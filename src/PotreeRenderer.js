
import {PointCloudTree} from "./PointCloudTree.js";
import {PointCloudOctreeNode} from "./PointCloudOctree.js";
import {PointCloudArena4DNode} from "./arena4d/PointCloudArena4D.js";
import {PointSizeType, PointColorType, ClipTask} from "./defines.js";

// Copied from three.js: WebGLRenderer.js
function paramThreeToGL(_gl, p) {

	let extension;

	if (p === THREE.RepeatWrapping) return _gl.REPEAT;
	if (p === THREE.ClampToEdgeWrapping) return _gl.CLAMP_TO_EDGE;
	if (p === THREE.MirroredRepeatWrapping) return _gl.MIRRORED_REPEAT;

	if (p === THREE.NearestFilter) return _gl.NEAREST;
	if (p === THREE.NearestMipMapNearestFilter) return _gl.NEAREST_MIPMAP_NEAREST;
	if (p === THREE.NearestMipMapLinearFilter) return _gl.NEAREST_MIPMAP_LINEAR;

	if (p === THREE.LinearFilter) return _gl.LINEAR;
	if (p === THREE.LinearMipMapNearestFilter) return _gl.LINEAR_MIPMAP_NEAREST;
	if (p === THREE.LinearMipMapLinearFilter) return _gl.LINEAR_MIPMAP_LINEAR;

	if (p === THREE.UnsignedByteType) return _gl.UNSIGNED_BYTE;
	if (p === THREE.UnsignedShort4444Type) return _gl.UNSIGNED_SHORT_4_4_4_4;
	if (p === THREE.UnsignedShort5551Type) return _gl.UNSIGNED_SHORT_5_5_5_1;
	if (p === THREE.UnsignedShort565Type) return _gl.UNSIGNED_SHORT_5_6_5;

	if (p === THREE.ByteType) return _gl.BYTE;
	if (p === THREE.ShortType) return _gl.SHORT;
	if (p === THREE.UnsignedShortType) return _gl.UNSIGNED_SHORT;
	if (p === THREE.IntType) return _gl.INT;
	if (p === THREE.UnsignedIntType) return _gl.UNSIGNED_INT;
	if (p === THREE.FloatType) return _gl.FLOAT;

	if (p === THREE.HalfFloatType) {

		extension = extensions.get('OES_texture_half_float');

		if (extension !== null) return extension.HALF_FLOAT_OES;

	}

	if (p === THREE.AlphaFormat) return _gl.ALPHA;
	if (p === THREE.RGBFormat) return _gl.RGB;
	if (p === THREE.RGBAFormat) return _gl.RGBA;
	if (p === THREE.LuminanceFormat) return _gl.LUMINANCE;
	if (p === THREE.LuminanceAlphaFormat) return _gl.LUMINANCE_ALPHA;
	if (p === THREE.DepthFormat) return _gl.DEPTH_COMPONENT;
	if (p === THREE.DepthStencilFormat) return _gl.DEPTH_STENCIL;

	if (p === THREE.AddEquation) return _gl.FUNC_ADD;
	if (p === THREE.SubtractEquation) return _gl.FUNC_SUBTRACT;
	if (p === THREE.ReverseSubtractEquation) return _gl.FUNC_REVERSE_SUBTRACT;

	if (p === THREE.ZeroFactor) return _gl.ZERO;
	if (p === THREE.OneFactor) return _gl.ONE;
	if (p === THREE.SrcColorFactor) return _gl.SRC_COLOR;
	if (p === THREE.OneMinusSrcColorFactor) return _gl.ONE_MINUS_SRC_COLOR;
	if (p === THREE.SrcAlphaFactor) return _gl.SRC_ALPHA;
	if (p === THREE.OneMinusSrcAlphaFactor) return _gl.ONE_MINUS_SRC_ALPHA;
	if (p === THREE.DstAlphaFactor) return _gl.DST_ALPHA;
	if (p === THREE.OneMinusDstAlphaFactor) return _gl.ONE_MINUS_DST_ALPHA;

	if (p === THREE.DstColorFactor) return _gl.DST_COLOR;
	if (p === THREE.OneMinusDstColorFactor) return _gl.ONE_MINUS_DST_COLOR;
	if (p === THREE.SrcAlphaSaturateFactor) return _gl.SRC_ALPHA_SATURATE;

	if (p === THREE.RGB_S3TC_DXT1_Format || p === RGBA_S3TC_DXT1_Format ||
		p === THREE.RGBA_S3TC_DXT3_Format || p === RGBA_S3TC_DXT5_Format) {

		extension = extensions.get('WEBGL_compressed_texture_s3tc');

		if (extension !== null) {

			if (p === THREE.RGB_S3TC_DXT1_Format) return extension.COMPRESSED_RGB_S3TC_DXT1_EXT;
			if (p === THREE.RGBA_S3TC_DXT1_Format) return extension.COMPRESSED_RGBA_S3TC_DXT1_EXT;
			if (p === THREE.RGBA_S3TC_DXT3_Format) return extension.COMPRESSED_RGBA_S3TC_DXT3_EXT;
			if (p === THREE.RGBA_S3TC_DXT5_Format) return extension.COMPRESSED_RGBA_S3TC_DXT5_EXT;

		}

	}

	if (p === THREE.RGB_PVRTC_4BPPV1_Format || p === THREE.RGB_PVRTC_2BPPV1_Format ||
		p === THREE.RGBA_PVRTC_4BPPV1_Format || p === THREE.RGBA_PVRTC_2BPPV1_Format) {

		extension = extensions.get('WEBGL_compressed_texture_pvrtc');

		if (extension !== null) {

			if (p === THREE.RGB_PVRTC_4BPPV1_Format) return extension.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
			if (p === THREE.RGB_PVRTC_2BPPV1_Format) return extension.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
			if (p === THREE.RGBA_PVRTC_4BPPV1_Format) return extension.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
			if (p === THREE.RGBA_PVRTC_2BPPV1_Format) return extension.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;

		}

	}

	if (p === THREE.RGB_ETC1_Format) {

		extension = extensions.get('WEBGL_compressed_texture_etc1');

		if (extension !== null) return extension.COMPRESSED_RGB_ETC1_WEBGL;

	}

	if (p === THREE.MinEquation || p === THREE.MaxEquation) {

		extension = extensions.get('EXT_blend_minmax');

		if (extension !== null) {

			if (p === THREE.MinEquation) return extension.MIN_EXT;
			if (p === THREE.MaxEquation) return extension.MAX_EXT;

		}

	}

	if (p === UnsignedInt248Type) {

		extension = extensions.get('WEBGL_depth_texture');

		if (extension !== null) return extension.UNSIGNED_INT_24_8_WEBGL;

	}

	return 0;

};

