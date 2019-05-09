import BoundingBox from './BoundingBox'
import LAZRecord from './records/LAZRecord'
import WKTProjection from './records/WKTProjection'
import Stream from './Stream'
import Coder from './ICoder'

const formats = {
	0: [Coder.POINT10],
	1: [Coder.POINT10, Coder.GPS_TIME],
	2: [Coder.POINT10, Coder.RGB],
	3: [Coder.POINT10, Coder.GPS_TIME, Coder.RGB],
};

const recordParsers = [
	LAZRecord,
	WKTProjection
]

const months = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 333];
const globalEncodings = ['GPSTimeType', 'WaveformDataPacketInternal', 'WaveformDataPacketExternal', 'ReturnSynthetic', 'WKT'];

const readString = bytes => {
	let s = "";

	for (let i = 0; i < bytes.length; i++){
		let b = bytes[i];

		if (b == 0){
			break;
		}else{
			s += String.fromCharCode(b);
		}
	}

	return s;
}

const writeString = (s, len) => {
	let bytes = new Uint8Array(len);
	let i = 0;

	for (; i < s.length; i++){
		bytes[i] = s.charCodeAt(i);
	}

	return bytes;
}

class LASDecoder {
	constructor (stream){
		this.header = {
			fileSourceID: 0,
			globalEncoding: {},
			projectID: [0, 0, 0, ''],
			version: {major: 1, minor: 2},
			systemIdentifier: '',
			generatingSoftware: '',
			date: new Date(),
			compressed: false,
			dataFormat: 0,
			dataStride: 20,
			numPoints: 0,
			numPointsByReturn: [],
			bounds: new BoundingBox(),
		}
		this.records = [];
		this.stream = new Stream(stream);
		
		this.readHeader(this.stream);
	}

	get bounds () {
		return this.header.bounds;
	}

	set bounds (v) {
		this.header.bounds = v;
	}

	readHeader (stream) {
		let numRecords;

		stream.seek(0);

		(function () {
			if (readString(stream.read(4)) != 'LASF') throw new Error('not a las/laz file');

			this.fileSourceID = stream.readUInt16LE();
			this.globalEncoding = (bits => {
				let e = {};

				for (let i = 0; i < globalEncodings.length; i++){
					e[globalEncodings[i]] = (bits & (1 << i)) ? true : false;
				}

				return e;
			})(stream.readUInt16LE());
			this.projectID = [
				stream.readUInt32LE(),
				stream.readUInt16LE(),
				stream.readUInt16LE(),
				readString(stream.read(8))
			]

			this.version = {
				major: stream.readUInt8(),
				minor: stream.readUInt8()
			}

			this.systemIdentifier = readString(stream.read(32));
			this.generatingSoftware = readString(stream.read(32));

			{
				let dayOfYear = stream.readUInt16LE();
				let year = stream.readUInt16LE();

				let month = 0;
				for (let i = 1; i < months.length; i++){
					if (months[i] < dayOfYear){
						month++;
					}else{
						break;
					}
				}

				this.date = new Date(year, month, dayOfYear - months[month]);
			}

			let headerSize = stream.readUInt16LE();
			this.offsetToPointData = stream.readUInt32LE();
			numRecords = stream.readUInt32LE();

			this.dataFormat = stream.readUInt8();
			this.compressed = !!(this.dataFormat & 0x80);
			this.dataFormat = this.dataFormat & 0x3F;

			this.dataStride = stream.readUInt16LE();
			this.numPoints = stream.readUInt32LE();

			{
				this.numPointsByReturn = [];

				for (let i = 0; i < 5; i++) this.numPointsByReturn.push(stream.readUInt32LE());
			}

			this.pointScale = [stream.readDoubleLE(), stream.readDoubleLE(), stream.readDoubleLE()];
			this.pointOffset = [stream.readDoubleLE(), stream.readDoubleLE(), stream.readDoubleLE()];

			{
				let maxx = stream.readDoubleLE();
				let minx = stream.readDoubleLE();
				let maxy = stream.readDoubleLE();
				let miny = stream.readDoubleLE();
				let maxz = stream.readDoubleLE();
				let minz = stream.readDoubleLE();

				this.bounds = new BoundingBox([minx, miny, minz], [maxx, maxy, maxz]);
			}

			if (this.version.major > 1 || (this.version.major == 1 && this.version.minor >= 4)){
				let startWaveform = stream.readUInt64LE();
				let start = stream.readUInt64LE();
				let num = stream.readUInt64LE();

				this.numPoints = stream.readUInt64LE();

				for (let i = 0; i < 15; i++) this.numPointsByReturn[i] = stream.readUInt64LE();
			}

			stream.seek(headerSize);
		}).call(this.header = {});

		this.records = [];

		main:for (let i = 0; i < numRecords; i++){
			stream.skip(2);
			let userID = readString(stream.read(16));
			let recordID = stream.readUInt16LE();
			let length = stream.readUInt16LE();
			let description = readString(stream.read(32));

			let record = {
				userID,
				recordID,
				description,
				extended: false
			};

			this.records.push(record);

			for (let o of recordParsers){
				let parser = o(record);

				if (parser) {
					let pos = stream.pos;

					parser.decode(stream, length);

					stream.seek(pos + length);
					continue main;
				}
			}

			record.data = stream.read(length);
		}
	}

	/*
		to prevent needless memory copy operations, the buffer returned is owned by the web assembly instance and .free must be called on the
		returned buffer to free the memory from the web assembly instance.
	*/
	async readPoints () {
		let stride = this.header.dataStride;
		let dataType = formats[this.header.dataFormat];
		if (stride - Coder.getSize(dataType) > 0) dataType = dataType.concat([255 | ((stride - Coder.getSize(dataType)) << 8)]);
		
		let last = null;

		this.stream.seek(this.header.offsetToPointData);

		if (this.header.compressed){
			let chunkOffset = this.stream.readUInt64LE();

			let laszipHeader = this.records.find(e => e.recordID == 22204 && e.userID == 'laszip encoded');
			let decoder = await Coder.createDecoder(dataType, this.header.numPoints, laszipHeader.chunkSize);

			decoder.decode(this.stream.read(this.stream.remaining));
			return decoder.destroy();
		}else{
			return this.stream.read(this.header.numPoints * stride)
		}
	}
}

export default LASDecoder;