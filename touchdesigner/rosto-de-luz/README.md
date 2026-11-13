# Rosto de Luz (TouchDesigner)

O rosto e as mãos de quem está na frente da câmera viram dezenas de milhares de pontos de luz em 3D. O som e o MIDI do Moog Sub Phatty controlam os efeitos.

## Onde está o projeto

- Arquivo principal: `Desktop/rosto_de_luz_mediapipe/release/rosto de luz 3d.toe`, com as versões antigas na pasta `Backup` ao lado.
- Componente da obra: `/project1/Cabeca_de_Luz`. O rastreamento usa o componente MediaPipe (`/project1/MediaPipe` e `/project1/face_tracking`).
- Scripts de trabalho: `Desktop/rosto_de_luz_scripts/`.

## v4 (13/11/2026): mãos, som e MIDI

Os arquivos estão em `v4/`. O `rdl_v4_aplicar.py` aplica tudo no componente `Cabeca_de_Luz`.

- **Mãos:** até 2 mãos, cada uma com 6 mil pontos nos dedos e na palma, iluminados pelo vídeo como o rosto. Elas aparecem e somem suavemente e continuam funcionando mesmo sem rosto na câmera. Os controles ficam na aba **Mãos** (tamanho, brilho e espaço na tela). A posição das mãos usa o quadro inteiro da câmera, então elas nunca saem da tela da obra. Para funcionar, a opção *Detect hands* do componente MediaPipe precisa estar ligada.
- **Som** (`som_entrada`, aba **Som**):
  - volume → tamanho, intensidade, halo e respiração
  - graves → dispersão
  - agudos → cintilar
  - ataques → glitch e scanner
- **MIDI** (`midi_subphatty`, aba **MIDI**): as notas fazem os pontos explodirem (força = velocity) e mudam a cor; o pitch bend gira a cabeça.

| Controle do Sub Phatty | CC | Efeito |
|---|---|---|
| Roda de modulação | 1 | halo |
| Mod. do filtro | 2 | scanner |
| Taxa do LFO | 3 | velocidade das cores |
| Mod. de altura | 4 | vórtice |
| Glide | 5 | suavizar tremor |
| Volume | 7 | exposição |
| Ruído | 8 | glitch |
| Onda Osc 1 | 9 | tamanho |
| Afinação Osc 2 | 12 | deriva |
| Batimento Osc 2 | 13 | respiração |
| Onda Osc 2 | 14 | saturação |
| Nível Osc 1 | 15 | intensidade |
| Nível Osc 2 | 16 | brilho das mãos |
| Nível Sub | 17 | rastro |
| Multidrive | 18 | dispersão |
| Corte do filtro | 19 | tom da cor |
| Ressonância | 21 | cintilar |
| Quant. do EG do filtro | 22 | força da explosão |
| Relaxamento do filtro | 26 | retorno da explosão |
| Oitava Osc 1 | 74 | troca a paleta |

**Para ligar o Sub Phatty:** no TouchDesigner, em *Dialogs → MIDI Device Mapper*, adicione o Sub Phatty como entrada com **ID 1**. Para o som do synth, escolha a interface de áudio no `som_entrada`, que hoje usa a entrada padrão do Mac.

## v5 (13/11/2026): espectrômetro nos pontos

Os arquivos estão em `v5/`. O `rdl_v5_aplicar_espectro.py` acrescenta o efeito ao `Cabeca_de_Luz`.

O microfone (`som_entrada`) vira um espectro de 64 bandas, de 40 Hz a 14 kHz, guardado com 48 linhas de histórico (`espectro` → `espectro_tex`). Cada ponto do rosto e das mãos escuta uma banda: ganha a cor do arco-íris daquela frequência, brilha e se projeta para fora conforme a força do som. Os controles ficam na aba **Espectro**:

- **Modo:**
  - *Barras*: graves embaixo, agudos em cima
  - *Radial*: graves no centro, agudos na borda
  - *Cascata*: espectrograma que corre de cima para baixo, com a frequência no eixo horizontal
- **Ajustes:** quantidade, cor do espectro, altura dos picos, ganho do microfone e suavização.
