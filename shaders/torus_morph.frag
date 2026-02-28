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

#define PI 3.1415926
#define eps 0.005

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

vec3 tri(vec3 x) { return abs(x - floor(x) - 0.5); }

float distort(vec3 p) {
    float t = u_time * 0.25;
    return dot(tri(p + t) + sin(tri(p + t)), vec3(0.666));
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float map(vec3 p) {
    float d = distort(p);
    return -sdTorus(p + vec3(0.0, 0.0, 0.2), vec2(1.0, 0.7)) + d * 0.05;
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(eps, 0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

float trace(vec3 r, vec3 d) {
    float m, t = 0.0;
    for (int i = 0; i < 80; i++) {
        m = map(r + d * t);
        t += m;
        if (m < eps || t > 40.0) break;
    }
    return t;
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

    float t = u_time * 0.25;
    float audio = u_mid * 0.5 + u_bass * 0.5;

    vec2 screenUV = (uv * 2.0 - 1.0);
    screenUV.x *= 1.7;

    vec3 r = vec3(0.0, 0.0, 1.0);
    vec3 d = normalize(vec3(screenUV, -1.0));

    float depth = trace(r, d);
    vec3 p = r + d * depth;
    vec3 n = calcNormal(p);

    vec3 color = vec3(0.0);

    if (depth < 40.0) {
        vec3 objcol = vec3(audio, audio * audio, 1.0 - audio);
        vec3 lp = vec3(1.0, 3.0, 3.0);
        vec3 ld = normalize(lp - p);
        float len = length(ld);
        float atten = max(0.0, 1.0 / (len * len));
        ld /= len;

        float amb = 0.25;
        float diff = max(0.0, dot(ld, n));
        float spec = pow(max(0.0, dot(reflect(-ld, n), d)), 8.0);

        color = objcol * (((diff * 0.8 + amb * 0.8) + 0.1 * spec) + atten * 0.1);
    }

    // Bass pulse glow
    color *= 1.0 + u_bass * 0.5;

    // Energy brightness
    color *= 0.5 + u_energy * 0.7;

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