let attributeLocations = {
	"position": 0,
	"color": 1,
	"intensity": 2,
	"classification": 3, 
	"returnNumber": 4,
	"numberOfReturns": 5,
	"pointSourceID": 6,
	"indices": 7,
	"normal": 8,
	"spacing": 9,
	"gpsTime": 10,
};

class Shader {

	constructor(gl, name, vsSource, fsSource) {
		this.gl = gl;
		this.name = name;
		this.vsSource = vsSource;
		this.fsSource = fsSource;

		this.cache = new Map();

		this.vs = null;
		this.fs = null;
		this.program = null;

		this.uniformLocations = {};
		this.attributeLocations = {};
		this.uniformBlockIndices = {};
		this.uniformBlocks = {};
		this.uniforms = {};

		this.update(vsSource, fsSource);
	}

	update(vsSource, fsSource) {
		this.vsSource = vsSource;
		this.fsSource = fsSource;

		this.linkProgram();
	}

	compileShader(shader, source){
		let gl = this.gl;

		gl.shaderSource(shader, source);

		gl.compileShader(shader);

		let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
		if (!success) {
			let info = gl.getShaderInfoLog(shader);
			let numberedSource = source.split("\n").map((a, i) => `${i + 1}`.padEnd(5) + a).join("\n");
			throw `could not compile shader ${this.name}: ${info}, \n${numberedSource}`;
		}
	}

