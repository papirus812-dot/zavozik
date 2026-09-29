/*
 * Корзина — боковая панель: список, +/−, удаление, итог, пустое состояние.
 * Модальный <dialog>: фокус внутри панели, Escape и клик мимо закрывают,
 * после закрытия фокус возвращается туда, откуда корзину открыли.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});

  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  Z.initCart = function (store, { announce = () => {} } = {}) {
    const dialog = document.querySelector('[data-cart]');
    if (!dialog) return null;
    const panel = dialog.querySelector('.cart__panel');
    const list = dialog.querySelector('[data-cart-list]');
    const empty = dialog.querySelector('[data-cart-empty]');
    const foot = dialog.querySelector('[data-cart-foot]');
    const totalEl = dialog.querySelector('[data-cart-total]');
    const closeButton = dialog.querySelector('.cart__head [data-cart-close]');
    const counters = document.querySelectorAll('[data-cart-count]');
    // переключатель-корзина в шапке: «включается», когда в корзине что-то есть (header.css)
    const toggles = document.querySelectorAll('[data-cart-toggle]');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rows = new Map(); // id → <li>
    let opener = null;
    let closing = null;
    let lastCount = store.count();

    /* ---------- открыть / закрыть ---------- */
    function open(from) {
      if (dialog.open && !closing) return;
      if (closing) finishClose(false);
      opener = from || document.activeElement;
      dialog.showModal();
      document.documentElement.classList.add('is-locked');
      // класс — на следующем кадре, чтобы панель выехала, а не появилась
      requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-open')));
      // панель ещё за краем экрана: без preventScroll браузер прокрутил бы сам диалог к кнопке
      closeButton.focus({ preventScroll: true });
    }

    function close() {
      if (!dialog.open || closing) return;
      dialog.classList.remove('is-open');
      if (reduce.matches) {
        finishClose(true);
        return;
      }
      const onEnd = (e) => {
        if (e.target === panel) finishClose(true);
      };
      panel.addEventListener('transitionend', onEnd);
      const timer = setTimeout(() => finishClose(true), 650);
      closing = () => {
        panel.removeEventListener('transitionend', onEnd);
        clearTimeout(timer);
      };
    }

    function finishClose(restoreFocus) {
      if (closing) closing();
      closing = null;
      if (dialog.open) dialog.close();
      dialog.classList.remove('is-open');
      document.documentElement.classList.remove('is-locked');
      if (restoreFocus && opener && document.contains(opener) && opener.getClientRects().length) opener.focus();
      opener = null;
    }

    document.addEventListener('click', (e) => {
      const openButton = e.target.closest('[data-cart-open]');
      if (openButton) {
        e.preventDefault();
        open(openButton);
        return;
      }
      if (dialog.contains(e.target) && e.target.closest('[data-cart-close]')) close();
    });

    // Escape: браузер присылает cancel — закрываем плавно, а не мгновенно
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
    // если браузер всё же закрыл диалог сам (повторный Escape) — прибираемся
    dialog.addEventListener('close', () => {
      if (closing || document.documentElement.classList.contains('is-locked')) finishClose(true);
    });

    // Tab и Shift+Tab ходят по кругу внутри панели
    dialog.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length && !el.closest('[hidden]'));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // «Перейти к молоку» в пустой корзине: закрыть панель и прокрутить к каталогу
    dialog.querySelector('[data-cart-goto]').addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('milk');
      opener = null;
      close();
      target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });

    dialog.querySelector('[data-cart-clear]').addEventListener('click', () => {
      store.clear();
      announce('Корзина очищена.');
      dialog.querySelector('[data-cart-goto]').focus();
    });

    /* ---------- строки товаров ---------- */
    function createRow(product) {
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.dataset.id = product.id;
      const deal = product.discount ? `<span class="cart-item__deal">−${product.discount}%</span>` : '';
      const size = [product.fat, product.size].filter(Boolean).join(', ');
      li.innerHTML = `
        <div class="cart-item__art" aria-hidden="true"><img src="${product.thumb}" width="360" height="360" alt="" loading="lazy" decoding="async"></div>
        <div class="cart-item__info">
          <p class="cart-item__name">${product.name}${deal}</p>
          <p class="cart-item__meta">${size ? size + '. ' : ''}${Z.formatPrice(product.price)} за шт.</p>
          <div class="qty" role="group" aria-label="Количество: ${product.name}">
            <button class="qty__btn" type="button" data-dec aria-label="Меньше: ${product.name}">−</button>
            <span class="qty__value" data-qty>1</span>
            <button class="qty__btn" type="button" data-inc aria-label="Больше: ${product.name}">+</button>
          </div>
        </div>
        <div class="cart-item__side">
          <p class="cart-item__sum" data-sum></p>
          <button class="cart-item__remove" type="button" data-remove aria-label="Удалить из корзины: ${product.name}">Удалить</button>
        </div>`;
      return li;
    }

    list.addEventListener('click', (e) => {
      const row = e.target.closest('.cart-item');
      if (!row) return;
      const id = row.dataset.id;
      const product = store.catalog.get(id);
      if (e.target.closest('[data-inc]')) {
        store.set(id, store.qty(id) + 1);
        announce(`${product.name}: ${store.qty(id)} шт.`);
      } else if (e.target.closest('[data-dec]')) {
        store.set(id, Math.max(1, store.qty(id) - 1));
        announce(`${product.name}: ${store.qty(id)} шт.`);
      } else if (e.target.closest('[data-remove]')) {
        // фокус — на соседнюю строку, а если товаров не осталось — на кнопку каталога
        const sibling = row.nextElementSibling || row.previousElementSibling;
        store.remove(id);
        announce(`«${product.name}» удалён из корзины.`);
        const next = sibling && sibling.querySelector('[data-remove]');
        (next || dialog.querySelector('[data-cart-goto]')).focus();
      }
    });

    function render(event) {
      const lines = store.lines();
      const alive = new Set(lines.map((l) => l.product.id));

      for (const [id, li] of rows) {
        if (alive.has(id)) continue;
        rows.delete(id);
        if (reduce.matches || !dialog.open) li.remove();
        else {
          li.classList.add('is-leaving');
          li.addEventListener('animationend', () => li.remove(), { once: true });
          setTimeout(() => li.remove(), 400);
        }
      }

      for (const { product, qty } of lines) {
        let li = rows.get(product.id);
        if (!li) {
          li = createRow(product);
          rows.set(product.id, li);
          list.appendChild(li);
        }
        li.querySelector('[data-qty]').textContent = String(qty);
        li.querySelector('[data-sum]').textContent = Z.formatPrice(product.price * qty);
        li.querySelector('[data-dec]').disabled = qty <= 1;
      }

      const count = store.count();
      const isEmpty = count === 0;
      empty.hidden = !isEmpty;
      foot.hidden = isEmpty;
      totalEl.textContent = Z.formatPrice(store.total());
      renderBonus();

      for (const t of toggles) t.classList.toggle('is-filled', !isEmpty);
      for (const el of counters) {
        // в кружке переключателя места на две цифры
        el.textContent = count > 99 && el.hasAttribute('data-cart-count-short') ? '99+' : String(count);
        if (count > lastCount && event) {
          el.classList.remove('is-bump');
          void el.offsetWidth; // перезапуск анимации
          el.classList.add('is-bump');
        }
      }
      lastCount = count;
    }

    // Бонусы из игры «Молочная ферма»: оплатить ими можно до 10 % заказа
    const bonusBox = dialog.querySelector('[data-cart-bonus]');
    function renderBonus() {
      if (!bonusBox || !Z.bonus) return;
      const rub = Z.bonus.get();
      const total = store.total();
      const use = Math.min(rub, Math.floor(total * (Z.BONUS_ORDER_SHARE || 0.1)));
      bonusBox.hidden = rub <= 0 || total <= 0;
      if (bonusBox.hidden) return;
      bonusBox.querySelector('[data-bonus-use]').textContent = `−${Z.formatPrice(use)}`;
      bonusBox.querySelector('[data-bonus-total]').textContent = Z.formatPrice(total - use);
      bonusBox.querySelector('[data-bonus-note]').textContent =
        `На бонусном счёте ${rub} ₽. Бонусами можно оплатить до ${Math.round((Z.BONUS_ORDER_SHARE || 0.1) * 100)} % заказа — спишутся при оформлении.`;
    }
    if (Z.bonus) Z.bonus.subscribe(renderBonus);

    store.subscribe(render);
    render(null);

    return { open, close };
  };
})();
