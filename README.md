# Apps de Estevão Lutz

Publicados em https://estevaolutz.github.io

## Organização

Cada app fica numa pasta própria e abre em `https://estevaolutz.github.io/<pasta>/`.

- Mapas e atlas em 3D: `odisseia`, `alexandre`, `mitologia-grega`, `cabeza-de-vaca`, `generais-romanos`, `antartida`, `amyr-klink`, `stalingrado`, `dia-d`, `asimov-universe`
- Obras audiovisuais: `dedalus`, `dente-de-leao`, `espectroscopio`, `gotas`, `desenhos-de-luz`, `feedback-digital`
- Política e dados: `quanto-custa-o-poder`, `para-onde-vai-o-meu-imposto`, `emendas-no-mapa`, `quem-bancou-quem`, `disse-e-votou` (o `quem-bancou-quem` lê as votações de `disse-e-votou/data/votos.json`)
- Estudos: `katas-shotokan`, `libras`, `reproducao-humana`
- Cidade: `onibus-rio/celular` — versão para telefone, gerada a partir da página principal por `onibus-rio/build/celular.py` (rodar de novo sempre que `onibus-rio/index.html` mudar).
- Cidade: `onibus-rio` — ônibus, BRT, executivos, metrô, trem, VLT e barcas, com mapa de fundo escuro, claro, ruas ou satélite, filtros por tipo, companhia e bairro (`data/bairros.json`, gerado por `build/bairros.py` com os limites dos 165 bairros do OpenStreetMap) e caixa de caminho (`onibus-rio/rota.js`: planejador de rotas no navegador, algoritmo RAPTOR com tempos estimados; endereços buscados no Photon/OpenStreetMap). Os ônibus vêm do GTFS oficial da SMTR (`data/rede.json`); metrô, trem, VLT e barcas vêm do OpenStreetMap via Overpass (`data/trilhos.json`, gerado por `build/trilhos.py` com a consulta `build/trilhos.overpassql`). Os dados são regerados toda segunda pelo GitHub Actions — `.github/workflows/onibus-rio.yml` baixa o GTFS e o OSM e roda `onibus-rio/build/processar.py` e `trilhos.py`; dá para rodar na hora em Actions → "Ônibus do Rio — atualizar dados" → Run workflow
- Sol e luz: `rastro-solar`
- Ferramentas de som: `medidor-spl`

## Projetos do TouchDesigner

Ficam em `touchdesigner/<obra>/`: os scripts e um README com instruções e com o local do .toe no Desktop. Não são páginas web.

- `touchdesigner/rosto-de-luz` — Rosto de Luz v4 (rosto e mãos em pontos de luz, som e MIDI do Sub Phatty). O .toe fica no Desktop, em `rosto_de_luz_mediapipe/release`; aqui ficam os scripts e as instruções.
- `touchdesigner/feedback-digital` — Feedback Digital v1 (motor do Feedback Lab com câmera, microfone e toque, modo Derreter, acaso). O .toe fica no Desktop, em `Obras audiovisuais/Feedback_Digital_TD`; aqui ficam o shader e as instruções. Versão web para iPad em `feedback-digital/`.

As versões anteriores (mapas 2D, versões para iPad e cópias dos artefatos do Claude) estão na branch `backup-2026-11`.
