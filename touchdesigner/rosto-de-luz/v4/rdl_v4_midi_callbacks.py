# Rosto de Luz v4 — MIDI do Moog Sub Phatty
# Botões (CC) movem os parâmetros do painel; notas disparam explosões; pitch bend gira a cabeça.
CC = {
    19: 'Tom',            # Corte do filtro        → tom da cor
    21: 'Cintilar',       # Ressonância            → cintilar
    22: 'Notaexplosao',   # Quant. do EG do filtro → força da explosão das notas
    18: 'Dispersao',      # Multidrive             → dispersão
    3:  'Fluxo',          # Taxa do LFO            → velocidade das cores
    4:  'Vortice',        # Mod. de altura         → vórtice
    2:  'Scanner',        # Mod. do filtro         → scanner holográfico
    15: 'Intensidade',    # Nível Osc 1            → intensidade da luz
    16: 'Brilhomaos',     # Nível Osc 2            → brilho das mãos
    17: 'Rastro',         # Nível Sub              → rastro
    8:  'Glitch',         # Ruído                  → glitch
    5:  'Suavizar',       # Glide                  → suavizar tremor
    26: 'Retorno',        # Relaxamento do filtro  → retorno da explosão
    9:  'Tamanho',        # Onda Osc 1             → tamanho dos pontos
    14: 'Saturacao',      # Onda Osc 2             → saturação
    12: 'Deriva',         # Afinação Osc 2         → deriva
    13: 'Respiracao',     # Batimento Osc 2        → respiração
    7:  'Exposicao',      # Volume                 → exposição
    1:  'Brilho',         # Roda de modulação      → halo
}
PALETA_CC = 74            # Oitava Osc 1 (chave de 4 posições) → troca a paleta


def _par(nome, v01):
    p = parent().par[nome]
    if p is None:
        return
    p.val = p.normMin + (p.normMax - p.normMin) * max(0.0, min(1.0, v01))


def onReceiveMIDI(dat, rowIndex, message, channel, index, value, input=None, bytes=None, *args):
    b = parent()
    if b.par['Midiativo'] is not None and not b.par.Midiativo.eval():
        return
    try:
        bb = [int(x) for x in bytes] if bytes is not None else []
    except Exception:
        bb = []
    st = (bb[0] & 0xF0) if bb else None
    m = str(message or '').lower().replace(' ', '')
    if st is None:   # sem bytes: usa as colunas do MIDI In DAT (índices de CC vêm de 1 a 128)
        if m.startswith('noteon'):
            st, bb = 0x90, [0x90, int(index), int(value)]
        elif m.startswith('control'):
            st, bb = 0xB0, [0xB0, int(index) - 1, int(value)]
        elif m.startswith('pitch'):
            st = 0xE0
    if st == 0x90 and len(bb) > 2:
        if bb[2] > 0:
            lst = b.fetch('notas', None, storeDefault=False) or []
            lst.append((bb[2] / 127.0, bb[1]))
            b.store('notas', lst[-16:])
        return
    if st == 0xB0 and len(bb) > 2:
        cc, val = bb[1], bb[2]
        if cc in CC:
            _par(CC[cc], val / 127.0)
        elif cc == PALETA_CC and b.par['Paleta'] is not None:
            names = b.par.Paleta.menuNames
            b.par.Paleta.val = names[min(len(names) - 1, val // 16 - 1 if val >= 16 else 0)]
        return
    if st == 0xE0:
        if len(bb) > 2:
            b.store('bend', (((bb[2] << 7) | bb[1]) - 8192) / 8192.0)
        else:
            x = float(value)
            b.store('bend', (x - 8192) / 8192.0 if abs(x) > 2 else x)
    return
