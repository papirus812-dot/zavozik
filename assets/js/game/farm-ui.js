/*
 * «Молочная ферма»: окно игры и всё, что в нём видно и нажимается.
 * Открывается из карточки «Программа лояльности»: окошко с тремя точками раздвигается во весь экран
 * и становится окном игры; «Назад в магазин», Esc и кнопка «назад» браузера сворачивают его обратно.
 * Слева — домик-ферма (тап: домик пружинит, брызги молока, «+N л», звук, вибрация на телефоне),
 * в середине — уровни (полосы-диорамы купленных построек), справа — магазин и награды.
 * На телефоне: ферма сверху, уровни и магазин — вкладками снизу.
 * Z.farm.open(fromElement) / Z.farm.close()
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});
  const F = (Z.farm = Z.farm || {});
  const fmt = (n, p) => F.fmt(n, p);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let ui = null;           // DOM и состояние окна — создаются при первом открытии

  const ICON_ARROW = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12 4 6 10l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_SOUND = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="farm__wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  const DROP = '<svg viewBox="0 0 16 20" width="12" height="15" aria-hidden="true" focusable="false"><path d="M8 1C8 1 2 8.4 2 12.6A6 6 0 0 0 14 12.6C14 8.4 8 1 8 1Z" fill="currentColor"/></svg>';

  // запасной домик, пока грузится 3D (и если WebGL недоступен)
  const HOUSE_SVG = `<svg class="farm__house-fallback" viewBox="0 0 200 170" aria-hidden="true" focusable="false">
    <ellipse cx="100" cy="150" rx="92" ry="16" fill="#3f6b2c"/>
    <rect x="46" y="72" width="108" height="74" fill="#f1ece0"/>
    <path d="M36 76 100 30l64 46z" fill="#3f6d2c"/>
    <rect x="58" y="80" width="84" height="18" fill="#2f5824"/>
    <text x="100" y="93" text-anchor="middle" font-size="9.5" font-family="Wix Madefor Display, sans-serif" fill="#f4efdf">МОЛОЧНАЯ ФЕРМА</text>
    <rect x="84" y="106" width="32" height="40" fill="#8a5a33"/>
    <rect x="16" y="60" width="26" height="86" rx="4" fill="#ece6d6"/><path d="M14 62a15 15 0 0 1 30 0z" fill="#3f6d2c"/>
  </svg>`;

  /* ================= звук: свой, собран в браузере ================= */
  const sound = {
    ctx: null,
    on: true,
    get() {
      if (!this.ctx) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) return null;
        this.ctx = new A();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, { type = 'sine', vol = 0.12, slide = 1, delay = 0 } = {}) {
      if (!this.on) return;
      const c = this.get();
      if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    plop() {
      this.tone(480 * (0.9 + Math.random() * 0.2), 0.12, { slide: 0.4, vol: 0.14 });
    },
    buy() {
      this.tone(784, 0.12, { vol: 0.08 });
      this.tone(1175, 0.18, { vol: 0.07, delay: 0.07 });
    },
    gold() {
      [988, 1319, 1568, 1976].forEach((f, i) => this.tone(f, 0.22, { vol: 0.06, delay: i * 0.07, type: 'triangle' }));
    },
    award() {
      [659, 988].forEach((f, i) => this.tone(f, 0.3, { vol: 0.06, delay: i * 0.1, type: 'triangle' }));
    },
  };

  /* ================= окно ================= */
  function build() {
    const dialog = document.createElement('dialog');
    dialog.className = 'farm';
    dialog.setAttribute('aria-labelledby', 'farm-title');
    dialog.innerHTML = `
      <div class="farm__window" data-win>
        <canvas class="farm__canvas" data-canvas aria-hidden="true"></canvas>
        <header class="farm__bar">
          <span class="farm__dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <button class="farm__back" type="button" data-close>${ICON_ARROW}<span>Назад в магазин</span></button>
          <h2 class="farm__title" id="farm-title">Молочная ферма</h2>
          <div class="farm__bank">
            <p class="farm__rub">Бонусы <strong data-rub>0 ₽</strong></p>
            <button class="farm__exchange" type="button" data-exchange>Обменять на рубли</button>
          </div>
          <button class="farm__sound" type="button" data-sound aria-pressed="true" aria-label="Звук">${ICON_SOUND}</button>
        </header>
        <div class="farm__body" data-body>
          <section class="farm__left" data-pane="farm" aria-label="Ферма">
            <div class="farm__count">
              <p class="farm__liters"><span data-liters>0</span> <span class="farm__unit">л</span></p>
              <p class="farm__rate"><span data-lps>0</span> л в секунду</p>
              <p class="farm__next" data-next></p>
              <p class="farm__wallet" data-wallet></p>
            </div>
            <ul class="farm__buffs" data-buffs></ul>
            <div class="farm__stage" data-house-stage>
              ${HOUSE_SVG}
              <button class="farm__house" type="button" data-house aria-label="Молочная ферма — надоить молоко"></button>
            </div>
            <p class="farm__tap-hint" data-tap-hint>Тапайте по ферме</p>
          </section>
          <section class="farm__middle" data-pane="layers" data-layers-panel aria-label="Уровни фермы">
            <ol class="farm__layers" data-layers></ol>
          </section>
          <section class="farm__store" data-pane="store" aria-label="Магазин">
            <div class="farm__store-tabs" role="tablist">
              <button type="button" role="tab" aria-selected="true" data-store-tab="shop">Магазин</button>
              <button type="button" role="tab" aria-selected="false" data-store-tab="awards">Награды <span data-award-count></span></button>
            </div>
            <div class="farm__shop" data-shop>
              <div class="farm__upgrades" data-upgrades></div>
              <div class="farm__modes" role="group" aria-label="Сколько покупать за раз">
                <button type="button" data-mode="1" aria-pressed="true">×1</button>
                <button type="button" data-mode="10" aria-pressed="false">×10</button>
                <button type="button" data-mode="100" aria-pressed="false">×100</button>
              </div>
              <ol class="farm__buildings" data-buildings></ol>
              <p class="farm__rules">1&nbsp;000&nbsp;000&nbsp;л = 1&nbsp;₽ на бонусный счёт сайта. Обменять можно до ${F.DAILY_RUB}&nbsp;₽ в&nbsp;день, оплатить бонусами — до ${Math.round(F.ORDER_SHARE * 100)}&nbsp;% заказа. Ферма и&nbsp;бонусы хранятся в&nbsp;этом браузере.</p>
            </div>
            <ol class="farm__awards" data-awards hidden></ol>
          </section>
        </div>
        <nav class="farm__tabs" aria-label="Разделы игры">
          <button type="button" data-tab="layers" aria-pressed="false">Уровни</button>
          <button type="button" data-tab="store" aria-pressed="true">Магазин</button>
        </nav>
        <div class="farm__fx" data-fx aria-hidden="true"></div>
        <div class="farm__toasts" data-toasts role="status" aria-live="polite"></div>
        <div class="farm__tip" data-tip hidden></div>
      </div>`;
    document.body.appendChild(dialog);
    const q = (s) => dialog.querySelector(s);
    return {
      dialog,
      win: q('[data-win]'),
      canvas: q('[data-canvas]'),
      body: q('[data-body]'),
      liters: q('[data-liters]'),
      lps: q('[data-lps]'),
      next: q('[data-next]'),
      wallet: q('[data-wallet]'),
      buffs: q('[data-buffs]'),
      stage: q('[data-house-stage]'),
      house: q('[data-house]'),
      tapHint: q('[data-tap-hint]'),
      layersPanel: q('[data-layers-panel]'),
      layers: q('[data-layers]'),
      upgrades: q('[data-upgrades]'),
      buildings: q('[data-buildings]'),
      awards: q('[data-awards]'),
      awardCount: q('[data-award-count]'),
      shop: q('[data-shop]'),
      rub: q('[data-rub]'),
      exchange: q('[data-exchange]'),
      soundBtn: q('[data-sound]'),
      fx: q('[data-fx]'),
      toasts: q('[data-toasts]'),
      tip: q('[data-tip]'),
      mode: 1,
      icons: {},
      rows: new Map(),
      layerEls: new Map(),
      upgradeEls: new Map(),
      from: null,
      running: false,
      closing: false,
      three: null,
    };
  }

  /* ================= игра и её отображение ================= */
  function setup() {
    ui = build();
    const game = F.createGame();
    ui.game = game;
    sound.on = game.state.sound !== false;
    ui.soundBtn.setAttribute('aria-pressed', String(sound.on));

    // тап по ферме: сразу на нажатие (не на отпускание) — так отзывчивее
    ui.house.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      tapAt(e.clientX, e.clientY);
    });
    ui.house.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const r = ui.house.getBoundingClientRect();
      tapAt(r.left + r.width / 2, r.top + r.height / 2);
    });

    ui.dialog.querySelector('[data-close]').addEventListener('click', () => close());
    ui.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
    ui.soundBtn.addEventListener('click', () => {
      sound.on = !sound.on;
      game.setSound(sound.on);
      ui.soundBtn.setAttribute('aria-pressed', String(sound.on));
    });
    // «Обменяно» — по событию игры: оно приходит раньше наград за обмен, и сообщения идут по порядку
    game.on('exchange', (rub) => {
      sound.gold();
      toast('Обменяно', `${rub} ₽ на бонусном счёте сайта. Всего: ${Z.bonus ? Z.bonus.get() : rub} ₽.`);
    });
    ui.exchange.addEventListener('click', () => {
      const res = game.exchange();
      if (res.rub <= 0 && res.info.left <= 0) toast('На сегодня всё', `Обмен — до ${F.DAILY_RUB} ₽ в день. Завтра можно снова.`);
      else if (res.rub <= 0) toast('Пока мало молока', `Нужен миллион литров на 1 ₽. Ещё ${fmt(F.RUB_RATE - (game.state.liters % F.RUB_RATE))} л.`);
      refreshBank();
    });
    ui.dialog.querySelectorAll('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        ui.mode = Number(b.dataset.mode);
        ui.dialog.querySelectorAll('[data-mode]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
        refreshStore(true);
      }));
    ui.dialog.querySelectorAll('[data-store-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        const awards = b.dataset.storeTab === 'awards';
        ui.dialog.querySelectorAll('[data-store-tab]').forEach((o) => o.setAttribute('aria-selected', String(o === b)));
        ui.shop.hidden = awards;
        ui.awards.hidden = !awards;
        if (awards) renderAwards();
      }));
    // вкладки на телефоне: уровни или магазин под фермой
    ui.dialog.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        ui.body.dataset.tab = b.dataset.tab;
        ui.dialog.querySelectorAll('[data-tab]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      }));
    ui.body.dataset.tab = 'store';

    // покупка построек и улучшений
    ui.buildings.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-buy]');
      if (!btn) return;
      if (game.buy(btn.dataset.buy, ui.mode)) {
        sound.buy();
        btn.classList.remove('is-bought');
        void btn.offsetWidth;
        btn.classList.add('is-bought');
      } else shake(btn);
    });
    ui.upgrades.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-upg]');
      if (!btn) return;
      if (game.buyUpgrade(btn.dataset.upg)) {
        sound.buy();
        hideTip();
      } else shake(btn);
    });

    // подсказки при наведении (и фокусе) — что это, сколько даёт
    const tipFor = (el) => {
      if (el.dataset.buy) return buildingTip(el.dataset.buy);
      if (el.dataset.upg) return upgradeTip(el.dataset.upg);
      return '';
    };
    const showTipFrom = (el) => {
      const html = tipFor(el);
      if (!html) return;
      ui.tip.innerHTML = html;
      ui.tip.hidden = false;
      const r = el.getBoundingClientRect(), w = ui.win.getBoundingClientRect();
      const tw = ui.tip.offsetWidth, th = ui.tip.offsetHeight;
      let x = r.left - w.left - tw - 12;
      if (x < 8) x = Math.min(r.right - w.left + 12, w.width - tw - 8);
      const y = Math.max(8, Math.min(r.top - w.top, w.height - th - 8));
      ui.tip.style.transform = `translate(${x}px, ${y}px)`;
    };
    ui.win.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-buy], [data-upg]');
      if (el && e.pointerType === 'mouse') showTipFrom(el);
    });
    ui.win.addEventListener('pointerout', (e) => {
      const el = e.target.closest('[data-buy], [data-upg]');
      if (el && !el.contains(e.relatedTarget)) hideTip();
    });
    ui.win.addEventListener('focusin', (e) => {
      const el = e.target.closest('[data-buy], [data-upg]');
      if (el) showTipFrom(el);
      else hideTip();
    });

    game.on('buy', ({ id }) => {
      layerFor(id);
      if (ui.three) ui.three.setCount(id, game.state.owned[id]);
      refreshStore(true);
      refreshLayers();
    });
    game.on('upgrade', () => {
      refreshStore(true);
      refreshLayers();
    });
    game.on('achievement', (a) => {
      sound.award();
      toast(`Награда: ${a.name}`, a.text, 'award');
      renderAwards();
    });
    game.on('golden', (eff) => {
      sound.gold();
      toast(eff.title, eff.text, 'gold');
    });
    game.on('goldenSpawn', ({ life }) => spawnGolden(life));

    // покинули вкладку или закрыли страницу — сохранить
    document.addEventListener('visibilitychange', () => document.hidden && game.save());
    window.addEventListener('pagehide', () => game.save());
    setInterval(() => ui.running && game.save(), 10000);

    // 3D: грузится отдельно; до готовности — рисованный домик
    F.create3D({ canvas: ui.canvas, host: ui.win }).then(async (three) => {
      ui.three = three;
      ui.win.classList.add('has-3d');
      for (const b of F.BUILDINGS) if (game.state.owned[b.id] > 0) three.setCount(b.id, game.state.owned[b.id], false);
      ui.icons = await three.icons();
      refreshStore(true);
      if (ui.running) three.resize();
    }).catch((err) => console.warn('Завозик: 3D фермы недоступно, остаётся рисунок.', err));

    window.addEventListener('resize', () => {
      if (ui.three) ui.three.resize();
      if (ui.running) fitLiters();
    });
    ui.lastUi = 0;
    ui.lastStore = 0;
    refreshStore(true);
    refreshLayers();
    renderAwards();
    refreshBank();
  }

  /* ---------- тап ---------- */
  function tapAt(x, y) {
    const game = ui.game;
    const n = game.tap();
    const w = ui.win.getBoundingClientRect();
    const lx = x - w.left, ly = y - w.top;
    floatText(lx, ly, `+${fmt(n, true)} л`);
    splash(lx, ly, game.buffMult('click') > 1);
    sound.plop();
    if (navigator.vibrate) navigator.vibrate(8);
    ui.liters.parentElement.classList.remove('is-bump');
    void ui.liters.parentElement.offsetWidth;
    ui.liters.parentElement.classList.add('is-bump');
    if (ui.three) {
      const r = ui.stage.getBoundingClientRect();
      ui.three.bump(((x - r.left) / r.width - 0.5) * 2, ((y - r.top) / r.height - 0.5) * 2);
    } else {
      ui.stage.classList.remove('is-tap');
      void ui.stage.offsetWidth;
      ui.stage.classList.add('is-tap');
    }
    if (ui.tapHint && game.state.clicks > 3) {
      ui.tapHint.remove();
      ui.tapHint = null;
    }
  }

  function floatText(x, y, text) {
    const el = document.createElement('span');
    el.className = 'farm__float';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    ui.fx.appendChild(el);
    const a = el.animate([
      { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0 },
      { transform: 'translate(-50%, -110%) scale(1.08)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%, -260%) scale(1)', opacity: 0 },
    ], { duration: reduce.matches ? 500 : 900, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
    a.onfinish = () => el.remove();
  }

  // брызги молока: капли разлетаются и падают
  function splash(x, y, gold) {
    if (reduce.matches) return;
    const n = gold ? 10 : 7;
    for (let i = 0; i < n; i++) {
      if (ui.fx.childElementCount > 90) break;
      const d = document.createElement('span');
      d.className = gold ? 'farm__drop is-gold' : 'farm__drop';
      d.innerHTML = DROP;
      d.style.left = `${x}px`;
      d.style.top = `${y}px`;
      ui.fx.appendChild(d);
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 60 + Math.random() * 90;
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
      const s = 0.6 + Math.random() * 0.7;
      const rot = (Math.atan2(vy, vx) * 180) / Math.PI + 90;
      const a = d.animate([
        { transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${s})`, opacity: 1 },
        { transform: `translate(calc(-50% + ${vx * 0.6}px), calc(-50% + ${vy * 0.6}px)) rotate(${rot}deg) scale(${s})`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${vx}px), calc(-50% + ${vy + 120}px)) rotate(180deg) scale(${s * 0.7})`, opacity: 0 },
      ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(0.25, 0.6, 0.6, 1)' });
      a.onfinish = () => d.remove();
    }
  }

  function shake(el) {
    el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 220 });
  }

  /* ---------- золотая капля ---------- */
  function spawnGolden(life) {
    if (!ui.running) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'farm__golden';
    btn.setAttribute('aria-label', 'Золотая капля — поймать');
    btn.innerHTML = DROP;
    const w = ui.win.getBoundingClientRect();
    const zone = (ui.layersPanel.offsetParent ? ui.layersPanel : ui.stage).getBoundingClientRect();
    btn.style.left = `${zone.left - w.left + 40 + Math.random() * Math.max(10, zone.width - 80)}px`;
    btn.style.top = `${zone.top - w.top + 60 + Math.random() * Math.max(10, zone.height - 160)}px`;
    ui.fx.after(btn);
    const timer = setTimeout(() => btn.remove(), life);
    btn.addEventListener('click', (e) => {
      clearTimeout(timer);
      const r = btn.getBoundingClientRect();
      splash(r.left - w.left + r.width / 2, r.top - w.top + r.height / 2, true);
      btn.remove();
      ui.game.catchGolden();
      refreshBuffs();
    });
  }

  /* ---------- сообщения ---------- */
  function toast(title, text, kind = '') {
    const el = document.createElement('div');
    el.className = `farm__toast${kind ? ' is-' + kind : ''}`;
    el.innerHTML = `<strong>${title}</strong><span>${text}</span>`;
    ui.toasts.appendChild(el);
    while (ui.toasts.childElementCount > 3) ui.toasts.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 400);
    }, 4200);
  }

  function hideTip() {
    ui.tip.hidden = true;
  }

  /* ---------- магазин ---------- */
  function buildingTip(id) {
    const g = ui.game, b = g.byId.get(id);
    const own = g.state.owned[id];
    const each = own ? g.lpsOf(id, false) / own : b.lps;
    const total = g.lpsOf(id, false), all = g.lps(false);
    return `<strong>${b.name}</strong><p>${b.text}</p>
      <p class="farm__tip-row">Каждая единица: ${fmt(each, true)} л/с</p>
      ${own ? `<p class="farm__tip-row">Все ${own}: ${fmt(total, true)} л/с${all ? ` — ${Math.round((total / all) * 100)} % удоя` : ''}</p>` : ''}`;
  }
  function upgradeTip(id) {
    const u = ui.game.upById.get(id);
    return `<strong>${u.name}</strong><p>${u.text}</p><p class="farm__tip-row">Цена: ${fmt(u.cost)} л</p>`;
  }

  function iconFor(key) {
    return ui.icons[key] ? `<img src="${ui.icons[key]}" alt="" width="56" height="56">` : `<span class="farm__icon-ph">${DROP}</span>`;
  }

  function upgradeIcon(u) {
    if (u.kind === 'building') return iconFor(u.target);
    if (u.kind === 'global') return iconFor('carton');
    if (u.kind === 'goldFreq' || u.kind === 'goldTime') return iconFor('golden');
    return iconFor('bucket');
  }

  function refreshStore(force) {
    const g = ui.game;
    // постройки
    const states = g.buildingStates();
    const want = states.map((x) => x.b.id + ':' + x.state).join(',') + '|' + Object.keys(ui.icons).length;
    if (force || want !== ui.storeKey) {
      ui.storeKey = want;
      ui.buildings.innerHTML = states.map(({ b, state }) => state === 'teaser'
        ? `<li class="farm__bld is-teaser"><span class="farm__bld-icon farm__icon-ph">?</span><span class="farm__bld-text"><span class="farm__bld-name">???</span><span class="farm__bld-price">откроется ближе к ${fmt(b.base * 0.5)} л</span></span></li>`
        : `<li class="farm__bld"><button type="button" class="farm__bld-btn" data-buy="${b.id}">
            <span class="farm__bld-icon">${iconFor(b.id)}</span>
            <span class="farm__bld-text"><span class="farm__bld-name">${b.name}</span><span class="farm__bld-price">${DROP}<span data-price></span></span></span>
            <span class="farm__bld-own" data-own></span>
          </button></li>`).join('');
      ui.rows.clear();
      ui.buildings.querySelectorAll('[data-buy]').forEach((btn) => ui.rows.set(btn.dataset.buy, btn));
    }
    for (const [id, btn] of ui.rows) {
      const price = g.cost(id, ui.mode);
      btn.querySelector('[data-price]').textContent = `${fmt(price)} л`;
      btn.querySelector('[data-own]').textContent = g.state.owned[id] || '';
      btn.classList.toggle('is-cheap', g.canAfford(price));
    }
    // улучшения
    const ups = g.availableUpgrades();
    const key = ups.map((u) => u.id).join(',') + '|' + Object.keys(ui.icons).length;
    if (force || key !== ui.upKey) {
      ui.upKey = key;
      ui.upgrades.innerHTML = ups.length
        ? ups.map((u) => `<button type="button" class="farm__upg" data-upg="${u.id}" aria-label="${u.name} — ${fmt(u.cost)} л">${upgradeIcon(u)}${u.kind === 'building' ? '<span class="farm__upg-badge">×2</span>' : ''}</button>`).join('')
        : '<p class="farm__upg-empty">Улучшения появятся по ходу игры</p>';
    }
    ui.upgrades.querySelectorAll('[data-upg]').forEach((b) => b.classList.toggle('is-cheap', g.canAfford(g.upById.get(b.dataset.upg).cost)));
  }

  /* ---------- уровни ---------- */
  const LAYER_ORDER = F.BUILDINGS.map((b) => b.id);
  function layerFor(id) {
    if (ui.layerEls.has(id)) return ui.layerEls.get(id);
    const b = ui.game.byId.get(id);
    const li = document.createElement('li');
    li.className = 'farm__layer';
    li.dataset.layer = id;
    li.innerHTML = `<div class="farm__layer-stage" data-stage></div>
      <div class="farm__layer-label"><span class="farm__layer-name">${b.layer}</span><span class="farm__layer-count" data-count></span><span class="farm__layer-rate" data-rate></span></div>`;
    // по порядку построек
    const after = LAYER_ORDER.slice(0, LAYER_ORDER.indexOf(id)).reverse().map((k) => ui.layerEls.get(k)).find(Boolean);
    if (after) after.el.after(li);
    else ui.layers.prepend(li);
    const rec = { el: li, stage: li.querySelector('[data-stage]'), count: li.querySelector('[data-count]'), rate: li.querySelector('[data-rate]') };
    ui.layerEls.set(id, rec);
    if (!reduce.matches) li.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    return rec;
  }

  function refreshLayers() {
    const g = ui.game;
    for (const b of F.BUILDINGS) {
      const n = g.state.owned[b.id];
      if (!n) continue;
      const rec = layerFor(b.id);
      rec.count.textContent = `${n} ${F.plural(n, b.forms)}`;
      rec.rate.textContent = `+${fmt(g.lpsOf(b.id), true)} л/с`;
    }
    // следующий уровень — закрытая полоса-загадка
    let teaser = ui.layers.querySelector('.farm__layer.is-locked');
    const nextB = F.BUILDINGS.find((b) => !g.state.owned[b.id]);
    if (!nextB) {
      if (teaser) teaser.remove();
      return;
    }
    if (!teaser) {
      teaser = document.createElement('li');
      teaser.className = 'farm__layer is-locked';
      teaser.innerHTML = '<div class="farm__layer-stage"></div><div class="farm__layer-label"><span class="farm__layer-name">Следующий уровень</span><span class="farm__layer-count" data-lock></span></div>';
    }
    ui.layers.appendChild(teaser);
    teaser.querySelector('[data-lock]').textContent = `Купите: ${g.buildingStates().some((x) => x.b.id === nextB.id && x.state === 'open') ? nextB.name.toLowerCase() : '???'}`;
  }

  /* ---------- награды ---------- */
  function renderAwards() {
    const got = new Set(ui.game.state.achievements);
    ui.awardCount.textContent = `${got.size} из ${F.ACHIEVEMENTS.length}`;
    if (ui.awards.hidden) return;
    ui.awards.innerHTML = F.ACHIEVEMENTS.map((a) => `<li class="farm__award${got.has(a.id) ? ' is-got' : ''}">
      <span class="farm__award-mark" aria-hidden="true">${got.has(a.id) ? DROP : '·'}</span>
      <span><strong>${got.has(a.id) ? a.name : '???'}</strong><span>${a.text}</span></span></li>`).join('');
  }

  /* ---------- счётчики и бонусы ---------- */
  function refreshBank() {
    const g = ui.game;
    const rub = Z.bonus ? Z.bonus.get() : 0;
    ui.rub.textContent = `${rub} ₽`;
    const info = g.rubInfo();
    ui.exchange.classList.toggle('is-ready', info.can > 0);
    ui.exchange.textContent = info.can > 0 ? `Обменять ${fmt(info.can * F.RUB_RATE)} л на ${info.can} ₽` : 'Обменять на рубли';
    ui.wallet.textContent = `На бонусном счёте ${rub} ₽`;
    if (info.left <= 0) ui.next.textContent = `Лимит на сегодня исчерпан: ${F.DAILY_RUB} ₽ в день`;
    else {
      const to = F.RUB_RATE - (g.state.liters % F.RUB_RATE);
      ui.next.textContent = g.state.liters >= F.RUB_RATE ? `Можно обменять на ${info.can} ₽` : `До первого рубля — ${fmt(to)} л`;
    }
  }

  function refreshBuffs() {
    const bs = ui.game.activeBuffs();
    ui.buffs.innerHTML = bs.map((b) => `<li class="farm__buff">${b.label}<span>${Math.ceil((b.until - Date.now()) / 1000)} с</span></li>`).join('');
  }

  function refreshNumbers() {
    const g = ui.game;
    const text = fmt(g.state.liters);
    ui.liters.textContent = text;
    ui.lps.textContent = fmt(g.lps(), true);
    if (text.length !== ui.litersLen) {
      ui.litersLen = text.length;
      fitLiters();
    }
  }

  // длинное число («998,46 млрд л») не должно залезать на уровни — шрифт уменьшается по ширине колонки
  function fitLiters() {
    const el = ui.liters.parentElement;
    el.style.fontSize = '';
    const room = el.clientWidth;
    if (room && el.scrollWidth > room) el.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(el).fontSize) * (room / el.scrollWidth))}px`;
  }

  /* ---------- главный цикл ---------- */
  function targets() {
    const layers = [];
    for (const [id, rec] of ui.layerEls) layers.push([id, rec.stage]);
    return { house: ui.stage, layers, clip: ui.layersPanel };
  }

  function loop(now) {
    if (!ui.running) return;
    const dt = Math.min(0.1, ui.last ? (now - ui.last) / 1000 : 1 / 60);
    ui.last = now;
    step(dt, now);
    requestAnimationFrame(loop);
  }

  function step(dt, now = performance.now()) {
    ui.game.tick(dt);
    if (ui.three) ui.three.frame(reduce.matches ? dt * 0.3 : dt, targets());
    if (now - ui.lastUi > 90) {
      ui.lastUi = now;
      refreshNumbers();
    }
    if (now - ui.lastStore > 300) {
      ui.lastStore = now;
      refreshStore(false);
      refreshBuffs();
      refreshBank();
      refreshLayers();
    }
  }

  /* ================= открыть / закрыть ================= */
  // окошко карточки «перетекает» в окно игры (и обратно): сдвиг и масштаб от рамки к рамке
  function morph(from, dir) {
    if (!from || reduce.matches || !from.getClientRects().length) return Promise.resolve();
    const a = from.getBoundingClientRect(), b = ui.win.getBoundingClientRect();
    const start = { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`, borderRadius: '10px', opacity: 0.55 };
    const end = { transform: 'none', borderRadius: '26px', opacity: 1 };
    ui.win.style.transformOrigin = '0 0';
    const anim = ui.win.animate(dir === 'in' ? [start, end] : [end, start], {
      duration: dir === 'in' ? 620 : 480,
      easing: dir === 'in' ? 'cubic-bezier(0.2, 0.85, 0.2, 1)' : 'cubic-bezier(0.55, 0, 0.8, 0.3)',
      fill: 'both',
    });
    const inner = ui.win.querySelectorAll('.farm__bar, .farm__body, .farm__tabs, .farm__canvas');
    inner.forEach((el) => el.animate(dir === 'in'
      ? [{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }]
      : [{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], { duration: dir === 'in' ? 620 : 480, fill: dir === 'in' ? 'none' : 'forwards' }));
    // страховка: если браузер придержал анимацию (фоновая вкладка), окно всё равно откроется и закроется
    const timeout = new Promise((resolve) => setTimeout(resolve, (dir === 'in' ? 620 : 480) + 250));
    return Promise.race([anim.finished, timeout]).then(() => anim.cancel()).catch(() => {});
  }

  F.open = async function (from) {
    if (!ui) setup();
    if (ui.dialog.open) return;
    ui.from = from || null;
    ui.dialog.showModal();
    document.documentElement.classList.add('is-locked');
    requestAnimationFrame(() => ui.dialog.classList.add('is-open'));
    if (from) from.classList.add('is-away');
    if (!history.state || !history.state.farm) history.pushState({ farm: true }, '', '#ferma');
    // удой за время, пока игра была закрыта
    const away = ui.game.offline();
    ui.running = true;
    ui.last = 0;
    if (ui.three) ui.three.resize();
    refreshStore(true);
    refreshLayers();
    refreshBank();
    refreshNumbers();
    requestAnimationFrame(loop);
    await morph(from, 'in');
    if (away > 0) toast('Пока вас не было', `Ферма надоила ${fmt(away)} л (вполсилы — хозяина не было).`);
    ui.house.focus({ preventScroll: true });
  };

  async function close(fromHistory = false) {
    if (!ui || !ui.dialog.open || ui.closing) return;
    ui.closing = true;
    hideTip();
    ui.game.save();
    ui.dialog.classList.remove('is-open');
    await morph(ui.from, 'out');
    ui.running = false;
    ui.dialog.close();
    ui.win.querySelectorAll('.farm__bar, .farm__body, .farm__tabs, .farm__canvas').forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('is-locked');
    if (ui.from) {
      ui.from.classList.remove('is-away');
      ui.from.focus({ preventScroll: true });
    }
    ui.closing = false;
    if (!fromHistory && history.state && history.state.farm) history.back();
  }
  F.close = close;
  window.addEventListener('popstate', () => {
    if (ui && ui.dialog.open) close(true);
  });

  // для проверок: шаг времени и кадр без requestAnimationFrame (в скрытой вкладке его нет)
  F.debug = {
    step: (sec = 1) => {
      const n = Math.max(1, Math.round(sec * 30));
      for (let i = 0; i < n; i++) step(sec / n, performance.now() + i * 400);
      return ui.game.state;
    },
    tap: (k = 1) => {
      const r = ui.house.getBoundingClientRect();
      for (let i = 0; i < k; i++) tapAt(r.left + r.width / 2, r.top + r.height / 2);
    },
    get ui() { return ui; },
  };
})();
