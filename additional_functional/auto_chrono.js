/* ===================== FMV — кнопка сборки хронологии ===================== */
(function () {
  'use strict';

  /* ---------------------------- Конфигурация ---------------------------- */
  // На какой теме активировать
  const ENABLE_ON_TOPIC_ID = 13;

  // Где рисуем инлайн-кнопку
  const TARGET_POST_ID = 'p82'; // пост с кнопкой
  const TARGET_SELECTOR = `#${TARGET_POST_ID} .post-box`;

  // id-шники создаваемых элементов
  const WRAP_ID = 'fmv-chrono-inline';
  const BTN_ID  = 'fmv-chrono-inline-btn';
  const NOTE_ID = 'fmv-chrono-inline-note';

  // Резервная (плавающая) кнопка
  const FLOAT_ID = 'fmv-chrono-float-btn';

  /* ------------------------------ Утилиты ------------------------------- */
  const log  = (...a) => console.log('[FMV]', ...a);
  const warn = (...a) => console.warn('[FMV]', ...a);

  // Проверяем, что мы на нужной теме
  function onRightTopic() {
    const m = location.search.match(/[?&]id=(\d+)/);
    return m && Number(m[1]) === ENABLE_ON_TOPIC_ID;
  }

  // Универсальный вызов сборки (ищем знакомые entrypoints)
  function invokeBuild(opts) {
    const fn =
      window.FMV_buildChronology ||
      window.FMV?.buildChronology ||
      window.FMV?.build ||
      window.buildChronology ||
      window.handleBuild;

    if (typeof fn === 'function') {
      try {
        fn(opts || {});
        return true;
      } catch (e) {
        warn('Ошибка в функции сборки:', e);
      }
    } else {
      warn('Функция сборки не найдена (ожидали FMV_buildChronology)');
    }
    return false;
  }

  // Ставим стили для плавающей кнопки и заметок
  function ensureStyles() {
    if (document.getElementById('fmv-chrono-styles')) return;
    const css = `
      #${FLOAT_ID}{
        position:fixed; right:16px; bottom:16px; z-index:9999;
        padding:.55em .9em; border-radius:6px; cursor:pointer;
        background:#556B2F; color:#fff; font:600 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        box-shadow:0 6px 20px rgba(0,0,0,.2); opacity:.92;
      }
      #${FLOAT_ID}:hover{ opacity:1; filter:brightness(1.05); }
      #${WRAP_ID}{ margin:8px 0 0; display:flex; gap:10px; align-items:center; }
      #${NOTE_ID}{ font-size:90%; opacity:.85; }
      .fmv-note-bad{
        background: rgba(200,0,0,.14);
        padding: 2px 6px; border-radius: 4px;
      }
    `.trim();
    const style = document.createElement('style');
    style.id = 'fmv-chrono-styles';
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  /* ----------------------- Инлайн-кнопка в посте ------------------------ */
  function mountInlineButton() {
    const host = document.querySelector(TARGET_SELECTOR);
    if (!host) return false;

    if (document.getElementById(WRAP_ID)) return true; // уже стоит

    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;

    const btn = document.createElement('a');
    btn.id = BTN_ID;
    btn.href = 'javascript:void(0)';
    btn.className = 'button';
    btn.textContent = 'Собрать хронологию';
    btn.setAttribute('data-fmv-chrono-trigger', 'inline');

    const note = document.createElement('span');
    note.id = NOTE_ID;
    note.setAttribute('data-fmv-chrono-note', 'inline');

    wrap.appendChild(btn);
    wrap.appendChild(note);
    host.appendChild(wrap);

    btn.addEventListener('click', () => {
      log('Нажата инлайн-кнопка');
      note.textContent = 'Собираю…';
      note.classList.remove('fmv-note-bad');

      const ok = invokeBuild({ buttonEl: btn, noteEl: note });
      if (!ok) {
        note.textContent = 'Скрипт автохронологии не загружен';
        note.classList.add('fmv-note-bad');
      }
    });

    log('Инлайн-кнопка добавлена в', TARGET_SELECTOR);
    return true;
  }

  /* ---------------------- Резервная плавающая кнопка -------------------- */
  function mountFloatButton() {
    if (document.getElementById(FLOAT_ID)) return true;

    const b = document.createElement('button');
    b.id = FLOAT_ID;
    b.type = 'button';
    b.textContent = 'Собрать хронологию';
    document.body.appendChild(b);

    b.addEventListener('click', () => {
      log('Нажата плавающая кнопка');
      // Попробуем найти/создать заметку от инлайн-кнопки (если есть)
      const note = document.getElementById(NOTE_ID);
      if (note) {
        note.textContent = 'Собираю…';
        note.classList.remove('fmv-note-bad');
      }
      const ok = invokeBuild({ buttonEl: b, noteEl: note || null });
      if (!ok) {
        // Покажем подсказку прямо в кнопке
        b.textContent = 'Не найден FMV_buildChronology';
        setTimeout(() => (b.textContent = 'Собрать хронологию'), 2500);
      }
    });

    log('Резервная кнопка поставлена (правый нижний угол)');
    return true;
  }

  /* ----------------------------- Инициализация -------------------------- */
  function init() {
    if (!onRightTopic()) return;

    ensureStyles();

    // 1) Пробуем поставить инлайн-кнопку сразу
    const okInline = mountInlineButton();
    if (!okInline) {
      log('Инлайн-хост не найден — ждём DOM через MutationObserver');
      const mo = new MutationObserver(() => {
        if (mountInlineButton()) mo.disconnect();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      // Через 2 сек. подстрахуемся плавучей кнопкой
      setTimeout(() => {
        if (!document.getElementById(WRAP_ID)) {
          log('Внешняя кнопка не найдена — включаю резервную');
          mountFloatButton();
        }
      }, 2000);
      // Отрубим наблюдатель через 10 сек. на всякий
      setTimeout(() => mo.disconnect(), 10000);
    } else {
      log('Внешняя кнопка установлена');
    }

    // На всякий случай опубликуем шорткат в консоли
    window.FMV_buildNow = () => invokeBuild({});
    log('Доступно window.FMV_buildNow()');
  }

  // DOM готов?
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
