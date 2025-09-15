/**
 * FMV Timeline Injector (robust decode)
 * Страница: https://testfmvoice.rusff.me/viewtopic.php?id=13
 * Разделы:
 *   4 → [personal / on]
 *   5 → [personal / off]
 * Формат строки:
 *   [personal / on|off] [b]дата[/b] — [url=ссылка]название[/url]
 *   [i]участники через запятую / локация[/i]
 */
(function () {
  'use strict';

  // --- URL-guard (игнорируем hash) ---
  try {
    const u = new URL(location.href);
    const ok = (u.hostname === 'testfmvoice.rusff.me'
             && u.pathname === '/viewtopic.php'
             && u.searchParams.get('id') === '13');
    if (!ok) { console.info('[FMV] Не целевой URL:', location.href); return; }
  } catch { console.warn('[FMV] Не смог распарсить URL'); return; }

  console.group('[FMV] Timeline injector: старт');

  // --- Константы ---
  const BASE = 'https://testfmvoice.rusff.me';
  const SECTIONS = [
    { id: 4, label: '[personal / on]'  },
    { id: 5, label: '[personal / off]' },
  ];
  const MAX_PAGES_PER_SECTION = 50;
  const CHAR_SPLIT = /\s*(?:,|;|\/|&|\bи\b)\s*/iu; // делители имён
  const TITLE_RE   = /^\s*\[(.+?)\]\s*(.+)$/s;     // "[дата] название"

  // --- Утилиты ---
  const abs = (base, href) => { try { return new URL(href, base).href; } catch { return href; } };
  const trimSp = (s) => String(s||'').replace(/\s+/g,' ').trim();
  const countFFFD = s => (s.match(/\uFFFD/g) || []).length;
  const countCyr  = s => (s.match(/[А-Яа-яЁё]/g) || []).length;

  function parseTitle(text) {
    const m = String(text||'').match(TITLE_RE);
    return m ? { date: m[1].trim(), episode: m[2].trim() } : { date: '', episode: trimSp(text) };
  }

  function dateToTs(ddmmyy) {
    const m = String(ddmmyy||'').match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (!m) return 0;
    let [, d, mm, y] = m;
    d = +d; mm = +mm; y = +y;
    if (String(y).length === 2) y = (y >= 50 ? 1900 : 2000) + y;
    const ts = Date.UTC(y, mm - 1, d);
    return isNaN(ts) ? 0 : ts;
  }

  // =========================
  //  Декодер с эвристикой
  // =========================
  function sniffMetaCharset(buf) {
    // ASCII/latin всегда читаемы → достаточно 4KB
    const headGuess = new TextDecoder('windows-1252').decode(buf.slice(0, 4096));
    const m1 = headGuess.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
    if (m1) return m1[1].toLowerCase();
    const m2 = headGuess.match(/content\s*=\s*["'][^"']*charset=([\w-]+)/i);
    if (m2) return m2[1].toLowerCase();
    return '';
  }

  function scoreDecoded(html, hint) {
    // Чем меньше � и больше кириллицы — тем лучше.
    // Наличие <html> и <head> даёт небольшой бонус.
    const sFFFD = countFFFD(html);
    const sCyr  = countCyr(html);
    const hasHtml = /<html[^>]*>/i.test(html) ? 1 : 0;
    const hasHead = /<head[^>]*>/i.test(html) ? 1 : 0;
    const hintBonus = hint ? 2 : 0;
    // Итоговая метрика:
    return (sCyr * 5) + (hasHtml + hasHead + hintBonus) * 3 - (sFFFD * 50);
  }

  async function fetchText(url, timeoutMs = 20000) {
    console.log('[FMV] fetch →', url);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { credentials: 'include', signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();

      // Подсказки: заголовок и meta
      let headerCharset = '';
      const ct = res.headers.get('content-type') || '';
      const mCT = ct.match(/charset=([^;]+)/i);
      if (mCT) headerCharset = mCT[1].trim().toLowerCase();

      const metaCharset = sniffMetaCharset(buf);
      const hints = { 'utf-8': false, 'windows-1251': false };
      if (/utf-?8/i.test(headerCharset) || /utf-?8/i.test(metaCharset)) hints['utf-8'] = true;
      if (/1251|cp-?1251/i.test(headerCharset) || /1251|cp-?1251/i.test(metaCharset)) hints['windows-1251'] = true;

      // Кандидаты декодирования
      const tryOrder = [];
      // 1) если есть явный charset в заголовке — вперёд
      if (headerCharset) tryOrder.push(headerCharset);
      // 2) meta
      if (metaCharset && !tryOrder.includes(metaCharset)) tryOrder.push(metaCharset);
      // 3) стандартные
      ['utf-8','windows-1251'].forEach(enc => { if (!tryOrder.includes(enc)) tryOrder.push(enc); });

      let best = { score: -1e9, enc: '', html: '' };
      for (const enc of tryOrder) {
        let html = '';
        try {
          html = new TextDecoder(enc, { fatal: false }).decode(buf);
        } catch { continue; }
        const score = scoreDecoded(html, hints[enc]);
        if (score > best.score) best = { score, enc, html };
      }

      console.log(`[FMV] decode: header=${headerCharset||'-'} meta=${metaCharset||'-'} → chosen=${best.enc}, score=${best.score}, �=${countFFFD(best.html)}, cyr=${countCyr(best.html)}`);
      return best.html;
    } finally {
      clearTimeout(t);
    }
  }

  // --- Парсинг темы ---
  const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

  function firstPostNode(doc) {
    return (
      doc.querySelector('.post.topicpost .post-content') ||
      doc.querySelector('.post.topicpost') ||
      doc
    );
  }

  function extractLocAndChars(firstNode) {
    const locNode  = firstNode.querySelector('location');
    const castNode = firstNode.querySelector('characters');

    const location = locNode ? locNode.innerText.trim().toLowerCase() : '';
    const rawChars = castNode ? castNode.innerText : '';

    const characters = rawChars
      ? rawChars.split(CHAR_SPLIT).map(s => s.trim().toLowerCase()).filter(Boolean)
      : [];

    return { location, characters };
  }

  async function scrapeTopic(topicUrl, rawTitle, label) {
    try {
      const html = await fetchText(topicUrl);
      const doc  = parseHTML(html);
      const first = firstPostNode(doc);
      const { location, characters } = extractLocAndChars(first);
      const { date, episode } = parseTitle(rawTitle);
      // Локальный «ремонт»: если вдруг всё же есть �, попробуем выкинуть их
      const safeLoc = location.replace(/\uFFFD+/g,'').trim();
      const safeChars = characters.map(s => s.replace(/\uFFFD+/g,'').trim()).filter(Boolean);
      console.log('[FMV]   тема ✓', { date, episode, location: safeLoc, characters: safeChars, url: topicUrl });
      return { label, date, episode, url: topicUrl, location: safeLoc, characters: safeChars };
    } catch (e) {
      console.warn('[FMV]   тема ✗', topicUrl, e);
      return null;
    }
  }

  // --- Обход раздела ---
  async function scrapeSection(section) {
    console.group(`[FMV] Раздел ${section.id} ${section.label}`);
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

      const topicsMap = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
        const href = abs(page, a.getAttribute('href'));
        const m = href.match(/viewtopic\.php\?id=(\d+)/i);
        if (!m) return;
        const id = m[1];
        const title = a.textContent || a.innerText || '';
        if (/^\s*(RSS|Atom)\s*$/i.test(title)) return;
        if (!topicsMap.has(id)) topicsMap.set(id, { url: href, title });
      });

      console.log('[FMV]  найдено тем (уник.):', topicsMap.size);

      for (const { url, title } of topicsMap.values()) {
        console.groupCollapsed('[FMV]   тема →', url);
        const row = await scrapeTopic(url, title, section.label);
        if (row) out.push(row);
        console.groupEnd();
      }

      // next-пагинация
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

    if (pageCount >= MAX_PAGES_PER_SECTION) {
      console.warn('[FMV]  достигнут лимит страниц, оборвали обход.');
    }

    console.groupEnd();
    return out;
  }

  // --- Сборка хронологии ---
  async function buildTimelineText() {
    console.group('[FMV] Сборка хронологии');
    const t0 = performance.now();
    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec);
      all = all.concat(part);
    }
    all = all.filter(Boolean);

    console.log('[FMV] Всего записей до сортировки:', all.length);
    all.sort((a, b) => dateToTs(a.date) - dateToTs(b.date));
    console.log('[FMV] Сортировка по дате: OK');

    const lines = all.map(e =>
      `${e.label} [b]${e.date}[/b] — [url=${e.url}]${e.episode}[/url]\n` +
      `[i]${e.characters.join(', ')} / ${e.location || ''}[/i]`
    );

    const text = lines.join('\n\n').trim();
    const dt = Math.round(performance.now() - t0);
    console.log('[FMV] Готовый текст, символов:', text.length, 'за', dt, 'мс');
    console.groupEnd();
    return text;
  }

  // --- Инъекция в #p83-content ---
  function waitForP83() {
    return new Promise(resolve => {
      const now = document.querySelector('#p83-content');
      if (now) return resolve(now);
      const obs = new MutationObserver(() => {
        const el = document.querySelector('#p83-content');
        if (el) { obs.disconnect(); resolve(el); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  async function run() {
    console.group('[FMV] Инъекция в #p83-content');
    const host = await waitForP83();
    console.log('[FMV] Нашли #p83-content:', !!host);

    host.innerHTML = '<div class="fmv-chrono-box" style="white-space:pre-wrap; font:inherit;">Готовлю хронологию…</div>';
    const box = host.querySelector('.fmv-chrono-box');

    try {
      const text = await buildTimelineText();
      box.textContent = text || '— пусто —';
      console.log('[FMV] Инъекция завершена.');
    } catch (e) {
      console.error('[FMV] Ошибка при сборке хронологии:', e);
      box.textContent = 'Ошибка при сборке хронологии.';
    }

    console.groupEnd(); // Инъекция
    console.groupEnd(); // Главная группа
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
