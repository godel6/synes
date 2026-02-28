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

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
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

    float t = u_time * (0.3 + u_bass * 0.8);

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    vec3 color = vec3(0.0);

    // Kaleidoscopic folding
    vec2 p = uv * 2.0 - 1.0;
    p.x *= 1.7;

    for (int i = 0; i < 8; i++) {
        float fi = float(i);

        // Fold space
        p = abs(p);
        float angle = fi * 0.785; // 45 degrees
        float s = sin(angle), c = cos(angle);
        p = mat2(c, s, -s, c) * p;

        // Rotate with time
        p += vec2(sin(t + fi), cos(t * 0.7 + fi)) * 0.3;

        // Distance pattern
        float d = length(p);
        float pattern = sin(d * (10.0 - fi) - t * 2.0);
        pattern = pow(abs(pattern), 2.0);

        // Color accumulation
        vec3 layerColor = mix(neon, neon2, fi / 8.0 + sin(t + fi) * 0.2);
        color += layerColor * pattern * (0.15 - fi * 0.015);
    }

    // Bass pulse
    color *= 1.0 + u_bass * 0.5;

    // Mid adds glow
    float glow = 1.0 / (dist * 3.0 + 0.5);
    color += neon * glow * u_mid * 0.3;

    // Treble sparkles
    float sparkle = noise(uv * 80.0 + t * 2.0);
    sparkle = pow(sparkle, 4.0);
    color += neon2 * sparkle * u_treble * 0.4;

    // Energy brightness
    color *= 0.3 + u_energy * 0.7;

    // Vignette (keep dark edges)
    float vignette = 1.0 - pow(dist, 1.5) * 0.6;
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
