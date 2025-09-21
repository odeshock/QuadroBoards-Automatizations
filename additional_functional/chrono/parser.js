/* ===================== поиск поста / блока ===================== */
function findChronoRendered(root) {
  const cand = Array.from(root.querySelectorAll('*')).find(n => /Собранная\s+хронология/i.test(n.textContent || ''));
  if (!cand) return null;
  return cand.closest('.quote-box, .media, .spoiler-box, .content, .post, div, section') || cand;
}

// --- parseParagraph: делим <p> на 4 логические строки по <br> ---
function parseParagraph(p) {
  const lines = [[], [], [], []]; // 0: дата+тема, 1: мета, 2: участники, 3: локация (+ всё остальное)
  let i = 0;
  for (const node of p.childNodes) {
    if (node.nodeType === 1 && node.tagName === 'BR') { i = Math.min(i + 1, 3); continue; }
    lines[i].push(node);
  }
  const dateTitleNodes = lines[0];
  const metaNodes      = lines[1];
  const partNodes      = lines[2];
  const locNodes       = lines[3];

  // ссылка темы — только <a href*="viewtopic.php?id="> из первой строки
  const tmp = document.createElement('div');
  dateTitleNodes.forEach(n => tmp.appendChild(n.cloneNode(true)));
  const a = tmp.querySelector('a[href*="viewtopic.php?id="]') || p.querySelector('a[href*="viewtopic.php?id="]');

  const { type, status, order, dateStart, dateEnd, title } =
    parseHeaderNew(dateTitleNodes, metaNodes, a);

  const { participants, masksLines } = parseParticipants(partNodes);
  const location = cleanLocation(textFromNodes(locNodes));

  const start = (type === 'au') ? '' : (dateStart || '');
  const end   = (type === 'au') ? '' : (dateEnd   || start || '');

  return {
    type, status,
    title, href: a?.href || '',
    dateStart: start, dateEnd: end,
    order: Number.isFinite(order) ? order : 0,
    participants, masksLines, location
  };
}

// --- parseHeaderNew: 1-я строка (дата — тема), 2-я строка ([тип / статус / порядок]) ---
function parseHeaderNew(dateTitleNodes, metaNodes, linkEl) {
  // ТЕМА: только текст из <a>
  const title = (linkEl?.textContent || '').trim();

  // 1-я строка как временный DOM
  const wrap = document.createElement('div');
  dateTitleNodes.forEach(n => wrap.appendChild(n.cloneNode(true)));
  const l1Text = (wrap.textContent || '').replace(/\s+/g, ' ').trim();

  // --- ДАТА: только если реально дата ---
  let dateStart = '', dateEnd = '';

  // (а) strong приоритетнее
  let datePart = (wrap.querySelector('strong')?.textContent || '').trim();

  if (!datePart) {
    // (б) искать дату только В НАЧАЛЕ строки
    const m = l1Text.match(/^\s*(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{1,2}\.\d{4}|\d{4})(?:\s*[-—–]\s*(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{1,2}\.\d{4}|\d{4}))?/);
    if (m) {
      dateStart = m[1];
      dateEnd   = m[2] || '';
    }
  } else {
    // распарсить диапазон из strong, если он есть
    const norm = datePart.replace(/[\u2012-\u2015\u2212—–−]/g, '-').replace(/\s*-\s*/g, '-');
    const duo = norm.split('-').slice(0, 2).map(s => s.trim());
    dateStart = duo[0] || '';
    dateEnd   = duo[1] || '';
  }

  // если встречается "дата не указана" — пусто
  if (/дата\s+не\s+указан/i.test(datePart || '')) { dateStart = ''; dateEnd = ''; }

  // --- МЕТА: [тип / статус / порядок] — 2-я строка
  const metaText = textFromNodes(metaNodes);
  let type = '', status = '', order = 0;
  const box = metaText.match(/\[([^\]]+)\]/);
  if (box) {
    const parts = box[1].split('/').map(s => s.trim());
    type   = (parts[0] || '').toLowerCase();
    status = (parts[1] || '').toLowerCase();
    if (parts[2]) { const n = parseInt(parts[2], 10); if (Number.isFinite(n)) order = n; }
  }

  return { type, status, order, dateStart, dateEnd, title };
}

