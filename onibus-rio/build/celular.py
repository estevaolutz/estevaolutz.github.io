#!/usr/bin/env python3
"""Ônibus do Rio — gera a versão para celular (celular/index.html) a partir da página principal.

Uso: python3 build/celular.py   (rodar de dentro de onibus-rio/)
A lógica (dados, mapa, filtros, rotas) é a mesma da página principal; muda a estrutura da tela:
  - em pé: busca no topo, gaveta arrastável com 3 alturas, abas embaixo;
  - deitado: painel lateral com uma única área de rolagem.
Sempre que a página principal mudar, rode de novo para a versão de celular acompanhar.
"""
import os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
src = open(os.path.join(RAIZ, "index.html"), encoding="utf-8").read()


def troca(s, a, b, n=1):
    if a not in s:
        sys.exit(f"não achei na página principal: {a[:70]!r}")
    return s.replace(a, b, n)


s = src
# ---------- caminhos (a página fica uma pasta abaixo) ----------
s = troca(s, 'href="lib/maplibre-gl.css"', 'href="../lib/maplibre-gl.css"')
s = troca(s, 'src="lib/maplibre-gl.js"', 'src="../lib/maplibre-gl.js"')
s = troca(s, 'src="rota.js"', 'src="../rota.js"')
s = s.replace('json("data/', 'json("../data/')
s = troca(s, '<title>Ônibus do Rio — ônibus, metrô, trem, VLT e barcas</title>',
          '<title>Ônibus do Rio — celular</title>\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">')

