// Maquete de Stalingrado — motor gráfico do projeto do Dia D (mesa, moldura graduada, sombras,
// símbolos em placas, trajetos, diário, ficha e linha do tempo), com os dados já reunidos para Stalingrado.
(function () {
"use strict";
const SG = window.SG;
const GEO = { LON0: 40.6, LON1: 45.4, LAT0: 47.5, LAT1: 49.9, KMX: 352.66265125157486, KMY: 266.88, GW: 1024, GH: 775 };
const HBASE = -45; // m abaixo do qual nada desce (baixada do Cáspio chega a −42 m)
const $ = (s) => document.querySelector(s);
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const LITE = /lite/.test(location.search);
const MOBILE = LITE || Math.min(innerWidth, innerHeight) < 700 || /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
const KX = 111.32 * Math.cos(48.7 * Math.PI / 180), KY = 111.2;
const { GW, GH, KMX, KMY, LON0, LON1, LAT0, LAT1 } = GEO;
let EXAG = 12, HGT = null, WAT = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function toX(lon) { return (lon - LON0) * KX - KMX / 2; }
function toZ(lat) { return (LAT1 - lat) * KY - KMY / 2; }
function hAt(lat, lon) {
  const gx = clamp((lon - LON0) / (LON1 - LON0) * GW - 0.5, 0, GW - 1.001);
  const gy = clamp((LAT1 - lat) / (LAT1 - LAT0) * GH - 0.5, 0, GH - 1.001);
  const x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0, i = y0 * GW + x0;
  return lerp(lerp(HGT[i], HGT[i + 1], fx), lerp(HGT[i + GW], HGT[i + GW + 1], fx), fy);
}
function yAt(lat, lon) { return (hAt(lat, lon) - HBASE) * EXAG / 1000; }
const setLoad = (p) => { const b = $("#loadbar"); if (b) b.style.width = Math.round(p * 100) + "%"; };

// ---------------- tempo: dias desde 23 ago 1942 ----------------
const D0 = Date.UTC(1942, 7, 23);
const day = (s) => { const [y, m, d] = s.split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d) - D0) / 864e5); };
const T0 = 0, T1 = day(SG.END);
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmt(t) { const dt = new Date(D0 + Math.floor(t) * 864e5); return [dt.getUTCDate() + " " + MES[dt.getUTCMonth()], dt.getUTCFullYear()]; }
const PHASES = [["1942-08-23", "Aproximação"], ["1942-09-13", "Combate urbano"], ["1942-11-19", "Operação Urano"], ["1942-11-24", "Cerco e socorro"], ["1942-12-30", "Destruição do bolsão"]].map(([d, n]) => [day(d), n]);

// ---------------- cidade: posições pela margem real do Volga ----------------
const BANK = SG.VOLGA_BANK.map(([lo, la]) => ({ x: (lo - 44.5) * KX, z: -(la - 48.7) * KY }));
function cityLL(lat, km) {
  const z = -(lat - 48.7) * KY;
  for (let i = 1; i < BANK.length; i++) {
    const a = BANK[i - 1], b = BANK[i];
    if ((a.z - z) * (b.z - z) <= 0) {
      const f = (z - a.z) / ((b.z - a.z) || 1), dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
      const x = a.x + dx * f + nx * km, zz = z + nz * km;
      return [48.7 - zz / KY, 44.5 + x / KX];
    }
  }
  return [lat, 44.5];
}

// ---------------- dados: unidades, QGs, eventos ----------------
const NATS = { de: "DE", ro: "RO", it: "IT", hu: "HU", su: "SU" };
const NATN = { de: "Alemanha", ro: "Romênia", it: "Itália", hu: "Hungria", su: "União Soviética" };
const SIZEN = { XXXX: "Exército", XXX: "Corpo", XX: "Divisão", X: "Brigada" };
const TYPEMAP = { inf: "inf", arm: "armor", mech: "mech", air: "air" };
const UNITS = SG.UNITS.map((u) => ({ ...u, div: false, track: u.path.map(([d, lo, la]) => [day(d), la, lo]) }))
  .concat(SG.CITY.DIVS.map((u) => ({ ...u, div: true, track: u.path.map(([d, lat, km]) => { const [la, lo] = cityLL(lat, km); return [day(d), la, lo]; }) })));
UNITS.forEach((u) => {
  u.t0 = u.start ? day(u.start) : u.track[0][0]; u.t1 = day(u.end || SG.END);
  const st = SG.STR[u.id]; u.st = st || null;
  if (st) { u.sp = st.p.map(([d, men, tk, est]) => ({ t: day(d), men, tk: tk || 0, est: !!est })); u.maxMen = Math.max(...u.sp.map((p) => p.men)); u.maxTk = Math.max(...u.sp.map((p) => p.tk)); }
});
const ECH_REF = { XXXX: 90000, XXX: 35000, XX: 10000, X: 4000 };
function strengthAt(u, t) {
  const p = u.sp; if (!p) return null;
  if (t <= p[0].t) return { men: p[0].men, tk: p[0].tk, est: p[0].est };
  for (let i = 1; i < p.length; i++) if (t <= p[i].t) { const a = p[i - 1], b = p[i], f = (t - a.t) / (b.t - a.t || 1); return { men: lerp(a.men, b.men, f), tk: lerp(a.tk, b.tk, f), est: !(f < 0.02 ? !a.est : f > 0.98 ? !b.est : false) }; }
  const l = p[p.length - 1]; return { men: l.men, tk: l.tk, est: l.est };
}
const fmtMen = (n) => n >= 10000 ? Math.round(n / 1000) + " mil" : n >= 1000 ? (Math.round(n / 100) / 10).toString().replace(".", ",") + " mil" : String(Math.round(n / 10) * 10);
const EVENTS = SG.EVENTS.map((e) => ({ t: day(e.d), lat: e.focus ? e.focus[1] : null, lon: e.focus ? e.focus[0] : null, dist: e.focus ? clamp(e.focus[2] * 1.1, 8, 340) : 200, title: e.t, text: e.x, side: e.k, dur: e.dur || 4, arrows: e.arrows || [] }));
const OFFMAP = [
  ["ax", "OKH · Hitler", "Wolfsschanze, Rastenburg (Prússia Oriental) e Vinnytsia (Werwolf, até nov.)"],
  ["ax", "Grupo de Exércitos B", "Gen.-Cel. von Weichs · Starobelsk"],
  ["ax", "Luftflotte 4", "Gen.-Cel. von Richthofen · Morozovsk e Tatsinskaya (na mesa)"],
  ["su", "Stavka", "Stalin; Zhukov e Vasilevsky, coordenadores · Moscou"],
  ["su", "Frente Sudoeste", "Gen. Vatutin · Serafimovich (na mesa)"],
  ["su", "Frente do Don", "Gen. Rokossovsky · Malaya Ivanovka (na mesa)"],
];
const PRESETS = {
  geral: { name: "Visão geral", lat: 48.75, lon: 43.0, dist: 330, pol: 46, az: 0 },
  cidade: { name: "Stalingrado", lat: 48.72, lon: 44.52, dist: 26, pol: 40, az: -14 },
  donbogen: { name: "Curva do Don", lat: 48.85, lon: 43.75, dist: 110, pol: 48, az: 0 },
  uranon: { name: "Urano · norte", lat: 49.25, lon: 43.05, dist: 120, pol: 50, az: -8 },
  uranos: { name: "Urano · sul", lat: 48.2, lon: 44.25, dist: 100, pol: 50, az: 10 },
  tempestade: { name: "Tempestade de Inverno", lat: 47.95, lon: 43.6, dist: 120, pol: 50, az: 0 },
  saturno: { name: "Pequeno Saturno", lat: 48.85, lon: 41.6, dist: 150, pol: 48, az: 0 },
  bolsao: { name: "O bolsão", lat: 48.72, lon: 44.1, dist: 75, pol: 44, az: 0 },
};

// ---------------- renderer, cena, câmera ----------------
const canvas = $("#stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(DPR);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1116);
scene.fog = new THREE.Fog(0x0b1116, 600, 1500);
const camera = new THREE.PerspectiveCamera(36, 1, 0.2, 4000);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
controls.minDistance = 3; controls.maxDistance = 620;
controls.screenSpacePanning = false; controls.zoomSpeed = 1.1; controls.rotateSpeed = 0.6;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

const hemi = new THREE.HemisphereLight(0xcfd9e3, 0x5b4d3a, 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); scene.add(sun); scene.add(sun.target);
sun.shadow.mapSize.setScalar(LITE ? 1024 : MOBILE ? 2048 : 4096);
{ const c = sun.shadow.camera; c.left = -KMX / 2 - 8; c.right = KMX / 2 + 8; c.top = KMY / 2 + 8; c.bottom = -KMY / 2 - 8; c.near = 1; c.far = 1400; }
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.1; sun.castShadow = true;

const G = {};
for (const k of ["units", "trails", "hqs", "ops", "fx", "plan"]) { G[k] = new THREE.Group(); scene.add(G[k]); }

// ---------------- texturas desenhadas ----------------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
const softTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.75)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const sparkTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.12, "rgba(255,240,200,.9)"); gr.addColorStop(0.35, "rgba(255,170,80,.35)"); gr.addColorStop(1, "rgba(255,120,40,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const smokeTex = canvasTex(128, 128, (g, w, h) => {
  for (let i = 0; i < 26; i++) {
    const x = w / 2 + (hash(i) - .5) * w * .45, y = h / 2 + (hash(i + 9) - .5) * h * .45, r = w * (.16 + hash(i + 3) * .18);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
});

