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

// ——— стили (вставляем один раз)
const STYLE_ID = 'ip-style';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
    .ip-hidden{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;}
    .ip-box{position:relative;z-index:1000;display:block;max-width:100%;border:1px solid #ccc;border-radius:10px;background:#fff;padding:6px;}
    .ip-box,.ip-scroll,.ip-grid,.ip-btn,.ip-btn *{pointer-events:auto;}
    .ip-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;height: calc(var(--ip-rows,1) * var(--ip-size,44px) + (var(--ip-rows,1) - 1) * var(--ip-gap,8px));}
    .ip-grid{display:grid;grid-template-columns:repeat(auto-fill,var(--ip-size,44px));gap:var(--ip-gap,8px);align-content:start;}
    .ip-btn{width:var(--ip-size,44px);height:var(--ip-size,44px);border:2px solid #d0d0d0;border-radius:10px;background:#fff;padding:0;cursor:pointer;touch-action:manipulation;}
    .ip-btn[selected]{border-color:#0b74ff;box-shadow:0 0 0 3px rgba(11,116,255,.15);}
    .ip-btn img{width:100%;height:100%;display:block;object-fit:contain;}
  `;
  document.head.appendChild(st);
}

// ——— резолвим поле по описанию
function resolveField(desc) {
  if (!desc) return null;
  if (desc instanceof Element) return desc;
  if (typeof desc === 'string') return document.querySelector(desc);
  if (desc.selector) return document.querySelector(desc.selector);
  if (desc.id && desc.name) {
    const byId = document.getElementById(String(desc.id));
    if (byId && byId.name === desc.name) return byId;
  }
  if (desc.id) return document.getElementById(String(desc.id));
  if (desc.name) return document.querySelector(`input[name="${desc.name}"]`);
  return null;
}

// ——— основная функция
function applyImagePicker({
  image_set,
  field,
  rows = 1,     // видимых строк без скролла
  size = 44,    // px
  gap  = 8,     // px
  required = true, // если true и есть варианты — пустым быть не может
  onlyOnProfilePage = true, // включён фильтр по URL
}) {
  try {
    if (onlyOnProfilePage && !isProfileFieldsPage()) return;

    injectStyles();

    // безопасно нормализуем image_set
    const IMAGES = Array.isArray(image_set) ? image_set : [];
    const hasImages = IMAGES.length > 0;

    // находим поле
    const input = resolveField(field);
    if (!input) { console.warn('[imagePicker] field not found'); return; }
    if (input.dataset.ipApplied === '1') return; // идемпотентно
    input.dataset.ipApplied = '1';

    // скрываем исходный input
    input.classList.add('ip-hidden');

    // создаём контейнер только если есть изображения
    let grid = null;
    if (hasImages) {
      const box = document.createElement('div');
      box.className = 'ip-box';
      // задаём переменные на контейнере (индивидуально на инстанс)
      box.style.setProperty('--ip-rows', String(rows));
      box.style.setProperty('--ip-size', `${size}px`);
      box.style.setProperty('--ip-gap',  `${gap}px`);

      const scroll = document.createElement('div');
      scroll.className = 'ip-scroll';
      const g = document.createElement('div');
      g.className = 'ip-grid';

      // вставляем после label (если есть) или после input
      const byFor = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
      const anchor = input.closest('label') || byFor || input;
      anchor.insertAdjacentElement('afterend', box);

      // клики не должны перехватываться родителями
      scroll.addEventListener('pointerdown', e => e.stopPropagation());
      scroll.addEventListener('click', e => e.stopPropagation());

      // рендер кнопок
      IMAGES.forEach(it => {
        const v = (it && it.value != null) ? String(it.value) : '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ip-btn';
        btn.dataset.v = v;

        const img = document.createElement('img');
        img.src = it.thumb;
        img.alt = '';
        img.loading = 'lazy';
        btn.appendChild(img);

        const onPick = (e) => { e.preventDefault(); e.stopPropagation(); setValue(v); };
        btn.addEventListener('pointerdown', onPick);
        btn.addEventListener('click', onPick);

        g.appendChild(btn);
      });

      scroll.appendChild(g);
      box.appendChild(scroll);
      grid = g;
    }

    // множество допустимых значений
    const allowed = new Set(IMAGES.map(i => (i && i.value != null ? String(i.value) : '')));

    // подсветка активной кнопки
    function highlight(v) {
      if (!grid) return;
      grid.querySelectorAll('.ip-btn').forEach(b => b.removeAttribute('selected'));
      const esc = (window.CSS && CSS.escape) ? CSS.escape(String(v)) : String(v);
      const btn = grid.querySelector(`.ip-btn[data-v="${esc}"]`);
      if (btn) btn.setAttribute('selected', '');
    }

    // установка значения (без рекурсии)
    let internal = false;
    function setValue(val) {
      const v = (val == null ? '' : String(val));
      if (input.value !== v) {
        internal = true;
        input.value = v;
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        internal = false;
      }
      highlight(v);
    }

    // инициализация значения
    const firstVal = hasImages ? (IMAGES[0].value == null ? '' : String(IMAGES[0].value)) : '';
    const current  = (input.value == null ? '' : String(input.value));
    let initial    = current;

    if (hasImages) {
      if (!allowed.has(current)) initial = required ? firstVal : '';
    } else {
      // нет изображений — храним пустую строку
      initial = '';
    }

    input.dataset.ipInitial = initial;
    setValue(initial);

    // синхронизация подсветки, если кто-то меняет поле извне
    if (!input.dataset.ipSynced) {
      input.addEventListener('input',  () => { if (!internal) highlight(input.value ?? ''); });
      input.addEventListener('change', () => { if (!internal) highlight(input.value ?? ''); });
      input.dataset.ipSynced = '1';
    }

    // валидация перед сабмитом: если значение не из набора — вернуть начальное
    const form = input.closest('form');
    if (form && !form.dataset.ipSubmitHooked) {
      form.addEventListener('submit', () => {
        const cur = (input.value == null ? '' : String(input.value));
        if (!hasImages) { setValue(''); return; }
        if (!allowed.has(cur)) {
          const fallback = input.dataset.ipInitial ?? (required ? firstVal : '');
          setValue(fallback);
        }
        // если required и почему-то пусто — перестрахуемся
        if (required && hasImages && (input.value === '')) setValue(firstVal);
      }, true);
      form.dataset.ipSubmitHooked = '1';
    }

    return {
      set: setValue,
      destroy: () => {
        input.classList.remove('ip-hidden');
        const box = input.nextElementSibling;
        if (box && box.classList.contains('ip-box')) box.remove();
        delete input.dataset.ipApplied;
        delete input.dataset.ipInitial;
      }
    };
  } catch (err) {
    console.error('[imagePicker] failed:', err);
  }
}
