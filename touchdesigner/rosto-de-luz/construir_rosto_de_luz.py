# =====================================================================
#  ROSTO DE LUZ v2 — construtor da rede no TouchDesigner
#  Rosto + mãos em pontos de luz · efeitos pelo som · MIDI do Moog Sub Phatty
#
#  Como usar:
#    1. No TouchDesigner, crie um Text DAT em /project1.
#    2. Cole este arquivo inteiro nele.
#    3. Botão direito no Text DAT → Run Script.
#  (ou no Textport:  exec(open('/caminho/construir_rosto_de_luz.py').read()) )
#
#  O script cria o componente /project1/rosto_de_luz_v2 com tudo dentro.
#  Rodar de novo apaga e reconstrói só o rosto_de_luz_v2.
# =====================================================================

DESTINO = '/project1'
NOME = 'rosto_de_luz_v2'
PORTA = 9980

avisos = []


def setp(o, nome, valor):
    p = getattr(o.par, nome, None)
    if p is None:
        avisos.append('%s: parâmetro "%s" não existe' % (o.name, nome))
        return
    try:
        p.val = valor
    except Exception as e:
        avisos.append('%s.%s: %s' % (o.name, nome, e))


def setexpr(o, nome, e):
    p = getattr(o.par, nome, None)
    if p is None:
        avisos.append('%s: parâmetro "%s" não existe' % (o.name, nome))
        return
    try:
        p.expr = e
        p.mode = ParMode.EXPRESSION
    except Exception as ex:
        avisos.append('%s.%s: %s' % (o.name, nome, ex))


def lig(dst, idx, src):
    try:
        dst.inputConnectors[idx].connect(src)
    except Exception as e:
        avisos.append('ligar %s → %s[%d]: %s' % (src.name, dst.name, idx, e))


def pos(o, x, y):
    o.nodeX = x * 200
    o.nodeY = -y * 150


# ---------------------------------------------------------------------
#  Código: rastreador (página web com MediaPipe, servida pelo próprio TD)
# ---------------------------------------------------------------------
RASTREADOR_HTML = r'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Rastreador · Rosto de Luz</title>
<style>
 body{margin:0;background:#000;color:#8fa3b8;font:13px system-ui,sans-serif}
 video{width:360px;transform:scaleX(-1);opacity:.55;display:block}
 #s{padding:8px 10px;white-space:pre-line}
</style></head>
<body>
<video id="v" autoplay playsinline muted></video>
<div id="s">Iniciando o rastreador…</div>
<script type="module">
const st = document.getElementById('s'), v = document.getElementById('v');
const q = new URLSearchParams(location.search);
const wsUrl = q.get('ws') || ('ws://' + (location.host || 'localhost:9980'));
let ws = null, conectado = false;
function conectar(){
  try { ws = new WebSocket(wsUrl); } catch(e) { setTimeout(conectar, 1500); return; }
  ws.onopen = () => { conectado = true; };
  ws.onclose = () => { conectado = false; setTimeout(conectar, 1500); };
  ws.onerror = () => {};
}
conectar();
try {
  const V = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const { FilesetResolver, FaceLandmarker, HandLandmarker } = await import(V + '/vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks(V + '/wasm');
  const M = 'https://storage.googleapis.com/mediapipe-models/';
  const face = await FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: M + 'face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO', numFaces: 1 });
  const hands = await HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: M + 'hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO', numHands: 2 });
  let constraints = { width: 1280, height: 720 };
  const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
  const cam = q.get('cam');
  if (cam !== null && devs[+cam]) constraints.deviceId = { exact: devs[+cam].deviceId };
  const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
  v.srcObject = stream; await v.play();
  const lista = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')
    .map((d, i) => i + ': ' + (d.label || 'câmera ' + i)).join('\n');
  const flat = (lms) => { const o = new Array(lms.length * 3);
    for (let i = 0; i < lms.length; i++) { o[i*3] = +(1 - lms[i].x).toFixed(4); o[i*3+1] = +lms[i].y.toFixed(4); o[i*3+2] = +lms[i].z.toFixed(4); }
    return o; };
  let ultimo = -1, n = 0, t0 = performance.now(), fps = 0, nf = 0, nh = 0;
  function loop(){
    const agora = performance.now();
    if (v.readyState >= 2 && v.currentTime !== ultimo) {
      ultimo = v.currentTime;
      const fr = face.detectForVideo(v, agora);
      const hr = hands.detectForVideo(v, agora);
      const f = fr.faceLandmarks && fr.faceLandmarks[0] ? flat(fr.faceLandmarks[0]) : null;
      const h = (hr.landmarks || []).map(flat);
      nf = f ? 1 : 0; nh = h.length;
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ a: v.videoWidth / v.videoHeight, f, h }));
      n++;
    }
    if (agora - t0 > 1000) { fps = n; n = 0; t0 = agora;
      st.textContent = (conectado ? 'Conectado ao TouchDesigner' : 'Procurando o TouchDesigner em ' + wsUrl + '…') +
        '\n' + fps + ' quadros/s · rosto: ' + (nf ? 'sim' : 'não') + ' · mãos: ' + nh +
        '\nCâmeras (use ?cam=N no endereço para trocar):\n' + lista; }
    requestAnimationFrame(loop);
  }
  loop();
} catch (e) {
  st.textContent = 'Erro no rastreador: ' + (e && e.message ? e.message : e) +
    '\nSe for a câmera, abra este endereço no Chrome: http://localhost:9980';
}
</script>
</body></html>
'''

# ---------------------------------------------------------------------
#  Código: servidor web (recebe os pontos do rosto e das mãos)
# ---------------------------------------------------------------------
SERVIDOR_PY = r'''# Servidor do Rosto de Luz: entrega a página do rastreador e recebe os pontos por WebSocket
import json

