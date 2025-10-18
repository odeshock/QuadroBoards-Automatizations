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

    // --- тянем библиотеки через fetchCardsWrappedClean
    const SKIN = window.SKIN;

    // если SKIN не объявлен — выходим и логируем предупреждение
    if (!SKIN) {
      console.warn('[setupSkinsJSON] window.SKIN не найден — прекращаю выполнение.');
      return;
    }

    // --- тянем библиотеки через fetchCardsWrappedClean
    let [libPlashka0, libIcon0, libBack0, libGift0, libCoupon0] = await Promise.all([
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryPlashkaPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryIconPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryBackPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryGiftPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryCouponPostID, { isCoupon: true }),
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

    const api = {
      getData,
      panels: { plashka: panelPlashka, icon: panelIcon, back: panelBack, gift: panelGift, coupon: panelCoupon },
    };
    window.__skinsSetupJSONMounted = api;
    return api;
  }

  window.setupSkinsJSON = setupSkinsJSON;
})();
