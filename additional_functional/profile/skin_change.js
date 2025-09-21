/* ===== Константы пикера ===== */
const IP_ROWS = 1;       // сколько строк видно без скролла
const IP_SIZE = 44;      // размер кнопки-иконки (px)
const IP_GAP  = 8;       // зазор между кнопками (px)
const IP_REQUIRED = true; // выбор обязателен (если есть варианты)

/* ===== Служебные ===== */
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

const STYLE_ID = 'ip-style';
function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
    :root{
      --ip-rows:${IP_ROWS};
      --ip-size:${IP_SIZE}px;
      --ip-gap:${IP_GAP}px;
    }
    .ip-hidden{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;}
    .ip-box{position:relative;z-index:1000;display:block;max-width:100%;border:1px solid #ccc;border-radius:10px;background:#fff;padding:6px;}
    .ip-box,.ip-scroll,.ip-grid,.ip-btn,.ip-btn *{pointer-events:auto;}
    .ip-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;height: calc(var(--ip-rows) * var(--ip-size) + (var(--ip-rows) - 1) * var(--ip-gap));}
    .ip-grid{display:grid;grid-template-columns:repeat(auto-fill,var(--ip-size));gap:var(--ip-gap);align-content:start;}
    .ip-btn{width:var(--ip-size);height:var(--ip-size);border:2px solid #d0d0d0;border-radius:10px;background:#fff;padding:0;cursor:pointer;touch-action:manipulation;}
    .ip-btn[selected]{border-color:#0b74ff;box-shadow:0 0 0 3px rgba(11,116,255,.15);}
    .ip-btn img{width:100%;height:100%;display:block;object-fit:contain;}
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

/* ===== Основная функция ===== */
function applyImagePicker(image_set, fieldSuffix) {
  if (!isProfileFieldsPage()) return;
  injectStylesOnce();

  const IMAGES = Array.isArray(image_set) ? image_set : [];
  const hasImages = IMAGES.length > 0;

  const input = resolveFieldBySuffix(fieldSuffix);
  if (!input) { console.warn('[imagePicker] field not found:', fieldSuffix); return; }
  if (input.dataset.ipApplied === '1') return;
  input.dataset.ipApplied = '1';

  // прячем исходный input
  input.classList.add('ip-hidden');

  // допустимые значения
  const allowed = new Set(IMAGES.map(i => (i && i.value != null ? String(i.value) : '')));

  // контейнеры (UI рисуем только если есть изображения)
  let grid = null;
  if (hasImages) {
    const box = document.createElement('div');
    box.className = 'ip-box';
    const scroll = document.createElement('div');
    scroll.className = 'ip-scroll';
    const g = document.createElement('div');
    g.className = 'ip-grid';

    const byFor = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
    const anchor = input.closest('label') || byFor || input;
    anchor.insertAdjacentElement('afterend', box);

    scroll.addEventListener('pointerdown', e => e.stopPropagation());
    scroll.addEventListener('click', e => e.stopPropagation());

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

      const pick = (e) => { e.preventDefault(); e.stopPropagation(); setValue(v); };
      btn.addEventListener('pointerdown', pick);
      btn.addEventListener('click', pick);

      g.appendChild(btn);
    });

    scroll.appendChild(g);
    box.appendChild(scroll);
    grid = g;
  }

  // подсветка выбранной
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
      input.dispatchEvent(new Event('input',  { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      internal = false;
    }
    highlight(v);
  }

  // инициализация значения
  const firstVal = hasImages ? (IMAGES[0].value == null ? '' : String(IMAGES[0].value)) : '';
  const current  = (input.value == null ? '' : String(input.value));
  let initial    = current;

  if (hasImages) {
    if (!allowed.has(current)) initial = IP_REQUIRED ? firstVal : '';
  } else {
    initial = ''; // нет картинок — всегда пустая строка
  }

  input.dataset.ipInitial = initial;
  setValue(initial);

  // синхронизация подсветки при внешних изменениях
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
      if (IP_REQUIRED && hasImages && input.value === '') {
        setValue(firstVal);
      }
    }, true);
    form.dataset.ipSubmitHooked = '1';
  }

  // контроллер (по желанию)
  return {
    set: setValue,
    destroy: () => {
      input.classList.remove('ip-hidden');
      const box = input.nextElementSibling;
      if (box && box.classList.contains('ip-box')) box.remove();
      delete input.dataset.ipApplied;
      delete input.dataset.ipInitial;
      delete input.dataset.ipSynced;
    }
  };
}
