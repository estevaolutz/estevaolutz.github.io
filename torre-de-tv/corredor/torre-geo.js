import * as THREE from 'three';
const PI=Math.PI, V=(x,y,z)=>new THREE.Vector3(x,y,z);
/* ================= GEOMETRIA (medidas em metros) ================= */
const RT=50/Math.sqrt(3);                       // raio do triângulo de 50 m de lado
const BND=[25,50,65,75,90,100,115,125,135,147,159,171,182,192,205,217,224.01]; // módulos (PUC-Rio)
function stageOf(y){if(y<25)return 0;for(let i=0;i<BND.length-1;i++)if(y<BND[i+1])return 3.5+i;return 3.5+BND.length-2;}
const hexR=y=>10.5+(3.0-10.5)*(y-25)/122;
const polar=(r,a,y)=>V(r*Math.sin(a),y,r*Math.cos(a));
const hv=(k,y)=>polar(hexR(y),k*PI/3,y);
const SQ=[[1,1],[1,-1],[-1,-1],[-1,1]];
const sv=(k,y,h)=>V(SQ[k%4][0]*h,y,SQ[k%4][1]*h);
const dirA=(a,s=1)=>[Math.sin(a)*s,0,Math.cos(a)*s];
const nrm=(x,z,s=1)=>{const l=Math.hypot(x,z)||1;return [x/l*s,0,z/l*s];};
const sqFaceN=(k,s)=>nrm(SQ[k][0]+SQ[(k+1)%4][0],SQ[k][1]+SQ[(k+1)%4][1],s);
const sqCornN=(k,s)=>nrm(SQ[k][0],SQ[k][1],s);

// categorias
const C={CONC:0,GLASS:1,LEG:2,BRACE:3,RING:4,STRUT:5,MAST:6,ARM:7,FM:8,TV:9,CEL:10,MW:11,BEACON:12,CORE:13,GROUND:14};
const beams=[],meshes=[],extra=[];
function B(a,b,cat,rad,o={}){beams.push({a,b,cat,rad:rad||[0,0,0],stage:o.stage??stageOf((a.y+b.y)/2),emit:o.emit??-1});}
function M(geo,cat,stage,rad){meshes.push({geo,cat,stage,rad:rad||[0,0,0]});}

// --- base de concreto: 3 pilares em U, núcleo, laje, faixa de vidro, cobertura
for(let k=0;k<3;k++){
  const th=k*2*PI/3, s=new THREE.Shape();
  s.moveTo(-3,0);s.lineTo(3,0);s.lineTo(4.5,15);s.lineTo(2.2,15);s.lineTo(2.2,9);
  s.absarc(0,9,2.2,0,PI,true);s.lineTo(-2.2,15);s.lineTo(-4.5,15);s.lineTo(-3,0);
  const g=new THREE.ExtrudeGeometry(s,{depth:2.4,bevelEnabled:false,curveSegments:16});
  g.translate(0,0,-1.2);g.rotateY(th-PI/2);const p=polar(17,th,0);g.translate(p.x,0,p.z);
  M(g,C.CONC,0,dirA(th,1.6));
}
{const g=new THREE.BoxGeometry(10.5,25,3.4);g.translate(0,12.5,0);M(g,C.CORE,0,[0,0,0]);}
{const g=new THREE.CylinderGeometry(RT,RT*0.78,2.2,3);g.translate(0,16.1,0);M(g,C.CONC,1.2,[0,0,0]);}
{const g=new THREE.CylinderGeometry(RT*.975,RT*.975,6,3,1,true);g.translate(0,20.1,0);M(g,C.GLASS,1.9,[0,0,0]);}
{const g=new THREE.CylinderGeometry(RT,RT,1.8,3);g.translate(0,24.1,0);M(g,C.CONC,2.6,[0,0,0]);}
// caixilhos da faixa de vidro
for(let k=0;k<3;k++){
  const a=polar(RT*.975,k*2*PI/3,0),b=polar(RT*.975,(k+1)*2*PI/3,0),L=a.distanceTo(b),n=Math.floor(L/2.5);
  for(let i=0;i<n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;B(V(x,17.2,z),V(x,23,z),C.GLASS,null,{stage:1.9});}
}
// núcleo (elevadores) acima da base, fatiado por módulo
for(const [y0,y1] of [[25,50],[50,65],[65,75],[75,88]]){const g=new THREE.BoxGeometry(3.4,y1-y0,3.4);g.translate(0,(y0+y1)/2,0);M(g,C.CORE,stageOf((y0+y1)/2),[0,0,0]);}
// mirante (75 m) e anel superior
{const g=new THREE.CylinderGeometry(7,3,3.5,6);g.translate(0,73.25,0);M(g,C.CONC,stageOf(75.5),[0,0,0]);}
{const g=new THREE.CylinderGeometry(7.2,7.2,.8,6);g.translate(0,75.4,0);M(g,C.CONC,stageOf(75.5),[0,0,0]);}
for(let i=0;i<24;i++){const a=i/24*2*PI;B(polar(7.1,a,75.8),polar(7.1,a,77.1),C.RING,null,{stage:stageOf(75.5)});}
for(let k=0;k<6;k++)B(polar(7.2,k*PI/3,77.1),polar(7.2,(k+1)*PI/3,77.1),C.RING,null,{stage:stageOf(75.5)});
{const g=new THREE.CylinderGeometry(4.2,2.2,2.5,6);g.translate(0,86.75,0);M(g,C.CONC,stageOf(86),[0,0,0]);}
{const g=new THREE.CylinderGeometry(4.4,4.4,.6,6);g.translate(0,88.3,0);M(g,C.CONC,stageOf(86),[0,0,0]);}

