// ---------- núcleo comum das obras de conjecturas (som, painel, tela inicial) ----------
const $ = id => document.getElementById(id);
const O = (() => {
  const P = {};
  let ids = [];
  function readP(){
    for (const k of ids){ const el = $(k); if (!el) continue;
      P[k] = el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' || el.type === 'text') ? el.value : parseFloat(el.value); }
  }
  function bind(list, onChange){
    ids = list.concat(['scale','vol','drone','verb']);
    readP();
    for (const k of ids){ const el = $(k); if (!el) continue;
      el.addEventListener(el.type === 'text' || el.type === 'number' ? 'change' : 'input', () => { const old = Object.assign({}, P); readP(); applyMix(); onChange && onChange(k, old); }); }
  }

  // ---------- áudio ----------
  let AC = null, master, comp, fxF, fxDrive, fxCrush, dFb, dRet, width = 1, verbIn, verbOut, dryBus, delay, droneG, droneF, droneOscs = [];
  const SCALES = {
    jonico:[0,2,4,5,7,9,11], dorico:[0,2,3,5,7,9,10], frigio:[0,1,3,5,7,8,10], lidio:[0,2,4,6,7,9,11],
    mixolidio:[0,2,4,5,7,9,10], eolio:[0,2,3,5,7,8,10], locrio:[0,1,3,5,6,8,10],
    menorHarm:[0,2,3,5,7,8,11], menorMel:[0,2,3,5,7,9,11], frigioDom:[0,1,4,5,7,8,10], hungara:[0,2,3,6,7,8,11],
    penta:[0,3,5,7,10], pentaMaior:[0,2,4,7,9], hirajoshi:[0,2,3,7,8], tons:[0,2,4,6,8,10]
  };
  const NOTAS = ['Ré','Mi♭','Mi','Fá','Fá♯','Sol','Lá♭','Lá','Si♭','Si','Dó','Dó♯'];
  const ROOT = 73.416; // Ré2
  const now = () => AC ? AC.currentTime : performance.now()/1000;
  let voices = 0;
  const MAXV = 56;

  function initAudio(){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    try { AC = new Ctx({ latencyHint: 'playback' }); } catch (e) { AC = new Ctx(); }
    master = AC.createGain();
    comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
    // efeitos de saída (neutros por padrão): filtro → saturação → redução de bits → compressor
    fxF = AC.createBiquadFilter(); fxF.type = 'lowpass'; fxF.frequency.value = 20000; fxF.Q.value = 0.7;
    fxDrive = AC.createWaveShaper(); fxCrush = AC.createWaveShaper(); fxDrive.oversample = '2x';
    master.connect(fxF); fxF.connect(fxDrive); fxDrive.connect(fxCrush); fxCrush.connect(comp); comp.connect(AC.destination);
    dryBus = AC.createGain(); dryBus.connect(master);
    verbIn = AC.createGain(); verbOut = AC.createGain(); verbOut.connect(master);
    const merger = AC.createChannelMerger(2); merger.connect(verbOut);
    const pre = AC.createBiquadFilter(); pre.type = 'lowpass'; pre.frequency.value = 3200;
    const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
    verbIn.connect(hp); hp.connect(pre);
    [0.0797,0.0911,0.1013,0.1129,0.1237,0.1373].forEach((dt, i) => {
      const d = AC.createDelay(0.3); d.delayTime.value = dt;
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      const fb = AC.createGain(); fb.gain.value = 0.7;
      const o = AC.createGain(); o.gain.value = 0.2;
      pre.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(o); o.connect(merger, 0, i % 2);
    });
    delay = AC.createDelay(2); delay.delayTime.value = 0.42;
    const fb = AC.createGain(); fb.gain.value = 0.3; dFb = fb; dRet = AC.createGain(); dRet.gain.value = 1;
    const dLp = AC.createBiquadFilter(); dLp.type = 'lowpass'; dLp.frequency.value = 2200;
    delay.connect(dLp); dLp.connect(fb); fb.connect(delay); dLp.connect(dRet); dRet.connect(verbIn); dRet.connect(dryBus);
    droneG = AC.createGain(); droneG.gain.value = 0;
    droneF = AC.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 260; droneF.Q.value = 0.7;
    droneF.connect(droneG); droneG.connect(dryBus); droneG.connect(verbIn);
    [[ROOT/2,'sine',0.55],[ROOT,'sawtooth',0.10],[ROOT*1.004,'sawtooth',0.10],[ROOT*1.4983,'sawtooth',0.06]].forEach(([f,type,g]) => {
      const o = AC.createOscillator(); o.type = type; o.frequency.value = f;
      const gg = AC.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(droneF); o.start(); droneOscs.push(o);
    });
    applyMix();
  }
  function applyMix(){
    if (!AC) return;
    const t = AC.currentTime;
    master.gain.setTargetAtTime(P.vol, t, 0.1);
    verbOut.gain.setTargetAtTime(P.verb*1.4, t, 0.1);
    dryBus.gain.setTargetAtTime(1 - P.verb*0.45, t, 0.1);
    droneG.gain.setTargetAtTime(P.drone*0.3, t, 1.5);
  }
  // drone: fundamental e quinta em semitons acima do Ré
  function setDrone(rootSemi, fifthSemi = 7, glide = 1.2, bright){
    if (!AC) return;
    const t = AC.currentTime, r = ROOT*Math.pow(2, rootSemi/12), f5 = r*Math.pow(2, fifthSemi/12);
    [r/2, r, r*1.004, f5].forEach((f, i) => droneOscs[i].frequency.setTargetAtTime(f, t, glide));
    if (bright != null) droneF.frequency.setTargetAtTime(bright, t, 0.8);
  }
  function scale(){ return SCALES[P.scale] || SCALES.dorico; }
  function semi(d){ const sc = scale(), k = sc.length; return sc[((d % k)+k)%k] + 12*Math.floor(d/k); }
  function freq(d, base = ROOT*2){ return base*Math.pow(2, semi(d)/12); }
  // acorde de cinco vozes (terças empilhadas) a partir do grau d
  function chord(d){ const k = scale().length, rel = k === 7 ? [0,2,4,6,8] : k === 5 ? [0,1,2,3,5] : [0,1,2,3,4]; return rel.map(r => semi(d + r)); }
  function chordName(d){
    const sc = scale(), k = sc.length, r0 = semi(d), root = ((r0 % 12)+12)%12;
    let name = NOTAS[root];
    if (k === 7){ const third = semi(d+2) - r0, fifth = semi(d+4) - r0;
      const q = third === 4 && fifth === 7 ? 'maior' : third === 3 && fifth === 7 ? 'menor' : third === 3 && fifth === 6 ? 'diminuto' : third === 4 && fifth === 8 ? 'aumentado' : '';
      if (q) name += ' ' + q; }
    return name;
  }

  function out(node, pan, send, dly, t, end){
    let last = node;
    if (AC.createStereoPanner && pan){ const p = AC.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan*width)); node.connect(p); last = p; }
    last.connect(dryBus);
    const s = AC.createGain(); s.gain.value = send; last.connect(s); s.connect(verbIn);
    if (dly > 0){ const d = AC.createGain(); d.gain.value = dly; last.connect(d); d.connect(delay); }
    voices++; setTimeout(() => voices--, Math.max(50, (end - AC.currentTime)*1000 + 100));
  }
  const ok = () => AC && voices < MAXV;
  function bell(f, t, vel = 0.8, pan = 0, dur = 3){
    if (!ok()) return;
    const c = AC.createOscillator(), m = AC.createOscillator(), mg = AC.createGain(), g = AC.createGain();
    c.frequency.value = f; m.frequency.value = f*2.76;
    mg.gain.setValueAtTime(f*0.5, t); mg.gain.exponentialRampToValueAtTime(0.01, t+Math.min(0.9, dur));
    m.connect(mg); mg.connect(c.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15*vel, t+0.006); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    c.connect(g); out(g, pan, 0.6, 0.3, t, t+dur);
    c.start(t); m.start(t); c.stop(t+dur+0.05); m.stop(t+dur+0.05);
  }
  function soft(f, t, vel = 0.8, pan = 0, dur = 1.6){
    if (!ok()) return;
    const o = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(16000, f*6), t); lp.frequency.exponentialRampToValueAtTime(f*1.2, t+Math.min(0.9, dur));
    o.connect(lp); lp.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14*vel, t+0.025); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    out(g, pan, 0.45, 0.15, t, t+dur);
    o.start(t); o.stop(t+dur+0.05);
  }
  function pluck(f, t, vel = 0.8, pan = 0, dur = 0.9){
    if (!ok()) return;
    const o = AC.createOscillator(), o2 = AC.createOscillator(), lp = AC.createBiquadFilter(), g = AC.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'square'; o2.frequency.value = f*1.003;
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(Math.min(14000, f*10), t); lp.frequency.exponentialRampToValueAtTime(f*1.1, t+dur*0.6);
    const g2 = AC.createGain(); g2.gain.value = 0.4; o2.connect(g2); g2.connect(lp);
    o.connect(lp); lp.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07*vel, t+0.004); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    out(g, pan, 0.35, 0.2, t, t+dur);
    o.start(t); o2.start(t); o.stop(t+dur+0.05); o2.stop(t+dur+0.05);
  }
  function pad(f, t, vel = 0.6, pan = 0, dur = 6, att = 1.2){
    if (!ok()) return;
    const g = AC.createGain(), lp = AC.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, f*4);
    [-7, 7].forEach(dt => { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(lp); o.start(t); o.stop(t+dur+0.1); });
    lp.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035*vel, t+att); g.gain.setTargetAtTime(0.0001, t+Math.max(att, dur-att*1.5), att*0.5);
    out(g, pan, 0.9, 0, t, t+dur);
  }
  function sine(f, t, vel = 0.6, pan = 0, dur = 4, att = 0.02){
    if (!ok()) return;
    const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14*vel, t+att); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); out(g, pan, 0.7, 0.1, t, t+dur); o.start(t); o.stop(t+dur+0.05);
  }
  function kick(t, vel = 0.8, f0 = 120){
    if (!ok()) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(42, t+0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5*vel, t+0.004); g.gain.exponentialRampToValueAtTime(0.0001, t+0.45);
    o.connect(g); out(g, 0, 0.1, 0, t, t+0.5); o.start(t); o.stop(t+0.5);
  }
  let noiseBuf = null;
  function tick(t, vel = 0.5, pan = 0, fc = 6000, dur = 0.05){
    if (!ok()) return;
    if (!noiseBuf){ noiseBuf = AC.createBuffer(1, AC.sampleRate*0.5|0, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2-1; }
    const s = AC.createBufferSource(); s.buffer = noiseBuf;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = 1.4;
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25*vel, t+0.002); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    s.connect(bp); bp.connect(g); out(g, pan, 0.25, 0.1, t, t+dur); s.start(t, Math.random()*0.4); s.stop(t+dur+0.02);
  }

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
    const st = $('showTxt'); if (st) st.addEventListener('input', () => document.body.classList.toggle('semtexto', !st.checked));
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
      if (e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'm') $('panel').classList.toggle('on');
      else if (k === 'f') toggleFull();
      else if (k === 't' && st){ st.checked = !st.checked; document.body.classList.toggle('semtexto', !st.checked); }
      else if (k === ' ' && !running){ e.preventDefault(); go(); }
      else if (keys[k]){ e.preventDefault(); if (running) keys[k](); }
    });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const fmt = v => v.toLocaleString('pt-BR');
  // ---------- controles de efeitos ----------
  const fx = {
    delay(time, feedback, mix){ if (!AC) return; const t = AC.currentTime;
      if (time > 0) delay.delayTime.setTargetAtTime(Math.min(1.95, time), t, 0.05);
      dFb.gain.setTargetAtTime(Math.min(0.92, feedback), t, 0.05); dRet.gain.setTargetAtTime(time > 0 ? mix : 0, t, 0.05); },
    filter(freq, q){ if (!AC) return; const t = AC.currentTime; fxF.frequency.setTargetAtTime(freq, t, 0.08); fxF.Q.setTargetAtTime(q, t, 0.08); },
    drive(a){ if (!AC) return; if (a <= 0.001){ fxDrive.curve = null; return; }
      const n = 2048, c = new Float32Array(n), k = 1 + a*30;
      for (let i = 0; i < n; i++){ const x = i/(n-1)*2 - 1; c[i] = Math.tanh(k*x)/Math.tanh(k); } fxDrive.curve = c; },
    crush(a){ if (!AC) return; if (a <= 0.001){ fxCrush.curve = null; return; }
      const bits = 16 - a*14, steps = Math.pow(2, bits)/2, n = 8192, c = new Float32Array(n);
      for (let i = 0; i < n; i++){ const x = i/(n-1)*2 - 1; c[i] = Math.round(x*steps)/steps; } fxCrush.curve = c; },
    width(w){ width = w; }
  };
  return { fx, P, bind, readP, now, initAudio, applyMix, setDrone, freq, semi, chord, chordName, scale, SCALES, NOTAS, ROOT,
    bell, soft, pluck, pad, sine, kick, tick, setup, toggleFull, fmt,
    get AC(){ return AC; }, get running(){ return running; }, get droneF(){ return droneF; } };
})();
