// ---------- núcleo das conjecturas da primeira leva, com o som do Motor Knick (lib/motor-knick.js) ----------
// Mesmo jeito de usar do núcleo antigo (O.bell, O.soft, O.pluck, O.pad, O.sine, O.tone, O.kick, O.tick, O.setDrone, O.fx…),
// mas as notas viram acontecimentos do motor: notas de vidro dentro do pulso dos arpejos, energia do arranjo e troca de acorde.
// O painel de som antigo fica escondido (os valores continuam valendo para a obra) e o painel do motor entra em #nucleo.
const O = (() => {
  const P = {};
  let ids = [];
  function readP(){
    for (const k of ids){ const el = $(k); if (!el) continue;
      P[k] = el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' || el.type === 'text') ? el.value : parseFloat(el.value); }
  }
  function bind(list, onChange){
    ids = list.concat(['scale','vol','drone','verb']);
    readP();
    for (const k of ids){ const el = $(k); if (!el) continue;
      el.addEventListener(el.type === 'text' || el.type === 'number' ? 'change' : 'input', () => { const old = Object.assign({}, P); readP(); onChange && onChange(k, old); }); }
  }

  // ---------- som: Motor Knick ----------
  const MK = MotorKnick({});
  if ($('nucleo')) MK.painel($('nucleo'));
  let AC = null;
  const SCALES = {
    jonico:[0,2,4,5,7,9,11], dorico:[0,2,3,5,7,9,10], frigio:[0,1,3,5,7,8,10], lidio:[0,2,4,6,7,9,11],
    mixolidio:[0,2,4,5,7,9,10], eolio:[0,2,3,5,7,8,10], locrio:[0,1,3,5,6,8,10],
    menorHarm:[0,2,3,5,7,8,11], menorMel:[0,2,3,5,7,9,11], frigioDom:[0,1,4,5,7,8,10], hungara:[0,2,3,6,7,8,11],
    penta:[0,3,5,7,10], pentaMaior:[0,2,4,7,9], hirajoshi:[0,2,3,7,8], tons:[0,2,4,6,8,10]
  };
  const NOTAS = ['Ré','Mi♭','Mi','Fá','Fá♯','Sol','Lá♭','Lá','Si♭','Si','Dó','Dó♯'];
  const ROOT = 73.416; // Ré2
  const now = () => AC ? AC.currentTime : performance.now()/1000;
  function initAudio(){ MK.iniciar(); AC = MK.AC; }
  function applyMix(){}
  function scale(){ return SCALES[MK.S.modo] || SCALES.eolio; }
  function semi(d){ d = Math.round(d); const sc = scale(), k = sc.length; return sc[((d % k)+k)%k] + 12*Math.floor(d/k); }
  function freq(d, base = ROOT*2){ return base*Math.pow(2, semi(d)/12); }
  function chord(d){ return [0,2,4,6,8].map(r => semi(d + r)); }
  function chordName(d){
    const r0 = semi(d), root = ((r0 % 12)+12)%12, third = semi(d+2) - r0, fifth = semi(d+4) - r0;
    const q = third === 4 && fifth === 7 ? 'maior' : third === 3 && fifth === 7 ? 'menor' : third === 3 && fifth === 6 ? 'diminuto' : third === 4 && fifth === 8 ? 'aumentado' : '';
    return NOTAS[root] + (q ? ' ' + q : '');
  }
  // entrega no tempo certo (as obras agendam as notas um pouco à frente)
  const quando = (t, fn) => { const dt = AC ? t - AC.currentTime : 0; if (dt > 0.03) setTimeout(fn, dt*1000); else fn(); };
  // vozes que só dobram a harmonia (baixo, acorde, pulso grave, pad) não viram nota: o motor já tem baixo e pad próprios
  const HARMONIA = /^(baixo|acor|acorde|pad|pulso|dro|drone|bass)/i;
  let src = '';
  function nota(f, t, vel, pan, s){
    if (!AC || !(f > 15 && f < 20000)) return;
    s = s || src;
    if (HARMONIA.test(s)){ quando(t, () => MK.pulso(Math.min(1, vel)*0.3)); return; }
    quando(t, () => MK.nota(f, { forca: Math.min(1, vel == null ? 0.8 : vel), pan: Math.max(-1, Math.min(1, pan || 0)) }));
  }
  // assinatura de cada timbre antigo: o último argumento de texto (se houver) é o nome do elemento
  const nomeDe = a => { for (let i = a.length - 1; i >= 0; i--) if (typeof a[i] === 'string') return a[i]; return ''; };
  const bell  = (f, t, vel = 0.8, pan = 0, ...r) => nota(f, t, vel, pan, nomeDe(r));
  const soft  = (f, t, vel = 0.8, pan = 0, ...r) => nota(f, t, vel*0.85, pan, nomeDe(r));
  const pluck = (f, t, vel = 0.8, pan = 0, ...r) => nota(f, t, vel, pan, nomeDe(r));
  const sine  = (f, t, vel = 0.6, pan = 0, ...r) => nota(f, t, vel, pan, nomeDe(r));
  const tone  = (f, t, vel = 0.8, pan = 0, s = '') => nota(f, t, vel, pan, s);
  const pad   = (f, t, vel = 0.6) => { if (AC) quando(t, () => MK.pulso(vel*0.2)); };
  const kick  = (t, vel = 0.8) => { if (AC) quando(t, () => MK.pulso(vel)); };
  const tick  = (t, vel = 0.5) => { if (AC) quando(t, () => MK.pulso(vel*0.4)); };
  // drone da obra → acorde do motor (o grau da escala mais próximo da nota pedida)
  let ultimoDrone = null;
  function setDrone(rootSemi){
    if (!AC) return;
    const alvo = ((Math.round(rootSemi) % 12) + 12) % 12; let g = 0, bd = 99;
    for (let d = 0; d < 7; d++){ const dd = Math.abs(((semi(d) % 12) + 12) % 12 - alvo); if (dd < bd){ bd = dd; g = d; } }
    if (g !== ultimoDrone){ ultimoDrone = g; MK.acorde(g); }
  }
  // efeitos antigos: agora são o Brilho e o Espaço do motor (estas chamadas não fazem nada)
  const fx = { delay(){}, filter(){}, drive(){}, crush(){}, width(){} };

  // ---------- tela, painel, teclas ----------
  function toggleFull(){
    const d = document;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen).call(d.documentElement);
      else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } catch (e) {}
  }
  let running = false;
  function setup(onStart, keys = {}){
    $('start').addEventListener('pointerdown', e => { e.stopPropagation(); go(); });
    function go(){ if (running) return; initAudio(); running = true; $('start').classList.add('hide'); onStart && onStart(); }
    $('dot').addEventListener('click', () => $('panel').classList.toggle('on'));
    const bf = $('bFull'); if (bf) bf.addEventListener('click', toggleFull);
    const st = $('showTxt'); if (st) st.addEventListener('input', () => document.body.classList.toggle('semtexto', !st.checked));
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
      if (e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'm') $('panel').classList.toggle('on');
      else if (k === 'f') toggleFull();
      else if (k === 't' && st){ st.checked = !st.checked; document.body.classList.toggle('semtexto', !st.checked); }
      else if (k === ' ' && !running){ e.preventDefault(); go(); }
      else if (keys[k]){ e.preventDefault(); if (running) keys[k](); }
    });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const fmt = v => v.toLocaleString('pt-BR');
  return { fx, P, bind, readP, now, initAudio, applyMix, setDrone, freq, semi, chord, chordName, scale, SCALES, NOTAS, ROOT,
    bell, soft, pluck, pad, sine, kick, tick, tone, droneTimbre(){}, setSrc: k => { src = k; }, setup, toggleFull, fmt, som: MK,
    get AC(){ return AC; }, get running(){ return running; }, get droneF(){ return null; } };
})();