// --- trecho I: pirâmide hexagonal 25→147 m
const L1=[25,37.5,50,57.5,65,75,82.5,90,100,107.5,115,125,135,147];
for(let j=0;j<L1.length-1;j++){const y0=L1[j],y1=L1[j+1];
  for(let k=0;k<6;k++){const fn=dirA((k+.5)*PI/3,1.8),vn=dirA(k*PI/3,1.8);
    B(hv(k,y0),hv(k,y1),C.LEG,vn);B(hv(k,y0),hv(k+1,y1),C.BRACE,fn);B(hv(k+1,y0),hv(k,y1),C.BRACE,fn);}}
for(const y of L1)for(let k=0;k<6;k++)B(hv(k,y),hv(k+1,y),C.RING,dirA((k+.5)*PI/3,1.8),{stage:stageOf(Math.min(y+.01,146.9))});
for(const y of [25,50,65,75,90,100,115,125,135,147])for(let k=0;k<6;k++){const a=k*PI/3;B(hv(k,y),polar(y<=88?2.4:1.15,a,y),C.STRUT,dirA(a,.9),{stage:stageOf(Math.min(y+.01,146.9))});}
// mastro interno 88→147
{const n=24;for(let i=0;i<n;i++){const y0=88+59*i/n,y1=88+59*(i+1)/n;for(let k=0;k<4;k++){B(sv(k,y0,.8),sv(k,y1,.8),C.MAST,null);B(sv(k,y1,.8),sv(k+1,y1,.8),C.MAST,null);B(sv(k+(i%2),y0,.8),sv(k+1-(i%2),y1,.8),C.MAST,null);}}}
// braços (espinha de peixe) que seguram as antenas
for(let y=92;y<=145;y+=4.5)for(let k=0;k<6;k++){const a=(k+.5)*PI/3;B(polar(1.0,a,y),polar(hexR(y)*Math.cos(PI/6)*.96,a,y),C.ARM,dirA(a,2.2));}
// transição hexágono → quadrado em 147
for(let k=0;k<6;k++){const a=k*PI/3;let best=0,bd=9;for(let c=0;c<4;c++){const ca=Math.atan2(SQ[c][0],SQ[c][1]);let d=Math.abs(Math.atan2(Math.sin(a-ca),Math.cos(a-ca)));if(d<bd){bd=d;best=c;}}B(hv(k,147),sv(best,147,1.5),C.STRUT,null,{stage:stageOf(146)});}
// --- trecho II: quadrado 147→192 (10 níveis de 3 m + 6 de 2,5 m)
const hw=y=>y<192?1.5-0.75*(y-147)/45:0.5;
const L2=[147];for(let i=0;i<10;i++)L2.push(150+3*i);for(let i=0;i<6;i++)L2.push(179.5+2.5*i);
for(let j=0;j<L2.length-1;j++){const y0=L2[j],y1=L2[j+1];for(let k=0;k<4;k++){
  B(sv(k,y0,hw(y0)),sv(k,y1,hw(y1)),C.LEG,sqCornN(k,1.2));
  B(sv(k,y0,hw(y0)),sv(k+1,y1,hw(y1)),C.BRACE,sqFaceN(k,1.2));B(sv(k+1,y0,hw(y0)),sv(k,y1,hw(y1)),C.BRACE,sqFaceN(k,1.2));
  B(sv(k,y1,hw(y1)),sv(k+1,y1,hw(y1)),C.RING,sqFaceN(k,1.2));}}
