#  ─────────────────────────────────────────────────────────────────────────
#  Como usar: abra o TouchDesigner, Alt+T (Textport) e rode
#     exec(open(r'/caminho/para/ESTE_ARQUIVO.py', encoding='utf-8').read())
#  O script cria (ou recria) um Base COMP em /project1 com a rede completa,
#  um painel de controles próprio (aba "Controles" do COMP) e uma janela de saída.
#  ─────────────────────────────────────────────────────────────────────────
import math

_avisos = []
def _par(o, nome):
    try:
        return getattr(o.par, nome)
    except Exception:
        return None
def setp(o, nome, valor):
    p = _par(o, nome)
    if p is None:
        _avisos.append('%s: parâmetro "%s" não existe nesta versão' % (o.name, nome)); return
    try:
        p.val = valor
    except Exception as e:
        _avisos.append('%s.%s = %r falhou (%s)' % (o.name, nome, valor, e))
def setx(o, nome, expr):
    p = _par(o, nome)
    if p is None:
        _avisos.append('%s: parâmetro "%s" não existe nesta versão' % (o.name, nome)); return
    p.expr = expr
    p.mode = ParMode.EXPRESSION
def novo(comp, tipo, nome, x, y, entradas=()):
    o = comp.create(tipo, nome)
    o.nodeX, o.nodeY = x, y
    for i, src in enumerate(entradas):
        o.inputConnectors[i].connect(src)
    return o
def uniforms(glsl, lista):
    """lista de (nome, (exprX, exprY, exprZ, exprW)) -> página Vectors do GLSL TOP"""
    try:
        glsl.seq.vec.numBlocks = max(len(lista), 1)   # TD 2022+: Vectors é uma sequência
    except Exception:
        pass
    for i, (nome, comps) in enumerate(lista):
        setp(glsl, 'vec%dname' % i, nome)
        for c, ex in zip('xyzw', comps):
            setx(glsl, 'vec%dvalue%s' % (i, c), str(ex))
def controles(comp, specs):
    """specs: (Nome, rótulo, padrão, mín, máx) ; Nome precisa começar com maiúscula"""
    pg = comp.appendCustomPage('Controles')
    for nome, rot, val, lo, hi in specs:
        if isinstance(val, bool):
            p = pg.appendToggle(nome, label=rot)[0]
        else:
            p = pg.appendFloat(nome, label=rot)[0]
            p.normMin, p.normMax = lo, hi
        p.default = val; p.val = val
def janela(comp, alvo, x, y):
    w = novo(comp, windowCOMP, 'janela', x, y)
    setp(w, 'winop', alvo.path)
    setp(w, 'borders', False)
    return w
def audio(comp, x, y):
    """microfone -> RMS -> suavização  (op 'nivel', canal 0, 0..~1)"""
    mic = novo(comp, audiodeviceinCHOP, 'mic', x, y)
    rms = novo(comp, analyzeCHOP, 'rms', x + 150, y, [mic])
    setp(rms, 'function', 'rmspower')
    lag = novo(comp, lagCHOP, 'nivel_bruto', x + 300, y, [rms])
    setp(lag, 'lag1', 0.02); setp(lag, 'lag2', 0.35)
    m = novo(comp, mathCHOP, 'nivel', x + 450, y, [lag])
    setx(m, 'gain', 'parent().par.Somganho * 4')
    return m
NIVEL = "(op('nivel')[0].eval() if op('nivel') and op('nivel').numChans else 0)"
def fim(comp):
    print('─' * 60)
    print('Pronto: %s' % comp.path)
    print('Controles: selecione o COMP e abra a aba "Controles" (tecla P).')
    print("Janela de saída: op('%s/janela').par.winopen.pulse()" % comp.path)
    if _avisos:
        print('Avisos (a rede funciona, mas confira):')
        for a in _avisos: print('  · ' + a)
    print('─' * 60)

