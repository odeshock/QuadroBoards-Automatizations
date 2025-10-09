/* ================== КОНСТАНТЫ UI ================== */
const IP_ROWS = 1;        // сколько строк карточек видно без скролла
const IP_GAP  = 8;        // расстояние между карточками, px
const IP_REQUIRED = true; // если есть варианты — пустым не оставляем

/* ================== УТИЛИТЫ ================== */
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

const STYLE_ID = 'ip-style-clean';
function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
    /* скрываем исходный textarea/input */
    .ip-hidden {
      display: none !important;
      resize: none !important;
      visibility: hidden !important;
    }

    /* Белый контейнер подстраивается под ширину контента */
    .ip-box {
      position: relative;
      display: inline-block;          /* ширина = контенту */
      max-width: 100%;
      border: 1px solid #ccc;
      border-radius: 10px;
      background: #fff;
      padding: 6px;
    }

    /* Вертикальный скролл */
    .ip-scroll {
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      max-height: calc(var(--ip-rows,1) * var(--ip-h,44px)
                      + (var(--ip-rows,1) - 1) * var(--ip-gap,8px));
    }

    /* Сетка: перенос вниз, ширина по контенту */
    .ip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ip-gap,8px);
      align-content: flex-start;
      justify-content: flex-start;
    }

    .ip-btn {
      position: relative;
      overflow: hidden;
      width: var(--ip-w,44px);
      height: var(--ip-h,44px);
      border: 2px solid #d0d0d0;
      border-radius: 10px;
      background: #fff;
      padding: 0;
      cursor: pointer;
      touch-action: manipulation;
    }
    .ip-btn[selected] {
      border-color: #0b74ff;
      box-shadow: 0 0 0 3px rgba(11,116,255,.15);
    }

    .ip-slot {
      position: relative;
      width: 100%;
      height: 100%;
    }
    .ip-slot img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
    .ip-slot * {
      pointer-events: none;
    }
  `;
  document.head.appendChild(st);
}

// поиск поля по суффиксу: работает и для input, и для textarea
function resolveFieldBySuffix(suffix) {
  const id = `fld${String(suffix)}`;
  const name = `form[fld${String(suffix)}]`;
  return (
    document.querySelector(`#${CSS.escape(id)}[name="${name}"]`) ||
    document.getElementById(id) ||
    document.querySelector(`[name="${name}"]`)
  );
}

// нормализация на ЗАГРУЗКЕ: у <a.modal-link> сохраняем только class и style
function normalizeModalLinkAttrs(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  t.content.querySelectorAll('a.modal-link').forEach(a => {
    Array.from(a.attributes).forEach(attr => {
      if (attr.name !== 'class' && attr.name !== 'style') a.removeAttribute(attr.name);
    });
  });
  return t.innerHTML.trim();
}

// ПЕРЕД СОХРАНЕНИЕМ: каждой <a.modal-link> добавить data-reveal-id и id="usrN"
function prepareModalLinkAttrs(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  const anchors = t.content.querySelectorAll('a.modal-link');
  if (anchors.length) {
    const u = new URL(location.href);
    const n = u.searchParams.get('id');
    const usrId = (n && /^\d+$/.test(n)) ? `usr${n}` : null;
    anchors.forEach(a => {
      a.setAttribute('data-reveal-id', 'character');
      if (usrId) a.setAttribute('id', usrId);
    });
  }
  return t.innerHTML.trim();
}

// превью карточки: если строка даёт DOM — вставляем, иначе <img>
function createThumbSlot(htmlOrUrl) {
  const slot = document.createElement('div');
  slot.className = 'ip-slot';
  const raw = String(htmlOrUrl ?? '').trim();
  if (!raw) return slot;
  const t = document.createElement('template'); t.innerHTML = raw;
  if (t.content.querySelector('*')) {
    slot.appendChild(t.content.cloneNode(true));
  } else {
    const img = document.createElement('img');
    img.src = raw; img.alt = ''; img.loading = 'lazy';
    slot.appendChild(img);
  }
  return slot;
}

function keyFor(str) { const s=String(str??''); let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i); return 'k'+(h>>>0).toString(36); }

// реестр полей на форме: form -> { entries: [{input, fieldSuffix, prepareOne}], hooked }
const FORM_STATE = new WeakMap();

