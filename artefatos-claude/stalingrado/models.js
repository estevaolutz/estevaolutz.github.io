// Modelos 3D low-poly para as unidades. Todos apontam para +X, base em y=0, comprimento ~1.
(function () {
  const cache = {};
  const geo = (k, f) => cache[k] || (cache[k] = f());
  const mats = {};
  const mat = (hex, opts) => { const k = hex + JSON.stringify(opts || {}); return mats[k] || (mats[k] = new THREE.MeshLambertMaterial(Object.assign({ color: hex }, opts))); };
  const shade = (hex, f) => { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); };
  const box = (w, h, d) => geo('b' + w + h + d, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (rt, rb, h, n) => geo('c' + rt + rb + h + n, () => new THREE.CylinderGeometry(rt, rb, h, n || 10));
  const sph = r => geo('s' + r, () => new THREE.SphereGeometry(r, 10, 8));
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

  function tank(col, side) {
    const g = new THREE.Group(), body = mat(col), dark = mat(shade(col, 0.45)), track = mat('#26231f');
    // lagartas
    g.add(add(box(1.0, 0.16, 0.2), track, 0, 0.09, 0.27), add(box(1.0, 0.16, 0.2), track, 0, 0.09, -0.27));
    for (let i = 0; i < 5; i++) for (const z of [0.38, -0.38]) { const w = add(cyl(0.065, 0.065, 0.03, 10), dark, -0.36 + i * 0.18, 0.09, z); w.rotation.x = Math.PI / 2; g.add(w); }
    // casco com glacis inclinado
    g.add(add(box(0.86, 0.17, 0.64), body, -0.03, 0.25, 0));
    const glacis = add(box(0.2, 0.17, 0.64), body, 0.43, 0.22, 0); glacis.rotation.z = -0.55; g.add(glacis);
    // torre
    const tur = add(side === 'su' ? cyl(0.2, 0.24, 0.17, 12) : box(0.38, 0.17, 0.36), body, -0.05, 0.42, 0);
    g.add(tur);
    g.add(add(box(0.12, 0.07, 0.07), dark, 0.18, 0.42, 0));
    const gun = add(cyl(0.03, 0.035, 0.62, 8), dark, 0.47, 0.43, 0); gun.rotation.z = Math.PI / 2; g.add(gun);
    // escotilha do comandante
    g.add(add(cyl(0.06, 0.06, 0.05, 10), dark, -0.12, 0.53, 0.06));
    return g;
  }

  function halftrack(col) {
    const g = new THREE.Group(), body = mat(col), dark = mat(shade(col, 0.45)), track = mat('#26231f'), canvas = mat(shade(col, 0.78));
    g.add(add(box(0.5, 0.15, 0.18), track, -0.2, 0.08, 0.24), add(box(0.5, 0.15, 0.18), track, -0.2, 0.08, -0.24));
    for (const z of [0.25, -0.25]) { const w = add(cyl(0.09, 0.09, 0.07, 12), track, 0.35, 0.09, z); w.rotation.x = Math.PI / 2; g.add(w); }
    g.add(add(box(1.0, 0.1, 0.5), dark, 0, 0.2, 0));
    g.add(add(box(0.3, 0.22, 0.46), body, 0.33, 0.36, 0));
    g.add(add(box(0.08, 0.1, 0.42), mat('#9fb4c0'), 0.49, 0.41, 0));
    g.add(add(box(0.6, 0.12, 0.48), body, -0.18, 0.31, 0));
    const cover = add(geo('cover', () => new THREE.CylinderGeometry(0.24, 0.24, 0.6, 12, 1, false, 0, Math.PI)), canvas, -0.18, 0.37, 0);
    cover.rotation.z = Math.PI / 2; g.add(cover);
    return g;
  }

  function soldier(col, dark) {
    const g = new THREE.Group(), body = mat(col), skin = mat('#d9b48f'), gear = mat(dark);
    g.add(add(box(0.07, 0.22, 0.05), gear, 0, 0.11, 0.045), add(box(0.07, 0.22, 0.05), gear, 0, 0.11, -0.045));
    g.add(add(box(0.1, 0.24, 0.17), body, 0, 0.34, 0));
    g.add(add(sph(0.065), skin, 0, 0.52, 0));
    const helm = add(sph(0.08), gear, 0, 0.55, 0); helm.scale.set(1, 0.6, 1); g.add(helm);
    const rifle = add(box(0.03, 0.4, 0.03), mat('#3b2b1d'), 0.07, 0.38, 0.1); rifle.rotation.z = -0.35; g.add(rifle);
    return g;
  }
  function squad(col) {
    const g = new THREE.Group(), dark = shade(col, 0.45);
    [[0.18, 0, 1.1], [-0.12, 0.2, 1], [-0.12, -0.2, 1]].forEach(([x, z, s]) => { const so = soldier(col, dark); so.position.set(x, 0, z); so.scale.setScalar(s * 1.3); g.add(so); });
    return g;
  }

  function plane(col, side) {
    const g = new THREE.Group(), body = mat(col), dark = mat(shade(col, 0.45)), glass = mat('#a9c4d4');
    const fus = add(cyl(0.07, 0.11, 1.0, 10), body, 0, 0, 0); fus.rotation.z = Math.PI / 2; g.add(fus);
    const nose = add(cyl(0.11, 0.11, 0.08, 10), dark, 0.53, 0, 0); nose.rotation.z = Math.PI / 2; g.add(nose);
    g.add(add(box(0.3, 0.025, 1.1), body, 0.08, -0.03, 0));
    g.add(add(box(0.16, 0.02, 0.38), body, -0.45, 0.02, 0));
    g.add(add(box(0.16, 0.18, 0.02), body, -0.45, 0.1, 0));
    const can = add(sph(0.08), glass, 0.12, 0.09, 0); can.scale.set(2, 0.7, 0.8); g.add(can);
    // motores nas asas para bombardeiros (só visual, alternado por lado)
    if (side === 'ax') for (const z of [0.28, -0.28]) { const e = add(cyl(0.05, 0.05, 0.2, 8), dark, 0.2, -0.04, z); e.rotation.z = Math.PI / 2; g.add(e); }
    const prop = new THREE.Group(); prop.position.set(0.58, 0, 0);
    prop.add(add(box(0.01, 0.34, 0.035), dark, 0, 0, 0), add(box(0.01, 0.035, 0.34), dark, 0, 0, 0));
    g.add(prop); g.userData.prop = prop;
    // marca nacional nas asas
    const mark = side === 'su' ? mat('#e23b2e') : mat('#111111');
    for (const z of [0.4, -0.4]) g.add(add(box(0.12, 0.03, 0.12), mark, 0.08, -0.02, z));
    return g;
  }

  function hq(col) {
    const g = new THREE.Group(), cloth = mat(shade('#7e7454', 1.0)), pole = mat('#3a3128'), flag = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    const tent = add(geo('tent', () => new THREE.ConeGeometry(0.42, 0.42, 4)), cloth, 0, 0.21, 0); tent.rotation.y = Math.PI / 4; g.add(tent);
    g.add(add(cyl(0.015, 0.015, 1.0, 6), pole, 0.32, 0.5, 0.32));
    const f = add(geo('flag', () => new THREE.PlaneGeometry(0.38, 0.24)), flag, 0.51, 0.86, 0.32); g.add(f);
    g.userData.flag = f;
    // antena de rádio
    g.add(add(cyl(0.008, 0.008, 0.7, 4), pole, -0.3, 0.35, -0.25));
    return g;
  }

  SG.makeModel = function (type, col, side) {
    const g = type === 'arm' ? tank(col, side) : type === 'mech' ? halftrack(col) : type === 'air' ? plane(col, side) : type === 'hq' ? hq(col) : squad(col);
    // anel no chão com a cor da nação, para leitura de longe
    if (type !== 'air') {
      const ring = new THREE.Mesh(geo('ring', () => new THREE.RingGeometry(0.62, 0.74, 28).rotateX(-Math.PI / 2)),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false }));
      ring.position.y = 0.02; g.add(ring); g.userData.ring = ring;
    }
    return g;
  };
})();
