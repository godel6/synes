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

// Hash and noise functions
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
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

vec3 getPaletteColor(float idx) {
    if (idx < 0.5) return vec3(0.4, 0.1, 0.6);      // Deep purple
    else if (idx < 1.5) return vec3(0.9, 0.3, 0.1); // Sunset orange
    else if (idx < 2.5) return vec3(0.1, 0.4, 0.7); // Deep ocean
    else return vec3(0.8, 0.1, 0.5);                  // Neon pink
}

vec3 getPaletteColor2(float idx) {
    if (idx < 0.5) return vec3(0.1, 0.5, 0.8);
    else if (idx < 1.5) return vec3(1.0, 0.7, 0.3);
    else if (idx < 2.5) return vec3(0.3, 0.8, 0.9);
    else return vec3(0.3, 1.0, 0.5);
}

void main() {
    vec2 uv = v_uv;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Bass: speed and intensity
    float speed = u_time * (0.15 + u_bass * 0.3);

    // Create nebula clouds
    vec2 p = uv * 3.0;
    p += vec2(fbm(p + speed), fbm(p - speed));

    float nebula = fbm(p + speed * 0.5);

    // Add detail layers
    nebula += fbm(p * 2.0 - speed * 0.3) * 0.5;
    nebula += fbm(p * 4.0 + speed * 0.2) * 0.25;

    nebula = smoothstep(0.3, 0.8, nebula);

    // Mid: color gradient
    float colShift = u_mid * 0.4;
    vec3 col1 = getPaletteColor(u_palette);
    vec3 col2 = getPaletteColor2(u_palette);

    vec3 color = mix(col1, col2, nebula + colShift);

    // Add stars
    float stars = 0.0;
    for(int i = 0; i < 30; i++) {
        vec2 starPos = vec2(hash(vec2(float(i), 0.0)), hash(vec2(0.0, float(i))));
        float twinkle = sin(u_time * 2.0 + float(i)) * 0.5 + 0.5;
        float d = length(uv - starPos);
        stars += smoothstep(0.01, 0.0, d) * twinkle;
    }
    color += vec3(stars) * 0.8;

    // Treble: fine dust
    float dust = fbm(uv * 20.0 + u_time);
    dust = pow(dust, 3.0);
    color += vec3(dust * u_treble * 0.2);

    // Energy: brightness
    float brightness = 0.6 + u_energy * 0.6;
    color *= brightness;

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
