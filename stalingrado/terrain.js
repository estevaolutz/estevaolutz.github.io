// Relevo geográfico, vegetação, textura realista e neve em shader.
// Alturas em metros sobre o nível do mar; o app converte para unidades com o exagero vertical escolhido.
(function () {
'use strict';
const SG = window.SG;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- ruído ----------
function hash2(ix, iz) { let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * ux) * (1 - uz) + (c + (d - c) * ux) * uz;
}
function fbm(x, z, o) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
SG.noise = { hash2, vnoise, fbm, sstep, clamp };

// ---------- geografia física ----------
// Rios: nível da água (m) no início e no fim do traçado, meia-largura do leito plano e largura das encostas
// (lei de Baer: margem direita alta e íngreme, esquerda baixa e larga), e quanto de mata ciliar têm.
SG.RIVER_P = {
  Volga:      { lv: [16, -22], floor: 2.4, wr: 3.0, wl: 6, forest: 0.6 },
  Don:        { lv: [95, 0],   floor: 1.5, wr: 2.6, wl: 11, forest: 0.65 },
  Chir:       { lv: [78, 34],  floor: 0.6, wr: 2.0, wl: 6,  forest: 0.35 },
  Myshkova:   { lv: [64, 36],  floor: 0.4, wr: 1.6, wl: 4.5, forest: 0.25 },
  Aksai:      { lv: [60, 37],  floor: 0.4, wr: 1.6, wl: 4.5, forest: 0.25 },
  Khopyor:    { lv: [118, 46], floor: 1.1, wr: 2.4, wl: 9,  forest: 1 },
  Medveditsa: { lv: [124, 45], floor: 1.0, wr: 2.4, wl: 8,  forest: 0.85 },
  Donets:     { lv: [66, 3],   floor: 1.0, wr: 2.4, wl: 8,  forest: 0.6 },
  Akhtuba:    { lv: [-12, -24], floor: 0.3, wr: 0.7, wl: 0.7, forest: 0.6 }
};
SG.RELIEF = {
  ridges: [ // pontos lon/lat, altura somada (m), largura (unidades ≈ 1,1 km)
    { name: 'Planalto do Volga', pts: [[46.3, 51.95], [45.85, 51.35], [45.35, 50.65], [44.95, 50.05], [44.72, 49.5]], h: 115, w: 30 },
    { name: 'Cordilheira do Don', pts: [[43.65, 49.75], [43.95, 49.35], [44.15, 49.0], [44.25, 48.78]], h: 55, w: 22 },
    { name: 'Colinas de Ergeni', pts: [[44.35, 48.42], [44.28, 48.1], [44.2, 47.6], [44.1, 47.0], [44.0, 46.3]], h: 100, w: 16 },
    { name: 'Depressão do Manych', pts: [[40.9, 47.05], [41.8, 46.72], [42.7, 46.38], [43.5, 46.12], [44.6, 45.9]], h: -75, w: 16 }
  ],
  blobs: [ // lon, lat, raio x, raio z (unidades), altura (m)
    [39.25, 48.22, 75, 28, 170], // Cordilheira do Donets (até ~367 m)
    [40.7, 50.45, 70, 55, 85],   // Planalto de Kalach (Voronezh)
    [40.3, 47.4, 40, 26, -70],   // baixada do Don inferior
    [41.2, 46.3, 60, 25, 45]     // rebordo do planalto de Stavropol
  ]
};
// matas nomeadas e areais com pinhais
SG.FORESTS = [ // lon, lat, rx, rz, força, pinheiro (0–1)
  [39.55, 51.85, 18, 10, 1, 0.6], // Usman
  [40.25, 51.1, 14, 8, 1, 1],     // pinhal de Khrenovoye
  [40.3, 50.6, 10, 8, 0.95, 0],   // floresta de Shipov
  [42.0, 51.3, 12, 8, 0.95, 0],   // Tellerman
  [43.25, 49.5, 24, 9, 0.75, 1],  // areais de Archeda e do Don
  [42.85, 49.5, 14, 7, 0.65, 1],  // margem esquerda junto a Serafimovich
  [42.25, 47.85, 20, 10, 0.5, 1]  // areais de Tsimla
];
SG.SANDS = [[43.25, 49.5, 22, 9, 0.8], [42.85, 49.5, 14, 7, 0.6], [42.25, 47.85, 20, 10, 0.6], [46.2, 46.4, 55, 22, 0.7], [45.6, 46.6, 30, 12, 0.5]];
SG.LAKES = [ // lon, lat, rx, rz, rotação, tipo, nome
  [46.65, 49.13, 8, 6, 0.2, 'salt', 'Lago Elton'],
  [46.88, 48.2, 4.5, 3.5, 0.4, 'salt', 'Baskunchak'],
  [43.0, 46.36, 44, 2.6, 0.5, 'water', 'Manych-Gudilo'],
  [44.85, 48.0, 3, 1.4, 0.6, 'water', 'Sarpa'], [44.72, 47.9, 2.6, 1.2, 0.3, 'water', ''], [44.78, 47.98, 2, 1, 0.9, 'water', '']
];

function polyXY(pts, P) { return pts.map(([lo, la]) => { const p = P(lo, la); return [p.x, p.z]; }); }
function distPoly(x, z, xy) {
  let m = 1e18;
  for (let i = 1; i < xy.length; i++) {
    const ax = xy[i - 1][0], az = xy[i - 1][1], bx = xy[i][0], bz = xy[i][1], dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1), ex = ax + dx * t - x, ez = az + dz * t - z, d = ex * ex + ez * ez;
    if (d < m) m = d;
  }
  return Math.sqrt(m);
}
function lonAtLat(pts, lat) { // pts com latitude decrescente
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if ((a[1] - lat) * (b[1] - lat) <= 0) return a[0] + (b[0] - a[0]) * (lat - a[1]) / ((b[1] - a[1]) || 1); }
  return lat > pts[0][1] ? pts[0][0] : pts[pts.length - 1][0];
}

