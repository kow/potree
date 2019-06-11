
import {PointCloudTree, PointCloudTreeNode} from "./PointCloudTree.js";
import {PointCloudOctreeGeometryNode} from "./PointCloudOctreeGeometry.js";
import {Utils} from "./utils.js";
import {PointCloudMaterial} from "./materials/PointCloudMaterial.js";


export class PointCloudOctreeNode extends PointCloudTreeNode {
	constructor () {
		super();

		//this.children = {};
		this.children = [];
		this.sceneNode = null;
		this.octree = null;
	}

	getNumPoints () {
		return this.geometryNode.numPoints;
	}

	isLoaded () {
		return true;
	}

	isTreeNode () {
		return true;
	}

	isGeometryNode () {
		return false;
	}

	getLevel () {
		return this.geometryNode.level;
	}

	getBoundingSphere () {
		return this.geometryNode.boundingSphere;
	}

	getBoundingBox () {
		return this.geometryNode.boundingBox;
	}

	getChildren () {
		let children = [];

		for (let i = 0; i < 8; i++) {
			if (this.children[i]) {
				children.push(this.children[i]);
			}
		}

		return children;
	}

	get name () {
		return this.geometryNode.name;
	}
};

export class PointCloudOctree extends PointCloudTree {
	constructor (geometry, material) {
		super();

		this.pointBudget = Infinity;
		this.pcoGeometry = geometry;
		this.boundingBox = this.pcoGeometry.boundingBox;
		this.boundingSphere = this.boundingBox.getBoundingSphere(new THREE.Sphere());
		this.material = material || new PointCloudMaterial();
		this.visiblePointsTarget = 2 * 1000 * 1000;
		this.minimumNodePixelSize = 150;
		this.level = 0;
		this.position.copy(geometry.offset);
		this.updateMatrix();

		this.showBoundingBox = false;
		this.boundingBoxNodes = [];
		this.loadQueue = [];
		this.visibleBounds = new THREE.Box3();
		this.visibleNodes = [];
		this.visibleGeometry = [];
		this.generateDEM = false;
		this.profileRequests = [];
		this.name = '';
		this._visible = true;

		{
			let box = [this.pcoGeometry.tightBoundingBox, this.getBoundingBoxWorld()]
				.find(v => v !== undefined);

			this.updateMatrixWorld(true);
			box = Utils.computeTransformedBoundingBox(box, this.matrixWorld);

			let bMin = box.min.z;
			let bMax = box.max.z;
			this.material.heightMin = bMin;
			this.material.heightMax = bMax;
		}

		// TODO read projection from file instead
		this.projection = geometry.projection;
		this.fallbackProjection = geometry.fallbackProjection;

		this.root = this.pcoGeometry.root;
	}

	setName (name) {
		if (this.name !== name) {
			this.name = name;
			this.dispatchEvent({type: 'name_changed', name: name, pointcloud: this});
		}
	}

	getName () {
		return this.name;
	}

