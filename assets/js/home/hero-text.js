/*
 * Первый экран: сменяющиеся надписи.
 *  • Заголовок — 10 коротких фраз по две строки. Смена по буквам: буквы уходящей фразы по очереди
 *    уплывают вверх и растворяются, новые выезжают снизу из размытия («срез» — строка заголовка).
 *  • Справа внизу — 8 коротких фраз о том, как «Завозик» смотрит на своё дело; мягко перетекают.
 * Для чтения с экрана заголовок постоянный («Натуральное молоко «Завозик»»), видимые фразы скрыты
 * от чтения. Смена идёт, только пока первый экран на виду; при «уменьшении движения» — не идёт.
 */
(function () {
  'use strict';

  const Z = (window.Zavozik = window.Zavozik || {});

  // Заголовок не должен заходить на пачку в ролике: край пачки поднимается вправо, поэтому
  // первая строка — не шире «Натуральное», вторая — короткая (до ~7 букв)
  const PHRASES = [
    ['Натуральное', 'молоко'],
    ['Свежий', 'кефир'],
    ['Топлёное', 'молоко'],
    ['Густая', 'сметана'],
    ['Сливочный', 'сыр'],
    ['Вкус', 'детства'],
    ['К завтраку', 'молоко'],
    ['Брусничный', 'йогурт'],
    ['Рассыпчатый', 'творог'],
    ['Тёплое', 'какао'],
  ];

  const MOTTOS = [
    '«Завозик» — молоко, кефир, йогурты и сыры. Ближе к хорошему.',
    'В основе каждого продукта — молоко. От бутылки на каждый день до сыра к празднику.',
    'Вкус держится на молоке и честных добавках: ягодах, специях, мёде.',
    'Классику любим, но удивлять не боимся: брусника с чабрецом, какао с морской солью.',
    'На одной полке — то, что хочется каждый день, и то, что хочется попробовать.',
    'Без консервантов — так написано на наших упаковках.',
    'Забота о людях и природе — это тоже написано на наших упаковках.',
    'Хорошее должно быть рядом: в холодильнике, на столе, в каждом завтраке.',
  ];

  const HOLD = 3400;          // сколько стоит фраза заголовка
  const MOTTO_EVERY = 5600;   // как часто меняется фраза справа внизу

  function chars(text) {
    return [...text].map((c) => `<span class="hero__char">${c === ' ' ? ' ' : c}</span>`).join('');
  }

  Z.initHeroText = function () {
    const phraseEl = document.querySelector('[data-hero-phrase]');
    const mottoEl = document.querySelector('[data-hero-motto]');
    const hero = document.querySelector('.hero');
    if (!phraseEl || !hero || !('animate' in Element.prototype)) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let pi = 0, mi = 0, onScreen = true, timerP = 0, timerM = 0, busy = false;
    const lines = () => [...phraseEl.querySelectorAll('.hero__line')];

    function render(i) {
      phraseEl.innerHTML = PHRASES[i].map((l) => `<span class="hero__line">${chars(l)}</span>`).join(' ');
    }

    // Смена заголовка: уход старых букв, затем приход новых — у каждой буквы своя задержка
    async function nextPhrase() {
      if (busy) return;
      busy = true;
      const out = lines().flatMap((l) => [...l.querySelectorAll('.hero__char')]);
      await Promise.all(out.map((c, k) => c.animate(
        [{ transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' },
         { transform: 'translateY(-110%)', opacity: 0, filter: 'blur(6px)' }],
        { duration: 420, delay: k * 22, easing: 'cubic-bezier(0.55, 0, 0.8, 0.2)', fill: 'forwards' },
      ).finished.catch(() => {})));
      pi = (pi + 1) % PHRASES.length;
      render(pi);
      const inc = lines().flatMap((l) => [...l.querySelectorAll('.hero__char')]);
      await Promise.all(inc.map((c, k) => c.animate(
        [{ transform: 'translateY(115%)', opacity: 0, filter: 'blur(8px)' },
         { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' }],
        { duration: 720, delay: k * 32, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' },
      ).finished.catch(() => {})));
      busy = false;
    }

    // Смена фразы справа внизу: растворяется, всплывает новая
    async function nextMotto() {
      if (!mottoEl) return;
      const out = mottoEl.animate(
        [{ opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
         { opacity: 0, transform: 'translateY(-8px)', filter: 'blur(4px)' }],
        { duration: 420, easing: 'ease-in', fill: 'forwards' },
      );
      await out.finished.catch(() => {});
      mi = (mi + 1) % MOTTOS.length;
      mottoEl.textContent = MOTTOS[mi];
      mottoEl.animate(
        [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)' },
         { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' }],
        { duration: 640, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' },
      );
      out.cancel();                    // появление уже держит начало — исчезновение больше не нужно
    }

    const running = () => onScreen && !reduce.matches && !document.hidden;

    function schedule() {
      clearTimeout(timerP);
      clearTimeout(timerM);
      if (!running()) return;
      timerP = setTimeout(async function loopP() {
        if (!running()) return;
        await nextPhrase();
        timerP = setTimeout(loopP, HOLD);
      }, HOLD);
      timerM = setTimeout(function loopM() {
        if (!running()) return;
        nextMotto();
        timerM = setTimeout(loopM, MOTTO_EVERY);
      }, MOTTO_EVERY / 2 + HOLD);
    }

    render(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        const was = onScreen;
        onScreen = e.isIntersecting;
        if (onScreen !== was) schedule();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', schedule);
    reduce.addEventListener('change', schedule);
    schedule();

    // для проверок: показать следующую фразу сразу
    return { nextPhrase, nextMotto, phrases: PHRASES, mottos: MOTTOS };
  };
})();
