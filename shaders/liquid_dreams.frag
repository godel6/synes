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

vec3 getPaletteColor(float idx) {
    if (idx < 0.5) return vec3(0.2, 0.4, 0.8);
    else if (idx < 1.5) return vec3(0.9, 0.4, 0.2);
    else if (idx < 2.5) return vec3(0.2, 0.7, 0.8);
    else return vec3(0.9, 0.2, 0.6);
}

vec3 getPaletteColor2(float idx) {
    if (idx < 0.5) return vec3(0.4, 0.2, 0.6);
    else if (idx < 1.5) return vec3(1.0, 0.7, 0.3);
    else if (idx < 2.5) return vec3(0.3, 0.9, 0.7);
    else return vec3(0.3, 1.0, 0.5);
}

// Simplex noise function
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                           dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// FBM for organic patterns
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 5; i++) {
        value += amplitude * snoise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Bass: flow speed and distortion amplitude
    float speed = u_time * (0.3 + u_bass * 0.7);
    float distortion = 0.3 + u_bass * 0.7;

    // Create flowing organic pattern
    vec2 p = uv * 3.0;
    p += vec2(snoise(p + speed), snoise(p - speed)) * distortion;
    float pattern = fbm(p);

    // Mid: color palette shift (calm blue/purple -> intense orange/pink)
    vec3 calmColor = vec3(0.1, 0.2, 0.5);   // Deep blue
    vec3 midColor = vec3(0.4, 0.1, 0.5);    // Purple
    vec3 intenseColor = vec3(1.0, 0.4, 0.2); // Orange-pink

    float mixFactor = u_mid;
    vec3 color = mix(calmColor, midColor, smoothstep(0.0, 0.5, mixFactor));
    color = mix(color, intenseColor, smoothstep(0.5, 1.0, mixFactor));

    // Apply pattern
    color *= 0.7 + pattern * 0.5;

    // Treble: surface shimmer
    float shimmer = snoise(uv * 50.0 + u_time * 2.0);
    color += vec3(shimmer * u_treble * 0.15);

    // Energy: glow and vignette
    float glow = 0.8 + u_energy * 0.5;
    color *= glow;

    // Subtle lyrics glow overlay
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        color = mix(color, color + glow * 0.3, edge_glow * pulse * 0.4);
    }

    // Vignette
    float vignette = 1.0 - dist * 0.6;
    color *= vignette;

    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 4.0) * 0.5 + 0.5;
        vec3 warm = vec3(1.0, 0.5, 0.1);
        color = mix(color, warm, 0.8);
        color += warm * pulse * 0.5;
    }
    f_color = vec4(color, 1.0);
}
