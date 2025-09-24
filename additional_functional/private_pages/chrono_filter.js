(() => {
  // Публичный API, если захотите вызвать из кода
  const API = {
    apply: () => [],
    reset: () => [],
    getVisible: () => [],
    destroy: () => {}
  };

  const filters = document.getElementById('filters');
  const list    = document.getElementById('list');
  if (!filters || !list) {
    window.ChronoFilter = API;
    return;
  }

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const parseDate = v => (v ? new Date(v) : null);
  const getChecked = (containerId, name) =>
    Array.from(document.querySelectorAll(`#${containerId} input[name="${name}"]:checked`))
      .map(i => i.value);

  function wireToggle(btnId, listId) {
    const btn  = document.getElementById(btnId);
    const list = document.getElementById(listId);
    if (!btn || !list) return () => {};
    const onBtn = (e) => {
      e.stopPropagation();
      list.style.display = list.style.display === 'block' ? 'none' : 'block';
    };
    const onDoc = (e) => {
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

  const elDateStart = document.getElementById('dateStart');
  const elDateEnd   = document.getElementById('dateEnd');
  const elReset     = document.getElementById('resetBtn');

  const episodes = $$('#list .episode').map(el => {
    const masks   = (el.dataset.mask || '')
      .split(';').map(s => s.trim()).filter(Boolean);
    const players = (el.dataset.players || '')
      .split(';').map(s => s.trim()).filter(Boolean);
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

  function apply() {
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

      // фильтр по датам
      if (ok && ds && ep.endL   && ep.endL   < ds) ok = false;
      if (ok && de && ep.startR && ep.startR > de) ok = false;

      // фильтр по типу/статусу
      if (ok && selType.length   && !selType.includes(ep.type))     ok = false;
      if (ok && selStatus.length && !selStatus.includes(ep.status)) ok = false;

      // фильтр по маскам/соигрокам/локации
      if (ok && selMask.length     && !ep.masks.some(m => selMask.includes(m)))     ok = false;
      if (ok && selPlayer.length   && !ep.players.some(p => selPlayer.includes(p))) ok = false;
      if (ok && selLocation.length && !selLocation.includes(ep.location))           ok = false;

      ep.el.style.display = ok ? '' : 'none';
      (ok ? visible : hidden).push(ep.el);
    });

    // генерируем событие для внешнего кода
    document.dispatchEvent(new CustomEvent('chrono:filtered', {
      detail: { visible, hidden }
    }));

    return visible;
  }

  function reset() {
    if (elDateStart) elDateStart.value = '';
    if (elDateEnd)   elDateEnd.value   = '';
    $$('#filters .dropdown-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    return apply();
  }

  // поведение дропдаунов
  const unTypeTgl     = wireToggle('typeToggle', 'typeList');
  const unStatusTgl   = wireToggle('statusToggle', 'statusList');
  const unMaskTgl     = wireToggle('maskToggle', 'maskList');
  const unPlayerTgl   = wireToggle('playerToggle', 'playerList');
  const unLocationTgl = wireToggle('locationToggle', 'locationList');

  function onChange(e) {
    if (e.target.matches('#filters .dropdown-list input[type="checkbox"]')) apply();
  }
  document.addEventListener('change', onChange);

  if (elDateStart) elDateStart.addEventListener('change', apply);
  if (elDateEnd)   elDateEnd.addEventListener('change', apply);
  if (elReset)     elReset.addEventListener('click', (e) => {
    e.preventDefault();
    reset();
  });

  // начальное применение фильтра
  apply();

  // экспортируем в глобал для вызова из кода
  API.apply = apply;
  API.reset = reset;
  API.getVisible = () => episodes.filter(ep => ep.el.style.display !== 'none').map(ep => ep.el);
  API.destroy = () => {
    document.removeEventListener('change', onChange);
    if (elDateStart) elDateStart.removeEventListener('change', apply);
    if (elDateEnd)   elDateEnd.removeEventListener('change', apply);
    if (elReset)     elReset.removeEventListener('click', reset);
    unTypeTgl(); unStatusTgl(); unMaskTgl(); unPlayerTgl(); unLocationTgl();
  };
  window.ChronoFilter = API;
})();
