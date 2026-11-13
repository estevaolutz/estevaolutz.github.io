
import numpy as np
import json
import math

UPPER = [132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361]
BX, BY_UP, BY_DN = 0.18, 0.80, 0.15

def _dirs(ns, nn):
    rng = np.random.default_rng(7)
    m = max(ns, 1) * 6
    phi = rng.random(m) * np.pi
    # densidade proporcional ao raio do arco (evita amontoar na nuca)
    a = np.where(phi < np.pi / 2, 1 + BX * np.sin(phi), (1 + BX) * np.sin(phi))
    keep = rng.random(m) < a / a.max()
    phi = phi[keep][:ns]
    t = rng.random(len(phi))
    nt = rng.random(nn); na = rng.random(nn) * 2 * np.pi
    return (t, phi), np.stack([np.cos(na), nt, np.sin(na)], 1)

def _fit(C):
    W = abs(C[454, 0] - C[234, 0])
    fy, chin = C[10, 1], C[152, 1]
    fh = abs(fy - chin)
    side_z = 0.5 * (C[454, 2] + C[234, 2])
    sg = 1.0 if C[4, 2] > side_z else -1.0          # para onde o rosto aponta
    U = C[UPPER]
    L = 1.25 * W                                     # comprimento da cabeça
    cx = U[:, 0].mean()
    cy = 0.5 * (C[234, 1] + C[454, 1]) + 0.12 * fh
    cz = U[:, 2].mean() - sg * 0.32 * L
    return np.array([cx, cy, cz, L, W, fh, chin, sg])

def _head(st, C, fit):
    (t, phi), nk = st['dirs']
    cx, cy, cz, L, W, fh, chin, sg = fit
    sg = 1.0 if sg >= 0 else -1.0
    ctr = np.array([cx, cy, cz])
    n = len(UPPER)
    x = t * (n - 1); i0 = np.minimum(x.astype(int), n - 2); f = (x - i0)[:, None]
    U = C[UPPER]
    O = U[i0] * (1 - f) + U[i0 + 1] * f                # ponto na borda da máscara
    r = O - ctr
    zf = np.maximum(r[:, 2] * sg, 0.05 * L)
    front = phi < np.pi / 2
    s = np.sin(phi); c = np.cos(phi)
    ax = np.where(front, 1 + BX * s, (1 + BX) * s)
    by = np.where(r[:, 1] > 0, BY_UP, BY_DN)
    ay = np.where(front, 1 + by * s, (1 + by) * s)
    z = np.where(front, zf * c, 0.62 * L * c)
    sk = ctr + np.stack([r[:, 0] * ax, r[:, 1] * ay, sg * z], 1)
    nr = 0.34 * W
    top = chin + 0.25 * fh
    neck = np.stack([cx + nk[:, 0] * nr, top - nk[:, 1] * 0.75 * fh, cz + sg * 0.18 * L + nk[:, 2] * nr * 0.95], 1)
    return sk, neck

