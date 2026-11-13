# Rosto de Luz v4 — acrescenta mãos, efeitos pelo som e MIDI do Sub Phatty ao Cabeca_de_Luz
import os
D = os.path.expanduser('~/Desktop/rosto_de_luz_scripts/')
b = op('/project1/Cabeca_de_Luz')
log = []

def txt(n): return open(D + n, encoding='utf-8').read()

def expr(o, n, e):
    p = getattr(o.par, n); p.expr = e; p.mode = ParMode.EXPRESSION

# 1. código novo
b.op('cabeca_callbacks').text = txt('rdl_v4_cabeca_callbacks_v4.py')
b.op('cabeca_vertex').text = txt('rdl_v4_cabeca_vertex_v4.glsl')

# 2. painel
def page(n):
    for pg in b.customPages:
        if pg.name == n:
            return pg
    return b.appendCustomPage(n)
def F(pg, n, lab, lo, hi, d):
    if b.par[n] is not None: return
    p = pg.appendFloat(n, label=lab)[0]
    p.normMin, p.normMax, p.min, p.max = lo, hi, lo, hi
    p.clampMin = p.clampMax = True; p.default = d; p.val = d
def I(pg, n, lab, lo, hi, d):
    if b.par[n] is not None: return
    p = pg.appendInt(n, label=lab)[0]
    p.normMin, p.normMax, p.min, p.max = lo, hi, lo, hi
    p.clampMin = p.clampMax = True; p.default = d; p.val = d
def T(pg, n, lab, d):
    if b.par[n] is not None: return
    p = pg.appendToggle(n, label=lab)[0]; p.default = d; p.val = d

pg = page('Mãos')
T(pg, 'Maos', 'Mãos', True)
I(pg, 'Pontosmao', 'Pontos por mão', 500, 20000, 6000)
F(pg, 'Brilhomaos', 'Brilho das mãos', 0, 2, 0.6)
F(pg, 'Escalamao', 'Tamanho das mãos', 0.2, 2, 0.8)
F(pg, 'Espacomao', 'Espaço das mãos na tela', 0.3, 1.2, 0.9)
pg = page('Som')
T(pg, 'Somativo', 'Som controla os efeitos', True)
F(pg, 'Ganho', 'Ganho da entrada', 0, 10, 1.0)
F(pg, 'Sompulso', 'Volume → pulsação', 0, 2, 0.6)
F(pg, 'Somgraves', 'Graves → dispersão', 0, 1, 0.4)
F(pg, 'Somagudos', 'Agudos → cintilar', 0, 1, 0.5)
F(pg, 'Somataques', 'Ataques → glitch e scanner', 0, 2, 0.6)
pg = page('MIDI')
T(pg, 'Midiativo', 'MIDI do Sub Phatty ativo', True)
F(pg, 'Notaexplosao', 'Notas → explosão', 0, 2, 0.6)
F(pg, 'Retorno', 'Retorno da explosão', 0, 1, 0.4)
F(pg, 'Notacor', 'Notas → cor', 0, 1, 1.0)

# 3. operadores novos
def mk(t, n, x, y):
    o = b.op(n) or b.create(t, n)
    o.nodeX, o.nodeY = x, y
    return o
som = mk(audiodeviceinCHOP, 'som_entrada', -800, -600)
mcb = mk(textDAT, 'modulacao_callbacks', -800, -750); mcb.text = txt('rdl_v4_modulacao_callbacks.py')
mod = mk(scriptCHOP, 'modulacao', -600, -600); mod.par.callbacks = mcb
midcb = mk(textDAT, 'midi_callbacks', -800, -900); midcb.text = txt('rdl_v4_midi_callbacks.py')
mid = mk(midiinDAT, 'midi_subphatty', -600, -900)
mid.par.callbacks = midcb; mid.par.bytes = True; mid.par.active = True
qx = mk(executeDAT, 'a_cada_quadro', -400, -900); qx.text = txt('rdl_v4_quadro_execute.py')
qx.par.framestart = True; qx.par.active = True

# 4. ligações dos efeitos com o som e o MIDI
M = "op('modulacao')['%s']"
luz = b.op('luz')
expr(luz, 'vec0valuex', "parent().par.Tamanho * (1 + %s)" % (M % 'tamanho'))
expr(luz, 'vec0valuey', "parent().par.Intensidade * (1 + %s)" % (M % 'intensidade'))
expr(luz, 'vec1valuew', "(parent().par.Tom + %s) %% 1" % (M % 'tom'))
expr(luz, 'vec2valuex', "min(1, parent().par.Cintilar + %s)" % (M % 'cintilar'))
expr(luz, 'vec2valuez', "parent().par.Respiracao + %s" % (M % 'respiracao'))
expr(luz, 'vec3valuex', "parent().par.Dispersao + %s" % (M % 'dispersao'))
expr(luz, 'vec3valuey', "parent().par.Vortice + %s" % (M % 'vortice'))
expr(luz, 'vec3valuez', "parent().par.Scanner + %s" % (M % 'scanner'))
expr(luz, 'vec3valuew', "min(1, parent().par.Glitch + %s)" % (M % 'glitch'))
expr(luz, 'vec4valuez', "parent().par.Brilhomaos")
expr(b.op('halo_nivel'), 'brightness1', "parent().par.Brilho + %s" % (M % 'brilho'))
expr(b.op('cabeca'), 'ry', "parent().par.Giro + absTime.seconds * parent().par.Autogiro * 40 + %s" % (M % 'giro'))

for o in (b.op('pontos_3d'), mod, b.op('luz'), som, mid):
    e = o.errors() or o.warnings()
    if e: log.append('%s: %s' % (o.name, e))
result['output'] = 'v4 aplicado. ' + ('; '.join(log) if log else 'sem erros')
