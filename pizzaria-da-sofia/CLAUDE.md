# Pizzaria da Sofia

Jogo infantil (5 anos) para iPad e computador, publicado em https://estevaolutz.github.io/pizzaria-da-sofia/ (aba Jogos da página inicial).

- Arquivo único: `index.html` (HTML + CSS + JS, sem bibliotecas). Desenho todo em canvas; sons sintetizados com Web Audio; fala com speechSynthesis (pt-BR, escolha de voz no botão 🗣️).
- Etapas (objeto `S`): `dough` (arrastar ingredientes da prateleira até o pote e girar para misturar) → `roll` (rolo) → `sauce` → `cheese` → `tops` (ingredientes de cada receita, arrastar ou tocar) → `oven` (8 s) → `eat` (mordidas).
- Receitas em `RECIPES`; desenho dos ingredientes em `TOP`; ingredientes da massa em `DOUGH_INGS`.
- Todo gesto usa Pointer Events: precisa funcionar com dedo e mouse. Testar com device_scale_factor=2 (telas Retina).
- Depois de qualquer mudança: commit e push no `main` (GitHub Pages).
- Falas: tabela `FALAS` (chave → número do arquivo e texto). Gravações em `audio/NN.mp3` e listadas em `audio/lista.json` (ex.: ["01","02"]). Se a gravação de uma fala não existe, o jogo usa a voz do aparelho (speechSynthesis). Para incluir gravações novas: converter para mp3 mono (ffmpeg -i in -ac 1 -ar 44100 -q:a 3, com corte de silêncio e normalização), salvar como NN.mp3 e acrescentar o número em lista.json.
