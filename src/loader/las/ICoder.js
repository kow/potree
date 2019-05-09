import Module from './coder'

let loaded = new Promise (ok => {
	Module.onRuntimeInitialized = () => ok();
});

const UCHAR = 1;
const CHAR = 2;
const USHORT = 3;
const SHORT = 4;
const UINT = 5;
const INT = 6;

const XYZ = 128;
const RGB = 129;
const GPS_TIME = 130;
const POINT10 = 131;

const malloc = size => {
	let buf = Module._malloc(size);

	let view = Module.HEAPU8.subarray(buf, buf + size);
	view.bufferLocation = buf;

	return view;
}

const free = buf => {
	if (typeof buf == 'number'){
		Module._free(buf);
	}else if (buf.bufferLocation){
		Module._free(buf.bufferLocation);
	}
}

const cwrap = (name, ret, params) => {
	const func = Module.cwrap(name, ret, params);

	return (...args) => {
		let clear = [];

		for (let i = 0; i < args.length; i++){
			if (ArrayBuffer.isView(args[i])){
				if (args[i].bufferLocation){
					args[i] = args[i].bufferLocation;
				}else{
					let abuf = new Uint8Array(args[i].buffer, args[i].byteOffset, args[i].byteLength);
					let buf = malloc(abuf.length)
					buf.set(abuf);
					clear.push(buf);

					args[i] = buf.bufferLocation;
				}
			}
		}

		let res = func(...args);

		clear.forEach(free);

		return res;
	}
}

const getSize = (fields) => {
	let size = 0;

	for (let o of fields){
		if (o == UCHAR || o == CHAR) size += 1;
		else if (o == USHORT || o == SHORT) size += 2;
		else if (o == UINT || o == INT) size += 4;
		else if (o == XYZ) size += 12;
		else if (o == RGB) size += 6;
		else if (o == GPS_TIME) size += 8;
		else if (o == POINT10) size += 20;
		else if (o == 255) size += (o >> 8);
	}

	return size;
}

const buffer = (() => {
	const sizeFunc = cwrap('size', 'number', ['number'])
	const bufFunc = cwrap('buf', 'number', ['number']);
	const pointsFunc = cwrap('points', 'number', ['number']);

	return ptr => {
		let buf = bufFunc(ptr);
		let size = sizeFunc(ptr);
		let points = pointsFunc(ptr);
		free (ptr);

		let view = Module.HEAPU8.subarray(buf, buf + size);
		view.points = points;
		view.bufferLocation = buf;

		view.free = () => {
			free(buf);
		}

		return view;
	}
})()

const genFields = fields => {
	let m = malloc(fields.length * 4 + 4);
	let buf = new Uint32Array(m.buffer, m.byteOffset, m.byteLength);

	for (let i = 0; i < fields.length; i++){
		buf[i] = fields[i];
	}

	return m;
}

const createDecoder = (() => {
	const create = cwrap('createDecoder', 'number', ['number', 'number', 'number']);
	const destroy = cwrap('destroyDecoder', 'number', ['number']);
	const reset = cwrap('resetDecoder', null, ['number'])
	const decode = cwrap('decode', 'number', ['number',  'number', 'number'])

	return async (fields, numPoints, chunkSize = 50000) => {
		await loaded;

		fields = genFields(fields);
		let decoder = create(fields, numPoints, chunkSize);

		return {
			decode (buf){
				let result = buffer(decode(decoder, buf, buf.length));

				return result;
			},

			destroy () {
				if (!decoder) return;

				let result = buffer(destroy(decoder));
				decoder = null;

				free(fields);
				return result;
			},

			reset (){
				reset(decoder);
			}
		}
	}
})()

const createEncoder = (() => {
	const create = cwrap('createEncoder', 'number', ['number', 'number']);
	const destroy = cwrap('destroyEncoder', 'number', ['number']);
	const reset = cwrap('resetEncoder', null, ['number'])
	const encode = cwrap('encode', 'number', ['number',  'number', 'number'])

	return async (fields, chunkSize = 50000) => {
		await loaded;
		
		let stride = getSize(fields);
		fields = genFields(fields);
		let encoder = create(fields, chunkSize);

		return {
			encode (buf){
				return buffer(encode(encoder, buf, buf.length / stride));
			},

			destroy () {
				if (!encoder) return;

				let result = buffer(destroy(encoder));
				encoder = null;
				
				free(fields);
				return result;
			},

			reset (){
				reset(encoder);
			}
		}
	}
})();

export default {
	createDecoder, 
	createEncoder,
	malloc,
	free,
	getSize,

	UCHAR, CHAR,
	USHORT, SHORT,
	UINT, INT,
	XYZ, RGB, GPS_TIME,
	POINT10
};

/*const concat = (...arrays) => {
	let count = arrays.reduce((a, b) => a + b.length, 0);
	
	let a = new Uint8Array(count);
	let off = 0;

	arrays.forEach(e => {
		a.set(e, off)
		off += e.length;
	})

	return a;
}

setTimeout (() => {
	let points = 1000000;
	let format = [POINT10, GPS_TIME, RGB];

	let src = new Uint8Array(points * getSize(format));
	for (let i = 0; i < src.length; i++) src[i] = i;
	
	
	let encoder = createEncoder(format);
	let encoded1 = new Uint8Array(encoder.encode(src));
	let encoded3 = new Uint8Array(encoder.destroy());

	let encoded = concat(encoded1, encoded3);
	console.log('encoded', encoded.length);

	let decoder = createDecoder(format, points);
	let decoded = concat (new Uint8Array(decoder.decode(encoded)), decoder.destroy());

	console.log('decoded', decoded.length)
}, 100)*/