	toTreeNode (geometryNode, parent) {
		let node = new PointCloudOctreeNode();

		// if(geometryNode.name === "r40206"){
		//	console.log("creating node for r40206");
		// }
		let sceneNode = new THREE.Points(geometryNode.geometry, this.material);
		sceneNode.name = geometryNode.name;
		sceneNode.position.copy(geometryNode.boundingBox.min);
		sceneNode.frustumCulled = false;
		sceneNode.onBeforeRender = (_this, scene, camera, geometry, material, group) => {
			if (material.program) {
				_this.getContext().useProgram(material.program.program);

				if (material.program.getUniforms().map.level) {
					let level = geometryNode.getLevel();
					material.uniforms.level.value = level;
					material.program.getUniforms().map.level.setValue(_this.getContext(), level);
				}

				if (this.visibleNodeTextureOffsets && material.program.getUniforms().map.vnStart) {
					let vnStart = this.visibleNodeTextureOffsets.get(node);
					material.uniforms.vnStart.value = vnStart;
					material.program.getUniforms().map.vnStart.setValue(_this.getContext(), vnStart);
				}

				if (material.program.getUniforms().map.pcIndex) {
					let i = node.pcIndex ? node.pcIndex : this.visibleNodes.indexOf(node);
					material.uniforms.pcIndex.value = i;
					material.program.getUniforms().map.pcIndex.setValue(_this.getContext(), i);
				}
			}
		};

		// { // DEBUG
		//	let sg = new THREE.SphereGeometry(1, 16, 16);
		//	let sm = new THREE.MeshNormalMaterial();
		//	let s = new THREE.Mesh(sg, sm);
		//	s.scale.set(5, 5, 5);
		//	s.position.copy(geometryNode.mean)
		//		.add(this.position)
		//		.add(geometryNode.boundingBox.min);
		//
		//	viewer.scene.scene.add(s);
		// }

		node.geometryNode = geometryNode;
		node.sceneNode = sceneNode;
		node.pointcloud = this;
		node.children = [];
		//for (let key in geometryNode.children) {
		//	node.children[key] = geometryNode.children[key];
		//}
		for(let i = 0; i < 8; i++){
			node.children[i] = geometryNode.children[i];
		}

		if (!parent) {
			this.root = node;
			this.add(sceneNode);
		} else {
			let childIndex = parseInt(geometryNode.name[geometryNode.name.length - 1]);
			parent.sceneNode.add(sceneNode);
			parent.children[childIndex] = node;
		}

		let disposeListener = function () {
			let childIndex = parseInt(geometryNode.name[geometryNode.name.length - 1]);
			parent.sceneNode.remove(node.sceneNode);
			parent.children[childIndex] = geometryNode;
		};
		geometryNode.oneTimeDisposeHandlers.push(disposeListener);

		return node;
	}

	updateMaterial (material, camera, renderer) {
		material.fov = camera.fov * (Math.PI / 180);
		material.screenWidth = renderer.domElement.clientWidth;
		material.screenHeight = renderer.domElement.clientHeight;
		material.spacing = this.pcoGeometry.spacing * Math.max(this.scale.x, this.scale.y, this.scale.z);
		material.near = camera.near;
		material.far = camera.far;
		material.uniforms.octreeSize.value = this.pcoGeometry.boundingBox.getSize(new THREE.Vector3()).x;
	}

	computeVisibilityTextureData(nodes, camera){

		if(Potree.measureTimings) performance.mark("computeVisibilityTextureData-start");

		let data = new Uint8Array(nodes.length * 4);
		let visibleNodeTextureOffsets = new Map();

		// copy array
		nodes = nodes.slice();

		// sort by level and index, e.g. r, r0, r3, r4, r01, r07, r30, ...
		let sort = function (a, b) {
			let na = a.geometryNode.name;
			let nb = b.geometryNode.name;
			if (na.length !== nb.length) return na.length - nb.length;
			if (na < nb) return -1;
			if (na > nb) return 1;
			return 0;
		};
		nodes.sort(sort);

		// code sample taken from three.js src/math/Ray.js
		let v1 = new THREE.Vector3();
		let intersectSphereBack = (ray, sphere) => {
			v1.subVectors( sphere.center, ray.origin );
			let tca = v1.dot( ray.direction );
			let d2 = v1.dot( v1 ) - tca * tca;
			let radius2 = sphere.radius * sphere.radius;

			if(d2 > radius2){
				return null;
			}

			let thc = Math.sqrt( radius2 - d2 );

			// t1 = second intersect point - exit point on back of sphere
			let t1 = tca + thc;

			if(t1 < 0 ){
				return null;
			}

			return t1;
		};

		let lodRanges = new Map();
		let leafNodeLodRanges = new Map();

		let bBox = new THREE.Box3();
		let bSphere = new THREE.Sphere();
		let worldDir = new THREE.Vector3();
		let cameraRay = new THREE.Ray(camera.position, camera.getWorldDirection(worldDir));

		let nodeMap = new Map();
		let offsetsToChild = new Array(nodes.length).fill(Infinity);

		for(let i = 0; i < nodes.length; i++){
			let node = nodes[i];

			nodeMap.set(node.name, node);
			visibleNodeTextureOffsets.set(node, i);

			if(i > 0){
				let index = parseInt(node.name.slice(-1));
				let parentName = node.name.slice(0, -1);
				let parent = nodeMap.get(parentName);
				let parentOffset = visibleNodeTextureOffsets.get(parent);

				let parentOffsetToChild = (i - parentOffset);

				offsetsToChild[parentOffset] = Math.min(offsetsToChild[parentOffset], parentOffsetToChild);

				data[parentOffset * 4 + 0] = data[parentOffset * 4 + 0] | (1 << index);
				data[parentOffset * 4 + 1] = (offsetsToChild[parentOffset] >> 8);
				data[parentOffset * 4 + 2] = (offsetsToChild[parentOffset] % 256);
			}

			data[i * 4 + 3] = node.name.length - 1;
		}

		var a = 10;

		if(Potree.measureTimings){
			performance.mark("computeVisibilityTextureData-end");
			performance.measure("render.computeVisibilityTextureData", "computeVisibilityTextureData-start", "computeVisibilityTextureData-end");
		}

		return {
			data: data,
			offsets: visibleNodeTextureOffsets
		};
	}

