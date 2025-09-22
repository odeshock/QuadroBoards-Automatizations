// create_choice_panel.js
// Панель выбора с библиотекой/выбранными и билдером HTML
(function () {
  'use strict';

  if (window.createChoicePanel) return;

  /**
   * ===== Вспом. утилиты =====
   */
  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  const escapeHtml = (s) => String(s || '').replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])
  );

  /**
   * ===== ТВОЯ РАБОЧАЯ ФУНКЦИЯ (с 1 защитой) =====
   * - снимает любой title у <div class="item"...>
   * - добавляет title заново только если текст не пуст
   * - обновляет <wrds> содержимым .ufo-text-edit (если введено)
   */
  function buildSelectedInnerHTML(row, html, opts = {}) {
    // защита от пустого row
    if (!row || typeof row.querySelector !== 'function') return String(html || '');

    const ATTR = (opts.editableAttr || 'title');

    // 1) достаём введённый заголовок из contenteditable
    const ed = row.querySelector('.ufo-title-edit');

    // берём innerHTML и жёстко чистим всё «невидимое»
    const rawTitle = ed ? ed.innerHTML : '';
    const cleanTitle = String(rawTitle)
      .replace(/<br\s*\/?>/gi, '\n')                        // <br> -> перенос строки
      .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '') // NBSP и zero-width
      .replace(/\s+/g, ' ')                                  // схлопываем пробелы
      .trim();

    // 2) убираем существующий title где бы он ни встретился
    function stripAttr(h /* , attrName */) {
      h = String(h || '');
      // у opening-тэга .item (самый частый случай)
      h = h.replace(/(<div\s+class="item"\b[^>]*?)\s+title="[^"]*"/i, '$1');
      // на всякий случай снимем у любых тегов, если вдруг где-то ещё всплыло
      h = h.replace(/\s+title="[^"]*"/gi, '');
      return h;
    }

    // 3) добавляем title ТОЛЬКО если после чистки он не пуст
    function addAttrToItem(h, attrName, value) {
      const safe = String(value).replace(/"/g, '&quot;');
      return h.replace(/(<div\s+class="item"\b)/i, `$1 ${attrName}="${safe}"`);
    }

    // сначала всегда снимаем дефолтный title из шаблона библиотеки
    let out = stripAttr(String(html || ''));

    // если пользователь реально что-то ввёл — ставим title заново
    if (cleanTitle) {
      out = addAttrToItem(out, ATTR, cleanTitle);
    }

    // 4) (опционально) если у вас есть поле текста .ufo-text-edit — подставьте его внутрь wrds/подписи
    const edText = row.querySelector('.ufo-text-edit');
    if (edText) {
      const rawText = edText.innerHTML || edText.textContent || '';
      const cleanText = String(rawText)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/\s+$/g, '')
        .trim();

      // пример: вставляем в <wrds>…</wrds> если такой контейнер есть
      if (cleanText) {
        if (/<wrds>[\s\S]*?<\/wrds>/i.test(out)) {
          out = out.replace(/<wrds>[\s\S]*?<\/wrds>/i, `<wrds>${cleanText}</wrds>`);
        }
      } else {
        // если пусто — не затираем существующее из библиотеки; оставляем как есть
        // (если нужно наоборот — раскомментируй строку ниже)
        // out = out.replace(/<wrds>[\s\S]*?<\/wrds>/i, '<wrds></wrds>');
      }
    }

    return out;
  }

  /**
   * ====== ГЛАВНАЯ ФУНКЦИЯ ПАНЕЛИ ======
   * opts:
   *  - mount: Element   — куда рендерить панель
   *  - title: string    — заголовок секции (например, "Плашки")
   *  - library: [{id, html}] — библиотека карточек
   *  - targetClass: string   — куда вставлять выбранные (по умолчанию '_plashka')
   *  - editableAttr: string  — редактируемый атрибут (по умолчанию 'title')
   */
  function createChoicePanel(opts = {}) {
    const mount = opts.mount || document.body;
    const title = opts.title || 'Плашки';
    const targetClass = opts.targetClass || '_plashka';
    const editableAttr = opts.editableAttr || 'title';
    const library = Array.isArray(opts.library) ? opts.library : [];

    // корень панели
    const panelEl = el(`
      <section class="ufo-panel" data-target-class="${escapeHtml(targetClass)}" style="margin:16px 0">
        <h3 style="margin:0 0 8px 0;font-size:18px">${escapeHtml(title)}</h3>
        <div class="ufo-lib" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"></div>
        <h4 style="margin:12px 0 6px 0;font-weight:600">Выбранные (сверху — новее)</h4>
        <div class="ufo-selected" style="display:flex;flex-direction:column;gap:8px"></div>
      </section>
    `);

    const libBox = panelEl.querySelector('.ufo-lib');
    const selBox = panelEl.querySelector('.ufo-selected');

    // отрисуем библиотеку
    library.forEach((item) => {
      const card = el(`
        <div class="ufo-lib-item" data-id="${escapeHtml(item.id)}" style="border:1px solid #e5e7eb;border-radius:10px;padding:8px;display:flex;gap:8px;align-items:center">
          <div class="ufo-thumb" style="flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${item.html}</div>
          <button type="button" class="ufo-add" style="flex:0 0 auto;padding:6px 10px;border:1px solid #d0d4dd;border-radius:8px;background:#f8fafc;cursor:pointer">Добавить ↑</button>
        </div>
      `);

      card.querySelector('.ufo-add').addEventListener('click', () => {
        // создаём строку «Выбранного»
        const row = el(`
          <div class="ufo-row" data-id="${escapeHtml(item.id)}" style="border:1px dashed #d1d5db;border-radius:10px;padding:8px">
            <div style="font-size:12px;opacity:.6;margin-bottom:4px">#${escapeHtml(item.id)}</div>
            <div class="ufo-title-edit" contenteditable="true" style="min-height:20px;padding:6px 8px;border:1px solid #eee;border-radius:8px;background:#fff" placeholder="Заголовок (опционально)"></div>
            <div class="ufo-text-edit" contenteditable="true" style="min-height:20px;margin-top:6px;padding:6px 8px;border:1px dashed #eee;border-radius:8px;background:#fffdf7" placeholder="Текст (опционально)"></div>
          </div>
        `);

        // КЛЮЧЕВОЕ: кэшируем исходник карточки и id в самой строке
        row.dataset.srcId = String(item.id);
        row.dataset.html  = String(item.html);

        selBox.prepend(row);
      });

      libBox.appendChild(card);
    });

    /**
     * ВОЗВРАЩАЕМЫЙ builder(fullHtml):
     * - собирает выбранные из `selBox`
     * - базовый HTML карточки берёт из row.dataset.html (или из library по id)
     * - вставляет результат в якорь <div class="targetClass">...</div> через DOM
     */
    function builder(fullHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(fullHtml || ''), 'text/html');

      // 1) находим/создаём якорь
      let anchor = doc.querySelector('.' + targetClass);
      if (!anchor) {
        anchor = doc.createElement('div');
        anchor.className = targetClass;
        (doc.body || doc.documentElement).appendChild(anchor);
      }

      // 2) соберём выбранные строки
      const rows = Array.from(selBox.querySelectorAll('.ufo-row'));

      // словарь библиотеки по id — бэкап, если вдруг dataset.html пуст
      const libById = new Map(library.map(x => [String(x.id), String(x.html)]));

      // 3) соберём карточки
      const parts = rows.map((row) => {
        const id = String(row?.dataset?.srcId || row?.getAttribute('data-id') || '');
        const baseHtml = row?.dataset?.html ?? libById.get(id) ?? '';
        return buildSelectedInnerHTML(row, baseHtml, { editableAttr });
      }).filter(s => s && s.trim());

      // 4) подменяем содержимое якоря
      anchor.innerHTML = parts.join('\n');

      // 5) возвращаем итоговый HTML
      return doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML;
    }

    // смонтировать панель
    if (mount) mount.appendChild(panelEl);

    // публичное API
    return {
      panelEl,
      builder,
    };
  }

  // экспорт
  window.createChoicePanel = createChoicePanel;
  window.buildSelectedInnerHTML = buildSelectedInnerHTML; // если нужно отдельно
})();
