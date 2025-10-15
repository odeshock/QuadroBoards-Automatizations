(function () {
  // === ПУБЛИЧНАЯ ФУНКЦИЯ ==========================================
  // Рендерит указанные доп. поля как HTML (по номерам)
  window.renderExtraFieldsAsHTML = function renderExtraFieldsAsHTML(fields) {    
    // не трогаем форму редактирования доп. полей
    if (/\/profile\.php\b/.test(location.pathname) && /section=fields/.test(location.search)) return;

    const suffixes = normalize(fields);
    if (!suffixes.length) return;

    const decodeEntities = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
    const looksLikeHtml  = (s) => /<([a-zA-Z!\/?][^>]*)>/.test(s);

    function removeExtraBreaks(container){
      // <br> прямо внутри <a class="modal-link">
      container.querySelectorAll('a.modal-link').forEach(a=>{
        a.querySelectorAll(':scope > br').forEach(br=>br.remove());
      });
      // <br> верхнего уровня в самом контейнере значения
      container.querySelectorAll(':scope > br').forEach(br=>br.remove());
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
        const txt  = (node.textContent || '').trim();
        return html || txt;
      });
    }

    function renderOne(n) {
      const nodes = findTargets(n);
      nodes.forEach(target => {
        if (!target || target.dataset.htmlRendered === '1') return;

        const htmlNow = (target.innerHTML || '').trim();
        const textNow = (target.textContent || '').trim();
        if (!htmlNow && !textNow) return;

        const alreadyHtml = looksLikeHtml(htmlNow) && !htmlNow.includes('&lt;') && !htmlNow.includes('&gt;');

        if (alreadyHtml) {
          removeExtraBreaks(target);
          target.dataset.htmlRendered = '1';
          return;
        }

        const decoded = decodeEntities(htmlNow || textNow);
        if (decoded !== htmlNow || looksLikeHtml(decoded)) {
          target.innerHTML = decoded;
          removeExtraBreaks(target);
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
        const m1 = s.match(/(?:^|[-_])fld(\d+)$/i); if (m1){ out.add(m1[1]); return; } // "fld5"/"pa-fld5"
        const m2 = s.match(/^(\d+)\s*-\s*(\d+)$/);                                      // "5-8"
        if (m2) { const a=Math.min(+m2[1],+m2[2]), b=Math.max(+m2[1],+m2[2]); for(let i=a;i<=b;i++) out.add(String(i)); }
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
