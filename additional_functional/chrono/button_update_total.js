// button_update_total.js
(() => {
  'use strict';

  // входные условия
  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();

  if (!GID.length || !FID.length || !TID || !PID) {
    console.warn('[button_update_total] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID');
    return;
  }

  // разделы
  const SECTIONS = Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
    ? window.CHRONO_CHECK.ForumInfo : [];

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
        const htmlRaw = renderChrono(events);

        // 3) cp1251-safe (числовые сущности для символов вне ASCII/кириллицы)
        const html = FMV.toCp1251Entities(htmlRaw);

        // 4) публикация
        const res = await FMV.replaceComment(GID, PID, html);

        const st = normStatus(res.status);
        const success = !!res.ok || st === 'ok';
        setStatus(success ? 'Готово' : 'Ошибка');

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
      } finally {
        busy = false;
      }
    }
  });

  /* ===================== СБОРКА и РЕНДЕР ===================== */

  const MAX_PAGES_PER_SECTION = 50;

  async function collectEvents() {
    const seenTopics = new Set(); // дедуп по теме (id:<ID> или url:<URL>)
    let all = [];
    for (const sec of SECTIONS) {
      const part = await scrapeSection(sec, seenTopics);
      all = all.concat(part);
    }
    // сортировка уже на основе новых правил
    return all.filter(Boolean).sort(compareEvents);
  }

  async function scrapeSection(section, seenTopics) {
    let url = abs(location.href, `/viewforum.php?id=${section.id}`);
    const seenPages = new Set();
    const out  = [];
    let n = 0;
    let lastSig = ''; // сигнатура набора тем на странице

    while (url && !seenPages.has(url) && n < MAX_PAGES_PER_SECTION) {
      n++; seenPages.add(url);
      const doc = await FMV.fetchDoc(url);

      // ссылки на темы
      const topics = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
        const href = abs(url, a.getAttribute('href'));
        const m = href.match(/viewtopic\.php\?id=(\d+)/i);
        const title = text(a);
        if (!m) return;
        if (/^\s*(RSS|Atom)\s*$/i.test(title)) return;
        if (/#p\d+$/i.test(href)) return; // якоря на конкретные сообщения
        if (/^\d{1,2}\.\d{1,2}\.\d{2,4}(?:\s+\d{1,2}:\d{2})?$/.test(title)) return; // «заголовок»-дата
        topics.set(m[1], { url: href, title });
      });

      // STOP #1: страница без прогресса (повтор сигнатуры)
      const sig = Array.from(topics.keys()).sort().join(',');
      if (sig && sig === lastSig) break;
      lastSig = sig;

      for (const [tid, { url: turl, title }] of topics) {
        const key = tid ? `id:${tid}` : `url:${turl.replace(/#.*$/,'')}`;
        if (seenTopics.has(key)) continue; // глобальная дедупликация

        const row = await scrapeTopic(turl, title, section.type, section.status);
        if (row) {
          seenTopics.add(key);
          out.push(row);
        }
      }

      const next = findNextPage(doc);
      const nextUrl = next ? abs(url, next) : null;

      // STOP #2: нет next или «следующая» указывает на уже посещённую
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
      const ord = FMV.parseOrderStrict(rawOrder);

      const participantsLower = uni.ok ? uni.participantsLower : [];
      const masksByCharLower  = uni.ok ? uni.masksByCharLower  : new Map();
      const locationsLower    = rawLoc ? rawLoc.split(/\s*[,;]\s*/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];
      const order             = ord.ok ? ord.value : 0; // по правилам: нет — значит 0

      const titleFromCrumbs = topicTitleFromCrumbs(doc);
      const safeTitle = rawTitle || titleFromCrumbs || '';
      const { dateRaw, episode } = parseTitle(safeTitle);

      const parsed = parseDateFlexible(dateRaw); // НОВЫЙ разбор дат

      return {
        type, status, url: topicUrl,
        episode, dateRaw,
        hasDate: parsed.hasDate,
        dateDisplay: parsed.display,
        startSort: parsed.startSort, // [y, m||0, d||0]
        endSort: parsed.endSort,     // [y, m||0, d||0]
        locationsLower, participantsLower, masksByCharLower, order,
        idToNameMap
      };
    } catch { return null; }
  }

  /* ===================== СОРТИРОВКА ПО НОВЫМ ПРАВИЛАМ ===================== */

  function compareTriples(aArr, bArr) {
    // aArr/bArr вида [y, m, d]
    for (let i = 0; i < 3; i++) {
      const da = (aArr[i] ?? 0) - (bArr[i] ?? 0);
      if (da) return da;
    }
    return 0;
  }

  function compareEvents(a, b) {
    const aHas = !!a.hasDate, bHas = !!b.hasDate;
    if (aHas !== bHas) return aHas ? -1 : 1; // 1) сначала с датой

    if (aHas && bHas) {
      // 2) по дате начала
      const s = compareTriples(a.startSort, b.startSort);
      if (s) return s;

      // 3) по дате конца (если нет конца — равен началу)
      const e = compareTriples(a.endSort, b.endSort);
      if (e) return e;
    }

    // 4) по order (дефолт 0)
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;

    // 5) по title (lowercase, алфавит по 'ru')
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

      // дата: показываем нормализованный текст; если нет — пометка (кроме AU можно оставить пусто, но решено подсветить)
      const dateHTML = e.hasDate
        ? FMV.escapeHtml(e.dateDisplay)
        : `[mark]дата не указана[/mark]`;

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

  /* ===================== НОВЫЙ РАЗБОР ДАТ ===================== */
  // Правила:
  // - yy → 19yy если > 30; иначе 20yy
  // - одиночная дата → формат показа: dd.mm.yyyy / mm.yyyy / yyyy
  // - диапазон → dd.mm.yyyy-dd.mm.yyyy / mm.yyyy-mm.yyyy / yyyy-yyyy
  // - для сортировки «нулевые» m=0/d=0, если они отсутствуют
  // Поддерживаемые записи внутри [дата]: см. описание пользователя.

  const DASH_RX = /[\u2012-\u2015\u2212—–−]/g; // разные тире

  function toYYYY(n) {
    // n: 2- или 4-значный год
    const num = Number(n);
    if (!Number.isFinite(num)) return null;
    if (String(n).length === 2) {
      return num > 30 ? 1900 + num : 2000 + num;
    }
    return num;
  }

  function pad2(x) { return String(x).padStart(2, '0'); }

  function daysInMonth(y, m) {
    if (!y || !m) return 31;
    return new Date(y, m, 0).getDate();
  }

  function parseDateFlexible(raw) {
    let s = String(raw || '').trim();
    if (!s) return { hasDate: false, display: '', startSort: [0,0,0], endSort: [0,0,0] };

    // нормализуем тире и пробелы вокруг
    s = s.replace(DASH_RX, '-').replace(/\s*-\s*/g, '-');

    const parts = s.split('-').slice(0, 2); // максимум две части
    if (parts.length === 1) {
      const one = parseToken(parts[0]);
      if (!one || !one.y) return { hasDate: false, display: '', startSort: [0,0,0], endSort: [0,0,0] };

      const start = one;
      const disp = displaySingle(start);
      return {
        hasDate: true,
        display: disp,
        startSort: [start.y, start.m ?? 0, start.d ?? 0],
        endSort: [start.y, start.m ?? 0, start.d ?? 0]
      };
    }

    // диапазон
    const rightRaw = parts[1];
    const leftRaw  = parts[0];

    const R0 = parseToken(rightRaw); // должен дать хотя бы год
    if (!R0 || !R0.y) return { hasDate: false, display: '', startSort: [0,0,0], endSort: [0,0,0] };

    let L0 = parseToken(leftRaw, R0); // можно использовать контекст справа (y/m)

    // если левая часть оказалась «numSolo», определить по контексту
    if (!L0 || !L0.y) {
      // если это «рядом» с R0:
      // - R0: ymd → L0: dd → dd.mm.y
      // - R0: my  → L0: mm → mm.y
      // - R0: y   → L0: y
      const leftNum = onlyNum(leftRaw);
      if (leftNum != null) {
        if (R0.d != null && R0.m != null) {
          L0 = { y: R0.y, m: R0.m, d: leftNum };
        } else if (R0.m != null) {
          L0 = { y: R0.y, m: leftNum };
        } else {
          // оба — годы
          L0 = { y: toYYYY(leftNum) };
        }
      }
    }

    // если левая «dd.mm», а справа только год — добавим год слева
    if (L0 && L0.y == null && L0.d != null && L0.m != null && R0.y) {
      L0.y = R0.y;
    }
    // если левая «dd», а справа «mm.y» → добавим месяц и год слева
    if (L0 && L0.y == null && L0.d != null && L0.m == null && R0.m != null && R0.y) {
      L0.m = R0.m; L0.y = R0.y;
    }

    // валидация (если есть день — должен укладываться в месяц)
    if (L0 && L0.d != null) {
      if (!(L0.m && L0.y && L0.d >= 1 && L0.d <= daysInMonth(L0.y, L0.m))) {
        return { hasDate: false, display: '', startSort: [0,0,0], endSort: [0,0,0] };
      }
    }
    if (R0 && R0.d != null) {
      if (!(R0.m && R0.y && R0.d >= 1 && R0.d <= daysInMonth(R0.y, R0.m))) {
        return { hasDate: false, display: '', startSort: [0,0,0], endSort: [0,0,0] };
      }
    }

    const start = L0;
    const end   = R0;

    // финальная нормализация сорт-ключей: отсутствующие m/d → 0
    const ss = [start.y, start.m ?? 0, start.d ?? 0];
    const ee = [end.y   ?? start.y, (end.m ?? 0), (end.d ?? 0)];

    const disp = displayRange(start, end);
    return { hasDate: true, display: disp, startSort: ss, endSort: ee };
  }

  // попробуем разобрать кусок даты
  // Возвращает объект из {y, m?, d?} или null
  function parseToken(tok) {
    const t = String(tok || '').trim();

    // dd.mm.yyyy / dd.mm.yy
    let m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const d = +m[1], mo = +m[2], y = toYYYY(m[3]);
      if (!(mo >= 1 && mo <= 12)) return null;
      if (!(d >= 1 && d <= daysInMonth(y, mo))) return null;
      return { y, m: mo, d };
    }

    // dd.mm  (год возьмём из второй части при диапазоне)
    m = t.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (m) {
      const d = +m[1], mo = +m[2];
      if (!(mo >= 1 && mo <= 12)) return null;
      if (!(d >= 1 && d <= 31)) return null; // проверим финально после подстановки года
      return { d, m: mo };
    }

    // mm.yyyy / mm.yy
    m = t.match(/^(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const mo = +m[1], y = toYYYY(m[2]);
      if (!(mo >= 1 && mo <= 12)) return null;
      return { y, m: mo };
    }

    // yyyy / yy
    m = t.match(/^(\d{2}|\d{4})$/);
    if (m) {
      const y = toYYYY(m[1]);
      return { y };
    }

    // только число (dd или mm) — разберём на этапе слияния с контекстом
    m = t.match(/^(\d{1,2})$/);
    if (m) {
      const v = +m[1];
      return { numSolo: v };
    }

    return null;
  }

  function onlyNum(t) {
    const m = String(t||'').trim().match(/^(\d{1,2})$/);
    return m ? +m[1] : null;
  }

  function displaySingle(a) {
    if (a.d != null) return `${pad2(a.d)}.${pad2(a.m)}.${a.y}`;
    if (a.m != null) return `${pad2(a.m)}.${a.y}`;
    return String(a.y);
  }

  function displayRange(a, b) {
    const bothHaveDay = (a.d != null) && (b.d != null);
    const bothHaveMon = (a.m != null) && (b.m != null);

    if (bothHaveDay) {
      return `${pad2(a.d)}.${pad2(a.m)}.${a.y}-${pad2(b.d)}.${pad2(b.m)}.${b.y}`;
    }
    if (bothHaveMon) {
      return `${pad2(a.m)}.${a.y}-${pad2(b.m)}.${b.y}`;
    }
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

  function abs(base, href) { try { return new URL(href, base).href; } catch { return href; } }
  function text(node) { return (node && (node.innerText ?? node.textContent) || '').trim(); }
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
