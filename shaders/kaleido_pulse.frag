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
    if (idx < 0.5) return vec3(0.5, 0.2, 0.7);
    else if (idx < 1.5) return vec3(1.0, 0.4, 0.1);
    else if (idx < 2.5) return vec3(0.2, 0.7, 0.9);
    else return vec3(1.0, 0.2, 0.5);
}

float getPaletteHue(float idx) {
    if (idx < 0.5) return 0.75;
    else if (idx < 1.5) return 0.08;
    else if (idx < 2.5) return 0.55;
    else return 0.9;
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Kaleidoscope effect
vec2 kaleidoscope(vec2 uv, float segments, float rotation) {
    float angle = atan(uv.y - 0.5, uv.x - 0.5);
    float radius = length(uv - 0.5);

    // Mirror around segment boundaries
    float segmentAngle = 6.28318 / segments;
    angle = mod(angle + rotation, segmentAngle);
    angle = abs(angle - segmentAngle * 0.5);

    // Convert back to UV
    uv = vec2(cos(angle), sin(angle)) * radius + 0.5;
    return uv;
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Fix aspect ratio
    float aspect = u_resolution.x / u_resolution.y;
    center.x *= aspect;

    // Bass: segment count and rotation speed - MORE dramatic
    float segments = 4.0 + u_bass * 10.0; // 4-14 segments
    float rotation = u_time * (0.3 + u_bass * 1.5);

    // Apply kaleidoscope
    vec2 kuv = kaleidoscope(uv, segments, rotation);

    // Mid: hue shift - more dramatic
    float hue = u_time * 0.15 + u_mid * 0.8 + dist * 0.3;
    vec3 color = hsv2rgb(vec3(hue, 0.9, 1.0));

    // Bass: add extra color burst on bass
    color += vec3(0.3, 0.0, 0.5) * u_bass;

    // Treble: add geometric details - more visible
    float detail = sin(kuv.x * 30.0 + u_time * 2.0) * sin(kuv.y * 30.0 - u_time * 1.5);
    detail = detail * 0.5 + 0.5;
    color += vec3(detail * u_treble * 0.4);

    // Radial pulse with bass - stronger effect
    float pulse = sin(dist * 8.0 - u_time * (3.0 + u_bass * 6.0)) * 0.5 + 0.5;
    color *= 0.6 + pulse * u_bass * 0.8;

    // Energy: brightness and bloom - brighter
    float brightness = 0.7 + u_energy * 0.8;
    color *= brightness;

    // Extra bloom on high energy
    color += color * u_energy * 0.3;

    // Chromatic aberration based on bass - stronger
    float aberration = u_bass * 0.03;
    color.r += smoothstep(0.2, 0.5, dist) * u_bass * 0.3;
    color.b -= smoothstep(0.2, 0.5, dist) * u_bass * 0.3;

    // Vignette
    float vignette = 1.0 - dist * 0.6;
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