// --- trecho III: quadrado de 1 m, 192→217 (níveis de 1 m)
for(let y=192;y<217;y++){for(let k=0;k<4;k++){
  B(sv(k,y,.5),sv(k,y+1,.5),C.LEG,sqCornN(k,.8));B(sv(k,y+1,.5),sv(k+1,y+1,.5),C.RING,sqFaceN(k,.8));
  B(sv(k+(y%2),y,.5),sv(k+1-(y%2),y+1,.5),C.BRACE,sqFaceN(k,.8));}}
B(V(0,217,0),V(0,224,0),C.MAST,null);B(V(-.6,219,0),V(.6,219,0),C.MAST,null);B(V(0,221,-.5),V(0,221,.5),C.MAST,null);

/* --- antenas --- */
// TV 3.0: dois painéis com polarização cruzada (MIMO 2x2), faces 0 e 2, ~163–175 m (posição aproximada)
for(const k of [0,2]){const n=sqFaceN(k,1),t=[n[2],0,-n[0]];
  for(let i=0;i<5;i++){const y=164+i*2.4,r=hw(y)+.6,c=V(n[0]*r,y,n[2]*r);
    const P=(dt,dy)=>V(c.x+t[0]*dt,c.y+dy,c.z+t[2]*dt);
    B(P(-.45,-1.1),P(.45,-1.1),C.TV,n.map(v=>v*3),{emit:1});B(P(-.45,-1.1),P(-.45,1.1),C.TV,n.map(v=>v*3),{emit:1});B(P(.45,-1.1),P(.45,1.1),C.TV,n.map(v=>v*3),{emit:1});
    B(P(-.35,-.35),P(.35,.35),C.TV,n.map(v=>v*3),{emit:1});B(P(-.35,.35),P(.35,-.35),C.TV,n.map(v=>v*3),{emit:1});
    B(V(n[0]*hw(y),y,n[2]*hw(y)),c,C.TV,n.map(v=>v*3),{emit:1});}}
// FM: dipolos nas faces do trecho superior
for(let y=150;y<=212;y+=4.5)for(let k=0;k<4;k++){if(y>161&&y<177&&(k===0||k===2))continue;
  const n=sqFaceN(k,1),t=[n[2],0,-n[0]],r=hw(y)+.45,m=V(n[0]*r,y,n[2]*r);
  B(V(m.x-t[0]*.7,y,m.z-t[2]*.7),V(m.x+t[0]*.7,y,m.z+t[2]*.7),C.FM,n.map(v=>v*3),{emit:0});
  B(V(n[0]*hw(y),y,n[2]*hw(y)),m,C.FM,n.map(v=>v*3),{emit:0});B(m,V(m.x,y+.5,m.z),C.FM,n.map(v=>v*3),{emit:0});}
