#!/usr/bin/env python3
"""Ônibus do Rio — converte o GTFS oficial da SMTR em dados compactos para o mapa.

Uso: python3 processar.py gtfs.zip ../data

Gera:
  rede.json  — linhas (com trajetos de ida e volta e a sequência de pontos),
               pontos (nome, coordenadas, linhas que passam) e metadados.
Só usa a biblioteca padrão do Python, para rodar em qualquer lugar (GitHub Actions).
"""
import csv, io, json, math, os, sys, zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone


def ler(z, nome):
    if nome not in z.namelist():
        return
    with z.open(nome) as f:
        r = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
        for row in r:
            yield {k.strip(): (v or "").strip() for k, v in row.items() if k}


# ---------- geometria ----------
def dp(pts, tol):
    """Douglas-Peucker (pts em metros projetados localmente)."""
    if len(pts) < 3:
        return list(range(len(pts)))
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > best:
                best, bi = d, i
        if best > tol * tol:
            keep[bi] = True
            stack.append((a, bi)); stack.append((bi, b))
    return [i for i, k in enumerate(keep) if k]


def simplificar(latlon, tol=6.0):
    lat0 = math.radians(-22.9)
    kx = 111320 * math.cos(lat0); ky = 110540
    proj = [(lo * kx, la * ky) for la, lo in latlon]
    return [latlon[i] for i in dp(proj, tol)]


def polyline(latlon):
    """Google encoded polyline, precisão 1e-5."""
    out, plat, plon = [], 0, 0
    for la, lo in latlon:
        ila, ilo = int(round(la * 1e5)), int(round(lo * 1e5))
        for v in (ila - plat, ilo - plon):
            v = ~(v << 1) if v < 0 else (v << 1)
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1F)) + 63)); v >>= 5
            out.append(chr(v + 63))
        plat, plon = ila, ilo
    return "".join(out)


def bairro_ok(s):
    return s.replace("  ", " ").strip()