def onHTTPRequest(webServerDAT, request, response):
    uri = str(request.get('uri', '/')).split('?')[0]
    if uri in ('/', '/index.html', '/rastreador'):
        response['statusCode'] = 200
        response['statusReason'] = 'OK'
        response['Content-Type'] = 'text/html; charset=utf-8'
        response['data'] = op('rastreador_html').text
    else:
        response['statusCode'] = 404
        response['statusReason'] = 'Not Found'
        response['data'] = ''
    return response

def onWebSocketOpen(webServerDAT, client, uri):
    return

def onWebSocketClose(webServerDAT, client):
    return

def onWebSocketReceiveText(webServerDAT, client, data):
    try:
        d = json.loads(data)
    except Exception:
        return
    d['t'] = absTime.seconds
    parent().store('lm', d)
    return

def onWebSocketReceiveBinary(webServerDAT, client, data):
    return

def onWebSocketReceivePing(webServerDAT, client, data):
    try:
        webServerDAT.webSocketSendPong(client, data=data)
    except Exception:
        pass
    return

def onWebSocketReceivePong(webServerDAT, client, data):
    return

def onServerStart(webServerDAT):
    return

def onServerStop(webServerDAT):
    return
'''

# ---------------------------------------------------------------------
#  Código: MIDI do Sub Phatty → parâmetros
# ---------------------------------------------------------------------
MIDI_PY = r'''# MIDI do Moog Sub Phatty → efeitos do Rosto de Luz
# Cada botão (CC) move um parâmetro do painel; as notas disparam explosões.
CC = {
    19: 'Cor',          # Corte do filtro      → cor
    21: 'Faisca',       # Ressonância          → faíscas
    22: 'Explosao',     # Quant. do EG         → força da explosão das notas
    18: 'Dispersao',    # Multidrive           → dispersão
    3:  'Ondafreq',     # Taxa do LFO          → velocidade da ondulação
    4:  'Ondaamp',      # Mod. de altura       → amplitude da ondulação
    2:  'Liquido',      # Mod. do filtro       → imagem líquida
    15: 'Brilhorosto',  # Nível Osc 1          → brilho do rosto
    16: 'Brilhomaos',   # Nível Osc 2          → brilho das mãos
    17: 'Rastro',       # Nível Sub            → rastro
    8:  'Granulado',    # Ruído                → granulado
    5:  'Suavizacao',   # Glide                → suavização do movimento
    26: 'Retorno',      # Relaxamento do filtro → retorno após explosão
    9:  'Tamanho',      # Onda Osc 1           → tamanho dos pontos
    14: 'Saturacao',    # Onda Osc 2           → saturação
    12: 'Gradiente',    # Afinação Osc 2       → gradiente de cor
    13: 'Respira',      # Batimento Osc 2      → respiração com o som
    7:  'Brilho',       # Volume               → brilho geral
    1:  'Glow',         # Roda de modulação    → brilho difuso (glow)
}

def _par(nome, v01):
    p = getattr(parent().par, nome, None)
    if p is None:
        return
    p.val = p.normMin + (p.normMax - p.normMin) * max(0.0, min(1.0, v01))

def _v127(x):
    try:
        x = float(x)
    except Exception:
        return 0.0
    return x * 127.0 if 0.0 < x <= 1.0 and not float(x).is_integer() else x

def onReceiveMIDI(dat, rowIndex, message, channel, index, value, input=None, bytes=None, *args):
    C = parent()
    if not C.par.Midiativo.eval():
        return
    try:
        bb = [int(b) for b in bytes] if bytes is not None else []
    except Exception:
        bb = []
    st = (bb[0] & 0xF0) if bb else None
    m = str(message or '').lower().replace(' ', '')
    if st == 0x90 or (st is None and m.startswith('noteon')):
        nota = bb[1] if len(bb) > 1 else int(_v127(index))
        vel = bb[2] if len(bb) > 2 else _v127(value)
        if vel > 0:
            lst = C.fetch('notas', None, storeDefault=False) or []
            lst.append((vel / 127.0, int(nota)))
            C.store('notas', lst[-16:])
        return
    if st == 0xB0 or (st is None and m.startswith('control')):
        cc = bb[1] if len(bb) > 1 else int(_v127(index))
        val = bb[2] if len(bb) > 2 else _v127(value)
        if cc in CC:
            _par(CC[cc], val / 127.0)
        return
    if st == 0xE0 or (st is None and m.startswith('pitch')):
        if len(bb) > 2:
            b = ((bb[2] << 7) | bb[1]) - 8192
            C.store('bend', b / 8192.0)
        else:
            x = float(value)
            C.store('bend', (x - 8192) / 8192.0 if abs(x) > 2 else x)
        return
    return
