
import {Points} from "./Points";

export class ProfileData {
	constructor (profile, pc) {
		this.profile = profile;

		this.segments = [];
		this.boundingBox = new THREE.Box3();

		for (let i = 0; i < profile.points.length - 1; i++) {
			let start = profile.points[i];
			let end = profile.points[i + 1];
			let center = new THREE.Vector3().addVectors(end, start).multiplyScalar(0.5);
			let up = profile.up || new THREE.Vector3(0, 0, 1);

			let length = start.distanceTo(end);
			let side = new THREE.Vector3().subVectors(end, start).normalize();
			let forward = new THREE.Vector3().crossVectors(side, up).normalize();
			let N = forward;
			let cutPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(N, start);
			let halfPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(side, center);

			let segment = {
				start: start,
				end: end,
				cutPlane: cutPlane,
				halfPlane: halfPlane,
				length: length,
				points: new Points()
			};

			this.segments.push(segment);
		}
	}

	size () {
		let size = 0;
		for (let segment of this.segments) {
			size += segment.points.numPoints;
		}

		return size;
	}
};

export class ProfileRequest {
	constructor (pointcloud, profile, maxDepth, callback) {
		this.pointcloud = pointcloud;
		this.profile = profile;
		this.maxDepth = maxDepth || Number.MAX_VALUE;
		this.callback = callback;
		this.temporaryResult = new ProfileData(this.profile, pointcloud);
		this.pointsServed = 0;
		this.highestLevelServed = 0;

		this.initialize();
	}

	update () {}

	initialize () {
		return this.load();
	}

	async loadNode (node){
		if (!node.loaded) await node.load();

		if (node.level <= this.maxDepth){
			// add points to result
			if (node.level == this.maxDepth || (this.maxDepth > node.level && !node.hasChildren)){
				this.getPointsInsideProfile(node, this.temporaryResult);
				
				if (this.temporaryResult.size() > 100) {
					this.pointsServed += this.temporaryResult.size();
					this.callback.onProgress({request: this, points: this.temporaryResult});
					this.temporaryResult = new ProfileData(this.profile, this.pointcloud);
				}

				this.highestLevelServed = Math.max(node.getLevel(), this.highestLevelServed);
			}

			exports.lru.touch(node);

			let children = [];

			for (let i = 0; i < 8; i++) {
				let child = node.children[i];
				
				if (child && this.pointcloud.nodeIntersectsProfile(child, this.profile)) {
					children.push(this.loadNode(child));
				}
			}

			await Promise.all(children);
		}
	}

	async load(){
		await this.loadNode(this.pointcloud.pcoGeometry.root);

		if (this.temporaryResult.size() > 0) {
			this.pointsServed += this.temporaryResult.size();
			this.callback.onProgress({request: this, points: this.temporaryResult});
			this.temporaryResult = new ProfileData(this.profile, this.pointcloud);
		}

		this.callback.onFinish({request: this});

		let index = this.pointcloud.profileRequests.indexOf(this);
		if (index >= 0) {
			this.pointcloud.profileRequests.splice(index, 1);
		}
	};

	getAccepted(numPoints, node, matrix, segment, segmentDir, points, totalMileage){
		let accepted = new Uint32Array(numPoints);
		let mileage = new Float64Array(numPoints);
		let acceptedPositions = new Float32Array(numPoints * 3);
		let numAccepted = 0;

		let pos = new THREE.Vector3();
		let svp = new THREE.Vector3();

		let view = new Float32Array(node.geometry.attributes.position.array);
		view = view.subarray(0, numPoints * 3)

		let bb = node.geometry.boundingBox;
		let size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];

		for (let i = 0; i < numPoints; i++) {
			pos.set(
				view[i * 3 + 0] * size[0],
				view[i * 3 + 1] * size[1],
				view[i * 3 + 2] * size[2]);
		
			pos.applyMatrix4(matrix);
			let distance = Math.abs(segment.cutPlane.distanceToPoint(pos));
			let centerDistance = Math.abs(segment.halfPlane.distanceToPoint(pos));

			if (distance < this.profile.width / 2 && centerDistance < segment.length / 2) {
				svp.subVectors(pos, segment.start);
				let localMileage = segmentDir.dot(svp);

				accepted[numAccepted] = i;
				mileage[numAccepted] = localMileage + totalMileage;
				points.boundingBox.expandByPoint(pos);

				acceptedPositions[3 * numAccepted + 0] = pos.x;
				acceptedPositions[3 * numAccepted + 1] = pos.y;
				acceptedPositions[3 * numAccepted + 2] = pos.z;

				numAccepted++;
			}
		}

