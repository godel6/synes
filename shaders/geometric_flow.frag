#version 330

in vec2 v_uv;
out vec4 f_color;

uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_lyrics;
uniform float u_palette;
uniform vec2 u_resolution;

vec3 getPaletteColor(float idx) {
    if (idx < 0.5) return vec3(0.4, 0.3, 0.8);
    else if (idx < 1.5) return vec3(0.9, 0.5, 0.2);
    else if (idx < 2.5) return vec3(0.2, 0.7, 0.8);
    else return vec3(1.0, 0.3, 0.7);
}

#define PI 3.14159265359

// SDF for circle
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

// SDF for triangle
float sdTriangle(vec2 p, float r) {
    const float k = sqrt(3.0);
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if(p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
}

// SDF for square
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Rotate
vec2 rotate(vec2 p, float a) {
    float c = cos(a);
    float s = sin(a);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 uv = v_uv;

    // Fix aspect ratio for fullscreen
    float aspect = u_resolution.x / u_resolution.y;
    vec2 center = uv - 0.5;
    center.x *= aspect;
    float dist = length(center);

    // Bass: rotation speed (dramatic increase with bass)
    float rotSpeed = u_time * (0.5 + u_bass * 3.0);

    // Mid: shape complexity (morph between circle, triangle, square)
    float shapeMix = u_mid;
    float currentShape = mod(shapeMix * 3.0, 3.0);

    vec3 color = vec3(0.0);

    // Multiple rotating layers - BIGGER shapes
    for(int layer = 0; layer < 6; layer++) {
        float layerDist = 0.15 + float(layer) * 0.12;
        float layerRot = rotSpeed * (1.0 + float(layer) * 0.4);

        vec2 p = rotate(center, layerRot);

        // Shape based on mid
        float d;
        if(currentShape < 1.0) {
            d = sdCircle(p, layerDist);
        } else if(currentShape < 2.0) {
            d = sdTriangle(p, layerDist);
        } else {
            d = sdBox(p, vec2(layerDist * 0.8));
        }

        // Line glow - thicker lines
        float line = smoothstep(0.015, 0.0, abs(d));

        // Hue based on layer and mid
        float hue = float(layer) * 0.15 + u_time * 0.1 + u_mid * 0.5;
        vec3 layerColor = hsv2rgb(vec3(hue, 0.9, 1.0));

        color += layerColor * line * (1.2 - float(layer) * 0.15);
    }

    // Bass: extra glow on shapes
    color += vec3(0.3, 0.1, 0.5) * u_bass * 0.5;

    // Treble: line shimmer and interference
    float shimmer = sin(center.x * 30.0 + u_time * 8.0) * sin(center.y * 30.0 - u_time * 6.0);
    shimmer = shimmer * 0.5 + 0.5;
    color += vec3(shimmer * u_treble * 0.2);

    // Interference pattern
    float interference = sin(dist * 20.0 - rotSpeed * 3.0);
    interference = pow(abs(interference), 15.0);
    color += vec3(interference * u_treble * 0.15);

    // Energy: glow intensity - BRIGHTER
    float glow = 0.8 + u_energy * 0.8;
    color *= glow;

    // Center bright spot
    float centerGlow = 1.0 - smoothstep(0.0, 0.25, dist);
    color += vec3(0.3, 0.2, 0.5) * centerGlow * u_energy;

    // Vignette
    float vignette = 1.0 - dist * 0.3;
    color *= vignette;

    // Subtle lyrics glow overlay
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        color = mix(color, color + glow * 0.3, edge_glow * pulse * 0.4);
    }
    f_color = vec4(color, 1.0);
}
