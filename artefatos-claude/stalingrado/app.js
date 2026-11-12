(function () {
'use strict';
const SG = window.SG;
function main() {
let dirty = true;
const D0 = Date.UTC(1942, 7, 23);
const day = s => { const [y, m, d] = s.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - D0) / 864e5); };
const NDAYS = day(SG.END);
const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const dateLabel = i => { const dt = new Date(D0 + Math.floor(i) * 864e5); return dt.getUTCDate() + ' ' + MES[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear(); };
const shortDate = s => { const i = day(s), dt = new Date(D0 + i * 864e5); return dt.getUTCDate() + ' ' + MES[dt.getUTCMonth()]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = SG.noise.sstep;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const small = Math.min(window.innerWidth, window.innerHeight) < 700;
const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const load = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

// ---------- preferências: exagero vertical e estilo ----------
let EX = 25; { const v = +load('stalingrado-ex'); if ([10, 25, 50].includes(v)) EX = v; }
let MODE = load('stalingrado-mode') === 'chart' ? 'chart' : 'real';
const M2U = EX / 1110;                 // metros → unidades (1 unidade ≈ 1,11 km)
const BX = 1 + EX * 0.1;               // exagero dos prédios e árvores

// ---------- projeção ----------
const LON0 = 43.0, LAT0 = 49.05, KX = 100 * Math.cos(49 * Math.PI / 180), KZ = 100;
const P = (lon, lat) => ({ x: (lon - LON0) * KX, z: -(lat - LAT0) * KZ });
const W = 580, H = 570, SX = small ? 380 : 540, SY = SX;

// ---------- rios ----------
const RIV = SG.RIVERS.map(r => {
  const curve = new THREE.CatmullRomCurve3(r.pts.map(([lo, la]) => { const p = P(lo, la); return new THREE.Vector3(p.x, 0, p.z); }));
  const n = Math.max(60, Math.round(curve.getLength() / 0.8));
  return { r, pts: curve.getSpacedPoints(n) };
});
function riverXZ(z) {
  const v = RIV[0].pts;
  for (let i = 1; i < v.length; i++) {
    const a = v[i - 1], b = v[i];
    if ((a.z - z) * (b.z - z) <= 0) { const f = (z - a.z) / ((b.z - a.z) || 1), dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1; return { x: a.x + dx * f, z, nx: -dz / L, nz: dx / L }; }
  }
  return { x: v[0].x, z, nx: -1, nz: 0 };
}
const BANK = SG.RIVERS[0].w / 2;
function cityLL(lat, km) {
  const r = riverXZ(-(lat - LAT0) * KZ), u = BANK + km / 1.11;
  const x = r.x + r.nx * u, z = r.z + r.nz * u; return { lo: x / KX + LON0, la: LAT0 - z / KZ };
}
const kmFromBank = (x, z) => { const r = riverXZ(z); return ((x - r.x) * r.nx + (z - r.z) * r.nz - BANK) * 1.11; };
const C = SG.CITY;

// ---------- relevo ----------
const FIELD = SG.buildField({ W, H, N: small ? 768 : 1024, P, LON0, LAT0, KX, KZ });

// malha com mais vértices na cidade: densidade alta em torno de Stalingrado e média na área da batalha
function makeWarp(len, N, c, A1, s1, A2, s2) {
  const M = 8192, cum = new Float64Array(M + 1), ds = len / M;
  for (let k = 0; k < M; k++) { const s = -len / 2 + (k + 0.5) * ds; cum[k + 1] = cum[k] + (1 + A1 * Math.exp(-(((s - c) / s1) ** 2)) + A2 * Math.exp(-(((s - c) / s2) ** 2))) * ds; }
  const T = cum[M]; for (let k = 0; k <= M; k++) cum[k] /= T;
  const pos = new Float32Array(N + 1); let k = 0;
  for (let i = 0; i <= N; i++) { const u = i / N; while (k < M - 1 && cum[k + 1] < u) k++; const f = (u - cum[k]) / ((cum[k + 1] - cum[k]) || 1); pos[i] = -len / 2 + (k + clamp(f, 0, 1)) * ds; }
  pos[0] = -len / 2; pos[N] = len / 2;
  const idx = x => { const q = clamp((x + len / 2) / ds, 0, M - 1e-6), k0 = q | 0, f = q - k0; return (cum[k0] + (cum[k0 + 1] - cum[k0]) * f) * N; };
  return { pos, idx };
}
const CC = P(44.54, 48.72);
const GX = makeWarp(W, SX, CC.x, 1.6, 120, 13, 7), GZ = makeWarp(H, SY, CC.z, 1.6, 105, 8, 17);

// detalhe urbano analítico (m): barranco do Volga, Mamayev Kurgan e as ravinas
const RAV = C.RAVINES.map(([n, lat, len]) => { const pts = []; for (let k = 0; k <= 24; k++) { const km = k / 24 * len; pts.push([(lat + Math.sin(k * 0.75) * 0.0012 + km * 0.0015 - 48.7) * 111, km]); } return { pts, len }; });
function ravineDist(lat, km) {
  const y = (lat - 48.7) * 111; let best = 1e9, len = 0;
  for (const rv of RAV) for (let i = 1; i < rv.pts.length; i++) {
    const a = rv.pts[i - 1], b = rv.pts[i], dx = b[1] - a[1], dy = b[0] - a[0];
    const t = clamp(((km - a[1]) * dx + (y - a[0]) * dy) / (dx * dx + dy * dy || 1), 0, 1), ex = a[1] + dx * t - km, ey = a[0] + dy * t - y, d = Math.hypot(ex, ey);
    if (d < best) { best = d; len = rv.len; }
  }
  return { d: best, len };
}
function cityM(x, z, base) {
  const lat = LAT0 - z / KZ; if (lat < 48.5 || lat > 48.92) return base;
  const r = riverXZ(z), km = ((x - r.x) * r.nx + (z - r.z) * r.nz - BANK) * 1.11;
  if (km < -0.05 || km > 9.5) return base;
  const wl = sstep(48.5, 48.56, lat) * sstep(48.92, 48.87, lat) * sstep(9.5, 6.5, km);
  const lv = FIELD.heightM(r.x, r.z) - 2.5;
  const prof = lv + 3 + 56 * sstep(0, 0.42, km) + 6 * Math.max(0, km - 0.42) + (SG.noise.fbm(x * 0.9, z * 0.9, 2) - 0.5) * 7;
  let h = base + (prof - base) * wl;
  const dk = Math.hypot((lat - 48.742) * 111, km - 1.1); h += 47 * Math.exp(-((dk / 0.55) ** 2)) * wl;
  const rv = ravineDist(lat, km), cut = 32 * Math.exp(-((rv.d / 0.15) ** 2)) * sstep(rv.len * 1.08, rv.len * 0.55, km) * wl;
  return Math.max(h - cut, Math.min(h, lv + 3));
}

// malha do terreno
const NV = (SX + 1) * (SY + 1), HG = new Float32Array(NV);
const tgeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(NV * 3), uv = new Float32Array(NV * 2);
  for (let j = 0; j <= SY; j++) { const z = GZ.pos[j]; for (let i = 0; i <= SX; i++) {
    const k = j * (SX + 1) + i, x = GX.pos[i], h = cityM(x, z, FIELD.heightM(x, z)) * M2U;
    HG[k] = h; pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uv[k * 2] = (x + W / 2) / W; uv[k * 2 + 1] = 1 - (z + H / 2) / H;
  } }
  const idx = new Uint32Array(SX * SY * 6); let q = 0;
  for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) { const a = j * (SX + 1) + i, b = a + 1, c = a + SX + 1, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  tgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tgeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tgeo.setIndex(new THREE.BufferAttribute(idx, 1)); tgeo.computeVertexNormals();
}
function heightAt(x, z) {
  const gx = clamp(GX.idx(x), 0, SX - 0.001), gz = clamp(GZ.idx(z), 0, SY - 0.001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, w = SX + 1;
  const a = HG[j * w + i], b = HG[j * w + i + 1], c = HG[(j + 1) * w + i], d = HG[(j + 1) * w + i + 1];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}
const G = (lon, lat, up = 0) => { const p = P(lon, lat); return new THREE.Vector3(p.x, heightAt(p.x, p.z) + up, p.z); };
const CG = (lat, km, up = 0) => { const ll = cityLL(lat, km); return G(ll.lo, ll.la, up); };

// ---------- cena ----------
const wrap = $('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
wrap.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb8c2c3, 500, 2500);
const camera = new THREE.PerspectiveCamera(38, 1, 0.03, 9000);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = 1.4; controls.minDistance = 3; controls.maxDistance = 1100;
controls.screenSpacePanning = false;
const hemi = new THREE.HemisphereLight(0xd6dee4, 0x5a5040, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 0.95); sun.position.set(-140, 120, 110); scene.add(sun);

// céu em gradiente que acompanha o clima
const skyU = { top: { value: new THREE.Color('#5d7484') }, hor: { value: new THREE.Color('#b8c2c3') }, gnd: { value: new THREE.Color('#8b8a80') } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top, hor, gnd; varying vec3 vD; void main(){ float y = normalize(vD).y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(hor, gnd, clamp(-y * 5.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }'
}));
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

// terreno
const terrainMat = SG.snowify(new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 }), { real: true, amt: 1 });
const terrain = new THREE.Mesh(tgeo, terrainMat);
scene.add(terrain);
const maxAniso = renderer.capabilities.getMaxAnisotropy(), bigTex = !small && renderer.capabilities.maxTextureSize >= 8192;
let texReal = null, texChart = null;
function makeOverlay(TS) {
  const c = document.createElement('canvas'); c.width = c.height = TS; const g = c.getContext('2d');
  const X = x => (x + W / 2) / W * TS, Zc = z => (H / 2 - z) / H * TS, pt = (lo, la) => { const p = P(lo, la); return [X(p.x), Zc(p.z)]; };
  const path = (pts, close) => { g.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = pt(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); if (close) g.closePath(); };
  // Stalingrado
  const north = [], south = [];
  for (let la = 48.866; la >= 48.548; la -= 0.003) { const a = cityLL(la, la > 48.69 ? 4.4 : 2.8), b = cityLL(la, 0.02); north.push([a.lo, a.la]); south.unshift([b.lo, b.la]); }
  path(north.concat(south), true); g.fillStyle = 'rgba(104,98,90,0.82)'; g.fill();
  // vilas e cidades
  let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  SG.TOWNS.forEach(([n, lo, la, tier]) => {
    if (tier > 2) return; const [x, y] = pt(lo, la), r = (tier > 1 ? 2.2 : 0.8) / W * TS;
    g.fillStyle = tier > 1 ? 'rgba(112,104,94,0.8)' : 'rgba(126,114,98,0.62)';
    for (let q = 0; q < 7; q++) { g.beginPath(); g.ellipse(x + (rnd() - 0.5) * r * 1.4, y + (rnd() - 0.5) * r * 1.4, r * (0.4 + rnd() * 0.5), r * (0.3 + rnd() * 0.4), rnd() * 3, 0, 7); g.fill(); }
  });
  // ferrovias
  g.strokeStyle = 'rgba(52,45,40,0.85)'; g.lineWidth = Math.max(1.1, TS / 2048 * 1.3); g.lineJoin = 'round';
  SG.RAILWAYS.forEach(r => { path(r); g.stroke(); });
  // lagos salgados e de água
  SG.LAKES.forEach(([lo, la, rx, rz, rot, type]) => {
    const [x, y] = pt(lo, la); g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath(); g.ellipse(0, 0, rx / W * TS, rz / H * TS, 0, 0, 7);
    if (type === 'salt') { g.fillStyle = 'rgba(232,228,216,0.95)'; g.fill(); g.strokeStyle = 'rgba(160,150,128,0.8)'; g.lineWidth = 2; g.stroke(); }
    else { g.fillStyle = 'rgba(50,80,94,0.95)'; g.fill(); }
    g.restore();
  });
  // lagoas e meandros abandonados nas várzeas
  g.fillStyle = 'rgba(52,82,96,0.85)';
  for (let q = 0; q < 2600; q++) {
    const x = -W / 2 + rnd() * W, z = -H / 2 + rnd() * H, c2 = FIELD.cellAt(x, z);
    if (FIELD.FLD[c2] !== 1 || rnd() > 0.5) continue;
    g.beginPath(); g.ellipse(X(x), Zc(z), (0.15 + rnd() * 0.35) / W * TS, (0.06 + rnd() * 0.1) / W * TS, rnd() * 3, 0, 7); g.fill();
  }
  return c;
}
function getTex(mode) {
  if (mode === 'real') {
    if (!texReal) { const TS = 2048; texReal = SG.paintRealistic(FIELD, { size: TS, W, H, LON0, LAT0, KX, KZ, overlay: makeOverlay(TS), anisotropy: maxAniso }); }
    return texReal;
  }
  if (!texChart) texChart = SG.buildChart({ P, F: FIELD, W, H, cityLL, RIVERS: SG.RIVERS, size: bigTex ? 4096 : 2048, anisotropy: maxAniso });
  return texChart;
}

// rios
const waterMat = SG.iceify(new THREE.MeshStandardMaterial({ color: 0x3a6474, roughness: 0.55, metalness: 0, transparent: true, opacity: 0.92 }));
for (const rv of RIV) {
  const pts = rv.pts, vtx = [], idx = [], half = rv.r.w / 2 + 0.05;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, p = pts[i];
    const y = heightAt(p.x, p.z) + 0.035;
    vtx.push(p.x + nx * half, y, p.z + nz * half, p.x - nx * half, y, p.z - nz * half);
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vtx, 3)); g.setIndex(idx);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(vtx.length).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  const m = new THREE.Mesh(g, waterMat); m.renderOrder = 1; scene.add(m);
}