	linkProgram() {

		let gl = this.gl;

		this.uniformLocations = {};
		this.attributeLocations = {};
		this.uniforms = {};

		gl.useProgram(null);

		let cached = this.cache.get(`${this.vsSource}, ${this.fsSource}`);
		if (cached) {
			this.program = cached.program;
			this.vs = cached.vs;
			this.fs = cached.fs;
			this.attributeLocations = cached.attributeLocations;
			this.uniformLocations = cached.uniformLocations;
			this.uniformBlocks = cached.uniformBlocks;
			this.uniforms = cached.uniforms;

			return;
		} else {

			this.vs = gl.createShader(gl.VERTEX_SHADER);
			this.fs = gl.createShader(gl.FRAGMENT_SHADER);
			this.program = gl.createProgram();

			for(let name of Object.keys(attributeLocations)){
				let location = attributeLocations[name];
				gl.bindAttribLocation(this.program, location, name);
			}

			this.compileShader(this.vs, this.vsSource);
			this.compileShader(this.fs, this.fsSource);

			let program = this.program;

			gl.attachShader(program, this.vs);
			gl.attachShader(program, this.fs);

			gl.linkProgram(program);

			gl.detachShader(program, this.vs);
			gl.detachShader(program, this.fs);

			let success = gl.getProgramParameter(program, gl.LINK_STATUS);
			if (!success) {
				let info = gl.getProgramInfoLog(program);
				throw `could not link program ${this.name}: ${info}`;
			}

			{ // attribute locations
				let numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

				for (let i = 0; i < numAttributes; i++) {
					let attribute = gl.getActiveAttrib(program, i);

					let location = gl.getAttribLocation(program, attribute.name);

					this.attributeLocations[attribute.name] = location;
				}
			}

			{ // uniform locations
				let numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

				for (let i = 0; i < numUniforms; i++) {
					let uniform = gl.getActiveUniform(program, i);

					let location = gl.getUniformLocation(program, uniform.name);

					this.uniformLocations[uniform.name] = location;
					this.uniforms[uniform.name] = {
						location: location,
						value: null,
					};
				}
			}

			// uniform blocks
			if(gl instanceof WebGL2RenderingContext){ 
				let numBlocks = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);

				for (let i = 0; i < numBlocks; i++) {
					let blockName = gl.getActiveUniformBlockName(program, i);

					let blockIndex = gl.getUniformBlockIndex(program, blockName);

					this.uniformBlockIndices[blockName] = blockIndex;

					gl.uniformBlockBinding(program, blockIndex, blockIndex);
					let dataSize = gl.getActiveUniformBlockParameter(program, blockIndex, gl.UNIFORM_BLOCK_DATA_SIZE);

					let uBuffer = gl.createBuffer();	
					gl.bindBuffer(gl.UNIFORM_BUFFER, uBuffer);
					gl.bufferData(gl.UNIFORM_BUFFER, dataSize, gl.DYNAMIC_READ);

					gl.bindBufferBase(gl.UNIFORM_BUFFER, blockIndex, uBuffer);

					gl.bindBuffer(gl.UNIFORM_BUFFER, null);

					this.uniformBlocks[blockName] = {
						name: blockName,
						index: blockIndex,
						dataSize: dataSize,
						buffer: uBuffer
					};

				}
			}

			let cached = {
				program: this.program,
				vs: this.vs,
				fs: this.fs,
				attributeLocations: this.attributeLocations,
				uniformLocations: this.uniformLocations,
				uniforms: this.uniforms,
				uniformBlocks: this.uniformBlocks,
			};

			this.cache.set(`${this.vsSource}, ${this.fsSource}`, cached);
		}




	}

	setUniformMatrix4(name, value) {
		const gl = this.gl;
		const location = this.uniformLocations[name];

		if (location == null) {
			return;
		}

		let tmp = new Float32Array(value.elements);
		gl.uniformMatrix4fv(location, false, tmp);
	}

	setUniform1f(name, value) {
		const gl = this.gl;
		const uniform = this.uniforms[name];

		if (uniform === undefined) {
			return;
		}

		if(uniform.value === value){
			return;
		}

		uniform.value = value;

		gl.uniform1f(uniform.location, value);

		//const location = this.uniformLocations[name];

		//if (location == null) {
		//	return;
		//}

		//gl.uniform1f(location, value);
	}

	setUniformBoolean(name, value) {
		const gl = this.gl;
		const uniform = this.uniforms[name];

		if (uniform === undefined) {
			return;
		}

		if(uniform.value === value){
			return;
		}

		uniform.value = value;

		gl.uniform1i(uniform.location, value);
	}

	setUniformTexture(name, value) {
		const gl = this.gl;
		const location = this.uniformLocations[name];

		if (location == null) {
			return;
		}

		gl.uniform1i(location, value);
	}

	setUniform2f(name, value) {
		const gl = this.gl;
		const location = this.uniformLocations[name];

		if (location == null) {
			return;
		}

		gl.uniform2f(location, value[0], value[1]);
	}

	setUniform3f(name, value) {
		const gl = this.gl;
		const location = this.uniformLocations[name];

		if (location == null) {
			return;
		}

		gl.uniform3f(location, value[0], value[1], value[2]);
	}

	setUniform4f(name, value) {
		const gl = this.gl;
		const location = this.uniformLocations[name];
		
		if (location == null) {
			return;
		}
		
		gl.uniform4fv(location, value);
	}

	setUniform(name, value) {

		if (value.constructor === THREE.Matrix4) {
			this.setUniformMatrix4(name, value);
		} else if (typeof value === "number") {
			this.setUniform1f(name, value);
		} else if (typeof value === "boolean") {
			this.setUniformBoolean(name, value);
		} else if (value instanceof WebGLTexture) {
			this.setUniformTexture(name, value);
		} else if (value instanceof Array) {

			if (value.length === 2) {
				this.setUniform2f(name, value);
			} else if (value.length === 3) {
				this.setUniform3f(name, value);
			}

		} else {
			console.error("unhandled uniform type: ", name, value);
		}

	}


	setUniform1i(name, value) {
		let gl = this.gl;
		let location = this.uniformLocations[name];

		if (location == null) {
			return;
		}

		gl.uniform1i(location, value);
	}

};

class WebGLTexture {

	constructor(gl, texture) {
		this.gl = gl;

		this.texture = texture;
		this.id = gl.createTexture();

		this.target = gl.TEXTURE_2D;
		this.version = -1;

		this.update(texture);
	}

	update() {

		if (!this.texture.image) {
			this.version = this.texture.version;

			return;
		}

		let gl = this.gl;
		let texture = this.texture;

		if (this.version === texture.version) {
			return;
		}

		this.target = gl.TEXTURE_2D;

		gl.bindTexture(this.target, this.id);

		let level = 0;
		let internalFormat = paramThreeToGL(gl, texture.format);
		let width = texture.image.width;
		let height = texture.image.height;
		let border = 0;
		let srcFormat = internalFormat;
		let srcType = paramThreeToGL(gl, texture.type);
		let data;

		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);

		if (texture instanceof THREE.DataTexture) {
			data = texture.image.data;

			gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, paramThreeToGL(gl, texture.magFilter));
			gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, paramThreeToGL(gl, texture.minFilter));

			gl.texImage2D(this.target, level, internalFormat,
				width, height, border, srcFormat, srcType,
				data);
		} else if (texture instanceof THREE.CanvasTexture) {
			data = texture.image;

			gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, paramThreeToGL(gl, texture.wrapS));
			gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, paramThreeToGL(gl, texture.wrapT));

			gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, paramThreeToGL(gl, texture.magFilter));
			gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, paramThreeToGL(gl, texture.minFilter));

			gl.texImage2D(this.target, level, internalFormat,
				internalFormat, srcType, data);
		}

		gl.bindTexture(this.target, null);

		this.version = texture.version;
	}

};

class WebGLBuffer {
	constructor() {
		this.numElements = 0;
		this.vao = null;
		this.vbos = new Map();
	}

	dispose () {
		this.disposed = true;
		this.gl.deleteVertexArray(this.vao);

		for (let o of this.vbos){
			this.gl.deleteBuffer(o.handle);
		}
	}
};

export class Renderer {

