/* Gravação de tela — usada por todas as obras audiovisuais (carregar no <head>, logo depois de lib/projecao.js).
   - Botão discreto de gravar no canto inferior esquerdo, ao lado dos botões de câmera, áudio e projeção
     (aparece quando o mouse/dedo se mexe; durante a gravação fica sempre à vista, vermelho, com o tempo). Atalho: Shift+R.
   - Grava a mesma imagem que vai para o projetor (o canvas principal da obra com as camadas de canvas/vídeo por cima);
     painéis, botões e textos em HTML ficam de fora.
   - Som: tudo o que a obra manda para as caixas (qualquer AudioContext da página) e, se escolhido, o microfone.
     Em "Automático", grava o som da obra; se a obra não toca nada (obras que só escutam), grava o microfone.
   - MP4 (H.264) quando o navegador permite, senão WebM. No iPad/iPhone abre a folha de compartilhar (Salvar vídeo).
   - Ajustes (formato, qualidade, quadros, som) no localStorage 'gravacao-ajustes'. */
(function () {
  if (window.Gravacao) return;
  const OBRA = (location.pathname.replace(/\/index\.html$/, '/').split('/').filter(Boolean).pop()) || 'obra';

  // ---------- som: cada ligação ao destino de um AudioContext também vai para uma "escuta" ----------
  const escutas = new Map();   // AudioContext -> MediaStreamAudioDestinationNode
  let mistura = null;          // { ctx, dest, ligados:Set } durante a gravação
  const AN = window.AudioNode && AudioNode.prototype;
  if (AN && window.AudioDestinationNode) {
    const conn = AN.connect, desc = AN.disconnect;
    const escuta = (ctx) => {
      let t = escutas.get(ctx);
      if (!t && ctx && typeof ctx.createMediaStreamDestination === 'function' && !(window.OfflineAudioContext && ctx instanceof OfflineAudioContext)) {
        try { t = ctx.createMediaStreamDestination(); escutas.set(ctx, t); ligarNaMistura(t); } catch (e) { t = null; }
      }
      return t;
    };
    AN.connect = function (dest, saida) {
      const r = conn.apply(this, arguments);
      if (dest instanceof AudioDestinationNode) { const t = escuta(dest.context); if (t) try { conn.call(this, t, saida || 0); } catch (e) {} }
      return r;
    };
    AN.disconnect = function (dest) {
      const r = desc.apply(this, arguments);
      if (dest instanceof AudioDestinationNode) { const t = escutas.get(dest.context); if (t) try { desc.call(this, t); } catch (e) {} }
      return r;
    };
  }
  // ---------- microfone: guarda os fluxos de áudio que a obra abriu ----------
  const mics = [];
  const md = navigator.mediaDevices;
  if (md && md.getUserMedia) {
    const gum = md.getUserMedia.bind(md);
    md.getUserMedia = async function (c) {
      const s = await gum(c);
      try { if (s && s.getAudioTracks().length) mics.push(s); } catch (e) {}
      return s;
    };
  }
  const micsVivos = () => mics.filter((s) => s.getAudioTracks().some((t) => t.readyState === 'live'));

  function ligarNaMistura(t) {
    if (!mistura || mistura.ligados.has(t)) return;
    try { const src = mistura.ctx.createMediaStreamSource(t.stream); src.connect(mistura.dest); mistura.ligados.add(t); mistura.fontes.push(src); } catch (e) {}
  }

  // ---------- formatos ----------
  const FORMATOS = [
    ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'MP4 (H.264)', 'mp4'], ['video/mp4;codecs=avc1,mp4a.40.2', 'MP4 (H.264)', 'mp4'],
    ['video/mp4;codecs=avc1', 'MP4 (H.264)', 'mp4'], ['video/mp4', 'MP4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'WebM (VP9)', 'webm'], ['video/webm;codecs=vp8,opus', 'WebM (VP8)', 'webm'], ['video/webm', 'WebM', 'webm'],
  ].filter(([m]) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m))
    .filter((f, i, a) => a.findIndex((g) => g[1] === f[1]) === i);

  const KA = 'gravacao-ajustes';
  const AJ0 = { fmt: 0, qual: 20, fps: 60, som: 'auto' };
  const lerAj = () => { const a = Object.assign({}, AJ0); try { Object.assign(a, JSON.parse(localStorage.getItem(KA)) || {}); } catch (e) {} if (a.fmt >= FORMATOS.length) a.fmt = 0; return a; };
  const salvarAj = (a) => { try { localStorage.setItem(KA, JSON.stringify(a)); } catch (e) {} };

  // ---------- imagem ----------
  function maiorCanvas() {
    let best = null, ba = 0;
    document.querySelectorAll('canvas').forEach((c) => {
      if (!c.width || !c.height || (c.closest && c.closest('.gravsel,.semproj'))) return;
      const r = c.getBoundingClientRect(), a = Math.max(0, r.width) * Math.max(0, r.height);
      if (a > ba && getComputedStyle(c).display !== 'none') { ba = a; best = c; }
    });
    return best;
  }

  // ---------- gravar ----------
  let rec = null, partes = [], fmt = null, inicio = 0, relogio = 0, segurando = false, fluxo = null;
  function gravar() { if (rec) parar(); else comecar(); }
  function comecar() {
    if (!FORMATOS.length) { alert('Este navegador não consegue gravar a tela. Use o Chrome atualizado (ou Safari 14.1+).'); return; }
    const aj = lerAj(); fmt = FORMATOS[aj.fmt] || FORMATOS[0];
    if (fmt[2] !== 'mp4') fmt = FORMATOS.find((f) => f[2] === 'mp4') || fmt;   // sempre MP4 quando o navegador permite
    let cv = null;
    if (window.Projecao && Projecao.segurar) { cv = Projecao.segurar(true); segurando = true; }
    else cv = maiorCanvas();
    if (!cv || !cv.captureStream) { if (segurando) { Projecao.segurar(false); segurando = false; } alert('Não achei a imagem da obra para gravar.'); return; }
    fluxo = cv.captureStream(+aj.fps || 60);

    // som
    const querObra = aj.som === 'auto' || aj.som === 'obra' || aj.som === 'ambos';
    let querMic = aj.som === 'mic' || aj.som === 'ambos';
    if (aj.som === 'auto' && !escutas.size) querMic = true;    // obra que só escuta: grava o microfone
    if (aj.som !== 'nenhum' && (querObra || querMic)) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC(); const dest = ctx.createMediaStreamDestination();
        mistura = { ctx, dest, ligados: new Set(), fontes: [], obra: querObra };
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        if (querObra) escutas.forEach((t) => ligarNaMistura(t));
        if (querMic) micsVivos().forEach((s) => { try { const src = ctx.createMediaStreamSource(s); src.connect(dest); mistura.fontes.push(src); } catch (e) {} });
        dest.stream.getAudioTracks().forEach((t) => fluxo.addTrack(t));
        if (!querObra) mistura.ligados = { has: () => true, add() {} };   // não puxa escutas novas
      } catch (e) { mistura = null; }
    }

    try { rec = new MediaRecorder(fluxo, { mimeType: fmt[0], videoBitsPerSecond: (+aj.qual || 20) * 1e6, audioBitsPerSecond: 192000 }); }
    catch (e) {
      try { rec = new MediaRecorder(fluxo, { mimeType: fmt[0] }); }
      catch (e2) { alert('Não consegui começar a gravação: ' + e2.message); limpar(); return; }
    }
    partes = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) partes.push(e.data); };
    rec.onstop = salvar;
    rec.start(1000); inicio = performance.now();
    clearInterval(relogio); relogio = setInterval(pintar, 250);
    pintar();
  }
  function parar() { if (rec && rec.state !== 'inactive') rec.stop(); }
  function limpar() {
    clearInterval(relogio);
    if (fluxo) fluxo.getVideoTracks().forEach((t) => t.stop());
    if (mistura) { try { mistura.fontes.forEach((s) => s.disconnect()); mistura.ctx.close(); } catch (e) {} mistura = null; }
    if (segurando && window.Projecao) Projecao.segurar(false);
    segurando = false; fluxo = null; rec = null; pintar();
  }
  function salvar() {
    const blob = new Blob(partes, { type: fmt[0].split(';')[0] }); partes = [];
    limpar();
    if (!blob.size) { alert('A gravação ficou vazia.'); return; }
    const d = new Date(), z = (n) => String(n).padStart(2, '0');
    const nome = `${OBRA}-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}.${fmt[2]}`;
    const arq = new File([blob], nome, { type: blob.type });
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      if (navigator.canShare && navigator.canShare({ files: [arq] })) { navigator.share({ files: [arq] }).catch(() => baixar(arq)); return; }
    }
    baixar(arq);
  }
  function baixar(arq) { const a = document.createElement('a'); a.href = URL.createObjectURL(arq); a.download = arq.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); }

  // ---------- botão e painel ----------
  const CSS = `
.gravsel{position:fixed;z-index:2147483000;left:calc(max(12px,env(safe-area-inset-left,0px)) + 188px);bottom:calc(12px + env(safe-area-inset-bottom,0px));
  display:flex;gap:8px;align-items:center;opacity:0;pointer-events:none;transition:opacity .35s}
.gravsel.vis,.gravsel.rec{opacity:1;pointer-events:auto}
.gravsel>button{all:unset;cursor:pointer;box-sizing:border-box;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;
  background:rgba(16,18,26,.82);color:#f2f0ea;border:1px solid rgba(255,255,255,.25);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.gravsel>button svg{width:18px;height:18px}
.gravsel .gBola{fill:#ff4b4b}
.gravsel.rec .gPrin{border-color:#ff4b4b;background:rgba(60,8,8,.85)}
.gravsel.rec .gBola{animation:gPisca 1s steps(2) infinite}
@keyframes gPisca{50%{opacity:.25}}
.gravsel .gT{display:none;font:600 12px/1 system-ui,-apple-system,sans-serif;color:#ff8080;font-variant-numeric:tabular-nums;
  background:rgba(16,18,26,.82);padding:6px 9px;border-radius:12px;border:1px solid rgba(255,75,75,.5)}
.gravsel.rec .gT{display:block}
.gravsel.rec:not(.vis) .gAj{display:none}
.gravsel .gpan{position:absolute;left:0;bottom:46px;width:270px;box-sizing:border-box;padding:12px 14px;border-radius:12px;
  background:rgba(11,13,18,.96);border:1px solid #ff6b6b;color:#e9ecf2;font:12px/1.35 system-ui,-apple-system,sans-serif;display:none}
.gravsel.aberto .gpan{display:block}
.gravsel .gpan h4{margin:0 0 2px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#ff8a8a;font-weight:600}
.gravsel .gpan p{margin:0 0 8px;color:#8b93a3}
.gravsel .gpan .l{display:flex;align-items:center;gap:8px;margin:5px 0}
.gravsel .gpan .l label{flex:0 0 78px;color:#aab1bf}
.gravsel .gpan select{flex:1;min-width:0;background:#1b2029;color:#e9ecf2;border:1px solid #2a303c;border-radius:7px;padding:4px 6px;font:inherit}
.gravsel .gpan .gGo{all:unset;cursor:pointer;display:block;text-align:center;margin-top:10px;padding:7px;border-radius:8px;background:#ff4b4b;color:#fff;font-weight:600}
.gravsel.rec .gpan .gGo{background:#2a303c}`;
  const SVG_REC = '<svg viewBox="0 0 24 24"><circle class="gBola" cx="12" cy="12" r="6.5"/></svg>';
  const SVG_STOP = '<svg viewBox="0 0 24 24"><rect class="gBola" x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>';
  let raiz = null, timer = 0;
  function pintar() {
    if (!raiz) return;
    const on = !!rec;
    raiz.classList.toggle('rec', on);
    const b = raiz.querySelector('.gPrin');
    b.innerHTML = on ? SVG_STOP : SVG_REC;
    b.title = on ? 'Parar e salvar o vídeo (Shift+R)' : 'Gravar a tela da obra, com som (Shift+R)';
    raiz.querySelector('.gGo').textContent = on ? '■ Parar e salvar' : '● Gravar';
    if (on) { const s = Math.floor((performance.now() - inicio) / 1000); raiz.querySelector('.gT').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  }
  function montar() {
    if (raiz || !document.body) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    raiz = document.createElement('div'); raiz.className = 'gravsel';
    const aj = lerAj();
    const opt = (lista, v) => lista.map(([val, nome]) => `<option value="${val}"${String(val) === String(v) ? ' selected' : ''}>${nome}</option>`).join('');
    raiz.innerHTML =
      '<button class="gPrin" aria-label="Gravar a tela"></button>' +
      '<button class="gAj" title="Ajustes da gravação" aria-label="Ajustes da gravação"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg></button>' +
      '<span class="gT">0:00</span>' +
      '<div class="gpan"><h4>Gravação de tela</h4><p>Grava só a imagem da obra (sem painéis e botões), com o som. Ao parar, o vídeo é baixado.</p>' +
      `<div class="l"><label>Formato</label><select data-k="fmt">${FORMATOS.length ? opt(FORMATOS.map((f, i) => [i, f[1]]), aj.fmt) : '<option>indisponível</option>'}</select></div>` +
      `<div class="l"><label>Qualidade</label><select data-k="qual">${opt([[8, 'Leve (8 Mbps)'], [20, 'Alta (20 Mbps)'], [50, 'Máxima (50 Mbps)']], aj.qual)}</select></div>` +
      `<div class="l"><label>Quadros/s</label><select data-k="fps">${opt([[30, '30'], [60, '60']], aj.fps)}</select></div>` +
      `<div class="l"><label>Som</label><select data-k="som">${opt([['auto', 'Automático'], ['obra', 'Só o som da obra'], ['mic', 'Só o microfone'], ['ambos', 'Obra + microfone'], ['nenhum', 'Sem som']], aj.som)}</select></div>` +
      '<button class="gGo"></button></div>';
    document.body.appendChild(raiz);
    raiz.querySelector('.gPrin').onclick = (e) => { e.stopPropagation(); gravar(); };
    raiz.querySelector('.gGo').onclick = (e) => { e.stopPropagation(); raiz.classList.remove('aberto'); gravar(); };
    raiz.querySelector('.gAj').onclick = (e) => { e.stopPropagation(); raiz.classList.toggle('aberto'); };
    raiz.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { const a = lerAj(); a[s.dataset.k] = s.dataset.k === 'som' ? s.value : +s.value; salvarAj(a); }));
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown', 'input', 'change', 'wheel'].forEach((ev) => raiz.addEventListener(ev, (e) => e.stopPropagation()));
    const mostrar = () => { raiz.classList.add('vis'); clearTimeout(timer); timer = setTimeout(() => { if (!raiz.classList.contains('aberto')) raiz.classList.remove('vis'); }, 2500); };
    ['mousemove', 'touchstart'].forEach((ev) => document.addEventListener(ev, mostrar, { passive: true }));
    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'R' || e.key === 'r') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '') && !e.target.isContentEditable) {
        e.preventDefault(); e.stopPropagation(); gravar();
      }
    }, true);
    addEventListener('pagehide', parar);
    pintar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();

  window.Gravacao = { gravar, parar, get gravando() { return !!rec; } };
})();
