/* ===================== поиск поста / блока ===================== */
function findChronoRendered(root) {
  const cand = Array.from(root.querySelectorAll('*')).find(n => /Собранная\s+хронология/i.test(n.textContent || ''));
  if (!cand) return null;
  return cand.closest('.quote-box, .media, .spoiler-box, .content, .post, div, section') || cand;
}

function renderStatus(type, status) {
  const MAP_TYPE = window.CHRONO_CHECK?.EpisodeMapType || {
    personal: ['personal', 'black'],
    plot:     ['plot',     'black'],
    au:       ['au',       'black']
  };

  const MAP_STAT = window.CHRONO_CHECK?.EpisodeMapStat || {
    on:       ['active',   'green'],
    off:      ['closed',   'teal'],
    archived: ['archived', 'maroon']
  };
  
  const t = MAP_TYPE[type] || MAP_TYPE.au;
  const s = MAP_STAT[status] || MAP_STAT.archived;
  return `[color=${t[1]}]${t[0]}[/color] / [color=${s[1]}]${s[0]}[/color]`;
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
        // (б) пытаемся взять префикс до первого « —/–/- » как кандидата на дату
    const head = l1Text.split(/\s[—–-]\s/)[0]?.trim() || '';
    const d = parseDateFlexible(head); // уже умеет все нужные форматы и диапазоны
    if (d && d.hasDate) {
      // сохраняем как текстовые значения для твоей дальнейшей логики
      const show = (a) =>
        a?.y != null
          ? (a.d != null ? `${String(a.d).padStart(2,'0')}.${String(a.m).padStart(2,'0')}.${a.y}`
             : a.m != null ? `${String(a.m).padStart(2,'0')}.${a.y}`
             : String(a.y))
          : '';
      dateStart = show(d.left);
      // ставим dateEnd только если диапазон реально есть
      dateEnd = (d.right && (d.right.y !== d.left.y || d.right.m != null || d.right.d != null))
                  ? show(d.right)
                  : '';
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
 * collectEpisodesFromForums (без forumIds/topicId/postId и без CHRONO_CHECK.ForumInfo)
 * Обходит разделы форума и возвращает массив эпизодов:
 * {
 *   dateStart, dateEnd, title, href, type, status, order, location,
 *   participants: [ { id?, name, masks: [] }, ... ]
 * }
 *
 * Параметры (все опциональны):
 *   - sections: [{ id, type?, status? }, ...]  // если не задано — автообнаружение по документу
 *   - maxPagesPerSection: число страниц на раздел (по умолчанию 50)
 *   - groupIds: допустимые группы (если ваша логика доступа это использует где-то снаружи)
 *   - respectAccess: флаг для внешних проверок доступа (пробрасывается как есть)
 */
async function collectEpisodesFromForums(opts = {}) {
    // --- вспомогательная функция для ограниченной параллельной загрузки ---
    async function asyncPool(limit, items, iteratee) {
      const ret = [];
      const executing = new Set();
      for (const item of items) {
        const p = Promise.resolve().then(() => iteratee(item));
        ret.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);
        if (executing.size >= limit) {
          await Promise.race(executing);
        }
      }
      return Promise.all(ret);
    }
  
  // разделы: либо из opts.sections, либо автообнаружение по текущему документу
  let SECTIONS = Array.isArray(opts.sections) && opts.sections.length ? opts.sections.slice() : [];
  if (!SECTIONS.length) {
    // авто: собрать все уникальные forum-id из текущей страницы
    const ids = new Set();
    document.querySelectorAll('a[href*="viewforum.php?id="]').forEach(a => {
      const m = String(a.getAttribute('href') || '').match(/viewforum\.php\?id=(\d+)/i);
      if (m) ids.add(m[1]);
    });
    SECTIONS = Array.from(ids).map(id => ({ id })); // type/status можно добавить позднее при необходимости
  }

  if (!SECTIONS.length) {
    console.warn('[collectEpisodesFromForums] Не удалось определить список разделов (sections)');
    return [];
  }

  const MAX_PAGES_PER_SECTION = 100;

  // ==== утилиты ====
  const abs  = (base, href)=>{ try { return new URL(href, base).href; } catch { return href; } };
  const text = node => (node && (node.innerText ?? node.textContent) || '').trim();

  // чтение заголовка темы: из <title> или хвоста крошек после последнего "»"
  function topicTitleFromCrumbs(doc) {
    const t = (doc.querySelector('title')?.textContent || '').trim();
    if (/\[.+\]\s+.+/.test(t)) return t;
    const crumbs = doc.querySelector('.crumbs, .crumbs-nav, #pun-crumbs1 .crumbs, #pun-crumbs1');
    if (crumbs) {
      const full = (crumbs.textContent || '').replace(/\s+/g, ' ').trim();
      const tail = full.split('»').pop()?.trim() || '';
      if (tail) return tail;
    }
    const a = doc.querySelector('a[href*="viewtopic.php?id="]');
    return (a?.textContent || '').trim();
  }

  // [дата] Заголовок — только если внутри реально дата/диапазон
  function parseTitle(str) {
    const s = String(str || '').trim();
  
    const m = s.match(/^\s*\[(.*?)\]\s*(.*)$/s);
    if (m) {
      const inner = (m[1] || '').trim();
      const rest  = (m[2] || '').trim();
      const d = parseDateFlexible(inner);   // ваша функция разбора дат
  
      if (d && d.hasDate) {
        // это действительно дата → отделяем
        return { dateRaw: inner, episode: rest.replace(/\s+/g, ' ') };
      }
      // НЕ дата → ничего не откусываем
    }
  
    return { dateRaw: '', episode: s.replace(/\s+/g, ' ') };
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

    // если оба — чисто двухзначные годы и получился "перевёрнутый" диапазон,
    // подгоняем век левой границы под правую
    const left2  = /^\d{1,2}$/.test(leftRaw);
    const right2 = /^\d{1,2}$/.test(rightRaw);
    if (left2 && right2 && L0?.y && R0?.y && (L0.m==null && L0.d==null) && (R0.m==null && R0.d==null)) {
      if (L0.y > R0.y) {
        // примем век правой границы для левой
        const century = Math.floor(R0.y / 100) * 100;       // 1900 или 2000
        const yy = +leftRaw;                                 // 22
        L0.y = century + yy;                                 // 1922
      }
    }

    
    if (L0 && L0.y == null && L0.d != null && L0.m != null && R0.y) L0.y = R0.y;
    const okDay = (o)=> (o.d==null) || (o.y && o.m && o.d>=1 && o.d<=daysInMonth(o.y,o.m));
    if (!okDay(L0) || !okDay(R0)) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
    const startKey = [L0.y, L0.m ?? 0, L0.d ?? 0];
    const endKey   = [R0.y ?? L0.y, R0.m ?? 0, R0.d ?? 0];
    function displayRange(a,b){
      if (a.d!=null && b.d!=null) return `${pad2(a.d)}.${pad2(a.m)}.${a.y}-${pad2(b.d)}.${b.m}.${b.y}`;
      if (a.m!=null && b.m!=null) return `${pad2(a.m)}.${a.y}-${pad2(b.m)}.${b.y}`;
      return `${a.y}-${b.y}`;
    }
    return { hasDate:true, startSort:startKey, endSort:endKey, display:displayRange(L0,R0), left:L0, right:R0 };
  }
  function cmpTriple(a, b) { for (let i=0;i<3;i++) { const d = (a[i]??0)-(b[i]??0); if (d) return d; } return 0; }
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
  function normalizeEpisodeTitle(type, rawTitle, hasDateForType) {
    const title = String(rawTitle || '').trim();
    let ok = true;
  
    if (type === 'plot') {
      // Требуем: валидная дата есть И суффикс "... [c]" или "... [с]" в самом конце
      const suffixRx = /\s\[\s*(?:c|с)\s*\]$/i; // лат. c или кир. с
      const hasSuffix = suffixRx.test(title);
      ok = !!hasDateForType && hasSuffix;
  
      return {
        title: hasSuffix ? title.replace(suffixRx, '').trim() : title,
        ok
      };
    }
  
    if (type === 'au') {
      // Требуем: начало либо "[au] ", либо "[AU] " (смешанный регистр не допускаем)
      const prefixRx = /^(?:\[\s*au\s*\]\s+|\[\s*AU\s*\]\s+)/;
      const hasPrefix = prefixRx.test(title);
      ok = hasPrefix;
  
      return {
        title: hasPrefix ? title.replace(prefixRx, '').trim() : title,
        ok
      };
    }
  
    return { title, ok };
  }

  // ==== скрапперы ====
  async function scrapeSection(section, seenTopics) {
  let url = abs(location.href, `/viewforum.php?id=${section.id}`);
  const seenPages = new Set();
  const out  = [];
  let n = 0;

  // [NEW] Зафиксируем какие темы уже встречали в этом разделе:
  const sectionSeen = new Set();

  let lastSig = '';

  while (url && !seenPages.has(url) && n < MAX_PAGES_PER_SECTION) {
    n++; seenPages.add(url);
    const doc = await FMV.fetchDoc(url);

    // список тем на странице (id → {url,title})
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

    // === РАННИЕ ВЫХОДЫ ===

    // (а) Совпала сигнатура со страницей N-1 → дальше листать нет смысла
    const pageIds = Array.from(topics.keys()).sort();
    const sig = pageIds.join(',');
    if (sig && sig === lastSig) break;
    lastSig = sig;

    // (б) На странице нет ни одного нового id относительно уже виденных в этом разделе
    const newIds = pageIds.filter(id => !sectionSeen.has(id));
    if (newIds.length === 0) break;
    newIds.forEach(id => sectionSeen.add(id));

    // --- параллельная загрузка тем с лимитом потоков ---
    const CONCURRENCY = Number.isFinite(+opts?.concurrencyPerPage)
      ? +opts.concurrencyPerPage
      : 6; // дефолт: 6 запросов одновременно
    
    const topicEntries = Array.from(topics.entries());
    
    const rows = await asyncPool(CONCURRENCY, topicEntries,
      async ([tid, { url: turl, title }]) => {
        const key = tid ? `id:${tid}` : `url:${turl.replace(/#.*$/,'')}`;
        if (seenTopics.has(key)) return null;
        const row = await scrapeTopic(turl, title, section.type, section.status);
        return row ? { key, row } : null;
      });
    
    for (const r of rows) {
      if (!r) continue;
      seenTopics.add(r.key);
      out.push(r.row);
    }

    // Переход на следующую страницу
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

      const titleFromCrumbs = topicTitleFromCrumbs(doc);
      const safeTitle = rawTitle || titleFromCrumbs || '';

      const { dateRaw, episode } = parseTitle(safeTitle);
      const parsed = parseDateFlexible(dateRaw);

      const norm = normalizeEpisodeTitle(type, episode || '', parsed.hasDate);

      const rawChars = FMV.readTagText(first, 'characters');
      const rawLoc   = FMV.readTagText(first, 'location');
      const rawOrder = FMV.readTagText(first, 'order');

      const idToNameMap = await FMV.buildIdToNameMapFromTags(rawChars);
      const uni = FMV.parseCharactersUnified(rawChars, idToNameMap, window.profileLink);
      const participantsLower = uni.ok ? uni.participantsLower : [];
      const masksByCharLower  = uni.ok ? uni.masksByCharLower  : new Map();

      const order = (FMV.parseOrderStrict(rawOrder).ok ? FMV.parseOrderStrict(rawOrder).value : 0);

      const locationsLower = rawLoc
        ? rawLoc.split(/\s*[,;]\s*/).map(s => s.trim().toLowerCase()).filter(Boolean)
        : [];

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

      const dateStartStr = parsed.hasDate
        ? ((parsed.left?.d != null) ? displaySingle(parsed.left)
          : (parsed.left?.m != null) ? displaySingle(parsed.left)
          : String(parsed.left?.y ?? ''))
        : '';
      
      const dateEndStr = parsed.hasDate
        ? ((parsed.right?.d != null) ? displaySingle(parsed.right)
          : (parsed.right?.m != null) ? displaySingle(parsed.right)
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
        isTitleNormalized: norm.ok,
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


/**
 * Собирает словарь по пользователям на основе collectEpisodesFromForums.
 * Учитывает только участников со ссылкой на профиль (есть p.id).
 *
 * Параметры:
 * @param {Object} [opts]
 * @param {Array<number|string>} [opts.groupIds] - допустимые группы; по умолчанию берётся из CHRONO_CHECK.GroupID
 * @param {boolean} [opts.respectAccess=true]    - выполнять проверки доступа (если есть хелперы)
 *
 * Возвращает:
 * Promise<{ [userId: string]: { name: string, episodes: Episode[] } }>
 *
 * Episode = {
 *   dateStart: string,
 *   dateEnd:   string,
 *   type:      string,
 *   status:    string,
 *   title:     string,
 *   href:      string,
 *   order:     number,
 *   location:  string,
 *   masks:     string[],  // маски владельца
 *   participants: Array<{ id:string, name:string, masks:string[] }>
 * }
 */
/**
 * Собирает словарь по пользователям на основе collectEpisodesFromForums.
 * Учитывает только участников со ссылкой на профиль (есть p.id).
 *
 * @param {Object} [opts]
 * @param {Array<number|string>} [opts.groupIds] - допустимые группы; по умолчанию CHRONO_CHECK.GroupID
 * @param {boolean} [opts.respectAccess=true]    - выполнять проверки доступа (если есть хелперы)
 * @param {Array<{id:string|number,type?:string,status?:string}>} [opts.sections] - список разделов
 * @param {number} [opts.maxPagesPerSection]     - лимит страниц на раздел
 *
 * @returns {Promise<Object>} { "<userId>": { name: string, episodes: Episode[] } }
 */
async function collectChronoByUser(opts = {}) {
  if (typeof collectEpisodesFromForums !== 'function') {
    throw new Error('collectEpisodesFromForums недоступна');
  }

  let SECTIONS = Array.isArray(opts.sections) && opts.sections.length ? opts.sections.slice() : [];
  const maxPagesPerSection =
    Number.isFinite(+opts.maxPagesPerSection) ? +opts.maxPagesPerSection : undefined;

  // получаем эпизоды с учётом sections
  const episodes = await collectEpisodesFromForums({
    sections: SECTIONS,
    maxPagesPerSection
  });

  const byUser = Object.create(null);

  // стабилизируем порядок
  episodes.forEach((e, i) => { if (!Number.isFinite(e.order)) e.order = i; });

  for (const ep of episodes) {
    const participants = (ep.participants || [])
      .map(p => {
        const id = p?.id ? String(p.id).trim() : '';
        if (!id) return null; // игнорируем ники без id/профиля
        return {
          id,
          name: (p.name || '').trim(),
          masks: Array.isArray(p.masks) ? p.masks.slice() : []
        };
      })
      .filter(Boolean);

    for (const self of participants) {
      const others = participants
        .filter(p => p !== self)
        .map(p => ({ id: p.id, name: p.name, masks: p.masks.slice() }));

      const outEpisode = {
        dateStart: ep.dateStart || '',
        dateEnd:   ep.dateEnd   || ep.dateStart || '',
        type:      ep.type      || '',
        status:    ep.status    || '',
        title:     ep.title     || '',
        href:      ep.href      || '',
        order:     Number(ep.order || 0),
        location:  ep.location  || '',
        masks:     self.masks || [],
        participants: others,
        // если нужно использовать дальше: пробросим валидность названия
        isTitleNormalized: !!ep.isTitleNormalized
      };

      if (!byUser[self.id]) {
        byUser[self.id] = { name: self.name || '', episodes: [] };
      }
      byUser[self.id].episodes.push(outEpisode);
    }
  }

  return byUser;
}
