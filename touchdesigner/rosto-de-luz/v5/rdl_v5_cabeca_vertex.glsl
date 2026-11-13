
uniform sampler2D sVid;
uniform vec4 uA;   // tamanho, intensidade, brilho crânio, tempo
uniform vec4 uB;   // paleta, saturação, fluxo, tom
uniform vec4 uC;   // cintilar, deriva, respiração, fala
uniform vec4 uD;   // dispersão, vórtice, scanner, glitch
uniform vec4 uE;   // contraste, profundidade da luz, brilho das mãos, -
uniform vec4 uF;   // brilho mínimo, cor real, compensação de tamanho, -
uniform vec4 uS;   // espectro: quantidade, modo (0 barras, 1 radial, 2 cascata), cor, altura dos picos
uniform sampler2D sSpec;   // 64 bandas x 48 linhas de histórico (linha 0 = agora)
out vec4 vCol;
out vec2 vQ;

vec3 hsv(float h, float s, float v){
    vec3 k = clamp(abs(mod(h*6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return v * mix(vec3(1.0), k, s);
}
vec3 heat(float t){ return clamp(vec3(1.5*t, 1.5*t-0.5, 3.0*t-2.0), 0.0, 1.0) + vec3(0.05,0.0,0.25)*(1.0-t); }
float hash(float n){ return fract(sin(n * 12.9898 + 4.1414) * 43758.5453); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

void main(){
    int id = TDInstanceID();
    vQ = P.xy * 2.0;
    vec4 ic = TDInstanceColor(vec4(1.0));
    vec2 uv = ic.rg;
    float kind = ic.b;
    float t = uA.w;
    float fid = float(id);
    float h = hash(fid * 0.0137), h2 = hash(fid * 0.0291 + 7.0), h3 = hash(fid * 0.0473 + 13.0);

    bool vidK = (kind < 0.5) || (kind > 2.5);   // rosto e mãos usam a luz do vídeo
    vec3 c; float l;
    if (vidK) {
        c = texture(sVid, uv).rgb;
        l = pow(clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0), uE.x);
        l = uF.x + (1.0 - uF.x) * l;
    } else {
        c = vec3(0.6);
        l = 0.3 + 0.35 * h;
    }

    vec3 center = TDDeform(vec3(0.0)).xyz;
    vec3 p = center;

    // glitch: fatias horizontais saltam
    float gstep = floor(t * 9.0);
    float slice = floor(p.y * 14.0);
    float gOn = step(1.0 - uD.w * 0.6, hash(slice * 3.1 + gstep * 17.0)) * step(0.001, uD.w);
    p.x += (hash(gstep + slice * 5.0) - 0.5) * 0.6 * uD.w * gOn;

    // respiração e deriva
    p *= 1.0 + sin(t * 1.1) * 0.012 * uC.z;
    p += vec3(sin(t*(0.35+h2*0.5) + h*6.2831), cos(t*(0.3+h*0.5) + h2*6.2831), sin(t*(0.4+h3*0.4) + h*12.0)) * uC.y * 0.012;

    // vórtice: a cabeça se torce em torno do eixo vertical
    p.xz = rot(uD.y * p.y * 1.6 * sin(t * 0.45) + uD.y * 0.3 * sin(t * 0.2 + p.y * 2.0)) * p.xz;

    // dispersão e fala: os pontos se soltam do centro da cabeça
    vec3 dir = normalize(center + (vec3(h, h2, h3) - 0.5) * 0.8 + 1e-4);
    vec3 turb = vec3(sin(t*0.5 + h*9.0), cos(t*0.4 + h2*9.0), sin(t*0.3 + h3*9.0));
    p += dir * uD.x * (0.4 + 2.2 * h3) + turb * uD.x * 0.35;
    p += dir * uC.w * (0.1 + 0.5 * h3);

    // scanner holográfico: faixa de luz que percorre a cabeça
    float scanY = mod(t * 0.45, 3.0) - 1.5;
    float band = exp(-pow((p.y - scanY) * 9.0, 2.0)) * uD.z;

    // espectrômetro: cada ponto ouve uma banda de frequência do microfone
    float sCoord = 0.0, sVal = 0.0;
    if (uS.x > 0.001) {
        float sRow = 0.0;
        if (uS.y < 0.5)      sCoord = clamp((center.y + 1.1) / 2.2, 0.0, 1.0);            // barras: graves embaixo
        else if (uS.y < 1.5) sCoord = clamp(length(center.xy) / 1.3, 0.0, 1.0);           // radial: graves no centro
        else { sCoord = clamp((center.x + 1.2) / 2.4, 0.0, 1.0);                          // cascata: espectrograma
               sRow = clamp((1.1 - center.y) / 2.2, 0.0, 1.0); }
        vec2 tsz = vec2(textureSize(sSpec, 0));
        sVal = texture(sSpec, vec2(sCoord, (sRow * (tsz.y - 1.0) + 0.5) / tsz.y)).r;
        float push = sVal * sVal * uS.x * uS.w;
        vec3 outw = normalize(vec3(center.xy * 0.6, 1.0));
        p += outw * push * 0.9;
    }

    // cintilação
    float tw = 0.5 + 0.5 * sin(t * (1.5 + h2 * 5.0) + h * 40.0);
    tw = mix(1.0, 0.25 + 0.75 * tw * tw, uC.x);

    int ci = TDCameraIndex();
    vec4 cp = uTDMats[ci].cam * vec4(p, 1.0);
    float var = mix(0.6 + 0.8 * h3, 0.9 + 0.2 * h3, uF.w);
    float lsz = mix(0.6 + 0.4 * l, 0.25 + 1.0 * l, uF.w);
    float sz = uA.x * 0.011 * var * lsz * (1.0 + band * 1.5 + uC.w * 0.6);
    sz *= uF.z;
    if (kind > 0.5 && kind < 2.5) sz *= 0.8;
    cp.xy += P.xy * sz;
    gl_Position = uTDMats[ci].proj * cp;
    vec4 cc = uTDMats[ci].cam * vec4(0.0, 0.0, 0.0, 1.0);
    float depthRel = cp.z - cc.z;
    float dfade = mix(1.0, 0.08 + 0.92 * smoothstep(-0.55, 0.45, depthRel), uE.y);

    vec3 col;
    float mode = uB.x;
    float flow = t * 0.05 * uB.z;
    float yy = clamp(center.y * 0.5 + 0.5, 0.0, 1.0);
    if (mode < 0.5) {                       // aurora
        float hue = fract(0.66 - l * 0.6 + yy * 0.25 + h * 0.05 + flow);
        col = hsv(hue, uB.y * (1.0 - 0.4 * l * l), 1.0);
    } else if (mode < 1.5) {                // holograma
        col = mix(vec3(0.1, 0.55, 1.0), vec3(0.75, 1.0, 1.0), l);
        col *= 0.75 + 0.25 * sin(center.y * 120.0 + t * 6.0);
    } else if (mode < 2.5) {                // real
        float g = dot(c, vec3(0.333));
        col = vidK ? mix(vec3(g), c, 1.0 + uB.y) * 1.3 : vec3(0.55, 0.6, 0.75);
    } else if (mode < 3.5) {                // luz
        col = mix(vec3(0.55, 0.6, 1.0), vec3(1.0, 0.97, 0.9), l);
    } else if (mode < 4.5) {                // calor
        col = heat(l);
    } else {                                // tom
        col = hsv(uB.w + l * 0.08 + h * 0.05, uB.y * (0.9 - 0.5 * l), 1.0);
    }
    if (vidK) col = mix(col, c * (0.6 + 0.8 * l) * 1.25, uF.y);
    col += band * vec3(0.6, 0.9, 1.0);
    col = mix(col, col * vec3(1.6, 0.4, 1.6), gOn);
    if (uS.x > 0.001) {                                  // cor do espectrômetro (arco-íris por frequência)
        vec3 sc = hsv(0.72 - sCoord * 0.78, 0.95, 1.0);
        col = mix(col, sc * (0.35 + 1.4 * sVal), clamp(uS.z * (0.35 + sVal), 0.0, 1.0));
    }
    float alpha = mix(0.35 + 0.65 * l, l * l * 1.4, uF.w) * tw * dfade;
    alpha *= mix(1.0, 0.6 + 1.8 * sVal, clamp(uS.x, 0.0, 1.0));
    if (kind > 0.5 && kind < 2.5) alpha *= uA.z;
    if (kind > 1.5 && kind < 2.5) alpha *= smoothstep(-1.7, -0.6, center.y);   // pescoço some para baixo
    if (kind > 2.5) alpha *= uE.z;                                  // mãos
    alpha *= ic.a;                                                  // aparecer/sumir
    vCol = vec4(max(col, 0.0), alpha);
}