	nodeIntersectsProfile (node, profile) {
		let bbWorld = node.boundingBox.clone().applyMatrix4(this.matrixWorld);
		let bsWorld = bbWorld.getBoundingSphere(new THREE.Sphere());

		let intersects = false;
		let points = profile.points;

		for (let i = 0; i < points.length - 1; i++) {
			let start = points[i];
			let end = points[i + 1];

			let center = new THREE.Vector3().addVectors(end, start).multiplyScalar(0.5);
			let up = profile.up || new THREE.Vector3(0, 0, 1);

			let length = start.distanceTo(end);
			let side = new THREE.Vector3().subVectors(end, start).normalize();
			let forward = new THREE.Vector3().crossVectors(side, up).normalize();
			let cutPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(forward, start);
			let halfPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(side, center);

			let distance = 
				Math.max(
					Math.abs(cutPlane.distanceToPoint(bsWorld.center)) - bsWorld.radius - profile.width,
					Math.abs(halfPlane.distanceToPoint(bsWorld.center)) - bsWorld.radius - length
				)

			if (distance < 0) return true;
		}

		return false;
	}

	nodesOnRay (nodes, ray, camera) {
		let sphere = new THREE.Sphere();

		let walk = node => {
			if (!node || !node.geometry) return;
			node.geometry.boundingBox.getBoundingSphere(sphere).applyMatrix4(this.matrixWorld);

			if (ray.intersectsSphere(sphere)) {
				nodes.push(node);

				for (let i = 0; i < 8; i++) walk(node.children[i]);	
			}
		}

		for (let i = 0; i < this.children.length; i++){
			walk(this.children[i]);
		}
	}

	updateMatrixWorld (force) {
		if (this.matrixAutoUpdate === true) this.updateMatrix();

		if (this.matrixWorldNeedsUpdate === true || force === true) {
			if (!this.parent) {
				this.matrixWorld.copy(this.matrix);
			} else {
				this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
			}

			this.matrixWorldNeedsUpdate = false;

			force = true;
		}
	}

	hideDescendants (object) {
		let stack = [];
		for (let i = 0; i < object.children.length; i++) {
			let child = object.children[i];
			if (child.visible) {
				stack.push(child);
			}
		}

		while (stack.length > 0) {
			let object = stack.shift();

			object.visible = false;

			for (let i = 0; i < object.children.length; i++) {
				let child = object.children[i];
				if (child.visible) {
					stack.push(child);
				}
			}
		}
	}

	moveToOrigin () {
		this.position.set(0, 0, 0);
		this.updateMatrixWorld(true);
		let box = this.boundingBox;
		let transform = this.matrixWorld;
		let tBox = Utils.computeTransformedBoundingBox(box, transform);
		this.position.set(0, 0, 0).sub(tBox.getCenter(new THREE.Vector3()));
	};

	moveToGroundPlane () {
		this.updateMatrixWorld(true);
		let box = this.boundingBox;
		let transform = this.matrixWorld;
		let tBox = Utils.computeTransformedBoundingBox(box, transform);
		this.position.y += -tBox.min.y;
	};

	getBoundingBoxWorld () {
		this.updateMatrixWorld(true);
		let box = this.boundingBox;
		let transform = this.matrixWorld;
		let tBox = Utils.computeTransformedBoundingBox(box, transform);

		return tBox;
	};