def main(zpath, outdir):
    z = zipfile.ZipFile(zpath)
    os.makedirs(outdir, exist_ok=True)

    feed = next(ler(z, "feed_info.txt"), {}) or {}
    agencias = {a["agency_id"]: a["agency_name"] for a in ler(z, "agency.txt")}

    # tarifas
    preco_fare = {f["fare_id"]: float(f["price"] or 0) for f in ler(z, "fare_attributes.txt")}
    tarifa_rota = {}
    for fr in ler(z, "fare_rules.txt"):
        if fr.get("route_id") and fr.get("fare_id") in preco_fare:
            tarifa_rota[fr["route_id"]] = preco_fare[fr["fare_id"]]

    rotas = {r["route_id"]: r for r in ler(z, "routes.txt")}

    # viagens
    trips = {}
    cont = Counter()  # (route, dir, shape, regular?) -> nº de viagens
    for t in ler(z, "trips.txt"):
        if t["route_id"] not in rotas:
            continue
        sid = t.get("service_id", "")
        reg = 0 if ("OBRA" in sid or "DESAT" in sid) else 1
        d = t.get("direction_id") or "0"
        trips[t["trip_id"]] = (t["route_id"], d, t.get("shape_id", ""), t.get("trip_headsign", ""), sid)
        cont[(t["route_id"], d, t.get("shape_id", ""), reg)] += 1

    # trajeto representativo por (linha, sentido): o shape com mais viagens regulares
    melhor = {}
    for (rid, d, sh, reg), n in cont.items():
        k = (rid, d)
        score = (reg, n)
        if k not in melhor or score > melhor[k][0]:
            melhor[k] = (score, sh)
    shape_escolhido = {k: v[1] for k, v in melhor.items()}
    shapes_usados = set(shape_escolhido.values())

    # intervalo (headway) mínimo em dias úteis
    headway = {}
    for f in ler(z, "frequencies.txt"):
        t = trips.get(f["trip_id"])
        if not t or not t[4].startswith("U"):
            continue
        try:
            h = int(f["headway_secs"])
        except ValueError:
            continue
        if h > 0:
            headway[t[0]] = min(headway.get(t[0], 10 ** 9), h)

    # paradas por viagem (só guarda a sequência das viagens candidatas)
    stop_rotas = defaultdict(set)
    seqs = defaultdict(list)
    cand = {tid for tid, t in trips.items() if shape_escolhido.get((t[0], t[1])) == t[2]}
    for st in ler(z, "stop_times.txt"):
        tid = st["trip_id"]
        t = trips.get(tid)
        if not t:
            continue
        stop_rotas[st["stop_id"]].add(t[0])
        if tid in cand:
            try:
                seqs[tid].append((int(st["stop_sequence"]), st["stop_id"]))
            except ValueError:
                pass
    # escolhe, por (linha, sentido), a viagem candidata com mais paradas
    rep = {}
    for tid, s in seqs.items():
        t = trips[tid]
        k = (t[0], t[1])
        if k not in rep or len(s) > len(seqs[rep[k]]):
            rep[k] = tid

    # pontos
    paradas = {}
    estacao = {}
    for s in ler(z, "stops.txt"):
        try:
            paradas[s["stop_id"]] = (bairro_ok(s["stop_name"]), float(s["stop_lat"]), float(s["stop_lon"]))
        except (ValueError, KeyError):
            continue
        if s.get("parent_station"):
            estacao[s["stop_id"]] = s["parent_station"]

    # shapes
    pts = defaultdict(list)
    for p in ler(z, "shapes.txt"):
        if p["shape_id"] in shapes_usados:
            pts[p["shape_id"]].append((int(float(p["shape_pt_sequence"])), float(p["shape_pt_lat"]), float(p["shape_pt_lon"])))
    shape_enc = {}
    for sh, l in pts.items():
        l.sort()
        shape_enc[sh] = polyline(simplificar([(a, b) for _, a, b in l]))

    # índices
    usadas = sorted(sid for sid in stop_rotas if sid in paradas)
    idx_parada = {sid: i for i, sid in enumerate(usadas)}

    def chave_ordem(r):
        n = r["route_short_name"]
        dig = "".join(c for c in n if c.isdigit())
        return (int(dig) if dig else 99999, n)

    lista_rotas = sorted((r for rid, r in rotas.items() if any((rid, d) in shape_escolhido for d in "01")), key=chave_ordem)
    idx_rota = {r["route_id"]: i for i, r in enumerate(lista_rotas)}

    def tipo(r):
        t = r.get("route_type", "")
        if t == "702":
            return "brt"
        if t == "200":
            return "exec"
        if t == "0":
            return "vlt"
        return "bus"

    linhas = []
    for r in lista_rotas:
        rid = r["route_id"]
        dirs = []
        for d in "01":
            if (rid, d) not in shape_escolhido:
                continue
            sh = shape_escolhido[(rid, d)]
            tid = rep.get((rid, d))
            seq = [idx_parada[s] for _, s in sorted(seqs.get(tid, []))] if tid else []
            seq = [i for i in seq if i is not None]
            head = trips[tid][3] if tid else ""
            if not head:
                head = next((t[3] for t in trips.values() if t[0] == rid and t[1] == d and t[3]), "")
            dirs.append({"h": head, "p": shape_enc.get(sh, ""), "s": seq})
        cor = (r.get("route_color") or "").strip()
        item = {
            "n": r["route_short_name"],
            "l": r["route_long_name"],
            "t": tipo(r),
            "a": agencias.get(r.get("agency_id", ""), ""),
            "c": ("#" + cor) if cor else "",
            "d": dirs,
        }
        if rid in tarifa_rota:
            item["$"] = tarifa_rota[rid]
        if rid in headway:
            item["i"] = round(headway[rid] / 60)
        linhas.append(item)

    pontos = []
    for sid in usadas:
        nome, la, lo = paradas[sid]
        rs = sorted(idx_rota[r] for r in stop_rotas[sid] if r in idx_rota)
        p = [nome, round(la, 5), round(lo, 5), rs]
        if sid in estacao:
            p.append(1)
        pontos.append(p)

    rede = {
        "gerado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "feed": {
            "inicio": feed.get("feed_start_date", ""),
            "fim": feed.get("feed_end_date", ""),
            "versao": feed.get("feed_version", ""),
            "fonte": "Secretaria Municipal de Transportes (SMTR) — GTFS do Rio de Janeiro, data.rio",
        },
        "linhas": linhas,
        "pontos": pontos,
    }
    with open(os.path.join(outdir, "rede.json"), "w", encoding="utf-8") as f:
        json.dump(rede, f, ensure_ascii=False, separators=(",", ":"))
    tipos = Counter(l["t"] for l in linhas)
    print(f"linhas: {len(linhas)} {dict(tipos)} | pontos: {len(pontos)} | "
          f"tamanho: {os.path.getsize(os.path.join(outdir, 'rede.json')) / 1e6:.1f} MB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "data")
