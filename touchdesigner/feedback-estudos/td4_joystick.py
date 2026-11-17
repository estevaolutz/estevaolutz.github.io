#  CONTROLE PELO JOYSTICK (USB estilo PlayStation 2) — rode depois dos scripts 1, 2 e 3.
#  exec(open(r'/caminho/td4_joystick.py', encoding='utf-8').read())
#  Cria em /project1: joystick (Joystick CHOP), joystick_mapa (o mapa, editável),
#  joystick_quadro (Execute DAT que roda o mapa a cada quadro), ativa (Select TOP)
#  e tela (Window COMP que mostra a obra ativa).
p = op('/project1')
j = p.op('joystick') or p.create(joystickCHOP, 'joystick')
j.nodeX, j.nodeY = -300, -500
j.par.buttonarray = 'b[1-12]'
j.par.connected = 'conectado'
nomes = j.par.source.menuNames
if len(nomes) > 1: j.par.source = nomes[1]          # primeiro joystick encontrado
MAPA = r'''# Controle dos estudos de feedback pelo joystick (USB estilo PlayStation 2)
# Os sticks e o direcional EMPURRAM os parâmetros (velocidade proporcional à inclinação),
# então os sliders da aba Controles continuam funcionando junto.
import random

OBRAS = ['fractal_de_video', 'derretimento', 'bordas_em_profundidade']
# LX/LY = stick esquerdo, RX/RY = stick direito, PX/PY = direcional
EIXOS = {
    'fractal_de_video':       {'LX': 'Rotacao',  'LY': 'Escala', 'RX': 'Abertura', 'RY': 'Torcao',    'PY': 'Memoria', 'PX': 'Matiz'},
    'derretimento':           {'LX': 'Ondulacao','LY': 'Queda',  'RX': 'Matiz',    'RY': 'Ordenacao', 'PY': 'Memoria', 'PX': 'Limiar'},
    'bordas_em_profundidade': {'LX': 'Rotacao',  'LY': 'Zoom',   'RX': 'Deslocx',  'RY': 'Deslocy',   'PY': 'Memoria', 'PX': 'Matiz'},
}
CICLO = {   # botão □: percorre valores
    'fractal_de_video':       ('Copias',   [2, 3, 4, 5, 6]),
    'derretimento':           ('Injecao',  [0.3, 0.6, 0.85, 1.0]),
    'bordas_em_profundidade': ('Desfoque', [0, 0.5, 1.5, 3]),
}
# adaptador PS2 (Microntek): 1 △  2 ○  3 ✕  4 □  5 L2  6 R2  7 L1  8 R1  9 Select  10 Start
BOTAO = {'limpar': 3, 'acaso': 1, 'padrao': 2, 'ciclo': 4,
         'anterior': 7, 'proxima': 8, 'som_menos': 5, 'som_mais': 6, 'tela': 10}
VELOCIDADE = 0.5      # fração da faixa do slider por segundo com o stick todo inclinado
ZONA_MORTA = 0.12

def _ch(j, nome):
    c = j.chan(nome)
    return c.eval() if c is not None else 0.0
def _eixo(v):
    return 0.0 if abs(v) < ZONA_MORTA else (v - ZONA_MORTA * (1 if v > 0 else -1)) / (1 - ZONA_MORTA)
def _obra():
    i = int(parent().fetch('obra_ativa', 0)) % len(OBRAS)
    return i, op('/project1/' + OBRAS[i])
def ativar(i):
    i %= len(OBRAS)
    parent().store('obra_ativa', i)
    op('/project1/ativa').par.top = '/project1/%s/%s' % (OBRAS[i], 'final' if OBRAS[i] == 'fractal_de_video' else 'saida')
    print('Joystick → ' + OBRAS[i])
def _empurra(comp, nome, v, dt):
    par = getattr(comp.par, nome, None)
    if par is None or v == 0: return
    lo, hi = par.normMin, par.normMax
    par.val = min(hi, max(lo, par.eval() + v * (hi - lo) * VELOCIDADE * dt))

def quadro():
    j = op('/project1/joystick')
    if j is None or j.numChans == 0: return
    dt = 1.0 / max(1, project.cookRate)
    i, comp = _obra()
    if comp is None: return
    lx, ly = _eixo(_ch(j, 'xaxis')), -_eixo(_ch(j, 'yaxis'))
    rxa, rxb = _eixo(_ch(j, 'zaxis')), _eixo(_ch(j, 'xrot'))
    rya, ryb = _eixo(_ch(j, 'zrot')), _eixo(_ch(j, 'yrot'))
    rx = rxa if abs(rxa) >= abs(rxb) else rxb
    ry = -(rya if abs(rya) >= abs(ryb) else ryb)
    vals = {'LX': lx, 'LY': ly, 'RX': rx, 'RY': ry, 'PX': _ch(j, 'p1_X'), 'PY': _ch(j, 'p1_Y')}
    for eixo, nome in EIXOS[comp.name].items():
        _empurra(comp, nome, vals[eixo], dt)
    b = {k: _ch(j, 'b%d' % n) > 0.5 for k, n in BOTAO.items()}
    antes = parent().fetch('botoes_antes', {})
    if b['limpar'] != antes.get('limpar', False): comp.par.Limpar = b['limpar']
    aperto = {k: v and not antes.get(k, False) for k, v in b.items()}
    parent().store('botoes_antes', b)
    if aperto['proxima']: ativar(i + 1)
    if aperto['anterior']: ativar(i - 1)
    if aperto['acaso']:
        for nome in EIXOS[comp.name].values():
            par = getattr(comp.par, nome); par.val = random.uniform(par.normMin, par.normMax)
    if aperto['padrao']:
        for nome in list(EIXOS[comp.name].values()) + [CICLO[comp.name][0]]:
            par = getattr(comp.par, nome); par.val = par.default
    if aperto['ciclo']:
        nome, valores = CICLO[comp.name]
        par = getattr(comp.par, nome)
        k = min(range(len(valores)), key=lambda n: abs(valores[n] - par.eval()))
        par.val = valores[(k + 1) % len(valores)]
    for nome_b, passo in (('som_menos', -0.25), ('som_mais', 0.25)):
        if aperto[nome_b]:
            comp.par.Somganho = min(5, max(0, comp.par.Somganho.eval() + passo))
    if aperto['tela']:
        t = op('/project1/tela')
        (t.par.winclose if t.isOpen else t.par.winopen).pulse()
'''
m = p.op('joystick_mapa') or p.create(textDAT, 'joystick_mapa')
m.text = MAPA; m.nodeX, m.nodeY = -150, -500
ex = p.op('joystick_quadro') or p.create(executeDAT, 'joystick_quadro')
ex.nodeX, ex.nodeY = 0, -500
ex.text = "def onFrameStart(frame):\n\top('/project1/joystick_mapa').module.quadro()\n\treturn\n"
ex.par.framestart = True; ex.par.active = True
at = p.op('ativa') or p.create(selectTOP, 'ativa'); at.nodeX, at.nodeY = 300, -500
tela = p.op('tela') or p.create(windowCOMP, 'tela'); tela.nodeX, tela.nodeY = 450, -500
tela.par.winop = at.path; tela.par.borders = False
m.module.ativar(0)
print('Joystick pronto: ' + str(j.par.source.eval()))
