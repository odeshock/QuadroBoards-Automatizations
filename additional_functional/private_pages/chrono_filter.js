// chrono_filter.js — модальный, корне-изолированный вариант
(() => {
  function makeFilterAPI(root) {
    const $  = (sel, r = root) => r.querySelector(sel);
    const $$ = (sel, r = root) => Array.from(r.querySelectorAll(sel));
    const parseDate = v => (v ? new Date(v) : null);
    const getChecked = (container, name) =>
      Array.from(container.querySelectorAll(`input[name="${name}"]:checked`)).map(i => i.value);

    const filters = $('#filters');
    const list    = $('#list');
    if (!filters || !list) {
      // если в этом корне нет фильтров — отдадим пустое API
      return { apply: () => [], reset: () => [], getVisible: () => [], destroy: () => {} };
    }

    // локальные элементы (только внутри root!)
    const elDateStart = $('#dateStart');
    const elDateEnd   = $('#dateEnd');
    const elReset     = $('#resetBtn');

    // контейнеры для чекбоксов (как узлы, а не по id)
    const typeBox     = $('#typeList');
    const statusBox   = $('#statusList');
    const maskBox     = $('#maskList');
    const playerBox   = $('#playerList');
    const locationBox = $('#locationList');

    // дропдауны
    function wireToggle(btnSel, listEl) {
      const btn  = $(btnSel);
      if (!btn || !listEl) return () => {};
      const onBtn = (e) => { e.stopPropagation(); listEl.style.display = listEl.style.display === 'block' ? 'none' : 'block'; };
      const onDoc = (e) => { if (!listEl.contains(e.target) && !btn.contains(e.target)) listEl.style.display = 'none'; };
      btn.addEventListener('click', onBtn);
      document.addEventListener('click', onDoc);
      return () => { btn.removeEventListener('click', onBtn); document.removeEventListener('click', onDoc); };
    }

    const unTypeTgl     = wireToggle('#typeToggle',     typeBox);
    const unStatusTgl   = wireToggle('#statusToggle',   statusBox);
    const unMaskTgl     = wireToggle('#maskToggle',     maskBox);
    const unPlayerTgl   = wireToggle('#playerToggle',   playerBox);
    const unLocationTgl = wireToggle('#locationToggle', locationBox);

    // распарсим эпизоды ОДИН раз (внутри root)
    const episodes = $$('#list .episode').map(el => {
      const masks   = (el.dataset.mask    || '').split(';').map(s => s.trim()).filter(Boolean);
      const players = (el.dataset.players || '').split(';').map(s => s.trim()).filter(Boolean);
      return {
        el,
        type:    (el.dataset.type    || '').trim(),
        status:  (el.dataset.status  || '').trim(),
        startL:  parseDate(el.dataset.startL),
        startR:  parseDate(el.dataset.startR),
        endL:    parseDate(el.dataset.endL),
        endR:    parseDate(el.dataset.endR),
        masks, players,
        location: (el.dataset.location || '').trim()
      };
    });

    function apply() {
      const ds = elDateStart && elDateStart.value ? new Date(elDateStart.value) : null;
      const de = elDateEnd   && elDateEnd.value   ? new Date(elDateEnd.value)   : null;

      const selType     = typeBox     ? getChecked(typeBox,     'type')     : [];
      const selStatus   = statusBox   ? getChecked(statusBox,   'status')   : [];
      const selMask     = maskBox     ? getChecked(maskBox,     'mask')     : [];
      const selPlayer   = playerBox   ? getChecked(playerBox,   'player')   : [];
      const selLocation = locationBox ? getChecked(locationBox, 'location') : [];

      const visible = [], hidden = [];

      episodes.forEach(ep => {
        let ok = true;
        if (ok && ds && ep.endL   && ep.endL   < ds) ok = false;
        if (ok && de && ep.startR && ep.startR > de) ok = false;
        if (ok && selType.length     && !selType.includes(ep.type))           ok = false;
        if (ok && selStatus.length   && !selStatus.includes(ep.status))       ok = false;
        if (ok && selMask.length     && !ep.masks.some(m => selMask.includes(m)))   ok = false;
        if (ok && selPlayer.length   && !ep.players.some(p => selPlayer.includes(p))) ok = false;
        if (ok && selLocation.length && !selLocation.includes(ep.location))   ok = false;

        ep.el.style.display = ok ? '' : 'none';
        (ok ? visible : hidden).push(ep.el);
      });

      // событие отсылаем из root (чтобы внешние слушатели могли отфильтровать по таргету)
      root.dispatchEvent(new CustomEvent('chrono:filtered', { detail: { visible, hidden } }));
      return visible;
    }

    function reset() {
      if (elDateStart) elDateStart.value = '';
      if (elDateEnd)   elDateEnd.value   = '';
      $$('#filters .dropdown-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      return apply();
    }

    // слушатели только по корню
    function onChange(e) {
      if (e.target.closest('#filters .dropdown-list') && e.target.matches('input[type="checkbox"]')) apply();
    }
    root.addEventListener('change', onChange);
    if (elDateStart) elDateStart.addEventListener('change', apply);
    if (elDateEnd)   elDateEnd.addEventListener('change', apply);
    if (elReset)     elReset.addEventListener('click', (e) => { e.preventDefault(); reset(); });

    // первая прогонка
    apply();

    return {
      apply, reset,
      getVisible: () => episodes.filter(ep => ep.el.style.display !== 'none').map(ep => ep.el),
      destroy: () => {
        root.removeEventListener('change', onChange);
        if (elDateStart) elDateStart.removeEventListener('change', apply);
        if (elDateEnd)   elDateEnd.removeEventListener('change', apply);
        if (elReset)     elReset.removeEventListener('click', reset);
        unTypeTgl(); unStatusTgl(); unMaskTgl(); unPlayerTgl(); unLocationTgl();
      }
    };
  }

  // ПУБЛИЧНЫЙ API
  window.ChronoFilter = {
    // инициализация внутри конкретного корня модалки
    init({ root } = {}) {
      const r = root || document;
      const api = makeFilterAPI(r);
      // можно вернуть API, если нужно управлять извне
      return api;
    },
    // заглушки на случай прямых вызовов
    apply: () => [],
    reset: () => [],
    getVisible: () => [],
    destroy: () => {}
  };
})();