	/**
	 * returns points inside the profile points
	 *
	 * maxDepth:		search points up to the given octree depth
	 *
	 *
	 * The return value is an array with all segments of the profile path
	 *	let segment = {
	 *		start:	THREE.Vector3,
	 *		end:	THREE.Vector3,
	 *		points: {}
	 *		project: function()
	 *	};
	 *
	 * The project() function inside each segment can be used to transform
	 * that segments point coordinates to line up along the x-axis.
	 *
	 *
	 */
	getPointsInProfile (profile, maxDepth, callback) {
		if (callback) {
			let request = new Potree.ProfileRequest(this, profile, maxDepth, callback);
			this.profileRequests.push(request);

			return request;
		}

		let points = {
			segments: [],
			boundingBox: new THREE.Box3(),
			projectedBoundingBox: new THREE.Box2()
		};

		// evaluate segments
		for (let i = 0; i < profile.points.length - 1; i++) {
			let start = profile.points[i];
			let end = profile.points[i + 1];
			let ps = this.getProfile(start, end, profile.width, maxDepth);

			let segment = {
				start: start,
				end: end,
				points: ps,
				project: null
			};

			points.segments.push(segment);

			points.boundingBox.expandByPoint(ps.boundingBox.min);
			points.boundingBox.expandByPoint(ps.boundingBox.max);
		}

		// add projection functions to the segments
		let mileage = new THREE.Vector3();
		for (let i = 0; i < points.segments.length; i++) {
			let segment = points.segments[i];
			let start = segment.start;
			let end = segment.end;

			let project = (function (_start, _end, _mileage, _boundingBox) {
				let start = _start;
				let end = _end;
				let mileage = _mileage;
				let boundingBox = _boundingBox;

				let xAxis = new THREE.Vector3(1, 0, 0);
				let dir = new THREE.Vector3().subVectors(end, start);
				dir.y = 0;
				dir.normalize();
				let alpha = Math.acos(xAxis.dot(dir));
				if (dir.z > 0) {
					alpha = -alpha;
				}

				return function (position) {
					let toOrigin = new THREE.Matrix4().makeTranslation(-start.x, -boundingBox.min.y, -start.z);
					let alignWithX = new THREE.Matrix4().makeRotationY(-alpha);
					let applyMileage = new THREE.Matrix4().makeTranslation(mileage.x, 0, 0);

					let pos = position.clone();
					pos.applyMatrix4(toOrigin);
					pos.applyMatrix4(alignWithX);
					pos.applyMatrix4(applyMileage);

					return pos;
				};
			}(start, end, mileage.clone(), points.boundingBox.clone()));

			segment.project = project;

			mileage.x += new THREE.Vector3(start.x, 0, start.z).distanceTo(new THREE.Vector3(end.x, 0, end.z));
			mileage.y += end.y - start.y;
		}

		points.projectedBoundingBox.min.x = 0;
		points.projectedBoundingBox.min.y = points.boundingBox.min.y;
		points.projectedBoundingBox.max.x = mileage.x;
		points.projectedBoundingBox.max.y = points.boundingBox.max.y;

		return points;
	}

