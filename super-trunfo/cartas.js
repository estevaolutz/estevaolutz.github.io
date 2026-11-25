/* Super Trunfo — Mitologia Grega · 48 cartas
   Atributos (1 a 10): poder, inteligência, força, velocidade, agressividade, astúcia, coragem
   Grupos: A Olímpicos (azul) · B Titãs e Divindades (verde) · C Heróis (vermelho) · D Monstros (roxo)
   Super Trunfo: Zeus (A1). Vence qualquer carta sem comparar, exceto os Desafiantes ⚡
   (Tifão, Cronos, Gaia e Prometeu): contra eles vale o atributo escolhido. */

const ATRIBUTOS = [
  {k:"poder",        n:"Poder"},
  {k:"inteligencia", n:"Inteligência"},
  {k:"forca",        n:"Força"},
  {k:"velocidade",   n:"Velocidade"},
  {k:"agressividade",n:"Agressividade"},
  {k:"astucia",      n:"Astúcia"},
  {k:"coragem",      n:"Coragem"},
];

const GRUPOS = {
  A:{n:"Olímpicos",            cor:"#4f8ff7", escura:"#1f4fa8", clara:"#dbe8ff"},
  B:{n:"Titãs e Divindades",   cor:"#5aae3a", escura:"#2f6b1c", clara:"#e0f2d6"},
  C:{n:"Heróis",               cor:"#d23a22", escura:"#8a1d0e", clara:"#fbe0da"},
  D:{n:"Monstros",             cor:"#8a1a66", escura:"#4f0a39", clara:"#f3dcec"},
};

// arquivo do Wikimedia Commons → endereço da imagem
const WM = (f, w=640) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f.replace(/ /g,"_")) + "?width=" + w;

