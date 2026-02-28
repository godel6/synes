#version 330

// Truchet Tunnel - ported from Shadertoy @byt3_m3chanic
// Original: https://www.shadertoy.com/view/sdtGRn
// Ported & enhanced for audio reactivity

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

#define PI   3.14159265359
#define PI2  6.28318530718

#define MAX_DIST  28.0
#define MIN_DIST  0.001
#define SCALE     0.7500

float hash21(vec2 p){ return fract(sin(dot(p,vec2(26.34,45.32)))*4324.23); }
mat2  rot(float a){ return mat2(cos(a),sin(a),-sin(a),cos(a)); }

vec3  hit, hitP1, sid, id;
float speed, sdir, hitD, chx, checker;
mat2  t90;

float torus(vec3 p, vec2 t){
    vec2 q = vec2(length(p.xy)-t.x, p.z);
    return length(q)-t.y;
}
float truchet(vec3 p, vec3 x, vec2 r){
    return min(torus(p-x,r), torus(p+x,r));
}

const float size    = 1.0/SCALE;
const float hlf     = size/2.0;
const float shorten = 1.26;

vec3 drep3(inout vec3 p){
    vec3 id2 = floor((p+hlf)/size);
    p = mod(p+hlf,size)-hlf;
    return id2;
}

vec2 map(vec3 q3){
    vec2 res = vec2(100.0, 0.0);

    float k  = 5.0/dot(q3,q3);
    q3 *= k;
    q3.z += speed;

    vec3 qm = q3;
    vec3 qd = q3+hlf;
    qd.xz *= t90;

    vec3 qid = drep3(qm);
    vec3 did = drep3(qd);

    float ht  = hash21(qid.xy+qid.z);
    float hy  = hash21(did.xz+did.y);

    float chk1 = mod(qid.y+qid.x, 2.0)*2.0-1.0;
    float chk2 = mod(did.y+did.x, 2.0)*2.0-1.0;

    float thx = 0.115;
    float thz = 0.200;

    if(ht>0.5) qm.x *= -1.0;
    if(hy>0.5) qd.x *= -1.0;

    float t2 = truchet(qm, vec3(hlf,hlf,0.0), vec2(hlf,thx));
    if(t2<res.x){ sid=qid; hit=qm; chx=chk1; sdir=ht>0.5?-1.0:1.0; res=vec2(t2,2.0); }

    float d2 = truchet(qd, vec3(hlf,hlf,0.0), vec2(hlf,thz));
    if(d2<res.x){ sid=did; hit=qd; chx=chk2; sdir=hy>0.5?-1.0:1.0; res=vec2(d2,1.0); }

    float mul = 1.0/k;
    res.x = res.x*mul/shorten;
    return res;
}

vec3 normal(vec3 p, float t2){
    float e = MIN_DIST*t2;
    vec2  h = vec2(1,-1)*0.5773;
    return normalize(
        h.xyy*map(p+h.xyy*e).x +
        h.yyx*map(p+h.yyx*e).x +
        h.yxy*map(p+h.yxy*e).x +
        h.xxx*map(p+h.xxx*e).x
    );
}

// Breathing palette — slowly drifts warm↔cool with time + mid
vec3 hue(float t2){
    vec3 drift = vec3(0.220,0.961,0.875)
               + 0.15*sin(u_time*0.1 + vec3(0.0,2.094,4.188))
               + u_mid*0.2;
    return 0.375 + 0.375*cos(PI2*t2*(vec3(0.985,0.98,0.95)+drift));
}

float gear(vec2 p, float radius){
    float sp = floor(radius*PI2)*2.0;
    float gs = length(p.xy)-radius;
    float at = atan(p.y,p.x);
    float gw = abs(sin(at*sp)*0.15);
    gs += smoothstep(0.05,0.5,gw);
    gs  = max(gs, -(length(p.xy)-(radius*0.45)));
    return gs;
}

vec4 FC = vec4(0.001,0.001,0.001,0.0);
vec3 lpos = vec3(-hlf, hlf, 3.85);

