(function () {
'use strict';
const SG = window.SG;
let dirty = true;
const D0 = Date.UTC(1942, 7, 23);
const day = s => { const [y, m, d] = s.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - D0) / 864e5); };
const NDAYS = day(SG.END);
const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const dateLabel = i => { const dt = new Date(D0 + Math.floor(i) * 864e5); return dt.getUTCDate() + ' ' + MES[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear(); };
const shortDate = s => { const i = day(s), dt = new Date(D0 + i * 864e5); return dt.getUTCDate() + ' ' + MES[dt.getUTCMonth()]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

// ---------- projeção ----------
const LON0 = 43.2, LAT0 = 48.9, KX = 100 * Math.cos(49 * Math.PI / 180), KZ = 100;
const P = (lon, lat) => ({ x: (lon - LON0) * KX, z: -(lat - LAT0) * KZ });
const W = 440, H = 340, SX = 240, SY = 186;

// ---------- rios (amostragem densa) ----------
const RIV = SG.RIVERS.map(r => {
  const curve = new THREE.CatmullRomCurve3(r.pts.map(([lo, la]) => { const p = P(lo, la); return new THREE.Vector3(p.x, 0, p.z); }));
  const n = Math.max(60, Math.round(curve.getLength() / 1.2));
  return { r, pts: curve.getSpacedPoints(n), depth: r.w > 2 ? 3.2 : r.w > 1 ? 2.3 : 1.2, vw: r.w > 2 ? 7 : r.w > 1 ? 4.5 : 2.6 };
});

// posição urbana: latitude + km a oeste da margem do Volga
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
const C = SG.CITY;

function rawHeight(x, z) {
  let h = 2.2 + 1.3 * Math.sin(x * 0.043 + 1.3) * Math.cos(z * 0.052) + 0.7 * Math.sin(x * 0.11 + z * 0.07)
    + 0.35 * Math.sin(x * 0.23 - z * 0.19) + 0.18 * Math.sin(x * 0.53 + z * 0.41) + 0.1 * Math.cos(x * 0.9 - z * 0.7);
  for (const rv of RIV) {
    let m = 1e9;
    for (let i = 0; i < rv.pts.length; i += 1) {
      const p = rv.pts[i], dx = p.x - x, dz = p.z - z;
      if (Math.abs(dx) > 25 || Math.abs(dz) > 25) { i += 4; continue; }
      const d = dx * dx + dz * dz; if (d < m) m = d;
    }
    h -= rv.depth * Math.exp(-m / (rv.vw * rv.vw));
  }
  // planície Volga-Akhtuba a leste do rio: mais baixa
  return h;
}
const HG = new Float32Array((SX + 1) * (SY + 1));
function heightAt(x, z) {
  const gx = clamp((x + W / 2) / W * SX, 0, SX - 0.001), gz = clamp((z + H / 2) / H * SY, 0, SY - 0.001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, w = SX + 1;
  const a = HG[j * w + i], b = HG[j * w + i + 1], c = HG[(j + 1) * w + i], d = HG[(j + 1) * w + i + 1];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}
const G = (lon, lat, up = 0) => { const p = P(lon, lat); return new THREE.Vector3(p.x, heightAt(p.x, p.z) + up, p.z); };

// ---------- cena ----------
const wrap = $('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x0e1317);
wrap.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0e1317, 260, 620);
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2000);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = 1.32; controls.minDistance = 18; controls.maxDistance = 520;
controls.screenSpacePanning = false;
scene.add(new THREE.HemisphereLight(0xc4ced6, 0x2e2618, 0.62));
const sun = new THREE.DirectionalLight(0xfff1dc, 0.85); sun.position.set(-160, 140, 90); scene.add(sun);

// terreno
const tgeo = new THREE.PlaneGeometry(W, H, SX, SY); tgeo.rotateX(-Math.PI / 2);
const tpos = tgeo.attributes.position;
for (let k = 0; k < tpos.count; k++) { const h = rawHeight(tpos.getX(k), tpos.getZ(k)); HG[k] = h; tpos.setY(k, h); }
tgeo.computeVertexNormals();
const cSummer = new Float32Array(tpos.count * 3), cWinter = new Float32Array(tpos.count * 3), cCur = new Float32Array(tpos.count * 3);
{
  const s1 = new THREE.Color('#e9dcb6'), s2 = new THREE.Color('#d2bf8e'), w1 = new THREE.Color('#f7f8f6'), w2 = new THREE.Color('#dfe5e8'), tmp = new THREE.Color();
  for (let k = 0; k < tpos.count; k++) {
    const x = tpos.getX(k), z = tpos.getZ(k), h = HG[k];
    const n = 0.5 + 0.5 * Math.sin(x * 0.31 + z * 0.17) * Math.cos(z * 0.27 - x * 0.08);
    const low = clamp((2.0 - h) / 3, 0, 1);
    tmp.copy(s1).lerp(s2, clamp(n * 0.6 + low * 0.7, 0, 1)); cSummer.set([tmp.r, tmp.g, tmp.b], k * 3);
    tmp.copy(w1).lerp(w2, clamp(n * 0.35 + low * 0.8, 0, 1)); cWinter.set([tmp.r, tmp.g, tmp.b], k * 3);
  }
}
tgeo.setAttribute('color', new THREE.BufferAttribute(cCur, 3));
const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const terrain = new THREE.Mesh(tgeo, terrainMat);
const buildChart = () => { const old = terrainMat.map; terrainMat.map = SG.buildChart({ P, HG, SX, SY, W, H, cityLL, RIVERS: SG.RIVERS, anisotropy: renderer.capabilities.getMaxAnisotropy() }); terrainMat.needsUpdate = true; if (old) old.dispose(); dirty = true; };
buildChart();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildChart);
scene.add(terrain);
let lastSnow = -1;
function setSnow(s) {
  if (Math.abs(s - lastSnow) < 0.015) return; lastSnow = s;
  for (let i = 0; i < cCur.length; i++) cCur[i] = cSummer[i] + (cWinter[i] - cSummer[i]) * s;
  tgeo.attributes.color.needsUpdate = true;
}

// rios como faixas
const waterMat = new THREE.MeshBasicMaterial({ color: 0x4f80a8, side: THREE.DoubleSide, fog: true, transparent: true, opacity: 0.55 });
for (const rv of RIV) {
  const pts = rv.pts, vtx = [], idx = [], half = rv.r.w / 2;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, p = pts[i];
    const y = heightAt(p.x, p.z) + 0.22;
    vtx.push(p.x + nx * half, y, p.z + nz * half, p.x - nx * half, y, p.z - nz * half);
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vtx, 3)); g.setIndex(idx);
  scene.add(new THREE.Mesh(g, waterMat));
}


