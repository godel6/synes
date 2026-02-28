#version 330

// Aurora Ocean
// Original shader for synes visualizer
// Concept: suspended underwater, looking up through a refractive surface
// at northern lights. Two worlds — bioluminescent deep below, aurora above.

uniform float u_time;
uniform vec2  u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_lyrics;
uniform float u_palette;

out vec4 f_color;

in vec2 v_uv;

#define PI  3.14159265359
#define PI2 6.28318530718

// ─── Noise helpers ────────────────────────────────────────────────────────────
float hash(float n){ return fract(sin(n)*43758.5453123); }
float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }

float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash2(i),
          b = hash2(i+vec2(1,0)),
          c = hash2(i+vec2(0,1)),
          d = hash2(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}

float fbm(vec2 p){
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.1; a*=0.5; }
    return v;
}

// ─── Water surface normal ──────────────────────────────────────────────────────
// Multiple overlapping sine waves + treble adds fine ripples
vec3 waterNormal(vec2 p, float t){
    float trebleRipple = 1.0 + u_treble*3.0;
    float h =
        0.12*sin(p.x*1.3 + t*0.9) +
        0.10*sin(p.y*1.7 + t*1.1) +
        0.07*sin((p.x+p.y)*1.1 + t*0.7) +
        0.05*sin(p.x*3.2 - t*1.4)*trebleRipple +
        0.03*sin(p.y*4.1 + t*1.8)*trebleRipple +
        0.02*noise(p*5.0 + t*0.5)*trebleRipple;

    float eps = 0.01;
    float hx =
        0.12*sin((p.x+eps)*1.3 + t*0.9)+
        0.10*sin(p.y*1.7 + t*1.1)+
        0.07*sin(((p.x+eps)+p.y)*1.1 + t*0.7)+
        0.05*sin((p.x+eps)*3.2 - t*1.4)*trebleRipple+
        0.03*sin(p.y*4.1 + t*1.8)*trebleRipple;
    float hy2 =
        0.12*sin(p.x*1.3 + t*0.9)+
        0.10*sin((p.y+eps)*1.7 + t*1.1)+
        0.07*sin((p.x+(p.y+eps))*1.1 + t*0.7)+
        0.05*sin(p.x*3.2 - t*1.4)*trebleRipple+
        0.03*sin((p.y+eps)*4.1 + t*1.8)*trebleRipple;

    return normalize(vec3(-(hx-h)/eps, 1.0, -(hy2-h)/eps));
}

// ─── Aurora above the surface ─────────────────────────────────────────────────
vec3 aurora(vec2 uv, float t){
    // mid frequencies drive aurora intensity and saturation
    float intensity = 0.5 + u_mid*1.2;

    vec3 col = vec3(0.0);
    // Multiple curtain layers at different heights/speeds
    for(int i=0; i<5; i++){
        float fi   = float(i);
        float spd  = 0.12 + fi*0.04;
        float freq = 1.8  + fi*0.6;
        float yOff = 0.2  + fi*0.18;

        // curtain shape: vertical bands that ripple horizontally
        float wave  = sin(uv.x*freq + t*spd + fi*1.3)*0.15
                    + sin(uv.x*freq*2.3 + t*spd*0.7 + fi)*0.07;
        float curtain = exp(-pow((uv.y - yOff - wave)*6.0, 2.0));
        curtain *= (0.4 + 0.6*fbm(vec2(uv.x*2.0+fi, t*0.05)));

        // Color per layer: greens, teals, purples, whites
        vec3 layerCol;
        if(i==0) layerCol = vec3(0.1, 0.9, 0.4);   // bright green
        else if(i==1) layerCol = vec3(0.0, 0.7, 0.8); // teal
        else if(i==2) layerCol = vec3(0.5, 0.2, 0.9); // purple
        else if(i==3) layerCol = vec3(0.8, 0.95, 1.0); // white-blue
        else          layerCol = vec3(0.2, 0.5, 0.7);  // deep blue

        col += layerCol * curtain * intensity;
    }

    // Stars (dim points in sky)
    vec2 starUV = floor(uv*120.0);
    float star  = pow(hash2(starUV), 18.0)*0.6;
    col += vec3(star);

    return col;
}