/* ================== ОСНОВНАЯ ФУНКЦИЯ ==================
   image_set: массив СТРОК (HTML или URL)
   fieldSuffix (number): 5 → 'fld5' / 'form[fld5]' 
   opts: { btnWidth?: number, btnHeight?: number, gridColSize?: number, modalLinkMode?: boolean }
*/
function applyImagePicker(image_set, fieldSuffix, opts = {}) {
  if (!isProfileFieldsPage()) return;
  injectStylesOnce();

  const modalLinkMode = !!opts.modalLinkMode;
  const RAW = Array.isArray(image_set) ? image_set : [];
  const ITEMS = RAW.map(s => String(s ?? ''));

  const input = resolveFieldBySuffix(fieldSuffix);
  if (!input) return;

  // скрываем исходный контрол
  input.classList.add('ip-hidden');

  // размеры карточек / сетки
  const w   = Number.isFinite(opts.btnWidth)   ? Math.max(1, opts.btnWidth)   : 44;
  const h   = Number.isFinite(opts.btnHeight)  ? Math.max(1, opts.btnHeight)  : 44;
  const col = Number.isFinite(opts.gridColSize)? Math.max(1, opts.gridColSize): w;

  // нормализованные строки (как храним внутри textarea/input)
  const NORMS = ITEMS.map(v => modalLinkMode ? normalizeModalLinkAttrs(v) : v);
  const allowed = new Set(NORMS);
  const keyByNorm = new Map(NORMS.map(n => [n, keyFor(n)]));

  // берём текущее значение поля (textarea.value уже отдаёт текст)
  const currentNorm = modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '');

  // строим UI, если есть варианты
  let grid = null;
  if (ITEMS.length > 0) {
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

    // клики по сетке не должны триггерить внешние хэндлеры
    scroll.addEventListener('pointerdown', e => e.stopPropagation());
    scroll.addEventListener('click', e => e.stopPropagation());

    NORMS.forEach((norm, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ip-btn';
      btn.dataset.key = keyByNorm.get(norm);

      // превью показываем: при modalLinkMode — нормализованную версию, иначе исходную
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

  // подсветка выбранной
  function highlight(normStr) {
    if (!grid) return;
    const key = keyByNorm.get(String(normStr)) || '';
    grid.querySelectorAll('.ip-btn').forEach(b => b.removeAttribute('selected'));
    if (key) {
      const btn = grid.querySelector(`.ip-btn[data-key="${key}"]`);
      if (btn) btn.setAttribute('selected', '');
    }
  }

  // установка значения в скрытый контрол
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

  // начальное значение
  const firstNorm   = NORMS[0] || '';
  const initialNorm = ITEMS.length
    ? (allowed.has(currentNorm) ? currentNorm : (IP_REQUIRED ? firstNorm : ''))
    : '';
  input.dataset.ipInitial = initialNorm;
  setValue(initialNorm);

  // синхронизация внешних правок
  input.addEventListener('input',  () => { if (!internal) highlight(modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '')); });
  input.addEventListener('change', () => { if (!internal) highlight(modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '')); });

  /* ===== РЕЕСТР ФОРМЫ: готовим ВСЕ поля перед отправкой ===== */
  const form = input.closest('form');
  if (!form) return { set: setValue };

  let state = FORM_STATE.get(form);
  if (!state) {
    state = { entries: [], hooked: false };
    FORM_STATE.set(form, state);
  }

  // подготовка одного поля
  const prepareOne = () => {
    let curNorm = modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '');

    if (!ITEMS.length) {
      const preparedEmpty = modalLinkMode ? prepareModalLinkAttrs('') : '';
      input.value = preparedEmpty;
      return preparedEmpty;
    }

    if (!allowed.has(curNorm)) {
      const fallback = input.dataset.ipInitial ?? (IP_REQUIRED ? firstNorm : '');
      curNorm = String(fallback);
      setValue(curNorm);
    }

    const finalVal = modalLinkMode ? prepareModalLinkAttrs(curNorm) : curNorm;
    input.value = finalVal;
    return finalVal;
  };

  state.entries.push({ input, fieldSuffix, prepareOne });

  if (!state.hooked) {
    state.hooked = true;
    const nativeSubmit = form.submit;

    const prepareAll = () => {
      state.entries.forEach(({ prepareOne }) => { prepareOne(); });
    };

    // обычный submit
    form.addEventListener('submit', (e) => {
      if (form.dataset.ipResuming === '1') return;
      prepareAll();
    }, true);

    // new FormData(form)
    form.addEventListener('formdata', (e) => {
      prepareAll();
      // гарантируем, что в FormData уйдут обновлённые значения
      state.entries.forEach(({ input, fieldSuffix }) => {
        try {
          const name = input.name || `form[fld${fieldSuffix}]`;
          e.formData.set(name, input.value);
        } catch(_) {}
      });
    });

    // программный form.submit()
    form.submit = function(...args){
      if (form.dataset.ipResuming === '1') return nativeSubmit.apply(this, args);
      prepareAll();
      return nativeSubmit.apply(this, args);
    };
  }

  return { set: setValue };
}
