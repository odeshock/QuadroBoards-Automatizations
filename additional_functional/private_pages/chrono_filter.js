// 1) Собираем эпизоды и их поля из data-* атрибутов
const episodes = Array.from(document.querySelectorAll('.episode')).map(el=>{
  const parseDate = v => v ? new Date(v) : null;
  const masks   = (el.dataset.mask||'').split(',').map(s=>s.trim()).filter(Boolean);
  const players = (el.dataset.players||'').split(',').map(s=>s.trim()).filter(Boolean);
  return {
    el,
    type: el.dataset.type || '',
    status: el.dataset.status || '',
    startL: parseDate(el.dataset.startL),
    startR: parseDate(el.dataset.startR),
    endL:   parseDate(el.dataset.endL),
    endR:   parseDate(el.dataset.endR),
    masks,
    players,
    location: el.dataset.location || ''
  };
});

// 2) Динамически наполняем списки фильтров из данных
const sets = { type:new Set(), status:new Set(), mask:new Set(), player:new Set(), location:new Set() };
episodes.forEach(ep=>{
  if(ep.type) sets.type.add(ep.type);
  if(ep.status) sets.status.add(ep.status);
  ep.masks.forEach(m=>sets.mask.add(m));
  ep.players.forEach(p=>sets.player.add(p));
  if(ep.location) sets.location.add(ep.location);
});

function fill(containerId, items, name){
  const box = document.getElementById(containerId);
  box.innerHTML = '';
  Array.from(items).sort((a,b)=>a.localeCompare(b,'ru')).forEach(v=>{
    const lbl = document.createElement('label');
    const cb  = document.createElement('input');
    cb.type='checkbox'; cb.name=name; cb.value=v;
    lbl.appendChild(cb); lbl.append(' '+v);
    box.appendChild(lbl);
  });
}
fill('typeList', sets.type, 'type');
fill('statusList', sets.status, 'status');
fill('maskList', sets.mask, 'mask');
fill('playerList', sets.player, 'player');
fill('locationList', sets.location, 'location');

// 3) Тогглы раскрывашек
function wireToggle(btnId, listId){
  const btn=document.getElementById(btnId), list=document.getElementById(listId);
  btn.addEventListener('click', e=>{ e.stopPropagation(); list.style.display=list.style.display==='block'?'none':'block'; });
  document.addEventListener('click', e=>{ if(!list.contains(e.target) && !btn.contains(e.target)) list.style.display='none'; });
}
wireToggle('typeToggle','typeList');
wireToggle('statusToggle','statusList');
wireToggle('maskToggle','maskList');
wireToggle('playerToggle','playerList');
wireToggle('locationToggle','locationList');

// 4) Логика фильтрации дат по вашему правилу:
// показываем эпизод, если (ds отсутствует или ds <= startR) И (de отсутствует или endL <= de)
const elDateStart = document.getElementById('dateStart');
const elDateEnd   = document.getElementById('dateEnd');
const elReset     = document.getElementById('resetBtn');

function getChecked(name){
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(i=>i.value);
}

function applyFilters(){
  const ds = elDateStart.value ? new Date(elDateStart.value) : null;
  const de = elDateEnd.value   ? new Date(elDateEnd.value)   : null;
  const selType = getChecked('type');
  const selStatus = getChecked('status');
  const selMask = getChecked('mask');
  const selPlayer = getChecked('player');
  const selLocation = getChecked('location');

  episodes.forEach(ep=>{
    // Даты
    if(ds && ep.startR && ds > ep.startR) ok=false;          // фильтр-старт > стартR эпизода
    if(de && ep.endL && ep.endL > de) ok=false;              // конецL эпизода > фильтр-энд
    // Тип/статус
    if(ok && selType.length && !selType.includes(ep.type)) ok=false;
    if(ok && selStatus.length && !selStatus.includes(ep.status)) ok=false;
    // Маски / соигроки / локация
    if(ok && selMask.length && !ep.masks.some(m=>selMask.includes(m))) ok=false;
    if(ok && selPlayer.length && !ep.players.some(p=>selPlayer.includes(p))) ok=false;
    if(ok && selLocation.length && !selLocation.includes(ep.location)) ok=false;
  });
}

// 5) Сброс
elReset.addEventListener('click', ()=>{
  elDateStart.value='';
  elDateEnd.value='';
  document.querySelectorAll('.dropdown-list input[type="checkbox"]').forEach(cb=>cb.checked=false);
  applyFilters();
});

// 6) Слушатели
document.addEventListener('change', e=>{
  if(e.target.matches('.dropdown-list input[type="checkbox"]')) applyFilters();
});
[elDateStart, elDateEnd].forEach(i=> i.addEventListener('change', applyFilters));

// 7) Первая отрисовка
applyFilters();