// ---------------- símbolos militares ----------------
const FILL = { ax: "#a9c9ef", su: "#f1a99c" }, INK = { ax: "#0f2b47", su: "#4b120b" };
function drawSymbol(g, o) {
  const A = o.side, fx = 48, fy = 58, fw = 160, fh = 100;
  g.clearRect(0, 0, 256, 232);
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(fx + 5, fy + 7, fw, fh);
  g.fillStyle = o.fill || FILL[A]; g.fillRect(fx, fy, fw, fh);
  g.lineWidth = 7; g.strokeStyle = INK[A]; g.strokeRect(fx, fy, fw, fh);
  g.lineWidth = 6; g.lineCap = "round"; g.strokeStyle = INK[A]; g.fillStyle = INK[A];
  const t = o.type, X = () => { g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + fw, fy + fh); g.moveTo(fx + fw, fy); g.lineTo(fx, fy + fh); g.stroke(); };
  const capsule = (s = 1) => { const w = 92 * s, h = 46 * s, cx = fx + fw / 2, cy = fy + fh / 2; g.beginPath(); g.moveTo(cx - w / 2 + h / 2, cy - h / 2); g.lineTo(cx + w / 2 - h / 2, cy - h / 2); g.arc(cx + w / 2 - h / 2, cy, h / 2, -Math.PI / 2, Math.PI / 2); g.lineTo(cx - w / 2 + h / 2, cy + h / 2); g.arc(cx - w / 2 + h / 2, cy, h / 2, Math.PI / 2, Math.PI * 1.5); g.stroke(); };
  if (o.hq) { g.font = "700 46px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("QG", fx + fw / 2, fy + fh / 2 + 2); }
  else if (t === "inf") X();
  else if (t === "armor") capsule();
  else if (t === "mech") { X(); capsule(.8); }
  else if (t === "air") { const cx = fx + fw / 2, cy = fy + fh / 2; g.beginPath(); g.ellipse(cx - 26, cy, 26, 15, 0, 0, 7); g.moveTo(cx + 52, cy); g.ellipse(cx + 26, cy, 26, 15, 0, 0, 7); g.stroke(); }
  if (o.size) { g.fillStyle = INK[A]; g.font = "700 40px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillText(o.size, fx + fw / 2, fy - 9); }
  if (o.nat) { g.fillStyle = INK[A]; g.font = "600 22px 'Barlow Condensed', sans-serif"; g.textAlign = "right"; g.textBaseline = "top"; g.fillText(o.nat, fx + fw - 8, fy + 6); }
  if (o.hq) { g.lineWidth = 7; g.strokeStyle = INK[A]; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, 230); g.stroke(); }
  if (o.label) {
    g.font = "600 36px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    const w = Math.min(250, g.measureText(o.label).width + 22), x = 128 - w / 2, y = fy + fh + 14;
    g.fillStyle = INK[A]; roundRect(g, x, y, w, 44, 8); g.fill();
    g.fillStyle = "#f4f1e8"; g.fillText(o.label, 128, y + 23, 236);
  }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function symbolTexture(o) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 232;
  drawSymbol(c.getContext("2d"), o);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter; return { tex: t, canvas: c, ctx: c.getContext("2d") };
}
function symbolInto(canvasEl, o) { const c = document.createElement("canvas"); c.width = 256; c.height = 232; drawSymbol(c.getContext("2d"), o); const g = canvasEl.getContext("2d"); canvasEl.width = canvasEl.clientWidth * DPR; canvasEl.height = canvasEl.clientHeight * DPR; g.drawImage(c, 0, 0, canvasEl.width, canvasEl.height); }
const unitSym = (u) => ({ side: u.side, type: TYPEMAP[u.type] || "inf", size: u.ech, nat: NATS[u.nat], fill: u.nat === "ro" ? "#e8d48a" : u.nat === "it" ? "#a9d6ab" : u.nat === "hu" ? "#ecbd92" : null });

// ---------------- carregamento ----------------
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Falha ao carregar " + src)); i.src = src; }); }
const BIG = !MOBILE && renderer.capabilities.maxTextureSize >= 8192;
async function boot() {
  setLoad(.05);
  const fontsReady = Promise.all([document.fonts.load("700 40px 'Barlow Condensed'"), document.fonts.load("600 36px 'Barlow Condensed'")]).catch(() => {});
  const [hImg, mImg] = await Promise.all([loadImage("height.png"), loadImage(MOBILE ? "map_mobile.jpg" : "map.jpg")]);
  setLoad(.45);
  await fontsReady;
  const c = document.createElement("canvas"); c.width = GW; c.height = GH;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(hImg, 0, 0);
  const d = g.getImageData(0, 0, GW, GH).data; HGT = new Float32Array(GW * GH); WAT = new Uint8Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) { HGT[i] = ((d[i * 4] << 8) | d[i * 4 + 1]) / 100 - 50; WAT[i] = d[i * 4 + 2] > 127 ? 1 : 0; }
  const mapTex = new THREE.Texture(mImg); mapTex.encoding = THREE.sRGBEncoding; mapTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  mapTex.minFilter = THREE.LinearMipmapLinearFilter; mapTex.generateMipmaps = true; mapTex.needsUpdate = true;
  setLoad(.6);
  buildTerrain(mapTex); setLoad(.7);
  buildPlan(); buildUnits(); buildHQs(); buildOps(); buildFX(); buildWeather(); setLoad(.9);
  buildUI();
  resize(); flyTo("geral", true);
  setTime(0);
  setLoad(1);
  const L = $("#loading"); L.style.opacity = 0; setTimeout(() => L.remove(), 700);
  renderer.setAnimationLoop(frame);
}

