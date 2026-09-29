/*
 * «Производство»: линия обработки молока в 3D — её можно вертеть мышью или пальцем и приближать.
 * Модель своя, собрана из простых форм по мотивам иллюстрации Tetra Pak (подпись под блоком):
 * блок нагрева и охлаждения (конусный сосуд, пластинчатый теплообменник, трубы, шкаф управления),
 * гомогенизатор, стерильный танк на опорах с лестницей, два фасовочных автомата с площадкой,
 * конвейер, по которому едут готовые пачки. Номера 1–4 привязаны к оборудованию: нажатие —
 * камера подлетает к нему. Сцена рисуется, только пока блок на экране; без WebGL остаётся фото.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});

  Z.initPlant3D = function () {
    const frame = document.querySelector('[data-plant]');
    if (!frame || !('IntersectionObserver' in window)) return null;
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
    } catch (e) {
      return null;
    }
    const api = { ready: null };
    function start() {
      if (api.ready) return api.ready;
      io.disconnect();
      api.ready = Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/environments/RoomEnvironment.js'),
      ]).then(([THREE, oc, room]) => build(THREE, oc.OrbitControls, room.RoomEnvironment, frame, api))
        .catch((err) => console.warn('Завозик: 3D-линия недоступна, остаётся фото.', err));
      return api.ready;
    }
    // грузим 3D, когда блок подъезжает к экрану
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) start();
    }, { rootMargin: '600px 0px' });
    io.observe(frame);
    api.start = start;
    return api;
  };

  function build(THREE, OrbitControls, RoomEnvironment, frame, api) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const canvas = document.createElement('canvas');
    canvas.className = 'plant__canvas';
    canvas.setAttribute('aria-label', 'Линия обработки молока в 3D: перетащите, чтобы повернуть, колесо или два пальца — приблизить');
    canvas.setAttribute('role', 'img');
    frame.prepend(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6f7f5);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
    const HOME = { pos: new THREE.Vector3(-9.5, 8.2, 17.5), target: new THREE.Vector3(0.4, 1.3, 0) };
    camera.position.copy(HOME.pos);

    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(HOME.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 34;
    controls.maxPolarAngle = Math.PI * 0.47;          // под пол не заглядываем
    controls.enablePan = false;
    controls.autoRotate = !reduce.matches;
    controls.autoRotateSpeed = 0.55;

    /* ---------------- свет ---------------- */
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8dcd4, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-6, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 40;
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 4;
    scene.add(sun);

    /* ---------------- материалы ---------------- */
    const M = {
      // нержавейка светлая, как на иллюстрации: металл отражает окружение, поэтому ему прибавлена
      // сила отражений и немного своего светлого цвета
      steel: new THREE.MeshStandardMaterial({ color: 0xeef1f3, metalness: 0.78, roughness: 0.24, envMapIntensity: 2.1 }),
      brushed: new THREE.MeshStandardMaterial({ color: 0xd6dadd, metalness: 0.7, roughness: 0.4, envMapIntensity: 1.8 }),
      frame: new THREE.MeshStandardMaterial({ color: 0xc2c7ca, metalness: 0.65, roughness: 0.48, envMapIntensity: 1.6 }),
      panel: new THREE.MeshStandardMaterial({ color: 0xeef0ee, metalness: 0.15, roughness: 0.5 }),
      green: new THREE.MeshStandardMaterial({ color: 0x5c8f35, metalness: 0.2, roughness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x1c2a2e, metalness: 0.3, roughness: 0.08, transparent: true, opacity: 0.82 }),
      screen: new THREE.MeshStandardMaterial({ color: 0x0d1820, emissive: 0x3d8fd6, emissiveIntensity: 0.55, roughness: 0.3 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x2a2d2c, roughness: 0.8 }),
      carton: new THREE.MeshStandardMaterial({ color: 0xf7f6f1, roughness: 0.55 }),
      cartonTop: new THREE.MeshStandardMaterial({ color: 0x3f7f2c, roughness: 0.5 }),
      lampOn: new THREE.MeshStandardMaterial({ color: 0x9be36c, emissive: 0x7bd14a, emissiveIntensity: 1.2 }),
    };

    const root = new THREE.Group();
    scene.add(root);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    function add(mesh, parent = root) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }
    function box(w, h, d, mat, x, y, z, parent) {
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent);
      m.position.set(x, y, z);
      return m;
    }
    function cyl(rt, rb, h, mat, x, y, z, seg = 40, parent) {
      const m = add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat), parent);
      m.position.set(x, y, z);
      return m;
    }
    // Труба по ломаной с плавными изгибами на углах
    function pipe(pts, r, mat = M.steel, bend = 0.22) {
      const path = new THREE.CurvePath();
      let prev = pts[0].clone();
      for (let i = 1; i < pts.length; i++) {
        const cur = pts[i];
        if (i < pts.length - 1) {
          const next = pts[i + 1];
          const a = cur.clone().sub(prev), b = next.clone().sub(cur);
          const ba = Math.min(bend, a.length() / 2), bb = Math.min(bend, b.length() / 2);
          const p1 = cur.clone().sub(a.normalize().multiplyScalar(ba));
          const p2 = cur.clone().add(b.normalize().multiplyScalar(bb));
          path.add(new THREE.LineCurve3(prev, p1));
          path.add(new THREE.QuadraticBezierCurve3(p1, cur.clone(), p2));
          prev = p2;
        } else {
          path.add(new THREE.LineCurve3(prev, cur.clone()));
        }
      }
      const geo = new THREE.TubeGeometry(path, Math.max(24, pts.length * 18), r, 12, false);
      return add(new THREE.Mesh(geo, mat));
    }
    // Перила: стойки, поручень и средняя перекладина
    function railing(pts, h = 1.0) {
      for (const p of pts) cyl(0.025, 0.025, h, M.frame, p.x, p.y + h / 2, p.z, 8);
      pipe(pts.map((p) => V(p.x, p.y + h, p.z)), 0.028, M.frame, 0.05);
      pipe(pts.map((p) => V(p.x, p.y + h * 0.5, p.z)), 0.02, M.frame, 0.05);
    }
    function ladder(x, z, y0, y1, facing = 0) {
      const g = new THREE.Group();
      root.add(g);
      g.position.set(x, 0, z);
      g.rotation.y = facing;
      cyl(0.025, 0.025, y1 - y0, M.frame, -0.22, (y0 + y1) / 2, 0, 8, g);
      cyl(0.025, 0.025, y1 - y0, M.frame, 0.22, (y0 + y1) / 2, 0, 8, g);
      for (let y = y0 + 0.25; y < y1; y += 0.3) {
        const r = cyl(0.018, 0.018, 0.44, M.frame, 0, y, 0, 8, g);
        r.rotation.z = Math.PI / 2;
      }
      return g;
    }
    function stairs(x0, x1, z, h, width = 0.8) {
      const n = Math.round(h / 0.22);
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / n;
        box((x1 - x0) / n, 0.04, width, M.brushed, x0 + (x1 - x0) * t, h * t, z);
      }
      for (const s of [-1, 1]) {
        pipe([V(x0, 1.0, z + (s * width) / 2), V(x1, h + 1.0, z + (s * width) / 2)], 0.025, M.frame, 0.01);
        const side = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x1 - x0, h), 0.12, 0.03), M.frame);
        side.position.set((x0 + x1) / 2, h / 2, z + (s * width) / 2);
        side.rotation.z = Math.atan2(h, x1 - x0);
        add(side);
      }
    }

    /* ---------------- пол ---------------- */
    const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 64), new THREE.MeshStandardMaterial({ color: 0xf0f1ee, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);
    // разметка цеха: тонкие линии, как на полу завода
    const lines = new THREE.MeshBasicMaterial({ color: 0xd9ddd6 });
    for (const z of [-2.4, 2.4]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(19, 0.06), lines);
      l.rotation.x = -Math.PI / 2;
      l.position.set(0.4, 0.002, z);
      root.add(l);
    }

    /* ---------------- 1. Нагрев и охлаждение ---------------- */
    const X1 = -6.2;
    box(3.6, 0.14, 2.0, M.frame, X1 + 0.6, 0.12, 0);                            // рама-основание
    for (const [dx, dz] of [[-1.1, -0.9], [2.3, -0.9], [-1.1, 0.9], [2.3, 0.9]]) cyl(0.06, 0.06, 0.12, M.rubber, X1 + dx, 0.06, dz, 10);
    // конусный сосуд на подставке, вокруг — площадка с перилами
    cyl(0.5, 0.5, 1.1, M.steel, X1 - 0.35, 1.25, -0.2, 48);
    cyl(0.08, 0.5, 1.0, M.steel, X1 - 0.35, 2.3, -0.2, 48);
    cyl(0.1, 0.1, 0.3, M.steel, X1 - 0.35, 2.95, -0.2, 16);
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) cyl(0.04, 0.04, 0.6, M.frame, X1 - 0.35 + dx, 0.45, -0.2 + dz, 8);
    box(1.6, 0.05, 1.4, M.brushed, X1 - 0.35, 1.55, -0.2);
    railing([V(X1 - 1.15, 1.58, -0.9), V(X1 - 1.15, 1.58, 0.5), V(X1 + 0.45, 1.58, 0.5)]);
    ladder(X1 - 1.4, 0.2, 0.1, 1.6, Math.PI / 2);
    // пластинчатый теплообменник: пачка пластин между двумя плитами, стяжки
    const phe = new THREE.Group();
    root.add(phe);
    phe.position.set(X1 + 1.25, 0.2, 0.05);
    box(0.14, 1.2, 0.8, M.brushed, -0.8, 0.8, 0, phe);
    box(0.14, 1.2, 0.8, M.brushed, 0.8, 0.8, 0, phe);
    for (let i = 0; i < 24; i++) box(0.035, 1.02, 0.7, i % 2 ? M.steel : M.brushed, -0.66 + i * 0.057, 0.8, 0, phe);
    for (const [y, z] of [[1.42, 0.3], [1.42, -0.3], [0.2, 0.3], [0.2, -0.3]]) {
      const rod = cyl(0.025, 0.025, 1.8, M.steel, 0, y, z, 10, phe);
      rod.rotation.z = Math.PI / 2;
    }
    // трубы блока
    pipe([V(X1 - 0.35, 0.9, 0.35), V(X1 - 0.35, 0.9, 0.75), V(X1 + 0.3, 0.9, 0.75), V(X1 + 0.3, 1.5, 0.75), V(X1 + 0.45, 1.5, 0.35)], 0.07);
    pipe([V(X1 + 2.05, 1.6, 0.25), V(X1 + 2.5, 1.6, 0.25), V(X1 + 2.5, 0.55, 0.25), V(X1 + 2.9, 0.55, 0.25)], 0.07);
    pipe([V(X1 + 2.05, 0.6, -0.25), V(X1 + 2.35, 0.6, -0.25), V(X1 + 2.35, 1.9, -0.25), V(X1 + 0.9, 1.9, -0.25), V(X1 + 0.9, 1.42, -0.25)], 0.055);
    pipe([V(X1 - 0.8, 0.5, -0.65), V(X1 + 0.3, 0.5, -0.65), V(X1 + 0.3, 1.1, -0.65), V(X1 + 0.45, 1.1, -0.3)], 0.06);
    // шкаф управления с экраном и зелёной полосой
    box(0.7, 1.7, 0.45, M.panel, X1 + 1.0, 1.05, 0.95);
    box(0.72, 0.08, 0.47, M.green, X1 + 1.0, 1.75, 0.95);
    box(0.34, 0.24, 0.02, M.screen, X1 + 1.0, 1.35, 1.18);
    box(0.05, 0.05, 0.02, M.lampOn, X1 + 1.28, 1.6, 1.18);

    /* ---------------- 2. Гомогенизатор ---------------- */
    const X2 = -1.55;
    pipe([V(X1 + 2.9, 0.55, 0.25), V(X2 - 0.9, 0.55, 0.25)], 0.07);
    const homo = new THREE.Group();
    root.add(homo);
    homo.position.set(X2, 0, 0.1);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.25, 1.2, 1, 1, 1), M.steel);
    body.position.y = 0.78;
    add(body, homo);
    box(1.74, 0.1, 1.24, M.green, 0, 1.2, 0, homo);                          // полоса
    box(1.74, 0.1, 1.24, M.green, 0, 0.3, 0, homo);
    box(1.0, 0.55, 0.02, M.glass, 0.1, 0.78, 0.61, homo);                     // окно
    box(0.26, 0.26, 0.02, M.screen, -0.6, 0.85, 0.61, homo);
    const hood = cyl(0.62, 0.62, 1.7, M.panel, 0, 1.43, 0, 36, homo);          // крышка-свод
    hood.scale.set(1, 0.3, 0.97);
    hood.rotation.z = Math.PI / 2;
    for (const dx of [-0.7, 0.7]) for (const dz of [-0.5, 0.5]) cyl(0.05, 0.05, 0.16, M.rubber, dx, 0.08, dz, 10, homo);
    cyl(0.05, 0.05, 0.12, M.lampOn, 0.6, 1.66, 0.3, 12, homo);

    /* ---------------- 3. Стерильный танк ---------------- */
    const X3 = 2.0;
    pipe([V(X2 + 0.9, 0.45, 0.1), V(X3 - 1.4, 0.45, 0.1), V(X3 - 1.4, 0.45, -0.6), V(X3 - 0.2, 0.45, -0.6), V(X3 - 0.2, 0.62, -0.2)], 0.065);
    cyl(1.05, 1.05, 2.1, M.steel, X3, 2.35, 0, 64);
    const dome = add(new THREE.Mesh(new THREE.SphereGeometry(1.05, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), M.steel));
    dome.position.set(X3, 3.4, 0);
    dome.scale.y = 0.38;
    cyl(1.05, 0.14, 0.75, M.steel, X3, 0.92, 0, 64);                           // конусное дно
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      cyl(0.06, 0.06, 1.35, M.brushed, X3 + Math.cos(a) * 0.95, 0.68, Math.sin(a) * 0.95, 10);
    }
    ladder(X3 + 1.12, 0.35, 0.1, 3.7, -Math.PI / 2);
    const ringPts = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ringPts.push(V(X3 + Math.cos(a) * 0.95, 3.72, Math.sin(a) * 0.95));
    }
    pipe(ringPts, 0.025, M.frame, 0.01);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      cyl(0.02, 0.02, 0.5, M.frame, X3 + Math.cos(a) * 0.95, 3.5, Math.sin(a) * 0.95, 6);
    }
    // клапанный узел со шкафом рядом с танком
    box(1.0, 0.1, 0.9, M.frame, X3 - 1.75, 0.08, 1.35);
    box(0.5, 1.2, 0.35, M.panel, X3 - 2.0, 0.75, 1.55);
    box(0.24, 0.18, 0.02, M.screen, X3 - 2.0, 1.0, 1.73);
    pipe([V(X3 - 1.55, 0.3, 1.2), V(X3 - 1.55, 1.1, 1.2), V(X3 - 1.2, 1.1, 1.2), V(X3 - 1.2, 0.3, 1.2)], 0.05);
    pipe([V(X3 - 1.2, 0.3, 1.2), V(X3 - 0.6, 0.3, 1.2), V(X3 - 0.6, 0.3, 0.4), V(X3 - 0.1, 0.3, 0.2)], 0.05);

    /* ---------------- 4. Фасовочные автоматы ---------------- */
    const X4 = 6.3;
    pipe([V(X3 + 0.14, 0.52, 0), V(X3 + 0.14, 0.3, 0), V(X4 - 1.4, 0.3, 0), V(X4 - 1.4, 0.3, -0.9), V(X4 - 1.05, 0.3, -0.9)], 0.06);
    const fillers = [];
    for (const dz of [-0.9, 1.0]) {
      const g = new THREE.Group();
      root.add(g);
      g.position.set(X4, 0, dz);
      box(1.9, 2.3, 1.2, M.panel, 0, 1.15, 0, g);
      box(1.92, 0.12, 1.22, M.green, 0, 2.02, 0, g);
      box(0.8, 1.1, 0.02, M.glass, -0.35, 1.1, 0.61, g);
      box(0.5, 1.1, 0.02, M.glass, 0.45, 1.1, 0.61, g);
      box(0.9, 1.1, 0.8, M.panel, 0.2, 2.85, -0.1, g);                           // верхний модуль
      box(0.3, 0.2, 0.02, M.screen, 0.2, 2.95, 0.31, g);
      cyl(0.05, 0.05, 0.12, M.lampOn, 0.6, 3.46, 0.2, 12, g);
      fillers.push(g);
    }
    // площадка над автоматами, перила и лестница
    box(2.6, 0.06, 3.3, M.brushed, X4 + 0.1, 2.34, 0.05);
    railing([V(X4 - 1.2, 2.37, -1.6), V(X4 + 1.4, 2.37, -1.6), V(X4 + 1.4, 2.37, 1.7), V(X4 - 0.4, 2.37, 1.7)]);
    stairs(X4 - 3.4, X4 - 1.2, -2.0, 2.34);
    // конвейер из автоматов: лента и бегущие пачки
    const beltZ = 2.05;
    box(6.5, 0.08, 0.36, M.rubber, X4 + 1.9, 0.62, beltZ);
    box(6.5, 0.14, 0.05, M.brushed, X4 + 1.9, 0.62, beltZ - 0.2);
    box(6.5, 0.14, 0.05, M.brushed, X4 + 1.9, 0.62, beltZ + 0.2);
    for (let x = X4 - 1.2; x < X4 + 5.1; x += 1.3) {
      cyl(0.03, 0.03, 0.6, M.frame, x, 0.3, beltZ - 0.18, 6);
      cyl(0.03, 0.03, 0.6, M.frame, x, 0.3, beltZ + 0.18, 6);
    }
    const cartonGeo = new THREE.BoxGeometry(0.16, 0.34, 0.16);
    const capGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.04, 12);
    const cartons = [];
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Group();
      const b = add(new THREE.Mesh(cartonGeo, [M.carton, M.carton, M.cartonTop, M.carton, M.carton, M.carton]), c);
      b.position.y = 0.17;
      const cap = add(new THREE.Mesh(capGeo, M.cartonTop), c);
      cap.position.set(0.03, 0.36, 0.03);
      c.position.set(0, 0.66, beltZ);
      root.add(c);
      cartons.push(c);
    }

    /* ---------------- номера на оборудовании ---------------- */
    const spots = [
      { el: frame.querySelector('[data-spot="1"]'), at: V(X1 + 0.2, 3.3, 0), view: { pos: V(-10.5, 4.2, 6.5), target: V(X1 + 0.4, 1.2, 0) } },
      { el: frame.querySelector('[data-spot="2"]'), at: V(X2, 2.0, 0.1), view: { pos: V(-2.6, 3.4, 6.2), target: V(X2, 0.9, 0) } },
      { el: frame.querySelector('[data-spot="3"]'), at: V(X3, 4.2, 0), view: { pos: V(5.8, 4.6, 7.8), target: V(X3, 2.1, 0) } },
      { el: frame.querySelector('[data-spot="4"]'), at: V(X4, 4.0, 0), view: { pos: V(12.5, 5.4, 7.5), target: V(X4 + 0.5, 1.6, 0) } },
    ].filter((s) => s.el);

    // перелёт камеры к узлу (или обратно к общему виду)
    let fly = null;
    function flyTo(view) {
      controls.autoRotate = false;
      fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: view.pos.clone(), t1: view.target.clone() };
      wake();
    }
    spots.forEach((s, i) => {
      s.el.addEventListener('click', () => {
        spots.forEach((o) => o.el.classList.toggle('is-active', o === s));
        flyTo(s.view);
      });
    });
    const resetBtn = frame.querySelector('[data-plant-reset]');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      spots.forEach((o) => o.el.classList.remove('is-active'));
      flyTo(homeView(camera.aspect));
      setTimeout(() => { controls.autoRotate = !reduce.matches; }, 1400);
    });
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
      fly = null;
      touched = true;
      frame.classList.add('is-touched');
    });

    /* ---------------- кадр ---------------- */
    const tmp = new THREE.Vector3();
    let w = 0, h = 0, touched = false;
    // насколько отодвинуть камеру от общего вида: на узком кадре линия иначе не влезает
    const distK = (aspect) => (aspect < 1.05 ? 1.95 : aspect < 1.45 ? 1.35 : 1);
    function homeView(aspect) {
      const k = distK(aspect);
      return { pos: HOME.target.clone().add(HOME.pos.clone().sub(HOME.target).multiplyScalar(k)), target: HOME.target.clone() };
    }
    function resize() {
      const r = frame.getBoundingClientRect();
      if (r.width === w && r.height === h) return;
      w = r.width;
      h = r.height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!touched && !fly) {
        const v = homeView(camera.aspect);
        camera.position.copy(v.pos);
        controls.target.copy(v.target);
      }
    }

    function placeSpots() {
      for (const s of spots) {
        tmp.copy(s.at).project(camera);
        const hidden = tmp.z > 1;
        s.el.style.left = `${((tmp.x + 1) / 2) * 100}%`;
        s.el.style.top = `${((1 - tmp.y) / 2) * 100}%`;
        s.el.hidden = hidden;
      }
    }

    let t = 0, last = 0, visible = false, running = false;
    function frameTick(now) {
      running = false;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      if (!visible || document.hidden) {
        last = 0;
        return;
      }
      resize();
      t += reduce.matches ? 0 : dt;
      // пачки едут по ленте и исчезают в конце
      const L = 6.2;
      cartons.forEach((c, i) => {
        const u = ((t * 0.45 + i * (L / cartons.length)) % L);
        c.position.x = X4 - 1.1 + u;
        c.visible = u > 0.05 && u < L - 0.05;
      });
      if (fly) {
        fly.t = Math.min(1, fly.t + dt / 1.2);
        const k = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
        camera.position.lerpVectors(fly.p0, fly.p1, k);
        controls.target.lerpVectors(fly.t0, fly.t1, k);
        if (fly.t >= 1) fly = null;
      }
      controls.update();
      renderer.render(scene, camera);
      placeSpots();
      running = true;
      requestAnimationFrame(frameTick);
    }
    function wake() {
      if (running || !visible) return;
      running = true;
      requestAnimationFrame(frameTick);
    }

    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) wake();
    }).observe(frame);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('resize', wake);
    frame.classList.add('is-3d');

    // для проверок: нарисовать кадр сразу (в скрытой вкладке нет requestAnimationFrame)
    api.debugRender = (seconds = 1, view) => {
      visible = true;
      if (view) {
        camera.position.copy(view.pos || camera.position);
        controls.target.copy(view.target || controls.target);
      }
      resize();
      t += seconds;
      cartons.forEach((c, i) => {
        const u = ((t * 0.45 + i * (6.2 / cartons.length)) % 6.2);
        c.position.x = X4 - 1.1 + u;
      });
      controls.update();
      renderer.render(scene, camera);
      placeSpots();
      return 'ok';
    };
    api.flyTo = (i) => spots[i] && spots[i].el.click();
    api.home = HOME;
    return api;
  }
})();
