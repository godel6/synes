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

mat2 rot(float a) {
    a = a * 3.14159 / 180.0;
    float s = sin(a), c = cos(a);
    return mat2(c, s, -s, c);
}

vec3 fractal(vec2 p, float audio) {
    float t = u_time * 0.4;
    p *= rot(45.0);

    vec2 p2 = p;
    p *= 0.6 + sin(t * 0.15) * 0.2;
    p.x += t * 0.2 + audio * 0.08;
    p = fract(p * 0.4);

    float m = 1000.0;
    float it = 0.0;

    for (int i = 0; i < 8; i++) {
        p = abs(p) / clamp(abs(p.x * p.y), 0.25, 2.0) - 1.0;
        float l = abs(p.x);
        m = min(m, l);
        if (m == l) {
            it = float(i);
        }
    }

    float f = smoothstep(0.02, 0.005, m * 0.5);

    vec3 col = vec3(1.0, 0.0, 0.5);
    col.rg *= rot(length(p2 + it * 0.3) * 150.0).x;
    col = normalize(col + 0.5) + step(0.5, fract(p2.y * 80.0));

    return col * (f * 0.85 + 0.15) * (1.0 + audio * 4.0);
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

    float audio = u_bass * 0.5 + u_mid * 0.3;

    uv *= 1.0 + audio * 0.4;

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    float f = max(abs(uv.x), abs(uv.y));
    vec3 color = fractal(uv, audio);

    // Add more color variation
    color += neon * abs(sin(uv.x * 10.0 + u_time)) * 0.2;
    color += neon2 * abs(cos(uv.y * 8.0 - u_time * 0.7)) * 0.2;

    // Treble adds detail
    color += (neon + neon2) * u_treble * 0.15;

    // Energy brightness
    color *= 0.25 + u_energy * 0.75;

    // Bass pulse
    color *= 1.0 + u_bass * 0.4;

    // Keep edges darker
    color *= exp(-0.8 * f);

    // Vignette (dark edges)
    float vignette = 1.0 - pow(dist, 1.5) * 0.5;
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
