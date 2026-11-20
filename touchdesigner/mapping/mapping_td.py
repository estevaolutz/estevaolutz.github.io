#  ─────────────────────────────────────────────────────────────────────────
#  MAPPING NO TOUCHDESIGNER — até 4 superfícies com 4 cantos cada (projetor HY300 ou outro)
#
#  Como usar: abra o TouchDesigner, Alt+T / Option+T (Textport) e rode
#     exec(open(r'/caminho/para/mapping_td.py', encoding='utf-8').read())
#  O script cria (ou recria) /project1/mapping com:
#    • aba "Mapping" do COMP: nº de superfícies, superfície e canto selecionados,
#      editar (mostra contorno e cantos), brilho, arquivo de vídeo, monitor do projetor
#    • abas "Superfície 1..4": conteúdo, cor, velocidade, densidade, reage ao som
#      e os 4 cantos (X e Y de 0 a 1, origem no canto de cima à esquerda)
#    • som: Audio Device In → nível (para os conteúdos que reagem ao som)
#    • saída 1280×720 numa janela no segundo monitor (o projetor)
#  Ajuste fino pelo teclado com a janela de saída em foco:
#    Tab = próximo canto · N = próxima superfície · setas = move 1 px (Shift = 10 px)
#    E = liga/desliga a edição · G = grade de teste em todas
#  Para usar um conteúdo seu (ex.: a saída do Dedalus, do Feedback Analógico...),
#  ligue o TOP dele na entrada 3 ("externo") de /project1/mapping/conteudo_N
#  e escolha "Externo" no Conteúdo da superfície.
#  ─────────────────────────────────────────────────────────────────────────

LARG, ALT = 1280, 720       # resolução nativa do HY300 — não use 4K
NSUP = 4

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
    for i, e in enumerate(entradas):
        if e is not None:
            o.inputConnectors[i].connect(e)
    return o
def res(o, w, h):
    setp(o, 'outputresolution', 'custom'); setp(o, 'resolutionw', w); setp(o, 'resolutionh', h)
def uniforme(glsl, i, nome, *exprs):
    setp(glsl, 'vec%dname' % i, nome)
    for comp, ex in zip('xyzw', exprs):
        if isinstance(ex, str):
            setx(glsl, 'vec%dvalue%s' % (i, comp), ex)
        else:
            setp(glsl, 'vec%dvalue%s' % (i, comp), ex)

