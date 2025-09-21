const IP_ROWS = 1;         // сколько строк видно без скролла
const IP_GAP  = 8;         // зазор между элементами, px
const IP_REQUIRED = true;  // выбор обязателен (если есть варианты)

/* ===== служебные ===== */
function isProfileFieldsPage() {
  try {
    const u = new URL(location.href);
    if (!/\/profile\.php$/i.test(u.pathname)) return false;
    const s = u.searchParams;
    if (s.get('section') !== 'fields') return false;
    const id = s.get('id');
    return !!id && /^\d+$/.test(id);
  } catch { return false; }
}

const STYLE_ID = 'ip-style-sep-wh-col';
function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
    .ip-hidden{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;}
    .ip-box{position:relative;z-index:1000;display:block;max-width:100%;border:1px solid #ccc;border-radius:10px;background:#fff;padding:6px;}
    .ip-box,.ip-scroll,.ip-grid,.ip-btn,.ip-btn *{pointer-events:auto;}
    /* rows/gap задаются константами, высота скроллера зависит от ip-h */
    .ip-scroll{
      overflow-y:auto; -webkit-overflow-scrolling:touch;
      height: calc(var(--ip-rows,1) * var(--ip-h,44px) + (var(--ip-rows,1) - 1) * var(--ip-gap,8px));
    }
    /* ширина колонки — отдельная переменная (--ip-col); по умолчанию = --ip-w */
    .ip-grid{display:grid;grid-template-columns:repeat(auto-fill, var(--ip-col, var(--ip-w,44px)));gap:var(--ip-gap,8px);align-content:start;}
    /* кнопка: независимые ширина и высота */
    .ip-btn{position:relative;overflow:hidden;width:var(--ip-w,44px);height:var(--ip-h,44px);border:2px solid #d0d0d0;border-radius:10px;background:#fff;padding:0;cursor:pointer;touch-action:manipulation;}
    .ip-btn[selected]{border-color:#0b74ff;box-shadow:0 0 0 3px rgba(11,116,255,.15);}
    .ip-slot{position:relative;width:100%;height:100%;}
    .ip-slot img{width:100%;height:100%;display:block;object-fit:cover;}
    .ip-slot *{pointer-events:none;} /* превью не перехватывает клики */
  `;
  document.head.appendChild(st);
}

function resolveFieldBySuffix(suffix) {
  const id = `fld${String(suffix)}`;
  const name = `form[fld${String(suffix)}]`;
  return (
    document.querySelector(`#${CSS.escape(id)}[name="${name}"][type="text"]`) ||
    document.getElementById(id) ||
    document.querySelector(`input[name="${name}"]`)
  );
}

// thumb может быть: HTML-строка, URL-строка, DOM-узел
function createThumbSlot(item) {
  const slot = document.createElement('div');
  slot.className = 'ip-slot';
  const t = item && item.thumb;

  if (t instanceof Node) { slot.appendChild(t.cloneNode(true)); return slot; }
  if (typeof t === 'string') {
    const s = t.trim();
    if (s.startsWith('<') && s.endsWith('>')) { slot.innerHTML = s; return slot; }
    const img = document.createElement('img'); img.src = s; img.alt=''; img.loading='lazy'; slot.appendChild(img); return slot;
  }
  return slot; // пустой
}

/* ===== основная функция =====
   image_set: [{thumb, value}, ...]  (может быть пустым/отсутствовать)
   fieldSuffix: '5'  → fld5 / form[fld5]
   opts: { btnWidth?:number, btnHeight?:number, gridColSize?:number }
*/
function applyImagePicker(image_set, fieldSuffix, opts = {}) {
  if (!isProfileFieldsPage()) return;
  injectStylesOnce();

  const IMAGES = Array.isArray(image_set) ? image_set : [];
  const hasImages = IMAGES.length > 0;

  const input = resolveFieldBySuffix(fieldSuffix);
  if (!input) { console.warn('[imagePicker] field not found:', fieldSuffix); return; }
  if (input.dataset.ipApplied === '1') return;
  input.dataset.ipApplied = '1';

  // стили инстанса
  const w = Number.isFinite(opts.btnWidth)  ? Math.max(1, opts.btnWidth)  : 44;
  const h = Number.isFinite(opts.btnHeight) ? Math.max(1, opts.btnHeight) : 44;
  const col = Number.isFinite(opts.gridColSize) ? Math.max(1, opts.gridColSize) : w;

  // прячем вход
  input.classList.add('ip-hidden');

  const allowed = new Set(IMAGES.map(i => (i && i.value != null ? String(i.value) : '')));

  // UI (если есть элементы)
  let grid = null;
  if (hasImages) {
    const box = document.createElement('div');
    box.className = 'ip-box';
    // задаём переменные инстанса
    box.style.setProperty('--ip-rows', String(IP_ROWS));
    box.style.setProperty('--ip-gap',  `${IP_GAP}px`);
    box.style.setProperty('--ip-w',    `${w}px`);
    box.style.setProperty('--ip-h',    `${h}px`);
    box.style.setProperty('--ip-col',  `${col}px`);

    const scroll = document.createElement('div'); scroll.className = 'ip-scroll';
    const g = document.createElement('div'); g.className = 'ip-grid';

    const byFor = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
    const anchor = input.closest('label') || byFor || input;
    anchor.insertAdjacentElement('afterend', box);

    scroll.addEventListener('pointerdown', e => e.stopPropagation());
    scroll.addEventListener('click', e => e.stopPropagation());

    IMAGES.forEach(it => {
      const v = (it && it.value != null) ? String(it.value) : '';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ip-btn'; btn.dataset.v = v;
      btn.appendChild(createThumbSlot(it));
      const pick = (e) => { e.preventDefault(); e.stopPropagation(); setValue(v); };
      btn.addEventListener('pointerdown', pick);
      btn.addEventListener('click', pick);
      g.appendChild(btn);
    });

    scroll.appendChild(g);
    box.appendChild(scroll);
    grid = g;
  }

  // подсветка
  function highlight(v) {
    if (!grid) return;
    grid.querySelectorAll('.ip-btn').forEach(b => b.removeAttribute('selected'));
    const esc = (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v);
    const btn = grid.querySelector(`.ip-btn[data-v="${esc}"]`);
    if (btn) btn.setAttribute('selected', '');
  }

  // установка значения без рекурсии
  let internal = false;
  function setValue(val) {
    const v = (val == null ? '' : String(val));
    if (input.value !== v) {
      internal = true;
      input.value = v;
      input.dispatchEvent(new Event('input',  { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      internal = false;
    }
    highlight(v);
  }

  // инициализация
  const firstVal = hasImages ? (IMAGES[0].value == null ? '' : String(IMAGES[0].value)) : '';
  const current  = (input.value == null ? '' : String(input.value));
  let initial    = hasImages
    ? (allowed.has(current) ? current : (IP_REQUIRED ? firstVal : ''))
    : '';

  input.dataset.ipInitial = initial;
  setValue(initial);

  // синхронизация на внешние изменения
  if (!input.dataset.ipSynced) {
    input.addEventListener('input',  () => { if (!internal) highlight(input.value ?? ''); });
    input.addEventListener('change', () => { if (!internal) highlight(input.value ?? ''); });
    input.dataset.ipSynced = '1';
  }

  // валидация перед submit
  const form = input.closest('form');
  if (form && !form.dataset.ipSubmitHooked) {
    form.addEventListener('submit', () => {
      const cur = (input.value == null ? '' : String(input.value));
      if (!hasImages) { setValue(''); return; }
      if (!allowed.has(cur)) {
        const fallback = input.dataset.ipInitial ?? (IP_REQUIRED ? firstVal : '');
        setValue(fallback);
      }
      if (IP_REQUIRED && hasImages && input.value === '') setValue(firstVal);
    }, true);
    form.dataset.ipSubmitHooked = '1';
  }

  return { set: setValue };
}
