/*
 * «Молочная ферма»: вся 3D-графика игры на Three.js — одна WebGL-картинка на всё окно игры.
 * Домик-ферма на травяном островке (его тапают: пружинит, наклоняется к пальцу, из трубы дымок)
 * и «уровни» — длинные полосы-диорамы для каждой постройки: луг с коровами, коровник с доярками,
 * пастбища, доильный зал, карусель, дорога с молоковозами, завод, сыроварня, дроны, Млечный Путь.
 * Каждая сцена рисуется в своё «окно» (рамка DOM-элемента), только пока она видна.
 * Модели свои, из простых форм; значки магазина — рендеры тех же моделей.
 * Z.farm.create3D({ canvas, host }) → { frame, resize, bump, setCount, icons, has, stats }
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});
  const F = (Z.farm = Z.farm || {});

  F.create3D = async function ({ canvas, host }) {
    const [THREE, roomMod, rbMod] = await Promise.all([
      import('three'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
    ]);
    const { RoundedBoxGeometry } = rbMod;
    const TAU = Math.PI * 2;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.info.autoReset = false;         // статистика — за весь кадр (дом + все уровни)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new roomMod.RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    /* ================= материалы и заготовки ================= */
    const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0 }, o));
    const M = {
      cream: std(0xf1ece0, { roughness: 0.85 }),
      white: std(0xf7f5ef, { roughness: 0.6 }),
      wood: std(0x8a5a33, { roughness: 0.85 }),
      woodLight: std(0xba8a5c, { roughness: 0.8 }),
      roof: std(0x3f6d2c, { roughness: 0.55 }),
      grass: std(0x5e8f39, { roughness: 0.95 }),
      dirt: std(0x6a4a2d, { roughness: 1 }),
      path: std(0xc8b089, { roughness: 1 }),
      steel: std(0xe3e7ea, { metalness: 0.8, roughness: 0.24, envMapIntensity: 1.8 }),
      warm: std(0xffdc92, { emissive: 0xffbd55, emissiveIntensity: 0.55, roughness: 0.35 }),
      glass: std(0x1f2b2e, { roughness: 0.1, metalness: 0.3 }),
      dark: std(0x222824, { roughness: 0.6 }),
      pink: std(0xe8aba2, { roughness: 0.6 }),
      horn: std(0xefe6cf, { roughness: 0.5 }),
      hay: std(0xd8b45c, { roughness: 0.95 }),
      leaf: std(0x4e8035, { roughness: 0.9, flatShading: true }),
      leafLight: std(0x6fa044, { roughness: 0.9, flatShading: true }),
      green: std(0x5c8f35, { roughness: 0.45 }),
      milk: std(0xfbfaf4, { roughness: 0.28 }),
      skin: std(0xeac3a3, { roughness: 0.7 }),
      cheese: std(0xf3c95e, { roughness: 0.55 }),
      rind: std(0xd79e3c, { roughness: 0.6 }),
      asphalt: std(0x393e3a, { roughness: 0.95 }),
      tile: std(0xd8dcd5, { roughness: 0.55 }),
      floor: std(0x9b7751, { roughness: 0.9 }),
      kraft: std(0xc9a26b, { roughness: 0.9 }),
      lamp: std(0x9be36c, { emissive: 0x7bd14a, emissiveIntensity: 1.3 }),
      jar: new THREE.MeshStandardMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.35, roughness: 0.05 }),
      gold: std(0xf2c14e, { metalness: 0.8, roughness: 0.22, envMapIntensity: 2 }),
    };

    // пятнистая шкура: белая с чёрными пятнами (три варианта — коровы не одинаковые)
    function spotTexture(seed) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#f6f4ee';
      x.fillRect(0, 0, 256, 256);
      let s = seed * 9301 + 49297;
      const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      x.fillStyle = '#1b1d1b';
      for (let i = 0; i < 6; i++) {
        const cx = r() * 256, cy = r() * 256, rr = 22 + r() * 40;
        x.beginPath();
        for (let a = 0; a <= TAU + 0.01; a += TAU / 14) {
          const k = rr * (0.7 + r() * 0.5);
          x.lineTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k * 0.8);
        }
        x.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    const hides = [1, 2, 3].map((i) => std(0xffffff, { map: spotTexture(i), roughness: 0.8 }));

    // мягкая тень под предметом (круг с размытым краем)
    const blobTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
    function blob(w, d) {
      const m = new THREE.Mesh(G(`plane${w},${d}`, () => new THREE.PlaneGeometry(w, d)), blobMat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.012;
      m.renderOrder = -1;
      return m;
    }

    // Одинаковые детали — одна и та же геометрия (кэш по размерам): тогда десятки коров
    // рисуются «пачками» (InstancedMesh, см. batch ниже), а не сотнями отдельных вызовов
    const geoCache = new Map();
    function G(key, make) {
      let g = geoCache.get(key);
      if (!g) geoCache.set(key, (g = make()));
      return g;
    }

    function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      if (parent) parent.add(m);
      return m;
    }
    const box = (w, h, d, mat, p, x, y, z) => mesh(G(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), mat, p, x, y, z);
    const rbox = (w, h, d, r, mat, p, x, y, z) => mesh(G(`rbox${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r)), mat, p, x, y, z);
    const cyl = (rt, rb, h, mat, p, x, y, z, seg = 24) => mesh(G(`cyl${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat, p, x, y, z);
    const ball = (r, mat, p, x, y, z, seg = 16) => mesh(G(`ball${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2))), mat, p, x, y, z);

    function lights(scene, shadows = false) {
      scene.environment = env;
      scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x2b3322, 0.85));
      const key = new THREE.DirectionalLight(0xfff0da, 2.1);
      key.position.set(4, 7, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xcfe3ff, 0.9);
      rim.position.set(-4, 3, -5);
      scene.add(rim);
      if (shadows) {
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        const c = key.shadow.camera;
        c.left = -4; c.right = 4; c.top = 4; c.bottom = -4; c.near = 1; c.far = 20;
        key.shadow.bias = -0.0005;
        key.shadow.radius = 3;
      }
      return key;
    }

    /* ================= модели ================= */
    function cow(v = 0) {
      const g = new THREE.Group();
      const hide = hides[v % 3];
      rbox(1.1, 0.58, 0.54, 0.17, hide, g, 0, 0.74, 0);
      const head = new THREE.Group();
      head.position.set(0.6, 0.94, 0);
      g.add(head);
      rbox(0.36, 0.34, 0.34, 0.1, hide, head, 0.04, 0, 0);
      rbox(0.16, 0.18, 0.3, 0.06, M.pink, head, 0.22, -0.07, 0);
      for (const z of [-0.13, 0.13]) {
        ball(0.028, M.dark, head, 0.17, 0.06, z, 8);
        const horn = mesh(G('horn', () => new THREE.ConeGeometry(0.035, 0.14, 8)), M.horn, head, 0.0, 0.22, z * 0.95);
        horn.rotation.x = z > 0 ? 0.5 : -0.5;
        const ear = box(0.06, 0.07, 0.16, M.pink, head, -0.03, 0.1, z * 1.7);
        ear.rotation.x = z > 0 ? -0.4 : 0.4;
      }
      const legs = [];
      for (const [x, z] of [[0.36, 0.17], [0.36, -0.17], [-0.36, 0.17], [-0.36, -0.17]]) {
        const leg = new THREE.Group();
        leg.position.set(x, 0.5, z);
        g.add(leg);
        cyl(0.07, 0.06, 0.46, M.white, leg, 0, -0.23, 0, 10);
        cyl(0.068, 0.07, 0.07, M.dark, leg, 0, -0.46, 0, 10);
        legs.push(leg);
      }
      const udder = ball(0.13, M.pink, g, -0.18, 0.47, 0, 12);
      udder.scale.set(1, 0.7, 1);
      const tail = new THREE.Group();
      tail.position.set(-0.56, 0.9, 0);
      g.add(tail);
      cyl(0.018, 0.018, 0.42, M.white, tail, 0, -0.21, 0, 6);
      ball(0.05, M.dark, tail, 0, -0.44, 0, 8);
      g.add(blob(1.5, 0.8));
      g.userData = { head, legs, tail };
      return g;
    }

    // доярка: сапожки, юбка с белой каймой, фартук, платок с хвостиком, коса, ведро в руке;
    // «перед» — по +x, как у коровы
    const dressMats = [std(0x4f7f3a), std(0x46679a), std(0x8e4b3f)];
    const scarfMats = [std(0xc8463c, { roughness: 0.7 }), M.white, std(0xe9c46a, { roughness: 0.7 })];
    const hairMat = std(0x6b4526, { roughness: 0.8 });
    function maid(v = 0) {
      const g = new THREE.Group();
      const dress = dressMats[v % 3];
      const scarf = scarfMats[v % 3];
      const legs = [];
      for (const z of [-0.075, 0.075]) {
        const leg = new THREE.Group();
        leg.position.set(0, 0.2, z);
        g.add(leg);
        cyl(0.05, 0.055, 0.17, M.dark, leg, 0, -0.1, 0, 10);
        box(0.13, 0.05, 0.085, M.dark, leg, 0.035, -0.17, 0);
        legs.push(leg);
      }
      cyl(0.15, 0.3, 0.52, dress, g, 0, 0.42, 0, 22);                      // юбка
      cyl(0.302, 0.302, 0.045, M.white, g, 0, 0.18, 0, 22);                // кайма
      const apron = box(0.02, 0.44, 0.24, M.white, g, 0.228, 0.43, 0);
      apron.rotation.z = 0.28;
      rbox(0.27, 0.34, 0.31, 0.09, dress, g, 0, 0.84, 0);                  // кофта
      box(0.02, 0.2, 0.15, M.white, g, 0.14, 0.8, 0);                      // нагрудник фартука
      ball(0.118, M.skin, g, 0.01, 1.13, 0, 18);
      for (const z of [-0.045, 0.045]) ball(0.014, M.dark, g, 0.118, 1.15, z, 6);
      const cap = mesh(G('scarf', () => new THREE.SphereGeometry(0.132, 18, 9, 0, TAU, 0, Math.PI * 0.56)), scarf, g, -0.005, 1.14, 0);
      cap.rotation.z = 0.42;
      const tail = mesh(G('scarfTail', () => new THREE.ConeGeometry(0.075, 0.17, 3)), scarf, g, -0.13, 1.02, 0);
      tail.rotation.z = Math.PI + 0.25;
      const braid = cyl(0.03, 0.018, 0.3, hairMat, g, -0.15, 0.9, 0.05, 8);
      braid.rotation.z = -0.2;
      const arms = [];
      for (const z of [-0.18, 0.18]) {
        const arm = new THREE.Group();
        arm.position.set(0, 0.97, z);
        arm.rotation.x = z > 0 ? -0.12 : 0.12;
        g.add(arm);
        cyl(0.048, 0.04, 0.34, dress, arm, 0, -0.17, 0, 8);
        ball(0.045, M.skin, arm, 0, -0.36, 0, 8);
        arms.push(arm);
      }
      // ведро висит на руке со стороны зрителя и покачивается на ходу
      const bucket = new THREE.Group();
      bucket.position.set(0, -0.37, 0);
      arms[1].add(bucket);
      bucket.rotation.x = 0.12;
      cyl(0.1, 0.08, 0.17, M.steel, bucket, 0, -0.12, 0, 14);
      cyl(0.088, 0.088, 0.01, M.milk, bucket, 0, -0.04, 0, 14);
      const handle = mesh(G('bucketHandle', () => new THREE.TorusGeometry(0.095, 0.007, 6, 16, Math.PI)), M.steel, bucket, 0, -0.04, 0);
      handle.castShadow = false;
      g.add(blob(0.9, 0.8));
      g.userData = { bucket, legs, arms };
      return g;
    }

    function tree(p, x, z, s = 1) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.scale.setScalar(s);
      p.add(g);
      cyl(0.07, 0.1, 0.6, M.wood, g, 0, 0.3, 0, 8);
      const a = mesh(G('crown', () => new THREE.IcosahedronGeometry(0.42, 0)), M.leaf, g, 0, 0.85, 0);
      a.rotation.set(0.3, 0.4, 0);
      mesh(G('crownSmall', () => new THREE.IcosahedronGeometry(0.3, 0)), M.leafLight, g, 0.2, 1.1, 0.1);
      g.add(blob(1.1, 1.1));
      return g;
    }

    function hayBale(p, x, z, rot = 0) {
      const b = cyl(0.28, 0.28, 0.45, M.hay, p, x, 0.28, z, 18);
      b.rotation.set(Math.PI / 2, 0, rot);
      return b;
    }

    function milkCan(p, x, z) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      p.add(g);
      cyl(0.12, 0.13, 0.32, M.steel, g, 0, 0.16, 0, 16);
      cyl(0.07, 0.11, 0.1, M.steel, g, 0, 0.37, 0, 16);
      cyl(0.08, 0.08, 0.04, M.steel, g, 0, 0.44, 0, 16);
      return g;
    }

    function fence(p, x0, x1, z, h = 0.5) {
      const n = Math.max(2, Math.round((x1 - x0) / 0.8) + 1);
      for (let i = 0; i < n; i++) box(0.07, h, 0.07, M.woodLight, p, x0 + ((x1 - x0) * i) / (n - 1), h / 2, z);
      for (const y of [h * 0.45, h * 0.85]) box(x1 - x0, 0.05, 0.04, M.woodLight, p, (x0 + x1) / 2, y, z);
    }

    function machine() {
      const g = new THREE.Group();
      rbox(0.5, 0.9, 0.42, 0.05, M.steel, g, 0, 0.45, 0);
      const jar = cyl(0.14, 0.14, 0.34, M.jar, g, 0, 1.08, 0, 20);
      jar.castShadow = false;
      const milk = cyl(0.125, 0.125, 0.3, M.milk, g, 0, 1.06, 0, 20);
      box(0.3, 0.12, 0.02, M.glass, g, 0, 0.6, 0.22);
      const lamp = ball(0.035, M.lamp, g, 0.16, 0.8, 0.22, 10);
      mesh(G('hose', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.1, 0.95, 0.1), new THREE.Vector3(0.45, 0.8, 0.25), new THREE.Vector3(0.6, 0.35, 0.15),
      ]), 20, 0.02, 8, false)), M.dark, g);
      g.add(blob(0.9, 0.7));
      g.userData = { milk, lamp };
      return g;
    }

    function tanker() {
      const g = new THREE.Group();
      rbox(0.62, 0.58, 0.62, 0.1, M.green, g, 0.95, 0.52, 0);
      box(0.02, 0.24, 0.5, M.glass, g, 1.27, 0.62, 0);
      box(2.3, 0.12, 0.5, M.dark, g, 0.1, 0.22, 0);
      const tank = cyl(0.33, 0.33, 1.5, M.steel, g, -0.2, 0.62, 0, 28);
      tank.rotation.z = Math.PI / 2;
      for (const x of [-0.95, 0.55]) {
        const cap = ball(0.33, M.steel, g, x, 0.62, 0, 20);
        cap.scale.set(0.35, 1, 1);
      }
      box(1.2, 0.05, 0.14, M.green, g, -0.2, 0.96, 0);
      const wheels = [];
      for (const x of [-0.75, -0.35, 0.95]) {
        for (const z of [-0.27, 0.27]) {
          const w = cyl(0.14, 0.14, 0.1, M.dark, g, x, 0.14, z, 16);
          w.rotation.x = Math.PI / 2;
          wheels.push(w);
        }
      }
      g.add(blob(2.8, 1.0));
      g.userData = { wheels };
      return g;
    }

    function tankUnit() {
      const g = new THREE.Group();
      cyl(0.36, 0.36, 1.1, M.steel, g, 0, 0.85, 0, 28);
      const dome = mesh(G('tankDome', () => new THREE.SphereGeometry(0.36, 24, 10, 0, TAU, 0, Math.PI / 2)), M.steel, g, 0, 1.4, 0);
      dome.scale.y = 0.45;
      cyl(0.36, 0.08, 0.22, M.steel, g, 0, 0.19, 0, 28);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        cyl(0.025, 0.025, 0.3, M.steel, g, Math.cos(a) * 0.28, 0.15, Math.sin(a) * 0.28, 6);
      }
      box(0.74, 0.05, 0.05, M.green, g, 0, 1.2, 0.35);
      g.add(blob(1.0, 1.0));
      return g;
    }

    function cheeseRack() {
      const g = new THREE.Group();
      for (const x of [-0.5, 0.5]) box(0.05, 1.3, 0.4, M.wood, g, x, 0.65, 0);
      const wheels = [];
      for (const y of [0.18, 0.62, 1.06]) {
        box(1.05, 0.04, 0.42, M.woodLight, g, 0, y, 0);
        for (const x of [-0.26, 0.26]) {
          const w = new THREE.Group();
          w.position.set(x, y + 0.1, 0);
          g.add(w);
          cyl(0.2, 0.2, 0.16, M.cheese, w, 0, 0, 0, 24);
          const rim = mesh(G('cheeseRim', () => new THREE.TorusGeometry(0.2, 0.02, 6, 24)), M.rind, w, 0, 0.07, 0);
          rim.rotation.x = Math.PI / 2;
          wheels.push(w);
        }
      }
      g.add(blob(1.4, 0.7));
      g.userData = { wheels };
      return g;
    }

    function drone() {
      const g = new THREE.Group();
      rbox(0.52, 0.12, 0.52, 0.05, M.white, g, 0, 0, 0);
      box(0.54, 0.03, 0.12, M.green, g, 0, 0.05, 0);
      const rotors = [];
      for (const [x, z] of [[0.36, 0.36], [-0.36, 0.36], [0.36, -0.36], [-0.36, -0.36]]) {
        const arm = box(0.3, 0.03, 0.04, M.white, g, x * 0.6, 0, z * 0.6);
        arm.rotation.y = Math.atan2(-z, x);
        const r = new THREE.Group();
        r.position.set(x, 0.05, z);
        g.add(r);
        box(0.36, 0.01, 0.04, M.dark, r, 0, 0, 0);
        box(0.04, 0.01, 0.36, M.dark, r, 0, 0, 0);
        rotors.push(r);
      }
      cyl(0.005, 0.005, 0.28, M.dark, g, 0, -0.18, 0, 4);
      rbox(0.26, 0.2, 0.2, 0.03, M.kraft, g, 0, -0.42, 0);
      box(0.27, 0.05, 0.21, M.green, g, 0, -0.38, 0);
      g.userData = { rotors };
      return g;
    }

    /* ================= домик-ферма ================= */
    function signTexture() {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 240;
      const x = c.getContext('2d');
      x.fillStyle = '#2f5824';
      x.fillRect(0, 0, 1024, 240);
      x.strokeStyle = '#e9e1c7';
      x.lineWidth = 10;
      x.strokeRect(14, 14, 996, 212);
      x.fillStyle = '#f4efdf';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      // надпись — на всю вывеску: кегль подбирается по ширине
      const font = (px) => `500 ${px}px "Wix Madefor Display", "Wix Madefor Text", sans-serif`;
      x.font = font(100);
      const px = Math.min(150, Math.floor((100 * 900) / x.measureText('МОЛОЧНАЯ ФЕРМА').width));
      x.font = font(px);
      x.fillText('МОЛОЧНАЯ ФЕРМА', 512, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    }

    function plankTexture(base, line, vertical = false) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = base;
      x.fillRect(0, 0, 256, 256);
      x.fillStyle = line;
      for (let i = 0; i < 256; i += 32) {
        if (vertical) x.fillRect(i, 0, 3, 256);
        else x.fillRect(0, i, 256, 3);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }

    async function buildHouse() {
      const scene = new THREE.Scene();
      lights(scene, true);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
      // Камера подбирает расстояние так, чтобы островок целиком влез в рамку любой пропорции
      // (с запасом на пружинку); в высокой узкой рамке смотрит круче сверху — островок
      // тогда выше на картинке и крупнее. Опорные точки: край островка, крыша, силос, труба, дерево.
      const aim = new THREE.Vector3(-0.1, 0.85, 0);
      const keyPts = [];
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * TAU;
        keyPts.push(new THREE.Vector3(Math.cos(a) * 2.7, 0.04, Math.sin(a) * 2.7));
        keyPts.push(new THREE.Vector3(Math.cos(a) * 2.35, -0.5, Math.sin(a) * 2.35));
      }
      keyPts.push(new THREE.Vector3(0.1, 2.15, -0.15), new THREE.Vector3(-1.65, 2.45, -0.6),
        new THREE.Vector3(-0.55, 2.55, -0.3), new THREE.Vector3(-1.55, 1.35, 1.2));
      const pv = new THREE.Vector3();
      const az = Math.atan2(5.6, 7.4);
      camera.userData.fit = (aspect) => {
        if (camera.userData.aspect === aspect) return;
        camera.userData.aspect = aspect;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        const elev = aspect < 0.85 ? 0.46 : 0.33;
        const dir = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
        const fits = (d) => {
          camera.position.copy(aim).addScaledVector(dir, d);
          camera.lookAt(aim);
          camera.updateMatrixWorld();
          for (const p of keyPts) {
            pv.copy(p).project(camera);
            if (Math.abs(pv.x) > 0.93 || Math.abs(pv.y) > 0.9) return false;
          }
          return true;
        };
        let lo = 4, hi = 80;
        for (let i = 0; i < 22; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) hi = mid;
          else lo = mid;
        }
        fits(hi);
      };
      camera.userData.fit(1);

      const root = new THREE.Group();           // сжимается при тапе (опора — низ островка)
      scene.add(root);
      const island = new THREE.Group();
      root.add(island);
      const top = mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.08, 64), M.grass, island, 0, 0, 0);
      top.receiveShadow = true;
      mesh(new THREE.CylinderGeometry(2.7, 2.35, 0.46, 64), M.dirt, island, 0, -0.27, 0);
      const pathM = mesh(new THREE.PlaneGeometry(0.8, 1.9), M.path, island, 0.35, 0.045, 1.75);
      pathM.rotation.x = -Math.PI / 2;

      const house = new THREE.Group();
      house.position.set(0.1, 0.04, -0.15);
      root.add(house);
      const wallMat = std(0xffffff, { map: plankTexture('#f1ece0', '#d9d2bf'), roughness: 0.85 });
      box(2.2, 1.35, 1.6, wallMat, house, 0, 0.675, 0);
      box(2.26, 0.1, 1.66, M.woodLight, house, 0, 0.05, 0);                 // цоколь
      // двускатная крыша: скаты вдоль z, фронтоны спереди и сзади
      const pitch = 0.62, halfW = 1.2, slab = halfW / Math.cos(pitch) + 0.08;
      for (const side of [-1, 1]) {
        const r = box(slab, 0.09, 1.9, M.roof, house, side * halfW * 0.5, 1.35 + Math.tan(pitch) * halfW * 0.5, 0);
        r.rotation.z = -side * pitch;
      }
      box(0.1, 0.1, 1.95, M.roof, house, 0, 1.35 + Math.tan(pitch) * halfW + 0.02, 0);
      const gable = new THREE.Shape();
      gable.moveTo(-1.1, 0);
      gable.lineTo(1.1, 0);
      gable.lineTo(0, Math.tan(pitch) * 1.1);
      gable.closePath();
      const gGeo = new THREE.ExtrudeGeometry(gable, { depth: 0.04, bevelEnabled: false });
      for (const z of [0.79, -0.83]) mesh(gGeo, M.cream, house, 0, 1.35, z);
      const round = mesh(new THREE.CircleGeometry(0.16, 24), M.warm, house, 0, 1.62, 0.84);
      round.castShadow = false;
      const rf = mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24), M.white, house, 0, 1.62, 0.845);
      rf.castShadow = false;
      // вывеска над дверью — во всю ширину фасада и ниже свеса крыши, чтобы читалась целиком
      const sign = mesh(new THREE.PlaneGeometry(1.96, 0.46), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6 }), house, 0, 1.07, 0.837);
      sign.castShadow = false;
      box(2.04, 0.52, 0.04, M.wood, house, 0, 1.07, 0.81);
      // двустворчатая дверь с перекрестьями
      box(0.86, 0.76, 0.05, M.wood, house, 0, 0.43, 0.815);
      for (const x of [-0.215, 0.215]) {
        for (const s of [1, -1]) {
          const brace = box(0.05, 0.84, 0.02, M.woodLight, house, x, 0.43, 0.845);
          brace.rotation.z = s * 0.5;
        }
        box(0.43, 0.05, 0.02, M.woodLight, house, x, 0.08, 0.845);
        box(0.43, 0.05, 0.02, M.woodLight, house, x, 0.78, 0.845);
      }
      // окна с тёплым светом по бокам
      for (const side of [-1, 1]) {
        for (const z of [-0.4, 0.4]) {
          const w = box(0.03, 0.42, 0.36, M.warm, house, side * 1.105, 0.78, z);
          w.castShadow = false;
          box(0.04, 0.46, 0.05, M.white, house, side * 1.11, 0.78, z);
          box(0.04, 0.05, 0.4, M.white, house, side * 1.11, 0.78, z);
        }
      }
      // труба и дымок
      box(0.2, 0.5, 0.2, M.wood, house, -0.55, 1.95, -0.3);
      const smoke = [];
      const smokeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, transparent: true, opacity: 0.6, roughness: 1 });
      for (let i = 0; i < 6; i++) {
        const p = ball(0.1, smokeMat.clone(), house, -0.55, 2.3, -0.3, 10);
        p.castShadow = false;
        p.userData.phase = i / 6;
        smoke.push(p);
      }
      // силос, бидоны, стог, дерево, забор
      const silo = new THREE.Group();
      silo.position.set(-1.65, 0.04, -0.6);
      root.add(silo);
      const siloMat = std(0xffffff, { map: plankTexture('#ece6d6', '#cfc6ae', false), roughness: 0.8 });
      cyl(0.42, 0.42, 2.1, siloMat, silo, 0, 1.05, 0, 28);
      const sdome = mesh(new THREE.SphereGeometry(0.44, 28, 12, 0, TAU, 0, Math.PI / 2), M.roof, silo, 0, 2.1, 0);
      sdome.scale.y = 0.7;
      for (let y = 0.3; y < 2.0; y += 0.22) box(0.16, 0.025, 0.025, M.steel, silo, 0.3, y, 0.33);
      milkCan(root, 0.85, 0.95);
      milkCan(root, 1.08, 0.82);
      hayBale(root, 1.75, 0.2, 0.3);
      hayBale(root, 1.55, -0.55, -0.4);
      tree(root, -1.55, 1.2, 1.05);
      fence(root, -2.3, -0.7, 1.95, 0.42);
      // вывеска — шрифтом сайта: дождаться его и перерисовать надпись
      try {
        await document.fonts.load('500 104px "Wix Madefor Display"');
      } catch (e) { /* без шрифта — запасной */ }
      sign.material.map = signTexture();
      sign.material.needsUpdate = true;

      // пружина: сжатие по высоте и небольшой наклон к месту тапа
      const spring = { d: 0, v: 0, tx: 0, tz: 0 };
      let t = 0;
      return {
        scene, camera, root, spring,
        bump(nx, ny) {
          spring.v -= 2.6;
          spring.tx += ny * 0.08;
          spring.tz -= nx * 0.08;
        },
        update(dt) {
          t += dt;
          const k = 420, c = 17;
          spring.v += (-k * spring.d - c * spring.v) * dt;
          spring.d += spring.v * dt;
          spring.d = Math.max(-0.12, Math.min(0.1, spring.d));
          root.scale.set(1 - spring.d * 0.5, 1 + spring.d, 1 - spring.d * 0.5);
          spring.tx *= Math.exp(-dt * 6);
          spring.tz *= Math.exp(-dt * 6);
          // фасад с вывеской повёрнут к зрителю, островок чуть покачивается
          root.rotation.set(spring.tx, Math.sin(t * 0.35) * 0.08 + 0.22, spring.tz);
          for (const p of smoke) {
            const u = (t * 0.22 + p.userData.phase) % 1;
            p.position.set(-0.55 + Math.sin(u * 6 + p.userData.phase * 9) * 0.08 + u * 0.25, 2.25 + u * 1.2, -0.3 - u * 0.1);
            p.scale.setScalar(0.6 + u * 1.6);
            p.material.opacity = 0.55 * (1 - u);
          }
        },
      };
    }

    /* ================= уровни ================= */
    // Общая «полоса»: сцена, свет, камера смотрит сбоку чуть сверху; land — земля своего цвета.
    // В узкой рамке (телефон) камера отъезжает, чтобы середина полосы ±VIEW всегда была видна.
    const VIEW = 6.8, WALK = 7.2;
    function strip(ground, back) {
      const scene = new THREE.Scene();
      lights(scene, false);
      const camera = new THREE.PerspectiveCamera(26, 4, 0.1, 80);
      const aim = new THREE.Vector3(0, 0.62, 0);
      const dir = new THREE.Vector3(0, 1.68, 7.6).normalize();
      camera.userData.fit = (aspect) => {
        const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        camera.position.copy(aim).addScaledVector(dir, Math.max(7.78, VIEW / (t * aspect)));
        camera.lookAt(aim);
      };
      camera.userData.fit(4);
      // земля тянется к зрителю: когда камера отъезжает (узкая рамка), низ кадра всё равно — земля
      const land = mesh(new THREE.BoxGeometry(26, 0.3, 8), ground, scene, 0, -0.15, 2.2);
      land.receiveShadow = true;
      if (back) scene.add(back);
      return { scene, camera, items: [], count: 0 };
    }

    // детерминированный «случай»: предметы уровня не прыгают при перерисовке
    const seeded = (seed) => {
      let s = seed;
      return () => ((s = (s * 16807) % 2147483647) / 2147483647);
    };
    // места для неподвижных построек — от середины полосы к краям: 0, −1, +1, −2, +2…
    const fromCenter = (i, step) => (i % 2 ? -1 : 1) * Math.ceil(i / 2) * step;
    // в два ряда: задний и передний (со сдвигом на полшага), тоже от середины
    function twoRows(obj, i, step) {
      const row = i % 2;
      obj.position.set(fromCenter(Math.floor(i / 2), step) + row * step * 0.5, 0, row ? 0.5 : -0.55);
      return obj;
    }

    function popIn(obj) {
      obj.userData.pop = 0;
      obj.scale.setScalar(0.01);
    }
    function grow(obj, dt, base = 1) {
      if (obj.userData.pop === undefined) return;
      obj.userData.pop = Math.min(1, obj.userData.pop + dt * 3);
      const p = obj.userData.pop;
      const s = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.25 - (1 - p) * 0.9 : 1;
      obj.scale.setScalar(Math.max(0.01, s) * base);
      if (p >= 1) delete obj.userData.pop;
    }

    const LAYERS = {
      cow: {
        cap: 26,
        make() {
          const s = strip(M.grass);
          fence(s.scene, -12, 12, -1.5, 0.55);
          const r = seeded(11);
          for (let i = 0; i < 40; i++) {
            const f = ball(0.04, [M.white, M.cheese, M.pink][i % 3], s.scene, -11 + r() * 22, 0.03, -1.2 + r() * 2.6, 6);
            f.castShadow = false;
          }
          return s;
        },
        add(s, i) {
          const r = seeded(100 + i);
          const c = cow(i);
          c.position.set(((i * 3.37 + 7) % 14) - 7, 0, -0.9 + r() * 1.9);
          c.userData.speed = (0.18 + r() * 0.2) * (r() < 0.5 ? 1 : -1);
          c.userData.phase = r() * TAU;
          c.rotation.y = c.userData.speed > 0 ? -0.15 : Math.PI + 0.15;
          return c;
        },
        tick(s, c, t, dt) {
          const u = c.userData;
          const grazing = Math.sin(t * 0.4 + u.phase) > 0.2;
          if (!grazing) {
            c.position.x += u.speed * dt;
            if (Math.abs(c.position.x) > WALK) {
              c.position.x = Math.sign(c.position.x) * WALK;
              u.speed = -u.speed;
              c.rotation.y = u.speed > 0 ? -0.15 : Math.PI + 0.15;
            }
            u.legs.forEach((l, k) => (l.rotation.z = Math.sin(t * 7 + u.phase + (k % 2) * Math.PI) * 0.35));
          }
          u.head.rotation.z = grazing ? -0.55 + Math.sin(t * 3 + u.phase) * 0.06 : Math.sin(t * 1.5 + u.phase) * 0.05;
          u.tail.rotation.x = Math.sin(t * 2.2 + u.phase) * 0.3;
        },
      },
      maid: {
        cap: 18,
        make() {
          const floorMat = std(0xffffff, { map: plankTexture('#9b7751', '#7e5f3f', true), roughness: 0.9 });
          const back = new THREE.Group();
          const wallMat = std(0xffffff, { map: plankTexture('#cbb89a', '#a99577'), roughness: 0.9 });
          box(26, 2.2, 0.1, wallMat, back, 0, 1.1, -1.7);
          for (let x = -10; x <= 10; x += 3.2) {
            const w = box(0.7, 0.45, 0.04, M.warm, back, x, 1.5, -1.64);
            w.castShadow = false;
          }
          const s = strip(floorMat, back);
          for (let x = -9; x <= 9; x += 4.5) hayBale(s.scene, x, -1.2, 0.2);
          return s;
        },
        add(s, i) {
          const r = seeded(300 + i);
          const m = maid(i);
          m.position.set(((i * 2.91 + 7) % 14) - 7, 0, -0.6 + r() * 1.5);
          m.userData.speed = (0.35 + r() * 0.25) * (r() < 0.5 ? 1 : -1);
          m.userData.phase = r() * TAU;
          m.rotation.y = m.userData.speed > 0 ? -0.45 : Math.PI + 0.45;
          return m;
        },
        tick(s, m, t, dt) {
          const u = m.userData;
          m.position.x += u.speed * dt;
          if (Math.abs(m.position.x) > WALK) {
            m.position.x = Math.sign(m.position.x) * WALK;
            u.speed = -u.speed;
            m.rotation.y = u.speed > 0 ? -0.45 : Math.PI + 0.45;
          }
          const w = t * 6 + u.phase;
          m.position.y = Math.abs(Math.sin(w)) * 0.025;
          u.legs.forEach((l, k) => (l.rotation.z = Math.sin(w + k * Math.PI) * 0.4));
          u.arms[0].rotation.z = Math.sin(w + Math.PI) * 0.3;
          u.bucket.rotation.z = Math.sin(w) * 0.14;
        },
      },
      pasture: {
        cap: 11,
        make() {
          const s = strip(M.grass);
          // холмы вдали
          for (let i = 0; i < 7; i++) {
            const h = mesh(G('hill', () => new THREE.SphereGeometry(2.4, 24, 12, 0, TAU, 0, Math.PI / 2)), i % 2 ? M.leafLight : M.grass, s.scene, -12 + i * 4, -0.4, -2.6);
            h.scale.set(1.2, 0.45, 0.6);
          }
          return s;
        },
        add(s, i) {
          const g = new THREE.Group();
          const r = seeded(500 + i);
          g.position.set(fromCenter(i, 1.35) + (r() - 0.5) * 0.4, 0, -0.8 + r() * 1.6);
          for (let k = 0; k < 18; k++) {
            const f = ball(0.045, [M.white, M.pink, M.cheese][k % 3], g, (r() - 0.5) * 1.6, 0.05, (r() - 0.5) * 1.1, 6);
            f.castShadow = false;
          }
          if (i % 3 === 0) tree(g, 0.3, -0.2, 0.9);
          else if (i % 3 === 1) hayBale(g, 0, 0, r() * 2);
          else fence(g, -0.7, 0.7, 0, 0.4);
          return g;
        },
        tick(s, g, t) {
          g.rotation.z = Math.sin(t * 0.8 + g.position.x) * 0.004;
        },
      },
      machine: {
        cap: 20,
        // доильный зал: тёмный наливной пол, зелёная панель по низу стены, над ней — молокопровод
        make() {
          const back = new THREE.Group();
          box(26, 2.2, 0.1, std(0xb9c4bd, { roughness: 0.6 }), back, 0, 1.1, -1.7);
          box(26, 0.85, 0.12, std(0x2f5a3a, { roughness: 0.5 }), back, 0, 0.425, -1.64);
          const line = cyl(0.05, 0.05, 26, M.steel, back, 0, 1.38, -1.55, 12);
          line.rotation.z = Math.PI / 2;
          for (let x = -11; x <= 11; x += 2.6) {
            const lamp = box(0.5, 0.06, 0.2, M.warm, back, x, 2.05, -1.5);
            lamp.castShadow = false;
          }
          return strip(std(0x56625a, { roughness: 0.45 }), back);
        },
        add(s, i) {
          const m = twoRows(machine(), i, 1.3);
          m.userData.phase = i * 0.7;
          m.userData.lamp.material = M.lamp.clone();
          return m;
        },
        tick(s, m, t) {
          const u = m.userData;
          u.milk.scale.y = 0.35 + (Math.sin(t * 0.9 + u.phase) * 0.5 + 0.5) * 0.65;
          u.milk.position.y = 0.91 + u.milk.scale.y * 0.15;
          u.lamp.material.emissiveIntensity = Math.sin(t * 4 + u.phase) > 0 ? 1.4 : 0.2;
        },
      },
      carousel: {
        cap: 18,
        make() {
          const s = strip(M.tile);
          const deck = new THREE.Group();
          deck.position.set(0, 0, -0.3);
          s.scene.add(deck);
          cyl(2.3, 2.3, 0.16, M.steel, deck, 0, 0.08, 0, 48);
          cyl(0.4, 0.4, 1.4, M.steel, deck, 0, 0.7, 0, 24);
          const cone = mesh(new THREE.ConeGeometry(0.8, 0.5, 24), M.roof, deck, 0, 1.6, 0);
          cone.castShadow = true;
          for (let k = 0; k < 18; k++) {
            const a = (k / 18) * TAU;
            const bar = box(0.04, 0.6, 1.1, M.steel, deck, Math.cos(a) * 1.7, 0.45, Math.sin(a) * 1.7);
            bar.rotation.y = -a;
          }
          s.deck = deck;
          return s;
        },
        add(s, i) {
          const a = (i / 18) * TAU + TAU / 36;
          const c = cow(i);
          c.scale.setScalar(0.62);
          c.position.set(Math.cos(a) * 1.72, 0.16, Math.sin(a) * 1.72);
          c.rotation.y = -a + Math.PI;
          s.deck.add(c);
          c.userData.base = 0.62;
          return c;
        },
        tick(s, c, t, dt, first) {
          if (first) s.deck.rotation.y += dt * 0.25;
        },
        own: true,
      },
      tanker: {
        cap: 8,
        make() {
          const s = strip(M.grass);
          box(26, 0.02, 1.4, M.asphalt, s.scene, 0, 0.01, 0.1);
          for (let x = -12; x < 12; x += 1.2) box(0.55, 0.021, 0.07, M.white, s.scene, x, 0.012, 0.1);
          for (let x = -11; x <= 11; x += 2.6) tree(s.scene, x, -1.3, 0.8 + ((x * 7) % 3) * 0.1);
          return s;
        },
        add(s, i) {
          const tk = tanker();
          tk.position.set(((i * 2.9 + 8.5) % 23) - 11.5, 0, 0.1);
          tk.userData.speed = 1.2;
          return tk;
        },
        tick(s, tk, t, dt) {
          tk.position.x += tk.userData.speed * dt;
          if (tk.position.x > 11.5) tk.position.x -= 23;
          tk.userData.wheels.forEach((w) => (w.rotation.y += dt * 8));
        },
      },
      plant: {
        cap: 16,
        make() {
          const back = new THREE.Group();
          box(26, 2.4, 0.1, M.cream, back, 0, 1.2, -1.75);
          for (let x = -11; x <= 11; x += 2.2) {
            const w = box(1.1, 0.5, 0.04, M.glass, back, x, 1.7, -1.69);
            w.castShadow = false;
          }
          box(26, 0.14, 0.12, M.green, back, 0, 0.9, -1.66);
          const s = strip(M.tile, back);
          const pipe = cyl(0.06, 0.06, 26, M.steel, s.scene, 0, 0.45, -0.8, 12);
          pipe.rotation.z = Math.PI / 2;
          return s;
        },
        add(s, i) {
          return twoRows(tankUnit(), i, 1.55);
        },
        tick() {},
      },
      cheese: {
        cap: 14,
        make() {
          const floorMat = std(0xffffff, { map: plankTexture('#6d4f33', '#553b25', true), roughness: 0.9 });
          const back = new THREE.Group();
          box(26, 2.4, 0.1, std(0x4a3a2c, { roughness: 0.95 }), back, 0, 1.2, -1.7);
          return strip(floorMat, back);
        },
        add(s, i) {
          const r = twoRows(cheeseRack(), i, 1.5);
          r.userData.phase = i;
          return r;
        },
        tick(s, r, t) {
          const w = r.userData.wheels[Math.floor(t * 0.3 + r.userData.phase) % r.userData.wheels.length];
          w.rotation.y += 0.02;
        },
      },
      drone: {
        cap: 12,
        make() {
          const s = strip(M.grass);
          box(26, 0.02, 1.2, M.asphalt, s.scene, 0, 0.01, 0.4);
          for (let x = -11; x <= 11; x += 3.1) tree(s.scene, x, -1.4, 0.7);
          return s;
        },
        add(s, i) {
          const r = seeded(900 + i);
          const d = drone();
          d.position.set(((i * 3.3 + 10) % 22) - 11, 1.1 + r() * 0.9, -0.8 + r() * 1.6);
          d.userData.speed = 0.9 + r() * 0.6;
          d.userData.phase = r() * TAU;
          return d;
        },
        tick(s, d, t, dt) {
          const u = d.userData;
          d.position.x += u.speed * dt;
          if (d.position.x > 11) d.position.x -= 22;
          d.position.y += Math.sin(t * 2 + u.phase) * 0.002;
          d.rotation.z = -0.08;
          u.rotors.forEach((r) => (r.rotation.y += dt * 30));
        },
      },
      galaxy: {
        cap: 40,
        make() {
          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(30, 4, 0.1, 80);
          camera.position.set(0, 3.2, 6.4);
          camera.lookAt(0, 0, 0);
          const stars = new THREE.BufferGeometry();
          const p = [], c = [];
          const r = seeded(77);
          for (let i = 0; i < 900; i++) {
            p.push((r() - 0.5) * 30, (r() - 0.5) * 8, -3 - r() * 6);
            const k = 0.6 + r() * 0.4;
            c.push(k, k, k * 1.05);
          }
          stars.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
          stars.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
          scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, depthWrite: false })));
          const galaxy = new THREE.Group();
          scene.add(galaxy);
          return { scene, camera, items: [], count: 0, galaxy };
        },
        // каждый «рукав» — спираль из частиц молочного цвета
        add(s, i) {
          const geo = new THREE.BufferGeometry();
          const p = [], c = [];
          const r = seeded(1200 + i);
          const arm = (i % 4) * (TAU / 4) + Math.floor(i / 4) * 0.35;
          for (let k = 0; k < 320; k++) {
            const d = Math.pow(r(), 0.7) * 3.2;
            const a = arm + d * 1.35 + (r() - 0.5) * 0.45;
            p.push(Math.cos(a) * d, (r() - 0.5) * 0.12 * (3.4 - d), Math.sin(a) * d);
            const warm = 0.88 + r() * 0.12;
            c.push(warm, warm * 0.98, warm * (0.9 + r() * 0.15));
          }
          geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
          geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
          const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
          s.galaxy.add(pts);
          return pts;
        },
        tick(s, pts, t, dt, first) {
          if (first) s.galaxy.rotation.y += dt * 0.12;
        },
        own: true,
      },
    };

    const layers = new Map();          // id → сцена уровня
    function layer(id) {
      if (!layers.has(id)) {
        const def = LAYERS[id];
        const s = def.make();
        s.def = def;
        s.t = 0;
        s.batches = [];
        s.dirty = true;
        s.scene.matrixWorldAutoUpdate = false;   // матрицы считает syncBatches перед кадром
        layers.set(id, s);
      }
      return layers.get(id);
    }
    function setCount(id, n, animate = true) {
      const def = LAYERS[id];
      if (!def) return;
      const s = layer(id);
      const want = Math.min(n, def.cap);
      while (s.items.length < want) {
        const obj = def.add(s, s.items.length);
        if (!def.own) s.scene.add(obj);
        if (animate) popIn(obj);
        s.items.push(obj);
        s.dirty = true;
      }
      s.count = n;
    }

    // Пачки: одинаковые детали уровня (та же геометрия и тот же материал — ноги всех коров,
    // все цветочки луга) рисуются одним InstancedMesh. Исходные меши остаются в сцене
    // невидимыми и двигаются как раньше; их мировые матрицы каждый кадр копируются в экземпляры.
    // Без этого уровень с десятком коров — сотни вызовов отрисовки, и игра заметно тормозит.
    function rebatch(s) {
      s.dirty = false;
      for (const b of s.batches) {
        s.scene.remove(b.inst);
        b.inst.dispose();
        for (const m of b.list) m.visible = true;
      }
      const groups = new Map();
      s.scene.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh) return;
        const key = `${o.geometry.id}:${o.material.id}`;
        const list = groups.get(key);
        if (list) list.push(o);
        else groups.set(key, [o]);
      });
      s.batches = [];
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        const inst = new THREE.InstancedMesh(list[0].geometry, list[0].material, list.length);
        inst.frustumCulled = false;
        inst.renderOrder = list[0].renderOrder;
        inst.castShadow = list[0].castShadow;
        inst.receiveShadow = list[0].receiveShadow;
        inst.matrixAutoUpdate = false;
        for (const m of list) m.visible = false;
        s.scene.add(inst);
        s.batches.push({ inst, list });
      }
    }
    function syncBatches(s) {
      if (s.dirty) rebatch(s);
      s.scene.updateMatrixWorld();
      for (const { inst, list } of s.batches) {
        for (let i = 0; i < list.length; i++) inst.setMatrixAt(i, list[i].matrixWorld);
        inst.instanceMatrix.needsUpdate = true;
      }
    }

    const house = await buildHouse();
    // домик — тоже пачками (доски, стойки забора, ступеньки силоса, бидоны)
    const houseBatch = { scene: house.scene, batches: [], dirty: true };
    house.scene.matrixWorldAutoUpdate = false;

    /* ================= кадр ================= */
    // Размер холста — по раскладке окна, а не по экранной рамке: пока окно «раскрывается» из
    // карточки, оно отмасштабировано, и рамка на экране меньше настоящей
    let W = 0, H = 0;
    function resize() {
      const w = host.clientWidth, h = host.clientHeight;
      if (w === W && h === H) return;
      W = w;
      H = h;
      renderer.setSize(w, h, false);
    }
    resize();

    // before — подготовка сцены, только если она сейчас видна (невидимые уровни не считаются)
    function drawInto(scene, camera, el, clipEl, hb, k, before) {
      const r = el.getBoundingClientRect();
      let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
      if (clipEl) {
        const c = clipEl.getBoundingClientRect();
        x0 = Math.max(x0, c.left); y0 = Math.max(y0, c.top); x1 = Math.min(x1, c.right); y1 = Math.min(y1, c.bottom);
      }
      if (x1 - x0 < 2 || y1 - y0 < 2 || r.width < 2) return false;
      if (before) before();
      // экранные координаты → координаты холста (с поправкой на масштаб окна)
      const L = (v) => (v - hb.left) / k, T = (v) => (v - hb.top) / k;
      renderer.setViewport(L(r.left), H - T(r.bottom), r.width / k, r.height / k);
      renderer.setScissor(L(x0), H - T(y1), (x1 - x0) / k, (y1 - y0) / k);
      camera.aspect = r.width / r.height;
      if (camera.userData.fit) camera.userData.fit(camera.aspect);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      return true;
    }

    // dt — шаг времени; targets: { house: el, layers: [[id, el]], clip: el }
    function frame(dt, targets) {
      resize();
      const hb = host.getBoundingClientRect();
      const k = hb.width / (host.clientWidth || 1) || 1;
      renderer.info.reset();
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);
      house.update(dt);
      if (targets.house) drawInto(house.scene, house.camera, targets.house, null, hb, k, () => syncBatches(houseBatch));
      for (const [id, el] of targets.layers || []) {
        const s = layers.get(id);
        if (!s) continue;
        s.t += dt;
        s.items.forEach((obj, i) => {
          grow(obj, dt, obj.userData.base || 1);
          s.def.tick(s, obj, s.t, dt, i === 0);
        });
        drawInto(s.scene, s.camera, el, targets.clip, hb, k, () => syncBatches(s));
      }
    }

    /* ================= значки магазина ================= */
    async function icons() {
      const size = 160;
      const off = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      off.setSize(size, size, false);
      off.outputColorSpace = THREE.SRGBColorSpace;
      off.toneMapping = THREE.ACESFilmicToneMapping;
      off.setClearColor(0x000000, 0);
      const offPm = new THREE.PMREMGenerator(off);
      const offEnv = offPm.fromScene(new roomMod.RoomEnvironment(), 0.04).texture;
      const out = {};
      const shots = {
        cow: () => cow(0),
        maid: () => maid(0),
        pasture: () => {
          const g = new THREE.Group();
          mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 32), M.grass, g, 0, -0.04, 0);
          tree(g, -0.3, -0.2, 0.9);
          hayBale(g, 0.4, 0.2, 0.6);
          return g;
        },
        machine,
        carousel: () => {
          const g = new THREE.Group();
          cyl(1, 1, 0.1, M.steel, g, 0, 0.05, 0, 40);
          cyl(0.2, 0.2, 0.7, M.steel, g, 0, 0.4, 0, 20);
          mesh(new THREE.ConeGeometry(0.42, 0.28, 20), M.roof, g, 0, 0.88, 0);
          for (let k = 0; k < 3; k++) {
            const c = cow(k);
            const a = (k / 3) * TAU;
            c.scale.setScalar(0.42);
            c.position.set(Math.cos(a) * 0.68, 0.1, Math.sin(a) * 0.68);
            c.rotation.y = -a + Math.PI;
            g.add(c);
          }
          return g;
        },
        tanker,
        plant: () => {
          const g = new THREE.Group();
          const a = tankUnit();
          a.position.x = -0.42;
          const b = tankUnit();
          b.position.set(0.42, 0, -0.2);
          b.scale.setScalar(0.85);
          g.add(a, b);
          return g;
        },
        cheese: () => {
          const g = new THREE.Group();
          for (let k = 0; k < 3; k++) {
            const w = new THREE.Group();
            w.position.set(0, 0.1 + k * 0.17, 0);
            w.rotation.y = k * 0.4;
            g.add(w);
            cyl(0.42 - k * 0.07, 0.42 - k * 0.07, 0.16, M.cheese, w, 0, 0, 0, 28);
            const rim = mesh(new THREE.TorusGeometry(0.42 - k * 0.07, 0.025, 6, 28), M.rind, w, 0, 0.07, 0);
            rim.rotation.x = Math.PI / 2;
          }
          const wedge = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20, 1, false, 0, 0.9), M.cheese, g, 0.45, 0.08, 0.3);
          wedge.rotation.y = 0.3;
          return g;
        },
        drone,
        galaxy: () => {
          const g = new THREE.Group();
          const tmp = { galaxy: g, items: [] };
          for (let k = 0; k < 6; k++) LAYERS.galaxy.add(tmp, k).material.size = 0.1;
          return g;
        },
        bucket: () => {
          const g = new THREE.Group();
          cyl(0.34, 0.26, 0.5, M.steel, g, 0, 0.25, 0, 28);
          cyl(0.31, 0.31, 0.02, M.milk, g, 0, 0.46, 0, 28);
          const h = mesh(new THREE.TorusGeometry(0.33, 0.02, 8, 28, Math.PI), M.steel, g, 0, 0.5, 0);
          h.rotation.y = Math.PI / 2;
          return g;
        },
        carton: () => {
          const g = new THREE.Group();
          box(0.5, 0.95, 0.5, M.white, g, 0, 0.475, 0);
          box(0.52, 0.18, 0.52, M.green, g, 0, 0.6, 0);
          const topp = mesh(new THREE.CylinderGeometry(0, 0.36, 0.25, 4), M.white, g, 0, 1.07, 0);
          topp.rotation.y = Math.PI / 4;
          cyl(0.07, 0.07, 0.08, M.green, g, 0.1, 1.12, 0.1, 16);
          return g;
        },
        golden: () => {
          const g = new THREE.Group();
          const d = ball(0.4, M.gold, g, 0, 0.4, 0, 32);
          d.scale.set(1, 1.05, 1);
          const tip = mesh(new THREE.ConeGeometry(0.28, 0.5, 32), M.gold, g, 0, 0.82, 0);
          tip.castShadow = false;
          return g;
        },
      };
      for (const [id, makeFn] of Object.entries(shots)) {
        const scene = new THREE.Scene();
        scene.environment = offEnv;
        scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4230, 1.1));
        const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
        key.position.set(3, 5, 4);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xcfe3ff, 1.1);
        rim.position.set(-4, 2, -3);
        scene.add(rim);
        const obj = makeFn();
        obj.traverse((o) => {
          if (o.material === blobMat) o.visible = false;
        });
        scene.add(obj);
        const bb = new THREE.Box3().setFromObject(obj);
        const c = bb.getCenter(new THREE.Vector3());
        const sz = bb.getSize(new THREE.Vector3()).length();
        const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
        const dir = new THREE.Vector3(1.1, 0.75, 1.35).normalize();
        cam.position.copy(c).addScaledVector(dir, sz * 1.55);
        cam.lookAt(c);
        off.render(scene, cam);
        out[id] = off.domElement.toDataURL('image/png');
      }
      offEnv.dispose();
      offPm.dispose();
      off.dispose();
      off.forceContextLoss();
      return out;
    }

    return {
      frame,
      resize,
      bump: (nx, ny) => house.bump(nx, ny),
      setCount,
      icons,
      has: (id) => layers.has(id),
      stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    };
  };
})();
