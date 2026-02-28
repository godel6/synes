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
        return vec3(0.1, 0.2, 0.5);
    } else if (idx < 1.5) {
        return vec3(0.8, 0.3, 0.1);
    } else if (idx < 2.5) {
        return vec3(0.1, 0.4, 0.7);
    } else {
        return vec3(0.8, 0.2, 0.5);
    }
}

vec3 getPaletteColor2(float idx) {
    if (idx < 0.5) {
        return vec3(0.5, 0.1, 0.6);
    } else if (idx < 1.5) {
        return vec3(1.0, 0.6, 0.2);
    } else if (idx < 2.5) {
        return vec3(0.2, 0.8, 0.8);
    } else {
        return vec3(0.3, 1.0, 0.5);
    }
}

// Hash function for randomness
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Value noise
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

// FBM for trails
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Bass: particle speed and trail length
    float speed = u_time * (0.2 + u_bass * 0.8);

    // Create flowing particle field
    vec2 p = uv * 10.0;
    p += vec2(fbm(p + speed), fbm(p - speed)) * (1.0 + u_bass * 2.0);

    // Base particles
    float particles = 0.0;
    for(int i = 0; i < 50; i++) {
        vec2 pos = vec2(
            hash(vec2(float(i), 0.0)),
            hash(vec2(0.0, float(i)))
        );

        // Animate position
        pos += vec2(sin(speed + float(i)), cos(speed * 0.7 + float(i))) * 0.1 * (1.0 + u_bass);

        float d = length(uv - pos);
        particles += smoothstep(0.03, 0.0, d);
    }

    // Mid: trail length and color gradient
    float trailLength = 0.5 + u_mid * 1.5;
    float trails = fbm(p * trailLength);

    // Color based on position and mid
    vec3 color1 = getPaletteColor(u_palette);
    vec3 color2 = getPaletteColor2(u_palette);
    vec3 color3 = getPaletteColor(u_palette) * 0.7;
    vec3 color4 = getPaletteColor2(u_palette) * 0.7;

    float colorMix = uv.x + uv.y + u_mid;
    vec3 particleColor = mix(color1, color2, smoothstep(0.0, 0.5, colorMix));
    particleColor = mix(particleColor, color3, smoothstep(0.3, 0.7, colorMix));
    particleColor = mix(particleColor, color4, smoothstep(0.6, 1.0, colorMix));

    vec3 color = particleColor * particles;
    color += particleColor * trails * 0.3;

    // Treble: sparkles and twinkling
    float sparkleTime = u_time * 3.0;
    float sparkle = 0.0;
    for(int i = 0; i < 20; i++) {
        vec2 sp = vec2(
            hash(vec2(float(i) * 1.23, 0.0)),
            hash(vec2(0.0, float(i) * 1.23))
        );
        float twinkle = sin(sparkleTime * (hash(sp) + 0.5) + float(i)) * 0.5 + 0.5;
        float d = length(uv - sp);
        sparkle += smoothstep(0.015, 0.0, d) * twinkle * u_treble;
    }
    color += vec3(sparkle);

    // Energy: brightness and glow
    float brightness = 0.5 + u_energy * 0.8;
    color *= brightness;

    // Glow from center
    float glow = 1.0 - dist;
    color += particleColor * glow * u_energy * 0.3;

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
