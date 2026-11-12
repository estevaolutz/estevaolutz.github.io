(function () {
"use strict";
const $ = (s) => document.querySelector(s);
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const MOBILE = Math.min(innerWidth, innerHeight) < 700 || /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
const KX = 111.32 * Math.cos(49.3 * Math.PI / 180), KY = 111.2;
const { GW, GH, KMX, KMY, LON0, LON1, LAT0, LAT1 } = GEO;
let EXAG = 6;
let HGT = null;
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
function yAt(lat, lon) { return Math.max(hAt(lat, lon), 0) * EXAG / 1000; }
const setLoad = (p) => { const b = $("#loadbar"); if (b) b.style.width = Math.round(p * 100) + "%"; };

// ---------------- renderer, scene, camera ----------------
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
scene.fog = new THREE.Fog(0x0b1116, 160, 420);
const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 1500);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
controls.minDistance = 1.5; controls.maxDistance = 190;
controls.screenSpacePanning = false; controls.zoomSpeed = 1.1; controls.rotateSpeed = 0.6;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

const hemi = new THREE.HemisphereLight(0xcfd9e3, 0x5b4d3a, 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); scene.add(sun); scene.add(sun.target);
const moon = new THREE.DirectionalLight(0xa9bfe6, 0.0); scene.add(moon); scene.add(moon.target);
for (const L of [sun, moon]) {
  L.shadow.mapSize.set(MOBILE ? 2048 : 4096, MOBILE ? 2048 : 4096);
  const c = L.shadow.camera; c.left = -62; c.right = 62; c.top = 42; c.bottom = -42; c.near = 1; c.far = 400;
  L.shadow.bias = -0.0004; L.shadow.normalBias = 0.04;
}
sun.castShadow = true;

// ---------------- groups ----------------
const G = {};
for (const k of ["units", "trails", "forts", "fleet", "air", "craft", "hqs", "fx"]) { G[k] = new THREE.Group(); scene.add(G[k]); }

// ---------------- textures generated on canvas ----------------
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
const waterNormal = (() => {
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const g = c.getContext("2d"), img = g.createImageData(N, N), hgt = new Float32Array(N * N);
  for (let o = 0; o < 4; o++) {
    const f = 4 << o, amp = 1 / (o + 1);
    const grid = []; for (let i = 0; i < (f + 1) * (f + 1); i++) grid.push(hash(i * 7.3 + o * 101));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const gx = x / N * f, gy = y / N * f, x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
      const a = grid[y0 * (f + 1) + x0], b = grid[y0 * (f + 1) + ((x0 + 1) % f)], cc = grid[((y0 + 1) % f) * (f + 1) + x0], d = grid[((y0 + 1) % f) * (f + 1) + ((x0 + 1) % f)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      hgt[y * N + x] += amp * lerp(lerp(a, b, sx), lerp(cc, d, sx), sy);
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = hgt[y * N + (x + 1) % N] - hgt[y * N + (x - 1 + N) % N], dy = hgt[((y + 1) % N) * N + x] - hgt[((y - 1 + N) % N) * N + x];
    const nx = -dx * 3, ny = -dy * 3, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
    img.data[i] = (nx / l * .5 + .5) * 255; img.data[i + 1] = (ny / l * .5 + .5) * 255; img.data[i + 2] = (nz / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 22); return t;
})();

// ---------------- military symbols ----------------
const FILL = { A: "#a9c9ef", G: "#f1a99c" }, INK = { A: "#0f2b47", G: "#4b120b" };
function drawSymbol(g, o) {
  const A = o.side, fx = 48, fy = 58, fw = 160, fh = 100;
  g.clearRect(0, 0, 256, 232);
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(fx + 5, fy + 7, fw, fh);
  g.fillStyle = FILL[A]; g.fillRect(fx, fy, fw, fh);
  g.lineWidth = 7; g.strokeStyle = INK[A]; g.strokeRect(fx, fy, fw, fh);
  g.lineWidth = 6; g.lineCap = "round"; g.strokeStyle = INK[A]; g.fillStyle = INK[A];
  const t = o.type, X = () => { g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + fw, fy + fh); g.moveTo(fx + fw, fy); g.lineTo(fx, fy + fh); g.stroke(); };
  const capsule = (s = 1) => { const w = 92 * s, h = 46 * s, cx = fx + fw / 2, cy = fy + fh / 2; g.beginPath(); g.moveTo(cx - w / 2 + h / 2, cy - h / 2); g.lineTo(cx + w / 2 - h / 2, cy - h / 2); g.arc(cx + w / 2 - h / 2, cy, h / 2, -Math.PI / 2, Math.PI / 2); g.lineTo(cx - w / 2 + h / 2, cy + h / 2); g.arc(cx - w / 2 + h / 2, cy, h / 2, Math.PI / 2, Math.PI * 1.5); g.stroke(); };
  const wings = () => { const cx = fx + fw / 2, by = fy + fh - 12; g.beginPath(); g.arc(cx - 20, by, 20, Math.PI, 0); g.arc(cx + 20, by, 20, Math.PI, 0); g.stroke(); };
  const tag = (s) => { g.font = "700 26px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = FILL[A]; g.fillRect(fx + fw / 2 - 30, fy + fh - 34, 60, 28); g.fillStyle = INK[A]; g.fillText(s, fx + fw / 2, fy + fh - 11); };
  if (o.hq) {
    g.font = "700 46px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(o.hqText || "QG", fx + fw / 2, fy + fh / 2 + 2);
  } else if (t === "inf") X();
  else if (t === "armor" || t === "panzer") capsule();
  else if (t === "pzgr") { X(); capsule(.8); }
  else if (t === "para" || t === "fjr") { X(); wings(); }
  else if (t === "glider") { X(); wings(); tag("GL"); }
  else if (t === "cdo") { X(); tag("CDO"); }
  else if (t === "ranger") { X(); tag("RGR"); }
  else if (t === "ost") { X(); tag("OST"); }
  else if (t === "fort") { g.beginPath(); g.moveTo(fx + 30, fy + fh - 22); g.lineTo(fx + fw - 30, fy + fh - 22); g.moveTo(fx + 50, fy + fh - 22); g.lineTo(fx + 50, fy + 34); g.lineTo(fx + fw - 50, fy + 34); g.lineTo(fx + fw - 50, fy + fh - 22); g.stroke(); }
  else if (t === "ship") { g.beginPath(); g.moveTo(fx + 26, fy + 52); g.lineTo(fx + fw - 26, fy + 52); g.lineTo(fx + fw - 46, fy + 76); g.lineTo(fx + 46, fy + 76); g.closePath(); g.stroke(); g.fillRect(fx + 70, fy + 34, 22, 18); }
  else if (t === "craft") { g.beginPath(); g.moveTo(fx + 40, fy + 40); g.lineTo(fx + fw - 40, fy + 40); g.lineTo(fx + fw - 40, fy + 70); g.lineTo(fx + 40, fy + 70); g.closePath(); g.stroke(); }
  if (o.size) { g.fillStyle = INK[A]; g.font = "700 40px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillText(o.size === "I" ? "I" : o.size, fx + fw / 2, fy - 9); }
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
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter; return { tex: t, canvas: c };
}
function symbolInto(canvasEl, o) { const c = document.createElement("canvas"); c.width = 256; c.height = 232; drawSymbol(c.getContext("2d"), o); const g = canvasEl.getContext("2d"); canvasEl.width = canvasEl.clientWidth * DPR; canvasEl.height = canvasEl.clientHeight * DPR; g.drawImage(c, 0, 0, canvasEl.width, canvasEl.height); }

// ---------------- loading ----------------
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Falha ao carregar " + src)); i.src = src; }); }

async function boot() {
  setLoad(.05);
  const fontsReady = Promise.all([document.fonts.load("700 40px 'Barlow Condensed'"), document.fonts.load("600 36px 'Barlow Condensed'")]).catch(() => {});
  const TILED = !MOBILE && renderer.capabilities.maxTextureSize >= 4096;
  const mapFiles = TILED ? ["map_0_0.jpg", "map_1_0.jpg", "map_0_1.jpg", "map_1_1.jpg"] : ["map.jpg"];
  let done = 0; const tick = (p) => { done++; setLoad(.05 + .4 * done / (mapFiles.length + 1)); return p; };
  const [hImg, ...mImgs] = await Promise.all([loadImage("height.png").then(tick), ...mapFiles.map((f) => loadImage(f).then(tick))]);
  setLoad(.45);
  await fontsReady;
  const c = document.createElement("canvas"); c.width = GW; c.height = GH;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(hImg, 0, 0);
  const d = g.getImageData(0, 0, GW, GH).data; HGT = new Float32Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) HGT[i] = ((d[i * 4] << 8) | d[i * 4 + 1]) / 100 - 50;
  const mapTex = mImgs.map((img) => { const t = new THREE.Texture(img); t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; });
  setLoad(.6);
  buildTerrain(mapTex); setLoad(.7);
  buildUnits(); buildForts(); buildFleet(); buildAir(); buildCraft(); buildHQs(); buildFX(); buildEquipment(); setLoad(.9);
  buildUI();
  resize(); flyTo("geral", true);
  setTime(450);
  setLoad(1);
  const L = $("#loading"); L.style.opacity = 0; setTimeout(() => L.remove(), 700);
  renderer.setAnimationLoop(frame);
}

// ---------------- terrain, slab, water ----------------
let terrainGeo, tiles = [], walls = [], water;
const paperDetail = (() => {
  const N = 512, c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d");
  g.fillStyle = "#808080"; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 9000; i++) { const x = hash(i) * N, y = hash(i + 1.7) * N, l = 4 + hash(i + 3.1) * 22, a = hash(i + 5.3) * Math.PI; const v = hash(i + 7.9) > .5 ? 255 : 0;
    g.strokeStyle = `rgba(${v},${v},${v},${0.035 + hash(i + 9.2) * 0.05})`; g.lineWidth = .7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    for (const ox of [-N, N]) { g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
})();
function paperMaterial(tex, repeat) {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.paperMap = { value: paperDetail }; sh.uniforms.paperRep = { value: repeat };
    sh.fragmentShader = "uniform sampler2D paperMap; uniform float paperRep;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n float pd = texture2D(paperMap, vUv * paperRep).r; diffuseColor.rgb *= 0.9 + 0.2 * pd;");
  };
  m.customProgramCacheKey = () => "paper";
  return m;
}
function buildTerrain(mapTex) {
  terrainGeo = new THREE.PlaneGeometry(KMX, KMY, GW - 1, GH - 1); terrainGeo.rotateX(-Math.PI / 2);
  const tiled = mapTex.length === 4, cs = [0, (GW - 1) / 2, GW - 1], rs = [0, (GH - 1) / 2, GH - 1];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const c0 = cs[c], c1 = cs[c + 1], r0 = rs[r], r1 = rs[r + 1], nc = c1 - c0 + 1, nr = r1 - r0 + 1;
    const geo = new THREE.BufferGeometry();
    const P = new Float32Array(nc * nr * 3), N = new Float32Array(nc * nr * 3), UV = new Float32Array(nc * nr * 2), I = [];
    for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
      const k = j * nc + i, cc = c0 + i, rr = r0 + j;
      UV[k * 2] = tiled ? i / (nc - 1) : cc / (GW - 1); UV[k * 2 + 1] = tiled ? 1 - j / (nr - 1) : 1 - rr / (GH - 1);
      if (i < nc - 1 && j < nr - 1) { const a0 = k, b0 = k + 1, c_ = k + nc, d0 = k + nc + 1; I.push(a0, c_, b0, b0, c_, d0); }
    }
    geo.setAttribute("position", new THREE.BufferAttribute(P, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(N, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(UV, 2)); geo.setIndex(I);
    const mesh = new THREE.Mesh(geo, paperMaterial(tiled ? mapTex[r * 2 + c] : mapTex[0], tiled ? 150 : 300));
    mesh.receiveShadow = true; mesh.castShadow = true; scene.add(mesh); tiles.push({ mesh, c0, r0, nc, nr });
  }
  // water
  const wm = new THREE.MeshStandardMaterial({ color: 0x2f5a78, transparent: true, opacity: 0.34, roughness: 0.22, metalness: 0.15, normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), depthWrite: false });
  water = new THREE.Mesh(new THREE.PlaneGeometry(KMX, KMY), wm); water.rotateX(-Math.PI / 2); water.position.y = 0.004; water.renderOrder = 2; scene.add(water);
  // table
  const tableTex = canvasTex(512, 512, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "#2b3238"); gr.addColorStop(0.5, "#1b2126"); gr.addColorStop(1, "#0b1116"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${hash(i) * .025})`; g.fillRect(hash(i + 1) * w, hash(i + 2) * h, 1, 1); }
  });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.9 }));
  table.rotateX(-Math.PI / 2); table.position.y = -1.05; table.receiveShadow = true; scene.add(table);
  // frame with graduations
  buildFrame();
  applyExag();
}
const BASE = -0.95;
const strataTex = canvasTex(64, 256, (g, w, h) => {
  const bands = [["#c9bd99", 10], ["#b7a47d", 18], ["#d3c7a5", 26], ["#8f7a5b", 34], ["#b3a07a", 24], ["#6e5c45", 40], ["#9e8a69", 30], ["#5a4a39", 74]];
  let y = 0; for (const [c, hh] of bands) { g.fillStyle = c; g.fillRect(0, y, w, hh); y += hh; }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${hash(i) * .12})`; g.fillRect(hash(i + 4) * w, hash(i + 7) * h, 2, 1); }
});
strataTex.wrapS = THREE.RepeatWrapping;
function buildWalls() {
  for (const w of walls) { scene.remove(w); w.geometry.dispose(); }
  walls = [];
  const sides = [
    { n: GW, idx: (k) => k, }, // north row
    { n: GW, idx: (k) => (GH - 1) * GW + (GW - 1 - k) }, // south row (reversed)
    { n: GH, idx: (k) => (GH - 1 - k) * GW }, // west col
    { n: GH, idx: (k) => k * GW + GW - 1 }, // east col
  ];
  const pos = terrainGeo.attributes.position;
  const mat = new THREE.MeshStandardMaterial({ map: strataTex, roughness: 0.95, vertexColors: true });
  for (const s of sides) {
    const P = [], U = [], C = [], I = [];
    let acc = 0, px = null, pz = null;
    for (let k = 0; k < s.n; k++) {
      const i = s.idx(k), x = pos.getX(i), z = pos.getZ(i), yt = Math.max(pos.getY(i), 0.004);
      if (px !== null) acc += Math.hypot(x - px, z - pz); px = x; pz = z;
      const sea = HGT[i] < 0;
      P.push(x, yt, z, x, BASE, z);
      U.push(acc / 6, 0, acc / 6, 1);
      const c = sea ? [0.55, 0.72, 0.85] : [1, 1, 1];
      C.push(...c, ...(sea ? [0.32, 0.42, 0.5] : [0.8, 0.8, 0.8]));
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
  const W = 1.1, top = 0.12, H = top - (BASE - 0.05);
  const mkSide = (len, isLat, flip) => canvasTex(4096, 64, (g, w, h) => {
    g.fillStyle = "#e9e1cc"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1b1712"; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    const a0 = isLat ? LAT0 : LON0, a1 = isLat ? LAT1 : LON1, mins = Math.round((a1 - a0) * 60);
    g.font = "600 26px 'IBM Plex Mono', monospace"; g.textBaseline = "middle"; g.textAlign = "center";
    for (let m = 0; m <= mins; m++) {
      let x = m / mins * w; if (flip) x = w - x;
      const big = m % 5 === 0;
      g.fillRect(x - 1, 3, 2, big ? 26 : 12); g.fillRect(x - 1, h - (big ? 26 : 12) - 3, 2, big ? 26 : 12);
      if (big && m % 10 === 0 && m > 0 && m < mins) {
        const v = a0 + m / 60, deg = Math.floor(Math.abs(v)), mn = Math.round((Math.abs(v) - deg) * 60);
        const s = `${deg}°${String(mn).padStart(2, "0")}′${isLat ? "N" : (v < 0 ? "W" : "E")}`;
        g.fillStyle = "#e9e1cc"; g.fillRect(x - 70, h / 2 - 14, 140, 28); g.fillStyle = "#1b1712"; g.fillText(s, x, h / 2 + 1);
      }
    }
  });
  const mk = (len, rotY, x, z, tex) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(len, H, W), [wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), wood, wood, wood]);
    box.position.set(x, BASE - 0.05 + H / 2, z); box.rotation.y = rotY; box.castShadow = true; box.receiveShadow = true; scene.add(box);
  };
  mk(KMX + 2 * W, 0, 0, -KMY / 2 - W / 2, mkSide(KMX, false, false));
  mk(KMX + 2 * W, Math.PI, 0, KMY / 2 + W / 2, mkSide(KMX, false, true));
  mk(KMY, Math.PI / 2, -KMX / 2 - W / 2, 0, mkSide(KMY, true, false));
  mk(KMY, -Math.PI / 2, KMX / 2 + W / 2, 0, mkSide(KMY, true, true));
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(KMX + 2 * W + 0.4, 0.12, KMY + 2 * W + 0.4), wood);
  plinth.position.y = BASE - 0.07; plinth.receiveShadow = true; plinth.castShadow = true; scene.add(plinth);
}
function applyExag() {
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < GW * GH; i++) pos.setY(i, HGT[i] * EXAG / 1000);
  pos.needsUpdate = true; terrainGeo.computeVertexNormals(); terrainGeo.computeBoundingSphere(); terrainGeo.computeBoundingBox();
  const fp = pos.array, fn = terrainGeo.attributes.normal.array;
  for (const tl of tiles) {
    const P = tl.mesh.geometry.attributes.position.array, N = tl.mesh.geometry.attributes.normal.array;
    for (let j = 0; j < tl.nr; j++) for (let i = 0; i < tl.nc; i++) { const k = (j * tl.nc + i) * 3, g = ((tl.r0 + j) * GW + tl.c0 + i) * 3; P[k] = fp[g]; P[k + 1] = fp[g + 1]; P[k + 2] = fp[g + 2]; N[k] = fn[g]; N[k + 1] = fn[g + 1]; N[k + 2] = fn[g + 2]; }
    tl.mesh.geometry.attributes.position.needsUpdate = true; tl.mesh.geometry.attributes.normal.needsUpdate = true; tl.mesh.geometry.computeBoundingSphere();
  }
  buildWalls();
  if (trailsBuilt) rebuildTrails();
  for (const f of forts) placeFort(f);
  for (const h of hqObjs) placeHQ(h);
}

