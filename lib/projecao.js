/* Modo projeção — usado por todas as obras audiovisuais.
   - Um botão discreto de projetor (canto inferior esquerdo, ao lado dos botões de câmera e áudio; aparece quando o
     mouse/dedo se mexe) abre uma JANELA DE PROJEÇÃO separada só com a imagem da obra. Atalho: Shift+P.
   - Os controles continuam nesta janela. A imagem passa direto entre as janelas (sem captura de aba), então a barra
     de compartilhamento do Chrome não aparece.
   - Na janela de projeção: ajuste de 4 cantos (calibração salva por obra), grade de teste, blackout, tela cheia.
   - Captura a área da tela principal da obra (o maior canvas) com tudo o que é desenhado em canvas/vídeo por cima dela;
     painéis, botões e textos em HTML ficam de fora.
   - Mantenha esta janela visível no Mac (não minimize): se ela ficar escondida, o navegador para de desenhar a obra. */
(function () {
  if (window.Projecao) return;
  const SCRIPT = document.currentScript && document.currentScript.src;
  const PAGINA = SCRIPT ? new URL('projecao.html', SCRIPT).href : null;
  const OBRA = location.pathname.replace(/index\.html$/, '');
  const CANAL = 'projecao:' + OBRA;

  // ---------- quadro único: roda os requestAnimationFrame da obra e logo depois compõe a imagem ----------
  const nRAF = window.requestAnimationFrame.bind(window);
  let fila = new Map(), idc = 0, agendado = false, ativo = false;
  function agenda() { if (!agendado) { agendado = true; nRAF(tick); } }
  window.requestAnimationFrame = function (cb) { const id = ++idc; fila.set(id, cb); agenda(); return id; };
  window.cancelAnimationFrame = function (id) { fila.delete(id); };
  if (window.webkitRequestAnimationFrame) window.webkitRequestAnimationFrame = window.requestAnimationFrame;
  function tick(t) {
    agendado = false;
    const f = fila; fila = new Map();
    f.forEach((cb) => { try { cb(t); } catch (e) { setTimeout(() => { throw e; }); } });
    if (ativo) { compor(); agenda(); }
  }

  // ---------- composição ----------
  let comp = null, cx = null, stream = null, principal = null, nQuadro = 0, versao = 0;
  const nosso = (el) => el === comp || (el.closest && el.closest('.projsel,.audsel,.camsel'));
  function visivel(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.02) return false;
    let p = el.parentElement;
    for (let i = 0; p && i < 6; i++, p = p.parentElement) { const ps = getComputedStyle(p); if (ps.display === 'none' || ps.visibility === 'hidden' || +ps.opacity < 0.02) return false; }
    return true;
  }
  function areaVisivel(r) { return Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); }
  function acharPrincipal() {
    let best = null, ba = 0;
    document.querySelectorAll('canvas').forEach((c) => {
      if (nosso(c) || !c.width || !c.height) return;
      const a = areaVisivel(c.getBoundingClientRect());
      if (a > ba && visivel(c)) { ba = a; best = c; }
    });
    return best;
  }
  let camadas = [];
  function acharCamadas(R) {
    camadas = [];
    document.querySelectorAll('canvas,video').forEach((el) => {
      if (nosso(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right <= R.left || r.left >= R.right || r.bottom <= R.top || r.top >= R.bottom) return;
      if (el.tagName === 'VIDEO' && !(el.videoWidth > 0)) return;
      if (!visivel(el)) return;
      camadas.push({ el });
    });
  }
  // filtros CSS (brilho, contraste, saturação, cor, inverter), opacidade e espelhamento da obra e dos elementos em volta
  function estilo(el) {
    const f = []; let a = 1, fx = false, fy = false;
    for (let e = el, i = 0; e && e !== document.documentElement && i < 10; e = e.parentElement, i++) {
      const cs = getComputedStyle(e);
      if (cs.filter && cs.filter !== 'none') f.push(cs.filter);
      a *= +cs.opacity;
      const m = cs.transform && cs.transform.match(/matrix\(([^)]+)\)/);
      if (m) { const v = m[1].split(',').map(Number); if (v[0] < 0) fx = !fx; if (v[3] < 0) fy = !fy; }
    }
    return { f: f.join(' ') || 'none', a, fx, fy };
  }
  function compor() {
    if (!comp) return;
    if (nQuadro++ % 30 === 0 || !principal || !principal.isConnected) principal = acharPrincipal();
    if (!principal) { cx.fillStyle = '#000'; cx.fillRect(0, 0, comp.width, comp.height); return; }
    let R = principal.getBoundingClientRect();
    R = { left: Math.max(0, R.left), top: Math.max(0, R.top), right: Math.min(innerWidth, R.right), bottom: Math.min(innerHeight, R.bottom) };
    const rw = R.right - R.left, rh = R.bottom - R.top;
    if (rw < 2 || rh < 2) return;
    const s = Math.min(1920 / rw, 1080 / rh, 2);
    const W = Math.round(rw * s), H = Math.round(rh * s);
    if (comp.width !== W || comp.height !== H) { comp.width = W; comp.height = H; }
    if (nQuadro % 30 === 1 || !camadas.length) acharCamadas(R);
    cx.globalAlpha = 1; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
    for (const c of camadas) {
      if (!c.el.isConnected) continue;
      const r = c.el.getBoundingClientRect();
      const x = (r.left - R.left) * s, y = (r.top - R.top) * s, w = r.width * s, h = r.height * s;
      const st = estilo(c.el);
      cx.save();
      cx.globalAlpha = Math.max(0, Math.min(1, st.a));
      cx.filter = st.f;
      try {
        if (st.fx || st.fy) { cx.translate(st.fx ? x + w : x, st.fy ? y + h : y); cx.scale(st.fx ? -1 : 1, st.fy ? -1 : 1); cx.drawImage(c.el, 0, 0, w, h); }
        else cx.drawImage(c.el, x, y, w, h);
      } catch (e) {}
      cx.restore();
    }
    cx.globalAlpha = 1; cx.filter = 'none';
  }
  // semVideo: a janela de projeção lê os pixels direto deste canvas (cores exatas, sem compressão de vídeo)
  function iniciar(semVideo) {
    if (!comp) { comp = document.createElement('canvas'); comp.width = 1280; comp.height = 720; cx = comp.getContext('2d', { alpha: false }); versao++; }
    if (!semVideo && !stream) { stream = comp.captureStream(60); versao++; }
    ativo = true; ultimoVivo = performance.now(); agenda(); marcar();
    return stream;
  }

  // ---------- conversa com a janela de projeção ----------
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(CANAL) : null;
  let janela = null, ultimoVivo = 0;
  if (bc) bc.onmessage = (ev) => { const d = ev.data || {}; if (d.t === 'vivo') { ultimoVivo = performance.now(); if (!ativo) iniciar(); } else if (d.t === 'tchau') { ativo = false; marcar(); } };
  setInterval(() => { if (ativo && performance.now() - ultimoVivo > 4000) { ativo = false; marcar(); } }, 1000);
  function abrir() {
    if (!PAGINA) return;
    if (janela && !janela.closed) { janela.focus(); return; }
    janela = window.open(PAGINA + '?v=4&obra=' + encodeURIComponent(OBRA) + '&titulo=' + encodeURIComponent(document.title || ''), 'projecao_' + OBRA, 'popup,width=960,height=540');
    if (!janela) alert('O navegador bloqueou a janela de projeção. Permita pop-ups para este site e tente de novo.');
  }

  // ---------- botão ----------
  const CSS = `
.projsel{position:fixed;z-index:2147483000;left:calc(max(12px,env(safe-area-inset-left,0px)) + 88px);bottom:calc(12px + env(safe-area-inset-bottom,0px));
  opacity:0;pointer-events:none;transition:opacity .35s}
.projsel.vis,.projsel.on.vis{opacity:1;pointer-events:auto}
.projsel button{all:unset;cursor:pointer;box-sizing:border-box;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;
  background:rgba(16,18,26,.82);color:#f2f0ea;border:1px solid rgba(255,255,255,.25);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.projsel.on button{border-color:#6fdc8c;color:#6fdc8c}
.projsel svg{width:19px;height:19px}`;
  let raiz = null, timer = 0;
  function montar() {
    if (raiz || !document.body) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    raiz = document.createElement('div'); raiz.className = 'projsel';
    raiz.innerHTML = '<button title="Janela de projeção (Shift+P)" aria-label="Janela de projeção"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="10" rx="2"/><circle cx="15.5" cy="12" r="2.6"/><path d="M6 10.5h4M6 13.5h3M7 17l-1 2.5M17 17l1 2.5"/></svg></button>';
    document.body.appendChild(raiz);
    const b = raiz.querySelector('button');
    b.onclick = (e) => { e.stopPropagation(); abrir(); };
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach((ev) => raiz.addEventListener(ev, (e) => e.stopPropagation()));
    const mostrar = () => { raiz.classList.add('vis'); clearTimeout(timer); timer = setTimeout(() => raiz.classList.remove('vis'), 2500); };
    ['mousemove', 'touchstart'].forEach((ev) => document.addEventListener(ev, mostrar, { passive: true }));
    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'P' || e.key === 'p') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '') && !e.target.isContentEditable) { e.preventDefault(); e.stopPropagation(); abrir(); }
    }, true);
    marcar();
  }
  function marcar() {
    if (!raiz) return;
    raiz.classList.toggle('on', ativo);
    raiz.querySelector('button').title = ativo ? 'Janela de projeção aberta — clique para trazê-la (Shift+P)' : 'Abrir janela de projeção (Shift+P)';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();

  window.Projecao = { iniciar, abrir, get canvas() { return comp; }, get versao() { return versao; }, get ativo() { return ativo; } };
})();
