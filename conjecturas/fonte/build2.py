#!/usr/bin/env python3
"""Monta as obras da segunda leva de conjecturas (núcleo v2): cada obra em fonte/obras2/<slug>.html traz só as partes
próprias (<intro>, <painel>, <imagem>, <dica>, <css>, <js>); o molde junta o estilo comum, o núcleo v2 (som, efeitos,
envios, timbres, vídeo e painel padrão) e o banco de configurações. Gera index.html, manifest e sw.js em conjecturas/<slug>/.
Os ícones são fotografados da própria obra por scripts/icones2.py."""
import hashlib, json, os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = next((a[7:] for a in sys.argv[1:] if a.startswith('--repo=')), os.path.join(AQUI, '..', '..'))
DESTINO = os.path.join(REPO, 'conjecturas')
CSS = open(os.path.join(AQUI, 'core.css')).read()
NUCLEO = open(os.path.join(AQUI, 'nucleo2.js')).read()
BANCO = open(os.path.join(AQUI, 'banco.js')).read()

OBRAS2 = {
  # matemática
  'antihydra': ('Antihydra', 'A máquina de Turing que esconde um Collatz: ninguém sabe se ela para'),
  'distancias-de-erdos': ('Distâncias de Erdős', 'Quantos pares de pontos à distância exata 1? Cada ligação é uma nota'),
  'dupla-cobertura': ('Dupla Cobertura', 'Ciclos que passam duas vezes por cada aresta, como linhas de ônibus em polirritmia'),
  'noperthedron': ('Noperthedron', 'O primeiro sólido que não passa por dentro de si mesmo'),
  'musica-dos-primos': ('Música dos Primos', 'Hipótese de Riemann: os zeros da função zeta reconstroem a escada dos primos'),
  'cento-e-noventa-e-seis': ('196', 'Inverter e somar: o número que nunca vira palíndromo'),
  'gilbreath': ('Gilbreath', 'A pirâmide das diferenças entre primos sempre começa com 1'),
  # física
  'sonoluminescencia': ('Sonoluminescência', 'Uma bolha transforma som em luz: o colapso que ninguém explica por inteiro'),
  'de-newton-a-boltzmann': ('De Newton a Boltzmann', 'O 6º problema de Hilbert: bolinhas que, de longe, viram um rio'),
  'fermi-pasta-ulam': ('Fermi–Pasta–Ulam', 'A corda que deveria virar ruído e volta ao começo'),
  'kuramoto': ('Kuramoto', 'Vagalumes desencontrados que entram em fase sozinhos'),
  'tres-corpos': ('Três Corpos', 'A dança em oito de três estrelas, entre a ordem e o caos'),
  # química
  'liesegang': ('Anéis de Liesegang', 'Anéis de precipitado cada vez mais espaçados: um ritardando químico'),
  'belousov-zhabotinsky': ('Belousov–Zhabotinsky', 'O relógio químico: espirais que giram e batem como um coração'),
}

MOLDE = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#000000">
<title>{titulo}</title>
<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icone-192.png"><link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>
{css}
  #panel .sub{{font-size:10.5px;letter-spacing:.12em;opacity:.45;margin:10px 0 2px;text-transform:uppercase}}
  #seq span.o{{white-space:normal;display:inline}}
  .hud{{text-shadow:0 0 8px #000,0 0 3px #000,0 0 1px #000}}
{css_obra}
</style>
</head>
<body>
<canvas id="cv"></canvas>
<div id="num" class="hud"></div><div id="op" class="hud"></div><div id="seq" class="hud"></div>
<div id="start"><h1>{titulo_maiusc}</h1><p>toque para começar</p>
  <p class="sub">{intro}</p></div>
<div id="dot" title="Controles (M)"></div>
<div id="panel">
{painel}
<div id="nucleo"></div>
{imagem}
<div id="nucleoVideo"></div>
<div class="hint">{dica}<br>Teclas: M controles · F tela cheia · T texto · R recomeçar · 1–9 configurações salvas · 0 padrão.</div>
</div>
<script>
(() => {{
'use strict';
{nucleo}
{js}
}})();
</script>
<script>
{banco}
</script>
</body>
</html>
"""

def parte(src, nome):
    m = re.search(r'<' + nome + r'>(.*?)</' + nome + r'>', src, re.S)
    return m.group(1).strip('\n') if m else ''

def main():
    so = [a for a in sys.argv[1:] if not a.startswith('-') and a in OBRAS2]
    for slug, (nome, desc) in OBRAS2.items():
        if so and slug not in so: continue
        arq = os.path.join(AQUI, 'obras2', slug + '.html')
        if not os.path.exists(arq): continue
        src = open(arq).read()
        html = MOLDE.format(titulo=nome, titulo_maiusc=nome.upper(), intro=parte(src, 'intro'), css=CSS, css_obra=parte(src, 'css'),
                            painel=parte(src, 'painel'), imagem=parte(src, 'imagem'), dica=parte(src, 'dica'),
                            nucleo=NUCLEO, js=parte(src, 'js'), banco=BANCO)
        pasta = os.path.join(DESTINO, slug); os.makedirs(pasta, exist_ok=True)
        open(os.path.join(pasta, 'index.html'), 'w').write(html)
        man = {"name": nome, "short_name": nome, "description": desc, "lang": "pt-BR", "start_url": "./", "scope": "./",
               "display": "standalone", "orientation": "any", "background_color": "#000000", "theme_color": "#000000",
               "icons": [{"src": "apple-touch-icon.png", "sizes": "180x180", "type": "image/png"},
                         {"src": "icone-192.png", "sizes": "192x192", "type": "image/png"},
                         {"src": "icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]}
        open(os.path.join(pasta, 'manifest.webmanifest'), 'w').write(json.dumps(man, ensure_ascii=False, indent=2) + '\n')
        ver = hashlib.md5(html.encode()).hexdigest()[:8]
        sw = f"""// guarda a obra no aparelho para abrir sem internet (a página é atualizada sempre que houver rede)
const CACHE = '{slug}-{ver}';
const ARQS = ['./', 'index.html', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', (e) => {{ e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQS))); self.skipWaiting(); }});
self.addEventListener('activate', (e) => {{ e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); }});
self.addEventListener('fetch', (e) => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => {{ const c = r.clone(); if (r.ok && new URL(e.request.url).origin === location.origin) caches.open(CACHE).then((k) => k.put(e.request, c)); return r; }})
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
}});
"""
        open(os.path.join(pasta, 'sw.js'), 'w').write(sw)
        print('ok', slug)

if __name__ == '__main__':
    main()