// ---------- vegetação ----------
const cityLatMin = 48.54, cityLatMax = 48.88;
const isUrban = (x, z) => { const lat = LAT0 - z / KZ; if (lat < cityLatMin || lat > cityLatMax || x < CC.x - 12 || x > CC.x + 12) return false; const km = kmFromBank(x, z); return km > -0.3 && km < (lat > 48.69 ? 4.5 : 2.9); };
const treeList = SG.placeTrees(FIELD, { budget: small ? 15000 : 42000, P, focus: [43.9, 48.9], skip: isUrban });
const leafMat = SG.snowify(new THREE.MeshStandardMaterial({ color: 0x5d7238, roughness: 1, flatShading: true }), { ns: 5 });
const pineMat = SG.snowify(new THREE.MeshStandardMaterial({ color: 0x33452e, roughness: 1, flatShading: true }), { ns: 5, amt: 0.85 });
const crownGeo = new THREE.IcosahedronGeometry(1, 0).translate(0, 1, 0), pineGeo = new THREE.ConeGeometry(0.42, 1, 7).translate(0, 0.5, 0);
const nPine = treeList.filter(t => t.pine).length;
const leafTrees = new THREE.InstancedMesh(crownGeo, leafMat, Math.max(1, treeList.length - nPine)), pineTrees = new THREE.InstancedMesh(pineGeo, pineMat, Math.max(1, nPine));
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  let a = 0, b = 0; const base = 0.0105 * BX;
  treeList.forEach(t => {
    const y = heightAt(t.x, t.z) - 0.002; v.set(t.x, y, t.z); q.setFromAxisAngle(up, t.r * 6.28);
    col.setScalar(0.82 + t.r * 0.34);
    if (t.pine) { s.set(base * t.s * 1.1, base * t.s * 3.2, base * t.s * 1.1); m4.compose(v, q, s); pineTrees.setMatrixAt(b, m4); pineTrees.setColorAt(b++, col); }
    else { s.set(base * t.s, base * t.s * 1.15, base * t.s); m4.compose(v, q, s); leafTrees.setMatrixAt(a, m4); leafTrees.setColorAt(a++, col); }
  });
  leafTrees.count = a; pineTrees.count = b;
  scene.add(leafTrees, pineTrees);
}

