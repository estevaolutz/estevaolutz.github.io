// Som da maquete de Stalingrado: tudo sintetizado com Web Audio e posicionado no terreno.
// Explosões, Katyushas, sirene dos Stukas, tanques, armas leves, aviões, vento, rio, e um som próprio por evento do diário.
(function () {
"use strict";
const SG = window.SG;
SG.makeSound = function (env) {
  const { camera, controls, events, toX, toZ } = env;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CATS = { arty: "Artilharia, Katyushas e bombas", air: "Aviões", ground: "Tanques e armas leves", amb: "Vento, rio e motores", event: "Eventos do diário" };
  const vol = { master: 0.8, arty: 0.85, air: 0.7, ground: 0.8, amb: 0.6, event: 0.9 };
  let on = true;
  try { const s = JSON.parse(localStorage.getItem("stal3-snd") || "null"); if (s) { Object.assign(vol, s.vol || {}); on = s.on !== false; } } catch (e) {}
  const save = () => { try { localStorage.setItem("stal3-snd", JSON.stringify({ vol, on })); } catch (e) {} };

  let ctx = null, out, comp, rev, bus = {}, noiseW, noiseB, voices = 0;
  const MAXV = 42, last = {}, R = Math.random, B = {};

  function mkBuf(sec, fill, ch = 1) {
    const b = ctx.createBuffer(ch, Math.max(1, Math.floor(ctx.sampleRate * sec)), ctx.sampleRate);
    for (let c = 0; c < ch; c++) fill(b.getChannelData(c), ctx.sampleRate, c);
    return b;
  }
  function buildBuffers() {
    noiseW = mkBuf(2, (d) => { for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; });
    noiseB = mkBuf(3, (d) => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (R() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
    B.mg = mkBuf(0.07, (d, sr) => { let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / sr, n = R() * 2 - 1; lp += 0.35 * (n - lp); d[i] = n * Math.exp(-t / 0.004) * 0.7 + lp * Math.exp(-t / 0.018) + Math.sin(2 * Math.PI * 140 * t) * Math.exp(-t / 0.02) * 0.5; } });
    B.smg = mkBuf(0.06, (d, sr) => { let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / sr, n = R() * 2 - 1; lp += 0.2 * (n - lp); d[i] = n * Math.exp(-t / 0.003) * 0.5 + lp * 1.4 * Math.exp(-t / 0.014); } });
    B.rifle = mkBuf(0.45, (d, sr) => { let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / sr, n = R() * 2 - 1; lp += 0.08 * (n - lp); d[i] = n * Math.exp(-t / 0.003) + lp * 2.4 * Math.exp(-t / 0.09); } });
    B.pom = mkBuf(0.3, (d, sr) => { let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / sr, n = R() * 2 - 1; lp += 0.12 * (n - lp); d[i] = Math.sin(2 * Math.PI * (150 - 220 * t) * t) * Math.exp(-t / 0.06) + lp * 1.8 * Math.exp(-t / 0.035); } });
    // ruínas: eco curto e denso de paredes; estepe: cauda longa e aberta
    rev.buffer = mkBuf(2.6, (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (R() * 2 - 1) * Math.pow(1 - t / 2.6, 2.4) * (t < 0.015 ? t / 0.015 : 1); } }, 2);
  }
  function init() {
    if (ctx) { if (ctx.state !== "running") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
    out = ctx.createGain(); out.connect(comp); comp.connect(ctx.destination);
    rev = ctx.createConvolver(); const rg = ctx.createGain(); rg.gain.value = 0.55; rev.connect(rg); rg.connect(out);
    for (const k of Object.keys(CATS)) { bus[k] = ctx.createGain(); bus[k].connect(out); }
    buildBuffers(); applyVol(); startLoops();
  }
  function applyVol() {
    if (!ctx) return; const now = ctx.currentTime;
    out.gain.setTargetAtTime(on ? vol.master : 0, now, 0.05);
    for (const k of Object.keys(CATS)) bus[k].gain.setTargetAtTime(vol[k], now, 0.05);
  }
  const _p = new THREE.Vector3();
  function spot(x, y, z) {
    const tx = controls.target.x, tz = controls.target.z, camD = camera.position.distanceTo(controls.target);
    const d = Math.hypot(x - tx, z - tz), Rr = 2 + camD * 0.3;
    let g = 1 / (1 + (d / Rr) * (d / Rr));
    g *= clamp(16 / (camD * 0.18 + 6), 0.2, 1.25) ; // a maquete é grande: a distância da câmera pesa menos que no Dia D
    _p.set(x, y || 0, z).project(camera);
    const pan = clamp(_p.x, -1, 1) * (_p.z > 1 ? -0.5 : 0.85);
    const muff = clamp(1 - d / (Rr * 3.5), 0, 1);
    return { g, pan, muff, far: 1 - muff };
  }
  function voice(cat, sp, dur, minG = 0.012) {
    if (!ctx || !on || ctx.state !== "running") return null;
    const g0 = sp ? sp.g : 1; if (g0 < minG) return null;
    if (voices >= MAXV && g0 < 0.35) return null;
    voices++; setTimeout(() => voices--, (dur + 0.3) * 1000);
    const g = ctx.createGain(); g.gain.value = g0;
    const p = ctx.createStereoPanner(); p.pan.value = sp ? sp.pan : 0;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = sp ? 700 + Math.pow(sp.muff, 1.6) * 15000 : 18000;
    g.connect(p); p.connect(lp); lp.connect(bus[cat]);
    const s = ctx.createGain(); s.gain.value = 0.18 + (sp ? sp.far * 0.55 : 0.15); lp.connect(s); s.connect(rev);
    return { in: g, t: ctx.currentTime + 0.005 };
  }
  function env_(gn, t, a, peak, dec, hold = 0) { const p = gn.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a); if (hold) p.setValueAtTime(peak, t + a + hold); p.exponentialRampToValueAtTime(0.0001, t + a + hold + dec); }
  function noise(dst, t, dur, o = {}) {
    const src = ctx.createBufferSource(); src.buffer = o.brown ? noiseB : noiseW; src.loop = true; let node = src;
    if (o.f) { const f = ctx.createBiquadFilter(); f.type = o.type || "lowpass"; f.Q.value = o.Q ?? 0.7; f.frequency.setValueAtTime(o.f, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.fdur || dur)); node.connect(f); node = f; }
    const g = ctx.createGain(); node.connect(g); g.connect(dst);
    env_(g, t, o.a ?? 0.003, o.peak ?? 1, o.dec ?? dur, o.hold || 0);
    src.start(t, R() * 1.5); src.stop(t + (o.a ?? 0.003) + (o.hold || 0) + (o.dec ?? dur) + 0.05);
    return g;
  }
  function tone(dst, t, dur, o = {}) {
    const osc = ctx.createOscillator(); osc.type = o.wave || "sine"; osc.frequency.setValueAtTime(o.f, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.fdur || dur));
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; f.Q.value = o.Q ?? 0.7; node.connect(f); node = f; }
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibD || 6; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.3); }
    const g = ctx.createGain(); node.connect(g); g.connect(dst);
    env_(g, t, o.a ?? 0.005, o.peak ?? 0.5, o.dec ?? dur, o.hold || 0);
    osc.start(t); osc.stop(t + (o.a ?? 0.005) + (o.hold || 0) + (o.dec ?? dur) + 0.05);
    return osc;
  }
  function buf(dst, t, b, o = {}) {
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = o.rate || 1; let node = s;
    if (o.f) { const f = ctx.createBiquadFilter(); f.type = o.type || "bandpass"; f.frequency.value = o.f; f.Q.value = o.Q ?? 0.9; node.connect(f); node = f; }
    const g = ctx.createGain(); g.gain.value = o.g ?? 1; node.connect(g); g.connect(dst); s.start(t);
  }
  const gate = (k, sec) => { const n = performance.now(); if (last[k] && n - last[k] < sec * 1000) return false; last[k] = n; return true; };

  function explosion(dst, t, size, sp) {
    const m = sp ? sp.muff : 1;
    tone(dst, t, 0.6 + size * 0.4, { f: 75, f1: 32, peak: 0.9 * Math.min(size, 1.6), dec: 0.5 + size * 0.5 });
    noise(dst, t, 1, { brown: true, f: 900 + 1200 * m, f1: 120, fdur: 1.2 + size, peak: 1.1, a: 0.004, dec: 0.9 + size * 1.3 });
    if (m > 0.3) noise(dst, t, 0.06, { f: 1800, type: "highpass", peak: 0.55 * m, dec: 0.06 });
    if (size > 1 && m > 0.4) for (let i = 0; i < 6; i++) noise(dst, t + 0.35 + R() * 0.9, 0.05, { f: 1800 + R() * 1500, type: "bandpass", Q: 2, peak: 0.12, dec: 0.06 }); // entulho caindo
  }
  function katyushaVoice(d, t, n) { // o "órgão de Stálin": cada foguete um uivo que sobe, todos sobrepostos
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.07 + R() * 0.02;
      noise(d, tt, 1.1, { f: 280 + R() * 80, f1: 1500 + R() * 400, fdur: 0.9, type: "bandpass", Q: 3.5, a: 0.02, peak: 0.2, dec: 1.1 });
      tone(d, tt, 1, { f: 220 + R() * 60, f1: 640 + R() * 120, fdur: 0.9, wave: "sawtooth", lp: 1400, peak: 0.035, a: 0.05, dec: 0.95 });
    }
    noise(d, t, 1.6, { f: 200, f1: 700, type: "bandpass", Q: 0.6, peak: 0.5, a: 0.08, dec: 1.6 });
  }
  function impactsRipple(d, t, n, size = 0.5) { for (let i = 0; i < n; i++) { const tt = t + i * 0.07 + R() * 0.05; tone(d, tt, 0.3, { f: 85, f1: 38, peak: 0.35 * size + 0.1, dec: 0.35 }); noise(d, tt, 0.5, { brown: true, f: 1300, f1: 200, peak: 0.5, dec: 0.6 }); } }
  function sirenVoice(d, t, dur, pk = 0.14) { // trombeta de Jericó: o lamento sobe enquanto o Stuka mergulha
    const o = tone(d, t, dur, { f: 330, f1: 980, fdur: dur, wave: "sawtooth", lp: 2200, Q: 4, peak: pk, a: dur * 0.4, hold: dur * 0.45, dec: 0.25, vib: 7, vibD: 14 });
    tone(d, t, dur, { f: 110, f1: 190, fdur: dur, wave: "sawtooth", lp: 600, peak: pk * 0.7, a: dur * 0.3, hold: dur * 0.5, dec: 0.3 });
    return o;
  }

  const api = {
    boom(x, z, size = 1) {
      if (!gate("boom", size < 0.8 ? 0.09 : 0.05)) return; const sp = spot(x, 0, z); const v = voice("arty", sp, 3.5); if (!v) return;
      if (size < 0.8) { // granada ou morteiro: estalo seco e curto
        noise(v.in, v.t, 0.04, { f: 2200, type: "highpass", peak: 0.6 * sp.muff + 0.1, dec: 0.04 });
        tone(v.in, v.t, 0.25, { f: 110, f1: 50, peak: 0.5, dec: 0.25 }); noise(v.in, v.t, 0.6, { brown: true, f: 1500, f1: 300, peak: 0.7, dec: 0.7 });
      } else explosion(v.in, v.t, size, sp);
    },
    splash(x, z) {
      if (!gate("splash", 0.15)) return; const sp = spot(x, 0, z); const v = voice("arty", sp, 2); if (!v) return;
      tone(v.in, v.t, 0.4, { f: 60, f1: 35, peak: 0.55, dec: 0.4 }); noise(v.in, v.t, 1.4, { f: 2600, f1: 500, peak: 0.55, a: 0.02, dec: 1.4 });
    },
    gun(x, y, z) {
      if (!gate("gun", 0.06)) return; const sp = spot(x, y, z); const v = voice("arty", sp, 2.5); if (!v) return;
      noise(v.in, v.t, 0.05, { f: 1400, type: "highpass", peak: 0.6 * sp.muff + 0.1, dec: 0.05 });
      tone(v.in, v.t, 0.6, { f: 70, f1: 34, peak: 0.8, dec: 0.6 }); noise(v.in, v.t, 1, { brown: true, f: 800, f1: 100, fdur: 1.5, peak: 0.9, dec: 1.8 });
    },
    katyusha(x, y, z, n, tx, tz) {
      if (!gate("kat", 0.7)) return; const sp = spot(x, y, z), v = voice("arty", sp, 4, 0.02);
      if (v) katyushaVoice(v.in, v.t, n);
      const sp2 = spot(tx, 0, tz), v2 = voice("arty", sp2, 4, 0.02); if (v2) impactsRipple(v2.in, v2.t + 1.35, Math.min(n, 12));
    },
    siren(x, y, z, dur) { if (!gate("siren", 0.8)) return; const sp = spot(x, y, z), v = voice("air", sp, dur + 0.5, 0.02); if (v) sirenVoice(v.in, v.t, dur); },
    bomb(x, z) { if (!gate("bombw", 0.3)) return; const sp = spot(x, 0, z), v = voice("arty", sp, 1, 0.05); if (v) tone(v.in, v.t, 0.7, { f: 2000, f1: 700, a: 0.4, peak: 0.12, dec: 0.3 }); },
    tankGun(x, y, z, german) {
      if (!gate("tank", 0.12)) return; const sp = spot(x, y, z); const v = voice("ground", sp, 2); if (!v) return;
      noise(v.in, v.t, 0.03, { f: german ? 2600 : 1800, type: "highpass", peak: 1.0 * sp.muff + 0.15, dec: 0.03 });
      tone(v.in, v.t, 0.3, { f: german ? 130 : 100, f1: 48, peak: 0.85, dec: 0.3 });
      noise(v.in, v.t, 0.8, { f: german ? 700 : 450, type: "bandpass", Q: 0.8, peak: 0.9, dec: 0.9 });
      noise(v.in, v.t + 0.05, 1, { brown: true, f: 500, f1: 120, peak: 0.6, dec: 1.4 });
    },
    mg42(x, y, z) {
      if (!gate("mg42", 0.3)) return; const sp = spot(x, y, z), n = 10 + (R() * 14) | 0, v = voice("ground", sp, n / 20 + 0.5, 0.03); if (!v) return;
      for (let i = 0; i < n; i++) buf(v.in, v.t + i / 21 + R() * 0.004, B.mg, { f: 1500, Q: 0.7, g: 0.75, rate: 0.95 + R() * 0.1 });
    },
    ppsh(x, y, z) { // PPSh-41: rajada rápida e mais leve, de 9 mm
      if (!gate("ppsh", 0.3)) return; const sp = spot(x, y, z), n = 8 + (R() * 12) | 0, v = voice("ground", sp, n / 15 + 0.5, 0.03); if (!v) return;
      for (let i = 0; i < n; i++) buf(v.in, v.t + i / 15 + R() * 0.006, B.smg, { f: 1900, Q: 0.6, g: 0.7, rate: 0.95 + R() * 0.1 });
    },
    flak(x, y, z) {
      if (!gate("flak", 0.3)) return; const sp = spot(x, y, z), v = voice("arty", sp, 2.5, 0.03); if (!v) return;
      buf(v.in, v.t, B.pom, { f: 380, Q: 0.5, g: 0.8 }); noise(v.in, v.t + 0.2, 0.08, { f: 1100, type: "bandpass", peak: 0.35, dec: 0.4 });
    },
    crash(x, y, z) {
      const sp = spot(x, y, z), v = voice("air", sp, 3.5, 0.03); if (!v) return;
      tone(v.in, v.t, 2.6, { f: 160, f1: 90, wave: "sawtooth", lp: 700, peak: 0.12, a: 0.1, dec: 2.5, vib: 9, vibD: 10 });
    },
    barrage(x, z) { if (L) acc.barrage += spot(x, 0, z).g; },
  };

  // ---- camadas contínuas ----
  let L = null; const acc = { ju52: 0, he111: 0, stuka: 0, boat: 0, truck: 0, fire: 0, barrage: 0, pan: 0, panW: 0 };
  function loopNoise(brown, f, type, Q) { const s = ctx.createBufferSource(); s.buffer = brown ? noiseB : noiseW; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = Q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); s.start(); return { g, fl }; }
  function engineBank(freqs, wave, lpf, dst, throb = 1.7) {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(dst); const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = lpf; lp.Q.value = 1.2; lp.connect(g);
    freqs.forEach((f) => { const o = ctx.createOscillator(); o.type = wave; o.frequency.value = f; o.connect(lp); o.start(); });
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = throb; lg.gain.value = lpf * 0.25; l.connect(lg); lg.connect(lp.frequency); l.start();
    return g;
  }
  function startLoops() {
    const ap = ctx.createStereoPanner(); ap.connect(bus.air);
    L = {
      ap,
      ju52: engineBank([78, 80.5, 83.2, 157], "sawtooth", 480, ap, 2.3), // três motores BMW 132 fora de sincronia
      he111: engineBank([71, 73, 142], "sawtooth", 420, ap, 1.4),
      stuka: engineBank([104, 106, 208], "sawtooth", 650, ap, 3.1),
      boat: engineBank([31, 33.5, 64], "square", 200, bus.amb, 5),
      truck: engineBank([46, 49, 92], "sawtooth", 260, bus.amb, 2),
      drum: loopNoise(true, 160, "lowpass", 0.8), // trovoada contínua das barragens
      wind: loopNoise(false, 420, "bandpass", 0.6),
      howl: loopNoise(false, 700, "bandpass", 6), // assobio da nevasca
      rain: loopNoise(false, 3000, "highpass", 0.5),
      river: loopNoise(true, 420, "lowpass", 0.6),
    };
    for (const k of ["drum"]) L[k].g.connect(bus.arty);
    for (const k of ["wind", "howl", "rain", "river"]) L[k].g.connect(bus.amb);
    const gust = ctx.createOscillator(), gg = ctx.createGain(); gust.frequency.value = 0.08; gg.gain.value = 160; gust.connect(gg); gg.connect(L.wind.fl.frequency); gg.connect(L.howl.fl.frequency); gust.start();
  }
  api.frameStart = () => { for (const k in acc) acc[k] = 0; };
  api.plane = (x, y, z, kind) => { if (!L) return; const sp = spot(x, y, z); acc[kind] += sp.g; acc.pan += sp.pan * sp.g; acc.panW += sp.g; };
  api.boat = (x, z, ice) => { if (L) acc[ice ? "truck" : "boat"] += spot(x, 0, z).g; };
  api.fire = (x, y, z, size) => { if (L) acc.fire += spot(x, y, z).g * size; };
  let urbanT = 0;
  api.frameEnd = (playing, w, dt, cityView, frontActive, volgaOpen, floes) => {
    if (!L || !ctx || ctx.state !== "running") return;
    const now = ctx.currentTime, k = playing ? 1 : 0, sat = (v, m) => m * (1 - Math.exp(-v / m));
    L.ju52.gain.setTargetAtTime(sat(acc.ju52 * 0.06, 0.5) * k, now, 0.3);
    L.he111.gain.setTargetAtTime(sat(acc.he111 * 0.05, 0.55) * k, now, 0.3);
    L.stuka.gain.setTargetAtTime(sat(acc.stuka * 0.5, 0.4) * k, now, 0.2);
    L.ap.pan.setTargetAtTime(acc.panW ? clamp(acc.pan / acc.panW, -0.8, 0.8) : 0, now, 0.4);
    L.boat.gain.setTargetAtTime(sat(acc.boat * 0.25, 0.35) * k, now, 0.4);
    L.truck.gain.setTargetAtTime(sat(acc.truck * 0.25, 0.3) * k, now, 0.4);
    L.drum.g.gain.setTargetAtTime(sat(acc.barrage * 0.8, 0.9) * k, now, 0.5);
    if (acc.barrage > 0.02 && Math.random() < acc.barrage * dt * 14) { const v = voice("arty", null, 2); if (v) { tone(v.in, v.t, 0.6, { f: 55 + R() * 20, f1: 28, peak: 0.35 * clamp(acc.barrage, 0, 1), dec: 0.7 }); noise(v.in, v.t, 1, { brown: true, f: 400, f1: 90, peak: 0.4 * clamp(acc.barrage, 0, 1), dec: 1.5 }); } }
    // clima das fontes: vento de base, nevasca assobiando, chuva
    L.wind.g.gain.setTargetAtTime(0.06 + 0.3 * w.wind + 0.12 * w.snow, now, 1);
    L.howl.g.gain.setTargetAtTime(0.12 * Math.max(0, w.wind - 0.4) + 0.08 * Math.max(0, w.snow - 0.5), now, 1.2);
    L.rain.g.gain.setTargetAtTime(0.25 * w.rain, now, 1);
    L.river.g.gain.setTargetAtTime(cityView && volgaOpen ? 0.22 : 0, now, 1);
    // gelo do Volga rangendo enquanto as placas descem o rio
    if (cityView && floes && Math.random() < dt * 0.5) { const v = voice("amb", null, 2); if (v) tone(v.in, v.t, 1.4, { f: 70 + R() * 50, f1: 40 + R() * 30, wave: "sawtooth", lp: 400, peak: 0.06, a: 0.2, dec: 1.2, vib: 11, vibD: 8 }); }
    // combate urbano: tiros isolados e rajadas distantes entre as ruínas
    if (cityView && frontActive && playing) { urbanT -= dt; if (urbanT <= 0) { urbanT = 0.12 + R() * 0.35; const v = voice("ground", null, 0.6); if (v) { const pk = 0.12 + R() * 0.12; if (R() < 0.75) buf(v.in, v.t, B.rifle, { f: 900 + R() * 900, Q: 0.6, g: pk, rate: 0.85 + R() * 0.3 }); else for (let i = 0; i < 4 + (R() * 5 | 0); i++) buf(v.in, v.t + i / 15, B.smg, { f: 1200, g: pk * 0.8 }); } } }
    if (acc.fire > 0.05 && R() < acc.fire * dt * 6) { const v = voice("amb", null, 0.2); if (v) noise(v.in, v.t, 0.03, { f: 2500 + R() * 2000, type: "bandpass", Q: 2, peak: clamp(acc.fire, 0, 1) * 0.35, dec: 0.03 }); }
  };

  // ---- um som próprio para cada evento do diário ----
  const C = {
    drone(d, t, dur, freqs, pk = 0.08, lp = 450) { freqs.forEach((f) => tone(d, t, dur, { f, wave: "sawtooth", lp, peak: pk, a: dur * 0.35, hold: dur * 0.3, dec: dur * 0.35 })); },
    airRaid(d, t, dur) { const o = tone(d, t, dur, { f: 300, peak: 0.13, a: 0.8, hold: dur - 1.6, dec: 0.8 }); o.frequency.setValueAtTime(300, t); o.frequency.linearRampToValueAtTime(700, t + dur * 0.4); o.frequency.linearRampToValueAtTime(700, t + dur * 0.6); o.frequency.linearRampToValueAtTime(260, t + dur); },
    carpet(d, t, n, gap = 0.2) { for (let i = 0; i < n; i++) explosion(d, t + i * gap + R() * 0.05, 0.9, null); },
    tracks(d, t, dur, pk = 0.3, fade = 0) { const n = Math.floor(dur * 11); for (let i = 0; i < n; i++) noise(d, t + i / 11 + R() * 0.01, 0.04, { f: 1400 + R() * 600, type: "bandpass", Q: 3, peak: pk * (1 - fade * i / n) * 0.6, dec: 0.04 }); tone(d, t, dur, { f: 42, wave: "sawtooth", lp: 220, peak: pk * 0.5, a: 0.4, hold: dur - 1, dec: 0.6 }); tone(d, t, dur, { f: 63, wave: "square", lp: 160, peak: pk * 0.25, a: 0.4, hold: dur - 1, dec: 0.6 }); },
    t34(d, t, dur) { tone(d, t, dur, { f: 36, f1: 52, fdur: dur * 0.5, wave: "sawtooth", lp: 300, peak: 0.16, a: 0.5, hold: dur - 1, dec: 0.5 }); C.tracks(d, t + 0.3, dur - 0.3, 0.3); }, // diesel V-2
    tankShot(d, t, ger) { noise(d, t, 0.03, { f: ger ? 2500 : 1800, type: "highpass", peak: 0.9, dec: 0.03 }); tone(d, t, 0.3, { f: ger ? 125 : 100, f1: 48, peak: 0.75, dec: 0.3 }); noise(d, t, 0.7, { f: 500, type: "bandpass", peak: 0.7, dec: 0.8 }); },
    morse(d, t, code) { let tt = t; for (const c of code) { if (c === " ") { tt += 0.18; continue; } const len = c === "." ? 0.07 : 0.21; tone(d, tt, len, { f: 760, peak: 0.13, a: 0.004, hold: len, dec: 0.01 }); tt += len + 0.07; } noise(d, t, tt - t, { f: 1600, type: "bandpass", Q: 0.7, peak: 0.04, a: 0.05, hold: Math.max(0, tt - t - 0.1), dec: 0.1 }); },
    mg(d, t, n, rate = 21, smg = false) { for (let i = 0; i < n; i++) buf(d, t + i / rate, smg ? B.smg : B.mg, { f: smg ? 1900 : 1500, g: 0.6 }); },
    rifles(d, t, n, spread) { for (let i = 0; i < n; i++) buf(d, t + R() * spread, B.rifle, { f: 1100 + R() * 700, g: 0.5 }); },
    grenade(d, t) { noise(d, t, 0.04, { f: 2200, type: "highpass", peak: 0.6, dec: 0.04 }); tone(d, t, 0.25, { f: 110, f1: 50, peak: 0.6, dec: 0.25 }); noise(d, t, 0.7, { brown: true, f: 1500, f1: 300, peak: 0.8, dec: 0.8 }); },
    metal(d, t, pk = 0.2) { [180, 467, 803, 1250].forEach((f, i) => tone(d, t, 1.1, { f: f * (0.95 + R() * 0.1), peak: pk / (1 + i * 0.5), a: 0.001, dec: 1.2 - i * 0.2 })); },
    flame(d, t, dur) { noise(d, t, dur, { f: 500, f1: 900, type: "bandpass", Q: 0.6, peak: 0.5, a: 0.08, hold: dur - 0.4, dec: 0.3 }); noise(d, t, dur, { brown: true, f: 300, peak: 0.6, a: 0.1, hold: dur - 0.4, dec: 0.4 }); },
    blizzard(d, t, dur) { noise(d, t, dur, { f: 600, f1: 950, type: "bandpass", Q: 5, peak: 0.25, a: dur * 0.3, hold: dur * 0.4, dec: dur * 0.3 }); noise(d, t, dur, { f: 400, type: "bandpass", Q: 0.6, peak: 0.3, a: 0.6, hold: dur - 1.2, dec: 0.6 }); },
    bell(d, t, f, pk = 0.2) { [0.5, 1, 1.19, 1.5, 2, 2.52, 3.01].forEach((m, i) => tone(d, t, 3, { f: f * m, peak: pk / (1 + i * 0.6), a: 0.002, dec: 3.2 - i * 0.3 })); },
    phone(d, t) { for (const f of [425]) { const o = tone(d, t, 1.2, { f, wave: "square", lp: 1500, peak: 0.06, a: 0.01, hold: 1.1, dec: 0.05 }); const l = ctx.createOscillator(), lg = ctx.createGain(); l.type = "square"; l.frequency.value = 17; lg.gain.value = 40; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 1.3); } },
    brass(d, t, notes, pk = 0.15) { notes.reduce((tt, [f, dur]) => { tone(d, tt, dur, { f, wave: "sawtooth", lp: 1500, Q: 2, peak: pk, a: 0.05, hold: Math.max(0, dur - 0.25), dec: 0.2, vib: 5, vibD: f * 0.006 }); return tt + dur; }, t); },
    plasterFall(d, t) { for (let i = 0; i < 14; i++) noise(d, t + R() * 1.4, 0.06, { f: 900 + R() * 2400, type: "bandpass", Q: 1.8, peak: 0.25, dec: 0.08 }); },
  };
  const CUES = [
    ["chega ao Volga", (d, t) => { C.airRaid(d, t, 4.5); C.drone(d, t, 5, [71, 73, 142], 0.07, 420); C.carpet(d, t + 2, 9, 0.22); }],
    ["Junção", (d, t) => { C.tracks(d, t, 3.2, 0.3); C.morse(d, t + 0.8, "--.. .- -.-"); }],
    ["Kotluban", (d, t) => { for (let i = 0; i < 5; i++) { explosion(d, t + i * 0.5, 0.8, null); } C.t34(d, t + 0.6, 3.4); }],
    ["Primeiro assalto", (d, t) => { sirenVoice(d, t, 1.8, 0.12); explosion(d, t + 1.9, 1.3, null); C.mg(d, t + 2.6, 18); C.grenade(d, t + 3.2); }],
    ["Estação Central", (d, t) => { C.mg(d, t, 14, 15, true); C.grenade(d, t + 1.1); C.mg(d, t + 1.6, 16); C.plasterFall(d, t + 1.2); C.grenade(d, t + 2.6); }],
    ["Elevador", (d, t) => { C.mg(d, t, 20); C.metal(d, t + 0.4, 0.15); explosion(d, t + 1.6, 1.1, null); C.mg(d, t + 2.3, 12); }],
    ["bairros operários", (d, t) => { for (let i = 0; i < 4; i++) { tone(d, t + i * 0.6, 0.6, { f: 1300, f1: 500, peak: 0.07, a: 0.45, dec: 0.15 }); C.grenade(d, t + i * 0.6 + 0.6); } C.rifles(d, t, 8, 3); }],
    ["Fábrica de Tratores", (d, t) => { sirenVoice(d, t, 1.6, 0.12); sirenVoice(d, t + 0.7, 1.6, 0.1); explosion(d, t + 1.8, 1.4, null); C.metal(d, t + 2.2, 0.25); C.tankShot(d, t + 2.8, true); }],
    ["Hubertus", (d, t) => { C.flame(d, t, 1.5); C.grenade(d, t + 1.7); explosion(d, t + 2.4, 1.0, null); C.plasterFall(d, t + 2.5); C.mg(d, t + 3.2, 10, 15, true); }],
    ["pinça norte", (d, t) => { noise(d, t, 5, { brown: true, f: 170, peak: 0.8, a: 0.6, hold: 3.6, dec: 0.8 }); for (let i = 0; i < 12; i++) tone(d, t + i * 0.36, 0.7, { f: 55 + R() * 20, f1: 28, peak: 0.5, dec: 0.8 }); katyushaVoice(d, t + 1.2, 16); }],
    ["pinça sul", (d, t) => { katyushaVoice(d, t, 12); C.t34(d, t + 1.4, 3.6); C.tankShot(d, t + 3, false); }],
    ["Sovetsky", (d, t) => { C.t34(d, t, 3); C.morse(d, t + 1, "... --- . -.. .. -. . -. .. ."); }],
    ["Ponte aérea", (d, t) => { C.drone(d, t, 5, [78, 80.5, 83.2, 157], 0.075, 480); for (let i = 0; i < 5; i++) buf(d, t + 1.4 + i * 0.55, B.pom, { f: 380, g: 0.6 }); }],
    ["Casa de Pavlov", (d, t) => { C.mg(d, t, 12, 15, true); C.grenade(d, t + 0.9); noise(d, t + 1.6, 2.4, { f: 420, type: "bandpass", Q: 0.6, peak: 0.12, a: 0.4, hold: 1.4, dec: 0.6 }); C.brass(d, t + 2, [[392, 0.3], [523, 0.3], [659, 0.6]], 0.12); }],
    ["Tempestade de Inverno", (d, t) => { C.blizzard(d, t, 4.5); C.tracks(d, t + 0.5, 3.6, 0.28); C.tankShot(d, t + 3.2, true); }],
    ["Pequeno Saturno", (d, t) => { noise(d, t, 3, { brown: true, f: 170, peak: 0.7, a: 0.4, hold: 2, dec: 0.6 }); for (let i = 0; i < 7; i++) tone(d, t + i * 0.4, 0.7, { f: 55, f1: 28, peak: 0.45, dec: 0.8 }); katyushaVoice(d, t + 1.6, 12); }],
    ["Myshkova", (d, t) => { noise(d, t, 4, { f: 3000, type: "highpass", peak: 0.15, a: 0.6, hold: 2.8, dec: 0.6 }); C.tankShot(d, t + 0.4, true); C.tankShot(d, t + 1.2, false); C.tankShot(d, t + 2, true); explosion(d, t + 2.6, 1.0, null); }],
    ["Tatsinskaya", (d, t) => { C.t34(d, t, 3); C.mg(d, t + 1, 10); explosion(d, t + 2.2, 1.3, null); explosion(d, t + 2.8, 1.0, null); C.metal(d, t + 2.4, 0.2); }],
    ["Kotelnikovo", (d, t) => { C.t34(d, t, 2.6); C.bell(d, t + 2.2, 294, 0.16); C.bell(d, t + 2.9, 262, 0.16); }],
    ["Ultimato", (d, t) => { C.phone(d, t); noise(d, t + 1.4, 1.8, { f: 1700, type: "bandpass", Q: 0.6, peak: 0.08, a: 0.1, hold: 1.4, dec: 0.3 }); C.morse(d, t + 1.5, "-. . - "); buf(d, t + 3.4, B.rifle, { f: 1000, g: 0.6 }); }],
    ["Anel", (d, t) => { noise(d, t, 5.5, { brown: true, f: 180, peak: 0.9, a: 0.3, hold: 4.4, dec: 0.8 }); for (let i = 0; i < 16; i++) tone(d, t + i * 0.3, 0.7, { f: 50 + R() * 25, f1: 26, peak: 0.55, dec: 0.8 }); katyushaVoice(d, t + 0.8, 16); katyushaVoice(d, t + 2.6, 12); }],
    ["Pitomnik", (d, t) => { C.drone(d, t, 2.5, [80, 83, 157], 0.07, 480); tone(d, t + 1, 2, { f: 170, f1: 70, wave: "sawtooth", lp: 600, peak: 0.12, a: 0.1, dec: 2 }); explosion(d, t + 2.9, 1.5, null); }],
    ["Gumrak", (d, t) => { for (let i = 0; i < 5; i++) explosion(d, t + i * 0.45, 0.9, null); C.metal(d, t + 2.5, 0.15); }],
    ["partido ao meio", (d, t) => { C.t34(d, t, 2.6); C.rifles(d, t + 0.5, 6, 2); C.morse(d, t + 2.2, ".-. .- --.. -.. . .-.."); }],
    ["Rendição", (d, t) => { noise(d, t, 5, { f: 420, type: "bandpass", Q: 0.6, peak: 0.25, a: 1, hold: 3, dec: 1 }); C.rifles(d, t + 0.4, 3, 1.5); C.phone(d, t + 2.6); }],
    ["Fim da batalha", (d, t) => { noise(d, t, 6, { f: 400, type: "bandpass", Q: 0.6, peak: 0.25, a: 1.5, hold: 3, dec: 1.5 }); C.brass(d, t + 1, [[196, 0.8], [262, 0.8], [330, 0.8], [392, 1.8]], 0.13); C.brass(d, t + 1, [[131, 0.8], [196, 0.8], [262, 0.8], [196, 1.8]], 0.08); }],
  ];
  api.cue = (i) => {
    const e = events[i]; if (!e) return; const c = CUES.find(([k]) => e.title.includes(k)); if (!c || !gate("cue" + i, 1.5)) return;
    let sp = null; if (e.lat !== null) { sp = spot(toX(e.lon), 0, toZ(e.lat)); sp.g = Math.max(sp.g, 0.75); sp.muff = Math.max(sp.muff, 0.8); sp.far = 1 - sp.muff; }
    const v = voice("event", sp, 7, 0); if (v) c[1](v.in, v.t);
  };

  // ---- controles ----
  api.init = init;
  api.isOn = () => on;
  api.setOn = (v) => { on = v; if (v) init(); applyVol(); save(); };
  api.setVol = (k, v) => { vol[k] = v; applyVol(); save(); };
  api.buildUI = () => {
    const $ = (s) => document.querySelector(s), mx = $("#mixer"); if (!mx) return;
    const ICON_ON = '<path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>';
    const ICON_OFF = '<path d="M4 9v6h4l5 4V5L8 9H4zm12.6 3 2.9-2.9-1.4-1.4-2.9 2.9-2.9-2.9-1.4 1.4 2.9 2.9-2.9 2.9 1.4 1.4 2.9-2.9 2.9 2.9 1.4-1.4z"/>';
    for (const [k, label] of [["master", "Volume geral"], ...Object.entries(CATS)]) {
      const id = "vol-" + k, v = Math.round(vol[k] * 100);
      mx.insertAdjacentHTML("beforeend", `<label for="${id}"${k === "master" ? ' class="main"' : ""}>${label}</label><input type="range" id="${id}" min="0" max="100" step="1" value="${v}"><output for="${id}" id="${id}-o">${v}</output>`);
      const inp = $("#" + id), o = $("#" + id + "-o"); inp.oninput = () => { o.textContent = inp.value; api.setVol(k, inp.value / 100); };
    }
    const sb = $("#sndbtn"), mb = $("#mute");
    const sync = () => { sb.setAttribute("aria-pressed", on); sb.textContent = on ? "Ligado" : "Desligado"; mx.classList.toggle("off", !on); $("#muteicon").innerHTML = on ? ICON_ON : ICON_OFF; mb.setAttribute("aria-label", on ? "Desligar o som" : "Ligar o som"); };
    const toggle = () => { api.setOn(!on); sync(); };
    sb.onclick = toggle; mb.onclick = toggle; sync();
    addEventListener("keydown", (e) => { if ((e.key === "m" || e.key === "M") && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) toggle(); });
    const wake = () => { if (on) init(); }; // o navegador só libera o áudio depois do primeiro gesto
    addEventListener("pointerdown", wake, { capture: true }); addEventListener("keydown", wake, { capture: true });
  };
  return api;
};
})();
