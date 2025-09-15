/* ======================= FMV — Автохронология ======================= */
/* Версия: custom (цвет статуса + множественные characters/locations)  */
(function () {
  'use strict';

  /* ----------------------------- Конфиг ----------------------------- */
  const ENABLE_ON_TOPIC_ID = 13;      // в какой теме активировать
  const POST_WITH_BUTTON   = 'p82';   // куда ставим кнопку
  const POST_FOR_OUTPUT    = 'p83';   // куда пишем результат

  // карта цветов для статуса
  const STATUS_MAP = {
    on:        { word: 'active',   color: 'green'  },
    off:       { word: 'closed',   color: 'teal'   },
    archived:  { word: 'archived', color: 'maroon' }
  };

  // текст в UI
  const UI = {
    buildBtn: 'Пересобрать хронологию',
    building: 'Готовлю…',
    done:     'Готово',
    spoilerTitle: 'Собранная хронология',
    empty:    'пусто'
  };

  /* ----------------------------- Утилиты ---------------------------- */
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const log  = (...a) => console.log('[FMV]', ...a);
  const warn = (...a) => console.warn('[FMV]', ...a);

  const onRightTopic = () => {
    const m = location.search.match(/[?&]id=(\d+)/);
    return m && Number(m[1]) === ENABLE_ON_TOPIC_ID;
  };

  const esc = (s='') => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  // нормализуем массив строк: режем по запятым/новым строкам, чистим, в lowercase
  function normalizeList(input) {
    if (input == null) return [];
    const raw = Array.isArray(input) ? input : [input];
    const items = [];
    for (const chunk of raw) {
      const text = String(chunk);
      // если это JSON-строка с массивом — попробуем распарсить
      if (/^\s*\[/.test(text) && /]\s*$/.test(text)) {
        try {
          for (const v of JSON.parse(text)) items.push(String(v));
          continue;
        } catch {}
      }
      // обычная строка
      text.split(/[,;\n]/).forEach(x => items.push(x));
    }
    const set = new Set();
    for (let v of items) {
      v = v.trim();
      if (!v) continue;
      set.add(v.toLowerCase());       // приводим к lowercase по задаче
    }
    return Array.from(set);
  }

  // линкуем имя, если есть в словаре участников
  function linkify(nameLower) {
    const dict = (window.FMV_PARTICIPANTS || {}); // {lowerName: url}
    const url = dict[nameLower];
    return url ? `<a href="${esc(url)}">${esc(nameLower)}</a>` : esc(nameLower);
  }

  // цветной статус
  function renderStatus(type='personal', status='archived') {
    const st = STATUS_MAP[ String(status).toLowerCase() ] || STATUS_MAP.archived;
    // тип по макету без подсветки
    return `[${esc(type)} / <span style="color:${st.color}">${esc(st.word)}</span>]`;
  }

  // собираем ВСЮ инфу из json/«yaml»-строк спойлеров "хронология"
  function collectEpisodes() {
    // входные спойлеры "хронология" (заголовок в lowercase)
    const inBlocks = $$('.quote-box.spoiler-box.media-box').filter(box => {
      const title = $('div:first-child', box)?.textContent?.trim()?.toLowerCase() || '';
      return title === 'хронология';
    });

    const out = [];
    for (const box of inBlocks) {
      // 1) JSON внутри <script type="application/json">
      const scripts = $$('script[type="application/json"],script[type="text/json"],script[data-fmv-chrono]', box);
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent.trim());
          // допускаем массив эпизодов
          const arr = Array.isArray(data) ? data : [data];
          out.push(...arr);
        } catch (e) { warn('bad json in chronology block:', e); }
      }

      // 2) fallback: построчный блокнот в <blockquote>
      const txt = $('blockquote', box)?.textContent || '';
      const lines = txt.split(/\n/).map(x => x.trim()).filter(Boolean);
      if (lines.length) {
        // грубый парсер "key: value"
        const rec = {};
        for (const ln of lines) {
          const m = ln.match(/^([a-zA-Zа-яёА-ЯЁ_]+)\s*:\s*(.+)$/);
          if (!m) continue;
          const key = m[1].toLowerCase();
          const val = m[2];
          // поддерживаем мульти-ключи: characters/character/chars; locations/location/place/places
          if (!rec[key]) rec[key] = val;
          else if (Array.isArray(rec[key])) rec[key].push(val);
          else rec[key] = [ rec[key], val ];
        }
        if (Object.keys(rec).length) out.push(rec);
      }
    }
    return out;
  }

  // нормализуем эпизод к единому виду
  function normalizeEpisode(raw) {
    const type   = (raw.type ?? 'personal').toString().toLowerCase();
    const status = (raw.status ?? 'archived').toString().toLowerCase();

    // даты/тайтл как есть (обезопасим только)
    const date  = (raw.date ?? raw.when ?? '').toString().trim();
    const title = (raw.title ?? raw.name ?? '').toString().trim();

    // соберём ВСЕ кандидаты по синонимам
    const charVals = [];
    ['characters','character','chars','who','participants'].forEach(k => {
      if (k in raw) charVals.push(raw[k]);
    });
    const locVals = [];
    ['locations','location','place','places','where'].forEach(k => {
      if (k in raw) locVals.push(raw[k]);
    });

    const characters = normalizeList(charVals);
    const locations  = normalizeList(locVals);

    return { type, status, date, title, characters, locations };
  }

  // превращаем эпизоды в HTML параграфы
  function renderEpisodesHTML(episodes) {
    if (!episodes.length) {
      return `<p><i>${esc(UI.empty)}</i></p>`;
    }
    const parts = [];
    for (const raw of episodes) {
      const ep = normalizeEpisode(raw);

      const statusHTML = renderStatus(ep.type, ep.status);
      const dateHTML   = esc(ep.date);
      const titleHTML  = esc(ep.title);

      const charsHTML = ep.characters.map(linkify).join(', ');
      const locsHTML  = ep.locations.join(', '); // уже lowercase

      parts.push(
        `<p style="margin:0 0 .4em 0">
           <span>${statusHTML}</span> ${dateHTML ? `${dateHTML} — ` : ''}${titleHTML}
           ${ (charsHTML || locsHTML) ? `<br><i>${charsHTML || ''}</i>${locsHTML ? ` / ${locsHTML}` : ''}` : '' }
         </p>`
      );
    }
    return parts.join('\n');
  }

  // публикуем итог в #p83
  function writeOutput(html) {
    const host = document.getElementById(POST_FOR_OUTPUT + '-content');
    if (!host) { warn('Выходной пост не найден:', POST_FOR_OUTPUT); return; }
    host.innerHTML =
      `<div class="quote-box spoiler-box media-box">
         <div onclick="toggleSpoiler(this)">${esc(UI.spoilerTitle)}</div>
         <blockquote>${html}</blockquote>
       </div>`;
  }

  // основная сборка
  function build() {
    const btnNote = document.getElementById('fmv-chrono-note');
    if (btnNote) btnNote.textContent = UI.building;

    const episodes = collectEpisodes();
    const html = renderEpisodesHTML(episodes);
    writeOutput(html);

    if (btnNote) btnNote.textContent = UI.done;
  }

  // публичный вход
  window.FMV_buildChronology = build;

  /* ----------------------- UI: кнопка в #p82 ------------------------ */
  function mountButton() {
    const postBox = document.querySelector(`#${POST_WITH_BUTTON} .post-box`);
    if (!postBox || document.getElementById('fmv-chrono-wrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'fmv-chrono-wrap';
    wrap.style.marginTop = '8px';

    wrap.innerHTML =
      `<a href="javascript:void(0)" class="button" id="fmv-chrono-btn">${esc(UI.buildBtn)}</a>
       <span id="fmv-chrono-note" style="margin-left:.6em;opacity:.85;font-size:90%"></span>`;

    postBox.appendChild(wrap);

    document.getElementById('fmv-chrono-btn')
      .addEventListener('click', () => build());
  }

  /* ----------------------------- Старт ----------------------------- */
  function init() {
    if (!onRightTopic()) return;
    mountButton();
    log('Автохронология готова. Доступно: FMV_buildChronology()');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
