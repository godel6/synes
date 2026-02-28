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

// Simple noise
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
    float v = 0.0;
    float a = 0.5;
    for(int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

vec3 getPaletteColor(float idx) {
    if (idx < 0.5) return vec3(0.1, 0.4, 0.7);      // Ocean blue
    else if (idx < 1.5) return vec3(0.9, 0.5, 0.2); // Warm sand
    else if (idx < 2.5) return vec3(0.2, 0.8, 0.9); // Cyan
    else return vec3(0.6, 0.2, 0.8);                  // Violet
}

vec3 getPaletteColor2(float idx) {
    if (idx < 0.5) return vec3(0.2, 0.7, 0.9);
    else if (idx < 1.5) return vec3(1.0, 0.8, 0.4);
    else if (idx < 2.5) return vec3(0.4, 0.9, 0.8);
    else return vec3(0.8, 0.4, 1.0);
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Bass: wave height
    float waveHeight = 0.1 + u_bass * 0.2;
    float speed = u_time * (0.5 + u_bass * 0.5);

    // Multiple wave layers
    float wave1 = sin(uv.x * 8.0 + speed) * waveHeight;
    float wave2 = sin(uv.x * 12.0 - speed * 0.7) * waveHeight * 0.6;
    float wave3 = sin(uv.x * 20.0 + speed * 1.3) * waveHeight * 0.3;

    // Add noise for organic feel
    float noiseVal = fbm(uv * 5.0 + speed * 0.3) * waveHeight;

    float waves = wave1 + wave2 + wave3 + noiseVal;
    waves = waves * 0.5 + 0.5;

    // Depth layers
    float depth = 1.0 - uv.y;

    // Calculate wave intersection
    float waveLine = smoothstep(waves - 0.05, waves + 0.05, uv.y);
    float waveHighlight = smoothstep(waves - 0.02, waves + 0.02, uv.y) - waveLine;

    // Mid: color shifting
    float colShift = u_mid * 0.3;
    vec3 deepColor = getPaletteColor(u_palette);
    vec3 surfaceColor = getPaletteColor2(u_palette);

    vec3 color = mix(deepColor, surfaceColor, waveLine + colShift);
    color += surfaceColor * waveHighlight * 0.5;

    // Foam on peaks
    float foam = smoothstep(0.6, 0.8, waveLine + u_bass * 0.3);
    color = mix(color, vec3(1.0), foam * 0.3);

    // Treble: sparkles on water
    float sparkle = noise(uv * 50.0 + u_time * 2.0);
    sparkle = pow(sparkle, 4.0);
    color += vec3(sparkle * u_treble * 0.2);

    // Energy: brightness
    float brightness = 0.7 + u_energy * 0.5;
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