// ---------------- units ----------------
const unitObjs = []; let trailsBuilt = false;
const ringGeo = new THREE.RingGeometry(0.16, 0.24, 28); ringGeo.rotateX(-Math.PI / 2);
function trackAt(tr, t) {
  if (t <= tr[0][0]) return [tr[0][1], tr[0][2], 0];
  for (let i = 1; i < tr.length; i++) if (t <= tr[i][0]) {
    const a = tr[i - 1], b = tr[i], f = (t - a[0]) / (b[0] - a[0]);
    const moving = Math.hypot(b[1] - a[1], b[2] - a[2]) > 0.0004 ? 1 : 0;
    return [lerp(a[1], b[1], f), lerp(a[2], b[2], f), moving];
  }
  const l = tr[tr.length - 1]; return [l[1], l[2], 0];
}
function buildUnits() {
  for (const u of UNITS) {
    const { tex, canvas: cv } = symbolTexture({ side: u.side, type: u.type, size: u.size, label: u.short, nat: u.nat });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sp = new THREE.Sprite(mat); sp.center.set(0.5, 0); sp.userData = { kind: "unit", u }; sp.renderOrder = 5;
    const pole = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineBasicMaterial({ color: u.side === "A" ? 0x0f2b47 : 0x4b120b, transparent: true, opacity: 0.85 }));
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: u.side === "A" ? 0x6ea6ef : 0xec6656, transparent: true, opacity: 0.9, depthWrite: false }));
    const grp = new THREE.Group(); grp.add(sp, pole, ring); G.units.add(grp);
    unitObjs.push({ u, grp, sp, pole, ring, canvas: cv, start: u.track[0][0] });
  }
  rebuildTrails(); trailsBuilt = true;
}
function rebuildTrails() {
  for (const o of unitObjs) {
    if (o.trail) { G.trails.remove(o.trail); o.trail.geometry.dispose(); }
    const tr = o.u.track, t0 = tr[0][0], t1 = tr[tr.length - 1][0];
    const pts = [];
    for (let t = t0; t <= t1 + 0.01; t += 4) { const [la, lo] = trackAt(tr, t); pts.push([t, la, lo]); }
    const P = [], I = [], times = [];
    const w = 0.07;
    for (let k = 0; k < pts.length; k++) {
      const [t, la, lo] = pts[k], x = toX(lo), z = toZ(la), y = yAt(la, lo) + 0.035;
      const q = pts[Math.min(k + 1, pts.length - 1)], p = pts[Math.max(k - 1, 0)];
      let dx = toX(q[2]) - toX(p[2]), dz = toZ(q[1]) - toZ(p[1]); const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      P.push(x - dz * w, y, z + dx * w, x + dz * w, y, z - dx * w); times.push(t);
      if (k > 0) { const a = (k - 1) * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: o.u.side === "A" ? 0x3f7fd6 : 0xd8463a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.renderOrder = 3; m.userData.times = times; o.trail = m; G.trails.add(m);
  }
}
function updateUnits(t, camPos) {
  for (const o of unitObjs) {
    const vis = t >= o.start;
    o.grp.visible = vis;
    if (o.trail) {
      const times = o.trail.userData.times; let n = 0; while (n < times.length && times[n] <= t) n++;
      o.trail.visible = vis && n > 1; o.trail.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
    }
    if (!vis) continue;
    const [la, lo, mv] = trackAt(o.u.track, t);
    const x = toX(lo), z = toZ(la), y = yAt(la, lo);
    const d = camPos.distanceTo(new THREE.Vector3(x, y, z));
    const s = clamp(d * 0.034, 0.16, 4.2);
    const pole = s * 0.42;
    o.grp.position.set(x, y, z);
    o.sp.position.set(0, pole, 0); o.sp.scale.set(s, s * 0.906, 1);
    o.pole.scale.set(1, pole, 1);
    o.ring.scale.setScalar(s * 0.55);
    o.ring.material.opacity = 0.55 + 0.35 * mv;
    o.pos = { la, lo, x, y, z };
    const sel = selected && selected.u === o.u;
    o.sp.material.color.setScalar(sel ? 1.18 : 1);
  }
}

// ---------------- fortifications ----------------
const forts = [];
const concrete = new THREE.MeshStandardMaterial({ color: 0xa8a294, roughness: 0.85 });
const concreteDead = new THREE.MeshStandardMaterial({ color: 0x5b5852, roughness: 0.9 });
const fortRingLive = new THREE.MeshBasicMaterial({ color: 0xe8513f, transparent: true, opacity: 0.95, depthWrite: false });
const fortRingDead = new THREE.MeshBasicMaterial({ color: 0x8e8a83, transparent: true, opacity: 0.7, depthWrite: false });
const fortRingGeo = new THREE.RingGeometry(0.2, 0.26, 4, 1); fortRingGeo.rotateX(-Math.PI / 2); fortRingGeo.rotateY(Math.PI / 4);
function buildForts() {
  for (const [id, name, la, lo, type, arm, men, fall] of FORTS) {
    const grp = new THREE.Group(); const parts = [];
    const n = type === "bat" ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(type === "bat" ? 0.16 : 0.2, 0.07, type === "bat" ? 0.14 : 0.16), concrete);
      b.position.set((i - (n - 1) / 2) * 0.24, 0.035, 0); b.castShadow = true; b.receiveShadow = true; grp.add(b); parts.push(b);
      if (type === "bat") { const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0x3a3a36, roughness: .6 })); barrel.rotation.x = Math.PI / 2; barrel.position.set((i - (n - 1) / 2) * 0.24, 0.045, -0.12); grp.add(barrel); }
    }
    const ring = new THREE.Mesh(fortRingGeo, fortRingLive); ring.position.y = 0.01; ring.scale.setScalar(type === "bat" ? 2.4 : 1.2); grp.add(ring);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(type === "bat" ? 1.1 : 0.6, 0.35, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData = { kind: "fort", f: { id, name, la, lo, type, arm, men, fall } }; grp.add(hit);
    grp.scale.setScalar(1.25);
    const f = { id, name, la, lo, type, arm, men, fall, grp, parts, ring, hit, dead: false };
    G.forts.add(grp); forts.push(f); placeFort(f);
  }
}
function placeFort(f) {
  f.grp.position.set(toX(f.lo), yAt(f.la, f.lo), toZ(f.la));
  // face the sea: north
  f.grp.rotation.y = 0;
}
function updateForts(t) {
  for (const f of forts) {
    const dead = f.fall !== null && t >= f.fall;
    if (dead !== f.dead) { f.dead = dead; for (const p of f.parts) p.material = dead ? concreteDead : concrete; f.ring.material = dead ? fortRingDead : fortRingLive; }
  }
}

