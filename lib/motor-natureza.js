/* =====================================================================
   Motor Natureza — motor de som das obras da aba "Natureza"
   (o Motor Knick fica só para as Conjecturas)

   Estética: música ambiental japonesa dos anos 80 (kankyō ongaku — Hiroshi
   Yoshimura, "Green"; Satoshi Ashikawa) e o "On Land" de Brian Eno. Nada de
   grade nem metrônomo: o tempo é livre, como chuva ou canto de pássaro.
   - Vozes acústicas sintetizadas por modelos simples de objetos que vibram:
     madeira (marimba de bambu), gota d'água, sino de metal (parciais
     inarmônicas), cristal, sopro (flauta de ar), kalimba e corda dedilhada.
   - Afinação natural (razões simples da série harmônica), escalas abertas
     (pentatônicas, yo, hirajoshi, série harmônica).
   - Bordão que respira: os harmônicos da fundamental sobem e descem sozinhos,
     como uma tambura.
   - Paisagem sintetizada que reage à obra: vento, água, chuva, grilos, pássaros.
   - Ar livre: reverberação longa e clara e um eco distante, sem pulso.

   A interface é a mesma do Motor Knick, então as obras trocam um pelo outro:
     const M = MotorNatureza({ painel: elemento, obra: 'micelio' });
     M.iniciar();                          // num gesto do usuário
     M.evento(grau, { forca, pan, voz });  // algo aconteceu → nota (grau da escala)
     M.nota(freqHz, { forca, pan, voz, exata }); // a partir de uma frequência (exata: não afina na escala)
     M.memorizar(freqHz, forca);           // altura de uma voz contínua da obra → memória da paisagem
     M.acorde(grau) / M.bordao(freqHz);    // muda o bordão (desliza devagar)
     M.pulso(forca);                       // choque sem nota: gravetos/gotas e energia
     M.energia(0..1); M.on('nota'|'passo'|'acorde', fn); M.saida; M.analisador

   Controles (iguais em todas as obras da aba): Ambiente, Tonalidade +
   Escala + Afinação, Voz, Volume, Vida (+ "a obra comanda"), Brilho, Espaço
   e, recolhida, a Mistura (Vozes, Bordão, Paisagem). Ids com prefixo "mn".
   ===================================================================== */