// casas das vilas
const hutGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const hutMat = SG.snowify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), { ns: 30 });
const huts = [];
{
  let seed = 97; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  SG.TOWNS.forEach(([n, lo, la, tier]) => {
    if (tier > 2) return; const c = P(lo, la), N = tier > 1 ? 260 : 60, R = tier > 1 ? 1.8 : 0.7, ang = rnd() * 3;
    for (let q = 0; q < N; q++) {
      const along = (rnd() - 0.5) * 2 * R, off = (rnd() - 0.5) * R * (tier > 1 ? 1.4 : 0.5);
      const x = c.x + Math.cos(ang) * along - Math.sin(ang) * off, z = c.z + Math.sin(ang) * along + Math.cos(ang) * off;
      huts.push({ x, z, sx: (11 + rnd() * 8) / 1110 * BX * 0.7, sz: (8 + rnd() * 5) / 1110 * BX * 0.7, h: (5 + rnd() * 3) / 1110 * BX, ry: ang + (rnd() < 0.5 ? 0 : 1.57), w: rnd() < 0.6 });
    }
  });
}
const hutMesh = new THREE.InstancedMesh(hutGeo, hutMat, huts.length);
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const cw = new THREE.Color('#cdc4b0'), cd = new THREE.Color('#7c6852');
  huts.forEach((h, i) => { v.set(h.x, heightAt(h.x, h.z) - 0.001, h.z); q.setFromAxisAngle(up, h.ry); s.set(h.sx, h.h, h.sz); m4.compose(v, q, s); hutMesh.setMatrixAt(i, m4); hutMesh.setColorAt(i, h.w ? cw : cd); });
  scene.add(hutMesh);
}

// ---------- cidade: quarteirões alinhados ao rio, fábricas, elevador e chaminés ----------
const bldGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const bldMat = SG.snowify(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }), { ns: 40 });
const cityBase = [], chimneys = [];
{
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const FACT = [[48.795, 0.08, 1.15, 0.0085], [48.776, 0.08, 0.95, 0.0068], [48.759, 0.08, 0.92, 0.0068], [48.735, 1.55, 2.3, 0.0035]];
  const inFact = (lat, km) => FACT.find(f => Math.abs(lat - f[0]) < f[3] && km > f[1] - 0.05 && km < f[2] + 0.05);
  const U = m => m / 1110;
  const place = (lat, km, sx, sz, h, kind, jit) => {
    const ll = cityLL(lat, km), p = P(ll.lo, ll.la), r = riverXZ(p.z);
    cityBase.push({ x: p.x, z: p.z, sx: U(sx) * 2.2, sz: U(sz) * 2.2, h: U(h) * BX * 1.6, ry: Math.atan2(r.nx, r.nz) + (jit || 0), r: rnd(), kind });
  };
  for (let lat = 48.548; lat < 48.866; lat += 0.0017) {
    const wmax = lat > 48.69 ? 4.3 : 2.7;
    for (let km = 0.14; km < wmax; km += 0.19) {
      const L = lat + (rnd() - 0.5) * 0.0003, K = km + (rnd() - 0.5) * 0.03;
      if (inFact(L, K)) continue;
      if (ravineDist(L, K).d < 0.13) continue;
      if (Math.hypot((L - 48.742) * 111, K - 1.1) < 0.42) continue;
      const e = K / wmax; if (rnd() < e * e * 0.8) continue;
      const center = L > 48.695 && L < 48.735 && K < 1.7;
      const nb = center ? 2 : 3 + (rnd() * 3 | 0), jit = (rnd() - 0.5) * 0.06;
      for (let b = 0; b < nb; b++) {
        const dl = (rnd() - 0.5) * 0.0011, dk = (rnd() - 0.5) * 0.12;
        if (center) place(L + dl, K + dk, 40 + rnd() * 35, 14 + rnd() * 9, 14 + rnd() * 10, 's', jit);
        else if (K < 1.9 && rnd() < 0.35) place(L + dl, K + dk, 20 + rnd() * 16, 10 + rnd() * 5, 8 + rnd() * 4, 's', jit);
        else place(L + dl, K + dk, 9 + rnd() * 6, 7 + rnd() * 4, 5 + rnd() * 1.5, 'w', jit + (rnd() < 0.5 ? 0 : 1.57));
      }
    }
  }
  FACT.forEach(([lat, k0, k1, hl], fi) => {
    for (let L = lat - hl; L < lat + hl; L += 0.00105) for (let K = k0; K < k1; K += 0.13) {
      if (rnd() < 0.22) continue;
      place(L + (rnd() - 0.5) * 0.0002, K, 60 + rnd() * 70, 32 + rnd() * 26, 13 + rnd() * 8, 'f', 0);
    }
    const nc = fi < 3 ? 6 + (rnd() * 4 | 0) : 3;
    for (let q = 0; q < nc; q++) { const ll = cityLL(lat + (rnd() - 0.5) * hl * 1.4, k0 + rnd() * (k1 - k0)), p = P(ll.lo, ll.la); chimneys.push({ x: p.x, z: p.z, h: U(55 + rnd() * 30) * BX * 1.6, r: U(3.5) * BX * 1.2 }); }
  });
  place(48.692, 0.75, 34, 120, 52, 'e', 0); // elevador de grãos
  place(48.717, 0.55, 54, 16, 16, 's', 0);  // Casa de Pavlov
}
const cityMesh = new THREE.InstancedMesh(bldGeo, bldMat, cityBase.length);
const chimMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8, 1, 1, 8).translate(0, 0.5, 0), SG.snowify(new THREE.MeshStandardMaterial({ color: 0x6d625a, roughness: 0.9 }), { ns: 40 }), Math.max(1, chimneys.length));
scene.add(cityMesh, chimMesh);
const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
chimneys.forEach((c, i) => { v3.set(c.x, heightAt(c.x, c.z), c.z); s3.set(c.r, c.h, c.r); mtx.compose(v3, q4.identity(), s3); chimMesh.setMatrixAt(i, mtx); });
const BCOL = { s: new THREE.Color('#a69d8e'), w: new THREE.Color('#8d7a62'), f: new THREE.Color('#857d74'), e: new THREE.Color('#b3ab9c') }, BURNT = new THREE.Color('#47413b'), tmpC = new THREE.Color();
let lastDmg = -1;
function setDamage(dmg) {
  if (Math.abs(dmg - lastDmg) < 0.02) return; lastDmg = dmg;
  cityBase.forEach((b, i) => {
    const min = b.kind === 'f' || b.kind === 'e' ? 0.45 : 0.1;
    const f = Math.max(min, 1 - dmg * (0.5 + b.r * 0.5));
    const hh = b.h * f; v3.set(b.x, heightAt(b.x, b.z) - 0.002, b.z); q4.setFromAxisAngle(yAxis, b.ry); s3.set(b.sx, hh, b.sz);
    mtx.compose(v3, q4, s3); cityMesh.setMatrixAt(i, mtx);
    tmpC.copy(BCOL[b.kind]).lerp(BURNT, clamp(dmg * (0.3 + b.r * 0.7), 0, 0.85)); cityMesh.setColorAt(i, tmpC);
  });
  cityMesh.instanceMatrix.needsUpdate = true; if (cityMesh.instanceColor) cityMesh.instanceColor.needsUpdate = true;
}

