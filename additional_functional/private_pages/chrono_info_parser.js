/* ===== helpers: маппинги статусов/типов и форматирование ===== */
const TYPE_MAP_RU = {
  personal: {label:'личный', emoji:'🪄'},
  plot:     {label:'сюжетный', emoji:'🪄'},
  au:       {label:'au',       emoji:'🪄'}
};
const STATUS_MAP_RU = {
  active:   {label:'активен',     emoji:'🟢'},
  archived: {label:'архивирован', emoji:'🟤'},
  closed:   {label:'закрыт',      emoji:'🟦'}
};

/* Нормализуем строку даты в числовой ключ YYYYMMDD для левой/правой границы */
function dateKey(raw, side='L') {
  const s = String(raw||'').trim();
  if (!s) return 0;
  // dd.mm.yyyy
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (m) {
    const d = +m[1], mo = +m[2], y = toYYYY(m[3]);
    return y*10000 + mo*100 + d;
  }
  // mm.yyyy
  m = s.match(/^(\d{1,2})\.(\d{2}|\d{4})$/);
  if (m) {
    const mo = +m[1], y = toYYYY(m[2]);
    const d = (side==='L') ? 1 : 31;
    return y*10000 + mo*100 + d;
  }
  // yyyy
  m = s.match(/^(\d{2}|\d{4})$/);
  if (m) {
    const y = toYYYY(m[1]);
    const mo = (side==='L') ? 1 : 12;
    const d  = (side==='L') ? 1 : 31;
    return y*10000 + mo*100 + d;
  }
  return 0;
}
function toYYYY(n){ const num = Number(n); if (String(n).length===2) return (num>30?1900+num:2000+num); return num; }

/* Утилиты DOM */
const $ = sel => document.querySelector(sel);
function on(el, ev, fn){ el.addEventListener(ev, fn, {passive:true}); }
function unique(arr){ return Array.from(new Set(arr.filter(Boolean))); }
function fmtDateRange(a,b){ return [a,b].filter(Boolean).join(' — '); }

/* dropdown open/close */
function setupDropdown(toggleBtn, listEl) {
  on(toggleBtn, 'click', () => {
    const open = listEl.style.display === 'block';
    listEl.style.display = open ? 'none' : 'block';
  });
  // клик снаружи — закрыть
  document.addEventListener('click', (e) => {
    if (!listEl.contains(e.target) && !toggleBtn.contains(e.target)) {
      listEl.style.display = 'none';
    }
  });
}

/* Собрать выбранные значения чекбоксов группы по name */
function selectedValues(name){
  return Array.from(document.querySelectorAll(`input[type="checkbox"][name="${name}"]:checked`))
    .map(i => i.value);
}

