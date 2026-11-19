/* =====================================================================
   RAIOS NAS MÃOS — camada de gestos sobre o Ceraunoscópio
   A câmera lê as mãos (MediaPipe Hand Landmarker, roda só no aparelho)
   e cada gesto chama um tipo de relâmpago no ponto para onde a mão aponta.
   Usa direto as funções do motor: fire, injectM, clearAll, V3, P, FL, cw, ch…
   ===================================================================== */
'use strict';
(function () {
  const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15';
  const MODELO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
  const LIG = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  const PONTAS = [8, 12, 16, 20], JUNTAS = [6, 10, 14, 18];

  const video = document.getElementById('camv');
  const oc = document.getElementById('maoc'), octx = oc.getContext('2d');
  const pc = document.getElementById('camc'), pctx = pc.getContext('2d');
  const gEl = document.getElementById('gesto'), stEl = document.getElementById('camst'), guia = document.getElementById('guia');

  let det = null, ligado = false, vista = 2;          // vista: 2 = câmera + cursores, 1 = só cursores, 0 = nada
  let zoom = 1, ultimoTs = -1, tPrev = performance.now();
  window.MAOS_TRAVA = true;                            // câmera do céu fica parada para a mão mirar

  const COR = { pinca: '#ffd36b', punho: '#ff7a59', aberta: '#9fd0ff', v: '#c9a6ff', tres: '#7dffc4', chifre: '#ff9de0', aponta: '#e8ecff', outro: '#8f9bc8' };
  const NOME = { pinca: 'pinça', punho: 'punho', aberta: 'mão aberta', v: 'V', tres: 'três dedos', chifre: 'chifres', aponta: 'apontando', outro: '' };

  guia.textContent =
`GESTOS                              (G fecha)
golpe para baixo ........ nuvem-solo (aberta = ramificado)
golpe para cima ......... ascendente
golpe na diagonal ....... do céu azul
golpe para o lado ....... aberta = aranha · fechada = horizontal
pinça (segurar) ......... raio aceso · sacudir = pulsos
punho → abrir ........... positivo (carga longa = aranha+positivo)
V ....................... clarão na nuvem
três dedos .............. estroboscópio
chifres ................. em contas
palmas .................. muito perto
duas mãos abertas ....... volante: gira e dá zoom
dois punhos (1 s) ....... apaga tudo
altura da mão ........... alta = longe · baixa = perto`;

  /* ------------------------------------------------------------ avisos */
  let gT = 0;
  function aviso(t, ms = 1400) { gEl.textContent = t; gEl.style.opacity = 1; clearTimeout(gT); gT = setTimeout(() => { gEl.style.opacity = 0; }, ms); }
  function estado(t) { stEl.textContent = t; stEl.style.display = t ? 'block' : 'none'; }

  /* ------------------------------------------------------------ câmera + leitor */
  async function iniciar() {
    if (ligado) return; ligado = true;
    estado('ligando a câmera…');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 } }, audio: false });
      video.srcObject = s; await video.play().catch(() => {});
    } catch (e) { estado('Sem câmera (' + (e.message || e.name) + '). Dá para tocar com o mouse, o teclado e o MIDI.'); return; }
    estado('carregando o leitor de mãos…');
    try {
      const mod = await import(MP + '/vision_bundle.mjs');
      const vision = await mod.FilesetResolver.forVisionTasks(MP + '/wasm');
      const o = (d) => ({ baseOptions: { modelAssetPath: MODELO, delegate: d }, runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.55, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      try { det = await mod.HandLandmarker.createFromOptions(vision, o('GPU')); } catch (e) { det = await mod.HandLandmarker.createFromOptions(vision, o('CPU')); }
    } catch (e) { estado('Não consegui carregar o leitor de mãos (' + (e.message || e) + ').'); return; }
    estado(''); travar(true); aviso('mostre as mãos para a câmera', 2600);
    requestAnimationFrame(passo);
  }
  addEventListener('camera-trocada', (e) => { if (e.detail && e.detail.stream) { video.srcObject = e.detail.stream; video.play().catch(() => {}); } });
  document.getElementById('go').addEventListener('click', iniciar);

  /* ------------------------------------------------------------ vista travada */
  function distVista() { return clamp(FL * 0.9 * P.base / (0.7 * ch), 900, 40000); }
  function travar(snap) {
    if (SEQ) return;
    V3.goal = [0, P.base * 0.5, P.dist * 1000]; V3.gdist = distVista() * zoom;
    if (snap) { V3.t = V3.goal.slice(); V3.dist = V3.gdist; V3.yaw = 0; V3.pitch = 0.08; }
  }
  // ponto da tela (0–1) + profundidade relativa → posição no mundo, desfazendo a rotação da vista
  function pontoMundo(sx, dm) {
    const fl = FL * 0.9, dist = V3.dist, cY = Math.cos(V3.yaw), sY = Math.sin(V3.yaw);
    const z1 = dist * (dm - 1), x1 = (sx * cw - cw / 2) * (dist + z1) / fl;
    return { X: V3.t[0] + cY * x1 + sY * z1, Z: V3.t[2] - sY * x1 + cY * z1 };
  }
  const profund = (sy) => clamp(lerp(1.6, 0.6, (sy - 0.15) / 0.7), 0.6, 1.6);   // mão alta = longe

  function disparar(tipo, sx, sy, I, rotulo, dm) {
    dm = dm ?? profund(sy);
    let F;
    if (P.v3) { const p = pontoMundo(sx, dm); F = fire(tipo, { X: p.X, D: Math.max(0.3, p.Z / 1000), xs: sx, I }); }
    else F = fire(tipo, { xs: sx, D: P.dist * dm, I });
    if (F) aviso(rotulo + '  →  ' + TNAME[tipo]);
    return F;
  }
  function segurar(F) {
    if (!F) return;
    if (F.cc.length === 0 && F.strokes.length) { const S = F.strokes[F.strokes.length - 1]; F.cc.push({ t0: S.t + 2e-4, t1: S.t + 30, I: S.I, path: S.path, lev: 0.03 * A_of(S.I) + 0.012, seed: Math.random() * 99, held: true }); F.dur = Math.max(F.dur, 31); }
    else if (F.cc.length) { const c = F.cc[F.cc.length - 1]; c.t1 = Math.max(c.t1, c.t0 + 30); c.held = true; F.dur = Math.max(F.dur, c.t0 + 31); }
  }
  function soltar(F) {
    if (!F) return;
    const now = simT - F.t0;
    for (const c of F.cc) if (c.held) { c.t1 = Math.max(c.t0 + 0.01, Math.min(c.t1, now + 0.015)); c.held = false; }
    let end = 0; for (const c of F.cc) end = Math.max(end, c.t1); for (const s of F.strokes) end = Math.max(end, s.t);
    F.dur = Math.max(end + F.c.tLG * 4 + 0.05, Math.min(F.dur, end + 0.1));
  }

  /* ------------------------------------------------------------ rastreamento */
  const MAOS = [];   // mãos acompanhadas entre quadros
  let proxId = 1;
  const asp = () => (video.videoWidth || 16) / (video.videoHeight || 9);
  const telaAsp = () => innerWidth / Math.max(1, innerHeight);
  // câmera espelhada; o miolo da imagem cobre a tela inteira (não precisa esticar o braço até a borda)
  const paraTela = (x, y) => [clamp((1 - x - 0.1) / 0.8, 0, 1), clamp((y - 0.08) / 0.8, 0, 1)];

  function classificar(m, lm) {
    const a = asp(), d = (i, j) => Math.hypot((lm[i].x - lm[j].x) * a, lm[i].y - lm[j].y);
    const palma = Math.max(1e-3, d(0, 9));
    const ext = PONTAS.map((t, k) => d(t, 0) > d(JUNTAS[k], 0) * 1.12 && d(t, 0) / palma > 1.15);
    m.ext = ext; m.n = ext.filter(Boolean).length;
    const pd = d(4, 8) / palma, indLonge = d(8, 0) / palma > 0.95;
    if (m.pose === 'pinca') m.pin = pd < 0.45 && indLonge; else m.pin = pd < 0.28 && indLonge && !(ext[1] && ext[2] && ext[3] && pd > 0.2);
    let p;
    if (m.pin) p = 'pinca';
    else if (m.n === 0) p = 'punho';
    else if (m.n === 4) p = 'aberta';
    else if (ext[0] && ext[1] && !ext[2] && !ext[3]) p = 'v';
    else if (ext[0] && ext[1] && ext[2] && !ext[3]) p = 'tres';
    else if (ext[0] && !ext[1] && !ext[2] && ext[3]) p = 'chifre';
    else if (ext[0] && !ext[1] && !ext[2] && !ext[3]) p = 'aponta';
    else p = 'outro';
    return p;
  }

  function rastrear(t) {
    if (!det || video.readyState < 2) return;
    let ts = performance.now(); if (ts <= ultimoTs) ts = ultimoTs + 1; ultimoTs = ts;
    let r; try { r = det.detectForVideo(video, ts); } catch (e) { return; }
    const vistas = r.landmarks || [];
    for (const m of MAOS) m.vista = false;
    const usadas = new Set();
    for (const lm of vistas) {
      const c = paraTela(lm[9].x, lm[9].y);
      let melhor = null, dm = 0.3;
      for (const m of MAOS) { if (usadas.has(m)) continue; const dd = Math.hypot(m.cx - c[0], m.cy - c[1]); if (dd < dm) { dm = dd; melhor = m; } }
      if (!melhor) { melhor = { id: proxId++, lm, pts: [], cx: c[0], cy: c[1], hist: [], pose: 'outro', poseT: t, poseDisp: false, estavel: 'outro', carga: 0, solta: null, F: null, ultM: 0, cd: 0, perdida: 0 }; MAOS.push(melhor); }
      usadas.add(melhor); melhor.vista = true; melhor.perdida = 0; melhor.lm = lm;
      melhor.pts = lm.map((p) => paraTela(p.x, p.y));
      melhor.cx = c[0]; melhor.cy = c[1];
      const pin = paraTela((lm[4].x + lm[8].x) / 2, (lm[4].y + lm[8].y) / 2); melhor.px = pin[0]; melhor.py = pin[1];
      melhor.hist.push([t, c[0] * telaAsp(), c[1]]); while (melhor.hist.length > 2 && t - melhor.hist[0][0] > 0.15) melhor.hist.shift();
      const h = melhor.hist, h0 = h[0], h1 = h[h.length - 1], dtH = Math.max(1 / 60, h1[0] - h0[0]);
      melhor.vx = h.length > 1 ? (h1[1] - h0[1]) / dtH : 0; melhor.vy = h.length > 1 ? (h1[2] - h0[2]) / dtH : 0;
      melhor.vel = Math.hypot(melhor.vx, melhor.vy);
      const p = classificar(melhor, lm);
      if (p !== melhor.pose) { melhor.poseAnt = melhor.pose; melhor.pose = p; melhor.poseT = t; melhor.poseDisp = false; }
      if (t - melhor.poseT > 0.12) melhor.estavel = melhor.pose;
    }
    for (let i = MAOS.length - 1; i >= 0; i--) {
      const m = MAOS[i];
      if (!m.vista && ++m.perdida > 10) { if (m.F) { soltar(m.F); m.F = null; } MAOS.splice(i, 1); }
    }
  }

  /* ------------------------------------------------------------ gestos → raios */
  const VOL = { on: false, t: 0 };
  let punhosT = 0, palmasCd = 0, palmasD = [];

  function gestos(t, dt) {
    const vis = MAOS.filter((m) => m.vista);
    for (const m of vis) m.cd = Math.max(0, m.cd - dt);
    palmasCd = Math.max(0, palmasCd - dt);

    // ---- duas mãos
    if (vis.length === 2) {
      const [a, b] = vis[0].cx < vis[1].cx ? [vis[0], vis[1]] : [vis[1], vis[0]], A = telaAsp();
      const dx = (b.cx - a.cx) * A, dy = b.cy - a.cy, D = Math.hypot(dx, dy);
      palmasD.push([t, D]); while (palmasD.length > 2 && t - palmasD[0][0] > 0.15) palmasD.shift();
      const ap = palmasD.length > 1 ? (palmasD[0][1] - D) / Math.max(1 / 60, t - palmasD[0][0]) : 0;
      // palmas
      if (D < 0.2 && ap > 1.3 && palmasCd === 0) {
        palmasCd = 0.9; a.cd = b.cd = 0.6; VOL.on = false;
        disparar('perto', (a.cx + b.cx) / 2, (a.cy + b.cy) / 2, P.corrente * 1.6, 'palmas', 0.28);
      }
      // dois punhos = apagar
      if (a.pose === 'punho' && b.pose === 'punho') { punhosT += dt; if (punhosT > 1) { punhosT = -9; clearAll(); a.carga = b.carga = 0; a.solta = b.solta = null; aviso('céu limpo'); } }
      else punhosT = 0;
      // volante
      const abertas = a.n >= 3 && b.n >= 3 && a.pose !== 'pinca' && b.pose !== 'pinca';
      if (!VOL.on) {
        if (abertas && a.vel < 1.6 && b.vel < 1.6) { VOL.t += dt; if (VOL.t > 0.35 && D > 0.25) { VOL.on = true; VOL.ang0 = Math.atan2(dy, dx); VOL.yaw0 = V3.yaw; VOL.d0 = D; VOL.z0 = zoom; VOL.y0 = (a.cy + b.cy) / 2; VOL.p0 = V3.pitch; VOL.fora = 0; aviso('volante'); } }
        else VOL.t = 0;
      } else {
        VOL.fora = abertas ? 0 : VOL.fora + dt;
        if (VOL.fora > 0.25) { VOL.on = false; VOL.t = 0; }
        else {
          let da = Math.atan2(dy, dx) - VOL.ang0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
          V3.yaw = VOL.yaw0 - da * 1.6;
          V3.pitch = clamp(VOL.p0 + ((a.cy + b.cy) / 2 - VOL.y0) * 1.4, -0.6, 1.2);
          zoom = clamp(VOL.z0 * VOL.d0 / Math.max(0.05, D), 0.3, 3.5);
        }
      }
    } else { VOL.on = false; VOL.t = 0; punhosT = 0; palmasD = []; }

    // ---- cada mão
    for (const m of vis) {
      const outra = vis.find((o) => o !== m);

      // pinça: raio que fica aceso enquanto segura
      if (m.pose === 'pinca' && !VOL.on) {
        if (!m.F && m.cd === 0) {
          m.F = disparar('neg', m.px, m.py, P.corrente * 1.1, 'pinça');
          segurar(m.F); m.ultM = t;
        } else if (m.F && m.vel > 0.9 && t - m.ultM > 0.07) { injectM(m.F, clamp(m.vel / 3, 0.2, 1)); m.ultM = t; }
      } else if (m.F) { soltar(m.F); m.F = null; m.cd = 0.25; }

      // punho carrega, abrir solta
      if (m.pose === 'punho') { if (m.vel < 1.5) m.carga = Math.min(4, m.carga + dt); }
      else if (m.carga > 0 && (m.n >= 3 || t - m.poseT > 0.1)) { m.solta = { t, c: m.carga }; m.carga = 0; }
      if (m.solta) {
        if (t - m.solta.t > 0.4) m.solta = null;
        else if (m.n >= 3 && m.pose !== 'pinca' && m.solta.c > 0.35 && !VOL.on) {
          const c = m.solta.c; m.solta = null; m.cd = 0.5;
          disparar(c > 2.5 ? 'aranhapos' : 'pos', m.cx, m.cy, P.corrente * (1 + c * 0.8), 'punho aberto (' + c.toFixed(1) + ' s de carga)');
        }
      }

      if (VOL.on || m.pose === 'pinca' || m.F) continue;

      // golpes
      if (m.vel > 2.2 && m.cd === 0) {
        const ax = Math.abs(m.vx), ay = Math.abs(m.vy), I = P.corrente * clamp(m.vel / 2.6, 0.6, 3.5);
        const ab = m.estavel === 'aberta' || m.n >= 3;
        let tipo = null, rot = '';
        if (m.vy > 0 && ax < 0.5 * ay) { tipo = ab ? 'ram' : 'neg'; rot = 'golpe para baixo'; }
        else if (m.vy > 0 && ax <= 2 * ay) { tipo = 'azul'; rot = 'golpe na diagonal'; }
        else if (m.vy < 0 && ax < 0.7 * ay) { tipo = 'asc'; rot = 'golpe para cima'; }
        else {
          // mãos vindo uma contra a outra = palmas, não golpe lateral
          if (outra && Math.sign(outra.vx) !== Math.sign(m.vx) && Math.abs(outra.vx) > 1.0) continue;
          tipo = ab ? 'aranha' : 'horiz'; rot = 'golpe para o lado';
        }
        m.cd = 0.5; m.poseDisp = true;
        const sx = m.cx - (m.vx / telaAsp()) * 0.06;    // um pouco antes do fim do movimento
        disparar(tipo, clamp(sx, 0, 1), m.cy, I, rot);
        continue;
      }

      // posturas paradas
      if (!m.poseDisp && m.vel < 0.8 && m.cd === 0 && t - m.poseT > 0.22) {
        const T = { v: 'ic', tres: 'estrobo', chifre: 'contas' }[m.pose];
        if (T) { m.poseDisp = true; m.cd = 0.35; disparar(T, m.cx, m.cy, P.corrente, NOME[m.pose]); }
      }
    }
  }

  /* ------------------------------------------------------------ desenho */
  function desenhar(t) {
    const dpr = Math.min(devicePixelRatio || 1, 1.5), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (oc.width !== W || oc.height !== H) { oc.width = W; oc.height = H; }
    octx.clearRect(0, 0, W, H);
    if (vista >= 1) for (const m of MAOS) {
      if (!m.vista) continue;
      const cor = COR[m.pose] || '#fff', x = m.cx * W, y = m.cy * H, R = 22 * dpr;
      octx.globalAlpha = 0.55; octx.strokeStyle = cor; octx.lineWidth = 1.5 * dpr;
      octx.beginPath(); octx.arc(x, y, R, 0, Math.PI * 2); octx.stroke();
      // pontas dos dedos esticados
      octx.fillStyle = cor;
      PONTAS.forEach((p, k) => { if (m.ext && m.ext[k]) { const q = m.pts[p]; octx.globalAlpha = 0.45; octx.beginPath(); octx.arc(q[0] * W, q[1] * H, 3 * dpr, 0, Math.PI * 2); octx.fill(); } });
      if (m.pose === 'pinca') { octx.globalAlpha = 0.9; octx.beginPath(); octx.arc(m.px * W, m.py * H, 6 * dpr, 0, Math.PI * 2); octx.fill(); }
      if (m.carga > 0) {   // anel de carga do punho
        octx.globalAlpha = 0.85; octx.lineWidth = 3 * dpr; octx.strokeStyle = m.carga > 2.5 ? '#ffe2a8' : '#ff7a59';
        octx.beginPath(); octx.arc(x, y, R + 7 * dpr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, m.carga / 2.5)); octx.stroke();
      }
      if (NOME[m.pose]) { octx.globalAlpha = 0.6; octx.font = `${11 * dpr}px system-ui,sans-serif`; octx.textAlign = 'center'; octx.fillText(NOME[m.pose], x, y + R + 18 * dpr); }
    }
    if (VOL.on && vista >= 1) {
      const vis = MAOS.filter((m) => m.vista);
      if (vis.length === 2) { octx.globalAlpha = 0.35; octx.strokeStyle = '#9fd0ff'; octx.lineWidth = 1.5 * dpr; octx.setLineDash([6 * dpr, 6 * dpr]);
        octx.beginPath(); octx.moveTo(vis[0].cx * W, vis[0].cy * H); octx.lineTo(vis[1].cx * W, vis[1].cy * H); octx.stroke(); octx.setLineDash([]); }
    }
    octx.globalAlpha = 1;

    // miniatura da câmera com o esqueleto
    pc.classList.toggle('off', vista < 2 || !det);
    if (vista >= 2 && det && video.videoWidth) {
      const w = 220, h = Math.round(w * video.videoHeight / video.videoWidth);
      if (pc.width !== w * 2) { pc.width = w * 2; pc.height = h * 2; pc.style.height = h + 'px'; }
      const PW = pc.width, PH = pc.height;
      pctx.save(); pctx.translate(PW, 0); pctx.scale(-1, 1); pctx.globalAlpha = 0.7; pctx.drawImage(video, 0, 0, PW, PH); pctx.restore();
      pctx.strokeStyle = '#ffffff30'; pctx.strokeRect(PW * 0.1, PH * 0.08, PW * 0.8, PH * 0.8);   // área que cobre a tela
      for (const m of MAOS) {
        if (!m.vista) continue;
        const L = m.lm, X = (i) => (1 - L[i].x) * PW, Y = (i) => L[i].y * PH;
        pctx.strokeStyle = COR[m.pose] || '#fff'; pctx.lineWidth = 3; pctx.globalAlpha = 0.95;
        pctx.beginPath(); for (const [i, j] of LIG) { pctx.moveTo(X(i), Y(i)); pctx.lineTo(X(j), Y(j)); } pctx.stroke();
        pctx.fillStyle = '#fff'; for (let i = 0; i < 21; i++) { pctx.beginPath(); pctx.arc(X(i), Y(i), 2.5, 0, Math.PI * 2); pctx.fill(); }
      }
      pctx.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------ laço */
  function passo(now) {
    const t = now / 1000, dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now;
    rastrear(t);
    gestos(t, dt);
    if (window.MAOS_TRAVA && P.v3 && !V3.drag) travar(false);
    desenhar(t);
    requestAnimationFrame(passo);
  }

  window.__maos = { MAOS, disparar, pontoMundo, travar, gestos, VOL };

  /* ------------------------------------------------------------ teclas */
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' || e.target.tagName === 'SELECT') return;
    if (e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === 'v' && !e.shiftKey) { vista = (vista + 2) % 3; aviso(['sem câmera nem cursores', 'só os cursores', 'câmera e cursores'][vista], 1000); }
    else if (k === 'g') guia.style.display = guia.style.display === 'block' ? 'none' : 'block';
    else if (k === 'z') { zoom = 1; V3.yaw = 0; V3.pitch = 0.08; travar(false); aviso('vista de volta ao centro', 900); }
  });
})();
