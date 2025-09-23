// skin_set_up.js
// setupSkins(container, initialHtml, opts?) -> Promise<{ build(fullHtml?) => string, panels }>
// Панели строятся через createChoicePanel (external-режим). Библиотеки подтягиваются ТОЛЬКО через get_skin_lib(className)
// или из дефолтов, если функции нет/вернула пусто.

(function () {
  'use strict';

  /**
   * @param {HTMLElement} container         куда рисовать панели
   * @param {string}      initialHtml       ПОЛНЫЙ HTML из textarea админки
   * @param {Object=}     opts
   *   @param {boolean=}  opts.withHeaders  показывать заголовки секций (по умолчанию true)
   *   @param {boolean=}  opts.startOpen    панели раскрыты при старте (по умолчанию false)
   *   @param {function=} opts.getLib       кастомная async (cls)=>[{id,html},...] (по умолчанию window.get_skin_lib)
   *
   * @returns {Promise<{ build: (fullHtmlOpt?:string)=>string, panels: { plashka:any, icon:any, back:any } }>}
   */
  async function setupSkins(container, initialHtml, opts = {}) {
    // --- базовые проверки
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('[setupSkins] container обязателен и должен быть HTMLElement');
    }
    if (typeof window.createChoicePanel !== 'function') {
      throw new Error('[setupSkins] createChoicePanel не найден. Подключите файл с панелью раньше.');
    }

    // --- защита от повторной инициализации
    if (window.__skinsSetupMounted) {
      return window.__skinsSetupMounted;
    }

    const withHeaders = opts.withHeaders ?? true;
    const startOpen   = opts.startOpen   ?? false;

    // --- дефолтные библиотеки (на случай, если get_skin_lib нет/упала/вернула пусто)
    const DEFAULT_LIBS = {
      '_plashka': [],
      '_icon': [],
      '_background':  [],
      '_gift': [],
    };

    // --- безопасная обёртка вокруг get_skin_lib / opts.getLib
    const getLibRaw =
      opts.getLib ??
      (typeof window.get_skin_lib === 'function' ? window.get_skin_lib : null);

    const safeGetLib = async (cls) => {
      try {
        if (typeof getLibRaw === 'function') {
          const r = await getLibRaw(cls);
          if (Array.isArray(r) && r.length) return r;
        }
      } catch (e) {
        console.log('[setupSkins] getLib error for', cls, e);
      }
      // если функции нет/пусто/ошибка — отдаём дефолт
      return DEFAULT_LIBS[cls] ?? [];
    };

    // --- 1) тянем библиотеки (всегда получим массивы)
    const [libPlashka0, libIcon0, libBack0, libGift0] = await Promise.all([
      safeGetLib('_plashka'),
      safeGetLib('_icon'),
      safeGetLib('_background'),
      safeGetLib('_gift')    // ← добавили сюда, но слева забыли переменную
    ]);

    // финальная подстраховка
    const LIB_P = Array.isArray(libPlashka0) && libPlashka0.length ? libPlashka0 : DEFAULT_LIBS['_plashka'];
    const LIB_I = Array.isArray(libIcon0)    && libIcon0.length    ? libIcon0    : DEFAULT_LIBS['_icon'];
    const LIB_B = Array.isArray(libBack0)    && libBack0.length    ? libBack0    : DEFAULT_LIBS['_background'];
    const LIB_G = Array.isArray(libGift0) && libGift0.length ? libGift0 : DEFAULT_LIBS['_gift'];

    // --- 2) контейнер под три панели (идемпотентно)
    let grid = container.querySelector('.skins-setup-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'skins-setup-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr';
      grid.style.gap = '16px';
      container.appendChild(grid);
    }

    // --- 3) три панели (external = true, используем initialHtml)
    const panelGift    = window.createChoicePanel({
      title: withHeaders ? 'Подарки' : undefined,
      targetClass: '_gift',
      library: LIB_G,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen,
      allowMultiAdd: true          // ← ключевая строчка
    });
    
    const panelPlashka = window.createChoicePanel({
      title: withHeaders ? 'Плашки' : undefined,
      targetClass: '_plashka',
      library: LIB_P,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    const panelIcon = window.createChoicePanel({
      title: withHeaders ? 'Иконки' : undefined,
      targetClass: '_icon',
      library: LIB_I,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    const panelBack = window.createChoicePanel({
      title: withHeaders ? 'Фон' : undefined,
      targetClass: '_background', // важно: используем вычисленный класс
      library: LIB_B,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    // --- 4) сборка: последовательно применяем builder каждой панели к ОДНОМУ HTML
    function build(fullHtmlOpt) {
      let current = (typeof fullHtmlOpt === 'string') ? fullHtmlOpt : (initialHtml || '');
      if (panelPlashka && typeof panelPlashka.builder === 'function') current = panelPlashka.builder(current);
      if (panelIcon    && typeof panelIcon.builder    === 'function') current = panelIcon.builder(current);
      if (panelBack    && typeof panelBack.builder    === 'function') current = panelBack.builder(current);
      if (panelGift    && typeof panelGift.builder    === 'function') current = panelGift.builder(current);
      return current;
    }

    const api = {
      build,
      panels: { plashka: panelPlashka, icon: panelIcon, back: panelBack, gift: panelGift },
    };
    window.__skinsSetupMounted = api;
    return api;
  }

  // экспорт
  window.setupSkins = setupSkins;
})();
