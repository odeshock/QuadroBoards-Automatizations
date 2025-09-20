// button_update_complete.js
(() => {
  'use strict';

  // входные условия
  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();

  if (!GID.length || !FID.length || !TID || !PID) {
    console.warn('[button_update_complete] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID');
    return;
  }

  // разделы (можно переопределить через CHRONO_CHECK.Sections)
  const SECTIONS = CHRONO_CHECK?.ForumInfo || [];

  let busy = false;

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить итог',
    order: 50,

    showStatus: true,
    showDetails: true,
    showLink: false,

    async onClick(api) {
      if (busy) return;
      busy = true;

      const setStatus  = (api && typeof api.setStatus  === 'function') ? api.setStatus  : (()=>{});
      const setDetails = (api && typeof api.setDetails === 'function') ? api.setDetails : (()=>{});

      try {
        setStatus('Выполняю…');
        setDetails('');

        // 1) сбор
        const events = await collectEvents();
        // 2) рендер «Собранной хронологии»
        const html = renderChrono(events);

        // 3) проверка наличия FMV.replaceComment
        if (!(window.FMV && typeof FMV.replaceComment === 'function')) {
          setStatus('Ошибка');
          setDetails('Не найдена FMV.replaceComment — проверь порядок подключений.');
          return;
        }

        // 4) замена комментария
        const res = await FMV.replaceComment(GID, PID, html);

        // ▸ нормализуем статус в строку (на случай объекта)
        function normStatus(s) {
          if (s == null) return '';
          if (typeof s === 'string') return s;
          if (typeof s === 'object') {
            return String(s.status || s.code || (s.ok ? 'ok' : 'unknown'));
          }
          return String(s);
        }

        // ▸ убираем HTML и укорачиваем
        function toPlainShort(s = '', limit = 200) {
          const t = String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          return t.length > limit ? t.slice(0, limit) + '…' : t;
        }

        const st = normStatus(res.status);
        const success = !!res.ok || st === 'ok';
        setStatus(success ? 'Готово' : 'Ошибка');

        const lines = [];
        lines.push(`<b>Статус:</b> ${success ? 'ok' : st || 'unknown'}`);

        const info  = toPlainShort(res.infoMessage || '');
        const error = toPlainShort(res.errorMessage || '');
        if (info)  lines.push(info);
        if (error) lines.push(`<span style="color:#b00020">${escapeHtml(error)}</span>`);

        setDetails(lines.join('<br>'));

      } catch (e) {
        setStatus('Ошибка');
        setDetails(escapeHtmlShort(e?.message || String(e)));
      } finally {
        busy = false;
      }
    }
  });

  /* ===================== СБОРКА и РЕНДЕР (HTML) ===================== */

  const MAX_PAGES_PER_SECTION = 50;
  const TMAX = [9999, 12, 31];

  async function collectEvents() {
    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec);
      all = all.concat(part);
    }
    return all.filter(Boolean).sort(compareEvents);
  }

  async function scrapeSection(section) {
    let url = abs(location.href, `/viewforum.php?id=${section.id}`);
    const seen = new Set();
    const out  = [];
    let n = 0;

    while (url && !seen.has(url) && n < MAX_PAGES_PER_SECTION) {
      n++; seen.add(url);
      const doc = await fetchDoc(url);

      // ссылки на темы
      const topics = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
        const href = abs(url, a.getAttribute('href'));
        const m = href.match(/viewtopic\.php\?id=(\d+)/i);
        const title = text(a);
        if (!m) return;
        if (/^\s*(RSS|Atom)\s*$/i.test(title)) return;
        topics.set(m[1], { url: href, title });
      });

      for (const { url: turl, title } of topics.values()) {
        const row = await scrapeTopic(turl, title, section.type, section.status);
        if (row) out.push(row);
      }

      const next = findNextPage(doc);
      url = next ? abs(url, next) : null;
    }
    return out;
  }

  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const doc   = await fetchDoc(topicUrl);
      const first = firstPostNode(doc);

      const rawChars = FMV.readTagText(first, 'characters');
      const rawLoc   = FMV.readTagText(first, 'location');
      const rawOrder = FMV.readTagText(first, 'order');

      const idToNameMap = await FMV.buildIdToNameMapFromTags(rawChars);

      const uni = FMV.parseCharactersUnified(rawChars, idToNameMap, window.profileLink);
      const ord = FMV.parseOrderStrict(rawOrder);

      const participantsLower = uni.ok ? uni.participantsLower : [];
      const masksByCharLower  = uni.ok ? uni.masksByCharLower  : new Map();
      const locationsLower    = rawLoc ? rawLoc.split(/\s*[,;]\s*/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];
      const order             = ord.ok ? ord.value : null;

      const titleFromCrumbs = topicTitleFromCrumbs(doc);
      const safeTitle = titleFromCrumbs || rawTitle || '';
      const { dateRaw, episode, hasBracket } = parseTitle(safeTitle);
      const isAu  = (type === 'au');
      const range = isAu ? { start: TMAX, end: TMAX, kind: 'unknown', bad: false } : parseDateRange(dateRaw);
      const auStart = /^\s*\[\s*(?:a|а)\s*(?:u|у)\s*\]/i.test(safeTitle);
      const dateBad = isAu ? !auStart : (!hasBracket || range.bad);
      const plotBad = (type === 'plot') ? !/\s\[\s*с\s*\]\s*$/iu.test(String(rawTitle || '')) : false;

      return {
        type, status, url: topicUrl,
        episode, dateRaw, range, dateBad, plotBad,
        locationsLower, participantsLower, masksByCharLower, order,
        idToNameMap
      };
    } catch { return null; }
  }

  function compareEvents(a, b) {
    const A = a?.range?.start || TMAX;
    const B = b?.range?.start || TMAX;
    for (let i = 0; i < 3; i++) {
      const d = (A[i] ?? 9999) - (B[i] ?? 9999);
      if (d) return d;
    }
    const ao = (a.order == null) ? 1e9 : a.order;
    const bo = (b.order == null) ? 1e9 : b.order;
    if (ao !== bo) return ao - bo;
    return String(a.episode || '').localeCompare(String(b.episode || ''), 'ru', { sensitivity: 'base' });
  }

  const MISS = 'background:#ffe6e6;color:#b00020;border-radius:6px;padding:0 .35em;font-weight:700';

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

      const dateHTML = e.type === 'au'
        ? (e.dateBad ? `[mark]проблема с [au] в названии[/mark]` : '')
        : ((!e.dateRaw || e.dateBad)
            ? `[mark]дата не указана/ошибка[/mark]`
            : escapeHtml(formatRange(e.range)));

      const url  = escapeHtml(e.url);
      const ttl0 = (e.type === 'plot') ? e.episode.replace(/\s\[\s*с\s*\]\s*$/iu, '') : e.episode;
      const ttl  = escapeHtml(ttl0);
      const plotErr = (e.type === 'plot' && e.plotBad) ? ` [mark]нет " [с]"[/mark]` : '';
      const ord = (e.order != null) ? ` [порядок: ${escapeHtml(String(e.order))}]` : '';

      // opts.asBB === true → рендерим в BB-коде, иначе в HTML как прежде
      const asBB = true;
      
      const names = (e.participantsLower && e.participantsLower.length)
        ? e.participantsLower.map(low => {
            const idStr = String(+String(low).replace(/^user/i, '')); // "user4" -> "4"
            const hasId = idStr !== '0' && /^\d+$/.test(idStr);
            const known = hasId && e.idToNameMap?.has(idStr);
            const display = known
              ? userLink(idStr, e.idToNameMap.get(idStr), asBB)
              : missingUser(hasId ? `user${idStr}` : String(low), asBB);
            const roles = Array.from(e.masksByCharLower.get(low) || []);
            const tail  = roles.length
              ? ` [as ${FMV.escapeHtml(roles.join(', '))}]`
              : '';

      return `${display}${tail}`;
    }).join(', ')
  : (asBB ? `[mark]не указаны[/mark]` : `<mark>не указаны</mark>`);


      const loc = (e.locationsLower && e.locationsLower.length)
        ? escapeHtml(e.locationsLower.join(', '))
        : `[mark]локация не указана[/mark]`;

      const dash = dateHTML ? ' — ' : ' ';
      return `${status} ${dateHTML}${dash}[url=${url}]${ttl}[/url]${plotErr}${ord}\n[i]${names}[/i]\n${loc}\n\n`;
    });

    const body = rows.join('') || ``;
    return `[media="Собранная хронология"]${body}[/media]`;
  }

  /* ===================== ВСПОМОГАТЕЛЬНОЕ ===================== */

  const z2 = n => String(n).padStart(2, '0');

  function formatRange(r) {
    const [y1, m1, d1] = r.start, [y2, m2, d2] = r.end;
    switch (r.kind) {
      case 'single':      return `${z2(d1)}.${z2(m1)}.${y1}`;
      case 'day-range':   return `${z2(d1)}-${z2(d2)}.${z2(m1)}.${y1}`;
      case 'cross-month': return `${z2(d1)}.${z2(m1)}-${z2(d2)}.${z2(m2)}.${y1}`;
      case 'month':       return `${z2(m1)}.${y1}`;
      case 'year':        return String(y1);
      default:
        if (y1 !== y2) return `${z2(d1)}.${z2(m1)}.${y1}-${z2(d2)}.${z2(m2)}.${y2}`;
        return `${z2(d1)}.${z2(m1)}-${z2(d2)}.${z2(m2)}.${y1}`;
    }
  }

  function isValidDate(y, m, d) {
    if (!Number.isFinite(y) || y < 0)   return false;
    if (!Number.isFinite(m) || m < 1)   return false;
    if (!Number.isFinite(d) || d < 1)   return false;
    return d <= new Date(y, m, 0).getDate();
  }

  function parseDateRange(src) {
    let txt = String(src || '').trim();
    if (!txt) return { start: TMAX, end: TMAX, kind: 'unknown', bad: true };

    txt = txt.replace(/[\u2012-\u2015\u2212—–−]+/g, '-').replace(/\s*-\s*/g, '-');

    const P = {
      single:               /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      dayRangeSameMonth:    /^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      crossMonthTailYear:   /^(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      crossYearBothYears:   /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\д{4})-(\д{1,2})\.(\д{1,2})\.(\д{2}|\д{4})$/,
      monthYear:            /^(\д{1,2})\.(\д{2}|\д{4})$/,
      yearOnly:             /^(\д{4})$/
    };

    const toI = x => parseInt(x, 10);
    const fixY = y => String(y).length === 2 ? (y >= 70 ? 1900 + y : 2000 + y) : y;
    const clamp = (y, m, d) => [Math.max(0, y), Math.min(Math.max(1, m), 12), Math.min(Math.max(1, d), 31)];

    let m = txt.match(P.single);
    if (m) {
      const d = toI(m[1]), mo = toI(m[2]), y = fixY(toI(m[3]));
      if (!isValidDate(y, mo, d)) return { start:TMAX, end:TMAX, kind:'single', bad:true };
      const a = clamp(y, mo, d); return { start:a, end:a.slice(), kind:'single', bad:false };
    }

    m = txt.match(P.dayRangeSameMonth);
    if (m) {
      const d1=toI(m[1]), d2=toI(m[2]), mo=toI(m[3]), y=fixY(toI(m[4]));
      if (!isValidDate(y, mo, d1) || !isValidDate(y, mo, d2)) return { start:TMAX, end:TMAX, kind:'day-range', bad:true };
      return { start:clamp(y, mo, d1), end:clamp(y, mo, d2), kind:'day-range', bad:false };
    }

    m = txt.match(P.crossMonthTailYear);
    if (m) {
      const d1=toI(m[1]), mo1=toI(m[2]), d2=toI(m[3]), mo2=toI(m[4]), y=fixY(toI(m[5]));
      if (!isValidDate(y, mo1, d1) || !isValidDate(y, mo2, d2)) return { start:TMAX, end:TMAX, kind:'cross-month', bad:true };
      return { start:clamp(y, mo1, d1), end:clamp(y, mo2, d2), kind:'cross-month', bad:false };
    }

    m = txt.match(P.crossYearBothYears);
    if (m) {
      const d1=toI(m[1]), mo1=toI(m[2]), y1=fixY(toI(m[3]));
      const d2=toI(m[4]), mo2=toI(m[5]), y2=fixY(toI(m[6]));
      if (!isValidDate(y1, mo1, d1) || !isValidDate(y2, mo2, d2)) return { start:TMAX, end:TMAX, kind:'cross-year', bad:true };
      return { start:[y1,mo1,d1], end:[y2,mo2,d2], kind:'cross-year', bad:false };
    }

    m = txt.match(P.monthYear);
    if (m) {
      const mo=toI(m[1]), y=fixY(toI(m[2]));
      if (!(mo>=1 && mo<=12)) return { start:TMAX, end:TMAX, kind:'month', bad:true };
      return { start:[y,mo,1], end:[y,mo,28], kind:'month', bad:false };
    }

    m = txt.match(P.yearOnly);
    if (m) { // <-- тут была кириллическая "м"
      const y=toI(m[1]);
      return { start:[y,1,1], end:[y,12,31], kind:'year', bad:false };
    }

    return { start:TMAX, end:TMAX, kind:'unknown', bad:true };
  }

  function parseTitle(text) {
    const m = String(text || '').match(/^\s*\[(.+?)\]\s*(.+)$/s);
    return m
      ? { dateRaw: m[1].trim(), episode: String(m[2]).replace(/\s+/g,' ').trim(), hasBracket: true }
      : { dateRaw: '',          episode: String(text).replace(/\s+/g,' ').trim(), hasBracket: false };
  }

  function firstPostNode(doc) {
    return doc.querySelector('.post.topicpost .post-content') ||
           doc.querySelector('.post.topicpost') || doc;
  }

  function findNextPage(doc) {
    const a = doc.querySelector('a[rel="next"], a[href*="&p="]:not([rel="prev"])');
    return a ? a.getAttribute('href') : null;
  }

  function abs(base, href) { try { return new URL(href, base).href; } catch { return href; } }
  function text(node) { return (node && (node.innerText ?? node.textContent) || '').trim(); }
  function escapeHtml(s = '') {
    return (window.FMV && typeof FMV.escapeHtml === 'function')
      ? FMV.escapeHtml(s)
      : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function escapeHtmlShort(s=''){
    const t = String(s);
    return escapeHtml(t.length > 500 ? t.slice(0,500) + '…' : t);
  }

  async function fetchDoc(url) {
    if (typeof window.fetchHtml === 'function') {
      const html = await window.fetchHtml(url);
      return (typeof window.parseHTML === 'function')
        ? window.parseHTML(html)
        : new DOMParser().parseFromString(html, 'text/html');
    }
    const res = await fetch(url, { credentials: 'include' });
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }
})();
