(() => {
  const DEBUG = false;
  const log = (...a) => DEBUG && console.log('[ChronoFilter]', ...a);

  // Публичный API
  const API = {
    init,        // init({ root }) — разовая инициализация + первичное применение
    apply,       // ручное применение фильтра
    reset,       // сброс фильтров
    getVisible,  // получить видимые эпизоды
    destroy      // снять обработчики (если нужно)
  };

  // Переменные состояния
  let root = document;      // будет заменён на модальный root
  let episodes = [];        // кэш разобранных эпизодов
  let unbinders = [];       // функции отписки слушателей

  // Утилиты (всегда в пределах root!)
  const $  = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));
  const parseDate = (v) => (v ? new Date(v) : null);

  function getChecked(listId, name) {
    // строго в пределах root, даже если id глобальный
    return $$('#' + listId + ' input[name="' + name + '"]:checked').map(i => i.value);
  }

  function wireToggle(btnId, listId) {
    const btn  = $('#' + btnId);
    const list = $('#' + listId);
    if (!btn || !list) return () => {};

    const onBtn = (e) => {
      e.stopPropagation();
      list.style.display = list.style.display === 'block' ? 'none' : 'block';
    };
    const onDoc = (e) => {
      // закрывать по клику вне списка/кнопки
      if (!list.contains(e.target) && !btn.contains(e.target)) {
        list.style.display = 'none';
      }
    };

    btn.addEventListener('click', onBtn);
    document.addEventListener('click', onDoc);
    return () => {
      btn.removeEventListener('click', onBtn);
      document.removeEventListener('click', onDoc);
    };
  }

  function buildEpisodes() {
    const nodes = $$('#list .episode');
    episodes = nodes.map(el => {
      const masks   = (el.dataset.mask || '').split(';').map(s => s.trim()).filter(Boolean);
      const players = (el.dataset.players || '').split(';').map(s => s.trim()).filter(Boolean);
      return {
        el,
        type:    (el.dataset.type    || '').trim(),
        status:  (el.dataset.status  || '').trim(),
        startL:  parseDate(el.dataset.startL),
        startR:  parseDate(el.dataset.startR),
        endL:    parseDate(el.dataset.endL),
        endR:    parseDate(el.dataset.endR),
        masks,
        players,
        location: (el.dataset.location || '').trim()
      };
    });
    log('episodes:', episodes.length);
  }

  function apply() {
    const filters = $('#filters');
    const list    = $('#list');
    if (!filters || !list || !episodes.length) {
      log('apply: нет filters/list/episodes — выходим');
      return [];
    }

    const elDateStart = $('#dateStart');
    const elDateEnd   = $('#dateEnd');

    const ds = elDateStart && elDateStart.value ? new Date(elDateStart.value) : null;
    const de = elDateEnd   && elDateEnd.value   ? new Date(elDateEnd.value)   : null;

    const selType     = getChecked('typeList', 'type');
    const selStatus   = getChecked('statusList', 'status');
    const selMask     = getChecked('maskList', 'mask');
    const selPlayer   = getChecked('playerList', 'player');
    const selLocation = getChecked('locationList', 'location');

    const visible = [];
    const hidden  = [];

    episodes.forEach(ep => {
      let ok = true;

      // по датам (пересечение интервалов)
      if (ok && ds && ep.endL   && ep.endL   < ds) ok = false;
      if (ok && de && ep.startR && ep.startR > de) ok = false;

      // по типу/статусу
      if (ok && selType.length   && !selType.includes(ep.type))     ok = false;
      if (ok && selStatus.length && !selStatus.includes(ep.status)) ok = false;

      // по маскам/соигрокам/локации
      if (ok && selMask.length     && !ep.masks.some(m => selMask.includes(m)))     ok = false;
      if (ok && selPlayer.length   && !ep.players.some(p => selPlayer.includes(p))) ok = false;
      if (ok && selLocation.length && !selLocation.includes(ep.location))           ok = false;

      ep.el.style.display = ok ? '' : 'none';
      (ok ? visible : hidden).push(ep.el);
    });

    // уведомим слушателей (если есть)
    document.dispatchEvent(new CustomEvent('chrono:filtered', { detail: { visible, hidden } }));
    log('apply -> visible:', visible.length, 'hidden:', hidden.length);

    return visible;
  }

  function reset() {
    const elDateStart = $('#dateStart');
    const elDateEnd   = $('#dateEnd');
    if (elDateStart) elDateStart.value = '';
    if (elDateEnd)   elDateEnd.value   = '';
    $$('#filters .dropdown-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    return apply();
  }

  function destroy() {
    // снять все слушатели
    unbinders.forEach(fn => { try { fn(); } catch {} });
    unbinders = [];
    episodes = [];
    root = document;
  }

  function init(opts = {}) {
    destroy(); // на всякий случай, если переинициализация
    root = opts.root || document;
    log('init, root:', root);

    const filters = $('#filters');
    const list    = $('#list');
    if (!filters || !list) {
      log('нет filters/list в корне — выходим');
      return;
    }

    // собрать эпизоды
    buildEpisodes();

    // провязать контролы (в пределах root)
    const elDateStart = $('#dateStart');
    const elDateEnd   = $('#dateEnd');
    const elReset     = $('#resetBtn');

    // dropdown toggles
    const unTypeTgl     = wireToggle('typeToggle', 'typeList');
    const unStatusTgl   = wireToggle('statusToggle', 'statusList');
    const unMaskTgl     = wireToggle('maskToggle', 'maskList');
    const unPlayerTgl   = wireToggle('playerToggle', 'playerList');
    const unLocationTgl = wireToggle('locationToggle', 'locationList');
    unbinders.push(unTypeTgl, unStatusTgl, unMaskTgl, unPlayerTgl, unLocationTgl);

    // чекбоксы фильтров
    const onChange = (e) => {
      if (e.target.matches('#filters .dropdown-list input[type="checkbox"]')) apply();
    };
    root.addEventListener('change', onChange);
    unbinders.push(() => root.removeEventListener('change', onChange));

    if (elDateStart) {
      elDateStart.addEventListener('change', apply);
      unbinders.push(() => elDateStart.removeEventListener('change', apply));
    }
    if (elDateEnd) {
      elDateEnd.addEventListener('change', apply);
      unbinders.push(() => elDateEnd.removeEventListener('change', apply));
    }
    if (elReset) {
      const onReset = (e) => { e.preventDefault(); reset(); };
      elReset.addEventListener('click', onReset);
      unbinders.push(() => elReset.removeEventListener('click', onReset));
    }

    // первичное применение
    apply();
  }

  // экспорт
  window.ChronoFilter = API;
})();