// ---------- rótulos HTML ----------
const LBL = $('labels'), labels = [];
function addLabel(text, pos, cls, data) {
  const el = document.createElement('div'); el.className = 'lbl ' + cls; el.textContent = text; LBL.appendChild(el);
  const o = { el, pos, cls, data, vis: true }; labels.push(o); return o;
}
const townDots = [];
SG.TOWNS.forEach(([n, lo, la, tier]) => {
  const p = G(lo, la, 0.2);
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(tier > 2 ? 0.9 : 0.45, tier > 2 ? 0.9 : 0.45, 0.5, 10), new THREE.MeshBasicMaterial({ color: 0xece6d6 }));
  dot.position.copy(p); scene.add(dot); townDots.push(dot);
  addLabel(n, p.clone().add(new THREE.Vector3(0, 1.0, 0)), 'town t' + tier);
});
SG.LAKES.forEach(([lo, la, , , , , n]) => { if (n) addLabel(n, G(lo, la, 0.4), 'lake'); });
SG.LANDMARKS.forEach(([n, lo, la]) => addLabel(n, G(lo, la, 1.5), 'mark'));
C.MARKS.forEach(([n, lat, km]) => {
  const p = CG(lat, km, 0.05);
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 6), new THREE.MeshBasicMaterial({ color: 0xc9a35a }));
  pin.position.copy(p).add(new THREE.Vector3(0, 0.45, 0)); pin.rotation.x = Math.PI; scene.add(pin);
  addLabel(n, p.clone().add(new THREE.Vector3(0, 0.65, 0)), 'mark');
});
{
  const mat = new THREE.LineBasicMaterial({ color: 0x2a2017, transparent: true, opacity: 0.6 });
  C.RAVINES.forEach(([n, lat, len]) => {
    const pts = []; for (let k = 0; k <= 24; k++) { const km = k / 24 * len; pts.push(CG(lat + Math.sin(k * 0.75) * 0.0012 + km * 0.0015, km, 0.03)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    addLabel('ravina ' + n, CG(lat + len * 0.0009, len * 0.6, 0.3), 'ravine');
  });
}
SG.RIVERS.forEach(r => { const m = r.pts[Math.floor(r.pts.length * (r.name === 'Volga' ? 0.4 : 0.45))]; addLabel(r.name, G(m[0], m[1], 0.5), 'river'); });
// ---------- símbolos ----------
function symbolTex(u) {
  const c = document.createElement('canvas'); c.width = 192; c.height = 152; const g = c.getContext('2d');
  const x0 = 24, y0 = 36, w = 144, h = 96;
  g.fillStyle = '#eae6da'; g.font = '700 24px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'center';
  g.fillText(u.ech, 96, 27);
  g.fillStyle = SG.NAT[u.nat].color; g.fillRect(x0, y0, w, h);
  g.strokeStyle = '#11171c'; g.lineWidth = 7; g.strokeRect(x0, y0, w, h);
  g.lineWidth = 6; g.beginPath();
  if (u.type === 'inf' || u.type === 'mech') { g.moveTo(x0, y0); g.lineTo(x0 + w, y0 + h); g.moveTo(x0 + w, y0); g.lineTo(x0, y0 + h); }
  if (u.type === 'arm' || u.type === 'mech') { g.moveTo(x0 + w / 2 + 46, y0 + h / 2); g.ellipse(x0 + w / 2, y0 + h / 2, 46, 26, 0, 0, Math.PI * 2); }
  if (u.type === 'air') { g.moveTo(x0 + w / 2, y0 + h / 2); g.ellipse(x0 + w / 2 - 24, y0 + h / 2, 24, 14, 0, 0, Math.PI * 2); g.moveTo(x0 + w / 2 + 48, y0 + h / 2); g.ellipse(x0 + w / 2 + 24, y0 + h / 2, 24, 14, 0, 0, Math.PI * 2); }
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function hqTex(side) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160; const g = c.getContext('2d');
  g.strokeStyle = '#eae6da'; g.lineWidth = 7; g.beginPath(); g.moveTo(22, 156); g.lineTo(22, 8); g.stroke();
  g.fillStyle = side === 'su' ? '#d24b3f' : '#7d9cc0'; g.beginPath(); g.moveTo(26, 10); g.lineTo(122, 10); g.lineTo(104, 40); g.lineTo(122, 70); g.lineTo(26, 70); g.closePath(); g.fill();
  g.strokeStyle = '#11171c'; g.lineWidth = 4; g.stroke();
  if (side === 'su') {
    g.fillStyle = '#f2d36b'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 22; g.lineTo(64 + Math.cos(a) * r, 40 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  } else {
    g.fillStyle = '#11171c'; g.fillRect(46, 34, 36, 12); g.fillRect(58, 22, 12, 36);
    g.strokeStyle = '#eae6da'; g.lineWidth = 3; g.strokeRect(46, 34, 36, 12); g.strokeRect(58, 22, 12, 36);
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

// ---------- unidades ----------
const pickables = [];
const DIVS = C.DIVS.map(u => ({ ...u, div: true, path: u.path.map(([d, lat, km]) => { const ll = cityLL(lat, km); return [d, ll.lo, ll.la]; }) }));
const units = SG.UNITS.concat(DIVS).map(u => {
  const path = u.path.map(([d, lo, la]) => ({ t: day(d), lo, la }));
  const start = u.start ? day(u.start) : path[0].t, end = day(u.end || SG.END);
  const model = SG.makeModel(u.type, SG.NAT[u.nat].color, u.side);
  model.userData.pick = { kind: 'unit', id: u.id }; scene.add(model); pickables.push(model);
  const lbl = addLabel(u.short, new THREE.Vector3(), 'unit ' + u.side);
  return { u, path, start, end, model, symImg: symbolTex(u).image, lbl, pos: new THREE.Vector3(), head: 0, on: false, phase: Math.random() * 6.28 };
});
function unitLL(un, t) {
  const p = un.path; if (t <= p[0].t) return p[0]; if (t >= p[p.length - 1].t) return p[p.length - 1];
  for (let i = 1; i < p.length; i++) if (t <= p[i].t) { const a = p[i - 1], b = p[i], f = (t - a.t) / (b.t - a.t || 1); return { lo: a.lo + (b.lo - a.lo) * f, la: a.la + (b.la - a.la) * f }; }
}

// ---------- QGs ----------
const hqs = SG.HQS.map(h => {
  const spr = SG.makeModel('hq', h.side === 'su' ? '#d24b3f' : '#7d9cc0', h.side);
  spr.userData.pick = { kind: 'hq', id: h.id }; scene.add(spr); pickables.push(spr);
  const stays = h.stays.map(s => ({ ...s, a: day(s.from), b: day(s.to) + 0.999 }));
  const lbl = addLabel('QG ' + h.who.split(' ').slice(-1)[0], new THREE.Vector3(), 'hq ' + h.side);
  return { h, spr, stays, lbl, cur: null };
});

// ---------- setas de operações ----------
const events = SG.EVENTS.map(e => ({ ...e, title: e.t, t: day(e.d) }));
const arrowMats = { su: new THREE.MeshBasicMaterial({ color: 0xe0574a, transparent: true, opacity: 0.92, depthTest: false }), ax: new THREE.MeshBasicMaterial({ color: 0x8fb0d6, transparent: true, opacity: 0.92, depthTest: false }) };
const arrows = [];
events.forEach(e => (e.arrows || []).forEach(a => {
  const pts = a.p.map(([lo, la], i, arr) => {
    const v = a.city ? CG(lo, la, 0.5) : G(lo, la, 1.6); if (a.air) v.y += Math.sin(Math.PI * i / (arr.length - 1)) * 22; return v;
  });
  if (!a.air && pts.length > 2) pts[1].y += a.city ? 0.4 : 2.5;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const L = curve.getLength(), rad = clamp(L * 0.012, a.city ? 0.06 : 0.35, 1.3) * (a.air ? 0.55 : 1);
  const tube = new THREE.TubeGeometry(curve, 64, rad, 8, false);
  const mesh = new THREE.Mesh(tube, arrowMats[a.s]); mesh.renderOrder = 8;
  const head = new THREE.Mesh(new THREE.ConeGeometry(rad * 2.6, rad * 6, 12), arrowMats[a.s]); head.renderOrder = 8;
  const end = curve.getPoint(1), tan = curve.getTangent(1);
  head.position.copy(end); head.quaternion.setFromUnitVectors(yAxis, tan);
  const grp = new THREE.Group(); grp.add(mesh, head); grp.visible = false; scene.add(grp);
  arrows.push({ e, grp, mesh, head, curve, total: tube.index.count });
}));

// ---------- zonas do Eixo ----------
const zoneMat = new THREE.MeshBasicMaterial({ color: 0x7d9cc0, transparent: true, opacity: 0.16, depthTest: false, side: THREE.DoubleSide });
const zoneLine = new THREE.LineBasicMaterial({ color: 0xa9c2e0, transparent: true, opacity: 0.75, depthTest: false });
const zones = SG.ZONES.map(([d, polys]) => {
  const grp = new THREE.Group(); grp.visible = false;
  polys.forEach(poly => {
    const shp = new THREE.Shape(poly.map(([lo, la]) => { const p = P(lo, la); return new THREE.Vector2(p.x, -p.z); }));
    const g = new THREE.ShapeGeometry(shp); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, zoneMat); m.position.y = poly.reduce((a, [lo, la]) => a + G(lo, la).y, 0) / poly.length + 0.4; m.renderOrder = 2; grp.add(m);
    const edge = [];
    for (let i = 0; i <= poly.length; i++) {
      const a = poly[i % poly.length], b = poly[(i + 1) % poly.length];
      for (let s = 0; s < 6 && i < poly.length; s++) { const f = s / 6; edge.push(G(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.35)); }
    }
    edge.push(edge[0].clone());
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edge), zoneLine); ln.renderOrder = 3; grp.add(ln);
  });
  scene.add(grp); return { t: day(d), grp };
});

// faixa soviética na cidade (entre a linha de frente e o Volga)
const stripMat = new THREE.MeshBasicMaterial({ color: 0xd24b3f, transparent: true, opacity: 0.26, depthTest: false, side: THREE.DoubleSide });
const frontMat = new THREE.LineBasicMaterial({ color: 0xff7a6b, transparent: true, opacity: 0.95, depthTest: false });
const fronts = C.FRONT.map(([d, pts]) => {
  const grp = new THREE.Group(); grp.visible = false;
  if (pts.length) {
    const dense = [];
    for (let i = 1; i < pts.length; i++) for (let s = 0; s < 6; s++) { const f = s / 6; dense.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]); }
    dense.push(pts[pts.length - 1]);
    const west = dense.map(([lat, km]) => CG(lat, km, 0.25)), bank = dense.map(([lat]) => CG(lat, 0, 0.25)).reverse();
    const shp = new THREE.Shape(west.concat(bank).map(v => new THREE.Vector2(v.x, -v.z)));
    const g = new THREE.ShapeGeometry(shp); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, stripMat); m.position.y = west.reduce((a, v) => a + v.y, 0) / west.length + 0.1; m.renderOrder = 4; grp.add(m);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(west), frontMat); ln.renderOrder = 5; grp.add(ln);
  }
  scene.add(grp); return { t: day(d), grp };
});
const CITYC = G(44.53, 48.75, 0);
const CITY_END = day('1943-01-26');