// ---------- relevo real ----------
// d: { h: Float32Array (m), w: Uint8Array (água 0/255), W, H, lon:[a,b], lat:[a,b] }
SG.demSampler = function (d) {
  const { W, H } = d, lo0 = d.lon[0], lo1 = d.lon[1], la0 = d.lat[0], la1 = d.lat[1];
  const pos = (lon, lat) => [clamp((lon - lo0) / (lo1 - lo0) * W - 0.5, 0, W - 1.001), clamp((la1 - lat) / (la1 - la0) * H - 0.5, 0, H - 1.001)];
  const bil = (A, lon, lat) => { const [fx, fy] = pos(lon, lat), i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, c = j * W + i;
    return (A[c] * (1 - u) + A[c + 1] * u) * (1 - v) + (A[c + W] * (1 - u) + A[c + W + 1] * u) * v; };
  return {
    d, inside: (lon, lat, m = 0) => lon > lo0 + m && lon < lo1 - m && lat > la0 + m && lat < la1 - m,
    edge: (lon, lat, m) => Math.min(sstep(lo0, lo0 + m, lon), sstep(lo1, lo1 - m, lon), sstep(la0, la0 + m, lat), sstep(la1, la1 - m, lat)),
    h: (lon, lat) => bil(d.h, lon, lat), w: (lon, lat) => bil(d.w, lon, lat) / 255,
    px: (lon, lat) => { const [fx, fy] = pos(lon, lat); return Math.round(fy) * W + Math.round(fx); }
  };
};