/* Основная точка входа */
async function renderEpisodesForUser(userId, opts = {}) {
  const listEl = $('#list');
  const maskListEl = $('#maskList');
  const playerListEl = $('#playerList');
  const locationListEl = $('#locationList');

  const typeToggle = $('#typeToggle');
  const statusToggle = $('#statusToggle');
  const maskToggle = $('#maskToggle');
  const playerToggle = $('#playerToggle');
  const locationToggle = $('#locationToggle');

  setupDropdown(typeToggle, $('#typeList'));
  setupDropdown(statusToggle, $('#statusList'));
  setupDropdown(maskToggle, maskListEl);
  setupDropdown(playerToggle, playerListEl);
  setupDropdown(locationToggle, locationListEl);

  const dateStartInp = $('#dateStart');
  const dateEndInp   = $('#dateEnd');
  const resetBtn     = $('#resetBtn');

  // === 1) получить данные
  const dict = await collectChronoByUser(opts); // <- из вашего файла
  const u = dict?.[String(userId)];
  const baseName = u?.name || '';
  const episodesRaw = Array.isArray(u?.episodes) ? u.episodes.slice() : [];

  // === 2) подготовить отображаемые эпизоды + набрать справочники
  const episodes = episodesRaw.map(ep => {
    const t = TYPE_MAP_RU[ep.type] || TYPE_MAP_RU.au;
    const s = STATUS_MAP_RU[ep.status] || STATUS_MAP_RU.archived;

    const masks = Array.isArray(ep.masks) ? ep.masks.filter(Boolean) : [];
    const players = (Array.isArray(ep.participants) ? ep.participants : [])
      .map(p => p?.name).filter(Boolean);

    const startL = dateKey(ep.dateStart, 'L');
    const endR   = dateKey(ep.dateEnd || ep.dateStart, 'R');

    return {
      ...ep,
      _typeLabel:t.label, _typeEmoji:t.emoji,
      _statusLabel:s.label, _statusEmoji:s.emoji,
      _masks:masks,
      _players:players,
      _startKeyL:startL,
      _endKeyR:endR,
      _maskStr: masks.join(';'),
      _playersStr: players.join(';')
    };
  });

  // справочники
  const dictMasks    = unique(episodes.flatMap(e => e._masks));
  const dictPlayers  = unique(episodes.flatMap(e => e._players));
  const dictLocation = unique(episodes.map(e => (e.location||'').trim()).filter(Boolean));

  // === 3) заполнить динамические dropdown'ы
  function fillList(container, name, values){
    container.innerHTML = values.map(v => (
      `<label><input type="checkbox" name="${name}" value="${escapeHtml(v)}"> ${escapeHtml(v)}</label>`
    )).join('');
  }
  fillList(maskListEl, 'mask', dictMasks);
  fillList(playerListEl, 'player', dictPlayers);
  fillList(locationListEl, 'location', dictLocation);

  // === 4) рендер листа с учётом фильтров
  function applyAndRender() {
    const tSel = selectedValues('type');      // русские ярлыки: личный/сюжетный/au
    const sSel = selectedValues('status');    // активен/архивирован/закрыт
    const mSel = selectedValues('mask');      // строки масок
    const pSel = selectedValues('player');    // имена
    const lSel = selectedValues('location');  // локации
    const ds = (dateStartInp.value || '').trim();
    const de = (dateEndInp.value   || '').trim();
    const dsKey = ds ? dateKey(dateInputToRu(ds),'L') : 0;
    const deKey = de ? dateKey(dateInputToRu(de),'R') : 0;

    const filtered = episodes.filter(ep => {
      if (tSel.length && !tSel.includes(ep._typeLabel)) return false;
      if (sSel.length && !sSel.includes(ep._statusLabel)) return false;
      if (mSel.length && !mSel.every(v => ep._masks.includes(v))) return false; // все выбранные маски должны быть
      if (pSel.length && !pSel.every(v => ep._players.includes(v))) return false;
      if (lSel.length && !lSel.includes((ep.location||'').trim())) return false;

      // проверка по диапазону дат (пересечение)
      if (dsKey || deKey) {
        const left  = dsKey || 0;
        const right = deKey || Number.MAX_SAFE_INTEGER;
        // интервал эпизода пересекает фильтр?
        if (!(ep._endKeyR >= left && ep._startKeyL <= right)) return false;
      }
      return true;
    });

    // рендер
    listEl.innerHTML = filtered.map(ep => {
      const typestr = `${ep._typeLabel} ${ep._typeEmoji}`;
      const statstr = `${ep._statusLabel} ${ep._statusEmoji}`;
      const masksComma   = ep._masks.join(', ');
      const playersComma = ep._players.join(', ');
      const dr = fmtDateRange(ep.dateStart, ep.dateEnd || ep.dateStart);

      return `
<div class="episode"
     data-type="${escapeAttr(ep._typeLabel)}"
     data-status="${escapeAttr(ep._statusLabel)}"
     data-start-l="${ep._startKeyL}" data-start-r="${ep._startKeyL}"
     data-end-l="${ep._endKeyR}" data-end-r="${ep._endKeyR}"
     data-mask="${escapeAttr(ep._maskStr)}"
     data-location="${escapeAttr(ep.location||'')}"
     data-players="${escapeAttr(ep._playersStr)}">
  <div>тип: ${escapeHtml(typestr)}; статус: ${escapeHtml(statstr)}</div>
  <div><span class="muted">${escapeHtml(dr)}</span> 
      <a class="title" href="${escapeAttr(ep.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ep.title)}</a> 
      ${masksComma ? 'as ' + escapeHtml(masksComma) : ''}</div>
  <div>локация: ${escapeHtml(ep.location||'')}</div>
  <div>соигроки: ${escapeHtml(playersComma)}</div>
</div>`;
    }).join('') || `<div class="meta">Ничего не найдено по текущим фильтрам.</div>`;
  }

  // === 5) вешаем обработчики и первый рендер
  document.querySelectorAll('#typeList input[name="type"], #statusList input[name="status"], #maskList input[name="mask"], #playerList input[name="player"], #locationList input[name="location"]').forEach(cb=>{
    on(cb,'change', applyAndRender);
  });
  on(dateStartInp,'change', applyAndRender);
  on(dateEndInp,'change', applyAndRender);

  on(resetBtn,'click', () => {
    // сброс дат
    dateStartInp.value = '';
    dateEndInp.value   = '';
    // сброс чекбоксов
    document.querySelectorAll('#filters input[type="checkbox"]').forEach(cb => cb.checked = false);
    applyAndRender();
  });

  // обновить подписи на кнопках dropdown по выбору
  function syncDropdownTitles() {
    const upd = () => {
      const t = selectedValues('type');      typeToggle.textContent     = t.length ? `Тип: ${t.join(', ')}` : 'Выбрать тип';
      const s = selectedValues('status');    statusToggle.textContent   = s.length ? `Статус: ${s.join(', ')}` : 'Выбрать статус';
      const m = selectedValues('mask');      maskToggle.textContent     = m.length ? `Маска: ${m.join(', ')}` : 'Выбрать маску';
      const p = selectedValues('player');    playerToggle.textContent   = p.length ? `Соигрок: ${p.join(', ')}` : 'Выбрать соигрока';
      const l = selectedValues('location');  locationToggle.textContent = l.length ? `Локация: ${l.join(', ')}` : 'Выбрать локацию';
    };
    document.querySelectorAll('#filters input[type="checkbox"]').forEach(cb=>on(cb,'change',upd));
    upd();
  }
  syncDropdownTitles();

  // первый рендер
  applyAndRender();
}

/* Преобразуем значение <input type="date"> (yyyy-mm-dd) в "дд.мм.гггг" */
function dateInputToRu(v){
  if (!v) return '';
  const [y,m,d] = v.split('-').map(n=>+n);
  const pad = x=>String(x).padStart(2,'0');
  return `${pad(d)}.${pad(m)}.${y}`;
}

/* Безопасные экранирования */
function escapeHtml(s){ return String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

// Автостарт по готовности DOM (кастомизируйте ID пользователя)
document.addEventListener('DOMContentLoaded', () => {
  // Пример: подставьте реальный ID пользователя из вашей логики
  // renderEpisodesForUser('12345');
});
