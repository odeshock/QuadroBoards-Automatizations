(function () {
  'use strict';

  /* ===== Активируемся только в нужной теме ===== */
  try {
    const u = new URL(location.href);
    if (!(u.hostname === 'testfmvoice.rusff.me' &&
          u.pathname === '/viewtopic.php' &&
          u.searchParams.get('id') === '13')) {
      return;
    }
  } catch { return; }

  /* ============================ КОНФИГ ============================ */
  const BASE = 'https://testfmvoice.rusff.me';

  // Разделы (как в оригинале)
  const SECTIONS = [
    { id: 4, type: 'personal', status: 'on'  },
    { id: 5, type: 'personal', status: 'off' },
    { id: 8, type: 'au', status: 'on' },
    { id: 9, type: 'plot', status: 'on' },
  ];

  const MAX_PAGES_PER_SECTION = 50;
  const MAX_PAGES_USERLIST    = 200;

  // UI-мишени
  const SRC_POST_ID  = 'p82';
  const SRC_HOST_SEL = `#${SRC_POST_ID} .post-box`;
  const OUT_SEL      = '#p83-content';

  // элементы
  const WRAP_ID = 'fmv-chrono-inline';
  const BTN_ID  = 'fmv-chrono-inline-btn';
  const NOTE_ID = 'fmv-chrono-inline-note';

  // стиль подсветки «пропуск/ошибка»
  const MISS_STYLE = 'background:#ffeaea;color:#b00020;padding:0 3px;border-radius:3px';

  // разделитель имён/локаций
  const CHAR_SPLIT = /\s*(?:,|;|\/|&|\bи\b)\s*/iu;

  /* ---------- статусный бейдж (цвет) ---------- */
  function renderStatus(type, status) {
    const mapType = {
      personal: { word: 'personal', color: 'black'  },
      plot:     { word: 'plot',     color: 'black'  },
      au:       { word: 'au',       color: 'red'    }
    };
    const mapStatus = {
      on:       { word: 'active',   color: 'green'  },
      off:      { word: 'closed',   color: 'teal'   },
      archived: { word: 'archived', color: 'maroon' }
    };
    const t = mapType[escapeHtml(type)] || mapType.au;
    const st = mapStatus[status] || mapStatus.archived;
    return `[<span style="color:${t.color}">${t.word}</span> / <span style="color:${st.color}">${st.word}</span>]`;
  }

  /* ---------- заголовок темы ---------- */
  const TITLE_RE = /^\s*\[(.+?)\]\s*(.+)$/s;
  function parseTitle(text) {
    const m = String(text||'').match(TITLE_RE);
    return m
      ? { dateRaw: m[1].trim(), episode: m[2].trim(), hasBracket: true }
      : { dateRaw: '', episode: trimSp(text), hasBracket: false };
  }

  /* ---------- даты ---------- */
  const TMAX = [9999,12,31];
  const yFix = (y)=> String(y).length<=2 ? 1900 + parseInt(y,10) : parseInt(y,10);
  const dateKey = (t) => t[0]*10000 + t[1]*100 + t[2];

  // --- Новая функция проверки существования дня
  function isValidDate(y, m, d) {
    if (!Number.isFinite(y) || y < 0) return false;
    if (!Number.isFinite(m) || m < 1 || m > 12) return false;
    if (!Number.isFinite(d) || d < 1) return false;
    const dim = new Date(y, m, 0).getDate();
    return d <= dim;
  }

  function parseDateRange(src) {
    let txt = String(src||'').trim();
    if (!txt) return { start: TMAX, end: TMAX, kind:'unknown', bad:true };
    txt = txt.replace(/[\u2012-\u2015\u2212—–−]+/g, '-').replace(/\s*-\s*/g, '-');

    const P = {
      single: /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      dayRangeSameMonth: /^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      crossMonthTailYear: /^(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      crossYearBothYears: /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      monthYear: /^(\d{1,2})\.(\d{2}|\d{4})$/,
      yearOnly: /^(\d{4})$/
    };

    const toInt = (x)=>parseInt(x,10);
    const fixYear = (y)=> String(y).length===2 ? 1900 + parseInt(y,10) : parseInt(y,10);
    const clamp = (y,m,d)=>[Math.max(0, y), Math.min(Math.max(1,m),12), Math.min(Math.max(0,d),31)];

    // 1) dd.mm.yy|yyyy
    let m = txt.match(P.single);
    if (m) {
      const d  = toInt(m[1]), mo = toInt(m[2]), y = fixYear(m[3]);
      const bad = !isValidDate(y, mo, d);
      const a = clamp(y,mo,d);
      return { start:a, end:a.slice(), kind:'single', bad };
    }

    // 2) dd-dd.mm.yy|yyyy
    m = txt.match(P.dayRangeSameMonth);
    if (m) {
      const d1 = toInt(m[1]), d2 = toInt(m[2]), mo = toInt(m[3]), y = fixYear(m[4]);
      const bad = !isValidDate(y, mo, d1) || !isValidDate(y, mo, d2);
      return { start:clamp(y,mo,d1), end:clamp(y,mo,d2), kind:'day-range', bad };
    }

    // 3) dd.mm-dd.mm.yy|yyyy (tail year applies to both)
    m = txt.match(P.crossMonthTailYear);
    if (m) {
      const d1 = toInt(m[1]), mo1 = toInt(m[2]), d2 = toInt(m[3]), mo2 = toInt(m[4]), y = fixYear(m[5]);
      const bad = !isValidDate(y, mo1, d1) || !isValidDate(y, mo2, d2);
      return { start:clamp(y,mo1,d1), end:clamp(y,mo2,d2), kind:'cross-month', bad };
    }

    // 4) dd.mm.yy|yyyy - dd.mm.yy|yyyy
    m = txt.match(P.crossYearBothYears);
    if (m) {
      const d1 = toInt(m[1]), mo1 = toInt(m[2]), y1 = fixYear(m[3]);
      const d2 = toInt(m[4]), mo2 = toInt(m[5]), y2 = fixYear(m[6]);
      const bad = !isValidDate(y1, mo1, d1) || !isValidDate(y2, mo2, d2);
      return { start:clamp(y1,mo1,d1), end:clamp(y2,mo2,d2), kind:(y1===y2?'cross-month':'cross-year'), bad };
    }

    // 5) mm.yy|yyyy
    m = txt.match(P.monthYear);
    if (m) {
      const mo = toInt(m[1]), y = fixYear(m[2]);
      const bad = !Number.isFinite(y) || mo < 1 || mo > 12;
      const a = clamp(y,mo,0);
      return { start:a, end:a.slice(), kind:'month', bad };
    }

    // 6) yyyy
    m = txt.match(P.yearOnly);
    if (m) {
      const y = toInt(m[1]);
      const bad = !Number.isFinite(y) || y < 0;
      const a = clamp(y,1,0);
      return { start:a, end:a.slice(), kind:'year', bad };
    }

    return { start: TMAX, end: TMAX, kind:'unknown', bad:true };
  }

  /* ---------- НОРМАЛИЗОВАННЫЙ ВЫВОД ДАТЫ ---------- */
  const z2 = (n) => String(n).padStart(2, '0');
  function formatRange(r) {
    if (!r || !r.start || !r.end) return '';
    const [y1, m1, d1] = r.start;
    const [y2, m2, d2] = r.end;

    switch (r.kind) {
      case 'single':       return `${z2(d1)}.${z2(m1)}.${y1}`;
      case 'day-range':    return `${z2(d1)}-${z2(d2)}.${z2(m1)}.${y1}`;
      case 'cross-month':  return `${z2(d1)}.${z2(m1)}-${z2(d2)}.${z2(m2)}.${y1}`;
      case 'month':        return `${z2(m1)}.${y1}`;
      case 'year':         return String(y1);
      default:
        if (y1 !== y2) return `${z2(d1)}.${z2(m1)}.${y1}-${z2(d2)}.${z2(m2)}.${y2}`;
        return `${z2(d1)}.${z2(m1)}-${z2(d2)}.${z2(m2)}.${y1}`;
    }
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
  const firstPostNode = (doc) =>
    doc.querySelector('.post.topicpost .post-content') ||
    doc.querySelector('.post.topicpost') ||
    doc;

  /* ---------- MНОЖЕСТВЕННЫЕ location/characters (+ masks) ---------- */
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

    // NEW: parse <masks> — "name=role;name=role2;..."
    // учитываем только те mask-ключи, которые встречаются в characters
    const masksByCharLower = new Map(); // charLower -> Set(rolesLower)
    firstNode.querySelectorAll('masks').forEach(n => {
      const raw = safeNodeText(n);
      if (!raw) return;
      raw.split(/\s*;\s*/).forEach(pair => {
        if (!pair) return;
        const eq = pair.indexOf('=');
        if (eq <= 0) return;
        const key = pair.slice(0, eq).trim().toLowerCase();
        const val = pair.slice(eq+1).trim().toLowerCase();
        if (!key || !val) return;
        if (!charSet.has(key)) return; // смотрим только персонажей из <characters>
        if (!masksByCharLower.has(key)) masksByCharLower.set(key, new Set());
        masksByCharLower.get(key).add(val);
      });
    });

    let order = null;
    const orderNode = firstNode.querySelector('order');
    if (orderNode) {
      const num = parseInt(safeNodeText(orderNode), 10);
      if (Number.isFinite(num)) order = num;
    }

    return { locationsLower, charactersLower, masksByCharLower, order };
  }

  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const html = await fetchText(topicUrl);
      const doc  = parseHTML(html);
      const first= firstPostNode(doc);

      const { locationsLower, charactersLower, masksByCharLower, order } = extractFromFirst(first);
      const { dateRaw, episode, hasBracket } = parseTitle(rawTitle);
      const isAu = (type === 'au');
      const range = isAu
        ? { start: TMAX, end: TMAX, kind: 'unknown', bad: false }
        : parseDateRange(dateRaw);
      const auAtStart = /^\s*\[\s*au\s*\]/i.test(String(rawTitle || ''));
      const auBad = isAu ? !auAtStart : false;
      const dateBad = isAu ? auBad : (!hasBracket || range.bad);

      return {
        type, status, dateRaw, episode, url: topicUrl,
        locationsLower, charactersLower, masksByCharLower, order,
        range, dateBad
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

  //* ================= СБОРКА HTML ================= */
  async function buildWrappedHTML() {
    const nameToProfile = await scrapeAllUsers();

    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec);
      all = all.concat(part);
    }
    all = all.filter(Boolean);
    all.sort(compareEvents);

    // helper для линка/подсветки конкретного имени (персонажа или роли)
    function renderOneNameLower(lower) {
      const href  = nameToProfile.get(lower);
      const shown = escapeHtml(lower);
      if (href) return `<a href="${escapeHtml(href)}" rel="nofollow">${shown}</a>`;
      return `<span style="${MISS_STYLE}">${shown}</span>`;
    }

    // UPDATED: теперь учитываем masks
    function renderNames(lowerArr, masksByCharLower) {
      if (!lowerArr || !lowerArr.length) {
        return `<span style="${MISS_STYLE}">не указаны</span>`;
      }
      return lowerArr.map((lowChar) => {
        const charHTML = renderOneNameLower(lowChar);

        const rolesSet = masksByCharLower?.get(lowChar);
        if (!rolesSet || rolesSet.size === 0) return charHTML;

        const roles = Array.from(rolesSet);
        const rolesHTML = roles.map(r => renderOneNameLower(r)).join(', ');
        return `${charHTML} [as ${rolesHTML}]`;
      }).join(', ');
    }

    const items = all.map(e => {
      const statusHTML = renderStatus(e.type, e.status);
      const dateHTML = e.type === 'au'
        ? (e.dateBad ? `<span style="${MISS_STYLE}">проблема с [au] в названии</span>` : '')
        : ((!e.dateRaw || e.dateBad) ? `<span style="${MISS_STYLE}">дата не указана/ошибка</span>` : escapeHtml(formatRange(e.range)));

      const url        = escapeHtml(e.url);
      const ttl        = escapeHtml(e.episode);
      const orderBadge = (e.order!=null) ? ` [${escapeHtml(String(e.order))}]` : '';

      const names = renderNames(e.charactersLower, e.masksByCharLower);

      const loc = (e.locationsLower && e.locationsLower.length)
        ? escapeHtml(e.locationsLower.join(', '))
        : `<span style="${MISS_STYLE}">локация не указана</span>`;

      const dash = dateHTML ? ' — ' : ' ';
      return `<p>${statusHTML} ${dateHTML}${dash}<a href="${url}" rel="nofollow">${ttl}</a>${orderBadge}<br><i>${names}</i> / ${loc}</p>`;
    });

    const body = items.join('') || `<p><i>— пусто —</i></p>`;

    return `
  <div class="quote-box spoiler-box media-box">
    <div onclick="toggleSpoiler(this)">Собранная хронология</div>
    <blockquote>${body}</blockquote>
  </div>`;
  }

  /* =================== ЗАПУСК ПО КНОПКЕ + ПОДМЕНА #p83 =================== */
  async function handleBuild(opts) {
    const btn  = opts?.buttonEl || document.getElementById(BTN_ID);
    const note = opts?.noteEl   || document.getElementById(NOTE_ID);

    try {
      const host = document.querySelector(OUT_SEL);
      if (!host) {
        console.warn('[FMV] контейнер вывода не найден:', OUT_SEL);
        return;
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

  /* ======================== UI: кнопка в p82 ======================== */
  function ensureStyles() {
    if (document.getElementById('fmv-chrono-styles')) return;
    const css = `
      #${WRAP_ID}{ margin:8px 0 0; display:flex; gap:10px; align-items:center; }
      #${NOTE_ID}{ font-size:90%; opacity:.85; }
      .fmv-note-bad{ background: rgba(200,0,0,.14); padding: 2px 6px; border-radius: 4px; }
    `.trim();
    const style = document.createElement('style');
    style.id = 'fmv-chrono-styles';
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  function mountInlineButton() {
    const host = document.querySelector(SRC_HOST_SEL);
    if (!host) return false;

    if (document.getElementById(WRAP_ID)) return true;

    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;

    const btn = document.createElement('a');
    btn.id = BTN_ID;
    btn.href = 'javascript:void(0)';
    btn.className = 'button';
    btn.textContent = 'Собрать хронологию';

    const note = document.createElement('span');
    note.id = NOTE_ID;

    wrap.appendChild(btn);
    wrap.appendChild(note);
    host.appendChild(wrap);

    btn.addEventListener('click', () => handleBuild({ buttonEl: btn, noteEl: note }));

    return true;
  }

  /* ============================== INIT ============================== */
  function init() {
    ensureStyles();
    mountInlineButton();
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
