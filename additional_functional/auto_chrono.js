
// == FMV timeline injector ===============================================
// Работает только на странице: https://testfmvoice.rusff.me/viewtopic.php?id=13#p83
(function () {
  const MUST_URL = 'https://testfmvoice.rusff.me/viewtopic.php?id=13';
  // жёсткая проверка адреса (включая хеш)
  if (location.href !== MUST_URL) return;

  const BASE = 'https://testfmvoice.rusff.me';
  const SECTIONS = [
    { id: 4, label: '[personal / on]'  },
    { id: 5, label: '[personal / off]' },
  ];
  const CHAR_SPLIT = /\s*(?:,|;|\/|&|\bи\b)\s*/iu;
  const TITLE_RE   = /^\s*\[(.+?)\]\s*(.+)$/s;

  // --- утилиты -----------------------------------------------------------
  const abs = (base, href) => { try { return new URL(href, base).href; } catch { return href; } };
  const decode = (s) => {
    if (!s) return '';
    const ta = document.createElement('textarea');
    ta.innerHTML = s;
    return ta.value;
  };
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

  // --- сетевые помощники -------------------------------------------------
  async function getHTML(url) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
    return await r.text();
  }

  function parseHTML(html) {
    const dp = new DOMParser();
    return dp.parseFromString(html, 'text/html');
  }

  // --- извлечь данные темы ----------------------------------------------
  function extractFirstPostBlock(doc) {
    // На РУСФФ первый пост обычно внутри .post.topicpost .post-content
    return (
      doc.querySelector('.post.topicpost .post-content') ||
      doc.querySelector('.post.topicpost') ||
      doc
    );
  }

  function extractLocAndChars(firstPostNode) {
    // Берём именно innerText (могут быть вложенные span и т.д.)
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
    const html = await getHTML(topicUrl);
    const doc  = parseHTML(html);
    const first = extractFirstPostBlock(doc);
    const { location, characters } = extractLocAndChars(first);
    const { date, episode } = parseTitle(decode(rawTitle));
    return { label, date, episode, url: topicUrl, location, characters };
  }

  // --- обойти раздел с пагинацией ---------------------------------------
  async function scrapeSection(section) {
    let page = `${BASE}/viewforum.php?id=${section.id}`;
    const seen = new Set();
    const out  = [];

    while (page && !seen.has(page)) {
      seen.add(page);
      const html = await getHTML(page);
      const doc  = parseHTML(html);

      // собрать ссылки на темы (уникальные по id)
      const map = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
        const href = abs(page, a.getAttribute('href'));
        const m = href.match(/viewtopic\.php\?id=(\d+)/i);
        if (!m) return;
        const id = m[1];
        if (!map.has(id)) {
          map.set(id, { url: href, title: a.textContent || a.innerText || '' });
        }
      });

      // загрузить темы
      for (const { url, title } of map.values()) {
        out.push(await scrapeTopic(url, title, section.label));
      }

      // пагинация: rel=next или текст "След"
      const nextRel = doc.querySelector('a[rel="next"]');
      let nextHref  = nextRel ? nextRel.getAttribute('href') : null;
      if (!nextHref) {
        const nextTxt = Array.from(doc.querySelectorAll('a')).find(a => /\b(След|Next|»|›)\b/i.test(a.textContent || ''));
        if (nextTxt) nextHref = nextTxt.getAttribute('href');
      }
      page = nextHref ? abs(page, nextHref) : null;
    }

    return out;
  }

  // --- главный сборщик ---------------------------------------------------
  async function buildTimeline() {
    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec);
      all = all.concat(part);
    }

    // сортировка по дате (старые → новые)
    all.sort((a, b) => dateToTs(a.date) - dateToTs(b.date));

    // финальный текст
    let buf = [];
    for (const e of all) {
      buf.push(
        `${e.label} [b]${e.date}[/b] — [url=${e.url}]${e.episode}[/url]\n` +
        `[i]${e.characters.join(', ')} / ${e.location || ''}[/i]`
      );
    }
    return buf.join('\n\n').trim();
  }

  // --- инъекция в пост #p83 ----------------------------------------------
  async function injectIntoSpoiler() {
    // ждём #p83-content (если DOM ещё рендерится)
    const ensureP83 = () => new Promise(resolve => {
      const el = document.querySelector('#p83-content');
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const found = document.querySelector('#p83-content');
        if (found) { obs.disconnect(); resolve(found); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    });

    const host = await ensureP83();

    // найти спойлер с заголовком "хронология"
    const spoilerBox = Array.from(host.querySelectorAll('.quote-box'))
      .find(box => /хронология/i.test(box.querySelector('.visible')?.textContent || ''));

    if (!spoilerBox) {
      console.error('Спойлер "хронология" не найден в #p83-content');
      return;
    }

    const para = spoilerBox.querySelector('blockquote p') || spoilerBox.querySelector('blockquote') || spoilerBox;
    para.textContent = 'Загрузка хронологии...';

    try {
      const text = await buildTimeline();
      // Подставляем BBCode как обычный текст (как и было в исходном <p>текст</p>)
      para.textContent = text || '— пусто —';
    } catch (err) {
      console.error('Ошибка при сборке хронологии:', err);
      para.textContent = 'Ошибка при сборке хронологии.';
    }
  }

  // запуск
  injectIntoSpoiler();
})();
