/* Escolha de câmera — usado por todos os apps que usam câmera.
   - Se houver uma câmera Logitech conectada, ela é usada automaticamente (modo "Automática").
   - Um botão discreto de câmera (canto inferior esquerdo; aparece quando o mouse/dedo se mexe)
     lista as câmeras e troca na hora, sem recarregar a página. A escolha fica guardada no aparelho.
   - Se a Logitech for conectada com o app aberto, a troca é automática.
   - Atalho: Shift+C abre/fecha a lista.
   - O app pode ouvir o evento 'camera-trocada' (window) para reler a trilha de vídeo. */
(function () {
  if (window.CameraPref) return;
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) return;
  const KEY = 'camera-preferida';
  const orig = md.getUserMedia.bind(md);
  const ehLogitech = (l) => /logi|logitech|brio|streamcam|c9[0-9]{2}|c6[0-9]{2}|c5[0-9]{2}/i.test(l || '');
  let lista = [];
  const streams = new Set();
  const lado = new WeakMap();   // facingMode original pedido pelo app

  const lerPref = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { modo: 'auto' }; } catch (e) { return { modo: 'auto' }; } };
  const salvarPref = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} };

  async function cameras() {
    try { lista = (await md.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch (e) { lista = []; }
    return lista;
  }
  // deviceId que deve ser usado, ou null (= comportamento original do app)
  function escolhida() {
    const p = lerPref();
    const logi = lista.find((d) => ehLogitech(d.label));
    if (p.modo === 'padrao') return null;
    if (p.modo === 'fixa') {
      const d = lista.find((x) => x.deviceId && x.deviceId === p.id) || lista.find((x) => x.label && x.label === p.label);
      if (d) return d.deviceId;
    }
    return logi ? logi.deviceId : null;
  }
  function comCamera(c, id) {
    const v = Object.assign({}, c.video === true ? {} : c.video);
    delete v.facingMode;
    v.deviceId = { exact: id };
    return Object.assign({}, c, { video: v });
  }
  const idDe = (s) => { const t = s.getVideoTracks()[0]; return t && t.getSettings ? t.getSettings().deviceId : null; };
  function guardar(s, c) { if (c && c.video && c.video !== true && c.video.facingMode) lado.set(s, c.video.facingMode); if (s && s.getVideoTracks().length) { streams.add(s); setTimeout(atualizarBotao, 0); } return s; }

  md.getUserMedia = async function (c) {
    if (!c || !c.video) return orig(c);
    if (c.video !== true && c.video.deviceId) return guardar(await orig(c), c);   // o app escolheu a câmera
    await cameras();
    let id = escolhida();
    if (!id && lista.length && !lista[0].label) {
      // sem permissão ainda o navegador esconde os nomes: abre a padrão, descobre a Logitech e troca
      const s = await orig(c);
      await cameras();
      id = escolhida();
      if (id && id !== idDe(s)) {
        try { const s2 = await orig(comCamera(c, id)); s.getTracks().forEach((t) => t.stop()); return guardar(s2, c); } catch (e) {}
      }
      return guardar(s, c);
    }
    if (id) { try { return guardar(await orig(comCamera(c, id)), c); } catch (e) { /* cai na câmera original */ } }
    return guardar(await orig(c), c);
  };

  // troca a câmera dos vídeos abertos sem reiniciar o app
  async function trocar(id) {
    for (const s of [...streams]) {
      const velha = s.getVideoTracks()[0];
      if (!velha || velha.readyState === 'ended') { streams.delete(s); continue; }
      if (id && idDe(s) === id) continue;
      const st = velha.getSettings ? velha.getSettings() : {};
      const v = {};
      if (st.width) v.width = { ideal: st.width };
      if (st.height) v.height = { ideal: st.height };
      if (st.frameRate) v.frameRate = { ideal: st.frameRate };
      if (id) v.deviceId = { exact: id }; else v.facingMode = lado.get(s) || 'user';
      let nova;
      try { nova = (await orig({ video: v, audio: false })).getVideoTracks()[0]; } catch (e) { continue; }
      s.removeTrack(velha); s.addTrack(nova); velha.stop();
      document.querySelectorAll('video').forEach((el) => {
        if (el.srcObject === s) { el.srcObject = null; el.srcObject = s; el.play().catch(() => {}); }
      });
      window.dispatchEvent(new CustomEvent('camera-trocada', { detail: { stream: s, track: nova } }));
    }
    atualizarBotao();
  }

  // ---------- botão ----------
  const CSS = `
.camsel{position:fixed;z-index:2147483000;left:max(12px,env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));
  font:500 13px/1.25 system-ui,-apple-system,sans-serif;color:#f2f0ea;opacity:0;pointer-events:none;transition:opacity .35s}
.camsel.vis,.camsel.aberto{opacity:1;pointer-events:auto}
.camsel button{all:unset;cursor:pointer;box-sizing:border-box}
.camsel .cs-b{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(16,18,26,.82);
  border:1px solid rgba(255,255,255,.25);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.camsel .cs-b svg{width:18px;height:18px}
.camsel .cs-m{display:none;position:absolute;left:0;bottom:44px;min-width:250px;max-width:80vw;padding:6px;border-radius:12px;
  background:rgba(16,18,26,.94);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 28px rgba(0,0,0,.4)}
.camsel.aberto .cs-m{display:block}
.camsel .cs-t{padding:6px 10px 4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.55}
.camsel .cs-o{display:flex;gap:8px;align-items:center;width:100%;padding:8px 10px;border-radius:8px}
.camsel .cs-o:hover{background:rgba(255,255,255,.08)}
.camsel .cs-o i{font-style:normal;width:12px;flex:none;color:#7fd1ff}
.camsel .cs-o small{opacity:.55;margin-left:auto;padding-left:8px}`;
  let raiz = null, timer = 0;
  function montar() {
    if (raiz || !document.body) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    raiz = document.createElement('div'); raiz.className = 'camsel';
    raiz.innerHTML = '<div class="cs-m"></div><button class="cs-b" title="Escolher câmera (Shift+C)" aria-label="Escolher câmera">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/></svg></button>';
    document.body.appendChild(raiz);
    raiz.querySelector('.cs-b').onclick = (e) => { e.stopPropagation(); alternar(); };
    raiz.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.addEventListener('pointerdown', () => raiz.classList.remove('aberto'));
    const mostrar = () => { if (!ativo()) return; raiz.classList.add('vis'); clearTimeout(timer); timer = setTimeout(() => raiz.classList.remove('vis'), 2500); };
    ['mousemove', 'touchstart'].forEach((ev) => document.addEventListener(ev, mostrar, { passive: true }));
    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'C' || e.key === 'c') && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) { if (ativo()) alternar(); }
    });
  }
  const ativo = () => lista.length > 1 && [...streams].some((s) => s.getVideoTracks().some((t) => t.readyState === 'live'));
  async function alternar() {
    await cameras(); desenharMenu(); raiz.classList.toggle('aberto');
  }
  function desenharMenu() {
    if (!raiz) return;
    const p = lerPref();
    const atual = [...streams].map(idDe).find(Boolean);
    const logi = lista.find((d) => ehLogitech(d.label));
    const op = (marca, txt, nota, fn) => { const b = document.createElement('button'); b.className = 'cs-o'; b.innerHTML = `<i>${marca ? '●' : ''}</i><span></span>${nota ? `<small>${nota}</small>` : ''}`; b.querySelector('span').textContent = txt; b.onclick = fn; return b; };
    const m = raiz.querySelector('.cs-m'); m.innerHTML = '<div class="cs-t">Câmera</div>';
    m.appendChild(op(p.modo === 'auto', 'Automática', logi ? 'Logitech' : 'Logitech se conectada', () => escolher({ modo: 'auto' })));
    lista.forEach((d, i) => {
      const nome = d.label || 'Câmera ' + (i + 1);
      m.appendChild(op(p.modo === 'fixa' && (p.id === d.deviceId || p.label === d.label), nome, d.deviceId === atual ? 'em uso' : '', () => escolher({ modo: 'fixa', id: d.deviceId, label: d.label })));
    });
  }
  async function escolher(p) {
    salvarPref(p); raiz.classList.remove('aberto');
    await cameras(); await trocar(escolhida());
  }
  function atualizarBotao() { montar(); if (raiz && raiz.classList.contains('aberto')) desenharMenu(); }

  // Logitech conectada/desconectada com o app aberto
  if (md.addEventListener) md.addEventListener('devicechange', async () => {
    await cameras();
    if (!streams.size) return;
    const id = escolhida(), atual = [...streams].map(idDe).find(Boolean);
    if (id && id !== atual) trocar(id);
    else if (atual && !lista.some((d) => d.deviceId === atual)) trocar(id);   // a câmera em uso saiu
    atualizarBotao();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
  window.CameraPref = { cameras, trocar, escolher, ehLogitech };
})();