// ---------------- fleet ----------------
const SHIPDIM = { ms: [0.43, 0.06], bb: [1.08, 0.18], ca: [1.1, 0.13], cl: [1.0, 0.12], dd: [0.68, 0.07], mon: [0.78, 0.17], tr: [0.87, 0.12], lst: [0.62, 0.09], hq: [0.9, 0.12], tb: [0.53, 0.05] };
// ===== Equipment models: built in metres (bow / nose along +x), merged into one vertex-coloured mesh per type =====
const equipMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.12 });
const SHIP_S = 0.0062, CRAFT_S = 0.0095, VEH_S = 0.006;
const HULLC = 0x5f6c78, HULLN = 0x3c4b5c, DECKC = 0x5d5d56, SUPERC = 0x9da5ab, BOOTC = 0x1c1e20, GUNC = 0x43484c, OLIVEV = 0x4d5532, TANV = 0xa8915a, KHAKIV = 0x9a9170, KGREYC = 0x4a5055, RUBBER = 0x1e1e1e;
function hullPiece(L, B, F, bow = 0.28, hex = HULLC, y0 = -1.2) {
  const s = new THREE.Shape();
  s.moveTo(-L / 2, -B * 0.4); s.quadraticCurveTo(-L / 2 - B * 0.06, 0, -L / 2, B * 0.4);
  s.lineTo(L * (0.5 - bow), B / 2); s.quadraticCurveTo(L * 0.45, B * 0.34, L / 2, 0);
  s.quadraticCurveTo(L * 0.45, -B * 0.34, L * (0.5 - bow), -B / 2); s.lineTo(-L / 2, -B * 0.4);
  const g = new THREE.ExtrudeGeometry(s, { depth: F - y0, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return colored(g, hex);
}
function deckPiece(L, B, F, bow = 0.28) { const g = hullPiece(L * 0.985, B * 0.95, F + 0.15, bow, DECKC, F); return g; }
function turret(parts, x, y, size, barrels, dir, hex = SUPERC) {
  parts.push(P_(new THREE.CylinderGeometry(size * 0.55, size * 0.6, size * 0.35, 12), hex, x, y + size * 0.17, 0));
  parts.push(slab(size * 1.2, size * 0.45, size * 0.95, x, y + size * 0.45, 0, hex));
  for (let i = 0; i < barrels; i++) { const z = (i - (barrels - 1) / 2) * size * 0.28; parts.push(P_(new THREE.CylinderGeometry(size * 0.07, size * 0.08, size * 1.7, 6), GUNC, x + dir * size * 1.35, y + size * 0.5, z, -Math.PI / 2)); }
}
const wheel = (r, w, x, y, z, hex) => { const g = new THREE.CylinderGeometry(r, r, w, 10); g.rotateX(Math.PI / 2); g.translate(x, y, z); return colored(g, hex); };
const funnel = (parts, x, y, r, h, hex = 0x8b9297) => { parts.push(P_(new THREE.CylinderGeometry(r * 0.92, r, h, 12), hex, x, y + h / 2, 0)); parts.push(P_(new THREE.CylinderGeometry(r * 0.94, r * 0.94, h * 0.12, 12), BOOTC, x, y + h * 0.95, 0)); };
const mast = (parts, x, y, h, yard = 0) => { parts.push(P_(new THREE.CylinderGeometry(0.35, 0.5, h, 6), GUNC, x, y + h / 2, 0)); if (yard) parts.push(slab(0.4, 0.3, yard, x, y + h * 0.8, 0, GUNC)); };
const tower = (parts, x, y, l, h, b) => { let yy = y, ll = l, bb = b; for (let i = 0; i < 3; i++) { const hh = h / 3; parts.push(slab(ll, hh, bb, x, yy + hh / 2, 0, SUPERC)); yy += hh; ll *= 0.72; bb *= 0.8; } return yy; };
function finish(parts, scale) { const g = THREE.BufferGeometryUtils.mergeBufferGeometries(parts); g.scale(scale, scale, scale); g.computeVertexNormals(); return g; }
function buildShipModel(type) {
  const p = [];
  if (type === "bb") {
    const L = 175, B = 29, F = 9; p.push(hullPiece(L, B, F, 0.3, HULLN), deckPiece(L, B, F, 0.3), slab(L * 0.9, 0.8, B * 1.01, -4, -0.6, 0, BOOTC));
    turret(p, 58, F, 9, 3, 1); turret(p, 44, F + 3, 9, 2, 1); turret(p, -46, F + 3, 9, 2, -1); turret(p, -60, F, 9, 3, -1);
    const top = tower(p, 22, F, 22, 14, 18); mast(p, 22, top, 16, 10); funnel(p, 2, F + 4, 4.2, 12); mast(p, -24, F, 18, 8);
    for (const z of [-11.5, 11.5]) for (const x of [-14, -4, 6]) p.push(slab(4, 2.2, 2.4, x, F + 1.1, z, SUPERC));
  } else if (type === "ca" || type === "cl") {
    const L = type === "ca" ? 180 : 165, B = type === "ca" ? 20 : 19, F = 8; p.push(hullPiece(L, B, F, 0.3), deckPiece(L, B, F, 0.3), slab(L * 0.9, 0.8, B * 1.01, -4, -0.6, 0, BOOTC));
    turret(p, 52, F, 7, 3, 1); turret(p, 40, F + 2.5, 7, 3, 1); turret(p, -46, F + 2.5, 7, 3, -1); if (type === "cl") turret(p, -58, F, 7, 3, -1);
    const top = tower(p, 24, F, 18, 12, 12); mast(p, 22, top, 14, 9); funnel(p, 6, F + 2, 3.2, 11); funnel(p, -8, F + 2, 3.2, 11); mast(p, -24, F, 15, 7);
    p.push(slab(36, 3, 10, -1, F + 1.5, 0, SUPERC));
  } else if (type === "dd" || type === "ms" || type === "tb") {
    const L = type === "ms" ? 70 : type === "tb" ? 85 : 110, B = type === "ms" ? 10 : type === "tb" ? 8.6 : 11, F = type === "ms" ? 5 : 4.6;
    const hc = type === "tb" ? KGREYC : HULLC;
    p.push(hullPiece(L, B, F, 0.32, hc), deckPiece(L, B, F, 0.32), slab(L * 0.9, 0.6, B * 1.01, -2, -0.5, 0, BOOTC));
    turret(p, L * 0.36, F, 3.6, 1, 1, type === "tb" ? 0x6a7076 : SUPERC); turret(p, L * 0.27, F + 1.2, 3.6, 1, 1, type === "tb" ? 0x6a7076 : SUPERC);
    if (type !== "ms") { turret(p, -L * 0.33, F, 3.6, 1, -1); turret(p, -L * 0.42, F, 3.6, 1, -1); p.push(slab(8, 1.6, 2.4, -L * 0.1, F + 0.8, 0, GUNC)); }
    else p.push(slab(10, 1.2, 4, -L * 0.36, F + 0.6, 0, GUNC));
    const top = tower(p, L * 0.18, F, 12, 7, 7); mast(p, L * 0.16, top, 9, 5);
    funnel(p, L * 0.02, F + 0.5, 2.2, 7.5, type === "tb" ? 0x5b6166 : 0x8b9297); if (type === "dd") funnel(p, -L * 0.1, F + 0.5, 2.2, 7.5);
  } else if (type === "mon") {
    const L = 125, B = 27, F = 6; p.push(hullPiece(L, B, F, 0.25, HULLN), deckPiece(L, B, F, 0.25), slab(L * 0.9, 0.8, B * 1.01, -3, -0.6, 0, BOOTC));
    turret(p, 30, F, 11, 2, 1); const top = tower(p, 8, F, 16, 22, 12); mast(p, 6, top, 10, 6); funnel(p, -10, F + 2, 3.6, 10);
  } else if (type === "tr" || type === "hq") {
    const L = 140, B = 19, F = 10; p.push(hullPiece(L, B, F, 0.25, 0x6c7378), deckPiece(L, B, F, 0.25), slab(L * 0.92, 0.8, B * 1.01, -3, -0.6, 0, BOOTC));
    p.push(slab(42, 9, 15, -6, F + 4.5, 0, SUPERC), slab(26, 4, 12, -2, F + 11, 0, SUPERC)); funnel(p, -10, F + 13, 3.6, 9);
    if (type === "hq") { mast(p, 34, F, 26, 14); mast(p, -2, F + 15, 18, 12); mast(p, -40, F, 22, 12); }
    else { mast(p, 42, F, 16, 8); mast(p, 24, F, 14, 6); mast(p, -38, F, 15, 8); for (const z of [-8.8, 8.8]) for (const x of [-22, -12, 0, 10]) p.push(slab(10, 2.2, 3, x, F + 2.2, z, OLIVEV)); }
  } else if (type === "lst") {
    const L = 100, B = 15, F = 7; p.push(hullPiece(L, B, F, 0.12, 0x6c7378), deckPiece(L, B, F, 0.12), slab(L * 0.92, 0.6, B * 1.01, -2, -0.5, 0, BOOTC));
    p.push(slab(18, 8, 13, -38, F + 4, 0, SUPERC)); mast(p, -36, F + 8, 10, 6); funnel(p, -44, F + 3, 1.6, 8);
    for (const x of [30, 20, 10, 0, -10, -20]) for (const z of [-3.2, 3.2]) p.push(slab(6, 2.4, 2.6, x, F + 1.2, z, OLIVEV));
  } else if (type === "lct") {
    const L = 36, B = 10; p.push(slab(L, 1.2, B, 0, -0.4, 0, 0x6c7378)); for (const z of [-B / 2, B / 2]) p.push(slab(L, 2.6, 0.5, 0, 1, z, 0x6c7378));
    p.push(slab(0.5, 2.4, B, L / 2, 0.9, 0, 0x55606a), slab(5, 4, B * 0.8, -L / 2 + 3, 2, 0, SUPERC));
    for (const x of [10, 3, -4]) for (const z of [-2.2, 2.2]) p.push(slab(5.8, 2.4, 2.6, x, 1.4, z, OLIVEV));
  } else if (type === "lcvp") {
    const L = 11, B = 3.3; p.push(slab(L, 0.5, B, 0, -0.2, 0, 0x5c6670)); for (const z of [-B / 2, B / 2]) p.push(slab(L, 1.6, 0.25, 0, 0.6, z, 0x5c6670));
    p.push(slab(0.3, 1.6, B, L / 2, 0.6, 0, 0x4d5862), slab(0.25, 1.5, B, -L / 2, 0.6, 0, 0x5c6670), slab(1.4, 1.0, 1.2, -L / 2 + 1.4, 1.5, 0, 0x4d5862));
    for (let i = 0; i < 6; i++) p.push(slab(1.2, 0.8, 2.4, 3.5 - i * 1.4, 0.7, 0, OLIVEV));
  } else if (type === "xcraft") {
    p.push(fuse(0.95, 12, 0, 0x2f3438), nose(0.95, 6, 0x2f3438), cone(0.95, 0.3, 3, -7.5, 0x2f3438), slab(2.2, 1.4, 1.1, 1, 1.0, 0, 0x2f3438), P_(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), GUNC, 1, 3.5, 0));
  }
  const sc = type === "lcvp" ? CRAFT_S : type === "lct" ? 0.0064 : type === "xcraft" ? 0.012 : SHIP_S;
  return finish(p, sc);
}
const shipModelCache = {};
function shipModel(type) { return shipModelCache[type] || (shipModelCache[type] = buildShipModel(type)); }
function makeShip(type) { const grp = new THREE.Group(); const m = new THREE.Mesh(shipModel(type), equipMat); m.castShadow = true; m.receiveShadow = true; grp.add(m); return grp; }
function buildVehicleModel(type) {
  const p = [];
  const tracks = (L, W, H, col = RUBBER) => { for (const z of [-W / 2, W / 2]) p.push(slab(L, H, W * 0.22, 0, H / 2, z * 0.86, col)); };
  if (type === "sherman" || type === "firefly" || type === "flail" || type === "dd") {
    const C = OLIVEV; tracks(5.9, 2.6, 1.0);
    p.push(slab(4.8, 1.0, 2.5, -0.3, 1.45, 0, C), P_(new THREE.BoxGeometry(1.6, 1.0, 2.5), C, 2.3, 1.35, 0, -0.5));
    p.push(P_(new THREE.CylinderGeometry(1.05, 1.15, 0.95, 12), C, -0.4, 2.4, 0), P_(new THREE.CylinderGeometry(0.1, 0.12, type === "firefly" ? 4.2 : 2.8, 6), GUNC, type === "firefly" ? 2.2 : 1.5, 2.45, 0, -Math.PI / 2));
    if (type === "flail") { for (const z of [-1.3, 1.3]) p.push(slab(3.2, 0.3, 0.3, 4.1, 1.5, z, C)); p.push(wheel(0.45, 3.4, 5.7, 1.0, 0, 0x2e2e2a)); }
    if (type === "dd") { for (const z of [-1.55, 1.55]) p.push(slab(6.2, 2.4, 0.15, 0, 2.6, z, KHAKIV)); for (const x of [-3.1, 3.1]) p.push(slab(0.15, 2.4, 3.1, x, 2.6, 0, KHAKIV)); }
  } else if (type === "pz4") {
    const C = TANV; tracks(5.9, 2.9, 1.0, 0x2a2a26);
    p.push(slab(5.6, 1.1, 2.6, 0, 1.5, 0, C), slab(2.6, 1.0, 2.2, -0.4, 2.55, 0, C), P_(new THREE.CylinderGeometry(0.09, 0.1, 4.8, 6), GUNC, 2.4, 2.6, 0, -Math.PI / 2));
    for (const z of [-1.55, 1.55]) p.push(slab(5.0, 1.0, 0.08, 0, 1.4, z, 0x8f7b4c));
    for (const z of [-1.3, 1.3]) p.push(slab(3.0, 0.9, 0.08, -0.4, 2.55, z, 0x8f7b4c));
    p.push(slab(1.6, 0.06, 1.3, 1.2, 2.06, 0.5, 0x5d6a3f), slab(1.4, 0.06, 1.1, -1.8, 2.06, -0.6, 0x5d6a3f));
  } else if (type === "ht") {
    const C = TANV; p.push(slab(3.4, 0.9, 2.0, -1.2, 0.45, 0, 0x2a2a26));
    for (const z of [-0.95, 0.95]) p.push(wheel(0.45, 0.3, 2.1, 0.45, z, RUBBER));
    p.push(slab(4.4, 1.2, 2.1, -0.6, 1.4, 0, C), P_(new THREE.BoxGeometry(1.8, 0.9, 1.7), C, 2.0, 1.2, 0, -0.35));
  } else if (type === "truck" || type === "opel") {
    const C = type === "truck" ? OLIVEV : 0x5f6448;
    for (const x of [2.2, -0.8, -2.2]) for (const z of [-0.95, 0.95]) p.push(wheel(0.5, 0.35, x, 0.5, z, RUBBER));
    p.push(slab(1.8, 1.4, 2.2, 1.9, 1.5, 0, C), slab(4.0, 1.6, 2.3, -1.2, 1.7, 0, type === "truck" ? 0x6b6e4c : 0x6a6650));
  }
  return finish(p, VEH_S);
}
const vehModelCache = {};
function vehModel(type) { return vehModelCache[type] || (vehModelCache[type] = buildVehicleModel(type)); }
const ships = [];
const EDGE_Z = -KMY / 2 + 0.5;
const wakeGeo = (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(-0.5, 0, 0); return g; })();
const wakeMat = new THREE.MeshBasicMaterial({ map: softTex, color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
let buoys, sweepers = [];
function buildFleet() {
  const forceOrder = { U: 0, O: 0, G: 0, J: 0, S: 0 };
  const forceBase = { U: -118, O: -114, G: -106, J: -100, S: -96 };
  for (const s of SHIPS) {
    const [name, type, force, la, lo, tla, tlo, f0, f1, sunk] = s;
    const grp = makeShip(type); G.fleet.add(grp);
    const ang = Math.atan2(toZ(tla) - toZ(la), toX(tlo) - toX(lo));
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.5), new THREE.MeshBasicMaterial({ visible: false })); hit.userData = { kind: "ship", s: { name, type, force } }; grp.add(hit);
    const wake = new THREE.Mesh(wakeGeo, wakeMat); wake.renderOrder = 2; G.fleet.add(wake);
    const k = forceOrder[force]++;
    const entry = forceBase[force] + k * 11 + hash(la * 31) * 6;
    const arrive = Math.max(entry + 120, f0 - 25 - hash(la * 100) * 30);
    ships.push({ name, type, force, la, lo, tla, tlo, f0, f1, sunk, grp, wake, entry, arrive, broadside: -(ang + Math.PI / 2) });
  }
  // transports, in convoy columns down each lane
  const per = 22;
  const hullI = new THREE.InstancedMesh(shipModel("tr"), equipMat, TAREAS.length * per), supI = new THREE.InstancedMesh(shipModel("lst"), equipMat, TAREAS.length * per);
  const wakeI2 = new THREE.InstancedMesh(wakeGeo, wakeMat, TAREAS.length * per);
  hullI.castShadow = true; supI.castShadow = true;
  hullI.frustumCulled = supI.frustumCulled = wakeI2.frustumCulled = false; G.fleet.add(hullI, supI, wakeI2); transports = { hullI, supI, wakeI2, list: [] };
  TAREAS.forEach(([beach, la, lo, arr], bi) => {
    const laneX = toX(lo);
    for (let k = 0; k < per; k++) {
      const r = hash(bi * 50 + k), r2 = hash(bi * 50 + k + 17);
      const ox = ((k % 6) - 2.5) * 1.1 + (r - .5) * .6, oz = (Math.floor(k / 6) - 1.5) * 0.9 + (r2 - .5) * .5;
      const col = k % 2, row = Math.floor(k / 2);
      const entry = -112 + bi * 9 + row * 13 + col * 4;
      transports.list.push({ lst: k % 3 === 2, x: laneX + ox, z: toZ(la) + oz, laneX: laneX + (col - .5) * 0.5, entry, arr: Math.max(entry + 110, arr + r * 30), rot: Math.PI / 2 + (r2 - .5) * .25 });
    }
  });
  // swept channels: lit dan buoys and minesweepers leading each lane
  const bp = [];
  TAREAS.forEach(([beach, la, lo], bi) => {
    const seg = LANDINGS[beach], bx = toX((seg[0][1] + seg[1][1]) / 2), bz = toZ((seg[0][0] + seg[1][0]) / 2) - 4.5;
    const ax = toX(lo), az = EDGE_Z, L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 1.6);
    const dx = (bx - ax) / L, dz = (bz - az) / L;
    for (let i = 0; i <= n; i++) for (const sd of [-1, 1]) bp.push(ax + dx * i * 1.6 - dz * sd * 0.9, 0.05, az + dz * i * 1.6 + dx * sd * 0.9);
    for (let m = 0; m < 3; m++) {
      const g = makeShip("ms"); G.fleet.add(g);
      const wake = new THREE.Mesh(wakeGeo, wakeMat); G.fleet.add(wake);
      sweepers.push({ grp: g, wake, ax: ax + (m - 1) * 0.5, az, bx: bx + (m - 1) * 0.6, bz: bz + 1.5 + m * 0.4, t0: -120 + bi * 4 + m * 3, t1: 25 + bi * 6, heading: Math.atan2(dz, dx) });
    }
  });
  const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
  buoys = new THREE.Points(bg, new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, map: softTex, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  buoys.frustumCulled = false; G.fleet.add(buoys);
}
let transports;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const easeOut = (f) => 1 - Math.pow(1 - f, 2.2);
function setWake(w, x, z, heading, speedK, len) {
  w.visible = speedK > 0.02; if (!w.visible) return;
  w.position.set(x, 0.007, z); w.rotation.set(0, -heading, 0); w.scale.set(len * (0.6 + speedK), 1, len * 0.22);
}
function updateFleet(t) {
  for (const s of ships) {
    const fx = toX(s.lo), fz = toZ(s.la);
    if (t < s.entry) { s.grp.visible = false; s.wake.visible = false; continue; }
    s.grp.visible = true;
    const f = clamp((t - s.entry) / (s.arrive - s.entry), 0, 1), e = easeOut(f);
    const z = lerp(EDGE_Z, fz, e), x = fx;
    const sailing = f < 1, speedK = sailing ? (1 - f) * 1.2 : 0;
    let y = 0.0, tilt = 0;
    const turn = smooth(0.85, 1, f);
    const head = lerp(Math.PI / 2, -s.broadside, turn);
    if (s.sunk && t > s.sunk) { const k = clamp((t - s.sunk) / 12, 0, 1); y = -0.15 * k; tilt = 0.5 * k; if (k >= 1) s.grp.visible = false; }
    s.grp.position.set(x, y, z); s.grp.rotation.set(0, -head, tilt);
    setWake(s.wake, x, z, head, s.grp.visible ? speedK : 0, SHIPDIM[s.type][0] * 1.4);
    s.firing = t >= s.f0 && t <= Math.min(s.f1, s.sunk || 1e9) && f >= 1;
  }
  const { hullI, supI, wakeI2, list } = transports; let n = 0, nl = 0, nw = 0;
  for (const tr of list) {
    if (t < tr.entry) continue;
    const f = clamp((t - tr.entry) / (tr.arr - tr.entry), 0, 1), e = easeOut(f), fan = smooth(0.75, 1, f);
    const x = lerp(tr.laneX, tr.x, fan), z = lerp(EDGE_Z, tr.z, e);
    const head = lerp(Math.PI / 2, tr.rot, fan);
    _v.set(x, 0.0, z); _q.setFromEuler(_e.set(0, -head, 0)); _s.set(1, 1, 1);
    _m.compose(_v, _q, _s); if (tr.lst) supI.setMatrixAt(nl++, _m); else hullI.setMatrixAt(n++, _m);
    if (f < 1) { _v.set(x, 0.007, z); _s.set(1.0 * (0.6 + (1 - f)), 1, 0.16); _m.compose(_v, _q, _s); wakeI2.setMatrixAt(nw++, _m); }
  }
  hullI.count = n; supI.count = nl; wakeI2.count = nw; hullI.instanceMatrix.needsUpdate = supI.instanceMatrix.needsUpdate = wakeI2.instanceMatrix.needsUpdate = true;
  for (const m of sweepers) {
    const vis = t >= m.t0 && t < 420; m.grp.visible = vis; if (!vis) { m.wake.visible = false; continue; }
    const f = clamp((t - m.t0) / (m.t1 - m.t0), 0, 1);
    const x = lerp(m.ax, m.bx, f), z = lerp(m.az, m.bz, f);
    m.grp.position.set(x, 0, z); m.grp.rotation.set(0, -m.heading, 0);
    setWake(m.wake, x, z, m.heading, f < 1 ? 1 : 0, 0.7);
  }
  buoys.visible = t > -110 && t < 600;
  buoys.material.opacity = (0.35 + 0.6 * nightK) * (0.75 + 0.25 * Math.sin(performance.now() * 0.004));
}