// ─── Underwater scene ─────────────────────────────────────────────────────────
vec3 underwater(vec2 uv, vec3 rd, float t){
    // bass causes deep bioluminescent pressure pulses
    float bassPulse = 1.0 + u_bass*2.5;
    float energy    = 0.3 + u_energy*0.7;

    // Deep color — dark indigo/black with blue-green tint
    vec3 deepColor = vec3(0.01, 0.04, 0.08);

    // Caustic light patterns from above, projected downward
    vec2 cp = uv*3.0 + vec2(t*0.08, t*0.05);
    float caustic =
        0.5 + 0.5*sin(cp.x*4.0 + sin(cp.y*3.0)*1.5 + t*0.4)
            * sin(cp.y*3.5 + sin(cp.x*2.5)*1.2 + t*0.3);
    caustic = pow(caustic, 3.0)*0.4;
    vec3 causticCol = vec3(0.0, 0.3, 0.4)*caustic;

    // Bioluminescent particles drifting upward
    float particles = 0.0;
    for(int i=0; i<8; i++){
        float fi  = float(i);
        float px  = hash(fi*3.1)*2.0-1.0;
        float py  = hash(fi*7.3)*2.0-1.0;
        float spd = 0.05 + hash(fi*13.7)*0.1;
        vec2  pp  = vec2(
            px + sin(t*0.2+fi)*0.2,
            mod(py + t*spd, 2.0)-1.0
        );
        float d   = length(uv - pp);
        float brightness = 0.004/(d*d + 0.002);
        particles += brightness*(0.6 + 0.4*sin(t*2.0+fi*PI));
    }
    // Bass makes them flare
    particles *= bassPulse;
    vec3 partCol = mix(vec3(0.0,0.6,0.5), vec3(0.2,0.4,1.0),
                       sin(t*0.3)*0.5+0.5) * particles;

    // God rays from above — vertical shafts of filtered surface light
    float rays = 0.0;
    for(int i=0; i<4; i++){
        float fi  = float(i);
        float rx  = (hash(fi*5.7)*2.0-1.0)*0.6;
        float ray = exp(-pow((uv.x - rx)*8.0 + sin(t*0.15+fi)*0.5, 2.0));
        ray      *= (0.5 + 0.5*fbm(vec2(uv.x*3.0, t*0.05+fi)));
        ray      *= smoothstep(0.0, -0.5, uv.y); // fade with depth
        rays     += ray*0.06;
    }
    vec3 rayCol = vec3(0.05, 0.2, 0.3)*rays*energy;

    return deepColor + causticCol + partCol + rayCol;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
void main(){
    vec2 fc  = gl_FragCoord.xy;
    vec2 uv  = (2.0*fc - u_resolution.xy)/max(u_resolution.x, u_resolution.y);

    float t = u_time;

    // Camera drifts very slowly up and down — like breathing
    float camY = sin(t*0.18)*0.12;

    // The water surface is at y = 0.0 in view space
    // Camera sits just below: y = -0.15 + breathing
    float camDist = 0.15 - camY;

    // Ray direction
    vec3 rd = normalize(vec3(uv.x, uv.y, 1.6));

    // Intersect with water plane (y = camDist above camera)
    // The surface in uv-space is at a fixed v-position
    float surfaceV = camDist * 1.6; // project surface into screen space

    // World-space hit point on water surface
    float tHit     = camDist / max(rd.y + camDist, 0.001);
    vec2  surfaceHit = uv + vec2(0.0, surfaceV);

    // Water surface normal at hit point
    vec3 wNorm = waterNormal(surfaceHit*1.5 + vec2(t*0.05), t);

    // Fresnel: how much do we see through vs reflect?
    // Looking straight up → more transmission (see aurora)
    // Looking at angle   → more reflection
    float cosTheta = abs(dot(normalize(vec3(0,1,0)), rd));
    float fresnel  = pow(1.0 - cosTheta, 3.0);
    fresnel        = mix(0.05, 0.92, fresnel);

    // Refraction offset — surface normal perturbs what we see above
    vec2 refractOffset = wNorm.xz * 0.08 * (1.0-fresnel);

    // What's above the surface: aurora sky
    vec2 skyUV   = vec2(uv.x, uv.y - surfaceV) + refractOffset;
    vec3 skyCol  = aurora(skyUV*0.5 + 0.5, t);

    // Reflection: mirror of sky in the surface
    vec3 reflCol = aurora(vec2(uv.x + refractOffset.x, -(uv.y - surfaceV))
                          *0.5 + 0.5, t) * 0.6;

    // What's below: underwater scene
    vec3 deepCol = underwater(uv + refractOffset*0.5, rd, t);

    // Blend based on whether pixel is above or below surface line
    // and Fresnel for the surface band itself
    float surfaceMask = smoothstep(surfaceV-0.04, surfaceV+0.04, uv.y);

    // Above surface: see aurora directly
    // Below surface: see underwater + fresnel reflection of aurora in surface
    vec3 belowCol = deepCol + reflCol*fresnel;
    vec3 col      = mix(belowCol, skyCol, surfaceMask);

    // Thin surface glimmer line — where water meets sky
    float glimmer = exp(-pow((uv.y - surfaceV)*18.0, 2.0))
                  * (0.4 + 0.6*fbm(vec2(uv.x*8.0, t*0.3)))
                  * (1.0 + u_treble*2.0);
    col += vec3(0.6,0.85,1.0)*glimmer*0.35;

    // bass deep pulse — whole underwater volume flashes bio-blue
    float bassFlash = u_bass*0.12 * (1.0-surfaceMask);
    col += vec3(0.0, 0.3, 0.5)*bassFlash;

    // Vignette
    col *= 1.0 - 0.45*dot(uv*0.8, uv*0.8);

    // Gentle tone mapping
    col  = col/(col + 0.8);
    col  = pow(max(col,0.0), vec3(0.42));

    // Subtle lyrics glow overlay
    vec2 center = v_uv - 0.5;
    float dist = length(center);
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        col = mix(col, col + glow * 0.3, edge_glow * pulse * 0.4);
    }

    f_color = vec4(col, 1.0);
}
