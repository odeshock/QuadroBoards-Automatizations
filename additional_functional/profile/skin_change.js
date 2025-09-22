(() => {
  /* ================== КОНСТАНТЫ ================== */
  const IP_ROWS = 1;
  const IP_GAP  = 8;
  const IP_REQUIRED = true;
  const FREEZE_SECONDS = 60;

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

  const STYLE_ID = 'ip-style-registry';
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
      .ip-slot *{pointer-events:none;}

      #ip-freeze-overlay{
        position:fixed; inset:0; background:rgba(0,0,0,.6); color:#fff; z-index:999999;
        display:flex; align-items:center; justify-content:center; text-align:center; font-family:system-ui,sans-serif;
      }
      #ip-freeze-overlay .ip-box{
        background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.25); padding:24px 28px; border-radius:12px;
        max-width:min(90vw,680px); box-shadow:0 10px 30px rgba(0,0,0,.45);
      }
      #ip-freeze-overlay h2{margin:0 0 6px; font-size:22px; font-weight:700}
      #ip-freeze-overlay p{margin:0 0 12px; opacity:.9}
      #ip-freeze-overlay .ip-count{font-size:28px; font-variant-numeric:tabular-nums}
    `;
    document.head.appendChild(st);
  }

  const FORM_STATE = new WeakMap(); // form -> { entries: Array<RegistryEntry>, hooked: true }

  const log = (step, value) => console.log(`[imagePicker] ${step}:`, value);

  function resolveFieldBySuffix(suffix) {
    const id = `fld${String(suffix)}`;
    const name = `form[fld${String(suffix)}]`;
    return (
      document.querySelector(`#${CSS.escape(id)}[name="${name}"][type="text"]`) ||
      document.getElementById(id) ||
      document.querySelector(`input[name="${name}"]`)
    );
  }

  // загрузочная нормализация a.modal-link: оставляем ТОЛЬКО class и style
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

  // перед сохранением: к каждой a.modal-link добавить data-reveal-id="character" и id="usrN"
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

  function createThumbSlot(htmlOrUrl) {
    const slot = document.createElement('div');
    slot.className = 'ip-slot';
    const raw = String(htmlOrUrl ?? '').trim();
    if (!raw) return slot;
    const t = document.createElement('template'); t.innerHTML = raw;
    if (t.content.querySelector('*')) slot.appendChild(t.content.cloneNode(true));
    else { const img = document.createElement('img'); img.src = raw; img.alt=''; img.loading='lazy'; slot.appendChild(img); }
    return slot;
  }

  function keyFor(str) { const s=String(str??''); let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i); return 'k'+(h>>>0).toString(36); }

  function freezeThenSubmit(form, nativeSubmit, seconds, snapshot) {
    if (form.dataset.ipFreezing === '1') return;
    form.dataset.ipFreezing = '1';
    const overlay = document.createElement('div');
    overlay.id = 'ip-freeze-overlay';
    overlay.innerHTML = `
      <div class="ip-box">
        <h2>Пауза перед отправкой</h2>
        <p>Смотрим консоль: значения подготовлены. Автоподтверждение через <span id="ip-freeze-left">${seconds}</span> c.</p>
        <div class="ip-count"></div>
      </div>`;
    document.body.appendChild(overlay);
    log('freeze:start', snapshot);

    let left = seconds;
    const leftEl = overlay.querySelector('#ip-freeze-left');
    const t = setInterval(() => {
      left = Math.max(0, left-1);
      if (leftEl) leftEl.textContent = String(left);
      log('freeze:tick', left);
      if (left <= 0) {
        clearInterval(t);
        overlay.remove();
        delete form.dataset.ipFreezing;
        form.dataset.ipResuming = '1';
        log('freeze:end -> submit', true);
        nativeSubmit.call(form);
        setTimeout(()=>{ delete form.dataset.ipResuming; },0);
      }
    },1000);
  }

  /* ================== ОСНОВНАЯ ФУНКЦИЯ ==================
     image_set: массив СТРОК (HTML или URL)
     fieldSuffix: '5' → fld5 / form[fld5]
     opts: { btnWidth?: number, btnHeight?: number, gridColSize?: number, modalLinkMode?: boolean }
  */
  function applyImagePicker(image_set, fieldSuffix, opts = {}) {
    if (!isProfileFieldsPage()) { log('abort:not-profile-fields-page', location.href); return; }
    injectStylesOnce();

    const modalLinkMode = !!opts.modalLinkMode;
    log('init:modalLinkMode', modalLinkMode);

    const RAW = Array.isArray(image_set) ? image_set : [];
    const ITEMS = RAW.map(s => String(s ?? ''));
    log('init:image_set.count', ITEMS.length);

    const input = resolveFieldBySuffix(fieldSuffix);
    if (!input) { log('abort:field-not-found', fieldSuffix); return; }

    log('init:input.original', input.value);

    // размеры
    const w = Number.isFinite(opts.btnWidth)  ? Math.max(1, opts.btnWidth)  : 44;
    const h = Number.isFinite(opts.btnHeight) ? Math.max(1, opts.btnHeight) : 44;
    const col = Number.isFinite(opts.gridColSize) ? Math.max(1, opts.gridColSize) : w;
    log('init:sizes', { w, h, col });

    input.classList.add('ip-hidden');

    // нормализованные строки
    const NORMS = ITEMS.map(v => modalLinkMode ? normalizeModalLinkAttrs(v) : v);
    const allowed = new Set(NORMS);
    const keyByNorm = new Map(NORMS.map(n => [n, keyFor(n)]));

    const currentNorm = modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '');
    log('init:input.normalized', currentNorm);

    // UI
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

      scroll.addEventListener('pointerdown', e => e.stopPropagation());
      scroll.addEventListener('click', e => e.stopPropagation());

      NORMS.forEach((norm, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'ip-btn'; btn.dataset.key = keyByNorm.get(norm);
        const display = modalLinkMode ? norm : ITEMS[idx];
        btn.appendChild(createThumbSlot(display));
        const pick = (e) => { e.preventDefault(); e.stopPropagation(); log(`pick:requested[fld${fieldSuffix}]`, norm); setValue(norm); };
        btn.addEventListener('pointerdown', pick);
        btn.addEventListener('click', pick);
        g.appendChild(btn);
      });

      scroll.appendChild(g);
      box.appendChild(scroll);
      grid = g;
      log('ui:built', { items: ITEMS.length, field:`fld${fieldSuffix}` });
    } else {
      log('ui:skipped-empty-image_set', { field:`fld${fieldSuffix}` });
    }

    function highlight(normStr) {
      if (!grid) return;
      const key = keyByNorm.get(String(normStr)) || '';
      grid.querySelectorAll('.ip-btn').forEach(b => b.removeAttribute('selected'));
      if (key) {
        const btn = grid.querySelector(`.ip-btn[data-key="${key}"]`);
        if (btn) btn.setAttribute('selected', '');
      }
    }

    // лог внешних изменений value
    input.addEventListener('input',  () => log(`external:input[fld${fieldSuffix}]`, input.value));
    input.addEventListener('change', () => log(`external:change[fld${fieldSuffix}]`, input.value));

    let internal = false;
    function setValue(normVal) {
      const v = String(normVal ?? '');
      log(`setValue:before[fld${fieldSuffix}]`, v);
      if (input.value !== v) {
        internal = true;
        input.value = v;
        input.dispatchEvent(new Event('input',  { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
        internal = false;
      }
      highlight(v);
      log(`setValue:after[fld${fieldSuffix}]`, input.value);
    }

    // инициализация выбранного
    const firstNorm   = NORMS[0] || '';
    const initialNorm = ITEMS.length
      ? (allowed.has(currentNorm) ? currentNorm : (IP_REQUIRED ? firstNorm : ''))
      : '';
    input.dataset.ipInitial = initialNorm;
    log(`init:initialNorm[fld${fieldSuffix}]`, initialNorm);
    setValue(initialNorm);

    /* ===== РЕЕСТР ФОРМЫ: регистрируем текущее поле ===== */
    const form = input.closest('form');
    if (!form) { log(`warn:no-form-for[fld${fieldSuffix}]`, true); return { set: setValue }; }

    let state = FORM_STATE.get(form);
    if (!state) {
      state = { entries: [], hooked: false };
      FORM_STATE.set(form, state);
    }

    // фабрика подготовки для КОНКРЕТНОГО поля
    const prepareOne = () => {
      let curNorm = modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '');
      log(`prepare:before-validate[fld${fieldSuffix}]`, curNorm);

      if (!ITEMS.length) {
        const preparedEmpty = modalLinkMode ? prepareModalLinkAttrs('') : '';
        input.value = preparedEmpty;
        log(`prepare:empty-image-set[fld${fieldSuffix}]`, input.value);
        return preparedEmpty;
      }

      if (!allowed.has(curNorm)) {
        const fallback = input.dataset.ipInitial ?? (IP_REQUIRED ? firstNorm : '');
        curNorm = String(fallback);
        log(`prepare:apply-fallback[fld${fieldSuffix}]`, curNorm);
        setValue(curNorm);
      }

      if (modalLinkMode) {
        const prepared = prepareModalLinkAttrs(curNorm);
        input.value = prepared;
        log(`prepare:final[fld${fieldSuffix}]`, input.value);
        return prepared;
      } else {
        input.value = curNorm;
        log(`prepare:final(no-modal-mode)[fld${fieldSuffix}]`, input.value);
        return curNorm;
      }
    };

    // кладём запись в реестр (одна на поле)
    state.entries.push({ input, fieldSuffix, prepareOne });

    // навешиваем слушатели на ФОРМУ — ОДИН раз на форму
    if (!state.hooked) {
      state.hooked = true;
      const nativeSubmit = form.submit;

      // вспомогательная: прогнать подготовку по всем полям формы
      const prepareAll = () => {
        const snapshot = {};
        state.entries.forEach(({ fieldSuffix, prepareOne }) => {
          snapshot[`fld${fieldSuffix}`] = prepareOne();
        });
        return snapshot;
      };

      form.addEventListener('submit', (e) => {
        if (form.dataset.ipResuming === '1') { log('submit:resume-pass', true); return; }
        e.preventDefault();
        const snap = prepareAll();
        freezeThenSubmit(form, nativeSubmit, FREEZE_SECONDS, snap);
      }, true);

      form.addEventListener('formdata', (e) => {
        const snap = prepareAll();
        state.entries.forEach(({ input, fieldSuffix }) => {
          try {
            const name = input.name || `form[fld${fieldSuffix}]`;
            e.formData.set(name, input.value);
            log(`formdata:set[fld${fieldSuffix}]`, { name, value: input.value });
          } catch(err) { console.warn('[imagePicker] formdata.set failed:', err); }
        });
        log('formdata:snapshot', snap);
      });

      form.submit = function(...args) {
        if (form.dataset.ipResuming === '1') return nativeSubmit.apply(this, args);
        const snap = prepareAll();
        freezeThenSubmit(form, nativeSubmit, FREEZE_SECONDS, snap);
      };

      form.querySelectorAll('button[type="submit"],input[type="submit"]').forEach(el => {
        el.addEventListener('click', () => {
          const snap = prepareAll();
          log('click:submit:prepared-snapshot', snap);
        }, { capture: true });
      });
    }

    return { set: setValue };
  }

  // экспорт
  window.applyImagePicker = applyImagePicker;
})();
