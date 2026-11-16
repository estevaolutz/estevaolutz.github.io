# Câmera Logitech nos projetos do TouchDesigner (Rosto de Luz, Feedback Digital, Dedalus TD,
# Tudo o que você disser, Explode, Dente de Leão TD...).
#
# Como usar: com o .toe aberto, abra a Textport (Alt+T / Option+T) e rode:
#     exec(open('/CAMINHO/camera_logitech.py').read())
# ou cole este arquivo num Text DAT e clique com o botão direito > Run Script.
#
# O script procura, no projeto inteiro, todo Video Device In TOP e todo componente com um
# parâmetro de câmera (ex.: o componente MediaPipe, parâmetro "Webcam") e escolhe a Logitech.
# Para voltar à câmera do Mac, rode de novo com PREFERIDA = 'FaceTime'.

PREFERIDA = 'Logitech'          # parte do nome da câmera (Logitech, BRIO, C920, FaceTime...)
CHAVES_DOS_PARAMETROS = ('device', 'webcam', 'camera', 'videodevice')


def _escolher(par):
    try:
        nomes, rotulos = list(par.menuNames), list(par.menuLabels)
    except Exception:
        return False
    for nome, rotulo in zip(nomes, rotulos):
        if PREFERIDA.lower() in (rotulo or '').lower() or PREFERIDA.lower() in (nome or '').lower():
            if par.eval() != nome:
                par.val = nome
            print('  %s.%s -> %s' % (par.owner.path, par.name, rotulo))
            return True
    return False


achou = 0
for o in root.findChildren(depth=None):
    alvo = []
    if o.OPType == 'videodeviceinTOP':
        alvo = [o.par.device]
    else:
        alvo = [p for p in o.customPars if p.isMenu and any(k in p.name.lower() for k in CHAVES_DOS_PARAMETROS)]
    for p in alvo:
        if _escolher(p):
            achou += 1

if achou:
    print('Câmera "%s" escolhida em %d lugar(es).' % (PREFERIDA, achou))
else:
    print('Nenhuma câmera com "%s" no nome foi encontrada. Confira se ela está conectada e '
          'aparece no parâmetro Device do Video Device In TOP.' % PREFERIDA)
