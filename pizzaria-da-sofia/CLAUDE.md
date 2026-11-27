# Pizzaria da Sofia

Jogo infantil (5 anos) para iPad e computador, publicado em https://estevaolutz.github.io/pizzaria-da-sofia/ (aba Jogos da página inicial).

- Arquivo único: `index.html` (HTML + CSS + JS, sem bibliotecas). Desenho todo em canvas; sons sintetizados com Web Audio; fala com speechSynthesis (pt-BR, escolha de voz no botão 🗣️).
- Etapas (objeto `S`): `dough` (arrastar ingredientes da prateleira até o pote e girar para misturar) → `roll` (rolo) → `sauce` → `cheese` → `tops` (ingredientes de cada receita, arrastar ou tocar) → `oven` (8 s) → `eat` (mordidas).
- Receitas em `RECIPES`; desenho dos ingredientes em `TOP`; ingredientes da massa em `DOUGH_INGS`.
- Todo gesto usa Pointer Events: precisa funcionar com dedo e mouse. Testar com device_scale_factor=2 (telas Retina).
- Depois de qualquer mudança: commit e push no `main` (GitHub Pages).
