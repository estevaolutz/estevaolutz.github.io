# Rosto de Luz v5 — espectrômetro: espectro do microfone em bandas log (linha 0 = agora) + histórico (cascata)
import numpy as np
import math

NB = 64      # bandas de frequência
NH = 48      # linhas de histórico (cascata)
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
    if 'hist' not in S:
        S['hist'] = np.zeros((NH, NB), dtype=np.float32)
        S['buf'] = np.zeros(4096)
        S['cur'] = np.zeros(NB)
    a = op('som_entrada')
    sr = 48000.0
    try:
        x = np.asarray(a[0].numpyArray(), dtype=np.float64)
        if a.numChans > 1:
            x = 0.5 * (x + np.asarray(a[1].numpyArray(), dtype=np.float64))
        sr = max(float(a.rate), 1.0)
        b = np.concatenate([S['buf'], x])[-4096:]
        S['buf'] = b
    except Exception:
        b = S['buf']
    n = len(b)
    spec = np.abs(np.fft.rfft(b * np.hanning(n))) / (n * 0.25)
    fr = np.fft.rfftfreq(n, 1.0 / sr)
    edges = np.geomspace(40.0, min(14000.0, sr * 0.45), NB + 1)
    idx = np.searchsorted(fr, edges)
    bands = np.zeros(NB)
    for i in range(NB):
        lo, hi = idx[i], max(idx[i + 1], idx[i] + 1)
        bands[i] = spec[lo:hi].max() if hi <= len(spec) else 0.0
    g = pv('Espectroganho', 1.0)
    db = 20.0 * np.log10(bands * g + 1e-9)
    val = np.clip((db + 75.0) / 60.0, 0.0, 1.0)           # -75 dB .. -15 dB → 0..1
    val = val * (0.6 + 0.8 * np.linspace(0, 1, NB))        # compensa a queda natural dos agudos
    val = np.clip(val, 0.0, 1.0)
    sm = min(0.95, max(0.0, pv('Espectrosuave', 0.5)))
    cur = S['cur']
    up = val > cur
    cur = np.where(up, cur + (val - cur) * (1.0 - sm * 0.5), cur + (val - cur) * (1.0 - sm))
    S['cur'] = cur
    if absTime.frame % 2 == 0:
        S['hist'] = np.roll(S['hist'], 1, axis=0)
        S['hist'][0] = cur
    scriptOp.clear()
    scriptOp.numSamples = NB
    for r in range(NH):
        c = scriptOp.appendChan('r%02d' % r)
        c.copyNumpyArray(np.ascontiguousarray(S['hist'][r] if r > 0 else cur, dtype=np.float32))
    return