	constructor(threeRenderer) {
		this.threeRenderer = threeRenderer;
		this.gl = this.threeRenderer.context;

		this.shaders = new Map();
		this.textures = new Map();

		this.glTypeMapping = new Map();
		this.glTypeMapping.set(Float32Array, this.gl.FLOAT);
		this.glTypeMapping.set(Uint8Array, this.gl.UNSIGNED_BYTE);
		this.glTypeMapping.set(Uint16Array, this.gl.UNSIGNED_SHORT);

		this.toggle = 0;
	}

	createBuffer(geometry){
		let gl = this.gl;
		let webglBuffer = new WebGLBuffer();
		webglBuffer.gl = gl;
		webglBuffer.vao = gl.createVertexArray();
		webglBuffer.numElements = geometry.attributes.position.count;

		gl.bindVertexArray(webglBuffer.vao);

		for(let attributeName in geometry.attributes){
			let bufferAttribute = geometry.attributes[attributeName];

			if (attributeName == 'position'){ // convert position to normalized uint16
				let arr = new Uint16Array(bufferAttribute.count * 3);

				for (let i = 0; i < arr.length; i++){
					arr[i] = bufferAttribute.array[i] * 65535;
				}

				let vbo = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
				gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);

				let attributeLocation = attributeLocations[attributeName];
				let normalized = bufferAttribute.normalized;

				gl.vertexAttribPointer(attributeLocation, bufferAttribute.itemSize, gl.UNSIGNED_SHORT, true, 0, 0);
				gl.enableVertexAttribArray(attributeLocation);

				webglBuffer.vbos.set(attributeName, {
					handle: vbo,
					name: 'position',
					count: bufferAttribute.count,
					itemSize: 3,
					type: Uint16Array,
					version: 0
				});
			}else{
				let vbo = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
				gl.bufferData(gl.ARRAY_BUFFER, bufferAttribute.array, gl.STATIC_DRAW);

				let attributeLocation = attributeLocations[attributeName];
				let normalized = bufferAttribute.normalized;
				let type = this.glTypeMapping.get(bufferAttribute.array.constructor);

				gl.vertexAttribPointer(attributeLocation, bufferAttribute.itemSize, type, normalized, 0, 0);
				gl.enableVertexAttribArray(attributeLocation);

				webglBuffer.vbos.set(attributeName, {
					handle: vbo,
					name: attributeName,
					count: bufferAttribute.count,
					itemSize: bufferAttribute.itemSize,
					type: geometry.attributes.position.array.constructor,
					version: 0
				});
			}
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.bindVertexArray(null);

		return webglBuffer;
	}

