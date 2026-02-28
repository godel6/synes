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

// Simplex noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

vec3 getPaletteColor(float idx) {
    if (idx < 0.5) return vec3(0.1, 0.9, 0.6);      // Aurora green
    else if (idx < 1.5) return vec3(1.0, 0.6, 0.2); // Warm sunset
    else if (idx < 2.5) return vec3(0.2, 0.7, 1.0); // Cool ocean
    else return vec3(0.9, 0.3, 0.8);                  // Neon purple
}

vec3 getPaletteColor2(float idx) {
    if (idx < 0.5) return vec3(0.2, 0.6, 0.9);
    else if (idx < 1.5) return vec3(1.0, 0.3, 0.4);
    else if (idx < 2.5) return vec3(0.4, 0.9, 0.7);
    else return vec3(0.3, 1.0, 0.6);
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Bass: wave amplitude
    float amplitude = 0.05 + u_bass * 0.15;
    float speed = u_time * (0.3 + u_bass * 0.5);

    // Create flowing aurora curtains
    float aurora = 0.0;

    // Multiple noise layers for curtain effect
    for(int i = 0; i < 4; i++) {
        float fi = float(i);
        vec2 p = uv * (2.0 + fi * 0.5);
        p.y += snoise(p + speed * (0.2 + fi * 0.1)) * amplitude * 3.0;
        p.x += sin(uv.y * 5.0 + speed + fi) * 0.1;

        float n = snoise(p + vec2(speed * 0.5, 0.0));
        n = smoothstep(0.2 - fi * 0.05, 0.8, n);

        aurora += n * (0.4 - fi * 0.08);
    }

    // Vertical fade
    float vertFade = smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.6, uv.y);
    aurora *= vertFade;

    // Mid: color shifting
    float colShift = u_mid * 0.5;
    vec3 col1 = getPaletteColor(u_palette);
    vec3 col2 = getPaletteColor2(u_palette);

    vec3 color = mix(col1, col2, aurora + colShift);

    // Add glow
    color *= aurora * 1.5;

    // Treble: sparkles
    float sparkle = snoise(uv * 30.0 + u_time * 2.0);
    sparkle = pow(max(sparkle, 0.0), 8.0);
    color += vec3(sparkle * u_treble * 0.3);

    // Energy: brightness
    float brightness = 0.5 + u_energy * 0.7;
    color *= brightness;

    // Vignette
    float vignette = 1.0 - dist * 0.4;
    color *= vignette;

    // Subtle lyrics glow overlay
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        color = mix(color, color + glow * 0.3, edge_glow * pulse * 0.4);
    }

    f_color = vec4(color, 1.0);
}