#  PROJETO TD 3 — BORDAS EM PROFUNDIDADE
#  Feedback clássico só com operadores nativos (sem GLSL), para estudar cada etapa:
#  as bordas da câmera entram num laço que a cada quadro amplia um pouco (Transform),
#  gira a cor (HSV Adjust), esmaece (Level/opacidade) e soma de volta (Composite add).
#  As camadas antigas ficam "atrás" das novas: um túnel pseudo-3D feito de contornos.
#  O som empurra o zoom e alonga a memória. A câmera em si nunca aparece — só as bordas.
#  Rede:
#    camera ─► espelho ─► bordas (Edge) ─► nivel_bordas ─┬───────────────► soma (Composite máximo) ─► saida
#                                                        └► laco (Feedback) ─► zoom ─► cor ─► memoria ─┘
NOME = 'bordas_em_profundidade'
pai = op('/project1') or root
if pai.op(NOME): pai.op(NOME).destroy()
c = pai.create(baseCOMP, NOME)
# câmera compartilhada: no Mac só um Video Device In pode abrir a câmera por vez
camera_global = pai.op('camera') or pai.create(videodeviceinTOP, 'camera')
camera_global.nodeX, camera_global.nodeY = -300, -300
controles(c, [
    ('Zoom',      'Zoom por quadro',        1.012, 0.97, 1.06),
    ('Rotacao',   'Rotação por quadro (graus)', 0.25, -5.0, 5.0),
    ('Deslocx',   'Deriva horizontal',      0.0, -0.01, 0.01),
    ('Deslocy',   'Deriva vertical',        0.0, -0.01, 0.01),
    ('Matiz',     'Giro de cor por quadro (graus)', 4.0, -30.0, 30.0),
    ('Memoria',   'Memória (opacidade no laço)', 0.94, 0.5, 0.995),
    ('Bordas',    'Força das bordas',       2.0, 0.0, 20.0),
    ('Desfoque',  'Desfoque no laço',       0.0, 0.0, 6.0),
    ('Somganho',  'Sensibilidade do som',   1.0, 0.0, 5.0),
    ('Limpar',    'Limpar (segure)',        False, 0, 1),
])

camera = novo(c, selectTOP, 'camera', 0, 0)
setp(camera, 'top', camera_global.path)
esp = novo(c, flipTOP, 'espelho', 150, 0, [camera]); setp(esp, 'flipx', True)
bordas = novo(c, edgeTOP, 'bordas', 300, 0, [esp])
setx(bordas, 'strength', 'parent().par.Bordas')
setp(bordas, 'blacklevel', 0.18)                     # corta o ruído da câmera
for ch, fase in (('r', 0), ('g', 2.094), ('b', 4.188)):   # cor das bordas gira devagar
    setx(bordas, 'edgecolor' + ch, '0.55+0.45*math.sin(absTime.seconds*0.35+%s)' % fase)
preto = novo(c, constantTOP, 'preto', 300, -120)
setp(preto, 'outputresolution', 'custom'); setp(preto, 'resolutionw', 1280); setp(preto, 'resolutionh', 720)
setp(preto, 'colorr', 0); setp(preto, 'colorg', 0); setp(preto, 'colorb', 0); setp(preto, 'alpha', 1)
sobre = novo(c, compositeTOP, 'sobre_preto', 375, 0, [bordas, preto]); setp(sobre, 'operand', 'over')
nb = novo(c, levelTOP, 'nivel_bordas', 450, 0, [sobre])
setp(nb, 'format', 'rgba16float')

laco = novo(c, feedbackTOP, 'laco', 450, -200, [nb])
setx(laco, 'reset', 'parent().par.Limpar')
zoom = novo(c, transformTOP, 'zoom', 600, -200, [laco])
ZE = 'parent().par.Zoom * (1 + %s * 0.03)' % NIVEL
setx(zoom, 'sx', ZE); setx(zoom, 'sy', ZE)
setx(zoom, 'rotate', 'parent().par.Rotacao')
setx(zoom, 'tx', 'parent().par.Deslocx + 0.003*math.sin(absTime.seconds*0.13)')
setx(zoom, 'ty', 'parent().par.Deslocy + 0.003*math.cos(absTime.seconds*0.11)')
setp(zoom, 'extend', 'zero')
cor = novo(c, hsvadjustTOP, 'cor', 750, -200, [zoom])
setx(cor, 'hueoffset', 'parent().par.Matiz')
desf = novo(c, blurTOP, 'desfoque', 900, -200, [cor])
setx(desf, 'size', 'parent().par.Desfoque')
mem = novo(c, levelTOP, 'memoria', 1050, -200, [desf])
setx(mem, 'opacity', 'min(0.999, parent().par.Memoria + %s * 0.04)' % NIVEL)

soma = novo(c, compositeTOP, 'soma', 1200, 0, [nb, mem])
setp(soma, 'operand', 'maximum')   # 'add' satura; máximo mantém o túnel limpo
saida = novo(c, nullTOP, 'saida', 1350, 0, [soma])
setp(laco, 'top', saida.name)

audio(c, 0, 300)
janela(c, saida, 1500, 0)
saida.viewer = True
fim(c)