'''

# ---------------------------------------------------------------------
#  Código: pontos de luz (Script CHOP) — rosto, mãos, som e MIDI
# ---------------------------------------------------------------------
PONTOS_PY = r'''# Rosto de Luz — gera os pontos do rosto e das mãos e aplica os efeitos do som e do MIDI
import numpy as np
import math

BONES = np.array([(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(7,8),(5,9),(9,10),(10,11),(11,12),
                  (9,13),(13,14),(14,15),(15,16),(13,17),(17,18),(18,19),(19,20),(0,17)], dtype=np.int64)
PALM = np.array([(0,1,5),(0,5,9),(0,9,13),(0,13,17)], dtype=np.int64)
S = {'waves': []}


def pv(nome, d=0.0):
    try:
        return float(getattr(parent().par, nome).eval())
    except Exception:
        return d


def bary(n, rng):
    r1 = np.sqrt(rng.random(n)); r2 = rng.random(n)
    return np.stack([1 - r1, r1 * (1 - r2), r1 * r2], 1)


def hsv2rgb(h, s, v):
    h = np.mod(h, 1.0) * 6.0
    i = np.floor(h).astype(np.int64) % 6
    f = h - np.floor(h)
    s = np.clip(s, 0, 1)
    v = np.asarray(v, dtype=np.float64) * np.ones_like(h)
    p = v * (1 - s); q = v * (1 - s * f); t = v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return r, g, b


def face_tris(P2):
    # malha aproximada do rosto: triângulos entre vizinhos próximos dos 478 pontos do MediaPipe
    d = ((P2[:, None, :] - P2[None, :, :]) ** 2).sum(-1)
    np.fill_diagonal(d, np.inf)
    nn = np.argsort(d, axis=1)[:, :7]
    tris = set()
    for i in range(len(P2)):
        ns = nn[i]
        for a in range(len(ns)):
            for b in range(a + 1, len(ns)):
                j, k = int(ns[a]), int(ns[b])
                if d[j, k] <= 2.2 * max(d[i, j], d[i, k]):
                    tris.add(tuple(sorted((i, j, k))))
    return np.array(sorted(tris), dtype=np.int64)


def preparar(nf, nh):
    rng = np.random.default_rng(7)
    S['nf'], S['nh'] = nf, nh
    S['f_tri'] = rng.random(nf)
    S['f_w'] = bary(nf, rng)
    S['f_j'] = rng.normal(0, 1, (nf, 3))
    S['f_r'] = rng.random(nf); S['f_r2'] = rng.random(nf)
    nb = int(nh * 0.78); npalm = nh - nb
    S['h_bone'] = rng.integers(0, len(BONES), nb)
    S['h_t'] = rng.random(nb)
    S['h_j'] = rng.normal(0, 1, (nb, 3))
    S['h_ptri'] = rng.integers(0, len(PALM), npalm)
    S['h_pw'] = bary(npalm, rng)
    S['h_pj'] = rng.normal(0, 1, (npalm, 3))
    S['h_r'] = rng.random(nh); S['h_r2'] = rng.random(nh)


def mundo(L, asp):
    esc = pv('Escala', 2.6); zg = pv('Profundidade', 1.0)
    W = np.empty_like(L)
    W[:, 0] = (L[:, 0] - 0.5) * asp * esc
    W[:, 1] = -(L[:, 1] - 0.5) * esc
    W[:, 2] = -L[:, 2] * asp * esc * zg
    return W


def audio():
    lvl = low = mid = high = 0.0
    try:
        a = op('audio_in')
        if a is not None and a.numChans > 0 and a.numSamples > 32:
            x = np.asarray(a[0].numpyArray(), dtype=np.float64)
            if a.numChans > 1:
                x = 0.5 * (x + np.asarray(a[1].numpyArray(), dtype=np.float64))
            g = pv('Ganho', 1.0)
            rms = math.sqrt(float(np.mean(x * x))) * g
            spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
            fr = np.fft.rfftfreq(len(x), 1.0 / max(float(a.rate), 1.0))
            lvl = min(1.0, rms * 6.0)
            out = []
            for i, (lo, hi) in enumerate(((20, 250), (250, 2500), (2500, 16000))):
                m = (fr >= lo) & (fr < hi)
                bv = float(spec[m].mean()) if m.any() else 0.0
                k = 'mx%d' % i
                S[k] = max(bv, S.get(k, 1e-6) * 0.997, 1e-6)
                out.append(min(1.0, bv / S[k]) * min(1.0, lvl * 3.0))
            low, mid, high = out
    except Exception as e:
        S['erro_audio'] = str(e)
    res = []
    for k, v in (('lvl', lvl), ('low', low), ('mid', mid), ('high', high)):
        old = S.get(k, 0.0)
        S[k] = old + (v - old) * (0.6 if v > old else 0.08)
        res.append(S[k])
    return res


def efeitos(P, c, r1, r2, t, lvl, low, high, esc):
    d = P - c
    dist = np.linalg.norm(d, axis=1) + 1e-6
    dirv = d / dist[:, None]
    # respiração com o volume
    P = c + d * (1.0 + pv('Respira', 0.5) * 0.25 * lvl)
    # dispersão pelos graves (e pelo Multidrive)
    disp = pv('Dispersao', 0.2) * (0.15 + low) * esc * 0.6
    if disp > 0:
        P = P + dirv * (disp * r1 * r1)[:, None]
    # explosão das notas do Sub Phatty
    b = S.get('burst', 0.0)
    if b > 1e-3:
        z = np.zeros_like(P); z[:, 2] = (r2 - 0.5) * 2.0
        P = P + (dirv + z) * (b * esc * 1.5 * (0.3 + r2))[:, None]
    # ondas de choque (ataques do som e notas)
    for (t0, amp) in S['waves']:
        R = (t - t0) * 1.4 * esc
        prof = np.exp(-((dist - R) / (0.15 * esc)) ** 2) * amp * math.exp(-(t - t0) * 1.5)
        P = P + dirv * (prof * 0.25 * esc)[:, None]
    # ondulação (LFO)
    oa = pv('Ondaamp', 0.0)
    if oa > 0:
        P[:, 2] = P[:, 2] + oa * esc * np.sin(2 * math.pi * pv('Ondafreq', 0.5) * t + (P[:, 1] - c[1]) * 6.0 / max(esc, 1e-3) + r1 * 0.5)
    # pitch bend inclina a imagem
    bend = S.get('bend', 0.0)
    if abs(bend) > 1e-3:
        P[:, 0] = P[:, 0] + bend * 0.4 * (P[:, 1] - c[1])
    return P


def cores(n, y, r1, r2, h0, bright, lvl, high):
    hue = h0 + pv('Gradiente', 0.3) * 0.25 * y + 0.04 * (r1 - 0.5)
    nm = S.get('note_mix', 0.0)
    if nm > 0.001:
        dh = np.mod(S.get('note_hue', 0.0) - hue + 0.5, 1.0) - 0.5
        hue = hue + dh * nm
    val = bright * pv('Brilho', 1.0) * (0.35 + 0.65 * (0.35 + 0.65 * lvl)) * (0.5 + 0.5 * r2)
    fa = pv('Faisca', 0.4)
    if fa > 0:
        sp = np.random.random(n) < (0.002 + 0.06 * fa * (0.2 + high))
        val = val * (1.0 + sp * 4.0 * fa)
    return hsv2rgb(hue, pv('Saturacao', 0.6), val)


def tamanho(r, lvl):
    return pv('Tamanho', 1.0) * 0.012 * (0.45 + r * 1.1) * (1.0 + pv('Pulsa', 0.8) * lvl)


def vazio(n):
    z = np.zeros(n)
    return np.zeros((n, 3)), z, z, z, z, z


def bloco_rosto(t, lvl, low, high):
    nf = S['nf']
    W = S.get('Wf'); T = S.get('tris')
    if W is None or T is None or len(T) == 0 or S.get('fa', 0) < 0.002 or pv('Rosto', 1) < 0.5:
        return vazio(nf)
    ti = np.minimum((S['f_tri'] * len(T)).astype(np.int64), len(T) - 1)
    tri = T[ti]; w = S['f_w']
    P = W[tri[:, 0]] * w[:, 0:1] + W[tri[:, 1]] * w[:, 1:2] + W[tri[:, 2]] * w[:, 2:3]
    esc = float(np.linalg.norm(W[234] - W[454])) if len(W) > 454 else 1.0
    P = P + S['f_j'] * (esc * 0.004)
    c = W.mean(0)
    P = efeitos(P, c, S['f_r'], S['f_r2'], t, lvl, low, high, esc)
    y = (P[:, 1] - c[1]) / max(esc, 1e-3)
    br = pv('Brilhorosto', 1.0) * S['fa']
    r, g, b = cores(nf, y, S['f_r'], S['f_r2'], pv('Cor', 0.55), br, lvl, high)
    return P, tamanho(S['f_r'], lvl), r, g, b, np.full(nf, br)


def bloco_mao(i, t, lvl, low, high):
    nh = S['nh']
    W = S.get('Wh%d' % i); al = S.get('ha%d' % i, 0.0)
    if W is None or al < 0.002 or pv('Maos', 1) < 0.5:
        return vazio(nh)
    hs = float(np.linalg.norm(W[0] - W[9])) + 1e-6
    b = BONES[S['h_bone']]
    a = W[b[:, 0]]; bb = W[b[:, 1]]
    tt = S['h_t'][:, None]
    P1 = a + (bb - a) * tt + S['h_j'] * (hs * 0.07 * (1.0 - 0.45 * tt))
    tri = PALM[S['h_ptri']]; w = S['h_pw']
    P2 = W[tri[:, 0]] * w[:, 0:1] + W[tri[:, 1]] * w[:, 1:2] + W[tri[:, 2]] * w[:, 2:3] + S['h_pj'] * (hs * 0.03)
    P = np.vstack([P1, P2])
    c = W.mean(0)
    P = efeitos(P, c, S['h_r'], S['h_r2'], t, lvl, low, high, hs * 2.0)
    y = (P[:, 1] - c[1]) / max(hs * 2.0, 1e-3)
    br = pv('Brilhomaos', 1.0) * al
    r, g, bl = cores(nh, y, S['h_r'], S['h_r2'], pv('Cor', 0.55) + pv('Cormaos', 0.08), br, lvl, high)
    return P, tamanho(S['h_r'], lvl) * 0.9, r, g, bl, np.full(nh, br)


def put(scriptOp, nome, arr):
    c = scriptOp.appendChan(nome)
    try:
        c.vals = arr
    except Exception:
        c.vals = arr.tolist()


def onSetupParameters(scriptOp):
    return


def onPulse(par):
    return


def onCook(scriptOp):
    C = parent()
    t = absTime.seconds
    dt = min(0.1, max(0.0, t - S.get('t', t))); S['t'] = t
    nf = int(pv('Pontosrosto', 24000)); nh = int(pv('Pontosmao', 4000))
    if S.get('nf') != nf or S.get('nh') != nh:
        preparar(nf, nh)
    if C.fetch('recalibrar', 0, storeDefault=False):
        C.store('recalibrar', 0)
        S['tris'] = None

    # --- rastreamento (vem do rastreador pelo WebSocket)
    lm = C.fetch('lm', None, storeDefault=False)
    asp = 16.0 / 9.0; face = None; hands = []
    if lm:
        try:
            asp = float(lm.get('a') or asp)
        except Exception:
            pass
    fresh = bool(lm) and (t - lm.get('t', -99)) < 0.5
    if fresh and lm.get('f'):
        face = np.asarray(lm['f'], dtype=np.float64).reshape(-1, 3)
        if face.shape[0] < 468:
            face = None
    if fresh and lm.get('h'):
        for h in lm['h']:
            arr = np.asarray(h, dtype=np.float64).reshape(-1, 3)
            if arr.shape[0] == 21:
                hands.append(arr)
        hands.sort(key=lambda m: m[0, 0])
        hands = hands[:2]

    k = 1.0 - min(0.97, max(0.0, pv('Suavizacao', 0.5)))
    if face is not None:
        Wf = mundo(face, asp)
        if S.get('Wf') is None or S['Wf'].shape != Wf.shape or S.get('fa', 0) < 0.05:
            S['Wf'] = Wf
        else:
            S['Wf'] = S['Wf'] + (Wf - S['Wf']) * k
        if S.get('tris') is None:
            S['tris'] = face_tris(face[:, :2] * np.array([asp, 1.0]))
    S['fa'] = S.get('fa', 0.0) + ((1.0 if face is not None else 0.0) - S.get('fa', 0.0)) * min(1.0, dt * 4.0)
    for i in range(2):
        key = 'Wh%d' % i; ak = 'ha%d' % i
        if i < len(hands):
            Wh = mundo(hands[i], asp)
            if S.get(key) is None or S.get(ak, 0.0) < 0.05:
                S[key] = Wh
            else:
                S[key] = S[key] + (Wh - S[key]) * k
            tgt = 1.0
        else:
            tgt = 0.0
        S[ak] = S.get(ak, 0.0) + (tgt - S.get(ak, 0.0)) * min(1.0, dt * 5.0)

    # --- som
    if pv('Somativo', 1) > 0.5:
        lvl, low, mid, high = audio()
    else:
        lvl = low = mid = high = 0.0
    slow = S.get('slow', 0.0)
    S['slow'] = slow + (lvl - slow) * min(1.0, dt * 2.0)
    if pv('Ondachoque', 1) > 0.5 and lvl - slow > 0.12 and t - S.get('tw', -9) > 0.18:
        S['waves'].append((t, min(1.0, (lvl - slow) * 4.0))); S['tw'] = t

    # --- MIDI (notas do Sub Phatty)
    notas = C.fetch('notas', None, storeDefault=False)
    if notas:
        C.store('notas', [])
        for vel, nota in notas:
            S['burst'] = max(S.get('burst', 0.0), vel * pv('Explosao', 0.6))
            S['note_hue'] = (nota % 12) / 12.0
            S['note_mix'] = 1.0
            S['waves'].append((t, 0.5 + 0.5 * vel))
    S['burst'] = S.get('burst', 0.0) * math.exp(-dt * (0.6 + 7.0 * pv('Retorno', 0.4)))
    S['note_mix'] = S.get('note_mix', 0.0) * math.exp(-dt * 0.5)
    try:
        S['bend'] = float(C.fetch('bend', 0.0, storeDefault=False) or 0.0)
    except Exception:
        S['bend'] = 0.0
    S['waves'] = [w for w in S['waves'] if t - w[0] < 2.5][-8:]

    # --- pontos
    blocos = [bloco_rosto(t, lvl, low, high), bloco_mao(0, t, lvl, low, high), bloco_mao(1, t, lvl, low, high)]
    P = np.vstack([b[0] for b in blocos])
    cols = [P[:, 0], P[:, 1], P[:, 2]] + [np.concatenate([b[j] for b in blocos]) for j in range(1, 6)]
    scriptOp.clear()
    scriptOp.numSamples = len(P)
    for nome, arr in zip(('tx', 'ty', 'tz', 'sc', 'cr', 'cg', 'cb', 'ca'), cols):
        put(scriptOp, nome, np.asarray(arr, dtype=np.float32))
    return
'''

# ---------------------------------------------------------------------
#  Código: textura do ponto de luz (Script TOP)
# ---------------------------------------------------------------------
TEXTURA_PY = r'''# Textura de um ponto de luz: núcleo forte e halo suave
import numpy as np

def onSetupParameters(scriptOp):
    return

def onPulse(par):
    return

def onCook(scriptOp):
    n = 64
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    r = np.sqrt(((x - n / 2 + 0.5) / (n / 2)) ** 2 + ((y - n / 2 + 0.5) / (n / 2)) ** 2)
    a = np.exp(-r * r * 6.0) * 0.7 + np.exp(-r * r * 40.0)
    a = np.clip(a * (r < 1.0), 0, 1).astype(np.float32)
    scriptOp.copyNumpyArray(np.dstack([a, a, a, a]))
    return
'''

# ---------------------------------------------------------------------
#  Código: execução a cada quadro e botões do painel
# ---------------------------------------------------------------------
QUADRO_PY = r'''# A cada quadro: mantém o rastreador interno vivo e recalcula os pontos
def onFrameStart(frame):
    try:
        if parent().par.Rastreadorinterno.eval():
            op('rastreador_view').cook(force=True)
    except Exception:
        pass
    op('pontos').cook(force=True)
    return
'''

PAINEL_PY = r'''# Botões do painel do Rosto de Luz
def onPulse(par):
    if par.name == 'Abrirjanela':
        op('janela').par.winopen.pulse()
    elif par.name == 'Fecharjanela':
        op('janela').par.winclose.pulse()
    elif par.name == 'Recalibrar':
        parent().store('recalibrar', 1)
    elif par.name == 'Recarregarrastreador':
        try:
            op('rastreador_view').par.reload.pulse()
        except Exception:
            pass
    return

def onValueChange(par, prev):
    return
'''

# =====================================================================
#  Construção
# =====================================================================
R = op(DESTINO)
velho = R.op(NOME)
if velho is not None:
    velho.destroy()
C = R.create(baseCOMP, NOME)
C.color = (0.35, 0.3, 0.6)

# ---- painel (parâmetros customizados) -------------------------------
def addf(pg, nome, label, d, lo, hi):
    p = pg.appendFloat(nome, label=label)[0]
    p.normMin = lo; p.normMax = hi; p.default = d; p.val = d
    return p

def addi(pg, nome, label, d, lo, hi):
    p = pg.appendInt(nome, label=label)[0]
    p.normMin = lo; p.normMax = hi; p.min = lo; p.clampMin = True; p.default = d; p.val = d
    return p

def addt(pg, nome, label, d):
    p = pg.appendToggle(nome, label=label)[0]
    p.default = d; p.val = d
    return p

pg = C.appendCustomPage('Rosto de Luz')
pg.appendPulse('Abrirjanela', label='Abrir janela da obra')
pg.appendPulse('Fecharjanela', label='Fechar janela da obra')
addt(pg, 'Rosto', 'Rosto', 1)
addt(pg, 'Maos', 'Mãos', 1)
addi(pg, 'Pontosrosto', 'Pontos do rosto', 24000, 2000, 100000)
addi(pg, 'Pontosmao', 'Pontos por mão', 4000, 500, 20000)
addf(pg, 'Escala', 'Escala', 2.6, 1.0, 5.0)
addf(pg, 'Profundidade', 'Profundidade (3D)', 1.0, 0.0, 3.0)
addf(pg, 'Suavizacao', 'Suavização do movimento', 0.5, 0.0, 0.95)
addf(pg, 'Tamanho', 'Tamanho dos pontos', 1.0, 0.2, 4.0)
addf(pg, 'Brilho', 'Brilho geral', 1.0, 0.0, 3.0)
addf(pg, 'Brilhorosto', 'Brilho do rosto', 1.0, 0.0, 2.0)
addf(pg, 'Brilhomaos', 'Brilho das mãos', 1.0, 0.0, 2.0)
addf(pg, 'Cor', 'Cor', 0.55, 0.0, 1.0)
addf(pg, 'Cormaos', 'Cor das mãos (desvio)', 0.08, -0.5, 0.5)
addf(pg, 'Saturacao', 'Saturação', 0.6, 0.0, 1.0)
addf(pg, 'Gradiente', 'Gradiente de cor', 0.3, 0.0, 2.0)
pg.appendPulse('Recalibrar', label='Recalibrar malha do rosto')

ps = C.appendCustomPage('Som')
addt(ps, 'Somativo', 'Som controla os efeitos', 1)
addf(ps, 'Ganho', 'Ganho da entrada', 1.0, 0.0, 10.0)
addf(ps, 'Pulsa', 'Pontos pulsam com o volume', 0.8, 0.0, 3.0)
addf(ps, 'Respira', 'Respiração com o volume', 0.5, 0.0, 2.0)
addf(ps, 'Dispersao', 'Dispersão pelos graves', 0.2, 0.0, 1.0)
addf(ps, 'Faisca', 'Faíscas pelos agudos', 0.4, 0.0, 1.0)
addt(ps, 'Ondachoque', 'Ondas de choque nos ataques', 1)

pm = C.appendCustomPage('MIDI e efeitos')
addt(pm, 'Midiativo', 'MIDI do Sub Phatty ativo', 1)
addf(pm, 'Explosao', 'Explosão das notas', 0.6, 0.0, 2.0)
addf(pm, 'Retorno', 'Retorno após a explosão', 0.4, 0.0, 1.0)
addf(pm, 'Ondafreq', 'Ondulação: velocidade (Hz)', 0.5, 0.0, 8.0)
addf(pm, 'Ondaamp', 'Ondulação: amplitude', 0.0, 0.0, 0.3)
addf(pm, 'Rastro', 'Rastro', 0.6, 0.0, 0.97)
addf(pm, 'Liquido', 'Imagem líquida', 0.0, 0.0, 1.0)
addf(pm, 'Glow', 'Brilho difuso (glow)', 0.6, 0.0, 1.5)
addf(pm, 'Granulado', 'Granulado', 0.0, 0.0, 1.0)

pr = C.appendCustomPage('Rastreador')
addt(pr, 'Rastreadorinterno', 'Rastreador dentro do TD', 1)
pr.appendPulse('Recarregarrastreador', label='Recarregar rastreador')

# ---- rastreamento ----------------------------------------------------
html = C.create(textDAT, 'rastreador_html'); html.text = RASTREADOR_HTML; pos(html, 0, 0)
srv_cb = C.create(textDAT, 'servidor_callbacks'); srv_cb.text = SERVIDOR_PY; pos(srv_cb, 0, 1)
srv = C.create(webserverDAT, 'servidor'); pos(srv, 1, 1)
setp(srv, 'port', PORTA)
setp(srv, 'callbacks', srv_cb.name)
setp(srv, 'active', True)
wr = C.create(webrenderTOP, 'rastreador_view'); pos(wr, 1, 0)
setp(wr, 'url', 'http://localhost:%d/' % PORTA)
setp(wr, 'resolutionw', 480); setp(wr, 'resolutionh', 480)
setexpr(wr, 'active', "parent().par.Rastreadorinterno")

# ---- som e MIDI ------------------------------------------------------
ain = C.create(audiodeviceinCHOP, 'audio_in'); pos(ain, 0, 3)
midi_cb = C.create(textDAT, 'midi_callbacks'); midi_cb.text = MIDI_PY; pos(midi_cb, 0, 4)
midi = C.create(midiinDAT, 'midi_in'); pos(midi, 1, 4)
setp(midi, 'callbacks', midi_cb.name)

# ---- pontos ----------------------------------------------------------
pts_cb = C.create(textDAT, 'pontos_codigo'); pts_cb.text = PONTOS_PY; pos(pts_cb, 2, 2)
pts = C.create(scriptCHOP, 'pontos'); pos(pts, 3, 2)
setp(pts, 'callbacks', pts_cb.name)

tex_cb = C.create(textDAT, 'ponto_textura_codigo'); tex_cb.text = TEXTURA_PY; pos(tex_cb, 2, 4)
tex = C.create(scriptTOP, 'ponto_textura'); pos(tex, 3, 4)
setp(tex, 'callbacks', tex_cb.name)
setp(tex, 'outputresolution', 'custom'); setp(tex, 'resolutionw', 64); setp(tex, 'resolutionh', 64)
setp(tex, 'format', 'rgba32float')

mat = C.create(constantMAT, 'luz_mat'); pos(mat, 4, 4)
setp(mat, 'colormap', tex.name)
setp(mat, 'blending', True)
setp(mat, 'srcblend', 'one')
setp(mat, 'destblend', 'one')
setp(mat, 'depthtest', False)
setp(mat, 'depthwriting', False)

geo = C.create(geometryCOMP, 'pontos_geo'); pos(geo, 4, 2)
for ch in list(geo.children):
    ch.destroy()
ret = geo.create(rectangleSOP, 'ponto')
setp(ret, 'sizex', 1.0); setp(ret, 'sizey', 1.0)
ret.render = True; ret.display = True
setp(geo, 'material', mat.path)
setp(geo, 'instancing', True)
setp(geo, 'instanceop', pts.path)
for p_, ch_ in (('instancetx', 'tx'), ('instancety', 'ty'), ('instancetz', 'tz'),
                ('instancesx', 'sc'), ('instancesy', 'sc'), ('instancesz', 'sc'),
                ('instancer', 'cr'), ('instanceg', 'cg'), ('instanceb', 'cb'), ('instancea', 'ca')):
    setp(geo, p_, ch_)

cam = C.create(cameraCOMP, 'cam'); pos(cam, 4, 1)
setp(cam, 'tz', 4.0)

ren = C.create(renderTOP, 'render'); pos(ren, 5, 2)
setp(ren, 'camera', cam.path)
setp(ren, 'geometry', geo.path)
setp(ren, 'lights', '')
setp(ren, 'resolutionw', 1920); setp(ren, 'resolutionh', 1080)
setp(ren, 'format', 'rgba16float')

# ---- pós-processamento: rastro, líquido, glow, granulado -------------
fb = C.create(feedbackTOP, 'rastro_fb'); pos(fb, 5, 3)
lig(fb, 0, ren)
fbl = C.create(levelTOP, 'rastro_nivel'); pos(fbl, 6, 3)
lig(fbl, 0, fb)
setexpr(fbl, 'opacity', "parent().par.Rastro")
tr = C.create(compositeTOP, 'rastro_soma'); pos(tr, 7, 2)
lig(tr, 0, ren); lig(tr, 1, fbl)
setp(tr, 'operand', 'add')
trn = C.create(nullTOP, 'rastro_out'); pos(trn, 8, 2)
lig(trn, 0, tr)
setp(fb, 'top', trn.name)

nz = C.create(noiseTOP, 'liquido_ruido'); pos(nz, 8, 3)
setp(nz, 'outputresolution', 'custom'); setp(nz, 'resolutionw', 480); setp(nz, 'resolutionh', 270)
setp(nz, 'mono', False)
setp(nz, 'period', 1.5)
setexpr(nz, 'tz', "absTime.seconds * 0.15")
dsp = C.create(displaceTOP, 'liquido'); pos(dsp, 9, 2)
lig(dsp, 0, trn); lig(dsp, 1, nz)
setexpr(dsp, 'displaceweightx', "parent().par.Liquido * 0.12")
setexpr(dsp, 'displaceweighty', "parent().par.Liquido * 0.12")

blr = C.create(blurTOP, 'glow_blur'); pos(blr, 10, 3)
lig(blr, 0, dsp)
setexpr(blr, 'size', "6 + parent().par.Glow * 40")
gl = C.create(levelTOP, 'glow_nivel'); pos(gl, 11, 3)
lig(gl, 0, blr)
setexpr(gl, 'opacity', "parent().par.Glow")
gs = C.create(compositeTOP, 'glow_soma'); pos(gs, 12, 2)
lig(gs, 0, dsp); lig(gs, 1, gl)
setp(gs, 'operand', 'add')

gr = C.create(noiseTOP, 'granulado_ruido'); pos(gr, 12, 3)
setp(gr, 'outputresolution', 'custom'); setp(gr, 'resolutionw', 1920); setp(gr, 'resolutionh', 1080)
setp(gr, 'period', 0.004)
setexpr(gr, 'seed', "absTime.frame")
grl = C.create(levelTOP, 'granulado_nivel'); pos(grl, 13, 3)
lig(grl, 0, gr)
setexpr(grl, 'opacity', "parent().par.Granulado * 0.3")
grs = C.create(compositeTOP, 'granulado_soma'); pos(grs, 14, 2)
lig(grs, 0, gs); lig(grs, 1, grl)
setp(grs, 'operand', 'add')

out = C.create(nullTOP, 'saida'); pos(out, 15, 2)
lig(out, 0, grs)
out.viewer = True

win = C.create(windowCOMP, 'janela'); pos(win, 16, 2)
setp(win, 'winop', out.path)
setp(win, 'winw', 1920); setp(win, 'winh', 1080)
setp(win, 'borders', False)

# ---- execução --------------------------------------------------------
ex = C.create(executeDAT, 'a_cada_quadro'); ex.text = QUADRO_PY; pos(ex, 2, 0)
setp(ex, 'framestart', True)
setp(ex, 'active', True)
pe = C.create(parameterexecuteDAT, 'painel'); pe.text = PAINEL_PY; pos(pe, 3, 0)
setp(pe, 'op', C.path)
setp(pe, 'pars', '*')
setp(pe, 'custom', True)
setp(pe, 'onpulse', True)
setp(pe, 'valuechange', False)
setp(pe, 'active', True)

C.viewer = True
print('\n=== Rosto de Luz v2 construído em %s ===' % C.path)
print('Rastreador: http://localhost:%d  (dentro do TD ou no Chrome)' % PORTA)
if avisos:
    print('Avisos (%d) — mande para o Claude se algo não funcionar:' % len(avisos))
    for a in avisos:
        print('  - ' + a)
else:
    print('Sem avisos.')
