import Coder from './ICoder'

const formats = {
	0: [Coder.POINT10],
	1: [Coder.POINT10, Coder.GPS_TIME],
	2: [Coder.POINT10, Coder.RGB],
	3: [Coder.POINT10, Coder.GPS_TIME, Coder.RGB],
};

export default (header, src, processor) => {
	let stride = header.header.dataStride;
	let dataType = formats[header.header.dataFormat];
	if (stride - Coder.getSize(dataType) > 0) dataType = dataType.concat([255 | ((stride - Coder.getSize(dataType)) << 8)]);
	
	let last = null;

	let decoder;

	if (header.header.compressed){
		let chunkOffset = src.readUInt64LE();

		let laszipHeader = header.records.find(e => e.recordID == 22204 && e.userID == 'laszip encoded');
		decoder = Coder.createDecoder(dataType, header.header.numPoints, laszipHeader.chunkSize);
	}else{
		decoder = header.header.numPoints;
	}

	while (true) {
		let points;

		if (header.header.compressed){
			if (src.size == src.readBytes){
				points = decoder.destroy();
			}else{
				let data = src.read(Math.min(1024 * 128, src.size - src.readBytes));
				points = decoder.decode(data);
			}
		}else{
			let p = Math.min(decoder, 2048);
			points = src.read(stride * p)
			decoder -= p;
		}

		processor (points, stride);

		if (header.header.compressed){
			if (points.points == 0){
				Coder.free(points);
				decoder.destroy();
				break;
			}
		}else{
			if (decoder == 0) break;
		}
	}
}