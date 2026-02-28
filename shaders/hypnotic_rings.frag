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
    if (idx < 0.5) return vec3(0.3, 0.2, 0.7);
    else if (idx < 1.5) return vec3(0.9, 0.3, 0.1);
    else if (idx < 2.5) return vec3(0.2, 0.6, 0.9);
    else return vec3(1.0, 0.2, 0.5);
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
    float angle = atan(center.y, center.x);

    // Bass: ring expansion speed and pulse width
    float ringSpeed = 2.0 + u_bass * 4.0;
    float pulseWidth = 0.1 - u_bass * 0.05;

    // Mid: ring spacing variation
    float spacing = 0.1 + u_mid * 0.15;

    // Multiple ring layers
    float rings = 0.0;
    for(int i = 0; i < 8; i++) {
        float phase = float(i) * spacing * 6.28;
        float r = mod(dist * 10.0 - u_time * ringSpeed + phase, 1.0);
        float ring = smoothstep(pulseWidth, 0.0, abs(r - 0.5));
        ring *= 1.0 - float(i) * 0.1; // Fade outer rings
        rings += ring;
    }

    // Color based on angle and mid
    float hue = angle / 6.28 + 0.5 + u_time * 0.05 + u_mid * 0.3;
    vec3 ringColor = hsv2rgb(vec3(hue, 0.9, 1.0));

    vec3 color = ringColor * rings;

    // Treble: edge sharpness and sparkle
    float edge = smoothstep(0.0, pulseWidth * 2.0, abs(mod(dist * 10.0 - u_time * ringSpeed, 1.0) - 0.5));
    float sparkle = sin(angle * 50.0 + u_time * 10.0) * 0.5 + 0.5;
    sparkle *= sin(dist * 100.0 - u_time * 15.0) * 0.5 + 0.5;
    color += ringColor * sparkle * u_treble * 0.3;

    // Energy: pulse intensity
    float pulse = sin(u_time * 2.0) * 0.5 + 0.5;
    float intensity = 0.5 + u_energy * 0.8 + pulse * u_energy * 0.3;
    color *= intensity;

    // Center glow
    float centerGlow = 1.0 - smoothstep(0.0, 0.2, dist);
    color += ringColor * centerGlow * u_energy * 0.5;

    // Outer fade
    float outerFade = 1.0 - smoothstep(0.3, 0.7, dist);
    color *= outerFade;

    // Chromatic pulse on bass
    float chromaPulse = u_bass * 0.1;
    color.r += chromaPulse * rings;
    color.b -= chromaPulse * rings;

    // Subtle breathing effect
    float breathe = sin(u_time * 0.5) * 0.1 + 0.9;
    color *= breathe;

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
