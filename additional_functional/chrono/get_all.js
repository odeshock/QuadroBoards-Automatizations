// ==UserScript==
// @name         auto_chrono (thin, uses FMV/common + profile + check_group)
// @namespace    fmv
// @match        *://*/viewtopic.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /* ============================ КОНФИГ ============================ */
  // Только на этой теме (допустимы #p.., &p=.. и т.п.)
  const TARGET_TOPIC_ID = '13';

  // Допущенные группы
  const ALLOWED_GROUP_IDS = ['1'];

  // Где ставим кнопку и куда кладём результат
  const SRC_HOST_SEL = '#p82 .post-box';     // контейнер, куда добавить кнопку
  const OUT_SEL      = '#p83-content';       // куда вывести собранную хронологию

  // Разделы (форумы) для обхода
  // type: personal | plot | au
  // status: on | off | archived
  const SECTIONS = [
    { id: 8, type: 'au',   status: 'on' },
    // добавляйте свои
  ];
  const MAX_PAGES_PER_SECTION = 50;
  const MAX_PAGES_USERLIST    = 200;

  /* ================= адрес и зависимости ================= */
  // фильтр по URL
  try {
    const u = new URL(location.href);
    if (u.pathname !== '/viewtopic.php' || u.searchParams.get('id') !== TARGET_TOPIC_ID) return;
  } catch { return; }

  // ждём общие модули
  waitFor(() =>
    window.FMV &&
    typeof FMV.escapeHtml === 'function' &&
    typeof FMV.parseCharactersStrict === 'function' &&
    typeof FMV.parseMasksStrict === 'function' &&
    typeof FMV.parseOrderStrict === 'function' &&
    typeof window.profileLink === 'function' &&
    typeof window.ensureAllowed === 'function'      // из check_group
  , { timeout: 15000 }).then(init);

  async function init () {
    // сообщаем check_group допустимые группы
    window.CHRONO_CHECK = window.CHRONO_CHECK || {};
    window.CHRONO_CHECK.GroupID = ALLOWED_GROUP_IDS.slice();

    // проверка доступа
    const allowed = await window.ensureAllowed();
    if (!allowed) return;

    mountButton();
  }

  /* ================= UI: кнопка ================= */
  function mountButton() {
    const host = document.querySelector(SRC_HOST_SEL);
    if (!host) return;

    // не плодим повторов
    if (host.querySelector('#fmv-chrono-btn')) return;

    const wrap = document.createElement('div');
    wrap.style.marginTop = '8px';

    const btn = document.createElement('a');
    btn.id = 'fmv-chrono-btn';
    btn.href = 'javascript:void(0)';
    btn.className = 'button';
    btn.textContent = 'Собрать хронологию';

    const note = document.createElement('span');
    note.id = 'fmv-chrono-note';
    note.style.marginLeft = '8px';
    note.style.opacity = '.85';

    wrap.append(btn, note);
    host.appendChild(wrap);

    btn.addEventListener('click', () => buildChrono({ btn, note }));
  }

  /* ================= логика сборки ================= */
  async function buildChrono({ btn, note }) {
    const outHost = document.querySelector(OUT_SEL);
    if (!outHost) {
      console.warn('[auto_chrono] контейнер вывода не найден:', OUT_SEL);
      return;
    }

    try {
      btn.disabled = true; btn.textContent = 'Собираю…';
      note.textContent = 'Готовлю хронологию…';

      // 1) карта «имя → href профиля» (для ссылок на имена в списке участников)
      const nameToProfile = await scrapeAllUsers();

      // 2) собираем события из разделов
      let events = [];
      for (const sec of SECTIONS) {
        const chunk = await scrapeSection(sec);
        events = events.concat(chunk);
      }
      events = events.filter(Boolean).sort(compareEvents);

      // 3) рендер
      outHost.innerHTML = renderChrono(events, nameToProfile);

      btn.disabled = false; btn.textContent = 'Пересобрать хронологию';
      note.textContent = 'Готово';
    } catch (e) {
      console.error('[auto_chrono] ошибка:', e);
      btn.disabled = false; btn.textContent = 'Пересобрать хронологию';
      note.textContent = 'Ошибка';
    }
  }

  /* ============== обход форумов и тем (используем helpers при наличии) ============== */
  async function scrapeSection(section) {
    let page = `${location.origin}/viewforum.php?id=${section.id}`;
    const seen = new Set();
    const out  = [];
    let count  = 0;

    while (page && !seen.has(page) && count < MAX_PAGES_PER_SECTION) {
      count++; seen.add(page);

      const doc = await fetchDoc(page);

      // ссылки на темы на странице
      const topics = new Map();
      doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a=>{
        const href = abs(page, a.getAttribute('href'));
        const m    = href.match(/viewtopic\.php\?id=(\d+)/i);
        if (!m) return;
        const id = m[1];
        const title = safeText(a);
        if (/^\s*(RSS|Atom)\s*$/i.test(title)) return;
        if (!topics.has(id)) topics.set(id, { url: href, title });
      });

      // идём в каждую тему
      for (const { url, title } of topics.values()) {
        const row = await scrapeTopic(url, title, section.type, section.status);
        if (row) out.push(row);
      }

      // пагинация
      const nextRel = doc.querySelector('a[rel="next"]');
      const next = nextRel ? nextRel.getAttribute('href') : null;
      page = next ? abs(page, next) : null;
    }

    return out;
  }

  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const doc   = await fetchDoc(topicUrl);
      const first = firstPostNode(doc);

      // «сырые» значения из первого поста
      const rawChars = FMV.readTagText(first, 'characters');
      const rawMasks = FMV.readTagText(first, 'masks');
      const rawLoc   = FMV.readTagText(first, 'location');
      const rawOrder = FMV.readTagText(first, 'order');

      // карта id->имя (на всякий случай подхватим с текущей страницы темы)
      // карта имён ровно по тем userID, что есть в <characters>/<masks>
      const idToNameMap = await FMV.buildIdToNameMapFromTags(rawChars, rawMasks);

      // строгие парсеры из общего модуля
      const chars = FMV.parseCharactersStrict(rawChars, idToNameMap, window.profileLink);
      const masks = FMV.parseMasksStrict(rawMasks,      idToNameMap, window.profileLink);
      const ord   = FMV.parseOrderStrict(rawOrder);

      // структуры «как в chrono»
      const charactersLower   = chars.ok ? chars.participantsLower : [];
      const masksByCharLower  = masks.ok ? masks.mapLower : new Map();
      const maskKeysLower     = new Set(masksByCharLower.keys());
      const participantsLower = Array.from(new Set([...charactersLower, ...maskKeysLower]));
      const locationsLower    = rawLoc ? rawLoc.split(/\s*[,;]\s*/).map(s=>s.trim().toLowerCase()).filter(Boolean) : [];
      const order             = ord.ok ? ord.value : null;

      // заголовок: [даты] название
      const { dateRaw, episode, hasBracket } = parseTitle(rawTitle);
      const isAu   = (type === 'au');
      const range  = isAu ? { start: TMAX, end: TMAX, kind: 'unknown', bad: false } : parseDateRange(dateRaw);
      const auAtStart = /^\s*\[\s*au\s*\]/i.test(String(rawTitle || ''));
      const dateBad = isAu ? !auAtStart : (!hasBracket || range.bad);

      // для plot — требуем хвост « [с]» в конце
      const plotBad = (type === 'plot') ? !/\s\[\s*с\s*\]\s*$/iu.test(String(rawTitle || '')) : false;

      return {
        type, status, url: topicUrl,
        episode, dateRaw, range, dateBad, plotBad,
        locationsLower, charactersLower, participantsLower,
        masksByCharLower, maskKeysLower, order,
        idToNameMap              
      };
    } catch (e) {
      console.warn('[auto_chrono] skip topic', topicUrl, e);
      return null;
    }
  }

  /* ===================== рендер (как в chrono) ===================== */
  const MISS = 'background:#ffe6e6;color:#b00020;border-radius:6px;padding:0 .35em;font-weight:700';

  function renderChrono(events, nameToProfile) {
    const items = events.map(e => {
      const status = renderStatus(e.type, e.status);

      const dateHTML = e.type === 'au'
        ? (e.dateBad ? `<span style="${MISS}">проблема с [au] в названии</span>` : '')
        : ((!e.dateRaw || e.dateBad)
            ? `<span style="${MISS}">дата не указана/ошибка</span>`
            : FMV.escapeHtml(formatRange(e.range)));

      const url  = FMV.escapeHtml(e.url);
      const ttl0 = (e.type === 'plot') ? e.episode.replace(/\s\[\s*с\s*\]\s*$/iu, '') : e.episode;
      const ttl  = FMV.escapeHtml(ttl0);
      const plotErr = (e.type === 'plot' && e.plotBad) ? ` <span style="${MISS}">нет " [с]"</span>` : '';
      const ord = (e.order != null) ? ` [${FMV.escapeHtml(String(e.order))}]` : '';

      // участники
      const charsSet = new Set(e.charactersLower || []);
      const names = (e.participantsLower && e.participantsLower.length)
        ? e.participantsLower.map(low => {
            const maskOnly = e.maskKeysLower?.has(low) && !charsSet.has(low);
            // только имена (userN) линковать — роли «[as …]» не линкуем
            const href = nameToProfile.get(low);
            const base = FMV.escapeHtml(low);
            const person = href && !maskOnly
              ? `<a href="${FMV.escapeHtml(href)}" rel="nofollow">${base}</a>`
              : (maskOnly ? `<span style="${MISS}">${base}</span>` : base);

            const roles = Array.from(e.masksByCharLower.get(low) || []);
            const tail  = roles.length ? ` [as ${FMV.escapeHtml(roles.join(', '))}]` : '';
            return person + tail;
          }).join(', ')
        : `<span style="${MISS}">не указаны</span>`;

      // локация
      const loc = (e.locationsLower && e.locationsLower.length)
        ? FMV.escapeHtml(e.locationsLower.join(', '))
        : `<span style="${MISS}">локация не указана</span>`;

      const dash = dateHTML ? ' — ' : ' ';
      return `<p>${status} ${dateHTML}${dash}<a href="${url}" rel="nofollow">${ttl}</a>${plotErr}${ord}<br><i>${names}</i> / ${loc}</p>`;
    });

    const body = items.join('') || `<p><i>— пусто —</i></p>`;

    return `
<div class="quote-box spoiler-box media-box">
  <div onclick="toggleSpoiler(this)">Собранная хронология</div>
  <blockquote>${body}</blockquote>
</div>`;
  }

  function renderStatus(type, status) {
    const mapType = { personal:['personal','black'], plot:['plot','black'], au:['au','red'] };
    const mapStat = { on:['active','green'], off:['closed','teal'], archived:['archived','maroon'] };
    const t = mapType[type] || mapType.au;
    const s = mapStat[status] || mapStat.archived;
    return `[<span style="color:${t[1]}">${t[0]}</span> / <span style="color:${s[1]}">${s[0]}</span>]`;
  }

  /* ===================== утилиты: сеть/датапарс ===================== */
  // helpers: используем, если есть
  const fetchHtml = window.fetchHtml;
  const parseHTMLHelper = window.parseHTML;

  async function fetchDoc(url) {
    if (typeof fetchHtml === 'function') {
      const html = await fetchHtml(url);
      return parseHTMLHelper ? parseHTMLHelper(html) : new DOMParser().parseFromString(html, 'text/html');
    }
    // fallback
    const res = await fetch(url, { credentials:'include' });
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function firstPostNode(doc) {
    return doc.querySelector('.post.topicpost .post-content') ||
           doc.querySelector('.post.topicpost') || doc;
  }

  function abs(base, href) {
    try { return new URL(href, base).href; } catch { return href; }
  }

  function safeText(node) {
    return (node && (node.innerText ?? node.textContent) || '').trim();
  }

  // заголовок: [дата] название
  const TITLE_RE = /^\s*\[(.+?)\]\s*(.+)$/s;
  function parseTitle(text) {
    const m = String(text||'').match(TITLE_RE);
    return m
      ? { dateRaw: m[1].trim(), episode: String(m[2]).replace(/\s+/g,' ').trim(), hasBracket: true }
      : { dateRaw: '',          episode: String(text).replace(/\s+/g,' ').trim(), hasBracket: false };
  }

  // даты (как в chrono)
  const TMAX = [9999,12,31];
  const z2   = (n) => String(n).padStart(2, '0');
  function formatRange(r) {
    const [y1,m1,d1] = r.start, [y2,m2,d2] = r.end;
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
  function isValidDate(y,m,d){ if(!Number.isFinite(y)||y<0)return false; if(!Number.isFinite(m)||m<1||m>12)return false; if(!Number.isFinite(d)||d<1)return false; return d<=new Date(y,m,0).getDate(); }
  function parseDateRange(src){
    let txt=String(src||'').trim(); if(!txt) return {start:TMAX,end:TMAX,kind:'unknown',bad:true};
    txt = txt.replace(/[\u2012-\u2015\u2212—–−]+/g,'-').replace(/\s*-\s*/g,'-');
    const P={
      single:/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      dayRangeSameMonth:/^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      crossMonthTailYear:/^(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      crossYearBothYears:/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})-(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
      monthYear:/^(\d{1,2})\.(\d{2}|\d{4})$/,
      yearOnly:/^(\d{4})$/ };
    const toI=(x)=>parseInt(x,10), fixY=(y)=>String(y).length===2?1900+parseInt(y,10):parseInt(y,10), clamp=(y,m,d)=>[Math.max(0,y),Math.min(Math.max(1,m),12),Math.min(Math.max(0,d),31)];
    let m=txt.match(P.single); if(m){const d=toI(m[1]),mo=toI(m[2]),y=fixY(m[3]); const bad=!isValidDate(y,mo,d); const a=clamp(y,mo,d); return {start:a,end:a.slice(),kind:'single',bad};}
    m=txt.match(P.dayRangeSameMonth); if(m){const d1=toI(m[1]),d2=toI(m[2]),mo=toI(m[3]),y=fixY(m[4]); const bad=!isValidDate(y,mo,d1)||!isValidDate(y,mo,d2); return {start:clamp(y,mo,d1),end:clamp(y,mo,d2),kind:'day-range',bad};}
    m=txt.match(P.crossMonthTailYear); if(m){const d1=toI(m[1]),mo1=toI(m[2]),d2=toI(m[3]),mo2=toI(m[4]),y=fixY(m[5]); const bad=!isValidDate(y,mo1,d1)||!isValidDate(y,mo2,d2); return {start:clamp(y,mo1,d1),end:clamp(y,mo2,d2),kind:'cross-month',bad};}
    m=txt.match(P.crossYearBothYears); if(m){const d1=toI(m[1]),mo1=toI(m[2]),y1=fixY(m[3]); const d2=toI(m[4]),mo2=toI(m[5]),y2=fixY(m[6]); const bad=!isValidDate(y1,mo1,d1)||!isValidDate(y2,mo2,d2); return {start:clamp(y1,mo1,d1),end:clamp(y2,mo2,d2),kind:(y1===y2?'cross-month':'cross-year'),bad};}
    m=txt.match(P.monthYear); if(m){const mo=toI(m[1]),y=fixY(m[2]); const bad=!Number.isFinite(y)||mo<1||mo>12; const a=clamp(y,mo,0); return {start:a,end:a.slice(),kind:'month',bad};}
    m=txt.match(P.yearOnly); if(m){const y=toI(m[1]); const bad=!Number.isFinite(y)||y<0; const a=clamp(y,1,0); return {start:a,end:a.slice(),kind:'year',bad};}
    return {start:TMAX,end:TMAX,kind:'unknown',bad:true};
  }

  // сортировка
  function compareEvents(a,b){
    const k = (r)=> r.start[0]*10000 + r.start[1]*100 + r.start[2];
    if (k(a.range)!==k(b.range)) return k(a.range)-k(b.range);
    const ke = (r)=> r.end[0]*10000 + r.end[1]*100 + r.end[2];
    if (ke(a.range)!==ke(b.range)) return ke(a.range)-ke(b.range);
    const ao = (a.order==null)? 1e9 : a.order;
    const bo = (b.order==null)? 1e9 : b.order;
    if (ao!==bo) return ao-bo;
    return (a.episode||'').localeCompare(b.episode||'','ru',{sensitivity:'base'});
  }

  /* ====== справочник пользователей (для ссылок по именам) ====== */
  async function scrapeAllUsers() {
    let page = `${location.origin}/userlist.php`;
    const seen = new Set();
    const nameToProfile = new Map();
    let cnt = 0;

    while (page && !seen.has(page) && cnt < MAX_PAGES_USERLIST) {
      cnt++; seen.add(page);

      const doc = await fetchDoc(page);
      doc.querySelectorAll('.usersname a, a[href*="profile.php?id="]').forEach(a=>{
        const nameText = safeText(a);
        if (!nameText) return;
        const norm = nameText.toLowerCase();
        if (!nameToProfile.has(norm)) {
          nameToProfile.set(norm, abs(page, a.getAttribute('href')));
        }
      });

      const nextRel = doc.querySelector('a[rel="next"]');
      page = nextRel ? abs(page, nextRel.getAttribute('href')) : null;
    }
    return nameToProfile;
  }

  /* ======================= утилита ожидания ======================= */
  function waitFor(check, { timeout=10000, interval=100 } = {}) {
    return new Promise(resolve => {
      const t0 = performance.now();
      (function tick(){
        try { if (check()) return resolve(true); } catch {}
        if (performance.now() - t0 > timeout) return resolve(false);
        setTimeout(tick, interval);
      })();
    });
  }
})();
