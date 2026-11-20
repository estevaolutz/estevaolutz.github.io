# Mapping no TouchDesigner

`mapping_td.py` cria `/project1/mapping`: até 4 superfícies de 4 cantos (homografia num GLSL TOP), conteúdos prontos (grade, contorno, linhas, pulso, fumaça, estrelas, cor, máscara, vídeo, câmera e **Externo**), nível de áudio para "reage ao som" e janela 1280×720 no monitor do projetor.

Rodar na Textport (Option+T):

    exec(open(r'/caminho/mapping_td.py', encoding='utf-8').read())

Teclado com a janela de saída em foco: Tab = canto, N = superfície, setas = 1 px (Shift = 10 px), E = editar, G = grade.
Para mapear uma obra sua, ligue o TOP dela no Null `externo` e escolha "Externo" no conteúdo da superfície.
Versão para o navegador do projetor: https://estevaolutz.github.io/mapping/
