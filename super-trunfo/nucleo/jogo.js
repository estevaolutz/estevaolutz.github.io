const $ = id => document.getElementById(id);
const PREFIXO = "supertrunfo-" + BARALHO.id + "-estevao-v1-";
const POR_COD = Object.fromEntries(CARTAS.map(c => [c.cod, c]));
const NOMES_BOT = BARALHO.bots;

/* ---------- preferências ---------- */
const P = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
};
let ESTILO = P.get("st-estilo", "original"); if(!["original","faixa","nobre"].includes(ESTILO)) ESTILO = ESTILO === "anfora" ? "faixa" : ESTILO === "marmore" ? "nobre" : "original";
let SOM = P.get("st-som", "1") === "1";
ESTILOS.forEach(e => $("est").insertAdjacentHTML("beforeend", `<option value="${e.k}">${e.n}</option>`));
$("est").value = ESTILO;
$("est").onchange = () => { ESTILO = $("est").value; P.set("st-estilo", ESTILO); redesenhar(); };
$("som").textContent = SOM ? "🔊" : "🔇";
$("som").onclick = () => { SOM = !SOM; P.set("st-som", SOM ? "1" : "0"); $("som").textContent = SOM ? "🔊" : "🔇"; };
$("nome").value = P.get("st-nome", "");
$("nome").onchange = () => P.set("st-nome", $("nome").value.trim());
function meuNome(){ return ($("nome").value.trim() || "Você").slice(0, 14); }

document.querySelectorAll(".opc").forEach(g => g.addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  g.querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b));
}));
const opcao = id => $(id).querySelector(".sel").dataset.v;

/* ---------- telas ---------- */
function mostrar(id){
  document.querySelectorAll(".tela").forEach(t => t.classList.toggle("ativa", t.id === id));
  window.scrollTo(0, 0);
}
function irInicio(){
  if(J.ativo && !confirm("Sair da partida?")) return;
  encerrarPartida(); mostrar("s-inicio");
}
function toast(t, ms=2200){ const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove("on"), ms); }
function modal(html){ $("modal-in").innerHTML = html; $("modal").classList.add("on"); }
function fecharModal(){ $("modal").classList.remove("on"); }
$("modal").addEventListener("click", e => { if(e.target.id === "modal") fecharModal(); });

/* ---------- som ---------- */
let AC = null;
function tom(f, t0, dur, tipo="triangle", vol=.12){
  if(!SOM) return;
  try{
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + t0;
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + .05);
  }catch(e){}
}
const SFX = {
  virar(){ tom(520, 0, .08, "square", .05); tom(780, .05, .08, "square", .04); },
  ganhou(){ [523, 659, 784, 1047].forEach((f, i) => tom(f, i * .09, .35)); },
  perdeu(){ [392, 330, 262].forEach((f, i) => tom(f, i * .12, .4, "sawtooth", .06)); },
  empate(){ tom(440, 0, .3); tom(440, .18, .3); },
  trunfo(){ [784, 988, 1175, 1568, 1976].forEach((f, i) => tom(f, i * .07, .5, "triangle", .1)); tom(98, 0, .9, "sawtooth", .08); },
  fim(v){ (v ? [523, 659, 784, 659, 784, 1047] : [440, 392, 349, 330]).forEach((f, i) => tom(f, i * .14, .45)); }
};
function vibrar(ms){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} }

