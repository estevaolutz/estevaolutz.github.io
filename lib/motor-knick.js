/* =====================================================================
   Motor Knick — motor de som comum das obras audiovisuais
   Estética: a trilha de Cliff Martinez para The Knick (2014) — vários
   sintetizadores analógicos arpejados em camadas de comprimentos
   diferentes (polimetria hipnótica), baixo pulsando em colcheias, pad
   escuro, sinos de vidro (à la Cristal Baschet), delay pontuado no tempo,
   reverb longo e um leve desvio de fita.

   A obra não toca notas soltas: ela conta ao motor o que está acontecendo
   e o motor transforma isso em música dentro do pulso.

     const M = MotorKnick({ painel: elemento, chave: 'nome-da-obra' });
     M.iniciar();                         // num gesto do usuário (toque/clique)
     M.evento(grau, { forca, pan });      // algo aconteceu na obra → nota de vidro no próximo 16º
     M.nota(freqHz, { forca, pan });      // idem, a partir de uma frequência (vai para a escala)
     M.acorde(grau);                      // a obra escolhe o acorde (entra no próximo tempo)
     M.energia(0..1);                     // quanto a obra está "acontecendo" (densidade automática)
     M.on('nota', fn) / M.on('passo', fn) // para o vídeo pulsar junto com o som
     M.saida                              // nó de saída (gravação, analisador)

   Controles (iguais em todas as obras): Cena, Tonalidade, Volume,
   Andamento, Densidade (+ "a obra comanda"), Brilho, Espaço e, recolhida,
   a Mistura (Arpejos, Baixo, Pad, Obra, Ritmo). Todos têm id com prefixo
   "mk", então o banco de configurações das obras guarda tudo.
   ===================================================================== */
