// Vista 3D das Conjecturas — câmera em órbita e projeção em perspectiva desenhadas no mesmo canvas 2D da obra,
// então o som, os efeitos de vídeo (rastro, brilho, espelho) e o banco de configurações valem também para o 3D.
// A cena é descrita em unidades de mundo de mais ou menos −1 a 1 (y para cima). Uso:
//   const T = Vista3D({ ligado: true, giro: 0.12, incl: 20 });
//   if (T.on){ T.quadro(); C.beginPath(); T.mv(C, x, y, z); T.ln(C, x2, y2, z2); C.stroke(); }
// Controles: arrastar = girar, pinça/roda = aproximar, dois toques = recentrar, tecla D = liga/desliga.
window.Vista3D = function(opt = {}){
  const $ = id => document.getElementById(id);
  const cv = opt.canvas || $('cv');
  const DEF = Object.assign({ ligado: true, giro: 0.12, incl: 22, zoom: 1, persp: 0.45, nevoa: 0.35, grade: true, yaw: 0.5 }, opt);
  const T = { on: DEF.ligado, giro: DEF.giro, incl: DEF.incl, zoom: DEF.zoom, persp: DEF.persp, nevoa: DEF.nevoa, grade: DEF.grade,
    X: 0, Y: 0, S: 1, A: 1, Z: 0, R: 300, W: 0, H: 0, cx: 0, cy: 0, ouvintes: [] };
  let yaw = DEF.yaw, dPitch = 0, zMul = 1, last = 0, cy = 1, sy = 0, cp = 1, sp = 0, D = 4, F = 1, ox = 0, oy = 0;

  // ---------- painel: uma seção "Vista 3D" logo antes dos efeitos de vídeo (ou da seção Imagem) ----------
  const panel = $('panel');
  if (panel && !$('v3d')){
    const box = document.createElement('div'); box.id = 'vista3dBox';
    box.innerHTML = `<h2>Vista 3D</h2>
      <div class="row"><label>3D (tecla D)</label><input type="checkbox" id="v3d"${T.on ? ' checked' : ''}></div>
      <div class="row"><label>Giro automático</label><input type="range" id="v3dGiro" min="-1" max="1" step="0.01" value="${T.giro}"></div>
      <div class="row"><label>Inclinação</label><input type="range" id="v3dIncl" min="-15" max="85" step="1" value="${T.incl}"></div>
      <div class="row"><label>Aproximar</label><input type="range" id="v3dZoom" min="0.4" max="3" step="0.01" value="${T.zoom}"></div>
      <div class="row"><label>Perspectiva</label><input type="range" id="v3dPersp" min="0" max="1" step="0.01" value="${T.persp}"></div>
      <div class="row"><label>Névoa ao fundo</label><input type="range" id="v3dNev" min="0" max="1" step="0.01" value="${T.nevoa}"></div>
      <div class="row"><label>Grade do chão</label><input type="checkbox" id="v3dGrade"${T.grade ? ' checked' : ''}></div>
      <div class="row"><button id="v3dCentro" type="button">Recentrar câmera</button></div>`;
    const antes = opt.antes ? $(opt.antes) : ($('nucleoVideo') || [...panel.querySelectorAll('h2')].find(h => /imagem|v[ií]deo/i.test(h.textContent)) || panel.querySelector('.hint'));
    if (antes && antes.parentNode) antes.parentNode.insertBefore(box, antes); else panel.appendChild(box);
    const ler = () => {
      T.on = $('v3d').checked; T.giro = +$('v3dGiro').value; T.incl = +$('v3dIncl').value; T.zoom = +$('v3dZoom').value;
      T.persp = +$('v3dPersp').value; T.nevoa = +$('v3dNev').value; T.grade = $('v3dGrade').checked;
      document.body.classList.toggle('em3d', T.on); const b = $('b3d'); if (b) b.classList.toggle('on', T.on);
      for (const fn of T.ouvintes) fn(T.on);
    };
    box.addEventListener('input', ler); box.addEventListener('change', ler);
    $('v3dCentro').addEventListener('click', () => T.recentrar());
    T.ler = ler;
  }
  // botão rápido "3D" ao lado do ponto do painel
  if (!$('b3d')){
    const st = document.createElement('style');
    st.textContent = `#b3d{position:fixed;right:50px;top:16px;height:26px;padding:0 9px;border-radius:13px;z-index:4;border:1px solid rgba(255,255,255,.25);
      background:rgba(0,0,0,.35);color:#cfd6dd;font:500 10.5px/24px -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;letter-spacing:.12em;cursor:pointer;opacity:.28;transition:opacity .4s}
      #b3d:hover{opacity:.8} #b3d.on{opacity:.55;border-color:rgba(191,228,255,.7);color:#e8f4ff} body.em3d #cv{cursor:grab} body.em3d #cv:active{cursor:grabbing}`;
    document.head.appendChild(st);
    const b = document.createElement('button'); b.id = 'b3d'; b.type = 'button'; b.title = 'Vista 3D (D)'; b.textContent = '3D';
    b.classList.toggle('on', T.on); document.body.appendChild(b);
    b.addEventListener('click', e => { e.stopPropagation(); T.alternar(); });
  }
  document.body.classList.toggle('em3d', T.on);
  T.alternar = () => { const c = $('v3d'); if (c){ c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); } else { T.on = !T.on; for (const fn of T.ouvintes) fn(T.on); } };
  T.recentrar = () => { yaw = DEF.yaw; dPitch = 0; zMul = 1; };
  T.mudou = fn => T.ouvintes.push(fn);
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (e.target.tagName === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'd' || e.key === 'D'){ e.preventDefault(); T.alternar(); }
  });

  // ---------- arrastar, pinça, roda, dois toques ----------
  const pts = new Map(); let pinch0 = 0, zoom0 = 1, tapT = 0;
  cv.addEventListener('pointerdown', e => {
    if (!T.on) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    if (pts.size === 2){ const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = zMul; }
    const agora = performance.now(); if (agora - tapT < 300 && pts.size === 1) T.recentrar(); tapT = agora;
  });
  cv.addEventListener('pointermove', e => {
    if (!T.on || !pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1){ yaw += dx*0.008; dPitch = Math.max(-80, Math.min(80, dPitch + dy*0.35)); }
    else if (pts.size === 2 && pinch0 > 0){ const [a, b] = [...pts.values()]; zMul = Math.max(0.25, Math.min(6, zoom0*Math.hypot(a.x - b.x, a.y - b.y)/pinch0)); }
  });
  const solta = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  cv.addEventListener('pointerup', solta); cv.addEventListener('pointercancel', solta);
  cv.addEventListener('wheel', e => { if (!T.on) return; e.preventDefault(); zMul = Math.max(0.25, Math.min(6, zMul*Math.exp(-e.deltaY*0.0012))); }, { passive: false });
  cv.style.touchAction = 'none';

  // ---------- câmera ----------
  // chamar uma vez por quadro, antes de desenhar; dt em segundos (opcional)
  T.quadro = (W = innerWidth, H = innerHeight, dt) => {
    const agora = performance.now()/1000;
    if (dt === undefined) dt = Math.min(0.1, last ? agora - last : 0); last = agora;
    if (!pts.size) yaw += dt*T.giro*0.6;
    const pitch = Math.max(-89, Math.min(89, T.incl + dPitch))*Math.PI/180;
    cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch);
    const fov = (12 + T.persp*68)*Math.PI/180; D = 1.25/Math.tan(fov/2);
    T.W = W; T.H = H; T.cx = W/2 + ox; T.cy = H/2 + oy;
    T.R = Math.min(W, H)*0.42*T.zoom*zMul; F = T.R*D;
    T.yaw = yaw; T.pitch = pitch; T.D = D;
    return T;
  };
  // desloca o centro da tela (por exemplo, para deixar espaço para o texto)
  T.centro = (dx = 0, dy = 0) => { ox = dx; oy = dy; };
  // projeta (x, y, z): grava T.X, T.Y (pixels), T.S (escala: 1 = na origem), T.A (névoa 0–1), T.Z (profundidade); false se atrás da câmera
  T.p = (x, y, z) => {
    const x1 = cy*x + sy*z, z1 = -sy*x + cy*z;
    const y2 = cp*y - sp*z1, z2 = sp*y + cp*z1;
    const zc = D - z2;
    if (zc < 0.08) return false;
    const k = F/zc;
    T.X = T.cx + x1*k; T.Y = T.cy - y2*k; T.S = D/zc; T.Z = zc;
    T.A = T.nevoa > 0 ? Math.exp(-T.nevoa*1.1*Math.max(0, zc - D + 1)) : 1;
    return true;
  };
  // caminhos: mv = moveTo, ln = lineTo (pulando o que fica atrás da câmera)
  let tem = false;
  T.mv = (C, x, y, z) => { tem = T.p(x, y, z); if (tem) C.moveTo(T.X, T.Y); return tem; };
  T.ln = (C, x, y, z) => { const ok = T.p(x, y, z); if (ok){ tem ? C.lineTo(T.X, T.Y) : C.moveTo(T.X, T.Y); } tem = ok; return ok; };
  // ponto redondo com raio r (em pixels na origem), com névoa
  T.ponto = (C, x, y, z, r, cor, alfa = 1) => {
    if (!T.p(x, y, z)) return false;
    const rr = Math.max(0.4, r*T.S), a = alfa*T.A; if (a < 0.01) return true;
    C.globalAlpha = Math.min(1, a); if (cor) C.fillStyle = cor;
    if (rr < 1.6) C.fillRect(T.X - rr, T.Y - rr, rr*2, rr*2);
    else { C.beginPath(); C.arc(T.X, T.Y, rr, 0, Math.PI*2); C.fill(); }
    C.globalAlpha = 1; return true;
  };
  // brilho redondo (gradiente) — para estrelas, cabeças, clarões
  T.brilho = (C, x, y, z, r, cor, alfa = 1) => {
    if (!T.p(x, y, z)) return false;
    const rr = Math.max(1, r*T.S), a = Math.min(1, alfa*T.A); if (a < 0.01) return true;
    const g = C.createRadialGradient(T.X, T.Y, 0, T.X, T.Y, rr);
    g.addColorStop(0, cor); g.addColorStop(1, 'rgba(0,0,0,0)');
    C.globalAlpha = a; C.fillStyle = g; C.beginPath(); C.arc(T.X, T.Y, rr, 0, Math.PI*2); C.fill(); C.globalAlpha = 1; return true;
  };
  // segmento com névoa
  T.seg = (C, x1, y1, z1, x2, y2, z2, alfa = 1) => {
    if (!T.p(x1, y1, z1)) return; const ax = T.X, ay = T.Y, aa = T.A;
    if (!T.p(x2, y2, z2)) return;
    C.globalAlpha = Math.min(1, alfa*(aa + T.A)/2); C.beginPath(); C.moveTo(ax, ay); C.lineTo(T.X, T.Y); C.stroke(); C.globalAlpha = 1;
  };
  // linha por vários pontos [x, y, z, x, y, z, ...], em trechos com a névoa de cada trecho
  T.poli = (C, a, alfa = 1, trecho = 12) => {
    const n = a.length/3 | 0; if (n < 2) return;
    for (let i = 0; i < n - 1; i += trecho){
      const f = Math.min(n - 1, i + trecho), m = (i + f) >> 1;
      T.p(a[m*3], a[m*3 + 1], a[m*3 + 2]); const al = Math.min(1, alfa*T.A); if (al < 0.01) continue;
      C.globalAlpha = al; C.beginPath(); tem = false;
      for (let j = i; j <= f; j++) T.ln(C, a[j*3], a[j*3 + 1], a[j*3 + 2]);
      C.stroke();
    }
    C.globalAlpha = 1;
  };
  // círculo no espaço: centro, raio, eixo 'y' (deitado), 'z' (de pé, de frente) ou 'x'
  T.circulo = (C, x, y, z, r, eixo = 'y', n = 48, a0 = 0, a1 = Math.PI*2) => {
    tem = false;
    for (let i = 0; i <= n; i++){
      const a = a0 + (a1 - a0)*i/n, c = Math.cos(a)*r, s = Math.sin(a)*r;
      if (eixo === 'y') T.ln(C, x + c, y, z + s); else if (eixo === 'z') T.ln(C, x + c, y + s, z); else T.ln(C, x, y + c, z + s);
    }
  };
  // grade do chão (y = nivel) e eixo, para dar referência de espaço
  T.chao = (C, nivel = -1, tam = 1.2, div = 8, cor = 'rgba(150,190,230,1)', alfa = 0.07) => {
    if (!T.grade) return;
    C.save(); C.strokeStyle = cor; C.lineWidth = 1;
    for (let i = 0; i <= div; i++){
      const u = -tam + 2*tam*i/div;
      T.seg(C, u, nivel, -tam, u, nivel, tam, alfa); T.seg(C, -tam, nivel, u, tam, nivel, u, alfa);
    }
    C.restore();
  };
  T.ler && T.ler();
  return T;
};