// cidade: blocos ao longo da margem oeste do Volga
const NB = 1500, cityMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x5a4f43 }), NB);
const cityBase = [];
{
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const FACT = [[48.795, 0.25, 0.9], [48.776, 0.2, 0.8], [48.759, 0.2, 0.75]]; // fábricas junto ao rio
  for (let i = 0; i < NB; i++) {
    const lat = 48.55 + rnd() * 0.30;
    const fac = FACT.find(f => Math.abs(lat - f[0]) < 0.006);
    const big = fac && rnd() < 0.55;
    const km = big ? 0.1 + rnd() * fac[2] : 0.15 + Math.pow(rnd(), 1.5) * (lat > 48.69 ? 4.2 : 2.6);
    const ll = cityLL(lat, km), p = P(ll.lo, ll.la), r = riverXZ(p.z);
    cityBase.push({ x: p.x, z: p.z, sx: big ? 0.35 + rnd() * 0.35 : 0.08 + rnd() * 0.16, sz: big ? 0.18 + rnd() * 0.2 : 0.08 + rnd() * 0.14,
      h: big ? 0.35 + rnd() * 0.3 : 0.12 + rnd() * 0.42, ry: Math.atan2(r.nx, r.nz) + (rnd() - 0.5) * 0.25, r: rnd() });
  }
  scene.add(cityMesh);
}
const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
let lastDmg = -1;
function setDamage(dmg) {
  if (Math.abs(dmg - lastDmg) < 0.02) return; lastDmg = dmg;
  cityBase.forEach((b, i) => {
    const f = Math.max(0.12, 1 - dmg * (0.55 + b.r * 0.45));
    const hh = b.h * f; v3.set(b.x, heightAt(b.x, b.z) + hh / 2, b.z); q4.setFromAxisAngle(yAxis, b.ry); s3.set(b.sx, hh, b.sz);
    mtx.compose(v3, q4, s3); cityMesh.setMatrixAt(i, mtx);
  });
  cityMesh.instanceMatrix.needsUpdate = true;
}

