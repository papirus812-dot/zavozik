/*
 * «Молочная ферма»: правила игры без картинок — литры, тапы, покупки, улучшения, золотые капли,
 * награды, сохранение в браузере, удой за время отсутствия и обмен литров на бонусные рубли сайта.
 * Z.farm.createGame() → объект игры; интерфейс (farm-ui.js) подписывается на его события.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});
  const F = (Z.farm = Z.farm || {});
  const KEY = 'zavozik.farm.v1';

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function fresh() {
    const owned = {};
    for (const b of F.BUILDINGS) owned[b.id] = 0;
    return {
      v: 1, liters: 0, total: 0, clicks: 0, owned, upgrades: [], achievements: [],
      goldens: 0, exchanged: 0, rubDay: '', rubToday: 0, saved: Date.now(), started: Date.now(),
      buffs: [], sound: true,
    };
  }

  F.createGame = function () {
    let s = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const got = JSON.parse(raw);
        if (got && got.v === 1) s = Object.assign(fresh(), got, { owned: Object.assign(fresh().owned, got.owned) });
      }
    } catch (e) { /* нет хранилища — играем без сохранения */ }

    const byId = new Map(F.BUILDINGS.map((b) => [b.id, b]));
    const upById = new Map(F.UPGRADES.map((u) => [u.id, u]));
    const listeners = {};
    const emit = (type, data) => (listeners[type] || []).forEach((fn) => fn(data));
    const has = (id) => s.upgrades.includes(id);

    /* ---------------- множители ---------------- */
    const now = () => Date.now();
    function buffMult(kind) {
      let m = 1;
      for (const b of s.buffs) if (b.kind === kind && b.until > now()) m *= b.mult;
      return m;
    }
    function globalMult() {
      let m = 1;
      for (const id of s.upgrades) {
        const u = upById.get(id);
        if (u && u.kind === 'global') m *= u.value;
      }
      return m;
    }
    function buildingMult(bid) {
      let m = 1;
      for (const id of s.upgrades) {
        const u = upById.get(id);
        if (u && u.kind === 'building' && u.target === bid) m *= u.value;
      }
      return m;
    }
    const lpsOf = (bid, withBuffs = true) =>
      (s.owned[bid] || 0) * byId.get(bid).lps * buildingMult(bid) * globalMult() * (withBuffs ? buffMult('lps') : 1);
    const lps = (withBuffs = true) => F.BUILDINGS.reduce((a, b) => a + lpsOf(b.id, withBuffs), 0);
    function clickPower() {
      let add = 1, mult = 1, share = 0;
      for (const id of s.upgrades) {
        const u = upById.get(id);
        if (!u) continue;
        if (u.kind === 'clickAdd') add += u.value;
        if (u.kind === 'clickMult') mult *= u.value;
        if (u.kind === 'clickLps') share += u.value;
      }
      return (add * mult + lps(false) * share) * buffMult('click');
    }

    /* ---------------- цены ---------------- */
    // цена n штук подряд: геометрическая прогрессия от текущей цены
    function cost(bid, n = 1) {
      const b = byId.get(bid);
      const g = F.PRICE_GROWTH;
      return Math.ceil(b.base * g ** (s.owned[bid] || 0) * (g ** n - 1) / (g - 1));
    }
    const canAfford = (amount) => s.liters >= amount;

    /* ---------------- действия ---------------- */
    function gain(n) {
      s.liters += n;
      s.total += n;
    }

    function tap() {
      const n = clickPower();
      gain(n);
      s.clicks += 1;
      emit('tap', n);
      return n;
    }

    function buy(bid, n = 1) {
      const price = cost(bid, n);
      if (!canAfford(price)) return false;
      s.liters -= price;
      s.owned[bid] += n;
      emit('buy', { id: bid, n });
      checkAchievements();
      return true;
    }

    function buyUpgrade(id) {
      const u = upById.get(id);
      if (!u || has(id) || !u.unlock(s) || !canAfford(u.cost)) return false;
      s.liters -= u.cost;
      s.upgrades.push(id);
      emit('upgrade', u);
      return true;
    }

    // Что показывать в магазине: открытые постройки + одна «загадка» следующей
    function buildingStates() {
      const out = [];
      let teased = false;
      for (let i = 0; i < F.BUILDINGS.length; i++) {
        const b = F.BUILDINGS[i];
        const prevOwned = i === 0 || (s.owned[F.BUILDINGS[i - 1].id] || 0) > 0;
        // корова видна сразу — это первая цель; остальные — когда до них уже недалеко
        const known = i === 0 || (s.owned[b.id] || 0) > 0 || s.total >= b.base * 0.5 || (prevOwned && s.total >= b.base * 0.25);
        if (known) out.push({ b, state: 'open' });
        else if (!teased) {
          out.push({ b, state: 'teaser' });
          teased = true;
        }
      }
      return out;
    }

    const availableUpgrades = () =>
      F.UPGRADES.filter((u) => !has(u.id) && u.unlock(s)).sort((a, b) => a.cost - b.cost);

    /* ---------------- золотые капли ---------------- */
    let nextGolden = now() + rnd(40, 90) * 1000;         // первая — пораньше, чтобы игрок её увидел
    function rnd(a, b) {
      return a + Math.random() * (b - a);
    }
    function goldenDelay() {
      let k = 1;
      for (const id of s.upgrades) if (upById.get(id)?.kind === 'goldFreq') k *= upById.get(id).value;
      return rnd(110, 210) * 1000 * k;
    }
    function goldenLife() {
      let k = 1;
      for (const id of s.upgrades) if (upById.get(id)?.kind === 'goldTime') k *= upById.get(id).value;
      return 13000 * k;
    }
    // поймали каплю: удой ×7 на 30 с, или «молочный фонтан» (тапы ×77 на 10 с), или сразу горсть литров
    function catchGolden() {
      s.goldens += 1;
      const r = Math.random();
      let effect;
      if (r < 0.45) {
        s.buffs.push({ kind: 'lps', mult: 7, until: now() + 30000, label: 'Удой ×7' });
        effect = { title: 'Удой ×7', text: 'На 30 секунд вся ферма доит всемеро больше.' };
      } else if (r < 0.65) {
        s.buffs.push({ kind: 'click', mult: 77, until: now() + 10000, label: 'Молочный фонтан' });
        effect = { title: 'Молочный фонтан', text: 'Тапайте! 10 секунд каждый тап — ×77.' };
      } else {
        const n = Math.max(13, Math.min(s.liters * 0.15 + 13, lps(false) * 900));
        gain(n);
        effect = { title: 'Удачный день', text: `+${F.fmt(n)} л сразу.` };
      }
      emit('golden', effect);
      checkAchievements();
      return effect;
    }

    /* ---------------- награды ---------------- */
    function checkAchievements() {
      for (const a of F.ACHIEVEMENTS) {
        if (s.achievements.includes(a.id)) continue;
        if (a.test(s, api)) {
          s.achievements.push(a.id);
          emit('achievement', a);
        }
      }
    }

    /* ---------------- рубли ---------------- */
    function rubInfo() {
      if (s.rubDay !== today()) {
        s.rubDay = today();
        s.rubToday = 0;
      }
      const left = Math.max(0, F.DAILY_RUB - s.rubToday);
      const can = Math.min(Math.floor(s.liters / F.RUB_RATE), left);
      return { can, left, today: s.rubToday };
    }
    function exchange() {
      const info = rubInfo();
      if (info.can <= 0) return { rub: 0, info };
      s.liters -= info.can * F.RUB_RATE;
      s.rubToday += info.can;
      s.exchanged += info.can;
      if (Z.bonus) Z.bonus.add(info.can);
      emit('exchange', info.can);
      checkAchievements();
      save();
      return { rub: info.can, info: rubInfo() };
    }

    /* ---------------- время ---------------- */
    let achTimer = 0;
    function tick(dt) {
      gain(lps() * dt);
      s.buffs = s.buffs.filter((b) => b.until > now());
      achTimer += dt;
      if (achTimer > 0.5) {
        achTimer = 0;
        checkAchievements();
      }
      if (now() >= nextGolden) {
        nextGolden = now() + goldenDelay();
        emit('goldenSpawn', { life: goldenLife() });
      }
    }

    // пока игра была закрыта: вполсилы, не дольше 8 часов
    function offline() {
      const away = Math.min((now() - (s.saved || now())) / 1000, F.OFFLINE_HOURS * 3600);
      if (away < 30) return 0;
      const n = lps(false) * away * F.OFFLINE_SHARE;
      if (n > 0) gain(n);
      return n;
    }

    function save() {
      s.saved = now();
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch (e) { /* хранилище недоступно */ }
    }

    function reset() {
      s = fresh();
      save();
      emit('reset');
    }

    const api = {
      get state() { return s; },
      byId, upById, lps, lpsOf, clickPower, cost, canAfford, tap, buy, buyUpgrade,
      buildingStates, availableUpgrades, catchGolden, checkAchievements, rubInfo, exchange,
      tick, offline, save, reset, buffMult,
      activeBuffs: () => s.buffs.filter((b) => b.until > now()),
      on(type, fn) {
        (listeners[type] = listeners[type] || []).push(fn);
      },
      setSound(v) {
        s.sound = v;
        save();
      },
    };
    return api;
  };
})();
