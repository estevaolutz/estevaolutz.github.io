# Rosto de Luz v5 — efeito espectrômetro nos pontos, modulado pelo microfone
import os
D = os.path.expanduser('~/Desktop/rosto_de_luz_scripts/')
b = op('/project1/Cabeca_de_Luz')
def txt(n): return open(D + n, encoding='utf-8').read()
def expr(o, n, e):
    p = getattr(o.par, n); p.expr = e; p.mode = ParMode.EXPRESSION

pg = None
for g in b.customPages:
    if g.name == 'Espectro': pg = g
if pg is None: pg = b.appendCustomPage('Espectro')
def F(n, lab, lo, hi, d):
    if b.par[n] is not None: return
    p = pg.appendFloat(n, label=lab)[0]
    p.normMin, p.normMax, p.min, p.max = lo, hi, lo, hi
    p.clampMin = p.clampMax = True; p.default = d; p.val = d
F('Espectro', 'Espectrômetro (quantidade)', 0, 2, 1.0)
if b.par['Espectromodo'] is None:
    m = pg.appendMenu('Espectromodo', label='Modo')[0]
    m.menuNames = ['barras', 'radial', 'cascata']
    m.menuLabels = ['Barras (graves embaixo)', 'Radial (graves no centro)', 'Cascata (espectrograma)']
    m.default = 'barras'; m.val = 'barras'
F('Espectrocor', 'Cor do espectro', 0, 1, 0.7)
F('Espectroaltura', 'Altura dos picos', 0, 2, 0.8)
F('Espectroganho', 'Ganho do microfone', 0.1, 10, 1.5)
F('Espectrosuave', 'Suavização', 0, 0.95, 0.5)

cb = b.op('espectro_callbacks') or b.create(textDAT, 'espectro_callbacks')
cb.text = txt('rdl_v5_espectro_callbacks.py'); cb.nodeX, cb.nodeY = -800, -1050
es = b.op('espectro') or b.create(scriptCHOP, 'espectro')
es.par.callbacks = cb; es.nodeX, es.nodeY = -600, -1050
tex = b.op('espectro_tex') or b.create(choptoTOP, 'espectro_tex')
tex.par.chop = es; tex.nodeX, tex.nodeY = -400, -1050
try: tex.par.format = 'r32float'
except Exception: pass

luz = b.op('luz')
luz.seq.vec.numBlocks = max(luz.seq.vec.numBlocks, 7)
luz.seq.sampler.numBlocks = max(luz.seq.sampler.numBlocks, 2)
luz.par.vec6name = 'uS'
expr(luz, 'vec6valuex', "parent().par.Espectro")
expr(luz, 'vec6valuey', "parent().par.Espectromodo.menuIndex")
expr(luz, 'vec6valuez', "parent().par.Espectrocor")
expr(luz, 'vec6valuew', "parent().par.Espectroaltura")
luz.par.sampler1name = 'sSpec'
luz.par.sampler1top = tex
try:
    luz.par.sampler1extendu = 'hold'; luz.par.sampler1extendv = 'hold'
except Exception: pass
b.op('cabeca_vertex').text = txt('rdl_v5_cabeca_vertex.glsl')

q = b.op('a_cada_quadro')
if 'espectro' not in q.text:
    q.text = q.text.replace("    op('modulacao').cook(force=True)", "    op('modulacao').cook(force=True)\n    op('espectro').cook(force=True)")
es.cook(force=True)
log = ['%s: %s' % (o.name, o.errors() or o.warnings()) for o in (es, tex, luz) if (o.errors() or o.warnings())]
result['output'] = 'v5 espectro aplicado. tex %dx%d. %s' % (tex.width, tex.height, '; '.join(log) or 'sem erros')
