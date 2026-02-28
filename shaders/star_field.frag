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

    float t = u_time;
    float speed = 0.15 + u_bass * 0.3;

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    vec3 color = vec3(0.0);

    // Star field
    for (int i = 0; i < 100; i++) {
        float fi = float(i);
        vec2 starPos = vec2(hash(vec2(fi * 1.23, fi * 0.456)), hash(vec2(fi * 2.789, fi * 1.345)));

        // Animate stars
        starPos.y = fract(starPos.y + t * speed * (0.1 + hash(vec2(fi)) * 0.15));

        float d = length(uv - starPos);

        // Star brightness
        float brightness = hash(vec2(fi * 7.89, fi * 3.21)) * 0.7 + 0.3;
        float twinkle = sin(t * 2.5 + fi * 3.0) * 0.5 + 0.5;
        brightness *= (0.4 + twinkle * 0.6);
        brightness *= 1.0 + u_bass * 0.6;

        float star = brightness * 0.008 / (d * d + 0.0008);
        star = pow(star, 1.3);

        vec3 starColor = mix(neon, neon2, hash(vec2(fi * 0.123, fi)));
        color += starColor * star * 0.12;
    }

    // Nebula background
    vec2 nebulaUV = uv * 2.5 + vec2(t * 0.03);
    float nebula = fbm(nebulaUV);
    nebula = pow(nebula, 2.5);
    color += neon * nebula * 0.12;

    // Mid adds detail
    color += neon2 * fbm(uv * 4.0 - t * 0.08) * u_mid * 0.15;

    // Treble sparkles
    float sparkle = noise(uv * 40.0 + t * 1.5);
    sparkle = pow(sparkle, 4.0);
    color += neon * sparkle * u_treble * 0.25;

    // Energy brightness
    color *= 0.25 + u_energy * 0.75;

    // Center glow
    float centerGlow = 0.015 / (dist + 0.08);
    color += neon2 * centerGlow * 0.25;

    // Vignette (dark edges)
    float vignette = 1.0 - pow(dist, 1.8) * 0.5;
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
