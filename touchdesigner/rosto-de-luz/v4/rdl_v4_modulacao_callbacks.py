# Rosto de Luz v4 — modulação pelo som (microfone/interface) e pelas notas do Sub Phatty
import numpy as np
import math

S = {}


def pv(n, d=0.0):
    p = parent().par[n]
    try:
        return float(p.eval()) if p is not None else d
    except Exception:
        return d


def onSetupParameters(scriptOp):
    return


def onPulse(par):
    return


def onCook(scriptOp):
    b = parent()
    t = absTime.seconds
    dt = min(0.1, max(0.0, t - S.get('t', t))); S['t'] = t
    lvl = low = high = 0.0
    if pv('Somativo', 1) > 0.5:
        try:
            a = op('som_entrada')
            x = np.asarray(a[0].numpyArray(), dtype=np.float64)
            if a.numChans > 1:
                x = 0.5 * (x + np.asarray(a[1].numpyArray(), dtype=np.float64))
            rms = math.sqrt(float(np.mean(x * x))) * pv('Ganho', 1.0)
            lvl = min(1.0, rms * 6.0)
            sp = np.abs(np.fft.rfft(x * np.hanning(len(x))))
            fr = np.fft.rfftfreq(len(x), 1.0 / max(float(a.rate), 1.0))
            res = []
            for k, (lo, hi) in (('low', (20, 250)), ('high', (2500, 16000))):
                m = (fr >= lo) & (fr < hi)
                bv = float(sp[m].mean()) if m.any() else 0.0
                S['mx' + k] = max(bv, S.get('mx' + k, 1e-6) * 0.997, 1e-6)
                res.append(min(1.0, bv / S['mx' + k]) * min(1.0, lvl * 3.0))
            low, high = res
        except Exception as e:
            S['erro'] = str(e)
    for k, v in (('lvl', lvl), ('low', low), ('high', high)):
        o = S.get(k, 0.0)
        S[k] = o + (v - o) * (0.6 if v > o else 0.08)
    lvl, low, high = S['lvl'], S['low'], S['high']
    slow = S.get('slow', 0.0)
    S['slow'] = slow + (lvl - slow) * min(1.0, dt * 2.0)
    if lvl - slow > 0.12 and t - S.get('ton', -9) > 0.15:
        S['atk'] = min(1.0, (lvl - slow) * 4.0); S['ton'] = t
    S['atk'] = S.get('atk', 0.0) * math.exp(-dt * 5.0)

    notas = b.fetch('notas', None, storeDefault=False)
    if notas:
        b.store('notas', [])
        for vel, n in notas:
            S['burst'] = max(S.get('burst', 0.0), vel)
            S['nota'] = (n % 12) / 12.0
            S['nmix'] = 1.0
    S['burst'] = S.get('burst', 0.0) * math.exp(-dt * (0.5 + 6.0 * pv('Retorno', 0.4)))
    S['nmix'] = S.get('nmix', 0.0) * math.exp(-dt * 0.4)
    try:
        bend = float(b.fetch('bend', 0.0, storeDefault=False) or 0.0)
    except Exception:
        bend = 0.0

    pulso = pv('Sompulso', 0.6); atk = S['atk'] * pv('Somataques', 0.6)
    bu = S['burst'] * pv('Notaexplosao', 0.6)
    ch = {
        'tamanho': lvl * pulso * 0.6,
        'intensidade': lvl * pulso * 0.5 + atk * 0.5,
        'dispersao': low * pv('Somgraves', 0.4) * 0.25 + bu * 0.6,
        'cintilar': high * pv('Somagudos', 0.5),
        'glitch': atk * 0.5,
        'scanner': atk * 0.8 + bu * 1.2,
        'vortice': bu * 0.5,
        'respiracao': lvl * pulso * 2.0,
        'brilho': lvl * pulso * 0.4 + bu * 0.6,
        'tom': S.get('nota', 0.0) * S['nmix'] * pv('Notacor', 1.0),
        'giro': bend * 30.0,
        'nivel': lvl, 'graves': low, 'agudos': high, 'explosao': bu,
    }
    scriptOp.clear()
    scriptOp.numSamples = 1
    for k, v in ch.items():
        scriptOp.appendChan(k)[0] = float(v)
    return
