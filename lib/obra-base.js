/* =====================================================================
   Obra base — esqueleto comum das obras da série "Instrumentos de Luz"
   (inspiradas na estética de @plyzitron: preto e branco, um acento de cor,
   sobreposição de dados medindo o próprio som).

   Monta: tela WebGL2 (#gl) + tela 2D por cima (#hud), tela de início,
   botão de controles (ponto no canto, tecla M), fonte de som (Motor Knick
   ou microfone/arquivo), análise de áudio e utilidades de desenho.

     const O = ObraBase({ titulo, texto, chave, cena, controles:[ ['Id','Rótulo',v,min,max,passo] | ['Seção'] ], aoIniciar });
     O.quadro((t, dt) => { ... });      // laço de animação
     O.A  → análise: freq (Uint8, 1024), onda (Float32), rms, db, grave, medio, agudo, ataque (0..1), hz, nivel (0..1)
     O.P  → valores dos controles     O.M → Motor Knick     O.gl, O.hx (2D), O.W, O.H, O.DPR
     O.onNota(fn)                     // notas do Motor Knick (já no tempo em que soam)
     O.aoToque = (x, y, forca, inicio) => {}   // toque/arraste na tela (já toca nota e faz glitch); cfg.toque:false desliga
     O.glitch(0..1)                   // dispara o glitch (fatias, canais, blocos)
   Depende de ../lib/motor-knick.js (carregado antes).
   ===================================================================== */
