

import { EventDispatcher } from "./EventDispatcher";


export class PointCloudTreeNode extends EventDispatcher{

	constructor(){
		super();
		this.needsTransformUpdate = true;
	}

	getChildren () {
		throw new Error('override function');
	}

	getBoundingBox () {
		throw new Error('override function');
	}

	isLoaded () {
		throw new Error('override function');
	}

	isGeometryNode () {
		throw new Error('override function');
	}

	isTreeNode () {
		throw new Error('override function');
	}

	getLevel () {
		throw new Error('override function');
	}

	getBoundingSphere () {
		throw new Error('override function');
	}

	async load(){
		if (this.loaded) return;
		if (this.parent && !this.parent.loaded) await this.parent.load();
		if (this.loading) {
			await this.loading;
			return;
		}

		if (!Potree.nodesLoading) Potree.nodesLoading = [];

		this.loading = (async () => {
			await new Promise(ok => setTimeout(ok))

			while (Potree.nodesLoading.length >= Potree.maxNodesLoading){
				await Promise.race(Potree.nodesLoading.slice());
			}
			
			Potree.nodesLoading.push(this.loading);
			Potree.numNodesLoading++;

			await this.loadPoints();
			
			Potree.nodesLoading.splice(Potree.nodesLoading.indexOf(this.loading), 1)
			this.loaded = true;
			this.loading = null;
			Potree.numNodesLoading--;

		})();

		await this.loading;
	}
};

export class PointCloudTree extends THREE.Object3D {
	constructor () {
		super();
	}

	initialized () {
		return this.root !== null;
	}
};
