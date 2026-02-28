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

// Get palette color based on index
vec3 getPaletteColor(float idx) {
    if (idx < 0.5) {
        // Default: purple/cyan/pink
        return vec3(0.5, 0.2, 0.8);
    } else if (idx < 1.5) {
        // Warm: sunset oranges/reds/yellows
        return vec3(0.9, 0.4, 0.1);
    } else if (idx < 2.5) {
        // Cool: ocean blues/teals
        return vec3(0.1, 0.6, 0.9);
    } else {
        // Neon: vibrant pinks/greens
        return vec3(1.0, 0.2, 0.6);
    }
}

// Get secondary palette color
vec3 getPaletteColor2(float idx) {
    if (idx < 0.5) {
        return vec3(0.1, 0.8, 0.9);
    } else if (idx < 1.5) {
        return vec3(1.0, 0.7, 0.2);
    } else if (idx < 2.5) {
        return vec3(0.2, 0.9, 0.7);
    } else {
        return vec3(0.2, 1.0, 0.5);
    }
}

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

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Bass: turbulence intensity and sudden bursts
    float turbulence = 2.0 + u_bass * 4.0;
    float speed = u_time * (0.5 + u_bass * 1.5);

    // Multi-layer plasma
    float v = 0.0;

    // Layer 1: large slow waves
    v += sin(uv.x * 4.0 + speed * 0.8);
    v += sin(uv.y * 4.0 + speed * 0.6);
    v += sin((uv.x + uv.y) * 3.0 + speed * 0.7);

    // Layer 2: turbulence
    vec2 noiseCoord = uv * turbulence;
    v += snoise(noiseCoord + speed) * 2.0;
    v += snoise(noiseCoord * 2.0 - speed * 0.5) * 1.0;

    // Layer 3: bass bursts
    float burst = snoise(uv * 3.0 + speed * 2.0);
    burst = pow(abs(burst), 2.0 - u_bass);
    v += burst * u_bass * 3.0;

    // Normalize
    v = v * 0.2 + 0.5;

    // Mid: dramatic color palette shifts
    float paletteShift = u_mid;

    // Use palette colors
    vec3 col1 = getPaletteColor(u_palette);
    vec3 col2 = getPaletteColor2(u_palette);
    vec3 col3 = getPaletteColor(u_palette) * 0.8;
    vec3 col4 = getPaletteColor2(u_palette) * 0.8;

    // Mix based on v and mid
    vec3 color;
    float t = v + paletteShift;
    if(t < 0.33) {
        color = mix(col1, col2, t * 3.0);
    } else if(t < 0.66) {
        color = mix(col2, col3, (t - 0.33) * 3.0);
    } else {
        color = mix(col3, col4, (t - 0.66) * 3.0);
    }

    // Treble: fine ripples
    float ripples = snoise(uv * 30.0 + u_time * 4.0);
    ripples = pow(abs(ripples), 8.0);
    color += vec3(ripples * u_treble * 0.3);

    // Energy: full brightness and bloom
    float brightness = 0.7 + u_energy * 0.6;
    color *= brightness;

    // Bloom effect
    color += color * u_energy * 0.3;

    // Radial shockwave on bass
    float shockwave = sin(dist * 15.0 - u_time * 5.0 * (1.0 + u_bass));
    shockwave = smoothstep(0.9, 1.0, shockwave);
    color += vec3(1.0, 0.5, 0.2) * shockwave * u_bass;

    // Vignette
    float vignette = 1.0 - dist * 0.5;
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
