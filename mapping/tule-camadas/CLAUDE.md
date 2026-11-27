# Tule em Camadas

App de projeção "holográfica" em telas de tule (aba Mapping do site). Arquivo único: `index.html`, sem dependências além da fonte Inter Tight.

## Montagens
- **Escada**: 3 canvases (1200×400), um por camada de tule, cada um com 4 cantos (homografia via CSS `matrix3d`). A camada da frente fica mais alta, a de trás mais baixa; o projetor fica levemente acima. Opção "frente embaixo" para projetor no chão.
- **Paralelo**: 1 canvas (1280×720) com imagem inteira; as 3 telas na mesma altura recebem a mesma imagem (eco). A profundidade é simulada com tamanho e brilho.

## Cenas
Mundo com objetos em x, y (0–1) e z contínuo (0 = frente, 2 = fundo). A função `each(z, fn)` distribui o desenho entre as camadas com pesos (controle "Transição"). Cenas: calib, orbit, parts, jelly, tunnel, rain. Atalhos: H painel, E cantos, F tela cheia, 1–6 cenas.

## Material do usuário
Rolo de tule de 10 m × 2,4 m; painéis sugeridos de 1,2 × 1 m. Projetor portátil (HY300), fraco para tule, por isso há brilho por camada.

## Ideias pendentes
- Modo com uma saída por projetor (paralelo com conteúdo diferente em cada tela).
- Cenas reativas ao microfone (não funcionam no artefato do Claude, só no GitHub Pages).
- Janela de projeção separada dos controles, como nos outros apps de mapping.
