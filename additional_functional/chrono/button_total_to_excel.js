// auto_chrono_converter_to_excel.js
(() => {
  'use strict';

  // === входные ===
  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();
  const OPEN_URL = (new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href)).href;

  if (!GID.length || !FID.length || !TID || !PID) {
    console.warn('[auto_chrono_converter_to_excel] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID');
    return;
  }

  // разделы (можно переопределить через CHRONO_CHECK.ForumInfo)
  const SECTIONS = Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
    ? window.CHRONO_CHECK.ForumInfo
    : []; // по умолчанию пусто — пользователь сам задаёт

  // blob-url результата (чтобы ревокать при повторном клике)
  let lastBlobUrl = '';

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'выгрузить Excel',
    order: 55,

    showStatus: true,
    showDetails: true,
    showLink: false,            // ссылку покажем только при успехе

    async onClick(api) {
      if (!SECTIONS.length) {
        api?.setStatus?.('Ошибка');
        api?.setDetails?.('Нет разделов для обхода (CHRONO_CHECK.ForumInfo пуст).');
        return;
      }

      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});

      // спрячем/очистим линк в начале
      if (api?.setLinkVisible) api.setLinkVisible(false);
      if (api?.setLink)        api.setLink('', '');

      try {
        setStatus('Собираю…');
        setDetails('');

        // 1) сбор и сортировка по тем же правилам
        const events = await collectEvents();
        const total  = events.length;

        // 2) конвертация в таблицу
        setStatus('Формирую файл…');
        const { blob, filename } = buildXls(events);

        // 3) подготовить blob-url
        if (lastBlobUrl) { try { URL.revokeObjectURL(lastBlobUrl); } catch {} }
        lastBlobUrl = URL.createObjectURL(blob);

        // 4) показать ссылку «скачать» только при успехе
        setStatus('Готово');
        if (api?.setLink)        api.setLink(lastBlobUrl, 'скачать');
        if (api?.setLinkVisible) api.setLinkVisible(true);

        // детали
        const secList = SECTIONS.map(s => s.id + (s.type ? `/${s.type}` : '')).join(', ');
        setDetails(`<b>Эпизодов:</b> ${total}<br><b>Разделы:</b> ${FMV.escapeHtml(secList)}<br><b>Файл:</b> ${FMV.escapeHtml(filename)}`);

      } catch (e) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        if (api?.setLinkVisible) api.setLinkVisible(false);
        if (api?.setLink)        api.setLink('', '');
      }
    }
  });

  /* ===================== СБОРКА (как в «итоге») ===================== */

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
        const title = txt(a);
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

        const row = await scrapeTopic(turl, title, section.type || 'au', section.status || 'on');
        if (row) { seenTopics.add(key); out.push(row); }
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

      const ordParsed = FMV.parseOrderStrict(rawOrder);
      const order     = ordParsed.ok ? ordParsed.value : 0;

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
        startSort: parsed.startSort,   // [y, m||0, d||0]
        endSort:   parsed.endSort,     // [y, m||0, d||0]
        locationsLower, participantsLower, masksByCharLower, order,
        idToNameMap
      };
    } catch { return null; }
  }

  /* ===================== СОРТИРОВКА (те же правила) ===================== */

  const cmp3 = (a,b)=> (a[0]-b[0]) || (a[1]-b[1]) || (a[2]-b[2]);

  function compareEvents(a, b) {
    const aHas = !!a.hasDate, bHas = !!b.hasDate;
    if (aHas !== bHas) return aHas ? -1 : 1;

    if (aHas && bHas) {
      const s = cmp3(a.startSort, b.startSort);
      if (s) return s;
      const e = cmp3(a.endSort, b.endSort);
      if (e) return e;
    }

    const ao = a.order ?? 0, bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;

    const at = String(a.episode || '').toLowerCase();
    const bt = String(b.episode || '').toLowerCase();
    return at.localeCompare(bt, 'ru', { sensitivity: 'base' });
  }

  /* ===================== XLS (Excel-совместимый) ===================== */

  function buildXls(events) {
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const rowsHtml = events.map(e => {
      const [sy, sm, sd] = e.startSort || [0,0,0];
      const [ey, em, ed] = e.endSort   || [0,0,0];
      const participants = (e.participantsLower && e.participantsLower.length)
        ? e.participantsLower.map(low => {
            const idNum  = parseInt(String(low).replace(/^user/i, ''), 10);
            const hasId  = Number.isFinite(idNum) && idNum > 0;
            const idKey  = hasId ? String(idNum) : null;
            const known  = !!(idKey && e.idToNameMap?.has(idKey));
            const name   = known ? (e.idToNameMap.get(idKey) || `user${idKey}`) : String(low);
            const roles  = Array.from(e.masksByCharLower.get(low) || []);
            const tail   = roles.length ? ` [as ${roles.join(', ')}]` : '';
            return `${name}${tail}`;
          }).join(', ')
        : '';

      const locs = (e.locationsLower && e.locationsLower.length) ? e.locationsLower.join(', ') : '';

      return `<tr>
        <td>${esc(e.type)}</td>
        <td>${esc(e.status)}</td>
        <td>${esc(e.episode || '')}</td>
        <td>${esc(e.hasDate ? e.dateDisplay : '')}</td>
        <td>${esc(sy||'')}</td>
        <td>${esc(sm||'')}</td>
        <td>${esc(sd||'')}</td>
        <td>${esc(ey||'')}</td>
        <td>${esc(em||'')}</td>
        <td>${esc(ed||'')}</td>
        <td>${esc(e.order ?? 0)}</td>
        <td>${esc(participants)}</td>
        <td>${esc(locs)}</td>
        <td>${esc(e.url)}</td>
      </tr>`;
    }).join('');

    const html =
`<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
<style>
  table{border-collapse:collapse;font-family:Inter,Arial,sans-serif;font-size:12px}
  th,td{border:1px solid #ccc;padding:4px 6px;vertical-align:top}
  th{background:#f2f2f2}
</style>
</head><body>
<table>
  <thead><tr>
    <th>Тип</th>
    <th>Статус</th>
    <th>Название</th>
    <th>Дата (текст)</th>
    <th>Год начала</th><th>Месяц начала</th><th>День начала</th>
    <th>Год конца</th><th>Месяц конца</th><th>День конца</th>
    <th>Порядок</th>
    <th>Участники</th>
    <th>Локации</th>
    <th>Ссылка</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const filename = `chronology_${new Date().toISOString().slice(0,10)}.xls`;
    return { blob, filename };
  }

  /* ===================== ДАТЫ: парсер (как в «итоге») ===================== */

  const DOTS_RX  = /[.\u2024\u2219\u00B7\u2027\u22C5·∙•]/g;
  const DASH_RX  = /[\u2012-\u2015\u2212—–−]/g;

  function normalizeDateStr(s){
    return String(s||'')
      .replace(DASH_RX, '-')
      .replace(DOTS_RX, '.')
      .replace(/\s*-\s*/g, '-')
      .trim();
  }

  function parseDateFlexible(raw) {
    let s = normalizeDateStr(raw);
    if (!s) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };

    const parts = s.split('-').slice(0,2);

    // одиночная
    if (parts.length === 1) {
      const one = parseToken(parts[0]);
      if (!one || !one.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
      const key = [one.y, one.m ?? 0, one.d ?? 0];
      return { hasDate:true, display:FMV.displaySingle(one), startSort:key, endSort:key };
    }

    // диапазон
    const leftRaw  = parts[0].trim();
    const rightRaw = parts[1].trim();

    const R0 = parseToken(rightRaw);
    if (!R0 || !R0.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };

    let L0 = parseToken(leftRaw);

    // одиночное число слева → день/месяц/год по контексту
    const solo = leftRaw.match(/^\d{1,2}$/);
    if (solo) {
      const v = +solo[0];
      if (R0.d != null && R0.m != null)      L0 = { y:R0.y, m:R0.m, d:v };
      else if (R0.m != null)                 L0 = { y:R0.y, m:v };
      else                                   L0 = { y: FMV.toYYYY(v) };
    }

    // dd.mm слева без года → год как справа
    if (L0 && L0.y == null && L0.d != null && L0.m != null && R0.y) L0.y = R0.y;

    const okDay = o => (o.d==null) || (o.y && o.m && o.d>=1 && o.d<=FMV.daysInMonth(o.y,o.m));
    if (!okDay(L0) || !okDay(R0)) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };

    const startKey = [L0.y, L0.m ?? 0, L0.d ?? 0];
    const endKey   = [R0.y ?? L0.y, R0.m ?? 0, R0.d ?? 0];
    return { hasDate:true, display:FMV.displayRange(L0,R0), startSort:startKey, endSort:endKey };
  }

  // порядок: full date → month+year → dd.mm → year
  function parseToken(t) {
    const s = normalizeDateStr(t);

    // dd.mm.yyyy / dd.mm.yy
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const d  = +m[1], mo = +m[2], y = FMV.toYYYY(m[3]);
      if (mo<1 || mo>12) return null;
      if (d<1 || d>FMV.daysInMonth(y,mo)) return null;
      return { y, m: mo, d };
    }

    // mm.yyyy / mm.yy (приоритетно над dd.mm)
    m = s.match(/^(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const mo = +m[1], y = FMV.toYYYY(m[2]);
      if (mo>=1 && mo<=12) return { y, m: mo };
    }

    // dd.mm (без года)
    m = s.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (m) {
      const d = +m[1], mo = +m[2];
      if (mo>=1 && mo<=12 && d>=1 && d<=31) return { m: mo, d };
      return null;
    }

    // yyyy / yy
    m = s.match(/^(\d{2}|\d{4})$/);
    if (m) return { y: FMV.toYYYY(m[1]) };

    return null;
  }

  /* ===================== МЕЛОЧИ ===================== */

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
  const txt = node => (node && (node.innerText ?? node.textContent) || '').trim();
})();
