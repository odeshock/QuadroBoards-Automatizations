/* ===== константы (общие) ===== */
const IP_ROWS = 1;         // сколько строк видно без скролла
const IP_GAP  = 8;         // зазор между элементами (px)
const IP_REQUIRED = true;  // выбор обязателен (если есть варианты)

/* ===== утилиты ===== */
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

const STYLE_ID = 'ip-style-unified';
function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
    .ip-hidden{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;}
    .ip-box{position:relative;z-index:1000;display:block;max-width:100%;border:1px solid #ccc;border-radius:10px;background:#fff;padding:6px;}
    .ip-box,.ip-scroll,.ip-grid,.ip-btn,.ip-btn *{pointer-events:auto;}
    .ip-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;
      height: calc(var(--ip-rows,1) * var(--ip-h,44px) + (var(--ip-rows,1) - 1) * var(--ip-gap,8px));}
    .ip-grid{display:grid;grid-template-columns:repeat(auto-fill, var(--ip-col, var(--ip-w,44px)));
      gap:var(--ip-gap,8px);align-content:start;}
    .ip-btn{position:relative;overflow:hidden;width:var(--ip-w,44px);height:var(--ip-h,44px);
      border:2px solid #d0d0d0;border-radius:10px;background:#fff;padding:0;cursor:pointer;touch-action:manipulation;}
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
    document.querySelector(`textarea[name="${name}"]`)
  );
}

// очищаем у <a.modal-link> все атрибуты кроме class
function normalizeModalLinkAttrs(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  t.content.querySelectorAll('a.modal-link').forEach(a => {
    Array.from(a.attributes).forEach(attr => {
      if (attr.name !== 'class') a.removeAttribute(attr.name);
    });
  });
  return t.innerHTML.trim();
}

// перед сабмитом: добавить data-reveal-id всем <a.modal-link>, id="usrN" — первой
function prepareModalLinkAttrs(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  const anchors = t.content.querySelectorAll('a.modal-link');
  if (anchors.length) {
    anchors.forEach(a => a.setAttribute('data-reveal-id', 'character'));
    const u = new URL(location.href);
    const n = u.searchParams.get('id');
    if (n && /^\d+$/.test(n)) anchors[0].setAttribute('id', `usr${n}`);
  }
  return t.innerHTML.trim();
}

// превью: если строка выглядит как HTML — innerHTML, иначе <img src="...">
function createThumbSlot(htmlOrUrl) {
  const slot = document.createElement('div');
  slot.className = 'ip-slot';
  const s = String(htmlOrUrl ?? '').trim();
  if (s.startsWith('<') && s.endsWith('>')) {
    slot.innerHTML = s;
  } else if (s) {
    const img = document.createElement('img');
    img.src = s; img.alt = ''; img.loading = 'lazy';
    slot.appendChild(img);
  }
  return slot;
}

// ключ по строке (для data-атрибутов/подсветки)
function keyFor(str) {
  const s = String(str ?? '');
  let h = 5381; for (let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i);
  return 'k' + (h>>>0).toString(36);
}

/* ===== основная функция =====
   image_set: массив СТРОК (HTML или URL). Каждая строка = и превью, и значение.
   fieldSuffix: '5' -> fld5 / form[fld5]
   opts: { btnWidth?:number, btnHeight?:number, gridColSize?:number, modalLinkMode?:boolean }
*/
function applyImagePicker(image_set, fieldSuffix, opts = {}) {
  if (!isProfileFieldsPage()) return;
  injectStylesOnce();

  const modalLinkMode = !!opts.modalLinkMode;

  const RAW = Array.isArray(image_set) ? image_set : [];
  const ITEMS = RAW.map(s => String(s ?? ''));
  const hasItems = ITEMS.length > 0;

  const input = resolveFieldBySuffix(fieldSuffix);
  if (!input) { console.warn('[imagePicker] field not found:', fieldSuffix); return; }
  if (input.dataset.ipApplied === '1') return;
  input.dataset.ipApplied = '1';

  // размеры инстанса
  const w = Number.isFinite(opts.btnWidth)  ? Math.max(1, opts.btnWidth)  : 44;
  const h = Number.isFinite(opts.btnHeight) ? Math.max(1, opts.btnHeight) : 44;
  const col = Number.isFinite(opts.gridColSize) ? Math.max(1, opts.gridColSize) : w;

  // спрятать input
  input.classList.add('ip-hidden');

  // нормализованные строки для хранения/сравнения
  const NORMS = ITEMS.map(v => modalLinkMode ? normalizeModalLinkAttrs(v) : v);
  const allowed = new Set(NORMS);
  const keyByNorm = new Map(NORMS.map(n => [n, keyFor(n)]));

  // UI
  let grid = null;
  if (hasItems) {
    const box = document.createElement('div');
    box.className = 'ip-box';
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

    NORMS.forEach((norm, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ip-btn'; btn.dataset.key = keyByNorm.get(norm);
      // превью: показываем нормализованную (если modalLinkMode) или исходную строку
      const display = modalLinkMode ? norm : ITEMS[idx];
      btn.appendChild(createThumbSlot(display));

      const pick = (e) => { e.preventDefault(); e.stopPropagation(); setValue(norm); };
      btn.addEventListener('pointerdown', pick);
      btn.addEventListener('click', pick);

      g.appendChild(btn);
    });

    scroll.appendChild(g);
    box.appendChild(scroll);
    grid = g;
  }

  // подсветка
  function highlight(normStr) {
    if (!grid) return;
    const key = keyByNorm.get(String(normStr)) || '';
    grid.querySelectorAll('.ip-btn').forEach(b => b.removeAttribute('selected'));
    if (key) {
      const btn = grid.querySelector(`.ip-btn[data-key="${key}"]`);
      if (btn) btn.setAttribute('selected', '');
    }
  }

  // установка значения (norm), без рекурсии
  let internal = false;
  function setValue(normVal) {
    const v = String(normVal ?? '');
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
  const currentNorm = modalLinkMode ? normalizeModalLinkAttrs(input.value) : String(input.value ?? '');
  const firstNorm   = hasItems ? NORMS[0] : '';
  const initialNorm = hasItems
    ? (allowed.has(currentNorm) ? currentNorm : (IP_REQUIRED ? firstNorm : ''))
    : '';
  input.dataset.ipInitial = initialNorm;
  setValue(initialNorm);

  // синхронизация внешних изменений
  if (!input.dataset.ipSynced) {
    input.addEventListener('input',  () => { if (!internal) highlight(modalLinkMode ? normalizeModalLinkAttrs(input.value) : String(input.value ?? '')); });
    input.addEventListener('change', () => { if (!internal) highlight(modalLinkMode ? normalizeModalLinkAttrs(input.value) : String(input.value ?? '')); });
    input.dataset.ipSynced = '1';
  }

  // перед submit
  const form = input.closest('form');
  if (form && !form.dataset.ipSubmitHooked) {
    form.addEventListener('submit', () => {
      let curNorm = modalLinkMode ? normalizeModalLinkAttrs(input.value) : String(input.value ?? '');
      if (!hasItems) { setValue(''); return; }
      if (!allowed.has(curNorm)) {
        const fallback = input.dataset.ipInitial ?? (IP_REQUIRED ? firstNorm : '');
        curNorm = String(fallback);
        setValue(curNorm);
      }
      if (modalLinkMode) {
        input.value = prepareModalLinkAttrs(curNorm);
      }
    }, true);
    form.dataset.ipSubmitHooked = '1';
  }

  return { set: setValue };
}
