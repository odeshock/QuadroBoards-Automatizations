/* ===================== FMV — автохронология (инлайн-кнопка + сборка) ===================== */
(function () {
  'use strict';

  /* --------------------------------- Конфиг --------------------------------- */
  const ENABLE_ON_TOPIC_ID = 13;              // на какой теме активировать
  const BTN_POST_ID        = 'p82';           // где рисовать кнопку
  const OUT_POST_ID        = 'p83';           // куда вставлять результат
  const BTN_HOST_SEL       = `#${BTN_POST_ID} .post-box`;
  const OUT_HOST_SEL       = `#${OUT_POST_ID}-content`;

  // Если укажешь список участников глобально, скрипт его подхватит:
  // window.FMV_PARTICIPANTS = { "selina moore": "/profile.php?id=4", ... }
  // Можно также положить JSON в <script id="fmv-chrono-participants" type="application/json">{...}</script>
  const MISS_STYLE = 'background:#ffe5e5;color:#900;padding:0 .25em;border-radius:4px';

  /* ------------------------------- Вспомогалки ------------------------------- */
  const log  = (...a) => console.log('[FMV]', ...a);

  function onRightTopic() {
    const m = location.search.match(/[?&]id=(\d+)/);
    return m && Number(m[1]) === ENABLE_ON_TOPIC_ID;
  }

  function getParticipantsMap() {
    // 1) из глобала
    if (window.FMV_PARTICIPANTS && typeof window.FMV_PARTICIPANTS === 'object') return lowerKeys(window.FMV_PARTICIPANTS);
    // 2) из JSON-тэга
    const tag = document.getElementById('fmv-chrono-participants');
    if (tag && tag.type === 'application/json') {
      try { return lowerKeys(JSON.parse(tag.textContent || '{}')); } catch {}
    }
    return {};
  }
  function lowerKeys(obj) {
    const out = {};
    Object.keys(obj || {}).forEach(k => out[String(k).toLowerCase()] = obj[k]);
    return out;
  }

  // строка/массив/разметку → массив строк; режем по запятым/слэшам/точкам с запятой
  function listify(v) {
    if (Array.isArray(v)) return v.map(x => String(x));
    if (v == null) return [];
    const raw = String(v)
      .replace(/<[^>]+>/g, '')         // на всякий: срежем теги, если вдруг прилетят
      .toLowerCase();
    return raw
      .split(/[,\u00B7/|;]+/g)         // запятая, слэш, вертикальная черта, точка с запятой, middle dot
      .map(s => s.trim())
      .filter(Boolean);
  }
  const uniq = (arr) => Array.from(new Set(arr));

  /* ----------------------------- Рендер статуса ----------------------------- */
  // тип не выделяем, цветим только статус
  function renderStatus(type, status) {
    const map = {
      on:        { word: 'active',   color: 'green'  },
      off:       { word: 'closed',   color: 'teal'   },
      archived:  { word: 'archived', color: 'maroon' }
    };
    const st = map[status] || map.archived;
    return `[${type} / <span style="color:${st.color}">${st.word}</span>]`;
  }

  /* --------------------------- Линковка персонажей -------------------------- */
  function linkifyCharacters(list, participantsMap) {
    return list.map(nameLC => {
      const href = participantsMap[nameLC];
      if (href) {
        // отображаем логин в lowercase как просила
        return `<a href="${href}">${nameLC}</a>`;
      }
      // незнакомых — подсветим
      return `<span style="${MISS_STYLE}">${nameLC}</span>`;
    }).join(', ');
  }

  /* ------------------------------- Сортировка ------------------------------- */
  // мягкая сортировка по начальной дате вида DD.MM.YY (если нет — остаётся порядок исходных)
  function parseDate(d) {
    // допускаем 10.10.97 или 10.10.1997
    const m = String(d || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (!m) return NaN;
    const dd = +m[1], mm = +m[2] - 1, yy = +m[3];
    const yyyy = yy < 100 ? 2000 + yy - 100 * (yy >= 70 ? 1 : 0) : yy; // 97→1997, 03→2003
    return new Date(yyyy, mm, dd).getTime();
  }

  /* --------------------------- Сбор исходных данных ------------------------- */
  // Базируемся на твоей логике: вытаскиваем данные из всех спойлеров «хронология»
  // Источник — <div class="quote-box spoiler-box media-box"><div>хронология</div><script type="text/html">...json...</script>
  // Если твоё наполнение другое — функция-коллектор может быть переопределена глобально: window.FMV_collectChrono()
  function collectChrono() {
    if (typeof window.FMV_collectChrono === 'function') return window.FMV_collectChrono();

    const blocks = Array.from(document.querySelectorAll('.quote-box.spoiler-box.media-box'));
    const out = [];
    for (const box of blocks) {
      const title = (box.querySelector(':scope > div')?.textContent || '').trim().toLowerCase();
      if (title !== 'хронология') continue;

      // поддержим два варианта:
      // 1) JSON внутри <script type="application/json">
      let script = box.querySelector(':scope > script[type="application/json"]');
      if (script) {
        try {
          const arr = JSON.parse(script.textContent || '[]');
          if (Array.isArray(arr)) out.push(...arr);
          continue;
        } catch {}
      }
      // 2) плейн-JSON внутри <script type="text/html"> (как часто делают на rusff)
      script = box.querySelector(':scope > script[type="text/html"]');
      if (script) {
        try {
          const txt = (script.textContent || '').trim();
          const arr = JSON.parse(txt);
          if (Array.isArray(arr)) out.push(...arr);
        } catch {
          // если это не JSON, попробуем простенький парсер «по линиям»: одна запись — одна <p>...</p>
          // формат: [type;status] 10.10.97-12.10.97 — title | characters | location
          const tmp = document.createElement('div');
          tmp.innerHTML = script.textContent || '';
          tmp.querySelectorAll('p').forEach(p => {
            const line = p.textContent.trim();
            if (!line) return;
            const m = line.match(/^\[(.+?)\]\s+(.+?)\s+—\s+(.+?)(?:\s*\|\s*(.+?))?(?:\s*\|\s*(.+))?$/);
            if (!m) return;
            const [_, ts, date, title, chars, locs] = m;
            const [type, status] = ts.split(/[;\/|,\s]+/).map(s => s.trim().toLowerCase());
            out.push({
              type, status,
              date_from: (date.split(/[-–—]/)[0] || '').trim(),
              date_to:   (date.split(/[-–—]/)[1] || '').trim(),
              title,
              characters: chars || '',
              location:   locs || ''
            });
          });
        }
      }
    }
    return out;
  }

  /* ------------------------------- Рендерер -------------------------------- */
  function renderChrono(events, participantsMap) {
    if (!events.length) return '<em>пусто</em>';

    // нормализуем и расширяем поля (multi-values + lowercase + uniq)
    const prepared = events.map(e => {
      const type   = String(e.type || 'personal').toLowerCase();
      const status = String(e.status || 'archived').toLowerCase();

      const chars = uniq(listify(e.characters));
      const locs  = uniq(listify(e.location));

      return {
        ...e,
        type, status,
        date_from: String(e.date_from || e.date || '').trim(),
        date_to:   String(e.date_to || '').trim(),
        title:     String(e.title || '').trim(),
        _chars:    chars,     // массив lc
        _locs:     locs       // массив lc
      };
    });

    // сортировка по начальной дате (если распарсилась)
    prepared.sort((a, b) => (parseDate(a.date_from) || 0) - (parseDate(b.date_from) || 0));

    // линии
    const lines = prepared.map(e => {
      const datePart = e.date_to
        ? `${e.date_from}–${e.date_to}`
        : e.date_from;

      const head = `${renderStatus(e.type, e.status)} ${datePart} — ${e.title || ''}`;

      const chars = e._chars.length
        ? linkifyCharacters(e._chars, participantsMap)
        : '';

      const locs  = e._locs.length
        ? e._locs.join(', ')
        : '';

      // выводим в три строки, как в твоём формате
      return [
        `<p style="margin:0 0 .4em 0"><span>${head}</span></p>`,
        chars ? `<div style="margin:-.25em 0 .1em 0">${chars}</div>` : '',
        locs  ? `<div style="opacity:.85">${locs}</div>` : ''
      ].filter(Boolean).join('\n');
    });

    // общий контейнер с “пулей”
    return `
      <div style="background:#f3f1ea;border-radius:10px;padding:.9em 1em 1em;border:1px solid rgba(0,0,0,.06)">
        <div style="display:flex;align-items:center;gap:.6em;margin:.1em 0 .6em">
          <span style="width:8px;height:8px;background:#6b8e23;border-radius:50%;display:inline-block"></span>
          <span style="opacity:.9">хронология</span>
        </div>
        ${lines.join('\n')}
      </div>
    `;
  }

  /* ------------------------------- Вставка UI ------------------------------- */
  const WRAP_ID = 'fmv-chrono-inline';
  const NOTE_ID = 'fmv-chrono-inline-note';

  function mountInlineButton() {
    const host = document.querySelector(BTN_HOST_SEL);
    if (!host) return false;
    if (document.getElementById(WRAP_ID)) return true;

    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    wrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin:8px 0 0';

    const btn = document.createElement('a');
    btn.href = 'javascript:void(0)';
    btn.className = 'button';
    btn.textContent = 'Пересобрать хронологию';

    const note = document.createElement('span');
    note.id = NOTE_ID;
    note.style.opacity = '.85';
    note.style.marginLeft = '6px';

    wrap.appendChild(btn);
    wrap.appendChild(note);
    host.appendChild(wrap);

    btn.addEventListener('click', () => {
      note.textContent = 'Готовлю…';

      try {
        const participants = getParticipantsMap();
        const events = collectChrono();
        const html = renderChrono(events, participants);

        const outHost = document.querySelector(OUT_HOST_SEL);
        if (outHost) {
          outHost.innerHTML = `
            <div class="quote-box spoiler-box media-box">
              <div onclick="toggleSpoiler(this);" class="">Собранная хронология</div>
              <blockquote class="">
                ${html}
              </blockquote>
            </div>
          `;
        }
        note.textContent = 'Готово';
      } catch (e) {
        console.error(e);
        note.textContent = 'Ошибка';
      }
    });

    log('Кнопка хронологии: установлена в конец', BTN_HOST_SEL);
    return true;
  }

  /* ------------------------------ Экспорт API ------------------------------ */
  // на случай ручного дергания из консоли
  window.FMV_buildChronology = function () {
    const participants = getParticipantsMap();
    const events = collectChrono();
    const html = renderChrono(events, participants);
    const outHost = document.querySelector(OUT_HOST_SEL);
    if (outHost) {
      outHost.innerHTML = `
        <div class="quote-box spoiler-box media-box">
          <div onclick="toggleSpoiler(this);" class="">Собранная хронология</div>
          <blockquote class="">
            ${html}
          </blockquote>
        </div>
      `;
    }
  };

  /* --------------------------------- Старт --------------------------------- */
  function init() {
    if (!onRightTopic()) return;
    if (!mountInlineButton()) {
      // если контейнер ещё не в DOM — подождём
      const mo = new MutationObserver(() => {
        if (mountInlineButton()) mo.disconnect();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 10000);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
