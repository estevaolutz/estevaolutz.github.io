// Clima documentado nas fontes e efeitos visuais: nuvens, neve caindo, chuva, neblina e fumaça.
(function () {
'use strict';
const SG = window.SG;

// k: intensidades 0–1. clears: a neblina se dissipa entre essas frações do dia.
SG.WX = [
  { from: '1942-08-23', to: '1942-08-26', k: { smoke: 1, cloud: 0.12 }, label: 'Cidade em chamas', temp: 'calor de fim de verão',
    note: 'O bombardeio de 23 ago incendeia Stalingrado. Os incêndios e os tanques de petróleo em chamas cobrem a cidade de fumaça por dias.',
    src: 'Relatos do bombardeio de 23 ago 1942' },
  { from: '1942-11-19', to: '1942-11-19', k: { fog: 1, snow: 0.55, cloud: 0.9, wind: 0.35 }, clears: [0.42, 0.62], label: 'Neblina espessa e neve',
    note: 'Urano começa sob neblina e neve: a artilharia atira sem poder corrigir a pontaria, os tanques avançam por bússola e a Luftwaffe fica no chão até a neblina se dissipar.',
    src: 'Wikipedia, "Operation Uranus"; Warfare History Network' },
  { from: '1942-11-20', to: '1942-11-21', k: { snow: 0.95, wind: 0.9, cloud: 1, fog: 0.35 }, label: 'Nevasca',
    note: 'A nevasca piora: castiga as tripulações dos tanques soviéticos e desorganiza a coordenação do XLVIII Corpo Panzer.',
    src: 'Wikipedia, "Operation Uranus"' },
  { from: '1942-11-22', to: '1942-11-23', k: { snow: 0.45, wind: 0.4, cloud: 0.85 }, label: 'Neve e geada',
    note: 'Colunas alemãs recuam para o bolsão sob neve e geada; no Don, soldados que tentam cruzar o gelo ainda fino caem na água.',
    src: 'Wikipedia, "Operation Uranus"; Warfare History Network' },
  { from: '1942-12-12', to: '1942-12-12', k: { cloud: 0.8, fog: 0.3 }, label: 'Degelo',
    note: 'No dia em que começa Tempestade de Inverno, Hitler comenta que o gelo está derretendo e teme que o Volga vire rota de abastecimento soviética.',
    src: 'Conferência de Hitler de 12 dez, citada por Topwar' },
  { from: '1942-12-16', to: '1942-12-16', k: { fog: 1, cloud: 0.8 }, clears: [0.45, 0.58], label: 'Neblina espessa',
    note: 'Pequeno Saturno abre com a preparação de artilharia dentro da neblina, atirando por quadrículas. Os aviões só decolam ao meio-dia, quando ela se dissipa. As tropas cruzam o Don sobre o gelo.',
    src: 'Topwar, "Operação Pequeno Saturno"' },
  { from: '1942-12-17', to: '1942-12-19', k: { snow: 0.85, wind: 0.8, cloud: 1, fog: 0.3 }, label: 'Nevasca',
    note: 'Uma nevasca que se forma ao longo de vários dias deixa a infantaria de Hoth sem condições de atacar no Myshkova.',
    src: 'Wikipedia, "Operation Winter Storm"' },
  { from: '1942-12-20', to: '1942-12-22', k: { rain: 0.45, cloud: 0.95, fog: 0.3 }, label: 'Chuva e lama',
    note: 'Há relatos de combate no Myshkova sob chuva e lama. As fontes divergem sobre o tempo nesses dias.',
    src: 'Warfare History Network' },
  { from: '1942-12-25', to: '1942-12-25', k: { snow: 0.35, wind: 0.45, cloud: 0.75, haze: 0.3 }, label: 'Rajadas de neve', temp: '≈ −25 °C',
    note: 'Natal no bolsão: rajadas de neve e frio de cerca de −25 °C.',
    src: 'Warfare History Network' },
  { from: '1943-01-03', to: '1943-01-07', k: { haze: 0.55, cloud: 0.2 }, label: 'Frio extremo', temp: 'até −35 °C',
    note: 'Após o fracasso do socorro, a temperatura chega a −35 °C (data aproximada: início de janeiro). Os aviões da ponte aérea ficam dias no chão.',
    src: 'Warfare History Network; WarHistory.org' },
  { from: '1943-01-16', to: '1943-01-16', k: { haze: 0.65, cloud: 0.05 }, label: 'O dia mais frio', temp: '−33,7 °C · sensação −44,5 °C',
    note: 'Provavelmente o dia mais frio da batalha, sob alta pressão (1046 hPa): céu limpo e ar enevoado de cristais de gelo.',
    src: 'Análise meteorológica, divulgameteo.es' }
];
SG.WX_RIVER = [
  { from: '1942-11-12', to: '1942-12-15', label: 'Placas de gelo no Volga', note: 'barcos e rebocadores mal conseguem cruzar' },
  { from: '1942-12-16', to: '1943-02-02', label: 'Volga congelado', note: 'travessias a pé e de caminhão sobre o gelo' }
];

const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

SG.wxInit = function (day) {
  SG.WX.forEach(w => { w.a = day(w.from); w.b = day(w.to) + 1; });
  SG.WX_RIVER.forEach(w => { w.a = day(w.from); w.b = day(w.to) + 1; });
  const cityFrom = day('1942-08-23'), cityTo = day('1943-02-02'), winter = day('1942-11-01');
  SG.wxAt = function (t) {
    const s = { cloud: t >= winter ? 0.3 : 0.08, fog: 0, snow: 0, wind: 0.15, rain: 0, haze: 0, smoke: t >= cityFrom && t <= cityTo ? 0.3 : 0, entry: null, river: null };
    const frac = t - Math.floor(t);
    for (const w of SG.WX) {
      if (t < w.a - 0.3 || t > w.b + 0.3) continue;
      const e = sstep(w.a - 0.3, w.a + 0.08, t) * sstep(w.b + 0.3, w.b - 0.08, t);
      for (const k in w.k) {
        let v = w.k[k] * e;
        if (k === 'fog' && w.clears && t >= w.a) v *= 1 - sstep(w.clears[0], w.clears[1], frac) * (t < w.b ? 1 : 0);
        if (v > s[k]) s[k] = v;
      }
      if (t >= w.a && t < w.b) s.entry = w;
    }
    for (const r of SG.WX_RIVER) if (t >= r.a && t < r.b) s.river = r;
    return s;
  };
};

// ---------- efeitos ----------
function puffTex(dark) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  let seed = dark ? 5 : 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const x = 128 + (rnd() - 0.5) * 120, y = 128 + (rnd() - 0.5) * 70, r = 30 + rnd() * 50;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${0.22 + rnd() * 0.18})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); return t;
}
function dotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
}

