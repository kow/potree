#extension GL_EXT_frag_depth : enable

precision highp float;
precision highp int;

uniform mat4 viewMatrix;
uniform mat4 uViewInv;
uniform mat4 uProjInv;
uniform vec3 cameraPosition;


uniform mat4 projectionMatrix;

uniform float blendHardness;
uniform float blendDepthSupplement;
uniform float fov;
uniform float uSpacing;
uniform float near;
uniform float far;
uniform float uScreenWidth;
uniform float uScreenHeight;

varying vec2 logDepth;

varying vec4	vColor;
varying float	vLogDepth;
varying vec3	vViewPosition;
varying float	vRadius;
varying float 	vPointSize;
varying vec3 	vPosition;

void main() {
	gl_FragColor = vColor;

	#if defined circle_point_shape
		if (length (gl_PointCoord * 2. - 1.) > 1.) discard;
	#endif

	#if defined(use_edl)
		gl_FragColor.a = vLogDepth;
	#endif

	#if defined(weighted_splats)
		float distance = 2.0 * length(gl_PointCoord.xy - 0.5);
		float weight = max(0.0, 1.0 - distance);
		weight = pow(weight, 1.5);

		gl_FragColor.a = weight;
		gl_FragColor.xyz = gl_FragColor.xyz * weight;
	#endif

	#ifndef color_weight_point_index
		gl_FragColor.a *= clamp(vPointSize, 0., 1.);
	#endif

	//gl_FragDepthEXT = log2(logDepth.x) * logDepth.y;
}