// ---------------- landing craft ----------------
let craft = [], craftI, lctI, wakeI;
function buildCraft() {
  craftI = new THREE.InstancedMesh(shipModel("lcvp"), equipMat, 1600); craftI.castShadow = true;
  lctI = new THREE.InstancedMesh(shipModel("lct"), equipMat, 300); lctI.castShadow = true; lctI.frustumCulled = false; G.craft.add(lctI);
  const wg = new THREE.PlaneGeometry(0.42, 0.09); wg.rotateX(-Math.PI / 2); wg.translate(-0.25, 0, 0);
  wakeI = new THREE.InstancedMesh(wg, new THREE.MeshBasicMaterial({ map: softTex, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), 1600);
  craftI.frustumCulled = wakeI.frustumCulled = false; G.craft.add(craftI, wakeI);
  for (const [beach, la, lo, , H] of TAREAS) {
    const seg = LANDINGS[beach], waves = beach === "Omaha" ? 11 : 10;
    for (let w = 0; w < waves; w++) {
      const per = beach === "Omaha" ? 30 : 26;
      for (let k = 0; k < per; k++) {
        const r1 = hash(w * 131 + k * 7 + H), r2 = hash(w * 17 + k * 3 + H * 2), r3 = hash(k * 91 + w + H * 3);
        const sp = (k + r1 * .8) / per, tla = lerp(seg[0][0], seg[1][0], sp), tlo = lerp(seg[0][1], seg[1][1], sp);
        const arrive = H - 4 + w * 13 + r2 * 6, travel = 95 + r3 * 20;
        const ox_ = toX(lo) + (r1 - .5) * 3, oz_ = toZ(la) + (r2 - .5) * 2, ex_ = toX(tlo), ez_ = toZ(tla), dl_ = Math.hypot(ex_ - ox_, ez_ - oz_), stop_ = w < 2 && k % 3 === 0 ? 0.16 : 0.05;
        craft.push({ lct: w < 2 && k % 3 === 0, ox: ox_, oz: oz_, tx: ex_ - (ex_ - ox_) / dl_ * stop_, tz: ez_ - (ez_ - oz_) / dl_ * stop_, arrive, depart: arrive - travel, dwell: beach === "Omaha" && w < 4 ? 120 : 22 });
      }
    }
  }
}
function updateCraft(t) {
  let n = 0, nl = 0;
  for (const c of craft) {
    if (t < c.depart || t > c.arrive + c.dwell + 8) continue;
    const f = clamp((t - c.depart) / (c.arrive - c.depart), 0, 1);
    const x = lerp(c.ox, c.tx, f), z = lerp(c.oz, c.tz, f);
    const fade = t > c.arrive + c.dwell ? 1 - (t - c.arrive - c.dwell) / 8 : 1;
    const ang = Math.atan2(c.tz - c.oz, c.tx - c.ox);
    _q.setFromEuler(_e.set(0, -ang, 0)); _v.set(x, 0.004, z); _s.setScalar(fade);
    _m.compose(_v, _q, _s); if (c.lct) lctI.setMatrixAt(nl++, _m); else craftI.setMatrixAt(n, _m);
    _s.set(f < 1 ? 1.4 : 0.001, 1, f < 1 ? 1.2 : 0.001); _v.y = 0.008; _m.compose(_v, _q, _s); wakeI.setMatrixAt(n, _m);
    n++; if (n >= 1600) break;
  }
  craftI.count = wakeI.count = n; lctI.count = nl; craftI.instanceMatrix.needsUpdate = wakeI.instanceMatrix.needsUpdate = lctI.instanceMatrix.needsUpdate = true;
}

// ---------------- ground vehicles, DD tanks, beach obstacles, X-craft, torpedo boats ----------------
const vehI = {}; let vehUnits = [], ddList = [], obstacles = [], xcraft = [], tboats = [], torpWakes;
const VEH_TYPES = ["sherman", "firefly", "flail", "dd", "pz4", "ht", "truck", "opel"];
function buildEquipment() {
  for (const k of VEH_TYPES) { const im = new THREE.InstancedMesh(vehModel(k), equipMat, k === "dd" ? 200 : 400); im.castShadow = true; im.frustumCulled = false; im.count = 0; G.units.add(im); vehI[k] = im; }
  for (const o of unitObjs) {
    const u = o.u; let fleet = null;
    if (u.type === "armor" && u.side === "A") fleet = u.nat === "US" ? ["sherman", "sherman", "sherman", "sherman", "sherman", "sherman"] : ["sherman", "firefly", "sherman", "flail", "sherman", "sherman"];
    else if (u.type === "panzer") fleet = u.size === "XX" ? Array(9).fill("pz4") : Array(7).fill("pz4");
    else if (u.type === "pzgr") fleet = ["ht", "ht", "pz4", "ht", "ht", "pz4"];
    else if (u.type === "inf" && u.side === "A" && (u.size === "III" || u.size === "X")) fleet = ["truck", "truck", "truck"];
    else if (u.id === "kgm") fleet = ["opel", "opel", "opel", "opel"];
    if (!fleet) continue;
    const delay = fleet[0] === "truck" ? 120 : 15;
    vehUnits.push({ o, fleet, delay, offs: fleet.map((_, i) => [-(0.07 + Math.floor(i / 2) * 0.09), (i % 2 ? 1 : -1) * (0.05 + hash(i + u.id.length) * 0.03)]) });
  }
  // DD tanks swimming in: [beach, count, launch distance km, launch min, land min, share that sinks]
  for (const [beach, n, dist, t0, t1, sinkShare] of [["Utah", 28, 3.0, 375, 410, 0.15], ["Omaha", 29, 5.4, 340, 392, 0.93], ["Sword", 34, 4.5, 400, 448, 0.1], ["Juno", 18, 3.2, 438, 470, 0.15]]) {
    const seg = LANDINGS[beach], ta = TAREAS.find((x) => x[0] === beach);
    const half = beach === "Omaha" ? [0.55, 1] : [0, 1];
    for (let i = 0; i < n; i++) {
      const sp = lerp(half[0], half[1], (i + .5) / n), la = lerp(seg[0][0], seg[1][0], sp), lo = lerp(seg[0][1], seg[1][1], sp);
      const tx = toX(lo), tz = toZ(la); let dx = toX(ta[2]) - tx, dz = toZ(ta[1]) - tz; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      const sinks = hash(i * 13 + n) < sinkShare;
      ddList.push({ sx: tx + dx * dist, sz: tz + dz * dist, tx, tz, t0: t0 + hash(i) * 6, t1: t1 + hash(i + 3) * 8, sinkAt: sinks ? 0.15 + hash(i + 7) * 0.45 : 2, h: Math.atan2(-dz, -dx) });
    }
  }
  // beach obstacles: hedgehogs and mined stakes in rows below the high-water mark
  const hg = (() => { const p = []; for (const [rx, rz] of [[0.6, 0], [-0.6, 0.9], [0, -0.9]]) { const b = slab(2.4, 0.22, 0.22, 0, 0.8, 0, 0x3a3631); b.rotateZ(rx); b.rotateY(rz); p.push(b); } return finish(p, VEH_S); })();
  const st = (() => { const p = [P_(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 6), 0x5a4a36, 0, 1.2, 0, 0.55)]; p.push(P_(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 8), 0x2c2c2a, 0.85, 2.5, 0)); return finish(p, VEH_S); })();
  const hgI = new THREE.InstancedMesh(hg, equipMat, 2600), stI = new THREE.InstancedMesh(st, equipMat, 2600);
  hgI.frustumCulled = stI.frustumCulled = false; G.forts.add(hgI, stI);
  let nh = 0, ns = 0;
  for (const [beach, seg] of Object.entries(LANDINGS)) {
    const ta = TAREAS.find((x) => x[0] === beach), x0 = toX(seg[0][1]), z0 = toZ(seg[0][0]), x1 = toX(seg[1][1]), z1 = toZ(seg[1][0]);
    let nx = toX(ta[2]) - (x0 + x1) / 2, nz = toZ(ta[1]) - (z0 + z1) / 2; const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    const L = Math.hypot(x1 - x0, z1 - z0), count = Math.floor(L / 0.045);
    for (let row = 0; row < 3; row++) for (let i = 0; i < count; i++) {
      const f = (i + hash(i * 3 + row) * .5) / count, off = 0.10 + row * 0.07 + hash(i + row * 99) * 0.02;
      const x = lerp(x0, x1, f) + nx * off, z = lerp(z0, z1, f) + nz * off;
      _q.setFromEuler(_e.set(0, hash(i + row) * 3, 0)); _v.set(x, -0.002 - row * 0.002, z); _s.setScalar(1); _m.compose(_v, _q, _s);
      if (row === 1 && nh < 2600) hgI.setMatrixAt(nh++, _m); else if (ns < 2600) { _q.setFromEuler(_e.set(0, Math.atan2(-nz, nx), 0)); _m.compose(_v, _q, _s); stI.setMatrixAt(ns++, _m); }
    }
  }
  hgI.count = nh; stI.count = ns; obstacles = [hgI, stI];
  // midget submarines marking the flanks of Juno and Sword
  for (const [name, la, lo] of [["X20", 49.352, -0.468], ["X23", 49.318, -0.322]]) {
    const g = makeShip("xcraft"); const light = sprite(0x6dff8a); light.visible = false; G.fleet.add(g); xcraft.push({ name, la, lo, g, light });
  }
  // German torpedo boats from Le Havre (Möwe, Jaguar, T28)
  for (let i = 0; i < 3; i++) { const g = makeShip("tb"); G.fleet.add(g); const wake = new THREE.Mesh(wakeGeo, wakeMat); G.fleet.add(wake); tboats.push({ g, wake, i }); }
  const tw = new THREE.BufferGeometry(); tw.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(12 * 6), 3));
  torpWakes = new THREE.LineSegments(tw, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); torpWakes.frustumCulled = false; G.fleet.add(torpWakes);
}
function tideLevel(t) { return 0.5 - 0.5 * Math.cos(2 * Math.PI * (t - 325) / 745); } // 0 = low water 05:25, 1 = high water ~11:30
const _hd = [0, 0];
function unitHeading(tr, t) { const [a1, b1] = trackAt(tr, t - 6), [a2, b2] = trackAt(tr, t + 6); const dx = toX(b2) - toX(b1), dz = toZ(a2) - toZ(a1); return Math.hypot(dx, dz) > 0.002 ? Math.atan2(dz, dx) : null; }
function updateEquipment(t) {
  const cnt = {}; for (const k of VEH_TYPES) cnt[k] = 0;
  for (const vu of vehUnits) {
    const o = vu.o; if (!o.grp.visible || !o.pos || t < o.start + vu.delay) continue;
    let h = unitHeading(o.u.track, t); if (h === null) h = vu.lastH ?? (o.u.side === "A" ? Math.PI / 2 : -Math.PI / 2); vu.lastH = h;
    const ch = Math.cos(h), shh = Math.sin(h);
    vu.fleet.forEach((k, i) => {
      if (cnt[k] >= 400) return; const [back, side] = vu.offs[i];
      const x = o.pos.x + ch * back - shh * side, z = o.pos.z + shh * back + ch * side;
      _q.setFromEuler(_e.set(0, -h, 0)); _v.set(x, groundY(x, z), z); _s.setScalar(1); _m.compose(_v, _q, _s); vehI[k].setMatrixAt(cnt[k]++, _m);
    });
  }
  for (const d of ddList) {
    if (t < d.t0 || t > d.t1 + 18) continue;
    const f = clamp((t - d.t0) / (d.t1 - d.t0), 0, 1);
    let y = -0.012; if (f > d.sinkAt) { const k = clamp((f - d.sinkAt) * 6, 0, 1); y -= k * 0.04; if (k >= 1) continue; }
    const x = lerp(d.sx, d.tx, Math.min(f, d.sinkAt)), z = lerp(d.sz, d.tz, Math.min(f, d.sinkAt));
    if (f >= 1) y = groundY(x, z);
    _q.setFromEuler(_e.set(0, -d.h, 0)); _v.set(x, y, z); _s.setScalar(1); _m.compose(_v, _q, _s); vehI.dd.setMatrixAt(cnt.dd++, _m);
  }
  for (const k of VEH_TYPES) { vehI[k].count = cnt[k]; vehI[k].instanceMatrix.needsUpdate = true; }
  const tide = tideLevel(t); for (const ob of obstacles) ob.position.y = -tide * 0.016;
  for (const xc of xcraft) {
    const up = t >= 300 && t <= 470; xc.g.visible = up; xc.light.visible = up && layers.fx;
    if (!up) continue; const x = toX(xc.lo), z = toZ(xc.la); xc.g.position.set(x, -0.004, z); xc.g.rotation.y = Math.PI / 2;
    xc.light.position.set(x, 0.09, z); xc.light.scale.setScalar(0.35 + 0.15 * Math.sin(performance.now() * 0.006)); xc.light.material.opacity = 0.4 + 0.6 * nightK;
  }
  const tp = torpWakes.geometry.attributes.position.array; let nt = 0;
  const ex = toX(0.0) + 1, ez = toZ(49.44), px = toX(-0.165), pz = toZ(49.405);
  for (const b of tboats) {
    const vis = t >= 290 && t <= 375; b.g.visible = vis; if (!vis) { b.wake.visible = false; continue; }
    const f = t < 325 ? (t - 290) / 35 : 1 - (t - 325) / 50, ff = clamp(f, 0, 1);
    const x = lerp(ex, px, ff) + b.i * 0.5, z = lerp(ez, pz, ff) + b.i * 0.35, head = t < 325 ? Math.atan2(pz - ez, px - ex) : Math.atan2(ez - pz, ex - px);
    b.g.position.set(x, 0, z); b.g.rotation.set(0, -head, 0); setWake(b.wake, x, z, head, 1, 0.6);
    if (t >= 322 && t <= 334) for (let k = 0; k < 3; k++) {
      const tg = [toX(-0.180), toZ(49.390)], ft = clamp((t - 322) / 8, 0, 1), ox = x, oz = z;
      const ang = Math.atan2(tg[1] - oz, tg[0] - ox) + (k - 1) * 0.08, len = Math.hypot(tg[0] - ox, tg[1] - oz) * ft;
      tp.set([ox, 0.006, oz, ox + Math.cos(ang) * len, 0.006, oz + Math.sin(ang) * len], nt * 6); nt++;
    }
  }
  torpWakes.geometry.setDrawRange(0, nt * 2); torpWakes.geometry.attributes.position.needsUpdate = true;
}

