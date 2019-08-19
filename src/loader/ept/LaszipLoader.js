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

		await this.parse(node, url);
	}

	async parse(node, url){
		let min = node.boundingBox.min;
		let max = node.boundingBox.max;

		let message = {
			url,
			bbmin: [min.x, min.y, min.z],
			bbmax: [max.x, max.y, max.z],
		};

		let parent = node.parent;

		if (parent && parent.geometry){
			let i = 0;
			for (i = 0; i < 8; i++) if (parent.children[i] == node) break;
			let index = (i & 2) | ((i & 1) << 2) | ((i & 4) >> 2);

			message.parentIndex = i;
			message.parentAttributes = {}
			message.pointCounts = node.parent.pointCounts

			let count = node.parent.pointCounts[index];
			let off = 0;
			for (let ii = 0; ii < index; ii++) off += node.parent.pointCounts[ii];

			for (let o in parent.geometry.attributes){
				if (o == 'indices') continue;

				message.parentAttributes[o] = parent.geometry.attributes[o].array.subarray(off * strides[o], (off + count) * strides[o]);
			}
		}

		let e = await Potree.workerPool.job(Potree.scriptPath + '/workers/EptLaszipDecoderWorker.js', message);

		if (!e.data) return;

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

		node.pointCounts = e.data.pointCounts;
		node.density = e.data.density;

		node.doneLoading(
				g,
				tightBoundingBox,
				e.data.numPoints,
				new THREE.Vector3(...e.data.mean));
	}
}