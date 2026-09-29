/*
 * Шапка: логотип возвращает наверх; когда первый экран прокручен, под шапкой появляется затемнение,
 * чтобы логотип и корзина читались поверх любых сцен и панелей.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});

  Z.initHeader = function () {
    const header = document.querySelector('[data-header]');
    if (!header) return null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hero = document.getElementById('top');

    // Логотип — наверх, к первому экрану
    header.querySelector('[data-scroll-top]').addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    });

    function update() {
      if (hero) header.classList.toggle('is-over-content', hero.getBoundingClientRect().bottom < header.offsetHeight + 24);
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

    return { update };
  };
})();