// ---------- campo de alturas, água e vegetação a partir do relevo real ----------
// o: { W, H, N, P, LON0, LAT0, KX, KZ, region (demSampler) }
SG.buildField = function (o) {
  const { W, H, P, LON0, LAT0, KX, KZ } = o, R = o.region, NX = o.N, NZ = o.N, n = NX * NZ, cx = W / NX, cz = H / NZ;
  const ccx = i => -W / 2 + (i + 0.5) * cx, ccz = j => -H / 2 + (j + 0.5) * cz;
  const HM = new Float32Array(n), WAT = new Uint8Array(n);
  for (let j = 0; j < NZ; j++) { const lat = LAT0 - ccz(j) / KZ; for (let i = 0; i < NX; i++) { const lon = ccx(i) / KX + LON0, c = j * NX + i; HM[c] = R.h(lon, lat); WAT[c] = R.w(lon, lat) > 0.45 ? 1 : 0; } }
  // distância até a água mais próxima (duas passadas, propagando o pixel de água)
  const seed = new Int32Array(n).fill(-1), dist = new Float32Array(n).fill(1e9);
  for (let c = 0; c < n; c++) if (WAT[c]) { seed[c] = c; dist[c] = 0; }
  const relax = (c, nb, x, z) => { const s = seed[nb]; if (s < 0) return; const si = s % NX, sj = (s / NX) | 0, d = Math.hypot(x - ccx(si), z - ccz(sj)); if (d < dist[c]) { dist[c] = d; seed[c] = s; } };
  for (let j = 0; j < NZ; j++) { const z = ccz(j); for (let i = 0; i < NX; i++) { const c = j * NX + i, x = ccx(i);
    if (i > 0) relax(c, c - 1, x, z); if (j > 0) { relax(c, c - NX, x, z); if (i > 0) relax(c, c - NX - 1, x, z); if (i < NX - 1) relax(c, c - NX + 1, x, z); } } }
  for (let j = NZ - 1; j >= 0; j--) { const z = ccz(j); for (let i = NX - 1; i >= 0; i--) { const c = j * NX + i, x = ccx(i);
    if (i < NX - 1) relax(c, c + 1, x, z); if (j < NZ - 1) { relax(c, c + NX, x, z); if (i < NX - 1) relax(c, c + NX + 1, x, z); if (i > 0) relax(c, c + NX - 1, x, z); } } }
  // declividade, concavidade e sombreamento
  const SL = new Float32Array(n), SH = new Float32Array(n), BK = new Float32Array(n), EXS = 34 / 1110, L = [-0.53, 0.71, -0.46];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const c = j * NX + i, a = HM[j * NX + Math.max(0, i - 1)], b = HM[j * NX + Math.min(NX - 1, i + 1)], u = HM[Math.max(0, j - 1) * NX + i], d = HM[Math.min(NZ - 1, j + 1) * NX + i];
    const gx = (b - a) / (2 * cx), gz = (d - u) / (2 * cz); SL[c] = Math.hypot(gx, gz);
    const nx = -gx * EXS, nz = -gz * EXS, nl = Math.hypot(nx, 1, nz);
    SH[c] = Math.max(0, (nx * L[0] + L[1] + nz * L[2]) / nl) / 0.71;
    BK[c] = clamp(((a + b + u + d) / 4 - HM[c]) / 5, 0, 1) * sstep(6, 30, SL[c]);   // fundo de ravina
  }
  const forests = SG.FORESTS.map(([lo, la, rx, rz, f, pine]) => { const p = P(lo, la); return { x: p.x, z: p.z, rx, rz, f, pine }; });
  const sands = SG.SANDS.map(([lo, la, rx, rz, f]) => { const p = P(lo, la); return { x: p.x, z: p.z, rx, rz, f }; });
  const FF = new Float32Array(n), PINE = new Uint8Array(n), SAND = new Float32Array(n), ARID = new Float32Array(n), FLD = new Uint8Array(n);
  for (let j = 0; j < NZ; j++) {
    const z = ccz(j), lat = LAT0 - z / KZ;
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i, x = ccx(i), lon = x / KX + LON0, h = HM[c], d = dist[c], lev = seed[c] >= 0 ? HM[seed[c]] : -50, rel = h - lev;
      let f = 0, pine = 0, fld = 0;
      if (WAT[c]) fld = 2;
      else if (d < 8 && rel < 7) fld = 1;                        // várzea baixa junto à água
      if (!WAT[c] && d < 3.2 && rel < 16) f = (0.5 + 0.45 * sstep(47.5, 51, lat)) * (1 - sstep(1.2, 3.2, d));
      if (fld === 1) f = Math.max(f, 0.55);
      for (const b of forests) { const dx = (x - b.x) / b.rx, dz = (z - b.z) / b.rz, e = Math.exp(-(dx * dx + dz * dz) * 1.4) * b.f; if (e > f) f = e; if (b.pine && e > 0.3) pine = 1; }
      f = Math.max(f, BK[c] * 1.5 * sstep(48.6, 50.6, lat));    // bosques nas ravinas (bairaki)
      const low = sstep(30, 5, h) * sstep(44.4, 44.7, lon);
      const arid = clamp(clamp((lon - 43.6) * 0.45 + (48.6 - lat) * 0.55, 0, 1) * (1 - 0.3 * sstep(48.5, 49.5, lat)) + low * 0.35, 0, 1);
      f *= sstep(0.3, 0.62, fbm(x * 0.22 + 11, z * 0.22 - 5, 3)) * 1.35 * (0.6 + 0.55 * sstep(47.5, 51.2, lat)) * (1 - arid * 0.65);
      if (WAT[c]) f = 0;
      let sd = 0; for (const b of sands) { const dx = (x - b.x) / b.rx, dz = (z - b.z) / b.rz; sd = Math.max(sd, b.f * Math.exp(-(dx * dx + dz * dz) * 1.3)); }
      FF[c] = clamp(f, 0, 1); PINE[c] = pine; SAND[c] = sd * (0.6 + 0.6 * vnoise(x * 0.3, z * 0.3)); ARID[c] = arid; FLD[c] = fld;
    }
  }
  const bil = (A, x, z) => {
    const fx = clamp((x + W / 2) / cx - 0.5, 0, NX - 1.001), fz = clamp((z + H / 2) / cz - 0.5, 0, NZ - 1.001), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, c = j * NX + i;
    return (A[c] * (1 - u) + A[c + 1] * u) * (1 - v) + (A[c + NX] * (1 - u) + A[c + NX + 1] * u) * v;
  };
  const cellAt = (x, z) => clamp(Math.floor((z + H / 2) / cz), 0, NZ - 1) * NX + clamp(Math.floor((x + W / 2) / cx), 0, NX - 1);
  return { NX, NZ, W, H, cx, cz, HM, WAT, BK, FF, PINE, SAND, ARID, FLD, SL, SH, seed, dist, bil, cellAt, heightM: (x, z) => bil(HM, x, z) };
};

