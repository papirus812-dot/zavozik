/*
 * Программа лояльности: игра «Молочная ферма» (assets/js/game) и бонусный счёт сайта.
 *  • Z.bonus — рубли, заработанные в игре (1 000 000 л = 1 ₽). Хранятся в этом браузере: сервера и
 *    аккаунтов у сайта пока нет, поэтому это демо-бонусы. Корзина показывает, сколько ими можно оплатить.
 *  • Код игры тяжёлый, поэтому грузится не сразу, а когда посетитель тянется к карточке
 *    «Программа лояльности» (наведение, фокус); по нажатию игра открывается.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});
  const KEY = 'zavozik.bonus.v1';
  const subs = [];

  Z.BONUS_ORDER_SHARE = 0.1;          // бонусами — не больше 10 % заказа

  Z.bonus = {
    get() {
      try {
        return Math.max(0, Math.floor(JSON.parse(localStorage.getItem(KEY) || '{}').rub || 0));
      } catch (e) {
        return 0;
      }
    },
    add(n) {
      const v = this.get() + n;
      try {
        localStorage.setItem(KEY, JSON.stringify({ rub: v }));
      } catch (e) { /* хранилище недоступно */ }
      subs.forEach((fn) => fn(v));
    },
    subscribe(fn) {
      subs.push(fn);
    },
  };
  // бонусы начислены в другой вкладке — обновить
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) subs.forEach((fn) => fn(Z.bonus.get()));
  });

  const FILES = ['assets/js/game/farm-data.js', 'assets/js/game/farm-engine.js', 'assets/js/game/farm-3d.js', 'assets/js/game/farm-ui.js'];
  let loading = null;

  function script(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => fail(new Error(src));
      document.head.appendChild(s);
    });
  }

  Z.loadFarm = function () {
    if (!loading) {
      loading = (async () => {
        for (const f of FILES) await script(f);
      })();
      loading.catch(() => {
        loading = null;
      });
    }
    return loading;
  };

  Z.initLoyalty = function () {
    const card = document.querySelector('[data-loyalty]');
    if (!card) return;
    const warm = () => Z.loadFarm().catch(() => {});
    card.addEventListener('pointerenter', warm, { once: true });
    card.addEventListener('focus', warm, { once: true });
    card.addEventListener('click', async () => {
      card.classList.add('is-loading');
      try {
        await Z.loadFarm();
        Z.farm.open(card);
      } catch (e) {
        console.warn('Завозик: игру не удалось загрузить.', e);
      }
      card.classList.remove('is-loading');
    });
    // ссылка прямо на игру (…/home.html#ferma)
    if (location.hash === '#ferma') {
      history.replaceState(null, '', location.pathname + location.search);
      Z.loadFarm().then(() => Z.farm.open(card)).catch(() => {});
    }
  };
})();