(function (global) {
  'use strict';

  const MODOS = {
    eolio: [0, 2, 3, 5, 7, 8, 10], dorico: [0, 2, 3, 5, 7, 9, 10], frigio: [0, 1, 3, 5, 7, 8, 10],
    menorHarm: [0, 2, 3, 5, 7, 8, 11], lidio: [0, 2, 4, 6, 7, 9, 11], jonico: [0, 2, 4, 5, 7, 9, 11],
    mixolidio: [0, 2, 4, 5, 7, 9, 10]
  };
  const MODOS_NOME = [['eolio', 'menor'], ['dorico', 'dórico'], ['frigio', 'frígio'], ['menorHarm', 'menor harm.'],
    ['mixolidio', 'mixolídio'], ['lidio', 'lídio'], ['jonico', 'maior']];
  const NOTAS = ['Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si', 'Dó', 'Dó♯'];
  const RE2 = 73.416;

  // Cenas: o "arranjo". Padrões em índices de notas do acorde (0 = fundamental, 1 = terça, 2 = quinta,
  // 3 = sétima, 4 = fundamental uma oitava acima...). div = 1 (semicolcheia) ou 2 (colcheia).
  const CENAS = {
    hipnose: {
      nome: 'Hipnose', bpm: 104, dens: 0.7, bri: 0.45, esp: 0.55,
      mix: { arp: 0.8, bai: 0.7, pad: 0.55, vid: 0.8, rit: 0.25 },
      prog: [0, 5, 0, 6], compassos: 2, pump: 0.25,
      arpA: { pat: [0, 1, 2, 4, 2, 1], div: 1, oit: 1, prob: 1, res: 7, dec: 0.22, env: 1.0, w2: 0.45 },
      arpB: { pat: [4, 6, 5, 7, 5], div: 1, oit: 2, prob: 0.75, res: 4, dec: 0.16, env: 1.4, w2: 0.8 },
      bai: { pat: [0, 0, 0, 0, 0, 0, 4, 0], div: 2, dec: 0.2 },
      rit: { tique: [1, 0, 0.4, 0, 0.7, 0, 0.4, 0.3], bumbo: [] }
    },
    pulso: {
      nome: 'Pulso', bpm: 120, dens: 0.85, bri: 0.55, esp: 0.45,
      mix: { arp: 0.8, bai: 0.85, pad: 0.4, vid: 0.7, rit: 0.6 },
      prog: [0, 3, 5, 4], compassos: 2, pump: 0.4,
      arpA: { pat: [0, 1, 2, 3, 4, 3, 2, 1], div: 1, oit: 1, prob: 1, res: 8, dec: 0.18, env: 1.2, w2: 0.5 },
      arpB: { pat: [4, 5, 6], div: 1, oit: 2, prob: 0.85, res: 5, dec: 0.12, env: 1.6, w2: 0.8 },
      bai: { pat: [0, 0, 4, 0, 0, 0, 4, 0], div: 2, dec: 0.16 },
      rit: { tique: [0.5, 0.2, 1, 0.2, 0.5, 0.2, 1, 0.4], bumbo: [0, 8] }
    },
    nevoa: {
      nome: 'Névoa', bpm: 84, dens: 0.55, bri: 0.3, esp: 0.75,
      mix: { arp: 0.6, bai: 0.55, pad: 0.85, vid: 0.95, rit: 0 },
      prog: [0, 5, 2, 6], compassos: 4, pump: 0.1,
      arpA: { pat: [0, 2, 4, 6, 4, 2, 1], div: 1, oit: 1, prob: 0.6, res: 5, dec: 0.35, env: 0.7, w2: 0.4 },
      arpB: { pat: [4, 6, 5, 7, 6], div: 2, oit: 2, prob: 0.6, res: 3, dec: 0.3, env: 1.0, w2: 0.9 },
      bai: { pat: [0, -1, -1, -1, 0, -1, -1, -1], div: 2, dec: 0.6 },
      rit: { tique: [], bumbo: [] }
    },
    vidro: {
      nome: 'Vidro', bpm: 96, dens: 0.6, bri: 0.6, esp: 0.7,
      mix: { arp: 0.55, bai: 0.4, pad: 0.6, vid: 1, rit: 0.15 },
      prog: [0, 4, 5, 3], compassos: 2, pump: 0.15,
      arpA: { pat: [0, 2, 1, 3, 2, 4], div: 2, oit: 1, prob: 0.8, res: 4, dec: 0.3, env: 0.8, w2: 0.3 },
      arpB: { pat: [4, 7, 6, 5, 8], div: 1, oit: 2, prob: 0.7, res: 3, dec: 0.2, env: 1.8, w2: 1 },
      bai: { pat: [0, -1, 0, -1, 0, -1, 4, -1], div: 2, dec: 0.35 },
      rit: { tique: [0.6, 0, 0, 0.3, 0, 0, 0.5, 0], bumbo: [] }
    },
    tensao: {
      nome: 'Tensão', bpm: 128, dens: 0.8, bri: 0.6, esp: 0.4,
      mix: { arp: 0.85, bai: 0.8, pad: 0.45, vid: 0.7, rit: 0.45 },
      prog: [0, 1, 5, 4], compassos: 1, pump: 0.35,
      arpA: { pat: [0, 2, 1, 4, 2, 5], div: 1, oit: 1, prob: 1, res: 11, dec: 0.15, env: 1.5, w2: 0.6 },
      arpB: { pat: [7, 5, 6, 4, 6, 5, 8], div: 1, oit: 2, prob: 0.8, res: 7, dec: 0.1, env: 2, w2: 0.9 },
      bai: { pat: [0, 0, 0, 0, 0, 0, 0, 0], div: 2, dec: 0.12 },
      rit: { tique: [1, 0.3, 0.6, 0.3, 1, 0.3, 0.6, 0.5], bumbo: [0, 6, 8] }
    }
  };

  const CSS = `
  .mk{font:13px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;color:#dfe6ee}
  .mk h3{margin:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8fa3b8;font-weight:600}
  .mk .mk-cenas{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
  .mk .mk-cenas button{flex:1 1 auto;background:#141b23;color:#c9d4df;border:1px solid #2a3542;border-radius:8px;padding:7px 8px;font:inherit;cursor:pointer}
  .mk .mk-cenas button.on{background:#e8f1ff;color:#0b1016;border-color:#e8f1ff}
  .mk .mk-l{display:grid;grid-template-columns:86px 1fr 34px;align-items:center;gap:8px;margin:7px 0}
  .mk .mk-l label{color:#aab8c6}
  .mk .mk-l output{color:#7f91a3;font-variant-numeric:tabular-nums;text-align:right;font-size:12px}
  .mk input[type=range]{width:100%;accent-color:#9cc8ff;margin:0}
  .mk select{background:#141b23;color:#dfe6ee;border:1px solid #2a3542;border-radius:6px;padding:4px 6px;font:inherit}
  .mk .mk-ton{display:flex;gap:6px}
  .mk .mk-ton select{flex:1}
  .mk .mk-auto{display:flex;align-items:center;gap:6px;margin:2px 0 6px 94px;color:#8fa3b8;font-size:12px}
  .mk details{margin-top:8px;border-top:1px solid #222c37;padding-top:6px}
  .mk summary{cursor:pointer;color:#8fa3b8;font-size:11px;letter-spacing:.14em;text-transform:uppercase;list-style:none}
  .mk summary::-webkit-details-marker{display:none}
  .mk summary::after{content:' +'}
  .mk details[open] summary::after{content:' −'}
  `;

  function MotorKnick(cfg) {
    cfg = cfg || {};
    const S = { cena: 'hipnose', tom: 0, modo: 'eolio', vol: 0.8, bpm: 104, dens: 0.7, auto: true, bri: 0.45, esp: 0.55,
      arp: 0.8, bai: 0.7, pad: 0.55, vid: 0.8, rit: 0.25 };
    Object.assign(S, cfg.padroes || {});
    const ouvintes = { nota: [], passo: [], acorde: [] };
    const emit = (tipo, d, t) => {
      const fns = ouvintes[tipo]; if (!fns.length) return;
      const ms = AC ? Math.max(0, (t - AC.currentTime) * 1000) : 0;
      setTimeout(() => { for (const fn of fns) try { fn(d); } catch (e) {} }, ms);
    };

    // ---------- áudio ----------
    let AC = null, master, saida, analisador, somaArp, somaPad, pumpG, delayIn, verbIn, delRet, verbRet, dL, dR, dFbL, dFbR;
    const bus = {};
    let padVozes = [], padF = null, timer = null, rodando = false;
    let passo = 0, proxT = 0, compasso = 0;
    let grauAcorde = 0, acordePedido = null, acordeObraAte = -1;
    let atividade = 0, energiaObra = 0, ultimaAtiv = 0, flash = 0;
    const filaVidro = [];
    let vozes = 0; const MAXV = cfg.maxVozes || 64;
    const cena = () => CENAS[S.cena] || CENAS.hipnose;
    const spb = () => 60 / S.bpm;                      // segundos por tempo
    const raiz = () => RE2 * Math.pow(2, (S.tom > 6 ? S.tom - 12 : S.tom) / 12);
    const escala = () => MODOS[S.modo] || MODOS.eolio;
    function semi(g) { g = Math.round(g); const e = escala(), k = e.length; return e[((g % k) + k) % k] + 12 * Math.floor(g / k); }
    const hz = (g, oit) => raiz() * Math.pow(2, oit + semi(g) / 12);
    // i-ésima nota do acorde (empilhado em terças: 1, 3, 5, 7; depois uma oitava acima)
    const grauDoAcorde = (i) => grauAcorde + [0, 2, 4, 6][((i % 4) + 4) % 4] + 7 * Math.floor(i / 4);

    function irGerado(seg, dec) {
      const sr = AC.sampleRate, n = Math.floor(sr * seg), b = AC.createBuffer(2, n, sr);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c); let lp = 0;
        for (let i = 0; i < n; i++) {
          const x = i / n, k = 0.08 + 0.85 * x;                    // fica mais escuro com o tempo
          lp += (Math.random() * 2 - 1 - lp) * (1 - k);
          d[i] = lp * Math.pow(1 - x, dec) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
        }
      }
      return b;
    }
    function curvaFita(a) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * (1 + a)) / Math.tanh(1 + a); } return c; }

    function montar() {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      try { AC = new Ctx({ latencyHint: 'playback' }); } catch (e) { AC = new Ctx(); }
      // saída: desvio de fita (wow) → saturação → compressor → volume → analisador
      const soma = AC.createGain();
      const wow = AC.createDelay(0.05); wow.delayTime.value = 0.006;
      const wl = AC.createOscillator(), wg = AC.createGain(); wl.frequency.value = 0.37; wg.gain.value = 0.00028; wl.connect(wg); wg.connect(wow.delayTime); wl.start();
      const fita = AC.createWaveShaper(); fita.curve = curvaFita(0.6); fita.oversample = '2x';
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
      const lim = AC.createDynamicsCompressor(); lim.threshold.value = -3; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
      master = AC.createGain(); saida = master;
      analisador = AC.createAnalyser(); analisador.fftSize = 2048;
      soma.connect(wow); wow.connect(fita); fita.connect(comp); comp.connect(lim); lim.connect(master); master.connect(analisador); master.connect(AC.destination);
      // "bombeamento": arpejos e pad respiram com o tempo
      pumpG = AC.createGain(); pumpG.connect(soma);
      // delay pingue-pongue no tempo (colcheia pontuada à esquerda, semínima à direita)
      delayIn = AC.createGain();
      const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280;
      dL = AC.createDelay(3); dR = AC.createDelay(3);
      dFbL = AC.createGain(); dFbR = AC.createGain();
      const lpL = AC.createBiquadFilter(), lpR = AC.createBiquadFilter(); lpL.type = lpR.type = 'lowpass'; lpL.frequency.value = 3200; lpR.frequency.value = 2600;
      const mg = AC.createChannelMerger(2); delRet = AC.createGain();
      delayIn.connect(hp); hp.connect(dL); dL.connect(lpL); lpL.connect(dFbL); dFbL.connect(dR); dR.connect(lpR); lpR.connect(dFbR); dFbR.connect(dL);
      lpL.connect(mg, 0, 0); lpR.connect(mg, 0, 1); mg.connect(delRet); delRet.connect(soma);
      // reverb longo e escuro
      verbIn = AC.createGain(); const conv = AC.createConvolver(); conv.buffer = irGerado(4.2, 2.6);
      verbRet = AC.createGain(); verbIn.connect(conv); conv.connect(verbRet); verbRet.connect(soma);
      delRet.connect(verbIn);
      // camadas: cada uma com volume e envios fixos (o "Espaço" regula as voltas)
      const camadas = { arpA: [pumpG, 0.35, 0.25], arpB: [pumpG, 0.55, 0.35], bai: [soma, 0.05, 0.08], pad: [pumpG, 0.1, 0.6], vid: [soma, 0.3, 0.7], rit: [soma, 0.15, 0.12] };
      for (const k in camadas) {
        const [dest, sd, sv] = camadas[k]; const g = AC.createGain(); g.connect(dest);
        const a = AC.createGain(); a.gain.value = sd; g.connect(a); a.connect(delayIn);
        const b = AC.createGain(); b.gain.value = sv; g.connect(b); b.connect(verbIn);
        bus[k] = g;
      }
      // pad: seis serras desafinadas que deslizam de um acorde para o outro
      padF = AC.createBiquadFilter(); padF.type = 'lowpass'; padF.Q.value = 0.9; padF.frequency.value = 700;
      const padG = AC.createGain(); padG.gain.value = 0.05; padF.connect(padG); padG.connect(bus.pad);
      const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 260; lfo.connect(lg); lg.connect(padF.frequency); lfo.start();
      for (let i = 0; i < 6; i++) {
        const o = AC.createOscillator(); o.type = 'sawtooth'; o.detune.value = (i % 2 ? 1 : -1) * (5 + i * 2);
        const pn = AC.createStereoPanner ? AC.createStereoPanner() : null; const g = AC.createGain(); g.gain.value = 0;
        o.connect(g); if (pn) { pn.pan.value = (i % 2 ? 0.55 : -0.55); g.connect(pn); pn.connect(padF); } else g.connect(padF);
        o.start(); padVozes.push({ o, g });
      }
      aplicar(); acordePad(0.01);
    }

    function aplicar() {
      if (!AC) return;
      const t = AC.currentTime, c = cena();
      master.gain.setTargetAtTime(S.vol * 1.25, t, 0.08);
      const e = S.esp;
      delRet.gain.setTargetAtTime(0.15 + e * 0.95, t, 0.1);
      verbRet.gain.setTargetAtTime(e * 1.1, t, 0.15);
      const fb = 0.18 + e * 0.42; dFbL.gain.setTargetAtTime(fb, t, 0.1); dFbR.gain.setTargetAtTime(fb, t, 0.1);
      dL.delayTime.setTargetAtTime(spb() * 0.75, t, 0.2); dR.delayTime.setTargetAtTime(spb() * 0.5, t, 0.2);
      bus.arpA.gain.setTargetAtTime(S.arp, t, 0.08); bus.arpB.gain.setTargetAtTime(S.arp * 0.8, t, 0.08);
      bus.bai.gain.setTargetAtTime(S.bai, t, 0.08); bus.pad.gain.setTargetAtTime(S.pad, t, 0.3);
      bus.vid.gain.setTargetAtTime(S.vid, t, 0.08); bus.rit.gain.setTargetAtTime(S.rit, t, 0.08);
      padF.frequency.setTargetAtTime(300 + Math.pow(S.bri, 1.6) * 2600, t, 0.5);
    }
    function acordePad(glide) {
      if (!AC) return;
      const t = AC.currentTime, nv = [0, 1, 2, 0, 2, 3].map((i, k) => hz(grauDoAcorde(i), k < 3 ? 1 : 2));
      padVozes.forEach((v, i) => { v.o.frequency.setTargetAtTime(nv[i], t, glide); v.g.gain.setTargetAtTime(i === 0 ? 0.7 : 0.6, t, 1.2); });
    }

    // ---------- vozes ----------
    const dur = (end) => { vozes++; setTimeout(() => vozes--, Math.max(60, (end - AC.currentTime) * 1000 + 80)); };
    const livre = () => vozes < MAXV;
    function painel(node, pan, k) {
      if (AC.createStereoPanner && pan) { const p = AC.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); p.connect(bus[k]); }
      else node.connect(bus[k]);
    }
    // sintetizador analógico arpejado: serra + pulso, filtro passa-baixa de 24 dB com envelope
    function pluck(k, f, t, vel, pan, o) {
      if (!livre()) return;
      const m = Math.pow(2, (S.bri - 0.5) * 4) * (1 + flash * 0.8);
      const base = Math.min(9000, f * 1.1 * m + 120 * m), pico = Math.min(16000, base * (2 + o.env * 3));
      const g = AC.createGain(), f1 = AC.createBiquadFilter(), f2 = AC.createBiquadFilter();
      f1.type = f2.type = 'lowpass'; f1.Q.value = o.res * (0.7 + 0.3 * S.bri); f2.Q.value = 0.6;
      const a = AC.createOscillator(); a.type = 'sawtooth'; a.frequency.value = f; a.detune.value = (Math.random() - 0.5) * 9;
      const b = AC.createOscillator(); b.type = 'square'; b.frequency.value = f; b.detune.value = 6 + (Math.random() - 0.5) * 7;
      const bg = AC.createGain(); bg.gain.value = o.w2;
      a.connect(f1); b.connect(bg); bg.connect(f1); f1.connect(f2); f2.connect(g);
      const d = o.dec * (0.8 + S.esp * 0.4);
      for (const fl of [f1, f2]) { fl.frequency.setValueAtTime(pico, t); fl.frequency.setTargetAtTime(base, t + 0.002, d * 0.3); }
      const lvl = 0.085 * vel;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.003); g.gain.setTargetAtTime(0, t + 0.012, d * 0.45);
      const end = t + d * 3 + 0.05;
      painel(g, pan, k); dur(end);
      a.start(t); b.start(t); a.stop(end); b.stop(end);
    }
    function baixo(f, t, vel, d) {
      if (!livre()) return;
      const m = Math.pow(2, (S.bri - 0.5) * 2.5);
      const g = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5;
      const s = AC.createOscillator(); s.type = 'sine'; s.frequency.value = f;
      const w = AC.createOscillator(); w.type = 'sawtooth'; w.frequency.value = f; w.detune.value = -4;
      const sg = AC.createGain(); sg.gain.value = 0.6; const wg = AC.createGain(); wg.gain.value = 0.55;
      s.connect(sg); sg.connect(g); w.connect(wg); wg.connect(lp); lp.connect(g);
      lp.frequency.setValueAtTime(Math.min(4000, f * 9 * m), t); lp.frequency.setTargetAtTime(f * 1.6 * m, t + 0.002, 0.06);
      const lvl = 0.13 * vel; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.004); g.gain.setTargetAtTime(0, t + d * 0.6, d * 0.35);
      const end = t + d * 2 + 0.1; g.connect(bus.bai); dur(end);
      s.start(t); w.start(t); s.stop(end); w.stop(end);
    }
    // vidro: seno com parciais de vidro, vibrato lento e coro (aproximação do Cristal Baschet)
    function vidro(f, t, vel, pan) {
      if (!livre()) return;
      const g = AC.createGain(), lvl = 0.07 * vel;
      const vib = AC.createOscillator(), vg = AC.createGain(); vib.frequency.value = 4.6 + Math.random(); vg.gain.value = f * 0.004;
      vib.connect(vg);
      const parts = [[1, 1, 0], [1.0035, 0.55, 0], [2.0, 0.22, 0], [3.01, 0.09, 0], [4.95, 0.04, 0]];
      const os = parts.map(([r, a]) => { const o = AC.createOscillator(); o.frequency.value = f * r; vg.connect(o.frequency); const og = AC.createGain(); og.gain.value = a; o.connect(og); og.connect(g); return o; });
      const d = 2.6 + S.esp * 2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.045); g.gain.setTargetAtTime(lvl * 0.45, t + 0.05, 0.25); g.gain.setTargetAtTime(0, t + 0.4, d * 0.3);
      const end = t + d + 0.2; painel(g, pan, 'vid'); dur(end);
      vib.start(t); vib.stop(end); for (const o of os) { o.start(t); o.stop(end); }
    }
    let ruido = null;
    function tique(t, vel, pan) {
      if (!livre()) return;
      if (!ruido) { ruido = AC.createBuffer(1, AC.sampleRate * 0.25 | 0, AC.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = AC.createBufferSource(); s.buffer = ruido;
      const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
      const bp = AC.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 9500; bp.gain.value = 6;
      const g = AC.createGain(); const d = 0.025 + vel * 0.03;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * vel, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(hp); hp.connect(bp); bp.connect(g); painel(g, pan, 'rit'); dur(t + d);
      s.start(t, Math.random() * 0.2); s.stop(t + d + 0.01);
    }
    function bumbo(t, vel) {
      if (!livre()) return;
      const o = AC.createOscillator(), g = AC.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g); g.connect(bus.rit); dur(t + 0.4); o.start(t); o.stop(t + 0.42);
    }

    // ---------- relógio ----------
    function energiaAtual() {
      const ag = (performance.now() - ultimaAtiv) / 1000;
      const a = Math.max(atividade * Math.exp(-ag / 7), energiaObra);
      return S.auto ? S.dens * (0.5 + 0.5 * Math.min(1, a)) : S.dens;
    }
    // quanto uma camada toca dada a energia (entra suavemente em vez de ligar de uma vez)
    const entra = (E, limiar) => Math.max(0, Math.min(1, (E - limiar) / 0.15));

    function agendar(p, t) {
      const c = cena(), E = energiaAtual(), q = spb() / 4;
      const pc = p % 16;
      if (pc === 0) {
        compasso = Math.floor(p / 16);
        if (acordePedido == null && compasso > acordeObraAte && compasso % c.compassos === 0) {
          const g = c.prog[Math.floor(compasso / c.compassos) % c.prog.length];
          if (g !== grauAcorde) { grauAcorde = g; acordePad(spb() * 1.5); emit('acorde', { grau: g }, t); }
        }
      }
      if (acordePedido != null && pc % 4 === 0) {
        grauAcorde = acordePedido; acordePedido = null; acordeObraAte = compasso + 1; acordePad(spb()); emit('acorde', { grau: grauAcorde }, t);
      }
      // bombeamento no tempo
      if (pc % 4 === 0 && c.pump > 0) {
        const pmp = c.pump * (0.5 + 0.5 * E);
        pumpG.gain.cancelScheduledValues(t); pumpG.gain.setValueAtTime(1 - pmp, t); pumpG.gain.setTargetAtTime(1, t + 0.02, spb() * 0.28);
      }
      const notas = [];
      // arpejo A (o motor principal)
      const A = c.arpA, iA = Math.floor(p / A.div);
      if (p % A.div === 0 && Math.random() < A.prob * entra(E, 0.12)) {
        const g = grauDoAcorde(A.pat[iA % A.pat.length]), f = hz(g, A.oit), v = (pc % 4 === 0 ? 1 : 0.72) * (0.6 + 0.4 * E);
        pluck('arpA', f, t, v, iA % 2 ? 0.25 : -0.25, A); notas.push({ camada: 'arpA', grau: g, freq: f, forca: v });
      }
      // arpejo B (agudo, comprimento diferente → fase que gira)
      const B = c.arpB, iB = Math.floor(p / B.div);
      if (p % B.div === 0 && Math.random() < B.prob * entra(E, 0.42)) {
        const g = grauDoAcorde(B.pat[iB % B.pat.length]), f = hz(g, B.oit), v = 0.55 + 0.35 * E;
        pluck('arpB', f, t + q * 0.02, v, iB % 2 ? 0.6 : -0.6, B); notas.push({ camada: 'arpB', grau: g, freq: f, forca: v });
      }
      // baixo
      const Bx = c.bai, iX = Math.floor(p / Bx.div);
      if (p % Bx.div === 0 && entra(E, 0.04) > Math.random()) {
        const ix = Bx.pat[iX % Bx.pat.length];
        if (ix >= 0) { const g = grauDoAcorde(ix), f = hz(g, 0); baixo(f, t, pc % 8 === 0 ? 1 : 0.8, Bx.dec * spb() * 2); notas.push({ camada: 'baixo', grau: g, freq: f, forca: 1 }); }
      }
      // ritmo
      const R = c.rit, er = entra(E, 0.7);
      if (er > 0) {
        const tv = R.tique.length ? R.tique[pc % R.tique.length] : 0;
        if (tv > 0 && Math.random() < er) tique(t, tv, (Math.random() - 0.5) * 0.6);
        if (R.bumbo.indexOf(pc) >= 0) { bumbo(t, er); notas.push({ camada: 'bumbo', forca: er }); }
      }
      // vidro: eventos da obra entram aqui, no pulso
      if (filaVidro.length) {
        filaVidro.sort((a, b) => b.forca - a.forca);
        const maxN = p % 2 === 0 ? 2 : 1;
        for (let i = 0; i < maxN && filaVidro.length; i++) {
          const ev = filaVidro.shift(); const f = hz(ev.grau, 3);
          vidro(f, t, 0.5 + 0.5 * ev.forca, ev.pan); notas.push({ camada: 'vidro', grau: ev.grau, freq: f, forca: ev.forca, pan: ev.pan });
        }
        if (filaVidro.length > 6) filaVidro.length = 6;
      }
      flash *= 0.85;
      for (const n of notas) emit('nota', n, t);
      emit('passo', { passo: p, compasso, tempo: pc >> 2, energia: E, acorde: grauAcorde }, t);
    }
    function relogio() {
      if (!AC || !rodando) return;
      while (proxT < AC.currentTime + 0.14) { agendar(passo, proxT); proxT += spb() / 4; passo++; }
    }
    function ligarRelogio() {
      // Worker para o relógio não engasgar quando a aba perde o foco
      try {
        const w = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),25)'], { type: 'text/javascript' })));
        w.onmessage = relogio; timer = w;
      } catch (e) { timer = setInterval(relogio, 25); }
    }

    // ---------- API ----------
    const M = {
      MODOS, NOTAS, CENAS, S,
      get AC() { return AC; }, get saida() { return saida; }, get analisador() { return analisador; }, get rodando() { return rodando; },
      iniciar() {
        if (!AC) { montar(); }
        if (AC.state === 'suspended') AC.resume();
        if (!rodando) { rodando = true; proxT = AC.currentTime + 0.08; if (!timer) ligarRelogio(); }
        return AC.resume ? AC.resume() : Promise.resolve();
      },
      parar() { rodando = false; if (AC) AC.suspend(); },
      // algo aconteceu na obra: grau da escala (inteiro; 0 = tônica), forca 0..1, pan −1..1
      evento(grau, o) {
        o = o || {}; const forca = o.forca == null ? 0.7 : o.forca;
        filaVidro.push({ grau: Math.round(grau), forca, pan: o.pan || 0 });
        atividade = Math.min(1, atividade * Math.exp(-(performance.now() - ultimaAtiv) / 7000) + 0.06 + forca * 0.06); ultimaAtiv = performance.now();
        flash = Math.min(1, flash + forca * 0.5);
      },
      // a partir de uma frequência: vai para o grau da escala mais próximo
      nota(f, o) {
        if (!(f > 0)) return;
        const s = 12 * Math.log2(f / raiz()); let best = 0, bd = 1e9;
        for (let g = -14; g <= 49; g++) { const d = Math.abs(semi(g) - s); if (d < bd) { bd = d; best = g; } }
        // o vidro soa três oitavas acima da raiz: mantém a nota e dobra para a região do vidro (≈ 450–1800 Hz)
        let g = best - 21; while (g < -3) g += 7; while (g > 11) g -= 7;
        M.evento(g, o);
      },
      acorde(g) { acordePedido = Math.round(g); },
      energia(x) { energiaObra = Math.max(0, Math.min(1, x)); },
      on(tipo, fn) { (ouvintes[tipo] = ouvintes[tipo] || []).push(fn); },
      hz, semi, grauDoAcorde, get grauAcorde() { return grauAcorde; },
      nomeAcorde() {
        const r0 = semi(grauAcorde), t3 = semi(grauAcorde + 2) - r0, t5 = semi(grauAcorde + 4) - r0;
        const q = t3 === 4 && t5 === 7 ? '' : t3 === 3 && t5 === 7 ? 'm' : t3 === 3 && t5 === 6 ? 'º' : t3 === 4 && t5 === 8 ? '+' : '';
        return NOTAS[(((r0 + S.tom) % 12) + 12) % 12] + q;
      },
      set(k, v) { if (k === 'cena') aplicarCena(v); else { S[k] = v; if (k === 'tom' || k === 'modo') acordePad(0.6); aplicar(); } },
      painel: montarPainel
    };

    function aplicarCena(nome, mexerControles) {
      const c = CENAS[nome]; if (!c) return; S.cena = nome;
      if (mexerControles !== false) {
        const vals = { mkBpm: c.bpm, mkDens: c.dens, mkBri: c.bri, mkEsp: c.esp, mkArp: c.mix.arp, mkBai: c.mix.bai, mkPad: c.mix.pad, mkVid: c.mix.vid, mkRit: c.mix.rit };
        const chave = { mkBpm: 'bpm', mkDens: 'dens', mkBri: 'bri', mkEsp: 'esp', mkArp: 'arp', mkBai: 'bai', mkPad: 'pad', mkVid: 'vid', mkRit: 'rit' };
        for (const id in vals) {
          const el = raizPainel && raizPainel.querySelector('#' + id);
          if (el) { el.value = vals[id]; el.dispatchEvent(new Event('input', { bubbles: true })); } else S[chave[id]] = vals[id];
        }
        aplicar();
      }
      if (raizPainel) raizPainel.querySelectorAll('.mk-cenas button').forEach(b => b.classList.toggle('on', b.dataset.c === nome));
    }

    // ---------- painel simplificado ----------
    let raizPainel = null;
    function montarPainel(alvo) {
      if (!document.getElementById('mk-css')) { const st = document.createElement('style'); st.id = 'mk-css'; st.textContent = CSS; document.head.appendChild(st); }
      const el = document.createElement('div'); el.className = 'mk'; raizPainel = el;
      const lin = (id, lab, min, max, step, v, fmt) => `<div class="mk-l"><label for="${id}">${lab}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}" data-fmt="${fmt || 'pct'}"><output></output></div>`;
      el.innerHTML = `<h3>Som</h3>
        <div class="mk-cenas">${Object.keys(CENAS).map(k => `<button type="button" data-c="${k}" class="${k === S.cena ? 'on' : ''}">${CENAS[k].nome}</button>`).join('')}</div>
        <select id="mkCena" hidden>${Object.keys(CENAS).map(k => `<option value="${k}"${k === S.cena ? ' selected' : ''}>${CENAS[k].nome}</option>`).join('')}</select>
        <div class="mk-l"><label>Tonalidade</label><div class="mk-ton" style="grid-column:span 2">
          <select id="mkTom" aria-label="Tônica">${NOTAS.map((n, i) => `<option value="${i}"${i === S.tom ? ' selected' : ''}>${n}</option>`).join('')}</select>
          <select id="mkModo" aria-label="Modo">${MODOS_NOME.map(([k, n]) => `<option value="${k}"${k === S.modo ? ' selected' : ''}>${n}</option>`).join('')}</select></div></div>
        ${lin('mkVol', 'Volume', 0, 1, 0.01, S.vol)}
        ${lin('mkBpm', 'Andamento', 60, 150, 1, S.bpm, 'bpm')}
        ${lin('mkDens', 'Densidade', 0, 1, 0.01, S.dens)}
        <label class="mk-auto"><input type="checkbox" id="mkAuto"${S.auto ? ' checked' : ''}> a obra comanda</label>
        ${lin('mkBri', 'Brilho', 0, 1, 0.01, S.bri)}
        ${lin('mkEsp', 'Espaço', 0, 1, 0.01, S.esp)}
        <details><summary>Mistura</summary>
          ${lin('mkArp', 'Arpejos', 0, 1.2, 0.01, S.arp)}${lin('mkBai', 'Baixo', 0, 1.2, 0.01, S.bai)}${lin('mkPad', 'Pad', 0, 1.2, 0.01, S.pad)}
          ${lin('mkVid', 'Obra', 0, 1.2, 0.01, S.vid)}${lin('mkRit', 'Ritmo', 0, 1.2, 0.01, S.rit)}
        </details>`;
      (typeof alvo === 'string' ? document.querySelector(alvo) : alvo).appendChild(el);
      const mapa = { mkVol: 'vol', mkBpm: 'bpm', mkDens: 'dens', mkBri: 'bri', mkEsp: 'esp', mkArp: 'arp', mkBai: 'bai', mkPad: 'pad', mkVid: 'vid', mkRit: 'rit' };
      const out = (inp) => { const o = inp.parentNode.querySelector('output'); if (o) o.textContent = inp.dataset.fmt === 'bpm' ? inp.value : Math.round(inp.value * 100); };
      for (const id in mapa) {
        const inp = el.querySelector('#' + id); out(inp);
        inp.addEventListener('input', () => { S[mapa[id]] = parseFloat(inp.value); out(inp); aplicar(); });
      }
      const sc = el.querySelector('#mkCena');
      sc.addEventListener('change', () => aplicarCena(sc.value));
      sc.addEventListener('input', () => aplicarCena(sc.value));
      el.querySelectorAll('.mk-cenas button').forEach(b => b.addEventListener('click', () => { sc.value = b.dataset.c; sc.dispatchEvent(new Event('change', { bubbles: true })); }));
      el.querySelector('#mkTom').addEventListener('change', e => { S.tom = +e.target.value; acordePad(0.6); });
      el.querySelector('#mkModo').addEventListener('change', e => { S.modo = e.target.value; acordePad(0.6); });
      el.querySelector('#mkAuto').addEventListener('change', e => { S.auto = e.target.checked; });
      return el;
    }
    if (cfg.painel) montarPainel(cfg.painel);
    return M;
  }

  MotorKnick.CENAS = CENAS;
  global.MotorKnick = MotorKnick;
})(typeof window !== 'undefined' ? window : this);
