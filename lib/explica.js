/* Caixa "Sobre a obra" das Conjecturas: a fórmula, como ela vira som e como vira imagem.
   Um botão discreto (canto inferior direito, tecla I) abre e fecha a caixa. A obra é achada pelo endereço da página.
   A parte "Esta obra" (andamento, tonalidade, timbre) vem da identidade da obra no Motor Knick (lib/motor-knick.js). */
(function () {
  'use strict';
  if (window.Explica) return;

  // comum a todas: o que o motor faz com o que a fórmula manda
  const SOM_COMUM = 'Tudo passa pelo Motor Knick: as notas que a fórmula produz soam como notas de vidro dentro do pulso e ficam guardadas numa memória curta. Os dois arpejos tocam essa memória (o grave na ordem em que as notas vieram, o agudo de trás para a frente) e o ritmo deles segue os lugares do compasso onde as notas da obra caíram. Sem notas da obra por um tempo, os arpejos voltam a um padrão próprio.';
  const IMG_COMUM = 'A imagem também toca: o motor olha o quadro cerca de 8 vezes por segundo. Mais luz abre o filtro dos arpejos, mais movimento deixa o arranjo mais cheio, e o lado onde está a luz é o lado de onde vêm os arpejos.';

  const T = {
    'granizo': {
      titulo: 'Granizo — a conjectura de Collatz',
      formula: 'Escolha um número n. Se n é par, divida por 2; se é ímpar, faça 3n + 1. Repita.<code>n → n/2 (par) · n → 3n + 1 (ímpar)</code>A conjectura diz que, começando de qualquer número, sempre se chega ao 1 (e ao laço 4 → 2 → 1). Já foi conferida para números gigantescos, mas ninguém provou.',
      som: 'Cada passo é uma nota: a altura vem do tamanho do número (log de n), então quando o número cai por ÷2 o som desce e quando sobe por ×3+1 o som sobe. Quantos passos o número leva até o 1 escolhe o acorde. A chegada ao 1 e o laço 4 → 2 → 1 dão impulsos no arranjo.',
      imagem: 'Cada caminho até o 1 é um galho: par dobra para um lado, ímpar para o outro, e caminhos que passam pelo mesmo número dividem o galho, formando um coral. As ondas que saem das notas mudam de cor com a energia de cada faixa do som.'
    },
    'corredor-solitario': {
      titulo: 'Corredor Solitário',
      formula: 'n corredores saem juntos de uma pista circular de comprimento 1, cada um com uma velocidade inteira diferente. A posição de cada um é<code>xᵢ(t) = vᵢ · t  (mod 1)</code>A conjectura diz que cada corredor, em algum momento, fica sozinho: a pelo menos 1/n da volta de todos os outros. Está provada até 10 corredores; em geral continua aberta.',
      som: 'Cada corredor toca a sua nota ao passar pela largada. Como as velocidades são diferentes, as notas se cruzam em polirritmia — é essa polirritmia que vira o ritmo dos arpejos. Quando um corredor fica sozinho, ele canta mais forte.',
      imagem: 'Os corredores giram em anéis; quem está sozinho acende. A cada volta completa todos se reencontram na largada e a tela pisca.'
    },
    'formiga-de-langton': {
      titulo: 'Formiga de Langton',
      formula: 'Uma formiga numa grade de casas brancas e pretas. Em casa branca ela vira 90° à direita, em casa preta vira 90° à esquerda; depois troca a cor da casa e anda uma casa.<code>branca → direita · preta → esquerda · inverte a cor · avança</code>Depois de uns 10 mil passos de caos ela sempre começa a construir uma "rodovia" que se repete a cada 104 passos. Ninguém provou que isso acontece a partir de qualquer começo.',
      som: 'Cada batida junta alguns passos: as viradas à esquerda escolhem a nota e a direção da formiga escolhe a voz. No caos a melodia não se repete; quando a rodovia aparece, a música vira um laço de 104 passos — e os arpejos passam a repetir esse laço.',
      imagem: 'A grade com o rastro das casas trocadas; a câmera segue a formiga branca. Na rodovia, o desenho vira uma faixa diagonal que se repete.'
    },
    'recaman': {
      titulo: 'Recamán',
      formula: 'Comece em 0. No passo n, volte n casas se puder (sem ficar negativo e sem cair num número já visitado); se não puder, avance n.<code>a(n) = a(n−1) − n, se possível · senão a(n−1) + n</code>Ninguém sabe se todos os números acabam aparecendo.',
      som: 'Cada termo é uma nota pela sua altura na reta: para trás soa macio, para a frente soa como sino, e repetições ganham uma nota a mais. Como a sequência vai e volta, os arpejos tocam esse vaivém em ziguezague. O acorde fica preso no menor número que ainda falta; quando ele aparece (o 4 só no passo 131), a harmonia se resolve.',
      imagem: 'Cada passo é um arco sobre a reta dos números: para trás, embaixo; para a frente, em cima. Juntos formam a espiral de arcos; no 3D, cada arco gira um pouco e vira uma escultura torcida.'
    },
    'kolakoski': {
      titulo: 'Kolakoski',
      formula: 'Uma sequência de 1 e 2 em que o tamanho dos blocos é a própria sequência:<code>1 2 2 1 1 2 1 2 2 1 2 2 1 1 2 …</code>(um bloco de um 1, um bloco de dois 2, um bloco de dois 1…). A conjectura de Keane diz que, no longo prazo, metade dos termos é 1. Ninguém provou.',
      som: 'É um cânone: a mesma sequência toca em várias vozes, cada uma mais lenta que a outra (na de baixo cada termo dura o seu valor; na de cima, um termo dura um bloco inteiro da de baixo). A voz mais lenta escolhe o acorde; os termos 1 e 2 viram notas curtas e longas, e isso vira o ritmo dos arpejos.',
      imagem: 'Cada faixa da tela é a mesma sequência em outra velocidade, em blocos de 1 (claros) e 2 (escuros). O gráfico embaixo mostra a diferença entre a quantidade de 1 e de 2.'
    },
    'cometa-de-goldbach': {
      titulo: 'Cometa de Goldbach',
      formula: 'Todo número par maior que 2 é a soma de dois primos:<code>E = p + q   (p, q primos)</code>Conjectura de 1742, conferida por computador até números enormes e nunca provada. Contando de quantos jeitos cada par se escreve assim, os pontos formam a figura chamada "cometa de Goldbach".',
      som: 'Cada número par vira um acorde: cada par de primos p + q é uma nota, mais grave quanto mais perto do meio do número. O baixo muda com o resto da divisão por 6 (as três faixas do cometa). Se algum par não tivesse nenhum par de primos, o acorde ficaria mudo e a conjectura cairia.',
      imagem: 'Cada par de primos é um anel em volta do número; os pontos de todos os números (quantos pares cada um tem) desenham a cauda do cometa.'
    },
    'antihydra': {
      titulo: 'Antihydra',
      formula: 'Uma máquina de Turing de 6 estados que, por dentro, faz esta conta:<code>a → a + ⌊a/2⌋ · se a é par, b → b + 2 · se é ímpar, b → b − 1</code>Ela começa em a = 8, b = 0 e para se b chegar a −1. Quase certamente nunca para — metade das vezes a é par —, mas provar isso é tão difícil quanto problemas como o de Collatz.',
      som: 'Par toca uma nota e b sobe; ímpar toca outra e b desce. Quando b chega perto do chão (−1, onde a máquina pararia), entra o sino de alerta. Na vista da fita, cada estado da máquina toca um grau da escala.',
      imagem: 'Cada passo é um anel com os bits de a em binário (o último bit, que decide par ou ímpar, no topo). A linha embaixo é b, e o chão vermelho é −1. Na vista "Fita da máquina" aparece a própria máquina de Turing rodando.'
    },
    'distancias-de-erdos': {
      titulo: 'Distâncias de Erdős',
      formula: 'Com n pontos no plano, quantos pares podem ficar à distância exatamente 1?<code>u(n) = máximo de pares à distância 1</code>Erdős (1946) mostrou que uma grade, com a unidade bem escolhida, dá um pouco mais que n pares, e conjecturou que não dava para ir muito além disso. A página conta como, em maio de 2026, foram encontradas construções melhores.',
      som: 'Os pontos entram um a um, e cada par novo à distância 1 é uma nota. Cada direção (cada jeito de escrever a unidade como soma de dois quadrados, como 65 = 1² + 8² = 4² + 7²) tem um grau próprio. O fuso de Moser (7 pontos, 11 pares) vira um laço rítmico.',
      imagem: 'Os pontos da grade e os segmentos de comprimento 1, coloridos pela direção. O gráfico embaixo mostra pares por ponto, crescendo devagar.'
    },
    'dupla-cobertura': {
      titulo: 'Dupla Cobertura por Ciclos',
      formula: 'Num grafo sem ponte (nenhuma aresta cuja remoção o desconecte), dá para escolher ciclos que passem exatamente duas vezes por cada aresta?<code>cada aresta ∈ exatamente 2 ciclos</code>A pergunta é de Szekeres (1973); a página conta a prova publicada em julho de 2026.',
      som: 'Cada ciclo é uma "linha de ônibus" com um grau da escala; uma luz percorre o ciclo e cada vértice soma um passo. Ciclos de tamanhos diferentes dão a volta em tempos diferentes: é isso que vira polirritmia e o ritmo dos arpejos. Quando duas luzes chegam ao mesmo vértice juntas, toca o sino do encontro.',
      imagem: 'O grafo (do diamante ao icosidodecaedro, passando por Petersen e o hipercubo) com cada ciclo numa cor; no fim, cada aresta fica com duas cores.'
    },
    'noperthedron': {
      titulo: 'Noperthedron',
      formula: 'Um sólido é "de Rupert" se dá para abrir nele um túnel por onde passe outra cópia de mesmo tamanho: em alguma direção, a sombra da cópia cabe dentro da sombra do furo.<code>sombra(cópia) ⊂ interior de sombra(sólido)</code>Por séculos se achou que todo sólido convexo era assim. Em 2025, Steininger e Yurkevich construíram o Noperthedron (90 vértices, 152 faces) e provaram que ele não é.',
      som: 'Duas vozes fixas: a segunda fica a uma quinta justa da primeira quando a margem (quanto a cópia teria de encolher ou poderia crescer) é exatamente 1, e desafina quanto mais longe de 1. No Noperthedron o som chega perto de resolver e nunca resolve.',
      imagem: 'O sólido, a sombra do furo e a sombra da cópia tentando caber; os pontos vermelhos são os vértices da cópia que ficaram para fora.'
    },
    'musica-dos-primos': {
      titulo: 'Música dos Primos — a fórmula explícita de Riemann',
      formula: 'A contagem dos primos (com peso ln p) é uma escada, e Riemann mostrou que ela é exatamente a soma de ondas, uma para cada zero ρ da função zeta:<code>ψ(x) = x − Σ<sub>ρ</sub> x<sup>ρ</sup>/ρ − ln 2π − ½ ln(1 − x⁻²)</code>A hipótese de Riemann diz que todos esses zeros estão sobre a linha ½.',
      som: 'Cada zero é uma frequência: na afinação literal, o zero de altura γ toca γ/14,13 vezes a frequência do primeiro zero, então não há escala, são as próprias razões entre os zeros. O cursor que varre o gráfico toca uma nota em cada primo.',
      imagem: 'A escada ψ(x) e a mesma conta feita só com os zeros já tocados: com poucos zeros é uma ondulação, com muitos encosta na escada. Embaixo, os zeros ½ + iγ sobre a linha crítica.'
    },
    'linha-critica': {
      titulo: 'Linha Crítica — a hipótese de Riemann',
      formula: 'A função zeta:<code>ζ(s) = 1 + 1/2ˢ + 1/3ˢ + 1/4ˢ + …</code>(estendida para todo o plano complexo). A hipótese de Riemann diz que todos os zeros não triviais têm parte real ½: estão sobre a linha Re(s) = ½.',
      som: 'A voz contínua tem volume igual a |ζ(½ + it)|, então ela cala em cada zero; o pan segue o argumento. Os pontos de Gram (onde ζ(½ + it) é real) tocam como pulso; quando a lei de Gram falha, a nota muda.',
      imagem: 'Um ponto sobe pela linha ½ e a zeta o leva ao plano complexo: a curva gira, se enrola e passa exatamente pela origem em cada zero (um clarão). Com a linha fora do ½, ela sempre erra a origem. No 3D, o chão é a faixa crítica e cada zero é um poço sem fundo.'
    },
    'cento-e-noventa-e-seis': {
      titulo: '196 — números de Lychrel',
      formula: 'Pegue um número, inverta os algarismos e some; repita até virar palíndromo:<code>n → n + inverso(n)   (89 + 98 = 187, 187 + 781 = 968 …)</code>O 89 chega em 24 passos. O 196 já foi levado a mais de um bilhão de passos e nunca virou palíndromo. Ninguém provou que exista um número que nunca chega (um "número de Lychrel").',
      som: 'Os primeiros algarismos de cada linha tocam um arpejo (algarismo = grau); o sino fica mais alto quanto mais espelhado está o número; o baixo muda quando nasce um algarismo novo; o palíndromo vira um acorde.',
      imagem: 'Cada linha é o número depois de um passo, cada algarismo com uma cor. Os pares que já se espelham brilham; palíndromo é quando a linha acende inteira. No 196 a parte espelhada fica perto de 50% e nunca chega a 100%.'
    },
    'gilbreath': {
      titulo: 'Gilbreath',
      formula: 'Escreva os primos numa linha e, embaixo, as diferenças entre vizinhos (sem sinal), e de novo, e de novo:<code>dₖ₊₁(i) = | dₖ(i+1) − dₖ(i) |</code>Gilbreath percebeu em 1958 que toda linha começa com 1. Já foi conferido para bilhões de linhas, mas ninguém provou.',
      som: 'A diagonal nova de cada primo toca os primeiros valores maiores que 1 como arpejo (valor/2 = grau); o baixo segue o intervalo entre o primo novo e o anterior; os zeros viram um estalo; o 1 do fim é um sino pedal, sempre a mesma nota.',
      imagem: 'A pirâmide de diferenças: em cima os primos, cada diagonal nova descendo até a coluna da esquerda, sempre em 1. Lá embaixo só há 0 e 2 — é por isso que o 1 sobrevive.'
    },
    'sonoluminescencia': {
      titulo: 'Sonoluminescência',
      formula: 'Uma bolha de ar presa na água por uma onda de som segue a equação de Keller–Miksis para o raio R(t):<code>(1 − Ṙ/c) R R̈ + 3/2 (1 − Ṙ/3c) Ṙ² = (1 + Ṙ/c) (p_bolha − p(t))/ρ + R/(ρc) · dp_bolha/dt</code>No fundo do colapso ela solta um clarão de trilionésimos de segundo. O mecanismo da luz ainda não tem explicação completa.',
      som: 'A onda é um tom contínuo que pulsa com o ciclo; a voz da bolha desce quando ela cresce e sobe no colapso; o clarão é um sino (mais agudo quanto mais quente), o choque é um impulso no arranjo, e os rebotes são notas curtas.',
      imagem: 'A bolha cresce até umas dez vezes o raio de repouso e desaba; no colapso, o clarão. O ciclo está desacelerado: cada volta da onda dura alguns segundos.'
    },
    'de-newton-a-boltzmann': {
      titulo: 'De Newton a Boltzmann',
      formula: 'Partículas que andam reto e só colidem (choques elásticos), olhadas de longe, viram um fluido. A ponte entre os dois é a equação de Boltzmann para a densidade f(x, v, t):<code>∂f/∂t + v · ∇f = Q(f, f)</code>Hilbert pediu essa dedução em 1900; a página conta a dedução anunciada em 2025 por Deng, Hani e Ma.',
      som: 'As colisões viram grãos (mais agudos quando a batida é forte); o rio é uma voz contínua que abre o filtro com a energia do escoamento; os redemoinhos mais fortes tocam notas.',
      imagem: 'De perto, milhares de bolinhas colidindo; de longe, a média das velocidades em cada quadradinho leva uma tinta, e a cor diz o giro (vorticidade). Com o tempo as correntes viram calor e o rio se acalma.'
    },
    'fermi-pasta-ulam': {
      titulo: 'Fermi–Pasta–Ulam–Tsingou',
      formula: 'Uma corda de 32 massas presas por molas um pouco não lineares (pontas fixas):<code>ẍⱼ = (xⱼ₊₁ − 2xⱼ + xⱼ₋₁) + α [ (xⱼ₊₁ − xⱼ)² − (xⱼ − xⱼ₋₁)² ]</code>Tocando só o modo mais grave, esperava-se que a energia se espalhasse até virar ruído. Em vez disso ela passeia por alguns modos e volta quase toda ao começo (a recorrência).',
      som: 'Cada modo é uma voz senoidal com frequência proporcional à do modo (quase a série harmônica); o volume de cada voz segue a energia do modo, então o timbre vai de um seno puro a um som cheio e volta. O sino toca quando a energia volta ao modo 1; o pulso marca cada oscilação do modo 1.',
      imagem: 'Em cima, a corda vibrando; embaixo, a energia de cada modo ao longo do tempo (o gráfico do relatório de 1955).'
    },
    'kuramoto': {
      titulo: 'Kuramoto — vagalumes que sincronizam',
      formula: 'Cada vagalume tem uma fase θᵢ que anda no seu ritmo natural ωᵢ e é puxada pelas outras:<code>dθᵢ/dt = ωᵢ + (K/N) Σⱼ sen(θⱼ − θᵢ)</code>A coerência r (0 = desencontrados, 1 = todos juntos) é o tamanho da média dos e<sup>iθ</sup>. Acima de um acoplamento K crítico, a multidão começa a piscar junto, de repente.',
      som: 'Cada piscada é uma nota (vagalumes mais rápidos são mais agudos); quando muitos piscam juntos entra o pulso grave; a coerência r abre o filtro. O acoplamento sobe e desce sozinho: o estalar vira pulso e o pulso volta a estalar.',
      imagem: 'Os vagalumes piscando; o círculo no canto mostra todas as fases (espalhadas ou num bloco) e a seta é a coerência r.'
    },
    'tres-corpos': {
      titulo: 'Três Corpos',
      formula: 'Três estrelas que se atraem pela gravidade de Newton:<code>mᵢ r̈ᵢ = Σⱼ G mᵢ mⱼ (rⱼ − rᵢ) / |rⱼ − rᵢ|³</code>Não existe fórmula geral para o movimento, e quase sempre ele é caótico. Mas há órbitas raras que se repetem, como a dança em oito (Moore, 1993; Chenciner e Montgomery, 2000).',
      som: 'Cada estrela é uma voz contínua, e a altura de cada uma alimenta os arpejos; os encontros próximos tocam sinos. Basta um empurrão minúsculo para a ordem virar caos, e a música muda junto.',
      imagem: 'As três estrelas e os seus rastros: o oito, a borboleta, o triângulo de Lagrange que se desfaz, o problema de Pitágoras. No modo de posicionar, a linha tracejada é a prévia do que vai acontecer.'
    },
    'liesegang': {
      titulo: 'Anéis de Liesegang',
      formula: 'Um sal A se espalha num gel com outro sal B e forma um produto C, que só precipita quando passa de um limiar:<code>A + B → C · C precipita quando C > limiar</code>Os anéis nascem cada vez mais espaçados, quase em progressão geométrica (lei de Jablczynski: xₙ₊₁/xₙ → constante). Não há explicação aceita por todos.',
      som: 'Cada anel novo é uma nota (e o baixo muda a cada dois); a voz da frente desce enquanto a reação avança, cada vez mais devagar. O intervalo entre as notas cresce sozinho, como um ritardando — e o ritmo dos arpejos se espaça junto.',
      imagem: 'A frente da reação avançando e os anéis de precipitado nascendo um a um; a razão entre um anel e o anterior aparece no texto.'
    },
    'belousov-zhabotinsky': {
      titulo: 'Belousov–Zhabotinsky',
      formula: 'Uma reação química que oscila e desenha espirais. Aqui, o modelo de três substâncias que se perseguem (pedra, papel, tesoura), com a média das vizinhas a, b, c:<code>a → a + a(αb − γc) · b → b + b(βc − αa) · c → c + c(γa − βb)</code>Mudar α, β e γ quebra o equilíbrio e muda o ritmo das ondas.',
      som: 'Eletrodos espalhados pela placa: cada um é uma nota da escala e toca quando a onda de A passa por ele. Quando a placa toda pulsa junto entra o baixo; uma gota jogada na tela faz um respingo.',
      imagem: 'As ondas e espirais de três cores que giram sempre na mesma ordem. Tocar na tela joga uma gota que cria novas espirais.'
    }
  };

  const ONDA = { sawtooth: 'serra', square: 'quadrada', triangle: 'triangular', sine: 'senoidal' };
  const MODO = { eolio: 'menor', dorico: 'dórico', frigio: 'frígio', menorHarm: 'menor harmônica', mixolidio: 'mixolídio', lidio: 'lídio', jonico: 'maior' };
  const NOTAS = ['Ré', 'Mi♭', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Lá♭', 'Lá', 'Si♭', 'Si', 'Dó', 'Dó♯'];

  const slug = (() => { const m = location.pathname.match(/\/conjecturas\/([^/]+)\//); return m ? m[1] : null; })();
  const D = slug && T[slug];
  if (!D) return;

  function identidade() {
    const I = window.MotorKnick && MotorKnick.IDENTIDADES && MotorKnick.IDENTIDADES[slug];
    if (!I) return '';
    const cons = I.cons >= 0.5 ? 'puxa bastante as notas da fórmula para as notas do acorde' : I.cons >= 0.3 ? 'deixa as notas da fórmula meio livres, meio presas ao acorde' : 'deixa as notas da fórmula quase livres, mesmo quando batem contra o acorde';
    return `${I.bpm} bpm, ${NOTAS[I.tom]} ${MODO[I.modo] || I.modo}. Arpejo grave em onda ${ONDA[I.A.o1] || I.A.o1} com ${ONDA[I.A.o2] || I.A.o2}, percorrendo as ${I.A.n || 8} últimas notas da obra${I.A.div === 2 ? ' em colcheias' : ' em semicolcheias'}; arpejo agudo em onda ${ONDA[I.B.o1] || I.B.o1}, lendo a memória de ${I.passoB || 2} em ${I.passoB || 2} notas, de trás para a frente. A harmonia ${cons}. É a cena "Obra" do painel de som; as outras cenas trocam o arranjo, mas a fórmula continua mandando as notas.`;
  }

  const CSS = `
.explica-bt{all:unset;position:fixed;z-index:2147482990;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));
  cursor:pointer;box-sizing:border-box;height:34px;padding:0 13px;border-radius:17px;display:flex;align-items:center;gap:6px;
  background:rgba(14,17,24,.82);color:#e9ecf2;border:1px solid rgba(255,255,255,.22);font:500 13px/1 system-ui,-apple-system,sans-serif;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.explica-bt i{font-style:italic;font-family:Georgia,serif;font-size:15px}
.explica-bt:hover,.explica-bt.on{border-color:#9cc8ff;color:#9cc8ff}
.explica{position:fixed;z-index:2147482991;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(58px + env(safe-area-inset-bottom,0px));
  width:min(440px,calc(100vw - 28px));max-height:calc(100vh - 90px);overflow:auto;box-sizing:border-box;padding:18px 20px 16px;border-radius:14px;
  background:rgba(9,11,16,.95);border:1px solid #2a3442;color:#dfe6ee;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;display:none;
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.explica.on{display:block}
.explica h2{margin:0 0 12px;font:400 19px/1.25 Georgia,"Times New Roman",serif;color:#fff}
.explica h3{margin:14px 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9cc8ff;font-weight:600}
.explica p{margin:0 0 6px}
.explica .c{color:#9aa6b4;font-size:13px}
.explica code{display:block;margin:8px 0;padding:9px 11px;border-radius:8px;background:#121822;border:1px solid #223042;color:#f3e6c4;
  font:15px/1.45 "Cambria Math","STIX Two Math",Georgia,serif;white-space:normal;overflow-wrap:anywhere}
.explica .x{all:unset;position:absolute;top:10px;right:12px;cursor:pointer;color:#8b93a3;font-size:20px;line-height:1}
@media (max-width:520px){.explica{bottom:calc(56px + env(safe-area-inset-bottom,0px));font-size:13.5px}}`;

  function montar() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const bt = document.createElement('button'); bt.className = 'explica-bt'; bt.type = 'button';
    bt.innerHTML = '<i>f(x)</i> sobre a obra'; bt.title = 'A fórmula e como ela vira som e imagem (tecla I)';
    const cx = document.createElement('div'); cx.className = 'explica'; cx.setAttribute('role', 'dialog'); cx.setAttribute('aria-label', 'Sobre a obra');
    cx.innerHTML = `<button class="x" type="button" aria-label="Fechar">×</button><h2>${D.titulo}</h2>
      <h3>A fórmula</h3><p>${D.formula}</p>
      <h3>Como vira som</h3><p>${D.som}</p><p class="c">${SOM_COMUM}</p>
      <h3>Como vira imagem</h3><p>${D.imagem}</p><p class="c">${IMG_COMUM}</p>
      <h3>Esta obra</h3><p class="c id"></p>`;
    document.body.appendChild(bt); document.body.appendChild(cx);
    const abre = (v) => { const on = v == null ? !cx.classList.contains('on') : v; cx.classList.toggle('on', on); bt.classList.toggle('on', on); if (on) cx.querySelector('.id').textContent = identidade(); };
    bt.addEventListener('click', (e) => { e.stopPropagation(); abre(); });
    cx.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); abre(false); });
    // cliques e toques na caixa não chegam à obra (nem começam/param nada)
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'wheel'].forEach((ev) => { bt.addEventListener(ev, (e) => e.stopPropagation()); cx.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev === 'wheel' || ev === 'touchstart' }); });
    addEventListener('keydown', (e) => {
      if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) { abre(); }
      else if (e.key === 'Escape' && cx.classList.contains('on')) abre(false);
    }, true);
    window.Explica = { abrir: () => abre(true), fechar: () => abre(false) };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
