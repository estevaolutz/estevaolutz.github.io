/* Desenho das cartas (frente e verso) nos três estilos */
const ESTILOS = [
  {k:"original", n:"Original"},
  {k:"anfora",   n:"Ânfora"},
  {k:"marmore",  n:"Mármore e Ouro"},
];

function esc(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function dois(n){ return (n<10?"0":"")+n; }

function htmlCarta(c, estilo="original", opt={}){
  const g = GRUPOS[c.grupo];
  const vars = `--cor:${g.cor};--escura:${g.escura};--clara:${g.clara};` + (opt.w ? `--w:${opt.w};` : "");
  const linhas = ATRIBUTOS.map(a=>{
    const v = c[a.k];
    let barra = "";
    if(estilo==="anfora") barra = "<i>" + Array.from({length:10},(_,i)=>`<u class="${i<v?"on":""}"></u>`).join("") + "</i>";
    else if(estilo==="marmore") barra = `<i><s style="width:${v*10}%"></s></i>`;
    else barra = "<i></i>";
    const mk = opt.marcar===a.k ? " marcado" : "";
    return `<li data-k="${a.k}" class="${mk}"><b>${a.n}</b>${barra}<em>${estilo==="original"?dois(v):v}</em></li>`;
  }).join("");
  const st = c.superTrunfo ? `<div class="tag-st">SUPER TRUNFO</div>` : "";
  const des = c.desafiante ? `<div class="tag-des" title="Desafiante de Zeus: contra o Super Trunfo, vale o atributo">⚡ DESAFIANTE</div>` : "";
  return `<div class="carta st-${estilo}${opt.escolhivel?" escolhivel":""}" data-cod="${c.cod}" style="${vars}">
    <div class="topo"><span class="cod">${c.cod}</span><span class="nome">${esc(c.nome)}</span></div>
    <div class="foto"><img src="${esc(c.img)}" style="object-position:${c.pos}" alt="${esc(c.nome)} — ${esc(c.obra)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"
      onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=sem-img>🏛️</div>')">${st}${des}</div>
    <div class="grupo">${g.n}</div>
    <ul class="atr">${linhas}</ul>
    <div class="mito">${esc(c.mito)}</div>
  </div>`;
}

const SVG_VASO = `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg"><g fill="#d8773d">
<path d="M38 6h24v6c0 3-3 4-3 8 0 3 3 6 8 9 14 9 21 22 21 38 0 20-14 36-30 41v6h8v6H34v-6h8v-6C26 103 12 87 12 67c0-16 7-29 21-38 5-3 8-6 8-9 0-4-3-5-3-8z"/>
<path d="M26 30c-10 0-16 6-16 13s6 12 13 12" fill="none" stroke="#d8773d" stroke-width="4"/><path d="M74 30c10 0 16 6 16 13s-6 12-13 12" fill="none" stroke="#d8773d" stroke-width="4"/></g>
<g fill="#16110e"><circle cx="50" cy="66" r="15"/><path d="M50 52l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" fill="#d8773d"/>
<rect x="16" y="40" width="68" height="4"/><rect x="18" y="90" width="64" height="3"/></g></svg>`;

const SVG_TEMPLO = `<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#b38a2e" stroke-width="2.2">
<path d="M8 30L60 6l52 24z"/><path d="M10 30h100M12 36h96"/>
<path d="M20 38v38M32 38v38M44 38v38M56 38v38M68 38v38M80 38v38M92 38v38M104 38v38" stroke-width="3"/>
<path d="M12 78h96M6 84h108"/></g><text x="60" y="26" text-anchor="middle" font-family="Cinzel,serif" font-size="11" fill="#b38a2e" font-weight="900">⚡</text></svg>`;

function htmlVerso(estilo="original", opt={}){
  const vars = opt.w ? `--w:${opt.w};` : "";
  let miolo;
  if(estilo==="anfora") miolo = `${SVG_VASO}<div class="v1">SUPER<br>TRUNFO</div><div class="v2">MITOLOGIA GREGA</div>`;
  else if(estilo==="marmore") miolo = `${SVG_TEMPLO}<div class="v1">SUPER<br>TRUNFO</div><div class="v2">MITOLOGIA GREGA</div>`;
  else miolo = `<div class="raio">⚡</div><div class="v1">SUPER<br>TRUNFO</div><div class="v2">MITOLOGIA GREGA</div>`;
  return `<div class="carta verso st-${estilo}" style="${vars}"><div class="v-in">${miolo}</div></div>`;
}
