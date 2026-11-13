# Rosto de Luz v4 — a cada quadro: modulação e pontos (mantém as mãos vivas mesmo sem rosto)
def onFrameStart(frame):
    op('modulacao').cook(force=True)
    op('pontos_3d').cook(force=True)
    return
