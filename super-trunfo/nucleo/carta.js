/* Super Trunfo · desenho das cartas (frente e verso) — comum a todas as mitologias.
   Precisa de BARALHO (baralho.js) carregado antes. */

const ATRIBUTOS = [
  {k:"poder",        n:"Poder"},
  {k:"inteligencia", n:"Inteligência"},
  {k:"forca",        n:"Força"},
  {k:"velocidade",   n:"Velocidade"},
  {k:"agressividade",n:"Agressividade"},
  {k:"astucia",      n:"Astúcia"},
  {k:"coragem",      n:"Coragem"},
];
const GRUPOS = BARALHO.grupos;

// arquivo do Wikimedia Commons → endereço da imagem
function WM(f, w=640){ return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f.replace(/ /g,"_")) + "?width=" + w; }

const ESTILOS = [
  {k:"original", n:"Original", classe:"st-original"},
  {k:"faixa",    n:BARALHO.temas.faixa.n, classe:"st-faixa " + BARALHO.temas.faixa.classe},
  {k:"nobre",    n:BARALHO.temas.nobre.n, classe:"st-nobre " + BARALHO.temas.nobre.classe},
];
const classeEstilo = k => (ESTILOS.find(e => e.k === k) || ESTILOS[0]).classe;

const CARTAS = BARALHO.cartas.map(([cod, nome, v, img, obra, mito]) => {
  const c = {cod, nome, grupo:cod[0], obra, mito,
    img: /^https?:|^img\//.test(img) ? img : WM(img),
    pos: (BARALHO.enquadramento || {})[cod] || "50% 50%",
    superTrunfo: cod === BARALHO.superTrunfo,
    desafiante: (BARALHO.desafiantes || []).includes(cod)};
  ATRIBUTOS.forEach((a, i) => c[a.k] = v[i]);
  c.total = v.reduce((s, x) => s + x, 0);
  return c;
});

function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function dois(n){ return (n < 10 ? "0" : "") + n; }

function htmlCarta(c, estilo="original", opt={}){
  const g = GRUPOS[c.grupo];
  const vars = `--cor:${g.cor};--escura:${g.escura};--clara:${g.clara};` + (opt.w ? `--w:${opt.w};` : "");
  const linhas = ATRIBUTOS.map(a => {
    const v = c[a.k];
    let barra = "<i></i>";
    if(estilo === "faixa") barra = "<i>" + Array.from({length:10}, (_, i) => `<u class="${i < v ? "on" : ""}"></u>`).join("") + "</i>";
    else if(estilo === "nobre") barra = `<i><s style="width:${v * 10}%"></s></i>`;
    const mk = opt.marcar === a.k ? " marcado" : "";
    return `<li data-k="${a.k}" class="${mk}"><b>${a.n}</b>${barra}<em>${estilo === "original" ? dois(v) : v}</em></li>`;
  }).join("");
  const st = c.superTrunfo ? `<div class="tag-st">SUPER TRUNFO</div>` : "";
  const des = c.desafiante ? `<div class="tag-des" title="Desafiante: contra o Super Trunfo, vale o atributo">⚡ DESAFIANTE</div>` : "";
  const longo = c.nome.length > 10 ? " longo" : "";
  return `<div class="carta ${classeEstilo(estilo)}${opt.escolhivel ? " escolhivel" : ""}" data-cod="${c.cod}" style="${vars}">
    <div class="topo"><span class="cod">${c.cod}</span><span class="nome${longo}">${esc(c.nome)}</span></div>
    <div class="foto"><img src="${esc(c.img)}" style="object-position:${c.pos}" alt="${esc(c.nome)} — ${esc(c.obra)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"
      onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=sem-img>🏛️</div>')">${st}${des}</div>
    <div class="grupo">${g.n}</div>
    <ul class="atr">${linhas}</ul>
    <div class="mito">${esc(c.mito)}</div>
  </div>`;
}

function htmlVerso(estilo="original", opt={}){
  const vars = (opt.w ? `--w:${opt.w};` : "") + `--verso-cor:${BARALHO.versoCor || "#1d3f8f"};`;
  const v = BARALHO.verso || {};
  const titulo = `<div class="v1">SUPER<br>TRUNFO</div><div class="v2">${esc(BARALHO.subtitulo.toUpperCase())}</div>`;
  let miolo;
  if(estilo === "faixa") miolo = (v.faixa || `<div class="simb">${v.simbolo || "⚡"}</div>`) + titulo;
  else if(estilo === "nobre") miolo = (v.nobre || `<div class="simb">${v.simbolo || "⚡"}</div>`) + titulo;
  else miolo = `<div class="raio">${v.simbolo || "⚡"}</div>` + titulo;
  return `<div class="carta verso ${classeEstilo(estilo)}" style="${vars}"><div class="v-in">${miolo}</div></div>`;
}
