/*
 * Каталог в главах «Молоко» и «Сыры»: товар недели крупно (spotlight), затем полки
 * «Каждый день» / «Классика» и «С характером». Карточка: фото, название (открывает описание),
 * вид и объём, цена (для товаров недели — со скидкой) и «В корзину».
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});

  // Подпись под названием: вид продукта, жирность, объём — как на упаковке
  Z.productMeta = (p) => [p.kind, p.fat, p.size].filter(Boolean).join(', ');

  Z.priceHTML = (p) =>
    `<span class="price-now">${Z.formatPrice(p.price)}</span>` +
    (p.oldPrice ? `<s class="price-old"><span class="visually-hidden">Цена без скидки: </span>${Z.formatPrice(p.oldPrice)}</s>` : '');

  const alt = (p) => `${p.name} «Завозик»${p.size ? ', ' + p.size : ''}`;
  const sticker = (p) => (p.discount ? `<span class="sticker" aria-hidden="true">−${p.discount}%</span>` : '');
  // Звёздочки кнопки «В корзину» (buy-button.css): вылетают из-под кнопки, форма — #buy-star в home.html
  Z.buyStars = [1, 2, 3, 4, 5, 6]
    .map((n) => `<svg class="buy-button__star buy-button__star--${n}" viewBox="0 0 784.11 815.53" aria-hidden="true" focusable="false"><use href="#buy-star"/></svg>`)
    .join('');
  const addButton = (p, describedBy) => `
    <button class="buy-button" type="button" data-add="${p.id}" aria-describedby="${describedBy}">
      <span class="buy-button__label">В корзину</span>${Z.buyStars}
    </button>`;
  const inCart = (p) => `
    <p class="product__incart" data-in-cart="${p.id}" hidden>
      <span>В корзине: <span data-in-cart-count>0</span></span>
      <button class="link-button" type="button" data-cart-open>Открыть корзину</button>
    </p>`;

  // Фото повторяет кнопку-название (для мыши), поэтому не в порядке табуляции и скрыто от чтения
  function card(p) {
    return `
      <li class="product${p.discount ? ' is-deal' : ''}" data-product="${p.id}">
        <button class="product__media" type="button" data-product-open="${p.id}" tabindex="-1" aria-hidden="true">
          <img src="${p.image}" width="600" height="750" loading="lazy" decoding="async" alt="${alt(p)}">
          ${sticker(p)}
        </button>
        <div class="product__body">
          <h4 class="product__name" id="product-${p.id}">
            <button class="name-button" type="button" data-product-open="${p.id}">${p.name}${p.discount ? `<span class="visually-hidden">, товар недели, скидка ${p.discount}%</span>` : ''}</button>
          </h4>
          <p class="product__kind">${Z.productMeta(p)}</p>
          <p class="product__teaser">${p.teaser}</p>
          <div class="product__buy">
            <p class="product__price">${Z.priceHTML(p)}</p>
            ${addButton(p, `product-${p.id}`)}
          </div>
          ${inCart(p)}
        </div>
      </li>`;
  }

  // Товар недели главы: первый товар этой категории из недельной подборки
  function spotlight(p) {
    return `
      <button class="spotlight__media" type="button" data-product-open="${p.id}" tabindex="-1" aria-hidden="true">
        <img src="${p.image}" width="600" height="750" loading="lazy" decoding="async" alt="${alt(p)}">
        ${sticker(p)}
      </button>
      <div class="spotlight__info">
        <p class="spotlight__label">Товар недели, скидка ${p.discount}%</p>
        <h3 class="spotlight__name" id="product-${p.id}-spot">
          <button class="name-button" type="button" data-product-open="${p.id}">${p.name}</button>
        </h3>
        <p class="spotlight__text">${p.text}</p>
        <div class="spotlight__buy">
          <p class="product__price">${Z.priceHTML(p)}</p>
          ${addButton(p, `product-${p.id}-spot`)}
        </div>
        ${inCart(p)}
      </div>`;
  }

  // Короткое «Добавлено» прямо на кнопке (она заодно «зажигается» — звёзды, в том числе на телефоне)
  Z.confirmAdded = function (button) {
    const label = button.querySelector('.buy-button__label');
    if (!label) return;
    button.classList.add('is-added');
    label.textContent = 'Добавлено';
    clearTimeout(button.zavozikTimer);
    button.zavozikTimer = setTimeout(() => {
      button.classList.remove('is-added');
      label.textContent = 'В корзину';
    }, 1400);
  };

  Z.initCatalog = function (store, { announce } = {}) {
    for (const list of document.querySelectorAll('[data-catalog]')) {
      const items = Z.products.filter((p) => p.category === list.dataset.catalog && (!list.dataset.shelf || p.shelf === list.dataset.shelf));
      list.innerHTML = items.map(card).join('');
    }
    for (const box of document.querySelectorAll('[data-spotlight]')) {
      const p = (Z.weekly || []).find((w) => w.category === box.dataset.spotlight);
      if (p) box.innerHTML = spotlight(p);
    }

    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-add]');
      if (!button) return;
      const id = button.dataset.add;
      store.add(id);
      Z.confirmAdded(button);
      if (announce) {
        const p = store.catalog.get(id);
        const n = store.count();
        announce(`«${p.name}» в корзине. Всего ${n} ${Z.plural(n, ['товар', 'товара', 'товаров'])}.`);
      }
    });

    function refresh() {
      for (const el of document.querySelectorAll('[data-in-cart]')) {
        const qty = store.qty(el.dataset.inCart);
        el.hidden = qty === 0;
        el.querySelector('[data-in-cart-count]').textContent = `${qty} шт.`;
      }
    }
    store.subscribe(refresh);
    refresh();
  };
})();
