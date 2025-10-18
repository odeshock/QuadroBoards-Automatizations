// chrono_filter.js — модульная, корне-изолированная версия
(() => {
  function makeFilterAPI(root) {
    const $  = (sel, r = root) => r.querySelector(sel);
    const $$ = (sel, r = root) => Array.from(r.querySelectorAll(sel));
    const parseDate = v => (v ? new Date(v) : null);
    const getChecked = (box, name) =>
      Array.from(box?.querySelectorAll(`input[name="${name}"]:checked`) || []).map(i => i.value);

    const filters = $('#filters');
    const list    = $('#list');
    if (!filters || !list) {
      return { apply: () => [], reset: () => [], getVisible: () => [], destroy: () => {} };
    }

    const elDateStart = $('#dateStart');
    const elDateEnd   = $('#dateEnd');
    const elReset     = $('#resetBtn');

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
      const ds = elDateStart?.value ? new Date(elDateStart.value) : null;
      const de = elDateEnd?.value   ? new Date(elDateEnd.value)   : null;

      const selType     = getChecked(typeBox,     'type');
      const selStatus   = getChecked(statusBox,   'status');
      const selMask     = getChecked(maskBox,     'mask');
      const selPlayer   = getChecked(playerBox,   'player');
      const selLocation = getChecked(locationBox, 'location');

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

      // событие — от корня модалки
      root.dispatchEvent(new CustomEvent('chrono:filtered', { detail: { visible, hidden } }));
      return visible;
    }

    function reset() {
      if (elDateStart) elDateStart.value = '';
      if (elDateEnd)   elDateEnd.value   = '';
      $$('#filters .dropdown-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      return apply();
    }

    function onChange(e) {
      if (e.target.closest('#filters .dropdown-list') && e.target.matches('input[type="checkbox"]')) apply();
    }
    root.addEventListener('change', onChange);
    elDateStart?.addEventListener('change', apply);
    elDateEnd?.addEventListener('change', apply);
    elReset?.addEventListener('click', (e) => { e.preventDefault(); reset(); });

    apply();

    return {
      apply, reset,
      getVisible: () => episodes.filter(ep => ep.el.style.display !== 'none').map(ep => ep.el),
      destroy: () => {
        root.removeEventListener('change', onChange);
        elDateStart?.removeEventListener('change', apply);
        elDateEnd?.removeEventListener('change', apply);
        elReset?.removeEventListener('click', reset);
        unTypeTgl(); unStatusTgl(); unMaskTgl(); unPlayerTgl(); unLocationTgl();
      }
    };
  }

  // Публичный API — то, что ждёт modal_loader
  window.ChronoFilter = {
    init({ root } = {}) { return makeFilterAPI(root || document); },
    apply: () => [],
    reset: () => [],
    getVisible: () => [],
    destroy: () => {}
  };
})();