// Celular: painéis setoriais (0°,120°,240°) em 95 e 120 m
for(const y of [95,120])for(let s=0;s<3;s++){const a=s*2*PI/3,r=hexR(y)*Math.cos(PI/6)+.35,t=[Math.cos(a),0,-Math.sin(a)];
  for(const off of [-.9,0,.9]){const c=polar(r,a,y),x=c.x+t[0]*off,z=c.z+t[2]*off,w=.18;
    B(V(x-t[0]*w,y-1,z-t[2]*w),V(x-t[0]*w,y+1,z-t[2]*w),C.CEL,dirA(a,3),{emit:2});B(V(x+t[0]*w,y-1,z+t[2]*w),V(x+t[0]*w,y+1,z+t[2]*w),C.CEL,dirA(a,3),{emit:2});
    B(V(x-t[0]*w,y+1,z-t[2]*w),V(x+t[0]*w,y+1,z+t[2]*w),C.CEL,dirA(a,3),{emit:2});B(V(x-t[0]*w,y-1,z-t[2]*w),V(x+t[0]*w,y-1,z+t[2]*w),C.CEL,dirA(a,3),{emit:2});}}
// Micro-ondas: parabólicas
const DISH=[{y:105,az:15,r:1.0},{y:112,az:80,r:.8},{y:120,az:150,r:1.2},{y:128,az:210,r:.7},{y:134,az:300,r:.9}];
DISH.forEach((d,j)=>{const a=d.az*PI/180,c=polar(hexR(d.y)*.92+.7,a,d.y),u=[Math.cos(a),0,-Math.sin(a)],rad=dirA(a,4);d.c=c;d.a=a;d.rad=rad;
  const P=(t)=>V(c.x+u[0]*Math.cos(t)*d.r,c.y+Math.sin(t)*d.r,c.z+u[2]*Math.cos(t)*d.r);
  for(let i=0;i<20;i++)B(P(i/20*2*PI),P((i+1)/20*2*PI),C.MW,rad,{emit:3+j});
  B(P(0),P(PI),C.MW,rad,{emit:3+j});B(P(PI/2),P(-PI/2),C.MW,rad,{emit:3+j});
  B(c,polar(hexR(d.y)*.9,a,d.y),C.MW,rad,{emit:3+j});});
// balizamento aéreo
extra.push({p:V(0,224.4,0),cat:C.BEACON,stage:stageOf(223)});
for(let k=0;k<4;k++)extra.push({p:sv(k,192.2,.8),cat:C.BEACON,stage:stageOf(191)});
for(const y of [147.3,100.3,50.3])for(let k=0;k<6;k++)extra.push({p:hv(k,y),cat:C.BEACON,stage:stageOf(y-1)});

/* ================= EMISSORES ================= */
const LAYERS={fm:[0],tv:[1],cel:[2],mw:[3,4,5,6,7]};
const E=[
 {type:0,base:V(0,190,0),stage:stageOf(190),rad:[0,0,0],col:[1,.6,.2],lam:30,az:0,el:0},
 {type:1,base:V(0,170,0),stage:stageOf(170),rad:[0,0,0],col:[1,.25,.85],lam:16,az:0,el:0},
 {type:2,base:V(0,107,0),stage:stageOf(107),rad:[0,0,0],col:[.3,1,.5],lam:9,az:0,el:0}
];
DISH.forEach(d=>E.push({type:3,base:d.c,stage:stageOf(d.y),rad:d.rad,col:[.55,.85,1],lam:5,az:d.a,el:.008}));
const layerOn={fm:true,tv:true,cel:true,mw:true},layerGain={fm:1,tv:1,cel:1,mw:1};

