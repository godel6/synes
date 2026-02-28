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

// Hash and noise
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

// Mirror fold for kaleidoscopic effect
vec3 fold(vec3 p) {
    vec3 nc = vec3(-0.5, -0.809017, 0.309017);
    for (int i = 0; i < 5; i++) {
        p.xy = abs(p.xy);
        p -= 2.0 * min(0.0, dot(p, nc)) * nc;
    }
    return p - vec3(0.0, 0.0, 1.275);
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

    float t = u_time * (0.5 + u_bass * 1.5);

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    vec3 color = vec3(0.0);

    // Raymarching setup
    vec3 ro = vec3(0.0, 0.0, 0.0);
    vec3 rd = normalize(vec3((uv - 0.5) * 2.0, 1.0));

    // Rotate ray direction
    float angle = t * 0.1;
    rd.xy = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * rd.xy;

    float d = 0.0;
    vec3 p;

    // Raymarch
    for (int i = 0; i < 60; i++) {
        p = ro + rd * d;
        p.xy *= cos(p.z * 0.1) * 0.5;
        p.z += t;
        p = fold(p);

        // Cylinder SDF
        vec2 cp = p.xz;
        cp.x = abs(cp.x);
        float cylinderDist = length(cp - vec2(0.75, 0.0)) - 0.5;

        float s = abs(cylinderDist);

        // Color accumulation
        float fade = smoothstep(0.05, 0.0, s);
        vec3 col = abs(sin(vec3((-p.z * 0.1 - t * 0.4)) * cos(d * 0.01) * 0.5 * sin(vec3(p.xy, 0.0) * (sin(p.z * 0.5) * 0.10) + vec3(0.01, 5.0, 0.0)) * 0.2));
        color += col * fade * (1.0 - float(i) / 60.0);

        d += s * 0.5;
        if (s < 0.001 || d > 10.0) break;
    }

    // Post processing
    color = (vec3(0.0) - color) * exp(-d * 0.5);
    color = pow(color, vec3(0.5));
    color *= 1.0 + u_energy * 0.5;

    // Bass pulse
    color *= 1.0 + u_bass * 0.3;

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
