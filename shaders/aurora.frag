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

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
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

    float t = u_time * 0.2;

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    // Aurora waves
    vec2 p = uv;
    p.x *= 2.0;

    // Multiple aurora bands
    float aurora = 0.0;

    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float offset = fi * 0.3;
        float speed = 0.2 + fi * 0.1;

        float wave = sin(p.x * (3.0 + fi) + t * speed + fbm(p * 2.0 + fi) * 2.0);
        wave *= exp(-abs(p.y - 0.5 - wave * 0.2) * 3.0);

        // Vertical fade
        wave *= smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.7, uv.y);

        aurora += wave * (1.0 - fi * 0.2);
    }

    aurora *= 0.5;

    // Bass makes aurora brighter and more active
    aurora *= 1.0 + u_bass * 1.5;

    // Color the aurora
    vec3 col = neon * aurora;
    col += neon2 * fbm(uv * 5.0 + t) * 0.3;

    // Add glow at bottom
    float ground = smoothstep(0.4, 0.0, uv.y);
    col += neon2 * ground * 0.2;

    // Mid adds subtle detail
    col += neon * fbm(uv * 10.0 - t * 0.5) * u_mid * 0.3;

    // Treble sparkles
    float sparkle = noise(uv * 100.0 + t * 2.0);
    sparkle = pow(sparkle, 3.0);
    col += neon * sparkle * u_treble * 0.3;

    // Energy brightness
    col *= 0.5 + u_energy * 0.5;

    // Dark vignette
    col *= exp(-1.5 * dist);

    // Lyrics overlay - subtle glow
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        col = mix(col, col + glow * 0.3, edge_glow * pulse * 0.4);
    }

    f_color = vec4(col, 1.0);
}
