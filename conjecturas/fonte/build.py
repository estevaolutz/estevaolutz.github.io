#!/usr/bin/env python3
"""Monta as páginas das obras de conjecturas: junta o núcleo comum (som, painel, estilo) a cada obra
e gera manifest, sw.js e ícones na pasta de cada uma dentro do repositório."""
import hashlib, json, math, os, sys, random
from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, '..', '..')
DESTINO = os.path.join(REPO, 'conjecturas')  # cada obra fica em conjecturas/<obra>/
CSS = open(os.path.join(AQUI, 'core.css')).read()
JS = open(os.path.join(AQUI, 'core.js')).read()
SOM = open(os.path.join(AQUI, 'som.html')).read()

OBRAS = {
  'corredor-solitario': ('Corredor Solitário', 'A conjectura do corredor solitário em polirritmia e luz'),
  'formiga-de-langton': ('Formiga de Langton', 'Do caos à rodovia: a formiga de Langton em som e luz'),
  'recaman': ('Recamán', 'A sequência de Recamán: para trás se puder, para a frente se não'),
  'kolakoski': ('Kolakoski', 'Uma sequência que descreve a si mesma, em cânone rítmico'),
  'cometa-de-goldbach': ('Cometa de Goldbach', 'Todo par é soma de dois primos: cada número vira um acorde'),
}

def icone(slug, size):
    S = size * 4
    im = Image.new('RGB', (S, S), (0, 0, 0))
    d = ImageDraw.Draw(im)
    c = S / 2
    w = max(2, S // 110)
    if slug == 'corredor-solitario':
        for i, r in enumerate([0.18, 0.26, 0.34, 0.42]):
            R = r * S
            d.ellipse([c-R, c-R, c+R, c+R], outline=(60, 80, 100), width=w)
            a = [0.3, 2.1, 4.0, 5.3][i]
            x, y = c + R*math.cos(a), c + R*math.sin(a)
            col = (230, 245, 255) if i == 2 else (140, 180, 215)
            rr = S*0.03 if i == 2 else S*0.018
            d.ellipse([x-rr, y-rr, x+rr, y+rr], fill=col)
    elif slug == 'formiga-de-langton':
        n = 26; cs = S*0.8/n; o = S*0.1
        random.seed(3)
        for i in range(n):
            for j in range(n):
                diag = abs((i - j) - 4) < 3 and i > n*0.45
                blob = (i-n*0.35)**2 + (j-n*0.4)**2 < 40 and random.random() < 0.5
                if diag and (i + 2*j) % 3 == 0 or blob:
                    d.rectangle([o+i*cs, o+j*cs, o+(i+1)*cs-2, o+(j+1)*cs-2], fill=(150, 190, 225))
    elif slug == 'recaman':
        seq = [0]; seen = {0}
        for n in range(1, 60):
            p = seq[-1] - n
            if p > 0 and p not in seen: seq.append(p)
            else: seq.append(seq[-1] + n)
            seen.add(seq[-1])
        mx = max(seq); sc = S*0.84/mx; o = S*0.08
        for n in range(1, len(seq)):
            a, b = seq[n-1], seq[n]
            x0, x1 = o + min(a, b)*sc, o + max(a, b)*sc
            r = (x1 - x0)/2
            box = [x0, c - r, x1, c + r]
            hue = (120 + n*3) % 255
            d.arc(box, 180 if n % 2 else 0, 360 if n % 2 else 180, fill=(140+n, 190, 230), width=w)
    elif slug == 'kolakoski':
        k = [1, 2, 2]; i = 2
        while len(k) < 400:
            v = 1 if len(k) % 2 == 0 else 2
            k += [v] * k[i]; i += 1
        rows = 6; o = S*0.1; hh = S*0.8/rows
        for r in range(rows):
            x = o; scale = 1.5 ** r; idx = 0
            seq = k
            while x < S - o and idx < len(seq):
                ww = seq[idx] * S*0.012 * scale
                col = (220, 235, 250) if seq[idx] == 1 else (110, 150, 200)
                d.rectangle([x, o + (rows-1-r)*hh, min(S-o, x+ww-3), o + (rows-1-r)*hh + hh - 6], fill=col)
                x += ww; idx += 1
    elif slug == 'cometa-de-goldbach':
        N = 1400
        sieve = [True]*(N+1); sieve[0] = sieve[1] = False
        for p in range(2, int(N**0.5)+1):
            if sieve[p]:
                for q in range(p*p, N+1, p): sieve[q] = False
        g = {}
        for E in range(4, N+1, 2):
            g[E] = sum(1 for p in range(2, E//2+1) if sieve[p] and sieve[E-p])
        mg = max(g.values()); o = S*0.1
        for E, v in g.items():
            x = o + E/N*S*0.8; y = S - o - v/mg*S*0.8
            col = [(120, 170, 220), (200, 225, 250), (90, 130, 190)][E % 3]
            rr = S*0.004
            d.ellipse([x-rr, y-rr, x+rr, y+rr], fill=col)
    im = im.resize((size, size), Image.LANCZOS)
    return im

def main():
    for slug, (nome, desc) in OBRAS.items():
        if not os.path.exists(os.path.join(AQUI, slug + '.html')): continue
        src = open(os.path.join(AQUI, slug + '.html')).read()
        html = src.replace('/*CORE_CSS*/', CSS).replace('<!--SOM-->', SOM).replace('//CORE_JS', JS)
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
        for nomeArq, sz in [('icone-512.png', 512), ('icone-192.png', 192), ('apple-touch-icon.png', 180)]:
            p = os.path.join(pasta, nomeArq)
            if not os.path.exists(p) or '--icones' in sys.argv:
                icone(slug, sz).save(p, optimize=True)
        print('ok', slug)

if __name__ == '__main__':
    main()
