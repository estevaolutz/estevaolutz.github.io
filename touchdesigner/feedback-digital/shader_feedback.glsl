
// FEEDBACK DIGITAL - motor do Feedback Lab (5 modos)
// entradas: 0 laco, 1 onda do microfone, 2 semente (camera+toque)
uniform vec4 uT;   // x tempo, y dt, z aspecto, w modo (0-4)
uniform vec4 uF1;  // x persistencia, y realce, z zoom, w rotacao
uniform vec4 uF2;  // x deslocamento, y escala ruido, z giro de matiz, w separacao RGB
uniform vec4 uF3;  // x semente, y linha audio, z -, w congelar
uniform vec4 uR;   // x,y centro aleatorio, z dobra aleatoria, w escala da dobra
uniform vec4 uF4;  // x inversao, y brilho, z pulso graves, w respiracao (lfo)
out vec4 fragColor;
float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5;} return s;}
vec2 curl(vec2 p){ float e=.02; return vec2(fbm(p+vec2(0,e))-fbm(p-vec2(0,e)), -(fbm(p+vec2(e,0))-fbm(p-vec2(e,0))))/(2.*e);}
vec3 hueRot(vec3 c,float h){ vec3 k=vec3(0.57735); float co=cos(h); return c*co+cross(k,c)*sin(h)+k*dot(k,c)*(1.-co); }
float lum(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
vec3 P(vec2 uv){ return texture(sTD2DInputs[0],uv).rgb; }
vec2 toUV(vec2 c,float asp){ c.x/=asp; return c+.5; }
float sdShape(vec2 p,float r,float m){
  float c=length(p)-r; vec2 d=abs(p)-vec2(r*.85); float s=length(max(d,0.))+min(max(d.x,d.y),0.);
  vec2 dl=abs(p)-vec2(r*1.8,r*.14); float l=length(max(dl,0.))+min(max(dl.x,dl.y),0.);
  if(m<1.5) return mix(c,s,clamp(m/1.5,0.,1.)); return mix(s,l,clamp(m-1.5,0.,1.)); }
void main(){
  vec2 res=uTDOutputInfo.res.zw; float asp=res.x/res.y; vec2 px=1./res;
  vec2 uv=vUV.st; vec2 c=uv-.5; c.x*=asp; vec2 o=uR.xy; c-=o;
  int mode=int(uT.w+0.5);
  float z=1.0-uF1.z-uF4.w-uF4.z; float an=uF1.w;
  mat2 R=mat2(cos(an),sin(an),-sin(an),cos(an));
  vec2 src=c;
  vec3 col;
  if(mode==0){            // 1 TUNEL: zoom + rotacao (Transform TOP no laco)
    src=R*(c*z);
  } else if(mode==1){     // 2 FLUIDO: deslocamento por ruido (Noise + Displace TOP)
    src=R*(c*z) - curl(c*uF2.y+vec2(0.,uT.x*.05))*uF2.x*0.004;
  } else if(mode==2){     // 3 ESTRIAS: bordas realimentadas (Edge TOP no laco)
    src=R*(c*z);
  } else if(mode==3){     // 4 DERRETER: auto-deslocamento pelo gradiente da propria imagem (Slope + Displace)
    vec2 u0=uv;
    float gx=lum(P(u0+vec2(px.x*3.,0.)))-lum(P(u0-vec2(px.x*3.,0.)));
    float gy=lum(P(u0+vec2(0.,px.y*3.)))-lum(P(u0-vec2(0.,px.y*3.)));
    src=R*(c*z) + vec2(gy,-gx)*uF2.x*0.03 + vec2(0.,0.0008*(1.0+uF2.x));
  } else {                // 5 PIXEL SORT: escorre pela luminancia (Displace pelo proprio brilho)
    vec2 u0=uv;
    float l=lum(P(u0));
    src=R*(c*z) + vec2(0.,(l-0.35)*uF2.x*0.012);
  }
  src -= curl(c*uR.w+vec2(uT.x*.031,-uT.x*.023))*uR.z*0.004;
  src += o;
  vec2 su=toUV(src,asp);
  float ch=uF2.w*0.004;
  vec3 prev=vec3(texture(sTD2DInputs[0],su+vec2(ch,0.)).r, texture(sTD2DInputs[0],su).g, texture(sTD2DInputs[0],su-vec2(ch,0.)).b);
  vec3 bl=(P(su+vec2(px.x,0.))+P(su-vec2(px.x,0.))+P(su+vec2(0.,px.y))+P(su-vec2(0.,px.y)))*.25;
  float sh=uF1.y*(mode==2?2.2:0.6);
  col=prev+(prev-bl)*sh;
  if(mode==2) col+=abs(prev-bl)*uF1.y*1.5;
  col=hueRot(col,uF2.z);
  col*=uF1.x;
  // semente: movimento da camera + toque (input 2), emissiva sobre o rastro
  vec3 sd=texture(sTD2DInputs[2],uv).rgb;
  col=max(col, sd*uF3.x);
  float w=texture(sTD2DInputs[1],vec2(uv.x,.5)).r;
  float yy=.5+clamp(w*1.4,-1.,1.)*.4;
  col+=vec3(.9,.95,1.)*(1.0-smoothstep(px.y*.8,px.y*2.5,abs(uv.y-yy)))*uF3.y;
  col=clamp(col,0.,1.0);
  if(uF3.w>0.5) col=max(col,P(uv)*0.0+texture(sTD2DInputs[0],uv).rgb);
  fragColor=TDOutputSwizzle(vec4(col,1.));
}
