
precision highp float;
precision highp int;

#define max_clip_polygons 8
#define PI 3.141592653589793

attribute vec3 position;
attribute vec3 color;
attribute float intensity;
attribute float classification;
attribute float returnNumber;
attribute float numberOfReturns;
attribute float pointSourceID;
attribute vec4 indices;
attribute float spacing;
attribute float gpsTime;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 uViewInv;

uniform float setChildren;

uniform float nodeLevel;

uniform float uScreenWidth;
uniform float uScreenHeight;
uniform float fov;
uniform float near;
uniform float far;
uniform float nearPlaneHeight;

uniform bool uUseOrthographicCamera;
uniform float uOrthoWidth;
uniform float uOrthoHeight;


#define CLIPTASK_NONE 0
#define CLIPTASK_HIGHLIGHT 1
#define CLIPTASK_SHOW_INSIDE 2
#define CLIPTASK_SHOW_OUTSIDE 3

#define CLIPMETHOD_INSIDE_ANY 0
#define CLIPMETHOD_INSIDE_ALL 1

uniform int clipTask;
uniform int clipMethod;
#if defined(num_clipboxes) && num_clipboxes > 0
	uniform mat4 clipBoxes[num_clipboxes];
#endif

#if defined(num_clipspheres) && num_clipspheres > 0
	uniform mat4 uClipSpheres[num_clipspheres];
#endif

#if defined(num_clippolygons) && num_clippolygons > 0
	uniform int uClipPolygonVCount[num_clippolygons];
	uniform vec3 uClipPolygonVertices[num_clippolygons * 8];
	uniform mat4 uClipPolygonWVP[num_clippolygons];
#endif


uniform float size;
uniform float minSize;
uniform float maxSize;

uniform float uPCIndex;
uniform float uOctreeSpacing;
uniform float uNodeSpacing;
uniform float uOctreeSize;
uniform vec3 uBBSize;
uniform float uLevel;

uniform vec3 uColor;
uniform float uOpacity;

uniform vec2 elevationRange;
uniform vec2 intensityRange;

uniform vec2 uFilterReturnNumberRange;
uniform vec2 uFilterNumberOfReturnsRange;
uniform vec2 uFilterGPSTimeClipRange;

uniform float uGPSOffset;
uniform float uGPSRange;
uniform float intensityGamma;
uniform float intensityContrast;
uniform float intensityBrightness;
uniform float rgbGamma;
uniform float rgbContrast;
uniform float rgbBrightness;
uniform float uTransition;

uniform float colorWeights[16];

uniform vec3 uShadowColor;

uniform sampler2D visibleNodes;
uniform sampler2D gradient;
uniform sampler2D classificationLUT;

#if defined(num_shadowmaps) && num_shadowmaps > 0
uniform sampler2D uShadowMap[num_shadowmaps];
uniform mat4 uShadowWorldView[num_shadowmaps];
uniform mat4 uShadowProj[num_shadowmaps];
#endif

varying vec4	vColor;
varying float	vLogDepth;
varying vec3	vViewPosition;
varying float 	vRadius;
varying float 	vPointSize;


float round(float number){
	return floor(number + 0.5);
}

// 
//    ###    ########     ###    ########  ######## #### ##     ## ########     ######  #### ######## ########  ######  
//   ## ##   ##     ##   ## ##   ##     ##    ##     ##  ##     ## ##          ##    ##  ##       ##  ##       ##    ## 
//  ##   ##  ##     ##  ##   ##  ##     ##    ##     ##  ##     ## ##          ##        ##      ##   ##       ##       
// ##     ## ##     ## ##     ## ########     ##     ##  ##     ## ######       ######   ##     ##    ######    ######  
// ######### ##     ## ######### ##           ##     ##   ##   ##  ##                ##  ##    ##     ##             ## 
// ##     ## ##     ## ##     ## ##           ##     ##    ## ##   ##          ##    ##  ##   ##      ##       ##    ## 
// ##     ## ########  ##     ## ##           ##    ####    ###    ########     ######  #### ######## ########  ######  
//
																	
float getLOD(){
	return uLevel;
}

float getSpacing(){
	return uNodeSpacing;
}

float getPointSizeAttenuation(){
	return pow(2.0, getLOD());
}

// ---------------------
// KD-TREE
// ---------------------

#if (defined(adaptive_point_size) || defined(color_weight_lod)) && defined(tree_type_kdtree)

