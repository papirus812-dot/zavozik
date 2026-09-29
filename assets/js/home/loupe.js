/*
 * Лупа над фото товаров (только мышь). Над фото курсор превращается в большую лупу, а под ней —
 * «молекулярный состав» товара (molecules.js): молекулы и то, что крупнее молекул, с названиями
 * и формулами. Слой с молекулами лежит «под» фото во весь его размер и в лупе увеличен: ведёшь
 * лупой — видишь другие молекулы. Работает на карточках, у товара недели и в окне товара.
 * Нажатие — как и раньше: открывает карточку товара.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});
  const SEL = '.product__media, .spotlight__media, .product-dialog__media';
  const BL = 16;                 // длина связи в слое молекул (единицы слоя 480×600)
  const LENS_BOND = 19;          // какой она должна быть в лупе, px

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Оправа и ручка: кольцо, металлическая втулка и деревянная ручка под 45° вниз-вправо
  function frameSVG(D) {
    const R = D / 2, L = Math.round(D * 0.6), S = Math.ceil(R + L + 34);
    const x0 = R + 6, fx = x0 + 18;
    return {
      S,
      svg: `<svg class="loupe__frame" viewBox="${-S} ${-S} ${2 * S} ${2 * S}" width="${2 * S}" height="${2 * S}" style="left:${R - S}px;top:${R - S}px" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="loupe-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#d9ddd6"/><stop offset="0.28" stop-color="#6f766f"/>
            <stop offset="0.55" stop-color="#262b27"/><stop offset="0.8" stop-color="#8d948c"/><stop offset="1" stop-color="#2c312d"/>
          </linearGradient>
          <linearGradient id="loupe-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8a5b35"/><stop offset="0.35" stop-color="#5c3a20"/>
            <stop offset="0.75" stop-color="#3b2413"/><stop offset="1" stop-color="#23150b"/>
          </linearGradient>
          <linearGradient id="loupe-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f1f3ef"/><stop offset="0.45" stop-color="#9aa19a"/><stop offset="1" stop-color="#3a403b"/>
          </linearGradient>
        </defs>
        <g transform="rotate(45)">
          <rect x="${x0}" y="-8" width="22" height="16" rx="3" fill="url(#loupe-steel)"/>
          <rect x="${fx}" y="-11" width="${L}" height="22" rx="11" fill="url(#loupe-wood)"/>
          <rect x="${fx + 6}" y="-7.5" width="${L - 16}" height="3" rx="1.5" fill="#ffffff" fill-opacity="0.16"/>
          <rect x="${fx + L - 12}" y="-11" width="3" height="22" fill="#000" fill-opacity="0.18"/>
        </g>
        <circle r="${R + 5}" fill="none" stroke="url(#loupe-rim)" stroke-width="11"/>
        <circle r="${R + 10}" fill="none" stroke="#0d100e" stroke-opacity="0.55" stroke-width="1"/>
        <circle r="${R + 0.5}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1"/>
      </svg>`,
    };
  }

  Z.initLoupe = function () {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!Z.moleculeLayer) return null;

    const el = document.createElement('div');
    el.className = 'loupe';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="loupe__body"><div class="loupe__lens"><div class="loupe__layer"></div><span class="loupe__glass"></span></div><span class="loupe__hint">Открыть</span></div>';
    const body = el.firstElementChild;
    const lens = body.querySelector('.loupe__lens');
    const layer = body.querySelector('.loupe__layer');
    const hint = body.querySelector('.loupe__hint');
    document.body.appendChild(el);

    let media = null, pid = null, D = 0, M = 1, frameD = 0;
    let box = null;                      // рамка фото на экране
    let origin = { x: 0, y: 0 };         // сдвиг «фиксированной» системы координат у контейнера лупы
    let px = -1, py = -1, raf = 0;

    const idOf = (m) => {
      if (m.dataset.productOpen) return m.dataset.productOpen;
      const add = m.closest('dialog') && m.closest('dialog').querySelector('[data-pd-add]');
      return add ? add.dataset.pdId : null;
    };

    function mount(m) {
      // в открытом окне товара лупа должна быть внутри <dialog> — иначе окно окажется поверх неё
      const host = m.closest('dialog') || document.body;
      if (el.parentNode !== host) host.appendChild(el);
      el.style.transform = 'translate3d(0,0,0)';
      const r = el.getBoundingClientRect();
      origin = { x: r.left, y: r.top };
    }

    function measure() {
      box = media.getBoundingClientRect();
      const s = Math.max(box.width / 480, box.height / 600);           // слой ложится «обложкой», как фото
      M = clamp(LENS_BOND / (BL * s), 1.2, 3);
      D = Math.round(clamp(Math.min(box.width, box.height) * 0.62, 168, 250));
      layer.style.width = `${box.width * M}px`;
      layer.style.height = `${box.height * M}px`;
      body.style.setProperty('--d', `${D}px`);
      if (D !== frameD) {
        const old = body.querySelector('.loupe__frame');
        if (old) old.remove();
        body.insertAdjacentHTML('beforeend', frameSVG(D).svg);
        frameD = D;
      }
    }

    function enter(m) {
      media = m;
      const id = idOf(m);
      if (id !== pid) {
        pid = id;
        layer.innerHTML = id ? Z.moleculeLayer(id) : '';
        lens.style.background = Z.moleculeTint ? Z.moleculeTint(id) : '';
      }
      hint.hidden = !!m.closest('dialog');
      mount(m);
      measure();
      m.classList.add('is-looking');
      el.classList.add('is-on');
      place();
    }

    function leave() {
      if (!media) return;
      media.classList.remove('is-looking');
      media = null;
      el.classList.remove('is-on');
    }

    function place() {
      raf = 0;
      if (!media) return;
      const lx = px - box.left, ly = py - box.top;
      el.style.transform = `translate3d(${px - origin.x - D / 2}px, ${py - origin.y - D / 2}px, 0)`;
      layer.style.transform = `translate3d(${D / 2 - lx * M}px, ${D / 2 - ly * M}px, 0)`;
    }

    // какая фотография под указателем (лупа сама событий не ловит)
    function check(target) {
      const m = target instanceof Element ? target.closest(SEL) : null;
      if (m === media) return;
      leave();
      if (m && fine.matches) enter(m);
    }

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') {
        leave();
        return;
      }
      px = e.clientX;
      py = e.clientY;
      check(e.target);
      if (media && !raf) raf = requestAnimationFrame(place);
    }, { passive: true });

    // страница прокрутилась, а мышь стоит: фото уехало из-под лупы или подъехало другое
    document.addEventListener('scroll', () => {
      if (px < 0) return;
      const t = document.elementFromPoint(px, py);
      check(t);
      if (media) {
        box = media.getBoundingClientRect();
        if (!raf) raf = requestAnimationFrame(place);
      }
    }, { passive: true, capture: true });

    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    window.addEventListener('resize', () => media && measure());
    document.addEventListener('pointerdown', () => el.classList.add('is-press'));
    document.addEventListener('pointerup', () => el.classList.remove('is-press'));
    // окно товара закрылось — лупа возвращается в документ
    document.addEventListener('close', (e) => {
      if (e.target instanceof HTMLDialogElement && el.parentNode === e.target) {
        leave();
        document.body.appendChild(el);
      }
    }, true);

    return { leave };
  };
})();