// ---------------- aircraft & paratroopers ----------------
// Low-poly models built in metres (nose along +x), scaled ~4.5x real size so they read on the maquette.
const AIR_SCALE = 0.0095;
const OLIVE = 0x575e3d, OLIVE2 = 0x4b5236, RAFGRN = 0x3b4230, BLACK = 0x161616, WHITE = 0xe9e6dc, METAL = 0x8d9296;
function colored(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo; g.clearGroups(); const n = g.attributes.position.count, c = new THREE.Color(hex), arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3)); if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2)); return g;
}
function P_(geo, hex, x = 0, y = 0, z = 0, rz = 0, ry = 0) { if (rz) geo.rotateZ(rz); if (ry) geo.rotateY(ry); geo.translate(x, y, z); return colored(geo, hex); }
const fuse = (r, len, x, hex, y = 0) => P_(new THREE.CylinderGeometry(r, r, len, 12, 1), hex, x, y, 0, -Math.PI / 2);
const cone = (r0, r1, len, x, hex, y = 0) => P_(new THREE.CylinderGeometry(r1, r0, len, 12, 1), hex, x, y, 0, -Math.PI / 2);
const nose = (r, x, hex, y = 0) => P_(new THREE.SphereGeometry(r, 12, 8), hex, x, y, 0);
const slab = (cx, cy, cz, x, y, z, hex) => P_(new THREE.BoxGeometry(cx, cy, cz), hex, x, y, z);
const nacelle = (r, len, x, y, z, hex) => P_(new THREE.CylinderGeometry(r * 0.8, r, len, 10, 1), hex, x, y, z, -Math.PI / 2);
function stripes(parts, chord, thick, x, y, zc, w = 0.55) { [WHITE, BLACK, WHITE, BLACK, WHITE].forEach((c, i) => { for (const s of [-1, 1]) parts.push(slab(chord * 1.02, thick * 1.2, w, x, y, s * (zc + i * w), c)); }); }
function fuseStripes(parts, r, x, y = 0) { [WHITE, BLACK, WHITE, BLACK, WHITE].forEach((c, i) => parts.push(fuse(r * 1.04, 0.5, x - i * 0.5, c, y))); }
function buildModel(key) {
  const p = [];
  if (key === "c47") {
    p.push(fuse(1.25, 12, 0.5, OLIVE), nose(1.25, 6.5, OLIVE), cone(1.25, 0.35, 6, -8.5, OLIVE));
    p.push(slab(3.8, 0.45, 29, 1.6, -0.75, 0, OLIVE2)); stripes(p, 3.8, 0.45, 1.6, -0.75, 7.5);
    for (const z of [-5.6, 5.6]) p.push(nacelle(0.78, 4.4, 3.4, -0.45, z, OLIVE));
    p.push(slab(2.2, 0.25, 10.5, -10.6, 0.25, 0, OLIVE2), slab(3.0, 3.3, 0.28, -10.8, 1.9, 0, OLIVE2));
    fuseStripes(p, 1.25, -3.4);
  } else if (key === "waco") {
    p.push(slab(10, 2.0, 1.7, 0.5, 0, 0, OLIVE), slab(2.6, 1.6, 1.6, 6.5, -0.1, 0, OLIVE), cone(0.8, 0.25, 4, -6.4, OLIVE, 0.3));
    p.push(slab(2.6, 0.3, 25.5, 1.6, 1.15, 0, OLIVE2)); stripes(p, 2.6, 0.3, 1.6, 1.15, 6.5, 0.5);
    p.push(slab(1.8, 0.2, 7, -8.2, 0.5, 0, OLIVE2), slab(2.2, 2.4, 0.22, -8.4, 1.5, 0, OLIVE2));
  } else if (key === "horsa") {
    p.push(fuse(1.3, 13, 0.5, RAFGRN), nose(1.3, 7, RAFGRN), cone(1.3, 0.35, 5, -8.5, RAFGRN));
    p.push(slab(3.4, 0.35, 26.8, 1.8, 1.15, 0, RAFGRN)); stripes(p, 3.4, 0.35, 1.8, 1.15, 7.0);
    p.push(slab(2.2, 0.22, 9, -10.4, 0.6, 0, RAFGRN), slab(2.8, 3.4, 0.24, -10.6, 2.0, 0, RAFGRN));
    fuseStripes(p, 1.3, -3);
  } else if (key === "b24") {
    p.push(fuse(1.5, 14, 0.5, OLIVE), nose(1.5, 7.5, OLIVE), cone(1.5, 0.5, 4.5, -8.7, OLIVE));
    p.push(slab(3.0, 0.45, 33.5, 1.2, 1.1, 0, OLIVE2));
    for (const z of [-9.2, -4.4, 4.4, 9.2]) p.push(nacelle(0.78, 3.8, 3.0, 0.75, z, OLIVE));
    p.push(slab(2.4, 0.25, 8.2, -10.3, 0.7, 0, OLIVE2)); for (const z of [-4.1, 4.1]) p.push(slab(2.4, 3.6, 0.25, -10.4, 1.9, z, OLIVE2));
  } else if (key === "b26") {
    p.push(fuse(1.35, 11, 0.5, OLIVE), nose(1.35, 6, OLIVE), cone(1.35, 0.35, 5, -7.5, OLIVE));
    p.push(slab(3.4, 0.45, 21.6, 1.2, 0, 0, OLIVE2)); stripes(p, 3.4, 0.45, 1.2, 0, 5.2, 0.5);
    for (const z of [-4.1, 4.1]) p.push(nacelle(0.95, 5.0, 2.6, 0.1, z, OLIVE));
    p.push(slab(2.4, 0.25, 9.5, -9.3, 0.7, 0, OLIVE2), slab(3.2, 4.0, 0.28, -9.6, 2.3, 0, OLIVE2));
    fuseStripes(p, 1.35, -3);
  } else if (key === "lanc") {
    p.push(fuse(1.45, 14, 0.2, RAFGRN), nose(1.45, 7.2, RAFGRN), cone(1.45, 0.45, 5, -9.3, RAFGRN));
    p.push(slab(3.6, 0.5, 31, 1.3, 0.2, 0, RAFGRN));
    for (const z of [-9.4, -4.6, 4.6, 9.4]) p.push(nacelle(0.8, 4.2, 3.0, 0.1, z, BLACK));
    p.push(slab(2.4, 0.25, 10, -11.2, 0.6, 0, RAFGRN)); for (const z of [-5, 5]) p.push(slab(2.4, 3.4, 0.25, -11.3, 1.8, z, RAFGRN));
  }
  const g = THREE.BufferGeometryUtils.mergeBufferGeometries(p); g.scale(AIR_SCALE, AIR_SCALE, AIR_SCALE); g.computeVertexNormals(); return g;
}
const MODELS = ["c47", "waco", "horsa", "b24", "b26", "lanc"];
const airMesh = {}, groundMesh = {};
let airMat, planes = [], planeLights, gliderGround = [], paraPts, paraList = [], towLines;
function buildAir() {
  const mat = airMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1, emissive: 0x1a1a1a });
  for (const k of MODELS) {
    const geo = buildModel(k);
    const im = new THREE.InstancedMesh(geo, mat, 1400); im.castShadow = true; im.frustumCulled = false; im.count = 0; G.air.add(im); airMesh[k] = im;
    if (k === "waco" || k === "horsa") { const gm = new THREE.InstancedMesh(geo, mat, 700); gm.castShadow = true; gm.frustumCulled = false; gm.count = 0; G.air.add(gm); groundMesh[k] = gm; }
  }
  const lp = new THREE.BufferGeometry(); lp.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(4000 * 3), 3));
  planeLights = new THREE.Points(lp, new THREE.PointsMaterial({ size: 3.5, sizeAttenuation: false, map: softTex, color: 0xffd38a, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
  planeLights.frustumCulled = false; G.air.add(planeLights);
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(800 * 6), 3));
  towLines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0x1c1c1c, transparent: true, opacity: 0.7 })); towLines.frustumCulled = false; G.air.add(towLines);
  const pp = new THREE.BufferGeometry(); pp.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6000 * 3), 3));
  paraPts = new THREE.Points(pp, new THREE.PointsMaterial({ size: 3.5, sizeAttenuation: false, map: softTex, color: 0xf4f0e6, transparent: true, depthWrite: false })); paraPts.frustumCulled = false; G.air.add(paraPts);
  FLIGHTS.forEach(([name, tz, kind, n, ent, dz, ext], fi) => {
    const speed = kind === "bomber" ? 0.75 : kind === "glider" ? 0.5 : 0.55; // km per sim-minute, slowed well below real speed so streams read on the maquette
    const A = [toX(ent[1]), toZ(ent[0])], B = [toX(dz[1]), toZ(dz[0])], C = [toX(ext[1]), toZ(ext[0])];
    const dAB = Math.hypot(B[0] - A[0], B[1] - A[1]), dBC = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const shown = Math.min(n, kind === "glider" ? 120 : 90);
    const spread = kind === "bomber" ? 0.12 : 0.22;
    const scatter = name.includes("505") ? 1.1 : name.includes("Coup") ? 0.05 : kind === "glider" ? 0.9 : 2.6;
    const model = kind === "c47" ? "c47" : kind === "glider" ? (name.includes("Missão") ? "waco" : "horsa") : name.includes("B-24") ? "b24" : name.includes("B-26") ? "b26" : "lanc";
    const tug = kind === "glider" ? (model === "waco" ? "c47" : "lanc") : null;
    for (let k = 0; k < shown; k++) {
      const off = k * spread * (n / shown) * 0.55;
      const lat = ((k % 3) - 1) * 0.3 + (hash(fi * 300 + k) - .5) * 0.2 + (kind === "bomber" ? ((Math.floor(k / 3) % 6) - 2.5) * 0.5 : 0);
      const pl = { kind, model, tug, A, B, C, dAB, dBC, speed, tOver: tz + off, lat, alt: kind === "bomber" ? 3.0 + hash(k) * .3 : 1.3 + hash(k) * .15, fi, k };
      planes.push(pl);
      if (kind === "glider") {
        const gx = B[0] + (hash(fi * 77 + k) - .5) * scatter * 2, gz = B[1] + (hash(fi * 91 + k) - .5) * scatter * 1.4;
        pl.land = [gx, gz]; gliderGround.push({ model, x: gx, z: gz, t: tz + off + 0.8, rot: hash(k + fi) * 6.28 });
      }
      if (kind === "c47" && k % 2 === 0) {
        for (let j = 0; j < 3; j++) {
          const r = hash(fi * 1000 + k * 10 + j), r2 = hash(fi * 2000 + k * 10 + j);
          paraList.push({ x: B[0] + (r - .5) * scatter * 2 + (k / shown - .5) * 1.2, z: B[1] + (r2 - .5) * scatter * 1.6, t0: tz + off, dur: 1.4 + r * 0.6 });
        }
      }
    }
  });
}
const EXIT_T = 7; // sim-minutes a plane stays visible after passing its DZ or target
function planePos(p, t, out) {
  const tStart = p.tOver - p.dAB / p.speed;
  let d = (t - tStart) * p.speed;
  out.towed = false; out.tugOnly = false; out.sc = 1;
  const gl = p.kind === "glider";
  if (d < 0) return false;
  if (!gl && d > p.dAB) {
    // after the drop or bomb run the plane turns for home quickly and fades out instead of loitering over the map
    const e = t - p.tOver; if (e > EXIT_T) return false;
    d = p.dAB + Math.min(e * p.speed * 3, p.dBC);
    if (e > EXIT_T - 3) out.sc = (EXIT_T - e) / 3;
  }
  if (gl && d > p.dAB + 6) return false;
  let x, z, dx, dz;
  const dd = Math.min(d, gl ? p.dAB : 1e9);
  if (dd <= p.dAB) { const f = dd / p.dAB; x = lerp(p.A[0], p.B[0], f); z = lerp(p.A[1], p.B[1], f); dx = p.B[0] - p.A[0]; dz = p.B[1] - p.A[1]; }
  else { const f = (dd - p.dAB) / p.dBC; x = lerp(p.B[0], p.C[0], f); z = lerp(p.B[1], p.C[1], f); dx = p.C[0] - p.B[0]; dz = p.C[1] - p.B[1]; }
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  x += -dz * p.lat; z += dx * p.lat;
  let y = p.alt, pitch = 0;
  if (gl) {
    const rem = p.dAB - d, land = p.land;
    // tug position: ahead of the glider on the rope until release 4 km out, then it flies on and leaves
    const tugAhead = 0.5 + (rem < 4 ? (4 - rem) * 1.3 : 0);
    out.tx = x + dx * tugAhead; out.tz = z + dz * tugAhead; out.ty = p.alt + (rem < 4 ? (4 - rem) * 0.05 : 0.02);
    out.towed = rem >= 4; out.tugVisible = tugAhead < 6;
    if (d > p.dAB) out.tugOnly = true;
    if (rem < 4) { const f = clamp(1 - rem / 4, 0, 1); x = lerp(x, land[0], f * f); z = lerp(z, land[1], f * f); y = lerp(p.alt, 0.05, f); pitch = -0.12 * (1 - f); }
  }
  out.x = x; out.y = y; out.z = z; out.h = Math.atan2(dz, dx); out.pitch = pitch; return true;
}
const _pp = {}, _c = new THREE.Color();
const GLIDER_STAY = 20; // sim-minutes a landed glider stays on the map
function updateAir(t, night) {
  const cnt = {}; for (const k of MODELS) cnt[k] = 0;
  let nl = 0, nt = 0; const lp = planeLights.geometry.attributes.position.array, tp = towLines.geometry.attributes.position.array;
  const put = (k, x, y, z, h, pitch, sc = 1) => {
    if (cnt[k] >= 1400) return; _q.setFromEuler(_e.set(0, -h, pitch, "YXZ")); _v.set(x, y, z); _s.setScalar(sc);
    _m.compose(_v, _q, _s); airMesh[k].setMatrixAt(cnt[k]++, _m);
    if (nl < 4000) { lp[nl * 3] = x; lp[nl * 3 + 1] = y - 0.02; lp[nl * 3 + 2] = z; nl++; }
  };
  for (const p of planes) {
    if (!planePos(p, t, _pp)) continue;
    if (!_pp.tugOnly) put(p.model, _pp.x, _pp.y, _pp.z, _pp.h, _pp.pitch, _pp.sc);
    if (p.tug && _pp.tugVisible) {
      put(p.tug, _pp.tx, _pp.ty, _pp.tz, _pp.h, 0);
      if (_pp.towed && nt < 800) { tp.set([_pp.x, _pp.y, _pp.z, _pp.tx, _pp.ty, _pp.tz], nt * 6); nt++; }
    }
  }
  for (const k of MODELS) { airMesh[k].count = cnt[k]; airMesh[k].instanceMatrix.needsUpdate = true; }
  planeLights.geometry.setDrawRange(0, nl); planeLights.geometry.attributes.position.needsUpdate = true;
  planeLights.material.opacity = 0.9 * night;
  airMat.emissive.setRGB(0.1 + 0.32 * night, 0.1 + 0.34 * night, 0.1 + 0.4 * night); // moonlit silhouettes stay readable at night
  towLines.geometry.setDrawRange(0, nt * 2); towLines.geometry.attributes.position.needsUpdate = true;
  const gc = { waco: 0, horsa: 0 };
  for (const gl of gliderGround) {
    const age = t - gl.t;
    if (age < 0 || age > GLIDER_STAY || gc[gl.model] >= 700) continue;
    const k = age > GLIDER_STAY - 5 ? (GLIDER_STAY - age) / 5 : 1; // shrink away once the landing has been shown
    _q.setFromEuler(_e.set(0, gl.rot, 0.05)); _v.set(gl.x, groundY(gl.x, gl.z) + 0.006, gl.z); _s.setScalar(k);
    _m.compose(_v, _q, _s); groundMesh[gl.model].setMatrixAt(gc[gl.model]++, _m);
  }
  for (const k of ["waco", "horsa"]) { groundMesh[k].count = gc[k]; groundMesh[k].instanceMatrix.needsUpdate = true; }
  const pa = paraPts.geometry.attributes.position.array; let m = 0;
  for (const p of paraList) {
    const a = t - p.t0; if (a < 0 || a > p.dur + 12) continue;
    const f = clamp(a / p.dur, 0, 1), gy = groundY(p.x, p.z);
    pa[m * 3] = p.x + Math.sin(p.t0 + a) * 0.05; pa[m * 3 + 1] = lerp(1.2, gy + 0.03, f); pa[m * 3 + 2] = p.z; m++; if (m >= 6000) break;
  }
  paraPts.geometry.setDrawRange(0, m); paraPts.geometry.attributes.position.needsUpdate = true;
}
function groundY(x, z) { const lo = (x + KMX / 2) / KX + LON0, la = LAT1 - (z + KMY / 2) / KY; return yAt(la, lo); }

