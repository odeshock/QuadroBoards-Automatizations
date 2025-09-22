(function () {
  'use strict';

  async function setupSkins(container, initialHtml, opts = {}) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('[setupSkins] container обязателен и должен быть HTMLElement');
    }
    if (typeof window.createChoicePanel !== 'function') {
      throw new Error('[setupSkins] createChoicePanel не найден. Подключите файл с панелью раньше.');
    }

    const withHeaders = opts.withHeaders ?? true;
    const startOpen   = opts.startOpen   ?? false;
    const backClass   = opts.backClass   ?? '_back'; // или '_background', если так у вас принято

    // ← главное изменение: безопасная обёртка вокруг get_skin_lib
    const getLibRaw = opts.getLib ?? (typeof window.get_skin_lib === 'function'
                                      ? window.get_skin_lib
                                      : null);

    const getLib = async (cls) => {
      try {
        if (typeof getLibRaw === 'function') {
          const r = await getLibRaw(cls);
          return Array.isArray(r) ? r : [];
        }
      } catch (_) {}
      return []; // если функции нет/упала — возвращаем пустую библиотеку
    };

    // ← и используем её для всех трёх секций
    const [libPlashka, libIcon, libBack] = await Promise.all([
      getLib('_plashka'),
      getLib('_icon'),
      getLib(backClass),
    ]);

    const LIB_P = Array.isArray(libPlashka) ? libPlashka : [
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
  ];
    const LIB_I = Array.isArray(libIcon)    ? libIcon    : [];
    const LIB_B = Array.isArray(libBack)    ? libBack    : [];

    // дальше — как было
    const grid = document.createElement('div');
    grid.className = 'skins-setup-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr';
    grid.style.gap = '16px';
    container.appendChild(grid);

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
      targetClass: backClass,
      library: LIB_B,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    function build(fullHtmlOpt) {
      let current = (typeof fullHtmlOpt === 'string') ? fullHtmlOpt : (initialHtml || '');
      if (panelPlashka?.builder) current = panelPlashka.builder(current);
      if (panelIcon?.builder)    current = panelIcon.builder(current);
      if (panelBack?.builder)    current = panelBack.builder(current);
      return current;
    }

    return { build, panels: { plashka: panelPlashka, icon: panelIcon, back: panelBack } };
  }

  window.setupSkins = setupSkins;
})();
