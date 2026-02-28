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
    float angle = atan(center.y, center.x);

    float t = u_time;
    float speed = 1.0 + u_bass * 2.0;

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    vec3 color = vec3(0.0);

    // Multiple ripple rings
    for (int i = 0; i < 12; i++) {
        float fi = float(i);

        // Ripple position
        float rippleSpeed = speed * (0.3 + fi * 0.05);
        float radius = fract(t * rippleSpeed * 0.1 + fi * 0.08);
        radius = radius * 0.8;

        // Ring intensity based on audio
        float ringWidth = 0.02 + u_bass * 0.03;
        float ring = smoothstep(radius + ringWidth, radius, dist);
        ring *= smoothstep(radius - ringWidth, radius, dist);

        // Pulse
        float pulse = sin(t * 2.0 + fi) * u_bass * 0.5 + 0.5;

        // Wave distortion
        float wave = sin(angle * (3.0 + fi * 0.5) + t + fi * 0.5) * 0.5 + 0.5;
        wave = pow(wave, 2.0);

        // Color variation
        vec3 ringColor = mix(neon, neon2, wave + fi * 0.08);

        color += ringColor * ring * (0.6 - fi * 0.04) * (0.5 + pulse * 0.5);
    }

    // Mid adds noise distortion
    float noiseVal = noise(center * 15.0 + t * speed * 0.2);
    color += neon * noiseVal * u_mid * 0.2;

    // Treble adds fine detail
    float detail = noise(center * 40.0 + t * 2.0);
    detail = pow(detail, 3.0);
    color += neon2 * detail * u_treble * 0.3;

    // Energy brightness
    color *= 0.4 + u_energy * 0.7;

    // Center glow
    float centerGlow = 0.015 / (dist + 0.05);
    color += neon * centerGlow * 0.4;

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
