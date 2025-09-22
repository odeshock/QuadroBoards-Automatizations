// skin_set_up.js
// setupSkins(container, initialHtml, opts?) -> Promise<{ build(fullHtml?) => string, panels }>
// Панели строятся через createChoicePanel (external-режим). Библиотеки подтягиваются ТОЛЬКО через get_skin_lib(className).

(function () {
  'use strict';

  /**
   * @param {HTMLElement} container         куда рисовать панели
   * @param {string}      initialHtml       ПОЛНЫЙ HTML из textarea админки
   * @param {Object=}     opts
   *   @param {string=}   opts.backClass    '_background' | '_back' (по умолчанию '_background')
   *   @param {boolean=}  opts.withHeaders  показывать заголовки секций (по умолчанию true)
   *   @param {boolean=}  opts.startOpen    панели раскрыты при старте (по умолчанию false)
   *   @param {function=} opts.getLib       кастомная async (cls)=>[{id,html},...] (по умолчанию window.get_skin_lib)
   *
   * @returns {Promise<{ build: (fullHtmlOpt?:string)=>string, panels: { plashka:any, icon:any, back:any } }>}
   */
  async function setupSkins(container, initialHtml, opts = {}) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('[setupSkins] container обязателен и должен быть HTMLElement');
    }
    if (typeof window.createChoicePanel !== 'function') {
      throw new Error('[setupSkins] createChoicePanel не найден. Подключите файл с панелью раньше.');
    }

    const {
      withHeaders = true,
      startOpen   = false,
      getLib      = (typeof window.get_skin_lib === 'function' ? window.get_skin_lib : null),
    } = opts;

    if (typeof getLib !== 'function') {
      throw new Error('[setupSkins] get_skin_lib не найден. Передайте opts.getLib или подключите глобальную функцию.');
    }

    // 1) тянем библиотеки по одному классу
    const [libPlashka, libIcon, libBack] = await Promise.all([
      // Promise.resolve().then(() => getLib('_plashka')),
      // Promise.resolve().then(() => getLib('_icon')),
      // Promise.resolve().then(() => getLib('_back')),
      Promise.resolve().then(() => [
    { id: '1', html:
      '<div class="item" title="за вступление!" data-id="1">' +
      '<a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/440/247944.gif" class="plashka"><wrds>я не подарок, но и ты не шаверма</wrds></a>' +
      '</div>'
    },
    { id: '2', html:
      '<div class="item" title="новый дизайн — новая плашка! такие вот делишки, девчонки и мальчишки) а так же их родители.." data-id="2">' +
      '<a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/440/561829.gif" class="plashka"><wrds>twinkle twinkle little star</wrds></a>' +
      '</div>'
    },
    { id: '3', html:
      '<div class="item" title="пример №3" data-id="3">' +
      '<a class="modal-link"><img src="https://picsum.photos/seed/3/300/120" class="plashka"><wrds>пример 3</wrds></a>' +
      '</div>'
    },
    { id: '4', html:
      '<div class="item" title="пример №4" data-id="4">' +
      '<a class="modal-link"><img src="https://picsum.photos/seed/4/300/120" class="plashka"><wrds>пример 4</wrds></a>' +
      '</div>'
    },
    { id: '5', html:
      '<div class="item" title="пример №5" data-id="5">' +
      '<a class="modal-link"><img src="https://picsum.photos/seed/5/300/120" class="plashka"><wrds>пример 5</wrds></a>' +
      '</div>'
    },
    { id: '6', html:
      '<div class="item" title="пример №6" data-id="6">' +
      '<a class="modal-link"><img src="https://picsum.photos/seed/6/300/120" class="plashka"><wrds>пример 6</wrds></a>' +
      '</div>'
    }
  ]),
      Promise.resolve().then(() => []),
      Promise.resolve().then(() => []),
    ]);

    // подстраховка
    const LIB_P = Array.isArray(libPlashka) ? libPlashka : [];
    const LIB_I = Array.isArray(libIcon)    ? libIcon    : [];
    const LIB_B = Array.isArray(libBack)    ? libBack    : [];

    // 2) контейнер под три панели
    const grid = document.createElement('div');
    grid.className = 'skins-setup-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr';
    grid.style.gap = '16px';
    container.appendChild(grid);

    // 3) три панели (external = true, используем initialHtml)
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
      targetClass: '_back',
      library: LIB_B,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    // 4) сборка: последовательно применяем builder каждой панели к ОДНОМУ HTML
    function build(fullHtmlOpt) {
      let current = (typeof fullHtmlOpt === 'string') ? fullHtmlOpt : (initialHtml || '');
      if (panelPlashka && typeof panelPlashka.builder === 'function') current = panelPlashka.builder(current);
      if (panelIcon    && typeof panelIcon.builder    === 'function') current = panelIcon.builder(current);
      if (panelBack    && typeof panelBack.builder    === 'function') current = panelBack.builder(current);
      return current;
    }

    return {
      build,
      panels: {
        plashka: panelPlashka,
        icon:    panelIcon,
        back:    panelBack
      }
    };
  }

  // экспорт
  window.setupSkins = setupSkins;
})();