# ---------- estilos: tira a regra de celular da página principal e acrescenta a estrutura nova ----------
i = s.index("/* celular: painel vira gaveta embaixo */")
j = s.index("</style>", i)
CSS = r"""
/* ===================== versão para celular ===================== */
:root{--abas:58px;--seg-t:env(safe-area-inset-top);--seg-b:env(safe-area-inset-bottom);--seg-l:env(safe-area-inset-left);--seg-r:env(safe-area-inset-right)}
html,body{height:100%;overscroll-behavior:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
body{position:fixed;inset:0}
/* barra de busca no topo */
#barra{position:fixed;z-index:6;top:calc(8px + var(--seg-t));left:calc(8px + var(--seg-l));right:calc(8px + var(--seg-r));display:flex;gap:8px;align-items:center}
#barra .ic{flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--panel);border:1px solid var(--line);color:var(--txt);text-decoration:none;font-size:18px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.campoBusca{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:44px;padding:0 6px 0 12px;border-radius:14px;background:var(--panel);border:1px solid var(--line);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 6px 24px rgba(0,0,0,.35)}
.campoBusca:focus-within{border-color:var(--acc)}
.campoBusca svg{flex:none;color:var(--mut)}
#busca{flex:1;min-width:0;border:0;background:none;padding:0;font-size:16px;height:100%}
#limpaBusca{flex:none;width:32px;height:32px;border:0;border-radius:50%;background:#262b36;color:var(--txt);display:none;font-size:13px}
.campoBusca.tem #limpaBusca{display:block}
#barra #bPainel{display:none}
/* gaveta */
#painel{position:fixed;top:auto;left:0;right:0;bottom:calc(var(--abas) + var(--seg-b));width:auto;max-height:none;height:var(--h,150px);
  border-radius:20px 20px 0 0;border-bottom:0;display:flex;flex-direction:column;overflow:hidden;z-index:5;
  transition:height .28s cubic-bezier(.2,.8,.2,1);box-shadow:0 -8px 30px rgba(0,0,0,.4)}
#painel.arrastando{transition:none}
#cabSheet{flex:none;padding:0 12px 8px;touch-action:none;cursor:grab;border-bottom:1px solid var(--line)}
.alca{display:block;width:100%;height:22px;border:0;background:none;padding:0;position:relative}
.alca::after{content:"";position:absolute;left:50%;top:8px;width:44px;height:5px;margin-left:-22px;border-radius:9px;background:#454d5e}
#resumo{color:var(--mut);font-size:11.5px;margin:-2px 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fbarra{margin-top:4px;gap:6px}
.fb{padding:6px 8px;gap:5px}
.fb svg{display:none}
#painel.detalhe #filtros,#painel.detalhe #resumo{display:none}
#painel.detalhe #cabSheet{padding-bottom:0;border-bottom:0}
#corpo{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-bottom:8px}
#painel[data-snap="baixo"] #corpo{overflow:hidden}
.lin{padding:9px 14px;min-height:48px}
.det{padding:10px 14px 14px}
.voltar{font-size:14px;padding:6px 0;margin-bottom:6px}
.acoes button,.atalhos button,.bseq button,.bai{min-height:34px}
.opc{min-height:48px}
.aba-rodape{padding:8px 0 4px}
/* abas embaixo */
#abas{position:fixed;z-index:7;left:0;right:0;bottom:0;height:calc(var(--abas) + var(--seg-b));padding:0 var(--seg-r) var(--seg-b) var(--seg-l);
  display:grid;grid-template-columns:repeat(4,1fr);background:#0d1016;border-top:1px solid var(--line)}
#abas button{border:0;background:none;color:var(--mut);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;font-weight:500;padding:0;width:auto;height:auto;border-radius:0}
#abas button svg{width:22px;height:22px}
#abas button.on{color:var(--acc)}
#abas button:active{background:rgba(255,255,255,.05)}
/* controles do mapa */
#ctl{display:none}
#bTudo{position:fixed;z-index:4;right:calc(10px + var(--seg-r));bottom:calc(var(--abas) + var(--seg-b) + var(--h,150px) + 40px);width:40px;height:40px;border-radius:12px;
  border:1px solid var(--line);background:var(--panel);font-size:17px;display:grid;place-items:center;transition:bottom .28s cubic-bezier(.2,.8,.2,1)}
#painel.arrastando ~ #bTudo{transition:none}
#menuFundo{position:fixed;top:auto;right:calc(8px + var(--seg-r));bottom:calc(var(--abas) + var(--seg-b) + 8px);min-width:220px;max-width:calc(100% - 16px);z-index:9}
#menuFundo #rodape{display:block;border-top:1px solid var(--line);margin-top:6px;padding:8px 6px 2px;font-size:11px;line-height:1.45}
#dicaMapa{top:calc(62px + var(--seg-t));left:50%;max-width:calc(100% - 24px);white-space:normal;text-align:center}
.maplibregl-ctrl-bottom-right{bottom:calc(var(--abas) + var(--seg-b) + var(--h,150px));transition:bottom .28s}
.maplibregl-ctrl-bottom-left{display:none}
body[data-snap="meio"] .maplibregl-ctrl-bottom-right,body[data-snap="cheio"] .maplibregl-ctrl-bottom-right,body[data-snap="cheio"] #bTudo{display:none}
#corpo{overflow-anchor:none;scroll-padding-bottom:72px}

/* ---------- deitado: painel lateral ---------- */
@media (orientation:landscape) and (max-height:600px){
  :root{--lado:min(400px, 46vw)}
  #barra{right:auto;width:calc(var(--lado) - 8px);top:calc(6px + var(--seg-t))}
  #barra #bPainel{display:grid}
  #painel{top:calc(56px + var(--seg-t));bottom:calc(var(--abas) + var(--seg-b));left:0;right:auto;width:var(--lado);height:auto !important;
    padding-left:var(--seg-l);border-radius:0 16px 16px 0;border-left:0;transition:transform .25s}
  #painel{display:block;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scroll-padding-bottom:72px}
  #corpo{overflow:visible !important;flex:none}
  #cabSheet{cursor:default;touch-action:auto;padding-top:6px}
  body[data-snap] .maplibregl-ctrl-bottom-right{display:block}
  body[data-snap] #bTudo{display:grid}
  .alca{display:none}
  #painel[data-snap="baixo"] #corpo{overflow-y:auto}
  #abas{right:auto;width:var(--lado);border-right:1px solid var(--line);border-radius:0 0 14px 0;padding-right:0}
  #bTudo{bottom:calc(40px + var(--seg-b))}
  .maplibregl-ctrl-bottom-right{bottom:0}
  #menuFundo{right:auto;left:calc(var(--lado) + 8px);bottom:calc(8px + var(--seg-b))}
  #dicaMapa{left:calc(var(--lado) + (100% - var(--lado)) / 2)}
  /* esconder o painel para ver o mapa inteiro */
  body.semPainel #painel,body.semPainel #abas{transform:translateX(calc(-100% - 10px))}
  body.semPainel #barra{width:auto}
  body.semPainel .campoBusca{display:none}
  #abas{transition:transform .25s}
}
"""
s = s[:i] + CSS + s[j:]