// ---------- rótulos HTML ----------
const LBL = $('labels'), labels = [];
function addLabel(text, pos, cls, data) {
  const el = document.createElement('div'); el.className = 'lbl ' + cls; el.textContent = text; LBL.appendChild(el);
  const o = { el, pos, cls, data, vis: true }; labels.push(o); return o;
}
const bigDots = [];
SG.TOWNS.forEach(([n, lo, la, tier]) => {
  const p = G(lo, la, 0.4);
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(tier > 2 ? 0.9 : 0.45, tier > 2 ? 0.9 : 0.45, 0.5, 10), new THREE.MeshBasicMaterial({ color: 0xece6d6 }));
  dot.position.copy(p); scene.add(dot); if (tier > 2) bigDots.push(dot);
  addLabel(n, p.clone().add(new THREE.Vector3(0, 1.2, 0)), 'town t' + tier);
});
SG.LANDMARKS.forEach(([n, lo, la]) => addLabel(n, G(lo, la, 1.5), 'mark'));
const CG = (lat, km, up = 0) => { const ll = cityLL(lat, km); return G(ll.lo, ll.la, up); };
C.MARKS.forEach(([n, lat, km]) => {
  const p = CG(lat, km, 0.05);
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xc9a35a }));
  pin.position.copy(p).add(new THREE.Vector3(0, 0.6, 0)); pin.rotation.x = Math.PI; scene.add(pin);
  addLabel(n, p.clone().add(new THREE.Vector3(0, 0.85, 0)), 'mark');
});
{
  const mat = new THREE.LineBasicMaterial({ color: 0x2a2017, transparent: true, opacity: 0.85 });
  C.RAVINES.forEach(([n, lat, len]) => {
    const pts = []; for (let k = 0; k <= 20; k++) { const km = k / 20 * len; pts.push(CG(lat + Math.sin(k * 0.9) * 0.0012 + km * 0.0015, km, 0.06)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    addLabel('ravina ' + n, CG(lat + len * 0.0009, len * 0.6, 0.3), 'ravine');
  });
}
SG.RIVERS.forEach(r => { const m = r.pts[Math.floor(r.pts.length * (r.name === 'Volga' ? 0.22 : 0.45))]; addLabel(r.name, G(m[0], m[1], 0.5), 'river'); });

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
    const m = new THREE.Mesh(g, zoneMat); m.position.y = 2.6; m.renderOrder = 2; grp.add(m);
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
    const m = new THREE.Mesh(g, stripMat); m.position.y = 1.2; m.renderOrder = 4; grp.add(m);
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

// ---------- estado ----------
const S = { t: 0, playing: false, speed: 5, sel: null, filt: { ax: true, su: true, hq: true, ar: true, lb: true }, tab: 'op', curEvent: -1, cityView: false };
const BASE_DPS = 4; // 1× = 4 dias por segundo

const PHASES = [
  ['1942-08-23', 'Aproximação'], ['1942-09-13', 'Combate urbano'], ['1942-11-19', 'Operação Urano'],
  ['1942-11-24', 'Cerco e socorro'], ['1942-12-30', 'Destruição do bolsão']
].map(([d, n]) => [day(d), n]);

function update() {
  const t = S.t;
  $('dateBig').textContent = dateLabel(t);
  $('phase').textContent = PHASES.filter(p => t >= p[0]).pop()[1];
  $('slider').value = t;
  $('dayCount').textContent = 'Dia ' + (Math.floor(t) + 1) + ' de ' + (NDAYS + 1);
  // neve e destruição
  setSnow(clamp((t - day('1942-10-28')) / 26, 0, 1));
  waterMat.color.set(t > day('1942-12-16') ? 0xe6f0f4 : t > day('1942-11-20') ? 0x9fbfd2 : 0x4f80a8); waterMat.opacity = t > day('1942-12-16') ? 0.85 : 0.55;
  setDamage(clamp((t + 6) / 90, 0, 1));
  // zonas
  let zi = -1; zones.forEach((z, i) => { if (t >= z.t) zi = i; });
  const cityFront = S.cityView && t < CITY_END;
  zones.forEach((z, i) => z.grp.visible = i === zi && !cityFront);
  let fi = -1; fronts.forEach((f, i) => { if (t >= f.t) fi = i; });
  fronts.forEach((f, i) => f.grp.visible = S.cityView && i === fi);
  $('modeChip').hidden = !S.cityView;
  bigDots.forEach(d => d.visible = !S.cityView);
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
  if (ei !== S.curEvent) { S.curEvent = ei; renderOp(); markTicks(); }
  if (S.tab === 'unit' && S.sel) renderSel(true);
  dirty = true;
}

// ---------- painel ----------
function renderOp() {
  const e = events[S.curEvent], box = $('opBody');
  if (!e) { box.innerHTML = '<p class="muted">Arraste a linha do tempo.</p>'; return; }
  const next = events[S.curEvent + 1];
  box.innerHTML = `<div class="op-date">${shortDate(e.d)} ${e.d.slice(0, 4)}</div>
    <h2 class="op-title ${e.k}">${esc(e.title)}</h2><p>${esc(e.x)}</p>
    <div class="op-nav"><button class="btn ghost" id="opPrev" ${S.curEvent <= 0 ? 'disabled' : ''}>← Anterior</button>
    <button class="btn ghost" id="opFocus">Centralizar</button>
    <button class="btn ghost" id="opNext" ${next ? '' : 'disabled'}>Próxima →</button></div>
    ${next ? `<p class="muted small">A seguir: ${shortDate(next.d)} · ${esc(next.title)}</p>` : ''}`;
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
$('reset').onclick = () => focusOn([43.6, 48.85, 330]);
$('cityBtn').onclick = () => focusOn([44.53, 48.755, 62]);

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
const proj = new THREE.Vector3();
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
  const cv = camera.position.distanceTo(controls.target) < 120 && controls.target.distanceTo(CITYC) < 45;
  if (cv !== S.cityView) { S.cityView = cv; update(); }
  // escala e posição dos sprites conforme distância
  const camD = camera.position.distanceTo(controls.target);
  units.forEach(un => {
    if (!un.on) return;
    const sel = S.sel && S.sel.id === un.u.id;
    const d = camera.position.distanceTo(un.pos), big = un.u.ech === 'XXXX' ? 1.2 : 1;
    const s = (un.u.div ? clamp(d * 0.03, 0.5, 3.4) : clamp(d * 0.045, 1.9, 10)) * big * (sel ? 1.3 : 1);
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
    dirty = true;
  });
  hqs.forEach(q => {
    if (!q.spr.visible) return;
    const st = q.cur, base = G(st.lon, st.lat, 0), d = camera.position.distanceTo(base), s = clamp(d * 0.03, 0.55, 6.5) * (S.sel && S.sel.id === q.h.id ? 1.35 : 1);
    q.spr.scale.setScalar(s * 1.1); q.spr.position.copy(base);
    q.spr.userData.flag.rotation.y = Math.sin(now * 0.004 + base.x) * 0.25;
    q.lbl.pos.set(base.x, base.y + s * 1.15, base.z);
  });
  // rótulos
  const w = wrap.clientWidth, h = wrap.clientHeight;
  labels.forEach(l => {
    let show = l.cls === 'unit ax' || l.cls === 'unit su' || l.cls.startsWith('hq') ? l.vis : true;
    if (l.cls === 'mark' || l.cls === 'ravine') show = S.cityView && S.filt.lb;
    if (l.cls === 'town t1') show = camD < 230;
    if (l.cls === 'river') show = camD < 380;
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
setT(0);
requestAnimationFrame(frame);
setTimeout(() => focusOn(events[0].focus), 400);
})();
