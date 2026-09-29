/*
 * Карточка товара во всплывающем окне: фото, описание, что указано на упаковке, цена и «В корзину».
 * Открывается из каталога и из карусели «Товары недели». Escape и клик мимо закрывают,
 * фокус остаётся внутри окна и возвращается туда, откуда окно открыли.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});
  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  Z.initProductDialog = function (store, { announce = () => {} } = {}) {
    const dialog = document.querySelector('[data-product-dialog]');
    if (!dialog) return null;
    const panel = dialog.querySelector('.product-dialog__panel');
    const q = (s) => dialog.querySelector(s);
    const els = {
      image: q('[data-pd-image]'),
      deal: q('[data-pd-deal]'),
      kind: q('[data-pd-kind]'),
      title: q('[data-pd-title]'),
      facts: q('[data-pd-facts]'),
      text: q('[data-pd-text]'),
      tips: q('[data-pd-tips]'),
      marksWrap: q('[data-pd-marks-wrap]'),
      marks: q('[data-pd-marks]'),
      price: q('[data-pd-price]'),
      add: q('[data-pd-add]'),
      incart: q('[data-pd-incart]'),
      close: q('.product-dialog__close'),
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = null;
    let opener = null;
    let closing = null;

    function fill(p) {
      current = p;
      els.image.src = p.image;
      els.image.alt = `${p.name} «Завозик»${p.size ? ', ' + p.size : ''}`;
      els.deal.hidden = !p.discount;
      els.deal.textContent = p.discount ? `−${p.discount}%` : '';
      els.kind.textContent = (p.category === 'cheese' ? 'Сыры' : 'Молоко') + (p.discount ? `, товар недели со скидкой ${p.discount}%` : '');
      els.title.textContent = p.name;
      const facts = [
        ['Продукт', p.kind],
        ['Жирность', p.fat],
        [p.category === 'cheese' || /г$/.test(p.size || '') ? 'Вес' : 'Объём', p.size],
      ].filter(([, v]) => v);
      els.facts.innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      els.text.textContent = p.text;
      els.tips.textContent = p.tips;
      els.marksWrap.hidden = !p.marks.length;
      els.marks.innerHTML = p.marks.map((m) => `<li>${m}</li>`).join('');
      els.price.innerHTML = Z.priceHTML(p);
      els.add.dataset.pdId = p.id;
      refreshInCart();
    }

    function refreshInCart() {
      if (!current) return;
      const qty = store.qty(current.id);
      els.incart.hidden = qty === 0;
      els.incart.innerHTML = qty ? `<span>В корзине: ${qty} шт.</span> <button class="link-button" type="button" data-pd-to-cart>Открыть корзину</button>` : '';
    }

    function open(id, from) {
      const p = store.catalog.get(id);
      if (!p) return;
      if (closing) finishClose(false);
      fill(p);
      if (!dialog.open) {
        opener = from || document.activeElement;
        dialog.showModal();
        document.documentElement.classList.add('is-locked');
        requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-open')));
      }
      els.close.focus({ preventScroll: true });
      panel.scrollTop = 0;
    }

    function close(restoreFocus = true) {
      if (!dialog.open || closing) return;
      dialog.classList.remove('is-open');
      if (reduce.matches) {
        finishClose(restoreFocus);
        return;
      }
      const onEnd = (e) => {
        if (e.target === panel) finishClose(restoreFocus);
      };
      panel.addEventListener('transitionend', onEnd);
      const timer = setTimeout(() => finishClose(restoreFocus), 500);
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
      if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('is-locked');
      if (restoreFocus && opener && document.contains(opener) && opener.getClientRects().length) opener.focus({ preventScroll: true });
      opener = null;
    }

    // Открыть: любая кнопка с data-product-open (каталог, товар недели, подпись пачки на первом экране)
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-product-open]');
      if (trigger) {
        e.preventDefault();
        open(trigger.dataset.productOpen, trigger);
        return;
      }
      if (dialog.contains(e.target) && e.target.closest('[data-pd-close]')) close();
    });

    els.add.addEventListener('click', () => {
      if (!current) return;
      store.add(current.id);
      Z.confirmAdded(els.add);
      const n = store.count();
      announce(`«${current.name}» в корзине. Всего ${n} ${Z.plural(n, ['товар', 'товара', 'товаров'])}.`);
    });

    // «Открыть корзину» из карточки: закрыть карточку и показать корзину
    dialog.addEventListener('click', (e) => {
      if (!e.target.closest('[data-pd-to-cart]')) return;
      const back = opener;
      close(false);
      setTimeout(() => Z.cartPanel && Z.cartPanel.open(back), reduce.matches ? 0 : 320);
    });

    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
    dialog.addEventListener('close', () => {
      if (closing || dialog.classList.contains('is-open')) finishClose(true);
    });

    // Tab и Shift+Tab ходят по кругу внутри окна
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

    store.subscribe(refreshInCart);

    return { open, close };
  };
})();