# ---------- estrutura da tela ----------
i = s.index('<div id="painel">')
j = s.index('<div id="escolha"></div>')
ICS = {
    "busca": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    "linhas": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8.5 21l1.5-4M15.5 21 14 17"/><circle cx="8.5" cy="14" r=".6" fill="currentColor"/><circle cx="15.5" cy="14" r=".6" fill="currentColor"/></svg>',
    "rota": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/></svg>',
    "perto": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8"/><path d="M12 1.5V4M12 20v2.5M1.5 12H4M20 12h2.5"/></svg>',
    "mapa": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="m2 13 10 5 10-5"/><path d="m2 17.5 10 5 10-5" opacity=".5"/></svg>',
    "painel": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 4v16"/></svg>',
}
HTML = f"""<div id="barra">
  <a class="ic" href="../../" aria-label="Todos os apps">←</a>
  <button class="ic" id="bPainel" aria-label="Mostrar ou esconder o painel">{ICS["painel"]}</button>
  <div class="campoBusca">{ICS["busca"]}
    <input id="busca" type="search" enterkeyhint="search" placeholder="Linha, bairro, ponto ou estação" autocomplete="off">
    <button id="limpaBusca" aria-label="Limpar busca">✕</button>
  </div>
</div>

<div id="painel" data-snap="baixo">
  <div id="cabSheet">
    <button class="alca" id="alca" aria-label="Subir ou descer o painel"></button>
    <div id="resumo">&nbsp;</div>
    <div id="filtros"></div>
  </div>
  <div id="corpo"></div>
</div>
<button id="bTudo" aria-label="Ver a cidade inteira">⤢</button>

<nav id="abas">
  <button data-tab="linhas" class="on">{ICS["linhas"]}Linhas</button>
  <button id="bRota" data-tab="rota">{ICS["rota"]}Como chegar</button>
  <button id="bPerto" data-tab="perto">{ICS["perto"]}Perto</button>
  <button id="bTema" data-tab="mapa">{ICS["mapa"]}Mapa</button>
</nav>
<div id="ctl"></div>
<div id="menuFundo" role="menu">
  <div class="secao" style="padding:4px 6px 6px">Mapa de fundo</div>
  <button data-fundo="escuro"><i style="background:#1b1e24"></i>Escuro</button>
  <button data-fundo="claro"><i style="background:#e8e8e3"></i>Claro</button>
  <button data-fundo="ruas"><i style="background:linear-gradient(135deg,#f2efe9 50%,#f7d28e 50%)"></i>Ruas</button>
  <button data-fundo="satelite"><i style="background:linear-gradient(135deg,#2f4a2a,#1f3b52)"></i>Satélite</button>
  <div id="rodape"></div>
</div>
"""
s = s[:i] + HTML + s[j:]

# ---------- comportamento ----------
# começa com a gaveta baixa
s = troca(s, '    if (innerWidth <= 700) $("#painel").classList.add("min");', '    snap("baixo", true);')

# render: mantém a rolagem quando a mesma tela é redesenhada (ex.: marcou uma opção)
s = troca(s, '''  if (S.aba) corpo.innerHTML = htmlAba();
  else if (S.linha !== null) corpo.innerHTML = htmlLinha();
  else if (S.ponto !== null) corpo.innerHTML = htmlPonto(S.ponto);
  else if (S.perto) corpo.innerHTML = htmlPerto();
  else corpo.innerHTML = htmlLista();
  corpo.scrollTop = 0;''', '''  const chave = [S.aba, S.linha, S.dir, S.ponto, !!S.perto, S.aba ? "" : $("#busca").value].join("|");
  const painel = $("#painel"), mesma = chave === S._chaveTela, rol = corpo.scrollTop, rolP = painel.scrollTop;
  S._chaveTela = chave;
  if (S.aba) corpo.innerHTML = htmlAba();
  else if (S.linha !== null) corpo.innerHTML = htmlLinha();
  else if (S.ponto !== null) corpo.innerHTML = htmlPonto(S.ponto);
  else if (S.perto) corpo.innerHTML = htmlPerto();
  else corpo.innerHTML = htmlLista();
  corpo.scrollTop = mesma ? rol : 0;
  // deitado, quem rola é o painel: mesma tela mantém a posição; tela nova mostra o começo do conteúdo
  if (mesma) painel.scrollTop = rolP; else painel.scrollTop = 0;''')