float getLOD(){
	vec3 offset = vec3(0.0, 0.0, 0.0);
	float iOffset = 0.0;
	float depth = 0.0;
		
		
	vec3 size = uBBSize;	
	vec3 pos = position;
		
	for(float i = 0.0; i <= 1000.0; i++){
		
		vec4 value = texture2D(visibleNodes, vec2(iOffset / 2048.0, 0.0));
		
		int children = int(value.r * 255.0);
		float next = value.g * 255.0;
		int split = int(value.b * 255.0);
		
		if(next == 0.0){
		 	return depth;
		}
		
		vec3 splitv = vec3(0.0, 0.0, 0.0);
		if(split == 1){
			splitv.x = 1.0;
		}else if(split == 2){
		 	splitv.y = 1.0;
		}else if(split == 4){
		 	splitv.z = 1.0;
		}
		
		iOffset = iOffset + next;
		
		float factor = length(pos * splitv / size);
		if(factor < 0.5){
			// left
		if(children == 0 || children == 2){
				return depth;
			}
		}else{
			// right
			pos = pos - size * splitv * 0.5;
			if(children == 0 || children == 1){
				return depth;
			}
			if(children == 3){
				iOffset = iOffset + 1.0;
			}
		}
		size = size * ((1.0 - (splitv + 1.0) / 2.0) + 0.5);
		
		depth++;
	}
		
		
	return depth;	
}

float getPointSizeAttenuation(){
	return 0.5 * pow(1.3, getLOD());
}

#endif



// 
//    ###    ######## ######## ########  #### ########  ##     ## ######## ########  ######  
//   ## ##      ##       ##    ##     ##  ##  ##     ## ##     ##    ##    ##       ##    ## 
//  ##   ##     ##       ##    ##     ##  ##  ##     ## ##     ##    ##    ##       ##       
// ##     ##    ##       ##    ########   ##  ########  ##     ##    ##    ######    ######  
// #########    ##       ##    ##   ##    ##  ##     ## ##     ##    ##    ##             ## 
// ##     ##    ##       ##    ##    ##   ##  ##     ## ##     ##    ##    ##       ##    ## 
// ##     ##    ##       ##    ##     ## #### ########   #######     ##    ########  ######                                                                               
// 



// formula adapted from: http://www.dfstudios.co.uk/articles/programming/image-programming-algorithms/image-processing-algorithms-part-5-contrast-adjustment/
float getContrastFactor(float contrast){
	return (1.0158730158730156 * (contrast + 1.0)) / (1.0158730158730156 - contrast);
}

vec3 getRGB(){
	vec3 rgb = color;
	
	rgb = pow(rgb, vec3(rgbGamma));
	rgb = rgb + rgbBrightness;
	//rgb = (rgb - 0.5) * getContrastFactor(rgbContrast) + 0.5;
	rgb = clamp(rgb, 0.0, 1.0);

		//rgb = indices.rgb;
	//rgb.b = pcIndex / 255.0;
	
	
	return rgb;
}

float getIntensity(){
	float w = (intensity - intensityRange.x) / (intensityRange.y - intensityRange.x);
	w = pow(w, intensityGamma);
	w = w + intensityBrightness;
	w = (w - 0.5) * getContrastFactor(intensityContrast) + 0.5;
	w = clamp(w, 0.0, 1.0);

	return w;
}

float getGpsTime(){
	float w = (gpsTime + uGPSOffset) / uGPSRange;
	w = clamp(w, 0.0, 1.0);

	return w;
}

vec3 getElevation(){
	vec4 world = modelMatrix * vec4( position, 1.0 );
	float w = (world.z - elevationRange.x) / (elevationRange.y - elevationRange.x);
	vec3 cElevation = texture2D(gradient, vec2(w,1.0-w)).rgb;
	
	return cElevation;
}

vec4 getClassification(){
	vec2 uv = vec2(classification / 255.0, 0.5);
	vec4 classColor = texture2D(classificationLUT, uv);
	
	return classColor;
}

vec3 getReturnNumber(){
	if(numberOfReturns == 1.0){
		return vec3(1.0, 1.0, 0.0);
	}else{
		if(returnNumber == 1.0){
			return vec3(1.0, 0.0, 0.0);
		}else if(returnNumber == numberOfReturns){
			return vec3(0.0, 0.0, 1.0);
		}else{
			return vec3(0.0, 1.0, 0.0);
		}
	}
}

