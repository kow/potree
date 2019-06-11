
import {ClipTask, ClipMethod} from "./defines";
import {Box3Helper} from "./utils/Box3Helper";

export function updatePointClouds(pointclouds, camera, renderer){
	for (let pointcloud of pointclouds) {
		let start = performance.now();

		for (let profileRequest of pointcloud.profileRequests) {
			profileRequest.update();

			let duration = performance.now() - start;
			if(duration > 5){
				break;
			}
		}

		let duration = performance.now() - start;
	}

	let result = updateVisibility(pointclouds, camera, renderer);

	for (let pointcloud of pointclouds) {
		pointcloud.updateMaterial(pointcloud.material, camera, renderer);
	}

	exports.lru.freeMemory();

	return result;
};



export function updateVisibilityStructures(pointclouds, camera, renderer) {
	let frustums = [];
	let camObjPositions = [];
	let priorityQueue = new BinaryHeap(function (x) { return 1 / x.weight; });
	
	for (let i = 0; i < pointclouds.length; i++) {
		let pointcloud = pointclouds[i];

		if (!pointcloud.initialized() || !pointcloud.viewMatrixWorld) {
			continue;
		}

		pointcloud.numVisiblePoints = 0;
		pointcloud.deepestVisibleLevel = 0;

		// frustum in object space
		//camera.updateMatrixWorld();
		let frustum = new THREE.Frustum();
		let viewI = pointcloud.viewMatrixWorldInv;
		let world = pointcloud.matrixWorld;
		
		// use close near plane for frustum intersection
		let frustumCam = camera.clone();
		frustumCam.near = Math.min(camera.near, 0.1);
		frustumCam.updateProjectionMatrix();
		let proj = camera.projectionMatrix;
		
		let fm = new THREE.Matrix4().multiply(proj).multiply(viewI).multiply(world);
		frustum.setFromMatrix(fm);
		frustums.push(frustum);

		// camera position in object space
		let view = pointcloud.viewMatrixWorld;
		let worldI = new THREE.Matrix4().getInverse(world);
		let camMatrixObject = new THREE.Matrix4().multiply(worldI).multiply(view);
		let camObjPos = new THREE.Vector3().setFromMatrixPosition(camMatrixObject);
		camObjPositions.push(camObjPos);
		
		if (pointcloud.visible && pointcloud.root !== null) {
			priorityQueue.push({pointcloud: i, node: pointcloud.root, weight: Number.MAX_VALUE});
		}

		// hide all previously visible nodes
		// if(pointcloud.root instanceof PointCloudOctreeNode){
		//	pointcloud.hideDescendants(pointcloud.root.sceneNode);
		// }
		if (pointcloud.root.isTreeNode()) {
			pointcloud.hideDescendants(pointcloud.root.sceneNode);
		}

		for (let j = 0; j < pointcloud.boundingBoxNodes.length; j++) {
			pointcloud.boundingBoxNodes[j].visible = false;
		}
	}

	return {
		'frustums': frustums,
		'camObjPositions': camObjPositions,
		'priorityQueue': priorityQueue
	};
};


