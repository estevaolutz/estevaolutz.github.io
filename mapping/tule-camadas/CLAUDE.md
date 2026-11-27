# Tule em Camadas

App de projeção "holográfica" em telas de tule (aba Mapping do site). Arquivo único: `index.html`, sem dependências além da fonte Inter Tight.

## Montagens
- **Escada**: 3 canvases (1200×400), um por camada de tule, cada um com 4 cantos (homografia via CSS `matrix3d`). A camada da frente fica mais alta, a de trás mais baixa; o projetor fica levemente acima. Opção "frente embaixo" para projetor no chão.
- **Paralelo**: 1 canvas (1280×720) com imagem inteira; as 3 telas na mesma altura recebem a mesma imagem (eco). A profundidade é simulada com tamanho e brilho.

## Cenas
Mundo com objetos em x, y (0–1) e z contínuo (0 = frente, 2 = fundo). A função `each(z, fn)` distribui o desenho entre as camadas com pesos (controle "Transição"). Cenas: calib, orbit, parts, jelly, tunnel, rain. Atalhos: H painel, E cantos, F tela cheia, 1–6 cenas.

## Janela de projeção separada
Botão "Abrir janela de projeção" abre a mesma página com `#projecao` (sem painel, cursor oculto, duplo clique = tela cheia). Controle e projeção se sincronizam por `BroadcastChannel('tule-camadas')`: o controle envia o estado inteiro (`t:'state'`), a projeção pede com `t:'hello'` e devolve os cantos se forem arrastados nela (`t:'quads'`). A projeção também manda o tamanho (`t:'size'`); com ela conectada, o controle vira uma pré-visualização na proporção do projetor, ao lado do painel (`placeStage()`), e ocupa a tela toda quando o painel é recolhido (ao editar, o painel recolhe sozinho e aparece a barra flutuante `#tools`: zoom −/+, Ajustar, Concluir, Painel). Zoom e arrasto da pré-visualização: `Z`, `PX`, `PY` em `applyView()`/`zoomAt()`; pinça/roda = zoom, dois dedos/arrastar fundo = mover, duplo clique numa bolinha = zoom 4× nela. Não funciona no artefato do Claude (window.open bloqueado).

## Material do usuário
Rolo de tule de 10 m × 2,4 m; painéis sugeridos de 1,2 × 1 m. Projetor portátil (HY300), fraco para tule, por isso há brilho por camada.

## Ideias pendentes
- Modo com uma saída por projetor (paralelo com conteúdo diferente em cada tela).
- Cenas reativas ao microfone (não funcionam no artefato do Claude, só no GitHub Pages).
