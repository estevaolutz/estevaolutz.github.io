#!/usr/bin/env python3
"""Ônibus do Rio — bairros.

Uso: python3 bairros.py [bairros_overpass.json] ../data
Lê os limites dos 165 bairros do Rio (OpenStreetMap, admin_level=10) e diz em que bairro fica
cada ponto de ônibus (rede.json) e cada estação (trilhos.json). Gera bairros.json.
Se o arquivo do Overpass não vier (servidor fora do ar), reaproveita os limites do bairros.json anterior.
"""
import json, os, sys, unicodedata
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from processar import polyline, simplificar

ZONAS = {
    "Centro": "Saúde|Gamboa|Santo Cristo|Caju|Centro|Lapa|Catumbi|Rio Comprido|Cidade Nova|Estácio|São Cristóvão|Mangueira|Benfica|Vasco da Gama|Paquetá|Santa Teresa",
    "Zona Sul": "Flamengo|Glória|Laranjeiras|Catete|Cosme Velho|Botafogo|Humaitá|Urca|Leme|Copacabana|Ipanema|Leblon|Lagoa|Jardim Botânico|Gávea|Vidigal|São Conrado|Rocinha",
    "Grande Tijuca": "Praça da Bandeira|Tijuca|Alto da Boa Vista|Maracanã|Vila Isabel|Andaraí|Grajaú",
    "Barra e Jacarepaguá": "Jacarepaguá|Anil|Gardênia Azul|Curicica|Freguesia (Jacarepaguá)|Pechincha|Taquara|Tanque|Praça Seca|Vila Valqueire|Cidade de Deus|Joá|Itanhangá|Barra da Tijuca|Camorim|Vargem Pequena|Vargem Grande|Recreio dos Bandeirantes|Grumari|Barra Olímpica",
    "Zona Oeste": "Deodoro|Vila Militar|Campo dos Afonsos|Jardim Sulacap|Magalhães Bastos|Realengo|Padre Miguel|Bangu|Senador Camará|Gericinó|Santíssimo|Campo Grande|Senador Vasconcelos|Inhoaíba|Cosmos|Paciência|Santa Cruz|Sepetiba|Guaratiba|Barra de Guaratiba|Pedra de Guaratiba|Vila Kennedy",
    "Ilha do Governador": "Ribeira|Zumbi|Cacuia|Pitangueiras|Praia da Bandeira|Cocotá|Bancários|Freguesia (Ilha)|Jardim Guanabara|Jardim Carioca|Tauá|Moneró|Portuguesa|Galeão|Cidade Universitária",
}
ZONA_DE = {}
for z, nomes in ZONAS.items():
    for n in nomes.split("|"):
        ZONA_DE[n] = z


