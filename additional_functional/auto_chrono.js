/* ============================================================
 * FMV — Автохронология
 * Кнопка в конце #p82 → пишет результат в #p83-content
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------------------- Конфиг ---------------------------- */
  const ENABLE_ON_TOPIC_ID = 13;       // только для этой темы
  const SOURCE_POST_ID     = 'p82';    // где читать вводные и ставить кнопку
  const OUTPUT_POST_ID     = 'p83';    // куда писать хронологию

  const WRAP_ID = 'fmv-chrono-inline';
  const BTN_ID  = 'fmv-chrono-inline-btn';
  const NOTE_ID = 'fmv-chrono-inline-note';

  /* ---------------------------- Utils ----------------------------- */
  const $    = (s, root=document) => root.querySelector(s);
  const $all = (s, root=document) => Array.from(root.querySelectorAll(s));
  const esc  = (s='') => s.replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
  const uniq = arr => Array.from(new Map(arr.map(x => [x.toLowerCase(), x])).values());
  const norm = s => s.trim().replace(/\s+/g,' ').toLowerCase();

  const MISS_STYLE = 'background:#ffe5e5;color:#900;padding:0 .25em;border-radius:4px;';

  function onRightTopic() {
    // id темы есть и в ссылке, и в data-атрибутах контейнера
    const byQS = location.search.match(/[?&]id=(\d+)/);
    const byAttr = $('#pun-viewtopic')?.getAttribute('data-topic-id');
    const val = Number(byQS?.[1] || byAttr || 0);
    return val === ENABLE_ON_TOPIC_ID;
  }

  /* --------------------- Разбор исходных данных ------------------- */
  function sourceBox() {
    return $(`#${CSS.escape(SOURCE_POST_ID)}-content`) ||
           $(`#${CSS.escape(SOURCE_POST_ID)} .post-content`);
  }

  function renderStatus(type, status) {
    const map = {
      on:       { word: 'active',   color: 'green'  },
      off:      { word: 'closed',   color: 'teal'   },
      archived: { word: 'archived', color: 'maroon' }
    };
    const st = map[status] || map.archived;
    const color = (type === 'personal') ? 'inherit' : st.color; // personal — без акцента
    return `${type} / <span style="color:${color}">${st.word}</span>`;
  }

  // Заголовок: "[дата] название темы"
  function renderHeader() {
    const topicTitle = $('#pun-main h1 span')?.textContent.trim()
                   || document.title.replace(/\s*\-.*$/, '').trim();
    const dateStr = $(`#${CSS.escape(SOURCE_POST_ID)} h3 a.permalink`)?.textContent.trim() || '';
    return `<p><strong>[${esc(dateStr)}] ${esc(topicTitle)}</strong></p>`;
  }

  function detectTypeAndStatus() {
    const raw = (sourceBox()?.textContent || '').toLowerCase();
    let type = 'common';
    if (/\bpersonal\b|персонал|личн/.test(raw)) type = 'personal';

    let status = 'on';
    if (/\bclosed\b|закрыт|off\b/.test(raw)) status = 'off';
    if (/\barchiv|архив/.test(raw)) status = 'archived';

    return { type, status };
  }

  // «заявленные участники»
  function collectDeclaredAuthors() {
    const box = sourceBox();
    if (!box) return [];
    // приоритет: data-атрибут
    const dataAttr = box.querySelector('[data-fmv-members]');
    if (dataAttr) {
      return uniq(
        dataAttr.getAttribute('data-fmv-members')
          .split(/[,;]+/).map(s => s.trim()).filter(Boolean)
      );
    }
    // эвристика по тексту
    const txt = box.textContent || '';
    const m = txt.match(/участники[^:—-]*[:—-]\s*([^\n]+)/i);
    if (m) {
      return uniq(
        m[1].split(/[,;]+/)
          .map(s => s.replace(/\(.*?\)|\[.*?\]/g,'').trim())
          .filter(Boolean)
      );
    }
    // ссылки внутри блока
    const links = $all('a', box).map(a => a.textContent.trim()).filter(Boolean);
    return uniq(links);
  }

  // Фактически отписавшиеся
  function collectActualAuthors() {
    const names = $all('.post .post-author .pa-author a')
      .map(a => a.textContent.trim())
      .filter(Boolean);
    return uniq(names);
  }

  // Локации
  function collectLocations() {
    const box = sourceBox();
    if (!box) return [];
    const dataAttr = box.querySelector('[data-fmv-locations]');
    if (dataAttr) {
      return uniq(
        dataAttr.getAttribute('data-fmv-locations')
          .split(/[,;]+/).map(s => s.trim()).filter(Boolean)
      );
    }
    const txt = box.textContent || '';
    const m = txt.match(/локац(?:ия|ии)[^:—-]*[:—-]\s*([^\n]+)/i);
    if (m) {
      return uniq(m[1].split(/[,;]+/).map(s => s.trim()).filter(Boolean));
    }
    return [];
  }

  /* ------------------------- Рендер блоков ------------------------- */
  function renderParticipantsBlock() {
    const declared = collectDeclaredAuthors();
    const actual   = collectActualAuthors();

    const declaredN = new Set(declared.map(norm));
    const actualN   = new Set(actual.map(norm));

    const notAnswered = declared.filter(d => !actualN.has(norm(d)));
    const extras      = actual.filter(a => !declaredN.has(norm(a)));

    const rows = [];
    rows.push(`<p><strong>Участники:</strong> ${declared.length
      ? esc(declared.join(', '))
      : `<span style="${MISS_STYLE}">не указаны</span>`}</p>`);

    rows.push(`<p><strong>Отписались:</strong> ${actual.length
      ? esc(actual.join(', '))
      : `<span style="${MISS_STYLE}">никто</span>`}</p>`);

    if (notAnswered.length) {
      rows.push(`<p><strong>Не отписались:</strong> <span style="${MISS_STYLE}">${esc(notAnswered.join(', '))}</span></p>`);
    }
    if (extras.length) {
      rows.push(`<p><strong>Лишние участники:</strong> <span style="${MISS_STYLE}">${esc(extras.join(', '))}</span></p>`);
    }
    return rows.join('\n');
  }

  function renderLocationsBlock() {
    const locs = collectLocations();
    return `<p><strong>Локации:</strong> ${locs.length
      ? esc(locs.join(', '))
      : `<span style="${MISS_STYLE}">не указаны</span>`}</p>`;
  }

  function buildChronologyHTML() {
    const { type, status } = detectTypeAndStatus();
    return [
      `<p><span style="display:block;text-align:center"><strong>Хронология</strong></span></p>`,
      renderHeader(),
      `<p>${renderStatus(type, status)}</p>`,
      renderLocationsBlock(),
      renderParticipantsBlock()
    ].join('\n');
  }

  /* ------------------ Кнопка в конце поста #p82 ------------------ */
  function mountInlineButton() {
    const host = $(`#${CSS.escape(SOURCE_POST_ID)} .post-box`);
    if (!host || document.getElementById(WRAP_ID)) return !!host;

    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    wrap.style.cssText = 'margin-top:10px;display:flex;gap:10px;align-items:center;';

    const btn = document.createElement('a');
    btn.id = BTN_ID;
    btn.href = 'javascript:void(0)';
    btn.className = 'button';
    btn.textContent = 'Собрать хронологию';

    const note = document.createElement('span');
    note.id = NOTE_ID;
    note.style.cssText = 'font-size:90%;opacity:.85;';

    wrap.appendChild(btn);
    wrap.appendChild(note);
    host.appendChild(wrap); // ← именно в КОНЕЦ #p82 .post-box

    btn.addEventListener('click', () => {
      note.textContent = 'Собираю…';
      const html = buildChronologyHTML();

      const out = $(`#${CSS.escape(OUTPUT_POST_ID)}-content`) ||
                  $(`#${CSS.escape(OUTPUT_POST_ID)} .post-content`);
      if (!out) {
        note.textContent = 'Не нашёл #p83-content';
        note.style.cssText += `background:#ffe5e5;color:#900;padding:0 .25em;border-radius:4px;`;
        return;
      }
      out.innerHTML = html;          // ← переписываем #p83 только ПО КЛИКУ
      note.textContent = 'Готово';
    });

    return true;
  }

  /* --------------------------- Инициализация --------------------------- */
  function init() {
    if (!onRightTopic()) return;
    // ставим кнопку сразу или через наблюдатель
    if (!mountInlineButton()) {
      const mo = new MutationObserver(() => {
        if (mountInlineButton()) mo.disconnect();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 10000);
    }
    // шорткат на всякий
    window.FMV_buildChronology = function () {
      const out = $(`#${CSS.escape(OUTPUT_POST_ID)}-content`) ||
                  $(`#${CSS.escape(OUTPUT_POST_ID)} .post-content`);
      if (out) out.innerHTML = buildChronologyHTML();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