//   código, nome, [poder, intel, força, veloc, agress, astúcia, coragem], imagem, obra, mito
const CARTAS_RAW = [
 // ---------- A · OLÍMPICOS ----------
 ["A1","Zeus",      [10,8,9,7,8,7,9], "img/zeus.jpg", "Escultura de Zeus", "Rei dos deuses, senhor do raio e do Olimpo."],
 ["A2","Hera",      [8,7,4,5,8,8,6],  "img/hera.jpg", "Joseph Paelinck, Juno (1832)", "Rainha do Olimpo, protetora do casamento; ciumenta e vingativa."],
 ["A3","Poseidon",  [9,5,9,6,8,3,7],  "img/poseidon.jpg", "Estátua de Poseidon", "Deus dos mares e dos terremotos, com seu tridente."],
 ["A4","Deméter",   [8,7,5,4,5,5,6],  "img/demeter.jpg", "Estátua de Deméter", "Deusa das colheitas; quando sofre, a terra seca."],
 ["A5","Atena",     [8,10,6,6,5,8,8], "img/atena.jpg", "Estátua de Atena", "Deusa da sabedoria e da estratégia na guerra."],
 ["A6","Apolo",     [8,8,6,8,6,5,7],  "img/apolo.jpg", "Estátua de Apolo com a lira", "Deus da luz, da música, da poesia e das profecias."],
 ["A7","Ártemis",   [7,7,6,9,7,6,8],  "img/artemis.jpg", "Ártemis caçadora, Louvre", "Deusa da caça e da lua, de arco certeiro."],
 ["A8","Ares",      [7,3,9,7,10,2,6], "img/ares.jpg", "Cabeça de Ares, Museu Montemartini", "Deus da guerra brutal; fugiu ferido da batalha de Troia."],
 ["A9","Afrodite",  [9,7,2,5,3,9,4],  "img/afrodite.jpg", "Botticelli, O Nascimento de Vênus", "Deusa do amor e da beleza; começou a Guerra de Troia."],
 ["A10","Hefesto",  [7,9,8,1,4,7,6],  WM("Velázquez - La Fragua de Vulcano (Museo del Prado, 1630).jpg"), "Velázquez, A Forja de Vulcano (1630)", "Ferreiro dos deuses; manco, forjou o raio de Zeus."],
 ["A11","Hermes",   [7,8,4,10,3,10,6],"img/hermes.jpg", "Pintura de Hermes com o caduceu", "Mensageiro de sandálias aladas, deus dos viajantes e dos ladrões."],
 ["A12","Dionísio", [7,6,5,5,7,8,6],  "img/dionisio.jpg", "Vaso grego: Dionísio na pantera", "Deus do vinho, das festas e do teatro."],

 // ---------- B · TITÃS E DIVINDADES ----------
 ["B1","Hades",     [9,8,7,4,5,7,7],  "img/hades.jpg", "Vaso grego: Hades rapta Perséfone", "Senhor do mundo dos mortos e de todas as riquezas da terra."],
 ["B2","Perséfone", [8,7,3,5,4,8,7],  WM("Persephone Hades BM Vase E82 (cropped).jpg"), "Cálice ático, British Museum E82", "Rainha do mundo dos mortos; sua volta traz a primavera."],
 ["B3","Héstia",    [8,9,3,2,1,5,7],  WM("Hestia Giustiniani.jpg"), "Héstia Giustiniani, escultura romana", "Deusa do fogo do lar; a mais pacífica dos deuses."],
 ["B4","Eros",      [8,6,2,9,4,8,6],  WM("Flying Eros MAN Firenze 91456 detail.jpg"), "Kylix de Kachrylion, c. 510 a.C., Florença", "Deus do amor; suas flechas apaixonam até os deuses."],
 ["B5","Pã",        [6,5,6,8,6,7,5],  WM("Pan statuette, S 199, Roman, 1st century AD, marble, from a Greek prototype of the 4th century BC - Musei Capitolini - Rome, Italy - DSC06171.jpg"), "Estatueta romana de Pã, Museus Capitolinos", "Deus dos bosques e pastores, metade bode; espalha o pânico."],
 ["B6","Gaia",      [10,8,8,1,6,8,8], WM("Pergamonmuseum - Antikensammlung - Pergamonaltar 13 detail.jpg"), "Altar de Pérgamo, Gigantomaquia", "A Terra, mãe de tudo; mãe dos Titãs e de Tifão.", "desafiante"],
 ["B7","Urano",     [9,5,8,2,7,3,6],  WM("Aion mosaic Glyptothek Munich W504.jpg"), "Mosaico de Sentinum, Gliptoteca de Munique", "O Céu estrelado, primeiro rei do universo."],
 ["B8","Cronos",    [9,7,8,4,9,8,6],  "img/cronos.jpg", "Rubens, Saturno devorando um filho", "Titã que devorava os filhos para não perder o trono.", "desafiante"],
 ["B9","Reia",      [8,8,5,4,3,9,7],  WM("Rhea handing a swaddled stone to Cronus, Attic terracotta pelike, c. 460–450 BC, Met 06.1021.144.jpg (cropped).jpg"), "Pelike ática, c. 460 a.C., Met", "Mãe dos deuses; enganou Cronos com uma pedra no lugar de Zeus."],
 ["B10","Atlas",    [7,4,10,3,7,3,8], "img/atlas.jpg", "Afresco: Atlas sustenta o céu", "Titã condenado a carregar o céu nos ombros para sempre."],
 ["B11","Prometeu", [7,10,7,5,2,10,10],"img/prometeu.jpg", "Taça laconiana: Prometeu e a águia", "Roubou o fogo dos deuses para dar aos humanos.", "desafiante"],
 ["B12","Hélio",    [8,6,6,9,4,4,6],  WM("Architrave with sculpted metope showing sun god Helios in a quadriga; from temple of Athena at Troy, ca 300-280 BCE; Altes Museum, Berlin (25308440197) (cropped) 1.jpg"), "Métope do templo de Atena em Troia", "O Sol, que cruza o céu todo dia num carro de fogo."],

 // ---------- C · HERÓIS ----------
 ["C1","Hércules",  [6,4,10,7,9,4,9], "img/hercules.jpg", "Kylix: Hércules e o leão de Nemeia", "O mais forte dos heróis, autor dos Doze Trabalhos."],
 ["C2","Aquiles",   [5,5,9,10,9,4,9], "img/aquiles.jpg", "Vaso grego: Aquiles em combate", "Guerreiro invencível de Troia, de pés velozes; só o calcanhar era fraco."],
 ["C3","Odisseu",   [3,10,6,5,4,10,7],"img/odisseu.jpg", "Pintura: Odisseu cega o ciclope", "O rei de Ítaca, inventor do Cavalo de Troia."],
 ["C4","Perseu",    [4,7,6,8,5,8,8],  "img/perseu.jpg", "Vaso grego: Perseu e Medusa", "Cortou a cabeça da Medusa com sandálias aladas e escudo espelhado."],
 ["C5","Teseu",     [4,8,8,6,6,8,9],  "img/teseu.jpg", "Mosaico romano: Teseu e o Minotauro", "Venceu o Minotauro e saiu do labirinto com o fio de Ariadne."],
 ["C6","Jasão",     [3,7,6,6,5,8,8],  "img/jasao.jpg", "Vaso grego: Jasão e o velo de ouro", "Capitão dos Argonautas na busca do velo de ouro."],
 ["C7","Heitor",    [3,7,8,7,6,5,10], "img/heitor.jpg", "Vaso grego: Aquiles e Heitor, British Museum", "Príncipe e defensor de Troia; enfrentou Aquiles sabendo que ia morrer."],
 ["C8","Ájax",      [3,3,10,5,8,2,9], "img/ajax.jpg", "Ânfora de Exéquias: Ájax e Aquiles jogando", "Gigante de Salamina, muralha dos gregos em Troia."],
 ["C9","Belerofonte",[4,5,6,9,6,5,8], "img/belerofonte.jpg", "Prato apuliano: Belerofonte no Pégaso", "Montou o cavalo alado Pégaso e venceu a Quimera."],
 ["C10","Orfeu",    [7,8,2,4,1,7,8],  "img/orfeu.jpg", "Pintura: Orfeu e Eurídice no mundo dos mortos", "Músico cuja lira encantava feras, pedras e o próprio Hades."],
 ["C11","Castor",   [4,7,6,9,5,6,7],  "img/castor.jpg", "Pintura: os Dióscuros", "Gêmeo mortal, o melhor domador de cavalos da Grécia."],
 ["C12","Pólux",    [5,5,9,6,7,4,7],  "img/polux.jpg", "Pintura: os Dióscuros", "Gêmeo imortal, filho de Zeus, campeão de pugilato."],

 // ---------- D · MONSTROS ----------
 ["D1","Tifão",     [10,4,10,6,10,4,9], WM("Typhon Staatliche Antikensammlungen 596.jpg"), "Hídria calcídica, c. 540 a.C., Munique", "O monstro mais terrível de todos; quase derrotou Zeus.", "desafiante"],
 ["D2","Cérbero",   [6,2,8,8,10,1,7], "img/cerbero.jpg", "Vaso grego: Hércules e Cérbero", "Cão de três cabeças que guarda a porta do mundo dos mortos."],
 ["D3","Hidra",     [8,1,8,3,9,2,8],  "img/hidra.jpg", "Vaso grego: a Hidra de Lerna", "Serpente de muitas cabeças: corte uma, nascem duas."],
 ["D4","Medusa",    [9,5,3,3,7,6,5],  "img/medusa.jpg", "Rubens, A Cabeça da Medusa", "Górgona de cabelos de serpente; quem a olha vira pedra."],
 ["D5","Minotauro", [3,2,9,6,10,2,6], "img/minotauro.jpg", "Pintura: Teseu e o Minotauro", "Metade homem, metade touro, preso no labirinto de Creta."],
 ["D6","Ciclope",   [5,2,10,3,8,1,7], "img/ciclope.jpg", "Busto de Polifemo", "Polifemo, gigante de um olho só, enganado por Odisseu."],
 ["D7","Quimera",   [7,2,8,7,9,2,6],  WM("Chimera d'arezzo, fi, 04.JPG"), "Quimera de Arezzo, bronze etrusco, c. 400 a.C.", "Leão, cabra e serpente num só corpo, cuspindo fogo."],
 ["D8","Esfinge",   [6,10,6,5,6,9,5], WM("16541- Pittore di Edipo, Kylix attica, Edipo ascolta l'enigma postogli dalla Sfinge, 470-460 aC -FG.jpg"), "Kylix do Pintor de Édipo, Museus Vaticanos", "Devorava quem não decifrasse seu enigma; Édipo acertou."],
 ["D9","Cila",      [6,2,9,4,9,3,5],  WM("Scylla Louvre CA1341.jpg"), "Cratera beócia, c. 440 a.C., Louvre", "Monstro marinho de seis cabeças no estreito dos navegantes."],
 ["D10","Harpias",  [4,3,4,10,8,6,4], WM("Phineus Boreads Louvre G364.jpg"), "Cratera ática, c. 460 a.C., Louvre", "Mulheres-pássaro que roubavam a comida do rei Fineu."],
 ["D11","Sereias",  [8,7,1,5,3,10,3], WM("Odysseus Sirens BM E440 n2.jpg"), "Estamno do Pintor da Sereia, British Museum", "Seu canto atraía os marinheiros para a morte."],
 ["D12","Leão de Nemeia",[7,1,9,8,9,2,8], WM("Mosaico Trabajos Hércules (M.A.N. Madrid) 01.jpg"), "Mosaico romano de Llíria, Madri", "Leão de pele invulnerável, o 1º trabalho de Hércules."],
];

// enquadramento da imagem (object-position) quando o centro corta o rosto
const ENQUADRAMENTO = {B3:"50% 8%", B5:"50% 22%", A8:"50% 30%", A7:"50% 20%", A2:"50% 25%", B2:"50% 30%"};

const CARTAS = CARTAS_RAW.map(([cod,nome,v,img,obra,mito,flag]) => {
  const c = {cod, nome, grupo:cod[0], img, obra, mito, pos: ENQUADRAMENTO[cod] || "50% 50%", desafiante: flag==="desafiante", superTrunfo: cod==="A1"};
  ATRIBUTOS.forEach((a,i)=> c[a.k]=v[i]);
  c.total = v.reduce((s,x)=>s+x,0);
  return c;
});