// rota da unidade selecionada
let routeLine = null;
function showRoute(un) {
  if (routeLine) { scene.remove(routeLine); routeLine.geometry.dispose(); routeLine = null; }
  if (!un || un.path.length < 2) return;
  const pts = []; const p = un.path;
  for (let i = 1; i < p.length; i++) for (let s = 0; s <= 10; s++) { const f = s / 10; pts.push(G(p[i - 1].lo + (p[i].lo - p[i - 1].lo) * f, p[i - 1].la + (p[i].la - p[i - 1].la) * f, 0.9)); }
  routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: SG.NAT[un.u.nat].color, dashSize: 1.6, gapSize: 1, depthTest: false, transparent: true }));
  routeLine.computeLineDistances(); routeLine.renderOrder = 7; scene.add(routeLine);
}


// ---------- clima ----------
SG.wxInit(day);
const cityPts = C.MARKS.map(([, lat, km]) => CG(lat, km, 0));
for (let i = 0; i < 24; i++) cityPts.push(CG(48.56 + i * 0.013, 0.4 + (i * 0.37) % 2.4, 0));
const weather = SG.makeWeather({ scene, camera, heightAt, cityPts });
const CLEAR = { cloud: 0.08, fog: 0, snow: 0, wind: 0.15, rain: 0, haze: 0, smoke: 0 };
const knots = arr => arr.map(([d, v]) => [day(d), v]);
const interp = (ks, t) => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) { const a = ks[i - 1], b = ks[i], f = (t - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * f; } return ks[ks.length - 1][1]; };
const SNOW_K = knots([['1942-11-04', 0], ['1942-11-12', 0.3], ['1942-11-18', 0.42], ['1942-11-21', 0.85], ['1942-12-01', 0.95], ['1942-12-11', 1], ['1942-12-13', 0.72], ['1942-12-17', 0.76], ['1942-12-19', 0.95], ['1942-12-22', 0.86], ['1942-12-26', 1]]);
const AUT_K = knots([['1942-08-23', 0.05], ['1942-09-15', 0.3], ['1942-10-10', 0.75], ['1942-10-30', 1]]);
const ICE_K = knots([['1942-11-10', 0], ['1942-11-14', 0.45], ['1942-12-10', 0.62], ['1942-12-16', 0.92], ['1942-12-18', 1]]);
const LEAF_K = knots([['1942-08-23', 0], ['1942-09-20', 1], ['1942-10-08', 2], ['1942-10-24', 3], ['1942-11-04', 4]]);
const LEAF_C = ['#5d7238', '#748040', '#a3803c', '#836748', '#6a5e56'].map(c => new THREE.Color(c));
function setSeason(t) {
  const U = SG.SNOWU;
  U.uSnow.value = interp(SNOW_K, t); U.uAutumn.value = interp(AUT_K, t); U.uIce.value = interp(ICE_K, t);
  const l = interp(LEAF_K, t), i = Math.min(3, Math.floor(l)); leafMat.color.copy(LEAF_C[i]).lerp(LEAF_C[i + 1], l - i);
  waterMat.opacity = 0.9;
}
const SKY = { top: new THREE.Color('#5c7384'), hor: new THREE.Color('#bcc5c5'), topO: new THREE.Color('#6a7175'), horO: new THREE.Color('#a4a9a9'),
  topF: new THREE.Color('#a5abac'), horF: new THREE.Color('#d2d5d3'), smoke: new THREE.Color('#6f645a'), cold: new THREE.Color('#c9d6e0'), gnd: new THREE.Color('#8b8a80') };
const cT = new THREE.Color(), cH = new THREE.Color();
function applyWx(camD) {
  const w = S.filt.wx ? S.wx : CLEAR;
  const ov = Math.max(w.cloud * 0.85, w.snow, w.rain * 0.9), fg = Math.max(w.fog, w.haze * 0.55);
  cT.copy(SKY.top).lerp(SKY.topO, ov).lerp(SKY.topF, fg).lerp(SKY.smoke, w.smoke * 0.3);
  cH.copy(SKY.hor).lerp(SKY.horO, ov).lerp(SKY.horF, fg).lerp(SKY.cold, w.haze * 0.35).lerp(SKY.smoke, w.smoke * 0.18);
  skyU.top.value.copy(cT); skyU.hor.value.copy(cH); skyU.gnd.value.copy(SKY.gnd).lerp(cH, 0.5);
  scene.fog.color.copy(cH); renderer.setClearColor(cH);
  const k = Math.max(w.fog * (camD > 150 ? 0.8 : 1), w.snow * 0.42 + w.wind * 0.06, w.haze * 0.3, w.rain * 0.35);
  const nearC = camD * 1.4 + 240, farC = camD * 5 + 1300, nearF = camD * 0.15, farF = camD * 1.7 + 25;
  scene.fog.near = nearC + (nearF - nearC) * k; scene.fog.far = farC + (farF - farC) * k;
  sun.intensity = 1.0 * (1 - 0.55 * ov) * (1 - 0.35 * fg); hemi.intensity = 0.58 + 0.18 * ov + 0.1 * fg;
  sun.color.set(w.haze > 0.3 ? 0xf3f6ff : 0xfff1dc);
}

