

import {PointAttributeNames} from "./PointAttributes.js";
import {Version} from "../Version.js";
import {XHRFactory} from "../XHRFactory.js";

let names = {
	[PointAttributeNames.POSITION_CARTESIAN]: 'position',
	[PointAttributeNames.COLOR_PACKED]: 'color',
	[PointAttributeNames.CLASSIFICATION]: 'classification',
	[PointAttributeNames.RETURN_NUMBER]: 'returnNumber',
	[PointAttributeNames.NUMBER_OF_RETURNS]: 'numberOfReturns',
	[PointAttributeNames.SOURCE_ID]: 'pointSourceID',
	[PointAttributeNames.NORMAL_SPHEREMAPPED]: 'normal',
	[PointAttributeNames.NORMAL_OCT16]: 'normal',
	[PointAttributeNames.NORMAL]: 'normal',
	[PointAttributeNames.SPACING]: 'spacing',
	[PointAttributeNames.GPS_TIME]: 'gpsTime'
}

let constructors = {
	[PointAttributeNames.POSITION_CARTESIAN]: Float32Array,
	[PointAttributeNames.COLOR_PACKED]: Uint8Array,
	[PointAttributeNames.CLASSIFICATION]: Float32Array,
	[PointAttributeNames.RETURN_NUMBER]: Uint8Array,
	[PointAttributeNames.NUMBER_OF_RETURNS]: Uint8Array,
	[PointAttributeNames.SOURCE_ID]: Uint16Array,
	[PointAttributeNames.NORMAL_SPHEREMAPPED]: Float32Array,
	[PointAttributeNames.NORMAL_OCT16]: Float32Array,
	[PointAttributeNames.NORMAL]: Float32Array,
	[PointAttributeNames.SPACING]: Float32Array,
	[PointAttributeNames.GPS_TIME]: Float32Array
}

let strides = {
	[PointAttributeNames.POSITION_CARTESIAN]: 3,
	[PointAttributeNames.COLOR_PACKED]: 4,
	[PointAttributeNames.CLASSIFICATION]: 1,
	[PointAttributeNames.RETURN_NUMBER]: 1,
	[PointAttributeNames.NUMBER_OF_RETURNS]: 1,
	[PointAttributeNames.SOURCE_ID]: 1,
	[PointAttributeNames.NORMAL_SPHEREMAPPED]: 3,
	[PointAttributeNames.NORMAL_OCT16]: 3,
	[PointAttributeNames.NORMAL]: 3,
	[PointAttributeNames.SPACING]: 1,
	[PointAttributeNames.GPS_TIME]: 1
}

export class BinaryLoader{

	constructor(version, boundingBox, scale){
		if (typeof (version) === 'string') {
			this.version = new Version(version);
		} else {
			this.version = version;
		}

		this.boundingBox = boundingBox;
		this.scale = scale;
	}

	async load(node){
		if (node.loaded) {
			return;
		}

		let url = node.getURL();

		if (this.version.equalOrHigher('1.4')) {
			url += '.bin';
		}

		let req = await fetch(url);
		req = await req.arrayBuffer();

		await this.parse(node, req);
	};