// ---------------- HQs ----------------
const hqObjs = [];
function buildHQs() {
  for (const [side, name, cmd, la, lo, appear, kind] of HQS) {
    const label = name.replace(/^QG |^PC /, "").replace(/ ·.*$/, "").replace("Infantaria", "Inf.").replace("Aerotransportada", "Aerotr.");
    const { tex } = symbolTexture({ side, hq: true, label, hqText: kind === "ship" ? "PC" : "QG" });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.center.set(0.5, 0); sp.renderOrder = 6;
    sp.userData = { kind: "hq", h: { side, name, cmd, la, lo, kind } };
    const grp = new THREE.Group(); grp.add(sp);
    if (kind === "ship") { const sh = makeShip("hq"); sh.rotation.y = Math.PI / 2 * (hash(la) > .5 ? 1 : -1); grp.add(sh); }
    else { const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 16), new THREE.MeshStandardMaterial({ color: side === "A" ? 0x2c5a8f : 0x8e2a20, roughness: .6 })); flag.position.y = .04; flag.castShadow = true; grp.add(flag); }
    G.hqs.add(grp);
    const o = { side, name, cmd, la, lo, appear, kind, grp, sp }; hqObjs.push(o); placeHQ(o);
  }
}
function placeHQ(o) { o.grp.position.set(toX(o.lo), o.kind === "ship" ? 0 : yAt(o.la, o.lo), toZ(o.la)); }
function updateHQs(t, camPos) {
  for (const o of hqObjs) {
    o.grp.visible = t >= o.appear;
    const d = camPos.distanceTo(o.grp.position), s = clamp(d * 0.03, 0.16, 3.6);
    o.sp.scale.set(s, s * 0.906, 1); o.sp.position.y = o.kind === "ship" ? 0.25 : 0.12;
  }
}

