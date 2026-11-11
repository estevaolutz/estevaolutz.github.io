// Gera a textura "carta de estado-maior" desenhada sobre o terreno.
// Recebe funções do app: P(lon,lat)->{x,z}, grid de alturas, dimensões e cityLL.
SG.RAILWAYS = [
  // Stalingrado – Kalach – Chir – Morozovsk – Tatsinskaya – Likhaya
  [[44.50,48.70],[44.38,48.67],[44.15,48.66],[43.95,48.66],[43.72,48.65],[43.55,48.64],[43.25,48.47],[43.1,48.39],[42.6,48.37],[41.83,48.35],[41.27,48.20],[40.6,48.17],[40.0,48.15]],
  // Stalingrado – Abganerovo – Kotelnikovo – Salsk
  [[44.47,48.64],[44.38,48.48],[44.24,48.30],[44.12,48.14],[43.75,47.92],[43.14,47.63],[42.6,47.42],[42.1,47.30]],
  // Stalingrado – Gumrak – Kotluban – Frolovo – Povorino
  [[44.52,48.74],[44.37,48.79],[44.30,48.92],[44.25,49.05],[44.05,49.38],[43.65,49.77],[43.35,50.15],[43.1,50.5]],
  // Millerovo – Likhaya
  [[40.40,48.92],[40.25,48.55],[40.0,48.15]],
  // margem leste: Akhtuba – Baskunchak (abastecimento soviético)
  [[44.78,48.72],[45.05,48.55],[45.45,48.30],[46.0,48.05],[46.5,47.95]]
];
SG.AKHTUBA = [[44.78,48.80],[44.95,48.62],[45.2,48.42],[45.6,48.15],[46.0,47.9],[46.4,47.7]];

