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
uniform float u_hand_x;
uniform float u_hand_y;
uniform float u_hand_present;

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

    // Hand tracking - smooth glow effect
    vec2 hand_pos = vec2(u_hand_x, 1.0 - u_hand_y);
    float dist_to_hand = length(uv - hand_pos);
    float hand_glow = smoothstep(0.4, 0.0, dist_to_hand) * u_hand_present * 0.5;

    float t = u_time;
    float speed = 0.2 + u_bass * 0.5;

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    vec3 color = vec3(0.0);

    // Star field
    for (int i = 0; i < 30; i++) {
        float fi = float(i);
        vec2 starPos = vec2(hash(vec2(fi * 1.23, fi * 0.456)), hash(vec2(fi * 2.789, fi * 1.345)));

        // Move stars
        starPos.y = fract(starPos.y + t * speed * (0.1 + hash(vec2(fi)) * 0.2));

        float d = length(uv - starPos);

        // Star brightness with twinkle
        float twinkle = sin(t * 3.0 + fi * 2.0) * 0.5 + 0.5;
        float brightness = hash(vec2(fi * 7.89, fi * 3.21)) * 0.7 + 0.3;
        brightness *= (0.5 + twinkle * 0.5);

        // Bass makes stars brighter
        brightness *= 1.0 + u_bass * 0.8;

        float star = brightness * 0.01 / (d * d + 0.001);
        star = pow(star, 1.5);

        vec3 starColor = mix(neon, neon2, hash(vec2(fi * 0.123, fi)));
        color += starColor * star * 0.15;
    }

    // Nebula/clouds background
    vec2 nebulaUV = uv * 3.0 + vec2(t * 0.05);
    float nebula = fbm(nebulaUV);
    nebula = pow(nebula, 2.0);
    color += neon * nebula * 0.15;

    // Mid adds more nebula detail
    color += neon2 * fbm(uv * 5.0 - t * 0.1) * u_mid * 0.2;

    // Treble sparkles
    float sparkle = noise(uv * 50.0 + t * 2.0);
    sparkle = pow(sparkle, 5.0);
    color += neon * sparkle * u_treble * 0.3;

    // Energy brightness
    color *= 0.5 + u_energy * 0.6;

    // Center glow
    float centerGlow = 0.02 / (dist + 0.1);
    color += neon2 * centerGlow * 0.3;

    // Hand glow - soft light around hand
    color += neon * hand_glow * 1.5;

    // Vignette
    float vignette = 1.0 - dist * 0.4;
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
