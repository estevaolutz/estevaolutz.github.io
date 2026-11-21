/* Fonte de áudio — microfone ou arquivo — usado pelas obras audiovisuais que escutam o microfone.
   - Um botão discreto de áudio (canto inferior esquerdo, ao lado do botão de câmera; aparece quando o mouse/dedo se mexe)
     deixa trocar entre o microfone e um arquivo de áudio (mp3, wav, m4a, aac, ogg, flac ou o som de um vídeo).
   - No modo arquivo a obra "escuta" o arquivo no lugar do microfone e o som sai nas caixas; o microfone fica desligado.
   - A troca é na hora, sem recarregar a página, e funciona antes ou depois de a obra ligar o microfone.
   - Atalho: Shift+A abre/fecha o menu. Espaço dentro do menu = tocar/pausar. */
(function () {
  if (window.AudioArquivo) return;
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) return;
  const prev = md.getUserMedia.bind(md);           // pode ser o getUserMedia já ajustado pela escolha de câmera

  let ctx = null, dest = null, micGain = null, fileGain = null, monitor = null;
  let micStream = null, micSrc = null, el = null, elSrc = null, nomeArq = '';
  let modo = 'mic', pedido = true, usado = false;
  const clones = new Set();

  function garantirCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    dest = ctx.createMediaStreamDestination();
    micGain = ctx.createGain(); fileGain = ctx.createGain(); monitor = ctx.createGain();
    micGain.connect(dest); fileGain.connect(dest);
    fileGain.connect(monitor); monitor.connect(ctx.destination);   // o arquivo também sai nas caixas
    aplicar();
  }
  const acordar = () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, acordar, { capture: true, passive: true }));

  function aplicar() {
    if (!ctx) return;
    const t = ctx.currentTime;
    micGain.gain.setTargetAtTime(modo === 'mic' ? 1 : 0, t, 0.02);
    fileGain.gain.setTargetAtTime(modo === 'arquivo' ? 1 : 0, t, 0.02);
  }
  async function abrirMic() {
    if (micStream && micStream.getAudioTracks().some((t) => t.readyState === 'live')) return;
    micStream = await prev({ audio: pedido });
    micSrc = ctx.createMediaStreamSource(micStream);
    micSrc.connect(micGain);
  }
  function fecharMic() {
    if (micSrc) { try { micSrc.disconnect(); } catch (e) {} micSrc = null; }
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  }
  function novaTrilha() {
    const t = dest.stream.getAudioTracks()[0].clone();
    const parar = t.stop.bind(t);
    t.stop = () => { parar(); clones.delete(t); if (!clones.size) { usado = false; fecharMic(); desenhar(); } };
    clones.add(t);
    return t;
  }

  md.getUserMedia = async function (c) {
    if (!c || !c.audio) return prev(c);
    garantirCtx(); acordar();
    pedido = c.audio === true ? true : c.audio;
    if (modo === 'mic') await abrirMic();            // se o microfone for negado, a obra recebe o erro como antes
    const s = c.video ? await prev(Object.assign({}, c, { audio: false })) : new MediaStream();
    s.addTrack(novaTrilha());
    usado = true; desenhar();
    return s;
  };

  async function usarMic() {
    modo = 'mic';
    if (el) el.pause();
    if (ctx && usado) { try { await abrirMic(); } catch (e) { aviso('Microfone bloqueado'); } }
    aplicar(); desenhar();
  }
  function usarArquivo(f) {
    garantirCtx(); acordar();
    if (!el) {
      el = new Audio(); el.loop = true; el.crossOrigin = 'anonymous';
      elSrc = ctx.createMediaElementSource(el); elSrc.connect(fileGain);
      el.addEventListener('play', desenhar); el.addEventListener('pause', desenhar);
      el.addEventListener('timeupdate', progresso);
    }
    if (el.src) URL.revokeObjectURL(el.src);
    el.src = URL.createObjectURL(f); nomeArq = f.name;
    modo = 'arquivo'; fecharMic(); aplicar();
    el.play().catch(() => {});
    desenhar();
  }

  // ---------- botão ----------
  const CSS = `
.audsel{position:fixed;z-index:2147483000;left:calc(max(12px,env(safe-area-inset-left,0px)) + 44px);bottom:calc(12px + env(safe-area-inset-bottom,0px));
  font:500 13px/1.25 system-ui,-apple-system,sans-serif;color:#f2f0ea;opacity:0;pointer-events:none;transition:opacity .35s}
.audsel.vis,.audsel.aberto{opacity:1;pointer-events:auto}
.audsel button{all:unset;cursor:pointer;box-sizing:border-box}
.audsel .as-b{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(16,18,26,.82);
  border:1px solid rgba(255,255,255,.25);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.audsel .as-b.arq{border-color:#7fd1ff;color:#7fd1ff}
.audsel .as-b svg{width:18px;height:18px}
.audsel .as-m{display:none;position:absolute;left:0;bottom:44px;width:290px;max-width:84vw;padding:6px;border-radius:12px;
  background:rgba(16,18,26,.94);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 28px rgba(0,0,0,.4)}
.audsel.aberto .as-m{display:block}
.audsel .as-t{padding:6px 10px 4px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.55}
.audsel .as-o{display:flex;gap:8px;align-items:center;width:100%;padding:8px 10px;border-radius:8px}
.audsel .as-o:hover{background:rgba(255,255,255,.08)}
.audsel .as-o i{font-style:normal;width:12px;flex:none;color:#7fd1ff}
.audsel .as-o small{opacity:.55;margin-left:auto;padding-left:8px;white-space:nowrap}
.audsel .as-p{padding:6px 10px 8px}
.audsel .as-n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85;margin-bottom:6px}
.audsel .as-r{display:flex;align-items:center;gap:8px;margin:4px 0}
.audsel .as-r input[type=range]{flex:1;min-width:0;accent-color:#7fd1ff}
.audsel .as-r label{flex:0 0 58px;opacity:.7;font-size:12px}
.audsel .as-k{padding:5px 10px;border-radius:7px;background:rgba(255,255,255,.1);font-size:12px}
.audsel .as-k.on{background:#7fd1ff;color:#071018}
.audsel .as-h{padding:4px 10px 6px;font-size:11.5px;opacity:.55;line-height:1.4}`;
  const ICONE_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  const ICONE_ARQ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
  let raiz = null, input = null, timer = 0;
  function montar() {
    if (raiz || !document.body) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    raiz = document.createElement('div'); raiz.className = 'audsel';
    raiz.innerHTML = '<div class="as-m"></div><button class="as-b" title="Fonte de áudio: microfone ou arquivo (Shift+A)" aria-label="Fonte de áudio"></button>';
    input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aif,.aiff'; input.hidden = true;
    input.onchange = () => { const f = input.files[0]; if (f) usarArquivo(f); input.value = ''; };
    raiz.appendChild(input);
    document.body.appendChild(raiz);
    raiz.querySelector('.as-b').onclick = (e) => { e.stopPropagation(); alternar(); };
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown', 'wheel'].forEach((ev) => raiz.addEventListener(ev, (e) => e.stopPropagation()));
    document.addEventListener('pointerdown', () => raiz.classList.remove('aberto'));
    const mostrar = () => { raiz.classList.add('vis'); clearTimeout(timer); timer = setTimeout(() => raiz.classList.remove('vis'), 2500); };
    ['mousemove', 'touchstart'].forEach((ev) => document.addEventListener(ev, mostrar, { passive: true }));
    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'A' || e.key === 'a') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '') && !e.target.isContentEditable) { e.preventDefault(); e.stopPropagation(); alternar(); }
    }, true);
    raiz.addEventListener('keydown', (e) => { if (e.key === ' ' && el && modo === 'arquivo' && e.target.tagName !== 'INPUT') { e.preventDefault(); el.paused ? el.play() : el.pause(); } });
    desenhar();
  }
  function alternar() { montar(); desenhar(); raiz.classList.toggle('aberto'); if (raiz.classList.contains('aberto')) { raiz.classList.add('vis'); clearTimeout(timer); } }
  const mmss = (s) => isFinite(s) ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '–:––';
  function progresso() {
    if (!raiz || !el) return;
    const r = raiz.querySelector('[data-pos]'), t = raiz.querySelector('[data-tempo]');
    if (r && document.activeElement !== r && isFinite(el.duration)) r.value = el.currentTime / el.duration;
    if (t) t.textContent = mmss(el.currentTime) + ' / ' + mmss(el.duration);
  }
  function aviso(txt) { if (!raiz) return; const h = raiz.querySelector('.as-h'); if (h) h.textContent = txt; }
  function desenhar() {
    if (!raiz) return;
    const b = raiz.querySelector('.as-b');
    b.innerHTML = modo === 'arquivo' ? ICONE_ARQ : ICONE_MIC; b.classList.toggle('arq', modo === 'arquivo');
    const m = raiz.querySelector('.as-m'); m.innerHTML = '<div class="as-t">Fonte de áudio</div>';
    const op = (marca, txt, nota, fn) => { const o = document.createElement('button'); o.className = 'as-o'; o.innerHTML = `<i>${marca ? '●' : ''}</i><span></span>${nota ? `<small>${nota}</small>` : ''}`; o.querySelector('span').textContent = txt; o.onclick = fn; return o; };
    m.appendChild(op(modo === 'mic', 'Microfone', modo === 'mic' && micStream ? 'em uso' : '', usarMic));
    m.appendChild(op(modo === 'arquivo', nomeArq ? 'Trocar arquivo de áudio…' : 'Arquivo de áudio…', '', () => input.click()));
    if (nomeArq && el) {
      const p = document.createElement('div'); p.className = 'as-p';
      p.innerHTML = `<div class="as-n"></div>
        <div class="as-r"><button class="as-k" data-play></button><button class="as-k" data-loop>Repetir</button><small data-tempo style="margin-left:auto;opacity:.6"></small></div>
        <div class="as-r"><label>Posição</label><input type="range" data-pos min="0" max="1" step="0.001" value="0"></div>
        <div class="as-r"><label>Volume</label><input type="range" data-vol min="0" max="1.5" step="0.01"></div>`;
      p.querySelector('.as-n').textContent = '♪ ' + nomeArq;
      const bp = p.querySelector('[data-play]'); bp.textContent = el.paused ? '▶ Tocar' : '❚❚ Pausar';
      bp.onclick = () => { if (modo !== 'arquivo') { modo = 'arquivo'; fecharMic(); aplicar(); } el.paused ? el.play() : el.pause(); };
      const bl = p.querySelector('[data-loop]'); bl.classList.toggle('on', el.loop); bl.onclick = () => { el.loop = !el.loop; bl.classList.toggle('on', el.loop); };
      const pos = p.querySelector('[data-pos]'); pos.oninput = () => { if (isFinite(el.duration)) el.currentTime = pos.value * el.duration; };
      const vol = p.querySelector('[data-vol]'); vol.value = monitor.gain.value; vol.oninput = () => { monitor.gain.value = +vol.value; };
      m.appendChild(p);
    }
    const h = document.createElement('div'); h.className = 'as-h';
    h.textContent = modo === 'arquivo'
      ? (usado ? 'A obra está ouvindo o arquivo no lugar do microfone.' : 'O arquivo vai entrar no lugar do microfone quando a obra ligar o áudio.')
      : 'Escolha um arquivo para a obra reagir a uma música gravada em vez do microfone.';
    m.appendChild(h);
    progresso();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
  window.AudioArquivo = { usarMic, usarArquivo, get modo() { return modo; } };
})();
