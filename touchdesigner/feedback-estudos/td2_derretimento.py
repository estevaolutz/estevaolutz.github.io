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

#  PROJETO TD 2 — DERRETIMENTO
#  Pixel sorting por realimentação: cada pixel do quadro anterior escorre para baixo
#  com velocidade proporcional ao próprio brilho — os claros caem mais rápido e
#  ordenam a imagem como cera derretendo. A câmera é invisível: só o MOVIMENTO
#  (diferença entre o quadro atual e o anterior) injeta cor no laço.
#  Truque: um segundo Feedback TOP apontado para a própria câmera devolve o quadro
#  anterior dela — é assim que se mede o movimento sem Cache TOP.
#  Rede:
#    camera ─► cam ─► cam_anterior (Feedback TOP, alvo = cam)
#    fundo ─► laco (Feedback TOP, alvo = saida) ─► derrete (GLSL: laco, cam, cam_anterior) ─► saida
NOME = 'derretimento'
pai = op('/project1') or root
if pai.op(NOME): pai.op(NOME).destroy()
c = pai.create(baseCOMP, NOME)
controles(c, [
    ('Queda',     'Velocidade da queda',     1.2, 0.0, 6.0),
    ('Ordenacao', 'Força da ordenação (brilho→velocidade)', 2.0, 0.0, 6.0),
    ('Ondulacao', 'Ondulação lateral',       0.6, 0.0, 4.0),
    ('Memoria',   'Memória (decaimento)',    0.992, 0.9, 1.0),
    ('Matiz',     'Deriva de cor',           0.004, -0.05, 0.05),
    ('Limiar',    'Limiar de movimento',     0.06, 0.0, 0.4),
    ('Injecao',   'Força da injeção',        0.85, 0.0, 1.0),
    ('Somganho',  'Sensibilidade do som',    1.0, 0.0, 5.0),
    ('Limpar',    'Limpar (segure)',         False, 0, 1),
])

shader = novo(c, textDAT, 'shader_derrete', 400, 250)
shader.text = '''// Derretimento — pixel sorting por feedback
uniform vec4 uTime;   // x tempo, y nível do som
uniform vec4 uA;      // x queda, y ondulação, z memória, w matiz
uniform vec4 uB;      // x limiar, y injeção, z ordenação
layout(location = 0) out vec4 fragColor;

vec3 hueRot(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a);
    return c*ca + cross(k,c)*sin(a) + k*dot(k,c)*(1.-ca); }
float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }

void main(){
    vec2 uv = vUV.st;
    vec2 px = uTD2DInfos[0].res.xy;
    float t = uTime.x, lvl = uTime.y;
    vec3 aqui = texture(sTD2DInputs[0], uv).rgb;
    // quanto mais claro o pixel acima, mais rápido ele cai
    vec3 acima = texture(sTD2DInputs[0], uv + vec2(0., px.y * 6.)).rgb;
    float vel = uA.x * (.25 + lum(acima) * uB.z) * (1. + lvl * 4.);
    float onda = uA.y * sin(uv.y * 38. + t * 1.1 + uv.x * 6.) * px.x * 2.;
    vec3 c = texture(sTD2DInputs[0], uv + vec2(onda, vel * px.y * 3.)).rgb;
    c = mix(c, max(c, aqui * .97), .25);                // cera: o rastro gruda um pouco
    c = hueRot(c, uA.w * 6.28318) * uA.z;
    // câmera invisível: só o movimento entra
    vec2 cu = vec2(1. - uv.x, uv.y);
    vec3 cam = texture(sTD2DInputs[1], cu).rgb;
    vec3 ant = texture(sTD2DInputs[2], cu).rgb;
    float mv = smoothstep(uB.x, uB.x + .12, lum(abs(cam - ant)));
    c = mix(c, hueRot(cam * 1.35, t * .07), mv * uB.y);
    fragColor = TDOutputSwizzle(vec4(min(c, vec3(4.)), 1.));
}
'''

camera = novo(c, videodeviceinTOP, 'camera', 0, 150)
cam = novo(c, nullTOP, 'cam', 200, 150, [camera])
cam_ant = novo(c, feedbackTOP, 'cam_anterior', 400, 150, [cam])
setp(cam_ant, 'top', cam.name)

fundo = novo(c, constantTOP, 'fundo', 0, 0)
setp(fundo, 'outputresolution', 'custom'); setp(fundo, 'resolutionw', 1920); setp(fundo, 'resolutionh', 1080)
setp(fundo, 'colorr', 0); setp(fundo, 'colorg', 0); setp(fundo, 'colorb', 0); setp(fundo, 'alpha', 1)
setp(fundo, 'format', 'rgba16float')

laco = novo(c, feedbackTOP, 'laco', 200, 0, [fundo])
setx(laco, 'reset', 'parent().par.Limpar')
der = novo(c, glslTOP, 'derrete', 600, 0, [laco, cam, cam_ant])
setp(der, 'pixeldat', shader.name)
setp(der, 'format', 'rgba16float')
uniforms(der, [
    ('uTime', ('absTime.seconds', NIVEL, 0, 0)),
    ('uA', ('parent().par.Queda', 'parent().par.Ondulacao', 'parent().par.Memoria', 'parent().par.Matiz')),
    ('uB', ('parent().par.Limiar', 'parent().par.Injecao', 'parent().par.Ordenacao', 0)),
])
saida = novo(c, nullTOP, 'saida', 800, 0, [der])
setp(laco, 'top', saida.name)

audio(c, 0, 400)
janela(c, saida, 1000, 0)
saida.viewer = True
fim(c)
