// skin_set_up.js
// setupSkins(container, initialHtml, opts?) -> Promise<{ build(fullHtml?) => string, panels }>

(function () {
  'use strict';

  /**
   * @param {HTMLElement} container         куда рисовать панели
   * @param {string}      initialHtml       ПОЛНЫЙ HTML из textarea админки
   * @param {Object=}     opts
   *   @param {boolean=}  opts.withHeaders  показывать заголовки секций (по умолчанию true)
   *   @param {boolean=}  opts.startOpen    панели раскрыты при старте (по умолчанию false)
   *
   * @returns {Promise<{ build: (fullHtmlOpt?:string)=>string, panels: { plashka:any, icon:any, back:any, gift:any } }>}
   */
  async function setupSkins(container, initialHtml, opts = {}) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('[setupSkins] container обязателен и должен быть HTMLElement');
    }
    if (typeof window.createChoicePanel !== 'function') {
      throw new Error('[setupSkins] createChoicePanel не найден. Подключите файл с панелью раньше.');
    }

    if (window.__skinsSetupMounted) {
      return window.__skinsSetupMounted;
    }

    const withHeaders = opts.withHeaders ?? true;
    const startOpen   = opts.startOpen   ?? false;

    // --- тянем библиотеки через fetchCardsWrappedClean
    const SKIN = window.SKIN;

    // если SKIN не объявлен — выходим и логируем предупреждение
    if (!SKIN) {
      console.warn('[setupSkins] window.SKIN не найден — прекращаю выполнение.');
      return;
    }

    // --- тянем библиотеки через fetchCardsWrappedClean
    let [libPlashka0, libIcon0, libBack0, libGift0, libCoupon0] = await Promise.all([
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryPlashkaPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryIconPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryBackPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryGiftPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryCouponPostID),
    ]);

    // подстраховка от null/undefined
    libPlashka0 = Array.isArray(libPlashka0) ? libPlashka0 : [];
    libIcon0    = Array.isArray(libIcon0)    ? libIcon0    : [];
    libBack0    = Array.isArray(libBack0)    ? libBack0    : [];
    libGift0    = Array.isArray(libGift0)    ? libGift0    : [];
    libCoupon0  = Array.isArray(libCoupon0)  ? libCoupon0  : [];

    // --- контейнер под панели
    let grid = container.querySelector('.skins-setup-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'skins-setup-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr';
      grid.style.gap = '16px';
      container.appendChild(grid);
    }

    // --- панели
    const panelGift = window.createChoicePanel({
      title: withHeaders ? 'Подарки' : undefined,
      targetClass: '_gift',
      library: libGift0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen,
      allowMultiAdd: true
    });

    const panelCoupon = window.createChoicePanel({
      title: withHeaders ? 'Купон' : undefined,
      targetClass: '_coupon',
      library: libCoupon0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    const panelPlashka = window.createChoicePanel({
      title: withHeaders ? 'Плашки' : undefined,
      targetClass: '_plashka',
      library: libPlashka0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    const panelIcon = window.createChoicePanel({
      title: withHeaders ? 'Иконки' : undefined,
      targetClass: '_icon',
      library: libIcon0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    const panelBack = window.createChoicePanel({
      title: withHeaders ? 'Фон' : undefined,
      targetClass: '_background',
      library: libBack0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    // --- builder
    function build(fullHtmlOpt) {
      let current = (typeof fullHtmlOpt === 'string') ? fullHtmlOpt : (initialHtml || '');
      if (panelPlashka?.builder) current = panelPlashka.builder(current);
      if (panelIcon?.builder)    current = panelIcon.builder(current);
      if (panelBack?.builder)    current = panelBack.builder(current);
      if (panelGift?.builder)    current = panelGift.builder(current);
      if (panelCoupon?.builder)  current = panelCoupon.builder(current);
      return current;
    }

    const api = {
      build,
      panels: { plashka: panelPlashka, icon: panelIcon, back: panelBack, gift: panelGift, coupon: panelCoupon},
    };
    window.__skinsSetupMounted = api;
    return api;
  }

  window.setupSkins = setupSkins;
})();
