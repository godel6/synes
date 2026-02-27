#version 330

in vec2 v_uv;
out vec4 f_color;

uniform float u_time;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_lyrics;

// Complex number multiplication
vec2 cMul(vec2 a, vec2 b) {
    return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;

    // Adjust for aspect ratio
    float aspect = 1.0;
    vec2 c = center * vec2(aspect, 1.0) * 3.0;

    // Bass: zoom pulse AND brightness boost
    float zoom = 1.0 + u_bass * 0.5 * sin(u_time * 3.0);
    c *= zoom;

    // Mid: Julia constant morphing (more dramatic)
    float juliaReal = -0.4 + u_mid * 0.8;
    float juliaImag = 0.6 + u_mid * 0.4;
    vec2 juliaC = vec2(juliaReal, juliaImag);

    // Energy: iteration depth (more iterations = more detail)
    int maxIter = 30 + int(u_energy * 50.0);

    // Fractal iteration (Julia set)
    vec2 z = c;
    float iter = 0.0;
    for(int i = 0; i < 80; i++) {
        if(i >= maxIter) break;
        if(dot(z, z) > 4.0) break;
        z = cMul(z, z) + juliaC;
        iter += 1.0;
    }

    // Smooth coloring
    float smoothIter = iter - log2(log2(dot(z, z) + 1.0)) + 4.0;
    float t = smoothIter / float(maxIter);

    // BRIGHT color palette - much more vibrant
    vec3 col1 = vec3(0.1, 0.0, 0.3);   // Deep purple
    vec3 col2 = vec3(0.0, 0.8, 1.0);   // Bright cyan
    vec3 col3 = vec3(1.0, 0.2, 0.5);   // Hot pink
    vec3 col4 = vec3(1.0, 0.9, 0.0);   // Bright gold
    vec3 col5 = vec3(1.0, 1.0, 1.0);   // White core

    // More vibrant color mixing
    vec3 color;
    if(t < 0.2) {
        color = mix(col1, col2, t * 5.0);
    } else if(t < 0.4) {
        color = mix(col2, col3, (t - 0.2) * 5.0);
    } else if(t < 0.6) {
        color = mix(col3, col4, (t - 0.4) * 5.0);
    } else if(t < 0.8) {
        color = mix(col4, col5, (t - 0.6) * 5.0);
    } else {
        color = mix(col5, col1, (t - 0.8) * 5.0);
    }

    // Bass: add extra glow
    color += vec3(0.2, 0.0, 0.3) * u_bass;

    // Treble: add sparkly noise
    float noise = fract(sin(dot(uv * 200.0 + u_time, vec2(12.9898, 78.233))) * 43758.5453);
    color += vec3(noise * u_treble * 0.3);

    // Energy: big brightness boost
    float brightness = 0.5 + u_energy * 1.0;
    color *= brightness;

    // Extra glow on bass hits
    float bassGlow = u_bass * 0.5;
    color += vec3(bassGlow, bassGlow * 0.5, bassGlow * 0.8);

    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 4.0) * 0.5 + 0.5;
        vec3 warm = vec3(1.0, 0.5, 0.1);
        color = mix(color, warm, 0.8);
        color += warm * pulse * 0.5;
    }
    f_color = vec4(color, 1.0);
}
