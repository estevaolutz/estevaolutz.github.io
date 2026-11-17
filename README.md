# Apps de Estevão Lutz

Publicados em https://estevaolutz.github.io

## Organização

Cada app fica numa pasta própria e abre em `https://estevaolutz.github.io/<pasta>/`.

- Mapas e atlas em 3D: `odisseia`, `alexandre`, `mitologia-grega`, `cabeza-de-vaca`, `generais-romanos`, `roma`, `antartida`, `amyr-klink`, `stalingrado`, `dia-d`, `asimov-universe`
- Mapas de livros: `le-guin` — as obras de Ursula K. Le Guin num grafo (D3) com as ligações entre livros e séries; vistas Constelação e Linha do tempo. Página única.
- Obras audiovisuais: `dedalus`, `dente-de-leao`, `espectroscopio`, `gotas`, `desenhos-de-luz`, `feedback-digital`
- Política e dados: `quanto-custa-o-poder`, `para-onde-vai-o-meu-imposto`, `emendas-no-mapa`, `quem-bancou-quem`, `disse-e-votou` (o `quem-bancou-quem` lê as votações de `disse-e-votou/data/votos.json`)
- Estudos: `katas-shotokan`, `libras`, `reproducao-humana`
- Cidade: `onibus-rio/celular` — versão para telefone, gerada a partir da página principal por `onibus-rio/build/celular.py` (rodar de novo sempre que `onibus-rio/index.html` mudar).
- Cidade: `onibus-rio` — ônibus, BRT, executivos, metrô, trem, VLT e barcas, com mapa de fundo escuro, claro, ruas ou satélite, filtros por tipo, companhia e bairro (`data/bairros.json`, gerado por `build/bairros.py` com os limites dos 165 bairros do OpenStreetMap) e caixa de caminho (`onibus-rio/rota.js`: planejador de rotas no navegador, algoritmo RAPTOR com tempos estimados; endereços buscados no Photon/OpenStreetMap). Os ônibus vêm do GTFS oficial da SMTR (`data/rede.json`); metrô, trem, VLT e barcas vêm do OpenStreetMap via Overpass (`data/trilhos.json`, gerado por `build/trilhos.py` com a consulta `build/trilhos.overpassql`). Os dados são regerados toda segunda pelo GitHub Actions — `.github/workflows/onibus-rio.yml` baixa o GTFS e o OSM e roda `onibus-rio/build/processar.py` e `trilhos.py`; dá para rodar na hora em Actions → "Ônibus do Rio — atualizar dados" → Run workflow
- Sol e luz: `rastro-solar`
- Ferramentas de som: `medidor-spl`
- Construção: `domo-geodesico` — calculadora de domos geodésicos (icosaedro classe I, 1V a 8V): modelo 3D (three.js), hastes com fator de corda, comprimento de corte e ângulos, conectores com planta, painéis, plano de corte em barras comerciais, custo, peso e pontos da base com pés de nivelamento. Página única; ajustes guardados no localStorage.
- Casa: `mercado-da-casa` — atalho para o app Mercado da Casa (lista de compras compartilhada), que roda no Claude em https://claude.ai/artifact/VGFJQbVsy2cV7bpCPy2Usd porque precisa do banco de dados compartilhado de lá; o GitHub Pages não guarda dados. A página redireciona para o app e pode ir para a tela inicial do celular. O código do app fica em `mercado-da-casa/fonte/app-claude.html` (só funciona dentro do Claude).
- Jogos: `batalha-naval` — Batalha Naval para dois aparelhos: um cria a sala (código de 4 letras ou link `?sala=XXXX`, com botão de convite) e o outro entra; conexão direta pelo PeerJS/WebRTC, como o modo online do Rio Kart. Tabuleiro 10×10 com 5 navios (5, 4, 3, 3, 2), posicionamento por toque ou aleatório, quem acerta atira de novo, sons sintetizados, vibração, placar entre partidas e revanche (quem perdeu começa). Página única; o nome do jogador fica no localStorage.
- Jogos: `caca-ao-tesouro` — Caça ao Tesouro da Matemática (5º ano): abertura com mapa antigo de pergaminho com todas as ilhas; mapa ilustrado e animado de 9 ilhas (dia, pôr do sol e noite) com missões de +, −, × e ÷ com problemas de piratas e dicas visuais, Torre de Blocos, Desafio Relâmpago (60 s), Batalha do Monstro (ataque com ×, defesa com ÷) e baú; níveis que se ajustam sozinhos, medalhas, loja de piratas e painel dos pais (segurar 3 s). Página única; progresso no localStorage do aparelho.
- Jogos: `lagoa-kart` — Lagoa Kart 2: corrida estilo kart com 4 pistas no Rio real (Lagoa Rodrigo de Freitas, Copacabana, Aterro + Pão de Açúcar e Subida do Cristo) feitas com ruas, prédios e parques do OpenStreetMap e relevo real (Terrain Tiles), pilotos da família em estilo desenho animado, colisões entre karts, queda na água, sons sintetizados, música por link (Spotify, Tidal, YouTube, Deezer, SoundCloud, Apple Music), tela dividida para até 4 jogadores, modo online por código de sala (PeerJS/WebRTC) e controle USB de PS2 (Gamepad API, com tela de mapeamento). Página única gerada a partir dos fontes que ficam no Desktop, em `Jogos/Lagoa Kart`. Versão para celular em `lagoa-kart/celular` (mesmo código com `window.LK_MOBILE=true`: controles de toque, inclinação, tela deitada, gráficos mais leves), gerada junto pelo `build2.py`.

