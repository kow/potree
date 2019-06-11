

import {PointCloudTreeNode} from "./PointCloudTree.js";
import {XHRFactory} from "./XHRFactory.js";
import {Utils} from "./utils.js";

export class PointCloudOctreeGeometry{

	constructor(){
		this.url = null;
		this.octreeDir = null;
		this.spacing = 0;
		this.boundingBox = null;
		this.root = null;
		this.nodes = null;
		this.pointAttributes = null;
		this.hierarchyStepSize = -1;
		this.loader = null;
	}
	
}

export class PointCloudOctreeGeometryNode extends PointCloudTreeNode{

	constructor(name, pcoGeometry, boundingBox){
		super();

		this.id = PointCloudOctreeGeometryNode.IDCount++;
		this.name = name;
		this.index = parseInt(name.charAt(name.length - 1));
		this.pcoGeometry = pcoGeometry;
		this.geometry = null;
		this.boundingBox = boundingBox;
		this.boundingSphere = boundingBox.getBoundingSphere(new THREE.Sphere());
		this.children = [];
		this.numPoints = 0;
		this.level = null;
		this.loaded = false;
		this.oneTimeDisposeHandlers = [];
	}

	isGeometryNode(){
		return true;
	}

	getLevel(){
		return this.level;
	}

	isTreeNode(){
		return false;
	}

	isLoaded(){
		return this.loaded;
	}

	getBoundingSphere(){
		return this.boundingSphere;
	}

	getBoundingBox(){
		return this.boundingBox;
	}

	getChildren(){
		let children = [];

		for (let i = 0; i < 8; i++) {
			if (this.children[i]) {
				children.push(this.children[i]);
			}
		}

		return children;
	}

	getBoundingBox(){
		return this.boundingBox;
	}

	getURL(){
		let url = '';

		let version = this.pcoGeometry.loader.version;

		if (version.equalOrHigher('1.5')) {
			url = this.pcoGeometry.octreeDir + '/' + this.getHierarchyPath() + '/' + this.name;
		} else if (version.equalOrHigher('1.4')) {
			url = this.pcoGeometry.octreeDir + '/' + this.name;
		} else if (version.upTo('1.3')) {
			url = this.pcoGeometry.octreeDir + '/' + this.name;
		}

		return url;
	}

	getHierarchyPath(){
		let path = 'r/';

		let hierarchyStepSize = this.pcoGeometry.hierarchyStepSize;
		let indices = this.name.substr(1);

		let numParts = Math.floor(indices.length / hierarchyStepSize);
		for (let i = 0; i < numParts; i++) {
			path += indices.substr(i * hierarchyStepSize, hierarchyStepSize) + '/';
		}

		path = path.slice(0, -1);

		return path;
	}

	addChild(child) {
		this.children[child.index] = child;
		child.parent = this;
	}

	async loadPoints(){
		if (this.pcoGeometry.loader.version.equalOrHigher('1.5') && (this.level % this.pcoGeometry.hierarchyStepSize) === 0 && this.hasChildren) {
			await this.loadHierachy();
		}

		return await this.pcoGeometry.loader.load(this);
	}

	async loadHierachy(){
		let node = this;
		if ((node.level % node.pcoGeometry.hierarchyStepSize) !== 0) return;

		// let hurl = node.pcoGeometry.octreeDir + "/../hierarchy/" + node.name + ".hrc";
		let hurl = node.pcoGeometry.octreeDir + '/' + node.getHierarchyPath() + '/' + node.name + '.hrc';

		let req = await fetch(hurl);
		let hbuffer = await req.arrayBuffer();

		let view = new DataView(hbuffer);

		let stack = [];
		let children = view.getUint8(0);
		let numPoints = view.getUint32(1, true);
		node.numPoints = numPoints;
		stack.push({children: children, numPoints: numPoints, name: node.name});

		let decoded = [];

		let offset = 5;
		while (stack.length > 0) {
			let snode = stack.shift();
			let mask = 1;
			for (let i = 0; i < 8; i++) {
				if ((snode.children & mask) !== 0) {
					let childName = snode.name + i;

					let childChildren = view.getUint8(offset);
					let childNumPoints = view.getUint32(offset + 1, true);

					stack.push({children: childChildren, numPoints: childNumPoints, name: childName});

					decoded.push({children: childChildren, numPoints: childNumPoints, name: childName});

					offset += 5;
				}

				mask = mask * 2;
			}

			if (offset === hbuffer.byteLength) {
				break;
			}
		}

		// console.log(decoded);

		let nodes = {};
		nodes[node.name] = node;
		let pco = node.pcoGeometry;

		for (let i = 0; i < decoded.length; i++) {
			let name = decoded[i].name;
			let decodedNumPoints = decoded[i].numPoints;
			let index = parseInt(name.charAt(name.length - 1));
			let parentName = name.substring(0, name.length - 1);
			let parentNode = nodes[parentName];
			let level = name.length - 1;
			let boundingBox = Utils.createChildAABB(parentNode.boundingBox, index);

			let currentNode = new PointCloudOctreeGeometryNode(name, pco, boundingBox);
			currentNode.level = level;
			currentNode.numPoints = decodedNumPoints;
			currentNode.hasChildren = decoded[i].children > 0;
			currentNode.spacing = pco.spacing / Math.pow(2, level);
			parentNode.addChild(currentNode);
			nodes[name] = currentNode;
		}
	}

	getNumPoints(){
		return this.numPoints;
	}

	dispose(){
		if (this.geometry && this.parent != null) {
			this.geometry.dispose();
			this.geometry = null;
			this.loaded = false;

			// this.dispatchEvent( { type: 'dispose' } );
			for (let i = 0; i < this.oneTimeDisposeHandlers.length; i++) {
				let handler = this.oneTimeDisposeHandlers[i];
				handler();
			}
			this.oneTimeDisposeHandlers = [];
		}

		if (this.webglBuffer) this.webglBuffer.dispose();
	}
	
}

PointCloudOctreeGeometryNode.IDCount = 0;
