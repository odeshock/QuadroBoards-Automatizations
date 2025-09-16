(function () {
  'use strict';

  /* ===== Активируемся только в нужном разделе ===== */
  try {
    const u = new URL(location.href);
    if (!(u.hostname === 'testfmvoice.rusff.me' &&
          u.pathname === '/viewforum.php' &&
          u.searchParams.get('id') === '8')) {
      return;
    }
  } catch { return; }

  /* ============================ КОНФИГ ============================ */
  const BASE = 'https://testfmvoice.rusff.me';

  // Единственный раздел по ТЗ
  const SECTIONS = [
    { id: 8, type: 'au', status: 'on' },
  ];

  const MAX_PAGES_PER_SECTION = 50;
  const MAX_PAGES_USERLIST    = 200;

  // элементы/стили
  const BTN_ID  = 'fmv-chrono-au-btn';
  const OUT_ID  = 'fmv-chrono-au-out';
  const NOTE_ID = 'fmv-chrono-au-note';

  // стиль подсветки ошибки
  const MISS_STYLE = 'background:#ffeaea;color:#b00020;padding:0 3px;border-radius:3px';

  // разделитель имён/локаций
  const CHAR_SPLIT = /\s*(?:,|;|\/|&|\bи\b)\s*/iu;

  /* ---------- статусный бейдж (тип + статус) ---------- */
  function renderStatus(type, status) {
    const map = {
      on:       { word: 'active',   color: 'green'  },
      off:      { word: 'closed',   color: 'teal'   },
      archived: { word: 'archived', color: 'maroon' }
    };
    const st = map[status] || map.on;
    const typeHTML = `<span style="color:red">${escapeHtml(type)}</span>`; // тип au красным
    return `[${typeHTML} / <span style="color:${st.color}">${st.word}</span>]`;
  }

  /* ---------- заголовок темы ---------- */
  const TITLE_RE = /^\s*\[(.+?)\]\s*(.+)$/s;
  function parseTitleForAU(text) {
    const t = String(text||'');
    const m = t.match(TITLE_RE);
    if (!m) return { tag: '', tagOk: false, episode: trimSp(t) };
    const tagRaw = m[1].trim();
    const episode = m[2].trim();
    const tagOk = tagRaw.toLowerCase() === 'au';
    return { tag: tagRaw, tagOk, episode };
  }

  /* ---------- Новый декодер для чтения текста из DOM ---------- */
  function safeNodeText(node) {
    const raw = (node && (node.innerText ?? node.textContent) || '').trim();
    if (!raw) return '';
    const looksBroken = /[\uFFFD]|[ÃÂÐÑ]{2,}/.test(raw);
    if (!looksBroken) return raw;

    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xFF;

    const candidates = [raw];
    try { candidates.push(new TextDecoder('utf-8').decode(bytes)); } catch {}
    try { candidates.push(new TextDecoder('windows-1251').decode(bytes)); } catch {}

    const score = (s) => {
      const cyr = (s.match(/[А-Яа-яЁё]/g)||[]).length;
      const bad = (s.match(/[\uFFFD]/g)||[]).length + (s.match(/[ÃÂÐÑ]/g)||[]).length;
      return cyr * 4 - bad * 5;
    };

    let best = candidates[0], bestScore = score(best);
    for (const c of candidates.slice(1)) {
      const sc = score(c);
      if (sc > bestScore) { best = c; bestScore = sc; }
    }
    return best;
  }

  /* ---------- сеть/парс ---------- */
  function countFFFD(s){return (s.match(/[\uFFFD]/g)||[]).length}
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
    const hasHtml = /<\/html>/i.test(html) ? 1 : 0;
    const hasHead = /<\/head>/i.test(html) ? 1 : 0;
    const hintBonus = hint ? 2 : 0;
    return (sCyr * 5) + (hasHtml + hasHead + hintBonus) * 3 - (sFFFD * 50);
  }
  async function fetchText(url, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { credentials:'include', signal:ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();

      const ct = res.headers.get('content-type') || '';
      const mCT = ct.match(/charset=([^;]+)/i);
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
        try { html = new TextDecoder(enc, { fatal:false }).decode(buf); }
        catch { continue; }
        const score = scoreDecoded(html, hints[enc]);
        if (score > best.score) best = { score, enc, html };
      }
      return best.html;
    } finally { clearTimeout(t); }
  }
  const parseHTML = (html)=> new DOMParser().parseFromString(html,'text/html');

  /* ---------- MНОЖЕСТВЕННЫЕ location/characters/order ---------- */
  function extractFromFirst(firstNode) {
    const locSet = new Set();
    firstNode.querySelectorAll('location').forEach(n => {
      const raw = safeNodeText(n);
      if (!raw) return;
      raw.split(CHAR_SPLIT).map(s=>s.trim()).filter(Boolean).map(s=>s.toLowerCase()).forEach(v=>locSet.add(v));
    });
    const locationsLower = Array.from(locSet);

    const charSet = new Set();
    firstNode.querySelectorAll('characters').forEach(n => {
      const raw = safeNodeText(n);
      if (!raw) return;
      raw.split(CHAR_SPLIT).map(s=>s.trim()).filter(Boolean).map(s=>s.toLowerCase()).forEach(v=>charSet.add(v));
    });
    const charactersLower = Array.from(charSet);

    let order = null;
    const orderNode = firstNode.querySelector('order');
    if (orderNode) {
      const num = parseInt(safeNodeText(orderNode), 10);
      if (Number.isFinite(num)) order = num;
    }

    return { locationsLower, charactersLower, order };
  }

  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const html = await fetchText(topicUrl);
      const doc  = parseHTML(html);
      const first= doc.querySelector('.post.topicpost .post-content') ||
                   doc.querySelector('.post.topicpost') || doc;

      const { locationsLower, charactersLower, order } = extractFromFirst(first);
      const { tag, tagOk, episode } = parseTitleForAU(rawTitle);

      // Для AU: дат нет. Ошибку показываем только если [au] отсутствует или не lowercase.
      const tagError = !tagOk; // true => подсветим в «дате»

      return {
        type, status, url: topicUrl,
        tag, tagOk, tagError,
        episode, locationsLower, charactersLower, order
      };
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
        const m    = href.match(/viewtopic\.php\?id=(\d+)/i);
        if (!m) return;
        const id = m[1];
        const title = safeNodeText(a);
        if (/^\s*(RSS|Atom)\s*$/i.test(title)) return;
        if (!topics.has(id)) topics.set(id, { url: href, title });
      });

      for (const { url, title } of topics.values()) {
        const row = await scrapeTopic(url, title, section.type, section.status);
        if (row) out.push(row);
      }

      const nextRel  = doc.querySelector('a[rel="next"]');
      let nextHref   = nextRel ? nextRel.getAttribute('href') : null;
      if (!nextHref) {
        const candidate = Array.from(doc.querySelectorAll('a'))
          .find(a => /\b(След|Next|»|›)\b/i.test(safeNodeText(a) || ''));
        if (candidate) nextHref = candidate.getAttribute('href');
      }
      page = nextHref ? abs(page, nextHref) : null;
    }
    return out;
  }

  // Сортировка для AU: по order (отсутствие => 0), потом по названию (алфавитно)
  function compareAU(a, b) {
    const ao = (a.order == null) ? 0 : a.order;
    const bo = (b.order == null) ? 0 : b.order;
    if (ao !== bo) return ao - bo;
    const an = a.episode || '';
    const bn = b.episode || '';
    return an.localeCompare(bn, 'ru', { sensitivity:'base' });
  }

  /* ================= СБОРКА HTML ================= */
  async function buildWrappedHTML() {
    const nameToProfile = await scrapeAllUsers();

    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec);
      all = all.concat(part);
    }

    all = all.filter(Boolean);
    all.sort(compareAU);

    function renderNames(lowerArr) {
      if (!lowerArr || !lowerArr.length) {
        return `<span style="${MISS_STYLE}">не указаны</span>`;
      }
      return lowerArr.map((low) => {
        const href  = nameToProfile.get(low);
        const shown = escapeHtml(low);
        if (href) return `<a href="${escapeHtml(href)}" rel="nofollow">${shown}</a>`;
        return `<span style="${MISS_STYLE}">${shown}</span>`;
      }).join(', ');
    }

    const items = all.map(e => {
      const statusHTML = renderStatus(e.type, e.status);
      const dateHTML   = e.tagError
        ? `<span style="${MISS_STYLE}">[au] отсутствует или не lowercase</span>`
        : '—'; // дат не ждём

      const url        = escapeHtml(e.url);
      const ttl        = escapeHtml(e.episode);
      const orderBadge = ` [${escapeHtml(String(e.order == null ? 0 : e.order))}]`;

      const names = renderNames(e.charactersLower);

      const loc = (e.locationsLower && e.locationsLower.length)
        ? escapeHtml(e.locationsLower.join(', '))
        : `<span style="${MISS_STYLE}">локация не указана</span>`;

      return `<p>${statusHTML} ${dateHTML} — <a href="${url}" rel="nofollow">${ttl}</a>${orderBadge}<br><i>${names}</i> / ${loc}</p>`;
    });

    const body = items.join('') || `<p><i>— пусто —</i></p>`;

    return `
<div class="quote-box spoiler-box media-box">
  <div onclick="toggleSpoiler(this)">Собранная хронология (AU)</div>
  <blockquote>${body}</blockquote>
</div>`;
  }

  async function scrapeAllUsers() {
    let page = `${BASE}/userlist.php`;
    const seen = new Set();
    const nameToProfile = new Map();
    let cnt = 0;

    while (page && !seen.has(page) && cnt < MAX_PAGES_USERLIST) {
      cnt++;
      seen.add(page);

      const html = await fetchText(page);
      const doc  = parseHTML(html);

      const anchors = doc.querySelectorAll('.usersname a, a[href*="profile.php?id="]');
      anchors.forEach(a=>{
        const nameText = safeNodeText(a);
        if (!nameText) return;
        const norm = nameText.toLowerCase();
        if (!nameToProfile.has(norm)) {
          nameToProfile.set(norm, abs(page, a.getAttribute('href')));
        }
      });

      const nextRel  = doc.querySelector('a[rel="next"]');
      let nextHref   = nextRel ? nextRel.getAttribute('href') : null;
      if (!nextHref) {
        const candidate = Array.from(doc.querySelectorAll('a'))
          .find(a => /\b(След|Next|»|›)\b/i.test(safeNodeText(a) || ''));
        if (candidate) nextHref = candidate.getAttribute('href');
      }
      page = nextHref ? abs(page, nextHref) : null;
    }
    return nameToProfile;
  }

  /* =================== ЗАПУСК ПО КНОПКЕ + ВСТАВКА В ВЕРХ СТРАНИЦЫ =================== */
  async function handleBuild(opts) {
    const btn  = opts?.buttonEl || document.getElementById(BTN_ID);
    const note = opts?.noteEl   || document.getElementById(NOTE_ID);

    try {
      let host = document.getElementById(OUT_ID);
      if (!host) {
        host = document.createElement('div');
        host.id = OUT_ID;
        host.style.margin = '12px 0';
        const anchor = document.querySelector('#pun-main, .pun-main, body');
        (anchor || document.body).insertBefore(host, (anchor || document.body).firstChild);
      }

      if (btn)  { btn.disabled = true; btn.textContent = 'Собираю…'; }
      if (note) { note.textContent = 'Готовлю хронологию…'; note.style.opacity = '.85'; note.classList.remove('fmv-note-bad'); }

      const html = await buildWrappedHTML();
      host.innerHTML = html;

      if (btn)  { btn.disabled = false; btn.textContent = 'Пересобрать хронологию'; }
      if (note) { note.textContent = 'Готово'; note.style.opacity = '1'; }
    } catch (e) {
      console.warn('[FMV] ошибка сборки:', e);
      if (btn)  { btn.disabled = false; btn.textContent = 'Пересобрать хронологию'; }
      if (note) { note.textContent = 'Ошибка'; note.classList.add('fmv-note-bad'); }
    }
  }

  /* ======================== UI: кнопка (фикс. в углу) ======================== */
  function ensureStyles() {
    if (document.getElementById('fmv-chrono-au-styles')) return;
    const css = `
      #${BTN_ID}{ position:fixed; right:14px; bottom:14px; z-index:9999; }
      #${NOTE_ID}{ position:fixed; right:14px; bottom:50px; font-size:90%; opacity:.85; background: rgba(0,0,0,.04); padding: 2px 6px; border-radius: 4px; }
      .fmv-note-bad{ background: rgba(200,0,0,.14) !important; }
    `.trim();
    const style = document.createElement('style');
    style.id = 'fmv-chrono-au-styles';
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  function mountFloatingButton() {
    if (document.getElementById(BTN_ID)) return true;

    const btn = document.createElement('a');
    btn.id = BTN_ID;
    btn.href = 'javascript:void(0)';
    btn.className = 'button';
    btn.textContent = 'Собрать AU-хронологию';

    const note = document.createElement('span');
    note.id = NOTE_ID;

    document.body.appendChild(btn);
    document.body.appendChild(note);

    btn.addEventListener('click', () => handleBuild({ buttonEl: btn, noteEl: note }));

    return true;
  }

  /* ============================== INIT ============================== */
  function init() {
    ensureStyles();
    mountFloatingButton();
    window.FMV_buildChronology = handleBuild;
  }

  /* ============================== HELPERS ============================== */
  const escapeHtml = (s='') => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
  const trimSp = (s) => String(s||'').replace(/\s+/g,' ').trim();
  const abs = (base, href) => { try { return new URL(href, base).href; } catch { return href; } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
