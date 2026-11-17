# Feedback Digital — 3 projetos HTML + 3 projetos TouchDesigner

## O que é feedback digital (síntese da pesquisa)

Feedback é a versão digital de apontar a câmera para o monitor que mostra a própria câmera: o quadro anterior volta como entrada do próximo. O que você coloca dentro do laço é aplicado de forma recursiva, quadro após quadro, e é daí que nascem os padrões.

**Os 5 ingredientes de qualquer laço**
1. **Memória**: guardar o último quadro. No TD é o Feedback TOP; no navegador são duas texturas que se alternam (ping-pong), porque uma textura não pode ser lida e escrita ao mesmo tempo.
2. **Transformação**: o que muda a cada volta (zoom, rotação, deslocamento, distorção, advecção). Essa parte define a forma.
3. **Decaimento**: multiplicar por menos de 1 (Level TOP com opacidade ~0,9–0,99) para o passado sumir e a tela não saturar.
4. **Injeção**: alguma coisa nova precisa entrar (ruído, toque, som, movimento da câmera). Sem injeção o laço converge para preto ou para um ponto fixo.
5. **Contraforça ao borrão**: cada amostragem interpolada borra um pouco. Nitidez dentro do laço, bordas (Edge TOP) ou união por máximo seguram os detalhes.

**Detalhes técnicos que fazem diferença**
- **Formato de pixel**: use 16-bit float (`rgba16float`) no laço. Com 8 bits os valores pequenos arredondam para zero, o rastro "trava" e aparecem faixas. A documentação recomenda formato de maior precisão quando os valores precisam passar de 0–1 ou acumular sem banding.
- **Feedback TOP**: o parâmetro *Target TOP* aponta para o fim da cadeia; a entrada define resolução e formato; *Reset* limpa. Ele também serve para pegar "o quadro anterior" de qualquer TOP (o truque usado no Derretimento para medir movimento da câmera).
- **GLSL TOP**: `sTD2DInputs[i]` são as entradas, `vUV.st` a coordenada, `uTD2DInfos[i].res` = (1/w, 1/h, w, h), `uTDOutputInfo` a resolução de saída, saída em `layout(location=0) out vec4 fragColor` passando por `TDOutputSwizzle()`. Uniforms personalizados ficam na página Vectors (`vec0name`, `vec0valuex`…).
- **Família de técnicas**: zoom/rotação (túnel, Droste), sistemas de funções iteradas (várias cópias, fractal), advecção por campo de ruído (fluidos falsos), reação-difusão (Gray-Scott), pixel sorting por feedback, bordas em profundidade (pseudo-3D).

## Projetos HTML (WebGL2, abrem no Chrome, Android e iPad)
| Arquivo | Técnica | Entradas |
|---|---|---|
| `tunel_de_espelhos.html` | zoom + rotação + giro de matiz + separação RGB, bordas espelhadas | toque, microfone, câmera invisível (movimento) |
| `rios_de_tinta.html` | advecção semi-lagrangiana por curl noise + nitidez no laço | toque, microfone, câmera invisível |
| `reacao_difusao.html` | Gray-Scott, 1–32 passos por quadro, mapa vivo de F/k | toque, microfone, câmera invisível |

Os três têm deriva aleatória (o laço nunca se repete), painel ⚙ (tecla H) e tela cheia (F).

## Projetos TouchDesigner
Já montados e testados no projeto `Desktop/Obras audiovisuais/Feedback_Estudos_TD/feedback_estudos.toe` (TD 2025.33230). Os três usam uma câmera única em `/project1/camera` (no Mac só um Video Device In abre a câmera por vez).

Cada `.py` monta a rede inteira dentro de um Base COMP em `/project1`.

1. Abra o TD → **Alt+T** (Textport)
2. `exec(open(r'/Users/…/td1_fractal_de_video.py', encoding='utf-8').read())`
3. Selecione o COMP criado → **P** → aba **Controles**
4. Janela de saída: `op('/project1/fractal_de_video/janela').par.winopen.pulse()`

| Script | Técnica | Rede |
|---|---|---|
| `td1_fractal_de_video.py` | IFS por feedback: N cópias reduzidas e giradas do quadro anterior unidas por máximo; ruído semeia o centro | Constant → Feedback → GLSL (+ Noise) → Null |
| `td2_derretimento.py` | pixel sorting por feedback: pixels claros caem mais rápido; só o movimento da câmera injeta cor | Video In → Null → Feedback (quadro anterior); Constant → Feedback → GLSL → Null |
| `td3_bordas_em_profundidade.py` | só operadores nativos: Edge (cor girando) → Feedback → Transform → HSV Adjust → Blur → Level → Composite máximo | sem GLSL, para estudar cada etapa |

Todos têm entrada de microfone (Audio Device In → Analyze RMS → Lag → Math), parâmetro **Limpar** e controles de memória e cor. Se algum nome de parâmetro mudou na sua versão do TD, o script não para: ele lista no Textport o que não conseguiu ajustar.
