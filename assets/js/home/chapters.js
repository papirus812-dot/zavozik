/*
 * Главы страницы: «перекатывающиеся» буквы в ссылках, названия глав поднимаются по буквам,
 * когда окно главы появляется; плавающая навигация внизу показывает текущую главу и раскрывает
 * список глав; подпись «Открыть» у курсора над фото товаров (только мышь).
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});

  // Разбить текст на буквы: для экранного диктора остаётся прежний текст целиком
  function split(el, wrapClass, charClass) {
    const text = el.textContent.trim();
    if (!text) return;
    el.textContent = '';
    const sr = document.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = text;
    const wrap = document.createElement('span');
    wrap.className = wrapClass;
    wrap.setAttribute('aria-hidden', 'true');
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = charClass;
      s.style.setProperty('--i', String(i));
      s.dataset.char = ch;
      s.textContent = ch;
      wrap.appendChild(s);
    });
    el.append(sr, wrap);
  }

  Z.splitRoll = function (root = document) {
    for (const el of root.querySelectorAll('.roll:not([data-rolled])')) {
      el.dataset.rolled = '';
      split(el, 'roll__text', 'roll__char');
    }
  };

  function initPill(chapters, names) {
    const pill = document.querySelector('[data-pill]');
    if (!pill || !chapters.length) return null;
    const toggle = pill.querySelector('[data-pill-toggle]');
    const menu = pill.querySelector('[data-pill-menu]');
    const current = pill.querySelector('[data-pill-current]');
    const count = pill.querySelector('[data-pill-count]');
    const links = [...menu.querySelectorAll('a')];
    const hero = document.getElementById('top');
    let open = false;
    let index = null; // -1 — первый экран, дальше номер главы

    function setOpen(value) {
      open = value;
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    }

    toggle.addEventListener('click', () => setOpen(!open));
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('pointerdown', (e) => {
      if (open && !pill.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        toggle.focus();
      }
    });
    pill.addEventListener('focusout', (e) => {
      if (open && !pill.contains(e.relatedTarget)) setOpen(false);
    });

    function update() {
      const vh = window.innerHeight;
      // текущая глава — та, что пересекает середину экрана; пока виден первый экран — просто «Разделы»
      let i = -1;
      chapters.forEach((c, k) => {
        if (c.getBoundingClientRect().top <= vh * 0.5) i = k;
      });
      if (hero && hero.getBoundingClientRect().bottom > vh * 0.5) i = -1;
      if (i === index) return;
      index = i;
      current.textContent = i < 0 ? 'Разделы' : names[i];
      count.textContent = i < 0 ? `${chapters.length}` : `${i + 1} из ${chapters.length}`;
      links.forEach((a, k) => {
        if (k === i) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }

    let queued = false;
    window.addEventListener(
      'scroll',
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          update();
        });
      },
      { passive: true }
    );
    window.addEventListener('resize', update);
    update();
    return { update, close: () => setOpen(false) };
  }

  function initReveal(chapters) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches || !('IntersectionObserver' in window)) {
      chapters.forEach((c) => c.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.closest('[data-chapter]').classList.add('is-in');
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.3 }
    );
    chapters.forEach((c) => io.observe(c.querySelector('.chapter__stage')));
  }

  function initCursor() {
    const label = document.querySelector('[data-cursor-label]');
    if (!label) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    let on = false;
    const hide = () => {
      if (!on) return;
      on = false;
      label.classList.remove('is-on');
    };
    document.addEventListener(
      'pointermove',
      (e) => {
        if (!fine.matches || e.pointerType !== 'mouse') return hide();
        const target = e.target instanceof Element ? e.target.closest('[data-cursor]') : null;
        if (!target || document.querySelector('dialog[open]')) return hide();
        if (label.textContent !== target.dataset.cursor) label.textContent = target.dataset.cursor;
        label.style.setProperty('--x', `${e.clientX + 16}px`);
        label.style.setProperty('--y', `${e.clientY + 16}px`);
        if (!on) {
          on = true;
          label.classList.add('is-on');
        }
      },
      { passive: true }
    );
    document.addEventListener('pointerdown', hide);
    window.addEventListener('blur', hide);
    document.documentElement.addEventListener('pointerleave', hide);
  }

  // Дроны в разделе «Доставка»: в разметке один, остальные пять — его копии (по три с каждой
  // стороны: у кадра, дальше, ещё дальше). Анимации на паузе, пока раздел не виден.
  function initDrones() {
    const box = document.querySelector('[data-drones]');
    const tpl = box && box.querySelector('[data-drone]');
    if (!tpl) return;
    for (const cls of ['drone--near drone--right', 'drone--mid drone--left', 'drone--mid drone--right', 'drone--far drone--left', 'drone--far drone--right']) {
      const d = tpl.cloneNode(true);
      d.className = `drone ${cls}`;
      box.appendChild(d);
    }
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(([entry]) => box.classList.toggle('is-offscreen', !entry.isIntersecting)).observe(box);
  }

  // Слова о доставке (drone.css, .flyby): по очереди выходят из темноты в одной точке неба над
  // дорогой — из размытия, издалека — приближаются и, не долетев до зрителя, растворяются;
  // следующее выходит, когда предыдущее уже тает. Никуда не едут: только приближаются на месте.
  // В конце выходит логотип и держится 15 секунд — потом всё сначала. Идёт, только пока раздел на экране.
  function initFlyby() {
    const box = document.querySelector('[data-flyby]');
    if (!box || !('animate' in Element.prototype)) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const items = [...box.querySelectorAll('.flyby__item')];
    const words = items.slice(0, -1), logo = items[items.length - 1];
    const FLY = 2400, GAP = 2250, LOGO_IN = 2000, LOGO_HOLD = 15000, LOGO_OUT = 900, PAUSE = 600;
    // глубина z (px); точка схода перспективы — центр слова, поэтому оно не смещается, а растёт
    const at = (z) => `translate(-50%, -50%) translateZ(${z}px)`;
    // у логотипа свой фильтр (осветление, drone.css) — размытие добавляем к нему, а не вместо него
    const LOGO_F = 'brightness(2.05) saturate(0.68) drop-shadow(0 6px 30px rgba(0, 0, 0, 0.5))';
    let anims = [], timer = 0, on = false;

    function stop() {
      clearTimeout(timer);
      anims.forEach((a) => a.cancel());
      anims = [];
    }

    function cycle() {
      stop();
      if (!on || reduce.matches || document.hidden) return;
      words.forEach((w, i) => anims.push(w.animate(
        [
          { transform: at(-1500), opacity: 0, filter: 'blur(14px)' },
          { transform: at(-620), opacity: 1, filter: 'blur(0px)', offset: 0.32 },
          { transform: at(150), opacity: 1, filter: 'blur(0px)', offset: 0.8 },
          { transform: at(300), opacity: 0, filter: 'blur(12px)' },
        ],
        { duration: FLY, delay: i * GAP, easing: 'cubic-bezier(0.35, 0, 0.75, 0.8)', fill: 'both' },
      )));
      const start = words.length * GAP + 200;
      anims.push(logo.animate(
        [
          { transform: at(-1500), opacity: 0, filter: `${LOGO_F} blur(14px)` },
          { transform: at(-500), opacity: 1, filter: `${LOGO_F} blur(0px)`, offset: 0.55 },
          { transform: at(0), opacity: 1, filter: `${LOGO_F} blur(0px)` },
        ],
        { duration: LOGO_IN, delay: start, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' },
      ));
      anims.push(logo.animate(
        [
          { transform: at(0), opacity: 1, filter: `${LOGO_F} blur(0px)` },
          { transform: at(160), opacity: 0, filter: `${LOGO_F} blur(12px)` },
        ],
        { duration: LOGO_OUT, delay: start + LOGO_IN + LOGO_HOLD, easing: 'ease-in', fill: 'forwards' },
      ));
      timer = setTimeout(cycle, start + LOGO_IN + LOGO_HOLD + LOGO_OUT + PAUSE);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting === on) return;
        on = e.isIntersecting;
        cycle();
      }).observe(box);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : cycle()));
    reduce.addEventListener('change', cycle);
    // для проверок: запустить, не дожидаясь, пока раздел окажется на экране
    return {
      debugStart() {
        on = true;
        cycle();
        return anims;
      },
    };
  }

  // «Кто мы?»: в правом нижнем углу окна по очереди появляются фразы о том, во что верит марка.
  // Смена — растворение с лёгким сдвигом; идёт, только пока окно на экране.
  const MOTTOS = [
    'Мы делаем то, что сами хотим видеть на своём столе.',
    'Чем короче путь от фермы до стола, тем честнее вкус.',
    'Природа делает главное. Наше дело — бережно это сохранить.',
    'Классика — на каждый день, смелые вкусы — для настроения.',
    'Забота о людях начинается с заботы о земле и тех, кто на ней работает.',
    'Молоко любит холод, чистоту и внимание. Мы тоже.',
    'Вкус детства для нас не ностальгия, а мерка.',
    'Каждая пачка — маленькое обещание: будет вкусно.',
  ];

  function initMottos() {
    const el = document.querySelector('[data-who-motto]');
    if (!el || !('animate' in Element.prototype)) return null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const EVERY = 5200;
    let i = 0, timer = 0, on = false;

    async function next() {
      const out = el.animate(
        [{ opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
         { opacity: 0, transform: 'translateY(-8px)', filter: 'blur(4px)' }],
        { duration: 420, easing: 'ease-in', fill: 'forwards' },
      );
      await out.finished.catch(() => {});
      i = (i + 1) % MOTTOS.length;
      el.textContent = MOTTOS[i];
      el.animate(
        [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)' },
         { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }],
        { duration: 640, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' },
      );
      out.cancel();
    }

    function schedule() {
      clearTimeout(timer);
      if (!on || reduce.matches || document.hidden) return;
      timer = setTimeout(function loop() {
        if (!on || reduce.matches || document.hidden) return;
        next();
        timer = setTimeout(loop, EVERY);
      }, EVERY);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting === on) return;
        on = e.isIntersecting;
        schedule();
      }).observe(el);
    }
    document.addEventListener('visibilitychange', schedule);
    reduce.addEventListener('change', schedule);
    return { next, mottos: MOTTOS };
  }

  // Бегущие строки на стыках разделов (marquee.css): слово и символ повторяются; дорожка — две
  // одинаковые половины. Длительность — от длины половины, чтобы все строки ехали с одной скоростью.
  function initMarquees() {
    const SPEED = 70; // пикселей в секунду
    const tracks = [];
    for (const el of document.querySelectorAll('[data-marquee]')) {
      const sym = el.dataset.symbol === 'flower' ? 'sym-flower' : 'sym-leaf';
      const unit = `<span class="marquee__word">${el.dataset.marquee}</span><svg class="marquee__sym" focusable="false"><use href="#${sym}"/></svg>`;
      const half = `<span class="marquee__half">${unit.repeat(8)}</span>`;
      el.innerHTML = `<div class="marquee__track">${half}${half}</div>`;
      tracks.push(el.firstElementChild);
    }
    const tune = () => {
      for (const t of tracks) t.style.animationDuration = `${Math.max(10, t.firstElementChild.offsetWidth / SPEED)}s`;
    };
    tune();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(tune);
    window.addEventListener('resize', tune);
  }

  Z.initChapters = function () {
    const chapters = [...document.querySelectorAll('[data-chapter]')];
    // имена глав — до разбивки названий на буквы
    const names = chapters.map((c) => c.querySelector('.chapter__title').textContent.trim());
    chapters.forEach((c) => split(c.querySelector('.chapter__title'), 't-chars', 't-char'));
    Z.splitRoll(document);
    initReveal(chapters);
    initCursor();
    initDrones();
    initMarquees();
    const flyby = initFlyby();
    const mottos = initMottos();
    return { pill: initPill(chapters, names), flyby, mottos };
  };
})();
