/*
 * Данные корзины: товары и количества, сохранение в localStorage,
 * синхронизация между вкладками. Интерфейс подписывается на изменения.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});
  const KEY = 'zavozik.cart.v1';
  const MAX_QTY = 99;

  class CartStore {
    constructor(catalog) {
      this.catalog = catalog; // Map: id → товар
      this.items = new Map(); // id → количество, в порядке добавления
      this.listeners = new Set();
      this.load();
      // Корзина открыта в другой вкладке — подтягиваем изменения
      window.addEventListener('storage', (e) => {
        if (e.key !== KEY) return;
        this.load();
        this.emit({ type: 'sync' });
      });
    }

    load() {
      this.items.clear();
      let data = null;
      try {
        data = JSON.parse(localStorage.getItem(KEY) || 'null');
      } catch (e) {
        data = null;
      }
      const list = data && Array.isArray(data.items) ? data.items : [];
      for (const item of list) {
        if (!item || !this.catalog.has(item.id)) continue; // товара больше нет в каталоге
        const qty = Math.floor(Number(item.qty));
        if (qty > 0) this.items.set(item.id, Math.min(MAX_QTY, qty));
      }
    }

    save() {
      try {
        const items = [...this.items].map(([id, qty]) => ({ id, qty }));
        localStorage.setItem(KEY, JSON.stringify({ items }));
      } catch (e) {
        // хранилище недоступно (приватный режим) — корзина живёт до перезагрузки
      }
    }

    qty(id) {
      return this.items.get(id) || 0;
    }

    add(id, n = 1) {
      if (!this.catalog.has(id)) return;
      this.set(id, this.qty(id) + n, 'add');
    }

    set(id, qty, type = 'set') {
      if (!this.catalog.has(id)) return;
      const next = Math.max(0, Math.min(MAX_QTY, Math.floor(qty)));
      if (next === this.qty(id)) return;
      if (next === 0) this.items.delete(id);
      else this.items.set(id, next);
      this.save();
      this.emit({ type: next === 0 ? 'remove' : type, id });
    }

    remove(id) {
      if (!this.items.has(id)) return;
      this.items.delete(id);
      this.save();
      this.emit({ type: 'remove', id });
    }

    clear() {
      if (!this.items.size) return;
      this.items.clear();
      this.save();
      this.emit({ type: 'clear' });
    }

    count() {
      let n = 0;
      for (const qty of this.items.values()) n += qty;
      return n;
    }

    total() {
      let sum = 0;
      for (const [id, qty] of this.items) sum += this.catalog.get(id).price * qty;
      return sum;
    }

    lines() {
      return [...this.items].map(([id, qty]) => ({ product: this.catalog.get(id), qty }));
    }

    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    emit(event) {
      for (const fn of this.listeners) fn(event, this);
    }
  }

  const priceFormat = new Intl.NumberFormat('ru-RU');

  Z.CartStore = CartStore;
  Z.formatPrice = (n) => `${priceFormat.format(n)} ₽`;
  // 1 товар, 2 товара, 5 товаров
  Z.plural = (n, [one, few, many]) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };
})();
