/*
 * 3D-сцены глав на Three.js (библиотека — с CDN через import map в home.html): «Кто мы?» — фермер
 * с шаром молока и стаканами (who-scene.js), дальше сцены из светящихся частиц — змеевик
 * пастеризатора, молочная гладь, сырная головка, дорога к горизонту.
 * (Первый экран — готовый ролик из Blender, см. hero-video.js.)
 * Один холст на всю страницу: каждая видимая сцена рисуется в своё «окно» (viewport + scissor),
 * поэтому она едет вместе со своим экраном. Пока окна не видны — рисования нет.
 * Без WebGL, без ES-модулей или при «экономии трафика» остаются запасные фоны из CSS.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  // цвет из #rrggbb без пересчёта цветового пространства — для своих шейдеров частиц
  const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

  Z.initScenes = function () {
    const canvas = document.querySelector('[data-scene-canvas]');
    if (!canvas) return null;
    const conn = navigator.connection;
    if (conn && conn.saveData) return null;
    if (!('noModule' in HTMLScriptElement.prototype)) return null;
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
    } catch (e) {
      return null;
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const small = () => window.innerWidth < 760;

    // Окна сцен: «окна» глав (до верха своей панели с запасом под дугу)
    const windows = [];
    for (const c of document.querySelectorAll('[data-chapter]')) {
      windows.push({ key: c.dataset.chapter, stage: c.querySelector('.chapter__stage'), panel: c.querySelector('.chapter__panel') });
    }

    const state = { THREE: null, renderer: null, env: null, scenes: {}, builders: {}, running: false, last: 0 };
    const api = { state, windows, ready: null };

    api.ready = Promise.all([import('three'), import('three/addons/environments/RoomEnvironment.js')])
      .then(([THREE, room]) => setup(THREE, room.RoomEnvironment))
      .catch((err) => {
        console.warn('Завозик: 3D-сцены недоступны, остаются обычные фоны.', err);
      });

    /* ------------------------------------------------------------------ */
    function setup(THREE, RoomEnvironment) {
      state.THREE = THREE;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.autoClear = false;
      renderer.localClippingEnabled = true;       // уровень молока в стаканах «Кто мы?»
      state.renderer = renderer;
      // отражения для шара молока и стекла
      const pmrem = new THREE.PMREMGenerator(renderer);
      state.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();

      const whoStage = document.querySelector('#who .chapter__stage');
      state.builders = {
        who: () =>
          Z.buildWhoScene(THREE, {
            env: state.env,
            stage: whoStage,
            button: document.querySelector('[data-who-pour]'),
            small,
            pxRatio: () => state.renderer.getPixelRatio(),
            wake,
          }),
        production: () => buildPipes(THREE),
        milk: () => buildMilkSea(THREE),
        cheese: () => buildCheese(THREE),
        delivery: () => buildRoad(THREE),
      };

      resize();
      window.addEventListener('resize', () => {
        resize();
        wake();
      });
      window.addEventListener('scroll', wake, { passive: true });
      document.addEventListener('visibilitychange', wake);
      reduce.addEventListener('change', wake);
      document.documentElement.classList.add('has-scenes');
      canvas.classList.add('is-on');
      wake();
    }

    function resize() {
      const { renderer } = state;
      if (!renderer) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small() ? 1.5 : 1.75));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }

    function scene(key) {
      if (!state.scenes[key] && state.builders[key]) state.scenes[key] = state.builders[key]();
      return state.scenes[key];
    }

    // Что из окон сейчас на экране
    function visible() {
      const vh = window.innerHeight;
      const list = [];
      for (const w of windows) {
        if (!w.stage) continue;
        const r = w.stage.getBoundingClientRect();
        let bottom = r.bottom;
        if (w.panel) bottom = Math.min(bottom, w.panel.getBoundingClientRect().top + 150);
        const top = Math.max(r.top, 0), bot = Math.min(bottom, vh);
        if (bot - top > 1 && r.width > 0) list.push({ w, r, top, bot });
      }
      return list;
    }

    function wake() {
      if (!state.renderer || state.running) return;
      state.running = true;
      requestAnimationFrame(frame);
    }

    function frame(now) {
      state.running = false;
      const t = now / 1000;
      const dt = Math.min(0.05, state.last ? t - state.last : 1 / 60);
      state.last = t;
      const list = document.hidden ? [] : visible();
      draw(list, reduce.matches ? 0 : dt);
      if (list.length && !reduce.matches) {
        state.running = true;
        requestAnimationFrame(frame);
      } else {
        state.last = 0;
      }
    }

    function draw(list, dt) {
      const { renderer } = state;
      const H = window.innerHeight;
      renderer.setScissorTest(false);
      renderer.clear();
      if (!list.length) return;
      renderer.setScissorTest(true);
      for (const { w, r, top, bot } of list) {
        const sc = scene(w.key);
        if (!sc) continue;
        renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
        renderer.setScissor(r.left, H - bot, r.width, bot - top);
        renderer.clearDepth();
        sc.camera.aspect = r.width / r.height;
        sc.frame(sc.camera.aspect);
        sc.camera.updateProjectionMatrix();
        // сколько окна уже открыто: 0 — только показалось снизу, 1 — заняло экран
        const open = clamp01((H - r.top) / H);
        sc.update(dt, open, reduce.matches);
        renderer.render(sc.scene, sc.camera);
      }
    }

    // Для проверок: нарисовать сцену во весь холст на заданный момент её анимации
    api.debugRender = async function (key, seconds = 2) {
      await api.ready;
      if (!state.renderer) return 'нет 3D';
      const sc = scene(key);
      if (!sc) return 'нет сцены';
      // раскладка и пропорции камеры под экран — до расчёта кадров, как в обычной отрисовке
      sc.camera.aspect = window.innerWidth / window.innerHeight;
      sc.frame(sc.camera.aspect);
      sc.camera.updateProjectionMatrix();
      if (sc.reset) sc.reset();
      const steps = Math.round(seconds * 60);
      for (let i = 0; i < steps; i++) sc.update(1 / 60, 1, false);
      const { renderer } = state;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
      renderer.clear();
      sc.camera.aspect = window.innerWidth / window.innerHeight;
      sc.frame(sc.camera.aspect);
      sc.camera.updateProjectionMatrix();
      renderer.render(sc.scene, sc.camera);
      return sc.info ? sc.info() : 'ok';
    };

    /* ==================================================================
     * Главы: сцены из светящихся частиц
     * ================================================================== */
    const POINTS_VERT = `
      uniform float uTime;
      uniform float uPx;
      uniform float uSize;
      uniform float uIn;
      uniform float uRim;
      uniform vec3 uRimColor;
      uniform vec3 uRimCenter;
      attribute vec3 aColor;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vAlpha;
      /*DISPLACE*/
      void main() {
        vec3 p = displace(position);
        vec3 scatter = vec3(sin(aSeed * 91.7), cos(aSeed * 47.3), sin(aSeed * 13.1 + 1.3)) * 2.6;
        float e = smoothstep(0.0, 1.0, clamp(uIn * 1.3 - aSeed * 0.3, 0.0, 1.0));
        p = mix(p + scatter, p, e);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPx * (0.55 + aSeed * 0.9) / max(0.1, -mv.z);
        vColor = aColor;
        if (uRim > 0.0) {
          // ободок по взгляду камеры: край шара светится своим цветом
          vec3 n = normalize((modelViewMatrix * vec4(p - uRimCenter, 0.0)).xyz);
          float rim = pow(1.0 - abs(n.z), 2.5) * uRim;
          vColor = mix(aColor, uRimColor, clamp(rim, 0.0, 1.0));
        }
        vAlpha = 0.35 + 0.65 * e;
      }`;
    const POINTS_FRAG = `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c);
        if (d > 0.25) discard;
        float a = smoothstep(0.25, 0.0, d) * vAlpha;
        gl_FragColor = vec4(vColor, a);
      }`;

    function pointsScene(THREE, { positions, colors, displace = 'vec3 displace(vec3 p) { return p; }', size = 26, camera: cam }) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.fromArray(cam.pos);
      camera.lookAt(new THREE.Vector3().fromArray(cam.look));
      const n = positions.length / 3;
      const seeds = new Float32Array(n);
      for (let i = 0; i < n; i++) seeds[i] = Math.random();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPx: { value: 1 },
          uSize: { value: size },
          uIn: { value: 0 },
          uRim: { value: 0 },
          uRimColor: { value: new THREE.Vector3(0, 0, 0) },
          uRimCenter: { value: new THREE.Vector3(0, 0, 0) },
        },
        vertexShader: POINTS_VERT.replace('/*DISPLACE*/', displace),
        fragmentShader: POINTS_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      scene.add(points);
      let t = 0;
      let appear = 0;
      return {
        scene,
        camera,
        points,
        mat,
        frame(aspect) {
          // на узком экране — дальше, чтобы сцена целиком влезала
          const k = aspect < 0.8 ? 1.55 : aspect < 1.2 ? 1.2 : 1;
          camera.position.set(cam.pos[0] * k, cam.pos[1] * k, cam.pos[2] * k);
          camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
        },
        update(dt, open, still) {
          t += dt;
          // частицы собираются, пока окно главы открывается
          appear = still ? 1 : Math.max(appear, clamp01(open * 1.15));
          mat.uniforms.uTime.value = t;
          mat.uniforms.uIn.value = appear;
          mat.uniforms.uPx.value = state.renderer.getPixelRatio() * (small() ? 0.8 : 1);
          if (this.tick) this.tick(dt, t);
        },
        reset() {
          t = 0;
          appear = 1;
        },
      };
    }

    // «Молоко»: спокойная молочная гладь в утреннем свете
    function buildMilkSea(THREE) {
      const nx = small() ? 150 : 230, nz = small() ? 90 : 130;
      const positions = new Float32Array(nx * nz * 3), colors = new Float32Array(nx * nz * 3);
      const near = rgb(0xfdfcf7), far = rgb(0x9fc3e6);
      let k = 0;
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const x = (i / (nx - 1) - 0.5) * 16, z = (j / (nz - 1)) * -14 + 3;
          positions[k * 3] = x;
          positions[k * 3 + 1] = 0;
          positions[k * 3 + 2] = z;
          const f = j / (nz - 1);
          colors[k * 3] = near[0] * (1 - f) + far[0] * f;
          colors[k * 3 + 1] = near[1] * (1 - f) + far[1] * f;
          colors[k * 3 + 2] = near[2] * (1 - f) + far[2] * f;
          k++;
        }
      }
      return pointsScene(THREE, {
        positions,
        colors,
        size: 30,
        camera: { pos: [0, 1.7, 6.5], look: [0.6, -0.3, -2] },
        displace: `vec3 displace(vec3 p) {
          p.y += sin(p.x * 0.7 + uTime * 0.9) * 0.22 + sin(p.z * 0.9 - uTime * 1.1) * 0.18 + sin((p.x + p.z) * 1.7 + uTime * 1.6) * 0.06;
          return p;
        }`,
      });
    }

    // «Сыры»: сырная головка с вырезанным куском и дырками — как 3D-скан из частиц
    function buildCheese(THREE) {
      const R = 1.6, H = 0.95, cut = 1.05, a0 = cut / 2, a1 = Math.PI * 2 - cut / 2;
      const holes = [];
      for (let i = 0; i < 26; i++) {
        let a, r, y;
        if (i < 10) { a = i % 2 ? a0 : a1; r = 0.25 + Math.random() * (R - 0.45); y = (Math.random() - 0.5) * H * 0.75; }
        else if (i < 16) { a = a0 + Math.random() * (a1 - a0); r = 0.2 + Math.random() * (R - 0.4); y = (Math.random() < 0.5 ? 1 : -1) * H / 2; }
        else { a = a0 + Math.random() * (a1 - a0); r = R; y = (Math.random() - 0.5) * H * 0.75; }
        holes.push([Math.cos(a) * r, y, Math.sin(a) * r, 0.08 + Math.random() * 0.13]);
      }
      const inHole = (x, y, z) => holes.some(([hx, hy, hz, hr]) => (x - hx) ** 2 + (y - hy) ** 2 + (z - hz) ** 2 < hr * hr);
      const L = new THREE.Vector3(-0.4, 1, 0.55).normalize();
      const positions = [], colors = [];
      const cFace = rgb(0xf4d990), cRind = rgb(0xcf8a2c), cHi = rgb(0xfff4d2);
      const f = small() ? 0.45 : 1;
      const push = (x, y, z, n, base) => {
        if (inHole(x, y, z)) return;
        let lit = 0.45 + 0.75 * Math.max(0, n.x * L.x + n.y * L.y + n.z * L.z);
        let c = base.map((v) => v * lit);
        if (Math.random() < 0.05) c = c.map((v, i) => v * 0.3 + cHi[i] * 0.7);
        positions.push(x, y, z);
        colors.push(...c);
      };
      const up = { x: 0, y: 1, z: 0 }, dn = { x: 0, y: -1, z: 0 };
      for (let i = 0; i < 16000 * f; i++) {
        const a = a0 + Math.random() * (a1 - a0), r = Math.sqrt(Math.random()) * R, top = Math.random() < 0.5;
        push(Math.cos(a) * r, top ? H / 2 : -H / 2, Math.sin(a) * r, top ? up : dn, cFace);
      }
      for (let i = 0; i < 14000 * f; i++) {
        const a = a0 + Math.random() * (a1 - a0), y = (Math.random() - 0.5) * H;
        push(Math.cos(a) * R, y, Math.sin(a) * R, { x: Math.cos(a), y: 0, z: Math.sin(a) }, cRind);
      }
      const n0 = { x: Math.sin(a0), y: 0, z: -Math.cos(a0) }, n1 = { x: -Math.sin(a1), y: 0, z: Math.cos(a1) };
      for (let i = 0; i < 12000 * f; i++) {
        const side = Math.random() < 0.5, a = side ? a0 : a1, r = Math.sqrt(Math.random()) * R, y = (Math.random() - 0.5) * H;
        push(Math.cos(a) * r, y, Math.sin(a) * r, side ? n0 : n1, cFace.map((v, i) => v * 0.85 + cHi[i] * 0.15));
      }
      const dark = cRind.map((v) => v * 0.55);
      for (const [hx, hy, hz, hr] of holes) {
        for (let k = 0; k < 260 * f; k++) {
          const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
          const x = hx + hr * s * Math.cos(t), y = hy + hr * u, z = hz + hr * s * Math.sin(t);
          const ang = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2), rad = Math.hypot(x, z);
          if (Math.abs(y) > H / 2 || rad > R || ang < a0 || ang > a1) continue;
          positions.push(x, y, z);
          colors.push(...dark);
        }
      }
      const sc = pointsScene(THREE, {
        positions: new Float32Array(positions),
        colors: new Float32Array(colors),
        size: 16,
        camera: { pos: [0, 1.5, 6.4], look: [0.9, 0.05, 0] },
      });
      const group = new THREE.Group();
      sc.scene.remove(sc.points);
      group.add(sc.points);
      group.rotation.x = 0.42;
      group.position.set(1.05, 0.05, 0);
      sc.scene.add(group);
      sc.tick = (dt, t) => {
        sc.points.rotation.y = -0.95 + t * 0.12;
      };
      return sc;
    }

    // «Доставка»: дорога сквозь поля уходит к горизонту, камера летит вперёд
    function buildRoad(THREE) {
      const nx = small() ? 120 : 190, nz = small() ? 110 : 170;
      const positions = new Float32Array(nx * nz * 3), colors = new Float32Array(nx * nz * 3);
      const field = rgb(0x6fa544), light = rgb(0xb8e08f), road = rgb(0xece6d2);
      let k = 0;
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const x = (i / (nx - 1) - 0.5) * 22, z = (j / (nz - 1)) * -30 + 4;
          positions[k * 3] = x;
          positions[k * 3 + 1] = 0;
          positions[k * 3 + 2] = z;
          const onRoad = Math.abs(x) < 0.55;
          const c = onRoad ? road : Math.random() < 0.18 ? light : field;
          colors.set(c, k * 3);
          k++;
        }
      }
      return pointsScene(THREE, {
        positions,
        colors,
        size: 24,
        camera: { pos: [0, 1.25, 4.5], look: [0, 0.4, -8] },
        displace: `vec3 displace(vec3 p) {
          // бесконечная дорога: сетка сдвигается навстречу камере и повторяется
          float z = mod(p.z + uTime * 2.2 + 26.0, 30.0) - 26.0;
          float hills = (sin(p.x * 0.45 + z * 0.3) * 0.35 + sin(p.x * 0.9 - z * 0.55) * 0.18) * smoothstep(0.6, 3.5, abs(p.x));
          return vec3(p.x, hills - 0.2, z);
        }`,
      });
    }

    // «Производство»: змеевик пастеризатора из частиц. Стенки трубы: вход и выход — холодные,
    // средние ряды — нагретые (пастеризация); внутри течёт молоко — белые частицы бегут по трубе.
    // У частицы в position: x — путь вдоль трубы, y — 0 стенка / 1 молоко, z — угол вокруг оси
    function buildPipes(THREE) {
      const RUNS = 6, LR = 4.6, RB = 0.28;
      const SEG = LR + Math.PI * RB, TOTAL = RUNS * SEG - Math.PI * RB;
      const f = small() ? 0.5 : 1;
      const nWall = Math.round(13000 * f), nFlow = Math.round(5200 * f);
      const positions = new Float32Array((nWall + nFlow) * 3), colors = new Float32Array((nWall + nFlow) * 3);
      const cold = rgb(0x9ab8d4), hot = rgb(0xffa060), chill = rgb(0x8fc6ff), milk = rgb(0xfffbf2);
      const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
      for (let i = 0; i < nWall + nFlow; i++) {
        const wall = i < nWall;
        const d = Math.random() * TOTAL;
        positions[i * 3] = d;
        positions[i * 3 + 1] = wall ? 0 : 1;
        positions[i * 3 + 2] = Math.random() * Math.PI * 2;
        let c;
        if (wall) {
          // ряд змеевика: 0–1 холодные, 2–3 горячие, 4–5 охлаждение
          const row = d / SEG;
          const heat = Math.max(0, 1 - Math.abs(row - 2.9) / 1.6);
          c = row < 2.9 ? mix(cold, hot, heat) : mix(chill, hot, heat);
          c = c.map((v) => v * (0.55 + Math.random() * 0.45));
        } else {
          c = milk.map((v) => v * (0.75 + Math.random() * 0.25));
        }
        colors.set(c, i * 3);
      }
      const sc = pointsScene(THREE, {
        positions,
        colors,
        size: 15,
        camera: { pos: [0, 0.4, 9.4], look: [1.2, 0.1, 0] },
        displace: `
          const float LR = ${LR.toFixed(3)};
          const float RB = ${RB.toFixed(3)};
          const float SEG = ${SEG.toFixed(4)};
          const float TOTAL = ${TOTAL.toFixed(4)};
          vec3 pathAt(float d, out vec3 tn) {
            float k = floor(d / SEG);
            float u = d - k * SEG;
            float dir = mod(k, 2.0) < 0.5 ? 1.0 : -1.0;
            float y0 = k * 2.0 * RB;
            if (u < LR) {
              tn = vec3(dir, 0.0, 0.0);
              return vec3(dir * (u - LR * 0.5), y0, 0.0);
            }
            float a = (u - LR) / RB;
            tn = vec3(dir * cos(a), sin(a), 0.0);
            return vec3(dir * (LR * 0.5 + sin(a) * RB), y0 + RB - cos(a) * RB, 0.0);
          }
          vec3 displace(vec3 p) {
            bool flow = p.y > 0.5;
            float d = flow ? mod(p.x + uTime * 0.85, TOTAL) : p.x;
            vec3 tn;
            vec3 c = pathAt(d, tn);
            vec3 n1 = vec3(-tn.y, tn.x, 0.0);
            float r = flow ? 0.085 * sqrt(aSeed) : 0.13;
            vec3 q = c + (n1 * cos(p.z) + vec3(0.0, 0.0, 1.0) * sin(p.z)) * r;
            return q - vec3(0.0, ${((RUNS - 1) * RB).toFixed(3)}, 0.0);
          }`,
      });
      // змеевик чуть развёрнут, чтобы читался объём; на вертикальном экране — стоя, рядами вверх
      const group = new THREE.Group();
      sc.scene.remove(sc.points);
      group.add(sc.points);
      group.rotation.set(0.22, -0.42, 0);
      group.position.set(1.25, 0.15, 0);
      sc.scene.add(group);
      const baseFrame = sc.frame;
      sc.frame = (aspect) => {
        baseFrame.call(sc, aspect);
        const tall = aspect < 0.8;
        group.rotation.z = tall ? Math.PI / 2 : 0;
        group.position.set(tall ? 1.1 : 1.25, tall ? 1.2 : 0.15, 0);
      };
      sc.tick = (dt, t) => {
        group.rotation.y = -0.42 + Math.sin(t * 0.25) * 0.08;
      };
      return sc;
    }

    return api;
  };
})();