def chave_alfa(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


def decodificar(s):
    pts, i, lat, lon = [], 0, 0, 0
    while i < len(s):
        vals = []
        for _ in range(2):
            res = sh = 0
            while True:
                b = ord(s[i]) - 63; i += 1
                res |= (b & 31) << sh; sh += 5
                if b < 32:
                    break
            vals.append(~(res >> 1) if res & 1 else res >> 1)
        lat += vals[0]; lon += vals[1]
        pts.append((lat / 1e5, lon / 1e5))
    return pts


def aneis_da_relacao(rel):
    """Junta as vias (com geometria) da relação em anéis fechados."""
    segs = [[(p["lat"], p["lon"]) for p in m["geometry"]] for m in rel.get("members", [])
            if m["type"] == "way" and m.get("geometry") and m.get("role") in ("outer", "inner", "")]
    aneis = []
    while segs:
        anel = segs.pop(0)
        mudou = True
        while anel[0] != anel[-1] and mudou:
            mudou = False
            for k, s in enumerate(segs):
                if s[0] == anel[-1]:
                    anel += s[1:]
                elif s[-1] == anel[-1]:
                    anel += s[-2::-1]
                elif s[-1] == anel[0]:
                    anel = s[:-1] + anel
                elif s[0] == anel[0]:
                    anel = s[::-1][:-1] + anel
                else:
                    continue
                segs.pop(k); mudou = True
                break
        if len(anel) >= 4:
            aneis.append(anel)
    return aneis


def dentro(lat, lon, aneis):
    """Par-ou-ímpar sobre todos os anéis (buracos funcionam sozinhos)."""
    d = False
    for a in aneis:
        j = len(a) - 1
        for i in range(len(a)):
            yi, xi = a[i]; yj, xj = a[j]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                d = not d
            j = i
    return d


def main(args):
    outdir = args[-1]
    bruto = args[0] if len(args) > 1 else None
    bairros = []
    try:
        els = json.load(open(bruto, encoding="utf-8"))["elements"] if bruto else []
    except (OSError, ValueError, KeyError):
        els = []
    for e in els:
        t = e.get("tags", {})
        if e["type"] != "relation" or t.get("admin_level") != "10" or not t.get("name"):
            continue
        aneis = aneis_da_relacao(e)
        if aneis:
            bairros.append({"n": t["name"].strip(), "aneis": aneis})
    anterior = os.path.join(outdir, "bairros.json")
    if len(bairros) < 150:
        if not os.path.exists(anterior):
            sys.exit("sem limites de bairros")
        print(f"Overpass sem bairros ({len(bairros)}); reaproveitando os limites anteriores")
        velho = json.load(open(anterior, encoding="utf-8"))
        bairros = [{"n": b["n"], "aneis": [decodificar(p) for p in b["p"]]} for b in velho["bairros"]]
    bairros.sort(key=lambda b: chave_alfa(b["n"]))
    for b in bairros:
        las = [p[0] for a in b["aneis"] for p in a]; los = [p[1] for a in b["aneis"] for p in a]
        b["bbox"] = (min(las), min(los), max(las), max(los))

    def onde_exato(lat, lon):
        for i, b in enumerate(bairros):
            a, o, A, O = b["bbox"]
            if a <= lat <= A and o <= lon <= O and dentro(lat, lon, b["aneis"]):
                return i
        return -1

    def onde(lat, lon):
        # pontos na beira (cais, divisa simplificada): tenta deslocar até ~60 m
        i = onde_exato(lat, lon)
        k = 0.0003
        for dla, dlo in ((k, 0), (-k, 0), (0, k), (0, -k), (2*k, 0), (-2*k, 0), (0, 2*k), (0, -2*k)):
            if i >= 0:
                break
            i = onde_exato(lat + dla, lon + dlo)
        return i

    rede = json.load(open(os.path.join(outdir, "rede.json"), encoding="utf-8"))
    tr_path = os.path.join(outdir, "trilhos.json")
    trilhos = json.load(open(tr_path, encoding="utf-8")) if os.path.exists(tr_path) else {"estacoes": []}
    pts = [onde(p[1], p[2]) for p in rede["pontos"]]
    est = [onde(e[1], e[2]) for e in trilhos["estacoes"]]

    saida = {
        "gerado": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "fonte": "Limites de bairros: © colaboradores do OpenStreetMap (ODbL)",
        "np": len(pts), "ne": len(est),
        "bairros": [],
        "pontos": pts, "estacoes": est,
    }
    for b in bairros:
        # ponto para o rótulo: média do maior anel
        maior = max(b["aneis"], key=len)
        c = (round(sum(p[0] for p in maior) / len(maior), 5), round(sum(p[1] for p in maior) / len(maior), 5))
        saida["bairros"].append({"n": b["n"], "z": ZONA_DE.get(b["n"], "Zona Norte"), "c": c,
                                 "p": [polyline(simplificar(a, 12.0)) for a in b["aneis"]]})
    with open(anterior, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, separators=(",", ":"))
    fora = sum(1 for x in pts if x < 0)
    print(f"bairros: {len(bairros)} | pontos fora da cidade: {fora}/{len(pts)} | estações fora: {sum(1 for x in est if x < 0)}/{len(est)} | "
          f"{os.path.getsize(anterior) / 1e3:.0f} kB")


if __name__ == "__main__":
    main(sys.argv[1:])
