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
      console.log('[setupSkins] уже смонтировано — возвращаю ранее созданный API');
      return window.__skinsSetupMounted;
    }

    const withHeaders = opts.withHeaders ?? true;
    const startOpen   = opts.startOpen   ?? false;

    // --- дефолтные библиотеки (на случай, если get_skin_lib нет/упала/вернула пусто)
    const DEFAULT_LIBS = {
      '_plashka': [
        { id: '1', html: '<div class="item" title="за вступление!" data-id="1"><a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/440/247944.gif" class="plashka"><wrds>я не подарок, но и ты не шаверма</wrds></a></div>' },
        { id: '2', html: '<div class="item" title="новый дизайн — новая плашка! такие вот делишки, девчонки и мальчишки) а так же их родители.." data-id="2"><a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/440/561829.gif" class="plashka"><wrds>twinkle twinkle little star</wrds></a></div>' },
        { id: '3', html: '<div class="item" title="пример №3" data-id="3"><a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/6/144030.png" class="plashka"><wrds>все мысли о тебе</wrds></a></div>' },
        { id: '4', html: '<div class="item" title="пример №4" data-id="4"><a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/2/873866.gif" class="plashka"><wrds>я раздену тебя до души</wrds></a></div>' },
        { id: '5', html: '<div class="item" title="пример №5" data-id="5"><a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/1014/371365.png" class="plashka"><wrds>вальсом по красным линиям</wrds></a></div>' },
        { id: '6', html: '<div class="item" title="пример №6" data-id="6"><a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/6/220828.png" class="plashka"><wrds>я став клованом</wrds></a></div>' },
        { id: '7', html: '<div class="item" data-id="7"><a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/1014/625440.png" class="plashka"><wrds>пупупу</wrds></a></div>' },
      ],
      '_icon': [
        { id: '1', html: '<div class="item" data-id="1"><img class="icon" src="https://cdn2.iconfinder.com/data/icons/harry-potter-colour-collection/60/07_-_Harry_Potter_-_Colour_-_Golden_Snitch-512.png"></div>'},
        { id: '2', html: '<div class="item" data-id="2"><img class="icon" src="https://static.thenounproject.com/png/2185221-200.png"></div>'},
      ],
      '_back':  [
        { id: '1', html: '<div class="item" data-id="1"><img class="back" src="https://upforme.ru/uploads/001c/14/5b/440/238270.gif"></div>'},
        { id: '2', html: '<div class="item" data-id="2"><img class="back" src="https://forumstatic.ru/files/001c/83/91/88621.png"></div>'},
      ],
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
    const [libPlashka0, libIcon0, libBack0] = await Promise.all([
      safeGetLib('_plashka'),
      safeGetLib('_icon'),
      safeGetLib('_back'),
    ]);

    // финальная подстраховка
    const LIB_P = Array.isArray(libPlashka0) && libPlashka0.length ? libPlashka0 : DEFAULT_LIBS['_plashka'];
    const LIB_I = Array.isArray(libIcon0)    && libIcon0.length    ? libIcon0    : DEFAULT_LIBS['_icon'];
    const LIB_B = Array.isArray(libBack0)    && libBack0.length    ? libBack0    : DEFAULT_LIBS['_back'];

    console.log('[setupSkins] libs sizes:', { plashka: LIB_P.length, icon: LIB_I.length, back: LIB_B.length });

    // --- 2) контейнер под три панели (идемпотентно)
    let grid = container.querySelector('.skins-setup-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'skins-setup-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr';
      grid.style.gap = '16px';
      container.appendChild(grid);
    } else {
      console.log('[setupSkins] grid уже существует — переиспользуем');
    }

    // --- 3) три панели (external = true, используем initialHtml)
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
      targetClass: '_back', // важно: используем вычисленный класс
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
      return current;
    }

    const api = {
      build,
      panels: { plashka: panelPlashka, icon: panelIcon, back: panelBack }
    };
    window.__skinsSetupMounted = api;
    return api;
  }

  // экспорт
  window.setupSkins = setupSkins;
})();
