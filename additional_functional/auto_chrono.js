
/**
 * FMV Timeline Injector
 * Страница: https://testfmvoice.rusff.me/viewtopic.php?id=13
 * Вставляет собранную хронологию в пост #p83 (спойлер "хронология").
 */
(function () {
  'use strict';

  // --- 0) Жёсткая проверка URL ------------------------------------------
  try {
    const u = new URL(location.href);
    const okHost = u.hostname === 'testfmvoice.rusff.me';
    const okPath = u.pathname === '/viewtopic.php';
    const okId   = u.searchParams.get('id') === '13';
    if (!(okHost && okPath && okId)) {
      console.info('[FMV] URL не целевой, скрипт не запускается.', { href: location.href });
      return;
    }
  } catch (e) {
    console.warn('[FMV] Не удалось распарсить URL, прекращаю работу.');
    return;
  }

  console.group('[FMV] Timeline injector: запуск');

  // --- 1) Константы и регэкспы ------------------------------------------
  const BASE = 'https://testfmvoice.rusff.me';
  const SECTIONS = [
    { id: 4, label: '[personal / on]'  },
    { id: 5, label: '[personal / off]' },
  ];
  const CHAR_SPLIT = /\s*(?:,|;|\/|&|\bи\b)\s*/iu;
  const TITLE_RE   = /^\s*\[(.+?)\]\s*(.+)$/s;

  // --- 2) Вспомогательные функции ---------------------------------------
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

  // fetch с таймаутом и логами
  async function fetchText(url, timeoutMs = 20000) {
    console.log('[FMV] fetch →', url);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { credentials: 'include', signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = await r.text();
      return txt;
    } finally {
      clearTimeout(t);
    }
  }

  function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // --- 3) Извлечение данных темы ----------------------------------------
  function extractFirstPostNode(doc) {
    // Обычно первый пост: .post.topicpost .post-content
    return (
      doc.querySelector('.post.topicpost .post-content') ||
      doc.querySelector('.post.topicpost') ||
      doc
    );
  }

  function extractLocAndChars(firstPostNode) {
    const locNode  = firstPostNode.querySelector('location');
    const castNode = firstPostNode.querySelector('characters');

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
      const first = extractFirstPostNode(doc);
      const { location, characters } = extractLocAndChars(first);
      const { date, episode } = parseTitle(rawTitle);
      console.log('[FMV]   тема ок:', { date, episode, location, characters, url: topicUrl });
      return { label, date, episode, url: topicUrl, location, characters };
    } catch (e) {
      console.warn('[FMV]   тема ошибка:', topicUrl, e);
      return null;
    }
  }

  // --- 4) Обход раздела с пагинацией ------------------------------------
  async function scrapeSection(section) {
    console.group(`[FMV] Раздел ${section.id} ${section.label}`);
    let page = `${BASE}/viewforum.php?id=${section.id}`;
    const seen = new Set();
    const out  = [];

    while (page && !seen.has(page)) {
      console.log('[FMV]  страница:', page);
      seen.add(page);
      const html = await fetchText(page);
      const doc  = parseHTML(html);

      // Ссылки на темы (уникальные по id)
      const topicsMap = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
        const href = abs(page, a.getAttribute('href'));
        const m = href.match(/viewtopic\.php\?id=(\d+)/i);
        if (!m) return;
        const id = m[1];
        // брать текст только из списков тем, по возможности
        const title = a.textContent || a.innerText || '';
        if (!topicsMap.has(id)) topicsMap.set(id, { url: href, title });
      });

      console.log('[FMV]  найдено ссылок на темы (грубый счётчик):', topicsMap.size);

      for (const { url, title } of topicsMap.values()) {
        console.groupCollapsed('[FMV]   тема:', url);
        const row = await scrapeTopic(url, title, section.label);
        if (row) out.push(row);
        console.groupEnd();
      }

      // Навигация: rel=next или ссылки по тексту
      const nextRel = doc.querySelector('a[rel="next"]');
      let nextHref  = nextRel ? nextRel.getAttribute('href') : null;
      if (!nextHref) {
        const nextTxt = Array.from(doc.querySelectorAll('a'))
          .find(a => /\b(След|Next|»|›)\b/i.test(a.textContent || ''));
        if (nextTxt) nextHref = nextTxt.getAttribute('href');
      }
      page = nextHref ? abs(page, nextHref) : null;
      console.log('[FMV]  следующая страница:', page || '(нет)');
    }

    console.groupEnd();
    return out;
  }

  // --- 5) Сборка хронологии ---------------------------------------------
  async function buildTimeline() {
    console.group('[FMV] Сборка хронологии');
    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec);
      all = all.concat(part);
    }

    console.log('[FMV] Всего записей до сортировки:', all.length);
    all.sort((a, b) => dateToTs(a.date) - dateToTs(b.date));
    console.log('[FMV] Сортировка по дате: OK');

    const lines = all.map(e =>
      `${e.label} [b]${e.date}[/b] — [url=${e.url}]${e.episode}[/url]\n` +
      `[i]${e.characters.join(', ')} / ${e.location || ''}[/i]`
    );

    const text = lines.join('\n\n').trim();
    console.log('[FMV] Готовый текст длина:', text.length);
    console.groupEnd();
    return text;
  }

  // --- 6) Ожидание DOM и инъекция ---------------------------------------
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

    // Ищем спойлер "хронология"
    const spoilerBox = Array.from(host.querySelectorAll('.quote-box'))
      .find(box => /хронология/i.test(box.querySelector('.visible')?.textContent || ''));

    if (!spoilerBox) {
      console.warn('[FMV] Спойлер "хронология" не найден в #p83-content');
      console.groupEnd();
      console.groupEnd();
      return;
    }

    const para = spoilerBox.querySelector('blockquote p') || spoilerBox.querySelector('blockquote') || spoilerBox;
    para.textContent = 'Загрузка хронологии...';
    console.log('[FMV] Спойлер найден. Запускаю сборку…');

    try {
      const text = await buildTimeline();
      para.textContent = text || '— пусто —';
      console.log('[FMV] Инъекция завершена.');
    } catch (e) {
      console.error('[FMV] Ошибка при сборке хронологии:', e);
      para.textContent = 'Ошибка при сборке хронологии.';
    }

    console.groupEnd(); // Инъекция
    console.groupEnd(); // Главная группа
  }

  // Старт после интерактивности DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true });
  } else {
    inject();
  }
})();