vec3 getSourceID(){
	float w = mod(pointSourceID, 10.0) / 10.0;
	return texture2D(gradient, vec2(w,1.0 - w)).rgb;
}


// 
//  ######  ##       #### ########  ########  #### ##    ##  ######   
// ##    ## ##        ##  ##     ## ##     ##  ##  ###   ## ##    ##  
// ##       ##        ##  ##     ## ##     ##  ##  ####  ## ##        
// ##       ##        ##  ########  ########   ##  ## ## ## ##   #### 
// ##       ##        ##  ##        ##         ##  ##  #### ##    ##  
// ##    ## ##        ##  ##        ##         ##  ##   ### ##    ##  
//  ######  ######## #### ##        ##        #### ##    ##  ######                                                          
// 



vec4 getColor(){
	vec4 color = vec4(uColor, uOpacity);
	
	#ifdef color_weight_rgb
		color.xyz += getRGB() * colorWeights[color_weight_rgb];
	#endif

	#ifdef color_weight_height
		color.xyz += getElevation() * colorWeights[color_weight_height];
	#endif

	#ifdef color_weight_rgb_height
		color.xyz += ((1.0 - uTransition) * getRGB() + uTransition) * colorWeights[color_weight_rgb_height];
	#endif

	#ifdef color_weight_depth
		color.xyz += vec3(gl_Position.w, (gl_Position.z / gl_Position.w) * 0.5 + 0.5, 0.0) * colorWeights[color_weight_depth];
	#endif

	#ifdef color_weight_intensity
		color.xyz += vec3(getIntensity() * colorWeights[color_weight_intensity]);
	#endif

	#ifdef color_weight_gpstime
		color.xyz += vec3(getGpsTime() * colorWeights[color_weight_gpstime]);
	#endif

	#ifdef color_weight_intensity_gradient
	{
		float w = getIntensity();
		color.xyz += texture2D(gradient, vec2(w,1.0-w)).rgb * colorWeights[color_weight_intensity_gradient];
	}
	#endif

	#ifdef color_weight_lod
	{
		float depth = getLOD();
		float w = depth / 10.0;
		color.xyz += texture2D(gradient, vec2(w,1.0-w)).rgb * colorWeights[color_weight_lod];
	}
	#endif

	#ifdef color_weight_classification
		color.xyz += getClassification().rgb * colorWeights[color_weight_classification];
	#endif

	#ifdef color_weight_return_number
		color.xyz += getReturnNumber() * colorWeights[color_weight_return_number];
	#endif

	#ifdef color_weight_source
		color.xyz += getSourceID() * colorWeights[color_weight_source];
	#endif

	#ifdef color_weight_normal
		color.xyz += (modelMatrix * vec4(normal, 0.0)).xyz * colorWeights[color_weight_normal];
	#endif

	#ifdef color_weight_point_index
		color = vec4(indices.rgb, uPCIndex / 255.) * colorWeights[color_weight_point_index];
	#endif
	
	return color;
}

float getPointSize(){
	float pointSize = 1.0;
	
	float slope = tan(fov / 2.0);
	float projFactor = -0.5 * uScreenHeight / (slope * vViewPosition.z);
	
	float r = uOctreeSpacing * 1.7;
	vRadius = r;
	#if defined fixed_point_size
		pointSize = 0;
	#elif defined attenuated_point_size
		if(uUseOrthographicCamera){
			pointSize = size;
		}else{
			pointSize = size * spacing * projFactor;
			//pointSize = pointSize * projFactor;
		}
	#elif defined adaptive_point_size
		pointSize = size * nearPlaneHeight / gl_Position.w / pow(2., getLOD());
	#endif

	pointSize = max(minSize, pointSize);
	pointSize = min(maxSize, pointSize);
	
	vRadius = pointSize / projFactor;

	return pointSize;
}

