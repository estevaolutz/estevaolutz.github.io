// ---------- núcleo v2 das conjecturas ----------
// Som: desde nov/2026 é o Motor Knick (lib/motor-knick.js, embutido pelo build2.py) com o painel simplificado.
// Motor de som do Cometa de Goldbach / Recamán (um canal por elemento com volume e envios para reverb Valhalla, delay,
// pitch delay e bit crusher; filtro, saturação e largura na saída), timbres e ADSR do Corredor Solitário, efeitos de
// vídeo (brilho, contraste, saturação, matiz, brilho difuso, desfoque, rastro com zoom e giro, inverter, espelho) e o
// painel padrão montado automaticamente. Cada obra só descreve os seus elementos e desenha.
const $ = id => document.getElementById(id);
function Nucleo(cfg){
  cfg = cfg || {};
  const EL = (cfg.elementos || []).map(e => Object.assign({ vol: 1, V: 0.5, D: 0.2, P: 0, B: 0, timbre: 'sino' }, e));
  const P = {};

  // ---------- painel padrão ----------
  const rg = (id, lab, min, max, step, v) => `<div class="row"><label for="${id}">${lab}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
  const sl = (id, lab, opts, v) => `<div class="row"><label for="${id}">${lab}</label><select id="${id}">${opts.map(([a, b]) => `<option value="${a}"${String(a) === String(v) ? ' selected' : ''}>${b}</option>`).join('')}</select></div>`;
  const ck = (id, lab, v) => `<div class="row"><label for="${id}">${lab}</label><input type="checkbox" id="${id}"${v ? ' checked' : ''}></div>`;
  const sub = t => `<div class="sub">${t}</div>`;
  const ESCALAS = [['jonico','Jônico (maior)'],['dorico','Dórico'],['frigio','Frígio'],['lidio','Lídio'],['mixolidio','Mixolídio'],['eolio','Eólio (menor)'],
    ['menorHarm','Menor harmônica'],['menorMel','Menor melódica'],['frigioDom','Frígio dominante'],['hungara','Húngara menor'],['penta','Pentatônica menor'],
    ['pentaMaior','Pentatônica maior'],['hirajoshi','Hirajoshi'],['tons','Tons inteiros']];
  const TLIST = [['sino','Sino'],['corda','Corda'],['macio','Macio'],['vidro','Vidro'],['marimba','Marimba'],['celesta','Celesta'],['kalimba','Kalimba'],
    ['sopro','Sopro'],['sinoGrave','Sino grave'],['harpa','Harpa'],['pad','Pad'],['seno','Seno puro'],['grave','Baixo redondo'],['percussao','Percussão']];
  const nucleo = $('nucleo'), nVideo = $('nucleoVideo');
  // som: Motor Knick (lib/motor-knick.js) — painel simplificado igual em todas as obras
  const MK = MotorKnick({ padroes: cfg.som || {} });
  if (nucleo) MK.painel(nucleo);
  if (nVideo){
    nVideo.innerHTML = '<h2>Vídeo</h2>' + rg('vBri', 'Brilho', 0.3, 2.5, 0.01, 1) + rg('vCon', 'Contraste', 0.4, 2.5, 0.01, 1) + rg('vSat', 'Saturação', 0, 3, 0.01, 1)
      + rg('vHue', 'Matiz', 0, 360, 1, 0) + rg('vGlow', 'Brilho difuso', 0, 30, 0.5, 4) + rg('vBlur', 'Desfoque', 0, 8, 0.1, 0) + rg('vTrail', 'Rastro', 0, 0.97, 0.01, 0)
      + rg('vZoom', 'Zoom do rastro', 0.95, 1.06, 0.001, 1.01) + rg('vRot', 'Giro do rastro', -3, 3, 0.05, 0.3) + ck('vInv', 'Inverter', false)
      + sl('vMirror', 'Espelho', [['0','Nenhum'],['2','2 lados'],['4','4 lados']], '0') + ck('showTxt', 'Texto', true)
      + '<div class="btns"><button id="bRe" type="button">Recomeçar</button><button id="bFull" type="button">Tela cheia</button></div>';
  }
  // padrões próprios de cada obra
  for (const k in (cfg.padroes || {})){ const el = $(k); if (!el) continue; if (el.type === 'checkbox') el.checked = !!cfg.padroes[k]; else el.value = cfg.padroes[k]; }

  // ---------- leitura dos controles ----------
  const panel = $('panel');
  const ctrls = () => [...panel.querySelectorAll('input[id],select[id]')].filter(el => !el.id.startsWith('bk') && el.type !== 'file');
  function readP(){ for (const el of ctrls()) P[el.id] = el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' || el.type === 'text') ? el.value : el.value === '' ? NaN : parseFloat(el.value); }
  readP();
  const listeners = [];
  for (const el of ctrls()){
    el.addEventListener(el.type === 'text' || el.type === 'number' ? 'change' : 'input', () => {
      const old = Object.assign({}, P); readP(); if (el.id[0] === 'v' || el.id === 'showTxt') applyVideo();
      for (const fn of listeners) fn(el.id, old);
    });
  }
  const setCtl = (k, v) => { const el = $(k); if (!el) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };

  // ---------- áudio: tudo passa pelo Motor Knick ----------
  // A obra continua chamando note/play/hit/kick/voz/setDrone como antes; o motor recebe isso como
  // acontecimentos (notas de vidro no pulso, energia do arranjo, troca de acorde) e faz a música.
  let AC = null;
  const SCALES = {
    jonico:[0,2,4,5,7,9,11], dorico:[0,2,3,5,7,9,10], frigio:[0,1,3,5,7,8,10], lidio:[0,2,4,6,7,9,11],
    mixolidio:[0,2,4,5,7,9,10], eolio:[0,2,3,5,7,8,10], locrio:[0,1,3,5,6,8,10],
    menorHarm:[0,2,3,5,7,8,11], menorMel:[0,2,3,5,7,9,11], frigioDom:[0,1,4,5,7,8,10], hungara:[0,2,3,6,7,8,11],
    penta:[0,3,5,7,10], pentaMaior:[0,2,4,7,9], hirajoshi:[0,2,3,7,8], tons:[0,2,4,6,8,10]
  };
  const NOTAS = ['Ré','Mi♭','Mi','Fá','Fá♯','Sol','Lá♭','Lá','Si♭','Si','Dó','Dó♯'];
  const ROOT = 73.416; // Ré2
  const now = () => AC ? AC.currentTime : performance.now()/1000;
  function initAudio(){ MK.iniciar(); AC = MK.AC; }
  function applyMix(){}
  function scale(){ return SCALES[MK.S.modo] || SCALES.eolio; }
  function semi(d){ d = Math.round(d); const sc = scale(), k = sc.length; return sc[((d % k)+k)%k] + 12*Math.floor(d/k); }
  function freq(d, base = ROOT*2){ return base*Math.pow(2, semi(d)/12); }
  function chord(d){ return [0,2,4,6,8].map(r => semi(d + r)); }
  function chordName(d){
    const r0 = semi(d), root = ((r0 % 12)+12)%12, third = semi(d+2) - r0, fifth = semi(d+4) - r0;
    const q = third === 4 && fifth === 7 ? 'maior' : third === 3 && fifth === 7 ? 'menor' : third === 3 && fifth === 6 ? 'diminuto' : third === 4 && fifth === 8 ? 'aumentado' : '';
    return NOTAS[root] + (q ? ' ' + q : '');
  }
  const noteName = d => NOTAS[((semi(d) % 12) + 12) % 12];
  // entrega no tempo certo (as obras agendam notas um pouco à frente)
  const quando = (t, fn) => { const dt = AC ? t - AC.currentTime : 0; if (dt > 0.03) setTimeout(fn, dt*1000); else fn(); };
  function note(src, f, t, vel = 0.8, pan = 0){ if (!AC || !(f > 15 && f < 20000)) return; quando(t, () => MK.nota(f, { forca: Math.min(1, vel), pan })); }
  const play = (src, d, t, vel, pan, durMul, base) => note(src, freq(d, base), t, vel == null ? 0.8 : vel, pan || 0);
  function hit(src, t, vel = 0.5){ if (AC) quando(t, () => MK.pulso(vel*0.6)); }
  function kick(src, t, vel = 0.8){ if (AC) quando(t, () => MK.pulso(vel)); }
  // drone da obra → acorde do motor (o grau da escala mais próximo da nota pedida)
  let ultimoDrone = null;
  function setDrone(rootSemi){
    if (!AC) return;
    const alvo = ((Math.round(rootSemi) % 12) + 12) % 12; let g = 0, bd = 99;
    for (let d = 0; d < 7; d++){ const dd = Math.abs(((semi(d) % 12) + 12) % 12 - alvo); if (dd < bd){ bd = dd; g = d; } }
    if (g !== ultimoDrone){ ultimoDrone = g; MK.acorde(g); }
  }
  // voz contínua da obra (oscilador sustentado) dentro do canal "Obra" do motor
  function voz(src, type = 'sine'){
    if (!AC) return null;
    const o = AC.createOscillator(); o.type = type; const g = AC.createGain(); g.gain.value = 0;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    let pn = null; o.connect(lp); lp.connect(g);
    const dest = MK.barramento('vid');
    if (AC.createStereoPanner){ pn = AC.createStereoPanner(); g.connect(pn); pn.connect(dest); } else g.connect(dest);
    o.start();
    return {
      set(f, gain, pan = 0, tc = 0.05, cut){ const t = AC.currentTime; if (f > 0) o.frequency.setTargetAtTime(f, t, tc); g.gain.setTargetAtTime(gain*0.35, t, tc);
        if (pn) pn.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, tc); if (cut) lp.frequency.setTargetAtTime(Math.min(cut, 3000), t, tc); },
      stop(){ const t = AC.currentTime; g.gain.setTargetAtTime(0, t, 0.1); o.stop(t + 1); }
    };
  }

  // ---------- vídeo ----------
  const cv = $('cv'), ctx = cv.getContext('2d');
  const lay = document.createElement('canvas'), lctx = lay.getContext('2d');
  const fbk = document.createElement('canvas'), fctx = fbk.getContext('2d');
  const HAS_FILTER = 'filter' in lctx;
  const V = { cv, ctx, lay, lctx, W: 0, H: 0, DPR: 1, resizers: [] };
  function resize(){
    V.DPR = Math.min(devicePixelRatio || 1, 2); V.W = innerWidth; V.H = innerHeight;
    for (const c of [cv, lay, fbk]){ c.width = V.W*V.DPR; c.height = V.H*V.DPR; }
    ctx.setTransform(V.DPR,0,0,V.DPR,0,0); lctx.setTransform(V.DPR,0,0,V.DPR,0,0);
    for (const fn of V.resizers) fn();
  }
  addEventListener('resize', resize); resize();
  function applyVideo(){
    cv.style.filter = `brightness(${P.vBri}) contrast(${P.vCon}) saturate(${P.vSat}) hue-rotate(${P.vHue}deg)${P.vInv ? ' invert(1)' : ''}`;
    document.body.classList.toggle('semtexto', P.showTxt === false);
  }
  applyVideo();
  // começa um quadro: devolve o contexto da camada onde a obra desenha (tamanho em pixels CSS)
  V.begin = (clear = true) => {
    const { W, H } = V;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (P.vTrail > 0){
      ctx.save(); ctx.globalAlpha = P.vTrail;
      ctx.translate(W/2, H/2); ctx.rotate(P.vRot*Math.PI/180); ctx.scale(P.vZoom, P.vZoom); ctx.translate(-W/2, -H/2);
      ctx.drawImage(fbk, 0, 0, W, H); ctx.restore();
    }
    lctx.setTransform(V.DPR,0,0,V.DPR,0,0);
    lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1; lctx.filter = 'none';
    if (clear) lctx.clearRect(0, 0, W, H);
    return lctx;
  };
  // fecha o quadro: brilho difuso, desfoque e espelho; guarda o quadro para o rastro
  V.end = () => {
    const { W, H } = V;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const m = +P.vMirror, mirrors = m === 4 ? [[1,1],[-1,1],[1,-1],[-1,-1]] : m === 2 ? [[1,1],[-1,1]] : [[1,1]];
    for (const [sx, sy] of mirrors){
      ctx.save(); ctx.translate(W/2, H/2); ctx.scale(sx, sy); ctx.translate(-W/2, -H/2);
      const al = sx === 1 && sy === 1 ? 1 : 0.7;
      if (HAS_FILTER && P.vGlow > 0){ ctx.filter = `blur(${P.vGlow}px)`; ctx.globalAlpha = 0.55*al; ctx.drawImage(lay, 0, 0, W, H); }
      ctx.filter = HAS_FILTER && P.vBlur > 0 ? `blur(${P.vBlur}px)` : 'none';
      ctx.globalAlpha = al; ctx.drawImage(lay, 0, 0, W, H);
      ctx.restore();
    }
    ctx.restore(); ctx.filter = 'none';
    if (P.vTrail > 0){ fctx.setTransform(1,0,0,1,0,0); fctx.globalCompositeOperation = 'copy'; fctx.drawImage(cv, 0, 0); fctx.globalCompositeOperation = 'source-over'; }
  };
  // cor da série (Gelo, Arco-íris, Brasa, Branco) para um valor u em [0,1)
  V.cor = (u, a = 1, l = 66) => {
    switch (P.color){
      case 'arco': return `hsla(${(u*360 + 190) % 360},70%,${l}%,${a})`;
      case 'brasa': return `hsla(${8 + 40*((u % 1 + 1) % 1)},85%,${l - 4}%,${a})`;
      case 'branco': return `hsla(0,0%,${Math.min(96, l + 14)}%,${a})`;
      default: { const k = (u % 1 + 1) % 1; return `hsla(${192 + 38*k},${60 - 26*k}%,${l + 10 - 18*k}%,${a})`; }
    }
  };

  // ---------- tela, painel, teclas ----------
  function toggleFull(){
    const d = document;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen).call(d.documentElement);
      else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } catch (e) {}
  }
  let running = false;
  function setup(onStart, keys = {}){
    $('start').addEventListener('pointerdown', e => { e.stopPropagation(); go(); });
    function go(){ if (running) return; initAudio(); running = true; $('start').classList.add('hide'); onStart && onStart(); }
    $('dot').addEventListener('click', () => $('panel').classList.toggle('on'));
    const bf = $('bFull'); if (bf) bf.addEventListener('click', toggleFull);
    const br = $('bRe'); if (br && keys.r) br.addEventListener('click', () => keys.r());
    const st = $('showTxt');
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
      if (e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'm') $('panel').classList.toggle('on');
      else if (k === 'f') toggleFull();
      else if (k === 't' && st){ st.checked = !st.checked; st.dispatchEvent(new Event('input', { bubbles: true })); }
      else if (k === ' ' && !running){ e.preventDefault(); go(); }
      else if (keys[k] || keys[e.key]){ e.preventDefault(); if (running) (keys[k] || keys[e.key])(); }
    });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const fmt = v => typeof v === 'number' ? v.toLocaleString('pt-BR') : String(v);
  return { P, V, readP, now, initAudio, applyMix, applyVideo, setDrone, freq, semi, chord, chordName, noteName, scale, SCALES, NOTAS, ROOT,
    note, play, hit, kick, voz, setup, toggleFull, fmt, on: fn => listeners.push(fn),
    som: MK, get AC(){ return AC; }, get running(){ return running; }, get droneF(){ return null; }, get voices(){ return 0; } };
}