// ---------- estado ----------
const S = { t: 0, playing: false, speed: 5, sel: null, filt: { ax: true, su: true, hq: true, ar: true, lb: true, wx: true }, tab: 'op', curEvent: -1, cityView: false, wx: CLEAR, wxEntry: undefined };
const BASE_DPS = 4; // 1× = 4 dias por segundo

const PHASES = [
  ['1942-08-23', 'Aproximação'], ['1942-09-13', 'Combate urbano'], ['1942-11-19', 'Operação Urano'],
  ['1942-11-24', 'Cerco e socorro'], ['1942-12-30', 'Destruição do bolsão']
].map(([d, n]) => [day(d), n]);

function renderWxChip() {
  const w = S.wx, e = w.entry, r = w.river, chip = $('wxChip');
  if (!e && !r) { chip.hidden = true; return; }
  chip.hidden = false;
  chip.innerHTML = (e ? `<span><b>${esc(e.label)}</b>${e.temp ? ` · ${esc(e.temp)}` : ''}</span>` : '') + (r ? `<span class="riv">${esc(r.label)}</span>` : '');
  chip.title = e ? e.note + ' Fonte: ' + e.src : r.label + ': ' + r.note;
}
function renderWx() {
  const box = $('wxBox'); if (!box) return;
  const e = S.wx.entry;
  box.innerHTML = e ? `<h3>Clima do dia</h3><p><b>${esc(e.label)}</b>${e.temp ? ' · ' + esc(e.temp) : ''}. ${esc(e.note)}</p><p class="muted small">Fonte: ${esc(e.src)}</p>` : '';
}

function update() {
  const t = S.t;
  $('dateBig').textContent = dateLabel(t);
  $('phase').textContent = PHASES.filter(p => t >= p[0]).pop()[1];
  $('slider').value = t;
  $('dayCount').textContent = 'Dia ' + (Math.floor(t) + 1) + ' de ' + (NDAYS + 1);
  setSeason(t);
  S.wx = SG.wxAt(t);
  if (S.wx.entry !== S.wxEntry || S.wx.river !== S.wxRiver) { S.wxEntry = S.wx.entry; S.wxRiver = S.wx.river; renderWxChip(); renderWx(); }
  setDamage(clamp((t + 6) / 90, 0, 1));
  // zonas
  let zi = -1; zones.forEach((z, i) => { if (t >= z.t) zi = i; });
  const cityFront = S.cityView && t < CITY_END;
  zones.forEach((z, i) => z.grp.visible = i === zi && !cityFront);
  let fi = -1; fronts.forEach((f, i) => { if (t >= f.t) fi = i; });
  fronts.forEach((f, i) => f.grp.visible = S.cityView && i === fi);
  $('modeChip').hidden = !S.cityView;
  townDots.forEach(d => d.visible = MODE === 'chart' && !S.cityView);
  // unidades
  units.forEach(un => {
    const on = t >= un.start && t <= un.end + 0.999 && S.filt[un.u.side] && (!!un.u.div === S.cityView);
    un.on = on; un.model.visible = on; un.lbl.vis = on && S.filt.lb;
    if (!on) return;
    const ll = unitLL(un, t), g = G(ll.lo, ll.la, 0);
    un.pos.copy(g);
    const a = unitLL(un, t - 1.5), b = unitLL(un, t + 1.5), pa = P(a.lo, a.la), pb = P(b.lo, b.la);
    if (Math.hypot(pb.x - pa.x, pb.z - pa.z) > 1e-3) un.head = Math.atan2(-(pb.z - pa.z), pb.x - pa.x);
    else if (un.head === 0) un.head = un.u.side === 'ax' ? 0 : Math.PI;
  });
  // QGs
  hqs.forEach(q => {
    const s = q.stays.find(s => t >= s.a && t <= s.b); q.cur = s || null;
    const on = !!s && S.filt.hq; q.spr.visible = on; q.lbl.vis = on && S.filt.lb;
    if (on) q.spr.position.copy(G(s.lon, s.lat, 0));
  });
  // setas
  arrows.forEach(a => {
    const dt = t - a.e.t, on = S.filt.ar && dt >= 0 && dt <= a.e.dur;
    a.grp.visible = on; if (!on) return;
    const p = clamp(dt / Math.min(2.2, a.e.dur * 0.6), 0.02, 1);
    const seg = 8 * 6; a.mesh.geometry.setDrawRange(0, Math.floor(a.total * p / seg) * seg);
    a.head.visible = p >= 0.98;
    const fade = a.e.dur - dt < 1 ? clamp(a.e.dur - dt, 0, 1) : 1; a.mesh.material.opacity = 0.92 * fade;
  });
  // evento atual
  let ei = -1; events.forEach((e, i) => { if (t >= e.t) ei = i; });
  if (ei !== S.curEvent) { S.curEvent = ei; renderOp(); renderWx(); markTicks(); }
  if (S.tab === 'unit' && S.sel) renderSel(true);
  dirty = true;
}