#if defined(num_clippolygons) && num_clippolygons > 0
bool pointInClipPolygon(vec3 point, int polyIdx) {

	mat4 wvp = uClipPolygonWVP[polyIdx];
	//vec4 screenClipPos = uClipPolygonVP[polyIdx] * modelMatrix * vec4(point, 1.0);
	//screenClipPos.xy = screenClipPos.xy / screenClipPos.w * 0.5 + 0.5;

	vec4 pointNDC = wvp * vec4(point, 1.0);
	pointNDC.xy = pointNDC.xy / pointNDC.w;

	int j = uClipPolygonVCount[polyIdx] - 1;
	bool c = false;
	for(int i = 0; i < 8; i++) {
		if(i == uClipPolygonVCount[polyIdx]) {
			break;
		}

		//vec4 verti = wvp * vec4(uClipPolygonVertices[polyIdx * 8 + i], 1);
		//vec4 vertj = wvp * vec4(uClipPolygonVertices[polyIdx * 8 + j], 1);

		//verti.xy = verti.xy / verti.w;
		//vertj.xy = vertj.xy / vertj.w;

		//verti.xy = verti.xy / verti.w * 0.5 + 0.5;
		//vertj.xy = vertj.xy / vertj.w * 0.5 + 0.5;

		vec3 verti = uClipPolygonVertices[polyIdx * 8 + i];
		vec3 vertj = uClipPolygonVertices[polyIdx * 8 + j];

		if( ((verti.y > pointNDC.y) != (vertj.y > pointNDC.y)) && 
			(pointNDC.x < (vertj.x-verti.x) * (pointNDC.y-verti.y) / (vertj.y-verti.y) + verti.x) ) {
			c = !c;
		}
		j = i;
	}

	return c;
}
#endif

void doClipping(){
	#if defined(clip_return_number_enabled)
	{ // return number filter
		vec2 range = uFilterReturnNumberRange;
		if(returnNumber < range.x || returnNumber > range.y){
			gl_Position = vec4(100.0, 100.0, 100.0, 0.0);
			
			return;
		}
	}
	#endif

	#if defined(clip_number_of_returns_enabled)
	{ // number of return filter
		vec2 range = uFilterNumberOfReturnsRange;
		if(numberOfReturns < range.x || numberOfReturns > range.y){
			gl_Position = vec4(100.0, 100.0, 100.0, 0.0);
			
			return;
		}
	}
	#endif

	#if defined(clip_gps_enabled)
	{ // GPS time filter
		float time = gpsTime + uGPSOffset;
		vec2 range = uFilterGPSTimeClipRange;

		if(time < range.x || time > range.y){
			gl_Position = vec4(100.0, 100.0, 100.0, 0.0);
			
			return;
		}
	}
	#endif

	int clipVolumesCount = 0;
	int insideCount = 0;

	#if defined(num_clipboxes) && num_clipboxes > 0
		for(int i = 0; i < num_clipboxes; i++){
			vec4 clipPosition = clipBoxes[i] * modelMatrix * vec4( position, 1.0 );
			bool inside = -0.5 <= clipPosition.x && clipPosition.x <= 0.5;
			inside = inside && -0.5 <= clipPosition.y && clipPosition.y <= 0.5;
			inside = inside && -0.5 <= clipPosition.z && clipPosition.z <= 0.5;

			insideCount = insideCount + (inside ? 1 : 0);
			clipVolumesCount++;
		}	
	#endif

	#if defined(num_clippolygons) && num_clippolygons > 0
		for(int i = 0; i < num_clippolygons; i++) {
			bool inside = pointInClipPolygon(position, i);

			insideCount = insideCount + (inside ? 1 : 0);
			clipVolumesCount++;
		}
	#endif

	bool insideAny = insideCount > 0;
	bool insideAll = (clipVolumesCount > 0) && (clipVolumesCount == insideCount);

	if(clipMethod == CLIPMETHOD_INSIDE_ANY){
		if(insideAny && clipTask == CLIPTASK_HIGHLIGHT){
			vColor.r += 0.5;
		}else if(!insideAny && clipTask == CLIPTASK_SHOW_INSIDE){
			gl_Position = vec4(100.0, 100.0, 100.0, 1.0);
		}else if(insideAny && clipTask == CLIPTASK_SHOW_OUTSIDE){
			gl_Position = vec4(100.0, 100.0, 100.0, 1.0);
		}
	}else if(clipMethod == CLIPMETHOD_INSIDE_ALL){
		if(insideAll && clipTask == CLIPTASK_HIGHLIGHT){
			vColor.r += 0.5;
		}else if(!insideAll && clipTask == CLIPTASK_SHOW_INSIDE){
			gl_Position = vec4(100.0, 100.0, 100.0, 1.0);
		}else if(insideAll && clipTask == CLIPTASK_SHOW_OUTSIDE){
			gl_Position = vec4(100.0, 100.0, 100.0, 1.0);
		}
	}
}



