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

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 getNeonColor(float idx) {
    if (idx < 0.5) return vec3(0.0, 1.0, 0.8);
    else if (idx < 1.5) return vec3(1.0, 0.0, 0.5);
    else if (idx < 2.5) return vec3(0.3, 0.8, 1.0);
    else return vec3(1.0, 0.2, 0.8);
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);

    float t = u_time;
    float speed = 0.5 + u_bass * 1.5;

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    vec3 color = vec3(0.0);

    // Expanding rings from center
    for (int i = 0; i < 15; i++) {
        float fi = float(i);

        // Ring position
        float ringRadius = fract(t * speed * 0.15 + fi * 0.07);

        // Ring intensity
        float ringWidth = 0.015 + u_bass * 0.02;
        float ring = smoothstep(ringRadius + ringWidth, ringRadius, dist);
        ring *= smoothstep(ringRadius - ringWidth, ringRadius, dist);

        // Wave modulation
        float wave = sin(angle * (4.0 + fi * 0.3) + t + fi) * 0.5 + 0.5;

        // Pulse with bass
        float pulse = sin(t * 2.0 + fi * 0.5) * u_bass * 0.5 + 0.5;

        // Color
        vec3 ringCol = mix(neon, neon2, wave);
        color += ringCol * ring * (0.5 - fi * 0.03) * (0.4 + pulse * 0.6);
    }

    // Bass glow at center
    float centerGlow = 0.02 / (dist + 0.05);
    color += neon * centerGlow * (0.3 + u_bass * 0.4);

    // Mid adds subtle noise
    float noise = hash(uv * 100.0 + t) * u_mid * 0.1;
    color += neon2 * noise;

    // Treble sparkles
    float sparkle = hash(uv * 500.0 + t * 2.0);
    sparkle = step(0.98, sparkle) * u_treble;
    color += neon * sparkle * 0.5;

    // Energy brightness
    color *= 0.4 + u_energy * 0.6;

    // Vignette
    float vignette = 1.0 - dist * 0.5;
    color *= vignette;

    // Lyrics overlay
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        color = mix(color, color + glow * 0.3, edge_glow * pulse * 0.4);
    }

    f_color = vec4(color, 1.0);
}
