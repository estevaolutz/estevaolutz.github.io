/* Modo leitura — texto rolando sobre o mapa.
   Cada mapa chama Leitura.init({...}) com as paradas e uma função que leva o mapa até elas.
   Ao rolar o texto, a parada que passa pela linha de leitura move o mapa.

   cfg = {
     titulo: 'Mapa da Odisseia',                // título no topo
     intro: 'texto curto',                      // opcional
     botao: { em: Element|seletor, onde: 'append'|'prepend'|'before'|'after', classe: '' } | null (botão flutuante)
     mapa: Element|seletor|null,                // contêiner que vira tela cheia (null = o mapa já é tela cheia)
     esconder: ['seletor', ...],                // elementos escondidos durante a leitura
     itens: () => [{ sobre, titulo, html, cor, secao }],   // secao:true = divisória (abre um mito, uma expedição…)
     ir: (i, item) => {},                       // leva o mapa até o item i
     inicio: () => índice inicial,
     aoEntrar, aoSair: () => {}
   } */
(function () {
  if (window.Leitura) return;
  const CSS = `
.lt-btn{display:inline-flex;align-items:center;gap:7px;font:600 13px/1 system-ui,-apple-system,sans-serif;letter-spacing:.01em;
  padding:9px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(16,18,26,.86);color:#f2f0ea;cursor:pointer;
  box-shadow:0 4px 16px rgba(0,0,0,.25);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);white-space:nowrap}
.lt-btn.lt-abaixo{margin:10px 0 0;align-self:flex-start;justify-self:start;width:max-content}
.lt-btn:hover{background:rgba(32,36,50,.94)}
.lt-btn svg{width:16px;height:16px;flex:none}
.lt-btn.lt-flutua{position:fixed;z-index:60;left:max(14px,env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px))}
body.lt-on{overflow:hidden!important}
body.lt-on .lt-btn{display:none!important}
body.lt-on .lt-esconde{display:none!important}
.lt-mapa{position:fixed!important;inset:0!important;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important;
  aspect-ratio:auto!important;margin:0!important;border-radius:0!important;z-index:2147482000!important;transform:none!important}
.lt-capa{position:fixed;z-index:2147482001;top:0;bottom:0;left:0;width:min(460px,44vw);overflow-y:auto;overscroll-behavior:contain;
  padding:0 22px 0 max(22px,env(safe-area-inset-left,0px));box-sizing:border-box;scrollbar-width:thin;-webkit-overflow-scrolling:touch;
  background:linear-gradient(90deg,rgba(8,10,15,.42),rgba(8,10,15,0))}
.lt-capa:focus{outline:none}
.lt-esp{height:42vh}.lt-fim{height:55vh}
.lt-card{position:relative;margin:0 0 62vh;padding:18px 20px 20px;border-radius:12px;background:rgba(14,16,23,.88);color:#ecebe6;
  border:1px solid rgba(255,255,255,.12);border-left:4px solid var(--c,#e0b34f);box-shadow:0 10px 34px rgba(0,0,0,.4);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);opacity:.5;transition:opacity .35s,transform .35s;transform:scale(.985);
  font:16px/1.6 Georgia,"Iowan Old Style","Times New Roman",serif;cursor:default}
.lt-card.lt-ativo{opacity:1;transform:none}
.lt-card.lt-secao{background:rgba(24,22,16,.9);border-left-width:6px}
.lt-sobre{font:600 11px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--c,#e0b34f);margin-bottom:6px}
.lt-card>h2{margin:0 0 10px;font:700 25px/1.12 Georgia,"Times New Roman",serif;color:#fff;text-wrap:balance}
.lt-card.lt-secao>h2{font-size:30px}
.lt-corpo{color:#dedcd5}
.lt-corpo p{margin:0 0 .8em}.lt-corpo p:last-child{margin-bottom:0}
.lt-corpo h2{font:700 21px/1.15 Georgia,serif;margin:0 0 6px;color:#fff}
.lt-corpo h3,.lt-corpo strong:first-child{display:block;font:600 11px/1.5 ui-monospace,Menlo,monospace!important;letter-spacing:.12em;text-transform:uppercase;color:#b9b5a8!important;margin:14px 0 4px!important}
.lt-corpo *{border-color:rgba(255,255,255,.14)!important}
.lt-corpo p,.lt-corpo li,.lt-corpo dd{color:#e2e0d9!important}
.lt-corpo h3:first-child{margin-top:0}
.lt-corpo .chip,.lt-corpo .lt-tag{display:inline-block;font:500 11.5px/1.3 system-ui,sans-serif;padding:3px 8px;margin:0 4px 4px 0;border-radius:999px;border:1px solid rgba(255,255,255,.18);color:#d6d3ca;background:rgba(255,255,255,.04)}
.lt-corpo a{color:#9fd3ff}
.lt-corpo button,.lt-corpo svg,.lt-corpo canvas,.lt-corpo .acoes,.lt-corpo .actions,.lt-corpo .nav,.lt-corpo .fontes{display:none!important}
.lt-corpo img{max-width:100%;height:auto;border-radius:6px}
.lt-corpo .badge{display:none}
.lt-corpo [lang=grc],.lt-corpo .greek{font-style:italic;color:#bdb7a6}
.lt-barra{position:fixed;z-index:2147482002;top:calc(12px + env(safe-area-inset-top,0px));left:max(22px,env(safe-area-inset-left,0px));max-width:calc(min(460px,44vw) - 44px);
  display:flex;align-items:center;gap:6px;padding:6px;border-radius:12px;background:rgba(14,16,23,.9);border:1px solid rgba(255,255,255,.14);
  color:#ecebe6;font:500 13px/1 system-ui,-apple-system,sans-serif;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,.35)}
.lt-barra b{font-weight:600;max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 6px}
.lt-barra span{font:500 12px ui-monospace,Menlo,monospace;color:#b7b4aa;padding:0 4px;white-space:nowrap}
.lt-barra button{font:600 13px/1 system-ui,sans-serif;color:#ecebe6;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);
  border-radius:8px;padding:8px 11px;cursor:pointer;min-width:36px}
.lt-barra button:hover{background:rgba(255,255,255,.14)}
.lt-prog{position:fixed;z-index:2147482002;top:0;left:0;height:3px;background:#e0b34f;width:0;transition:width .3s}
.lt-dica{font:13px/1.45 system-ui,sans-serif;color:#b9b6ad;margin-top:10px}
@media (max-width:700px){
  .lt-mapa{bottom:42vh!important;bottom:42svh!important}
  .lt-capa{width:100%;padding:0 10px;background:none}
  .lt-esp{height:56vh;height:56svh}
  .lt-card{margin-bottom:46vh;margin-bottom:46svh;padding:15px 16px 17px;font-size:15.5px}
  .lt-card>h2{font-size:22px}
  .lt-barra{left:10px;right:10px;max-width:none;top:auto;bottom:calc(8px + env(safe-area-inset-bottom,0px));justify-content:space-between}
  .lt-fim{height:70vh}
  .lt-barra b{max-width:none;flex:1}
  .lt-btn.lt-flutua{bottom:calc(76px + env(safe-area-inset-bottom,0px))}
}
@media (max-height:500px) and (orientation:landscape){
  .lt-capa{width:min(400px,48vw)}
  .lt-barra{max-width:calc(min(400px,48vw) - 44px);top:6px}
  .lt-esp{height:30vh}.lt-card{margin-bottom:58vh;font-size:15px;padding:14px 16px}
  .lt-card>h2{font-size:20px}
}
@media (prefers-reduced-motion:reduce){.lt-card{transition:none}}`;

  const ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 5.5C4.5 4 7.5 4 12 6c4.5-2 7.5-2 10-.5V19c-2.5-1.5-5.5-1.5-10 .5-4.5-2-7.5-2-10-.5z"/><path d="M12 6v13.5"/></svg>';
  const $ = (s) => typeof s === 'string' ? document.querySelector(s) : s;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let estilo = false;
  function addCSS() { if (estilo) return; estilo = true; const st = document.createElement('style'); st.id = 'leitura-css'; st.textContent = CSS; document.head.appendChild(st); }
  const fone = () => matchMedia('(max-width:700px)').matches;

  function init(cfg) {
    addCSS();
    let aberto = false, capa, barra, prog, cards = [], itens = [], ativo = -1, timer = 0, raf = 0, escondidos = [], mapaEl = null;

    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'lt-btn' + (cfg.botao && cfg.botao.classe ? ' ' + cfg.botao.classe : '');
    const R = Object.assign({ botao: 'Modo leitura', dica: 'Role para ler. Cada trecho que passa pelo meio da tela leva o mapa até o lugar. Setas ↑ ↓ também funcionam; Esc sai.', sair: '✕ Sair' }, cfg.rotulos || {});
    btn.innerHTML = ICONE + '<span>' + esc(R.botao) + '</span>';
    btn.title = 'Ler o texto rolando sobre o mapa; o mapa acompanha a leitura';
    btn.onclick = () => abrir();
    const host = cfg.botao && $(cfg.botao.em);
    if (host) {
      const onde = cfg.botao.onde || 'append';
      if (onde === 'prepend') host.prepend(btn); else if (onde === 'before') host.before(btn); else if (onde === 'after') host.after(btn); else host.appendChild(btn);
    } else { btn.classList.add('lt-flutua'); document.body.appendChild(btn); }

    const redimensiona = () => { dispatchEvent(new Event('resize')); };

    function montar() {
      itens = cfg.itens() || [];
      capa = document.createElement('div'); capa.className = 'lt-capa'; capa.tabIndex = -1;
      capa.setAttribute('role', 'region'); capa.setAttribute('aria-label', 'Modo leitura: ' + (cfg.titulo || 'texto do mapa'));
      let h = '<div class="lt-esp"></div>';
      h += `<article class="lt-card lt-secao lt-abertura" data-i="-1"><div class="lt-sobre">${esc(R.botao)}</div><h2>${esc(cfg.titulo || '')}</h2>` +
        (cfg.intro ? `<div class="lt-corpo"><p>${esc(cfg.intro)}</p></div>` : '') +
        `<div class="lt-dica">${esc(R.dica)}</div></article>`;
      itens.forEach((it, i) => {
        h += `<article class="lt-card${it.secao ? ' lt-secao' : ''}" data-i="${i}" style="--c:${esc(it.cor || '#e0b34f')}">` +
          (it.sobre ? `<div class="lt-sobre">${esc(it.sobre)}</div>` : '') +
          (it.titulo ? `<h2>${esc(it.titulo)}</h2>` : '') +
          `<div class="lt-corpo">${it.html || ''}</div></article>`;
      });
      h += '<div class="lt-fim"></div>';
      capa.innerHTML = h;
      cards = [...capa.querySelectorAll('.lt-card')];
      cards.forEach((c) => c.addEventListener('click', (e) => { if (e.target.closest('a')) return; rolarPara(+c.dataset.i); }));
      barra = document.createElement('div'); barra.className = 'lt-barra';
      barra.innerHTML = `<b>${esc(cfg.titulo || '')}</b><span class="lt-pos"></span><button type="button" data-d="-1" aria-label="Trecho anterior">↑</button><button type="button" data-d="1" aria-label="Próximo trecho">↓</button><button type="button" class="lt-sair">${esc(R.sair)}</button>`;
      barra.querySelector('.lt-sair').onclick = fechar;
      barra.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => rolarPara(Math.max(-1, Math.min(itens.length - 1, ativo + +b.dataset.d))));
      prog = document.createElement('div'); prog.className = 'lt-prog';
      document.body.append(capa, barra, prog);
      capa.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(verificar); }, { passive: true });
    }

    function verificar() {
      raf = 0;
      const linha = innerHeight * (fone() ? 0.7 : 0.5);
      let melhor = -1, dist = 1e9;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        const d = r.top <= linha && r.bottom >= linha ? 0 : Math.min(Math.abs(r.top - linha), Math.abs(r.bottom - linha));
        if (d < dist) { dist = d; melhor = +c.dataset.i; }
      }
      if (melhor !== ativo) marcar(melhor, true);
    }

    function marcar(i, mover) {
      ativo = i;
      cards.forEach((c) => c.classList.toggle('lt-ativo', +c.dataset.i === i));
      const pos = barra.querySelector('.lt-pos');
      pos.textContent = i >= 0 ? `${i + 1} / ${itens.length}` : `0 / ${itens.length}`;
      prog.style.width = ((i + 1) / Math.max(1, itens.length) * 100) + '%';
      if (!mover || i < 0) return;
      clearTimeout(timer);
      timer = setTimeout(() => { try { cfg.ir(i, itens[i]); } catch (e) { console.error(e); } }, 180);
    }

    function rolarPara(i, instantaneo) {
      const c = cards.find((x) => +x.dataset.i === i); if (!c) return;
      const linha = innerHeight * (fone() ? 0.7 : 0.5);
      const alvo = capa.scrollTop + c.getBoundingClientRect().top - Math.min(linha - 40, innerHeight * (fone() ? 0.56 : 0.22));
      capa.scrollTo({ top: Math.max(0, alvo), behavior: instantaneo || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }

    function teclas(e) {
      if (!aberto) return;
      const k = e.key;
      if (k === 'Escape') { fechar(); }
      else if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.target.closest('button'))) rolarPara(Math.min(itens.length - 1, ativo + 1));
      else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp') rolarPara(Math.max(-1, ativo - 1));
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    }

    function abrir() {
      if (aberto) return;
      aberto = true;
      try { cfg.aoEntrar && cfg.aoEntrar(); } catch (e) { console.error(e); }
      montar();
      mapaEl = cfg.mapa ? $(cfg.mapa) : null;
      if (mapaEl) mapaEl.classList.add('lt-mapa');
      escondidos = [];
      (cfg.esconder || []).forEach((s) => document.querySelectorAll(s).forEach((el) => { if (!el.classList.contains('lt-esconde')) { el.classList.add('lt-esconde'); escondidos.push(el); } }));
      document.body.classList.add('lt-on');
      addEventListener('keydown', teclas, true);
      redimensiona(); setTimeout(redimensiona, 80); setTimeout(redimensiona, 450);
      let ini = -1; try { ini = cfg.inicio ? cfg.inicio() : -1; } catch (e) {}
      if (!(ini >= 0 && ini < itens.length)) ini = -1;
      requestAnimationFrame(() => { rolarPara(ini, true); marcar(ini, false); capa.focus({ preventScroll: true }); if (ini >= 0) setTimeout(() => cfg.ir(ini, itens[ini]), 300); });
    }

    function fechar() {
      if (!aberto) return;
      aberto = false; clearTimeout(timer);
      removeEventListener('keydown', teclas, true);
      capa.remove(); barra.remove(); prog.remove();
      document.body.classList.remove('lt-on');
      escondidos.forEach((el) => el.classList.remove('lt-esconde'));
      if (mapaEl) mapaEl.classList.remove('lt-mapa');
      redimensiona(); setTimeout(redimensiona, 80); setTimeout(redimensiona, 450);
      try { cfg.aoSair && cfg.aoSair(); } catch (e) { console.error(e); }
      if (mapaEl && mapaEl.getBoundingClientRect().top < 0) mapaEl.scrollIntoView({ block: 'start' });
      btn.focus({ preventScroll: true });
    }
    return { abrir, fechar, botao: btn };
  }
  window.Leitura = { init, esc };
  const fila = window.LeituraQ; window.LeituraQ = { push: init };
  if (Array.isArray(fila)) fila.forEach(init);
})();
