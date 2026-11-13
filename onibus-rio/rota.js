// Ônibus do Rio — caixa de caminho (planejador de rotas)
// Roda no navegador sobre os dados já carregados (S.rede). Como não há horários de cada viagem,
// o tempo é estimado: caminhada + espera (metade do intervalo da linha) + percurso (distância / velocidade do modo).
// O algoritmo é o RAPTOR (rodadas de embarque), com até 3 baldeações.
"use strict";
const Rota = (() => {
  const ANDAR = 75;              // metros por minuto (4,5 km/h)
  const FATOR_ANDAR = 1.25;      // ruas não são linha reta
  const RAIO_ACESSO = 900;       // até onde se anda para o primeiro ponto / do último
  const RAIO_BALDEACAO = 400;    // caminhada entre pontos numa baldeação
  const PENALIDADE = 3;          // minutos a mais por baldeação (desconforto, incerteza)
  const MAX_RODADAS = 4;         // até 4 conduções
  const VEL = {bus:17, exec:20, brt:24, metro:33, trem:38, vlt:15, barca:18};       // km/h médios
  const DESVIO = {bus:1.3, exec:1.3, brt:1.15, metro:1.1, trem:1.05, vlt:1.15, barca:1.1};
  const ESPERA = {metro:3, trem:6, vlt:5, barca:15};

  const R = {de:null, para:null, opcoes:[], sel:0, escolhendo:null, calculando:false};
  let pads = null, pontoPads = null, vizinhos = null;
  let mA = null, mB = null;

  // ---------- rede para o roteamento ----------
  function preparar(){
    if (pads) return;
    const L = S.rede.linhas, P = S.rede.pontos;
    pads = []; pontoPads = P.map(() => []);
    L.forEach((l, li) => l.d.forEach((d, di) => {
      if (!d.s || d.s.length < 2) return;
      const cum = [0];
      const v = VEL[l.t] || 17, f = DESVIO[l.t] || 1.3;
      for (let k = 1; k < d.s.length; k++){
        const a = P[d.s[k-1]], b = P[d.s[k]];
        cum.push(cum[k-1] + dist([a[2], a[1]], [b[2], b[1]]) * f / (v * 1000 / 60));
      }
      let espera = ESPERA[l.t] ?? (l.i ? Math.min(15, Math.max(2, l.i / 2)) : 7);
      if (l.t === "barca" && /Arariboia/i.test(l.l)) espera = 5;
      const pi = pads.length;
      pads.push({li, di, s:d.s, cum, espera});
      d.s.forEach((s, pos) => pontoPads[s].push([pi, pos]));
    }));
    // vizinhos a pé (grade de ~400 m)
    const cel = 0.004, grade = new Map();
    const chave = (x, y) => x + ":" + y;
    P.forEach((p, i) => { const k = chave(Math.floor(p[2]/cel), Math.floor(p[1]/cel)); (grade.get(k) || grade.set(k, []).get(k)).push(i); });
    vizinhos = P.map((p, i) => {
      const gx = Math.floor(p[2]/cel), gy = Math.floor(p[1]/cel), out = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
        for (const j of grade.get(chave(gx+dx, gy+dy)) || []){
          if (j === i) continue;
          const d = dist([p[2], p[1]], [P[j][2], P[j][1]]);
          if (d <= RAIO_BALDEACAO) out.push([j, d * FATOR_ANDAR / ANDAR]);
        }
      return out;
    });
  }

  function proximos(pt, raio){
    const P = S.rede.pontos, out = [];
    for (let i = 0; i < P.length; i++){
      const d = dist(pt, [P[i][2], P[i][1]]);
      if (d <= raio) out.push([i, d * FATOR_ANDAR / ANDAR, d]);
    }
    return out;
  }

  // ---------- RAPTOR ----------
  function raptor(orig, dest, excluir){
    const N = S.rede.pontos.length;
    let acesso = proximos(orig, RAIO_ACESSO), saida = proximos(dest, RAIO_ACESSO);
    if (!acesso.length) acesso = proximos(orig, 1600);
    if (!saida.length) saida = proximos(dest, 1600);
    if (!acesso.length || !saida.length) return [];
    const saidaDe = new Map(saida.map(([i, t]) => [i, t]));
    const melhor = new Float64Array(N).fill(Infinity);
    const tau = [new Float64Array(N).fill(Infinity)];
    const pai = [new Array(N)];
    let marcados = new Set();
    for (const [i, t] of acesso){ tau[0][i] = t; melhor[i] = t; pai[0][i] = {orig:true}; marcados.add(i); }
    let limite = Infinity;
    const chegadas = [];
    for (let k = 1; k <= MAX_RODADAS && marcados.size; k++){
      const ant = tau[k-1];
      const tk = new Float64Array(N).fill(Infinity), pk = new Array(N);
      tau.push(tk); pai.push(pk);
      const Q = new Map();
      for (const s of marcados) for (const [p, pos] of pontoPads[s]){
        if (excluir && excluir.has(pads[p].li)) continue;
        const q = Q.get(p); if (q === undefined || pos < q) Q.set(p, pos);
      }
      const porOnibus = new Set();
      for (const [p, pos0] of Q){
        const pd = pads[p];
        let base = Infinity, bPos = -1, bPonto = -1;
        for (let pos = pos0; pos < pd.s.length; pos++){
          const s = pd.s[pos];
          if (bPos >= 0){
            const t = base + pd.cum[pos];
            if (t < melhor[s] && t < limite){
              tk[s] = t; melhor[s] = t; pk[s] = {p, de:bPonto, pos0:bPos, pos}; porOnibus.add(s);
            }
          }
          if (ant[s] < Infinity){
            const v = ant[s] + pd.espera + (k > 1 ? PENALIDADE : 0) - pd.cum[pos];
            if (v < base){ base = v; bPos = pos; bPonto = s; }
          }
        }
      }
      marcados = new Set(porOnibus);
      // baldeações a pé
      for (const s of porOnibus) for (const [j, w] of vizinhos[s]){
        const t = tk[s] + w;
        if (t < melhor[j] && t < limite){ tk[j] = t; melhor[j] = t; pk[j] = {andar:s}; marcados.add(j); }
      }
      // chegada ao destino nesta rodada
      let melhorK = null;
      for (const s of marcados){
        const w = saidaDe.get(s); if (w === undefined || tk[s] === Infinity) continue;
        const t = tk[s] + w;
        if (!melhorK || t < melhorK.t) melhorK = {t, k, s, w};
      }
      if (melhorK){ chegadas.push(melhorK); limite = Math.min(limite, melhorK.t); }
    }
    return chegadas.map(c => montar(c, pai, tau, orig, dest));
  }

  function montar(c, pai, tau, orig, dest){
    const P = S.rede.pontos, pernas = [];
    pernas.push({tipo:"andar", de:c.s, ate:"dest", min:c.w});
    let k = c.k, s = c.s;
    while (k > 0){
      const p = pai[k][s];
      if (p.andar !== undefined){
        pernas.push({tipo:"andar", de:p.andar, ate:s, min:tau[k][s] - tau[k][p.andar]});
        s = p.andar; continue;
      }
      const pd = pads[p.p];
      pernas.push({tipo:"ride", pad:p.p, li:pd.li, di:pd.di, pos0:p.pos0, pos:p.pos, de:p.de, ate:s,
        min:pd.cum[p.pos] - pd.cum[p.pos0], espera:pd.espera});
      s = p.de; k--;
    }
    pernas.push({tipo:"andar", de:"orig", ate:s, min:tau[0][s]});
    pernas.reverse();
    // junta caminhadas seguidas e tira as de 0 m
    const juntas = [];
    for (const x of pernas){
      const ult = juntas[juntas.length - 1];
      if (x.tipo === "andar" && ult && ult.tipo === "andar"){ ult.ate = x.ate; ult.min += x.min; }
      else juntas.push({...x});
    }
    const limpas = juntas.filter(x => !(x.tipo === "andar" && x.min < 0.3 && x.de !== "orig" && x.ate !== "dest"));
    const andar = limpas.filter(x => x.tipo === "andar").reduce((a, x) => a + x.min, 0);
    return {t:c.t, pernas:limpas, andar, conducoes:limpas.filter(x => x.tipo === "ride").length,
      chave:limpas.filter(x => x.tipo === "ride").map(x => x.li).join("-")};
  }

  function planejar(){
    if (!R.de || !R.para){ R.opcoes = []; return; }
    preparar();
    const o = [R.de.lon, R.de.lat], d = [R.para.lon, R.para.lat];
    let todas = [];
    const reta = dist(o, d);
    if (reta * FATOR_ANDAR <= 2200)
      todas.push({t:reta * FATOR_ANDAR / ANDAR, pernas:[{tipo:"andar", de:"orig", ate:"dest", min:reta * FATOR_ANDAR / ANDAR}],
        andar:reta * FATOR_ANDAR / ANDAR, conducoes:0, chave:"a pé"});
    // 1ª busca: as melhores por número de conduções; depois, alternativas sem as linhas já sugeridas
    let base = raptor(o, d, null);
    todas.push(...base);
    const excl = new Set();
    for (let rodada = 0; rodada < 3 && base.length; rodada++){
      const melhorAgora = base.reduce((a, b) => (b.t < a.t ? b : a));
      melhorAgora.pernas.filter(x => x.tipo === "ride").forEach(x => excl.add(x.li));
      base = raptor(o, d, excl);
      todas.push(...base);
    }
    // remove repetidas e as muito piores
    const vistas = new Set();
    todas.sort((a, b) => a.t - b.t);
    const minT = todas.length ? todas[0].t : 0;
    R.opcoes = todas.filter(x => { if (vistas.has(x.chave)) return false; vistas.add(x.chave); return x.t <= Math.max(minT * 1.8, minT + 25); }).slice(0, 5);
    R.sel = 0;
  }

  // ---------- busca de lugares ----------
  let timerBusca = null, buscaId = 0;
  async function sugerir(campo, texto){
    const caixa = document.getElementById("rSug");
    if (!caixa) return;
    const q = semAcento(texto.trim());
    if (q.length < 2){ caixa.innerHTML = ""; return; }
    const P = S.rede.pontos, L = S.rede.linhas;
    const locais = [];
    for (let i = 0; i < P.length && locais.length < 60; i++) if (P[i]._busca.includes(q)) locais.push(i);
    // estações primeiro, depois nomes que começam com o texto; um por nome
    locais.sort((a, b) => ((P[b][4] === 2) - (P[a][4] === 2)) || (P[b]._busca.startsWith(q) - P[a]._busca.startsWith(q)));
    const nomes = new Set(), lista = [];
    for (const i of locais){ const k = P[i][0] + (P[i][4] === 2 ? "E" : ""); if (nomes.has(k)) continue; nomes.add(k); lista.push(i); if (lista.length >= 5) break; }
    const htmlLocais = lista.map(i => {
      const p = P[i], est = p[4] === 2;
      const tipo = est ? (PREFIXO[L[p[3][0]].t] || "Estação ").trim() : "Ponto de ônibus";
      return `<button class="sug" data-sug='${esc(JSON.stringify({nome:(est ? (PREFIXO[L[p[3][0]].t] || "") : "") + p[0], lat:p[1], lon:p[2]}))}'><b>${esc(p[0])}</b><small>${tipo} · ${p[3].slice(0, 6).map(i => esc(L[i].n)).join(" · ")}${p[3].length > 6 ? " …" : ""}</small></button>`;
    }).join("");
    caixa.innerHTML = htmlLocais + `<div class="sug-carregando">procurando endereços…</div>`;
    const id = ++buscaId;
    let end = "";
    try {
      const u = `https://photon.komoot.io/api/?q=${encodeURIComponent(texto)}&limit=6&lat=-22.91&lon=-43.3&bbox=-43.82,-23.09,-42.95,-22.73`;
      const r = await fetch(u); const j = await r.json();
      if (id !== buscaId) return;
      end = (j.features || []).map(f => {
        const pr = f.properties, [lon, lat] = f.geometry.coordinates;
        const nome = [pr.name, pr.street && pr.name !== pr.street ? pr.street + (pr.housenumber ? ", " + pr.housenumber : "") : (pr.housenumber ? pr.housenumber : "")].filter(Boolean).join(" — ") || pr.street || "Lugar";
        const onde = [pr.district || pr.locality, pr.city].filter(Boolean).join(", ");
        return `<button class="sug" data-sug='${esc(JSON.stringify({nome, lat, lon}))}'><b>${esc(nome)}</b><small>Endereço · ${esc(onde)}</small></button>`;
      }).join("");
    } catch (e) { if (id !== buscaId) return; }
    caixa.innerHTML = htmlLocais + end + (!htmlLocais && !end ? `<div class="sug-carregando">Nada encontrado. Dica: toque em ⌖ e escolha o lugar no mapa.</div>` : "");
  }
  async function nomeDoLugar(lat, lon){
    // nome do ponto/estação mais próximo (até 60 m) ou endereço aproximado
    const perto = proximos([lon, lat], 60).sort((a, b) => a[2] - b[2])[0];
    if (perto) return S.rede.pontos[perto[0]][0];
    try {
      const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`); const j = await r.json();
      const pr = j.features?.[0]?.properties;
      if (pr) return [pr.street || pr.name, pr.housenumber].filter(Boolean).join(", ") + (pr.district ? " — " + pr.district : "");
    } catch (e) {}
    return "Ponto no mapa";
  }

  // ---------- marcadores ----------
  function pino(letra, cor){
    // o MapLibre usa o transform do elemento externo para posicionar; a gota fica num elemento interno
    const el = document.createElement("div");
    el.className = "pino-rota-ext";
    el.innerHTML = `<div class="pino-rota" style="background:${cor}"><span>${letra}</span></div>`;
    return el;
  }
  function atualizarMarcadores(){
    if (R.de){
      if (!mA){ mA = new maplibregl.Marker({element:pino("A", "#22c55e"), draggable:true, anchor:"bottom"}).setLngLat([R.de.lon, R.de.lat]).addTo(map);
        mA.on("dragend", () => moverPara("de", mA.getLngLat())); }
      else mA.setLngLat([R.de.lon, R.de.lat]);
    } else if (mA){ mA.remove(); mA = null; }
    if (R.para){
      if (!mB){ mB = new maplibregl.Marker({element:pino("B", "#ef4444"), draggable:true, anchor:"bottom"}).setLngLat([R.para.lon, R.para.lat]).addTo(map);
        mB.on("dragend", () => moverPara("para", mB.getLngLat())); }
      else mB.setLngLat([R.para.lon, R.para.lat]);
    } else if (mB){ mB.remove(); mB = null; }
  }
  async function moverPara(campo, ll){
    R[campo] = {nome:"…", lat:ll.lat, lon:ll.lng};
    calcular();
    R[campo].nome = await nomeDoLugar(ll.lat, ll.lng);
    const inp = document.getElementById(campo === "de" ? "rDe" : "rPara"); if (inp) inp.value = R[campo].nome;
    atualizarEndereco();
  }

  // ---------- desenho da rota ----------
  function garantirCamadas(){
    if (map.getSource("rota")) return;
    map.addSource("rota", {type:"geojson", data:{type:"FeatureCollection", features:[]}});
    map.addLayer({id:"rota-casco", type:"line", source:"rota", filter:["==",["get","k"],"ride"], layout:{"line-cap":"round","line-join":"round"},
      paint:{"line-color":"#0b0d12","line-width":["interpolate",["linear"],["zoom"],10,7,15,12],"line-opacity":0.8}});
    map.addLayer({id:"rota-ride", type:"line", source:"rota", filter:["==",["get","k"],"ride"], layout:{"line-cap":"round","line-join":"round"},
      paint:{"line-color":["get","cor"],"line-width":["interpolate",["linear"],["zoom"],10,4,15,7.5]}});
    map.addLayer({id:"rota-andar", type:"line", source:"rota", filter:["==",["get","k"],"andar"], layout:{"line-cap":"round","line-join":"round"},
      paint:{"line-color":"#ffffff","line-width":["interpolate",["linear"],["zoom"],10,2,15,4],"line-dasharray":[0.2,1.8]}});
    map.addLayer({id:"rota-pontos", type:"circle", source:"rota", filter:["==",["get","k"],"pt"],
      paint:{"circle-radius":["interpolate",["linear"],["zoom"],10,4,15,7],"circle-color":"#ffffff","circle-stroke-color":["get","cor"],"circle-stroke-width":3}});
  }
  function trechoDaLinha(pd, pos0, pos){
    // recorta o desenho da linha entre o embarque e o desembarque; se falhar, liga os pontos
    const l = S.rede.linhas[pd.li], P = S.rede.pontos;
    const coords = (l._coords[pd.di] || l._coords[0]).flat();
    const a = P[pd.s[pos0]], b = P[pd.s[pos]];
    const maisPerto = (pt, desde) => { let bi = -1, bd = Infinity;
      for (let i = desde; i < coords.length; i++){ const d = (coords[i][0]-pt[2])**2 + (coords[i][1]-pt[1])**2; if (d < bd){ bd = d; bi = i; } } return [bi, bd]; };
    const [ia] = maisPerto(a, 0), [ib, db] = maisPerto(b, Math.max(0, ia));
    if (ia >= 0 && ib > ia && db < 3e-6) return [[a[2], a[1]], ...coords.slice(ia, ib + 1), [b[2], b[1]]];
    return pd.s.slice(pos0, pos + 1).map(i => [P[i][2], P[i][1]]);
  }
  function desenhar(){
    if (!map.getStyle()) return;
    garantirCamadas();
    const op = R.opcoes[R.sel], feats = [];
    if (op){
      const P = S.rede.pontos;
      const lugar = x => x === "orig" ? [R.de.lon, R.de.lat] : x === "dest" ? [R.para.lon, R.para.lat] : [P[x][2], P[x][1]];
      for (const pe of op.pernas){
        if (pe.tipo === "andar") feats.push({type:"Feature", properties:{k:"andar"}, geometry:{type:"LineString", coordinates:[lugar(pe.de), lugar(pe.ate)]}});
        else {
          const l = S.rede.linhas[pe.li], pd = pads[pe.pad];
          feats.push({type:"Feature", properties:{k:"ride", cor:l._cor}, geometry:{type:"LineString", coordinates:trechoDaLinha(pd, pe.pos0, pe.pos)}});
          for (const x of [pe.de, pe.ate]) feats.push({type:"Feature", properties:{k:"pt", cor:l._cor}, geometry:{type:"Point", coordinates:lugar(x)}});
        }
      }
    }
    map.getSource("rota").setData({type:"FeatureCollection", features:feats});
  }
  function limparDesenho(){ if (map.getSource("rota")) map.getSource("rota").setData({type:"FeatureCollection", features:[]}); }
  function enquadrar(){
    const pts = [];
    if (R.de) pts.push([R.de.lon, R.de.lat]);
    if (R.para) pts.push([R.para.lon, R.para.lat]);
    const op = R.opcoes[R.sel];
    if (op) op.pernas.forEach(pe => { if (pe.tipo === "ride") pads[pe.pad].s.slice(pe.pos0, pe.pos + 1).forEach(i => pts.push([S.rede.pontos[i][2], S.rede.pontos[i][1]])); });
    if (!pts.length) return;
    if (pts.length === 1){ map.easeTo({center:pts[0], zoom:Math.max(map.getZoom(), 14), padding:padMapa()}); return; }
    const b = pts.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(pts[0], pts[0]));
    map.fitBounds(b, {padding:padMapa(), maxZoom:16, duration:800});
  }

  // ---------- painel ----------
  const fmtMin = m => { m = Math.max(1, Math.round(m)); return m < 60 ? `${m} min` : `${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`; };
  const hora = m => { const d = new Date(Date.now() + m * 60000); return d.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"}); };
  const icAndar = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px"><circle cx="13" cy="4" r="2"/><path d="M10.5 8.5 8 20h2.2l1.6-7 2.2 2v5h2v-6.5l-2.2-2 .7-3.3A6 6 0 0 0 19 11V9a4 4 0 0 1-3.4-2l-1-1.6A2 2 0 0 0 12 5l-5 2v5h2V8.4z"/></svg>`;

  function html(){
    return `<div class="det rota">
      <button class="voltar" data-rsair>← voltar ao mapa</button>
      <h2 class="rt">Como chegar</h2>
      <div class="campos">
        <div class="campo"><span class="pin" style="background:#22c55e">A</span>
          <input id="rDe" data-campo="de" placeholder="De onde? Endereço, ponto ou estação" autocomplete="off" value="${esc(R.de ? R.de.nome : "")}">
          <button data-meu="de" title="Minha localização" aria-label="Minha localização">◎</button>
          <button data-mapa="de" title="Escolher no mapa" aria-label="Escolher no mapa" class="${R.escolhendo === "de" ? "on" : ""}">⌖</button></div>
        <button class="trocar" data-trocar title="Inverter" aria-label="Inverter origem e destino">⇅</button>
        <div class="campo"><span class="pin" style="background:#ef4444">B</span>
          <input id="rPara" data-campo="para" placeholder="Para onde?" autocomplete="off" value="${esc(R.para ? R.para.nome : "")}">
          <button data-meu="para" title="Minha localização" aria-label="Minha localização">◎</button>
          <button data-mapa="para" title="Escolher no mapa" aria-label="Escolher no mapa" class="${R.escolhendo === "para" ? "on" : ""}">⌖</button></div>
      </div>
      <div id="rSug"></div>
      <div id="rRes">${htmlResultados()}</div>
    </div>`;
  }

  function htmlResultados(){
    if (R.escolhendo) return `<div class="aviso">Toque no mapa para marcar ${R.escolhendo === "de" ? "a origem (A)" : "o destino (B)"}.</div>`;
    if (!R.de || !R.para) return `<div class="aviso">Escolha a origem e o destino: digite um endereço, um ponto ou uma estação, use ◎ para a sua localização, ⌖ para tocar no mapa — ou simplesmente toque em dois lugares no mapa.</div>`;
    if (R.calculando) return `<div class="aviso">Calculando…</div>`;
    if (!R.opcoes.length) return `<div class="aviso">Não encontrei um caminho com até 3 baldeações e caminhadas de até 900 m. Tente marcar um ponto mais perto de uma avenida ou estação.</div>`;
    const L = S.rede.linhas;
    return R.opcoes.map((op, i) => {
      const rides = op.pernas.filter(x => x.tipo === "ride");
      const seq = op.pernas.map(pe => pe.tipo === "andar"
        ? (pe.min >= 1 ? `<span class="pe">${icAndar}${Math.round(pe.min)}</span>` : "")
        : selo(L[pe.li])).filter(Boolean).join(`<span class="seta">›</span>`);
      const resumo = op.conducoes === 0 ? "só caminhada" : op.conducoes === 1 ? "sem baldeação" : `${op.conducoes - 1} baldeaç${op.conducoes - 1 > 1 ? "ões" : "ão"}`;
      const tarifa = rides.reduce((a, pe) => a + (L[pe.li].$ || 0), 0);
      return `<div class="op ${i === R.sel ? "on" : ""}" data-op="${i}">
        <div class="op-topo"><b>${fmtMin(op.t)}</b><span>chega ~${hora(op.t)}</span></div>
        <div class="op-seq">${seq}</div>
        <div class="op-meta">${resumo} · ${Math.round(op.andar)} min a pé${tarifa ? ` · ônibus a partir de R$ ${tarifa.toFixed(2).replace(".", ",")}` : ""}</div>
        ${i === R.sel ? htmlPassos(op) : ""}
      </div>`;
    }).join("") + `<div class="nota">Tempos estimados pela distância, pela velocidade média de cada modo e pela espera média (metade do intervalo da linha). Não considera horários, trânsito nem tarifa integrada.</div>`;
  }

  function htmlPassos(op){
    const L = S.rede.linhas, P = S.rede.pontos;
    const nomeDe = x => x === "orig" ? R.de.nome : x === "dest" ? R.para.nome : nomePonto(x);
    const nomePonto = i => { const p = P[i]; return (p[4] === 2 ? (PREFIXO[L[p[3][0]].t] || "Estação ") : "ponto ") + p[0]; };
    const passos = op.pernas.map(pe => {
      if (pe.tipo === "andar"){
        if (pe.min < 0.5) return "";
        const metros = Math.round(pe.min * ANDAR / 10) * 10;
        return `<li class="pa"><span class="ic">${icAndar}</span><div>Caminhe ${metros} m até <b>${esc(nomeDe(pe.ate))}</b><small>${fmtMin(pe.min)}</small></div></li>`;
      }
      const l = L[pe.li], d = l.d[pe.di], n = pe.pos - pe.pos0;
      const verbo = l.t === "barca" ? "Pegue a barca" : l.t === "metro" ? "Pegue o metrô" : l.t === "trem" ? "Pegue o trem" : l.t === "vlt" ? "Pegue o VLT" : "Pegue o ônibus";
      return `<li class="pr" style="--cor:${l._cor}"><span class="ic">${selo(l)}</span><div>${verbo} <b>${esc(l.n)}</b> em <b>${esc(nomeDe(pe.de))}</b>, sentido ${esc(d.h || l.l)}
        <small>espera ~${Math.round(pe.espera)} min · ${fmtMin(pe.min)} de viagem · ${n} parada${n > 1 ? "s" : ""}</small>
        Desça em <b>${esc(nomeDe(pe.ate))}</b></div></li>`;
    }).join("");
    return `<ol class="passos">${passos}<li class="pa fim"><span class="ic">🏁</span><div><b>${esc(R.para.nome)}</b></div></li></ol>
      <div class="acoes"><button data-renq>Ver no mapa</button><button data-rcomp>Compartilhar</button></div>`;
  }

  function atualizarResultados(){
    const el = document.getElementById("rRes"); if (el) el.innerHTML = htmlResultados();
    let dica = document.getElementById("dicaMapa");
    if (!dica){ dica = document.createElement("div"); dica.id = "dicaMapa"; document.body.appendChild(dica); }
    const campo = S.modo === "rota" ? (R.escolhendo || (!R.de ? "de" : !R.para ? "para" : null)) : null;
    dica.textContent = campo ? `Toque no mapa para marcar ${campo === "de" ? "a origem (A)" : "o destino (B)"}` : "";
    dica.style.display = campo ? "block" : "none";
  }

  // ---------- fluxo ----------
  function calcular(){
    atualizarMarcadores();
    if (!R.de || !R.para){ R.opcoes = []; limparDesenho(); atualizarResultados(); return; }
    R.calculando = true; atualizarResultados();
    setTimeout(() => {
      const t0 = performance.now();
      planejar();
      R.calculando = false;
      console.log("rota calculada em", Math.round(performance.now() - t0), "ms");
      atualizarResultados(); desenhar(); enquadrar(); atualizarEndereco();
    }, 20);
  }
  function definir(campo, lugar){
    R[campo] = lugar; R.escolhendo = null;
    const inp = document.getElementById(campo === "de" ? "rDe" : "rPara"); if (inp) inp.value = lugar.nome;
    const sug = document.getElementById("rSug"); if (sug) sug.innerHTML = "";
    document.querySelectorAll("[data-mapa]").forEach(b => b.classList.remove("on"));
    calcular();
    // foco no próximo campo vazio
    if (campo === "de" && !R.para){ const p = document.getElementById("rPara"); if (p && innerWidth > 700) p.focus(); }
  }
  function abrir(pre){
    S.modo = "rota"; S.linha = null; S.ponto = null; S.perto = null;
    if (S.aba){ S.aba = null; montarFiltros(); }
    if (pre) Object.assign(R, pre);
    aplicarEstado(); render(); expandir();
    atualizarMarcadores(); atualizarResultados();
    if (R.de && R.para) calcular();
    else if (innerWidth > 700) setTimeout(() => { const i = document.getElementById(R.de ? "rPara" : "rDe"); if (i) i.focus(); }, 50);
  }
  function sair(){
    S.modo = null; R.escolhendo = null;
    limparDesenho(); atualizarResultados();
    if (mA){ mA.remove(); mA = null; } if (mB){ mB.remove(); mB = null; }
    aplicarEstado(); render(); atualizarEndereco();
  }
  function lugarDoPonto(pi){
    const p = S.rede.pontos[pi], L = S.rede.linhas;
    return {nome:(p[4] === 2 ? (PREFIXO[L[p[3][0]].t] || "Estação ") : "") + p[0], lat:p[1], lon:p[2]};
  }

  // clique no mapa durante o modo rota: marca A/B; devolve true se tratou o clique
  function clique(e){
    if (S.modo !== "rota") return false;
    const campo = R.escolhendo || (!R.de ? "de" : !R.para ? "para" : null);
    if (!campo) return true;
    // se tocou num ponto/estação, usa o nome dele
    const r = 8, f = map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], {layers:["estacoes", "pontos"].filter(id => map.getLayer(id))});
    if (f.length) definir(campo, lugarDoPonto(f[0].properties.i));
    else {
      const ll = e.lngLat;
      definir(campo, {nome:"…", lat:ll.lat, lon:ll.lng});
      nomeDoLugar(ll.lat, ll.lng).then(n => { R[campo].nome = n; const i = document.getElementById(campo === "de" ? "rDe" : "rPara"); if (i) i.value = n; atualizarEndereco(); });
    }
    if (R.de && !R.para) recolherNoCelular();
    return true;
  }

  // ---------- eventos do painel ----------
  const corpo = document.getElementById("corpo");
  corpo.addEventListener("input", e => {
    const inp = e.target.closest("[data-campo]"); if (!inp) return;
    R.focoCampo = inp.dataset.campo;
    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => sugerir(inp.dataset.campo, inp.value), 250);
  });
  corpo.addEventListener("focusin", e => { const inp = e.target.closest("[data-campo]"); if (inp){ R.focoCampo = inp.dataset.campo; inp.select(); } });
  corpo.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.closest("[data-campo]")){ const b = document.querySelector("#rSug .sug"); if (b) b.click(); }
  });
  corpo.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("[data-rsair]")){ sair(); return; }
    const sug = t.closest("[data-sug]");
    if (sug){ definir(R.focoCampo || (!R.de ? "de" : "para"), JSON.parse(sug.dataset.sug)); return; }
    const meu = t.closest("[data-meu]");
    if (meu){
      const campo = meu.dataset.meu;
      if (!navigator.geolocation){ alertaSuave("Seu navegador não informa a localização."); return; }
      meu.textContent = "…";
      navigator.geolocation.getCurrentPosition(pos => { meu.textContent = "◎"; definir(campo, {nome:"Minha localização", lat:pos.coords.latitude, lon:pos.coords.longitude}); },
        () => { meu.textContent = "◎"; alertaSuave("Não foi possível obter sua localização."); }, {enableHighAccuracy:true, timeout:12000});
      return;
    }
    const mp = t.closest("[data-mapa]");
    if (mp){ R.escolhendo = R.escolhendo === mp.dataset.mapa ? null : mp.dataset.mapa;
      document.querySelectorAll("[data-mapa]").forEach(b => b.classList.toggle("on", b.dataset.mapa === R.escolhendo));
      atualizarResultados(); if (R.escolhendo) recolherNoCelular(); return; }
    if (t.closest("[data-trocar]")){ [R.de, R.para] = [R.para, R.de];
      document.getElementById("rDe").value = R.de ? R.de.nome : ""; document.getElementById("rPara").value = R.para ? R.para.nome : "";
      calcular(); return; }
    if (t.closest("[data-renq]")){ enquadrar(); recolherNoCelular(); return; }
    if (t.closest("[data-rcomp]")){ atualizarEndereco();
      const dados = {title:`Como chegar: ${R.de.nome} → ${R.para.nome}`, url:location.href};
      if (navigator.share) navigator.share(dados).catch(() => {}); else navigator.clipboard && navigator.clipboard.writeText(location.href).then(() => alertaSuave("Link copiado."));
      return; }
    const op = t.closest("[data-op]");
    if (op && +op.dataset.op !== R.sel){ R.sel = +op.dataset.op; atualizarResultados(); desenhar(); enquadrar(); }
    // botões "sair daqui / ir para cá" no painel de um ponto
    const rd = t.closest("[data-rde]"), rp = t.closest("[data-rpara]");
    if (rd) abrir({de:lugarDoPonto(+rd.dataset.rde)});
    if (rp) abrir({para:lugarDoPonto(+rp.dataset.rpara)});
  });
  document.getElementById("bRota").addEventListener("click", () => abrir());

  // ---------- link compartilhável: #de=lat,lon,nome&para=... ----------
  function codificar(l){ return `${l.lat.toFixed(5)},${l.lon.toFixed(5)},${encodeURIComponent(l.nome)}`; }
  function decodificar(s){ const [la, lo, ...n] = s.split(","); const lat = +la, lon = +lo; if (!isFinite(lat) || !isFinite(lon)) return null; return {lat, lon, nome:decodeURIComponent(n.join(",")) || "Ponto no mapa"}; }
  function atualizarEndereco(){
    if (S.modo !== "rota") return;
    const h = [R.de && "de=" + codificar(R.de), R.para && "para=" + codificar(R.para)].filter(Boolean).join("&");
    history.replaceState(null, "", location.pathname + location.search + (h ? "#" + h : "#rota"));
  }
  addEventListener("redePronta", () => {
    const h = location.hash.slice(1);
    if (!/^(de=|para=|rota)/.test(h)) return;
    const pr = {};
    for (const parte of h.split("&")){ const [k, v] = parte.split("="); if ((k === "de" || k === "para") && v){ const l = decodificar(v); if (l) pr[k] = l; } }
    abrir(pr);
  });

  return {html, clique, abrir, sair, R};
})();
