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
  let fila = new Map(), idc = 0, agendado = false, ativo = false, projAtivo = false, seguro = 0;   // ativo = compondo (projeção aberta ou gravação)
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
  const nosso = (el) => el === comp || (el.closest && el.closest('.projsel,.audsel,.camsel,.gravsel'));
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
  const KF = 'projecao-filtros:' + OBRA;   // '0' = a projeção ignora os filtros de imagem da tela
  let copiaFiltros = true; try { copiaFiltros = localStorage.getItem(KF) !== '0'; } catch (e) {}
  function estilo(el) {
    const f = []; let a = 1, fx = false, fy = false;
    for (let e = el, i = 0; e && e !== document.documentElement && i < 10; e = e.parentElement, i++) {
      const cs = getComputedStyle(e);
      if (copiaFiltros && cs.filter && cs.filter !== 'none') f.push(cs.filter);
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
    projAtivo = true; ativo = true; ultimoVivo = performance.now(); agenda(); marcar();
    return stream;
  }

  // ---------- conversa com a janela de projeção ----------
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel(CANAL) : null;
  let janela = null, ultimoVivo = 0, estadoProj = {};
  if (bc) bc.onmessage = (ev) => { const d = ev.data || {}; if (d.t === 'vivo') { ultimoVivo = performance.now(); if (!projAtivo) iniciar(); if (d.estado) { estadoProj = d.estado; pintarPainel(); } } else if (d.t === 'tchau') { projAtivo = false; ativo = seguro > 0; marcar(); } };
  setInterval(() => { if (projAtivo && performance.now() - ultimoVivo > 4000) { projAtivo = false; ativo = seguro > 0; marcar(); } }, 1000);
  // a gravação (lib/gravacao.js) usa a mesma imagem composta, mesmo sem a janela de projeção aberta
  function segurar(on) {
    if (on) { seguro++; if (!comp) { comp = document.createElement('canvas'); comp.width = 1280; comp.height = 720; cx = comp.getContext('2d', { alpha: false }); versao++; } ativo = true; compor(); agenda(); }
    else { seguro = Math.max(0, seguro - 1); ativo = projAtivo || seguro > 0; }
    return comp;
  }
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
.projsel svg{width:19px;height:19px}
.projsel{display:flex;gap:8px;align-items:flex-end}
.projsel .projpan{position:absolute;left:0;bottom:46px;width:300px;max-height:calc(100vh - 80px);overflow:auto;box-sizing:border-box;padding:12px 14px;border-radius:12px;
  background:rgba(11,13,18,.96);border:1px solid #e8b04a;color:#e9ecf2;font:12px/1.35 system-ui,-apple-system,sans-serif;display:none}
.projsel.aberto .projpan{display:block}
.projsel .projpan h4{margin:0 0 2px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#e8b04a;font-weight:600}
.projsel .projpan p{margin:0 0 8px;color:#8b93a3}
.projsel .projpan .l{display:flex;align-items:center;gap:8px;margin:4px 0}
.projsel .projpan .l label{flex:0 0 86px;color:#aab1bf}
.projsel .projpan .l input{flex:1;accent-color:#e8b04a;margin:0}
.projsel .projpan .l output{flex:0 0 34px;text-align:right;color:#8b93a3;font-variant-numeric:tabular-nums}
.projsel .projpan .bts{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.projsel .projpan .bts button{all:unset;cursor:pointer;background:#1b2029;border:1px solid #2a303c;border-radius:7px;padding:5px 9px;color:#e9ecf2}
.projsel .projpan .bts button.on{background:#e8b04a;color:#111;border-color:#e8b04a}
.projsel .projpan .ck{display:flex;gap:6px;align-items:center;margin-top:8px;color:#aab1bf}
.projsel.on .bAjuste{border-color:#e8b04a;color:#e8b04a}`;
  // ---------- imagem da projeção: controles nesta janela, efeito só na janela de projeção ----------
  // Os valores ficam no mesmo lugar que o ajuste de cor da janela de projeção (tecla C lá), então os dois andam juntos.
  const KC = 'projecao-cor', COR0 = { bri: 1, con: 1, sat: 1, gam: 1, pre: 0, r: 1, g: 1, b: 1 };
  const CORES = [['bri', 'Brilho', 0.3, 2, 0.01], ['con', 'Contraste', 0.3, 2, 0.01], ['sat', 'Saturação', 0, 2.5, 0.01], ['gam', 'Gama', 0.4, 2.5, 0.01],
    ['pre', 'Nível do preto', -0.2, 0.2, 0.005], ['r', 'Vermelho', 0, 1.6, 0.01], ['g', 'Verde', 0, 1.6, 0.01], ['b', 'Azul', 0, 1.6, 0.01]];
  const PAINEL = '<div class="projpan"><h4>Imagem da projeção</h4><p>Só muda o que sai no projetor; a tela do Mac fica como está.</p>' +
    CORES.map(([k, n, a, z, st]) => `<div class="l"><label>${n}</label><input type="range" data-c="${k}" min="${a}" max="${z}" step="${st}"><output></output></div>`).join('') +
    '<label class="ck"><input type="checkbox" class="pFiltros"> copiar os filtros de imagem da tela</label>' +
    '<div class="bts"><button data-cmd="preto">Blackout</button><button data-cmd="teste">Barras de teste</button><button data-cmd="grade">Grade</button><button data-cmd="edit">Cantos</button><button data-cmd="padrao">Padrão</button><button data-cmd="abrir">Abrir projeção</button></div></div>';
  const lerCor = () => { let c = Object.assign({}, COR0); try { Object.assign(c, JSON.parse(localStorage.getItem(KC)) || {}); } catch (e) {} return c; };
  function pintarPainel() {
    if (!raiz) return; const c = lerCor();
    raiz.querySelectorAll('.projpan input[data-c]').forEach((el) => { el.value = c[el.dataset.c]; el.nextElementSibling.textContent = (+el.value).toFixed(2); });
    const f = raiz.querySelector('.pFiltros'); if (f) f.checked = copiaFiltros;
    raiz.querySelectorAll('.projpan button[data-cmd]').forEach((bt) => bt.classList.toggle('on', !!estadoProj[bt.dataset.cmd]));
  }
  function ligarPainel() {
    raiz.querySelectorAll('.projpan input[data-c]').forEach((el) => el.addEventListener('input', () => {
      const c = lerCor(); c[el.dataset.c] = +el.value; el.nextElementSibling.textContent = (+el.value).toFixed(2);
      try { localStorage.setItem(KC, JSON.stringify(c)); } catch (e) {}   // a janela de projeção ouve a mudança e aplica
      if (bc) bc.postMessage({ t: 'cor', cor: c });
    }));
    raiz.querySelector('.pFiltros').addEventListener('change', (e) => { copiaFiltros = e.target.checked; try { localStorage.setItem(KF, copiaFiltros ? '1' : '0'); } catch (x) {} });
    raiz.querySelectorAll('.projpan button[data-cmd]').forEach((bt) => bt.addEventListener('click', () => {
      const c = bt.dataset.cmd;
      if (c === 'abrir') { abrir(); return; }
      if (c === 'padrao') { try { localStorage.setItem(KC, JSON.stringify(COR0)); } catch (e) {} if (bc) bc.postMessage({ t: 'cor', cor: COR0 }); pintarPainel(); return; }
      if (bc) bc.postMessage({ t: 'cmd', c });
      estadoProj[c] = !estadoProj[c]; pintarPainel();
    }));
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown', 'input', 'change'].forEach((ev) => raiz.querySelector('.projpan').addEventListener(ev, (e) => e.stopPropagation()));
    addEventListener('storage', (e) => { if (e.key === KC) pintarPainel(); });
  }
  let raiz = null, timer = 0;
  function montar() {
    if (raiz || !document.body) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    raiz = document.createElement('div'); raiz.className = 'projsel';
    raiz.innerHTML = '<button title="Janela de projeção (Shift+P)" aria-label="Janela de projeção"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="10" rx="2"/><circle cx="15.5" cy="12" r="2.6"/><path d="M6 10.5h4M6 13.5h3M7 17l-1 2.5M17 17l1 2.5"/></svg></button>';
    raiz.insertAdjacentHTML('beforeend', '<button class="bAjuste" title="Imagem da projeção (só no projetor, não muda a tela do Mac)" aria-label="Imagem da projeção"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg></button>' + PAINEL);
    document.body.appendChild(raiz);
    const b = raiz.querySelector('button');
    b.onclick = (e) => { e.stopPropagation(); abrir(); };
    raiz.querySelector('.bAjuste').onclick = (e) => { e.stopPropagation(); raiz.classList.toggle('aberto'); pintarPainel(); };
    ligarPainel();
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach((ev) => raiz.addEventListener(ev, (e) => e.stopPropagation()));
    const mostrar = () => { raiz.classList.add('vis'); clearTimeout(timer); timer = setTimeout(() => { if (!raiz.classList.contains('aberto')) raiz.classList.remove('vis'); }, 2500); };
    ['mousemove', 'touchstart'].forEach((ev) => document.addEventListener(ev, mostrar, { passive: true }));
    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'P' || e.key === 'p') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '') && !e.target.isContentEditable) { e.preventDefault(); e.stopPropagation(); abrir(); }
    }, true);
    marcar();
  }
  function marcar() {
    if (!raiz) return;
    raiz.classList.toggle('on', projAtivo);
    raiz.querySelector('button').title = projAtivo ? 'Janela de projeção aberta — clique para trazê-la (Shift+P)' : 'Abrir janela de projeção (Shift+P)';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();

  window.Projecao = { iniciar, abrir, segurar, get canvas() { return comp; }, get versao() { return versao; }, get ativo() { return projAtivo; } };
})();
