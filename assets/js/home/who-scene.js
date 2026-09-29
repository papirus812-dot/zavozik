/*
 * Сцена раздела «Кто мы?»: фермер на одном колене держит на плечах огромный шар молока (поза Атланта,
 * с линиями построения, как на эскизе), справа парят восемь пустых стаканов.
 * Фермер — реалистичный рендер из Blender (человек Microsoft Rocketbox, лицензия MIT —
 * assets/img/farmer-LICENSE.txt), картинка с прозрачностью в квадрате 1000×1000 «точек рисунка». Нажатие на шар — из него дугой вылетает струя молока
 * в случайный пустой стакан; полный стакан через 30 секунд снова пустеет. Фон — мерцающие точки.
 * Шар — настоящий 3D: глянец, перламутровый отлив, поверхность чуть «дышит», как жидкость.
 * Молоко в стакане держит горизонт: объём обрезан горизонтальной плоскостью, срез — «крышка».
 * Вызов: Z.buildWhoScene(THREE, { env, stage, button, small, pxRatio, wake }) → объект сцены для scenes.js.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});
  const TAU = Math.PI * 2;
  const FULL_FOR = 30;          // сколько секунд стакан стоит полным
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => x * x * (3 - 2 * x);

  Z.buildWhoScene = function (THREE, { env, stage, button, small, pxRatio, wake }) {
    const scene = new THREE.Scene();
    scene.environment = env;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    /* ---------------- свет ---------------- */
    scene.add(new THREE.HemisphereLight(0xeef4ff, 0x1a2414, 0.3));
    const key = new THREE.DirectionalLight(0xfff6e8, 2.4);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfe0ff, 1.3);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    /* ---------------- мерцающие точки фона ---------------- */
    const bg = (() => {
      const pos = [], seed = [];
      for (let x = -12; x <= 12; x += 0.46) {
        for (let y = -7; y <= 9; y += 0.46) {
          pos.push(x + (Math.random() - 0.5) * 0.12, y + (Math.random() - 0.5) * 0.12, -3);
          seed.push(Math.random());
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uIn: { value: 0 } },
        vertexShader: `
          uniform float uTime; uniform float uPx; uniform float uIn;
          attribute float aSeed; varying float vA;
          void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (1.6 + aSeed * 1.4) * uPx;
            // мерцание: у каждой точки свой ритм, иногда короткая вспышка
            float s = 0.5 + 0.5 * sin(uTime * (0.7 + aSeed * 2.3) + aSeed * 40.0);
            vA = (0.12 + 0.55 * pow(s, 6.0)) * uIn;
          }`,
        fragmentShader: `
          varying float vA;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            if (dot(c, c) > 0.25) discard;
            gl_FragColor = vec4(0.82, 0.86, 0.8, vA);
          }`,
        transparent: true,
        depthWrite: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      scene.add(pts);
      return mat;
    })();

    /* ---------------- фермер ---------------- */
    // шар в «точках рисунка» (квадрат 1000×1000, земля — y = 950): так кадрирован рендер фермера
    const S = { x: 520, y: 300, r: 245 };
    const UNIT = 0.004;                         // 1000 точек рисунка = 4 единицы сцены
    const toX = (px) => (px - S.x) * UNIT;
    const toY = (py) => (950 - py) * UNIT;
    const farmer = new THREE.Group();
    scene.add(farmer);

    // Рендер фермера — картинкой на плоскости. На месте шара в ней «дыра» (шар в Blender был
    // вырезом), поэтому картинка рисуется ПОВЕРХ 3D-шара: где шар ближе к зрителю, его видно
    // сквозь дыру, а руки и голова, что перед шаром, закрывают его. Тень и молочный отсвет шара
    // на плечах уже в рендере.
    const figure = (() => {
      // картинка встроена в farmer-image.js (data: URL): так она грузится в WebGL и когда страницу
      // открывают прямо с диска (file://) — обычный файл браузер туда не пускает из соображений
      // безопасности, и фермер пропадал. Файлы в assets/img — запасной вариант
      const src = Z.farmerImage || (small() ? 'assets/img/farmer-sm.webp' : 'assets/img/farmer.webp');
      const tex = new THREE.TextureLoader().load(src, () => wake && wake());
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1000 * UNIT, 1000 * UNIT), mat);
      plane.position.set(toX(500), toY(500), 0.02);
      plane.renderOrder = 1;                    // после шара (он непрозрачный), до стаканов и линий
      farmer.add(plane);
      return { mat, plane, y: plane.position.y };
    })();

    // линии построения, как на эскизе: круг вокруг шара, рамка, золотая спираль, оси шара
    const guides = (() => {
      const mat = new THREE.LineBasicMaterial({ color: 0xe8efe0, transparent: true, opacity: 0.22, depthTest: false });
      const group = new THREE.Group();
      const add = (pts, closed = false) => {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new (closed ? THREE.LineLoop : THREE.Line)(geo, mat);
        line.renderOrder = 4;
        group.add(line);
      };
      const R = S.r * UNIT;
      const circle = [];
      for (let i = 0; i < 96; i++) circle.push(V(Math.cos((i / 96) * TAU) * R * 1.04, toY(S.y) + Math.sin((i / 96) * TAU) * R * 1.04, 0));
      add(circle, true);
      const x0 = toX(96), x1 = toX(838), y0 = toY(44), y1 = toY(956);
      add([V(x0, y0, 0), V(x1, y0, 0), V(x1, y1, 0), V(x0, y1, 0)], true);
      add([V(x0, toY(S.y), 0), V(x1, toY(S.y), 0)]);
      add([V(0, y0, 0), V(0, y1, 0)]);
      // золотая спираль в правом нижнем углу рамки: растёт в φ раз за четверть оборота
      const spiral = [];
      const sr = 0.5;                                   // внешний радиус
      const cx = x1 - sr * 1.05, cy = y1 + sr * 1.05;
      const turns = (Math.PI / 2) * Math.log(sr / 0.012) / Math.log(1.618);
      for (let a = 0; a <= turns; a += 0.04) {
        const r = 0.012 * Math.pow(1.618, a / (Math.PI / 2));
        spiral.push(V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
      }
      add(spiral);
      farmer.add(group);
      return mat;
    })();

    /* ---------------- шар молока ---------------- */
    const R = S.r * UNIT;
    const sphereCenter = V(0, toY(S.y), 0);
    const sphereU = { uT: { value: 0 }, uAmp: { value: 0.02 } };
    // молоко: сливочно-белое, глянцевое, с перламутровым отливом (тонкая плёнка — её толщина
    // медленно меняется в update, и цвет отлива «переливается»)
    const milkMat = new THREE.MeshPhysicalMaterial({
      color: 0xf3efe4,
      roughness: 0.22,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
      sheen: 1,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color(0xc8dcff),
      iridescence: 1,
      iridescenceIOR: 1.33,
      iridescenceThicknessRange: [200, 600],
      envMapIntensity: 0.7,
    });
    milkMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, sphereU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uT; uniform float uAmp;
          float wob(vec3 p) { return sin(p.x * 3.1 + uT * 1.3) * sin(p.y * 2.7 + uT * 1.1) * sin(p.z * 3.3 + uT * 0.9); }`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          {
            float e = 0.02;
            vec3 gr = vec3(wob(position + vec3(e, 0, 0)) - wob(position - vec3(e, 0, 0)),
                           wob(position + vec3(0, e, 0)) - wob(position - vec3(0, e, 0)),
                           wob(position + vec3(0, 0, e)) - wob(position - vec3(0, 0, e))) / (2.0 * e);
            objectNormal = normalize(objectNormal - uAmp * (gr - dot(gr, objectNormal) * objectNormal));
          }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed += normal * uAmp * wob(position);`);
    };
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), milkMat);
    sphere.position.copy(sphereCenter);
    farmer.add(sphere);

    /* ---------------- стаканы ---------------- */
    const H = 0.8;                                   // высота стакана
    const outer = [[0, 0], [0.24, 0], [0.26, 0.02], [0.3, 0.78], [0.305, 0.8], [0.29, 0.8], [0.275, 0.78], [0.237, 0.09], [0, 0.09]];
    const glassGeo = new THREE.LatheGeometry(outer.map(([x, y]) => new THREE.Vector2(x, y - H / 2)), 48);
    const cavity = [[0, 0.09], [0.236, 0.09], [0.272, 0.77], [0, 0.77]];
    const milkGeo = new THREE.LatheGeometry(cavity.map(([x, y]) => new THREE.Vector2(x * 0.985, y - H / 2)), 40);
    // прозрачное стекло на тёмном фоне: своего цвета нет — только отражения и блики по краям,
    // и они складываются с тем, что позади (молоко внутри видно насквозь)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      emissive: 0x0b100b,
      roughness: 0.12,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.9,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const capColor = new THREE.Color(0xefece4);

    const glasses = [];
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.renderOrder = 3;
      // своё молоко у каждого стакана: своя плоскость-уровень
      const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -100);
      const mm = new THREE.MeshPhysicalMaterial({
        color: 0xf6f3ea,
        roughness: 0.3,
        sheen: 0.6,
        sheenColor: new THREE.Color(0xdfe9ff),
        clippingPlanes: [plane],
        side: THREE.DoubleSide,
      });
      mm.onBeforeCompile = (sh) => {
        // срез по уровню — «крышка»: изнанку рисуем ровным цветом молочной поверхности
        sh.uniforms.uCap = { value: capColor };
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uCap;')
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (!gl_FrontFacing) gl_FragColor.rgb = uCap;');
      };
      const milk = new THREE.Mesh(milkGeo, mm);
      milk.visible = false;
      group.add(milk, glass);
      scene.add(group);
      glasses.push({
        group, milk, plane,
        base: V(0, 0, 0), tilt: 0, tiltX: 0,
        ph: [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU, Math.random() * TAU],
        state: 'empty', fill: 0, fullAt: 0,
      });
    }

    /* ---------------- струи ---------------- */
    const SEG = 44, RAD = 10;
    const streamMat = new THREE.MeshPhysicalMaterial({ color: 0xf7f4ec, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.8, sheenColor: new THREE.Color(0xcfe2ff) });
    const streams = [];

    function makeTube() {
      const geo = new THREE.BufferGeometry();
      const n = (SEG + 1) * (RAD + 1);
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const idx = [];
      for (let i = 0; i < SEG; i++) {
        for (let j = 0; j < RAD; j++) {
          const a = i * (RAD + 1) + j, b = (i + 1) * (RAD + 1) + j;
          idx.push(a, a + 1, b, b, a + 1, b + 1);                  // лицевая сторона — наружу
        }
      }
      geo.setIndex(idx);
      return geo;
    }

    const _p = V(0, 0, 0), _t = V(0, 0, 0), _n = V(0, 0, 0), _b = V(0, 0, 0), _z = V(0, 0, 1);
    // Трубка по квадратичной кривой Безье от t0 до t1, радиус сужается к концу и чуть «дышит»
    function fillTube(geo, P0, P1, P2, t0, t1, r0, r1, time) {
      const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
      let k = 0;
      for (let i = 0; i <= SEG; i++) {
        const s = i / SEG;
        const t = t0 + (t1 - t0) * s;
        const u = 1 - t;
        _p.set(u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x, u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y, u * u * P0.z + 2 * u * t * P1.z + t * t * P2.z);
        _t.set(2 * u * (P1.x - P0.x) + 2 * t * (P2.x - P1.x), 2 * u * (P1.y - P0.y) + 2 * t * (P2.y - P1.y), 2 * u * (P1.z - P0.z) + 2 * t * (P2.z - P1.z)).normalize();
        _n.crossVectors(_t, _z);
        if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0);
        _n.normalize();
        _b.crossVectors(_t, _n).normalize();
        // концы трубки закруглены: у головы и хвоста радиус сходит на нет
        const cap = Math.min(1, Math.sin(Math.min(1, s * 6) * Math.PI / 2), Math.sin(Math.min(1, (1 - s) * 6) * Math.PI / 2) * 0.7 + 0.3);
        // струя жидкая: толщина «дышит» волнами, бегущими к стакану
        const r = (r0 + (r1 - r0) * t) * (1 + 0.22 * Math.sin(t * 22 - time * 11) + 0.1 * Math.sin(t * 57 - time * 17)) * cap;
        for (let j = 0; j <= RAD; j++) {
          const a = (j / RAD) * TAU;
          const cx = Math.cos(a), sy = Math.sin(a);
          const nx = cx * _n.x + sy * _b.x, ny = cx * _n.y + sy * _b.y, nz = cx * _n.z + sy * _b.z;
          pos[k] = _p.x + nx * r; pos[k + 1] = _p.y + ny * r; pos[k + 2] = _p.z + nz * r;
          nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
          k += 3;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
      geo.computeBoundingSphere();
    }

    /* ---------------- раскладка под экран ---------------- */
    let layoutAspect = 0;
    function layout(aspect) {
      if (Math.abs(aspect - layoutAspect) < 0.01) return;
      layoutAspect = aspect;
      const narrow = aspect < 0.8;
      if (narrow) {
        // телефон: фермер внизу слева, стаканы — облаком над ним и справа; ниже фермера —
        // фраза и название главы (они стоят над кнопкой «Разделы»), поэтому фермер чуть выше
        camera.position.set(0, 1.3, 14);
        camera.lookAt(0, 1.3, 0);
        farmer.scale.setScalar(0.62);
        farmer.position.set(-0.55, -0.95, 0);
        const spots = [[-1.2, 4.9], [0.1, 5.4], [1.3, 4.8], [-0.4, 3.9], [0.9, 3.6], [1.5, 2.3], [1.1, 1.0], [1.6, -0.4]];
        spots.forEach(([x, y], i) => glasses[i].base.set(x, y, (i % 3) * 0.3 - 0.3));
        glasses.forEach((g) => g.group.scale.setScalar(0.72));
      } else {
        const wide = aspect > 1.9;
        camera.position.set(0, 0.95, wide ? 8.6 : 9);
        camera.lookAt(0, 0.95, 0);
        // фермер стоит над огромным заголовком «Кто мы?» внизу слева, а не на нём
        farmer.scale.setScalar(wide ? 0.86 : 0.92);
        const hw = Math.tan((35 * Math.PI) / 360) * camera.position.z * aspect;   // половина ширины кадра
        farmer.position.set(-hw * 0.5, wide ? -0.22 : -0.34, 0);
        const x0 = hw * 0.08, x1 = hw * 0.82;
        const spots = [[0.05, 2.55], [0.34, 2.95], [0.62, 2.45], [0.9, 2.85], [0.18, 1.05], [0.47, 1.4], [0.74, 0.95], [0.97, 1.3]];
        spots.forEach(([fx, y], i) => glasses[i].base.set(x0 + (x1 - x0) * fx, y - 0.25, ((i * 7) % 5) * 0.18 - 0.45));
        glasses.forEach((g) => g.group.scale.setScalar(0.82));
      }
      glasses.forEach((g, i) => {
        g.tilt = (i % 2 ? 1 : -1) * (0.22 + ((i * 37) % 11) / 40);
        g.tiltX = 0.28 + ((i * 13) % 7) / 30;
      });
    }

    /* ---------------- налить ---------------- */
    let t = 0, appear = 0, pulse = 0;
    const _mouth = V(0, 0, 0), _w = V(0, 0, 0);
    // 30 секунд «полного» стакана — по настоящим часам: анимация стоит, пока раздел не на экране
    let clockShift = 0;
    const now = () => performance.now() / 1000 + clockShift;

    function mouthOf(g, out) {
      return out.set(0, H / 2 - 0.08, 0).applyMatrix4(g.group.matrixWorld);
    }

    function pour(still) {
      const free = glasses.filter((g) => g.state === 'empty');
      if (!free.length) {
        pulse = Math.max(pulse, 0.5);
        return false;
      }
      const g = free[Math.floor(Math.random() * free.length)];
      g.state = 'coming';
      pulse = 1;
      if (still) {
        g.state = 'full';
        g.fill = 1;
        g.fullAt = now();
        return true;
      }
      const mesh = new THREE.Mesh(makeTube(), streamMat);
      mesh.frustumCulled = false;
      scene.add(mesh);
      streams.push({ g, mesh, age: 0 });
      return true;
    }

    // кнопка над шаром (её положение — каждый кадр) — мышь, палец и клавиатура
    if (button) {
      button.addEventListener('click', () => {
        const still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        pour(still);
        if (!wake) return;
        wake();
        // без анимации кадры не идут сами — перерисовать, когда стакану пора опустеть
        if (still) setTimeout(wake, (FULL_FOR + 0.2) * 1000);
      });
    }

    const _c = V(0, 0, 0), _e = V(0, 0, 0), _right = V(0, 0, 0);
    function placeButton() {
      if (!button || !stage) return;
      const w = stage.clientWidth, h = stage.clientHeight;
      camera.updateMatrixWorld();
      sphere.getWorldPosition(_c);
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      _e.copy(_c).addScaledVector(_right, R * farmer.scale.x);
      _c.project(camera);
      _e.project(camera);
      const cx = (_c.x + 1) / 2 * w, cy = (1 - _c.y) / 2 * h;
      const r = Math.abs((_e.x - _c.x) / 2 * w);
      button.style.transform = `translate(${cx - r}px, ${cy - r}px)`;
      button.style.width = button.style.height = `${2 * r}px`;
    }

    /* ---------------- кадр ---------------- */
    function update(dt, open, still) {
      t += dt;
      appear = still ? 1 : Math.max(appear, clamp01(open * 1.15));
      const px = pxRatio();
      bg.uniforms.uTime.value = t;
      bg.uniforms.uPx.value = px;
      bg.uniforms.uIn.value = appear;
      // фермер проявляется и чуть приподнимается, пока раздел открывается
      figure.mat.opacity = ease(appear);
      figure.plane.position.y = figure.y - (1 - ease(appear)) * 0.25;
      guides.opacity = 0.14 * appear;
      glassMat.opacity = appear;

      // шар «дышит», после выстрела — вздрагивает
      pulse = Math.max(0, pulse - dt * 1.6);
      sphereU.uT.value = t;
      sphereU.uAmp.value = 0.016 + pulse * 0.05;
      milkMat.iridescenceThicknessRange[0] = 220 + 140 * Math.sin(t * 0.6);
      milkMat.iridescenceThicknessRange[1] = 560 + 180 * Math.sin(t * 0.43 + 1.2);
      sphere.scale.setScalar(1 + pulse * 0.035 * Math.sin(t * 30) + (1 - appear) * -0.4);
      sphere.rotation.y = t * 0.12;
      scene.updateMatrixWorld();

      // стаканы: плавают, покачиваются, медленно вращаются
      for (const g of glasses) {
        const [a, b, c, d] = g.ph;
        g.group.position.set(
          g.base.x + Math.sin(t * 0.55 + a) * 0.2,
          g.base.y + Math.sin(t * 0.8 + b) * 0.16 + (1 - appear) * -1.2,
          g.base.z + Math.sin(t * 0.45 + c) * 0.12,
        );
        g.group.rotation.set(g.tiltX + Math.sin(t * 0.5 + d) * 0.08, t * 0.25 + a, g.tilt + Math.sin(t * 0.7 + a) * 0.12);
        g.group.updateMatrixWorld();
        if (g.state === 'full' && now() - g.fullAt > FULL_FOR) g.state = 'draining';
        if (g.state === 'filling') {
          g.fill = Math.min(1, g.fill + dt / 0.9);
          if (g.fill >= 1) {
            g.state = 'full';
            g.fullAt = now();
          }
        } else if (g.state === 'draining') {
          g.fill = Math.max(0, g.fill - dt / 1.4);
          if (g.fill <= 0) g.state = 'empty';
        }
        if (still && g.state === 'draining') {
          g.fill = 0;
          g.state = 'empty';
        }
        // уровень молока — горизонтальная плоскость: от самой низкой точки дна до самой низкой точки края
        g.milk.visible = g.fill > 0.001;
        if (g.milk.visible) {
          let lo = Infinity, rimLo = Infinity;
          for (let k = 0; k < 8; k++) {
            const ang = (k / 8) * TAU;
            _w.set(Math.cos(ang) * 0.236, 0.09 - H / 2, Math.sin(ang) * 0.236).applyMatrix4(g.group.matrixWorld);
            lo = Math.min(lo, _w.y);
            _w.set(Math.cos(ang) * 0.27, 0.77 - H / 2, Math.sin(ang) * 0.27).applyMatrix4(g.group.matrixWorld);
            rimLo = Math.min(rimLo, _w.y);
          }
          const level = lo + (rimLo - lo - 0.03) * ease(g.fill) * 0.92;
          g.plane.constant = level;
        }
      }

      // струи: голова летит к стакану, стакан наполняется, хвост уходит в стакан
      for (let i = streams.length - 1; i >= 0; i--) {
        const s = streams[i];
        s.age += dt;
        mouthOf(s.g, _mouth);
        sphere.getWorldPosition(_c);
        const dir = _w.copy(_mouth).sub(_c).normalize();
        const P0 = _c.clone().addScaledVector(dir, R * farmer.scale.x * 0.96);
        const P2 = _mouth.clone();
        const P1 = P0.clone().add(P2).multiplyScalar(0.5);
        P1.y += 0.9 + P0.distanceTo(P2) * 0.25;
        const head = ease(clamp01(s.age / 0.45));
        const tail = ease(clamp01((s.age - 1.1) / 0.4));
        if (s.age > 0.45 && s.g.state === 'coming') s.g.state = 'filling';
        const rs = 0.12 * farmer.scale.x, re = 0.06 * farmer.scale.x;
        fillTube(s.mesh.geometry, P0, P1, P2, tail, Math.max(tail + 0.02, head), rs, re, t);
        if (s.age > 1.55) {
          scene.remove(s.mesh);
          s.mesh.geometry.dispose();
          streams.splice(i, 1);
        }
      }

      placeButton();
    }

    return {
      scene,
      camera,
      frame(aspect) {
        layout(aspect);
      },
      update,
      reset() {
        t = 0;
        appear = 1;
      },
      pour,
      info() {
        return glasses.map((g) => `${g.state}:${g.fill.toFixed(2)}`).join(' ');
      },
      // для проверок: перемотать время (секунды) шагами кадра — и анимацию, и часы 30 секунд
      advance(seconds) {
        const n = Math.round(seconds * 30);
        for (let i = 0; i < n; i++) {
          clockShift += 1 / 30;
          update(1 / 30, 1, false);
        }
      },
    };
  };
})();
