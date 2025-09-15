(function () {
  'use strict';

  // --- включаемся только на нужной странице
  try {
    const u = new URL(location.href);
    if (!(u.hostname === 'testfmvoice.rusff.me' &&
          u.pathname === '/viewtopic.php' &&
          u.searchParams.get('id') === '13')) {
      return;
    }
  } catch { return; }

  console.group('[FMV] Автохронология');

  // ===== Конфиг
  const BASE = 'https://testfmvoice.rusff.me';
  const SECTIONS = [
    { id: 4, type: 'personal', status: 'on'  }, // active
    { id: 5, type: 'personal', status: 'off' }, // closed
  ];
  const MAX_PAGES_PER_SECTION = 50;

  // ===== Утилиты
  const abs = (base, href) => { try { return new URL(href, base).href; } catch { return href; } };
  const trimSp = (s) => String(s||'').replace(/\s+/g,' ').trim();
  const esc = (s='') => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const MISS_STYLE = 'background:#ffe5e5;color:#900;padding:0 .25em;border-radius:4px';

  // статус окрашиваем, personal — без акцента
  function renderStatus(type, status) {
    const map = {
      on:       { word: 'active',   color: 'green'  },
      off:      { word: 'closed',   color: 'teal'   },
      archived: { word: 'archived', color: 'maroon' }
    };
    const st = map[status] || map.archived;
    return `[${type} / <span style="color: ${st.color}">${st.word}</span>]`;
  }

  // заголовок темы: "[дата] название"
  const TITLE_RE = /^\s*\[(.+?)\]\s*(.+)$/s;
  function parseTitle(text) {
    const m = String(text||'').match(TITLE_RE);
    return m ? { dateRaw: m[1].trim(), episode: m[2].trim(), hasBracket:true }
             : { dateRaw: '', episode: trimSp(text), hasBracket:false };
  }

  // ===== парсер дат
  const RU_MONTHS = {
    'янв':1,'январь':1,'января':1,'фев':2,'февраль':2,'февраля':2,'мар':3,'март':3,'марта':3,
    'апр':4,'апрель':4,'апреля':4,'май':5,'мая':5,'июн':6,'июнь':6,'июня':6,'июл':7,'июль':7,'июля':7,
    'авг':8,'август':8,'августа':8,'сен':9,'сент':9,'сентябрь':9,'сентября':9,'окт':10,'октябрь':10,'октября':10,
    'ноя':11,'ноябрь':11,'ноября':11,'дек':12,'декабрь':12,'декабря':12
  };
  const CHAR_SPLIT = /\s*(?:,|;|\/|&|\bи\b)\s*/iu;
  const TMAX = [9999,12,31];
  const yFix = (y)=> String(y).length<=2 ? 1900 + parseInt(y,10) : parseInt(y,10);

  function parseDateRange(src) {
    let s = String(src||'').trim();
    if (!s) return { start: TMAX, end: TMAX, kind:'unknown', bad:true };
    s = s.replace(/[—–−]/g,'-').replace(/\s*-\s*/g,'-');

    // dd.mm.yy(yyyy)-dd.mm.yy(yyyy)
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const a=[yFix(m[3]),+m[2],+m[1]];
      const b=[yFix(m[6]),+m[5],+m[4]];
      return { start:a, end:b, kind:'full-range', bad:false };
    }
    // dd1-dd2.mm.yy(yyyy)
    m = s.match(/^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const y=yFix(m[4]), mo=+m[3];
      const a=[y,mo,+m[1]], b=[y,mo,+m[2]];
      return { start:a, end:b, kind:'day-range', bad:false };
    }
    // dd.mm.yy(yyyy)
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const a=[yFix(m[3]),+m[2],+m[1]];
      return { start:a, end:a.slice(), kind:'single', bad:false };
    }
    // <месяц> <год>
    m = s.toLowerCase().match(/^([а-яё]{3,})\s+(\d{4})$/i);
    if (m && RU_MONTHS[m[1]]) {
      const y=+m[2], mo=RU_MONTHS[m[1]];
      const a=[y,mo,0];
      return { start:a, end:a.slice(), kind:'month', bad:false };
    }
    // год
    m = s.match(/^(\d{4})$/);
    if (m) {
      const y=+m[1], a=[y,1,0];
      return { start:a, end:a.slice(), kind:'year', bad:false };
    }
    // фоллбэк — хотя бы одна дата
    m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})/);
    if (m) {
      const a=[yFix(m[3]),+m[2],+m[1]];
      return { start:a, end:a.slice(), kind:'fallback', bad:true };
    }
    return { start:TMAX, end:TMAX, kind:'unknown', bad:true };
  }

  // ===== декодирование страниц без кракозябр
  function countFFFD(s){return (s.match(/\uFFFD/g)||[]).length}
  function countCyr(s){return (s.match(/[А-Яа-яЁё]/g)||[]).length}
  function sniffMetaCharset(buf) {
    const head = new TextDecoder('windows-1252').decode(buf.slice(0,4096));
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
    console.log('[FMV] fetch →', url);
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { credentials: 'include', signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();

      let headerCharset = '';
      const ct = res.headers.get('content-type') || '';
      const mCT = ct.match(/charset=([^;]+)/i);
      if (mCT) headerCharset = mCT[1].trim().toLowerCase();
      const metaCharset = sniffMetaCharset(buf);

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
        try { html = new TextDecoder(enc, { fatal: false }).decode(buf); } catch { continue; }
        const score = scoreDecoded(html, hints[enc]);
        if (score > best.score) best = { score, enc, html };
      }
      console.log(`[FMV] decode → ${best.enc}, �=${countFFFD(best.html)}, cyr=${countCyr(best.html)}`);
      return best.html;
    } finally { clearTimeout(t); }
  }

  // ===== парсинг первого поста темы
  const parseHTML = (html)=> new DOMParser().parseFromString(html,'text/html');
  const firstPostNode = (doc) =>
    doc.querySelector('.post.topicpost .post-content') ||
    doc.querySelector('.post.topicpost') || doc;

  function extractFromFirst(firstNode) {
    const locNode   = firstNode.querySelector('location');
    const castNode  = firstNode.querySelector('characters');
    const orderNode = firstNode.querySelector('order');

    const location = (locNode ? locNode.innerText.trim() : '').toLowerCase();
    const rawChars = castNode ? castNode.innerText : '';
    const characters = rawChars
      ? rawChars.split(CHAR_SPLIT).map(s=>s.trim().toLowerCase()).filter(Boolean)
      : [];

    let order = null;
    if (orderNode) {
      const num = parseInt(orderNode.textContent.trim(), 10);
      if (Number.isFinite(num)) order = num;
    }
    return { location, characters, order };
  }

  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const html = await fetchText(topicUrl);
      const doc  = parseHTML(html);
      const first = firstPostNode(doc);
      const { location, characters, order } = extractFromFirst(first);
      const { dateRaw, episode, hasBracket } = parseTitle(rawTitle);
      const range = parseDateRange(dateRaw);
      const dateBad = !hasBracket || range.bad;
      console.log('[FMV][date]', dateRaw || '(нет)', '→', range.start, '-', range.end, '('+range.kind+')', 'bad=', dateBad, '| order=', order==null?'-':order);
      return { type, status, dateRaw, episode, url: topicUrl, location, characters, order, range, dateBad };
    } catch (e) {
      console.warn('[FMV] тема ✗', topicUrl, e);
      return null;
    }
  }

  // ===== обход разделов
  async function scrapeSection(section) {
    console.group(`[FMV] Раздел ${section.id} ${section.type}/${section.status}`);
    let page = `${BASE}/viewforum.php?id=${section.id}`;
    const seen = new Set();
    const out  = [];
    let pageCount = 0;

    while (page && !seen.has(page) && pageCount < MAX_PAGES_PER_SECTION) {
      pageCount++;
      console.log('[FMV]  страница:', page);
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
      console.log('[FMV]  тем найдено:', topics.size);

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
      console.log('[FMV]  следующая страница:', page || '(нет)');
    }

    console.groupEnd();
    return out;
  }

  // ===== сортировка
  const dateKey = (t) => t[0]*10000 + t[1]*100 + t[2];
  function compareEvents(a, b) {
    const sa = dateKey(a.range.start), sb = dateKey(b.range.start);
    if (sa !== sb) return sa - sb;

    const ea = dateKey(a.range.end),   eb = dateKey(b.range.end);
    if (ea !== eb) return ea - eb;

    const ao = (a.order == null) ? Number.POSITIVE_INFINITY : a.order;
    const bo = (b.order == null) ? Number.POSITIVE_INFINITY : b.order;
    if (ao !== bo) return ao - bo;

    return (a.episode||'').localeCompare(b.episode||'', 'ru', { sensitivity:'base' });
  }

  // ===== сборка HTML (со спойлером)
  async function buildWrappedHTML() {
    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec);
      all = all.concat(part);
    }
    all = all.filter(Boolean);
    console.log('[FMV] всего записей:', all.length);
    all.sort(compareEvents);

    const items = all.map(e => {
      const statusHTML = renderStatus(e.type, e.status); // HTML со span'ом
      const dateHTML = (e.dateBad || !e.dateRaw)
        ? `<span style="${MISS_STYLE}">дата не указана/ошибка</span>`
        : esc(e.dateRaw);

      const url = esc(e.url);
      const ttl = esc(e.episode);
      const orderBadge = (e.order!=null) ? ` <span>[${esc(String(e.order))}]</span>` : '';

      const chars = (e.characters && e.characters.length)
        ? esc(e.characters.join(', '))
        : `<span style="${MISS_STYLE}">не указаны</span>`;

      const loc = e.location
        ? esc(e.location)
        : `<span style="${MISS_STYLE}">не указана</span>`;

      const tail = `${chars} / ${loc}`;

      return `<p>${statusHTML} <strong>${dateHTML}</strong> — <a href="${url}">${ttl}</a>${orderBadge}<br>` +
             `<span style="font-style:italic">${tail}</span></p>`;
    });

    const inner = items.join('') || '<p>— пусто —</p>';
    return `<div class="quote-box spoiler-box media-box">` +
           `<div onclick="toggleSpoiler(this);" class="">хронология</div>` +
           `<blockquote class="">${inner}</blockquote>` +
           `</div>`;
  }

  // ===== ожидание и инъекция в #p83-content
  function waitForP83() {
    return new Promise(resolve => {
      const now = document.querySelector('#p83-content');
      if (now) return resolve(now);
      const obs = new MutationObserver(() => {
        const el = document.querySelector('#p83-content');
        if (el) { obs.disconnect(); resolve(el); }
      });
      obs.observe(document.documentElement, { childList:true, subtree:true });
    });
  }

  async function run() {
    console.group('[FMV] Инъекция в #p83-content');
    const host = await waitForP83();
    console.log('[FMV] #p83-content найден:', !!host);

    host.innerHTML = '<div class="fmv-chrono-box" style="white-space:normal;font:inherit">Готовлю хронологию…</div>';
    const box = host.querySelector('.fmv-chrono-box');

    try {
      const wrapped = await buildWrappedHTML();
      host.innerHTML = wrapped;
      console.log('[FMV] Готово.');
    } catch (e) {
      console.error('[FMV] Ошибка:', e);
      box.textContent = 'Ошибка при сборке хронологии.';
    }
    console.groupEnd(); // инъекция
    console.groupEnd(); // глобальная
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once:true });
  } else {
    run();
  }
})();
