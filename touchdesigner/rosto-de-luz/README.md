# Rosto de Luz — v2 (TouchDesigner)

O rosto e as mãos do visitante viram milhares de pontos de luz em 3D, e o som e o MIDI do Moog Sub Phatty controlam os efeitos.

A v1 original ficou só no Mac. Esta v2 foi refeita do zero em 12/11/2026, já com as mãos, os efeitos de som e o MIDI.

## Arquivos

- `construir_rosto_de_luz.py` — monta a rede inteira no TouchDesigner.
- `rastreador.html` — o rastreador (MediaPipe: rosto com 478 pontos e as duas mãos). Ele já vem embutido no script; este arquivo é uma cópia para abrir no Chrome se precisar.

## Como montar

1. No TouchDesigner, crie um **Text DAT** em `/project1`, cole o conteúdo de `construir_rosto_de_luz.py` e clique com o botão direito → **Run Script**.
2. O script cria o componente `/project1/rosto_de_luz_v2` com tudo dentro. Rodar de novo reconstrói só esse componente.
3. **Câmera:** o rastreador roda dentro do TD (Web Render TOP `rastreador_view`) e pede acesso à câmera. Se a câmera não abrir ali, desligue *Rastreador dentro do TD* (aba Rastreador) e abra **http://localhost:9980** no Chrome. Para trocar de câmera, use `http://localhost:9980/?cam=1`.
4. **Som:** no `audio_in`, escolha a interface onde entra o Sub Phatty, ou o microfone.
5. **MIDI:** em *Dialogs → MIDI Device Mapper*, ligue o Sub Phatty como entrada com **ID 1**.
6. Salve como `rosto_de_luz_v2.toe` na pasta da obra no Desktop. Para projetar, use **Abrir janela da obra**.

Se aparecerem avisos no Textport depois do Run Script, mande para o Claude.

## O que o som faz

| Som | Efeito |
|---|---|
| Volume | pontos pulsam e o rosto "respira" |
| Graves | dispersão dos pontos para fora |
| Agudos | faíscas |
| Ataques (picos) | ondas de choque que atravessam o rosto e as mãos |

## MIDI do Sub Phatty

| Controle | CC | Efeito |
|---|---|---|
| Notas | — | explosão dos pontos (força = velocity) e cor da nota |
| Pitch bend | — | inclina a imagem |
| Roda de modulação | 1 | glow |
| Mod. do filtro | 2 | imagem líquida |
| Taxa do LFO | 3 | velocidade da ondulação |
| Mod. de altura | 4 | amplitude da ondulação |
| Glide | 5 | suavização do movimento |
| Volume | 7 | brilho geral |
| Ruído | 8 | granulado |
| Onda Osc 1 | 9 | tamanho dos pontos |
| Afinação Osc 2 | 12 | gradiente de cor |
| Batimento Osc 2 | 13 | respiração |
| Onda Osc 2 | 14 | saturação |
| Nível Osc 1 | 15 | brilho do rosto |
| Nível Osc 2 | 16 | brilho das mãos |
| Nível Sub | 17 | rastro |
| Multidrive | 18 | dispersão |
| Corte do filtro | 19 | cor |
| Ressonância | 21 | faíscas |
| Quant. do EG do filtro | 22 | força da explosão |
| Relaxamento do filtro | 26 | retorno depois da explosão |

Todos esses controles também aparecem no painel do componente (abas *Rosto de Luz*, *Som*, *MIDI e efeitos*), então dá para testar sem o Sub Phatty.