# ─── shaders ────────────────────────────────────────────────────────────
CONTEUDO = r'''
// entradas: 0 = filme, 1 = câmera, 2 = ruído, 3 = externo
uniform vec4 uA;   // x = modo, y = tempo, z = velocidade, w = densidade
uniform vec4 uB;   // rgb = cor, w = nível do som (0 se não reage)
out vec4 fragColor;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  vec2 s = vec2(vUV.s, 1.0 - vUV.t);          // origem em cima à esquerda
  int m = int(uA.x + 0.5); float t = uA.y * uA.z * (1.0 + uB.w * 2.0); float den = uA.w;
  vec3 C = uB.rgb, c = vec3(0);
  float e = min(min(s.x,1.-s.x),min(s.y,1.-s.y));
  if (m == 0) {                                  // grade de teste
    vec2 g = abs(fract(s*8.+.5)-.5);
    float l = 1.-smoothstep(0.,.03,min(g.x,g.y));
    float b = 1.-smoothstep(0.,.012,e);
    float dg = 1.-smoothstep(0.,.006,min(abs(s.x-s.y),abs(s.x+s.y-1.)));
    float ci = 1.-smoothstep(0.,.008,abs(length(s-.5)-.3));
    c = vec3(.35)*l + vec3(1)*max(b,max(dg*.5,ci));
    vec3 k = vec3(1,0,0);                           // cantos: vermelho, verde, azul, amarelo
    if(s.x>.5&&s.y<.5)k=vec3(0,1,0); if(s.x>.5&&s.y>.5)k=vec3(.2,.4,1); if(s.x<.5&&s.y>.5)k=vec3(1,1,0);
    c = mix(c, k, 1.-smoothstep(.07,.08,length(vec2(min(s.x,1.-s.x),min(s.y,1.-s.y)))));
  } else if (m == 1) {                           // contorno com luz que corre
    float per;
    if(s.y<=s.x&&s.y<=1.-s.x)per=s.x; else if(1.-s.x<=s.y&&1.-s.x<=1.-s.y)per=1.+s.y;
    else if(1.-s.y<=s.x&&1.-s.y<=1.-s.x)per=3.-s.x; else per=4.-s.y;
    float gw = exp(-e*(30.+den*6.));
    float sp = pow(.5+.5*cos((per*.25-t*.25)*6.2831),24.);
    c = C*gw*.6 + mix(C,vec3(1),.5)*sp*smoothstep(.06,0.,e);
  } else if (m == 2) {                           // linhas que correm
    float f = fract(s.y*den*.5-t); c = C*smoothstep(0.,.08,f)*smoothstep(.35,.1,f);
  } else if (m == 3) {                           // pulso
    float d = length(s-.5)*2.; float f = fract(d*den*.25-t); c = C*pow(1.-f,4.)*smoothstep(1.42,1.,d);
  } else if (m == 4) {                           // fumaça (Noise TOP)
    c = C * smoothstep(.3,.9,texture(sTD2DInputs[2], vec2(s.x,1.-s.y)).r);
  } else if (m == 5) { c = texture(sTD2DInputs[0], vec2(s.x,1.-s.y)).rgb;   // filme
  } else if (m == 6) { c = texture(sTD2DInputs[1], vec2(s.x,1.-s.y)).rgb;   // câmera
  } else if (m == 7) { c = C;                                              // cor sólida
  } else if (m == 8) { c = vec3(0);                                        // preto (máscara)
  } else if (m == 9) { c = texture(sTD2DInputs[3], vec2(s.x,1.-s.y)).rgb; // externo
  } else if (m == 10) {                          // estrelas
    vec2 g = s*den*2.; vec2 id = floor(g); float r = h21(id);
    vec2 o = vec2(h21(id+3.1),h21(id+7.7))*.6+.2;
    c = C*smoothstep(.12,0.,length(fract(g)-o))*(.5+.5*sin(t*6.*(.3+r)+r*40.));
  }
  if (uB.w > 0.0) c *= .15 + uB.w * 1.6;
  fragColor = TDOutputSwizzle(vec4(c,1));
}
'''

WARP = r'''
uniform vec4 uP01;   // canto 1 (x,y) e canto 2 (x,y) — 0..1, origem em cima à esquerda
uniform vec4 uP23;   // canto 3 e canto 4 (sentido horário a partir de cima à esquerda)
uniform vec4 uEd;    // x = editar, y = esta é a selecionada, z = canto selecionado (0-3), w = brilho
uniform vec2 uRes;
out vec4 fragColor;
mat3 quadH(vec2 a, vec2 b, vec2 c, vec2 d){
  float sx=a.x-b.x+c.x-d.x, sy=a.y-b.y+c.y-d.y;
  float dx1=b.x-c.x, dx2=d.x-c.x, dy1=b.y-c.y, dy2=d.y-c.y;
  float den=dx1*dy2-dx2*dy1; if(abs(den)<1e-9) den=1e-9;
  float g=(sx*dy2-dx2*sy)/den, h=(dx1*sy-sx*dy1)/den;
  return mat3(b.x-a.x+g*b.x, b.y-a.y+g*b.y, g,
              d.x-a.x+h*d.x, d.y-a.y+h*d.y, h,
              a.x, a.y, 1.0);
}
float seg(vec2 p, vec2 a, vec2 b){vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h);}
void main(){
  vec2 P[4]; P[0]=uP01.xy; P[1]=uP01.zw; P[2]=uP23.xy; P[3]=uP23.zw;
  vec2 p = vec2(vUV.s, 1.0 - vUV.t);
  vec4 col = vec4(0);
  vec3 q = inverse(quadH(P[0],P[1],P[2],P[3])) * vec3(p,1.);
  if (q.z > 0.0) {
    vec2 s = q.xy / q.z;
    if (s.x>=0.&&s.x<=1.&&s.y>=0.&&s.y<=1.)
      col = vec4(texture(sTD2DInputs[0], vec2(s.x,1.-s.y)).rgb * uEd.w, step(0.001, uEd.w));
  }
  if (uEd.x > 0.5) {                             // contorno e cantos para editar
    vec2 px = p*uRes; float d = 1e9;
    for (int i=0;i<4;i++) d = min(d, seg(px, P[i]*uRes, P[(i+1)%4]*uRes));
    vec3 lc = uEd.y > .5 ? vec3(.91,.69,.29) : vec3(.5);
    col = mix(col, vec4(lc,1), 1.-smoothstep(1.,2.,d));
    if (uEd.y > .5) for (int i=0;i<4;i++){
      float r = length(px-P[i]*uRes);
      float ring = 1.-smoothstep(1.,2.,abs(r-(i==int(uEd.z+.5)?12.:8.)));
      float fill = (i==int(uEd.z+.5)) ? 1.-smoothstep(10.,12.,r) : 0.;
      col = mix(col, vec4(lc,1), max(ring,fill));
    }
  }
  fragColor = TDOutputSwizzle(col);
}
'''

