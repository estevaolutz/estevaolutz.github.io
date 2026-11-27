# Quebrada

Bateria eletrônica (trip hop / trap / jungle) controlada pelo Korg nanoPAD2, com visual WebGL2 (fumaça, enxame de partículas, glitch). Arquivo único: `index.html`. Publicado em https://estevaolutz.github.io/quebrada/

## Projeção
- Usa `../lib/projecao.js` com `data-calibrar`: a janela de projeção (Shift+P ou botão PROJEÇÃO) sai **limpa**, só o visual, sem pads, textos, ajuda ou alças.
- Os 4 cantos são calibrados **na página do computador** (botão CALIBRAR CANTOS): miniatura com alças, Tab/1–4, setas (Shift = 10 px), Resetar cantos, Blackout. Enquanto calibra, a projeção mostra uma grade. A calibração fica em `localStorage['projecao-cantos:/quebrada/']`.
- Pads e controles ficam só na página do computador. A captura pega só canvas/vídeo sobre o canvas `#vis`; HTML nunca vai para a projeção.

## Regras
- Qualquer alteração: commit e push direto (GitHub Pages publica sozinho).
