/* Сборка главной: ролик первого экрана, шапка, главы, каталоги, карточка товара, корзина и 3D-сцены глав */
(function () {
  'use strict';

  const Z = window.Zavozik;

  function boot() {
    const announcer = document.querySelector('[data-announcer]');
    // Сообщения для экранного диктора: пересоздаём текст, чтобы повтор тоже прозвучал
    const announce = (text) => {
      announcer.textContent = '';
      setTimeout(() => {
        announcer.textContent = text;
      }, 40);
    };

    const store = new Z.CartStore(new Map(Z.products.map((p) => [p.id, p])));
    Z.cart = store;

    // ролик первого экрана — сразу: он виден первым
    if (Z.initHeroVideo) Z.initHeroVideo();
    if (Z.initHeroText) Z.heroText = Z.initHeroText();
    Z.initHeader();
    Z.chapters = Z.initChapters();
    Z.initCatalog(store, { announce });
    Z.cartPanel = Z.initCart(store, { announce });
    Z.productDialog = Z.initProductDialog(store, { announce });
    // лупа с «молекулярным составом» над фото товаров (только мышь)
    if (Z.initLoupe) Z.loupe = Z.initLoupe();
    // 3D — последним: библиотека грузится отдельно, без неё страница работает с запасными фонами
    if (Z.initScenes) Z.scenes = Z.initScenes();
    // линия обработки в 3D в «Производстве» — грузится, когда блок подъезжает к экрану
    if (Z.initPlant3D) Z.plant3d = Z.initPlant3D();
    // «Программа лояльности» открывает игру «Молочная ферма»
    if (Z.initLoyalty) Z.initLoyalty();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
