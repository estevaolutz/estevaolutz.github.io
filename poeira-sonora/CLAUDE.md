# Poeira Sonora

Obra audiovisual: centenas de milhares de partículas (262 mil, 524 mil ou 1 milhão) simuladas na GPU (WebGL2, texturas float em ping-pong) que reagem ao som. Arquivo único: `index.html`. Publicado em https://estevaolutz.github.io/poeira-sonora/

## Som
- Fontes: arquivo de áudio (botão ou arrastar para a tela), microfone/entrada de interface (escolha do dispositivo, sem eco/ruído/AGC) e "Ver exemplo" (batida trip hop sintetizada).
- Análise com ganho automático por banda: graves → explosão, médios-graves → vórtice, médios → turbulência, agudos → faíscas; batida → onda de choque, tremor de câmera e aberração cromática; batida forte → "quebra" (congela, quantiza em grade, fatias deslizam).
- Espectro em log (256 bins) vai para uma textura e deforma as formas por faixa de frequência.

## Formas
Nebulosa, Esfera (inicial), Galáxia, Toro, Relevo do espectro, Enxame, Anéis — teclas 1–7; troca automática a cada 32 batidas.

## Imagem
- Escala da forma (padrão 2,4) e Dispersão (padrão 0,5) espaçam as partículas; brilho por ponto baixo e bloom leve para não estourar em branco. No Enxame cada aglomerado tem uma cor; na Nebulosa a cor vai pela distância do centro.

## Saída
- Usa `../lib/projecao.js` com `data-calibrar` (projeção limpa, cantos calibrados na página do computador pelo botão "Ajustar cantos") e `../lib/gravacao.js` (MP4 com som, tela cheia). Se as libs não carregarem (arquivo aberto fora do site), cai nas funções próprias de projeção/gravação.
- Botão de engrenagem (canto superior direito, aparece com o movimento do mouse/dedo) abre e fecha o painel de ajustes; o painel tem × para fechar.
- Atalhos: H painel, F tela cheia, R gravar, P projeção, Espaço play/pausa, A troca automática.

## Regras
- Qualquer alteração: commit e push direto (GitHub Pages publica sozinho).