	async getPointsInBox(mat, projector){
		let points = []

		let worldToBox;

		let p1size, p2size, p3size;
		let plane1, plane2, plane3;

		{
			let p = projector.projectTo(this.projection);

			try {
				let origin = p(Math.vec3(0).multiply(mat));
				let x = p(Math.vec3(1, 0, 0).multiply(mat)).subtract(origin);
				let y = p(Math.vec3(0, 1, 0).multiply(mat)).subtract(origin);
				let z = p(Math.vec3(0, 0, 1).multiply(mat)).subtract(origin);
				
				mat = Math.mat4(x, 0, y, 0, z, 0, origin, 1);

				p1size = x.len();
				p2size = y.len();
				p3size = z.len();

				plane1 = new THREE.Plane().setFromNormalAndCoplanarPoint(x.normalize().threeAlias(), origin.threeAlias())
				plane2 = new THREE.Plane().setFromNormalAndCoplanarPoint(y.normalize().threeAlias(), origin.threeAlias())
				plane3 = new THREE.Plane().setFromNormalAndCoplanarPoint(z.normalize().threeAlias(), origin.threeAlias())
			}catch (e){}

			worldToBox = new THREE.Matrix4().set(...mat.invert().transpose());
		}

		let projectBack = projector.projectFrom(this.projection);
		let root = this.pcoGeometry.root.geometry.attributes;
		
		let checkPoints = (position, bb, size) => {
			let pos = new THREE.Vector4();
			for (let i = 0; i < position.length; i += 3){
				let x = position[i + 0] * size[0] + bb.min.x;
				let y = position[i + 1] * size[1] + bb.min.y;
				let z = position[i + 2] * size[2] + bb.min.z;

				pos.set(x, y, z, 1);
				pos.applyMatrix4(worldToBox);
				
				if(-0.5 < pos.x && pos.x < 0.5){
					if(-0.5 < pos.y && pos.y < 0.5){
						if(-0.5 < pos.z && pos.z < 0.5){
							let p = projectBack(Math.vec3(x, y, z));

							points.push(...p);
						}
					}
				}
			}
		}

		let process = async root => {
			await root.load();
			
			let bb = root.boundingBox;
			let size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];

			for (let i = 0; i < 8; i++){
				let child = root.children[i];

				if (child){
					let bsWorld = child.boundingSphere;

					let distance = Math.max(
						Math.abs(plane1.distanceToPoint(bsWorld.center)) - bsWorld.radius - p1size,
						Math.abs(plane2.distanceToPoint(bsWorld.center)) - bsWorld.radius - p2size,
						Math.abs(plane3.distanceToPoint(bsWorld.center)) - bsWorld.radius - p3size
					)
					
					if (distance >= 0) child = null;
				}

				if (child){
					await process(child);
				}else{
					let index = (i & 2) | ((i & 1) << 2) | ((i & 4) >> 2);
					let start = 0;
					for (let ii = 0; ii < index; ii++) start += root.pointCounts[ii];

					start *= 3;
					
					checkPoints(root.geometry.attributes.position.array.subarray(start, start + root.pointCounts[index] * 3), bb, size);
				}
			}
		}