function parseParticipants(nodes) {
  // расплющим DOM в токены "link" и "text"
  const toks = [];
  (function flat(nl){
    Array.from(nl).forEach(n => {
      if (n.nodeType === 3) toks.push({ t:'text', v:n.nodeValue || '' });
      else if (n.nodeType === 1) {
        if (n.tagName === 'A') toks.push({ t:'link', name:(n.textContent||'').trim(), href:n.href||'' });
        else flat(n.childNodes);
      }
    });
  })(nodes);

  const participants = [];            // {name, href}
  const maskMap = new Map();          // name -> [mask,...]
  let lastName = null;

  const addMask = (name, list) => {
    if (!name || !list || !list.length) return;
    if (!maskMap.has(name)) maskMap.set(name, []);
    maskMap.get(name).push(...list);
  };

  for (const tk of toks) {
    if (tk.t === 'link') {
      const name = tk.name;
      participants.push({ name, href: tk.href });
      lastName = name;
      continue;
    }

    if (tk.t === 'text') {
      let t = tk.v || '';
      // если встречаем "не указаны" — обе колонки пустые
      if (/\bне\s*указан/i.test(t)) return { participants: [], masksLines: [] };

      // вытащить маски и привязать к последнему участнику
      t = t.replace(/\[\s*as\s*([^\]]+)\]/ig, (_m, g) => {
        const arr = g.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
        addMask(lastName, arr);
        return ''; // удалить из текста
      });

      // оставшиеся имена (без масок) через запятую
      t.split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
        if (/^[–—-]+$/.test(name)) return;                 // мусорные тире
        if (/^\[.*\]$/.test(name)) return;                 // остаточные скобки
        participants.push({ name, href: '' });
        lastName = name;
      });
    }
  }

  // собрать строки для колонки "Маски" (по одной маске в строке)
  const masksLines = [];
  for (const p of participants) {
    const arr = maskMap.get(p.name);
    if (arr && arr.length) arr.forEach(msk => masksLines.push(`${p.name} — ${msk}`));
  }

  return { participants, masksLines };
}
function cleanLocation(s) {
  const t=String(s||'').trim();
  if (!t) return '';
  if (/^локац/i.test(t) && /не\s+указан/i.test(t)) return '';
  if (/^не\s+указан/i.test(t)) return '';
  return t;
}

/**
 * collectEpisodesFromForums
 * Обходит разделы форума (как button_update_total) и возвращает массив эпизодов:
 * {
 *   dateStart, dateEnd, title, href, type, status, order, location,
 *   participants: [ { id?, name, masks: [] }, ... ]
 * }
 *
 * Параметры (все опциональны):
 *   - sections: [{ id, type, status }, ...]  // если не задано — берём CHRONO_CHECK.ForumInfo
 *   - maxPagesPerSection: число страниц на раздел (по умолчанию 50)
 *   - groupIds / forumIds / topicId / postId — переопределения входных условий
 */
