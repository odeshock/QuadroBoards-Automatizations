<script>
/**
 * FMV Timeline Injector (фикс поиска спойлера + обновление шаблона)
 * Страница: https://testfmvoice.rusff.me/viewtopic.php?id=13
 * Кладёт собранную хронологию в пост #p83, спойлер "хронология".
 */
(function () {
  'use strict';

  // --- 0) Целевая страница ---
  try {
    const u = new URL(location.href);
    const ok = (u.hostname === 'testfmvoice.rusff.me'
             && u.pathname === '/viewtopic.php'
             && u.searchParams.get('id') === '13');
    if (!ok) {
      console.info('[FMV] Не целевой URL, выходим:', location.href);
      return;
    }
  } catch (e) {
    console.warn('[FMV] Не смог распарсить URL, выходим.');
    return;
  }

  console.group('[FMV] Timeline injector: старт');

  // --- 1) Константы и регэкспы ---
  const BASE = 'https://testfmvoice.rusff.me';
  const SECTIONS = [
    { id: 4, label: '[personal / on]'  },
    { id: 5, label: '[personal / off]' },
  ];
  const CHAR_SPLIT = /\s*(?:,|;|\/|&|\bи\b)\s*/iu;
  const TITLE_RE   = /^\s*\[(.+?)\]\s*(.+)$/s;
  const MAX_PAGES_PER_SECTION = 50;

  // --- 2) Утилиты ---
  const abs = (base, href) => { try { return new URL(href, base).href; } catch { return href; } };
  const trimSp = (s) => String(s||'').replace(/\s+/g,' ').trim();
  const escapeHTML = (s) => String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

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

  async function fetchText(url, timeoutMs = 20000) {
    console.log('[FMV] fetch →', url);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { credentials: 'include', signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } finally {
      clearTimeout(t);
    }
  }

  const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

  // --- 3) Достаём данные темы ---
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

  // --- 4) Обход раздела с пагинацией ---
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

  // --- 5) Сборка хронологии ---
  async function buildTimeline() {
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

  // --- 6) Ожидание DOM и инъекция ---
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

  async function inject() {
    console.group('[FMV] Инъекция в пост #p83');
    const host = await waitForP83();
    console.log('[FMV] Нашли #p83-content:', !!host);

    // Найдём все спойлеры и залогируем их заголовки
    const allSpoilers = Array.from(host.querySelectorAll('.quote-box.spoiler-box'));
    console.log('[FMV] Всего спойлеров в #p83-content:', allSpoilers.length);
    allSpoilers.forEach((box, i) => {
      const head = box.querySelector('div[onclick*="toggleSpoiler"]') ||
                   box.querySelector('.visible') ||
                   box.firstElementChild;
      console.log(`[FMV]  спойлер[${i}] заголовок:`, (head?.textContent || '').trim());
    });

    // Ищем тот, у которого заголовок содержит "хронология" (без опоры на .visible)
    const spoilerBox = allSpoilers.find(box => {
      const head = box.querySelector('div[onclick*="toggleSpoiler"]') ||
                   box.querySelector('.visible') ||
                   box.firstElementChild;
      const title = (head?.textContent || '').trim().toLowerCase();
      return title.includes('хронология');
    });

    if (!spoilerBox) {
      console.warn('[FMV] Спойлер "хронология" не найден в #p83-content');
      console.groupEnd();
      console.groupEnd();
      return;
    }
    console.log('[FMV] Спойлер "хронология" найден.');

    const bq  = spoilerBox.querySelector('blockquote');
    const tpl = spoilerBox.querySelector('script[type="text/html"]');

    if (!bq)  console.warn('[FMV] Внутри спойлера нет <blockquote> — это необычно.');
    if (!tpl) console.warn('[FMV] Внутри спойлера нет <script type="text/html"> (шаблона).');

    if (bq)  bq.textContent = 'Загрузка хронологии...';
    if (tpl) tpl.textContent = '<p>Загрузка хронологии...</p>';

    try {
      const text = await buildTimeline();
      const html = '<p>' + escapeHTML(text).replace(/\n/g, '<br>') + '</p>';

      // 1) Заполним шаблон — чтобы при разворачивании спойлера показался наш текст
      if (tpl) {
        tpl.textContent = html; // textContent, чтобы не выполнять скрипты при вставке
        console.log('[FMV] Обновили шаблон <script type="text/html">');
      }

      // 2) Попробуем сразу показать внутри <blockquote> (если он уже открыт)
      if (bq) {
        bq.innerHTML = html;
        console.log('[FMV] Обновили содержимое <blockquote>');
      }

      console.log('[FMV] Инъекция завершена успешно.');
    } catch (e) {
      console.error('[FMV] Ошибка при сборке хронологии:', e);
      if (bq)  bq.textContent  = 'Ошибка при сборке хронологии.';
      if (tpl) tpl.textContent = '<p>Ошибка при сборке хронологии.</p>';
    }

    console.groupEnd(); // Инъекция
    console.groupEnd(); // Главная группа
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
</script>
