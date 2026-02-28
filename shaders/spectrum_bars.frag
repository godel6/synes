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

// Simple hash
float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

vec3 getNeonColor(float idx) {
    if (idx < 0.5) return vec3(0.0, 1.0, 0.8);      // Cyan neon
    else if (idx < 1.5) return vec3(1.0, 0.0, 0.5);  // Hot pink
    else if (idx < 2.5) return vec3(0.3, 0.5, 1.0);   // Electric blue
    else return vec3(1.0, 0.2, 0.8);                    // Purple neon
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Bass: bar height multiplier
    float barHeight = u_bass * 0.7 + 0.1;
    // Mid: bar width variation
    float barWidth = 12.0 + u_mid * 8.0;
    // Treble: shimmer on peaks
    float shimmer = u_treble * 0.3;

    // Calculate bar position
    float x = uv.x * barWidth;
    float barIndex = floor(x);
    float barX = fract(x);

    // Random height per bar
    float h = hash(barIndex * 127.1) * 0.6 + 0.4;
    h *= barHeight;

    // Smooth falloff
    float bar = smoothstep(h + 0.02, h, uv.y);
    bar *= smoothstep(0.0, 0.1, uv.y);

    // Bar shape
    float barShape = smoothstep(0.0, 0.15, barX) * smoothstep(1.0, 0.85, barX);
    bar *= barShape;

    // Color per bar with gradient
    vec3 neon = getNeonColor(u_palette);
    vec3 color2 = getNeonColor(u_palette + 1.0);
    vec3 barColor = mix(neon, color2, barIndex / barWidth);

    // Bass pulse glow
    float pulse = sin(u_time * 3.0 + barIndex * 0.5) * 0.5 + 0.5;
    barColor += barColor * pulse * u_bass * 0.5;

    // Energy glow at base
    float baseGlow = smoothstep(0.15, 0.0, uv.y) * u_energy;
    vec3 color = barColor * bar + neon * baseGlow * 0.5;

    // Treble sparkles at top
    float sparkle = hash(barIndex + u_time) * shimmer;
    if (uv.y > h - 0.02 && uv.y < h + 0.02) {
        color += neon * sparkle;
    }

    // Subtle reflection
    float reflection = smoothstep(0.15, 0.0, uv.y) * bar * 0.3;
    color += barColor * reflection;

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