async function collectEpisodesFromForums(opts = {}) {
  // ==== входные условия ====
  const GID = (opts.groupIds ?? window.CHRONO_CHECK?.GroupID ?? []).map(Number);
  const FID = (opts.forumIds ?? window.CHRONO_CHECK?.AmsForumID ?? []).map(String);
  const TID = String(opts.topicId ?? window.CHRONO_CHECK?.ChronoTopicID ?? '').trim();
  const PID = String(opts.postId  ?? window.CHRONO_CHECK?.TotalChronoPostID ?? '').trim();
  const OPEN_URL = (new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href)).href;

  if (!GID.length || !FID.length || !TID || !PID) {
    console.warn('[collectEpisodesFromForums] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID');
    return [];
  }

  // разделы (можно переопределить)
  const SECTIONS = Array.isArray(opts.sections) && opts.sections.length
    ? opts.sections
    : (Array.isArray(window.CHRONO_CHECK?.ForumInfo) ? window.CHRONO_CHECK.ForumInfo : []);

  const MAX_PAGES_PER_SECTION = Number.isFinite(+opts.maxPagesPerSection) ? +opts.maxPagesPerSection : 50;

  // ==== утилиты ====
  const abs  = (base, href)=>{ try { return new URL(href, base).href; } catch { return href; } };
  const text = node => (node && (node.innerText ?? node.textContent) || '').trim();

  // чтение заголовка темы: из <title> или хвоста крошек после последнего "»"
  function topicTitleFromCrumbs(doc) {
    // 1) <title>
    const t = (doc.querySelector('title')?.textContent || '').trim();
    if (/\[.+\]\s+.+/.test(t)) return t;

    // 2) крошки: берём весь текст и хвост после последнего "»"
    const crumbs = doc.querySelector('.crumbs, .crumbs-nav, #pun-crumbs1 .crumbs, #pun-crumbs1');
    if (crumbs) {
      const full = (crumbs.textContent || '').replace(/\s+/g, ' ').trim();
      const tail = full.split('»').pop()?.trim() || '';
      if (tail) return tail;
    }

    // 3) запасной вариант
    const a = doc.querySelector('a[href*="viewtopic.php?id="]');
    return (a?.textContent || '').trim();
  }

  // [дата] Заголовок
  function parseTitle(str) {
    const m = String(str || '').match(/^\s*\[(.+?)\]\s*(.+)$/s);
    return m
      ? { dateRaw: m[1].trim(), episode: String(m[2]).replace(/\s+/g,' ').trim() }
      : { dateRaw: '',          episode: String(str).replace(/\s+/g,' ').trim() };
  }

  // ---- парсинг дат ----
  const DASH_RX = /[\u2012-\u2015\u2212—–−]/g;
  const DOT_RX  = /[.\u2024\u2219\u00B7\u2027\u22C5·∙•]/g;
  const pad2 = x => String(x).padStart(2,'0');
  function toYYYY(n){ const num = Number(n); if (!Number.isFinite(num)) return null; return String(n).length === 2 ? (num > 30 ? 1900 + num : 2000 + num) : num; }
  function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); }

  function parseToken(t) {
    const s = String(t || '').trim().replace(DOT_RX, '.');

    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const d  = +m[1], mo = +m[2], y = toYYYY(m[3]);
      if (mo<1 || mo>12) return null;
      if (d<1 || d>daysInMonth(y,mo)) return null;
      return { y, m: mo, d };
    }
    m = s.match(/^(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const mo = +m[1], y = toYYYY(m[2]);
      if (mo>=1 && mo<=12) return { y, m: mo };
    }
    m = s.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (m) {
      const d = +m[1], mo = +m[2];
      if (mo>=1 && mo<=12 && d>=1 && d<=31) return { m: mo, d };
      return null;
    }
    m = s.match(/^(\d{2}|\d{4})$/);
    if (m) return { y: toYYYY(m[1]) };

    return null;
  }
  function displaySingle(a){ return a.d!=null ? `${pad2(a.d)}.${pad2(a.m)}.${a.y}`
                          : a.m!=null ? `${pad2(a.m)}.${a.y}` : String(a.y); }

  function parseDateFlexible(raw) {
    let s = String(raw || '').trim();
    if (!s) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };

    s = s.replace(DASH_RX, '-').replace(DOT_RX, '.').replace(/\s*-\s*/g, '-');
    const parts = s.split('-').slice(0,2);
    if (parts.length === 1) {
      const one = parseToken(parts[0]);
      if (!one || !one.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
      const k = [one.y, one.m ?? 0, one.d ?? 0];
      return { hasDate:true, display:displaySingle(one), startSort:k, endSort:k, left:one, right:one };
    }
    const leftRaw  = parts[0].trim();
    const rightRaw = parts[1].trim();

    const R0 = parseToken(rightRaw);
    if (!R0 || !R0.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };

    let L0 = parseToken(leftRaw);
    const mSolo = leftRaw.match(/^\d{1,2}$/);
    if (mSolo) {
      const v = +mSolo[0];
      if (R0.d != null && R0.m != null)      L0 = { y:R0.y, m:R0.m, d:v };
      else if (R0.m != null)                 L0 = { y:R0.y, m:v };
      else                                   L0 = { y: toYYYY(v) };
    }
    if (L0 && L0.y == null && L0.d != null && L0.m != null && R0.y) L0.y = R0.y;

    const okDay = (o)=> (o.d==null) || (o.y && o.m && o.d>=1 && o.d<=daysInMonth(o.y,o.m));
    if (!okDay(L0) || !okDay(R0)) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };

    const startKey = [L0.y, L0.m ?? 0, L0.d ?? 0];
    const endKey   = [R0.y ?? L0.y, R0.m ?? 0, R0.d ?? 0];

    function displayRange(a,b){
      if (a.d!=null && b.d!=null) return `${pad2(a.d)}.${pad2(a.m)}.${a.y}-${pad2(b.d)}.${pad2(b.m)}.${b.y}`;
      if (a.m!=null && b.m!=null) return `${pad2(a.m)}.${a.y}-${pad2(b.m)}.${b.y}`;
      return `${a.y}-${b.y}`;
    }

    return { hasDate:true, startSort:startKey, endSort:endKey, display:displayRange(L0,R0), left:L0, right:R0 };
  }

  function cmpTriple(a, b) {
    for (let i=0;i<3;i++) { const d = (a[i]??0)-(b[i]??0); if (d) return d; }
    return 0;
  }
  function compareEpisodes(a, b) {
    const aHas = !!a.__hasDate, bHas = !!b.__hasDate;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas) {
      const s = cmpTriple(a.__startSort, b.__startSort); if (s) return s;
      const e = cmpTriple(a.__endSort,   b.__endSort);   if (e) return e;
    }
    const ao = a.order ?? 0, bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return String(a.title||'').toLowerCase()
      .localeCompare(String(b.title||'').toLowerCase(), 'ru', { sensitivity:'base' });
  }

  function normalizeEpisodeTitle(type, rawTitle, dateRaw) {
    const title = String(rawTitle || '');
    if (type === 'plot') {
      const suffRx = /\s\[(?:с|c)\]\s*$/i;
      return { title: title.replace(suffRx, '').trimEnd() };
    }
    if (type === 'au') {
      const cleaned = title.replace(/^[\uFEFF\u00A0\s]*\[\s*au\s*\]\s*/i, '');
      return { title: cleaned };
    }
    return { title };
  }

  // ==== скрапперы ====
  async function scrapeSection(section, seenTopics) {
    let url = abs(location.href, `/viewforum.php?id=${section.id}`);
    const seenPages = new Set();
    const out  = [];
    let n = 0;
    let lastSig = '';

    while (url && !seenPages.has(url) && n < MAX_PAGES_PER_SECTION) {
      n++; seenPages.add(url);
      const doc = await FMV.fetchDoc(url);

      // соберём список тем на странице (id → {url,title})
      const topics = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
        const href = abs(url, a.getAttribute('href'));
        const m = href.match(/viewtopic\.php\?id=(\d+)/i);
        const ttl = text(a);
        if (!m) return;
        if (/^\s*(RSS|Atom)\s*$/i.test(ttl)) return;
        if (/#p\d+$/i.test(href)) return;
        if (/^\d{1,2}\.\d{1,2}\.\d{2,4}(?:\s+\d{1,2}:\d{2})?$/.test(ttl)) return;
        topics.set(m[1], { url: href, title: ttl });
      });

      // защита от зацикливания: сигнатура набора тем
      const sig = Array.from(topics.keys()).sort().join(',');
      if (sig && sig === lastSig) break;
      lastSig = sig;

      for (const [tid, { url: turl, title }] of topics) {
        const key = tid ? `id:${tid}` : `url:${turl.replace(/#.*$/,'')}`;
        if (seenTopics.has(key)) continue;
        const row = await scrapeTopic(turl, title, section.type, section.status);
        if (row) { seenTopics.add(key); out.push(row); }
      }

      const next = (function findNextPage(doc){
        const a = doc.querySelector('a[rel="next"], a[href*="&p="]:not([rel="prev"])');
        return a ? a.getAttribute('href') : null;
      })(doc);
      const nextUrl = next ? abs(url, next) : null;
      if (!nextUrl || seenPages.has(nextUrl)) { url = null; break; }
      url = nextUrl;
    }
    return out;
  }

  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const doc   = await FMV.fetchDoc(topicUrl);
      const first = doc.querySelector('.post.topicpost .post-content')
                   || doc.querySelector('.post.topicpost') || doc;

      // заголовок темы
      const titleFromCrumbs = topicTitleFromCrumbs(doc);
      const safeTitle = rawTitle || titleFromCrumbs || '';

      // дата + чистый эпизод
      const { dateRaw, episode } = parseTitle(safeTitle);
      const parsed = parseDateFlexible(dateRaw);

      // теги из первого поста
      const rawChars = FMV.readTagText(first, 'characters');
      const rawLoc   = FMV.readTagText(first, 'location');
      const rawOrder = FMV.readTagText(first, 'order');

      // участники (хелперы как в кнопке)
      const idToNameMap = await FMV.buildIdToNameMapFromTags(rawChars);
      const uni = FMV.parseCharactersUnified(rawChars, idToNameMap, window.profileLink);
      const participantsLower = uni.ok ? uni.participantsLower : [];
      const masksByCharLower  = uni.ok ? uni.masksByCharLower  : new Map();

      const order = (FMV.parseOrderStrict(rawOrder).ok ? FMV.parseOrderStrict(rawOrder).value : 0);

      // локации
      const locationsLower = rawLoc
        ? rawLoc.split(/\s*[,;]\s*/).map(s => s.trim().toLowerCase()).filter(Boolean)
        : [];

      // финальные участники:
      // - если low = "userN" и N есть в idToNameMap (профиль существует) → { id, name, masks }
      // - иначе без id: { name, masks }
      const participants = participantsLower.map(low => {
        const masks = Array.from(masksByCharLower.get(low) || []);
        const m = /^user(\d+)$/i.exec(String(low));
        if (m) {
          const id = m[1];
          if (idToNameMap && idToNameMap.has(id)) {
            return { id, name: idToNameMap.get(id), masks };
          }
          return { name: `user${id}`, masks };
        }
        return { name: String(low), masks };
      });

      // нормализуем title по типу
      const norm = normalizeEpisodeTitle(type, episode || '', dateRaw);

      // строки дат
      const dateStartStr = parsed.hasDate
        ? (parsed.left?.d!=null ? displaySingle(parsed.left)
           : parsed.left?.m!=null ? displaySingle(parsed.left)
           : String(parsed.left?.y ?? ''))
        : '';
      const dateEndStr   = parsed.hasDate
        ? (parsed.right?.d!=null ? displaySingle(parsed.right)
           : parsed.right?.m!=null ? displaySingle(parsed.right)
           : String(parsed.right?.y ?? parsed.left?.y ?? ''))
        : (dateStartStr || '');

      return {
        dateStart: dateStartStr,
        dateEnd:   dateEndStr,
        title:     norm.title || '',
        href:      topicUrl,
        type, status,
        order:     Number(order) || 0,
        location:  locationsLower.join(', '),
        participants,

        // служебные ключи для сортировки
        __hasDate: parsed.hasDate,
        __startSort: parsed.startSort,
        __endSort:   parsed.endSort
      };
    } catch {
      return null;
    }
  }

  // ==== обход и сортировка ====
  const seenTopics = new Set();
  let all = [];
  for (const sec of SECTIONS) {
    const part = await scrapeSection(sec, seenTopics);
    all = all.concat(part);
  }

  all = all.filter(Boolean).sort(compareEpisodes);

  // подчистим служебные поля
  all.forEach(e => { delete e.__hasDate; delete e.__startSort; delete e.__endSort; });

  return all;
}
