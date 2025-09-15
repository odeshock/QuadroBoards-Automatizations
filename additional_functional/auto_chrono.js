/* ============================================================
 * FMV — Автохронология
 * Вариант: inline-кнопка в #p82 .post-box → пишет в #p83-content
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- настройки ---------- */
  const POST_WITH_BUTTON_ID = 'p82';     // откуда «смотрим» и куда ставим кнопку
  const OUTPUT_POST_ID      = 'p83';     // где перезаписываем контент хроной
  const BUTTON_ID           = 'fmv-chrono-btn';
  const NOTE_ID             = 'fmv-chrono-note';

  // «красный» акцент для пропусков / несостыковок
  const MISS_STYLE = 'background:#ffe5e5;color:#900;padding:0 .25em;border-radius:4px;';

  // статус окрашиваем, personal — без акцента
  function renderStatus(type, status) {
    const map = {
      on:       { word: 'active',  color: 'green'  },
      off:      { word: 'closed',  color: 'teal'   },
      archived: { word: 'archived',color: 'maroon' }
    };
    const st = map[status] || map.archived;
    const color = (type === 'personal') ? 'inherit' : st.color;
    return `[${type}] / <span style="color:${color}">${st.word}</span>`;
  }

  // заголовок темы: "[дата] название"
  function renderHeader() {
    const title = document.querySelector('#pun-main h1 span')?.textContent.trim()
                  || document.title.replace(/\s*\-.*$/, '').trim();
    const dateStr = document.querySelector(`#${CSS.escape(POST_WITH_BUTTON_ID)} h3 a.permalink`)?.textContent.trim()
                    || '';
    return `<p><strong>[${escapeHtml(dateStr)}] ${escapeHtml(title)}</strong></p>`;
  }

  // ===== helpers =======================================================
  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function escapeHtml(s=''){ return s.replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
  function uniq(arr){ return Array.from(new Map(arr.map(x=>[x.toLowerCase(), x])).values()); }
  const norm = s => s.trim().replace(/\s+/g,' ').toLowerCase();

  // Список авторов, реально писавших в теме
  function collectActualAuthors() {
    const names = $all('.post .post-author .pa-author a').map(a => a.textContent.trim()).filter(Boolean);
    return uniq(names);
  }

  // Попытка вытащить «заявленных участников»
  // 1) data-fmv-members="Имя1, Имя2"
  // 2) внутри #p82-content строка "участники:" или "участники —", затем перечисление
  // 3) ссылки в первом посте (fallback)
  function collectDeclaredAuthors() {
    const box = $(`#${CSS.escape(POST_WITH_BUTTON_ID)}-content`) || $(`#${CSS.escape(POST_WITH_BUTTON_ID)} .post-content`);
    if (!box) return [];

    const dataAttr = box.querySelector('[data-fmv-members]');
    if (dataAttr) {
      return uniq(
        dataAttr.getAttribute('data-fmv-members')
          .split(/[,;]+/).map(s => s.trim()).filter(Boolean)
      );
    }

    const text = box.textContent || '';
    const m = text.match(/участники[^:—-]*[:—-]\s*([^\n]+)/i);
    if (m) {
      return uniq(
        m[1].split(/[,;]+/).map(s => s.replace(/\(.*?\)|\[.*?\]/g,'').trim()).filter(Boolean)
      );
    }

    const links = $all('a', box).map(a => a.textContent.trim()).filter(Boolean);
    return uniq(links);
  }

  // Локации:
  // 1) data-fmv-locations="Гора; Пляж"
  // 2) «локации: ...» в первом посте
  function collectLocations() {
    const box = $(`#${CSS.escape(POST_WITH_BUTTON_ID)}-content`) || $(`#${CSS.escape(POST_WITH_BUTTON_ID)} .post-content`);
    if (!box) return [];
    const dataAttr = box.querySelector('[data-fmv-locations]');
    if (dataAttr) {
      return uniq(
        dataAttr.getAttribute('data-fmv-locations')
          .split(/[,;]+/).map(s => s.trim()).filter(Boolean)
      );
    }
    const txt = box.textContent || '';
    const m = txt.match(/локац(ия|ии)[^:—-]*[:—-]\s*([^\n]+)/i);
    if (m) {
      return uniq(
        m[2].split(/[,;]+/).map(s => s.trim()).filter(Boolean)
      );
    }
    return [];
  }

  // Тип и статус (очень «мягкие» эвристики)
  function detectTypeAndStatus() {
    const box = $(`#${CSS.escape(POST_WITH_BUTTON_ID)}-content`) || $(`#${CSS.escape(POST_WITH_BUTTON_ID)} .post-content`);
    const raw = (box?.textContent || '').toLowerCase();

    // type
    let type = 'common';
    if (/\bpersonal\b|\bперсонал|\bличн/.test(raw)) type = 'personal';

    // status
    let status = 'on';
    if (/\bзакрыт|\bclosed|\boff\b/.test(raw)) status = 'off';
    if (/\bархив|\barchive|\barchived/.test(raw)) status = 'archived';

    return { type, status };
  }

  // Сбор «красивых» блоков
  function renderParticipantsBlock() {
    const declared = collectDeclaredAuthors();
    const actual   = collectActualAuthors();

    const declaredN = new Set(declared.map(norm));
    const actualN   = new Set(actual.map(norm));

    const notAnswered = declared.filter(d => !actualN.has(norm(d)));
    const extras      = actual.filter(a => !declaredN.has(norm(a)));

    const rows = [];

    if (declared.length) {
      rows.push(`<p><strong>Участники:</strong> ${escapeHtml(declared.join(', '))}</p>`);
    } else {
      rows.push(`<p><strong>Участники:</strong> <span style="${MISS_STYLE}">не указаны</span></p>`);
    }

    rows.push(`<p><strong>Отписались:</strong> ${actual.length ? escapeHtml(actual.join(', ')) : '<span style="'+MISS_STYLE+'">никто</span>'}</p>`);

    if (notAnswered.length) {
      rows.push(`<p><strong>Не отписались:</strong> <span style="${MISS_STYLE}">${escapeHtml(notAnswered.join(', '))}</span></p>`);
    }

    if (extras.length) {
      rows.push(`<p><strong>Лишние участники:</strong> <span style="${MISS_STYLE}">${escapeHtml(extras.join(', '))}</span></p>`);
    }

    return rows.join('\n');
  }

  function renderLocationsBlock() {
    const locs = collectLocations();
    if (!locs.length) {
      return `<p><strong>Локации:</strong> <span style="${MISS_STYLE}">не указаны</span></p>`;
    }
    return `<p><strong>Локации:</strong> ${escapeHtml(locs.join(', '))}</p>`;
  }

  // Финальный HTML хронологии
  function buildChronologyHTML() {
    const { type, status } = detectTypeAndStatus();

    const parts = [];
    parts.push(`<p><span style="display:block;text-align:center"><strong>Хронология</strong></span></p>`);
    parts.push(renderHeader());
    parts.push(`<p>${renderStatus(type, status)}</p>`);
    parts.push(renderLocationsBlock());
    parts.push(renderParticipantsBlock());

    return parts.join('\n');
  }

  /* ---------- кнопка и действия ---------- */
  function placeInlineButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const targetPostBox = $(`#${CSS.escape(POST_WITH_BUTTON_ID)} .post-box`);
    if (!targetPostBox) return false;

    const wrap = document.createElement('div');
    wrap.style.marginTop = '10px';

    const btn = document.createElement('a');
    btn.id = BUTTON_ID;
    btn.href = 'javascript://';
    btn.className = 'button';
    btn.textContent = 'Собрать хронологию';
    btn.style.display = 'inline-block';

    const note = document.createElement('span');
    note.id = NOTE_ID;
    note.style.cssText = 'font-size:90%;opacity:.8;margin-left:.75em;';

    wrap.appendChild(btn);
    wrap.appendChild(note);
    targetPostBox.appendChild(wrap);

    btn.addEventListener('click', onBuildClick);
    console.log('[FMV] Нажата инлайн-кнопка');
    return true;
  }

  function onBuildClick() {
    try {
      const html = buildChronologyHTML();
      const out = $(`#${CSS.escape(OUTPUT_POST_ID)}-content`) || $(`#${CSS.escape(OUTPUT_POST_ID)} .post-content`);
      if (!out) {
        alert('Не нашёл контейнер для вывода (#'+OUTPUT_POST_ID+'-content).');
        return;
      }
      out.innerHTML = html;
      const note = document.getElementById(NOTE_ID);
      if (note) note.textContent = ' — обновлено ' + new Date().toLocaleString();
    } catch (err) {
      console.warn('[FMV] Ошибка сборки:', err);
      alert('Ошибка при сборке хронологии. Подробности в консоли.');
    }
  }

  // даём внешний хук (на всякий случай)
  window.FMV_buildChronology = function () {
    onBuildClick();
  };

  /* ---------- инициализация ---------- */
  function init() {
    const ok = placeInlineButton();
    if (!ok) {
      // если вдруг не смогли — тихо ничего не делаем
      console.warn('[FMV] Не удалось поставить инлайн-кнопку (не нашёл .post-box в #'+POST_WITH_BUTTON_ID+')');
    } else {
      console.log('[FMV] Кнопка хронологии добавлена в #'+POST_WITH_BUTTON_ID+' .post-box');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