vec4 render(inout vec3 ro, inout vec3 rd, inout vec3 ref2, bool last, inout float d){
    vec3  C = vec3(0.0);
    vec3  p = ro;
    float m = 0.0;

    for(int i=0; i<180; i++){
        p = ro + rd*d;
        vec2 ray = map(p);
        if(abs(ray.x)<MIN_DIST*d || d>MAX_DIST) break;
        d  += i<64 ? ray.x*0.35 : ray.x;
        m   = ray.y;
    }

    hitP1   = hit;
    id      = sid;
    hitD    = sdir;
    checker = chx;

    if(d<MAX_DIST){
        vec3 pp = ro+rd*d;
        vec3 n  = normal(pp,d);
        vec3 l  = normalize(lpos-pp);
        vec3 h2 = vec3(0.05);

        float diff    = clamp(dot(n,l),0.0,1.0);
        float bounce  = clamp(dot(n,vec3(0.0,-1.0,0.0)),0.0,1.0);
        float fresnel = pow(clamp(1.0+dot(rd,n),0.0,1.0),5.0);
        fresnel       = mix(0.01,0.7,fresnel);

        float shdw = 1.0;
        for(float st=0.01; st<12.0;){
            float sh = map(pp+l*st).x;
            if(sh<MIN_DIST){ shdw=0.0; break; }
            shdw = min(shdw, 24.0*sh/st);
            st  += sh;
            if(shdw<MIN_DIST||st>32.0) break;
        }
        diff += bounce;
        diff  = mix(diff, diff*shdw, 0.65);

        vec3  view = normalize(pp-ro);
        vec3  ret  = reflect(normalize(lpos),n);
        float spec = 0.5*pow(max(dot(view,ret),0.0),(m==2.0||m==4.0)?24.0:64.0);

        if(m==2.0){
            vec3 hp = hitP1*hitD;
            vec2 d3 = vec2(length(hp-hlf),length(hp+hlf));
            vec3 g3 = d3.x<d3.y ? vec3(hp-hlf) : vec3(hp+hlf);
            float angle = atan(g3.y,g3.x)/PI2;
            float gz    = atan(hp.z, length(g3.yx)-hlf)/PI2;
            vec2  uv    = vec2(angle,gz);
            if(hitD<1.0 ^^ checker>0.0) uv.y *= -1.0;

            float px2 = 0.0125;
            vec2 scaler = vec2(28.0,6.0);
            vec2 grid   = fract(uv*scaler)-0.5;
            vec2 cid2   = floor(uv*scaler);
            if(hash21(cid2)<0.5) grid.x *= -1.0;

            vec2  d22 = vec2(length(grid-0.5),length(grid+0.5));
            vec2  gx  = d22.x<d22.y ? vec2(grid-0.5) : vec2(grid+0.5);
            float circle = length(gx)-0.5;
            float center = smoothstep(0.03-px2,px2,abs(abs(abs(circle)-0.2)-0.1)-0.025);

            h2   = mix(vec3(0.0),vec3(0.6),center);
            ref2 = vec3(clamp(1.0-center,0.0,1.0))-fresnel;
        }

        if(m==1.0){
            vec3 hp = hitP1*hitD;
            vec2 d3 = vec2(length(hp-hlf),length(hp+hlf));
            vec3 g3 = d3.x<d3.y ? vec3(hp-hlf) : vec3(hp+hlf);
            float angle = atan(g3.y,g3.x)/PI2;
            float gz    = atan(hp.z, length(g3.yx)-hlf)/PI2;
            vec2  uv    = vec2(angle,gz);
            if(hitD<1.0 ^^ checker>0.0) uv.y *= -1.0;

            float px2   = 0.0125;
            vec2 scaler = vec2(28.0,10.0);
            vec2 grid   = fract(uv*scaler)-0.5;
            vec2 cid2   = floor(uv*scaler);
            float hs    = hash21(cid2);
            if(hs<0.5) grid.x *= -1.0;

            vec2  d22   = vec2(length(grid-0.5),length(grid+0.5));
            vec2  gx    = d22.x<d22.y ? vec2(grid-0.5) : vec2(grid+0.5);
            float circle = length(gx)-0.5;
            float center = smoothstep(0.03-px2,px2,abs(circle)-0.15);
            h2 = mix(hue(length(pp.zy*0.3)*3.), hue(length(pp.zx*0.5)*2.), center);

            float chk2   = mod(cid2.y+cid2.x,2.0)*2.0-1.0;
            vec2  arc    = grid-sign(grid.x+grid.y+0.001)*0.5;
            float angle2 = atan(arc.x,arc.y);
            float width  = 0.2;
            float dist2  = length(arc);

            // treble speeds up gear spin
            float gearSpeed = 1.4 + u_treble*2.5;
            float tm   = u_time*0.25;
            vec2  tuv  = vec2(
                fract(chk2*angle2/1.57+tm),
                (dist2-(0.5-width))/(2.0*width)*2.0
            );
            tuv.y -= 0.5;
            vec2 tid = vec2(
                floor(chk2*angle2/1.57+tm),
                floor(dist2-(0.5-width))/(2.0*width)
            );
            tuv.xy *= vec2(2.0,0.5);
            tuv.x   = mod(tuv.x+0.5,1.0)-0.5;

            vec2  gvec = tuv.xy-vec2(0.0,0.25);
            float dir  = (chk2>0.0 ^^ hs>0.5) ? -1.0:1.0;
            gvec *= rot(u_time*gearSpeed*dir);
            float ddt  = gear(gvec,0.45);
            ddt = smoothstep(-px2,px2,min(ddt,center));
            h2  = mix(h2,vec3(0.0),ddt);
            ref2 = vec3(clamp(1.0-center,0.0,1.0))-fresnel;
        }

        // energy reduces fog → reveals more depth on loud moments
        float fogK = 0.05 - u_energy*0.02;
        C = diff*h2+spec;
        if(last) C = mix(FC.rgb, C, exp(-fogK*d*d*d));
        ro = pp+n*0.002;
        rd = reflect(rd,n);
    } else {
        C = FC.rgb;
    }
    return vec4(C,0.0);
}

