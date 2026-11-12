// Modelos 3D das forças, fiéis ao equipamento de cada exército em 1942.
// Todos apontam para +X, base em y=0, comprimento ~1. O anel no chão mantém a cor da nação para leitura de longe.
(function () {
  const cache = {};
  const geo = (k, f) => cache[k] || (cache[k] = f());
  const mats = {};
  // materiais foscos; no inverno ganham neve nas superfícies de cima (mesmo shader do terreno)
  const mat = (hex, o) => {
    o = o || {}; const k = hex + JSON.stringify(o);
    if (mats[k]) return mats[k];
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: o.rough == null ? 0.82 : o.rough, metalness: o.metal || 0, flatShading: !!o.flat, side: o.side || THREE.FrontSide });
    if (o.snow !== false && SG.snowify) SG.snowify(m, { ns: 22, amt: o.snow == null ? 0.65 : o.snow });
    return (mats[k] = m);
  };
  const basic = (hex, o) => { const k = 'b' + hex + JSON.stringify(o || {}); return mats[k] || (mats[k] = new THREE.MeshBasicMaterial(Object.assign({ color: hex }, o))); };
  const box = (w, h, d) => geo('b' + w + '_' + h + '_' + d, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (rt, rb, h, n) => geo('c' + rt + '_' + rb + '_' + h + '_' + n, () => new THREE.CylinderGeometry(rt, rb, h, n || 12));
  const sph = (r, ws, hs, ts, tl) => geo('s' + r + ws + hs + ts + tl, () => new THREE.SphereGeometry(r, ws || 12, hs || 8, 0, Math.PI * 2, ts || 0, tl || Math.PI));
  const add = (par, g, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); if (rx) o.rotation.x = rx; if (ry) o.rotation.y = ry; if (rz) o.rotation.z = rz; par.add(o); return o; };
  // prisma a partir de um perfil lateral (x,y), extrudado na largura z — para cascos inclinados
  const prism = (key, pts, width) => geo('p' + key, () => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false }); g.translate(0, 0, -width / 2); return g;
  });

  // ---------- insígnias ----------
  function starTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#c8261d'; g.strokeStyle = '#f2e9d8'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 29; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke(); return new THREE.CanvasTexture(c);
  }
  function crossTex() { // cruz de identificação dos blindados alemães (Balkenkreuz)
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#f4f1e8'; g.fillRect(14, 4, 36, 56); g.fillRect(4, 14, 56, 36);
    g.fillStyle = '#111'; g.fillRect(24, 8, 16, 48); g.fillRect(8, 24, 48, 16); return new THREE.CanvasTexture(c);
  }
  const decal = (k, f) => mats['d' + k] || (mats['d' + k] = new THREE.MeshBasicMaterial({ map: f(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const plane = (w, h) => geo('pl' + w + h, () => new THREE.PlaneGeometry(w, h));

  // ---------- rodagem de lagartas ----------
  function running(g, len, z, nWheels, wr, colDark, track, opts) {
    opts = opts || {};
    add(g, box(len, 0.035, 0.13), track, 0, 0.018, z);                       // lagarta no chão
    add(g, box(len * 0.92, 0.03, 0.13), track, 0, wr * 2 + 0.01, z);         // lagarta de cima
    const front = add(g, cyl(wr * 0.8, wr * 0.8, 0.13, 10), track, len / 2 - wr * 0.6, wr * 1.3, z, Math.PI / 2);
    const back = add(g, cyl(wr * 0.8, wr * 0.8, 0.13, 10), track, -len / 2 + wr * 0.6, wr * 1.3, z, Math.PI / 2);
    const span = len - wr * 3.2;
    for (let i = 0; i < nWheels; i++) {
      const x = -span / 2 + span * i / (nWheels - 1);
      add(g, cyl(wr, wr, 0.14, 12), colDark, x, wr + 0.01, z, Math.PI / 2);
      add(g, cyl(wr * 0.45, wr * 0.45, 0.145, 8), track, x, wr + 0.01, z, Math.PI / 2);
    }
    if (opts.returnRollers) for (let i = 0; i < opts.returnRollers; i++) add(g, cyl(0.022, 0.022, 0.1, 6), track, -len * 0.3 + len * 0.6 * i / (opts.returnRollers - 1), wr * 2 + 0.005, z, Math.PI / 2);
  }

  // ---------- Panzer IV (Ausf. F2/G, cano longo de 75 mm) ----------
  function panzerIV() {
    const g = new THREE.Group(), body = mat('#50565a'), dark = mat('#2c2f31'), track = mat('#2a2622', { snow: 0.3 }), tool = mat('#5b4a35');
    running(g, 0.98, 0.25, 8, 0.045, dark, track, { returnRollers: 4 });
    running(g, 0.98, -0.25, 8, 0.045, dark, track, { returnRollers: 4 });
    add(g, box(0.92, 0.13, 0.38), body, -0.01, 0.17, 0);                            // casco inferior
    add(g, box(1.0, 0.025, 0.66), body, -0.01, 0.235, 0);                           // para-lamas
    add(g, box(0.62, 0.12, 0.6), body, -0.07, 0.305, 0);                            // superestrutura
    add(g, box(0.1, 0.12, 0.6), body, 0.27, 0.305, 0);                              // placa frontal da superestrutura
    add(g, prism('pzglacis', [[0, 0], [0.13, 0], [0.13, 0.06], [0, 0.12]], 0.58), body, 0.32, 0.245, 0);
    add(g, box(0.05, 0.035, 0.08), dark, 0.335, 0.33, -0.15);                       // visor do motorista
    add(g, box(0.22, 0.02, 0.5), mat('#43484b'), -0.42, 0.37, 0);                   // grade do motor
    // torre
    const tur = new THREE.Group(); tur.position.set(-0.02, 0.365, 0); g.add(tur);
    add(tur, prism('pztur', [[-0.2, 0], [0.18, 0], [0.15, 0.13], [-0.18, 0.13]], 0.38), body, 0, 0, 0);
    add(tur, box(0.06, 0.12, 0.46), body, -0.02, 0.065, 0);                          // saias laterais da torre
    add(tur, cyl(0.055, 0.06, 0.06, 12), body, -0.11, 0.16, 0);                      // cúpula do comandante
    add(tur, box(0.06, 0.08, 0.1), dark, 0.19, 0.065, 0);                            // mantelete
    add(tur, cyl(0.018, 0.022, 0.62, 8), dark, 0.5, 0.065, 0, 0, 0, Math.PI / 2);    // cano de 75 mm L/43
    add(tur, cyl(0.03, 0.03, 0.05, 8), dark, 0.81, 0.065, 0, 0, 0, Math.PI / 2);     // freio de boca
    add(g, box(0.18, 0.02, 0.025), tool, -0.15, 0.25, 0.31);                         // ferramentas no para-lama
    const cr = decal('cross', crossTex);
    add(tur, plane(0.09, 0.09), cr, 0, 0.065, 0.236);
    add(tur, plane(0.09, 0.09), cr, 0, 0.065, -0.236, 0, Math.PI, 0);
    return g;
  }

  // ---------- T-34/76 modelo 1942 (torre "porca") ----------
  function t34() {
    const g = new THREE.Group(), body = mat('#4a5131'), dark = mat('#2d3120'), track = mat('#2a2622', { snow: 0.3 });
    // cinco rodas grandes tipo Christie, sem roletes de retorno
    running(g, 0.96, 0.27, 5, 0.075, dark, track);
    running(g, 0.96, -0.27, 5, 0.075, dark, track);
    // casco com glacis e laterais inclinadas
    add(g, prism('t34hull', [[-0.48, 0.14], [0.3, 0.14], [0.5, 0.2], [0.34, 0.33], [-0.42, 0.33], [-0.5, 0.25]], 0.42), body, 0, 0, 0);
    add(g, prism('t34side', [[-0.46, 0], [0.34, 0], [0.34, 0.08], [-0.42, 0.08]], 0.14), body, 0, 0.26, 0.26, 0.35);
    add(g, prism('t34side', [[-0.46, 0], [0.34, 0], [0.34, 0.08], [-0.42, 0.08]], 0.14), body, 0, 0.26, -0.26, -0.35);
    add(g, box(0.06, 0.04, 0.07), dark, 0.42, 0.28, -0.1);                          // escotilha do motorista
    add(g, box(0.26, 0.015, 0.34), mat('#3d432a'), -0.3, 0.335, 0);                 // grade do motor
    add(g, cyl(0.03, 0.03, 0.2, 10), mat('#3b3a33'), -0.36, 0.38, 0.17, 0, 0, Math.PI / 2); // tanques extras de combustível
    add(g, cyl(0.03, 0.03, 0.2, 10), mat('#3b3a33'), -0.36, 0.38, -0.17, 0, 0, Math.PI / 2);
    // torre hexagonal
    const tur = new THREE.Group(); tur.position.set(0.05, 0.33, 0); g.add(tur);
    add(tur, geo('t34tur', () => { const c = new THREE.CylinderGeometry(0.15, 0.19, 0.13, 6); c.scale(1.15, 1, 1); return c; }), body, 0, 0.065, 0, 0, Math.PI / 6);
    add(tur, cyl(0.045, 0.045, 0.03, 10), body, -0.06, 0.14, 0.06);                  // escotilhas gêmeas
    add(tur, cyl(0.045, 0.045, 0.03, 10), body, -0.06, 0.14, -0.06);
    add(tur, box(0.06, 0.07, 0.12), dark, 0.2, 0.06, 0);                             // mantelete
    add(tur, cyl(0.02, 0.024, 0.48, 8), dark, 0.44, 0.06, 0, 0, 0, Math.PI / 2);     // cano F-34 de 76 mm
    const st = decal('star', starTex);
    add(tur, plane(0.1, 0.1), st, 0, 0.065, 0.2);
    add(tur, plane(0.1, 0.1), st, 0, 0.065, -0.2, 0, Math.PI, 0);
    return g;
  }

  // ---------- SdKfz 251 (meia-lagarta blindada alemã) ----------
  function sdkfz251() {
    const g = new THREE.Group(), body = mat('#50565a'), dark = mat('#2c2f31'), track = mat('#2a2622', { snow: 0.3 });
    running(g, 0.58, 0.2, 6, 0.04, dark, track); g.children.slice(-16).forEach(o => o.position.x -= 0.17);
    running(g, 0.58, -0.2, 6, 0.04, dark, track); g.children.slice(-16).forEach(o => o.position.x -= 0.17);
    for (const z of [0.24, -0.24]) { add(g, cyl(0.06, 0.06, 0.06, 12), track, 0.38, 0.06, z, Math.PI / 2); add(g, cyl(0.03, 0.03, 0.065, 8), dark, 0.38, 0.06, z, Math.PI / 2); }
    add(g, prism('sdkbody', [[-0.48, 0.1], [0.34, 0.1], [0.5, 0.17], [0.42, 0.25], [0.12, 0.3], [-0.48, 0.32]], 0.4), body, 0, 0, 0);
    add(g, box(0.5, 0.02, 0.32), dark, -0.18, 0.31, 0);                              // compartimento aberto
    add(g, box(0.05, 0.05, 0.12), dark, 0.07, 0.34, 0);                              // escudo da metralhadora
    add(g, cyl(0.008, 0.008, 0.14, 6), dark, 0.14, 0.355, 0, 0, 0, Math.PI / 2);     // MG 34
    for (const z of [0.1, -0.1]) add(g, sph(0.035, 8, 6), mat('#555b48'), -0.2 + Math.abs(z) * 0.5, 0.34, z); // capacetes da tropa
    const cr = decal('cross', crossTex);
    add(g, plane(0.08, 0.08), cr, -0.2, 0.22, 0.205); add(g, plane(0.08, 0.08), cr, -0.2, 0.22, -0.205, 0, Math.PI, 0);
    return g;
  }

  // ---------- caminhão ZiS-5 com lona (corpos mecanizados soviéticos) ----------
  function zis5() {
    const g = new THREE.Group(), body = mat('#4f5733'), dark = mat('#26281c'), tire = mat('#1f1d1a', { snow: 0.3 }), canvas = mat('#6c6a4a');
    for (const x of [0.33, -0.12, -0.3]) for (const z of [0.2, -0.2]) { add(g, cyl(0.07, 0.07, 0.07, 12), tire, x, 0.07, z, Math.PI / 2); add(g, cyl(0.035, 0.035, 0.075, 8), body, x, 0.07, z, Math.PI / 2); }
    add(g, box(0.95, 0.04, 0.3), dark, 0, 0.12, 0);                                 // chassi
    add(g, box(0.2, 0.14, 0.3), body, 0.38, 0.2, 0);                                // capô
    add(g, box(0.04, 0.12, 0.26), dark, 0.49, 0.19, 0);                             // grade do radiador
    for (const z of [0.18, -0.18]) add(g, box(0.18, 0.02, 0.1), body, 0.36, 0.15, z); // para-lamas
    add(g, box(0.16, 0.2, 0.36), body, 0.21, 0.25, 0);                              // cabine de madeira
    add(g, box(0.02, 0.08, 0.3), mat('#9fb0b8', { snow: false, rough: 0.3 }), 0.29, 0.31, 0); // para-brisa
    add(g, box(0.55, 0.1, 0.42), mat('#5a4a33'), -0.17, 0.19, 0);                   // carroceria
    add(g, geo('zis-cover', () => new THREE.CylinderGeometry(0.2, 0.2, 0.55, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)), canvas, -0.17, 0.24, 0); // lona em arco
    return g;
  }

  // ---------- soldados ----------
  const UNIF = {
    de: { coat: '#5d6150', trousers: '#545748', helm: '#4f5446', helmet: 'stahl' },   // feldgrau, capacete M35
    su: { coat: '#7a7047', trousers: '#6c6340', helm: '#4c5232', helmet: 'ssh40' },   // khaki, capacete SSh-40
    ro: { coat: '#73663f', trousers: '#665a37', helm: '#5c5638', helmet: 'dutch' },   // khaki romeno, capacete M38 de aba larga
    it: { coat: '#6e735b', trousers: '#646850', helm: '#5f6450', helmet: 'm33' },     // grigio-verde, capacete M33
    hu: { coat: '#6b6345', trousers: '#5f583d', helm: '#555844', helmet: 'stahl' }    // khaki húngaro, capacete M38
  };
  function helmetGeo(kind) {
    return geo('helm' + kind, () => {
      const pts = kind === 'stahl' ? [[0, 0.075], [0.05, 0.07], [0.075, 0.04], [0.082, 0.0], [0.095, -0.025]]
        : kind === 'ssh40' ? [[0, 0.078], [0.055, 0.068], [0.08, 0.035], [0.085, 0.0], [0.088, -0.008]]
        : kind === 'dutch' ? [[0, 0.07], [0.05, 0.062], [0.072, 0.03], [0.078, 0.005], [0.115, -0.012]]
        : [[0, 0.074], [0.052, 0.066], [0.077, 0.032], [0.083, 0.0], [0.092, -0.012]];
      return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 14);
    });
  }
  function soldier(nat, pose, winter) {
    const u = UNIF[nat] || UNIF.de, g = new THREE.Group();
    const coat = mat(u.coat, { snow: 0.25 }), legs = mat(u.trousers, { snow: 0.2 }), boots = mat('#2a241e', { snow: 0.2 }), skin = mat('#b48d6c', { snow: false }), helm = mat(u.helm, { snow: 0.5, side: THREE.DoubleSide }), wood = mat('#4a3523', { snow: 0.15 }), steel = mat('#2b2b2b', { snow: 0.1 });
    const step = pose === 'walk' ? 0.25 : 0;
    // pernas e botas
    add(g, box(0.055, 0.2, 0.06), legs, 0.0, 0.11, 0.04, 0, 0, step);
    add(g, box(0.055, 0.2, 0.06), legs, 0.0, 0.11, -0.04, 0, 0, -step);
    add(g, box(0.075, 0.05, 0.065), boots, 0.01, 0.025, 0.04); add(g, box(0.075, 0.05, 0.065), boots, 0.01, 0.025, -0.04);
    // capote com saia até o joelho
    add(g, cyl(0.07, 0.095, 0.28, 8), coat, 0, 0.33, 0);
    add(g, box(0.08, 0.04, 0.17), mat('#3a3326', { snow: 0.2 }), 0, 0.31, 0);       // cinto e cartucheiras
    // braços
    add(g, box(0.05, 0.2, 0.05), coat, 0.04, 0.35, 0.1, 0.2, 0, -0.6);
    add(g, box(0.05, 0.2, 0.05), coat, 0.06, 0.35, -0.09, -0.15, 0, -0.9);
    add(g, sph(0.05, 10, 8), skin, 0, 0.52, 0);                                     // cabeça
    add(g, helmetGeo(u.helmet), helm, 0, 0.53, 0);
    add(g, sph(0.08, 12, 6, 0, Math.PI / 2), helm, 0, 0.53, 0);                     // casco do capacete
    if (nat === 'de' || nat === 'hu') add(g, cyl(0.03, 0.03, 0.1, 8), steel, -0.07, 0.34, 0.03, 0, 0, Math.PI / 2 + 0.2); // estojo da máscara de gás
    if (winter && nat === 'su') add(g, box(0.09, 0.02, 0.14), mat('#4d4232'), 0, 0.46, 0); // gola do capote
    return g;
  }
  function rifle(g, x, y, z, ang, long) {
    const r = new THREE.Group(); r.position.set(x, y, z); r.rotation.z = ang; g.add(r);
    add(r, box(0.035, long ? 0.42 : 0.36, 0.02), mat('#4a3523', { snow: 0.1 }), 0, 0, 0);
    add(r, box(0.012, long ? 0.2 : 0.16, 0.012), mat('#2b2b2b', { snow: false }), 0.012, long ? 0.26 : 0.22, 0);
  }
  function squad(nat) {
    const g = new THREE.Group();
    const spots = [[0.28, 0, 1.08, 'walk'], [0.02, 0.24, 1, 'walk'], [0.02, -0.24, 1, 'walk'], [-0.26, 0.1, 0.98, 'walk'], [-0.26, -0.14, 1, 'walk']];
    spots.forEach(([x, z, s, pose], i) => {
      const so = soldier(nat, pose); so.position.set(x, 0, z); so.rotation.y = (i % 2 ? 0.08 : -0.06); so.scale.setScalar(s * 1.25);
      // arma: fuzil Mauser/Mosin, submetralhadora PPSh para um soviético, metralhadora para outro
      if (nat === 'su' && i === 1) { add(so, box(0.03, 0.2, 0.025), mat('#4a3523', { snow: 0.1 }), 0.13, 0.36, 0.06, 0, 0, -1.1); add(so, cyl(0.035, 0.035, 0.03, 10), mat('#2b2b2b', { snow: false }), 0.15, 0.33, 0.06, Math.PI / 2); }
      else if (i === 3) { add(so, box(0.24, 0.035, 0.03), mat('#262626', { snow: false }), 0.08, 0.42, -0.1, 0, 0, 0.25); }
      else rifle(so, 0.1, 0.4, 0.07, -1.0, nat === 'su');
      g.add(so);
    });
    return g;
  }

  // ---------- aviões ----------
  function propeller(par, x, y, z, r) {
    const p = new THREE.Group(); p.position.set(x, y, z); par.add(p);
    const blade = mat('#1d1d1d', { snow: false });
    add(p, box(0.01, r * 2, 0.03), blade, 0, 0, 0); add(p, box(0.01, 0.03, r * 2), blade, 0, 0, 0);
    add(p, geo('spin', () => new THREE.ConeGeometry(0.025, 0.06, 10)), mat('#3a3a3a', { snow: false }), 0.03, 0, 0, 0, 0, -Math.PI / 2);
    return p;
  }
  function he111() { // bombardeiro e transporte da ponte aérea
    const g = new THREE.Group(), top = mat('#4a5442', { snow: false }), under = mat('#8fa6b5', { snow: false }), glass = mat('#9fbccc', { snow: false, rough: 0.2 }), dark = mat('#2a2a2a', { snow: false });
    const fus = add(g, geo('he-fus', () => { const c = new THREE.CylinderGeometry(0.045, 0.075, 0.95, 12); c.rotateZ(-Math.PI / 2); return c; }), top, -0.02, 0, 0);
    add(g, sph(0.075, 12, 10, 0, Math.PI / 2), glass, 0.455, 0, 0, 0, 0, -Math.PI / 2);   // nariz envidraçado
    add(g, box(0.36, 0.022, 1.3), top, 0.05, -0.01, 0);                              // asa
    add(g, box(0.3, 0.01, 1.22), under, 0.05, -0.024, 0);
    for (const z of [0.26, -0.26]) {                                                  // motores Jumo
      add(g, geo('he-eng', () => { const c = new THREE.CylinderGeometry(0.045, 0.04, 0.26, 10); c.rotateZ(-Math.PI / 2); return c; }), top, 0.17, -0.005, z);
    }
    add(g, box(0.16, 0.012, 0.42), top, -0.46, 0.01, 0);                             // estabilizador
    add(g, box(0.14, 0.15, 0.012), top, -0.47, 0.075, 0);                            // leme
    add(g, box(0.06, 0.04, 0.05), glass, 0.1, 0.06, 0);                              // posto de tiro dorsal
    const cr = decal('cross', crossTex);
    for (const z of [0.48, -0.48]) add(g, plane(0.1, 0.1), cr, 0.05, 0.013, z, -Math.PI / 2);
    g.userData.props = [propeller(g, 0.31, -0.005, 0.26, 0.11), propeller(g, 0.31, -0.005, -0.26, 0.11)];
    return g;
  }
  function il2() { // avião de ataque ao solo soviético
    const g = new THREE.Group(), top = mat('#4b5534', { snow: false }), under = mat('#93a8b8', { snow: false }), glass = mat('#9fbccc', { snow: false, rough: 0.2 });
    add(g, geo('il-fus', () => { const c = new THREE.CylinderGeometry(0.04, 0.075, 0.9, 10); c.rotateZ(-Math.PI / 2); return c; }), top, 0, 0, 0);
    add(g, box(0.18, 0.06, 0.12), top, 0.32, -0.01, 0);                               // capô blindado
    add(g, sph(0.05, 10, 8, 0, Math.PI / 2), glass, 0.08, 0.055, 0);                  // cabine
    add(g, box(0.26, 0.02, 1.15), top, 0.06, -0.035, 0);                             // asa (bordas em flecha suave)
    add(g, box(0.22, 0.01, 1.05), under, 0.06, -0.047, 0);
    for (const z of [0.12, -0.12]) add(g, box(0.1, 0.07, 0.03), mat('#2a2a2a', { snow: false }), 0.1, -0.08, z); // carenagens do trem
    add(g, box(0.14, 0.012, 0.36), top, -0.42, 0.01, 0);
    add(g, box(0.12, 0.13, 0.012), top, -0.43, 0.065, 0);
    const st = decal('star', starTex);
    for (const z of [0.42, -0.42]) add(g, plane(0.11, 0.11), st, 0.06, -0.024, z, -Math.PI / 2);
    add(g, plane(0.09, 0.09), st, -0.3, 0.02, 0.06); add(g, plane(0.09, 0.09), st, -0.3, 0.02, -0.06, 0, Math.PI, 0);
    g.userData.props = [propeller(g, 0.42, 0, 0, 0.13)];
    return g;
  }

  // ---------- quartel-general: barraca de estado-maior, viatura e antena ----------
  function hq(col, side) {
    const g = new THREE.Group(), cloth = mat(side === 'su' ? '#6d6849' : '#5e6152', { snow: 0.8 }), pole = mat('#3a3128', { snow: false }), flag = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    add(g, prism('tent', [[-0.3, 0], [0.3, 0], [0.3, 0.16], [0, 0.34], [-0.3, 0.16]], 0.44), cloth, 0, 0, 0, 0, Math.PI / 2, 0); // barraca de cumeeira
    add(g, box(0.02, 0.12, 0.12), mat('#2a2620', { snow: false }), 0.221, 0.08, 0);   // entrada
    // viatura de comando: Kübelwagen (alemão) ou GAZ-M1 (soviético)
    const car = new THREE.Group(); car.position.set(0.15, 0, 0.42); car.rotation.y = 0.4; g.add(car);
    const cb = mat(side === 'su' ? '#4a5131' : '#50565a');
    for (const x of [0.12, -0.12]) for (const z of [0.08, -0.08]) add(car, cyl(0.04, 0.04, 0.03, 10), mat('#1f1d1a', { snow: 0.3 }), x, 0.04, z, Math.PI / 2);
    add(car, box(0.36, 0.08, 0.17), cb, 0, 0.09, 0);
    add(car, box(0.16, 0.07, 0.15), side === 'su' ? cb : mat('#4c4535'), -0.04, 0.165, 0);
    // antena de rádio e mastro com bandeira
    add(g, cyl(0.006, 0.006, 0.9, 4), pole, -0.35, 0.45, -0.22);
    add(g, cyl(0.015, 0.015, 1.0, 6), pole, 0.3, 0.5, -0.32);
    const f = add(g, geo('flag', () => new THREE.PlaneGeometry(0.36, 0.22)), flag, 0.48, 0.87, -0.32);
    g.userData.flag = f;
    return g;
  }

  SG.makeModel = function (type, col, side, nat) {
    nat = nat || (side === 'su' ? 'su' : 'de');
    let g;
    if (type === 'arm') g = side === 'su' ? t34() : panzerIV();
    else if (type === 'mech') g = side === 'su' ? zis5() : sdkfz251();
    else if (type === 'air') g = side === 'su' ? il2() : he111();
    else if (type === 'hq') g = hq(col, side);
    else g = squad(nat);
    if (g.userData.props) g.userData.prop = g.userData.props[0];
    if (type !== 'air') {
      const ring = new THREE.Mesh(geo('ring', () => new THREE.RingGeometry(0.62, 0.74, 32).rotateX(-Math.PI / 2)),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false }));
      ring.position.y = 0.02; g.add(ring); g.userData.ring = ring;
    }
    return g;
  };
})();
