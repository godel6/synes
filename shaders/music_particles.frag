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

vec3 getNeonColor(float idx) {
    if (idx < 0.5) return vec3(0.0, 1.0, 0.8);      // Cyan
    else if (idx < 1.5) return vec3(1.0, 0.0, 0.5);  // Hot pink
    else if (idx < 2.5) return vec3(0.3, 0.8, 1.0);   // Electric blue
    else return vec3(1.0, 0.2, 0.8);                    // Purple
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    float speed = u_time * (0.3 + u_bass * 0.8);

    vec3 neon = getNeonColor(u_palette);
    vec3 neon2 = getNeonColor(u_palette + 1.0);

    vec3 color = vec3(0.0);

    // Particles
    for (int i = 0; i < 50; i++) {
        float fi = float(i);

        // Particle position with movement
        vec2 pos = vec2(
            hash(vec2(fi, 0.0)),
            hash(vec2(0.0, fi))
        );

        // Animate position
        float angle = speed + fi * 0.3;
        float radius = 0.1 + hash(vec2(fi * 1.5, fi)) * 0.3;
        radius *= (1.0 + u_bass * 0.5); // Bass expands radius

        pos.x += cos(angle + fi) * radius;
        pos.y += sin(angle * 0.7 + fi) * radius * 0.5;

        // Wrap around
        pos = fract(pos);

        // Distance to particle
        float d = length(uv - pos);

        // Particle glow
        float size = 0.01 + u_energy * 0.02;
        float particle = smoothstep(size, 0.0, d);

        // Twinkle
        float twinkle = sin(u_time * 3.0 + fi * 2.0) * 0.5 + 0.5;
        particle *= 0.5 + twinkle * 0.5;

        // Bass makes particles brighter
        particle *= 1.0 + u_bass * 0.5;

        // Color variation
        vec3 pColor = mix(neon, neon2, hash(vec2(fi, fi * 0.5)));

        color += pColor * particle * 0.4;
    }

    // Mid: adds trails/drift
    float trail = noise(uv * 8.0 + speed * 0.5);
    trail = pow(trail, 2.0);
    color += neon * trail * u_mid * 0.2;

    // Treble: fine dust
    float dust = noise(uv * 40.0 + u_time * 2.0);
    dust = pow(dust, 5.0);
    color += neon2 * dust * u_treble * 0.3;

    // Center glow
    float centerGlow = 0.015 / (dist + 0.05);
    color += neon * centerGlow * (0.3 + u_energy * 0.3);

    // Vignette
    float vignette = 1.0 - dist * 0.4;
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