	async parse(node, buffer){
		let pointAttributes = node.pcoGeometry.pointAttributes;
		let numPoints = buffer.byteLength / node.pcoGeometry.pointAttributes.byteSize;

		if (this.version.upTo('1.5')) {
			node.numPoints = numPoints;
		}

		let workerPath = Potree.scriptPath + '/workers/BinaryDecoderWorker.js';

		let message = {
			buffer: buffer,
			pointAttributes: pointAttributes,
			version: this.version.version,
			min: [ node.boundingBox.min.x, node.boundingBox.min.y, node.boundingBox.min.z ],
			offset: [node.pcoGeometry.offset.x, node.pcoGeometry.offset.y, node.pcoGeometry.offset.z],
			scale: this.scale,
			spacing: node.spacing,
			hasChildren: node.hasChildren,
			name: node.name
		};

		let e = await Potree.workerPool.job(workerPath, message, [message.buffer]);

		let data = e.data;
		let buffers = Object.create(data.attributeBuffers);
		let parent = node.parent;

		//count all points and sort them into the 8 quadrents
		{
			let pointCounts = node.pointCounts = [0, 0, 0, 0, 0, 0, 0, 0]
			let pos = new Float32Array(buffers[PointAttributeNames.POSITION_CARTESIAN].buffer);

			let min = node.boundingBox.min;
			let max = node.boundingBox.max;
			let bx = (max.x - min.x) / 2;
			let by = (max.y - min.y) / 2;
			let bz = (max.z - min.z) / 2;

			for (let i = 0; i < pos.length; i += 3){
				pointCounts[(pos[i] >= bx ? 1 : 0) | (pos[i + 1] >= by ? 2 : 0) | (pos[i + 2] >= bz ? 4 : 0)]++;
			}
		}
		
		if (parent){
			let min = parent.boundingBox.min;
			let max = parent.boundingBox.max;
			let size = [max.x - min.x, max.y - min.y, max.z - min.z];

			let pos = parent.geometry.attributes.position.array;
			let i;
			for (i = 0; i < 8; i++) if (parent.children[i] == node) break;

			if (i < 8){
				let index = (i & 2) | ((i & 1) << 2) | ((i & 4) >> 2);
				let count = parent.pointCounts[index];

				let arrays = [];

				for (let o in buffers){
					let pnode = parent.geometry.attributes[names[o]].array;
					let oarray = new constructors[o](buffers[o].buffer);
					let narray = new constructors[o](oarray.length + count * strides[o])
					narray.set(oarray);

					buffers[o] = narray;

					let obj = {
						parray: pnode,
						array: narray,
						index: oarray.length,
						stride: strides[o],
						pos: o == PointAttributeNames.POSITION_CARTESIAN
					};

					if (obj.pos){
						arrays.splice(0, 0, obj);
					}else{
						arrays.push(obj);
					}
				}

				let xoff = (index & 1) ? -.5 : 0;
				let yoff = (index & 2) ? -.5 : 0;
				let zoff = (index & 4) ? -.5 : 0;

				for (let p of arrays){
					let off = 0;
					for (let ii = 0; ii < index; ii++) off += parent.pointCounts[ii];

					if (p.pos){
						for (let ii = off; ii < off + count; ii++){
							let i3 = ii * 3;

							p.array[p.index++] = (p.parray[i3 + 0] + xoff) * size[0]
							p.array[p.index++] = (p.parray[i3 + 1] + yoff) * size[1]
							p.array[p.index++] = (p.parray[i3 + 2] + zoff) * size[2]
						}
					}else{
						p.array.set(p.parray.subarray(off * p.stride, (off + count) * p.stride), p.index)
					}
				}
			}
		}

		//count all points and sort them into the 8 quadrents
		{
			let pointCounts = node.pointCounts = [0, 0, 0, 0, 0, 0, 0, 0]
			let pos = new Float32Array(buffers[PointAttributeNames.POSITION_CARTESIAN].buffer);

			let min = node.boundingBox.min;
			let max = node.boundingBox.max;
			let bx = (max.x - min.x) / 2;
			let by = (max.y - min.y) / 2;
			let bz = (max.z - min.z) / 2;

			for (let i = 0; i < pos.length; i += 3){
				pointCounts[(pos[i] >= bx ? 1 : 0) | (pos[i + 1] >= by ? 2 : 0) | (pos[i + 2] >= bz ? 4 : 0)]++;
			}

			let arrays = [];

			for (let o in buffers){
				if (o != PointAttributeNames.POSITION_CARTESIAN){
					arrays.push({
						array: new constructors[o](buffers[o].buffer),
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
				let quad = (x >= bx ? 1 : 0) | (y >= by ? 2 : 0) | (z >= bz ? 4 : 0);

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

		let geometry = new THREE.BufferGeometry();

		for(let property in buffers){
			let buffer = buffers[property].buffer;
			property = parseInt(property);
			
			if (property === PointAttributeNames.POSITION_CARTESIAN) {
				buffer = new Float32Array(buffer);

				//normalize geometry to 0 - 1
				{
					let min = node.boundingBox.min;
					let max = node.boundingBox.max;
					
					let off = [0, 0, 0]
					let size = [max.x - min.x, max.y - min.y, max.z - min.z];
					
					for (let i = 0; i < buffer.length; i += 3){
						buffer[i + 0] = (buffer[i + 0] - off[0]) / size[0];
						buffer[i + 1] = (buffer[i + 1] - off[1]) / size[1];
						buffer[i + 2] = (buffer[i + 2] - off[2]) / size[2];
					}
				}


				{
					let ib = new Uint32Array(buffer.length / 3);
					for (let i = 0; i < ib.length; i++) ib[i] = i;

					let bufferAttribute = new THREE.BufferAttribute(new Uint8Array(ib.buffer), 4);
					bufferAttribute.normalized = true;
					geometry.addAttribute('indices', bufferAttribute)
				}

				buffer = new THREE.BufferAttribute(buffer, 3);
			} else if (property === PointAttributeNames.COLOR_PACKED) {
				buffer = new THREE.BufferAttribute(new Uint8Array(buffer), 4, true);
			} else if (property === PointAttributeNames.INTENSITY) {
				buffer = new THREE.BufferAttribute(new Float32Array(buffer), 1);
			} else if (property === PointAttributeNames.CLASSIFICATION) {
				buffer = new THREE.BufferAttribute(new Uint8Array(buffer), 1);
			} else if (property === PointAttributeNames.RETURN_NUMBER) {
				buffer = new THREE.BufferAttribute(new Uint8Array(buffer), 1);
			} else if (property === PointAttributeNames.NUMBER_OF_RETURNS) {
				buffer = new THREE.BufferAttribute(new Uint8Array(buffer), 1);
			} else if (property === PointAttributeNames.SOURCE_ID) {
				buffer = new THREE.BufferAttribute(new Uint16Array(buffer), 1);
			} else if (property === PointAttributeNames.NORMAL_SPHEREMAPPED) {
				buffer = new THREE.BufferAttribute(new Float32Array(buffer), 3);
			} else if (property === PointAttributeNames.NORMAL_OCT16) {
				buffer = new THREE.BufferAttribute(new Float32Array(buffer), 3);
			} else if (property === PointAttributeNames.NORMAL) {
				buffer = new THREE.BufferAttribute(new Float32Array(buffer), 3);
			} else if (property === PointAttributeNames.SPACING) {
				let bufferAttribute = new THREE.BufferAttribute(new Float32Array(buffer), 1);
				buffer = bufferAttribute;
			} else if (property === PointAttributeNames.GPS_TIME) {
				let bufferAttribute = new THREE.BufferAttribute(new Float32Array(buffer), 1);
				buffer = bufferAttribute;

				node.gpsTime = {
					offset: buffers[property].offset,
					range: buffers[property].range,
				};
			}

			geometry.addAttribute(names[property], buffer)
		}
		
		node.numPoints = numPoints;
		node.geometry = geometry;
		node.mean = new THREE.Vector3(...data.mean);
		node.tightBoundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
		node.estimatedSpacing = data.estimatedSpacing;
		//node.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
	};

	
}

