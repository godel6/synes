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

    float t = u_time * (0.3 + u_bass * 0.5);

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    // Plasma effect - multiple wave layers
    float v = 0.0;
    vec2 p = uv * 5.0;

    v += sin(p.x + t);
    v += sin(p.y + t);
    v += sin(p.x + p.y + t);
    v += sin(sqrt(p.x * p.x + p.y * p.y) + t);
    v *= 0.5;

    // Add bass response
    v += sin(p.x * 2.0 + t * 2.0) * u_bass;
    v += sin(p.y * 2.0 + t * 1.5) * u_bass;

    // Color mapping
    vec3 col = vec3(
        sin(v * 3.14159 + 0.0) * 0.5 + 0.5,
        sin(v * 3.14159 + 2.094) * 0.5 + 0.5,
        sin(v * 3.14159 + 4.188) * 0.5 + 0.5
    );

    // Mix with neon colors
    col = mix(col, neon, 0.3);
    col += neon2 * sin(v * 2.0) * 0.2;

    // Mid adds detail
    col += noise(uv * 20.0 + t) * u_mid * 0.2;

    // Treble sparkles
    float sparkle = noise(uv * 50.0 + t * 3.0);
    sparkle = pow(sparkle, 4.0);
    col += neon * sparkle * u_treble * 0.4;

    // Energy brightness
    col *= 0.4 + u_energy * 0.6;

    // Vignette - dark edges
    col *= exp(-2.0 * dist);

    // Lyrics overlay - subtle glow
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        col = mix(col, col + glow * 0.3, edge_glow * pulse * 0.4);
    }

    f_color = vec4(col, 1.0);
}