## Modo leitura

`lib/leitura.js` cria o botão **Modo leitura** nos mapas: o texto das paradas rola por cima do mapa e, quando um trecho passa pelo meio da tela, o mapa voa até o lugar. Cada mapa chama `Leitura.init({...})` no fim do seu script, informando as paradas (`itens`), como ir até elas (`ir`) e qual contêiner do mapa vira tela cheia (`mapa`). Está em: Odisseia, Alexandre, Mitologia Grega, Cabeza de Vaca, Generais Romanos, Roma, Antártida, Amyr Klink, Stalingrado, Dia D e Asimov Universe.

## Câmera (Logitech)

`lib/camera.js` entra em todos os apps que usam câmera (Dedalus, Gotas, Desenhos de luz, Dente de Leão, Feedback Digital, Libras, Rastro Solar). Se houver uma câmera Logitech conectada, ela é usada automaticamente; um botão discreto de câmera no canto inferior esquerdo (aparece ao mexer o mouse; atalho Shift+C) lista as câmeras e troca na hora, sem recarregar. A escolha fica guardada no navegador. Se a Logitech for plugada com o app aberto, a troca é automática.

Nos projetos do TouchDesigner, `touchdesigner/camera_logitech.py` escolhe a Logitech em todos os Video Device In TOP e no parâmetro de câmera do componente MediaPipe (instruções no próprio arquivo).

## Projetos do TouchDesigner

Ficam em `touchdesigner/<obra>/`: os scripts e um README com instruções e com o local do .toe no Desktop. Não são páginas web.

- `touchdesigner/rosto-de-luz` — Rosto de Luz v4 (rosto e mãos em pontos de luz, som e MIDI do Sub Phatty). O .toe fica no Desktop, em `rosto_de_luz_mediapipe/release`; aqui ficam os scripts e as instruções.
- `touchdesigner/feedback-digital` — Feedback Digital v1 (motor do Feedback Lab com câmera, microfone e toque, modo Derreter, acaso). O .toe fica no Desktop, em `Obras audiovisuais/Feedback_Digital_TD`; aqui ficam o shader e as instruções. Versão web para iPad em `feedback-digital/`.

As versões anteriores (mapas 2D, versões para iPad e cópias dos artefatos do Claude) estão na branch `backup-2026-11`.