/* ---------- motor do jogo (roda no aparelho que comanda) ---------- */
function embaralhar(a){ for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function comparar(c0, c1, k){
  if(c0.superTrunfo && !c1.desafiante) return {v:0, motivo:"trunfo"};
  if(c1.superTrunfo && !c0.desafiante) return {v:1, motivo:"trunfo"};
  if(c0[k] > c1[k]) return {v:0, motivo:"atr"};
  if(c1[k] > c0[k]) return {v:1, motivo:"atr"};
  return {v:-1, motivo:"empate"};
}

const MOTOR = {
  novo(maxRodadas){
    const ids = embaralhar(CARTAS.map(c => c.cod));
    this.maos = [[], []]; ids.forEach((id, i) => this.maos[i % 2].push(id));
    this.monte = []; this.vez = Math.random() < .5 ? 0 : 1; this.rodada = 0; this.max = +maxRodadas || 0;
    this.fase = "escolha"; this.rev = null; this.fim = null;
  },
  escolher(j, k){
    if(this.fase !== "escolha" || this.vez !== j || !ATRIBUTOS.some(a => a.k === k)) return false;
    const a = this.maos[0].shift(), b = this.maos[1].shift();
    const r = comparar(POR_COD[a], POR_COD[b], k);
    if(r.v >= 0){
      const ganhou = r.v === 0 ? [a, b] : [b, a];
      this.maos[r.v].push(...ganhou, ...this.monte);
      this.levou = this.monte.length; this.monte = []; this.vez = r.v;
    } else { this.monte.push(a, b); this.levou = 0; }
    this.rodada++;
    this.rev = {cartas:[a, b], k, v:r.v, motivo:r.motivo, escolheu:j, levou:this.levou};
    this.fase = "revela";
    const n0 = this.maos[0].length, n1 = this.maos[1].length;
    if(n0 === 0 || n1 === 0 || (this.max && this.rodada >= this.max) || this.rodada >= 400){
      const vencedor = n0 > n1 ? 0 : n1 > n0 ? 1 : -1;
      this.fimPendente = {v:vencedor, n:[n0, n1]};
    } else this.fimPendente = null;
    return true;
  },
  proxima(){
    if(this.fase !== "revela") return false;
    if(this.fimPendente){ this.fase = "fim"; this.fim = this.fimPendente; }
    else { this.fase = "escolha"; this.rev = null; }
    return true;
  },
  vista(i){
    const j = 1 - i, r = this.rev;
    return {
      fase:this.fase, rodada:this.rodada, max:this.max, monte:this.monte.length,
      eu:{n:this.maos[i].length, topo:this.maos[i][0] || null},
      adv:{n:this.maos[j].length},
      minhaVez:this.vez === i,
      rev: r ? {eu:r.cartas[i], adv:r.cartas[j], k:r.k, motivo:r.motivo, levou:r.levou,
        res: r.v === -1 ? "empate" : (r.v === i ? "ganhou" : "perdeu"), euEscolhi:r.escolheu === i} : null,
      fim: this.fim ? {res: this.fim.v === -1 ? "empate" : (this.fim.v === i ? "ganhou" : "perdeu"), eu:this.fim.n[i], adv:this.fim.n[j]} : null
    };
  }
};

/* ---------- computador ---------- */
const BOT = {
  nivel:"medio",
  escolher(cod){
    const c = POR_COD[cod];
    if(this.nivel === "facil") return ATRIBUTOS[Math.floor(Math.random() * ATRIBUTOS.length)].k;
    if(this.nivel === "medio"){
      const max = Math.max(...ATRIBUTOS.map(a => c[a.k]));
      const op = ATRIBUTOS.filter(a => c[a.k] === max); return op[Math.floor(Math.random() * op.length)].k;
    }
    // oráculo: escolhe o atributo com maior chance de vencer as outras 47 cartas
    let melhor = null, pm = -1;
    ATRIBUTOS.forEach(a => {
      let p = 0; CARTAS.forEach(o => { if(o.cod === cod) return; if(o[a.k] < c[a.k]) p += 1; else if(o[a.k] === c[a.k]) p += .5; });
      p += Math.random() * .01; if(p > pm){ pm = p; melhor = a.k; }
    });
    return melhor;
  }
};

/* ---------- estado da partida neste aparelho ---------- */
const J = {ativo:false, modo:null, host:false, nomeAdv:"", vista:null, timer:null, botT:null, revistaRod:-1, denovoEu:false, denovoAdv:false};

function iniciarSolo(){
  P.set("st-nome", $("nome").value.trim());
  BOT.nivel = opcao("opc-nivel");
  Object.assign(J, {ativo:true, modo:"solo", host:true, nomeAdv:NOMES_BOT[BOT.nivel], revistaRod:-1});
  MOTOR.novo(opcao("opc-modo-solo"));
  mostrar("s-jogo"); atualizar();
}

// o aparelho que comanda chama isto depois de cada mudança
function atualizar(){
  const v = MOTOR.vista(0);
  desenharJogo(v);
  if(J.modo === "online") enviar({t:"vista", v:MOTOR.vista(1), nome:meuNome()});
  clearTimeout(J.timer); clearTimeout(J.botT);
  if(MOTOR.fase === "revela") J.timer = setTimeout(() => { if(MOTOR.proxima()) atualizar(); }, MOTOR.rev.motivo === "trunfo" ? 5200 : 4200);
  if(J.modo === "solo" && MOTOR.fase === "escolha" && MOTOR.vez === 1){
    J.botT = setTimeout(() => { if(MOTOR.escolher(1, BOT.escolher(MOTOR.maos[1][0]))) atualizar(); }, 1100 + Math.random() * 900);
  }
}

function escolherAtributo(k){
  const v = J.vista; if(!v || v.fase !== "escolha" || !v.minhaVez) return;
  SFX.virar();
  if(J.host){ if(MOTOR.escolher(0, k)) atualizar(); }
  else { enviar({t:"escolha", k}); J.vista.minhaVez = false; $("aviso").textContent = "…"; }
}
function pedirProxima(){
  if(J.host){ clearTimeout(J.timer); if(MOTOR.proxima()) atualizar(); }
  else enviar({t:"proxima"});
}

/* ---------- desenho da mesa ---------- */
function nomeAtr(k){ return ATRIBUTOS.find(a => a.k === k).n; }

function desenharJogo(v){
  J.vista = v;
  const mesa = $("mesa");
  $("nm-eu").textContent = meuNome(); $("nm-adv").textContent = J.nomeAdv || "Adversário";
  $("q-adv").textContent = J.nomeAdv || "Adversário";
  $("n-eu").textContent = v.eu.n;
  $("n-adv").textContent = v.adv.n;
  $("n-monte").textContent = v.monte;
  $("rodada").textContent = (v.monte ? "monte · " : "") + "Rodada " + (v.rodada + (v.fase === "escolha" ? 1 : 0)) + (v.max ? "/" + v.max : "");
  $("pl-eu").classList.toggle("vez", v.fase === "escolha" && v.minhaVez);
  $("pl-adv").classList.toggle("vez", v.fase === "escolha" && !v.minhaVez);
  $("bt-prox").style.display = v.fase === "revela" ? "block" : "none";
  const aviso = $("aviso"); aviso.className = "";

  if(v.fase === "escolha"){
    mesa.className = "mesa fase-escolha";
    $("c-eu").innerHTML = v.eu.topo ? htmlCarta(POR_COD[v.eu.topo], ESTILO, {escolhivel:v.minhaVez}) : "";
    $("c-adv").innerHTML = htmlVerso(ESTILO);
    $("c-eu").firstElementChild && $("c-eu").firstElementChild.classList.add("vira");
    $("duelo").innerHTML = "";
    if(v.minhaVez){ aviso.className = "eu"; aviso.textContent = "Sua vez: toque no atributo mais forte da sua carta"; vibrar(15); }
    else aviso.textContent = `Vez de ${J.nomeAdv}… escolhendo um atributo`;
    if(v.minhaVez) $("c-eu").querySelectorAll("li").forEach(li => li.onclick = () => escolherAtributo(li.dataset.k));
  }
  else if(v.fase === "revela" && v.rev){
    const r = v.rev, ce = POR_COD[r.eu], ca = POR_COD[r.adv];
    mesa.className = "mesa fase-revela";
    $("c-eu").innerHTML = htmlCarta(ce, ESTILO, {marcar:r.k});
    $("c-adv").innerHTML = htmlCarta(ca, ESTILO, {marcar:r.k});
    $("c-adv").firstElementChild.classList.add("vira");
    const quem = r.euEscolhi ? "Você escolheu" : `${J.nomeAdv} escolheu`;
    let duelo = `${nomeAtr(r.k)}: ${ce[r.k]} × ${ca[r.k]}`;
    if(r.motivo === "trunfo") duelo = "⚡ " + POR_COD[BARALHO.superTrunfo].nome.toUpperCase() + ", o Super Trunfo, vence" + (ce.superTrunfo ? "!" : "…");
    else if((ce.superTrunfo && ca.desafiante) || (ca.superTrunfo && ce.desafiante)) duelo = "⚡ Desafiante contra " + POR_COD[BARALHO.superTrunfo].nome + "! " + duelo;
    $("duelo").textContent = duelo;
    const extra = r.levou ? ` e leva o monte (+${r.levou})` : "";
    if(r.res === "ganhou"){ aviso.className = "ganhou"; aviso.textContent = `${quem} ${nomeAtr(r.k)} — você ganhou a rodada${extra}!`; $("c-eu").firstElementChild.classList.add("ganhadora"); }
    else if(r.res === "perdeu"){ aviso.className = "perdeu"; aviso.textContent = `${quem} ${nomeAtr(r.k)} — ${J.nomeAdv} ganhou a rodada${extra}`; $("c-adv").firstElementChild.classList.add("ganhadora"); }
    else { aviso.textContent = `${quem} ${nomeAtr(r.k)} — empate! As cartas vão para o monte`; }
    if(J.revistaRod !== v.rodada){
      J.revistaRod = v.rodada;
      if(r.motivo === "trunfo") SFX.trunfo(); else ({ganhou:SFX.ganhou, perdeu:SFX.perdeu, empate:SFX.empate})[r.res]();
      vibrar(r.res === "ganhou" ? [30, 40, 30] : 60);
    }
  }
  else if(v.fase === "fim" && v.fim){
    const f = v.fim;
    const tit = f.res === "ganhou" ? "Você venceu!" : f.res === "perdeu" ? `${J.nomeAdv} venceu` : "Empate!";
    const ic = f.res === "ganhou" ? "🏆" : f.res === "perdeu" ? "🏛️" : "⚖️";
    if(J.fimVisto !== v.rodada){
      J.fimVisto = v.rodada; J.denovoEu = J.denovoAdv = false; SFX.fim(f.res === "ganhou");
      if(f.res === "ganhou") P.set("st-vit", +P.get("st-vit", 0) + 1); else if(f.res === "perdeu") P.set("st-der", +P.get("st-der", 0) + 1);
    }
    modal(`<div class="ic">${ic}</div><h2>${tit}</h2>
      <p>Cartas no fim: <b>${meuNome()} ${f.eu}</b> × <b>${J.nomeAdv} ${f.adv}</b></p>
      <p>Seu histórico neste aparelho: ${P.get("st-vit", 0)} vitórias, ${P.get("st-der", 0)} derrotas</p>
      <button class="bt ouro" onclick="jogarDeNovo()">Jogar de novo</button>
      <button class="bt" onclick="fecharModal();J.ativo=false;irInicio()">Menu</button>`);
  }
}

function jogarDeNovo(){
  fecharModal(); J.fimVisto = -1;
  if(J.modo === "solo"){ MOTOR.novo(MOTOR.max); J.revistaRod = -1; atualizar(); return; }
  J.denovoEu = true; enviar({t:"denovo"});
  if(J.host) talvezReiniciar(); else toast("Esperando " + J.nomeAdv + " aceitar…");
}
function talvezReiniciar(){
  if(J.host && J.denovoEu && J.denovoAdv){ J.denovoEu = J.denovoAdv = false; MOTOR.novo(MOTOR.max); J.revistaRod = -1; fecharModal(); atualizar(); }
  else if(J.host && J.denovoEu) toast("Esperando " + J.nomeAdv + " aceitar…");
}

function sairJogo(){ if(confirm("Sair da partida?")){ J.ativo = false; encerrarPartida(); mostrar("s-inicio"); } }
function encerrarPartida(){
  clearTimeout(J.timer); clearTimeout(J.botT);
  if(J.modo === "online") sairOnline(true);
  J.ativo = false; J.modo = null; fecharModal();
}

function redesenhar(){
  montarLeque();
  if($("s-galeria").classList.contains("ativa")) desenharGaleria();
  if(J.vista && $("s-jogo").classList.contains("ativa")){ const rr = J.revistaRod; desenharJogo(J.vista); J.revistaRod = rr; }
  montarDesafiantes();
}

/* ---------- rede (PeerJS, como na Batalha Naval) ---------- */
const R = {peer:null, conn:null, saindo:false};
function setRede(on, txt){ const el = $("rede"); el.style.display = "flex"; el.classList.toggle("on", on); el.querySelector("span").textContent = txt; }
function novoPeer(id){
  return new Peer(id, {debug:0, config:{iceServers:[
    {urls:"stun:stun.l.google.com:19302"}, {urls:"stun:stun1.l.google.com:19302"},
    {urls:"turn:eu-0.turn.peerjs.com:3478", username:"peerjs", credential:"peerjsp"},
    {urls:"turn:us-0.turn.peerjs.com:3478", username:"peerjs", credential:"peerjsp"},
  ]}});
}
function gerarCodigo(){ const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for(let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
function enviar(m){ if(R.conn && R.conn.open) R.conn.send(m); }

function criarSala(t=0){
  if(typeof Peer === "undefined"){ toast("Sem internet para o modo online"); return; }
  P.set("st-nome", $("nome").value.trim());
  sairOnline(true); R.saindo = false;
  Object.assign(J, {modo:"online", host:true, maxOn:opcao("opc-modo-on")});
  const cod = gerarCodigo(); setRede(false, "conectando…");
  const p = novoPeer(PREFIXO + cod); R.peer = p;
  p.on("open", () => { $("cod-sala").textContent = cod; $("sala-msg").textContent = "Esperando o outro jogador entrar…"; mostrar("s-sala"); setRede(false, "sala " + cod); });
  p.on("connection", c => {
    if(R.conn && R.conn.open){ c.on("open", () => { c.send({t:"cheia"}); setTimeout(() => c.close(), 400); }); return; }
    ligar(c);
  });
  p.on("error", e => { if(e.type === "unavailable-id" && t < 5){ p.destroy(); criarSala(t + 1); return; } erroRede(e); });
  p.on("disconnected", () => { try{ p.reconnect(); }catch(e){} });
}
function entrarSala(cod){
  cod = (cod || "").toUpperCase().trim();
  if(cod.length !== 4){ toast("O código tem 4 letras"); return; }
  if(typeof Peer === "undefined"){ toast("Sem internet para o modo online"); return; }
  P.set("st-nome", $("nome").value.trim());
  sairOnline(true); R.saindo = false;
  Object.assign(J, {modo:"online", host:false});
  setRede(false, "conectando…"); toast("Procurando a sala " + cod + "…");
  const p = novoPeer(); R.peer = p;
  p.on("open", () => {
    const c = p.connect(PREFIXO + cod, {reliable:true}); ligar(c);
    setTimeout(() => { if(!(R.conn && R.conn.open) && !R.saindo) aviso("🔎", "Sala não encontrada", "Confira o código ou peça para o outro jogador criar a sala de novo."); }, 12000);
  });
  p.on("error", e => { if(e.type === "peer-unavailable"){ aviso("🔎", "Sala não encontrada", "Confira o código " + cod + "."); return; } erroRede(e); });
}
function ligar(c){
  R.conn = c;
  c.on("open", () => {
    setRede(true, "conectado");
    enviar({t:"oi", nome:meuNome()});
    if(J.host){ Object.assign(J, {ativo:true, revistaRod:-1}); MOTOR.novo(J.maxOn); mostrar("s-jogo"); setTimeout(atualizar, 300); }
  });
  c.on("data", aoReceber);
  c.on("close", () => { setRede(false, "desconectado"); if(!R.saindo && J.modo === "online"){ J.ativo = false; aviso("📡", "Conexão perdida", (J.nomeAdv || "O outro jogador") + " saiu ou a internet caiu."); } });
}
function aoReceber(m){
  switch(m.t){
    case "cheia": aviso("🚫", "Sala cheia", "Essa sala já tem dois jogadores."); break;
    case "oi": J.nomeAdv = String(m.nome || "Adversário").slice(0, 14); if(J.host) toast(J.nomeAdv + " entrou!"); break;
    case "vista": // convidado recebe o estado
      if(!J.host){
        if(m.nome) J.nomeAdv = String(m.nome).slice(0, 14);
        if(!J.ativo){ J.ativo = true; J.revistaRod = -1; mostrar("s-jogo"); }
        if(m.v.fase === "escolha" && J.vista && J.vista.fase === "fim") fecharModal();
        desenharJogo(m.v);
      } break;
    case "escolha": if(J.host && MOTOR.escolher(1, m.k)) atualizar(); break;
    case "proxima": if(J.host){ clearTimeout(J.timer); if(MOTOR.proxima()) atualizar(); } break;
    case "denovo": J.denovoAdv = true; if(J.host) talvezReiniciar(); if(!J.denovoEu) toast(J.nomeAdv + " quer jogar de novo!"); break;
  }
}
function aviso(ic, t, txt){ modal(`<div class="ic">${ic}</div><h2>${t}</h2><p>${txt}</p><button class="bt ouro" onclick="fecharModal();encerrarPartida();mostrar('s-inicio')">OK</button>`); }
function erroRede(e){ console.warn(e); if(R.saindo) return; aviso("⚠️", "Erro de conexão", "Não deu para conectar (" + (e.type || e) + "). Verifique a internet e tente de novo."); }
function sairOnline(silencioso){
  R.saindo = true;
  try{ R.conn && R.conn.close(); }catch(e){} try{ R.peer && R.peer.destroy(); }catch(e){}
  R.conn = R.peer = null; $("rede").style.display = "none";
  if(!silencioso) mostrar("s-online");
}

/* ---------- galeria ---------- */
let FILTRO = "todas";
function abrirGaleria(){ mostrar("s-galeria"); desenharGaleria(); }
function desenharGaleria(){
  const fs = [["todas", "Todas (" + CARTAS.length + ")"], ...Object.entries(GRUPOS).map(([k, g]) => [k, g.n])];
  $("filtros").innerHTML = fs.map(([k, n]) => `<button data-k="${k}" class="${k === FILTRO ? "sel" : ""}">${n}</button>`).join("");
  $("filtros").querySelectorAll("button").forEach(b => b.onclick = () => { FILTRO = b.dataset.k; desenharGaleria(); });
  const lista = FILTRO === "todas" ? CARTAS : CARTAS.filter(c => c.grupo === FILTRO);
  $("grade").innerHTML = lista.map(c => htmlCarta(c, ESTILO)).join("");
  $("grade").querySelectorAll(".carta").forEach(el => el.onclick = () => verCarta(el.dataset.cod));
}
function paginaFonte(c){
  if(!c.img.startsWith("https://commons.wikimedia.org")) return "";
  const f = decodeURIComponent(c.img.split("Special:FilePath/")[1].split("?")[0]);
  return `<a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f)}" target="_blank" rel="noopener">ver no Wikimedia Commons</a>`;
}
function verCarta(cod){
  const c = POR_COD[cod], g = GRUPOS[c.grupo];
  const extra = c.superTrunfo ? "<p><b>⚡ Super Trunfo:</b> vence qualquer carta, exceto os Desafiantes.</p>"
    : c.desafiante ? "<p><b>⚡ Desafiante:</b> contra o Super Trunfo (" + POR_COD[BARALHO.superTrunfo].nome + "), vale o atributo escolhido.</p>" : "";
  modal(`<div class="grande">${htmlCarta(c, ESTILO)}</div>
    <p><b>${c.cod} · ${c.nome}</b> — ${g.n}</p><p>${c.mito}</p>${extra}
    <p class="creditos">Imagem: ${c.obra} ${paginaFonte(c)}</p>
    <button class="bt" onclick="fecharModal()">Fechar</button>`);
}

/* ---------- início, regras, créditos ---------- */
function montarLeque(){
  $("leque").innerHTML = BARALHO.leque.map(k => htmlCarta(POR_COD[k], ESTILO)).join("");
}
function montarDesafiantes(){
  $("regras-des").innerHTML = [BARALHO.superTrunfo, ...BARALHO.desafiantes].map(k => htmlCarta(POR_COD[k], ESTILO)).join("");
}
$("regras-grupos").innerHTML = "Grupos: " + Object.entries(GRUPOS).map(([k, g]) => `<b style="color:${g.cor}">${k} · ${g.n}</b>`).join(", ") + ".";
$("mitos").innerHTML = MITOLOGIAS.map(m => `<a href="${m.url}" class="${m.id === BARALHO.id ? "atual" : ""}">${m.simbolo} ${m.n}<small>${m.d}</small></a>`).join("");
$("lista-creditos").innerHTML = CARTAS.filter(c => c.img.startsWith("https://")).map(c => `<div>${c.cod} ${c.nome}: ${c.obra} — ${paginaFonte(c)}</div>`).join("");
montarLeque(); montarDesafiantes();
$("cod-in").addEventListener("keydown", e => { if(e.key === "Enter") entrarSala($("cod-in").value); });
// entrar direto por link: ?sala=ABCD
const qs = new URLSearchParams(location.search);
if(qs.get("sala")){ $("cod-in").value = qs.get("sala"); mostrar("s-online"); }