// ---------- textura realista (verão de 1942; canal alfa = quanto é capim, para o outono) ----------
// overlay: canvas TS×TS (linha 0 = sul) com cidade, vilas, ferrovias e lagos
SG.paintRealistic = function (F, o) {
  const TS = o.size, { W, H, LON0, LAT0, KX, KZ } = o, data = new Uint8Array(TS * TS * 4);
  const ov = o.overlay.getContext('2d').getImageData(0, 0, TS, TS).data;
  const C = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const steppeA = C('#b9a46c'), steppeB = C('#968e5c'), arid = C('#b3a88c'), north = C('#8f9459'), meadow = C('#71844c'),
    decid = C('#4c5b34'), pineC = C('#38492f'), sand = C('#cdb88e'), loess = C('#a88f69'), water = C('#2f4f5c'), shore = C('#a99e7c');
  const FIELD = [C('#c8b583'), C('#7e6a52'), C('#6c6c3f'), C('#ad975d'), C('#b8a877')];
  const a1 = 0.33, ca = Math.cos(a1), sa = Math.sin(a1), a2 = -0.22, cb = Math.cos(a2), sb = Math.sin(a2);
  const mix = (o, c, t) => { o[0] += (c[0] - o[0]) * t; o[1] += (c[1] - o[1]) * t; o[2] += (c[2] - o[2]) * t; };
  const col = [0, 0, 0];
  for (let py = 0; py < TS; py++) {
    const z = H / 2 - (py + 0.5) * H / TS, lat = LAT0 - z / KZ;
    for (let px = 0; px < TS; px++) {
      const x = -W / 2 + (px + 0.5) * W / TS, lon = x / KX + LON0, k = (py * TS + px) * 4, cell = F.cellAt(x, z);
      const ar = F.bil(F.ARID, x, z), ff = F.bil(F.FF, x, z), sd = F.bil(F.SAND, x, z), bk = F.bil(F.BK, x, z);
      // sombreamento e declividade na resolução da textura, direto do relevo real
      const e = 0.0025, h0 = o.heightAt(lon, lat), hx = o.heightAt(lon + e / KX * 100, lat), hz = o.heightAt(lon, lat - e);
      const gx = (hx - h0) / (e * 100), gz = (hz - h0) / (e * 100), sl = Math.hypot(gx, gz);
      const nxs = -gx * 0.0306, nzs = -gz * 0.0306, nls = Math.hypot(nxs, 1, nzs);
      const sh = Math.max(0, (nxs * -0.53 + 0.71 + nzs * -0.46) / nls) / 0.71;
      const n1 = vnoise(x * 0.09, z * 0.09), n2 = vnoise(x * 0.9 + 3, z * 0.9);
      col[0] = steppeA[0]; col[1] = steppeA[1]; col[2] = steppeA[2];
      mix(col, steppeB, n1 * 0.8);
      mix(col, north, sstep(49.6, 51.6, lat) * 0.7 * (1 - ar));
      mix(col, arid, ar);
      let grass = 1;
      // lavouras coletivas em talhões
      const fld = F.FLD[cell] === 2 ? 0 : F.FLD[cell];
      const fp = (1 - ar) * 0.5 * (0.4 + 0.9 * vnoise(x * 0.025 + 40, z * 0.025)) * (1 - ff * 1.6) * (sl < 22 ? 1 : 0.25) * (fld ? 0.15 : 1) * sstep(46.7, 47.3, lat);
      if (fp > 0.02) {
        const west = lon < 41.2, u = west ? x * cb + z * sb : x * ca + z * sa, v = west ? -x * sb + z * cb : -x * sa + z * ca;
        const fw = 2.4 * (0.7 + 0.6 * hash2(Math.floor(u / 14), Math.floor(v / 14))), cu = Math.floor(u / fw), cv = Math.floor(v / 1.5 + (cu & 1) * 0.5);
        if (hash2(cu, cv) < fp) {
          const t = hash2(cu * 7 + 3, cv * 5 + 1), fc = FIELD[t < 0.36 ? 0 : t < 0.58 ? 1 : t < 0.74 ? 2 : t < 0.9 ? 3 : 4];
          const eu = u / fw - cu, ev = v / 1.5 + (cu & 1) * 0.5 - cv;
          mix(col, fc, 0.42 + 0.25 * hash2(cu + 9, cv - 4));
          if (eu < 0.03 || eu > 0.97 || ev < 0.04 || ev > 0.96) { col[0] *= 0.9; col[1] *= 0.9; col[2] *= 0.88; }
        }
      }
      if (fld === 1) mix(col, meadow, 0.7);
      mix(col, loess, clamp(bk * 2.2 + sstep(30, 70, sl) * 0.5, 0, 0.75));
      if (sd > 0.05) { mix(col, sand, clamp(sd, 0, 0.85)); grass *= 1 - sd * 0.8; }
      if (ff > 0.04) { mix(col, F.PINE[cell] ? pineC : decid, clamp(ff * 1.1, 0, 0.92)); grass *= 1 - clamp(ff * 1.2, 0, 1); }
      // água (do relevo real)
      const wa = o.waterAt(lon, lat);
      if (wa > 0.05) { mix(col, shore, clamp(wa * 2, 0, 0.6)); }
      if (wa > 0.4) { mix(col, water, sstep(0.4, 0.7, wa)); grass = 0; }
      // sobreposição vetorial
      const oa = ov[k + 3] / 255;
      if (oa > 0) { col[0] += (ov[k] / 255 - col[0]) * oa; col[1] += (ov[k + 1] / 255 - col[1]) * oa; col[2] += (ov[k + 2] / 255 - col[2]) * oa; grass *= 1 - oa; }
      const shade = clamp(0.6 + 0.44 * sh, 0.35, 1.18) * (0.94 + 0.12 * n2);
      data[k] = clamp(col[0] * shade * 255, 0, 255); data[k + 1] = clamp(col[1] * shade * 255, 0, 255); data[k + 2] = clamp(col[2] * shade * 255, 0, 255);
      data[k + 3] = clamp(grass, 0, 1) * 255;
    }
  }
  const t = new THREE.DataTexture(data, TS, TS, THREE.RGBAFormat);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = o.anisotropy || 8; t.needsUpdate = true;
  return t;
};

