/*
 * Первый экран: ролик «из пачки без конца льётся молоко» (рендер в Blender, по мотивам SPYLT) —
 * бесшовная петля: струя не начинается и не обрывается.
 * Видео крутится только пока первый экран на виду. При «уменьшении движения» и в режиме экономии
 * трафика остаётся неподвижный постер — сам ролик тогда даже не скачивается (preload="none").
 * Постер — первый кадр ролика, поэтому подмена постера на видео не видна.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});

  Z.initHeroVideo = function () {
    const video = document.querySelector('[data-hero-video]');
    if (!video) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const conn = navigator.connection;
    if (conn && conn.saveData) return;

    let onScreen = true;

    function update() {
      const run = onScreen && !reduce.matches && !document.hidden;
      if (!run) {
        if (!video.paused) video.pause();
        return;
      }
      video.preload = 'auto';
      // play() может отказать (энергосбережение на телефоне) — тогда просто остаётся постер
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        onScreen = entries[0].isIntersecting;
        update();
      }).observe(video);
    }
    reduce.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
  };
})();