export function updateVisibility(pointclouds, camera, renderer){
	let numVisiblePoints = 0;

	let unloadedGeometry = [];

	let lowestSpacing = Infinity;

	// calculate object space frustum and cam pos and setup priority queue
	let s = updateVisibilityStructures(pointclouds, camera, renderer);
	let frustums = s.frustums;
	let camObjPositions = s.camObjPositions;
	let priorityQueue = s.priorityQueue;

	let loadedToGPUThisFrame = 0;
	
	let domWidth = renderer.domElement.clientWidth;
	let domHeight = renderer.domElement.clientHeight;

	// check if pointcloud has been transformed
	// some code will only be executed if changes have been detected
	if(!Potree._pointcloudTransformVersion){
		Potree._pointcloudTransformVersion = new Map();
	}
	let pointcloudTransformVersion = Potree._pointcloudTransformVersion;
	for(let pointcloud of pointclouds){

		if(!pointcloud.visible){
			continue;
		}

		pointcloud.updateMatrixWorld();

		if(!pointcloudTransformVersion.has(pointcloud)){
			pointcloudTransformVersion.set(pointcloud, {number: 0, transform: pointcloud.matrixWorld.clone()});
		}else{
			let version = pointcloudTransformVersion.get(pointcloud);

			if(!version.transform.equals(pointcloud.matrixWorld)){
				version.number++;
				version.transform.copy(pointcloud.matrixWorld);

				pointcloud.dispatchEvent({
					type: "transformation_changed",
					target: pointcloud
				});
			}
		}
	}

	let nodesTouched = 0;

	while (priorityQueue.size() > 0) {
		nodesTouched++;

		let element = priorityQueue.pop();
		let node = element.node;
		let parent = element.parent;
		let pointcloud = pointclouds[element.pointcloud];

		// { // restrict to certain nodes for debugging
		//	let allowedNodes = ["r", "r0", "r4"];
		//	if(!allowedNodes.includes(node.name)){
		//		continue;
		//	}
		// }

		let box = node.getBoundingBox();
		let frustum = frustums[element.pointcloud];
		let camObjPos = camObjPositions[element.pointcloud];

		let insideFrustum = frustum.intersectsBox(box);
		let maxLevel = pointcloud.maxLevel || Infinity;
		let level = node.getLevel();
		let visible = insideFrustum;
		visible = visible && level < maxLevel;

		let clipBoxes = pointcloud.material.clipBoxes;
		if(true && clipBoxes.length > 0){

			//node.debug = false;

			let numIntersecting = 0;
			let numIntersectionVolumes = 0;

			//if(node.name === "r60"){
			//	var a = 10;
			//}

			for (let clipBox of clipBoxes){

				let pcWorldInverse = new THREE.Matrix4().getInverse(pointcloud.matrixWorld);
				let clipBoxMatrix = clipBox.matrixWorld

				if (Math.Vector && camera.controls && camera.controls.project){
					let p = camera.controls.project(pointcloud.projection);
					let mat = Math.mat4(clipBoxMatrix.elements);

					try {
						let origin = p(Math.vec3(0).multiply(mat));
						let x = p(Math.vec3(1, 0, 0).multiply(mat)).subtract(origin);
						let y = p(Math.vec3(0, 1, 0).multiply(mat)).subtract(origin);
						let z = p(Math.vec3(0, 0, 1).multiply(mat)).subtract(origin);

						clipBoxMatrix = new THREE.Matrix4();
						clipBoxMatrix.elements = Math.mat4(x, 0, y, 0, z, 0, origin, 1);
					}catch (e){}
				}

				let toPCObject = pcWorldInverse.multiply(clipBoxMatrix);

				let px = new THREE.Vector3(+0.5, 0, 0).applyMatrix4(pcWorldInverse);
				let nx = new THREE.Vector3(-0.5, 0, 0).applyMatrix4(pcWorldInverse);
				let py = new THREE.Vector3(0, +0.5, 0).applyMatrix4(pcWorldInverse);
				let ny = new THREE.Vector3(0, -0.5, 0).applyMatrix4(pcWorldInverse);
				let pz = new THREE.Vector3(0, 0, +0.5).applyMatrix4(pcWorldInverse);
				let nz = new THREE.Vector3(0, 0, -0.5).applyMatrix4(pcWorldInverse);

				let pxN = new THREE.Vector3().subVectors(nx, px).normalize();
				let nxN = pxN.clone().multiplyScalar(-1);
				let pyN = new THREE.Vector3().subVectors(ny, py).normalize();
				let nyN = pyN.clone().multiplyScalar(-1);
				let pzN = new THREE.Vector3().subVectors(nz, pz).normalize();
				let nzN = pzN.clone().multiplyScalar(-1);

				let pxPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(pxN, px);
				let nxPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(nxN, nx);
				let pyPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(pyN, py);
				let nyPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(nyN, ny);
				let pzPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(pzN, pz);
				let nzPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(nzN, nz);

				//if(window.debugdraw !== undefined && window.debugdraw === true && node.name === "r60"){

				//	Potree.utils.debugPlane(viewer.scene.scene, pxPlane, 1, 0xFF0000);
				//	Potree.utils.debugPlane(viewer.scene.scene, nxPlane, 1, 0x990000);
				//	Potree.utils.debugPlane(viewer.scene.scene, pyPlane, 1, 0x00FF00);
				//	Potree.utils.debugPlane(viewer.scene.scene, nyPlane, 1, 0x009900);
				//	Potree.utils.debugPlane(viewer.scene.scene, pzPlane, 1, 0x0000FF);
				//	Potree.utils.debugPlane(viewer.scene.scene, nzPlane, 1, 0x000099);

				//	Potree.utils.debugBox(viewer.scene.scene, box, new THREE.Matrix4(), 0x00FF00);
				//	Potree.utils.debugBox(viewer.scene.scene, box, pointcloud.matrixWorld, 0xFF0000);
				//	Potree.utils.debugBox(viewer.scene.scene, clipBox.box.boundingBox, clipBox.box.matrixWorld, 0xFF0000);

				//	window.debugdraw = false;
				//}

				let frustum = new THREE.Frustum(pxPlane, nxPlane, pyPlane, nyPlane, pzPlane, nzPlane);
				let intersects = frustum.intersectsBox(box);

				if(intersects){
					numIntersecting++;
				}
				numIntersectionVolumes++;
			}

			let insideAny = numIntersecting > 0;
			let insideAll = numIntersecting === numIntersectionVolumes;

			if(pointcloud.material.clipTask === ClipTask.SHOW_INSIDE){
				if(pointcloud.material.clipMethod === ClipMethod.INSIDE_ANY && insideAny){
					//node.debug = true
				}else if(pointcloud.material.clipMethod === ClipMethod.INSIDE_ALL && insideAll){
					//node.debug = true;
				}else{
					visible = false;
				}
			} else if(pointcloud.material.clipTask === ClipTask.SHOW_OUTSIDE){
				//if(pointcloud.material.clipMethod === ClipMethod.INSIDE_ANY && !insideAny){
				//	//visible = true;
				//	let a = 10;
				//}else if(pointcloud.material.clipMethod === ClipMethod.INSIDE_ALL && !insideAll){
				//	//visible = true;
				//	let a = 20;
				//}else{
				//	visible = false;
				//}
			}
			

		}

		if (node.spacing) {
			lowestSpacing = Math.min(lowestSpacing, node.spacing);
		} else if (node.geometryNode && node.geometryNode.spacing) {
			lowestSpacing = Math.min(lowestSpacing, node.geometryNode.spacing);
		}

		if (visible){
			let npoints = 0;

			if (level > (pointcloud.minRenderLevel || 0)){
				npoints = node.getNumPoints();
			}else if (level == (pointcloud.minRenderLevel || 0)){
				let n = node;

				while (n != null){
					npoints += n.getNumPoints();
					n = n.parent;
				}
			}

			if (numVisiblePoints + npoints > Potree.pointBudget) {
				visible = false;
			}else{
				numVisiblePoints += npoints;
			}
		}

		(node.geometryNode || node).visible = visible;
		if (!visible) {
			continue;
		}

		if (node.isGeometryNode() && (!parent || parent.isTreeNode())) {
			if (node.isLoaded()) {
				node = pointcloud.toTreeNode(node, parent);
			} else {
				if (level >= (pointcloud.minRenderLevel || 0)) unloadedGeometry.push(node);
			}
		}

		if (node.isTreeNode()) {
			exports.lru.touch(node.geometryNode);
			node.sceneNode.material = pointcloud.material;

			if(node._transformVersion === undefined){
				node._transformVersion = -1;
			}
			let transformVersion = pointcloudTransformVersion.get(pointcloud);
			if(node._transformVersion !== transformVersion.number){
				node.sceneNode.updateMatrix();
				node.sceneNode.matrixWorld.multiplyMatrices(pointcloud.matrixWorld, node.sceneNode.matrix);	
				node._transformVersion = transformVersion.number;
			}

			if (pointcloud.showBoundingBox && !node.boundingBoxNode && node.getBoundingBox) {
				let boxHelper = new Box3Helper(node.getBoundingBox());
				
				boxHelper.matrixAutoUpdate = false;
				pointcloud.boundingBoxNodes.push(boxHelper);
				node.boundingBoxNode = boxHelper;
				boxHelper.matrix.copy(pointcloud.matrixWorld);
			} else if (pointcloud.showBoundingBox) {
				node.boundingBoxNode.visible = true;
				node.boundingBoxNode.matrix.copy(pointcloud.matrixWorld);
			} else if (!pointcloud.showBoundingBox && node.boundingBoxNode) {
				node.boundingBoxNode.visible = false;
			}
		}

		// add child nodes to priorityQueue
		let children = node.getChildren();
		for (let i = 0; i < children.length; i++) {
			let child = children[i];

			let weight = 0; 
			if(camera.isPerspectiveCamera){
				let sphere = child.getBoundingSphere();
				let center = sphere.center;
				//let distance = sphere.center.distanceTo(camObjPos);
				
				let dx = camObjPos.x - center.x;
				let dy = camObjPos.y - center.y;
				let dz = camObjPos.z - center.z;
				
				let dd = dx * dx + dy * dy + dz * dz;
				let distance = Math.sqrt(dd);
				let radius = sphere.radius;
				
				let fov = (camera.fov * Math.PI) / 180;
				let slope = Math.tan(fov / 2);
				let projFactor = (0.5 * domHeight) / (slope * distance);
				let screenPixelRadius = radius * projFactor;
				
				if(screenPixelRadius < pointcloud.minimumNodePixelSize){
					continue;
				}
			
				weight = screenPixelRadius;

				//let levelWeight = pointcloud.levelWeight || 1000;

				//weight = -(distance - radius) + node.level * levelWeight;



				if(distance - radius < 0){
					weight = Number.MAX_VALUE;
				}
			} else {
				// TODO ortho visibility
				let bb = child.getBoundingBox();				
				let distance = child.getBoundingSphere().center.distanceTo(camObjPos);
				let diagonal = bb.max.clone().sub(bb.min).length();
				//weight = diagonal / distance;

				weight = diagonal;
			}

			priorityQueue.push({pointcloud: element.pointcloud, node: child, parent: node, weight: weight});
		}
	}// end priority queue loop

	/*{ // update DEM
		let maxDEMLevel = 4;
		let candidates = pointclouds
			.filter(p => (p.generateDEM && p.dem instanceof Potree.DEM));
		for (let pointcloud of candidates) {
			let updatingNodes = pointcloud.visibleNodes.filter(n => n.getLevel() <= maxDEMLevel);
			pointcloud.dem.update(updatingNodes);
		}
	}*/
	//console.log(numVisiblePoints)
	Potree.visiblePoints = numVisiblePoints;
	Potree.loadingProgress = (nodesTouched - unloadedGeometry.length) / nodesTouched;

	for (let i = 0; i < unloadedGeometry.length && Potree.nodesLoading.length + i < Potree.maxNodesLoading; i++) {
		unloadedGeometry[i].load();
	}

	return {
		numVisiblePoints: numVisiblePoints,
		lowestSpacing: lowestSpacing
	};
};