// ---------------- terreno, laje e moldura ----------------
const SNOW = { uSnow: { value: 0 }, uIce: { value: 0 } };
let terrain, terrainGeo, walls = [], overlay, overlayCtx, overlayTex;
function buildTerrain(mapTex) {
  terrainGeo = new THREE.PlaneGeometry(KMX, KMY, GW - 1, GH - 1); terrainGeo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.93, metalness: 0 });
  // neve sobre a carta: clareia o papel e deixa a tinta (curvas, rios, nomes) visível; gelo sobre a água azul
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SNOW);
    sh.fragmentShader = "uniform float uSnow, uIce;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(.3, .55, .15));
  float blue = smoothstep(.02, .08, c.b - c.r);
  float paper = smoothstep(.18, .42, lum);
  float n = fract(sin(dot(floor(vUv * 900.0), vec2(12.9898, 78.233))) * 43758.5453);
  float s = uSnow * paper * (1.0 - blue) * (.82 + .18 * n);
  c = mix(c, vec3(.92, .94, .97) * clamp(lum / .8, .5, 1.08), s * .62);
  c = mix(c, vec3(.80, .86, .91), uIce * blue * .85);
  diffuseColor.rgb = c;
}`);
  };
  terrain = new THREE.Mesh(terrainGeo, mat);
  terrain.receiveShadow = true; terrain.castShadow = true; scene.add(terrain);
  // camada das frentes: pintada num canvas sobre a mesma malha
  const oc = document.createElement("canvas"); oc.width = MOBILE ? 2048 : 4096; oc.height = Math.round(oc.width * KMY / KMX);
  overlayCtx = oc.getContext("2d"); overlayTex = new THREE.CanvasTexture(oc); overlayTex.encoding = THREE.sRGBEncoding; overlayTex.anisotropy = 8;
  overlay = new THREE.Mesh(terrainGeo, new THREE.MeshBasicMaterial({ map: overlayTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -14, polygonOffsetUnits: -14 }));
  overlay.renderOrder = 4; scene.add(overlay);
  const tableTex = canvasTex(512, 512, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "#2b3238"); gr.addColorStop(0.5, "#1b2126"); gr.addColorStop(1, "#0b1116"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${hash(i) * .025})`; g.fillRect(hash(i + 1) * w, hash(i + 2) * h, 1, 1); }
  });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.9 }));
  table.rotateX(-Math.PI / 2); table.position.y = BASE - 0.4; table.receiveShadow = true; scene.add(table);
  buildFrame();
  applyExag();
}
const BASE = -3.2;
const strataTex = canvasTex(64, 256, (g, w, h) => {
  const bands = [["#c9bd99", 10], ["#b7a47d", 18], ["#d3c7a5", 26], ["#8f7a5b", 34], ["#b3a07a", 24], ["#6e5c45", 40], ["#9e8a69", 30], ["#5a4a39", 74]];
  let y = 0; for (const [c, hh] of bands) { g.fillStyle = c; g.fillRect(0, y, w, hh); y += hh; }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${hash(i) * .12})`; g.fillRect(hash(i + 4) * w, hash(i + 7) * h, 2, 1); }
});
strataTex.wrapS = THREE.RepeatWrapping;
function buildWalls() {
  for (const w of walls) { scene.remove(w); w.geometry.dispose(); }
  walls = [];
  const sides = [{ n: GW, idx: (k) => k }, { n: GW, idx: (k) => (GH - 1) * GW + (GW - 1 - k) }, { n: GH, idx: (k) => (GH - 1 - k) * GW }, { n: GH, idx: (k) => k * GW + GW - 1 }];
  const pos = terrainGeo.attributes.position;
  const mat = new THREE.MeshStandardMaterial({ map: strataTex, roughness: 0.95, vertexColors: true });
  for (const s of sides) {
    const P = [], U = [], C = [], I = [];
    let acc = 0, px = null, pz = null;
    for (let k = 0; k < s.n; k++) {
      const i = s.idx(k), x = pos.getX(i), z = pos.getZ(i), yt = pos.getY(i);
      if (px !== null) acc += Math.hypot(x - px, z - pz); px = x; pz = z;
      const w = WAT[i] === 1;
      P.push(x, yt, z, x, BASE, z); U.push(acc / 18, 0, acc / 18, 1);
      C.push(...(w ? [0.55, 0.72, 0.85] : [1, 1, 1]), ...(w ? [0.32, 0.42, 0.5] : [0.8, 0.8, 0.8]));
      if (k > 0) { const a = (k - 1) * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); geo.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    geo.setIndex(I); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); walls.push(m);
  }
}
function buildFrame() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.55, metalness: 0.05 });
  const W = 3.2, top = 0.35, H = top - (BASE - 0.15);
  const mkSide = (len, isLat, flip) => canvasTex(4096, 64, (g, w, h) => {
    g.fillStyle = "#e9e1cc"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1b1712"; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    const a0 = isLat ? LAT0 : LON0, a1 = isLat ? LAT1 : LON1, steps = Math.round((a1 - a0) * 12); // marca a cada 5′
    g.font = "600 26px 'IBM Plex Mono', monospace"; g.textBaseline = "middle"; g.textAlign = "center";
    for (let m = 0; m <= steps; m++) {
      let x = m / steps * w; if (flip) x = w - x;
      const big = m % 6 === 0;
      g.fillRect(x - 1, 3, 2, big ? 26 : 12); g.fillRect(x - 1, h - (big ? 26 : 12) - 3, 2, big ? 26 : 12);
      if (big && m > 0 && m < steps) {
        const v = a0 + m / 12, deg = Math.floor(v), mn = Math.round((v - deg) * 60);
        const s = `${deg}°${String(mn).padStart(2, "0")}′${isLat ? "N" : "E"}`;
        g.fillStyle = "#e9e1cc"; g.fillRect(x - 70, h / 2 - 14, 140, 28); g.fillStyle = "#1b1712"; g.fillText(s, x, h / 2 + 1);
      }
    }
  });
  const mk = (len, rotY, x, z, tex) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(len, H, W), [wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), wood, wood, wood]);
    box.position.set(x, BASE - 0.15 + H / 2, z); box.rotation.y = rotY; box.castShadow = true; box.receiveShadow = true; scene.add(box);
  };
  mk(KMX + 2 * W, 0, 0, -KMY / 2 - W / 2, mkSide(KMX, false, false));
  mk(KMX + 2 * W, Math.PI, 0, KMY / 2 + W / 2, mkSide(KMX, false, true));
  mk(KMY, Math.PI / 2, -KMX / 2 - W / 2, 0, mkSide(KMY, true, false));
  mk(KMY, -Math.PI / 2, KMX / 2 + W / 2, 0, mkSide(KMY, true, true));
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(KMX + 2 * W + 1.2, 0.36, KMY + 2 * W + 1.2), wood);
  plinth.position.y = BASE - 0.2; plinth.receiveShadow = true; plinth.castShadow = true; scene.add(plinth);
}
function applyExag() {
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < GW * GH; i++) pos.setY(i, (HGT[i] - HBASE) * EXAG / 1000);
  pos.needsUpdate = true; terrainGeo.computeVertexNormals(); terrainGeo.computeBoundingSphere(); terrainGeo.computeBoundingBox();
  buildWalls();
  if (trailsBuilt) { rebuildTrails(); rebuildPlan(); rebuildOps(); }
  for (const h of hqObjs) placeHQ(h);
}

// ---------------- planta alemã de 1942 em alta resolução sobre a cidade ----------------
const planMeshes = [];
function buildPlan() {
  for (const pl of [].concat(SG.PLANTA || [])) {
    const file = pl.file8k && BIG ? pl.file8k : pl.file;
    const tex = new THREE.TextureLoader().load(file); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.userData.pl = pl; m.receiveShadow = true; m.renderOrder = 1; G.plan.add(m); planMeshes.push(m);
  }
  rebuildPlan();
}
function rebuildPlan() {
  // a planta usa exatamente os vértices do terreno sob ela (sem z-fighting), com UV pela lat/lon
  const tp = terrainGeo.attributes.position;
  planMeshes.forEach((m, n) => {
    const pl = m.userData.pl;
    const i0 = Math.ceil((pl.lon[0] - LON0) / (LON1 - LON0) * (GW - 1)), i1 = Math.floor((pl.lon[1] - LON0) / (LON1 - LON0) * (GW - 1));
    const j0 = Math.ceil((LAT1 - pl.lat[1]) / (LAT1 - LAT0) * (GH - 1)), j1 = Math.floor((LAT1 - pl.lat[0]) / (LAT1 - LAT0) * (GH - 1));
    const NX = i1 - i0, pos = [], uv = [], idx = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * GW + i, lo = LON0 + i / (GW - 1) * (LON1 - LON0), la = LAT1 - j / (GH - 1) * (LAT1 - LAT0);
      pos.push(tp.getX(k), tp.getY(k), tp.getZ(k));
      uv.push((lo - pl.lon[0]) / (pl.lon[1] - pl.lon[0]), (la - pl.lat[0]) / (pl.lat[1] - pl.lat[0]));
      if (i < i1 && j < j1) { const a = (j - j0) * (NX + 1) + (i - i0); idx.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2); }
    }
    m.geometry.dispose(); const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    m.geometry = g; m.renderOrder = 1 + n; m.material.polygonOffsetFactor = m.material.polygonOffsetUnits = -3 - 3 * n;
  });
}

// ---------------- unidades ----------------
const unitObjs = []; let trailsBuilt = false;
const ringGeo = new THREE.RingGeometry(0.16, 0.24, 28); ringGeo.rotateX(-Math.PI / 2);
function trackAt(tr, t) {
  if (t <= tr[0][0]) return [tr[0][1], tr[0][2], 0];
  for (let i = 1; i < tr.length; i++) if (t <= tr[i][0]) {
    const a = tr[i - 1], b = tr[i], f = (t - a[0]) / (b[0] - a[0] || 1);
    const moving = Math.hypot(b[1] - a[1], b[2] - a[2]) > 0.002 ? 1 : 0;
    return [lerp(a[1], b[1], f), lerp(a[2], b[2], f), moving];
  }
  const l = tr[tr.length - 1]; return [l[1], l[2], 0];
}
function buildUnits() {
  for (const u of UNITS) {
    const { tex, canvas: cv } = symbolTexture({ ...unitSym(u), label: u.short });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sp = new THREE.Sprite(mat); sp.center.set(0.5, 0); sp.userData = { kind: "unit", u }; sp.renderOrder = 5;
    const pole = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineBasicMaterial({ color: u.side === "ax" ? 0x0f2b47 : 0x4b120b, transparent: true, opacity: 0.85 }));
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: u.side === "ax" ? 0x6ea6ef : 0xec6656, transparent: true, opacity: 0.9, depthWrite: false }));
    const grp = new THREE.Group(); grp.add(sp, pole, ring); G.units.add(grp);
    unitObjs.push({ u, grp, sp, pole, ring, canvas: cv, tex, lastLab: "" });
  }
  rebuildTrails(); trailsBuilt = true;
}
function rebuildTrails() {
  for (const o of unitObjs) {
    if (o.trail) { G.trails.remove(o.trail); o.trail.geometry.dispose(); }
    const tr = o.u.track, t0 = tr[0][0], t1 = tr[tr.length - 1][0];
    if (tr.length < 2 || t1 - t0 < 0.5) { o.trail = null; continue; }
    const pts = [];
    for (let t = t0; t <= t1 + 0.01; t += 0.25) { const [la, lo] = trackAt(tr, t); pts.push([t, la, lo]); }
    const P = [], I = [], times = [];
    const w = o.u.div ? 0.035 : o.u.ech === "XXXX" ? 0.32 : 0.22;
    for (let k = 0; k < pts.length; k++) {
      const [t, la, lo] = pts[k], x = toX(lo), z = toZ(la), y = yAt(la, lo) + (o.u.div ? 0.02 : 0.06);
      const q = pts[Math.min(k + 1, pts.length - 1)], p = pts[Math.max(k - 1, 0)];
      let dx = toX(q[2]) - toX(p[2]), dz = toZ(q[1]) - toZ(p[1]); const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      P.push(x - dz * w, y, z + dx * w, x + dz * w, y, z - dx * w); times.push(t);
      if (k > 0) { const a = (k - 1) * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: o.u.side === "ax" ? 0x3f7fd6 : 0xd8463a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.renderOrder = 3; m.userData.times = times; o.trail = m; G.trails.add(m);
  }
}
let cityView = false;
const CITYC = new THREE.Vector3();
function updateUnits(t, camPos) {
  for (const o of unitObjs) {
    const u = o.u, inTime = t >= u.t0 && t <= u.t1 + 0.999;
    const vis = inTime && (u.div === cityView);
    o.grp.visible = vis;
    if (o.trail) {
      const times = o.trail.userData.times; let n = 0; while (n < times.length && times[n] <= t) n++;
      o.trail.visible = vis && n > 1; o.trail.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
    }
    if (!vis) continue;
    let [la, lo, mv] = trackAt(u.track, t);
    la = clamp(la, LAT0 + 0.04, LAT1 - 0.04); lo = clamp(lo, LON0 + 0.05, LON1 - 0.05);
    const x = toX(lo), z = toZ(la), y = yAt(la, lo);
    const d = camPos.distanceTo(new THREE.Vector3(x, y, z));
    const sv = u.sp ? strengthAt(u, t) : null;
    const k = u.type === "air" || !sv ? 1 : clamp(Math.sqrt(sv.men / ECH_REF[u.ech]), 0.6, 1.45);
    const s = (u.div ? clamp(d * 0.03, 0.09, 1.6) : clamp(d * 0.034, 0.5, 14)) * k;
    const pole = s * 0.42 + (u.type === "air" ? s * 0.9 : 0);
    o.grp.position.set(x, y, z);
    o.sp.position.set(0, pole, 0); o.sp.scale.set(s, s * 0.906, 1);
    o.pole.scale.set(1, pole, 1);
    o.ring.scale.setScalar(s * 0.55);
    o.ring.material.opacity = 0.55 + 0.35 * mv;
    o.pos = { la, lo, x, y, z };
    const sel = selected && selected.u === u;
    o.sp.material.color.setScalar(sel ? 1.18 : 1);
    // rótulo com o efetivo do dia (redesenha só quando muda)
    const lab = sv ? u.short + " · " + (u.st.unit ? Math.round(sv.men) + " av." : fmtMen(sv.men)) : u.short;
    if (lab !== o.lastLab) { o.lastLab = lab; drawSymbol(o.canvas.getContext("2d"), { ...unitSym(u), label: lab }); o.tex.needsUpdate = true; }
  }
}

// ---------------- QGs (mudam de lugar ao longo da batalha) ----------------
const hqObjs = [];
function buildHQs() {
  for (const h of SG.HQS) {
    const stays = h.stays.map((s) => ({ ...s, a: day(s.from), b: day(s.to) + 0.999 }));
    const label = h.who.split(" ").slice(-1)[0];
    const { tex } = symbolTexture({ side: h.side, hq: true, label });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.center.set(0.5, 0); sp.renderOrder = 6;
    sp.userData = { kind: "hq", h };
    const grp = new THREE.Group(); grp.add(sp);
    const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 16), new THREE.MeshStandardMaterial({ color: h.side === "su" ? 0x8e2a20 : 0x2c5a8f, roughness: .6 })); flag.position.y = .04; flag.castShadow = true; grp.add(flag);
    G.hqs.add(grp);
    hqObjs.push({ h, stays, grp, sp, flag, cur: null });
  }
}
function placeHQ(o) { if (o.cur) o.grp.position.set(toX(o.cur.lon), yAt(o.cur.lat, o.cur.lon), toZ(o.cur.lat)); }
function updateHQs(t, camPos) {
  for (const o of hqObjs) {
    const s = o.stays.find((q) => t >= q.a && t <= q.b) || null;
    if (s !== o.cur) { o.cur = s; placeHQ(o); }
    o.grp.visible = !!s;
    if (!s) continue;
    const d = camPos.distanceTo(o.grp.position), k = clamp(d * 0.03, 0.4, 11);
    o.sp.scale.set(k, k * 0.906, 1); o.sp.position.y = k * 0.1; o.flag.scale.setScalar(k * 0.9);
  }
}

// ---------------- operações: setas sobre o terreno e frentes pintadas ----------------
const opArrows = [];
const arrowMat = { ax: new THREE.MeshBasicMaterial({ color: 0x4f8ee0, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5 }), su: new THREE.MeshBasicMaterial({ color: 0xe0574a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5 }) };
function buildOps() { EVENTS.forEach((e) => e.arrows.forEach((a) => opArrows.push({ e, a, mesh: null, n: 0 }))); rebuildOps(); }
function rebuildOps() {
  for (const o of opArrows) {
    if (o.mesh) { G.ops.remove(o.mesh); o.mesh.geometry.dispose(); }
    const pts0 = o.a.p.map(([p1, p2]) => o.a.city ? cityLL(p1, p2) : [p2, p1]); // [lat, lon]
    const curve = new THREE.CatmullRomCurve3(pts0.map(([la, lo]) => new THREE.Vector3(toX(lo), 0, toZ(la))), false, "centripetal");
    const L = curve.getLength(), N = Math.max(24, Math.round(L * (o.a.city ? 30 : 2))), w = clamp(L * 0.035, o.a.city ? 0.08 : 1.2, o.a.city ? 0.3 : 4.5) * (o.a.air ? 0.35 : 1), head = Math.min(L * 0.22, w * 3.2);
    const P = [], I = [];
    const sp = curve.getSpacedPoints(N);
    for (let k = 0; k <= N; k++) {
      const p = sp[k], q = sp[Math.min(k + 1, N)], r = sp[Math.max(k - 1, 0)], dist = (k / N) * L;
      let dx = q.x - r.x, dz = q.z - r.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const fromEnd = L - dist, ww = fromEnd < head ? w * 2.2 * (fromEnd / head) : w * (0.55 + 0.45 * k / N);
      const lo = (p.x + KMX / 2) / KX + LON0, la = LAT1 - (p.z + KMY / 2) / KY, y = yAt(la, lo) + (o.a.city ? 0.04 : 0.12) + (o.a.air ? Math.sin(Math.PI * k / N) * 7 : 0);
      P.push(p.x - dz * ww, y, p.z + dx * ww, p.x + dz * ww, y, p.z - dx * ww);
      if (k > 0) { const a = (k - 1) * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
    o.mesh = new THREE.Mesh(g, arrowMat[o.a.s] || arrowMat.ax); o.mesh.renderOrder = 7; o.mesh.visible = false; o.n = N; o.end = sp[N]; G.ops.add(o.mesh);
  }
}
function updateOps(t) {
  for (const o of opArrows) {
    const dt = t - o.e.t, on = layers.ops && dt >= 0 && dt <= o.e.dur && !!o.a.city === cityView;
    o.mesh.visible = on; if (!on) continue;
    const p = clamp(dt / Math.min(2.2, o.e.dur * 0.6), 0.03, 1);
    o.mesh.geometry.setDrawRange(0, Math.floor(o.n * p) * 6);
    o.mesh.material.opacity = 0.85 * (o.e.dur - dt < 1 ? clamp(o.e.dur - dt, 0, 1) : 1);
  }
}
const ZONES = SG.ZONES.map(([d, polys]) => ({ t: day(d), polys }));
const FRONTS = SG.CITY.FRONT.map(([d, pts]) => ({ t: day(d), pts }));
let lastOverlayKey = "";
function drawOverlay(t) {
  let zi = -1; ZONES.forEach((z, i) => { if (t >= z.t) zi = i; });
  let fi = -1; FRONTS.forEach((f, i) => { if (t >= f.t) fi = i; });
  const key = [zi, fi, layers.fronts].join(",");
  if (key === lastOverlayKey) return; lastOverlayKey = key;
  const g = overlayCtx, W = g.canvas.width, H = g.canvas.height;
  const X = (lo) => (lo - LON0) / (LON1 - LON0) * W, Y = (la) => (LAT1 - la) / (LAT1 - LAT0) * H;
  g.clearRect(0, 0, W, H);
  if (layers.fronts && zi >= 0) {
    for (const poly of ZONES[zi].polys) {
      g.beginPath(); poly.forEach(([lo, la], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.closePath();
      g.fillStyle = "rgba(79,142,224,0.20)"; g.fill();
      g.setLineDash([W / 300, W / 500]); g.lineWidth = W / 900; g.strokeStyle = "rgba(23,64,120,0.9)"; g.stroke(); g.setLineDash([]);
    }
  }
  if (layers.fronts && fi >= 0 && FRONTS[fi].pts.length) {
    const pts = FRONTS[fi].pts, west = [], bank = [];
    for (let i = 0; i < pts.length; i++) {
      const steps = i ? 6 : 1;
      for (let s = steps === 1 ? 0 : 1; s <= (steps === 1 ? 0 : steps); s++) {
        const a = pts[Math.max(0, i - 1)], b = pts[i], f = steps === 1 ? 1 : s / steps;
        const lat = lerp(a[0], b[0], f), km = lerp(a[1], b[1], f);
        const wq = cityLL(lat, km), bq = cityLL(lat, -0.05); if (bq[1] !== 44.5) { west.push(wq); bank.push(bq); }
      }
    }
    g.beginPath(); west.concat(bank.reverse()).forEach(([la, lo], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.closePath();
    g.fillStyle = "rgba(224,87,74,0.38)"; g.fill();
    g.beginPath(); west.forEach(([la, lo], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.lineWidth = W / 1600; g.strokeStyle = "rgba(150,20,12,0.95)"; g.stroke();
  }
  overlayTex.needsUpdate = true;
}

// ---------------- efeitos: incêndios, explosões, fumaça ----------------
const fx = { flashes: [], smokes: [] };
let flashPool = [], smokePool = [], fireSprites = [];
function sprite(color, blend, tex) { const m = new THREE.SpriteMaterial({ map: tex || softTex, color, transparent: true, depthWrite: false, blending: blend || THREE.AdditiveBlending }); const s = new THREE.Sprite(m); s.visible = false; G.fx.add(s); return s; }
function buildFX() {
  for (let i = 0; i < 160; i++) flashPool.push(sprite(0xffa040, null, sparkTex));
  for (let i = 0; i < 160; i++) smokePool.push(sprite(0x8a8681, THREE.NormalBlending, smokeTex));
  // incêndios: [lat, lon, de (dia), até, tamanho]
  const C = (lat, km) => cityLL(lat, km);
  const fires = [[...C(48.71, 0.8), 0, 10, 1.4], [...C(48.76, 0.9), 0, 8, 1.1], [...C(48.69, 0.7), 0, 12, 1.0], [...C(48.795, 0.8), 52, 62, 1.0], [...C(48.776, 0.6), 60, 80, 0.8], [...C(48.759, 0.6), 62, 90, 0.8],
    [48.20, 41.27, 123, 127, 0.9], [48.78, 44.25, 145, 150, 0.6], [48.78, 44.37, 150, 155, 0.6]];
  for (const f of fires) fireSprites.push({ la: f[0], lo: f[1], t0: f[2], t1: f[3], size: f[4], glow: sprite(0xff7a2a, null, sparkTex), sm: sprite(0x6f6a64, THREE.NormalBlending, smokeTex) });
}
function take(pool, list, o) { const s = pool.find((p) => !p.visible); if (!s) return; s.visible = true; o.s = s; list.push(o); }
function boom(x, z, size) {
  const lo = (x + KMX / 2) / KX + LON0, la = LAT1 - (z + KMY / 2) / KY, y = yAt(la, lo) + 0.06;
  take(flashPool, fx.flashes, { pos: new THREE.Vector3(x, y + .05, z), age: 0, life: 0.35, size: size * 1.1 });
  take(smokePool, fx.smokes, { pos: new THREE.Vector3(x, y, z), age: 0, life: 3.5 + Math.random() * 2, size: size * .55, rot: Math.random() * 6 });
}
let fxClock = 0;
function updateFX(t, dt) {
  fxClock += dt;
  if (playing && layers.fx) {
    // combate onde há setas ativas
    for (const o of opArrows) if (o.mesh.visible && Math.random() < (cityView ? 2.5 : 1.6) * dt) { const e = o.end, r = o.a.city ? 0.35 : 4; boom(e.x + (Math.random() - .5) * r, e.z + (Math.random() - .5) * r, o.a.city ? 0.18 : 2.2); }
    // luta urbana contínua ao longo da linha de frente
    if (cityView) { let fi = -1; FRONTS.forEach((f, i) => { if (t >= f.t) fi = i; }); const pts = fi >= 0 ? FRONTS[fi].pts : []; if (pts.length && Math.random() < 6 * dt) { const p = pts[(Math.random() * pts.length) | 0]; const [la, lo] = cityLL(p[0] + (Math.random() - .5) * 0.004, p[1] + (Math.random() - .3) * 0.3); boom(toX(lo), toZ(la), 0.16); } }
  }
  for (let i = fx.flashes.length - 1; i >= 0; i--) {
    const o = fx.flashes[i]; o.age += dt; const f = o.age / o.life;
    if (f >= 1) { o.s.visible = false; fx.flashes.splice(i, 1); continue; }
    o.s.position.copy(o.pos); o.s.scale.setScalar(o.size * 0.7 * (0.5 + f * 1.1)); o.s.material.opacity = (1 - f) * 0.85;
  }
  for (let i = fx.smokes.length - 1; i >= 0; i--) {
    const o = fx.smokes[i]; o.age += dt; const f = o.age / o.life;
    if (f >= 1) { o.s.visible = false; fx.smokes.splice(i, 1); continue; }
    o.s.position.set(o.pos.x + f * .6 * o.size, o.pos.y + f * 1.6 * o.size, o.pos.z); o.s.scale.setScalar(o.size * (0.5 + f * 2.2)); o.s.material.opacity = 0.55 * (1 - f) * (f < .1 ? f * 10 : 1);
    o.s.material.rotation = o.rot + f;
  }
  for (const f of fireSprites) {
    const on = layers.fx && t >= f.t0 && t <= f.t1;
    f.glow.visible = on; f.sm.visible = on;
    if (!on) continue;
    const x = toX(f.lo), z = toZ(f.la), y = yAt(f.la, f.lo);
    const fl = 0.8 + Math.sin(fxClock * 13 + f.la * 99) * 0.12 + Math.sin(fxClock * 31 + f.lo * 77) * 0.08;
    f.glow.position.set(x, y + 0.12, z); f.glow.scale.setScalar(f.size * 0.9 * fl); f.glow.material.opacity = 0.75;
    const ph = (fxClock * 0.12 + f.la * 10) % 1;
    f.sm.position.set(x + ph * 0.8 * f.size, y + 0.3 + ph * 2.2 * f.size, z); f.sm.scale.setScalar(f.size * (0.8 + ph * 3)); f.sm.material.opacity = 0.5 * (1 - ph);
  }
}

// ---------------- estação e clima (no lugar do ciclo dia/noite do Dia D) ----------------
const knots = (arr) => arr.map(([d, v]) => [day(d), v]);
const interp = (ks, t) => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) { const a = ks[i - 1], b = ks[i]; return lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0])); } return ks[ks.length - 1][1]; };
const SNOW_K = knots([["1942-11-04", 0], ["1942-11-12", 0.3], ["1942-11-18", 0.42], ["1942-11-21", 0.85], ["1942-12-01", 0.95], ["1942-12-11", 1], ["1942-12-13", 0.72], ["1942-12-17", 0.76], ["1942-12-19", 0.95], ["1942-12-22", 0.86], ["1942-12-26", 1]]);
const ICE_K = knots([["1942-11-10", 0], ["1942-11-14", 0.45], ["1942-12-10", 0.62], ["1942-12-16", 0.92], ["1942-12-18", 1]]);
const ELEV_K = knots([["1942-08-23", 46], ["1942-10-01", 34], ["1942-11-01", 25], ["1942-12-21", 18], ["1943-02-02", 24]]);
const cSum = new THREE.Color(0xfff1dc), cWin = new THREE.Color(0xe9f0ff), cSkySum = new THREE.Color(0xd4dde6), cSkyWin = new THREE.Color(0xc3d0de), cGndSum = new THREE.Color(0x6a5a44), cGndWin = new THREE.Color(0x7a7f86);
let weather = null, wxNow = null;
function buildWeather() {
  SG.wxInit(day);
  const cityPts = [];
  for (let i = 0; i < 16; i++) { const [la, lo] = cityLL(48.58 + i * 0.016, 0.5 + (i * 0.37) % 2); cityPts.push(new THREE.Vector3(toX(lo), yAt(la, lo), toZ(la))); }
  weather = SG.makeWeather({ scene, camera, heightAt: (x, z) => { const lo = (x + KMX / 2) / KX + LON0, la = LAT1 - (z + KMY / 2) / KY; return yAt(la, lo); }, cityPts });
}
function updateSeason(t, camD) {
  const s = interp(SNOW_K, t); SNOW.uSnow.value = s; SNOW.uIce.value = interp(ICE_K, t);
  wxNow = SG.wxAt(t);
  const w = layers.wx ? wxNow : { cloud: 0, fog: 0, snow: 0, wind: 0, rain: 0, haze: 0, smoke: 0 };
  const el = interp(ELEV_K, t), ov = Math.max(w.cloud * 0.8, w.snow, w.rain * 0.9), fg = Math.max(w.fog, w.haze * 0.5);
  const er = THREE.MathUtils.degToRad(el), ar = THREE.MathUtils.degToRad(215);
  sun.position.set(Math.sin(ar) * Math.cos(er) * 500, Math.sin(er) * 500, -Math.cos(ar) * Math.cos(er) * 500);
  sun.intensity = 2.5 * (1 - 0.55 * ov) * (1 - 0.3 * fg);
  sun.color.copy(cSum).lerp(cWin, s);
  hemi.color.copy(cSkySum).lerp(cSkyWin, s); hemi.groundColor.copy(cGndSum).lerp(cGndWin, s); hemi.intensity = 0.72 + 0.25 * ov;
  // neblina e nevasca fecham a visibilidade como no clima das fontes
  const k = Math.max(w.fog, w.snow * 0.4, w.haze * 0.3);
  scene.fog.color.setHex(0x0b1116).lerp(new THREE.Color(0xb9c2c6), k * 0.85);
  scene.background.copy(scene.fog.color);
  scene.fog.near = lerp(camD * 1.6 + 300, camD * 0.25, k); scene.fog.far = lerp(camD * 4 + 1300, camD * 1.6 + 30, k);
  renderer.toneMappingExposure = 1.05 - 0.08 * s;
  const e = wxNow.entry, r = wxNow.river, txt = (e ? e.label + (e.temp ? " · " + e.temp : "") : "") + (r ? (e ? " · " : "") + r.label : "");
  const wxEl = $("#wx"); if (wxEl.textContent !== txt) wxEl.textContent = txt;
}

// ---------------- tempo e reprodução ----------------
let simT = 0, playing = false, speed = 2, lastFrame = performance.now();
const SPEEDS = [0.5, 1, 2, 4];
function setTime(t) { simT = clamp(t, T0, T1); drawTrack(); updateClock(); updateEvents(); }
function updateClock() {
  const [s, y] = fmt(simT); $("#clock").textContent = s;
  const lab = y + " · Dia " + (Math.floor(simT) + 1) + " de " + (T1 + 1);
  const st = $("#date strong"); if (st.textContent !== lab) st.textContent = lab;
  const ph = PHASES.filter((p) => simT >= p[0]).pop()[1]; if ($("#phase").textContent !== ph) $("#phase").textContent = ph;
}
function togglePlay(v) {
  playing = v === undefined ? !playing : v;
  if (playing && simT >= T1 - 0.1) simT = T0;
  $("#playicon").innerHTML = playing ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4.5v15l13-7.5z"/>';
  $("#play").setAttribute("aria-label", playing ? "Pausar" : "Reproduzir");
}

// ---------------- câmera ----------------
let fly = null, follow = null;
function presetPose(p) {
  const asp = innerWidth / innerHeight, portrait = asp < 0.85;
  const tx = toX(p.lon), tz = toZ(p.lat) + (portrait ? p.dist * 0.06 : 0), pol = THREE.MathUtils.degToRad(p.pol - (portrait ? 16 : 0)), az = THREE.MathUtils.degToRad(p.az);
  const d = p.dist * (portrait ? 0.82 : asp < 1.3 ? 1.2 : 1);
  const ty = yAt(p.lat, p.lon);
  return { target: new THREE.Vector3(tx, ty, tz), pos: new THREE.Vector3(tx + d * Math.sin(pol) * Math.sin(az), ty + d * Math.cos(pol), tz + d * Math.sin(pol) * Math.cos(az)) };
}
function flyTo(key, instant) {
  const p = PRESETS[key]; if (!p) return; follow = null;
  const pose = presetPose(p);
  document.querySelectorAll("#presets .chip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === key ? "true" : "false"));
  if (instant) { controls.target.copy(pose.target); camera.position.copy(pose.pos); controls.update(); return; }
  fly = { t0: performance.now(), dur: 1500, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: pose.target, toP: pose.pos };
}
function flyToPoint(lat, lon, dist = 40) {
  const pose = presetPose({ lat, lon, dist, pol: 48, az: 0 });
  document.querySelectorAll("#presets .chip").forEach((b) => b.setAttribute("aria-pressed", "false"));
  fly = { t0: performance.now(), dur: 1300, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: pose.target, toP: pose.pos };
}
function updateFly(now) {
  if (!fly) return;
  const f = clamp((now - fly.t0) / fly.dur, 0, 1), e = f < .5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
  controls.target.lerpVectors(fly.fromT, fly.toT, e);
  const mid = fly.fromP.clone().lerp(fly.toP, e); mid.y += Math.sin(e * Math.PI) * fly.fromP.distanceTo(fly.toP) * 0.12;
  camera.position.copy(mid);
  if (f >= 1) fly = null;
}
let autoCam = true, lastAutoIdx = -2, lastUserCam = -1e9;
function currentEventIdx() { let k = -1; for (let i = 0; i < EVENTS.length; i++) if (EVENTS[i].t <= simT) k = i; return k; }
function flyToEvent(i) { const e = EVENTS[i]; if (!e || e.lat === null) return; follow = null; flyToPoint(e.lat, e.lon, e.dist); }
function updateAutoCam(now) {
  if (!autoCam) return;
  const i = currentEventIdx(); if (i === lastAutoIdx) return; lastAutoIdx = i;
  if (i >= 0 && playing && now - lastUserCam > 5000) flyToEvent(i);
}
function setAutoCam(v) { autoCam = v; const b = $("#autocam"); if (b) b.setAttribute("aria-pressed", v ? "true" : "false"); if (v) { lastAutoIdx = currentEventIdx(); flyToEvent(lastAutoIdx); } }

// ---------------- seleção ----------------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let selected = null, downAt = null;
function pick(ev) {
  const r = canvas.getBoundingClientRect(); mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const cand = [];
  if (layers.units) for (const o of unitObjs) if (o.grp.visible) cand.push(o.sp);
  if (layers.hqs) for (const o of hqObjs) if (o.grp.visible) cand.push(o.sp);
  const hit = ray.intersectObjects(cand, false)[0];
  return hit ? hit.object.userData : null;
}
canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; fly = null; lastUserCam = performance.now(); });
canvas.addEventListener("wheel", () => { lastUserCam = performance.now(); fly = null; }, { passive: true });
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const d = pick(e); if (d) select(d); else closeCard();
});
let lastHover = 0;
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
  const now = performance.now(); if (now - lastHover < 50) return; lastHover = now;
  const d = pick(e), tip = $("#tip");
  if (d) { tip.hidden = false; tip.style.left = e.clientX + "px"; tip.style.top = e.clientY + "px"; tip.textContent = d.u ? d.u.name : d.h ? "QG · " + d.h.who : ""; canvas.style.cursor = "pointer"; }
  else { tip.hidden = true; canvas.style.cursor = ""; }
});
canvas.addEventListener("pointerleave", () => { $("#tip").hidden = true; });

// ---------------- ficha ----------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function strChart(cv, u) {
  const W = cv.width = 640, H = cv.height = 150, g = cv.getContext("2d"), p = u.sp, pad = 26;
  const X = (t) => pad + t / T1 * (W - pad * 2), Y = (v) => H - 22 - v / u.maxMen * (H - 40), col = u.side === "ax" ? "#6ea6ef" : "#ec6656";
  g.clearRect(0, 0, W, H); g.strokeStyle = "rgba(196,212,224,.2)"; g.beginPath(); g.moveTo(pad, H - 22); g.lineTo(W - pad, H - 22); g.stroke();
  g.fillStyle = "rgba(151,163,171,1)"; g.font = "20px 'IBM Plex Mono', monospace";
  [["1942-09-01", "set"], ["1942-11-01", "nov"], ["1943-01-01", "jan"]].forEach(([d, n]) => g.fillText(n, X(day(d)) - 14, H - 2));
  g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q.t), Y(q.men)) : g.moveTo(X(q.t), Y(q.men))); g.lineTo(X(p[p.length - 1].t), H - 22); g.lineTo(X(p[0].t), H - 22); g.closePath(); g.fillStyle = col + "33"; g.fill();
  g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q.t), Y(q.men)) : g.moveTo(X(q.t), Y(q.men))); g.strokeStyle = col; g.lineWidth = 3; g.stroke();
  p.forEach((q) => { g.beginPath(); g.arc(X(q.t), Y(q.men), 6, 0, 7); if (q.est) { g.fillStyle = "#111a21"; g.fill(); g.strokeStyle = col; g.lineWidth = 2.5; g.stroke(); } else { g.fillStyle = col; g.fill(); } });
  const xt = X(simT); g.strokeStyle = "#f1c46d"; g.lineWidth = 2; g.beginPath(); g.moveTo(xt, 6); g.lineTo(xt, H - 22); g.stroke();
  g.fillStyle = "rgba(232,230,223,.85)"; g.fillText(fmtMen(u.maxMen), 4, 22);
}
function select(d) {
  const card = $("#card"); card.hidden = false;
  if (d.kind === "unit") {
    const u = d.u; selected = { u };
    const sv = u.sp ? strengthAt(u, simT) : null;
    const str = sv ? `<dt>Efetivo hoje</dt><dd>${u.st.unit ? Math.round(sv.men) + " " + u.st.unit : Math.round(sv.men / 100) * 100 >= 1000 ? (Math.round(sv.men / 100) * 100).toLocaleString("pt-BR") + " homens" : Math.round(sv.men / 10) * 10 + " homens"}${u.maxTk ? " · " + Math.round(sv.tk) + " tanques" : ""}${sv.est ? ' <span class="hint">(estimado)</span>' : ""}<div class="strbar"><i style="width:${(sv.men / u.maxMen * 100).toFixed(1)}%;background:${u.side === "ax" ? "#6ea6ef" : "#ec6656"}"></i></div></dd>` : "";
    card.innerHTML = `<div class="top"><canvas id="cardsym"></canvas><div style="min-width:0"><div class="eyebrow">${esc(NATN[u.nat])} · ${esc(SIZEN[u.ech] || "")}</div><h2>${esc(u.name)}</h2></div><button class="close" type="button" aria-label="Fechar">×</button></div>
    <dl><dt>Comando</dt><dd>${esc(u.cmd)}</dd><dt>Subordinado</dt><dd>${esc(u.parent || "—")}</dd>${str}<dt>Em cena</dt><dd class="mono">${fmt(u.t0).join(" ")} – ${fmt(u.t1).join(" ")}</dd><dt>Equipamento</dt><dd>${esc((u.eq || []).join("; "))}</dd><dt>Histórico</dt><dd>${esc(u.notes || "")}${u.fate ? " <b>Destino:</b> " + esc(u.fate) : ""}</dd></dl>
    ${u.sp ? `<canvas class="chart" id="cchart"></canvas><div class="hint">Efetivo ao longo da batalha. Pontos vazados = estimativa. Fontes: ${esc(u.st.src.split(",").map((k) => SG.STR_SRC[k] || k).join("; "))}.</div>` : ""}
    <div class="actions"><button class="chip" id="cfollow" type="button" aria-pressed="false">Acompanhar</button><button class="chip" id="cgo" type="button">Ir até a unidade</button></div>`;
    symbolInto($("#cardsym"), unitSym(u));
    if (u.sp) strChart($("#cchart"), u);
    $("#cfollow").onclick = (ev) => { setAutoCam(false); const o = unitObjs.find((x) => x.u === u); follow = follow === o ? null : o; ev.currentTarget.setAttribute("aria-pressed", follow ? "true" : "false"); if (follow && simT < u.t0) setTime(u.t0); };
    $("#cgo").onclick = () => { setAutoCam(false); const t = clamp(simT, u.t0, u.t1); if (t !== simT) setTime(t); const [la, lo] = trackAt(u.track, t); flyToPoint(la, lo, u.div ? 9 : 60); };
  } else if (d.kind === "hq") {
    const h = d.h; selected = null;
    card.innerHTML = `<div class="top"><canvas id="cardsym"></canvas><div style="min-width:0"><div class="eyebrow">${h.side === "ax" ? "Eixo" : "Exército Vermelho"} · Quartel-general</div><h2>${esc(h.who)}</h2></div><button class="close" type="button" aria-label="Fechar">×</button></div>
    <dl><dt>Função</dt><dd>${esc(h.role)}</dd>${h.stays.map((s) => `<dt class="mono" style="letter-spacing:0">${fmt(day(s.from))[0]}</dt><dd>${esc(s.place)} <span class="hint">até ${fmt(day(s.to))[0]}</span></dd>`).join("")}${h.note ? `<dt>Nota</dt><dd>${esc(h.note)}</dd>` : ""}</dl>`;
    symbolInto($("#cardsym"), { side: h.side, hq: true });
  }
  card.querySelector(".close").onclick = closeCard;
}
function closeCard() { $("#card").hidden = true; selected = null; follow = null; }

