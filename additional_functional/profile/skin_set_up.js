(function () {
  'use strict';

  async function setupSkins(container, initialHtml, opts = {}) {
    if (window.__skinsSetupMounted) return window.__skinsSetupMounted;
    
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('[setupSkins] container обязателен и должен быть HTMLElement');
    }
    if (typeof window.createChoicePanel !== 'function') {
      throw new Error('[setupSkins] createChoicePanel не найден. Подключите файл с панелью раньше.');
    }

    const withHeaders = opts.withHeaders ?? true;
    const startOpen   = opts.startOpen   ?? false;

    // === 1) дефолтные библиотеки (на случай, если get_skin_lib нет/упала/вернула пусто)
    const DEFAULT_LIBS = {
      '_plashka': [
        { id: '1', html: '<div class="item" title="за вступление!" data-id="1"><a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/440/247944.gif" class="plashka"><wrds>я не подарок, но и ты не шаверма</wrds></a></div>' },
        { id: '2', html: '<div class="item" title="новый дизайн — новая плашка! такие вот делишки, девчонки и мальчишки) а так же их родители.." data-id="2"><a class="modal-link"><img src="https://upforme.ru/uploads/001c/14/5b/440/561829.gif" class="plashka"><wrds>twinkle twinkle little star</wrds></a></div>' },
        { id: '3', html: '<div class="item" title="пример №3" data-id="3"><a class="modal-link"><img src="https://picsum.photos/seed/3/300/120" class="plashka"><wrds>пример 3</wrds></a></div>' },
        { id: '4', html: '<div class="item" title="пример №4" data-id="4"><a class="modal-link"><img src="https://picsum.photos/seed/4/300/120" class="plashka"><wrds>пример 4</wrds></a></div>' },
        { id: '5', html: '<div class="item" title="пример №5" data-id="5"><a class="modal-link"><img src="https://picsum.photos/seed/5/300/120" class="plashka"><wrds>пример 5</wrds></a></div>' },
        { id: '6', html: '<div class="item" title="пример №6" data-id="6"><a class="modal-link"><img src="https://picsum.photos/seed/6/300/120" class="plashka"><wrds>пример 6</wrds></a></div>' },
      ],
      '_icon': [],
      '_back': []
    };
  
    // безопасная обёртка вокруг get_skin_lib (или opts.getLib)
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
      return DEFAULT_LIBS[cls] ?? [];
    };
    
    // фактическая загрузка (всегда вернёт массивы; для плашек — хотя бы DEFAULT_LIBS)
    const backClass = opts.backClass ?? '_back';
    const [libPlashka0, libIcon0, libBack0] = await Promise.all([
      safeGetLib('_plashka'),
      safeGetLib('_icon'),
      safeGetLib(backClass),
    ]);
    
    // финальные массивы (если что-то пришло не так — подстрахуемся ещё раз)
    const LIB_P = Array.isArray(libPlashka0) && libPlashka0.length ? libPlashka0 : DEFAULT_LIBS['_plashka'];
    const LIB_I = Array.isArray(libIcon0)    && libIcon0.length    ? libIcon0    : DEFAULT_LIBS['_icon'];
    const LIB_B = Array.isArray(libBack0)    && libBack0.length    ? libBack0    : DEFAULT_LIBS[backClass] ?? [];
    console.log('[setupSkins] libs sizes:', { plashka: LIB_P.length, icon: LIB_I.length, back: LIB_B.length });
  
    // идемпотентно создаём/переиспользуем сетку
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
  window.__skinsSetupMounted = api;
  return api;
})();