// ---------- árvores ----------
// devolve listas {x, z, s, pine} distribuídas pela densidade de mata, mais densas na área da batalha
SG.placeTrees = function (F, o) {
  const { budget, P, focus, skip } = o, out = [];
  const fx = P(focus[0], focus[1]);
  const w = c => { const j = Math.floor(c / F.NX), i = c - j * F.NX, x = -F.W / 2 + (i + 0.5) * F.cx, z = -F.H / 2 + (j + 0.5) * F.cz; return 0.25 + 2.2 * Math.exp(-(((x - fx.x) / 150) ** 2 + ((z - fx.z) / 110) ** 2)); };
  let S = 0; for (let c = 0; c < F.FF.length; c += 1) if (F.FF[c] > 0.18) S += F.FF[c] * w(c);
  const k = budget / (S || 1);
  for (let c = 0; c < F.FF.length && out.length < budget; c++) {
    const f = F.FF[c]; if (f <= 0.18) continue;
    let cnt = f * w(c) * k; const base = Math.floor(cnt); cnt = base + (hash2(c, 91) < cnt - base ? 1 : 0);
    const j = Math.floor(c / F.NX), i = c - j * F.NX;
    for (let q = 0; q < cnt; q++) {
      const x = -F.W / 2 + (i + hash2(c, q * 2 + 1)) * F.cx, z = -F.H / 2 + (j + hash2(c, q * 2 + 2)) * F.cz;
      if (skip && skip(x, z)) continue;
      out.push({ x, z, s: 0.75 + hash2(c, q + 77) * 0.6, pine: F.PINE[c] ? hash2(c, q + 5) < 0.85 : hash2(c, q + 5) < 0.06, r: hash2(c, q + 13) });
    }
  }
  return out;
};

