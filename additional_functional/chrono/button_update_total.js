// button_update_complete.js
(() => {
  'use strict';

  /* ===================== CHRONO_CHECK входные ===================== */
  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();

  // перечень секций (форумов), которые обходим при сборке.
  // можно переопределить в CHRONO_CHECK.Sections
  // формат: { id: <forumId>, type: 'personal'|'plot'|'au', status: 'on'|'off'|'archived' }
  const SECTIONS = Array.isArray(window.CHRONO_CHECK?.Sections) && window.CHRONO_CHECK.Sections.length
    ? window.CHRONO_CHECK.Sections
    : [
        // добавь сюда свои форумы при необходимости
        { id: 8, type: 'au', status: 'on' }
      ];

  if (!GID.length || !FID.length || !TID || !PID) {
    console.warn('[button_update_complete] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID');
    return;
  }

  /* ===================== КНОПКА ===================== */
  let busy = false;

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'Обновить итог',
    order: 1,
    showStatus: false,
    showDetails: false,
    showLink: false,

    async onClick() {
      if (busy) return;
      busy = true;
      try {
        // 1) собрать события
        const events = await collectEvents();
        // 2) отрендерить «Собранную хронологию»
        const html = renderChrono(events);

        // 3) убедиться, что FMV.replaceComment загружена
        if (!(window.FMV && typeof FMV.replaceComment === 'function')) {
          console.error('[update_complete] FMV.replaceComment не найдена — проверь порядок подключений.');
          return;
        }

        // 4) заменить комментарий
        const res = await FMV.replaceComment(GID, PID, html);
        const st  = res.status;

        if (res.ok) {
          console.info(`[update_complete] ✅ Комментарий #${PID} обновлён. Статус: ${st}`);
          if (res.infoMessage) console.info(res.infoMessage);
        } else {
          console.error(`[update_complete] ✖ Не удалось обновить #${PID}. Статус: ${st}`);
          if (res.errorMessage) console.error(res.errorMessage);
          else if (res.infoMessage) console.info(res.infoMessage);
        }
      } catch (e) {
        console.error('[update_complete] Ошибка выполнения:', e);
      } finally {
        busy = false;
      }
    }
  });

  /* ===================== СБОРКА «как заведено» ===================== */
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

      // теги из первого поста
      const rawChars = FMV.readTagText(first, 'characters');
      const rawLoc   = FMV.readTagText(first, 'location');
      const rawOrder = FMV.readTagText(first, 'order');

      // карта userN -> имя
      const idToNameMap = await FMV.buildIdToNameMapFromTags(rawChars);

      // унифицированный разбор персонажей
      const uni = FMV.parseCharactersUnified(rawChars, idToNameMap, window.profileLink);
      const ord = FMV.parseOrderStrict(rawOrder);

      const participantsLower = uni.ok ? uni.participantsLower : [];
      const masksByCharLower  = uni.ok ? uni.masksByCharLower  : new Map();
      const locationsLower    = rawLoc ? rawLoc.split(/\s*[,;]\s*/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];
      const order             = ord.ok ? ord.value : null;

      // заголовок: [даты] название
      const { dateRaw, episode, hasBracket } = parseTitle(rawTitle);

      // специфика типов
      const isAu  = (type === 'au');
      const range = isAu ? { start: TMAX, end: TMAX, kind: 'unknown', bad: false } : parseDateRange(dateRaw);
      const auStart = /^\s*\[\s*au\s*\]/i.test(String(rawTitle || ''));
      const dateBad = isAu ? !auStart : (!hasBracket || range.bad);
      const plotBad = (type === 'plot') ? !/\s\[\s*с\s*\]\s*$/iu.test(String(rawTitle || '')) : false;

      return {
        type, status, url: topicUrl,
        episode, dateRaw, range, dateBad, plotBad,
        locationsLower, participantsLower, masksByCharLower, order,
        idToNameMap
      };
    } catch (e) {
      console.warn('[update_complete] skip topic', topicUrl, e);
      return null;
    }
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

  /* ===================== РЕНДЕР ===================== */
  const MISS = 'background:#ffe6e6;color:#b00020;border-radius:6px;padding:0 .35em;font-weight:700';

  function renderStatus(type, status) {
    const mapType = { personal:['personal','black'], plot:['plot','black'], au:['au','red'] };
    const mapStat = { on:['active','green'], off:['closed','teal'], archived:['archived','maroon'] };
    const t = mapType[type] || mapType.au;
    const s = mapStat[status] || mapStat.archived;
    return `[<span style="color:${t[1]}">${t[0]}</span> / <span style="color:${s[1]}">${s[0]}</span>]`;
  }

  function renderChrono(events) {
    const rows = events.map(e => {
      const status = renderStatus(e.type, e.status);

      const dateHTML = e.type === 'au'
        ? (e.dateBad ? `<span style="${MISS}">проблема с [au] в названии</span>` : '')
        : ((!e.dateRaw || e.dateBad)
            ? `<span style="${MISS}">дата не указана/ошибка</span>`
            : escapeHtml(formatRange(e.range)));

      const url  = escapeHtml(e.url);
      const ttl0 = (e.type === 'plot') ? e.episode.replace(/\s\[\s*с\s*\]\s*$/iu, '') : e.episode;
      const ttl  = escapeHtml(ttl0);
      const plotErr = (e.type === 'plot' && e.plotBad) ? ` <span style="${MISS}">нет " [с]"</span>` : '';
      const ord = (e.order != null) ? ` [${escapeHtml(String(e.order))}]` : '';

      const names = (e.participantsLower && e.participantsLower.length)
        ? e.participantsLower.map(low => {
            const id   = String(+low.replace(/^user/i, ''));
            const base = window.profileLink(id, e.idToNameMap?.get(id));
            const roles = Array.from(e.masksByCharLower.get(low) || []);
            const tail  = roles.length ? ` [as ${escapeHtml(roles.join(', '))}]` : '';
            return `${base}${tail}`;
          }).join(', ')
        : `<span style="${MISS}">не указаны</span>`;

      const loc = (e.locationsLower && e.locationsLower.length)
        ? escapeHtml(e.locationsLower.join(', '))
        : `<span style="${MISS}">локация не указана</span>`;

      const dash = dateHTML ? ' — ' : ' ';
      return `<p>${status} ${dateHTML}${dash}<a href="${url}" rel="noopener" target="_blank">${ttl}</a>${plotErr}${ord}<br><i>${names}</i> / ${loc}</p>`;
    });

    const body = rows.join('') || `<p><i>— пусто —</i></p>`;
    return `
<div class="quote-box spoiler-box media-box">
  <div onclick="toggleSpoiler(this)">Собранная хронология</div>
  <blockquote>${body}</blockquote>
</div>`;
  }

  /* ===================== ПАРСИНГ ДАТ И ВСПОМОГАТЕЛЬНОЕ ===================== */
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
      crossYearBothYears:   /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      monthYear:            /^(\d{1,2})\.(\d{2}|\d{4})$/,
      yearOnly:             /^(\d{4})$/
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
    if (m) {
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

  async function fetchDoc(url) {
    // если есть твои хелперы — используем
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