// ---------------- effects (real time) ----------------
const fx = { shells: [], flashes: [], smokes: [], tracers: [] };
let flashPool = [], smokePool = [], shellPool = [], tracerLines, fireSprites = [];
function sprite(color, blend, tex) { const m = new THREE.SpriteMaterial({ map: tex || softTex, color, transparent: true, depthWrite: false, blending: blend || THREE.AdditiveBlending }); const s = new THREE.Sprite(m); s.visible = false; G.fx.add(s); return s; }
function buildFX() {
  for (let i = 0; i < 160; i++) flashPool.push(sprite(0xffa040, null, sparkTex));
  for (let i = 0; i < 160; i++) smokePool.push(sprite(0x8a8681, THREE.NormalBlending, smokeTex));
  for (let i = 0; i < 160; i++) shellPool.push(sprite(0xffc070, null, sparkTex));
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(400 * 6), 3)); tg.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(400 * 6), 3));
  tracerLines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); tracerLines.frustumCulled = false; G.fx.add(tracerLines);
  // persistent fires: [lat, lon, t0, t1, size]
  const fires = [[49.408, -1.317, 100, 300, 1], [49.375, -0.888, 400, 900, .8], [49.362, -0.860, 410, 850, .8], [49.369, -0.874, 420, 800, .7], [49.343, -0.583, 450, 900, .6], [49.293, -0.400, 600, 1440, .5], [49.183, -0.370, 780, 1440, 1.4], [49.276, -0.703, 1200, 1300, .3]];
  for (const f of fires) {
    const glow = sprite(0xff7a2a, null, sparkTex); glow.visible = false; const sm = sprite(0x6f6a64, THREE.NormalBlending, smokeTex);
    fireSprites.push({ la: f[0], lo: f[1], t0: f[2], t1: f[3], size: f[4], glow, sm });
  }
}
function take(pool, list, o) { const s = pool.find((p) => !p.visible); if (!s) return; s.visible = true; o.s = s; list.push(o); }
let fxClock = 0;
function updateFX(t, dt, playing, night) {
  fxClock += dt;
  if (playing && layers.fx) {
    for (const s of ships) {
      if (!s.firing || !s.grp.visible) continue;
      const rate = s.type === "bb" ? 0.55 : s.type === "dd" ? 1.3 : 0.9;
      if (Math.random() < rate * dt) {
        const tx = toX(s.tlo) + (Math.random() - .5) * 1.2, tz = toZ(s.tla) + (Math.random() - .5) * 1.0;
        const from = new THREE.Vector3(s.grp.position.x, 0.12, s.grp.position.z), to = new THREE.Vector3(tx, groundY(tx, tz) + 0.05, tz);
        take(flashPool, fx.flashes, { pos: from.clone(), age: 0, life: 0.18, size: s.type === "bb" ? 1.1 : 0.6 });
        take(shellPool, fx.shells, { from, to, age: 0, life: clamp(from.distanceTo(to) / 9, 0.7, 2.6), big: s.type === "bb" });
      }
    }
    for (const a of AIRSTRIKES) if (t >= a[2] && t <= a[3] && Math.random() < 3.5 * dt) {
      const x = toX(a[1]) + (Math.random() - .5) * 1.4, z = toZ(a[0]) + (Math.random() - .5) * 1.0;
      boom(x, z, 1.4);
    }
    if (t > 0 && t < 300) {
      const active = planes.filter((p) => p.kind !== "bomber" && t > p.tOver - 6 && t < p.tOver + 2);
      if (active.length && Math.random() < 9 * dt) {
        const p = active[(Math.random() * active.length) | 0];
        const gx = p.B[0] + (Math.random() - .5) * 8, gz = p.B[1] + (Math.random() - .5) * 6;
        const tr = fx.tracers.length < 400 ? {} : null;
        if (tr) { tr.o = new THREE.Vector3(gx, groundY(gx, gz), gz); tr.d = new THREE.Vector3((Math.random() - .5) * .5, 1, (Math.random() - .5) * .5).normalize(); tr.age = 0; tr.life = .7 + Math.random() * .5; tr.col = Math.random() < .5 ? [1, .35, .15] : [1, .75, .3]; fx.tracers.push(tr); }
      }
    }
  }
  for (let i = fx.shells.length - 1; i >= 0; i--) {
    const o = fx.shells[i]; o.age += dt; const f = o.age / o.life;
    if (f >= 1) { o.s.visible = false; fx.shells.splice(i, 1); boom(o.to.x, o.to.z, o.big ? 1.2 : 0.75); continue; }
    o.s.position.lerpVectors(o.from, o.to, f); o.s.position.y += Math.sin(f * Math.PI) * (2.2 + o.from.distanceTo(o.to) * .12);
    o.s.scale.setScalar(o.big ? .22 : .15); o.s.material.opacity = 0.6 + 0.4 * nightK;
  }
  for (let i = fx.flashes.length - 1; i >= 0; i--) {
    const o = fx.flashes[i]; o.age += dt; const f = o.age / o.life;
    if (f >= 1) { o.s.visible = false; fx.flashes.splice(i, 1); continue; }
    o.s.position.copy(o.pos); o.s.scale.setScalar(o.size * 0.7 * (0.5 + f * 1.1)); o.s.material.opacity = (1 - f) * (0.7 + 0.3 * night);
  }
  for (let i = fx.smokes.length - 1; i >= 0; i--) {
    const o = fx.smokes[i]; o.age += dt; const f = o.age / o.life;
    if (f >= 1) { o.s.visible = false; fx.smokes.splice(i, 1); continue; }
    o.s.position.set(o.pos.x + f * .6, o.pos.y + f * 1.1, o.pos.z); o.s.scale.setScalar(o.size * (0.5 + f * 2.2)); o.s.material.opacity = 0.55 * (1 - f) * (f < .1 ? f * 10 : 1);
    o.s.material.rotation = o.rot + f;
  }
  const tp = tracerLines.geometry.attributes.position.array, tc = tracerLines.geometry.attributes.color.array; let n = 0;
  for (let i = fx.tracers.length - 1; i >= 0; i--) {
    const o = fx.tracers[i]; o.age += dt; if (o.age > o.life) { fx.tracers.splice(i, 1); continue; }
    const a = o.age * 2.4, b = a + 0.35, fade = 1 - o.age / o.life;
    tp.set([o.o.x + o.d.x * a, o.o.y + o.d.y * a, o.o.z + o.d.z * a, o.o.x + o.d.x * b, o.o.y + o.d.y * b, o.o.z + o.d.z * b], n * 6);
    tc.set([o.col[0] * fade * .3, o.col[1] * fade * .3, o.col[2] * fade * .3, o.col[0] * fade, o.col[1] * fade, o.col[2] * fade], n * 6); n++;
  }
  tracerLines.geometry.setDrawRange(0, n * 2); tracerLines.geometry.attributes.position.needsUpdate = tracerLines.geometry.attributes.color.needsUpdate = true;
  for (const f of fireSprites) {
    const on = layers.fx && t >= f.t0 && t <= f.t1;
    f.glow.visible = on; f.sm.visible = on;
    if (!on) continue;
    const x = toX(f.lo), z = toZ(f.la), y = yAt(f.la, f.lo);
    const fl = 0.8 + Math.sin(fxClock * 13 + f.la * 99) * 0.12 + Math.sin(fxClock * 31 + f.lo * 77) * 0.08;
    f.glow.position.set(x, y + 0.12, z); f.glow.scale.setScalar(f.size * 0.9 * fl); f.glow.material.opacity = 0.35 + 0.6 * night;
    const ph = (fxClock * 0.12 + f.la * 10) % 1;
    f.sm.position.set(x + ph * 0.8, y + 0.3 + ph * 1.6, z); f.sm.scale.setScalar(f.size * (0.8 + ph * 2.5)); f.sm.material.opacity = 0.45 * (1 - ph);
  }
}
function boom(x, z, size) {
  const y = groundY(x, z) + 0.06;
  take(flashPool, fx.flashes, { pos: new THREE.Vector3(x, y + .05, z), age: 0, life: 0.35, size: size * 1.1 });
  take(smokePool, fx.smokes, { pos: new THREE.Vector3(x, y, z), age: 0, life: 3.5 + Math.random() * 2, size: size * .55, rot: Math.random() * 6 });
}

// ---------------- light & time of day ----------------
const RISE = 358, SET = 1327;
function sunState(t) {
  let e; if (t >= RISE && t <= SET) e = Math.sin((t - RISE) / (SET - RISE) * Math.PI) * 64; else { const d = t < RISE ? RISE - t : t - SET; e = -Math.min(18, d / 5); }
  const az = 54 + ((t - RISE) / (SET - RISE)) * 252;
  return { e, az };
}
const cNightSky = new THREE.Color(0x30446a), cDaySky = new THREE.Color(0xd4dde6), cNightGnd = new THREE.Color(0x15181c), cDayGnd = new THREE.Color(0x6a5a44);
const cRoomNight = new THREE.Color(0x05080c), cRoomDay = new THREE.Color(0x0e151b);
const cSunLow = new THREE.Color(0xffb36b), cSunHigh = new THREE.Color(0xfff3e2);
let nightK = 0;
function updateLight(t) {
  const { e, az } = sunState(t);
  const k = smooth(-7, 9, e); nightK = 1 - k;
  const er = THREE.MathUtils.degToRad(Math.max(e, 4)), ar = THREE.MathUtils.degToRad(az);
  sun.position.set(Math.sin(ar) * Math.cos(er) * 120, Math.sin(er) * 120, -Math.cos(ar) * Math.cos(er) * 120);
  sun.intensity = 2.5 * k; sun.color.copy(cSunLow).lerp(cSunHigh, smooth(4, 30, e));
  moon.position.set(-40, 55, 70); moon.intensity = 0.75 * (1 - k);
  sun.castShadow = k > 0.35; moon.castShadow = !sun.castShadow;
  hemi.color.copy(cNightSky).lerp(cDaySky, k); hemi.groundColor.copy(cNightGnd).lerp(cDayGnd, k); hemi.intensity = lerp(0.55, 0.72, k);
  scene.background.copy(cRoomNight).lerp(cRoomDay, k); scene.fog.color.copy(scene.background);
  renderer.toneMappingExposure = lerp(1.25, 1.05, k);
  water.material.color.setHex(k > 0.5 ? 0x2f5a78 : 0x1d3348);
  const phase = e < -6 ? "Noite · lua cheia" : e < 4 ? (t < 700 ? "Alvorada" : "Crepúsculo") : t < 700 ? "Manhã" : t < 1080 ? "Tarde" : "Fim de tarde";
  const ph = $("#phase"); if (ph.textContent !== phase) ph.textContent = phase;
}

