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

#  PROJETO TD 1 — FRACTAL DE VÍDEO
#  Feedback iterado (IFS): a cada quadro, N cópias reduzidas e giradas do quadro
#  anterior são somadas. Como na experiência clássica de câmera-apontada-para-monitor
#  com vários monitores, o laço converge para um atrator fractal que respira com o som.
#  Rede:  fundo ─► laco (Feedback TOP) ─► fractal (GLSL TOP) ─► saida ─┐
#                    ▲          semente (Noise TOP) ─┘                    │
#                    └───────────────── Target TOP ─────────────────────┘
NOME = 'fractal_de_video'
pai = op('/project1') or root
if pai.op(NOME): pai.op(NOME).destroy()
c = pai.create(baseCOMP, NOME)
controles(c, [
    ('Copias',   'Cópias (2–6)',        3.0, 2, 6),
    ('Escala',   'Escala de cada cópia', 0.52, 0.3, 0.8),
    ('Abertura', 'Distância entre cópias', 0.42, 0.0, 0.8),
    ('Rotacao',  'Rotação',             0.35, -3.1416, 3.1416),
    ('Torcao',   'Torção ao longo do tempo', 0.6, 0.0, 3.0),
    ('Memoria',  'Memória (decaimento)', 0.93, 0.5, 1.0),
    ('Matiz',    'Deriva de cor',        0.03, -0.3, 0.3),
    ('Semente',  'Quantidade de semente', 0.25, 0.0, 1.0),
    ('Deriva',   'Deriva aleatória',     0.5, 0.0, 1.0),
    ('Somganho', 'Sensibilidade do som', 1.0, 0.0, 5.0),
    ('Limpar',   'Limpar (segure)',      False, 0, 1),
])

shader = novo(c, textDAT, 'shader_fractal', 200, 250)
shader.text = '''// Fractal de vídeo — feedback iterado
uniform vec4 uTime;   // x tempo, y nível do som
uniform vec4 uA;      // x escala, y rotação, z abertura, w memória
uniform vec4 uB;      // x matiz, y cópias, z torção, w semente
layout(location = 0) out vec4 fragColor;

vec3 hueRot(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a);
    return c*ca + cross(k,c)*sin(a) + k*dot(k,c)*(1.-ca); }

void main(){
    vec2 uv  = vUV.st;
    vec2 res = uTDOutputInfo.res.zw;
    float asp = res.x / res.y;
    float t = uTime.x, lvl = uTime.y;
    vec2 p = uv - .5; p.x *= asp;
    int N = int(clamp(uB.y, 2., 6.) + .5);
    float sc = uA.x * (1. + lvl*.12);
    vec3 acc = vec3(0.);
    for (int i = 0; i < 6; i++){
        if (i >= N) break;
        float ang = 6.28318 * float(i) / float(N) + t * .05 * uB.z;
        vec2 off = vec2(cos(ang), sin(ang)) * uA.z * (1. + lvl*.3);
        float r = uA.y + ang * .25 * uB.z;
        mat2 R = mat2(cos(r), -sin(r), sin(r), cos(r));
        vec2 q = R * (p - off) / sc;          // mapa inverso: de onde vem este pixel
        q.x /= asp; q += .5;
        vec3 c = (q.x < 0. || q.y < 0. || q.x > 1. || q.y > 1.) ? vec3(0.) : texture(sTD2DInputs[0], q).rgb;
        acc = max(acc, hueRot(c, float(i) * .15));   // união das cópias
    }
    acc = hueRot(acc, uB.x * 6.28318) * uA.w;
    // semente: o ruído entra no centro e alimenta o atrator
    vec3 seed = texture(sTD2DInputs[1], uv).rgb;
    float mask = smoothstep(.10 + lvl*.25, 0., length(p));
    acc += seed * mask * (uB.w + lvl*2.);
    fragColor = TDOutputSwizzle(vec4(min(acc, vec3(4.)), 1.));
}
'''

fundo = novo(c, constantTOP, 'fundo', 0, 0)
setp(fundo, 'outputresolution', 'custom'); setp(fundo, 'resolutionw', 1920); setp(fundo, 'resolutionh', 1080)
setp(fundo, 'colorr', 0); setp(fundo, 'colorg', 0); setp(fundo, 'colorb', 0); setp(fundo, 'alpha', 1)
setp(fundo, 'format', 'rgba16float')

semente = novo(c, noiseTOP, 'semente', 0, -150)
setp(semente, 'outputresolution', 'custom'); setp(semente, 'resolutionw', 1920); setp(semente, 'resolutionh', 1080)
setp(semente, 'mono', False); setp(semente, 'period', 0.35); setp(semente, 'harmon', 3)
setx(semente, 'tz', 'absTime.seconds * 0.4')

laco = novo(c, feedbackTOP, 'laco', 200, 0, [fundo])
setx(laco, 'reset', 'parent().par.Limpar')

fr = novo(c, glslTOP, 'fractal', 400, 0, [laco, semente])
setp(fr, 'pixeldat', shader.name)
setp(fr, 'format', 'rgba16float')
D = 'parent().par.Deriva'
uniforms(fr, [
    ('uTime', ('absTime.seconds', NIVEL, 0, 0)),
    ('uA', ('parent().par.Escala + %s*0.04*math.sin(absTime.seconds*0.071)' % D,
            'parent().par.Rotacao + %s*0.6*math.sin(absTime.seconds*0.043)*math.cos(absTime.seconds*0.017)' % D,
            'parent().par.Abertura + %s*0.12*math.sin(absTime.seconds*0.059+1.3)' % D,
            'parent().par.Memoria')),
    ('uB', ('parent().par.Matiz', 'parent().par.Copias', 'parent().par.Torcao', 'parent().par.Semente')),
])
saida = novo(c, nullTOP, 'saida', 600, 0, [fr])
setp(laco, 'top', saida.name)

audio(c, 0, 300)
janela(c, saida, 800, 0)
saida.viewer = True
fim(c)
