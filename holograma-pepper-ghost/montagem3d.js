// Desenhos 3D interativos das montagens do holograma Pepper's Ghost (three.js r128)
(()=>{
const boxes=[...document.querySelectorAll('.v3d')];
if(!boxes.length)return;
if(!window.THREE){boxes.forEach(b=>{b.insertAdjacentHTML('beforeend','<div class="off">Os desenhos 3D precisam de internet para carregar.</div>');});return;}
const T=THREE, PI=Math.PI, SQ2=Math.SQRT2;

// ---------- icosaedro (mesma figura do app) ----------
const ICO=(()=>{const p=(1+Math.sqrt(5))/2,v=[];for(const a of[-1,1])for(const b of[-1,1])v.push([0,a,b*p],[a,b*p,0],[b*p,0,a]);
  const L=Math.hypot(1,p);v.forEach(q=>{q[0]/=L;q[1]/=L;q[2]/=L;});const e=[];
  for(let i=0;i<12;i++)for(let j=i+1;j<12;j++){const d=(v[i][0]-v[j][0])**2+(v[i][1]-v[j][1])**2+(v[i][2]-v[j][2])**2;if(Math.abs(d-4/(L*L))<.01)e.push([i,j]);}
  return{v,e};})();
const hueAt=t=>(t*18+190)%360;
function drawIco(x,cx,cy,r,t,ang,mir,text){
  x.save();x.translate(cx,cy);x.rotate(ang);if(mir)x.scale(-1,1);
  const ax=t*.5,ay=t*.7,ca=Math.cos(ay),sa=Math.sin(ay),cb=Math.cos(ax),sb=Math.sin(ax);
  const P=ICO.v.map(([a,b,c])=>{const x1=a*ca+c*sa,z1=-a*sa+c*ca;return[x1*r,(b*cb-z1*sb)*r];});
  const col=`hsl(${hueAt(t)},100%,62%)`;
  x.strokeStyle=col;x.lineWidth=Math.max(1.5,r/20);x.shadowColor=col;x.shadowBlur=r/3;x.lineCap='round';
  const oy=text?-r*.35:0;
  x.beginPath();ICO.e.forEach(([i,j])=>{x.moveTo(P[i][0],P[i][1]+oy);x.lineTo(P[j][0],P[j][1]+oy);});x.stroke();
  if(text){x.fillStyle=col;x.font=`800 ${r*.55}px system-ui,sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,0,r*1.05);}
  x.restore();
}

// ---------- texturas ----------
const GLOW=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.25,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c);})();
function screenTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const tex=new T.CanvasTexture(c);
  return{tex,redraw(t){x.fillStyle='#000';x.fillRect(0,0,w,h);draw(x,t);tex.needsUpdate=true;}};}
function label(txt,pos,h,color){
  const fs=54,pad=22,c=document.createElement('canvas'),m=c.getContext('2d');m.font=`600 ${fs}px system-ui,sans-serif`;
  c.width=Math.ceil(m.measureText(txt).width)+pad*2;c.height=fs+28;
  const x=c.getContext('2d');x.fillStyle='rgba(5,9,14,.78)';x.fillRect(0,0,c.width,c.height);x.strokeStyle='rgba(102,204,255,.45)';x.lineWidth=3;x.strokeRect(1.5,1.5,c.width-3,c.height-3);
  x.font=`600 ${fs}px system-ui,sans-serif`;x.fillStyle=color||'#dfeaf5';x.textBaseline='middle';x.fillText(txt,pad,c.height/2+2);
  const tex=new T.CanvasTexture(c);tex.minFilter=T.LinearFilter;
  const s=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:false,transparent:true}));
  s.scale.set(h*c.width/c.height,h,1);s.position.set(...pos);s.renderOrder=20;return s;
}

// ---------- materiais e peças ----------
const glassMat=()=>new T.MeshBasicMaterial({color:0x8fe8ff,transparent:true,opacity:.14,side:T.DoubleSide,depthWrite:false});
const edgeMat=new T.LineBasicMaterial({color:0x9feaff});
const bodyMat=new T.MeshLambertMaterial({color:0x26313d});
const blackMat=new T.MeshLambertMaterial({color:0x07090c,side:T.DoubleSide});
const V=a=>new T.Vector3(...a);
function quad(pts,mat){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...pts[0],...pts[1],...pts[2],...pts[0],...pts[2],...pts[3]],3));
  const grp=new T.Group();grp.add(new T.Mesh(g,mat));grp.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(pts.map(V)),edgeMat));return grp;
}
function plate(w,h,mat){const g=new T.Group();const pg=new T.PlaneGeometry(w,h);g.add(new T.Mesh(pg,mat));g.add(new T.LineSegments(new T.EdgesGeometry(pg),edgeMat));return g;}
function line(pts,dash){
  const g=new T.BufferGeometry().setFromPoints(pts.map(V));
  const m=dash?new T.LineDashedMaterial({color:0xffd34d,dashSize:dash,gapSize:dash*.7,transparent:true,opacity:.75}):new T.LineBasicMaterial({color:0xffd34d});
  const l=new T.Line(g,m);if(dash)l.computeLineDistances();return l;
}
function arrowHead(p,dir,s){const c=new T.Mesh(new T.ConeGeometry(s*.45,s*1.3,12),new T.MeshBasicMaterial({color:0xffd34d}));c.position.set(...p);c.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),V(dir).normalize());return c;}
function eye(p,s){const g=new T.Group();const w=new T.Mesh(new T.SphereGeometry(s,20,14),new T.MeshLambertMaterial({color:0xeef4fa}));const iris=new T.Mesh(new T.SphereGeometry(s*.45,16,10),new T.MeshBasicMaterial({color:0x1d6fa0}));iris.position.z=-s*.75;g.add(w,iris);g.position.set(...p);return g;}
function holo(r,flat){
  const g=new T.Group(),pos=[];ICO.e.forEach(([a,b])=>pos.push(...ICO.v[a],...ICO.v[b]));
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  const mat=new T.LineBasicMaterial({color:0x66ddff,transparent:true,blending:T.AdditiveBlending,depthWrite:false});
  const a=new T.LineSegments(geo,mat),b=new T.LineSegments(geo,mat);a.scale.setScalar(r);b.scale.setScalar(r*.5);
  const inner=new T.Group();inner.add(a,b);if(flat)inner.scale.z=flat;g.add(inner);
  const sp=new T.Sprite(new T.SpriteMaterial({map:GLOW,color:0x66ccff,transparent:true,opacity:.45,blending:T.AdditiveBlending,depthWrite:false}));sp.scale.setScalar(r*3.4);g.add(sp);
  g.userData.update=t=>{a.rotation.set(t*.5,t*.7,0);b.rotation.set(-t*.8,-t*.6,0);const c=new T.Color().setHSL(hueAt(t)/360,1,.62);mat.color.copy(c);sp.material.color.copy(c);};
  return g;
}

// ---------- cenas ----------
const BUILD={
  // Pirâmide de 4 lados sobre o celular (unidades: cm)
  pyramid(sc){
    const b=1,B=6,H=(B-b)/2,d=(b+B)/4;
    const body=new T.Mesh(new T.BoxGeometry(7.6,.8,15.2),bodyMat);body.position.y=-.41;sc.add(body);
    const scr=screenTex(280,560,(x,t)=>{const k=40;[[0,1,PI],[1,0,PI/2],[0,-1,0],[-1,0,-PI/2]].forEach(([dx,dy,a])=>drawIco(x,140+dx*d*k,280+dy*d*k,40,t,a,false));});
    const sm=new T.Mesh(new T.PlaneGeometry(7,14),new T.MeshBasicMaterial({map:scr.tex}));sm.rotation.x=-PI/2;sm.position.y=.01;sc.add(sm);
    const faces=[];
    for(let k=0;k<4;k++){const g=new T.Group();g.rotation.y=k*PI/2;const f=quad([[-b/2,0,b/2],[b/2,0,b/2],[B/2,H,B/2],[-B/2,H,B/2]],glassMat());g.add(f);sc.add(g);faces.push(f);}
    const h=holo(.95);h.position.set(0,H/2+.05,0);sc.add(h);
    const rays=new T.Group();sc.add(rays);
    const y=d-b/2;
    rays.add(line([[0,.02,d],[0,y,d],[0,y,9]]),arrowHead([0,y,9],[0,0,1],.35),line([[0,y,d],[0,y,b/2]],.25));
    rays.add(line([[d,.02,0],[d,y,0],[9,y,0]]),arrowHead([9,y,0],[1,0,0],.35),line([[d,y,0],[b/2,y,0]],.25));
    sc.add(eye([0,y,10],.45),eye([10,y,0],.45));
    const L=new T.Group();sc.add(L);
    const lh=label('imagem flutuando',[0,5,0],.8,'#66ddff');
    L.add(label('você',[0,y+1.3,10],.8),label('ou daqui',[10,y+1.3,0],.8),
          label('4 faces a 45°',[4.6,3.6,4.6],.8,'#9feaff'),lh,
          label('celular com o app',[-4.2,-.6,-8.2],.8,'#8fa3b5'));
    let e=0,eT=0;
    return{target:[0,1.1,0],st:{theta:.75,phi:.5,r:27,min:8,max:50},auto:'spin',screen:scr,holo:h,rays,labels:L,
      toggle:{explode(on){eT=on?1:0;}},
      update(t,dt){e+=(eT-e)*Math.min(1,dt*4);faces.forEach(f=>f.position.set(0,e*2.6,e*3.2));h.scale.setScalar(Math.max(.001,1-e));lh.visible=e<.5;rays.visible=rays.userData.on!==false&&e<.05;}};
  },

  // Caixa com placa única a 45° e tablet deitado (unidades: cm)
  plate(sc){
    const body=new T.Mesh(new T.BoxGeometry(25,.8,17),bodyMat);body.position.y=-.41;sc.add(body);
    const scr=screenTex(360,240,(x,t)=>drawIco(x,180,120,62,t,PI,true,'OLÁ'));
    const sm=new T.Mesh(new T.PlaneGeometry(24,16),new T.MeshBasicMaterial({map:scr.tex}));sm.rotation.x=-PI/2;sm.position.y=.01;sc.add(sm);
    // placa: borda baixa atrás (z=-8, y=.5), borda alta na frente (z=8, y=16.5)
    const p=plate(25.4,16*SQ2,glassMat());p.rotation.x=PI/4;p.position.set(0,8.5,0);sc.add(p);
    // sarrafos de apoio nas laterais
    const wood=new T.MeshLambertMaterial({color:0x8a6440});
    for(const sx of[-1,1]){const c=new T.Mesh(new T.BoxGeometry(.6,.6,16*SQ2),wood);c.rotation.x=-PI/4;c.position.set(sx*13.1,8.5-.35,.35);sc.add(c);}
    // caixa
    const walls=new T.Group();sc.add(walls);
    const wm=new T.MeshLambertMaterial({color:0x121a23,transparent:true,opacity:.6,side:T.DoubleSide,depthWrite:false});
    const floor=new T.Mesh(new T.PlaneGeometry(27.4,19.5),blackMat);floor.rotation.x=-PI/2;floor.position.set(0,-.85,-.5);walls.add(floor);
    const back=new T.Mesh(new T.PlaneGeometry(27.4,18.2),blackMat);back.position.set(0,8.25,-10.25);walls.add(back);
    for(const sx of[-1,1]){const w=plate(19.5,18.2,wm);w.rotation.y=PI/2;w.position.set(sx*13.7,8.25,-.5);walls.add(w);}
    const top=plate(27.4,19.5,new T.MeshLambertMaterial({color:0x121a23,transparent:true,opacity:.25,side:T.DoubleSide,depthWrite:false}));top.rotation.x=-PI/2;top.position.set(0,17.35,-.5);walls.add(top);
    const h=holo(4.3,.3);h.position.set(0,8.6,-8.5);sc.add(h);
    const rays=new T.Group();sc.add(rays);
    for(const z0 of[-2.5,3]){const y=z0+8.5;rays.add(line([[0,.02,z0],[0,y,z0],[0,y,30]]),arrowHead([0,y,30],[0,0,1],.8),line([[0,y,z0],[0,y,-8.5]],.6));}
    sc.add(eye([0,8.5,32],1));
    const L=new T.Group();sc.add(L);
    L.add(label('você',[0,11.3,32],1.8),label('placa a 45°: borda alta na frente',[0,20.3,9],1.6,'#9feaff'),
          label('imagem flutuando',[0,15.3,-8.5],1.6,'#66ddff'),label('fundo preto',[-9,3,-10.3],1.5,'#8fa3b5'),
          label('tablet deitado (Espelhar ligado)',[0,-3,12],1.8,'#8fa3b5'),label('apoio a 45°',[16.5,12,4],1.4,'#c9a27a'));
    return{target:[0,7.5,0],st:{theta:.85,phi:.28,r:66,min:25,max:120},auto:'swing',screen:scr,holo:h,rays,labels:L,
      toggle:{walls(on){walls.visible=on;}}};
  },

  // Palco com projetor, tecido no chão e película a 45° (unidades: dm)
  stage(sc){
    const fl=new T.Mesh(new T.PlaneGeometry(44,60),new T.MeshLambertMaterial({color:0x0b1016}));fl.rotation.x=-PI/2;fl.position.set(0,-.03,12);sc.add(fl);
    const scr=screenTex(320,200,(x,t)=>drawIco(x,160,100,54,t,PI,true,'OLÁ'));
    const sh=new T.Mesh(new T.PlaneGeometry(16,10),new T.MeshBasicMaterial({map:scr.tex}));sh.rotation.x=-PI/2;sh.position.y=.02;sc.add(sh);
    const mask=new T.Mesh(new T.BoxGeometry(21,2.2,.4),new T.MeshLambertMaterial({color:0x151c24}));mask.position.set(0,1.1,6);sc.add(mask);
    const f=plate(18,10*SQ2,glassMat());f.rotation.x=PI/4;f.position.set(0,5,0);sc.add(f);
    const pole=new T.MeshLambertMaterial({color:0x3a4652});
    for(const sx of[-1,1]){const pl=new T.Mesh(new T.BoxGeometry(.35,10.4,.35),pole);pl.position.set(sx*9.3,5.2,5);sc.add(pl);
      const st=new T.Mesh(new T.BoxGeometry(.3,.3,10*SQ2),pole);st.rotation.x=-PI/4;st.position.set(sx*9.3,5,0);sc.add(st);}
    const back=new T.Mesh(new T.PlaneGeometry(30,18),blackMat);back.position.set(0,9,-8);sc.add(back);
    // projetor pendurado na frente, apontando para o tecido
    const pj=new T.Group();const pb=new T.Mesh(new T.BoxGeometry(2.6,1.1,2.2),new T.MeshLambertMaterial({color:0xd9dee3}));pj.add(pb);
    const lens=new T.Mesh(new T.CylinderGeometry(.45,.45,.4,20),new T.MeshLambertMaterial({color:0x1a1f24}));lens.position.y=-.7;pj.add(lens);
    pj.position.set(0,19,16);pj.rotation.x=-.62;sc.add(pj);
    const ap=[0,18.4,15.4],cs=[[-8,.03,-5],[8,.03,-5],[8,.03,5],[-8,.03,5]],bp=[];
    for(let i=0;i<4;i++)bp.push(...ap,...cs[i],...cs[(i+1)%4]);
    const bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute(bp,3));
    sc.add(new T.Mesh(bg,new T.MeshBasicMaterial({color:0xbfe6ff,transparent:true,opacity:.07,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false})));
    const h=holo(3.1,.3);h.position.set(0,5,-5);sc.add(h);
    const rays=new T.Group();sc.add(rays);
    for(const z0 of[-1.5,2]){const y=z0+5;rays.add(line([[0,.04,z0],[0,y,z0],[0,y,34]]),arrowHead([0,y,34],[0,0,1],.9),line([[0,y,z0],[0,y,-5]],.6));}
    for(let i=0;i<5;i++){const e=eye([(i-2)*3.2,5.5,36+(i%2)*2],.9);sc.add(e);}
    const L=new T.Group();sc.add(L);
    L.add(label('plateia',[0,8.3,37],1.8),label('projetor',[0,21.6,16],1.6),label('película a 45°',[0,13.4,7],1.9,'#9feaff'),
          label('imagem flutuando',[0,10.5,-5],1.9,'#66ddff'),label('fundo preto',[-10,15,-8],1.8,'#8fa3b5'),
          label('tecido branco no chão',[13,1,-4],1.7,'#8fa3b5'),label('parede baixa esconde o tecido',[-9,3.6,8],1.7,'#8fa3b5'));
    return{target:[0,7,6],st:{theta:.95,phi:.3,r:72,min:30,max:140},auto:'swing',screen:scr,holo:h,rays,labels:L,toggle:{}};
  },
};

// ---------- montagem de cada visualizador ----------
const views=[];
function setup(el){
  const cv=el.querySelector('canvas');
  let R;try{R=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true});}catch(e){el.insertAdjacentHTML('beforeend','<div class="off">Seu navegador não conseguiu abrir o desenho 3D.</div>');return;}
  R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  const sc=new T.Scene(),cam=new T.PerspectiveCamera(38,1,.1,600);
  sc.add(new T.AmbientLight(0xffffff,.6));const dl=new T.DirectionalLight(0xffffff,.7);dl.position.set(6,12,9);sc.add(dl);
  const S=BUILD[el.dataset.scene](sc),st=S.st,tg=V(S.target);
  st.home=st.theta;st.dir=1;st.user=-1e9;
  const v={el,R,sc,cam,S,visible:false};
  function size(){const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
  new ResizeObserver(size).observe(cv);size();
  v.place=()=>{const c=Math.cos(st.phi);cam.position.set(tg.x+st.r*c*Math.sin(st.theta),tg.y+st.r*Math.sin(st.phi),tg.z+st.r*c*Math.cos(st.theta));cam.lookAt(tg);};
  // girar / zoom
  const pts=new Map();let lastD=0;const clamp=(a,b,c)=>Math.max(b,Math.min(c,a));
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);st.user=performance.now();});
  cv.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;const p=pts.get(e.pointerId),dx=e.clientX-p[0],dy=e.clientY-p[1];pts.set(e.pointerId,[e.clientX,e.clientY]);
    if(pts.size===1){st.theta-=dx*.009;st.phi=clamp(st.phi+dy*.008,-.15,1.45);}
    else if(pts.size===2){const a=[...pts.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(lastD)st.r=clamp(st.r*lastD/d,st.min,st.max);lastD=d;}
    st.user=performance.now();});
  const up=e=>{pts.delete(e.pointerId);lastD=0;};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();st.r=clamp(st.r*Math.exp(e.deltaY*.01),st.min,st.max);st.user=performance.now();},{passive:false});
  // botões
  el.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{
    const a=btn.dataset.act;st.user=performance.now();
    if(a==='zin')st.r=clamp(st.r/1.25,st.min,st.max);
    else if(a==='zout')st.r=clamp(st.r*1.25,st.min,st.max);
    else{btn.classList.toggle('on');const on=btn.classList.contains('on');
      if(a==='rays'){S.rays.userData.on=on;S.rays.visible=on;}
      else if(a==='explode'){btn.textContent=on?'Montar':'Desmontar';S.toggle.explode(on);}
      else if(S.toggle[a])S.toggle[a](on);}
  });
  new IntersectionObserver(es=>es.forEach(en=>v.visible=en.isIntersecting),{rootMargin:'120px'}).observe(el);
  views.push(v);
}
boxes.forEach(setup);

let t=0,last=performance.now();
function loop(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;
  for(const v of views){
    if(!v.visible)continue;const S=v.S,st=S.st;
    if(now-st.user>5000){
      if(S.auto==='spin')st.theta+=dt*.22;
      else{st.theta+=dt*.18*st.dir;if(st.theta>st.home+.9)st.dir=-1;if(st.theta<st.home-.9)st.dir=1;}
    }
    S.screen.redraw(t);S.holo.userData.update(t);if(S.update)S.update(t,dt);
    v.place();v.R.render(v.sc,v.cam);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