// ---------------- time & playback ----------------
let simT = 450, playing = false, speed = 5, lastFrame = performance.now();
const SPEEDS = [1, 5, 15, 60];
function setTime(t) { simT = clamp(t, T0, T1); drawTrack(); updateClock(); updateEvents(); }
function fmt(t) { let m = Math.round(t); const day = m < 0 ? 5 : m >= 1440 ? 7 : 6; m = ((m % 1440) + 1440) % 1440; return [String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"), day]; }
function updateClock() {
  const [s, day] = fmt(simT); $("#clock").textContent = s;
  const lab = day === 5 ? "Segunda, 5 jun 1944" : day === 7 ? "Quarta, 7 jun 1944" : "Terça, 6 jun 1944";
  const st = $("#date strong"); if (st.textContent !== lab) st.textContent = lab;
}
function togglePlay(v) {
  playing = v === undefined ? !playing : v;
  if (playing && simT >= T1 - 0.5) simT = T0;
  $("#playicon").innerHTML = playing ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4.5v15l13-7.5z"/>';
  $("#play").setAttribute("aria-label", playing ? "Pausar" : "Reproduzir");
}

// ---------------- camera ----------------
let fly = null, follow = null;
function presetPose(p) {
  const asp = innerWidth / innerHeight, portrait = asp < 0.85;
  const tx = toX(p.lon), tz = toZ(p.lat) + (portrait ? p.dist * 0.06 : 0), pol = THREE.MathUtils.degToRad(p.pol - (portrait ? 16 : 0)), az = THREE.MathUtils.degToRad(p.az);
  const d = p.dist * (portrait ? 0.82 : asp < 1.3 ? 1.2 : 1);
  return { target: new THREE.Vector3(tx, 0, tz), pos: new THREE.Vector3(tx + d * Math.sin(pol) * Math.sin(az), d * Math.cos(pol), tz + d * Math.sin(pol) * Math.cos(az)) };
}
function flyTo(key, instant) {
  const p = PRESETS[key]; if (!p) return; follow = null;
  const pose = presetPose(p);
  document.querySelectorAll("#presets .chip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === key ? "true" : "false"));
  if (instant) { controls.target.copy(pose.target); camera.position.copy(pose.pos); controls.update(); return; }
  fly = { t0: performance.now(), dur: 1500, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: pose.target, toP: pose.pos };
}
function flyToPoint(lat, lon, dist = 14) {
  const pose = presetPose({ lat, lon, dist, pol: 50, az: 0 });
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

function eventDist(e) { return /frota|sol|Fim do dia|bombardeio naval/i.test(e[3]) ? 60 : /salta|Mallard|Elmira|B-24/i.test(e[3]) ? 20 : 12; }
let autoCam = true, lastAutoIdx = -2, lastUserCam = -1e9;
function currentEventIdx() { let k = -1; for (let i = 0; i < EVENTS.length; i++) if (EVENTS[i][0] <= simT) k = i; return k; }
function flyToEvent(i) { const e = EVENTS[i]; if (!e || e[1] === null) return; follow = null; flyToPoint(e[1], e[2], eventDist(e)); }
function updateAutoCam(now) {
  if (!autoCam) return;
  const i = currentEventIdx();
  if (i === lastAutoIdx) return;
  lastAutoIdx = i;
  if (i >= 0 && playing && now - lastUserCam > 5000) flyToEvent(i);
}
function setAutoCam(v) { autoCam = v; const b = $("#autocam"); if (b) b.setAttribute("aria-pressed", v ? "true" : "false"); if (v) { lastAutoIdx = currentEventIdx(); flyToEvent(lastAutoIdx); } }

// ---------------- picking ----------------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let selected = null, hovered = null, downAt = null;
function pick(ev) {
  const r = canvas.getBoundingClientRect(); mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const cand = [];
  if (layers.units) for (const o of unitObjs) if (o.grp.visible) cand.push(o.sp);
  if (layers.hqs) for (const o of hqObjs) if (o.grp.visible) cand.push(o.sp);
  if (layers.forts) for (const f of forts) cand.push(f.hit);
  if (layers.fleet) for (const s of ships) if (s.grp.visible) cand.push(s.grp.children[s.grp.children.length - 1]);
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
  if (d) { tip.hidden = false; tip.style.left = e.clientX + "px"; tip.style.top = e.clientY + "px"; tip.textContent = d.u ? d.u.name : d.h ? d.h.name : d.f ? d.f.name : d.s ? d.s.name : ""; canvas.style.cursor = "pointer"; }
  else { tip.hidden = true; canvas.style.cursor = ""; }
});
canvas.addEventListener("pointerleave", () => { $("#tip").hidden = true; });

// ---------------- card ----------------
const NATN = { US: "Estados Unidos", UK: "Reino Unido", CA: "Canadá", FR: "França Livre", DE: "Alemanha" };
const SIZEN = { I: "Companhia", II: "Batalhão", III: "Regimento", X: "Brigada", XX: "Divisão" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function select(d) {
  const card = $("#card"); card.hidden = false;
  if (d.kind === "unit") {
    const u = d.u; selected = { u };
    const first = fmt(u.track[0][0])[0], arrival = u.side === "A" ? (["para", "glider"].includes(u.type) ? "Salto ou pouso às " : "Desembarque às ") + first : "Em posição desde antes do ataque";
    card.innerHTML = `<div class="top"><canvas id="cardsym"></canvas><div style="min-width:0"><div class="eyebrow">${esc(NATN[u.nat])} · ${esc(SIZEN[u.size])}</div><h2>${esc(u.name)}</h2></div><button class="close" type="button" aria-label="Fechar">×</button></div>
    <dl><dt>Comandante</dt><dd>${esc(u.cmd)}</dd><dt>Efetivo</dt><dd>${esc(u.men)}</dd><dt>Equipamento</dt><dd>${esc(u.eq)}</dd><dt>Missão</dt><dd>${esc(u.mission)}</dd><dt>Entrada</dt><dd>${esc(u.side === "A" ? arrival : "Em posição desde antes do ataque")}</dd></dl>
    <div class="actions"><button class="chip" id="cfollow" type="button" aria-pressed="false">Acompanhar</button><button class="chip" id="cgo" type="button">Ir até a unidade</button></div>`;
    symbolInto($("#cardsym"), { side: u.side, type: u.type, size: u.size, nat: u.nat });
    $("#cfollow").onclick = (ev) => { setAutoCam(false); const o = unitObjs.find((x) => x.u === u); follow = follow === o ? null : o; ev.currentTarget.setAttribute("aria-pressed", follow ? "true" : "false"); if (follow && simT < u.track[0][0]) setTime(u.track[0][0]); };
    $("#cgo").onclick = () => { setAutoCam(false); const t = Math.max(simT, u.track[0][0]); if (t !== simT) setTime(t); const [la, lo] = trackAt(u.track, t); flyToPoint(la, lo, 9); };
  } else if (d.kind === "fort") {
    const f = d.f; selected = null;
    card.innerHTML = `<div class="top"><canvas id="cardsym"></canvas><div style="min-width:0"><div class="eyebrow">Muralha do Atlântico · ${f.type === "bat" ? "Bateria" : "Ninho de resistência"}</div><h2>${esc(f.name)}</h2></div><button class="close" type="button" aria-label="Fechar">×</button></div>
    <dl><dt>Armamento</dt><dd>${esc(f.arm)}</dd><dt>Guarnição</dt><dd>~${f.men} homens</dd><dt>Situação</dt><dd>${f.fall === null ? "Resistiu além do dia 6" : (simT >= f.fall ? "Neutralizado às " : "Cai às ") + fmt(f.fall)[0]}</dd></dl>`;
    symbolInto($("#cardsym"), { side: "G", type: "fort" });
  } else if (d.kind === "hq") {
    const h = d.h; selected = null;
    card.innerHTML = `<div class="top"><canvas id="cardsym"></canvas><div style="min-width:0"><div class="eyebrow">${h.side === "A" ? "Aliados" : "Eixo"} · ${h.kind === "ship" ? "Navio-capitânia" : "Quartel-general"}</div><h2>${esc(h.name)}</h2></div><button class="close" type="button" aria-label="Fechar">×</button></div>
    <dl><dt>Comando</dt><dd>${esc(h.cmd)}</dd><dt>Posição</dt><dd class="mono">${h.la.toFixed(3)}° N, ${Math.abs(h.lo).toFixed(3)}° ${h.lo < 0 ? "W" : "E"}</dd></dl>`;
    symbolInto($("#cardsym"), { side: h.side, hq: true, hqText: h.kind === "ship" ? "PC" : "QG" });
  } else if (d.kind === "ship") {
    const s = d.s; selected = null;
    const TYP = { bb: "Encouraçado", ca: "Cruzador pesado", cl: "Cruzador", dd: "Contratorpedeiro", mon: "Monitor" };
    const sh = ships.find((x) => x.name === s.name);
    card.innerHTML = `<div class="top"><canvas id="cardsym"></canvas><div style="min-width:0"><div class="eyebrow">Força ${esc(s.force)} · ${esc(TYP[s.type] || "Navio")}</div><h2>${esc(s.name)}</h2></div><button class="close" type="button" aria-label="Fechar">×</button></div>
    <dl><dt>Fogo</dt><dd>${fmt(sh.f0)[0]} a ${sh.sunk ? "afundar às " + fmt(sh.sunk)[0] : fmt(sh.f1)[0]}</dd><dt>Alvo inicial</dt><dd class="mono">${sh.tla.toFixed(3)}° N, ${Math.abs(sh.tlo).toFixed(3)}° W</dd></dl>`;
    symbolInto($("#cardsym"), { side: "A", type: "ship" });
  }
  card.querySelector(".close").onclick = closeCard;
}
function closeCard() { $("#card").hidden = true; selected = null; follow = null; }

// ---------------- UI ----------------
const layers = { units: true, trails: true, forts: true, fleet: true, air: true, craft: true, hqs: true, fx: true };
const LNAMES = { units: "Unidades", trails: "Trajetos", forts: "Defesas", fleet: "Frota", air: "Aviões", craft: "Lanchas", hqs: "QGs", fx: "Combate" };
function buildUI() {
  const pr = $("#presets");
  for (const [k, p] of Object.entries(PRESETS)) { const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.dataset.k = k; b.textContent = p.name; b.setAttribute("aria-pressed", "false"); b.onclick = () => { setAutoCam(false); flyTo(k); }; pr.appendChild(b); }
  const ly = $("#layers");
  for (const k of Object.keys(layers)) { const l = document.createElement("label"); l.innerHTML = `<input type="checkbox" id="ly-${k}" checked> ${LNAMES[k]}`; l.querySelector("input").onchange = (e) => { layers[k] = e.target.checked; G[k].visible = layers[k]; }; ly.appendChild(l); }
  const ex = $("#exag"); let exTimer = null;
  ex.oninput = () => { $("#exagv").textContent = ex.value + "×"; clearTimeout(exTimer); exTimer = setTimeout(() => { EXAG = +ex.value; applyExag(); }, 60); };
  const lg = $("#legend");
  const items = [["Infantaria", { side: "A", type: "inf" }], ["Paraquedistas", { side: "A", type: "para" }], ["Blindados", { side: "A", type: "armor" }], ["Commandos", { side: "A", type: "cdo" }], ["Alemães", { side: "G", type: "inf" }], ["Panzergrenadiere", { side: "G", type: "pzgr" }], ["Quartel-general", { side: "A", hq: true }], ["Defesa costeira", { side: "G", type: "fort" }]];
  for (const [name, o] of items) { const d = document.createElement("div"); const cv = document.createElement("canvas"); d.appendChild(cv); d.appendChild(document.createTextNode(name)); lg.appendChild(d); requestAnimationFrame(() => symbolInto(cv, o)); }
  const off = document.createElement("div"); off.innerHTML = `<div class="eyebrow" style="margin-bottom:6px">Comandos fora do mapa</div>` + OFFMAP.map(([s, n, c, w]) => `<div style="font-size:12.5px;line-height:1.35;margin-bottom:5px"><b style="font:600 14px/1 var(--f-head);color:${s === "A" ? "var(--allied)" : "var(--axis)"}">${esc(n)}</b> · ${esc(c)}<br><span style="color:var(--muted)">${esc(w)}</span></div>`).join("");
  $("#offmap").appendChild(off);
  const tt = $("#toolstoggle"); const toolsEl = $("#tools");
  const setTools = (open) => { toolsEl.classList.toggle("collapsed", !open); tt.setAttribute("aria-expanded", open ? "true" : "false"); tt.textContent = open ? "Fechar" : "Camadas"; };
  setTools(innerWidth >= 700); tt.onclick = () => setTools(toolsEl.classList.contains("collapsed"));
  if (innerWidth >= 700) tt.style.display = "none";
  const spd = $("#speeds");
  for (const s of SPEEDS) { const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.textContent = s + "×"; b.title = s + " minuto(s) por segundo"; b.setAttribute("aria-pressed", s === speed ? "true" : "false"); b.onclick = () => { speed = s; spd.querySelectorAll(".chip[data-s]").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.s === s ? "true" : "false")); }; b.dataset.s = s; spd.insertBefore(b, $("#autocam")); }
  $("#togglelog").onclick = () => $("#log").classList.toggle("hiddenm");
  $("#autocam").onclick = () => setAutoCam(!autoCam);
  if (innerWidth < 700) $("#log").classList.add("hiddenm");
  $("#play").onclick = () => togglePlay();
  const jump = (dir) => { const i = currentEventIdx(); const k = dir < 0 ? (i >= 0 && simT - EVENTS[i][0] > 1 ? i : i - 1) : i + 1; if (k < 0 || k >= EVENTS.length) return; setTime(EVENTS[k][0]); lastAutoIdx = k; flyToEvent(k); };
  $("#prevev").onclick = () => jump(-1); $("#nextev").onclick = () => jump(1);
  addEventListener("keydown", (e) => { if (["INPUT"].includes(document.activeElement.tagName)) return; if (e.key === "PageUp" || (e.key === "," )) { e.preventDefault(); jump(-1); } if (e.key === "PageDown" || e.key === ".") { e.preventDefault(); jump(1); } });
  // events
  const ev = $("#events");
  EVENTS.forEach((e, i) => {
    const d = document.createElement("div"); d.className = "ev"; d.tabIndex = 0; d.dataset.i = i;
    d.innerHTML = `<time>${fmt(e[0])[0]}</time><b class="${e[5]}">${esc(e[3])}</b><p>${esc(e[4])}</p>`;
    const go = () => { setTime(e[0]); lastAutoIdx = i; flyToEvent(i); };
    d.onclick = go; d.onkeydown = (k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); go(); } };
    ev.appendChild(d);
  });
  ev.addEventListener("scroll", () => { evScrollAt = performance.now(); }, { passive: true });
  // track
  const tr = $("#track"); let drag = false;
  const tFromX = (x) => { const r = tr.getBoundingClientRect(); return T0 + clamp((x - r.left - 10) / (r.width - 20), 0, 1) * (T1 - T0); };
  tr.addEventListener("pointerdown", (e) => { drag = true; tr.setPointerCapture(e.pointerId); setTime(tFromX(e.clientX)); });
  tr.addEventListener("pointermove", (e) => { if (drag) setTime(tFromX(e.clientX)); });
  tr.addEventListener("pointerup", () => { drag = false; if (autoCam) { lastAutoIdx = currentEventIdx(); flyToEvent(lastAutoIdx); } });
  tr.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { setTime(simT + (e.shiftKey ? 30 : 5)); e.preventDefault(); } if (e.key === "ArrowLeft") { setTime(simT - (e.shiftKey ? 30 : 5)); e.preventDefault(); } });
  addEventListener("keydown", (e) => { if (e.code === "Space" && !["INPUT", "BUTTON"].includes(document.activeElement.tagName)) { e.preventDefault(); togglePlay(); } });
  addEventListener("resize", resize);
}
let evScrollAt = 0, lastNowIdx = -2;
function updateEvents() {
  const items = document.querySelectorAll("#events .ev"); if (!items.length) return;
  let nowIdx = -1; EVENTS.forEach((e, i) => { if (e[0] <= simT) nowIdx = i; });
  const recent = nowIdx >= 0 && simT - EVENTS[nowIdx][0] < 45 ? nowIdx : -1;
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
  const grd = g.createLinearGradient(X(T0), 0, X(T1), 0);
  const stop = (t, col) => grd.addColorStop(clamp((t - T0) / (T1 - T0), 0, 1), col);
  stop(T0, "#16243a"); stop(300, "#16243a"); stop(358, "#7a5a3a"); stop(420, "#b9a680"); stop(1260, "#b9a680"); stop(1327, "#7a5a3a"); stop(1400, "#16243a"); stop(T1, "#16243a");
  g.fillStyle = grd; g.globalAlpha = 0.55; g.fillRect(X(T0), y0, X(T1) - X(T0), bh); g.globalAlpha = 1;
  g.fillStyle = "rgba(217,164,65,.85)"; g.fillRect(X(T0), y0, X(simT) - X(T0), 2 * DPR);
  g.font = `500 ${10.5 * DPR}px 'IBM Plex Mono', monospace`; g.textAlign = "center"; g.textBaseline = "top";
  const every = w / DPR < 560 ? 240 : w / DPR < 900 ? 120 : 60;
  for (let t = -120; t <= 1440; t += 60) {
    const x = X(t), major = t % every === 0 || t === -120;
    g.fillStyle = "rgba(196,212,224,.35)"; g.fillRect(x, y0 + bh, DPR, major ? 6 * DPR : 3 * DPR);
    if (major) { g.fillStyle = "rgba(196,212,224,.75)"; g.fillText(fmt(t)[0].slice(0, 2) + "h", x, y0 + bh + 8 * DPR); }
  }
  // H-hours
  g.fillStyle = "#b783c7"; g.textBaseline = "bottom"; g.font = `600 ${10 * DPR}px 'Barlow Condensed', sans-serif`;
  for (const t of [390, 445, 465]) { const x = X(t); g.fillRect(x - DPR * .5, y0 - 4 * DPR, DPR * 1.5, bh + 4 * DPR); }
  g.textAlign = "right"; g.fillText("HORAS H", X(390) - 5 * DPR, y0 - 4 * DPR);
  for (const e of EVENTS) { const x = X(e[0]); g.fillStyle = e[5] === "A" ? "#6ea6ef" : "#ec6656"; g.beginPath(); g.arc(x, y0 + bh / 2, 2.6 * DPR, 0, 7); g.fill(); }
  const px = X(simT); g.fillStyle = "#f1c46d"; g.fillRect(px - DPR, 4 * DPR, 2 * DPR, h - 8 * DPR);
  g.beginPath(); g.arc(px, y0 + bh / 2, 6 * DPR, 0, 7); g.fill(); g.strokeStyle = "#0b1116"; g.lineWidth = 2 * DPR; g.stroke();
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); drawTrack();
}

// ---------------- frame ----------------
let lastUI = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  if (playing) { simT += dt * speed; if (simT >= T1) { simT = T1; togglePlay(false); } }
  updateAutoCam(now);
  updateFly(now);
  if (follow && follow.pos) { const d = new THREE.Vector3(follow.pos.x, 0, follow.pos.z).sub(new THREE.Vector3(controls.target.x, 0, controls.target.z)); controls.target.add(d.multiplyScalar(0.08)); camera.position.add(d); }
  controls.update();
  const cp = camera.position;
  updateLight(simT);
  updateUnits(simT, cp); updateForts(simT); updateFleet(simT); updateCraft(simT); updateAir(simT, nightK); updateHQs(simT, cp);
  updateFX(simT, dt, playing, nightK); updateEquipment(simT);
  waterNormal.offset.x = (now * 0.000004) % 1; waterNormal.offset.y = (now * 0.0000025) % 1;
  if (now - lastUI > (playing ? 90 : 250)) { lastUI = now; updateClock(); drawTrack(); updateEvents(); }
  renderer.render(scene, camera);
}

boot().catch((e) => { const L = $("#loading"); if (L) L.querySelector("h2").textContent = "Não foi possível carregar a maquete: " + e.message; console.error(e); });
})();