SG.makeWeather = function (o) {
  const { scene, camera, heightAt, cityPts } = o;
  let seed = 19; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const grp = new THREE.Group(); scene.add(grp);
  const ptex = puffTex();
  // nuvens
  const clouds = [];
  for (let i = 0; i < 150; i++) {
    const m = new THREE.SpriteMaterial({ map: ptex, transparent: true, depthWrite: false, opacity: 0, fog: false });
    const s = new THREE.Sprite(m); s.renderOrder = 20; grp.add(s);
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    clouds.push({ s, m, rx: Math.cos(a) * r, rz: Math.sin(a) * r, ry: rnd(), sc: 0.6 + rnd() * 0.9, rank: rnd(), sp: 0.6 + rnd() * 0.8 });
  }
  // bancos de neblina rente ao chão
  const banks = [];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.SpriteMaterial({ map: ptex, transparent: true, depthWrite: false, opacity: 0, fog: false, color: 0xe2e5e4 });
    const s = new THREE.Sprite(m); s.renderOrder = 19; grp.add(s);
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    banks.push({ s, m, rx: Math.cos(a) * r, rz: Math.sin(a) * r, sc: 0.7 + rnd() * 0.8, rank: rnd() });
  }
  // fumaça sobre a cidade
  const smoke = [];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.SpriteMaterial({ map: ptex, transparent: true, depthWrite: false, opacity: 0, color: 0x3c3631 });
    const s = new THREE.Sprite(m); s.renderOrder = 18; grp.add(s);
    const p = cityPts[Math.floor(rnd() * cityPts.length)];
    smoke.push({ s, m, base: p, ph: rnd(), sp: 0.05 + rnd() * 0.06, rank: rnd(), jx: (rnd() - 0.5) * 0.6, jz: (rnd() - 0.5) * 0.6 });
  }
  // neve / chuva
  const NP = 9000, pos = new Float32Array(NP * 3), loc = new Float32Array(NP * 3);
  for (let i = 0; i < NP * 3; i++) loc[i] = rnd() * 2 - 1;
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pmat = new THREE.PointsMaterial({ map: dotTex(), size: 1, transparent: true, depthWrite: false, opacity: 0.9, sizeAttenuation: true, color: 0xffffff, fog: false });
  const pts = new THREE.Points(pgeo, pmat); pts.frustumCulled = false; pts.renderOrder = 21; grp.add(pts);

  let clock = 0, windOff = 0;
  return {
    group: grp,
    update(w, dt, camD, target, on) {
      grp.visible = on; if (!on) return;
      clock += dt; windOff += dt * (0.4 + w.wind * 3);
      const camY = camera.position.y;
      // nuvens
      const R = Math.min(900, Math.max(40, camD * 1.5)), layer = Math.min(42, Math.max(target.y + 2, camY * 0.62));
      const storm = Math.max(w.snow, w.rain, w.wind * 0.7), shade = 0.98 - storm * 0.38 - w.smoke * 0.15;
      clouds.forEach(c => {
        const vis = c.rank < w.cloud;
        if (!vis) { c.s.visible = false; return; }
        let x = c.rx + windOff * 0.004 * c.sp; x = ((x + 1) % 2 + 2) % 2 - 1;
        const px = target.x + x * R, pz = target.z + c.rz * R, py = layer + c.ry * R * 0.05;
        c.s.position.set(px, py, pz);
        const sc = R * 0.3 * c.sc; c.s.scale.set(sc * 1.6, sc * 0.8, 1);
        const dc = camera.position.distanceTo(c.s.position), near = Math.min(1, Math.max(0, (dc - sc * 0.4) / (sc * 0.8)));
        c.m.opacity = (0.22 + 0.33 * w.cloud) * near; c.m.color.setScalar(shade); c.s.visible = true;
      });
      // neblina rente ao chão
      const fogAmt = Math.max(w.fog, w.haze * 0.5);
      const RB = Math.max(10, camD * 0.95);
      banks.forEach(b => {
        if (b.rank > fogAmt) { b.s.visible = false; return; }
        const px = target.x + b.rx * RB, pz = target.z + b.rz * RB, sc = RB * 0.42 * b.sc;
        b.s.position.set(px, heightAt(px, pz) + sc * 0.12, pz); b.s.scale.set(sc * 1.8, sc * 0.55, 1);
        const dc = camera.position.distanceTo(b.s.position), near = Math.min(1, Math.max(0, (dc - sc * 0.3) / (sc * 0.6)));
        b.m.opacity = 0.5 * fogAmt * near; b.s.visible = true;
      });
      // fumaça
      smoke.forEach(p => {
        if (p.rank > w.smoke) { p.s.visible = false; return; }
        const life = (p.ph + clock * p.sp) % 1;
        p.s.position.set(p.base.x + p.jx + life * (1.5 + w.wind * 4), p.base.y + 0.3 + life * 7, p.base.z + p.jz);
        const sc = 0.8 + life * 6; p.s.scale.set(sc, sc * 0.8, 1);
        p.m.opacity = Math.sin(life * Math.PI) * 0.5; p.s.visible = true;
      });
      // precipitação
      const prec = Math.max(w.snow, w.rain);
      if (prec < 0.02) { pts.visible = false; return; }
      pts.visible = true;
      const rain = w.rain > w.snow, Rh = Math.min(240, Math.max(4, camD * 0.6)), Ry = Rh * 0.75;
      const cnt = Math.floor(NP * Math.min(1, prec * 1.1)); pgeo.setDrawRange(0, cnt);
      pmat.size = Rh * (rain ? 0.003 : 0.0055) * (1 + w.wind * 0.3); pmat.color.set(rain ? 0xa9bccb : 0xffffff); pmat.opacity = rain ? 0.6 : 0.92;
      const fall = (rain ? 1.9 : 0.22 + w.wind * 0.25) * dt, drift = (rain ? 0.2 : 0.15 + w.wind * 1.1) * dt;
      const cy = target.y + Ry * 0.55;
      for (let i = 0; i < cnt; i++) {
        const k = i * 3;
        let y = loc[k + 1] - fall * (0.8 + (i % 7) * 0.06); if (y < -1) y += 2; loc[k + 1] = y;
        let x = loc[k] + drift + Math.sin(clock * 1.3 + i) * 0.0015 * (1 + w.wind * 2); if (x > 1) x -= 2; loc[k] = x;
        pos[k] = target.x + x * Rh; pos[k + 1] = cy + y * Ry; pos[k + 2] = target.z + loc[k + 2] * Rh;
      }
      pgeo.attributes.position.needsUpdate = true;
    }
  };
};
})();
