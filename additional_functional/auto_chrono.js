/**
 * FMV Timeline Injector
 * - Целевая страница: https://testfmvoice.rusff.me/viewtopic.php?id=13
 * - Собирает темы из разделов:
 *     4 → [personal / on]
 *     5 → [personal / off]
 * - Для каждой темы:
 *     * дата и название из заголовка темы: "[дата] название"
 *     * location и characters — из ПЕРВОГО поста, теги <location> и <characters> (innerText)
 *     * characters: split по , ; / & и слову "и", в lowercase, trim()
 *     * location: lowercase
 * - Сортировка: от старых дат к новым
 * - Формат строки:
 *     [personal / on|off] [b]дата[/b] — [url=ссылка]название[/url]
 *     [i]участники через запятую / локация[/i]
 * - Результат подставляется вместо ВСЕГО содержимого #p83-content
 */
(function () {
  'use strict';

  // --- 0) Проверка URL (игнорируем hash) ---
  try {
    const u = new URL(location.href);
    const ok = (u.hostname === 'testfmvoice.rusff.me'
             && u.pathname === '/viewtopic.php'
             && u.searchParams.get('id') === '13');
    if (!ok) {
      console.info('[FMV] Не целевой URL, выходим:', location.href);
      return;
    }
  } catch {
    console.warn('[FMV] Не смог распарсить URL, выходим.');
    return;
  }

  console.group('[FMV] Timeline injector: старт');

  // --- 1) Константы/регэкспы ---
  const BASE = 'https://testfmvoice.rusff.me';
  const SECTIONS = [
    { id: 4, label: '[personal / on]'  },
    { id: 5, label: '[personal / off]' },
  ];
  const MAX_PAGES_PER_SECTION = 50; // защитный лимит
  const CHAR_SPLIT = /\s*(?:,|;|\/|&|\bи\b)\s*/iu; // разделители для characters
  const TITLE_RE   = /^\s*\[(.+?)\]\s*(.+)$/s;     // "[дата] название"

  // --- 2) Утилиты ---
  const abs = (base, href) => { try { return new URL(href, base).href; } catch { return href; } };
  const trimSp = (s) => String(s||'').replace(/\s+/g,' ').trim();

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

  // --- 3) fetchText с правильной декодировкой (UTF-8 / windows-1251) ---
  async function fetchText(url, timeoutMs = 20000) {
    console.log('[FMV] fetch →', url);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { credentials: 'include', signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();

      // 1) charset из заголовка
      let charset = '';
      const ct = res.headers.get('content-type') || '';
      const mCT = ct.match(/charset=([^;]+)/i);
      if (mCT) charset = mCT[1].trim().toLowerCase();

      // 2) если в заголовке нет — попробуем найти в <meta ... charset=...>
      if (!charset) {
        const sniff = new TextDecoder('windows-1252').decode(buf.slice(0, 4096));
        const mMeta = sniff.match(/charset\s*=\s*["']?([\w-]+)/i);
        if (mMeta) charset = mMeta[1].toLowerCase();
      }

      const countFFFD = s => (s.match(/\uFFFD/g) || []).length;

      // 3) пробуем указанную/utf-8
      let html;
      try {
        html = new TextDecoder(charset || 'utf-8', { fatal: false }).decode(buf);
      } catch {
        html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      }

      // 4) если остались � — пробуем windows-1251
      if (/\uFFFD/.test(html)) {
        try {
          const html1251 = new TextDecoder('windows-1251', { fatal: false }).decode(buf);
          if (countFFFD(html1251) < countFFFD(html)) {
            console.log('[FMV] Переключился на windows-1251 для', url);
            html = html1251;
          }
        } catch {/* оставляем как есть */}
      }

      return html;
    } finally {
      clearTimeout(t);
    }
  }

  const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

  // --- 4) Парсинг темы ---
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
      console.log('[FMV]   тема ✓', { date, episode, location, characters, url: topicUrl });
      return { label, date, episode, url: topicUrl, location, characters };
    } catch (e) {
      console.warn('[FMV]   тема ✗', topicUrl, e);
      return null;
    }
  }

  // --- 5) Обход раздела с пагинацией ---
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

      // Собираем уникальные темы (по id)
      const topicsMap = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
        const href = abs(page, a.getAttribute('href'));
        const m = href.match(/viewtopic\.php\?id=(\d+)/i);
        if (!m) return;
        const id = m[1];
        const title = a.textContent || a.innerText || '';
        if (/^\s*(RSS|Atom)\s*$/i.test(title)) return; // не берём сервисные ссылки
        if (!topicsMap.has(id)) topicsMap.set(id, { url: href, title });
      });

      console.log('[FMV]  найдено тем (уник.):', topicsMap.size);

      for (const { url, title } of topicsMap.values()) {
        console.groupCollapsed('[FMV]   тема →', url);
        const row = await scrapeTopic(url, title, section.label);
        if (row) out.push(row);
        console.groupEnd();
      }

      // Пагинация "вперёд"
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

  // --- 6) Сборка хронологии ---
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

  // --- 7) Ждём #p83-content и полностью заменяем содержимое ---
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

    // Заглушка
    host.innerHTML = '<div class="fmv-chrono-box" style="white-space:pre-wrap; font:inherit;">Готовлю хронологию…</div>';
    const box = host.querySelector('.fmv-chrono-box');

    try {
      const text = await buildTimelineText();
      // Показываем как простой текст (чтобы не выполнять ничего)
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
