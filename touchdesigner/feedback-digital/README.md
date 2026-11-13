# Feedback Digital (TouchDesigner)

Câmera, microfone e toque alimentam um feedback de vídeo. O núcleo é o motor do **Feedback Lab** (o feedback da obra Página em Branco / Sub Phatty), um shader GLSL com 5 modos: Túnel, Fluido, Estrias, Derreter e Pixel sort. O padrão é **Derreter**, sem troca automática de modo.

## Onde está o projeto

- Arquivo principal: `Desktop/Obras audiovisuais/Feedback_Digital_TD/feedback digital TD v1.3.toe` (versões antigas na pasta `Backup`).
- Shader: `shader_feedback.glsl` (cópia aqui). O shader original do Feedback Lab e a versão anterior, com padrão fixo, ficam em `_ref_feedbacklab/`.
- Versão web para iPad: https://estevaolutz.github.io/feedback-digital/

## Entradas

- **Câmera:** a diferença entre quadros (o movimento) vira luz colorida que alimenta o laço. A imagem da câmera começa 100% transparente (Controles › Entradas › Transparência da câmera).
- **Microfone:** a onda aparece como uma linha no meio da tela. O volume controla o zoom e o matiz, os graves o pulso e a rotação, e os agudos a separação RGB e o deslocamento.
- **Toque/clique:** acende uma luz no ponto tocado, dentro da janela de saída (container `tela`).

## Acaso

O centro do feedback, o zoom, a rotação, o matiz e a dobra de turbulência caminham até alvos sorteados (script `troca_modo`, canais em `ACASO`). As bordas não são espelhadas, então não se forma a cruz simétrica. A troca automática de modo é opcional (Controles › Acaso).

## Janelas

- Saída: `janela_performance` (Controles › Sistema › Abrir janela de performance).
- Controles: parâmetros do COMP `Controles`, nas abas Feedback, Entradas, Acaso e Sistema.
