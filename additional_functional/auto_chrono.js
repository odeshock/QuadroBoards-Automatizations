(function () {
  'use strict';

  /* ===== Активируемся только в нужной теме ===== */
  try {
    const u = new URL(location.href);
    if (!(u.hostname === 'testfmvoice.rusff.me' && u.pathname === '/viewtopic.php' && u.searchParams.get('id') === '13')) {
      return;
    }
  } catch {
    return;
  }

  console.group('[FMV] Автохронология (кнопка → p82, вывод → p83)');

  /* ============================ КОНФИГ ============================ */
  const BASE = 'https://testfmvoice.rusff.me';

  // Разделы как в эталонной версии
  const SECTIONS = [
    { id: 4, type: 'personal', status: 'on'  },
    { id: 5, type: 'personal', status: 'off' },
  ];

  const MAX_PAGES_PER_SECTION = 50;
  const MAX_PAGES_USERLIST    = 200;

  // Где кнопка и куда вывод
  const SRC_POST_ID  = 'p82';
  const SRC_HOST_SEL = `#${SRC_POST_ID} .post-box`; // кнопка — в конец этого контейнера
  const OUT_SEL      = '#p83-content';              // сюда подменяем HTML после сборки

  // id элементов
  const WRAP_ID = 'fmv-chrono-inline';
  const BTN_ID  = 'fmv-chrono-inline-btn';
  const NOTE_ID = 'fmv-chrono-inline-note';

  /* =========================== УТИЛИТЫ =========================== */
  const abs    = (base, href) => { try { return new URL(href, base).href; } catch { return href; } };
  const esc    = (s='') => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                                    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const trimSp = (s) => String(s||'').replace(/\s+/g,' ').trim();

  const MISS_STYLE = 'background:#ffe5e5;color:#900;padding:0 .25em;border-radius:4px';

  /* ---------- статусный бейдж ---------- */
  function renderStatus(type, status) {
    const map = {
      on:       { word: 'active'  },
      off:      { word: 'closed'  },
      archived: { word: 'archived'}
    };
    const st = map[status] || map.archived;
    return `[${type} / ${st.word}]`;
  }

  /* ---------- заголовок темы: "[дата] эпизод" ---------- */
  const TITLE_RE = /^\s*\[(.+?)\]\s*(.+)$/s;
  function parseTitle(text) {
    const m = String(text||'').match(TITLE_RE);
    return m
      ? { dateRaw: m[1].trim(), episode: m[2].trim(), hasBracket: true }
      : { dateRaw: '', episode: trimSp(text), hasBracket: false };
  }

  /* ---------- разбор дат (ru) ---------- */
  const RU_MONTHS = {
    'янв':1,'январь':1,'января':1,
    'фев':2,'февраль':2,'февраля':2,
    'мар':3,'март':3,'марта':3,
    'апр':4,'апрель':4,'апреля':4,
    'май':5,'мая':5,
    'июн':6,'июнь':6,'июня':6,
    'июл':7,'июль':7,'июля':7,
    'авг':8,'август':8,'августа':8,
    'сен':9,'сент':9,'сентябрь':9,'сентября':9,
    'окт':10,'октябрь':10,'октября':10,
    'ноя':11,'ноябрь':11,'ноября':11,
    'дек':12,'декабрь':12,'декабря':12
  };
  const CHAR_SPLIT = /\s*(?:,|;|\/|&|\bи\b)\s*/iu;
  const TMAX = [9999,12,31];
  const yFix = (y)=> String(y).length<=2 ? 1900 + parseInt(y,10) : parseInt(y,10);
  const dateKey = (t) => t[0]*10000 + t[1]*100 + t[2];

  function parseDateRange(src) {
    let s = String(src||'').trim();
    if (!s) return { start: TMAX, end: TMAX, kind:'unknown', bad:true };
    s = s.replace(/[—–−]/g,'-').replace(/\s*-\s*/g,'-');

    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) return { start:[yFix(m[3]),+m[2],+m[1]], end:[yFix(m[6]),+m[5],+m[4]], kind:'full-range', bad:false };

    m = s.match(/^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) { const y=yFix(m[4]),mo=+m[3]; return { start:[y,mo,+m[1]], end:[y,mo,+m[2]], kind:'day-range', bad:false }; }

    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) { const a=[yFix(m[3]),+m[2],+m[1]]; return { start:a, end:a.slice(), kind:'single', bad:false }; }

    m = s.toLowerCase().match(/^([а-яё]{3,})\s+(\d{4})$/i);
    if (m && RU_MONTHS[m[1]]) { const y=+m[2], mo=RU_MONTHS[m[1]]; const a=[y,mo,0]; return { start:a, end:a.slice(), kind:'month', bad:false }; }

    m = s.match(/^(\d{4})$/);
    if (m) { const y=+m[1], a=[y,1,0]; return { start:a, end:a.slice(), kind:'year', bad:false }; }

    m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})/);
    if (m) { const a=[yFix(m[3]),+m[2],+m[1]]; return { start:a, end:a.slice(), kind:'fallback', bad:true }; }

    return { start:TMAX, end:TMAX, kind:'unknown', bad:true };
  }

  /* ---------- декод/парс страниц (1251/utf-8 автоопределение) ---------- */
  function countFFFD(s){return (s.match(/\uFFFD/g)||[]).length}
  function countCyr(s){return (s.match(/[А-Яа-яЁё]/g)||[]).length}
  function sniffMetaCharset(buf) {
    const head = new TextDecoder('windows-1252').decode(buf.slice(0, 4096));
    const m1 = head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
    if (m1) return m1[1].toLowerCase();
    const m2 = head.match(/content\s*=\s*["'][^"']*charset=([\w-]+)/i);
    if (m2) return m2[1].toLowerCase();
    return '';
  }
  function scoreDecoded(html, hint) {
    const sFFFD = countFFFD(html);
    const sCyr  = countCyr(html);
    const hasHtml = /<html[^>]*>/i.test(html) ? 1 : 0;
    const hasHead = /<head[^>]*>/i.test(html) ? 1 : 0;
    const hintBonus = hint ? 2 : 0;
    return (sCyr * 5) + (hasHtml + hasHead + hintBonus) * 3 - (sFFFD * 50);
  }
  async function fetchText(url, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeoutMs);
    try {
      const res  = await fetch(url, { credentials:'include', signal:ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf  = await res.arrayBuffer();

      const ct   = res.headers.get('content-type') || '';
      const mCT  = ct.match(/charset=([^;]+)/i);
      const headerCharset = mCT ? mCT[1].trim().toLowerCase() : '';
      const metaCharset   = sniffMetaCharset(buf);

      const hints = { 'utf-8': false, 'windows-1251': false };
      if (/utf-?8/i.test(headerCharset) || /utf-?8/i.test(metaCharset)) hints['utf-8'] = true;
      if (/1251|cp-?1251/i.test(headerCharset) || /1251|cp-?1251/i.test(metaCharset)) hints['windows-1251'] = true;

      const tryOrder = [];
      if (headerCharset) tryOrder.push(headerCharset);
      if (metaCharset && !tryOrder.includes(metaCharset)) tryOrder.push(metaCharset);
      ['utf-8','windows-1251'].forEach(enc => { if (!tryOrder.includes(enc)) tryOrder.push(enc); });

      let best = { score: -1e9, enc: '', html: '' };
      for (const enc of tryOrder) {
        let html = '';
        try { html = new TextDecoder(enc, { fatal:false }).decode(buf); } catch { continue; }
        const score = scoreDecoded(html, hints[enc]);
        if (score > best.score) best = { score, enc, html };
      }
      return best.html;
    } finally { clearTimeout(t); }
  }

  const parseHTML     = (html)=> new DOMParser().parseFromString(html,'text/html');
  const firstPostNode = (doc) =>
    doc.querySelector('.post.topicpost .post-content') ||
    doc.querySelector('.post.topicpost') || doc;

  function extractFromFirst(firstNode) {
    const locNode   = firstNode.querySelector('location');
    const castNode  = firstNode.querySelector('characters');
    const orderNode = firstNode.querySelector('order');

    const location  = (locNode ? locNode.innerText.trim() : '').toLowerCase();

    const rawChars  = castNode ? castNode.innerText : '';
    const charsSrc  = rawChars
      ? rawChars.split(CHAR_SPLIT).map(s=>s.trim()).filter(Boolean)
      : [];
    const charactersLower = charsSrc.map(s => s.toLowerCase());

    let order = null;
    if (orderNode) {
      const num = parseInt(orderNode.textContent.trim(), 10);
      if (Number.isFinite(num)) order = num;
    }
    return { location, charactersLower, order };
  }

  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const html = await fetchText(topicUrl);
      const doc  = parseHTML(html);
      const first= firstPostNode(doc);
      const { location, charactersLower, order } = extractFromFirst(first);
      const { dateRaw, episode, hasBracket } = parseTitle(rawTitle);
      const range  = parseDateRange(dateRaw);
      const dateBad = !hasBracket || range.bad;

      return { type, status, dateRaw, episode, url: topicUrl, location, charactersLower, order, range, dateBad };
    } catch (e) {
      console.warn('[FMV] тема ✗', topicUrl, e);
      return null;
    }
  }

  async function scrapeSection(section) {
    let page = `${BASE}/viewforum.php?id=${section.id}`;
    const seen = new Set();
    const out  = [];
    let pageCount = 0;

    while (page && !seen.has(page) && pageCount < MAX_PAGES_PER_SECTION) {
      pageCount++;
      seen.add(page);

      const html = await fetchText(page);
      const doc  = parseHTML(html);

      const topics = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a=>{
        const href = abs(page, a.getAttribute('href'));
        const m = href.match(/viewtopic\.php\?id=(\d+)/i);
        if (!m) return;
        const id = m[1];
        const title = a.textContent || a.innerText || '';
        if (/^\s*(RSS|Atom)\s*$/i.test(title)) return;
        if (!topics.has(id)) topics.set(id, { url: href, title });
      });

      for (const { url, title } of topics.values()) {
        const row = await scrapeTopic(url, title, section.type, section.status);
        if (row) out.push(row);
      }

      const nextRel = doc.querySelector('a[rel="next"]');
      let nextHref  = nextRel ? nextRel.getAttribute('href') : null;
      if (!nextHref) {
        const candidate = Array.from(doc.querySelectorAll('a'))
          .find(a => /\b(След|Next|»|›)\b/i.test(a.textContent || ''));
        if (candidate) nextHref = candidate.getAttribute('href');
      }
      page = nextHref ? abs(page, nextHref) : null;
    }
    return out;
  }

  async function scrapeAllUsers() {
    let page = `${BASE}/userlist.php`;
    const seen  = new Set();
    const nameToProfile = new Map(); // lowerName -> absolute href
    let cnt = 0;

    while (page && !seen.has(page) && cnt < MAX_PAGES_USERLIST) {
      cnt++;
      seen.add(page);

      const html = await fetchText(page);
      const doc  = parseHTML(html);

      const anchors = doc.querySelectorAll('.usersname a, a[href*="profile.php?id="]');
      anchors.forEach(a=>{
        const nameText = (a.textContent || a.innerText || '').trim();
        if (!nameText) return;
        const norm = nameText.toLowerCase();
        if (!nameToProfile.has(norm)) {
          nameToProfile.set(norm, abs(page, a.getAttribute('href')));
        }
      });

      const nextRel = doc.querySelector('a[rel="next"]');
      let nextHref  = nextRel ? nextRel.getAttribute('href') : null;
      if (!nextHref) {
        const candidate = Array.from(doc.querySelectorAll('a'))
          .find(a => /\b(След|Next|»|›)\b/i.test(a.textContent || ''));
        if (candidate) nextHref = candidate.getAttribute('href');
      }
      page = nextHref ? abs(page, nextHref) : null;
    }
    return nameToProfile;
  }

  function compareEvents(a, b) {
    const sa = dateKey(a.range.start), sb = dateKey(b.range.start);
    if (sa !== sb) return sa - sb;
    const ea = dateKey(a.range.end), eb = dateKey(b.range.end);
    if (ea !== eb) return ea - eb;
    const ao = (a.order == null) ? Number.POSITIVE_INFINITY : a.order;
    const bo = (b.order == null) ? Number.POSITIVE_INFINITY : b.order;
    if (ao !== bo) return ao - bo;
    return (a.episode||'').localeCompare(b.episode||'', 'ru', { sensitivity:'base' });
  }

  /* ================ СБОРКА HTML (без внутреннего заголовка) ================ */
  async function buildWrappedHTML() {
    const nameToProfile = await scrapeAllUsers();

    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec);
      all = all.concat(part);
    }
    all = all.filter(Boolean);
    all.sort(compareEvents);

    function renderNames(lowerArr) {
      if (!lowerArr || !lowerArr.length) return `<span style="${MISS_STYLE}">не указаны</span>`;
      return lowerArr.map((low) => {
        const href  = nameToProfile.get(low); // сравнение по lowercase
        const shown = esc(low);               // вывод lowercase
        if (href) return `<a href="${esc(href)}">${shown}</a>`;
        return `<span style="${MISS_STYLE}" title="пользователь не найден">${shown}</span>`;
      }).join(', ');
    }

    const items = all.map(e => {
      const statusHTML = renderStatus(e.type, e.status);
      const dateHTML   = (!e.dateRaw || e.dateBad)
        ? `<span style="${MISS_STYLE}" title="дата не распознана/не указана">дата не указана/ошибка</span>`
        : esc(e.dateRaw);

      const url        = esc(e.url);
      const ttl        = esc(e.episode);
      const orderBadge = (e.order!=null) ? ` <span>[${esc(String(e.order))}]</span>` : '';

      const names = renderNames(e.charactersLower);
      const loc   = e.location
        ? esc(e.location) // уже lowercase
        : `<span style="${MISS_STYLE}">локация не указана</span>`;

      // строка записи
      return `
        <p style="margin:0 0 .4em 0">
          <span>${statusHTML}</span> ${dateHTML} — <a href="${url}">${ttl}</a>${orderBadge}<br/>
          ${names} / ${loc}
        </p>
      `;
    });

    const body = items.join('') || `<p>— пусто —</p>`;

    // ВНЕШНИЙ спойлер остаётся («Собранная хронология»),
    // но ВНУТРЕННЕГО заголовка «Хронология» больше нет.
    return `<div class="quote-box spoiler-box media-box"><div onclick="toggleSpoiler(this);" class="">Собранная хронология</div><blockquote class="">${body}</blockquote></div>`;
  }

  /* =================== ЗАПУСК ПО КНОПКЕ + ПОДМЕНА #p83 =================== */
  async function handleBuild(opts) {
    const btn  = opts?.buttonEl || document.getElementById(BTN_ID);
    const note = opts?.noteEl   || document.getElementById(NOTE_ID);

    try {
      const host = document.querySelector(OUT_SEL);
      if (!host) { console.warn('[FMV] контейнер вывода не найден:', OUT_SEL); return; }

      // статус: только в p82
      if (btn)  { btn.disabled = true; btn.textContent = 'Собираю…'; }
      if (note) { note.textContent = 'Готовлю хронологию…'; note.style.opacity = '.85'; note.classList.remove('fmv-note-bad'); }

      const html = await buildWrappedHTML();
      host.innerHTML = html;

      // Чистим индикатор, "Готово" не показываем.
      if (note) note.textContent = '';
    } catch (e) {
      console.error('[FMV] Ошибка сборки:', e);
      if (note) {
        note.textContent = 'Ошибка сборки';
        note.classList.add('fmv-note-bad');
      }
      if (btn) btn.textContent = 'Ошибка';
      setTimeout(() => { if (btn) btn.textContent = 'Собрать хронологию'; }, 2000);
    } finally {
      const b = document.getElementById(BTN_ID);
      if (b) { b.disabled = false; b.textContent = 'Собрать хронологию'; }
    }
  }

  /* ========================= РИСУЕМ КНОПКУ В КОНЕЦ p82 ========================= */
  function mountInlineButton() {
    const host = document.querySelector(SRC_HOST_SEL);
    if (!host) return false;
    if (document.getElementById(WRAP_ID)) return true;

    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    wrap.style.marginTop = '8px';
    wrap.style.display   = 'flex';
    wrap.style.alignItems= 'center';
    wrap.style.gap       = '10px';

    const btn = document.createElement('a');
    btn.id = BTN_ID;
    btn.href = 'javascript:void(0)';
    btn.className = 'button';
    btn.textContent = 'Собрать хронологию';
    btn.setAttribute('data-fmv-chrono-trigger', 'inline');

    const note = document.createElement('span');
    note.id = NOTE_ID;
    note.setAttribute('data-fmv-chrono-note', 'inline');
    note.style.fontSize = '90%';
    note.style.opacity  = '.85';

    wrap.appendChild(btn);
    wrap.appendChild(note);
    host.appendChild(wrap); // в самый конец p82.post-box

    btn.addEventListener('click', () => handleBuild({ buttonEl: btn, noteEl: note }));

    console.log('[FMV] Кнопка добавлена в конец', SRC_HOST_SEL);
    return true;
  }

  function init() {
    if (mountInlineButton()) {
      console.log('[FMV] inline-кнопка готова');
    } else {
      const mo = new MutationObserver(() => {
        if (mountInlineButton()) mo.disconnect();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(()=>mo.disconnect(), 10000);
    }

    // экспорт
    window.FMV_buildChronology = () => handleBuild({});
    console.log('[FMV] Доступно window.FMV_buildChronology()');
  }

  // стили для сообщения об ошибке у заметки
  (function ensureStyles(){
    if (document.getElementById('fmv-chrono-styles')) return;
    const style = document.createElement('style');
    style.id = 'fmv-chrono-styles';
    style.textContent = `.fmv-note-bad{background:rgba(200,0,0,.14);padding:2px 6px;border-radius:4px}`;
    document.documentElement.appendChild(style);
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  console.groupEnd();
})();