def _face_samples(P, tris, nf):
    rng = np.random.default_rng(3)
    a, bb, c = P[tris[:, 0]], P[tris[:, 1]], P[tris[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(bb - a, c - a), axis=1) + 1e-9
    ti = rng.choice(len(tris), nf, p=area / area.sum())
    u = rng.random(nf); v = rng.random(nf)
    f = u + v > 1; u[f] = 1 - u[f]; v[f] = 1 - v[f]
    return ti, np.stack([1 - u - v, u, v], 1)

def onSetupParameters(scriptOp): return
def onPulse(par): return

def _face(scriptOp):
    b = scriptOp.parent()
    st = scriptOp.storage
    fp = scriptOp.inputs[0] if len(scriptOp.inputs) > 0 else None
    tm = scriptOp.inputs[1] if len(scriptOp.inputs) > 1 else None
    if fp is None or tm is None or fp.numSamples < 400 or tm.numChans < 16:
        return None
    names = [ch.name for ch in fp.chans()]
    arr = fp.numpyArray()
    P = np.stack([arr[names.index('x')], arr[names.index('y')], arr[names.index('z')]], 1).astype(np.float64)

    Praw = P.copy()
    if 'tris' not in st or st.get('npts') != len(P):
        sop = op(b.par.Mascara.eval()) if b.par['Mascara'] is not None else op('/project1/face_tracking/faceMask1')
        tris = [[v.point.index for v in pr] for pr in sop.prims if len(pr) == 3]
        tris = np.array([t for t in tris if max(t) < len(P)], dtype=np.int32)
        if len(tris) < 100:
            return
        st['tris'] = tris; st['npts'] = len(P); st.pop('fs', None)

    nf = int(b.par.Pontosrosto)
    ns = int(b.par.Pontoscranio) if b.par['Pontoscranio'] is not None else 0
    nn = int(b.par.Pontospescoco) if b.par['Pontospescoco'] is not None else 0
    if st.get('fs_n') != nf or 'fs' not in st:
        st['fs'] = _face_samples(P, st['tris'], nf); st['fs_n'] = nf
    if st.get('sk_n') != (ns, nn):
        st['dirs'] = _dirs(ns, nn); st['sk_n'] = (ns, nn)

    M = np.zeros((4, 4))
    for ch in tm.chans():
        n = ch.name
        if len(n) == 3 and n[0] == 'm':
            M[int(n[1]), int(n[2])] = ch[0]
    if abs(np.linalg.det(M[:3, :3])) < 1e-12:
        return None
    T = M[:3, 3].copy()
    R = M[:3, :3]
    Mi = np.linalg.inv(M)
    C = P @ Mi[:3, :3].T + Mi[:3, 3]
    fit = None

    # suavização
    a = float(b.par.Suavizar)
    if 'P' in st and st['P'].shape == P.shape:
        P = st['P'] * a + P * (1 - a)
        T = st['T'] * a + T * (1 - a)
        R = st['R'] * a + R * (1 - a)
    st['P'], st['T'], st['R'] = P, T, R
    Mi = np.linalg.inv(np.vstack([np.c_[R, T], [0, 0, 0, 1]]))
    C = P @ Mi[:3, :3].T + Mi[:3, 3]
    fit = _fit(C)
    if 'fit' in st and len(st['fit']) == len(fit):
        fit = st['fit'] * 0.85 + fit * 0.15
    st['fit'] = fit

    ti, w = st['fs']
    tris = st['tris']
    face = (P[tris[ti, 0]] * w[:, 0:1] + P[tris[ti, 1]] * w[:, 1:2] + P[tris[ti, 2]] * w[:, 2:3])
    fraw = (Praw[tris[ti, 0]] * w[:, 0:1] + Praw[tris[ti, 1]] * w[:, 1:2] + Praw[tris[ti, 2]] * w[:, 2:3])
    mg = float(b.par.Margem) if b.par['Margem'] is not None else 0.0
    cxy = Praw[:, :2].mean(0)
    fraw[:, :2] = cxy + (fraw[:, :2] - cxy) * (1.0 - mg)
    sk, neck = _head(st, C, st['fit'])
    hd = np.concatenate([sk, neck], 0)
    hw = hd @ R.T + T

    S = 6.0
    allp = (np.concatenate([face, hw], 0) - T) * S
    if not b.par.Seguir:
        sc = np.linalg.norm(R[:, 0]) + 1e-9
        Rn = R / sc
        allp = allp @ Rn        # desfaz o giro da cabeça
    # coordenadas da imagem para o rosto
    rat = 16.0 / 9.0
    try:
        rc = op('/project1/face_tracking/Build_SOPs/Build_SOP1/resolution')
        r0 = float(rc['ratio'])
        rat = r0 if r0 > 1 else 1.0 / max(r0, 1e-6)
    except Exception:
        pass
    fu = fraw[:, 0]
    fv = (fraw[:, 1] - 0.5) * rat + 0.5
    nfc = len(face)
    u = np.concatenate([fu, np.full(len(sk), -1.0), np.full(len(neck), -1.0)])
    v = np.concatenate([fv, np.full(len(sk), -1.0), np.full(len(neck), -1.0)])
    k = np.concatenate([np.zeros(nfc), np.ones(len(sk)), np.full(len(neck), 2.0)])
    st['ratio_wh'] = rat
    return (allp, u, v, k)


# ------------------------------------------------------------------
#  MÃOS (v4): pontos de luz nos dedos e na palma, no mesmo espaço do rosto
# ------------------------------------------------------------------
BONES = np.array([(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(7,8),(5,9),(9,10),(10,11),(11,12),
                  (9,13),(13,14),(14,15),(15,16),(13,17),(17,18),(18,19),(19,20),(0,17)], dtype=np.int64)
PALM = np.array([(0,1,5),(0,5,9),(0,9,13),(0,13,17)], dtype=np.int64)


def _hand_samples(nh):
    rng = np.random.default_rng(11)
    nb = int(nh * 0.75); npm = nh - nb
    bone = rng.integers(0, len(BONES), nb); t = rng.random(nb); j = rng.normal(0, 1, (nb, 3))
    pt = rng.integers(0, len(PALM), npm)
    u = rng.random(npm); v = rng.random(npm); f = u + v > 1; u[f] = 1 - u[f]; v[f] = 1 - v[f]
    return bone, t, j, pt, np.stack([1 - u - v, u, v], 1), rng.normal(0, 1, (npm, 3))


def _hand_pts(H, smp):
    bone, t, j, pt, w, pj = smp
    a = H[BONES[bone, 0]]; c = H[BONES[bone, 1]]
    hs = float(np.linalg.norm(H[0] - H[9])) + 1e-6
    tt = t[:, None]
    P1 = a + (c - a) * tt + j * (hs * 0.06 * (1.0 - 0.4 * tt))
    tri = PALM[pt]
    P2 = H[tri[:, 0]] * w[:, 0:1] + H[tri[:, 1]] * w[:, 1:2] + H[tri[:, 2]] * w[:, 2:3] + pj * (hs * 0.025)
    return np.vstack([P1, P2])


def _hands(b, st):
    nh = int(b.par.Pontosmao) if b.par['Pontosmao'] is not None else 0
    on = bool(b.par.Maos) if b.par['Maos'] is not None else False
    if nh <= 0:
        return None
    if st.get('hs_n') != nh:
        st['hsmp'] = _hand_samples(nh); st['hs_n'] = nh
        for i in range(2):
            st.pop('H%d' % i, None)
    rat = float(st.get('ratio_wh', 16.0 / 9.0))
    ratio = 1.0 / max(rat, 1e-6)                   # altura / largura
    hands = []
    if on:
        try:
            d = json.loads(op('/project1/MediaPipe/hands').text or '{}')
            for lms in d.get('gestureResults', {}).get('landmarks', []) or []:
                if len(lms) == 21:
                    hands.append(np.array([(p['x'], -p['y'] * ratio + 0.78, -p['z']) for p in lms], dtype=np.float64))
        except Exception:
            hands = []
    hands.sort(key=lambda h: h[0, 0])
    hands = hands[:2]
    T = st.get('T')
    if T is None:
        T = np.array([0.5, 0.78 - 0.5 * ratio, 0.0])
    zc = float(st['P'][:, 2].mean()) if 'P' in st else 0.0
    a_s = float(b.par.Suavizar)
    t = absTime.seconds
    dt = min(0.1, max(0.0, t - st.get('ht', t))); st['ht'] = t
    S = 6.0
    out = []
    for i in range(2):
        key = 'H%d' % i; ak = 'Ha%d' % i
        al = st.get(ak, 0.0)
        if i < len(hands):
            H = hands[i].copy()
            H[:, 2] = H[:, 2] - H[0, 2] + zc
            if key not in st or al < 0.05:
                st[key] = H
            else:
                st[key] = st[key] * a_s + H * (1 - a_s)
            tgt = 1.0
        else:
            tgt = 0.0
        al = al + (tgt - al) * min(1.0, dt * 5.0)
        st[ak] = al
        if key in st and al > 0.002:
            Hs = st[key]
            pr = _hand_pts(Hs, st['hsmp'])
            u = pr[:, 0].copy()
            v = (pr[:, 1] - 0.5) * rat + 0.5
            # a mão mantém o tamanho proporcional ao rosto, mas a posição usa o quadro
            # inteiro da câmera, para a mão nunca sair da tela da obra
            cpr = Hs.mean(0)
            esc = float(b.par.Escalamao) if b.par['Escalamao'] is not None else 0.8
            esp = float(b.par.Espacomao) if b.par['Espacomao'] is not None else 0.9
            zoom = float(b.par.Zoom) if b.par['Zoom'] is not None else 3.4
            try:
                cam = op('olho'); fov = float(cam.par.fov); horz = cam.par.viewanglemethod.eval() == 'horzfov'
            except Exception:
                fov, horz = 45.0, True
            half = zoom * math.tan(math.radians(fov) * 0.5)
            res = op('render')
            ar = (res.width / max(res.height, 1)) if res is not None else rat
            hw, hh = (half, half / ar) if horz else (half * ar, half)
            yc = 0.78 - 0.5 * ratio
            pos = np.array([(cpr[0] - 0.5) * 2.0 * hw * esp,
                            (cpr[1] - yc) / (0.5 * ratio) * hh * esp,
                            (cpr[2] - T[2]) * S])
            allp = (pr - cpr) * S * esc + pos
            out.append((allp, u, v, np.full(nh, 3.0), np.full(nh, al)))
        else:
            z = np.zeros(nh)
            out.append((np.zeros((nh, 3)), z - 1, z - 1, np.full(nh, 3.0), z))
    return out


def onCook(scriptOp):
    b = scriptOp.parent()
    st = scriptOp.storage
    fd = _face(scriptOp)
    if fd is None:
        fd = st.get('last')
    else:
        st['last'] = fd
    blocks = []
    if fd is not None:
        allp, u, v, k = fd
        blocks.append((allp, u, v, k, np.ones(len(allp))))
    hd = _hands(b, st)
    if hd:
        blocks.extend(hd)
    if not blocks:
        return
    data = tuple(np.concatenate([bl[i] for bl in blocks]) for i in range(5))
    _write(scriptOp, data)


def _write(scriptOp, data):
    allp, u, v, k, a = data
    scriptOp.clear()
    scriptOp.numSamples = len(allp)
    for name, vals in (('tx', allp[:, 0]), ('ty', allp[:, 1]), ('tz', allp[:, 2]), ('u', u), ('v', v), ('k', k), ('a', a)):
        ch = scriptOp.appendChan(name)
        ch.copyNumpyArray(np.ascontiguousarray(vals, dtype=np.float32))
