#!/usr/bin/env python3
"""Ônibus do Rio — metrô e trem a partir do OpenStreetMap.

Uso: python3 trilhos.py bruto_overpass.json ../data
Entrada: resultado da consulta trilhos.overpassql (Overpass API, JSON).
Gera trilhos.json com as linhas do MetrôRio e da SuperVia (trajeto e estações em ordem)
e todas as estações servidas por elas.
"""
import json, math, os, sys
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from processar import polyline, simplificar  # mesmas funções do processamento dos ônibus

OPERADORAS = {"metrô rio": "metro", "metrorio": "metro", "supervia": "trem"}
CURTO_METRO = {"1": "L1", "2": "L2", "4": "L4"}


def tipo_de(tags):
    op = (tags.get("operator") or "").lower().replace(" ", "")
    for k, v in OPERADORAS.items():
        if k.replace(" ", "") in op:
            return v
    return None


def dist(a, b):
    la1, lo1 = a; la2, lo2 = b
    k = math.cos(math.radians((la1 + la2) / 2))
    return math.hypot((la1 - la2) * 110540, (lo1 - lo2) * 111320 * k)


def main(entrada, outdir):
    els = json.load(open(entrada, encoding="utf-8"))["elements"]
    nos = {e["id"]: (e["lat"], e["lon"]) for e in els if e["type"] == "node" and "lat" in e}
    vias = {e["id"]: e["nodes"] for e in els if e["type"] == "way" and "nodes" in e}
    rels = {e["id"]: e for e in els if e["type"] == "relation"}

    # estações (nós, vias e relações com centro)
    estacoes = []
    for e in els:
        t = e.get("tags", {})
        if t.get("railway") not in ("station", "halt") or not t.get("name"):
            continue
        if t.get("station") in ("light_rail", "monorail", "funicular") or t.get("tram") == "yes" and t.get("train") != "yes":
            continue
        if "lat" in e:
            c = (e["lat"], e["lon"])
        elif "center" in e:
            c = (e["center"]["lat"], e["center"]["lon"])
        else:
            continue
        modos = set()
        if t.get("station") == "subway" or t.get("subway") == "yes":
            modos.add("metro")
        if t.get("station") == "train" or t.get("train") == "yes" or t.get("railway") == "halt":
            modos.add("trem")
        estacoes.append({"nome": t["name"].strip(), "c": c, "linhas": set(), "modos": modos})

    def estacao_mais_proxima(c, modo, raio=450):
        """Prefere a estação do mesmo modo (metrô ou trem); se não houver, a mais próxima."""
        best, bi = (2, raio), None
        for i, s in enumerate(estacoes):
            d = dist(c, s["c"])
            if d < raio:
                k = (0 if modo in s["modos"] else 1, d)
                if k < best:
                    best, bi = k, i
        return bi

    # agrupa as rotas pelo route_master (ou pela ref + operadora)
    grupos = defaultdict(list)
    mestre_de = {}
    for r in rels.values():
        t = r.get("tags", {})
        if t.get("type") == "route_master":
            for m in r.get("members", []):
                if m["type"] == "relation":
                    mestre_de[m["ref"]] = r
    for r in rels.values():
        t = r.get("tags", {})
        if t.get("type") != "route" or t.get("route") not in ("subway", "train"):
            continue
        tp = tipo_de(t) or (tipo_de(mestre_de[r["id"]].get("tags", {})) if r["id"] in mestre_de else None)
        if not tp:
            continue
        chave = mestre_de[r["id"]]["id"] if r["id"] in mestre_de else ("ref", tp, t.get("ref"))
        grupos[chave].append(r)

    def montar(rel):
        """Junta as vias da relação numa sequência de trechos contínuos (listas de nós)."""
        trechos = []
        for m in rel.get("members", []):
            if m["type"] != "way" or m["ref"] not in vias or m.get("role") in ("platform", "platform_entry_only", "platform_exit_only"):
                continue
            w = list(vias[m["ref"]])
            if trechos:
                a = trechos[-1]
                if a[-1] == w[0]:
                    a.extend(w[1:]); continue
                if a[-1] == w[-1]:
                    a.extend(w[-2::-1]); continue
                if len(trechos) == 1 and a[0] in (w[0], w[-1]):
                    a.reverse()
                    a.extend(w[1:] if a[-1] == w[0] else w[-2::-1]); continue
            trechos.append(w)
        return [[nos[n] for n in t if n in nos] for t in trechos]

    def paradas(rel, modo):
        seq = []
        for m in rel.get("members", []):
            if not (m.get("role") or "").startswith("stop"):
                continue
            c = None
            if m["type"] == "node" and m["ref"] in nos:
                c = nos[m["ref"]]
            if c is None:
                continue
            i = estacao_mais_proxima(c, modo)
            if i is not None and (not seq or seq[-1] != i):
                seq.append(i)
        return seq

    linhas = []
    for chave, rs in grupos.items():
        tags = rels[chave].get("tags", {}) if chave in rels else rs[0].get("tags", {})
        tp = tipo_de(tags) or tipo_de(rs[0].get("tags", {}))
        # sequências por relação; encadeia trechos (ex.: Central→Gramacho + Gramacho→Saracuruna)
        partes = [(paradas(r, tp), montar(r)) for r in rs]
        partes = [p for p in partes if len(p[0]) >= 2]
        if not partes:
            continue
        cadeias = [([*s], [*g]) for s, g in partes]
        mudou = True
        while mudou:
            mudou = False
            for i in range(len(cadeias)):
                for j in range(len(cadeias)):
                    if i != j and cadeias[i][0][-1] == cadeias[j][0][0] and set(cadeias[i][0][:-1]).isdisjoint(cadeias[j][0][1:]):
                        cadeias[i] = (cadeias[i][0] + cadeias[j][0][1:], cadeias[i][1] + cadeias[j][1])
                        del cadeias[j]; mudou = True; break
                if mudou:
                    break
        cadeias.sort(key=lambda c: -len(c[0]))
        ida = cadeias[0]
        # sentido oposto: a maior cadeia que começa onde a ida termina; senão, a ida invertida
        volta = next((c for c in cadeias[1:] if c[0][0] == ida[0][-1]), None)
        if volta is None:
            volta = (ida[0][::-1], [t[::-1] for t in ida[1]][::-1])
        dirs = []
        for seq, geo in (ida, volta):
            enc = [polyline(simplificar(t, 5.0)) for t in geo if len(t) >= 2]
            dirs.append({"h": estacoes[seq[-1]]["nome"], "p": enc, "s": seq})
        for i in set(ida[0]) | set(volta[0]):
            estacoes[i]["linhas"].add(len(linhas))
        ref = (tags.get("ref") or "").strip()
        nome = (tags.get("name") or "").split(":")[0].replace("Metrô Rio", "").replace("Linha", "").strip()
        if tp == "metro":
            n = CURTO_METRO.get(ref, "L" + ref if ref else nome)
        else:
            n = nome or ref
        a, b = estacoes[ida[0][0]]["nome"], estacoes[ida[0][-1]]["nome"]
        linhas.append({
            "n": n, "l": f"{a} – {b}", "t": tp,
            "a": "MetrôRio" if tp == "metro" else "SuperVia",
            "c": (tags.get("colour") or "").upper(), "d": dirs,
            "_ord": (0 if tp == "metro" else 1, n),
        })

    # reordena: metrô (L1, L2, L4) e depois trens; remapeia índices das estações
    ordem = sorted(range(len(linhas)), key=lambda i: linhas[i]["_ord"])
    novo = {old: new for new, old in enumerate(ordem)}
    linhas = [linhas[i] for i in ordem]
    for l in linhas:
        del l["_ord"]
    usadas = [i for i, s in enumerate(estacoes) if s["linhas"]]
    idx = {old: new for new, old in enumerate(usadas)}
    for l in linhas:
        for d in l["d"]:
            d["s"] = [idx[i] for i in d["s"]]
    est = [[estacoes[i]["nome"], round(estacoes[i]["c"][0], 5), round(estacoes[i]["c"][1], 5),
            sorted(novo[x] for x in estacoes[i]["linhas"])] for i in usadas]

    saida = {"gerado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
             "fonte": "© colaboradores do OpenStreetMap (ODbL)", "linhas": linhas, "estacoes": est}
    os.makedirs(outdir, exist_ok=True)
    p = os.path.join(outdir, "trilhos.json")
    tmp = p + ".novo"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    for l in linhas:
        print(f"{l['t']:5} {l['n']:15} {l['l']:45} estações {len(l['d'][0]['s'])}/{len(l['d'][1]['s'])} trechos {len(l['d'][0]['p'])}")
    print(f"estações: {len(est)} | {os.path.getsize(tmp) / 1e3:.0f} kB")
    if not any(l["t"] == "metro" for l in linhas) or not any(l["t"] == "trem" for l in linhas) or len(est) < 80:
        os.remove(tmp)
        sys.exit("faltou metrô ou trem — mantendo o arquivo anterior")
    os.replace(tmp, p)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "data")