// ---------------- interface ----------------
const layers = { units: true, trails: true, hqs: true, ops: true, fronts: true, plan: true, fx: true, wx: true };
const LNAMES = { units: "Unidades", trails: "Trajetos", hqs: "QGs", ops: "Operações", fronts: "Frentes", plan: "Planta 1942", fx: "Combate", wx: "Clima" };
function buildUI() {
  const pr = $("#presets");
  for (const [k, p] of Object.entries(PRESETS)) { const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.dataset.k = k; b.textContent = p.name; b.setAttribute("aria-pressed", "false"); b.onclick = () => { setAutoCam(false); flyTo(k); }; pr.appendChild(b); }
  const ly = $("#layers");
  for (const k of Object.keys(layers)) {
    const l = document.createElement("label"); l.innerHTML = `<input type="checkbox" id="ly-${k}" checked> ${LNAMES[k]}`;
    l.querySelector("input").onchange = (e) => { layers[k] = e.target.checked; if (G[k]) G[k].visible = layers[k]; if (k === "fronts") lastOverlayKey = ""; if (k === "wx" && weather) weather.group.visible = layers.wx; };
    ly.appendChild(l);
  }
  const ex = $("#exag"); let exTimer = null;
  ex.oninput = () => { $("#exagv").textContent = ex.value + "×"; clearTimeout(exTimer); exTimer = setTimeout(() => { EXAG = +ex.value; applyExag(); }, 80); };
  const lg = $("#legend");
  const items = [["Infantaria alemã", { side: "ax", type: "inf", nat: "DE" }], ["Panzer", { side: "ax", type: "armor", nat: "DE" }], ["Romenos", { side: "ax", type: "inf", nat: "RO", fill: "#e8d48a" }], ["Italianos / húngaros", { side: "ax", type: "inf", nat: "IT", fill: "#a9d6ab" }], ["Fuzileiros soviéticos", { side: "su", type: "inf", nat: "SU" }], ["Tanques soviéticos", { side: "su", type: "armor", nat: "SU" }], ["Força aérea", { side: "su", type: "air" }], ["Quartel-general", { side: "ax", hq: true }]];
  for (const [name, o] of items) { const d = document.createElement("div"); const cv = document.createElement("canvas"); d.appendChild(cv); d.appendChild(document.createTextNode(name)); lg.appendChild(d); requestAnimationFrame(() => symbolInto(cv, o)); }
  const off = document.createElement("div");
  off.innerHTML = `<p class="hint" style="margin:0 0 10px">Azul tracejado: área do Eixo. Vermelho na cidade: faixa soviética junto ao Volga. Setas: operações do dia. O tamanho das placas acompanha o efetivo.</p><div class="eyebrow" style="margin-bottom:6px">Comandos fora do mapa</div>` + OFFMAP.map(([s, n, w]) => `<div style="font-size:12.5px;line-height:1.35;margin-bottom:5px"><b style="font:600 14px/1 var(--f-head);color:${s === "su" ? "var(--soviet)" : "var(--axis)"}">${esc(n)}</b><br><span style="color:var(--muted)">${esc(w)}</span></div>`).join("") + `<p class="hint" style="margin-top:10px">Relevo: Terrain Tiles (AWS/Mapzen), ajustado para 1942. Planta: Stadtplan von Stalingrad, Gen.St.d.H. 1942 — David Rumsey Map Collection (CC BY-NC-SA).</p>`;
  $("#offmap").appendChild(off);
  const tt = $("#toolstoggle"); const toolsEl = $("#tools");
  const setTools = (open) => { toolsEl.classList.toggle("collapsed", !open); tt.setAttribute("aria-expanded", open ? "true" : "false"); tt.textContent = open ? "Fechar" : "Camadas"; };
  setTools(innerWidth >= 700); tt.onclick = () => setTools(toolsEl.classList.contains("collapsed"));
  if (innerWidth >= 700) tt.style.display = "none";
  const spd = $("#speeds");
  for (const s of SPEEDS) { const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.textContent = (s === 0.5 ? "½" : s) + "×"; b.title = s + " dia(s) por segundo"; b.setAttribute("aria-pressed", s === speed ? "true" : "false"); b.onclick = () => { speed = s; spd.querySelectorAll(".chip[data-s]").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.s === s ? "true" : "false")); }; b.dataset.s = s; spd.insertBefore(b, $("#autocam")); }
  $("#togglelog").onclick = () => $("#log").classList.toggle("hiddenm");
  $("#autocam").onclick = () => setAutoCam(!autoCam);
  if (innerWidth < 700) $("#log").classList.add("hiddenm");
  $("#play").onclick = () => togglePlay();
  const ev = $("#events");
  EVENTS.forEach((e, i) => {
    const d = document.createElement("div"); d.className = "ev"; d.tabIndex = 0; d.dataset.i = i;
    d.innerHTML = `<time>${fmt(e.t)[0]}</time><b class="${e.side}">${esc(e.title)}</b><p>${esc(e.text)}</p>`;
    const go = () => { setTime(e.t + 0.01); lastAutoIdx = i; flyToEvent(i); };
    d.onclick = go; d.onkeydown = (k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); go(); } };
    ev.appendChild(d);
  });
  ev.addEventListener("scroll", () => { evScrollAt = performance.now(); }, { passive: true });
  const tr = $("#track"); let drag = false;
  const tFromX = (x) => { const r = tr.getBoundingClientRect(); return T0 + clamp((x - r.left - 10) / (r.width - 20), 0, 1) * (T1 - T0); };
  tr.addEventListener("pointerdown", (e) => { drag = true; tr.setPointerCapture(e.pointerId); setTime(tFromX(e.clientX)); });
  tr.addEventListener("pointermove", (e) => { if (drag) setTime(tFromX(e.clientX)); });
  tr.addEventListener("pointerup", () => { drag = false; if (autoCam) { lastAutoIdx = currentEventIdx(); flyToEvent(lastAutoIdx); } });
  tr.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { setTime(simT + (e.shiftKey ? 7 : 1)); e.preventDefault(); } if (e.key === "ArrowLeft") { setTime(simT - (e.shiftKey ? 7 : 1)); e.preventDefault(); } });
  addEventListener("keydown", (e) => { if (e.code === "Space" && !["INPUT", "BUTTON"].includes(document.activeElement.tagName)) { e.preventDefault(); togglePlay(); } });
  addEventListener("resize", resize);
}
let evScrollAt = 0, lastNowIdx = -2;
function updateEvents() {
  const items = document.querySelectorAll("#events .ev"); if (!items.length) return;
  let nowIdx = -1; EVENTS.forEach((e, i) => { if (e.t <= simT) nowIdx = i; });
  const recent = nowIdx >= 0 && simT - EVENTS[nowIdx].t < Math.max(3, EVENTS[nowIdx].dur) ? nowIdx : -1;
  items.forEach((el, i) => { el.classList.toggle("past", i <= nowIdx); el.classList.toggle("now", i === recent); });
  $("#evcount").textContent = `${nowIdx + 1}/${EVENTS.length}`;
  if (nowIdx !== lastNowIdx && performance.now() - evScrollAt > 2500) {
    lastNowIdx = nowIdx; const el = items[Math.max(0, nowIdx)], box = $("#events");
    box.scrollTo({ top: el.offsetTop - box.clientHeight * 0.35, behavior: "smooth" });
  }
}
function drawTrack() {
  const c = $("#track"); if (!c) return;
  const w = c.clientWidth * DPR, h = c.clientHeight * DPR; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext("2d"), pad = 10 * DPR, X = (t) => pad + (t - T0) / (T1 - T0) * (w - 2 * pad);
  g.clearRect(0, 0, w, h);
  const y0 = 18 * DPR, bh = 10 * DPR;
  // faixa das estações: fim de verão, outono, inverno
  const grd = g.createLinearGradient(X(T0), 0, X(T1), 0);
  const stop = (d, col) => grd.addColorStop(clamp((day(d) - T0) / (T1 - T0), 0, 1), col);
  stop("1942-08-23", "#8a7a4a"); stop("1942-10-10", "#7a5a3a"); stop("1942-11-15", "#5d6f80"); stop("1942-11-25", "#b9c8d4"); stop("1943-02-02", "#d4dde6");
  g.fillStyle = grd; g.globalAlpha = 0.55; g.fillRect(X(T0), y0, X(T1) - X(T0), bh); g.globalAlpha = 1;
  g.fillStyle = "rgba(217,164,65,.85)"; g.fillRect(X(T0), y0, X(simT) - X(T0), 2 * DPR);
  g.font = `500 ${10.5 * DPR}px 'IBM Plex Mono', monospace`; g.textAlign = "center"; g.textBaseline = "top";
  [["1942-09-01", "SET"], ["1942-10-01", "OUT"], ["1942-11-01", "NOV"], ["1942-12-01", "DEZ"], ["1943-01-01", "JAN 43"], ["1943-02-01", "FEV"]].forEach(([d, n]) => {
    const x = X(day(d)); g.fillStyle = "rgba(196,212,224,.35)"; g.fillRect(x, y0 + bh, DPR, 6 * DPR); g.fillStyle = "rgba(196,212,224,.75)"; g.fillText(n, x, y0 + bh + 8 * DPR);
  });
  // dias de tempestade, neblina e frio extremo
  for (const wx of SG.WX) { const a = X(wx.a), b = X(wx.b); g.fillStyle = "rgba(240,246,250,.85)"; g.fillRect(a, y0 - 6 * DPR, Math.max(2 * DPR, b - a), 3 * DPR); }
  // grandes operações
  g.fillStyle = "#b783c7"; g.textBaseline = "bottom"; g.font = `600 ${10 * DPR}px 'Barlow Condensed', sans-serif`;
  for (const [d, n] of [["1942-11-19", "URANO"], ["1942-12-12", "TEMPESTADE"], ["1942-12-16", ""], ["1943-01-10", "ANEL"]]) { const x = X(day(d)); g.fillRect(x - DPR * .5, y0 - 4 * DPR, DPR * 1.5, bh + 4 * DPR); if (n && w / DPR > 560) { g.textAlign = n === "TEMPESTADE" ? "left" : "right"; g.fillText(n, x + (n === "TEMPESTADE" ? 4 : -4) * DPR, y0 - 7 * DPR); } }
  for (const e of EVENTS) { const x = X(e.t); g.fillStyle = e.side === "ax" ? "#6ea6ef" : "#ec6656"; g.beginPath(); g.arc(x, y0 + bh / 2, 2.6 * DPR, 0, 7); g.fill(); }
  const px = X(simT); g.fillStyle = "#f1c46d"; g.fillRect(px - DPR, 4 * DPR, 2 * DPR, h - 8 * DPR);
  g.beginPath(); g.arc(px, y0 + bh / 2, 6 * DPR, 0, 7); g.fill(); g.strokeStyle = "#0b1116"; g.lineWidth = 2 * DPR; g.stroke();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); drawTrack(); }