SG.buildChart = function (o) {
  const { P, HG, SX, SY, W, H, cityLL, RIVERS } = o;
  const CW = 2048, CH = Math.round(CW * H / W);
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  const X = x => (x + W / 2) / W * CW, Z = z => (z + H / 2) / H * CH;
  const pt = (lo, la) => { const p = P(lo, la); return [X(p.x), Z(p.z)]; };
  const path = (pts, close) => { g.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = pt(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); if (close) g.closePath(); };
  const smooth = pts => { // Catmull-Rom simples em lon/lat
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let t = 0; t < 1; t += 0.125) {
        const t2 = t * t, t3 = t2 * t, f = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1]); return out;
  };

  // papel
  g.fillStyle = '#efe6cd'; g.fillRect(0, 0, CW, CH);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(120,96,60,0.05)' : 'rgba(255,255,255,0.08)'; g.fillRect(rnd() * CW, rnd() * CH, 1 + rnd() * 2, 1 + rnd() * 2); }

  // várzea Volga–Akhtuba (verde claro com tracejado de mata)
  const volga = RIVERS[0].pts.filter(p => p[1] < 48.85);
  const ak = SG.AKHTUBA;
  const plain = smooth(volga).concat(smooth(ak.slice().reverse()));
  path(plain, true); g.fillStyle = 'rgba(122,150,96,0.22)'; g.fill();
  g.save(); path(plain, true); g.clip();
  g.strokeStyle = 'rgba(78,108,62,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 1600; i++) { const x = rnd() * CW, y = rnd() * CH; g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.stroke(); }
  g.restore();

  // matas ribeirinhas ao longo do Don e do Chir
  g.strokeStyle = 'rgba(78,108,62,0.5)'; g.lineWidth = 1;
  [RIVERS[1].pts, RIVERS[2].pts].forEach(r => smooth(r).forEach(([lo, la], i) => {
    if (i % 2) return; const [x, y] = pt(lo, la);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 26, 2.4, 0, Math.PI * 2); g.stroke(); }
  }));

  // curvas de nível (marching squares sobre a grade de alturas)
  const w = SX + 1, cx = CW / SX, cz = CH / SY;
  let mn = 1e9, mx = -1e9; for (const h of HG) { if (h < mn) mn = h; if (h > mx) mx = h; }
  const step = 0.42;
  for (let L = Math.ceil(mn / step) * step, n = 0; L < mx; L += step, n++) {
    const index = Math.round(L / step) % 5 === 0;
    g.strokeStyle = index ? 'rgba(140,92,48,0.75)' : 'rgba(150,104,60,0.42)'; g.lineWidth = index ? 1.6 : 0.9;
    g.beginPath();
    for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) {
      const a = HG[j * w + i], b = HG[j * w + i + 1], d = HG[(j + 1) * w + i], e = HG[(j + 1) * w + i + 1];
      const p = [];
      if ((a - L) * (b - L) < 0) p.push([i + (L - a) / (b - a), j]);
      if ((b - L) * (e - L) < 0) p.push([i + 1, j + (L - b) / (e - b)]);
      if ((d - L) * (e - L) < 0) p.push([i + (L - d) / (e - d), j + 1]);
      if ((a - L) * (d - L) < 0) p.push([i, j + (L - a) / (d - a)]);
      for (let k = 0; k + 1 < p.length; k += 2) { g.moveTo(p[k][0] * cx, p[k][1] * cz); g.lineTo(p[k + 1][0] * cx, p[k + 1][1] * cz); }
    }
    g.stroke();
  }

  // graticulado 30′ com rótulos
  g.strokeStyle = 'rgba(60,50,40,0.32)'; g.lineWidth = 1; g.setLineDash([10, 6]);
  for (let lo = 40; lo <= 46.5; lo += 0.5) { path([[lo, 47.2], [lo, 50.6]]); g.stroke(); }
  for (let la = 47.5; la <= 50.5; la += 0.5) { path([[39.9, la], [46.5, la]]); g.stroke(); }
  g.setLineDash([]);
  g.fillStyle = 'rgba(60,50,40,0.6)'; g.font = '600 15px "IBM Plex Mono", monospace';
  const dm = v => Math.floor(v) + '\u00b0' + (v % 1 ? '30\u2032' : '00\u2032');
  for (let lo = 40.5; lo <= 46; lo += 0.5) for (const la of [50.5, 49.0, 47.5]) { const [x, y] = pt(lo, la); g.fillText(dm(lo) + ' E', x + 4, y - 5); }
  for (let la = 47.5; la <= 50.5; la += 0.5) for (const lo of [40.0, 43.0, 46.0]) { const [x, y] = pt(lo, la); g.fillText(dm(la) + ' N', x + 4, y + 17); }

  // rios
  RIVERS.concat([{ name: 'Akhtuba', w: 0.7, pts: ak }]).forEach(r => {
    const s = smooth(r.pts);
    path(s); g.strokeStyle = '#3f6f97'; g.lineWidth = Math.max(2, r.w * 5.2); g.lineJoin = g.lineCap = 'round'; g.stroke();
    if (r.w > 1) { path(s); g.strokeStyle = '#8fb6d2'; g.lineWidth = r.w * 2.6; g.stroke(); }
  });

  // área urbana de Stalingrado (hachura densa)
  const north = [], south = [];
  for (let la = 48.865; la >= 48.55; la -= 0.005) { const a = cityLL(la, la > 48.69 ? 4.3 : 2.7), b = cityLL(la, 0); north.push([a.lo, a.la]); south.unshift([b.lo, b.la]); }
  const urb = north.concat(south);
  path(urb, true); g.fillStyle = 'rgba(70,58,48,0.22)'; g.fill();
  g.save(); path(urb, true); g.clip(); g.strokeStyle = 'rgba(50,40,32,0.5)'; g.lineWidth = 1;
  for (let k = -CH; k < CW; k += 5) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + CH, CH); g.stroke(); }
  g.restore();
  path(urb, true); g.strokeStyle = 'rgba(40,32,26,0.8)'; g.lineWidth = 1.5; g.stroke();

  // ferrovias: traço preto com intervalos brancos
  SG.RAILWAYS.forEach(r => {
    const s = smooth(r);
    path(s); g.strokeStyle = '#1e1a16'; g.lineWidth = 5; g.lineCap = 'butt'; g.stroke();
    path(s); g.strokeStyle = '#f3ecd8'; g.lineWidth = 2.4; g.setLineDash([12, 12]); g.stroke(); g.setLineDash([]);
  });

  // vilarejos (pontos pretos com nome no estilo das cartas)
  SG.TOWNS.forEach(([n, lo, la, tier]) => {
    const [x, y] = pt(lo, la), r = tier > 2 ? 0 : tier > 1 ? 6 : 4;
    if (!r) return;
    g.fillStyle = '#1e1a16'; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.strokeStyle = '#efe6cd'; g.lineWidth = 1; g.strokeRect(x - r, y - r, r * 2, r * 2);
  });

  // nomes dos rios em itálico
  g.fillStyle = '#2f5d84'; g.font = 'italic 600 30px "IBM Plex Sans", sans-serif';
  [['VOLGA', 45.1, 49.65, -1.1], ['VOLGA', 45.35, 48.08, -0.55], ['DON', 41.6, 49.7, -0.1], ['DON', 42.7, 48.08, 0.55], ['Chir', 41.95, 48.92, 0.55], ['Akhtuba', 45.55, 48.28, -0.55], ['Myshkova', 43.95, 48.12, 0.1]]
    .forEach(([n, lo, la, rot]) => { const [x, y] = pt(lo, la); g.save(); g.translate(x, y); g.rotate(rot); g.fillText(n, 0, 0); g.restore(); });

  // escala gráfica
  { const [x0, y0] = pt(40.15, 47.38), px = CW / W * (50 / 1.11);
    g.fillStyle = '#1e1a16'; for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#efe6cd' : '#1e1a16'; g.fillRect(x0 + i * px / 5, y0, px / 5, 8); }
    g.strokeStyle = '#1e1a16'; g.strokeRect(x0, y0, px, 8); g.fillStyle = '#1e1a16'; g.font = '600 15px "IBM Plex Mono", monospace';
    g.fillText('0', x0 - 4, y0 - 6); g.fillText('50 km', x0 + px - 20, y0 - 6); }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = o.anisotropy || 8; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};