		accepted = accepted.subarray(0, numAccepted);
		mileage = mileage.subarray(0, numAccepted);
		acceptedPositions = acceptedPositions.subarray(0, numAccepted * 3);

		//let end = performance.now();
		//let duration = end - start;
		//console.log("accepted duration ", duration)

		//console.log(`getAccepted finished`);

		return [accepted, mileage, acceptedPositions];
	}

	getPointsInsideProfile(node, target){
		let totalMileage = 0;
		let pointsProcessed = 0;

		let geometry = node.geometry;
		let numPoints = geometry.attributes.position.count;

		if(!numPoints){
			return;
		}

		for (let segment of target.segments) {

			{ // skip if current node doesn't intersect current segment
				let bbWorld = node.boundingBox.clone().applyMatrix4(this.pointcloud.matrixWorld);
				let bsWorld = bbWorld.getBoundingSphere(new THREE.Sphere());

				let start = new THREE.Vector3(segment.start.x, segment.start.y, bsWorld.center.z);
				let end = new THREE.Vector3(segment.end.x, segment.end.y, bsWorld.center.z);
					
				let closest = new THREE.Line3(start, end).closestPointToPoint(bsWorld.center, true, new THREE.Vector3());
				let distance = closest.distanceTo(bsWorld.center);

				let intersects = (distance < (bsWorld.radius + target.profile.width));

				if(!intersects){
					continue;
				}
			}

			//{// DEBUG
			//	console.log(node.name);
			//	let boxHelper = new Potree.Box3Helper(node.getBoundingBox());
			//	boxHelper.matrixAutoUpdate = false;
			//	boxHelper.matrix.copy(viewer.scene.pointclouds[0].matrixWorld);
			//	viewer.scene.scene.add(boxHelper);
			//}

			let sv = new THREE.Vector3().subVectors(segment.end, segment.start).setZ(0);
			let segmentDir = sv.clone().normalize();

			let points = new Points();

			let nodeMatrix = new THREE.Matrix4().makeTranslation(...node.boundingBox.min.toArray());

			let matrix = new THREE.Matrix4().multiplyMatrices(
				this.pointcloud.matrixWorld, nodeMatrix);

			pointsProcessed = pointsProcessed + numPoints;
			let [accepted, mileage, acceptedPositions] = this.getAccepted(numPoints, node, matrix, segment, segmentDir, points,totalMileage);
			points.data.position = acceptedPositions;

			let relevantAttributes = Object.keys(geometry.attributes).filter(a => !["position", "indices"].includes(a));
			for(let attributeName of relevantAttributes){
				let attribute = geometry.attributes[attributeName];
				let source = attribute.array;
				let numElements = attribute.itemSize;

				let filteredBuffer = new (source.constructor)(numElements * accepted.length);

				let target = filteredBuffer;

				for(let i = 0; i < accepted.length; i++){

					let index = accepted[i];
					
					let start = index * numElements;
					let end = start + numElements;
					let sub = source.subarray(start, end);

					target.set(sub, i * numElements);
				}

				points.data[attributeName] = filteredBuffer;
			}

			points.data['mileage'] = mileage;
			points.numPoints = accepted.length;

			segment.points.add(points);
			totalMileage += segment.length;
		}

		for (let segment of target.segments) {
			target.boundingBox.union(segment.points.boundingBox);
		}

		//console.log(`getPointsInsideProfile finished`);
	};

	finishLevelThenCancel () {
		if (this.cancelRequested) {
			return;
		}

		this.maxDepth = this.highestLevelServed;
		this.cancelRequested = true;

		//console.log(`maxDepth: ${this.maxDepth}`);
	};

	cancel () {
		this.callback.onCancel();

		let index = this.pointcloud.profileRequests.indexOf(this);
		if (index >= 0) {
			this.pointcloud.profileRequests.splice(index, 1);
		}
	};
}