const NE=8;
const FIELD=`
#define NE ${NE}
#define PI 3.14159265
uniform vec3 uEP[NE];uniform vec3 uEC[NE];uniform vec4 uEA[NE];uniform float uEL[NE];
uniform float uT,uC,uLam,uAudio,uRange,uFMdev;
float h11(float n){return fract(sin(n*127.1+.31)*43758.5453);}
vec3 emitterField(int i,vec3 p,float seed,bool usePat){
  vec4 a=uEA[i]; if(a.y<=.001) return vec3(0.);
  vec3 d=p-uEP[i]; float r=max(length(d),.5); vec3 n=d/r;
  float el=asin(clamp(n.y,-1.,1.)), az=atan(n.x,n.z);
  float lam=uEL[i]*uLam, tr=uT-r/uC, u=(r-uC*uT)/lam;
  float pat=1., s=0.; int ty=int(a.x+.5);
  if(ty==0){ pat=pow(max(cos(el+.03),0.),8.);
    u+=uFMdev*(.6+uAudio*3.)*sin(6.2832*.22*tr); s=pow(.5+.5*cos(6.2832*u),5.); }
  else if(ty==1){ pat=pow(max(cos(el+.05),0.),5.);
    float g=step(.25,fract(tr*.8)); s=pow(.5+.5*cos(6.2832*u),6.)*g*(.3+1.*h11(seed*13.+floor(uT*9.))); }
  else if(ty==2){ float da=mod(az-a.z+PI/3.,2.*PI/3.)-PI/3.;
    pat=exp(-da*da/.22)*exp(-pow(el+.1,2.)/.025);
    float g=step(fract(tr*1.3),.45); s=pow(.5+.5*cos(6.2832*u),5.)*g; }
  else { vec3 b=vec3(sin(a.z)*cos(a.w),sin(a.w),cos(a.z)*cos(a.w)); float c=dot(n,b);
    pat=exp(-(1.-c)/.0006); float k=floor(u); s=step(.45,fract(u))*step(.3,h11(k+float(i)*7.)); }
  if(!usePat) pat=1.;
  float att = ty==3 ? 1./(1.+r/(uRange*2.5)) : 1./(1.+r*r/(uRange*uRange));
  return uEC[i]*a.y*pat*att*s;
}
vec3 totalField(vec3 p,float seed){vec3 c=vec3(0.);for(int i=0;i<NE;i++)c+=emitterField(i,p,seed,true);return c;}
`;
const STRUCT_VS=`
${FIELD}
attribute vec3 aRad; attribute float aStage,aCat,aSeed,aEmit;
uniform float uExplode,uVGap,uRGap,uSway,uSize,uPx,uInduced,uFeed,uBeacon,uBright;
uniform vec3 uCat[16];
varying vec3 vCol;
void main(){
  vec3 p=position+(vec3(0.,aStage*uVGap,0.)+aRad*uRGap)*uExplode;
  float h=clamp(position.y/224.,0.,1.), sw=uSway*h*h;
  p.x+=sw*sin(6.2832*.35*uT); p.z+=sw*.55*sin(6.2832*.36*uT+1.3);
  int c=int(aCat+.5);
  vec3 col=uCat[c]*uBright;
  float sz=uSize;
  if(c!=14){
    col+=totalField(p,aSeed)*uInduced;
    if(aEmit>-.5){int e=int(aEmit+.5); col+=emitterField(e,uEP[e]+vec3(0.,.6,0.),aSeed,false)*2.4;}
    float fy=mod(uT*38.,300.)-30.;
    float fw=(c==13||c==6||c==2||c==0)?1.:.3;
    col+=vec3(1.,.85,.6)*exp(-pow(position.y-fy,2.)/50.)*uFeed*fw;
  }
  if(c==12){ float fl=step(fract(uT*.667),.16); col=vec3(1.,.07,.04)*(.2+3.5*fl)*uBeacon; sz*=5.*uBeacon; }
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
#ifdef PTS
  float lum=dot(col,vec3(.3,.5,.2));
  gl_PointSize=min(sz*uPx*(300./-mv.z)*(.75+min(lum,2.)*.55), (c==12?40.:9.)*uPx);
#endif
  vCol=col;
}`;
const PTS_FS=`varying vec3 vCol;void main(){vec2 q=gl_PointCoord-.5;float d=length(q);if(d>.5)discard;float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vCol*a,1.);}`;
export {beams,meshes,extra,E,C,stageOf,LAYERS,FIELD,STRUCT_VS,PTS_FS,NE};
