// skin_set_up.js
// Глобальная обёртка над createChoicePanel: три секции (_plashka, _icon, _background)
// Возвращает { build(), panels } для дальнейшего сохранения через admin_bridge.js

(function () {
  'use strict';

  /**
   * setupSkins
   * @param {HTMLElement} container          Куда рисовать панели (внутрь уже существующего узла)
   * @param {string}      initialHtml        Исходный ПОЛНЫЙ HTML из textarea админки
   * @param {Object}      opts               Доп. опции
   *   - libPlashka:   массив библиотеки для _plashka (по умолчанию window.LIB_P)
   *   - libIcon:      массив библиотеки для _icon    (по умолчанию window.LIB_I)
   *   - libBack:      массив библиотеки для _background/_back (по умолчанию window.LIB_B)
   *   - backClass:    '_background' | '_back'  (по умолчанию '_background')
   *   - withHeaders:  показывать заголовки секций (true)
   *   - startOpen:    разворачивать панели изначально (false — по умолчанию панели схлопнуты)
   *
   * @returns {{ build: (fullHtml?:string)=>string, panels: { plashka:any, icon:any, back:any } }}
   */
  function setupSkins(container, initialHtml, opts = {}) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('[setupSkins] Неверный container');
    }
    if (typeof window.createChoicePanel !== 'function') {
      throw new Error('[setupSkins] createChoicePanel не найден. Подключи файл с панелью раньше.');
    }

    const {
      libPlashka  = (window.LIB_P || []),
      libIcon     = (window.LIB_I || []),
      libBack     = (window.LIB_B || []),
      backClass   = '_background', // если у тебя используется '_back', поменяй здесь или передай в opts
      withHeaders = true,
      startOpen   = false
    } = opts;

    // Корневой контейнер под три панели
    const grid = document.createElement('div');
    grid.className = 'skins-setup-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr';
    grid.style.gap = '16px';
    container.appendChild(grid);

    // --- Панель 1: Плашки ---
    const panelPlashka = window.createChoicePanel({
      title: withHeaders ? 'Плашки' : undefined,
      targetClass: '_plashka',
      library: libPlashka,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    // --- Панель 2: Иконки ---
    const panelIcon = window.createChoicePanel({
      title: withHeaders ? 'Иконки' : undefined,
      targetClass: '_icon',
      library: libIcon,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    // --- Панель 3: Фон ---
    const panelBack = window.createChoicePanel({
      title: withHeaders ? 'Фон' : undefined,
      targetClass: backClass,
      library: libBack,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    /**
     * Сборка итогового ПОЛНОГО HTML.
     * Применяем панели ПОСЛЕДОВАТЕЛЬНО к одному и тому же HTML:
     *   html1 = panelPlashka.builder(base)
     *   html2 = panelIcon.builder(html1)
     *   html3 = panelBack.builder(html2)
     * Возвращаем html3.
     *
     * @param {string=} fullHtmlOverride — если нужно, можно передать другой базовый HTML,
     *                                    иначе берём initialHtml, переданный в setupSkins.
     */
    function build(fullHtmlOverride) {
      let current = (typeof fullHtmlOverride === 'string') ? fullHtmlOverride : (initialHtml || '');
      current = panelPlashka.builder(current);
      current = panelIcon.builder(current);
      current = panelBack.builder(current);
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

  // Экспортируем глобально
  window.setupSkins = setupSkins;
})();
