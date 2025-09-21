// button_update_total.js
(() => {
  'use strict';

  // входные условия
  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();
  const OPEN_URL = (new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href)).href;

  if (!GID.length || !FID.length || !TID || !PID) {
    console.warn('[button_update_total] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID');
    return;
  }

  // разделы (можно переопределить через CHRONO_CHECK.ForumInfo)
  const SECTIONS = Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
    ? window.CHRONO_CHECK.ForumInfo
    : [];

  let busy = false;

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить общее хроно',
    order: 1,
  
    showStatus: true,
    showDetails: true,
  
    showLink: true,
    linkText: 'Открыть ссылку',
    linkHref: OPEN_URL,
    // (если твоя версия createForumButton не знает linkText/linkHref —
    // ниже есть runtime-обновление через api.setLink)
  
    async onClick(api) {
      if (busy) return;
      busy = true;
    
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
    
      // Спрячем ссылку на время выполнения (если API позволяет)
      if (api?.setLinkVisible) api.setLinkVisible(false);
      if (api?.setLink)        api.setLink('', ''); // очистим, чтобы не мигала от прошлого раза
    
      try {
        setStatus('Выполняю…');
        setDetails('');
    
        // ... сбор, рендер, публикация ...
        const events = await collectEvents();
        const html   = FMV.toCp1251Entities(renderChrono(events));
        const res    = await FMV.replaceComment(GID, PID, html);
    
        const st = normStatus(res.status);
        const success = !!res.ok || st === 'ok';
    
        setStatus(success ? 'Готово' : 'Ошибка');
    
        // Показать ссылку ТОЛЬКО при успехе
        if (success) {
          if (api?.setLink)        api.setLink(OPEN_URL, 'Открыть ссылку');
          if (api?.setLinkVisible) api.setLinkVisible(true);
        } else {
          if (api?.setLinkVisible) api.setLinkVisible(false);
          if (api?.setLink)        api.setLink('', '');
        }
    
        // детали как раньше...
        const lines = [];
        lines.push(`<b>Статус:</b> ${success ? 'ok' : st || 'unknown'}`);
        const info  = toPlainShort(res.infoMessage || '');
        const error = toPlainShort(res.errorMessage || '');
        if (info)  lines.push(info);
        if (error) lines.push(`<span style="color:#b00020">${FMV.escapeHtml(error)}</span>`);
        setDetails(lines.join('<br>'));
    
      } catch (e) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        // на ошибке ссылки нет
        if (api?.setLinkVisible) api.setLinkVisible(false);
        if (api?.setLink)        api.setLink('', '');
      } finally {
        busy = false;
      }
    }

  });

  /* ===================== СБОРКА ===================== */

  const MAX_PAGES_PER_SECTION = 50;

  async function collectEvents() {
    const seenTopics = new Set();
    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec, seenTopics);
      all = all.concat(part);
    }
    return all.filter(Boolean).sort(compareEvents);
  }

  async function scrapeSection(section, seenTopics) {
    let url = abs(location.href, `/viewforum.php?id=${section.id}`);
    const seenPages = new Set();
    const out  = [];
    let n = 0;
    let lastSig = '';

    while (url && !seenPages.has(url) && n < MAX_PAGES_PER_SECTION) {
      n++; seenPages.add(url);
      const doc = await FMV.fetchDoc(url);

      const topics = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
        const href = abs(url, a.getAttribute('href'));
        const m = href.match(/viewtopic\.php\?id=(\d+)/i);
        const title = text(a);
        if (!m) return;
        if (/^\s*(RSS|Atom)\s*$/i.test(title)) return;
        if (/#p\d+$/i.test(href)) return;
        if (/^\d{1,2}\.\d{1,2}\.\d{2,4}(?:\s+\d{1,2}:\d{2})?$/.test(title)) return;
        topics.set(m[1], { url: href, title });
      });

      const sig = Array.from(topics.keys()).sort().join(',');
      if (sig && sig === lastSig) break;
      lastSig = sig;

      for (const [tid, { url: turl, title }] of topics) {
        const key = tid ? `id:${tid}` : `url:${turl.replace(/#.*$/,'')}`;
        if (seenTopics.has(key)) continue;
        const row = await scrapeTopic(turl, title, section.type, section.status);
        if (row) {
          seenTopics.add(key);
          out.push(row);
        }
      }

      const next = findNextPage(doc);
      const nextUrl = next ? abs(url, next) : null;
      if (!nextUrl || seenPages.has(nextUrl)) { url = null; break; }
      url = nextUrl;
    }
    return out;
  }

  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const doc   = await FMV.fetchDoc(topicUrl);
      const first = firstPostNode(doc);

      const rawChars = FMV.readTagText(first, 'characters');
      const rawLoc   = FMV.readTagText(first, 'location');
      const rawOrder = FMV.readTagText(first, 'order');

      const idToNameMap = await FMV.buildIdToNameMapFromTags(rawChars);

      const uni = FMV.parseCharactersUnified(rawChars, idToNameMap, window.profileLink);
      const participantsLower = uni.ok ? uni.participantsLower : [];
      const masksByCharLower  = uni.ok ? uni.masksByCharLower  : new Map();

      const order = (FMV.parseOrderStrict(rawOrder).ok ? FMV.parseOrderStrict(rawOrder).value : 0);

      const titleFromCrumbs = topicTitleFromCrumbs(doc);
      const safeTitle = rawTitle || titleFromCrumbs || '';
      const { dateRaw, episode } = parseTitle(safeTitle);
      const parsed = parseDateFlexible(dateRaw);

      const locationsLower = rawLoc ? rawLoc.split(/\s*[,;]\s*/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];

      return {
        type, status, url: topicUrl,
        episode, dateRaw,
        hasDate: parsed.hasDate,
        dateDisplay: parsed.display,
        startSort: parsed.startSort,
        endSort: parsed.endSort,
        locationsLower, participantsLower, masksByCharLower, order,
        idToNameMap
      };
    } catch { return null; }
  }

  /* ===================== СОРТИРОВКА ===================== */

  function cmpTriple(a, b) { // [y,m,d]
    for (let i=0;i<3;i++) {
      const d = (a[i]??0)-(b[i]??0);
      if (d) return d;
    }
    return 0;
  }

  function compareEvents(a, b) {
    const aHas = !!a.hasDate, bHas = !!b.hasDate;
    if (aHas !== bHas) return aHas ? -1 : 1;

    if (aHas) {
      const s = cmpTriple(a.startSort, b.startSort);
      if (s) return s;
      const e = cmpTriple(a.endSort, b.endSort);
      if (e) return e;
    }

    const ao = a.order ?? 0, bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;

    const at = String(a.episode || '').toLowerCase();
    const bt = String(b.episode || '').toLowerCase();
    return at.localeCompare(bt, 'ru', { sensitivity: 'base' });
  }

  /* ===================== РЕНДЕР ===================== */

  function renderStatus(type, status) {
    const mapType = { personal:['personal','black'], plot:['plot','black'], au:['au','black'] };
    const mapStat = { on:['active','green'], off:['closed','teal'], archived:['archived','maroon'] };
    const t = mapType[type] || mapType.au;
    const s = mapStat[status] || mapStat.archived;
    return `[[color=${t[1]}]${t[0]}[/color] / [color=${s[1]}]${s[0]}[/color]]`;
  }

  function renderChrono(events) {
    const rows = events.map(e => {
      const status = renderStatus(e.type, e.status);
  
      // ⬇️ было: const dateHTML = e.hasDate ? ... : `[mark]дата не указана[/mark]`;
      const dateHTML = (e.type === 'au')
        ? (e.hasDate ? FMV.escapeHtml(e.dateDisplay) : '') // в AU — ничего, если даты нет
        : (e.hasDate ? FMV.escapeHtml(e.dateDisplay) : `[mark]дата не указана[/mark]`);
  
      const url  = FMV.escapeHtml(e.url);
      const ttl  = FMV.escapeHtml(e.episode || '');
      const ord  = ` [порядок: ${FMV.escapeHtml(String(e.order ?? 0))}]`;
  
      const asBB = true;
      const names = (e.participantsLower && e.participantsLower.length)
        ? e.participantsLower.map(low => {
            const idNum = parseInt(String(low).replace(/^user/i, ''), 10);
            const hasId = Number.isFinite(idNum) && idNum > 0;
            const idKey = hasId ? String(idNum) : null;
            const known = !!(idKey && e.idToNameMap?.has(idKey));
            const display = known
              ? userLink(idKey, e.idToNameMap.get(idKey), asBB)
              : missingUser(hasId ? `user${idKey}` : String(low), asBB);
            const roles = Array.from(e.masksByCharLower.get(low) || []);
            const tail  = roles.length ? ` [as ${FMV.escapeHtml(roles.join(', '))}]` : '';
            return `${display}${tail}`;
          }).join(', ')
        : `[mark]не указаны[/mark]`;
  
      const loc = (e.locationsLower && e.locationsLower.length)
        ? FMV.escapeHtml(e.locationsLower.join(', '))
        : `[mark]локация не указана[/mark]`;
  
      const dash = dateHTML ? ' — ' : ' ';
      return `${status} ${dateHTML}${dash}[url=${url}]${ttl}[/url]${ord}\n[i]${names}[/i]\n${loc}\n\n`;
    });
  
    const body = rows.join('') || ``;
    return `[media="Собранная хронология"]${body}[/media]`;
  }

  /* ===================== РАЗБОР ДАТ (исправлен) ===================== */

  const DASH_RX = /[\u2012-\u2015\u2212—–−]/g;

  function toYYYY(n){
    const num = Number(n);
    if (!Number.isFinite(num)) return null;
    return String(n).length === 2 ? (num > 30 ? 1900 + num : 2000 + num) : num;
  }
  const pad2 = x => String(x).padStart(2,'0');
  function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); }
  

  function parseDateFlexible(raw) {
    let s = String(raw || '').trim();
    if (!s) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
  
    // нормализуем тире и «точки» (вдруг в заголовке стоят ∙ • · или U+2024)
    s = s
      .replace(/[\u2012-\u2015\u2212—–−]/g, '-')          // все тире -> '-'
      .replace(/[.\u2024\u2219\u00B7\u2027\u22C5·∙•]/g, '.')
      .replace(/\s*-\s*/g, '-');
  
    const parts = s.split('-').slice(0,2);
    if (parts.length === 1) {
      const one = parseToken(parts[0]);
      if (!one || !one.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
      const k = [one.y, one.m ?? 0, one.d ?? 0];
      return { hasDate:true, display:displaySingle(one), startSort:k, endSort:k };
    }
  
    const leftRaw  = parts[0].trim();
    const rightRaw = parts[1].trim();
  
    const R0 = parseToken(rightRaw);
    if (!R0 || !R0.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
  
    let L0 = parseToken(leftRaw);
  
    // если слева только 1–2 цифры — день/месяц по контексту справа
    const mSolo = leftRaw.match(/^\d{1,2}$/);
    if (mSolo) {
      const v = +mSolo[0];
      if (R0.d != null && R0.m != null)      L0 = { y:R0.y, m:R0.m, d:v };   // 12-13.12.98
      else if (R0.m != null)                 L0 = { y:R0.y, m:v };           // 11-12.2001
      else                                   L0 = { y: toYYYY(v) };          // 97-98
    }
  
    if (L0 && L0.y == null && L0.d != null && L0.m != null && R0.y) L0.y = R0.y; // 30.11-02.12.01
  
    // валидация дней после подстановок
    const okDay = (o)=> (o.d==null) || (o.y && o.m && o.d>=1 && o.d<=daysInMonth(o.y,o.m));
    if (!okDay(L0) || !okDay(R0)) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
  
    const startKey = [L0.y, L0.m ?? 0, L0.d ?? 0];
    const endKey   = [R0.y ?? L0.y, R0.m ?? 0, R0.d ?? 0];
  
    return { hasDate:true, display:displayRange(L0,R0), startSort:startKey, endSort:endKey };
  }

  function parseToken(t) {
    const s = String(t || '').trim()
      .replace(/[.\u2024\u2219\u00B7\u2027\u22C5·∙•]/g, '.');
  
    // dd.mm.yyyy / dd.mm.yy
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const d  = +m[1], mo = +m[2], y = toYYYY(m[3]);
      if (mo<1 || mo>12) return null;
      if (d<1 || d>daysInMonth(y,mo)) return null;
      return { y, m: mo, d };
    }
  
    // mm.yyyy / mm.yy  ← ПРИОРИТЕТНО!
    m = s.match(/^(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const mo = +m[1], y = toYYYY(m[2]);           // '12.00' -> 12, 2000
      if (mo>=1 && mo<=12) return { y, m: mo };
      // если «месяц» невалидный (0/13) — НЕ возвращаемся, пусть попробуют другие формы
    }
  
    // dd.mm (см. диапазоны слева)
    m = s.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (m) {
      const d = +m[1], mo = +m[2];
      if (mo>=1 && mo<=12 && d>=1 && d<=31) return { m: mo, d };
      return null;
    }
  
    // yyyy / yy
    m = s.match(/^(\d{2}|\d{4})$/);
    if (m) return { y: toYYYY(m[1]) };
  
    return null;
  }

  function displaySingle(a){ return a.d!=null ? `${String(a.d).padStart(2,'0')}.${String(a.m).padStart(2,'0')}.${a.y}`
                          : a.m!=null ? `${String(a.m).padStart(2,'0')}.${a.y}` : String(a.y); }
  
  function displayRange(a,b){
    if (a.d!=null && b.d!=null) return `${String(a.d).padStart(2,'0')}.${String(a.m).padStart(2,'0')}.${a.y}-${String(b.d).padStart(2,'0')}.${String(b.m).padStart(2,'0')}.${b.y}`;
    if (a.m!=null && b.m!=null) return `${String(a.m).padStart(2,'0')}.${a.y}-${String(b.m).padStart(2,'0')}.${b.y}`;
    return `${a.y}-${b.y}`;
  }


  /* ===================== УТИЛИТЫ ===================== */

  function parseTitle(text) {
    const m = String(text || '').match(/^\s*\[(.+?)\]\s*(.+)$/s);
    return m
      ? { dateRaw: m[1].trim(), episode: String(m[2]).replace(/\s+/g,' ').trim() }
      : { dateRaw: '',          episode: String(text).replace(/\s+/g,' ').trim() };
  }
  function firstPostNode(doc) {
    return doc.querySelector('.post.topicpost .post-content') ||
           doc.querySelector('.post.topicpost') || doc;
  }
  function findNextPage(doc) {
    const a = doc.querySelector('a[rel="next"], a[href*="&p="]:not([rel="prev"])');
    return a ? a.getAttribute('href') : null;
  }
  const abs = (base, href)=>{ try { return new URL(href, base).href; } catch { return href; } };
  const text = node => (node && (node.innerText ?? node.textContent) || '').trim();
  function normStatus(s) {
    if (s == null) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return String(s.status || s.code || (s.ok ? 'ok' : 'unknown'));
    return String(s);
  }
  function toPlainShort(s = '', limit = 200) {
    const t = String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > limit ? t.slice(0, limit) + '…' : t;
  }
})();