// 
// ##     ##    ###    #### ##    ## 
// ###   ###   ## ##    ##  ###   ## 
// #### ####  ##   ##   ##  ####  ## 
// ## ### ## ##     ##  ##  ## ## ## 
// ##     ## #########  ##  ##  #### 
// ##     ## ##     ##  ##  ##   ### 
// ##     ## ##     ## #### ##    ## 
//

void main() {
	vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
	vViewPosition = mvPosition.xyz;
	gl_Position = projectionMatrix * mvPosition;
	vLogDepth = log2(-mvPosition.z);


	// POINT SIZE
	float pointSize = getPointSize();
	gl_PointSize = pointSize;
	vPointSize = pointSize;

	// COLOR
	vColor = getColor();

	//LOD CLIPPING clip lowel detail points if higher detail ponts are going to render there
	{
		//vColor = vec4(position, 1);
		int bit = int(position.x >= .5) + int(position.y >= .5) * 2 + int(position.z >= .5) * 4;

		if (mod(setChildren / pow(2., float(bit)), 2.) >= 1.) gl_Position = vec4(100.0, 100.0, 100.0, 0.0);
	}


	#if defined hq_depth_pass
		float originalDepth = gl_Position.w;
		float adjustedDepth = originalDepth + 2.0 * vRadius;
		float adjust = adjustedDepth / originalDepth;

		mvPosition.xyz = mvPosition.xyz * adjust;
		gl_Position = projectionMatrix * mvPosition;
	#endif


	// CLIPPING
	doClipping();

	#if defined(num_clipspheres) && num_clipspheres > 0
		for(int i = 0; i < num_clipspheres; i++){
			vec4 sphereLocal = uClipSpheres[i] * mvPosition;

			float distance = length(sphereLocal.xyz);

			if(distance < 1.0){
				float w = distance;
				vColor.rgb = texture2D(gradient, vec2(w, 1.0 - w)).rgb;
			}
		}
	#endif

	#if defined(num_shadowmaps) && num_shadowmaps > 0

		const float sm_near = 0.1;
		const float sm_far = 10000.0;

		for(int i = 0; i < num_shadowmaps; i++){
			vec3 viewPos = (uShadowWorldView[i] * vec4(position, 1.0)).xyz;
			float distanceToLight = abs(viewPos.z);
			
			vec4 projPos = uShadowProj[i] * uShadowWorldView[i] * vec4(position, 1);
			vec3 nc = projPos.xyz / projPos.w;
			
			float u = nc.x * 0.5 + 0.5;
			float v = nc.y * 0.5 + 0.5;

			vec2 sampleStep = vec2(1.0 / (2.0*1024.0), 1.0 / (2.0*1024.0)) * 1.5;
			vec2 sampleLocations[9];
			sampleLocations[0] = vec2(0.0, 0.0);
			sampleLocations[1] = sampleStep;
			sampleLocations[2] = -sampleStep;
			sampleLocations[3] = vec2(sampleStep.x, -sampleStep.y);
			sampleLocations[4] = vec2(-sampleStep.x, sampleStep.y);

			sampleLocations[5] = vec2(0.0, sampleStep.y);
			sampleLocations[6] = vec2(0.0, -sampleStep.y);
			sampleLocations[7] = vec2(sampleStep.x, 0.0);
			sampleLocations[8] = vec2(-sampleStep.x, 0.0);

			float visibleSamples = 0.0;
			float numSamples = 0.0;

			float bias = vRadius * 2.0;

			for(int j = 0; j < 9; j++){
				vec4 depthMapValue = texture2D(uShadowMap[i], vec2(u, v) + sampleLocations[j]);

				float linearDepthFromSM = depthMapValue.x + bias;
				float linearDepthFromViewer = distanceToLight;

				if(linearDepthFromSM > linearDepthFromViewer){
					visibleSamples += 1.0;
				}

				numSamples += 1.0;
			}

			float visibility = visibleSamples / numSamples;

			if(u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0 || nc.x < -1.0 || nc.x > 1.0 || nc.y < -1.0 || nc.y > 1.0 || nc.z < -1.0 || nc.z > 1.0){
				//vColor = vec3(0.0, 0.0, 0.2);
			}else{
				//vColor = vec3(1.0, 1.0, 1.0) * visibility + vec3(1.0, 1.0, 1.0) * vec3(0.5, 0.0, 0.0) * (1.0 - visibility);
				vColor.xyz = vColor.xyz * visibility + vColor.xyz * uShadowColor * (1.0 - visibility);
			}
		}

	#endif
}
