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

    float t = u_time * 0.4;

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    vec3 col = vec3(0.0);

    // Multiple wave layers
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float y = uv.y * (3.0 + fi * 0.5);
        float speed = 0.5 + fi * 0.2;
        float amplitude = 0.03 + fi * 0.01;

        // Wave
        float wave = sin(y * 10.0 - t * speed + fi);
        wave *= sin(y * 5.0 + t * speed * 0.5 + fi * 0.5);

        // Horizontal line
        float line = smoothstep(0.02 + u_bass * 0.02, 0.0, abs(uv.x - 0.5 + wave * amplitude));

        // Vertical fade
        float vertFade = smoothstep(0.0, 0.2 + fi * 0.1, uv.y) * smoothstep(1.0, 0.8 - fi * 0.1, uv.y);

        // Color
        vec3 waveCol = mix(neon, neon2, fi / 6.0);
        col += waveCol * line * vertFade * (0.4 - fi * 0.05);
    }

    // Bass adds more waves and brightness
    col *= 1.0 + u_bass * 0.8;

    // Mid adds foam/detail
    float foam = noise(uv * 30.0 + t);
    foam = pow(foam, 2.0);
    col += neon2 * foam * u_mid * 0.15;

    // Treble sparkles
    float sparkle = noise(uv * 80.0 + t * 2.0);
    sparkle = pow(sparkle, 4.0);
    col += neon * sparkle * u_treble * 0.4;

    // Energy brightness
    col *= 0.5 + u_energy * 0.5;

    // Center glow
    col += neon * 0.02 / (dist + 0.2) * 0.3;

    // Vignette
    col *= exp(-1.0 * dist);

    // Lyrics overlay - subtle glow
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        col = mix(col, col + glow * 0.3, edge_glow * pulse * 0.4);
    }

    f_color = vec4(col, 1.0);
}
