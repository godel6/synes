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

vec3 getPaletteColor(float idx) {
    if (idx < 0.5) return vec3(0.0, 1.0, 0.8);      // Cyan
    else if (idx < 1.5) return vec3(1.0, 0.0, 0.5);  // Hot pink
    else if (idx < 2.5) return vec3(0.0, 0.5, 1.0);   // Electric blue
    else return vec3(1.0, 0.2, 0.8);                    // Purple
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Bass: grid speed and pulse
    float speed = u_time * (0.5 + u_bass * 1.5);
    float gridSize = 15.0 + u_bass * 10.0;

    // Create neon grid
    vec2 grid = fract(uv * gridSize);
    vec2 gridId = floor(uv * gridSize);

    // Grid lines
    float lineX = smoothstep(0.0, 0.05, grid.x) * smoothstep(1.0, 0.95, grid.x);
    float lineY = smoothstep(0.0, 0.05, grid.y) * smoothstep(1.0, 0.95, grid.y);
    float gridLine = 1.0 - (lineX * lineY);

    // Random glow per cell
    float cellHash = hash(gridId);
    float cellPulse = sin(speed * 2.0 + cellHash * 6.28) * 0.5 + 0.5;
    cellPulse = pow(cellPulse, 2.0);

    // Bass makes cells flash
    cellPulse = mix(cellPulse, 1.0, u_bass * 0.7);

    // Mid: color variation
    vec3 neonColor = getPaletteColor(u_palette + u_mid);

    // Add color variation per cell
    vec3 cellColor = neonColor * (0.5 + cellHash * 0.5);

    // Combine grid
    vec3 color = cellColor * gridLine * cellPulse * 0.8;

    // Add scanline effect (treble)
    float scanline = sin(uv.y * 200.0 + speed * 5.0) * 0.5 + 0.5;
    scanline = pow(scanline, 4.0) * u_treble * 0.2;
    color += neonColor * scanline;

    // Energy: brightness boost
    float brightness = 0.3 + u_energy * 0.7;
    color *= brightness;

    // Add glow at intersections
    float intersectGlow = (1.0 - lineX) * (1.0 - lineY);
    color += neonColor * intersectGlow * cellPulse * 0.5;

    // Vignette (subtle on black)
    float vignette = 1.0 - dist * 0.3;
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
