import {XHRFactory} from "../../XHRFactory.js";

/**
 * laslaz code taken and adapted from plas.io js-laslaz
 *	  http://plas.io/
 *	https://github.com/verma/plasio
 *
 * Thanks to Uday Verma and Howard Butler
 *
 */

let constructors = {
	'position': Float32Array,
	'color': Uint8Array,
	'intensity': Float32Array,
	'classification': Uint8Array,
	'returnNumber': Uint8Array,
	'numberOfReturns': Uint8Array,
	'pointSourceID': Uint16Array,
	'indices': Uint8Array
}

let strides = {
	'position': 3,
	'color': 4,
	'intensity': 1,
	'classification': 1,
	'returnNumber': 1,
	'numberOfReturns': 1,
	'pointSourceID': 1,
	'indices': 4
}

export class EptLaszipLoader {
	async load(node) {
		if (node.loaded) return;

		let url = node.url() + '.laz';

		let req = await fetch (url);
		let buffer = await req.arrayBuffer();

		await this.parse(node, buffer);
	}

	async parse(node, buffer){
		let lf = new LASFile(buffer);

		let open = await lf.open();
		lf.isOpen = true;

		let header = await lf.getHeader();

		let i = 0;
		let np = header.pointsCount;

		let toArray = (v) => [v.x, v.y, v.z];
		let mins = toArray(node.key.b.min);
		let maxs = toArray(node.key.b.max);

		while (true) {
			let data = await lf.readData(1000000, 0, 1);

			let d = new LASDecoder(
					data.buffer,
					header.pointsFormatId,
					header.pointsStructSize,
					data.count,
					header.scale,
					header.offset,
					mins,
					maxs);
			d.extraBytes = header.extraBytes;
			d.pointsFormatId = header.pointsFormatId;
			await this.push(node, d);

			i += data.count;

			if (!data.hasMoreData) {
				header.totalRead = i;
				header.versionAsString = lf.versionAsString;
				header.isCompressed = lf.isCompressed;
				
				break;
			}
		}

		await lf.close();
		lf.isOpen = false;
	}

	async push(node, las) {
		let min = node.boundingBox.min;
		let max = node.boundingBox.max;

		let message = {
			buffer: las.arrayb,
			numPoints: las.pointsCount,
			pointSize: las.pointSize,
			pointFormatID: las.pointsFormatId,
			scale: las.scale,
			offset: las.offset,
			mins: las.mins,
			maxs: las.maxs,

			bbmin: [min.x, min.y, min.z],
			bbmax: [max.x, max.y, max.z]
		};

		let parent = node.parent;

		if (parent && parent.geometry){
			let min = parent.boundingBox.min;
			let max = parent.boundingBox.max;
			message.parentSize = [max.x - min.x, max.y - min.y, max.z - min.z];

			let i = 0;
			for (i = 0; i < 8; i++) if (parent.children[i] == node) break;

			message.parentIndex = i;
			message.parentAttributes = {}

			for (let o in parent.geometry.attributes){
				message.parentAttributes[o] = parent.geometry.attributes[o].array;
			}
		}

		let e = await Potree.workerPool.job(Potree.scriptPath + '/workers/EptLaszipDecoderWorker.js', message, [message.buffer])

		let numPoints = las.pointsCount;


		let g = new THREE.BufferGeometry();
		for (let o in e.data){
			if (!constructors[o]) continue;

			g.addAttribute(o, new THREE.BufferAttribute(new constructors[o](e.data[o]), strides[o]))
		}

		g.attributes.indices.normalized = true;
		g.attributes.color.normalized = true;

		let tightBoundingBox = new THREE.Box3(
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(1, 1, 1)
		);

		node.doneLoading(
				g,
				tightBoundingBox,
				numPoints,
				new THREE.Vector3(...e.data.mean));
	}
}