s = troca(s, '''  if (S.modo === "rota"){ corpo.innerHTML = Rota.html(); corpo.scrollTop = 0; $("#painel").classList.add("detalhe"); return; }''',
          '''  marcarAba();
  if (S.modo === "rota"){ corpo.innerHTML = Rota.html(); corpo.scrollTop = 0; S._chaveTela = "rota"; $("#painel").classList.add("detalhe"); return; }''')

# margens do mapa conforme a gaveta / painel
i = s.index("function padMapa(){")
j = s.index("\n}\n", i) + 3
s = s[:i] + '''function padMapa(){
  if (deitado()){
    const w = document.body.classList.contains("semPainel") ? 0 : $("#painel").getBoundingClientRect().width;
    return {top:30, bottom:30, left:w + 30, right:60};
  }
  const topo = $("#barra").getBoundingClientRect().bottom;
  const fundo = innerHeight - $("#painel").getBoundingClientRect().top;
  return {top:topo + 20, bottom:fundo + 20, left:30, right:56};
}
''' + s[j:]

s = troca(s, '''function expandir(){ $("#painel").classList.remove("min"); }
function recolherNoCelular(){ if (innerWidth <= 700) $("#painel").classList.add("min"); }
$("#alca").addEventListener("click", () => $("#painel").classList.toggle("min"));
map.on("dragstart", () => recolherNoCelular());''', r'''// ---------- gaveta (em pé) e painel lateral (deitado) ----------
const deitado = () => matchMedia("(orientation:landscape) and (max-height:600px)").matches;
function alturas(){
  const p = $("#painel"), cab = $("#cabSheet");
  const max = p.getBoundingClientRect().bottom - $("#barra").getBoundingClientRect().bottom - 10;
  return {baixo:Math.min(cab.scrollHeight + 4, max), meio:Math.round(Math.min(max, Math.max(260, innerHeight * 0.5))), cheio:Math.round(max)};
}
function snap(nome, semAnimar){
  const p = $("#painel");
  if (deitado()){ p.dataset.snap = "cheio"; delete document.body.dataset.snap; document.body.classList.remove("semPainel"); return; }
  p.dataset.snap = nome; document.body.dataset.snap = nome;
  if (semAnimar) p.classList.add("arrastando");
  document.documentElement.style.setProperty("--h", alturas()[nome] + "px");
  if (semAnimar) requestAnimationFrame(() => p.classList.remove("arrastando"));
}
function expandir(){ if (deitado()) document.body.classList.remove("semPainel"); else if ($("#painel").dataset.snap === "baixo") snap("meio"); }
function recolherNoCelular(){ if (!deitado()) snap("baixo"); }
// o cabeçalho muda de altura (pílulas de filtro): a gaveta baixa acompanha
new ResizeObserver(() => { if ($("#painel").dataset.snap === "baixo" && !deitado()) snap("baixo", true); }).observe($("#cabSheet"));
addEventListener("resize", () => snap(deitado() ? "cheio" : ($("#painel").dataset.snap || "baixo"), true));
// arrastar a alça / cabeçalho
(() => {
  const p = $("#painel"), cab = $("#cabSheet");
  let y0 = 0, h0 = 0, t0 = 0, arrastou = false, ativo = false;
  cab.addEventListener("pointerdown", e => {
    if (deitado() || e.target.closest("button:not(.alca), input, a")) return;
    ativo = true; arrastou = false; y0 = e.clientY; h0 = p.getBoundingClientRect().height; t0 = performance.now();
    cab.setPointerCapture(e.pointerId);
  });
  cab.addEventListener("pointermove", e => {
    if (!ativo) return;
    const dy = e.clientY - y0;
    if (Math.abs(dy) > 6) arrastou = true;
    if (!arrastou) return;
    const a = alturas();
    p.classList.add("arrastando");
    document.documentElement.style.setProperty("--h", Math.max(a.baixo * 0.8, Math.min(a.cheio, h0 - dy)) + "px");
  });
  const fim = e => {
    if (!ativo) return; ativo = false;
    p.classList.remove("arrastando");
    const a = alturas(), h = p.getBoundingClientRect().height;
    if (!arrastou){ // toque na alça: sobe um degrau (ou volta para baixo do topo)
      if (e.target.closest(".alca")) snap({baixo:"meio", meio:"cheio", cheio:"baixo"}[p.dataset.snap] || "meio");
      return;
    }
    const v = (e.clientY - y0) / Math.max(1, performance.now() - t0); // px/ms, positivo = descendo
    let alvo;
    if (v > 0.6) alvo = h > a.meio + 10 ? "meio" : "baixo";
    else if (v < -0.6) alvo = h < a.meio - 10 ? "meio" : "cheio";
    else alvo = Object.entries(a).sort((x, y) => Math.abs(x[1] - h) - Math.abs(y[1] - h))[0][0];
    snap(alvo);
  };
  cab.addEventListener("pointerup", fim);
  cab.addEventListener("pointercancel", fim);
})();
map.on("dragstart", () => { if (!deitado() && $("#painel").dataset.snap === "cheio") snap("meio"); });
// abas
function marcarAba(){
  const aba = S.modo === "rota" ? "rota" : S.perto ? "perto" : "linhas";
  document.querySelectorAll("#abas [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === aba || (b.dataset.tab === "mapa" && $("#menuFundo").classList.contains("aberto"))));
}
$('#abas [data-tab="linhas"]').addEventListener("click", () => {
  if (S.modo === "rota") Rota.sair();
  S.linha = null; S.ponto = null; S.perto = null; S.aba = null;
  montarFiltros(); aplicarEstado(); render(); atualizarEndereco();
  snap($("#painel").dataset.snap === "baixo" ? "meio" : $("#painel").dataset.snap);
});
$("#bRota").addEventListener("click", () => setTimeout(() => { if (!deitado()) snap("cheio"); }, 0));
$("#bPerto").addEventListener("click", () => marcarAba());
$("#bTema").addEventListener("click", () => setTimeout(marcarAba, 0));
document.addEventListener("click", () => setTimeout(marcarAba, 0));
// busca no topo
$("#busca").addEventListener("focus", () => { if (S.modo === "rota") Rota.sair(); if (!deitado()) snap("cheio"); });
$("#busca").addEventListener("input", () => $(".campoBusca").classList.toggle("tem", !!$("#busca").value));
$("#busca").addEventListener("keydown", e => { if (e.key === "Enter") $("#busca").blur(); });
$("#limpaBusca").addEventListener("click", () => { $("#busca").value = ""; $(".campoBusca").classList.remove("tem"); $("#busca").dispatchEvent(new Event("input")); });
// deitado: botão para esconder o painel e ver o mapa todo
$("#bPainel").addEventListener("click", () => document.body.classList.toggle("semPainel"));
// créditos do mapa: começam recolhidos no botão "i" (abertos cobririam o mapa no celular)
(() => {
  let tocou = false;
  const fechar = () => { const a = document.querySelector(".maplibregl-ctrl-attrib"); if (a && !tocou) a.classList.remove("maplibregl-compact-show"); };
  document.addEventListener("click", e => { if (e.target.closest(".maplibregl-ctrl-attrib")) tocou = true; }, true);
  map.on("idle", fechar); map.on("resize", () => setTimeout(fechar, 0)); setTimeout(fechar, 300);
})();
// o teclado do celular encolhe a tela: refaz as alturas
if (window.visualViewport) visualViewport.addEventListener("resize", () => { if (!deitado()) snap($("#painel").dataset.snap, true); });''')
os.makedirs(os.path.join(RAIZ, "celular"), exist_ok=True)
with open(os.path.join(RAIZ, "celular", "index.html"), "w", encoding="utf-8") as f:
    f.write(s)
print("celular/index.html gerado:", len(s), "bytes")