TECLADO = r'''
# teclado da janela de saída: Tab = canto, N = superfície, setas = mover, E = editar, G = grade
def onKey(dat, key, character, alt, lAlt, rAlt, ctrl, lCtrl, rCtrl, shift, *resto, **kw):
    estado = resto[2] if len(resto) > 2 else True
    if not estado:
        return
    m = parent()
    k = (key or '').lower()
    n = int(m.par.Superficies.eval())
    if k == 'tab':
        m.par.Canto = int(m.par.Canto.eval()) % 4 + 1; return
    if k == 'n':
        m.par.Selecionada = int(m.par.Selecionada.eval()) % n + 1; m.par.Canto = 1; return
    if k == 'e':
        m.par.Editar = not m.par.Editar.eval(); return
    if k == 'g':
        m.par.Grade = not m.par.Grade.eval(); return
    passo = 10 if shift else 1
    mv = {'left': (-passo, 0), 'right': (passo, 0), 'up': (0, -passo), 'down': (0, passo)}.get(k)
    if mv and m.par.Editar.eval():
        s, c = int(m.par.Selecionada.eval()), int(m.par.Canto.eval())
        px, py = getattr(m.par, 'S%dp%dx' % (s, c)), getattr(m.par, 'S%dp%dy' % (s, c))
        px.val = px.eval() + mv[0] / float(m.par.Resolucao1.eval())
        py.val = py.eval() + mv[1] / float(m.par.Resolucao2.eval())
    return
'''

# ─── monta a rede ───────────────────────────────────────────────────────
pai = op('/project1')
velho = pai.op('mapping')
if velho:
    velho.destroy()
M = pai.create(baseCOMP, 'mapping')
M.nodeX, M.nodeY = 0, -400
M.color = (0.91, 0.69, 0.29)

pg = M.appendCustomPage('Mapping')
pg.appendInt('Superficies', label='Superfícies')[0].normMax = NSUP
M.par.Superficies.min, M.par.Superficies.max, M.par.Superficies.clampMin, M.par.Superficies.clampMax = 1, NSUP, True, True
M.par.Superficies = 1
pg.appendToggle('Editar', label='Editar (mostra cantos)'); M.par.Editar = True
pg.appendToggle('Grade', label='Grade de teste em todas')
pg.appendInt('Selecionada', label='Superfície selecionada'); M.par.Selecionada = 1
M.par.Selecionada.min, M.par.Selecionada.max, M.par.Selecionada.clampMin, M.par.Selecionada.clampMax = 1, NSUP, True, True
pg.appendInt('Canto', label='Canto selecionado'); M.par.Canto = 1
M.par.Canto.min, M.par.Canto.max, M.par.Canto.clampMin, M.par.Canto.clampMax = 1, 4, True, True
pg.appendFloat('Brilho', label='Brilho geral'); M.par.Brilho = 1; M.par.Brilho.normMax = 1.5
pg.appendFloat('Sensibilidade', label='Sensibilidade do som'); M.par.Sensibilidade = 4; M.par.Sensibilidade.normMax = 20
pg.appendFile('Arquivo', label='Vídeo / imagem')
pg.appendInt('Resolucao', label='Resolução da saída', size=2)
M.par.Resolucao1, M.par.Resolucao2 = LARG, ALT
pg.appendInt('Monitor', label='Monitor do projetor (0 = principal)'); M.par.Monitor = 1
pg.appendPulse('Abrirjanela', label='Abrir janela no projetor')
pg.appendPulse('Fecharjanela', label='Fechar janela')