		await process (this.pcoGeometry.root);
		return points;
	}

	/**
	 * returns points inside the given profile bounds.
	 *
	 * start:
	 * end:
	 * width:
	 * depth:		search points up to the given octree depth
	 * callback:	if specified, points are loaded before searching
	 *
	 *
	 */
	getProfile (start, end, width, depth, callback) {
		let request = new Potree.ProfileRequest(start, end, width, depth, callback);
		this.profileRequests.push(request);
	};

	getVisibleExtent () {
		return this.visibleBounds.applyMatrix4(this.matrixWorld);
	};

	/**
	 *
	 *
	 *
	 * params.pickWindowSize:	Look for points inside a pixel window of this size.
	 *							Use odd values: 1, 3, 5, ...
	 *
	 *
	 * TODO: only draw pixels that are actually read with readPixels().
	 *
	 */
	pick(viewer, camera, ray, params = {}){
		let renderer = viewer.renderer;
		let pRenderer = viewer.pRenderer;

		performance.mark("pick-start");

		let getVal = (a, b) => a !== undefined ? a : b;

		let pickWindowSize = getVal(params.pickWindowSize, 17);
		let pickOutsideClipRegion = getVal(params.pickOutsideClipRegion, false);

		let size = renderer.getSize();

		let width = Math.ceil(getVal(params.width, size.width));
		let height = Math.ceil(getVal(params.height, size.height));

		let pointSizeType = getVal(params.pointSizeType, this.material.pointSizeType);
		let pointSize = getVal(params.pointSize, this.material.size);

		let nodes = [];
		//reproject ray to local projection system
		if (camera && camera.controls){
			let pointTo = camera.controls.project(this.projection, ray.direction.multiplyScalar(100).add(ray.origin));
			let origin = camera.controls.project(this.projection, ray.origin);
			pointTo.subtract(origin).normalize();

			ray.origin = new THREE.Vector3(origin.x, origin.y, origin.z);
			ray.direction = new THREE.Vector3(pointTo.x, pointTo.y, pointTo.z);
		}

		this.nodesOnRay(nodes, ray, camera);

		if (nodes.length === 0) {
			return null;
		}

		if (!this.pickState) {
			let scene = new THREE.Scene();

			let material = new Potree.PointCloudMaterial();
			material.pointColorType = Potree.PointColorType.POINT_INDEX;

			let renderTarget = new THREE.WebGLRenderTarget(
				1, 1,
				{ minFilter: THREE.LinearFilter,
					magFilter: THREE.NearestFilter,
					format: THREE.RGBAFormat }
			);

			this.pickState = {
				renderTarget: renderTarget,
				material: material,
				scene: scene
			};
		};

		let pickState = this.pickState;
		let pickMaterial = pickState.material;

		{ // update pick material
			pickMaterial.pointSizeType = pointSizeType;
			pickMaterial.shape = this.material.shape;

			pickMaterial.uniforms.uFilterReturnNumberRange.value = this.material.uniforms.uFilterReturnNumberRange.value;
			pickMaterial.uniforms.uFilterNumberOfReturnsRange.value = this.material.uniforms.uFilterNumberOfReturnsRange.value;
			pickMaterial.uniforms.uFilterGPSTimeClipRange.value = this.material.uniforms.uFilterGPSTimeClipRange.value;

			pickMaterial.size = pointSize;
			pickMaterial.uniforms.minSize.value = this.material.uniforms.minSize.value;
			pickMaterial.uniforms.maxSize.value = this.material.uniforms.maxSize.value;
			pickMaterial.classification = this.material.classification;
			if(params.pickClipped){
				pickMaterial.clipBoxes = this.material.clipBoxes;
				pickMaterial.uniforms.clipBoxes = this.material.uniforms.clipBoxes;
				if(this.material.clipTask === Potree.ClipTask.HIGHLIGHT){
					pickMaterial.clipTask = Potree.ClipTask.NONE;
				}else{
					pickMaterial.clipTask = this.material.clipTask;
				}
				pickMaterial.clipMethod = this.material.clipMethod;
			}else{
				pickMaterial.clipBoxes = [];
			}

			this.updateMaterial(pickMaterial, camera, renderer);
		}

		//pickMaterial.pointColorType = Potree.PointColorType.LOD;

		pickState.renderTarget.setSize(width, height);

		let pixelPos = new THREE.Vector2(params.x, params.y);

		let gl = renderer.getContext();
		gl.enable(gl.SCISSOR_TEST);
		gl.scissor(
			parseInt(pixelPos.x - (pickWindowSize - 1) / 2),
			parseInt(pixelPos.y - (pickWindowSize - 1) / 2),
			parseInt(pickWindowSize), parseInt(pickWindowSize));


		renderer.state.buffers.depth.setTest(pickMaterial.depthTest);
		renderer.state.buffers.depth.setMask(pickMaterial.depthWrite);
		renderer.state.setBlending(THREE.NoBlending);

		{ // RENDER
			renderer.setRenderTarget(pickState.renderTarget);
			gl.clearColor(0, 0, 0, 0);
			renderer.clearTarget( pickState.renderTarget, true, true, true );

			let tmp = this.material;
			this.material = pickMaterial;

			pRenderer.renderOctree(this, camera, pickState.renderTarget, {nodeList: nodes});

			this.material = tmp;
		}

		let clamp = (number, min, max) => Math.min(Math.max(min, number), max);

		let x = parseInt(clamp(pixelPos.x - (pickWindowSize - 1) / 2, 0, width));
		let y = parseInt(clamp(pixelPos.y - (pickWindowSize - 1) / 2, 0, height));
		let w = parseInt(Math.min(x + pickWindowSize, width) - x);
		let h = parseInt(Math.min(y + pickWindowSize, height) - y);

		let pixelCount = w * h;
		let buffer = new Uint8Array(4 * pixelCount);

		gl.readPixels(x, y, pickWindowSize, pickWindowSize, gl.RGBA, gl.UNSIGNED_BYTE, buffer);

		renderer.setRenderTarget(null);
		renderer.state.reset();
		renderer.setScissorTest(false);
		gl.disable(gl.SCISSOR_TEST);

		let pixels = buffer;
		let ibuffer = new Uint32Array(buffer.buffer);

		// find closest hit inside pixelWindow boundaries
		let min = Number.MAX_VALUE;
		let hits = [];
		for (let u = 0; u < pickWindowSize; u++) {
			for (let v = 0; v < pickWindowSize; v++) {
				let offset = (u + v * pickWindowSize);
				let distance = Math.pow(u - (pickWindowSize - 1) / 2, 2) + Math.pow(v - (pickWindowSize - 1) / 2, 2);

				let pcIndex = pixels[4 * offset + 3];
				pixels[4 * offset + 3] = 0;
				let pIndex = ibuffer[offset];

				if(!(pcIndex === 0 && pIndex === 0) && (pcIndex !== undefined) && (pIndex !== undefined)){
					let hit = {
						pIndex: pIndex,
						pcIndex: pcIndex,
						distanceToCenter: distance
					};

					if(params.all){
						hits.push(hit);
					}else{
						if(hits.length > 0){
							if(distance < hits[0].distanceToCenter){
								hits[0] = hit;
							}
						}else{
							hits.push(hit);
						}
					}


				}
			}
		}

		// DEBUG: show panel with pick image
		/*{
			let img = Utils.pixelsArrayToImage(buffer, w, h);
			let screenshot = img.src;
		
			if(!this.debugDIV){
				this.debugDIV = $(`
					<div id="pickDebug"
					style="position: absolute;
					right: 400px; width: 300px;
					bottom: 44px; width: 300px;
					z-index: 1000;
					"></div>`);
				$(document.body).append(this.debugDIV);
			}
		
			this.debugDIV.empty();
			this.debugDIV.append($(`<img src="${screenshot}"
				style="transform: scaleY(-1); width: 300px"/>`));
			//$(this.debugWindow.document).append($(`<img src="${screenshot}"/>`));
			//this.debugWindow.document.write('<img src="'+screenshot+'"/>');
		}*/


		for(let hit of hits){
			let point = {};

			if (!nodes[hit.pcIndex]) {
				return null;
			}

			let node = nodes[hit.pcIndex];
			let geometry = node.geometry;

			for(let attributeName in geometry.attributes){
				let attribute = geometry.attributes[attributeName];

				let bb = geometry.boundingBox;

				let size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];

				if (attributeName === 'position') {
					let x = attribute.array[3 * hit.pIndex + 0] * size[0];
					let y = attribute.array[3 * hit.pIndex + 1] * size[1];
					let z = attribute.array[3 * hit.pIndex + 2] * size[2];

					let position = new THREE.Vector3(x, y, z);
					position.applyMatrix4(node.matrixWorld);

					//project back to global coordinates
					if (camera.controls) {
						let pos = camera.controls.unproject(this.projection, position);

						position.x = pos.x;
						position.y = pos.y;
						position.z = pos.z;
					}

					point[attributeName] = position;
				} else if (attributeName === 'indices') {

				} else if (attributeName === 'gpsTime') {
					let values = attribute.array.slice(attribute.itemSize * hit.pIndex, attribute.itemSize * (hit.pIndex + 1)) ;

					values[0] += node.gpsTime.offset;

					point[attributeName] = values;
				} else {

					let values = attribute.array.slice(attribute.itemSize * hit.pIndex, attribute.itemSize * (hit.pIndex + 1)) ;
					point[attributeName] = values;

					//debugger;
					//if (values.itemSize === 1) {
					//	point[attribute.name] = values.array[hit.pIndex];
					//} else {
					//	let value = [];
					//	for (let j = 0; j < values.itemSize; j++) {
					//		value.push(values.array[values.itemSize * hit.pIndex + j]);
					//	}
					//	point[attribute.name] = value;
					//}
				}

			}

			hit.point = point;
		}

		performance.mark("pick-end");
		performance.measure("pick", "pick-start", "pick-end");

		if(params.all){
			return hits.map(hit => hit.point);
		}else{
			if(hits.length === 0){
				return null;
			}else{
				return hits[0].point;
				//let sorted = hits.sort( (a, b) => a.distanceToCenter - b.distanceToCenter);

				//return sorted[0].point;
			}
		}

	};

	* getFittedBoxGen(boxNode){
		let start = performance.now();

		let shrinkedLocalBounds = new THREE.Box3();
		let worldToBox = new THREE.Matrix4().getInverse(boxNode.matrixWorld);

		for(let node of this.visibleNodes){
			if(!node.sceneNode){
				continue;
			}

			let buffer = node.geometryNode.buffer;

			let posOffset = buffer.offset("position");
			let stride = buffer.stride;
			let view = new DataView(buffer.data);

			let objectToBox = new THREE.Matrix4().multiplyMatrices(worldToBox, node.sceneNode.matrixWorld);

			let pos = new THREE.Vector4();
			for(let i = 0; i < buffer.numElements; i++){
				let x = view.getFloat32(i * stride + posOffset + 0, true);
				let y = view.getFloat32(i * stride + posOffset + 4, true);
				let z = view.getFloat32(i * stride + posOffset + 8, true);

				pos.set(x, y, z, 1);
				pos.applyMatrix4(objectToBox);

				if(-0.5 < pos.x && pos.x < 0.5){
					if(-0.5 < pos.y && pos.y < 0.5){
						if(-0.5 < pos.z && pos.z < 0.5){
							shrinkedLocalBounds.expandByPoint(pos);
						}
					}
				}
			}

			yield;
		}

		let fittedPosition = shrinkedLocalBounds.getCenter(new THREE.Vector3()).applyMatrix4(boxNode.matrixWorld);

		let fitted = new THREE.Object3D();
		fitted.position.copy(fittedPosition);
		fitted.scale.copy(boxNode.scale);
		fitted.rotation.copy(boxNode.rotation);

		let ds = new THREE.Vector3().subVectors(shrinkedLocalBounds.max, shrinkedLocalBounds.min);
		fitted.scale.multiply(ds);

		let duration = performance.now() - start;
		console.log("duration: ", duration);

		yield fitted;
	}

	getFittedBox(boxNode, maxLevel = Infinity){

		maxLevel = Infinity;

		let start = performance.now();

		let shrinkedLocalBounds = new THREE.Box3();
		let worldToBox = new THREE.Matrix4().getInverse(boxNode.matrixWorld);

		for(let node of this.visibleNodes){
			if(!node.sceneNode || node.getLevel() > maxLevel){
				continue;
			}

			let buffer = node.geometryNode.buffer;

			let posOffset = buffer.offset("position");
			let stride = buffer.stride;
			let view = new DataView(buffer.data);

			let objectToBox = new THREE.Matrix4().multiplyMatrices(worldToBox, node.sceneNode.matrixWorld);

			let pos = new THREE.Vector4();
			for(let i = 0; i < buffer.numElements; i++){
				let x = view.getFloat32(i * stride + posOffset + 0, true);
				let y = view.getFloat32(i * stride + posOffset + 4, true);
				let z = view.getFloat32(i * stride + posOffset + 8, true);

				pos.set(x, y, z, 1);
				pos.applyMatrix4(objectToBox);

				if(-0.5 < pos.x && pos.x < 0.5){
					if(-0.5 < pos.y && pos.y < 0.5){
						if(-0.5 < pos.z && pos.z < 0.5){
							shrinkedLocalBounds.expandByPoint(pos);
						}
					}
				}
			}
		}

		let fittedPosition = shrinkedLocalBounds.getCenter(new THREE.Vector3()).applyMatrix4(boxNode.matrixWorld);

		let fitted = new THREE.Object3D();
		fitted.position.copy(fittedPosition);
		fitted.scale.copy(boxNode.scale);
		fitted.rotation.copy(boxNode.rotation);

		let ds = new THREE.Vector3().subVectors(shrinkedLocalBounds.max, shrinkedLocalBounds.min);
		fitted.scale.multiply(ds);

		let duration = performance.now() - start;
		console.log("duration: ", duration);

		return fitted;
	}

	get progress () {
		return this.visibleNodes.length / this.visibleGeometry.length;
	}

	find(name){
		let node = null;
		for(let char of name){
			if(char === "r"){
				node = this.root;
			}else{
				node = node.children[char];
			}
		}

		return node;
	}

	get visible(){
		return this._visible;
	}

	set visible(value){
		if (value !== this._visible){
			this.dispatchEvent({type: 'visibility_changed', pointcloud: this});
		}
		this._visible = value;
	}

}










