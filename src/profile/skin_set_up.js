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

    // Проверка наличия fetchAllLibraries
    if (typeof window.fetchAllLibraries !== 'function') {
      console.error('[setupSkins] window.fetchAllLibraries не найдена. Подключите fetch_libraries.js');
      return;
    }

    // Загружаем все библиотеки
    const libraries = await window.fetchAllLibraries();
    const libPlashka0 = libraries.plashka;
    const libIcon0 = libraries.icon;
    const libBack0 = libraries.back;
    const libGift0 = libraries.gift;
    const libCoupon0 = libraries.coupon;

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
      title: withHeaders ? 'Купоны' : undefined,
      targetClass: '_coupon',
      library: libCoupon0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen,
      allowMultiAdd: true,
      expirableAttr: 'data-expired-date'  // добавляем поддержку даты истечения
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
