(function () {
  const DEBUG = true;
  const log = (...a) => DEBUG && console.log('[profile_fields_as_html]', ...a);

  // === ПУБЛИЧНАЯ ФУНКЦИЯ ==========================================
  // Рендерит указанные доп. поля как HTML (по номерам)
  window.renderExtraFieldsAsHTML = function renderExtraFieldsAsHTML(fields) {
    // не трогаем форму редактирования доп. полей
    if (/\/profile\.php\b/.test(location.pathname) && /section=fields/.test(location.search)) return;

    const suffixes = normalize(fields);
    if (!suffixes.length) return;

    const decodeEntities = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
    const looksLikeHtml = (s) => /<([a-zA-Z!\/?][^>]*)>/.test(s);

    function removeExtraBreaks(container) {
      // <br> прямо внутри <a class="modal-link">
      container.querySelectorAll('a.modal-link').forEach(a => {
        a.querySelectorAll(':scope > br').forEach(br => br.remove());
      });
      // <br> верхнего уровня в самом контейнере значения
      container.querySelectorAll(':scope > br').forEach(br => br.remove());
    }

    function findTargets(n) {
      const set = new Set();
      const sels = [
        `.pa-fld${n}`,
        `[class~="pa-fld${n}"]`,
        `[class*="fld${n}"]`,
        `[id*="fld${n}"]`,
        `[data-fld="${n}"]`,
      ];
      sels.forEach(sel => document.querySelectorAll(sel).forEach(el => set.add(el)));

      const targets = [];
      [...set].forEach(box => {
        const inner = box.querySelector?.('.pa-value, .field-value, .value') || null;
        targets.push(inner || box);
      });

      return targets.filter(node => {
        if (!node) return false;
        const html = (node.innerHTML || '').trim();
        const txt = (node.textContent || '').trim();
        return html || txt;
      });
    }

    function renderOne(n) {
      const nodes = findTargets(n);
      log(`Обработка поля ${n}, найдено узлов:`, nodes.length);
      nodes.forEach(target => {
        if (!target || target.dataset.htmlRendered === '1') return;

        const htmlNow = (target.innerHTML || '').trim();
        const textNow = (target.textContent || '').trim();
        if (!htmlNow && !textNow) return;

        log(`Поле ${n}, исходный HTML:`, htmlNow);
        log(`Поле ${n}, текст:`, textNow);

        // Сначала декодируем HTML-сущности
        const decoded = decodeEntities(htmlNow || textNow);
        log(`Поле ${n}, после декодирования:`, decoded);
        log(`Поле ${n}, похоже на HTML?`, looksLikeHtml(decoded));

        // Проверяем, изменилось ли содержимое или есть ли HTML-теги
        if (decoded !== htmlNow || looksLikeHtml(decoded)) {
          log(`Поле ${n}, применяем изменения`);
          target.innerHTML = decoded;
          removeExtraBreaks(target);
          target.dataset.htmlRendered = '1';
        } else {
          // Если ничего не изменилось, всё равно помечаем как обработанное
          log(`Поле ${n}, ничего не изменилось`);
          target.dataset.htmlRendered = '1';
        }
      });
    }

    // первичный прогон
    suffixes.forEach(renderOne);

    // если DOM подгружается — дорисуем, повторно не трогаем помеченные
    const mo = new MutationObserver(() => suffixes.forEach(renderOne));
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // ——— утилита нормализации входа
    function normalize(list) {
      const out = new Set();
      (Array.isArray(list) ? list : [list]).forEach(item => {
        const s = String(item).trim();
        if (/^\d+$/.test(s)) { out.add(s); return; }                                   // "5"
        const m1 = s.match(/(?:^|[-_])fld(\d+)$/i); if (m1) { out.add(m1[1]); return; } // "fld5"/"pa-fld5"
        const m2 = s.match(/^(\d+)\s*-\s*(\d+)$/);                                      // "5-8"
        if (m2) { const a = Math.min(+m2[1], +m2[2]), b = Math.max(+m2[1], +m2[2]); for (let i = a; i <= b; i++) out.add(String(i)); }
      });
      return [...out];
    }
  };

  // === АВТОЗАПУСК ОТ ГЛОБАЛЬНОГО МАССИВА ==========================
  // Если window.FIELDS_WITH_HTML существует и это непустой список — запускаем.
  // Если не существует — считаем пустым и ничего не делаем.
  const _raw = window.FIELDS_WITH_HTML;
  const _list =
    Array.isArray(_raw) ? _raw :
      (typeof _raw === 'string' && _raw.trim() ? [_raw.trim()] : []);

  if (_list.length) {
    window.renderExtraFieldsAsHTML(_list);
  }
})();