// ---------- estilo do mapa e exagero vertical ----------
function setMode(m) {
  MODE = m; store('stalingrado-mode', m);
  terrainMat.map = getTex(m); terrainMat.needsUpdate = true;
  terrainMat.userData.snow.uReal.value = m === 'real' ? 1 : 0; terrainMat.userData.snow.uAmt.value = m === 'real' ? 1 : 0.4;
  [leafTrees, pineTrees, hutMesh].forEach(o => o.visible = m === 'real');
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  update();
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
  if (b.dataset.mode === MODE) return;
  $('loading').hidden = false; $('loading').textContent = b.dataset.mode === 'chart' ? 'Desenhando a carta…' : 'Pintando o terreno…';
  setTimeout(() => { setMode(b.dataset.mode); $('loading').hidden = true; }, 30);
});
document.querySelectorAll('[data-ex]').forEach(b => {
  b.setAttribute('aria-pressed', String(+b.dataset.ex === EX));
  b.onclick = () => {
    if (+b.dataset.ex === EX) return;
    store('stalingrado-ex', b.dataset.ex);
    try { sessionStorage.setItem('stalingrado-t', String(S.t)); } catch (e) {}
    $('loading').hidden = false; $('loading').textContent = 'Refazendo o relevo…';
    setTimeout(() => location.reload(), 30);
  };
});
// ---------- painel ----------
function renderOp() {
  const e = events[S.curEvent], box = $('opBody');
  if (!e) { box.innerHTML = '<p class="muted">Arraste a linha do tempo.</p><div id="wxBox"></div>'; return; }
  const next = events[S.curEvent + 1];
  box.innerHTML = `<div class="op-date">${shortDate(e.d)} ${e.d.slice(0, 4)}</div>
    <h2 class="op-title ${e.k}">${esc(e.title)}</h2><p>${esc(e.x)}</p>
    <div class="op-nav"><button class="btn ghost" id="opPrev" ${S.curEvent <= 0 ? 'disabled' : ''}>← Anterior</button>
    <button class="btn ghost" id="opFocus">Centralizar</button>
    <button class="btn ghost" id="opNext" ${next ? '' : 'disabled'}>Próxima →</button></div>
    ${next ? `<p class="muted small">A seguir: ${shortDate(next.d)} · ${esc(next.title)}</p>` : ''}<div id="wxBox"></div>`;
  $('opPrev').onclick = () => gotoEvent(S.curEvent - 1);
  $('opNext').onclick = () => gotoEvent(S.curEvent + 1);
  $('opFocus').onclick = () => focusOn(e.focus);
}
function natChip(n) { return `<span class="chip" style="--c:${SG.NAT[n].color}">${SG.NAT[n].name}</span>`; }
function renderSel(soft) {
  const box = $('unitBody'), s = S.sel;
  if (!s) { box.innerHTML = '<p class="muted">Toque em um símbolo no mapa ou escolha uma força na aba Forças.</p>'; return; }
  if (s.kind === 'unit') {
    const un = units.find(x => x.u.id === s.id), u = un.u;
    const status = S.t < un.start ? `Entra em cena em ${dateLabel(un.start)}` : S.t > un.end + 0.999 ? 'Fora de combate nesta data' : 'Em ação nesta data';
    if (soft && box.dataset.id === u.id) { const st = box.querySelector('.status'); if (st) st.textContent = status; return; }
    box.dataset.id = u.id;
    box.innerHTML = `<div class="u-head"><canvas id="uSym" width="192" height="152"></canvas><div>
      <div class="u-side ${u.side}">${u.side === 'ax' ? 'Eixo' : 'Exército Vermelho'} · ${({XXXX:'Exército',XXX:'Corpo',XX:'Divisão',X:'Brigada'})[u.ech]}</div>
      <h2 class="u-name">${esc(u.name)}</h2>${natChip(u.nat)}</div></div>
      <p class="status">${status}</p>
      <dl class="kv"><dt>Comando</dt><dd>${esc(u.cmd)}</dd><dt>Subordinado a</dt><dd>${esc(u.parent)}</dd>
      <dt>Efetivo</dt><dd>${esc(u.men)}</dd><dt>Em cena</dt><dd class="num">${dateLabel(un.start)} – ${dateLabel(un.end)}</dd></dl>
      <h3>Equipamento e composição</h3><ul class="eq">${u.eq.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p>${esc(u.notes)}</p>${u.fate ? `<p class="fate"><b>Destino:</b> ${esc(u.fate)}</p>` : ''}
      <button class="btn ghost" id="uGo">Ir até a unidade</button>`;
    const c = $('uSym').getContext('2d'); c.drawImage(un.symImg, 0, 0);
    $('uGo').onclick = () => { if (!un.on) setT(un.start); const ll = unitLL(un, S.t); focusOn([ll.lo, ll.la, u.div ? 26 : 70]); };
  } else {
    const q = hqs.find(x => x.h.id === s.id), h = q.h;
    if (soft && box.dataset.id === h.id) { box.querySelectorAll('.stay').forEach((el, i) => el.classList.toggle('now', q.stays[i] === q.cur)); return; }
    box.dataset.id = h.id;
    box.innerHTML = `<div class="u-side ${h.side}">${h.side === 'ax' ? 'Eixo' : 'Exército Vermelho'} · Quartel-general</div>
      <h2 class="u-name">${esc(h.who)}</h2><p class="muted">${esc(h.role)}</p>
      <h3>Localizações do QG</h3><ol class="stays">${q.stays.map(st => `<li class="stay ${st === q.cur ? 'now' : ''}" data-a="${st.a}">
      <span class="num">${shortDate(st.from)} – ${shortDate(st.to)}</span><span>${esc(st.place)}</span></li>`).join('')}</ol>
      ${h.note ? `<p>${esc(h.note)}</p>` : ''}<p class="muted small">Posições marcadas "aproximado" não têm localização precisa documentada.</p>`;
    box.querySelectorAll('.stay').forEach((el, i) => el.onclick = () => { setT(q.stays[i].a); focusOn([q.stays[i].lon, q.stays[i].lat, 45]); });
  }
}
function renderForces() {
  const box = $('forceBody');
  const grp = (side, title, div) => `<h3 class="${side}">${title}</h3><ul class="flist">${units.filter(x => x.u.side === side && !!x.u.div === div).map(x =>
    `<li data-id="${x.u.id}"><span class="dot" style="--c:${SG.NAT[x.u.nat].color}"></span><span>${esc(x.u.name)}<small>${esc(x.u.cmd.split('→').pop().trim())}</small></span><span class="num small">${shortDate(x.u.start || x.u.path[0][0])}</span></li>`).join('')}</ul>`;
  const hq = `<h3>Quartéis-generais</h3><ul class="flist">${hqs.map(q => `<li data-hq="${q.h.id}"><span class="dot flag" style="--c:${q.h.side === 'su' ? '#d24b3f' : '#7d9cc0'}"></span><span>${esc(q.h.who)}<small>${esc(q.h.role)}</small></span><span class="num small">${q.stays.length}×</span></li>`).join('')}</ul>`;
  box.innerHTML = grp('ax', 'Eixo · exércitos e corpos', false) + grp('su', 'URSS · exércitos e corpos', false) + hq + grp('ax', 'Na cidade · divisões alemãs', true) + grp('su', 'Na cidade · divisões soviéticas', true);
  box.querySelectorAll('li[data-id]').forEach(li => li.onclick = () => { const un = units.find(x => x.u.id === li.dataset.id); if (!un.on) setT(un.start); select({ kind: 'unit', id: un.u.id }, true); });
  box.querySelectorAll('li[data-hq]').forEach(li => li.onclick = () => { const q = hqs.find(x => x.h.id === li.dataset.hq); if (!q.cur) setT(q.stays[0].a); select({ kind: 'hq', id: q.h.id }, true); });
}
function setTab(t) {
  S.tab = t; document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  ['op', 'unit', 'force'].forEach(k => $(k + 'Body').hidden = k !== t);
  if (t === 'unit') renderSel(false);
  $('panel').classList.add('open');
}
function select(s, fly) {
  S.sel = s; setTab('unit');
  const un = s && s.kind === 'unit' ? units.find(x => x.u.id === s.id) : null;
  showRoute(un);
  if (fly && s) {
    if (un) { const ll = unitLL(un, S.t); focusOn([ll.lo, ll.la, un.u.div ? 26 : 70]); }
    else { const q = hqs.find(x => x.h.id === s.id); const st = q.cur || q.stays[0]; focusOn([st.lon, st.lat, 45]); }
  }
  dirty = true;
}

// ---------- câmera ----------
let anim = null;
function focusOn(f) {
  if (!f) return;
  const tgt = G(f[0], f[1], 0); const dir = camera.position.clone().sub(controls.target).normalize();
  anim = { t0: performance.now(), dur: 1100, fromT: controls.target.clone(), toT: tgt, fromD: camera.position.distanceTo(controls.target), toD: f[2] || 120, dir };
}
function setT(t) { S.t = clamp(t, 0, NDAYS); update(); }
function gotoEvent(i) { if (i < 0 || i >= events.length) return; setT(events[i].t + 0.001); focusOn(events[i].focus); setTab('op'); }