MODOS = ['grade', 'contorno', 'linhas', 'pulso', 'fumaca', 'filme', 'camera', 'cor', 'preto', 'externo', 'estrelas']
ROT = ['Grade de teste', 'Contorno com luz que corre', 'Linhas que correm', 'Pulso (anéis)', 'Fumaça',
       'Vídeo / imagem', 'Câmera', 'Cor sólida', 'Preto (máscara)', 'Externo (entrada 3)', 'Estrelas']
INICIO = [(.30, .25, .70, .75), (.05, .10, .30, .45), (.70, .10, .95, .45), (.35, .60, .65, .95)]
CORES = [(0.91, 0.69, 0.29), (0.23, 0.48, 1.0), (1.0, 0.3, 0.5), (0.3, 1.0, 0.7)]
for i in range(1, NSUP + 1):
    p = M.appendCustomPage('Superfície %d' % i)
    p.appendMenu('S%dmodo' % i, label='Conteúdo')
    mp = getattr(M.par, 'S%dmodo' % i); mp.menuNames, mp.menuLabels = MODOS, ROT
    mp.val = 'grade' if i == 1 else ['contorno', 'linhas', 'pulso', 'estrelas'][i - 1]
    p.appendRGB('S%dcor' % i, label='Cor')
    for c, v in zip('rgb', CORES[i - 1]):
        setattr(M.par, 'S%dcor%s' % (i, c), v)
    p.appendFloat('S%dvel' % i, label='Velocidade'); setattr(M.par, 'S%dvel' % i, 0.5)
    p.appendFloat('S%dden' % i, label='Densidade'); setattr(M.par, 'S%dden' % i, 8)
    getattr(M.par, 'S%dden' % i).normMax = 40
    p.appendToggle('S%dsom' % i, label='Reage ao som')
    x0, y0, x1, y1 = INICIO[i - 1]
    for c, (x, y) in enumerate([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], 1):
        p.appendXY('S%dp%d' % (i, c), label='Canto %d (%s)' % (c, ['cima esq.', 'cima dir.', 'baixo dir.', 'baixo esq.'][c - 1]))
        setattr(M.par, 'S%dp%dx' % (i, c), x); setattr(M.par, 'S%dp%dy' % (i, c), y)

# fontes
filme = novo(M, moviefileinTOP, 'filme', -600, 300)
setx(filme, 'file', "parent().par.Arquivo.eval()")
camera = novo(M, videodeviceinTOP, 'camera', -600, 150)
ruido = novo(M, noiseTOP, 'ruido', -600, 0)
res(ruido, 512, 512); setp(ruido, 'period', 0.6); setp(ruido, 'harmon', 5)
setx(ruido, 'tz', "absTime.seconds * 0.15")
externo = novo(M, nullTOP, 'externo', -600, -150)     # ligue aqui o TOP de uma obra sua

# som
somin = novo(M, audiodeviceinCHOP, 'som', -600, -400)
analise = novo(M, analyzeCHOP, 'analise', -450, -400, [somin])
setp(analise, 'function', 'rmspower')
nivel = novo(M, mathCHOP, 'nivel_math', -300, -400, [analise])
setx(nivel, 'gain', "parent().par.Sensibilidade.eval()")
lag = novo(M, lagCHOP, 'suave', -150, -400, [nivel])
setp(lag, 'lag1', 0.02); setp(lag, 'lag2', 0.25)
lim = novo(M, limitCHOP, 'limite', 0, -400, [lag])
setp(lim, 'type', 'clamp'); setp(lim, 'min', 0); setp(lim, 'max', 1)
nv = novo(M, nullCHOP, 'nivel', 150, -400, [lim])

# textos dos shaders e do teclado
tc = novo(M, textDAT, 'shader_conteudo', -450, 500); tc.text = CONTEUDO
tw = novo(M, textDAT, 'shader_warp', -300, 500); tw.text = WARP
tk = novo(M, textDAT, 'teclado_callbacks', 600, 500); tk.text = TECLADO
kb = novo(M, keyboardinDAT, 'teclado', 450, 500)
setp(kb, 'callbacks', tk)