	updateBuffer(geometry, webglBuffer){
		let gl = this.gl;

		gl.bindVertexArray(webglBuffer.vao);

		for(let attributeName in geometry.attributes){
			let bufferAttribute = geometry.attributes[attributeName];

			let attributeLocation = attributeLocations[attributeName];
			let normalized = bufferAttribute.normalized;
			let type = this.glTypeMapping.get(bufferAttribute.array.constructor);

			let vbo = null;
			if(!webglBuffer.vbos.has(attributeName)){
				vbo = gl.createBuffer();

				webglBuffer.vbos.set(attributeName, {
					handle: vbo,
					name: attributeName,
					count: bufferAttribute.count,
					itemSize: bufferAttribute.itemSize,
					type: geometry.attributes.position.array.constructor,
					version: bufferAttribute.version
				});
			}else{
				vbo = webglBuffer.vbos.get(attributeName).handle;
				webglBuffer.vbos.get(attributeName).version = bufferAttribute.version;
			}

			gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
			gl.bufferData(gl.ARRAY_BUFFER, bufferAttribute.array, gl.STATIC_DRAW);
			gl.vertexAttribPointer(attributeLocation, bufferAttribute.itemSize, type, normalized, 0, 0);
			gl.enableVertexAttribArray(attributeLocation);
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.bindVertexArray(null);
	}

	renderNode(octree, node, transform, target, shader, params = {}) {
		let gl = this.gl;

		let material = params.material ? params.material : octree.material;
		let shadowMaps = params.shadowMaps == null ? [] : params.shadowMaps;
		let worldView = new THREE.Matrix4();

		let mat4holder = new Float32Array(16);
		let PCIndex = 0;

		/*let gpsMin = Infinity;
		let gpsMax = -Infinity
		for (let node of nodes) {

			if(node instanceof PointCloudOctreeNode){
				let geometryNode = node.geometryNode;

				if(geometryNode.gpsTime){
					let {offset, range} = geometryNode.gpsTime;
					let nodeMin = offset;
					let nodeMax = offset + range;

					gpsMin = Math.min(gpsMin, nodeMin);
					gpsMax = Math.max(gpsMax, nodeMax);
				}
			}

			break;

		}*/

		var childrenMasking = 0;
		var children = [null, null, null, null, null, null, null, null];
		let level = node.getLevel();
		
		if (!params.nodeList || (PCIndex = params.nodeList.indexOf(node.sceneNode)) >= 0){
			for (var ii = 0; ii < 8; ii++){
				let child = node.children[ii];
				let index = (ii & 2) | ((ii & 1) << 2) | ((ii & 4) >> 2);

				if (child && child.geometryNode && child.geometryNode.visible){
					childrenMasking |= 1 << index;
					children[index] = node.children[ii];
				}else if (node.geometryNode && node.geometryNode.pointCounts && node.geometryNode.pointCounts[index] == 0){
					childrenMasking |= 1 << index;
				}
			}
		}
		
		//render this node
		if (node.geometryNode && node.geometryNode.geometry && childrenMasking != 255 && node.geometryNode.level >= (octree.minRenderLevel || 0)){
			/*const lModel = shader.uniformLocations["modelMatrix"];
			if (lModel) {
				mat4holder.set(world.elements);
				gl.uniformMatrix4fv(lModel, false, mat4holder);
			}*/

			gl.uniformMatrix4fv(shader.uniformLocations["modelViewMatrix"], false, transform.elements);
			
			shader.setUniform1f('uLevel', level);
			shader.setUniform1f("uNodeSpacing", node.geometryNode.spacing);
			shader.setUniform1f("setChildren", childrenMasking);

			let geometry = node.geometryNode.geometry;

			/*if(node.geometryNode.gpsTime){
				let nodeMin = node.geometryNode.gpsTime.offset;
				let nodeMax = nodeMin + node.geometryNode.gpsTime.range;

				let gpsOffset = (+nodeMin - gpsMin);
				let gpsRange = (gpsMax - gpsMin);

				shader.setUniform1f("uGPSOffset", gpsOffset);
				shader.setUniform1f("uGPSRange", gpsRange);
			}*/

			{ // Clip Polygons
				if(material.clipPolygons && material.clipPolygons.length > 0){

					let clipPolygonVCount = [];
					let worldViewProjMatrices = [];

					for(let clipPolygon of material.clipPolygons){

						let view = clipPolygon.viewMatrix;
						let proj = clipPolygon.projMatrix;

						let worldViewProj = proj.clone().multiply(view).multiply(world);

						clipPolygonVCount.push(clipPolygon.markers.length);
						worldViewProjMatrices.push(worldViewProj);
					}

					let flattenedMatrices = [].concat(...worldViewProjMatrices.map(m => m.elements));

					let flattenedVertices = new Array(8 * 3 * material.clipPolygons.length);
					for(let i = 0; i < material.clipPolygons.length; i++){
						let clipPolygon = material.clipPolygons[i];
						for(let j = 0; j < clipPolygon.markers.length; j++){
							flattenedVertices[i * 24 + (j * 3 + 0)] = clipPolygon.markers[j].position.x;
							flattenedVertices[i * 24 + (j * 3 + 1)] = clipPolygon.markers[j].position.y;
							flattenedVertices[i * 24 + (j * 3 + 2)] = clipPolygon.markers[j].position.z;
						}
					}

					const lClipPolygonVCount = shader.uniformLocations["uClipPolygonVCount[0]"];
					gl.uniform1iv(lClipPolygonVCount, clipPolygonVCount);

					const lClipPolygonVP = shader.uniformLocations["uClipPolygonWVP[0]"];
					gl.uniformMatrix4fv(lClipPolygonVP, false, flattenedMatrices);

					const lClipPolygons = shader.uniformLocations["uClipPolygonVertices[0]"];
					gl.uniform3fv(lClipPolygons, flattenedVertices);

				}
			}

			{
				//let uFilterGPSTimeClipRange = material.uniforms.uFilterGPSTimeClipRange.value;
				
				//let gpsCliPRangeMin = uFilterGPSTimeClipRange[0] - gpsMin;
				//let gpsCliPRangeMax = uFilterGPSTimeClipRange[1] - gpsMin;
				
				shader.setUniform2f("uFilterReturnNumberRange", material.uniforms.uFilterReturnNumberRange.value);
				shader.setUniform2f("uFilterNumberOfReturnsRange", material.uniforms.uFilterNumberOfReturnsRange.value);
				//shader.setUniform2f("uFilterGPSTimeClipRange", [gpsCliPRangeMin, gpsCliPRangeMax]);
			}

			shader.setUniform1f("uPCIndex", PCIndex);
			let webglBuffer = null;
			if (!node.geometryNode.webglBuffer || node.geometryNode.webglBuffer.disposed){
				webglBuffer = node.geometryNode.webglBuffer = this.createBuffer(geometry);
			}else{
				webglBuffer = node.geometryNode.webglBuffer
				let update = false;

				for(let attributeName in geometry.attributes){
					let attribute = geometry.attributes[attributeName];

					if(attribute.version > webglBuffer.vbos.get(attributeName).version){
						update = true;
						break;
					}
				}

				if (update){
					this.updateBuffer(geometry, webglBuffer);
				}
			}

			if (webglBuffer){
				gl.bindVertexArray(webglBuffer.vao);
				gl.drawArrays(gl.POINTS, 0, webglBuffer.numElements);
				gl.bindVertexArray(null);
			}
		}

		for (var i = 0; i < 8; i++){
			if (children[i]){
				var matrix = transform.clone();
				matrix.scale(new THREE.Vector3(0.5, 0.5, 0.5));
				matrix.multiply(new THREE.Matrix4().makeTranslation(i & 1, (i & 2) >> 1, (i & 4) >> 2));

				this.renderNode(octree, children[i], matrix, target, shader, params);
			}
		}

			// uBBSize

			/*if (shadowMaps.length > 0) {

				const lShadowMap = shader.uniformLocations["uShadowMap[0]"];

				shader.setUniform3f("uShadowColor", material.uniforms.uShadowColor.value);

				let bindingStart = 5;
				let bindingPoints = new Array(shadowMaps.length).fill(bindingStart).map((a, i) => (a + i));
				gl.uniform1iv(lShadowMap, bindingPoints);

				for (let i = 0; i < shadowMaps.length; i++) {
					let shadowMap = shadowMaps[i];
					let bindingPoint = bindingPoints[i];
					let glTexture = this.threeRenderer.properties.get(shadowMap.target.texture).__webglTexture;

					gl.activeTexture(gl[`TEXTURE${bindingPoint}`]);
					gl.bindTexture(gl.TEXTURE_2D, glTexture);
				}

				{

					let worldViewMatrices = shadowMaps
						.map(sm => sm.camera.matrixWorldInverse)
						.map(view => new THREE.Matrix4().multiplyMatrices(view, world))

					let flattenedMatrices = [].concat(...worldViewMatrices.map(c => c.elements));
					const lWorldView = shader.uniformLocations["uShadowWorldView[0]"];
					gl.uniformMatrix4fv(lWorldView, false, flattenedMatrices);
				}

				{
					let flattenedMatrices = [].concat(...shadowMaps.map(sm => sm.camera.projectionMatrix.elements));
					const lProj = shader.uniformLocations["uShadowProj[0]"];
					gl.uniformMatrix4fv(lProj, false, flattenedMatrices);
				}
			}*/
	}

	renderOctree(octree, camera, target, params = {}){
		//update view matrix to match octree projection
		if (camera.controls){
			let matrix = camera.controls.update(0, octree.projection);
			camera.position.copy(camera.controls.position);			
			camera.matrix.copy({elements: matrix});

			camera.matrixAutoUpdate = false;
			camera.updateMatrixWorld(true);
		}

		octree.viewMatrixWorld = camera.matrixWorld.clone();
		octree.viewMatrixWorldInv = camera.matrixWorldInverse.clone();

		let gl = this.gl;

		let material = params.material ? params.material : octree.material;
		let shadowMaps = params.shadowMaps == null ? [] : params.shadowMaps;
		let view = camera.matrixWorldInverse;
		let viewInv = camera.matrixWorld;
		let proj = camera.projectionMatrix;
		let projInv = new THREE.Matrix4().getInverse(proj);
		let worldView = new THREE.Matrix4();

		let shader = null;

		{ // UPDATE SHADER AND TEXTURES
			if (!this.shaders.has(material)) {
				let [vs, fs] = [material.vertexShader, material.fragmentShader];
				let shader = new Shader(gl, "pointcloud", vs, fs);

				this.shaders.set(material, shader);
			}

			shader = this.shaders.get(material);

			//if(material.needsUpdate){
			{
				let [vs, fs] = [material.vertexShader, material.fragmentShader];

				let numSnapshots = material.snapEnabled ? material.numSnapshots : 0;
				let numClipBoxes = (material.clipBoxes && material.clipBoxes.length) ? material.clipBoxes.length : 0;
				let numClipSpheres = (params.clipSpheres && params.clipSpheres.length) ? params.clipSpheres.length : 0;
				let numClipPolygons = (material.clipPolygons && material.clipPolygons.length) ? material.clipPolygons.length : 0;

				//debugger;



				let defines = [
					`#define num_shadowmaps ${shadowMaps.length}`,
					`#define num_snapshots ${numSnapshots}`,
					`#define num_clipboxes ${numClipBoxes}`,
					`#define num_clipspheres ${numClipSpheres}`,
					`#define num_clippolygons ${numClipPolygons}`,
				];


				if(octree.pcoGeometry.root.isLoaded()){
					let attributes = octree.pcoGeometry.root.geometry.attributes;

					if(attributes.gpsTime){
						defines.push("#define clip_gps_enabled");
					}

					if(attributes.returnNumber){
						defines.push("#define clip_return_number_enabled");
					}

					if(attributes.numberOfReturns){
						defines.push("#define clip_number_of_returns_enabled");
					}

				}

				//vs = `#define num_shadowmaps ${shadowMaps.length}\n` + vs;
				//fs = `#define num_shadowmaps ${shadowMaps.length}\n` + fs;

				let definesString = defines.join("\n");

				let vsVersionIndex = vs.indexOf("#version ");
				let fsVersionIndex = fs.indexOf("#version ");

				if(vsVersionIndex >= 0){
					vs = vs.replace(/(#version .*)/, `$1\n${definesString}`)
				}else{
					vs = `${definesString}\n${vs}`;
				}

				if(fsVersionIndex >= 0){
					fs = fs.replace(/(#version .*)/, `$1\n${definesString}`)
				}else{
					fs = `${definesString}\n${fs}`;
				}


				shader.update(vs, fs);

				material.needsUpdate = false;
			}

			for (let uniformName of Object.keys(material.uniforms)) {
				let uniform = material.uniforms[uniformName];

				if (uniform.type == "t") {

					let texture = uniform.value;

					if (!texture) {
						continue;
					}

					if (!this.textures.has(texture)) {
						let webglTexture = new WebGLTexture(gl, texture);

						this.textures.set(texture, webglTexture);
					}

					let webGLTexture = this.textures.get(texture);
					webGLTexture.update();


				}
			}
		}

		gl.useProgram(shader.program);

		let transparent = false;
		if(params.transparent !== undefined){
			transparent = params.transparent && material.opacity < 1;
		}else{
			transparent = material.opacity < 1;
		}

		if (transparent){
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
			gl.depthMask(false);
			gl.disable(gl.DEPTH_TEST);
		} else {
			gl.disable(gl.BLEND);
			gl.depthMask(true);
			gl.enable(gl.DEPTH_TEST);
		}

		if(params.blendFunc !== undefined){
			gl.enable(gl.BLEND);
			gl.blendFunc(...params.blendFunc);
		}

		if(params.depthTest !== undefined){
			if(params.depthTest === true){
				gl.enable(gl.DEPTH_TEST);
			}else{
				gl.disable(gl.DEPTH_TEST);
			}
		}

		if(params.depthWrite !== undefined){
			 if(params.depthWrite === true){
				 gl.depthMask(true);
			 }else{
				 gl.depthMask(false);
			 }
			 
		}


		{ // UPDATE UNIFORMS
			shader.setUniformMatrix4("projectionMatrix", proj);
			shader.setUniformMatrix4("viewMatrix", view);
			shader.setUniformMatrix4("uViewInv", viewInv);
			shader.setUniformMatrix4("uProjInv", projInv);

			let screenWidth = target ? target.width : material.screenWidth;
			let screenHeight = target ? target.height : material.screenHeight;

			shader.setUniform1f("uScreenWidth", screenWidth);
			shader.setUniform1f("uScreenHeight", screenHeight);
			shader.setUniform1f("fov", Math.PI * camera.fov / 180);
			shader.setUniform1f("near", camera.near);
			shader.setUniform1f("far", camera.far);
			shader.setUniform1f("nearPlaneHeight", screenHeight / 2 / Math.tan((Math.PI * camera.fov / 180) / 2));
			
			if(camera instanceof THREE.OrthographicCamera){
				shader.setUniform("uUseOrthographicCamera", true);
				shader.setUniform("uOrthoWidth", camera.right - camera.left); 
				shader.setUniform("uOrthoHeight", camera.top - camera.bottom);
			}else{
				shader.setUniform("uUseOrthographicCamera", false);
			}

			if(material.clipBoxes.length + material.clipPolygons.length === 0){
				shader.setUniform1i("clipTask", ClipTask.NONE);
			}else{
				shader.setUniform1i("clipTask", material.clipTask);
			}

			shader.setUniform1i("clipMethod", material.clipMethod);
			
			//being lazy here using a different math library than three
			if (Math.Vector && material.clipBoxes && material.clipBoxes.length > 0) {
				let orig = material.uniforms.clipBoxes.value;
				let uni = new Float32Array(orig.length);
				let view = Math.mat4(viewInv.elements);

				for (let i = 0; i < orig.length; i += 16){
					//project
					let mat = Math.mat4(orig.slice(i, 16));

					if (camera.controls && camera.controls.project){
						let p = camera.controls.project(octree.projection);

						try {
							let origin = p(Math.vec3(0).multiply(mat));
							let x = p(Math.vec3(1, 0, 0).multiply(mat)).subtract(origin);
							let y = p(Math.vec3(0, 1, 0).multiply(mat)).subtract(origin);
							let z = p(Math.vec3(0, 0, 1).multiply(mat)).subtract(origin);

							mat = Math.mat4(x, 0, y, 0, z, 0, origin, 1);
						}catch (e){}
					}

					uni.set(mat.invert().multiply(view), i);
				}

				gl.uniformMatrix4fv(shader.uniformLocations["clipBoxes[0]"], false, uni);
			}

			// TODO CLIPSPHERES
			if(params.clipSpheres && params.clipSpheres.length > 0){

				let clipSpheres = params.clipSpheres;

				let matrices = [];
				for(let clipSphere of clipSpheres){
					//let mScale = new THREE.Matrix4().makeScale(...clipSphere.scale.toArray());
					//let mTranslate = new THREE.Matrix4().makeTranslation(...clipSphere.position.toArray());

					//let clipToWorld = new THREE.Matrix4().multiplyMatrices(mTranslate, mScale);
					let clipToWorld = clipSphere.matrixWorld;
					let viewToWorld = camera.matrixWorld
					let worldToClip = new THREE.Matrix4().getInverse(clipToWorld);

					let viewToClip = new THREE.Matrix4().multiplyMatrices(worldToClip, viewToWorld);

					matrices.push(viewToClip);
				}

				let flattenedMatrices = [].concat(...matrices.map(matrix => matrix.elements));

				const lClipSpheres = shader.uniformLocations["uClipSpheres[0]"];
				gl.uniformMatrix4fv(lClipSpheres, false, flattenedMatrices);
				
				//const lClipSpheres = shader.uniformLocations["uClipSpheres[0]"];
				//gl.uniformMatrix4fv(lClipSpheres, false, material.uniforms.clipSpheres.value);
			}

			shader.setUniform1f("size", material.size);
			shader.setUniform1f("maxSize", material.uniforms.maxSize.value);
			shader.setUniform1f("minSize", material.uniforms.minSize.value);

			// uniform float uPCIndex
			shader.setUniform1f("uOctreeSpacing", material.spacing);
			shader.setUniform("uOctreeSize", material.uniforms.octreeSize.value);
			gl.uniform1fv(shader.uniformLocations["classificationFilters[0]"], material.uniforms.classificationFilters.value);

			//uniform vec3 uColor;
			shader.setUniform3f("uColor", material.color.toArray());
			//uniform float opacity;
			shader.setUniform1f("uOpacity", material.opacity);

			shader.setUniform2f("elevationRange", material.elevationRange);
			shader.setUniform2f("intensityRange", material.intensityRange);
			//uniform float intensityGamma;
			//uniform float intensityContrast;
			//uniform float intensityBrightness;
			shader.setUniform1f("intensityGamma", material.intensityGamma);
			shader.setUniform1f("intensityContrast", material.intensityContrast);
			shader.setUniform1f("intensityBrightness", material.intensityBrightness);

			shader.setUniform1f("rgbGamma", material.rgbGamma);
			shader.setUniform1f("rgbContrast", material.rgbContrast);
			shader.setUniform1f("rgbBrightness", material.rgbBrightness);
			shader.setUniform1f("uTransition", material.transition);
			
			{
				let weights = new Float32Array(16);
				let i = 0;

				for (var o in material.colorMixer){
					if (material.colorMixer[o]){
						weights[i++] = material.colorMixer[o];
					}
				}

				gl.uniform1fv(shader.uniformLocations["colorWeights[0]"], weights);
			}

			let currentTextureBindingPoint = 0;

			let gradientTexture = this.textures.get(material.gradientTexture);
			shader.setUniform1i("gradient", currentTextureBindingPoint);
			gl.activeTexture(gl.TEXTURE0 + currentTextureBindingPoint);
			gl.bindTexture(gradientTexture.target, gradientTexture.id);
			currentTextureBindingPoint++;

			let classificationTexture = this.textures.get(material.classificationTexture);
			shader.setUniform1i("classificationLUT", currentTextureBindingPoint);
			gl.activeTexture(gl.TEXTURE0 + currentTextureBindingPoint);
			gl.bindTexture(classificationTexture.target, classificationTexture.id);
			currentTextureBindingPoint++;


			if (material.snapEnabled === true) {

				{
					const lSnapshot = shader.uniformLocations["uSnapshot[0]"];
					const lSnapshotDepth = shader.uniformLocations["uSnapshotDepth[0]"];

					let bindingStart = currentTextureBindingPoint;
					let lSnapshotBindingPoints = new Array(5).fill(bindingStart).map((a, i) => (a + i));
					let lSnapshotDepthBindingPoints = new Array(5)
						.fill(1 + Math.max(...lSnapshotBindingPoints))
						.map((a, i) => (a + i));
					currentTextureBindingPoint = 1 + Math.max(...lSnapshotDepthBindingPoints);

					gl.uniform1iv(lSnapshot, lSnapshotBindingPoints);
					gl.uniform1iv(lSnapshotDepth, lSnapshotDepthBindingPoints);

					for (let i = 0; i < 5; i++) {
						let texture = material.uniforms[`uSnapshot`].value[i];
						let textureDepth = material.uniforms[`uSnapshotDepth`].value[i];

						if (!texture) {
							break;
						}

						let snapTexture = this.threeRenderer.properties.get(texture).__webglTexture;
						let snapTextureDepth = this.threeRenderer.properties.get(textureDepth).__webglTexture;

						let bindingPoint = lSnapshotBindingPoints[i];
						let depthBindingPoint = lSnapshotDepthBindingPoints[i];

						gl.activeTexture(gl[`TEXTURE${bindingPoint}`]);
						gl.bindTexture(gl.TEXTURE_2D, snapTexture);

						gl.activeTexture(gl[`TEXTURE${depthBindingPoint}`]);
						gl.bindTexture(gl.TEXTURE_2D, snapTextureDepth);
					}
				}

				{
					let flattenedMatrices = [].concat(...material.uniforms.uSnapView.value.map(c => c.elements));
					const lSnapView = shader.uniformLocations["uSnapView[0]"];
					gl.uniformMatrix4fv(lSnapView, false, flattenedMatrices);
				}
				{
					let flattenedMatrices = [].concat(...material.uniforms.uSnapProj.value.map(c => c.elements));
					const lSnapProj = shader.uniformLocations["uSnapProj[0]"];
					gl.uniformMatrix4fv(lSnapProj, false, flattenedMatrices);
				}
				{
					let flattenedMatrices = [].concat(...material.uniforms.uSnapProjInv.value.map(c => c.elements));
					const lSnapProjInv = shader.uniformLocations["uSnapProjInv[0]"];
					gl.uniformMatrix4fv(lSnapProjInv, false, flattenedMatrices);
				}
				{
					let flattenedMatrices = [].concat(...material.uniforms.uSnapViewInv.value.map(c => c.elements));
					const lSnapViewInv = shader.uniformLocations["uSnapViewInv[0]"];
					gl.uniformMatrix4fv(lSnapViewInv, false, flattenedMatrices);
				}

			}
		}
		
		if (octree.root.sceneNode){
			var matrix = camera.matrixWorldInverse.clone();
			matrix.multiply(octree.root.sceneNode.matrixWorld);

			let min = octree.root.pointcloud.boundingBox.min;
			let max = octree.root.pointcloud.boundingBox.max;

			matrix.scale({x: max.x - min.x, y: max.y - min.y, z: max.z - min.z});

			this.renderNode(octree, octree.root, matrix, target, shader, params);
		}

		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.activeTexture(gl.TEXTURE0);

		if (camera.controls){
			let matrix = camera.controls.update(0);
			camera.position.copy(camera.controls.position);			
			camera.matrix.copy({elements: matrix});

			camera.matrixAutoUpdate = false;
			camera.updateMatrixWorld(true);
		}
	}

	render(octree, camera, target = null, params = {}) {
		const gl = this.gl;

		// PREPARE 
		if (target != null) {
			this.threeRenderer.setRenderTarget(target);
		}

		camera.updateProjectionMatrix();
		this.renderOctree(octree, camera, target, params);

		// CLEANUP
		gl.bindVertexArray(null);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, null)

		this.threeRenderer.state.reset();
	}
};








