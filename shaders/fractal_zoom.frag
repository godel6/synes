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

#define iters 30

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

int fractal(vec2 p, vec2 point) {
    vec2 so = (-1.0 + 2.0 * point) * 0.4;
    vec2 seed = vec2(0.098386255 + so.x, 0.6387662 + so.y);

    for (int i = 0; i < iters; i++) {
        if (length(p) > 2.0) return i;
        vec2 r = p;
        p = vec2(p.x * p.x - p.y * p.y, 2.0 * p.x * p.y);
        p = vec2(p.x * r.x - p.y * r.y + seed.x, r.x * p.y + p.x * r.y + seed.y);
    }
    return 0;
}

vec3 colorFromIter(int i, float pulse) {
    float f = float(i) / float(iters) * 2.0;
    f = f * f * 2.0;
    vec3 col = vec3(sin(f * 2.0), sin(f * 3.0), abs(sin(f * 7.0)));
    return col * pulse;
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
    float pulse = 0.5 + u_bass * 1.8 + u_mid * 0.5;

    vec2 position = 3.0 * (-0.5 + uv);
    position.x *= 1.7;

    // Multiple fractal layers
    vec3 c = colorFromIter(fractal(position, vec2(0.5 + sin(t / 3.0) / 2.0, pulse)), pulse);
    vec3 c2 = colorFromIter(fractal(position / 1.6, vec2(0.6 + cos(t / 2.0 + 0.5) / 2.0, pulse * 0.8)), pulse);
    vec3 c3 = colorFromIter(fractal(-position, vec2(0.55 + sin(t / 3.0 + 0.5) / 2.0, pulse * 0.9)), pulse);

    vec3 color = c + c2 * 0.3 + c3 * 0.2;

    // Bass boost
    color *= 1.0 + u_bass * 0.5;

    // Treble shimmer
    color += getNeonColor(u_palette) * u_treble * 0.2;

    // Energy brightness
    color *= 0.5 + u_energy * 0.5;

    // Hand glow - soft light around hand
    color += getNeonColor(u_palette) * hand_glow * 1.5;

    // Vignette
    float vignette = 1.0 - dist * 0.5;
    color *= vignette;

    // Lyrics overlay
    if (u_lyrics > 0.5) {
        float pulseL = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        color = mix(color, color + glow * 0.3, edge_glow * pulseL * 0.4);
    }

    f_color = vec4(color, 1.0);
}
