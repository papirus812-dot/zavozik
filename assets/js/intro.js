/*
 * Вход на сайт «Завозик»: жидкометаллический шар с логотипом.
 *
 * Шар — оригинальный шейдер LiquidMetal и его рендерер ShaderMount из @paper-design/shaders 0.0.46
 * (assets/vendor/paper-shaders), с параметрами компонента-референса Liquid Metal Hero
 * (21st.dev/@chowlol202/components/liquid-metal-hero). Изменён только масштаб шара.
 * Логотип дописан в тот же фрагментный шейдер — он часть сферы: лежит на её выпуклой поверхности,
 * освещён её светом, по контуру хромированная кромка; при этом чёткий и непрозрачный, в исходных цветах.
 *
 * Подсказки (стрелки к шару и «НАЖМИ» в углах) мигают раз в 10 секунд — это CSS, см. intro.css.
 *
 * Клик, тап, Enter или Space по шару → шар вырастает на 5 % и, продолжая медленно расти,
 * растворяется в чёрном → основной сайт проявляется из чёрного (см. home.html, layout.css).
 */
(() => {
  'use strict';

  const NEXT_PAGE = 'home.html';
  const LOGO_TEXTURE = 'assets/img/logo-zavozik-texture.png';
  // Метка для главной: пришли с заставки — показать плавное проявление
  const ARRIVAL_KEY = 'zavozik:from-splash';

  // Параметры шара из референса: LiquidMetal с пресетом по умолчанию
  const REFERENCE = {
    colorBack: '#000000',
    colorTint: '#ffffff',
    softness: 0.3,
    repetition: 4,
    shiftRed: 0.3,
    shiftBlue: 0.3,
    distortion: 0.1,
    contour: 1,
    shape: 'circle',
    speed: 1,
    frame: 8000,
  };
  // В референсе scale = 0.7. Здесь шар крупнее, но целиком в экране:
  // его диаметр = 0.984 × scale от меньшей стороны экрана (то же число — в CSS, у .orb).
  const SPHERE_SCALE = 0.9;
  // Ширина логотипа по поверхности шара, в единицах шейдера (диаметр шара ≈ 0.98)
  const LOGO_WIDTH = 0.7;
  const GROW_MS = 300;
  const DISSOLVE_MS = 700;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const splash = document.getElementById('splash');
  const stage = document.getElementById('stage');
  const orb = document.getElementById('orb');

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ------------------------------------------------------------------
   * Логотип внутри шейдера. Код ниже дописывается к оригинальному
   * фрагментному шейдеру: металл считается как в референсе, а в самом
   * конце поверх него кладётся логотип. Используются переменные
   * оригинала: uv и color.
   * ------------------------------------------------------------------ */
  const LOGO_UNIFORMS = `
uniform sampler2D u_logo;
uniform float u_logoAspectRatio;
uniform float u_logoWidth;
uniform float u_logoReady;`;

  const LOGO_BLOCK = `
  // ---- Завозик: логотип на поверхности шара — чёткий и непрозрачный ----
  // Координаты логотипа и их производные — до любых условий: по ним выбирается уровень детализации
  vec2 fromCenter = uv - .5;
  float radius = .49;
  float centerDist = length(fromCenter);
  // Логотип лежит на выпуклой поверхности (к краям чуть сжимается), но не течёт с металлом — буквы не плывут
  vec2 surf = fromCenter * (radius * asin(min(centerDist / radius, .999)) / max(centerDist, 1e-4));
  vec2 logoSize = vec2(u_logoWidth, u_logoWidth / u_logoAspectRatio);
  vec2 lp = surf / logoSize + .5;
  vec2 lpDx = dFdx(lp);
  vec2 lpDy = dFdy(lp);

  if (u_logoReady > .5 && lp.x > -.02 && lp.x < 1.02 && lp.y > -.02 && lp.y < 1.02) {
    // Буквы: четыре выборки внутри пикселя поверх MIP-фильтрации — ровные края без ряби
    vec4 logo = vec4(0.);
    for (int i = 0; i < 4; i++) {
      vec2 o = (vec2(float(i - (i / 2) * 2), float(i / 2)) - .5) * .5;
      logo += textureGrad(u_logo, lp + o.x * lpDx + o.y * lpDy, lpDx * .5, lpDy * .5);
    }
    logo *= .25;
    // Строго в пределах картинки: край текстуры не растягивается
    vec2 inside = step(vec2(0.), lp) * step(lp, vec2(1.));
    float cover = logo.a * inside.x * inside.y;

    // Кромка: наклон контура на шаг в один пиксель экрана, свет сверху-слева — эмблема вделана в металл
    vec2 ex = vec2(length(lpDx), 0.), ey = vec2(0., length(lpDy));
    float gx = textureGrad(u_logo, lp + ex, lpDx, lpDy).a - textureGrad(u_logo, lp - ex, lpDx, lpDy).a;
    float gy = textureGrad(u_logo, lp + ey, lpDx, lpDy).a - textureGrad(u_logo, lp - ey, lpDx, lpDy).a;
    float slope = length(vec2(gx, gy));
    float facing = slope > .001 ? -dot(vec2(gx, gy) / slope, normalize(vec2(-.55, -.85))) : 0.;
    float rim = 4. * cover * (1. - cover);

    // Свет сферы: эмблема лежит на той же выпуклой поверхности — к свету светлее, к краю шара темнее
    float rr = min(centerDist / radius, .999);
    vec3 normal = vec3(fromCenter / radius, sqrt(1. - rr * rr));
    float lit = clamp(dot(normal, normalize(vec3(-.42, -.58, .7))), 0., 1.);
    float shade = .8 + .32 * lit;

    // Эмаль: исходные цвета логотипа, сплошные — металл сквозь буквы не просвечивает,
    // только самые яркие блики сферы ложатся на неё, как на глазурь
    float metalLight = dot(color, vec3(.2126, .7152, .0722));
    vec3 enamel = logo.rgb * shade + .16 * smoothstep(.7, 1., metalLight) * color;
    color = mix(color, enamel, cover);

    // Хромированная кромка по контуру: светлая к свету, тёмная от света
    color += vec3(.95, .97, 1.) * rim * max(facing, 0.) * .55;
    color *= 1. - .35 * rim * max(-facing, 0.);
  }
`;

  function withLogo(fragment) {
    const uniformAnchor = 'uniform float u_shape;';
    const outputAnchor = 'fragColor = vec4(color, opacity);';
    if (!fragment.includes(uniformAnchor) || !fragment.includes(outputAnchor)) return null;
    return fragment
      .replace(uniformAnchor, uniformAnchor + LOGO_UNIFORMS)
      .replace(outputAnchor, `${LOGO_BLOCK}\n  ${outputAnchor}`);
  }

  // Текстуре логотипа — уровни детализации и анизотропная фильтрация:
  // уменьшенные буквы остаются ровными, а не рябят (ShaderMount создаёт её без мипмапов)
  function sharpenLogoTexture(mount) {
    const gl = mount.gl;
    const texture = mount.textures && mount.textures.get('u_logo');
    if (!gl || !texture) return;
    const unit = (mount.textureUnitMap && mount.textureUnitMap.get('u_logo')) || 0;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) {
      const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Не загрузилась картинка ${src.slice(0, 60)}`));
      img.src = src;
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // С диска (file://) браузер не отдаёт картинку в WebGL, поэтому там текстура берётся из data URI
  async function loadLogoTexture() {
    if (window.location.protocol === 'file:') {
      await loadScript('assets/js/logo-texture.js');
      return loadImage(window.ZAVOZIK_LOGO_TEXTURE);
    }
    return loadImage(LOGO_TEXTURE);
  }

  /* ------------------------------------------------------------------
   * Шейдер
   * ------------------------------------------------------------------ */
  function useFallback(reason) {
    if (reason) console.warn('Завозик: шейдер недоступен, показан статичный шар.', reason);
    const canvas = stage.querySelector('canvas');
    if (canvas) canvas.remove();
    splash.classList.remove('is-live');
    splash.classList.add('is-fallback');
  }

  async function startShader() {
    const P = window.PaperShaders;
    if (!P || typeof window.WebGL2RenderingContext === 'undefined') {
      throw new Error('WebGL2 недоступен');
    }

    const logo = await loadLogoTexture().catch((error) => {
      console.warn('Завозик: логотип не загрузился.', error);
      return null;
    });
    const fragment = logo ? withLogo(P.liquidMetalFragmentShader) : null;

    const sizing = P.defaultObjectSizing;
    const uniforms = {
      u_colorBack: P.getShaderColorFromString(REFERENCE.colorBack),
      u_colorTint: P.getShaderColorFromString(REFERENCE.colorTint),
      u_softness: REFERENCE.softness,
      u_repetition: REFERENCE.repetition,
      u_shiftRed: REFERENCE.shiftRed,
      u_shiftBlue: REFERENCE.shiftBlue,
      u_distortion: REFERENCE.distortion,
      u_contour: REFERENCE.contour,
      u_shape: P.LiquidMetalShapes[REFERENCE.shape],
      u_fit: P.ShaderFitOptions[sizing.fit],
      u_scale: SPHERE_SCALE,
      u_rotation: sizing.rotation,
      u_offsetX: sizing.offsetX,
      u_offsetY: sizing.offsetY,
      u_originX: sizing.originX,
      u_originY: sizing.originY,
      u_worldWidth: sizing.worldWidth,
      u_worldHeight: sizing.worldHeight,
    };
    if (fragment) {
      Object.assign(uniforms, { u_logo: logo, u_logoWidth: LOGO_WIDTH, u_logoReady: 1 });
    }

    const mount = new P.ShaderMount(
      stage,
      fragment || P.liquidMetalFragmentShader,
      uniforms,
      undefined,
      reduceMotion ? 0 : REFERENCE.speed,   // «меньше движения»: один неподвижный кадр
      REFERENCE.frame,
    );
    if (!mount.program) {
      mount.dispose();
      throw new Error('шейдер не собрался');
    }
    if (fragment) {
      try {
        sharpenLogoTexture(mount);
        mount.render(performance.now()); // перерисовать с новой фильтрацией (важно для неподвижного кадра)
      } catch (error) {
        console.warn('Завозик: мипмапы логотипа не включились, остаётся обычная фильтрация.', error);
      }
    }

    mount.canvasElement.addEventListener('webglcontextlost', () => {
      mount.dispose();
      useFallback('потерян WebGL-контекст');
    }, { once: true });

    // ShaderMount считает масштаб через window.outerWidth; пока окно не показано (фоновая вкладка,
    // предзагрузка) он бывает 0 — и холст остаётся нулевым. Пересчитываем, как только окно появится.
    const ensureCanvasSize = () => {
      if (!mount.canvasElement.width && window.outerWidth > 0) mount.handleResize();
    };
    window.addEventListener('resize', ensureCanvasSize);
    window.addEventListener('focus', ensureCanvasSize);
    document.addEventListener('visibilitychange', ensureCanvasSize);
    window.addEventListener('pageshow', ensureCanvasSize);

    // Если логотип не удалось встроить в шейдер, он показывается поверх шара картинкой
    if (!fragment) splash.classList.add('is-fallback-logo');
    splash.classList.add('is-live');
  }

  /* ------------------------------------------------------------------
   * Вход на сайт
   * ------------------------------------------------------------------ */
  let entering = false;

  async function enter() {
    if (entering) return; // повторные нажатия во время перехода не считаются
    entering = true;
    orb.setAttribute('aria-disabled', 'true');
    try {
      sessionStorage.setItem(ARRIVAL_KEY, '1');
    } catch (error) {
      // хранилище недоступно — главная просто откроется без проявления
    }

    splash.classList.add('is-entering');   // шар +5 %, подсказки гаснут
    await wait(reduceMotion ? 0 : GROW_MS);
    splash.classList.add('is-leaving');    // шар растворяется в чёрном, продолжая медленно расти
    await wait(reduceMotion ? 250 : DISSOLVE_MS);
    window.location.href = NEXT_PAGE;
  }

  orb.addEventListener('click', (event) => {
    // Открыть в новой вкладке — пусть работает как обычная ссылка
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    enter();
  });

  // Ссылка сама срабатывает на Enter; Space добавляем, как у кнопки
  orb.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      enter();
    }
  });

  // Возврат кнопкой «Назад» из кэша браузера: снова показать шар
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    entering = false;
    orb.removeAttribute('aria-disabled');
    splash.classList.remove('is-entering', 'is-leaving');
    try {
      sessionStorage.removeItem(ARRIVAL_KEY);
    } catch (error) {
      // ничего страшного
    }
  });

  startShader().catch((error) => {
    const canvas = stage.querySelector('canvas');
    if (canvas) canvas.remove();
    useFallback(error);
  });
})();