// ---------- neve, outono e gelo em shader ----------
SG.SNOWU = { uSnow: { value: 0 }, uAutumn: { value: 0 }, uIce: { value: 0 }, uUpV: { value: new THREE.Vector3(0, 1, 0) }, uSnowCol: { value: new THREE.Color(0.9, 0.93, 0.96) } };
const NOISE = `
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x), f.y); }
`;
const VERT = (vs) => 'varying vec3 vWp;\n' + vs.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  vec4 wpp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  wpp = instanceMatrix * wpp;
  #endif
  vWp = (modelMatrix * wpp).xyz;`);
SG.snowify = function (mat, o) {
  o = o || {};
  const own = { uAmt: { value: o.amt == null ? 1 : o.amt }, uReal: { value: o.real ? 1 : 0 }, uNs: { value: o.ns || 1 } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, SG.SNOWU, own);
    sh.vertexShader = VERT(sh.vertexShader);
    sh.fragmentShader = 'varying vec3 vWp;\nuniform float uSnow, uAutumn, uAmt, uReal, uNs;\nuniform vec3 uUpV, uSnowCol;\n' + NOISE + sh.fragmentShader
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 texelColor = texture2D( map, vUv );
  texelColor = mapTexelToLinear( texelColor );
  vec3 tcol = texelColor.rgb;
  float grassA = texelColor.a * uReal;
  tcol = mix(tcol, tcol * vec3(0.8, 0.72, 0.66) + vec3(0.016, 0.01, 0.006), uAutumn * grassA);
  diffuseColor.rgb *= tcol;
#endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  float upd = dot(normal, normalize(uUpV));
  vec2 sp = vWp.xz * uNs;
  float nn = vn2(sp * 0.8) * 0.55 + vn2(sp * 3.1) * 0.3 + vn2(sp * 11.0) * 0.15;
  float flatv = smoothstep(0.3, 0.78, upd);
  float cover = uSnow * 1.3 - 0.3 + (nn - 0.5) * 0.55;
  float sm = smoothstep(0.0, 0.3, cover) * flatv * uAmt;
  diffuseColor.rgb = mix(diffuseColor.rgb, uSnowCol, clamp(sm, 0.0, 1.0));
}`);
  };
  mat.userData.snow = own; mat.needsUpdate = true; return mat;
};
SG.iceify = function (mat) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, SG.SNOWU);
    sh.vertexShader = VERT(sh.vertexShader);
    sh.fragmentShader = 'varying vec3 vWp;\nuniform float uIce;\n' + NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{
  float n1 = vn2(vWp.xz * 1.7) * 0.65 + vn2(vWp.xz * 7.0) * 0.35;
  float ice = smoothstep(1.0 - uIce, 1.06 - uIce, n1);
  if (uIce > 0.97) ice = 0.92 + 0.08 * n1;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.89, 0.93), ice);
  diffuseColor.a = mix(diffuseColor.a, 1.0, ice);
}`);
  };
  mat.needsUpdate = true; return mat;
};
})();