// ---------- linha do tempo ----------
const slider = $('slider'); slider.max = NDAYS; slider.step = 0.01;
slider.addEventListener('input', () => { S.t = +slider.value; update(); });
const ticks = $('ticks');
events.forEach((e, i) => {
  const b = document.createElement('button'); b.className = 'tick ' + e.k; b.style.left = (e.t / NDAYS * 100) + '%';
  b.title = shortDate(e.d) + ' · ' + e.title; b.setAttribute('aria-label', b.title); b.onclick = () => gotoEvent(i); ticks.appendChild(b);
});
function markTicks() { ticks.querySelectorAll('.tick').forEach((b, i) => b.classList.toggle('cur', i === S.curEvent)); }
const months = $('months');
[['1942-09-01', 'set'], ['1942-10-01', 'out'], ['1942-11-01', 'nov'], ['1942-12-01', 'dez'], ['1943-01-01', 'jan 43'], ['1943-02-01', 'fev']].forEach(([d, n]) => {
  const s = document.createElement('span'); s.style.left = (day(d) / NDAYS * 100) + '%'; s.textContent = n; months.appendChild(s);
});
const wxTicks = $('wxTicks');
SG.WX.forEach(w => {
  const b = document.createElement('button'); b.className = 'wxt' + (w.k.snow > 0.6 || w.k.fog > 0.6 ? ' big' : '');
  b.style.left = (w.a / NDAYS * 100) + '%'; b.style.width = Math.max(0.5, (w.b - w.a) / NDAYS * 100) + '%';
  b.title = shortDate(w.from) + ' · ' + w.label; b.setAttribute('aria-label', 'Clima: ' + b.title);
  b.onclick = () => { setT(w.a + 0.3); setTab('op'); }; wxTicks.appendChild(b);
});
$('play').onclick = () => { if (S.t >= NDAYS) S.t = 0; S.playing = !S.playing; $('play').classList.toggle('on', S.playing); $('play').setAttribute('aria-label', S.playing ? 'Pausar' : 'Reproduzir'); };
let speedM = 1; try { const v = parseFloat(localStorage.getItem('stalingrado-speed')); if ([0.25, 0.5, 1, 2, 4].includes(v)) speedM = v; } catch (e) {}
function renderSpeed() {
  S.speed = BASE_DPS * speedM;
  document.querySelectorAll('.speed-seg button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.m === speedM)));
  $('speedOut').textContent = S.speed + (S.speed === 1 ? ' dia/s' : ' dias/s');
}
document.querySelectorAll('.speed-seg button').forEach(b => b.onclick = () => {
  speedM = +b.dataset.m; renderSpeed();
  try { localStorage.setItem('stalingrado-speed', String(speedM)); } catch (e) {}
});
renderSpeed();
document.querySelectorAll('.tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { const k = b.dataset.f; S.filt[k] = !S.filt[k]; b.setAttribute('aria-pressed', S.filt[k]); update(); });
$('sheetToggle').onclick = () => $('panel').classList.toggle('open');
$('reset').onclick = () => focusOn([43.4, 48.95, 360]);
$('cityBtn').onclick = () => focusOn([44.535, 48.735, 16]);


// seleção por toque
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => downAt = [e.clientX, e.clientY]);
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(pickables.filter(o => o.visible), true)[0];
  if (hit) { let o = hit.object; while (o && !o.userData.pick) o = o.parent; if (o) select(o.userData.pick, false); }
});

// ---------- loop ----------
let last = performance.now();
const proj = new THREE.Vector3(), UPW = new THREE.Vector3();
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
}
window.addEventListener('resize', resize);
controls.addEventListener('change', () => dirty = true);

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S.playing) { S.t += dt * S.speed; if (S.t >= NDAYS) { S.t = NDAYS; S.playing = false; $('play').classList.remove('on'); } update(); }
  if (anim) {
    const k = clamp((now - anim.t0) / anim.dur, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    controls.target.lerpVectors(anim.fromT, anim.toT, e);
    camera.position.copy(controls.target).addScaledVector(anim.dir, anim.fromD + (anim.toD - anim.fromD) * e);
    if (k >= 1) anim = null; dirty = true;
  }
  controls.update();
  // a câmera nunca entra no chão
  { const gy = heightAt(camera.position.x, camera.position.z) + 0.25; if (camera.position.y < gy) camera.position.y = gy; }
  const camD = camera.position.distanceTo(controls.target);
  const cv = camD < 120 && controls.target.distanceTo(CITYC) < 45;
  if (cv !== S.cityView) { S.cityView = cv; update(); }
  camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  SG.SNOWU.uUpV.value.copy(UPW.set(0, 1, 0).transformDirection(camera.matrixWorldInverse));
  sky.position.copy(camera.position); sky.scale.setScalar(4000);
  applyWx(camD);
  weather.update(S.filt.wx ? S.wx : CLEAR, dt, camD, controls.target, S.filt.wx);
  // escala e posição dos modelos conforme distância
  units.forEach(un => {
    if (!un.on) return;
    const sel = S.sel && S.sel.id === un.u.id;
    const d = camera.position.distanceTo(un.pos), big = un.u.ech === 'XXXX' ? 1.2 : 1;
    const s = (un.u.div ? clamp(d * 0.03, 0.14, 3.4) : clamp(d * 0.045, 1.2, 10)) * big * (sel ? 1.3 : 1);
    const m = un.model; m.scale.setScalar(s);
    if (un.u.type === 'air') {
      const ang = now * 0.00035 + un.phase, r = s * 1.6, alt = s * 2.6 + 2;
      m.position.set(un.pos.x + Math.cos(ang) * r, un.pos.y + alt, un.pos.z - Math.sin(ang) * r);
      m.rotation.set(0.35, ang + Math.PI / 2, 0, 'YXZ');
      m.userData.prop.rotation.x = now * 0.05;
      un.lbl.pos.set(un.pos.x, un.pos.y + alt + s * 0.6, un.pos.z);
    } else {
      m.position.copy(un.pos); m.rotation.set(0, un.head, 0);
      un.lbl.pos.set(un.pos.x, un.pos.y + s * 0.75, un.pos.z);
    }
    if (m.userData.ring) m.userData.ring.material.opacity = sel ? 1 : 0.8;
  });
  hqs.forEach(q => {
    if (!q.spr.visible) return;
    const st = q.cur, base = G(st.lon, st.lat, 0), d = camera.position.distanceTo(base), s = clamp(d * 0.03, 0.4, 6.5) * (S.sel && S.sel.id === q.h.id ? 1.35 : 1);
    q.spr.scale.setScalar(s * 1.1); q.spr.position.copy(base);
    q.spr.userData.flag.rotation.y = Math.sin(now * 0.004 + base.x) * 0.25;
    q.lbl.pos.set(base.x, base.y + s * 1.15, base.z);
  });
  // rótulos
  const w = wrap.clientWidth, h = wrap.clientHeight;
  labels.forEach(l => {
    let show = l.cls === 'unit ax' || l.cls === 'unit su' || l.cls.startsWith('hq') ? l.vis : S.filt.lb;
    if (l.cls === 'mark' || l.cls === 'ravine') show = S.cityView && S.filt.lb;
    if (l.cls === 'town t1') show = S.filt.lb && camD < 260;
    if (l.cls === 'river' || l.cls === 'lake') show = S.filt.lb && camD < 420;
    if (show) {
      proj.copy(l.pos).project(camera);
      if (proj.z > 1 || proj.x < -1.1 || proj.x > 1.1 || proj.y < -1.1 || proj.y > 1.1) show = false;
      else l.el.style.transform = `translate(${((proj.x + 1) / 2 * w).toFixed(1)}px, ${((1 - proj.y) / 2 * h).toFixed(1)}px)`;
    }
    if (l.shown !== show) { l.el.hidden = !show; l.shown = show; }
  });
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- início ----------
camera.position.set(-40, 210, 260);
controls.target.copy(G(43.7, 48.9, 0));
resize(); renderForces(); renderSel(false); setTab('op');
if (window.innerWidth < 760) $('panel').classList.remove('open');
let t0 = 0; try { const v = sessionStorage.getItem('stalingrado-t'); if (v != null) { t0 = clamp(+v, 0, NDAYS); sessionStorage.removeItem('stalingrado-t'); } } catch (e) {}
setMode(MODE);
setT(t0);
$('loading').hidden = true;
requestAnimationFrame(frame);
setTimeout(() => focusOn(t0 ? [43.4, 48.95, 360] : events[0].focus), 400);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (MODE === 'chart') { texChart = null; setMode('chart'); } });
} // main

setTimeout(() => {
  try { main(); }
  catch (e) { const l = document.getElementById('loading'); if (l) { l.hidden = false; l.textContent = 'Não foi possível gerar o mapa: ' + e.message; } throw e; }
}, 40);
})();