(function () {
  'use strict';
  const CSS = `
html,body{margin:0;height:100%;background:#000;overflow:hidden;color:#e6e9ee;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;touch-action:none}
#gl,#hud{position:fixed;inset:0;width:100%;height:100%;display:block}
#hud{pointer-events:none}
body.idle{cursor:none}
#ob-start{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#000;z-index:20;cursor:pointer;text-align:center;padding:24px}
#ob-start h1{margin:0;font-weight:300;letter-spacing:.34em;text-transform:uppercase;font-size:22px}
#ob-start p{margin:0;color:#7d8794;max-width:440px;line-height:1.55;font-size:14px}
#ob-start .b{margin-top:10px;border:1px solid #e6e9ee;border-radius:999px;padding:10px 26px;letter-spacing:.22em;font-size:12px;text-transform:uppercase}
#ob-start .f{display:flex;gap:8px;margin-top:4px}
#ob-start .f span{border:1px solid #39424d;border-radius:999px;padding:7px 14px;font-size:12px;color:#aeb7c2}
#ob-start .f span.on{border-color:#e6e9ee;color:#fff}
#ob-start.hide{display:none}
#ob-dot{position:fixed;right:16px;top:16px;width:14px;height:14px;border-radius:50%;background:#e6e9ee;opacity:.3;z-index:12;cursor:pointer;transition:opacity .4s}
#ob-dot:hover{opacity:.85}
body.idle #ob-dot{opacity:0}
#ob-panel{position:fixed;right:12px;top:40px;width:310px;max-height:calc(100% - 56px);overflow:auto;background:rgba(8,10,13,.93);border:1px solid #222831;border-radius:14px;padding:14px 16px;z-index:12;display:none;backdrop-filter:blur(8px);font-size:13px}
#ob-panel.on{display:block}
#ob-panel h3{margin:14px 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8b96a3;font-weight:600}
#ob-panel h3:first-child{margin-top:0}
#ob-vis h3:first-child{margin-top:14px}
.ob-l{display:grid;grid-template-columns:96px 1fr 34px;align-items:center;gap:8px;margin:7px 0}
.ob-l label{color:#aab4bf}
.ob-l output{color:#7d8794;font-variant-numeric:tabular-nums;text-align:right;font-size:12px}
#ob-panel input[type=range]{width:100%;accent-color:#5b7cff;margin:0}
.ob-seg{display:flex;gap:5px;margin-bottom:6px}
.ob-seg button{flex:1;background:#12161c;color:#c4ccd5;border:1px solid #29313b;border-radius:8px;padding:7px 6px;font:inherit;font-size:12px;cursor:pointer}
.ob-seg button.on{background:#e8eefc;color:#0a0d12;border-color:#e8eefc}
.ob-nota{color:#6f7a87;font-size:12px;line-height:1.45;margin:6px 0 0}
#ob-dica{position:fixed;left:50%;top:22px;transform:translateX(-50%);font:12px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;color:#cfd6df;background:rgba(0,0,0,.6);padding:8px 14px;border-radius:999px;z-index:13;opacity:0;transition:opacity .4s;pointer-events:none}
#ob-dica.on{opacity:1}
@media (max-width:520px){#ob-panel{left:10px;right:10px;width:auto}}
`;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

  function ObraBase(cfg) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend', `
<canvas id="gl"></canvas><canvas id="hud"></canvas>
<div id="ob-start"><h1>${cfg.titulo}</h1><p>${cfg.texto || ''}</p>
 <div class="f"><span data-f="motor" class="on">Som próprio</span><span data-f="mic">Microfone / arquivo</span></div>
 <span class="b">Começar</span></div>
<div id="ob-dot" title="Controles (M)"></div>
<div id="ob-panel">
 <h3>Fonte do som</h3>
 <div class="ob-seg" id="ob-fonte"><button data-f="motor" class="on">Som próprio</button><button data-f="mic">Microfone / arquivo</button></div>
 <p class="ob-nota" id="ob-fnota">O Motor Knick toca e a imagem reage a ele.</p>
 <div id="ob-vis"></div>
 <div id="ob-som" style="margin-top:14px"></div>
 <p class="ob-nota">M controles · F tela cheia · H dados na tela · Shift+P projeção · Shift+A arquivo de áudio</p>
</div>
<div id="ob-dica"></div>`);

    const gl = document.getElementById('gl').getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    const hudCv = document.getElementById('hud'), hx = hudCv.getContext('2d');
    const O = { gl, hx, W: 0, H: 0, DPR: 1, P: {}, A: null, M: null, fonte: 'motor', mostrarHud: true, rodando: false, clamp };

    // ---------- tamanho ----------
    function rs() {
      O.DPR = Math.min(devicePixelRatio || 1, 2); O.W = innerWidth; O.H = innerHeight;
      const g = document.getElementById('gl');
      g.width = Math.round(O.W * O.DPR); g.height = Math.round(O.H * O.DPR);
      hudCv.width = g.width; hudCv.height = g.height; hx.setTransform(O.DPR, 0, 0, O.DPR, 0, 0);
      if (O.aoRedimensionar) O.aoRedimensionar();
    }
    addEventListener('resize', rs); rs();

    // ---------- controles ----------
    const chave = 'obra:' + (cfg.chave || cfg.titulo);
    let salvo = {}; try { salvo = JSON.parse(localStorage.getItem(chave) || '{}'); } catch (e) {}
    const vis = document.getElementById('ob-vis');
    let html = '';
    for (const c of cfg.controles || []) {
      if (c.length === 1) { html += `<h3>${c[0]}</h3>`; continue; }
      const [id, lab, v, min, max, step] = c;
      const val = salvo[id] != null ? salvo[id] : v; O.P[id] = val;
      html += `<div class="ob-l"><label for="ob_${id}">${lab}</label><input type="range" id="ob_${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output></output></div>`;
    }
    html += `<div class="ob-seg" style="margin-top:8px"><button id="ob-reset">Voltar ao padrão</button></div>`;
    vis.innerHTML = html;
    const fmt = (inp) => { const s = +inp.step; inp.nextElementSibling.textContent = s >= 1 ? inp.value : (+inp.value).toFixed(s < 0.1 ? 2 : 1); };
    for (const c of cfg.controles || []) {
      if (c.length === 1) continue;
      const inp = document.getElementById('ob_' + c[0]); fmt(inp);
      inp.addEventListener('input', () => { O.P[c[0]] = +inp.value; fmt(inp); salvar(); });
    }
    function salvar() { try { localStorage.setItem(chave, JSON.stringify(O.P)); } catch (e) {} }
    document.getElementById('ob-reset').onclick = () => {
      for (const c of cfg.controles || []) { if (c.length === 1) continue; const inp = document.getElementById('ob_' + c[0]); inp.value = c[2]; O.P[c[0]] = c[2]; fmt(inp); }
      salvar();
    };

    // ---------- Motor Knick ----------
    O.M = MotorKnick({ painel: '#ob-som', chave: cfg.chave, padroes: cfg.somPadrao || {}, insercao: cfg.insercao });
    if (cfg.cena && MotorKnick.CENAS[cfg.cena]) setTimeout(() => { const b = document.querySelector(`#ob-som .mk-cenas button[data-c="${cfg.cena}"]`); if (b) b.click(); }, 0);
    const ouvNota = [];
    O.onNota = (fn) => ouvNota.push(fn);
    O.M.on('nota', (n) => { if (O.fonte === 'motor') ouvNota.forEach((f) => f(n)); });

    // ---------- análise de áudio ----------
    const A = O.A = { freq: new Uint8Array(1024), onda: new Float32Array(2048), rms: 0, db: -90, grave: 0, medio: 0, agudo: 0, ataque: 0, hz: 0, nivel: 0, sr: 48000, ant: new Float32Array(1024), fluxMed: 1 };
    let an = null, anMotor = null, anMic = null, micCtx = null, micStream = null;
    function analisadorMotor() {
      if (anMotor) return anMotor;
      const AC = O.M.AC; if (!AC) return null;
      anMotor = AC.createAnalyser(); anMotor.fftSize = 2048; anMotor.smoothingTimeConstant = 0.6;
      O.M.saida.connect(anMotor); return anMotor;
    }
    async function abrirMic() {
      if (anMic) return anMic;
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      micCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = micCtx.createMediaStreamSource(micStream);
      anMic = micCtx.createAnalyser(); anMic.fftSize = 2048; anMic.smoothingTimeConstant = 0.6; src.connect(anMic);
      return anMic;
    }
    async function usarFonte(f) {
      O.fonte = f;
      document.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === f));
      document.getElementById('ob-fnota').textContent = f === 'motor'
        ? 'O Motor Knick toca e a imagem reage a ele.'
        : 'A imagem escuta o microfone. Para usar um arquivo de áudio, abra o botão de áudio no canto inferior esquerdo (Shift+A).';
      document.getElementById('ob-som').style.display = f === 'motor' ? '' : 'none';
      if (!O.rodando) return;
      if (f === 'motor') { await O.M.iniciar(); an = analisadorMotor(); if (micCtx) micCtx.suspend(); }
      else { O.M.parar(); try { an = await abrirMic(); micCtx.resume(); } catch (e) { dica('sem microfone — voltando ao som próprio', 2500); usarFonte('motor'); } }
    }
    O.usarFonte = usarFonte;
    document.querySelectorAll('#ob-fonte button, #ob-start .f span').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); usarFonte(b.dataset.f); }));

    function analisar(dt) {
      if (!an) { A.rms *= 0.9; A.nivel *= 0.9; A.ataque *= 0.85; return; }
      an.getByteFrequencyData(A.freq); an.getFloatTimeDomainData(A.onda);
      A.sr = an.context.sampleRate;
      let s = 0; for (let i = 0; i < A.onda.length; i++) s += A.onda[i] * A.onda[i];
      A.rms = Math.sqrt(s / A.onda.length); A.db = 20 * Math.log10(A.rms + 1e-6);
      const ganho = O.P.Sensib != null ? O.P.Sensib : 1;
      const bin = A.sr / 2048, banda = (a, b) => { let x = 0; const i0 = Math.round(a / bin), i1 = Math.round(b / bin); for (let i = i0; i <= i1; i++) x += A.freq[i]; return x / ((i1 - i0 + 1) * 255); };
      const k = 1 - Math.exp(-dt / 0.06);
      A.grave += (clamp(banda(30, 180) * 1.5 * ganho, 0, 1) - A.grave) * k;
      A.medio += (clamp(banda(180, 2000) * 1.8 * ganho, 0, 1) - A.medio) * k;
      A.agudo += (clamp(banda(2000, 9000) * 2.6 * ganho, 0, 1) - A.agudo) * k;
      A.nivel += (clamp((A.db + 60) / 50 * ganho, 0, 1) - A.nivel) * k;
      // fluxo espectral → ataque
      let fl = 0; for (let i = 2; i < 400; i++) { const v = A.freq[i] / 255, d = v - A.ant[i]; if (d > 0) fl += d; A.ant[i] = v; }
      A.fluxMed += (fl - A.fluxMed) * 0.05;
      const at = fl > A.fluxMed * 1.8 + 0.8 ? clamp((fl / (A.fluxMed + 0.5) - 1.5) / 3, 0, 1) : 0;
      A.ataque = Math.max(A.ataque * Math.exp(-dt / 0.12), at * ganho);
      // frequência dominante (com interpolação)
      let mi = 3, mv = 0; for (let i = 3; i < 700; i++) if (A.freq[i] > mv) { mv = A.freq[i]; mi = i; }
      if (mv > 60) { const a = A.freq[mi - 1], b = A.freq[mi], c = A.freq[mi + 1], p = clamp(0.5 * (a - c) / (a - 2 * b + c || 1), -0.5, 0.5); A.hz = (mi + p) * bin; } else A.hz = 0;
    }

    // ---------- início ----------
    const start = document.getElementById('ob-start');
    start.addEventListener('click', async () => {
      start.classList.add('hide'); O.rodando = true;
      await usarFonte(O.fonte);
      if (cfg.aoIniciar) cfg.aoIniciar(O);
    });

    // ---------- painel, teclas, cursor ----------
    const painel = document.getElementById('ob-panel');
    document.getElementById('ob-dot').onclick = () => painel.classList.toggle('on');
    let tIdle = 0;
    const acordou = () => { document.body.classList.remove('idle'); clearTimeout(tIdle); tIdle = setTimeout(() => { if (!painel.classList.contains('on')) document.body.classList.add('idle'); }, 2500); };
    addEventListener('pointermove', acordou); acordou();
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.shiftKey || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 'm') painel.classList.toggle('on');
      else if (k === 'h') { O.mostrarHud = !O.mostrarHud; dica(O.mostrarHud ? 'dados na tela' : 'imagem limpa'); }
      else if (k === 'f') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }
      else if (O.aoTecla) O.aoTecla(k, e);
    });
    let tDica = 0;
    function dica(txt, ms) { const d = document.getElementById('ob-dica'); d.textContent = txt; d.classList.add('on'); clearTimeout(tDica); tDica = setTimeout(() => d.classList.remove('on'), ms || 1400); }
    O.dica = dica;

    // ---------- laço ----------
    // ---------- toque na tela: som + efeito + glitch ----------
    // A obra define O.aoToque(x, y, forca, inicio) (x, y em px CSS). Tocar = nota e glitch; arrastar = sequência de notas.
    const T = O.toque = { ativo: false, x: 0, y: 0, vx: 0, vy: 0, ultNota: 0 };
    const glCv = document.getElementById('gl');
    function notaToque(x, y, forca) {
      if (O.fonte === 'motor' && O.M.rodando) O.M.evento(Math.round((1 - y / O.H) * 14) - 3, { forca: clamp(forca, 0.25, 1), pan: clamp(x / O.W * 2 - 1, -1, 1) });
    }
    glCv.addEventListener('pointerdown', (e) => {
      if (!O.rodando || cfg.toque === false) return;
      try { glCv.setPointerCapture(e.pointerId); } catch (er) {}
      T.ativo = true; T.x = e.clientX; T.y = e.clientY; T.vx = T.vy = 0; T.ultNota = performance.now();
      notaToque(T.x, T.y, 0.95); O.glitch(0.55 * (O.P.Glitch != null ? O.P.Glitch : 1));
      if (O.aoToque) O.aoToque(T.x, T.y, 1, true);
    });
    glCv.addEventListener('pointermove', (e) => {
      if (!T.ativo) return;
      const dx = e.clientX - T.x, dy = e.clientY - T.y; T.x = e.clientX; T.y = e.clientY; T.vx = dx; T.vy = dy;
      const vel = Math.hypot(dx, dy), agora = performance.now();
      if (agora - T.ultNota > 110 && vel > 2) { T.ultNota = agora; const f = clamp(0.35 + vel / 40, 0, 1); notaToque(T.x, T.y, f); if (O.aoToque) O.aoToque(T.x, T.y, f, false); }
      O.glitch(Math.min(0.5, vel / 120) * (O.P.Glitch != null ? O.P.Glitch : 1));
    });
    const solta = () => { T.ativo = false; };
    glCv.addEventListener('pointerup', solta); glCv.addEventListener('pointercancel', solta);

    // glitch: fatias deslocadas da imagem, canais de cor separados, blocos e linhas
    let gN = 0;
    O.glitch = (v) => { gN = Math.min(1.2, Math.max(gN, v)); };
    function desenharGlitch(dt) {
      const at = O.A.ataque * (O.P.GlitchSom != null ? O.P.GlitchSom : 0.5);
      const g = Math.max(gN, at > 0.5 ? at * 0.6 : 0); gN *= Math.exp(-dt / 0.22);
      if (g < 0.03) return;
      const W = O.W, H = O.H, sx = glCv.width / W;
      hx.save();
      const n = 2 + Math.floor(g * 10);
      for (let i = 0; i < n; i++) {
        const y = Math.random() * H, h = 2 + Math.random() * 40 * g, off = (Math.random() - 0.5) * 160 * g;
        hx.globalAlpha = 0.9; hx.globalCompositeOperation = 'source-over';
        hx.drawImage(glCv, 0, y * sx, glCv.width, h * sx, off, y, W, h);
        if (Math.random() < 0.5) { hx.globalCompositeOperation = 'lighter'; hx.globalAlpha = 0.35 * g; hx.fillStyle = Math.random() < 0.5 ? 'rgb(255,0,40)' : 'rgb(0,90,255)'; hx.fillRect(off * 0.6, y, W, h); }
      }
      // separação de canais: cópias tingidas deslocadas
      hx.globalCompositeOperation = 'lighter'; hx.globalAlpha = 0.25 * g;
      const d = 6 + 18 * g;
      hx.drawImage(glCv, d, 0, W, H); hx.drawImage(glCv, -d, 0, W, H);
      hx.globalCompositeOperation = 'difference'; hx.globalAlpha = 1; hx.fillStyle = '#fff';
      for (let i = 0; i < Math.floor(g * 6); i++) if (Math.random() < 0.6) hx.fillRect(Math.random() * W, Math.random() * H, 10 + Math.random() * 120 * g, 2 + Math.random() * 14 * g);
      hx.globalCompositeOperation = 'source-over'; hx.globalAlpha = 0.12 * g; hx.fillStyle = '#000';
      for (let y = 0; y < H; y += 3) hx.fillRect(0, y, W, 1);
      hx.restore();
    }

    const fns = []; O.quadro = (fn) => fns.push(fn);
    let tAnt = performance.now() / 1000;
    function loop() {
      const t = performance.now() / 1000, dt = Math.min(0.05, t - tAnt); tAnt = t;
      analisar(dt);
      for (const f of fns) f(t, dt);
      desenharGlitch(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return O;
  }

  // =================== utilidades WebGL ===================
  ObraBase.programa = function (gl, vs, fs) {
    const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  };
  ObraBase.perspectiva = function (fov, asp, n, f) {
    const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
    return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
  };
  ObraBase.olhar = function (e, c, up) {
    const z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cruz(up, z)), y = cruz(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
  };
  ObraBase.mul = function (a, b) {
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; }
    return o;
  };
  // projeta um ponto 3D com a matriz (coluna-maior) → [x, y] em pixels CSS, ou null se atrás da câmera
  ObraBase.projetar = function (m, p, W, H) {
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    if (w <= 0.01) return null;
    return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H, w];
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  ObraBase.ruido = `
float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+17.1;a*=.5;}return s;}`;

  // =================== HUD (sobreposição de dados) ===================
  const MONO = '10px ui-monospace,"SF Mono",Menlo,Consolas,monospace';
  ObraBase.HUD = {
    MONO,
    // faixa com a forma de onda e o espectro, no pé da tela
    faixa(hx, A, x, y, w, h, alfa) {
      hx.save(); hx.globalAlpha = alfa;
      hx.strokeStyle = 'rgba(255,255,255,.75)'; hx.lineWidth = 1;
      hx.beginPath(); const n = 256;
      for (let i = 0; i < n; i++) { const v = A.onda[i * 4] || 0, xx = x + i / (n - 1) * w, yy = y + h * 0.3 - v * h * 0.9; i ? hx.lineTo(xx, yy) : hx.moveTo(xx, yy); }
      hx.stroke();
      hx.beginPath();
      for (let i = 0; i < 128; i++) { const f = Math.pow(i / 127, 2) * 500 | 0, v = A.freq[f] / 255, xx = x + i / 127 * w; hx.moveTo(xx, y + h); hx.lineTo(xx, y + h - v * h * 0.45); }
      hx.strokeStyle = 'rgba(255,255,255,.35)'; hx.stroke();
      hx.strokeStyle = 'rgba(255,255,255,.5)'; hx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
      hx.restore();
    },
    caixa(hx, x, y, w, h, rotulo, alfa, acento) {
      hx.save(); hx.globalAlpha = alfa; hx.lineWidth = 1; hx.strokeStyle = acento || 'rgba(255,255,255,.85)';
      hx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
      if (rotulo) { hx.font = MONO; hx.fillStyle = 'rgba(255,255,255,.9)'; hx.fillText(rotulo, Math.round(x) + 3, Math.round(y) - 4); }
      hx.restore();
    },
    texto(hx, s, x, y, alfa) { hx.save(); hx.globalAlpha = alfa; hx.font = MONO; hx.fillStyle = 'rgba(255,255,255,.85)'; hx.fillText(s, x, y); hx.restore(); },
    nota(hz) { if (!hz) return '—'; const n = Math.round(12 * Math.log2(hz / 440)) + 69, N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; return N[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }
  };
  window.ObraBase = ObraBase;
})();