void main(){
    t90   = rot(PI*0.5);
    // bass pumps fly-through speed
    speed = u_time*(0.225 + u_bass*0.18);

    vec2  uv2 = (2.0*gl_FragCoord.xy - u_resolution.xy)/max(u_resolution.x,u_resolution.y);
    vec3  ro   = vec3(0.0, 0.0, 3.5);
    vec3  rd   = normalize(vec3(uv2,-1.0));

    float x = -0.305;
    float y = -0.750;
    mat2  rx = rot(x);
    mat2  ry = rot(y);
    ro.yz *= rx; rd.yz *= rx;
    ro.xz *= ry; rd.xz *= ry;

    vec3  C   = vec3(0.0);
    vec3  ref2 = vec3(0.0);
    vec3  fil  = vec3(1.0);
    float d    = 0.0;

    for(float i=0.0; i<2.0; i++){
        vec4 pass = render(ro, rd, ref2, i==1.0, d);
        C   += pass.rgb*fil;
        fil *= ref2;
        if(i==0.0) FC = vec4(FC.rgb, exp(-0.145*d*d*d));
    }

    C = mix(C, FC.rgb, 1.0-FC.w);

    // subtle vignette
    C *= 1.0 - 0.4*dot(uv2,uv2);

    C = clamp(C, vec3(0.0), vec3(1.0));
    C = pow(C, vec3(0.4545));

    // Subtle lyrics glow overlay
    vec2 center = v_uv - 0.5;
    float dist = length(center);
    if (u_lyrics > 0.5) {
        float pulse = sin(u_time * 2.0) * 0.15 + 0.85;
        vec3 glow = vec3(1.0, 0.9, 0.7);
        float edge_glow = smoothstep(0.3, 0.8, dist);
        C = mix(C, C + glow * 0.3, edge_glow * pulse * 0.4);
    }

    f_color = vec4(C, 1.0);
}
