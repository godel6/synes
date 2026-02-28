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

// Get palette hue shift
float getPaletteHue(float idx) {
    if (idx < 0.5) return 0.7;       // Default purple
    else if (idx < 1.5) return 0.08;  // Warm orange
    else if (idx < 2.5) return 0.55;  // Cool blue
    else return 0.85;                  // Neon pink
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

    // Bass: wave amplitude and bass hit spikes
    float amplitude = 0.1 + u_bass * 0.2;
    float bassPulse = u_bass * 0.15;

    // Multiple wave layers
    float wave1 = sin(uv.x * 10.0 + u_time * (1.0 + u_bass)) * amplitude;
    float wave2 = sin(uv.x * 20.0 - u_time * 1.5) * amplitude * 0.5;
    float wave3 = sin(uv.x * 5.0 + u_time * 0.7) * amplitude * 0.3;

    // Combine waves
    float wave = wave1 + wave2 + wave3;

    // Distance from wave
    float d = abs(uv.y - 0.5 - wave);

    // Sharp neon lines
    float line = smoothstep(0.02 + bassPulse, 0.0, d);

    // Bass hits create vertical glow
    float bassGlow = smoothstep(0.4, 0.0, d) * u_bass * 0.5;

    // Mid: hue shift through spectrum
    float hue = getPaletteHue(u_palette) + uv.x * 0.3 + u_time * 0.1 + u_mid * 0.5;
    vec3 neonColor = hsv2rgb(vec3(hue, 1.0, 1.0));

    // Treble: scanlines and sparkle
    float scanline = sin(uv.y * 100.0) * 0.5 + 0.5;
    scanline = pow(scanline, 8.0) * u_treble * 0.3;

    // Sparkle particles
    float sparkle = 0.0;
    for(int i = 0; i < 3; i++) {
        vec2 sp = vec2(
            fract(sin(float(i) * 12.9898 + u_time) * 43758.5453),
            fract(cos(float(i) * 78.233 + u_time) * 43758.5453)
        );
        float dist = length(uv - sp);
        sparkle += smoothstep(0.02, 0.0, dist) * u_treble;
    }

    // Combine color
    vec3 color = neonColor * (line + bassGlow);
    color += neonColor * scanline;
    color += vec3(sparkle);

    // Energy: saturation boost and bloom
    float satBoost = 1.0 + u_energy * 0.5;
    color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, satBoost);

    // Bloom effect
    color += neonColor * (line + bassGlow) * u_energy * 0.5;

    // Bottom glow (horizon line)
    float horizon = smoothstep(0.3, 0.0, uv.y);
    color += neonColor * horizon * 0.3;

    vec2 center = uv - 0.5;
    float dist = length(center);

    // Subtle lyrics glow overlay
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        color = mix(color, color + glow * 0.3, edge_glow * pulse * 0.4);
    }
    f_color = vec4(color, 1.0);
}