(function (global) {
  'use strict';

  const MODOS = {
    pentaMaior: [0, 2, 4, 7, 9], penta: [0, 3, 5, 7, 10], yo: [0, 2, 5, 7, 9], hirajoshi: [0, 2, 3, 7, 8],
    lidio: [0, 2, 4, 6, 7, 9, 11], jonico: [0, 2, 4, 5, 7, 9, 11], dorico: [0, 2, 3, 5, 7, 9, 10], eolio: [0, 2, 3, 5, 7, 8, 10],
    serie: [0, 2, 4, 5.51, 7, 8.41, 9.69, 10.88]   // harmônicos 8 a 15
  };
  const MODOS_NOME = [['pentaMaior', 'pentatônica'], ['penta', 'penta menor'], ['yo', 'yo (japonesa)'], ['hirajoshi', 'hirajoshi'],
    ['serie', 'série harmônica'], ['lidio', 'lídio'], ['jonico', 'maior'], ['dorico', 'dórico'], ['eolio', 'menor']];
  // afinação natural: cada semitom vira uma razão simples
  const JUSTA = { 0: 1, 1: 16 / 15, 2: 9 / 8, 3: 6 / 5, 4: 5 / 4, 5: 4 / 3, 6: 45 / 32, 7: 3 / 2, 8: 8 / 5, 9: 5 / 3, 10: 9 / 5, 11: 15 / 8 };
  const SERIE = [1, 9 / 8, 5 / 4, 11 / 8, 3 / 2, 13 / 8, 7 / 4, 15 / 8];
  const NOTAS = ['Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si', 'Dó', 'Dó♯'];
  const RE2 = 73.416;
  const VOZES = [['obra', 'a de cada elemento'], ['madeira', 'Madeira'], ['gota', 'Gota'], ['sino', 'Sino'], ['cristal', 'Cristal'],
    ['sopro', 'Sopro'], ['kalimba', 'Kalimba'], ['corda', 'Corda']];
  // faixa em que cada voz soa bem (Hz): a nota é dobrada de oitava até caber
  const FAIXA = { madeira: [140, 1400], gota: [500, 3200], sino: [180, 1800], cristal: [600, 3600], sopro: [220, 1500], kalimba: [260, 2000], corda: [110, 1300] };

  // Ambientes: paisagem (vento, água, chuva, grilos, pássaros: 0..1), voz padrão e posição dos controles
  const CENAS = {
    floresta: { nome: 'Floresta', voz: 'madeira', vida: 0.55, bri: 0.5, esp: 0.55, mix: { voz: 0.85, bor: 0.45, amb: 0.5 },
      pais: { vento: 0.3, agua: 0, chuva: 0, grilos: 0, passaros: 0.6 } },
    agua: { nome: 'Água', voz: 'gota', vida: 0.6, bri: 0.55, esp: 0.65, mix: { voz: 0.85, bor: 0.4, amb: 0.55 },
      pais: { vento: 0.1, agua: 0.75, chuva: 0, grilos: 0, passaros: 0.1 } },
    vento: { nome: 'Vento', voz: 'sopro', vida: 0.45, bri: 0.4, esp: 0.7, mix: { voz: 0.8, bor: 0.6, amb: 0.6 },
      pais: { vento: 0.85, agua: 0, chuva: 0, grilos: 0, passaros: 0.15 } },
    chuva: { nome: 'Chuva', voz: 'kalimba', vida: 0.65, bri: 0.45, esp: 0.6, mix: { voz: 0.8, bor: 0.45, amb: 0.6 },
      pais: { vento: 0.25, agua: 0.2, chuva: 0.8, grilos: 0, passaros: 0 } },
    noite: { nome: 'Noite', voz: 'cristal', vida: 0.4, bri: 0.3, esp: 0.8, mix: { voz: 0.8, bor: 0.55, amb: 0.45 },
      pais: { vento: 0.15, agua: 0, chuva: 0, grilos: 0.65, passaros: 0 } }
  };

  // Identidade de cada obra da aba: ambiente de base, tonalidade, escala, afinação e a paisagem própria.
  // tom: 0 = Ré, 1 = Mi♭, 2 = Mi, 3 = Fá, 4 = Fá♯, 5 = Sol, 6 = Lá♭, 7 = Lá, 8 = Si♭, 9 = Si, 10 = Dó, 11 = Dó♯.
  const ID = (base, tom, modo, afin, extra) => Object.assign({ base, tom, modo, afin }, extra || {});
  const IDENTIDADES = {
    'micelio': ID('agua', 2, 'hirajoshi', 'natural', { nome: 'Placa úmida', voz: 'madeira', vida: 0.55, bri: 0.42, esp: 0.7,
      pais: { vento: 0.05, agua: 0.45, chuva: 0, grilos: 0.12, passaros: 0 } }),
    'harmonia-das-esferas': ID('noite', 0, 'serie', 'natural', { nome: 'Esferas', voz: 'sino', vida: 0.5, bri: 0.45, esp: 0.85,
      mix: { voz: 0.85, bor: 0.6, amb: 0.3 }, pais: { vento: 0.2, agua: 0, chuva: 0, grilos: 0.1, passaros: 0 } }),
    'ceraunoscopio': ID('chuva', 7, 'penta', 'natural', { nome: 'Tempestade', voz: 'sino', pais: { vento: 0.5, agua: 0, chuva: 0.7, grilos: 0, passaros: 0 } }),
    'raios-nas-maos': ID('chuva', 7, 'penta', 'natural', { nome: 'Tempestade', voz: 'sino', pais: { vento: 0.5, agua: 0, chuva: 0.7, grilos: 0, passaros: 0 } }),
    'dente-de-leao': ID('vento', 5, 'yo', 'natural', { nome: 'Campo', voz: 'sopro', pais: { vento: 0.7, agua: 0, chuva: 0, grilos: 0.2, passaros: 0.3 } })
  };
  const slugDaPagina = () => { try { const p = location.pathname.split('/').filter(Boolean); for (let i = p.length - 1; i >= 0; i--) if (IDENTIDADES[p[i]]) return p[i]; } catch (e) {} return null; };
  function cenaDaObra(I) {
    const b = CENAS[I.base] || CENAS.floresta;
    return { nome: I.nome || 'Obra', voz: I.voz || b.voz, vida: I.vida != null ? I.vida : b.vida, bri: I.bri != null ? I.bri : b.bri,
      esp: I.esp != null ? I.esp : b.esp, mix: Object.assign({}, b.mix, I.mix), pais: Object.assign({}, b.pais, I.pais) };
  }

  const CSS = `
  .mn{margin-bottom:16px;font:13px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;color:#e3ebe2}
  .mn h3{margin:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#93ad94;font-weight:600}
  .mn .mn-cenas{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
  .mn .mn-cenas button{flex:1 1 auto;background:#151d17;color:#cbd9cb;border:1px solid #2b3a2e;border-radius:8px;padding:7px 8px;font:inherit;cursor:pointer}
  .mn .mn-cenas button.on{background:#e6f4e3;color:#0d150f;border-color:#e6f4e3}
  .mn .mn-l{display:grid;grid-template-columns:86px 1fr 34px;align-items:center;gap:8px;margin:7px 0}
  .mn .mn-l label{color:#adc0ad}
  .mn .mn-l output{color:#83998a;font-variant-numeric:tabular-nums;text-align:right;font-size:12px}
  .mn input[type=range]{width:100%;accent-color:#a6d8a0;margin:0}
  .mn select{background:#151d17;color:#e3ebe2;border:1px solid #2b3a2e;border-radius:6px;padding:4px 6px;font:inherit;min-width:0}
  .mn .mn-ton{display:flex;gap:6px}
  .mn .mn-ton select{flex:1}
  .mn .mn-auto{display:flex;align-items:center;gap:6px;margin:2px 0 6px 94px;color:#93ad94;font-size:12px}
  .mn details{margin-top:8px;border-top:1px solid #233026;padding-top:6px}
  .mn summary{cursor:pointer;color:#93ad94;font-size:11px;letter-spacing:.14em;text-transform:uppercase;list-style:none}
  .mn summary::-webkit-details-marker{display:none}
  .mn summary::after{content:' +'}
  .mn details[open] summary::after{content:' −'}
  `;

  function MotorNatureza(cfg) {
    cfg = cfg || {};
    const S = { cena: 'floresta', tom: 0, modo: 'pentaMaior', afin: 'natural', voz: 'obra', vol: 0.8, vida: 0.55, auto: true,
      bri: 0.5, esp: 0.55, mvoz: 0.85, bor: 0.45, amb: 0.5 };
    const IDT = cfg.identidade || (cfg.obra !== false ? IDENTIDADES[cfg.obra || slugDaPagina()] : null) || null;
    const CEN = IDT ? Object.assign({ obra: cenaDaObra(IDT) }, CENAS) : CENAS;
    const daCena = (c) => ({ vida: c.vida, bri: c.bri, esp: c.esp, mvoz: c.mix.voz, bor: c.mix.bor, amb: c.mix.amb });
    if (IDT) Object.assign(S, { cena: 'obra', tom: IDT.tom, modo: IDT.modo, afin: IDT.afin || 'natural' }, daCena(CEN.obra));
    else Object.assign(S, daCena(CENAS.floresta));
    Object.assign(S, cfg.padroes || {});
    const cena = () => CEN[S.cena] || CEN.floresta || CENAS.floresta;

    const ouvintes = { nota: [], passo: [], acorde: [] };
    function emit(tipo, d, t) {
      const fs = ouvintes[tipo]; if (!fs || !fs.length) return;
      const ms = AC && t ? Math.max(0, (t - AC.currentTime) * 1000) : 0;
      const run = () => { for (const fn of fs) try { fn(d); } catch (e) {} };
      if (ms > 4) setTimeout(run, ms); else run();
    }

    // ---------- afinação ----------
    const escala = () => MODOS[S.modo] || MODOS.pentaMaior;
    const raiz = () => RE2 * Math.pow(2, (S.tom > 6 ? S.tom - 12 : S.tom) / 12);
    function semi(g) { g = Math.round(g); const e = escala(), k = e.length; return e[((g % k) + k) % k] + 12 * Math.floor(g / k); }
    // razão do grau g em relação à raiz (afinação natural ou temperada)
    function razao(g) {
      g = Math.round(g); const e = escala(), k = e.length, i = ((g % k) + k) % k, o = Math.floor(g / k);
      if (S.afin === 'temperada') return Math.pow(2, o + e[i] / 12);
      if (S.modo === 'serie') return Math.pow(2, o) * SERIE[i];
      return Math.pow(2, o) * (JUSTA[Math.round(e[i]) % 12] || Math.pow(2, e[i] / 12));
    }
    const hz = (g, oit) => raiz() * Math.pow(2, oit || 0) * razao(g);
    const grauDoAcorde = (i) => grauAcorde + [0, 2, 4][((i % 3) + 3) % 3] + escala().length * Math.floor(i / 3);
    // frequência → grau mais próximo (a partir da raiz)
    function grauDe(f) {
      const alvo = Math.log2(f / raiz()); let best = 0, bd = 1e9;
      for (let g = -20; g <= 60; g++) { const d = Math.abs(Math.log2(razao(g)) - alvo); if (d < bd) { bd = d; best = g; } }
      return best;
    }
    function caber(f, voz) { const [lo, hi] = FAIXA[voz] || [150, 2000]; let k = 0; while (f < lo && k++ < 8) f *= 2; while (f > hi && k++ < 16) f /= 2; return f; }

    // ---------- áudio ----------
    let AC = null, master, saida, analisador, soma, verbIn, verbRet, ecoIn, ecoRet, ecoD, ecoFb, rodando = false, mudo = false, timer = null, vidTimer = 0;
    const bus = {};
    let ruidoB = null, ruidoM = null;   // ruído branco e marrom (laços de 4 s)
    let bordaoOsc = [], bordaoF = null, bordaoBase = null, grauAcorde = 0, bordaoLivre = null;
    const pais = {};                    // nós da paisagem
    let vozes = 0, leve = !!cfg.leve; const MAXV = cfg.maxVozes || 40;
    let atividade = 0, energiaObra = 0, ultimaAtiv = 0;
    const mem = []; let ultimoEv = 0, ultNota = 0;
    const vid = { on: false, lum: 0.5, mov: 0, cx: 0.5, cy: 0.5 };

    function irGerado(seg) {
      const sr = AC.sampleRate, n = Math.floor(sr * seg), b = AC.createBuffer(2, n, sr);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c); let lp = 0;
        for (let i = 0; i < n; i++) {
          const x = i / n, k = 0.02 + 0.6 * x;                  // claro no começo, escurece devagar (ar livre)
          lp += (Math.random() * 2 - 1 - lp) * (1 - k);
          // primeiras reflexões esparsas (árvores, pedras) e cauda longa
          const er = i < sr * 0.12 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 1.6 : 0;
          d[i] = (lp * Math.pow(1 - x, 2.1) + er) * (i < sr * 0.02 ? i / (sr * 0.02) : 1);
        }
      }
      return b;
    }
    function ruidos() {
      const sr = AC.sampleRate, n = sr * 4;
      ruidoB = AC.createBuffer(1, n, sr); ruidoM = AC.createBuffer(1, n, sr);
      const b = ruidoB.getChannelData(0), m = ruidoM.getChannelData(0); let u = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b[i] = w; u = (u + 0.02 * w) / 1.02; m[i] = u * 3.5; }
    }
    function laco(buf) { const s = AC.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 3.5); return s; }

    function montar() {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      try { AC = new Ctx({ latencyHint: 'playback' }); } catch (e) { AC = new Ctx(); }
      ruidos();
      soma = AC.createGain();
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 2.5; comp.attack.value = 0.02; comp.release.value = 0.4;
      const lim = AC.createDynamicsCompressor(); lim.threshold.value = -3; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
      master = AC.createGain(); saida = master;
      analisador = AC.createAnalyser(); analisador.fftSize = 2048;
      soma.connect(comp); comp.connect(lim); lim.connect(master); master.connect(analisador); master.connect(AC.destination);
      // ar livre: reverberação longa e clara
      verbIn = AC.createGain(); const conv = AC.createConvolver(); conv.buffer = irGerado(4.6);
      verbRet = AC.createGain(); verbIn.connect(conv); conv.connect(verbRet); verbRet.connect(soma);
      // eco distante (encosta, outro lado do vale): sem relação com tempo nenhum
      ecoIn = AC.createGain(); ecoD = AC.createDelay(3); ecoD.delayTime.value = 0.61; ecoFb = AC.createGain(); ecoFb.gain.value = 0.28;
      const ecoLp = AC.createBiquadFilter(); ecoLp.type = 'lowpass'; ecoLp.frequency.value = 2200;
      const ecoHp = AC.createBiquadFilter(); ecoHp.type = 'highpass'; ecoHp.frequency.value = 250;
      ecoRet = AC.createGain();
      ecoIn.connect(ecoHp); ecoHp.connect(ecoD); ecoD.connect(ecoLp); ecoLp.connect(ecoFb); ecoFb.connect(ecoD); ecoLp.connect(ecoRet); ecoRet.connect(soma); ecoRet.connect(verbIn);
      // camadas
      const camadas = { voz: [0.22, 0.45], bor: [0, 0.5], amb: [0, 0.25] };
      for (const k in camadas) {
        const g = AC.createGain(); g.connect(soma);
        const a = AC.createGain(); a.gain.value = camadas[k][0]; g.connect(a); a.connect(ecoIn);
        const b = AC.createGain(); b.gain.value = camadas[k][1]; g.connect(b); b.connect(verbIn);
        bus[k] = g;
      }
      bus.vid = bus.obra = bus.voz;
      // bordão: seis harmônicos da fundamental, cada um respirando no seu ritmo (como uma tambura)
      bordaoF = AC.createBiquadFilter(); bordaoF.type = 'lowpass'; bordaoF.Q.value = 0.5;
      const bg = AC.createGain(); bg.gain.value = 0.06; bordaoF.connect(bg); bg.connect(bus.bor);
      [1, 2, 3, 4, 5, 6].forEach((h, i) => {
        const o = AC.createOscillator(); o.type = 'sine'; o.detune.value = (Math.random() - 0.5) * 6;
        const g = AC.createGain(); g.gain.value = 0; const amp = [0.9, 0.55, 0.42, 0.3, 0.24, 0.16][i];
        const l = AC.createOscillator(); l.frequency.value = 0.025 + Math.random() * 0.09; const lg = AC.createGain(); lg.gain.value = amp * 0.5;
        const pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
        l.connect(lg); lg.connect(g.gain); o.connect(g);
        if (pn) { pn.pan.value = i ? (i % 2 ? 0.45 : -0.45) : 0; g.connect(pn); pn.connect(bordaoF); } else g.connect(bordaoF);
        o.start(); l.start(); bordaoOsc.push({ o, g, h, amp });
      });
      // paisagem: vento (ruído branco em passa-faixa que passeia), água (ruído marrom), chuva (chiado agudo), grilos
      const mk = (buf, tipo, f, q) => { const s = laco(buf), fl = AC.createBiquadFilter(); fl.type = tipo; fl.frequency.value = f; fl.Q.value = q; const g = AC.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(bus.amb); return { s, fl, g }; };
      pais.vento = mk(ruidoB, 'bandpass', 500, 0.9);
      pais.agua = mk(ruidoM, 'lowpass', 520, 0.6);
      pais.chuva = mk(ruidoB, 'highpass', 2600, 0.4);
      { const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000; pais.chuva.fl.disconnect(); pais.chuva.fl.connect(lp); lp.connect(pais.chuva.g); }
      // grilos: um tom agudo cortado em trinados por uma onda quadrada, que por sua vez liga e desliga devagar
      { const o = AC.createOscillator(); o.frequency.value = 4300; const am = AC.createGain(); am.gain.value = 0;
        const tr = AC.createOscillator(); tr.type = 'square'; tr.frequency.value = 28; const trg = AC.createGain(); trg.gain.value = 0.5; tr.connect(trg); trg.connect(am.gain);
        const ch = AC.createOscillator(); ch.type = 'square'; ch.frequency.value = 1.6; const chg = AC.createGain(); chg.gain.value = 0.5; ch.connect(chg); chg.connect(am.gain);
        const g = AC.createGain(); g.gain.value = 0; const pn = AC.createStereoPanner ? AC.createStereoPanner() : null;
        o.connect(am); if (pn) { pn.pan.value = 0.5; am.connect(pn); pn.connect(g); } else am.connect(g); g.connect(bus.amb);
        o.start(); tr.start(); ch.start(); pais.grilos = { g, o, ch }; }
      aplicar(); bordaoAcorde(0.01);
    }

    function aplicar() {
      if (!AC) return;
      const t = AC.currentTime, e = S.esp;
      master.gain.setTargetAtTime(mudo ? 0 : S.vol * 1.2, t, 0.1);
      verbRet.gain.setTargetAtTime(0.25 + e * 1.1, t, 0.2);
      ecoRet.gain.setTargetAtTime(e * 0.8, t, 0.2); ecoFb.gain.setTargetAtTime(0.15 + e * 0.3, t, 0.2);
      bus.voz.gain.setTargetAtTime(S.mvoz, t, 0.08); bus.bor.gain.setTargetAtTime(S.bor, t, 0.4); bus.amb.gain.setTargetAtTime(S.amb, t, 0.4);
      bordaoF.frequency.setTargetAtTime(180 + Math.pow(S.bri, 1.5) * 2400, t, 0.6);
    }
    function fundamental() { return bordaoLivre || hz(grauAcorde, 0); }
    function bordaoAcorde(glide) {
      if (!AC) return;
      let f = fundamental(); while (f > 130) f /= 2; while (f < 55) f *= 2;
      const t = AC.currentTime;
      bordaoOsc.forEach((v) => { v.o.frequency.setTargetAtTime(f * v.h, t, glide); v.g.gain.setTargetAtTime(v.amp * 0.6, t, 2.5); });
    }

    // ---------- vozes ----------
    const conta = (end) => { vozes++; setTimeout(() => vozes--, Math.max(60, (end - AC.currentTime) * 1000 + 80)); };
    const livre = () => vozes < (leve ? 20 : MAXV);
    function saidaPan(g, pan, k) {
      if (AC.createStereoPanner && pan) { const p = AC.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(bus[k || 'voz']); }
      else g.connect(bus[k || 'voz']);
    }
    // envelope de percussão: ataque curto, queda exponencial
    function env(g, t, lvl, ataque, queda) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, lvl), t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + queda); }
    function osc(tipo, f, t, end, dest, detune) { const o = AC.createOscillator(); o.type = tipo; o.frequency.value = f; if (detune) o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; }
    function clique(t, f, lvl, dest) {
      const s = AC.createBufferSource(); s.buffer = ruidoB; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 2.5;
      const g = AC.createGain(); env(g, t, lvl, 0.001, 0.018); s.connect(bp); bp.connect(g); g.connect(dest); s.start(t, Math.random() * 3); s.stop(t + 0.04);
    }
    const brilho = () => Math.pow(2, (S.bri - 0.5) * 2) * (vid.on ? 0.75 + 0.5 * vid.lum : 1);

    const TOCA = {
      // marimba de bambu: fundamental + 4º modo da barra (≈3,9×) + estalo da baqueta
      madeira(f, t, v, pan) {
        const g = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(12000, f * 7 * brilho());
        const d = 0.5 + 0.35 * S.esp + (f < 250 ? 0.4 : 0), end = t + d + 0.1;
        const g2 = AC.createGain(); env(g2, t, 0.35, 0.002, d * 0.22);
        env(g, t, 0.16 * v, 0.003, d);
        osc('sine', f, t, end, g); osc('sine', f * 3.93, t, end, g2); g2.connect(g);
        clique(t, Math.min(6000, f * 5), 0.05 * v * brilho(), g);
        g.connect(lp); saidaPan(lp, pan); return end;
      },
      // gota: a bolha ressoa e a altura sobe enquanto ela se fecha
      gota(f, t, v, pan) {
        const g = AC.createGain(), o = AC.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f * 0.78, t); o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.09);
        const d = 0.1 + 0.08 * S.esp, end = t + d + 0.05;
        env(g, t, 0.14 * v, 0.002, d); o.connect(g); o.start(t); o.stop(end);
        saidaPan(g, pan); return end;
      },
      // sino de metal: parciais inarmônicas que somem cada uma no seu tempo, com batimento lento
      sino(f, t, v, pan) {
        const g = AC.createGain(); g.gain.value = 0.11 * v;
        const d = 2.2 + S.esp * 2.2, end = t + d + 0.2;
        const P = leve ? [[1, 1, 1], [2.756, 0.45, 0.5]] : [[1, 1, 1], [2.756, 0.45, 0.5], [5.404, 0.22 * brilho(), 0.28], [8.933, 0.1 * brilho(), 0.15]];
        for (const [r, a, k] of P) { if (f * r > 16000) continue; const gp = AC.createGain(); env(gp, t, a, 0.004, d * k); osc('sine', f * r, t, end, gp, r === 1 ? 0 : (Math.random() - 0.5) * 8); gp.connect(g); }
        if (!leve) { const gb = AC.createGain(); env(gb, t, 0.4, 0.004, d * 0.9); osc('sine', f * 1.0025, t, end, gb); gb.connect(g); }
        saidaPan(g, pan); return end;
      },
      // cristal: taça tocada de leve — seno puro com uma oitava quase exata, ataque macio
      cristal(f, t, v, pan) {
        const g = AC.createGain(), d = 1.6 + S.esp * 1.8, end = t + d + 0.2, lvl = 0.07 * v;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.035); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        osc('sine', f, t, end, g); const g2 = AC.createGain(); g2.gain.value = 0.25 * brilho(); osc('sine', f * 2.004, t, end, g2); g2.connect(g);
        saidaPan(g, pan); return end;
      },
      // sopro: ar soprado numa flauta — ruído afinado em passa-faixa estreito + um fio de seno, entra e sai devagar
      sopro(f, t, v, pan) {
        const g = AC.createGain(), d = 0.9 + S.esp * 0.8, end = t + d + 1.2, lvl = 0.12 * v;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl, t + 0.18); g.gain.setTargetAtTime(0.0001, t + d, 0.35);
        const s = AC.createBufferSource(); s.buffer = ruidoB; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 28;
        const ng = AC.createGain(); ng.gain.value = 2.2; s.connect(bp); bp.connect(ng); ng.connect(g); s.start(t, Math.random() * 3); s.stop(end);
        const o = AC.createOscillator(); o.frequency.value = f; const og = AC.createGain(); og.gain.value = 0.18 * brilho();
        const vb = AC.createOscillator(), vg = AC.createGain(); vb.frequency.value = 4.5 + Math.random(); vg.gain.value = 6; vb.connect(vg); vg.connect(o.detune);
        o.connect(og); og.connect(g); o.start(t); vb.start(t); o.stop(end); vb.stop(end);
        saidaPan(g, pan); return end;
      },
      // kalimba: lingueta de metal — fundamental redonda e um parcial agudo que some logo
      kalimba(f, t, v, pan) {
        const g = AC.createGain(), d = 0.9 + S.esp * 0.9, end = t + d + 0.1;
        env(g, t, 0.13 * v, 0.002, d);
        osc('sine', f, t, end, g); const g2 = AC.createGain(); env(g2, t, 0.3 * brilho(), 0.001, 0.12); osc('sine', f * 5.95, t, end, g2); g2.connect(g);
        clique(t, Math.min(7000, f * 3), 0.03 * v, g);
        saidaPan(g, pan); return end;
      },
      // corda dedilhada: triângulo + serra num passa-baixa que se fecha
      corda(f, t, v, pan) {
        const g = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
        const d = 1.1 + S.esp * 0.9, end = t + d + 0.1, pico = Math.min(12000, f * 10 * brilho());
        lp.frequency.setValueAtTime(pico, t); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.2, 200), t + d * 0.5);
        env(g, t, 0.12 * v, 0.003, d);
        osc('triangle', f, t, end, lp); const sg = AC.createGain(); sg.gain.value = 0.35; osc('sawtooth', f, t, end, sg, 5); sg.connect(lp);
        lp.connect(g); saidaPan(g, pan); return end;
      }
    };
    // graveto/pingo: estalo curto de ruído (chuva de esporos, cinturão de asteroides, chuva)
    function graveto(t, v, pan, f) {
      if (!livre()) return;
      const s = AC.createBufferSource(); s.buffer = ruidoB; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f || 1800 + Math.random() * 4500; bp.Q.value = 6;
      const g = AC.createGain(), d = 0.012 + Math.random() * 0.02; env(g, t, 0.09 * v, 0.001, d);
      s.connect(bp); bp.connect(g); saidaPan(g, pan, 'amb'); s.start(t, Math.random() * 3); s.stop(t + d + 0.02); conta(t + d);
    }
    // pássaro: duas ou três notas em glissando rápido
    function passaro(t, v) {
      if (!livre()) return;
      const g = AC.createGain(), o = AC.createOscillator(); o.type = 'sine';
      const base = 2200 + Math.random() * 2400, n = 2 + (Math.random() * 3 | 0), dn = 0.07 + Math.random() * 0.06;
      g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < n; i++) {
        const ti = t + i * dn * 1.4, f0 = base * (1 + (Math.random() - 0.3) * 0.4);
        o.frequency.setValueAtTime(f0, ti); o.frequency.exponentialRampToValueAtTime(f0 * (Math.random() < 0.5 ? 1.35 : 0.75), ti + dn);
        g.gain.setValueAtTime(0.0001, ti); g.gain.exponentialRampToValueAtTime(0.025 * v, ti + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, ti + dn);
      }
      const end = t + n * dn * 1.4 + 0.05; o.connect(g); saidaPan(g, (Math.random() - 0.5) * 1.6, 'amb'); o.start(t); o.stop(end); conta(end);
    }

    function vozDe(o) { if (S.voz !== 'obra' && TOCA[S.voz]) return S.voz; return (o && TOCA[o.voz]) ? o.voz : cena().voz; }
    function tocar(f, o, camada) {
      if (!AC || !rodando || !(f > 0)) return;
      const voz = vozDe(o), forca = o.forca == null ? 0.7 : o.forca;
      // Vida: notas fracas muito juntas são deixadas de lado (o resto respira)
      const agora = AC.currentTime, minDt = 0.02 + (1 - S.vida) * 0.22;
      if (agora - ultNota < minDt && forca < 0.75) return;
      if (!livre()) return;
      ultNota = agora;
      f = caber(f, voz);
      const t = (o.t && o.t > agora ? o.t : agora) + Math.random() * 0.018;   // mão humana, não relógio
      const end = TOCA[voz](f, t, 0.35 + 0.65 * forca, o.pan || 0); conta(end);
      emit('nota', { camada: camada || 'voz', voz, freq: f, forca, pan: o.pan || 0 }, t);
      // resposta da paisagem: às vezes a nota volta, mais fraca, uma quinta ou oitava acima (como um eco de pássaro)
      if (Math.random() < 0.12 * S.esp * S.vida && livre()) {
        const r = [1.5, 2, 4 / 3][Math.random() * 3 | 0], te = t + 0.35 + Math.random() * 0.9;
        const e2 = TOCA[voz](caber(f * r, voz), te, 0.25 + 0.2 * forca, -(o.pan || 0) * 0.8); conta(e2);
      }
    }

    // ---------- relógio da paisagem (não é pulso musical: só decide quando a paisagem fala) ----------
    function energiaAtual() {
      const ag = (performance.now() - ultimaAtiv) / 1000;
      const a = Math.max(atividade * Math.exp(-ag / 8), energiaObra, vid.on ? vid.mov * 0.8 : 0);
      return S.auto ? S.vida * (0.45 + 0.55 * Math.min(1, a)) : S.vida;
    }
    let ultT = 0, ventoProx = 0, passoN = 0, memProx = 0;
    function relogio() {
      if (!AC || !rodando) return;
      const t = AC.currentTime, dt = Math.min(0.2, ultT ? t - ultT : 0.05); ultT = t;
      const E = energiaAtual(), P = cena().pais || {}, k = 0.5 + 0.7 * E;
      // camadas contínuas
      pais.vento.g.gain.setTargetAtTime((P.vento || 0) * 0.5 * k, t, 1.2);
      pais.agua.g.gain.setTargetAtTime((P.agua || 0) * 0.55 * k, t, 1.2);
      pais.chuva.g.gain.setTargetAtTime((P.chuva || 0) * 0.16 * k, t, 1.2);
      pais.grilos.g.gain.setTargetAtTime((P.grilos || 0) * 0.012 * (0.6 + 0.4 * E), t, 1.5);
      if (t > ventoProx) {   // o vento muda de rumo
        ventoProx = t + 1.5 + Math.random() * 4;
        pais.vento.fl.frequency.setTargetAtTime(220 + Math.random() * 1100 * (0.6 + S.bri), t, 1.4);
        pais.vento.fl.Q.setTargetAtTime(0.6 + Math.random() * 2.2, t, 1.4);
        pais.agua.fl.frequency.setTargetAtTime(300 + Math.random() * 500, t, 1.6);
        pais.grilos.ch.frequency.setTargetAtTime(1.2 + Math.random() * 0.9, t, 2);
      }
      // acontecimentos esparsos
      const sorte = (taxa) => Math.random() < taxa * dt;
      if (P.passaros && sorte(P.passaros * 0.35 * k * S.amb * 2)) passaro(t + Math.random() * 0.05, 0.6 + 0.4 * Math.random());
      if (P.agua && sorte(P.agua * 1.6 * k * S.amb * 2)) { const f = 900 + Math.random() * 2000; if (livre()) { const e = TOCA.gota(f, t + Math.random() * 0.05, 0.18 + Math.random() * 0.2, (Math.random() - 0.5) * 1.4); conta(e); } }
      if (P.chuva && sorte(P.chuva * 14 * k * S.amb * 2)) graveto(t + Math.random() * 0.05, 0.35 + Math.random() * 0.5, (Math.random() - 0.5) * 1.8);
      // memória da paisagem: notas que a obra tocou voltam sozinhas, de vez em quando, em outra oitava
      if (mem.length && t > memProx && performance.now() - ultimoEv < 45000) {
        memProx = t + (1.2 + Math.random() * 3.5) / (0.3 + E);
        if (Math.random() < 0.35 + 0.5 * E) { const m = mem[Math.random() * mem.length | 0]; tocar(hz(m.g, Math.random() < 0.5 ? 2 : 3), { forca: 0.25 + 0.25 * m.forca, pan: (Math.random() - 0.5) * 1.4 }, 'memoria'); }
      }
      if (++passoN % 5 === 0) emit('passo', { passo: passoN / 5 | 0, energia: E, acorde: grauAcorde, tempo: 0 }, t);
      vigiar(t);
    }
    let vigT0 = 0, vigA0 = 0;
    function vigiar(agora) {
      const r = performance.now() / 1000;
      if (!vigT0) { vigT0 = r; vigA0 = agora; return; }
      if (r - vigT0 < 4) return;
      if (!leve && (agora - vigA0) / (r - vigT0) < 0.95) { leve = true; if (global.console) console.info('Motor Natureza: modo leve'); }
      vigT0 = r; vigA0 = agora;
    }
    function ligarRelogio() {
      try { const w = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),50)'], { type: 'text/javascript' }))); w.onmessage = relogio; timer = w; }
      catch (e) { timer = setInterval(relogio, 50); }
    }
    // ---------- imagem → som: a luz abre o brilho, o movimento dá vida ----------
    let vidCv = null, vidCx = null, vidAnt = null, vidMaxL = 0.05, vidMaxM = 0.002, vidAlvo = null, vidBusca = 0;
    function lerImagem() {
      try {
        if (!vidAlvo || !vidAlvo.isConnected || ++vidBusca % 25 === 0) {
          let best = null, ba = 0; document.querySelectorAll('canvas').forEach(c => { const r = c.getBoundingClientRect(), a = r.width * r.height; if (a > ba && c.width > 32) { ba = a; best = c; } });
          vidAlvo = best;
        }
        if (!vidAlvo) return;
        if (!vidCv) { vidCv = document.createElement('canvas'); vidCv.width = 24; vidCv.height = 14; vidCx = vidCv.getContext('2d', { willReadFrequently: true }); }
        vidCx.drawImage(vidAlvo, 0, 0, 24, 14);
        const d = vidCx.getImageData(0, 0, 24, 14).data, n = 24 * 14; let L = 0, M = 0, sx = 0, sy = 0; const cur = new Float32Array(n);
        for (let i = 0; i < n; i++) { const l = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255; cur[i] = l; L += l; sx += l * (i % 24); sy += l * Math.floor(i / 24); if (vidAnt) M += Math.abs(l - vidAnt[i]); }
        vidAnt = cur; L /= n; M /= n; vidMaxL = Math.max(L, vidMaxL * 0.995); vidMaxM = Math.max(M, vidMaxM * 0.99);
        const tot = L * n || 1;
        vid.lum += (Math.min(1, L / vidMaxL) - vid.lum) * 0.3; vid.mov += (Math.min(1, M / vidMaxM) - vid.mov) * 0.3;
        vid.cx += ((sx / tot) / 23 - vid.cx) * 0.2; vid.cy += ((sy / tot) / 13 - vid.cy) * 0.2; vid.on = true;
      } catch (e) { vid.on = false; }
    }
    function ativar(forca, k) { atividade = Math.min(1, atividade * Math.exp(-(performance.now() - ultimaAtiv) / 8000) + k * (0.5 + forca)); ultimaAtiv = performance.now(); }

    // ---------- API (a mesma do Motor Knick) ----------
    const M = {
      MODOS, NOTAS, CENAS, S, nomeMotor: 'natureza',
      get AC() { return AC; }, get saida() { return saida; }, get analisador() { return analisador; }, get rodando() { return rodando; },
      iniciar() {
        if (!AC) montar();
        if (AC.state === 'suspended') AC.resume();
        if (!rodando) { rodando = true; if (!timer) ligarRelogio(); }
        if (cfg.imagem !== false && !vidTimer) vidTimer = setInterval(lerImagem, 150);
        return AC.resume ? AC.resume() : Promise.resolve();
      },
      parar() { rodando = false; if (AC) AC.suspend(); },
      mudo(b) { mudo = !!b; aplicar(); },
      evento(grau, o) {
        o = o || {}; const g = Math.round(grau), forca = o.forca == null ? 0.7 : o.forca;
        mem.push({ g, forca }); if (mem.length > 16) mem.shift(); ultimoEv = performance.now(); ativar(forca, 0.05);
        tocar(hz(g, 2), o);
      },
      // exata: true toca a frequência como veio (ex.: afinação de Kepler); senão vai para a nota da escala mais próxima
      nota(f, o) {
        if (!(f > 0)) return; o = o || {}; const forca = o.forca == null ? 0.7 : o.forca;
        const g = grauDe(f); mem.push({ g, forca }); if (mem.length > 16) mem.shift(); ultimoEv = performance.now(); ativar(forca, 0.05);
        if (o.exata) tocar(f, o);
        else { const oit = Math.round(Math.log2(f / (raiz() * razao(g)))); tocar(raiz() * razao(g) * Math.pow(2, oit), o); }
      },
      memorizar(f, forca) {
        if (!(f > 0)) return; forca = forca == null ? 0.5 : forca;
        mem.push({ g: grauDe(f), forca }); if (mem.length > 16) mem.shift(); ultimoEv = performance.now(); ativar(forca, 0.02);
      },
      acorde(g) { g = Math.round(g); bordaoLivre = null; if (g !== grauAcorde) { grauAcorde = g; bordaoAcorde(3); emit('acorde', { grau: g }); } },
      // a obra escolhe a fundamental do bordão em Hz (fora da escala, se quiser)
      bordao(f) { if (!(f > 0)) return; if (bordaoLivre && Math.abs(Math.log2(f / bordaoLivre)) < 0.01) return; bordaoLivre = f; grauAcorde = grauDe(f); bordaoAcorde(3); emit('acorde', { grau: grauAcorde, freq: f }); },
      pulso(forca) {
        forca = forca == null ? 0.5 : forca; ativar(forca, 0.015);
        if (AC && rodando && Math.random() < 0.3 + forca) graveto(AC.currentTime + Math.random() * 0.02, 0.3 + forca * 0.7, (Math.random() - 0.5) * 1.6);
      },
      barramento(k) { return bus[k === 'vid' || k === 'obra' || !k ? 'voz' : k] || bus.voz; },
      energia(x) { energiaObra = Math.max(0, Math.min(1, x)); },
      on(tipo, fn) { (ouvintes[tipo] = ouvintes[tipo] || []).push(fn); },
      get leve() { return leve; }, set leve(v) { leve = !!v; },
      get imagem() { return vid; }, get identidade() { return IDT; }, get memoria() { return mem.map(m => m.g); },
      hz, semi, razao, grauDoAcorde, get grauAcorde() { return grauAcorde; },
      nomeAcorde() { const s = Math.round(12 * Math.log2(fundamental() / RE2)); return NOTAS[((s % 12) + 12) % 12]; },
      set(k, v) { if (k === 'cena') aplicarCena(v); else { S[k] = v; if (k === 'tom' || k === 'modo' || k === 'afin') bordaoAcorde(1.5); aplicar(); } },
      painel: montarPainel
    };

    function aplicarCena(nome, mexer) {
      const c = CEN[nome]; if (!c) return; S.cena = nome;
      if (mexer !== false) {
        const vals = { mnVida: c.vida, mnBri: c.bri, mnEsp: c.esp, mnVoz: c.mix.voz, mnBor: c.mix.bor, mnAmb: c.mix.amb };
        const chave = { mnVida: 'vida', mnBri: 'bri', mnEsp: 'esp', mnVoz: 'mvoz', mnBor: 'bor', mnAmb: 'amb' };
        for (const id in vals) {
          const el = raizPainel && raizPainel.querySelector('#' + id);
          if (el) { el.value = vals[id]; el.dispatchEvent(new Event('input', { bubbles: true })); } else S[chave[id]] = vals[id];
        }
        aplicar();
      }
      if (raizPainel) raizPainel.querySelectorAll('.mn-cenas button').forEach(b => b.classList.toggle('on', b.dataset.c === nome));
    }

    // ---------- painel ----------
    let raizPainel = null;
    function montarPainel(alvo, op) {
      op = op || {};
      if (!document.getElementById('mn-css')) { const st = document.createElement('style'); st.id = 'mn-css'; st.textContent = CSS; document.head.appendChild(st); }
      const el = document.createElement('div'); el.className = 'mn'; raizPainel = el;
      const lin = (id, lab, min, max, step, v) => `<div class="mn-l"><label for="${id}">${lab}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><output></output></div>`;
      el.innerHTML = `${op.titulo === false ? '' : '<h3>Som</h3>'}
        <div class="mn-cenas">${Object.keys(CEN).map(k => `<button type="button" data-c="${k}" class="${k === S.cena ? 'on' : ''}">${CEN[k].nome}</button>`).join('')}</div>
        <select id="mnCena" hidden>${Object.keys(CEN).map(k => `<option value="${k}"${k === S.cena ? ' selected' : ''}>${CEN[k].nome}</option>`).join('')}</select>
        <div class="mn-l"><label>Tonalidade</label><div class="mn-ton" style="grid-column:span 2">
          <select id="mnTom" aria-label="Tônica">${NOTAS.map((n, i) => `<option value="${i}"${i === S.tom ? ' selected' : ''}>${n}</option>`).join('')}</select>
          <select id="mnModo" aria-label="Escala">${MODOS_NOME.map(([k, n]) => `<option value="${k}"${k === S.modo ? ' selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <div class="mn-l"><label>Afinação</label><div class="mn-ton" style="grid-column:span 2">
          <select id="mnAfin"><option value="natural"${S.afin !== 'temperada' ? ' selected' : ''}>natural</option><option value="temperada"${S.afin === 'temperada' ? ' selected' : ''}>temperada</option></select></div></div>
        <div class="mn-l"><label>Voz</label><div class="mn-ton" style="grid-column:span 2">
          <select id="mnTimbre">${VOZES.map(([k, n]) => `<option value="${k}"${k === S.voz ? ' selected' : ''}>${n}</option>`).join('')}</select></div></div>
        ${lin('mnVol', 'Volume', 0, 1, 0.01, S.vol)}
        ${lin('mnVida', 'Vida', 0, 1, 0.01, S.vida)}
        <label class="mn-auto"><input type="checkbox" id="mnAuto"${S.auto ? ' checked' : ''}> a obra comanda</label>
        ${lin('mnBri', 'Brilho', 0, 1, 0.01, S.bri)}
        ${lin('mnEsp', 'Espaço', 0, 1, 0.01, S.esp)}
        <details><summary>Mistura</summary>
          ${lin('mnVoz', 'Vozes', 0, 1.2, 0.01, S.mvoz)}${lin('mnBor', 'Bordão', 0, 1.2, 0.01, S.bor)}${lin('mnAmb', 'Paisagem', 0, 1.2, 0.01, S.amb)}
        </details>`;
      (typeof alvo === 'string' ? document.querySelector(alvo) : alvo).appendChild(el);
      const mapa = { mnVol: 'vol', mnVida: 'vida', mnBri: 'bri', mnEsp: 'esp', mnVoz: 'mvoz', mnBor: 'bor', mnAmb: 'amb' };
      const out = (inp) => { const o = inp.parentNode.querySelector('output'); if (o) o.textContent = Math.round(inp.value * 100); };
      for (const id in mapa) { const inp = el.querySelector('#' + id); out(inp); inp.addEventListener('input', () => { S[mapa[id]] = parseFloat(inp.value); out(inp); aplicar(); }); }
      const sc = el.querySelector('#mnCena');
      sc.addEventListener('change', () => aplicarCena(sc.value)); sc.addEventListener('input', () => aplicarCena(sc.value));
      el.querySelectorAll('.mn-cenas button').forEach(b => b.addEventListener('click', () => { sc.value = b.dataset.c; sc.dispatchEvent(new Event('change', { bubbles: true })); }));
      el.querySelector('#mnTom').addEventListener('change', e => M.set('tom', +e.target.value));
      el.querySelector('#mnModo').addEventListener('change', e => M.set('modo', e.target.value));
      el.querySelector('#mnAfin').addEventListener('change', e => M.set('afin', e.target.value));
      el.querySelector('#mnTimbre').addEventListener('change', e => { S.voz = e.target.value; });
      el.querySelector('#mnAuto').addEventListener('change', e => { S.auto = e.target.checked; });
      return el;
    }
    if (cfg.painel) montarPainel(cfg.painel);
    MotorNatureza.atual = M;
    return M;
  }

  MotorNatureza.CENAS = CENAS;
  MotorNatureza.IDENTIDADES = IDENTIDADES;
  global.MotorNatureza = MotorNatureza;
})(typeof window !== 'undefined' ? window : this);
