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

function readUsingDataView(event) {
	performance.mark("laslaz-start");

	let buffer = event.data.buffer;

	let numPoints = event.data.numPoints;
	let pointSize = event.data.pointSize;
	let pointFormat = event.data.pointFormatID;
	let scale = event.data.scale;
	let offset = event.data.offset;

	let sourceUint8 = new Uint8Array(buffer);
	let sourceView = new DataView(buffer);

	let tightBoundingBox = {
		min: [
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY
		],
		max: [
			Number.NEGATIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			Number.NEGATIVE_INFINITY
		]
	};

	let mean = [0, 0, 0];

	let pBuff = new ArrayBuffer(numPoints * 3 * 4);
	let cBuff = new ArrayBuffer(numPoints * 4);
	let iBuff = new ArrayBuffer(numPoints * 4);
	let clBuff = new ArrayBuffer(numPoints);
	let rnBuff = new ArrayBuffer(numPoints);
	let nrBuff = new ArrayBuffer(numPoints);
	let psBuff = new ArrayBuffer(numPoints * 2);

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
	let twoByteColor = true;
	/*if (hasColor) {
		let r, g, b, pos;
		for (let i = 0; i < numPoints && !twoByteColor; ++i) {
			pos = i * pointSize;
			r = sourceView.getUint16(pos + co, true)
			g = sourceView.getUint16(pos + co + 2, true)
			b = sourceView.getUint16(pos + co + 4, true)
			if (r > 255 || g > 255 || b > 255) twoByteColor = true;
		}
	}*/

	for (let i = 0; i < numPoints; i++) {
		// POSITION
		let ux = sourceView.getInt32(i * pointSize + 0, true);
		let uy = sourceView.getInt32(i * pointSize + 4, true);
		let uz = sourceView.getInt32(i * pointSize + 8, true);

		x = ux * scale[0] + offset[0] - event.data.mins[0];
		y = uy * scale[1] + offset[1] - event.data.mins[1];
		z = uz * scale[2] + offset[2] - event.data.mins[2];

		positions[3 * i + 0] = x;
		positions[3 * i + 1] = y;
		positions[3 * i + 2] = z;

		mean[0] += x / numPoints;
		mean[1] += y / numPoints;
		mean[2] += z / numPoints;

		tightBoundingBox.min[0] = Math.min(tightBoundingBox.min[0], x);
		tightBoundingBox.min[1] = Math.min(tightBoundingBox.min[1], y);
		tightBoundingBox.min[2] = Math.min(tightBoundingBox.min[2], z);

		tightBoundingBox.max[0] = Math.max(tightBoundingBox.max[0], x);
		tightBoundingBox.max[1] = Math.max(tightBoundingBox.max[1], y);
		tightBoundingBox.max[2] = Math.max(tightBoundingBox.max[2], z);

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

	let attributes = {
		position: positions,
		color: colors,
		intensity: intensities,
		classification: classifications,
		returnNumber: returnNumbers,
		numberOfReturns: numberOfReturns,
		pointSourceID: pointSourceIDs
	}

	if (event.data.parentSize){
		let size = event.data.parentSize;

		let pos = event.data.parentAttributes.position;
		let i = event.data.parentIndex;

		if (i < 8){
			let count = 0;

			let index = (i & 2) | ((i & 1) << 2) | ((i & 4) >> 2);
			let arrays = [];

			for (let ii = 0; ii < pos.length; ii += 3){
				if (index == ((pos[ii] >= 0.5 ? 1 : 0) | (pos[ii + 1] >= 0.5 ? 2 : 0) | (pos[ii + 2] >= 0.5 ? 4 : 0))){
					count++;
				}
			}

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

				if (obj.pos){
					arrays.splice(0, 0, obj);
				}else{
					arrays.push(obj);
				}
			}

			let xoff = (index & 1) ? -0.5 : 0;
			let yoff = (index & 2) ? -0.5 : 0;
			let zoff = (index & 4) ? -0.5 : 0;

			for (let ii = 0; ii < pos.length / 3; ii++){
				if (index == ((pos[ii * 3] >= 0.5 ? 1 : 0) | (pos[ii * 3 + 1] >= 0.5 ? 2 : 0) | (pos[ii * 3 + 2] >= 0.5 ? 4 : 0))){
					for (let p of arrays){
						let off = ii * p.stride;

						if (p.pos){
							p.array[p.index++] = (p.parray[off + 0] + xoff) * size[0]
							p.array[p.index++] = (p.parray[off + 1] + yoff) * size[1]
							p.array[p.index++] = (p.parray[off + 2] + zoff) * size[2]
						}else{
							for (let iv = 0; iv < p.stride; iv++){
								p.array[p.index++] = p.parray[off + iv]
							}
						}
					}
				}
			}
		}
	}

	{
		let positions = attributes.position
		let min = event.data.bbmin;
		let max = event.data.bbmax;

		let off = [0, 0, 0]
		let size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];

		for (let i = 0; i < positions.length; i += 3){
			let x = positions[i + 0];
			let y = positions[i + 1];
			let z = positions[i + 2];

			positions[i + 0] = (x - off[0]) / size[0];
			positions[i + 1] = (y - off[1]) / size[1];
			positions[i + 2] = (z - off[2]) / size[2];
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
	let indices = new ArrayBuffer(len * 4);
	let iIndices = new Uint32Array(indices);
	for (let i = 0; i < len; i++) {
		iIndices[i] = i;
	}

	let message = {
		mean: mean,
		position: attributes.position.buffer,
		color: attributes.color.buffer,
		intensity: attributes.intensity.buffer,
		classification: attributes.classification.buffer,
		returnNumber: attributes.returnNumber.buffer,
		numberOfReturns: attributes.numberOfReturns.buffer,
		pointSourceID: attributes.pointSourceID.buffer,
		tightBoundingBox: tightBoundingBox,
		indices: indices
	};

	let transferables = [
		message.position,
		message.color,
		message.intensity,
		message.classification,
		message.returnNumber,
		message.numberOfReturns,
		message.pointSourceID,
		message.indices
	];

	postMessage(message, transferables);
};



onmessage = readUsingDataView;

