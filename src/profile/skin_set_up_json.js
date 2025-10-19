// skin_set_up_json.js
// setupSkinsJSON(container, opts?) -> Promise<{ getData() => object, panels }>

(function () {
  'use strict';

  /**
   * @param {HTMLElement} container         куда рисовать панели
   * @param {Object=}     opts
   *   @param {boolean=}  opts.withHeaders  показывать заголовки секций (по умолчанию true)
   *   @param {boolean=}  opts.startOpen    панели раскрыты при старте (по умолчанию false)
   *   @param {Object=}   opts.initialData  начальные данные { icon: [], plashka: [], background: [], gift: [], coupon: [] }
   *
   * @returns {Promise<{ getData: ()=>object, panels: { plashka, icon, back, gift, coupon } }>}
   */
  async function setupSkinsJSON(container, opts = {}) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('[setupSkinsJSON] container обязателен и должен быть HTMLElement');
    }
    if (typeof window.createChoicePanelJSON !== 'function') {
      throw new Error('[setupSkinsJSON] createChoicePanelJSON не найден. Подключите файл с панелью раньше.');
    }

    if (window.__skinsSetupJSONMounted) {
      return window.__skinsSetupJSONMounted;
    }

    const withHeaders = opts.withHeaders ?? true;
    const startOpen   = opts.startOpen   ?? false;
    const initialData = opts.initialData || {};

    // Проверка наличия fetchAllLibraries
    if (typeof window.fetchAllLibraries !== 'function') {
      console.error('[setupSkinsJSON] window.fetchAllLibraries не найдена. Подключите fetch_libraries.js');
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

    // --- панели (JSON-режим)
    const panelGift = window.createChoicePanelJSON({
      title: withHeaders ? 'Подарки' : undefined,
      targetClass: '_gift',
      library: libGift0,
      mountEl: grid,
      startOpen,
      allowMultiAdd: true
    });

    const panelCoupon = window.createChoicePanelJSON({
      title: withHeaders ? 'Купоны' : undefined,
      targetClass: '_coupon',
      library: libCoupon0,
      mountEl: grid,
      startOpen,
      allowMultiAdd: true,
      expirableAttr: 'data-expired-date'
    });

    const panelPlashka = window.createChoicePanelJSON({
      title: withHeaders ? 'Плашки' : undefined,
      targetClass: '_plashka',
      library: libPlashka0,
      mountEl: grid,
      startOpen
    });

    const panelIcon = window.createChoicePanelJSON({
      title: withHeaders ? 'Иконки' : undefined,
      targetClass: '_icon',
      library: libIcon0,
      mountEl: grid,
      startOpen
    });

    const panelBack = window.createChoicePanelJSON({
      title: withHeaders ? 'Фон' : undefined,
      targetClass: '_background',
      library: libBack0,
      mountEl: grid,
      startOpen
    });

    // --- Инициализация данными из API
    if (initialData.gift) panelGift.init(initialData.gift);
    if (initialData.coupon) panelCoupon.init(initialData.coupon);
    if (initialData.plashka) panelPlashka.init(initialData.plashka);
    if (initialData.icon) panelIcon.init(initialData.icon);
    if (initialData.background) panelBack.init(initialData.background);

    // --- getData: собирает данные из всех панелей
    function getData() {
      return {
        icon: panelIcon.getData(),
        plashka: panelPlashka.getData(),
        background: panelBack.getData(),
        gift: panelGift.getData(),
        coupon: panelCoupon.getData()
      };
    }

    // --- getLibraryIds: возвращает Set id для каждой категории
    function getLibraryIds() {
      return {
        icon: new Set(libIcon0.map(x => String(x.id))),
        plashka: new Set(libPlashka0.map(x => String(x.id))),
        background: new Set(libBack0.map(x => String(x.id))),
        gift: new Set(libGift0.map(x => String(x.id))),
        coupon: new Set(libCoupon0.map(x => String(x.id)))
      };
    }

    const api = {
      getData,
      getLibraryIds,
      panels: { plashka: panelPlashka, icon: panelIcon, back: panelBack, gift: panelGift, coupon: panelCoupon },
    };
    window.__skinsSetupJSONMounted = api;
    return api;
  }

  window.setupSkinsJSON = setupSkinsJSON;
})();