// ---------------- quadro ----------------
let lastUI = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  if (playing) { simT += dt * speed; if (simT >= T1) { simT = T1; togglePlay(false); } }
  updateAutoCam(now);
  updateFly(now);
  if (follow && follow.pos) { const d = new THREE.Vector3(follow.pos.x, 0, follow.pos.z).sub(new THREE.Vector3(controls.target.x, 0, controls.target.z)); controls.target.add(d.multiplyScalar(0.08)); camera.position.add(d); }
  controls.update();
  const cp = camera.position, camD = cp.distanceTo(controls.target);
  CITYC.set(toX(44.53), yAt(48.73, 44.53), toZ(48.73));
  const cv = camD < 60 && controls.target.distanceTo(CITYC) < 18;
  if (cv !== cityView) { cityView = cv; lastOverlayKey = ""; }
  updateSeason(simT, camD);
  drawOverlay(simT);
  updateUnits(simT, cp); updateHQs(simT, cp); updateOps(simT);
  updateFX(simT, dt);
  if (weather) weather.update(layers.wx ? wxNow : { cloud: 0, fog: 0, snow: 0, wind: 0, rain: 0, haze: 0, smoke: 0 }, dt, camD, controls.target, layers.wx);
  if (now - lastUI > (playing ? 90 : 250)) { lastUI = now; updateClock(); drawTrack(); updateEvents(); if (selected && selected.u && selected.u.sp && $("#cchart")) strChart($("#cchart"), selected.u); }
  renderer.render(scene, camera);
}

// gancho de teste (?lite): permite pausar o laço e renderizar quadros sob demanda
if (LITE) window.__MQ = { setTime, flyTo, togglePlay, setAutoCam, layers, get camera() { return camera; }, stop() { renderer.setAnimationLoop(null); }, step(n = 1, ms = 16) { for (let i = 0; i < n; i++) frame(lastFrame + ms); } };
boot().catch((e) => { const L = $("#loading"); if (L) L.querySelector("h2").textContent = "Não foi possível carregar a maquete: " + e.message; console.error(e); });
})();
