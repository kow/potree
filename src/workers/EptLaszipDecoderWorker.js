import LASDecoder from '../loader/las/LASDecoder';

let constructors = {
	'position': Float32Array,
	'color': Uint8Array,
	'intensity': Float32Array,
	'classification': Uint8Array,
	'returnNumber': Uint8Array,
	'numberOfReturns': Uint8Array,
	'pointSourceID': Uint16Array
}

let strides = {
	'position': 3,
	'color': 4,
	'intensity': 1,
	'classification': 1,
	'returnNumber': 1,
	'numberOfReturns': 1,
	'pointSourceID': 1
}

const Buffer = (typeof SharedArrayBuffer == 'undefined') ? ArrayBuffer : SharedArrayBuffer;

async function readUsingDataView(event) {
	performance.mark("laslaz-start");

	let req = await fetch (event.data.url);
	let decoder = new LASDecoder(await req.arrayBuffer());

	let sourceUint8 = await decoder.readPoints();
	let sourceView = new DataView(sourceUint8.buffer, sourceUint8.byteOffset, sourceUint8.byteLength);

	let numPoints = decoder.header.numPoints;
	let pointSize = decoder.header.dataStride;
	let pointFormat = decoder.header.dataFormat;
	let scale = decoder.header.pointScale;
	let offset = decoder.header.pointOffset;
	let mins = decoder.header.bounds.min;

	let pBuff = new Buffer(numPoints * 3 * 4);
	let cBuff = new Buffer(numPoints * 4);
	let iBuff = new Buffer(numPoints * 4);
	let clBuff = new Buffer(numPoints);
	let rnBuff = new Buffer(numPoints);
	let nrBuff = new Buffer(numPoints);
	let psBuff = new Buffer(numPoints * 2);

	let positions = new Float32Array(pBuff);
	let colors = new Uint8Array(cBuff);
	let intensities = new Float32Array(iBuff);
	let classifications = new Uint8Array(clBuff);
	let returnNumbers = new Uint8Array(rnBuff);
	let numberOfReturns = new Uint8Array(nrBuff);
	let pointSourceIDs = new Uint16Array(psBuff);

	// Point format 3 contains an 8-byte GpsTime before RGB values, so make
	// sure we have the correct color offset.
	let hasColor = pointFormat == 2 || pointFormat == 3;
	let co = pointFormat == 2 ? 20 : 28;

	// TODO This should be cached per-resource since this is an expensive check.
	let twoByteColor = false;
	if (hasColor) {
		let r, g, b, pos;
		for (let i = 0; i < numPoints && !twoByteColor; ++i) {
			pos = i * pointSize;
			r = sourceView.getUint16(pos + co, true)
			g = sourceView.getUint16(pos + co + 2, true)
			b = sourceView.getUint16(pos + co + 4, true)
			if (r > 255 || g > 255 || b > 255) twoByteColor = true;
		}
	}

	let min = event.data.bbmin;
	let max = event.data.bbmax;

	let size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]].map((e, i) => scale[i] / e);
	let off = offset.map((e, i) => (e - min[i]) / scale[i]);
	
	for (let i = 0; i < numPoints; i++) {
		// POSITION
		positions[3 * i + 0] = (sourceView.getInt32(i * pointSize + 0, true) + off[0]) * size[0];
		positions[3 * i + 1] = (sourceView.getInt32(i * pointSize + 4, true) + off[1]) * size[1];
		positions[3 * i + 2] = (sourceView.getInt32(i * pointSize + 8, true) + off[2]) * size[2];

		// INTENSITY
		let intensity = sourceView.getUint16(i * pointSize + 12, true);
		intensities[i] = intensity;

		// RETURN NUMBER, stored in the first 3 bits - 00000111
		// number of returns stored in next 3 bits	 - 00111000
		let returnNumberAndNumberOfReturns = sourceView.getUint8(i * pointSize + 14, true);
		let returnNumber = returnNumberAndNumberOfReturns & 0b0111;
		let numberOfReturn = (returnNumberAndNumberOfReturns & 0b00111000) >> 3;
		returnNumbers[i] = returnNumber;
		numberOfReturns[i] = numberOfReturn;

		// CLASSIFICATION
		let classification = sourceView.getUint8(i * pointSize + 15, true);
		classifications[i] = classification;

		// POINT SOURCE ID
		let pointSourceID = sourceView.getUint16(i * pointSize + 18, true);
		pointSourceIDs[i] = pointSourceID;

		// COLOR, if available
		if (hasColor) {
			let r = sourceView.getUint16(i * pointSize + co, true)
			let g = sourceView.getUint16(i * pointSize + co + 2, true)
			let b = sourceView.getUint16(i * pointSize + co + 4, true)

			if (twoByteColor) {
				r /= 256;
				g /= 256;
				b /= 256;
			}

			colors[4 * i + 0] = r;
			colors[4 * i + 1] = g;
			colors[4 * i + 2] = b;
			colors[4 * i + 3] = 255;
		}
	}

	sourceUint8.free();

	let attributes = {
		position: positions,
		color: colors,
		intensity: intensities,
		classification: classifications,
		returnNumber: returnNumbers,
		numberOfReturns: numberOfReturns,
		pointSourceID: pointSourceIDs
	}

	let pointCounts = [0, 0, 0, 0, 0, 0, 0, 0]

	//count all points and sort them into the 8 quadrents
	{
		let pos = positions;

		for (let i = 0; i < pos.length; i += 3){
			pointCounts[(pos[i] >= .5 ? 1 : 0) | (pos[i + 1] >= .5 ? 2 : 0) | (pos[i + 2] >= .5 ? 4 : 0)]++;
		}
	}

	if (event.data.parentAttributes){
		let pos = event.data.parentAttributes.position;
		let i = event.data.parentIndex;

		if (i < 8){
			let index = (i & 2) | ((i & 1) << 2) | ((i & 4) >> 2);
			let count = event.data.pointCounts[index];

			let arrays = [];

			for (let o in attributes){
				if (!constructors[o]) continue;

				let pnode = event.data.parentAttributes[o];
				let oarray = attributes[o];
				let narray = new constructors[o](oarray.length + count * strides[o])
				narray.set(oarray);

				attributes[o] = narray;

				let obj = {
					parray: pnode,
					array: narray,
					index: oarray.length,
					stride: strides[o],
					pos: o == 'position'
				};

				arrays.push(obj);
			}

			let xoff = (index & 1) ? -0.5 : 0;
			let yoff = (index & 2) ? -0.5 : 0;
			let zoff = (index & 4) ? -0.5 : 0;

			for (let p of arrays){
				if (p.pos){
					for (let ii = 0; ii < p.parray.length; ii += 3){
						p.array[p.index++] = (p.parray[ii + 0] + xoff) * 2
						p.array[p.index++] = (p.parray[ii + 1] + yoff) * 2
						p.array[p.index++] = (p.parray[ii + 2] + zoff) * 2
					}
				}else{
					p.array.set(p.parray, p.index)
				}
			}
		}
	}

	//count all points and sort them into the 8 quadrents
	{
		pointCounts.fill(0);
		let pos = attributes.position;

		for (let i = 0; i < pos.length; i += 3){
			pointCounts[(pos[i] >= .5 ? 1 : 0) | (pos[i + 1] >= .5 ? 2 : 0) | (pos[i + 2] >= .5 ? 4 : 0)]++;
		}

		let arrays = [];

		for (let o in attributes){
			if (o != 'position'){
				arrays.push({
					array: new constructors[o](attributes[o].buffer),
					stride: strides[o]
				});
			}
		}

		let offsets = [0], ooffsets = [];
		for (let i = 0; i < pointCounts.length; i++){
			let val = offsets[i] + pointCounts[i];
			offsets.push(val);
			ooffsets.push(val);
		}
		offsets.pop();

		//sort the points so that points in the same quadrent appear next to each other in memory
		let current = 0;
		while (current < 8){
			if (offsets[current] >= ooffsets[current]){
				current++;
				continue;
			}

			let i3 = offsets[current] * 3;

			let x = pos[i3 + 0];
			let y = pos[i3 + 1];
			let z = pos[i3 + 2];
			let quad = (x >= .5 ? 1 : 0) | (y >= .5 ? 2 : 0) | (z >= .5 ? 4 : 0);

			if (quad != current){
				{
					let dest = offsets[quad] * 3;

					pos[i3 + 0] = pos[dest + 0];
					pos[i3 + 1] = pos[dest + 1];
					pos[i3 + 2] = pos[dest + 2];
					pos[dest + 0] = x;
					pos[dest + 1] = y;
					pos[dest + 2] = z;
				}

				for (let i = 0; i < arrays.length; i++){
					let {array, stride} = arrays[i];
					
					let src = offsets[current] * stride;
					let dest = offsets[quad] * stride;

					for (let ii = 0; ii < stride; ii++){
						let temp = array[src + ii];
						array[src + ii] = array[dest + ii];
						array[dest + ii] = temp;
					}
				}

			}

			offsets[quad]++;
		}
	}

	performance.mark("laslaz-end");

	//{ // print timings
	//	  performance.measure("laslaz", "laslaz-start", "laslaz-end");
	//	  let measure = performance.getEntriesByType("measure")[0];
	//	  let dpp = 1000 * measure.duration / numPoints;
	//	  let debugMessage = `${measure.duration.toFixed(3)} ms, ${numPoints} points, ${dpp.toFixed(3)} µs / point`;
	//	  console.log(debugMessage);
	//}
	performance.clearMarks();
	performance.clearMeasures();

	let len = attributes.position.length / 3;
	let indices = new Buffer(len * 4);
	let iIndices = new Uint32Array(indices);
	for (let i = 0; i < len; i++) {
		iIndices[i] = i;
	}

	let message = {
		pointCounts,
		numPoints,
		mean: [off[0] + .5 / size[0], off[1] + .5 / size[1], off[2] + .5 / size[2]],
		position: attributes.position.buffer,
		color: attributes.color.buffer,
		intensity: attributes.intensity.buffer,
		classification: attributes.classification.buffer,
		returnNumber: attributes.returnNumber.buffer,
		numberOfReturns: attributes.numberOfReturns.buffer,
		pointSourceID: attributes.pointSourceID.buffer,
		indices: indices
	};

	let transferables = Buffer == ArrayBuffer ? [
		message.position,
		message.color,
		message.intensity,
		message.classification,
		message.returnNumber,
		message.numberOfReturns,
		message.pointSourceID,
		message.indices
	] : [];


	postMessage(message, transferables);
};



onmessage = async event => {
	try {
		await readUsingDataView(event);
	}catch (e){
		console.warn("Failed to decode: " + event.data.url + " due to " + e.toString() + e.stack);
		postMessage(null);
	}
};