warps = []
for i in range(1, NSUP + 1):
    y = 300 - (i - 1) * 180
    g = novo(M, glslTOP, 'conteudo_%d' % i, -300, y, [filme, camera, ruido, externo])
    res(g, 1024, 1024); setp(g, 'pixeldat', tc)
    P = "parent().par.S%d" % i
    MODO = "(0 if parent().par.Grade.eval() else %smodo.menuIndex)" % P
    uniforme(g, 0, 'uA', MODO, "absTime.seconds", P + "vel.eval()", P + "den.eval()")
    uniforme(g, 1, 'uB', P + "corr.eval()", P + "corg.eval()", P + "corb.eval()",
             "(op('nivel')[0].eval() if %ssom.eval() else 0)" % P)
    w = novo(M, glslTOP, 'warp_%d' % i, -100, y, [g])
    setp(w, 'pixeldat', tw)
    setp(w, 'outputresolution', 'custom')
    setx(w, 'resolutionw', "parent().par.Resolucao1.eval()")
    setx(w, 'resolutionh', "parent().par.Resolucao2.eval()")
    setp(w, 'format', 'rgba8fixed')
    uniforme(w, 0, 'uP01', P + "p1x.eval()", P + "p1y.eval()", P + "p2x.eval()", P + "p2y.eval()")
    uniforme(w, 1, 'uP23', P + "p3x.eval()", P + "p3y.eval()", P + "p4x.eval()", P + "p4y.eval()")
    LIGA = "(parent().par.Superficies.eval() >= %d)" % i
    uniforme(w, 2, 'uEd', "float(parent().par.Editar.eval() and %s)" % LIGA,
             "float(parent().par.Selecionada.eval() == %d)" % i,
             "parent().par.Canto.eval() - 1", "parent().par.Brilho.eval() * %s" % LIGA)
    uniforme(w, 3, 'uRes', "parent().par.Resolucao1.eval()", "parent().par.Resolucao2.eval()")
    warps.append(w)

# a superfície 1 fica por cima (máscaras pretas tapam o que está atrás)
comp = novo(M, compositeTOP, 'junta', 150, 0, warps)
setp(comp, 'operand', 'over')
setp(comp, 'outputresolution', 'custom')
setx(comp, 'resolutionw', "parent().par.Resolucao1.eval()")
setx(comp, 'resolutionh', "parent().par.Resolucao2.eval()")
fundo = novo(M, constantTOP, 'fundo_preto', 150, -150)
setp(fundo, 'colorr', 0); setp(fundo, 'colorg', 0); setp(fundo, 'colorb', 0); setp(fundo, 'alpha', 1)
setp(fundo, 'outputresolution', 'custom')
setx(fundo, 'resolutionw', "parent().par.Resolucao1.eval()")
setx(fundo, 'resolutionh', "parent().par.Resolucao2.eval()")
sobre = novo(M, overTOP, 'sobre_preto', 300, 0, [comp, fundo])
saida = novo(M, nullTOP, 'saida', 450, 0, [sobre])
saida.viewer = True

jan = novo(M, windowCOMP, 'janela', 600, 0)
setp(jan, 'winop', saida)
setx(jan, 'monitor', "parent().par.Monitor.eval()")
setp(jan, 'borders', False)
setp(jan, 'justifyoffsetto', 'monitor')
setx(jan, 'winw', "parent().par.Resolucao1.eval()")
setx(jan, 'winh', "parent().par.Resolucao2.eval()")
setp(jan, 'size', 'fill')

ex = novo(M, parameterexecuteDAT, 'botoes', 600, -150)
setp(ex, 'op', M); setp(ex, 'pars', 'Abrirjanela Fecharjanela'); setp(ex, 'onpulse', True)
ex.text = r'''
def onPulse(par):
    j = op('janela')
    if par.name == 'Abrirjanela':
        j.par.winopen.pulse()
    else:
        j.par.winclose.pulse()
    return
'''

# interface do COMP mostra a saída
setp(M, 'opviewer', saida)

print('Mapping criado em %s.' % M.path)
print('Abra a aba "Mapping" do COMP, ligue o projetor pela HDMI (monitor 1) e clique em "Abrir janela no projetor".')
if _avisos:
    print('Avisos (%d) — a rede funciona, mas confira estes parâmetros:' % len(_avisos))
    for a in _avisos:
        print('  ' + a)
