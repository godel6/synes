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

// Noise
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
    if (idx < 0.5) return vec3(0.0, 1.0, 0.8);      // Cyan
    else if (idx < 1.5) return vec3(1.0, 0.0, 0.5);  // Hot pink
    else if (idx < 2.5) return vec3(0.3, 0.8, 1.0);   // Electric blue
    else return vec3(1.0, 0.2, 0.8);                    // Purple
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);

    // Bass: wave intensity and ring count
    float speed = u_time * (1.0 + u_bass * 2.0);
    int rings = 5 + int(u_bass * 5.0);

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    vec3 color = vec3(0.0);

    // Multiple expanding rings
    for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float ringDist = fract(dist * 8.0 - speed * (0.1 + fi * 0.02) - fi * 0.1);
        ringDist = smoothstep(0.0, 0.1, ringDist) * smoothstep(0.3, 0.1, ringDist);

        // Vary ring by angle and time
        float wave = sin(angle * (3.0 + fi) + speed + fi * 1.5) * 0.5 + 0.5;
        wave = pow(wave, 2.0);

        // Bass makes rings pulse
        float pulse = sin(u_time * 2.0 + fi) * u_bass * 0.5 + 0.5;

        vec3 ringColor = mix(neon, neon2, wave);
        color += ringColor * ringDist * (0.4 - fi * 0.04) * (0.5 + pulse * 0.5);
    }

    // Mid: adds noise distortion
    float noiseVal = noise(center * 10.0 + speed * 0.5) * u_mid * 0.3;
    color += neon * noiseVal;

    // Treble: outer glow sparkles
    float sparkle = noise(center * 30.0 + u_time * 3.0);
    sparkle = pow(sparkle, 4.0);
    color += neon2 * sparkle * u_treble * 0.5;

    // Energy: brightness
    color *= 0.5 + u_energy * 0.7;

    // Center glow
    float centerGlow = 0.02 / (dist + 0.1);
    color += neon * centerGlow * 0.3;

    // Vignette
    float vignette = 1.0 - dist * 0.6;
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
