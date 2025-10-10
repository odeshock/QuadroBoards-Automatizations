/*!
 * QuadroBoards Automatizations - HEAD BUNDLE
 * @version 1.0.0
 */

/* MODULE 1: common.js */
// ===== FMV common (unified characters + users loader) =====
(function () {
  'use strict';

  const FMV = (window.FMV = window.FMV || {});

  /* ---------- tiny utils ---------- */
  FMV.escapeHtml = FMV.escapeHtml || function (s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  FMV.normSpace = FMV.normSpace || function (s) {
    return String(s ?? '').replace(/\s+/g, ' ').trim();
  };

  /** Читает текст тега <tag> из узла (без дублирования пробелов) */
  FMV.readTagText = FMV.readTagText || function (root, tag) {
    if (!root) return '';
    const el = root.querySelector(tag);
    return FMV.normSpace(el ? (el.textContent ?? '') : '');
  };

  /** Быстрый сбор имени из ссылок на текущей странице (подстраховка) */
  FMV.idToNameFromPage = FMV.idToNameFromPage || function () {
    const map = new Map();
    document.querySelectorAll('a[href*="profile.php?id="]').forEach(a => {
      const m = a.href.match(/profile\.php\?id=(\d+)/i);
      const name = FMV.normSpace(a.textContent || '');
      if (m && name && !map.has(m[1])) map.set(m[1], name);
    });
    return map;
  };

  /* ---------- order ---------- */
  /** Строгая проверка order: целое число; отдаёт ok, value и готовый html */
  FMV.parseOrderStrict = FMV.parseOrderStrict || function (orderText) {
    const raw = FMV.normSpace(orderText);
    if (!raw) return { ok: false, html: '' };
    if (/^-?\d+$/.test(raw)) {
      return { ok: true, value: parseInt(raw, 10), html: FMV.escapeHtml(raw) };
    }
    return {
      ok: false,
      html:
        `<span class="fmv-missing">Ошибка! Нужен формат целого числа (пример: -3 или 5)</span>` +
        ` — ${FMV.escapeHtml(raw)}`
    };
  };

  /* ---------- characters: извлечение id и карта имён ---------- */

  /** Вытягивает все userID из строки characters (формат: userN[=mask]; …) */
  FMV.extractUserIdsFromTags = FMV.extractUserIdsFromTags || function (charsText) {
    const ids = new Set();
    String(charsText || '').replace(/user(\d+)/gi, (_, d) => {
      ids.add(String(Number(d)));
      return _;
    });
    return Array.from(ids);
  };

  /**
   * Строит Map id->name по userID, указанным в characters.
   * Использует window.getProfileNameById(id) из profile_from_user, если доступно.
   * Если функция недоступна — вернёт пустую Map (а UI покажет "не найден").
   * Уважает глобальный кэш window.__FMV_ID_TO_NAME_MAP__ если он есть.
   */
  FMV.buildIdToNameMapFromTags = FMV.buildIdToNameMapFromTags || async function (charsText) {
    if (window.__FMV_ID_TO_NAME_MAP__ instanceof Map && window.__FMV_ID_TO_NAME_MAP__.size) {
      return window.__FMV_ID_TO_NAME_MAP__;
    }
    const ids = FMV.extractUserIdsFromTags(charsText);
    const map = new Map();

    if (typeof window.getProfileNameById !== 'function') return map;

    await Promise.all(ids.map(async (id) => {
      try {
        const name = await window.getProfileNameById(id);
        if (name) map.set(id, name);
      } catch { /* ignore */ }
    }));

    return map;
  };

  /* ---------- characters: единый парсер ---------- */

  /**
   * Разбирает unified-строку characters:
   *   "userN; userM=mask1; userM=mask2; userK"
   * Возвращает:
   *   ok                     — успешность
   *   participantsLower      — ['user5','user6', ...]
   *   masksByCharLower       — Map<'user5', Set(['mask1','mask2'])>
   *   htmlParticipants       — "<a ...>Имя</a> [as mask1, mask2]; <a ...>Имя</a>"
   *   htmlMasks              — "<a ...>Имя</a>=mask; ..."
   *   htmlError              — HTML ошибки формата (если не ок)
   */
  FMV.parseCharactersUnified = FMV.parseCharactersUnified || function (charsText, idToNameMap, profileLink = window.profileLink) {
    const raw = String(charsText || '').trim();
    if (!raw) {
      return {
        ok: false,
        participantsLower: [],
        masksByCharLower: new Map(),
        htmlParticipants: '',
        htmlMasks: '',
        htmlError: ''
      };
    }

    // Строгий шаблон: user\d+ или user\d+=не-«;», разделённые «;»
    const TEMPLATE = /^\s*user\d+(?:\s*=\s*[^;]+)?(?:\s*;\s*user\d+(?:\s*=\s*[^;]+)?)*\s*$/i;
    if (!TEMPLATE.test(raw)) {
      return {
        ok: false,
        participantsLower: [],
        masksByCharLower: new Map(),
        htmlParticipants: '',
        htmlMasks: '',
        htmlError:
          `<span class="fmv-missing">Ошибка формата! ` +
          `Нужен вид: userN; userM=маска; userM=маска; …</span>`
      };
    }

    const parts = raw.split(/\s*;\s*/).filter(Boolean);
    const participantsSet   = new Set();
    const masksByCharLower  = new Map();
    const htmlMaskPairs     = [];

    for (const p of parts) {
      const [left, right] = p.split('=');
      const id = String(Number((left.match(/user(\d+)/i) || [,''])[1]));
      const key = ('user' + id).toLowerCase();
      participantsSet.add(key);

      const personHtml = (typeof profileLink === 'function')
        ? profileLink(id, idToNameMap?.get(id))
        : FMV.escapeHtml(`user${id}`);

      if (right) {
        const mask = FMV.normSpace(right);
        if (!masksByCharLower.has(key)) masksByCharLower.set(key, new Set());
        masksByCharLower.get(key).add(mask.toLowerCase());
        htmlMaskPairs.push(`${personHtml}=${FMV.escapeHtml(mask)}`);
      }
    }

    const participantsLower = Array.from(participantsSet);

    const htmlParticipants = participantsLower.map(low => {
      const roles = Array.from(masksByCharLower.get(low) || []);
      const id    = String(+low.replace(/^user/i,''));
      const base  = (typeof profileLink === 'function')
        ? profileLink(id, idToNameMap?.get(id))
        : FMV.escapeHtml(`user${id}`);
      return roles.length ? `${base} [as ${FMV.escapeHtml(roles.join(', '))}]` : base;
    }).join('; ');

    return {
      ok: true,
      participantsLower,
      masksByCharLower,
      htmlParticipants,
      htmlMasks: htmlMaskPairs.join('; '),
      htmlError: ''
    };
  };

  /* ---------- удобный рендер для «Участники:» ---------- */
  FMV.renderParticipantsHtml = FMV.renderParticipantsHtml || function (charsText, idToNameMap, profileLink = window.profileLink) {
    const uni = FMV.parseCharactersUnified(charsText, idToNameMap, profileLink);
    if (uni && uni.ok) return uni.htmlParticipants;

    const raw = FMV.escapeHtml(String(charsText ?? ''));
    const err = (uni && uni.htmlError && uni.htmlError.trim())
      ? uni.htmlError
      : `<span class="fmv-missing">Аааа! Нужен формат: userN; userM=маска; userK</span> — ${raw}`;

    return err;
  };

  /* ---------- users loader (moved to common) ---------- */

  /**
   * FMV.fetchUsers({ force?:boolean, maxPages?:number, batchSize?:number })
   * Возвращает $.Deferred().promise() с массивом:
   *   [{ id:Number, code:'user<ID>', name:String }, ...] — 이미 отсортирован по name и без дублей
   */
  FMV.fetchUsers = FMV.fetchUsers || function (opts) {
    opts = opts || {};
    var force    = !!opts.force;
    var maxPages = opts.maxPages || 50;   // защитный лимит
    var batch    = opts.batchSize || 5;   // параллельная пачка

    var CACHE_KEY = 'fmv_users_cache_v1';
    var TTL_MS    = 30 * 60 * 1000;

    function readCache(){
      try{
        var raw = sessionStorage.getItem(CACHE_KEY);
        if(!raw) return null;
        var obj = JSON.parse(raw);
        if(!obj || !obj.time || !obj.data) return null;
        if(Date.now() - obj.time > TTL_MS) return null;
        return obj.data;
      }catch(_){ return null; }
    }
    function writeCache(list){
      try{ sessionStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(), data:list})); }catch(_){}
    }
    function fetchHtmlCompat(url){
      if (typeof window.fetchHtml === 'function') {
        var d=$.Deferred();
        Promise.resolve(window.fetchHtml(url)).then(function(txt){ d.resolve(txt); }, function(e){ d.reject(e||'fetchHtml failed'); });
        return d.promise();
      }
      // fallback на jQuery
      return $.get(url, undefined, undefined, 'html');
    }
    function parseUserList(html){
      var doc = document.implementation.createHTMLDocument('');
      doc.documentElement.innerHTML = html;
      var anchors = doc.querySelectorAll('a[href*="profile.php?id="]');
      var users = [];
      anchors.forEach(function(a){
        var name = FMV.normSpace(a.textContent || '');
        var m = (a.getAttribute('href')||'').match(/profile\.php\?id=(\d+)/);
        if (!m) return;
        var id = +m[1];
        users.push({ id: id, code: 'user'+id, name: name });
      });
      var pageLinks = doc.querySelectorAll('a[href*="userlist.php"]');
      var pages = [1];
      var baseHref = 'userlist.php';
      pageLinks.forEach(function(a){
        var href = a.getAttribute('href') || '';
        if (href) baseHref = href;
        var u = new URL(href, location.origin);
        var p = +(u.searchParams.get('p') || 0);
        if (p) pages.push(p);
      });
      var last = Math.max.apply(null, pages);
      return { users: users, last: last, base: baseHref };
    }
    function urlForPage(baseHref, p){
      var u = new URL(baseHref, location.origin);
      if (p > 1) u.searchParams.set('p', String(p));
      else u.searchParams.delete('p');
      return u.pathname + (u.search || '');
    }
    function uniqSort(list){
      var map = {};
      (list||[]).forEach(function(u){ map[u.code] = u; });
      var out = Object.keys(map).map(function(k){ return map[k]; });
      out.sort(function(a,b){ return a.name.localeCompare(b.name,'ru',{sensitivity:'base'}) });
      return out;
    }

    var cached = !force && readCache();
    if (cached) return $.Deferred().resolve(cached).promise();

    var d=$.Deferred();
    fetchHtmlCompat('/userlist.php').then(function(html1){
      var first = parseUserList(html1);
      var all   = first.users.slice();
      var last  = Math.min(first.last || 1, maxPages);

      var pages=[]; for (var p=2; p<=last; p++) pages.push(p);

      function runBatch(start){
        if (start >= pages.length) {
          var list = uniqSort(all);
          writeCache(list);
          d.resolve(list);
          return;
        }
        var chunk = pages.slice(start, start+batch);
        $.when.apply($, chunk.map(function(p){
          var url = urlForPage(first.base, p);
          return fetchHtmlCompat(url).then(function(htmlN){
            var part = parseUserList(htmlN);
            all = all.concat(part.users);
          });
        })).always(function(){ runBatch(start+batch); });
      }

      runBatch(0);
    }, function(err){
      d.reject(err || 'Не удалось загрузить список участников');
    });

    return d.promise();
  };

  FMV.invalidateUsersCache = FMV.invalidateUsersCache || function () {
    try { sessionStorage.removeItem('fmv_users_cache_v1'); } catch (_) {}
  };

})();

/* MODULE 2: helpers.js */
/**
 * @fileoverview Базовые утилиты для работы с кодировкой CP1251 и сериализацией форм
 * @module helpers
 */

// === helpers: cp1251 + сериализация формы «как браузер» ===

/**
 * Карта соответствия Unicode кодов кириллицы в CP1251
 * @type {Object<number, number>}
 * @private
 */
const __cp1251Map = (()=>{const m={};for(let u=1040;u<=1103;u++)m[u]=u-848;m[1025]=168;m[1105]=184;return m;})();

/**
 * Кодирует строку в формат URL с использованием кодировки CP1251
 * @param {string} str - Строка для кодирования
 * @returns {string} URL-кодированная строка в CP1251
 */
function encodeURIcp1251(str){
  const out=[]; for(const ch of String(str)){ let code=ch.charCodeAt(0);
    if(__cp1251Map[code]!==undefined) code=__cp1251Map[code];
    if(code<=0xFF){
      if((code>=0x30&&code<=0x39)||(code>=0x41&&code<=0x5A)||(code>=0x61&&code<=0x7A)||code===0x2D||code===0x2E||code===0x5F||code===0x7E)
        out.push(String.fromCharCode(code));
      else out.push('%'+code.toString(16).toUpperCase().padStart(2,'0'));
    }else{
      const ent=`&#${ch.charCodeAt(0)};`;
      for(const e of ent){ const c=e.charCodeAt(0);
        if((c>=0x30&&c<=0x39)||(c>=0x41&&c<=0x5A)||(c>=0x61&&c<=0x7A)||c===0x2D||c===0x2E||c===0x5F||c===0x7E)
          out.push(String.fromCharCode(c));
        else out.push('%'+c.toString(16).toUpperCase().padStart(2,'0'));
      }
    }
  }
  return out.join('').replace(/\+/g,'%2B');
}

/**
 * Сериализует форму в формат application/x-www-form-urlencoded с кодировкой CP1251
 * Позволяет выбрать конкретную submit-кнопку для отправки
 * @param {HTMLFormElement} form - HTML форма для сериализации
 * @param {string} [chosenName='save'] - Имя submit-кнопки для включения в данные
 * @returns {string} Сериализованная строка формы
 */
function serializeFormCP1251_SelectSubmit(form, chosenName='save'){
  const pairs=[];
  for(const el of Array.from(form.elements||[])){
    if(!el.name || el.disabled) continue;
    const t=(el.type||'').toLowerCase();

    // только один submit (save); preview и др. не тащим
    if(t==='submit' || t==='button'){
      if(el.name===chosenName) pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(el.value||''));
      continue;
    }
    if(el.name==='preview') continue;

    if((t==='checkbox'||t==='radio') && !el.checked) continue;
    if(el.tagName==='SELECT' && el.multiple){
      for(const opt of el.options) if(opt.selected)
        pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(opt.value));
      continue;
    }
    pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(el.value ?? ''));
  }
  return pairs.join('&');
}

/**
 * Загружает HTML документ с URL и декодирует его из CP1251
 * @param {string} url - URL для загрузки
 * @returns {Promise<Document>} Promise с распарсенным HTML документом
 * @throws {Error} При ошибке HTTP
 */
async function fetchCP1251Doc(url){
  const res = await fetch(url, { credentials:'include' });
  if(!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const html = new TextDecoder('windows-1251').decode(buf);
  return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * Загружает текст с URL и декодирует его из CP1251
 * @param {string} url - URL для загрузки
 * @param {RequestInit} [init] - Параметры fetch запроса
 * @returns {Promise<{res: Response, text: string}>} Promise с ответом и декодированным текстом
 */
async function fetchCP1251Text(url, init){
  const res = await fetch(url, init);
  const buf = await res.arrayBuffer();
  return { res, text: new TextDecoder('windows-1251').decode(buf) };
}

/**
 * Сериализует форму в формат application/x-www-form-urlencoded с кодировкой CP1251
 * Базовая версия без выбора конкретной submit-кнопки
 * @param {HTMLFormElement} form - HTML форма для сериализации
 * @returns {string} Сериализованная строка формы
 */
function serializeFormCP1251(form){
  const pairs = [];
  for (const el of Array.from(form.elements||[])) {
    if (!el.name || el.disabled) continue;
    if ((el.type==='checkbox'||el.type==='radio') && !el.checked) continue;
    if (el.tagName==='SELECT' && el.multiple) {
      for (const opt of el.options) if (opt.selected)
        pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(opt.value));
      continue;
    }
    pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(el.value));
  }
  return pairs.join('&');
}

/**
 * Универсальный загрузчик HTML с автоматической детекцией кодировки
 * Определяет кодировку в следующем порядке приоритета:
 * 1. HTTP заголовок Content-Type
 * 2. Meta тег в HTML
 * 3. Эвристический анализ (UTF-8 vs CP1251)
 * @param {string} url - URL для загрузки
 * @returns {Promise<string>} Promise с декодированным HTML текстом
 * @throws {Error} При ошибке HTTP
 */
async function fetchHtml(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = await res.arrayBuffer();

  // 1) charset из HTTP-заголовка имеет высший приоритет
  const ct = res.headers.get('content-type') || '';
  const hdrCharset = (ct.match(/charset=([\w-]+)/i) || [])[1]?.toLowerCase();
  if (hdrCharset && hdrCharset !== 'utf-8') {
    try { return new TextDecoder(hdrCharset).decode(buf); } catch { /* пойдём дальше */ }
  }

  // 2) предварительно декодируем как UTF-8, чтобы прочитать <meta charset=...>
  const utf8 = new TextDecoder('utf-8').decode(buf);
  const mMeta = utf8.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)
             || utf8.match(/<meta[^>]+content=["'][^"']*charset\s*=\s*([\w-]+)/i);
  const metaCharset = (mMeta && mMeta[1] || '').toLowerCase();

  if (!hdrCharset && metaCharset && metaCharset !== 'utf-8') {
    try { return new TextDecoder(metaCharset).decode(buf); } catch { /* пойдём к эвристике */ }
  }

  // 3) эвристика UTF-8 vs CP1251
  const cp = new TextDecoder('windows-1251').decode(buf);

  // «моджибейки» для UTF-8, ошибочно прочитанного как 8-битная кодировка
  const mojibake = /[ÂÃÐÑ][\u0080-\u00FF]?/g;

  // счётчики для выбора
  const score = s => {
    const mixed = (s.match(/\b(?:[A-Za-z]+[А-Яа-яЁё]+|[А-Яа-яЁё]+[A-Za-z]+)[A-Za-zА-Яа-яЁё]*\b/g) || []).length;
    const bad   = (s.match(mojibake) || []).length + (s.match(/\uFFFD/g) || []).length;
    return { mixed, bad };
  };

  const su = score(utf8);
  const sc = score(cp);

  // если cp показывает классические «Ã/Â/Ð/Ñ» — остаёмся на UTF-8;
  // если у UTF-8 больше «битых» и смешанных слов — берём CP1251.
  if (sc.bad > su.bad + 3) return utf8;
  if (su.bad > sc.bad + 3 || su.mixed > sc.mixed + 1) return cp;

  // по умолчанию — UTF-8 (современные форумы в основном на нём)
  return utf8;
}

/**
 * Парсит хронологические теги из DOM узла
 * Извлекает информацию об участниках, масках, локации и порядке
 * @param {Element} firstNode - DOM элемент содержащий теги хронологии
 * @returns {{participantsLower: string[], masks: Object<string, string>, location: string, order: string}}
 */
window.parseChronoTagsRaw = function(firstNode){
  const pick = sel => firstNode.querySelector(sel)?.textContent.trim() || '';

  const charsStr = pick('characters');
  const masksStr = pick('masks');

  const participantsLower = (charsStr ? charsStr.split(/\s*;\s*/) : [])
    .map(s => s.trim().toLowerCase()).filter(Boolean);

  const masks = {};
  (masksStr || '').split(/\s*;\s*/).forEach(pair=>{
    const i = pair.indexOf('=');
    if (i>0) masks[pair.slice(0,i).trim().toLowerCase()] = pair.slice(i+1).trim();
  });

  const all = new Set(participantsLower);
  Object.keys(masks).forEach(k=>all.add(k));

  return {
    participantsLower: Array.from(all),
    masks,
    location: pick('location'),
    order: pick('order'),
  };
};

/**
 * Резолвит имена пользователей и создает готовый HTML для хронологических данных
 * Использует глобальные функции profileLink и getProfileNameById
 * @param {Object} raw - Сырые данные из parseChronoTagsRaw
 * @param {Object} [opts={}] - Дополнительные опции
 * @returns {Promise<Object>} Резолвенные данные с HTML разметкой
 */
window.resolveChronoData = async function(raw, opts = {}){
  const out = { ...raw, idToName: new Map(), participantsHtml: '', masksHtml: '' };

  const ids = new Set();
  for (const tok of raw.participantsLower) { const m = /^user(\d+)$/i.exec(tok); if (m) ids.add(String(+m[1])); }
  for (const tok of Object.keys(raw.masks||{})) { const m = /^user(\d+)$/i.exec(tok); if (m) ids.add(String(+m[1])); }

  for (const id of ids) {
    try { out.idToName.set(id, await getProfileNameById(id) || null); }
    catch { out.idToName.set(id, null); }
  }

  const renderLeft = (token) => {
    const m = /^user(\d+)$/i.exec(token);
    if (!m) return (window.FMV && window.FMV.escapeHtml) ? window.FMV.escapeHtml(token) : token;
    const id = String(+m[1]);
    const name = out.idToName.get(id) || null;
    return profileLink(id, name); // ← тут появится <a> или (не найден)
  };

  const escHtml = (window.FMV && window.FMV.escapeHtml) ? window.FMV.escapeHtml : (s => s);
  out.participantsHtml = raw.participantsLower.map(renderLeft).join('; ');
  out.masksHtml = Object.entries(raw.masks||{}).map(([k,v]) => `${renderLeft(k)}=${escHtml(v)}`).join('; ');

  return out;
};

/**
 * Генерирует ссылку на профиль пользователя в HTML или BB-коде формате
 * @param {string|number} id - Числовой ID пользователя
 * @param {string} [name=''] - Отображаемое имя (если не указано, будет userN)
 * @param {boolean} [asBB=false] - true → BB-код, false → HTML
 * @returns {string} Ссылка на профиль
 */
function userLink(id, name = '', asBB = false) {
  const uid   = String(id);
  const label = name || `user${uid}`;
  const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');

  if (asBB) {
    // BB-код
    return `[url=${SITE_URL}/profile.php?id=${uid}]${label}[/url]`;
  }

  // HTML через штатную profileLink, если она определена
  if (typeof window.profileLink === 'function') {
    return window.profileLink(uid, label);
  }

  // запасной вариант простая <a>
  return `<a href="/profile.php?id=${uid}">${label}</a>`;
}

/**
 * Форматирует "не найденного" пользователя с визуальным выделением
 * @param {string} token - Исходное имя/токен (например user11)
 * @param {boolean} [asBB=false] - true → BB-код с [mark], false → HTML с span
 * @returns {string} Форматированная строка
 */
function missingUser(token, asBB = false) {
  const raw = String(token);
  return asBB
    ? `[mark]${raw}[/mark]`
    : `<span class="fmv-missing" data-found="0">${raw}</span>`;
}

/**
 * Извлекает заголовок темы из хлебных крошек (breadcrumbs) документа
 * @param {Document} doc - HTML документ для парсинга
 * @returns {string} Заголовок темы или пустая строка
 */
function topicTitleFromCrumbs(doc) {
  // обычно: <p class="container crumbs"> … <a>FMV</a> <em>»</em> <a>АУ</a> <em>»</em> Тест заголовка</p>
  const p =
    doc.querySelector('#pun-crumbs1 .crumbs') ||
    doc.querySelector('.section .crumbs, .container.crumbs, .crumbs');

  if (!p) return '';

  // берём ПОСЛЕДНИЙ содержательный текстовый фрагмент
  for (let i = p.childNodes.length - 1; i >= 0; i--) {
    const n = p.childNodes[i];
    if (!n) continue;

    if (n.nodeType === 3) { // текстовый узел
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (t) return t;
    } else if (n.nodeType === 1 && n.tagName !== 'A' && n.tagName !== 'EM') {
      const t = n.textContent.replace(/\s+/g, ' ').trim();
      if (t) return t;
    }
  }
  return '';
}

/* ===================== парсинг ===================== */

/**
 * Парсит HTML строку (из script тега) и извлекает параграфы
 * @param {string} htmlText - HTML текст для парсинга
 * @returns {Array} Массив распарсенных параграфов
 */
function parseFromScriptHTML(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${htmlText}</div>`, 'text/html');
  const wrap = doc.body.firstElementChild;
  const out = [];
  wrap.querySelectorAll('p').forEach(p => { const row = parseParagraph(p); if (row) out.push(row); });
  return out;
}

/**
 * Парсит уже отрендеренный DOM контейнер и извлекает параграфы
 * @param {Element} container - DOM элемент контейнер
 * @returns {Array} Массив распарсенных параграфов
 */
function parseFromRendered(container) {
  const ps = container.querySelectorAll('p');
  if (ps.length) return Array.from(ps).map(parseParagraph).filter(Boolean);
  const html = container.innerHTML.replace(/<br\s*\/?>/gi, '\n');
  return html.split(/\n{2,}/).map(chunk => {
    const div = document.createElement('div');
    div.innerHTML = `<p>${chunk}</p>`;
    return parseParagraph(div.firstElementChild);
  }).filter(Boolean);
}

/**
 * Находит DOM узел поста по его ID
 * @param {Document} doc - HTML документ
 * @param {string|number} pid - ID поста
 * @returns {Element|null} Найденный узел поста
 */
function findPostNode(doc, pid) {
  const id = `p${pid}`;
  let node = doc.getElementById(id);
  if (node) return node;
  const a = doc.querySelector(`a[name="${id}"]`);
  if (a) return a.closest('.post') || a.closest('.blockpost') || a.parentElement;
  node = doc.querySelector(`[id^="p${pid}"]`);
  return node;
}

/**
 * Извлекает текст из массива DOM узлов
 * @param {Array<Node>} nodes - Массив DOM узлов
 * @returns {string} Объединенный текст с нормализованными пробелами
 */
function textFromNodes(nodes) {
  return nodes.map(n => n.nodeType===3 ? (n.nodeValue||'') : (n.nodeType===1 ? (n.textContent||'') : ''))
    .join('').replace(/\s+/g,' ').trim();
}

/**
 * @fileoverview Дополнительные утилиты для FMV namespace
 * @requires common.js - использует FMV.escapeHtml
 */
(function () {
  'use strict';
  window.FMV = window.FMV || {};

  /**
   * Экранирует HTML и обрезает строку до заданного лимита
   * @param {string} s - Строка для экранирования
   * @param {number} [limit=500] - Максимальная длина строки
   * @returns {string} Экранированная и обрезанная строка
   */
  FMV.escapeHtmlShort = FMV.escapeHtmlShort || function (s = '', limit = 500) {
    const t = String(s);
    const cut = t.length > limit ? t.slice(0, limit) + '…' : t;
    return (typeof FMV.escapeHtml === 'function') ? FMV.escapeHtml(cut) : cut;
  };

  /**
   * Загружает HTML документ с автоопределением кодировки
   * @param {string} url - URL для загрузки
   * @returns {Promise<Document>} Promise с распарсенным документом
   */
  FMV.fetchDoc = FMV.fetchDoc || async function (url) {
    const html = await fetchHtml(url);
    if (typeof window.parseHTML === 'function') return window.parseHTML(html);
    return new DOMParser().parseFromString(html, 'text/html');
  };

  /**
   * Преобразует строку в CP1251-safe формат, заменяя несовместимые символы на HTML entities
   * @param {string} s - Строка для преобразования
   * @returns {string} CP1251-безопасная строка с HTML entities
   */
  FMV.toCp1251Entities = FMV.toCp1251Entities || function (s) {
    const keep = /[\u0000-\u007F\u0400-\u045F\u0401\u0451]/; // ASCII + кириллица + Ё/ё
    let out = '';
    for (const ch of String(s)) out += keep.test(ch) ? ch : `&#${ch.codePointAt(0)};`;
    return out;
  };
})();

/* MODULE 3: profile_from_user.js */
// profile_from_user.js
(() => {
  'use strict';

  // Можно переопределить глобально: window.MAKE_NAMES_LINKS = false
  const MAKE_NAMES_LINKS = (window.MAKE_NAMES_LINKS ?? true);

  // ───────────────────────────────────────────────────────────────────────────
  // УТИЛИТЫ
  // ───────────────────────────────────────────────────────────────────────────
  const escapeHtml = (str) =>
    (window.FMV && typeof FMV.escapeHtml === 'function')
      ? FMV.escapeHtml(String(str))
      : String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

  function extractUserIdsFromString(s) {
    const ids = new Set();
    (s || '').replace(/user(\d+)/gi, (_, d) => { ids.add(String(Number(d))); return _; });
    return Array.from(ids);
  }

  // Глобальная функция загрузки HTML. Должна быть определена в проекте.
  // Ожидается сигнатура: fetchHtml(url) -> Promise<string>
  const fetchHtml = window.fetchHtml || (async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    return await res.text();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // БАЗОВЫЕ РЕНДЕРЫ С СОВМЕСТИМОСТЬЮ
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * СТАРОЕ API (СОХРАНЕНО):
   * profileLink(id, name) -> HTML-строка
   * Если name не передан/пуст — возвращает <span class="fmv-missing" data-found="0">userN</span>
   * Если name есть:
   *   - при MAKE_NAMES_LINKS=true -> <a class="fmv-user" data-found="1" href="/profile.php?id=N">Имя</a>
   *   - иначе -> просто "Имя"
   */
  window.profileLink = function profileLink(id, name) {
    const uid = String(Number(id));
    const hasName = (typeof name === 'string' && name.trim().length > 0);

    if (!hasName) {
      const label = `user${uid}`;
      return `<span class="fmv-missing" data-user-id="${uid}" data-found="0">${escapeHtml(label)}</span>`;
    }

    const safeName = escapeHtml(name.trim());
    if (!MAKE_NAMES_LINKS) return safeName;

    const a = document.createElement('a');
    a.className = 'fmv-user';
    a.href = '/profile.php?id=' + encodeURIComponent(uid);
    a.textContent = safeName;
    a.setAttribute('data-user-id', uid);
    a.setAttribute('data-found', '1');
    return a.outerHTML;
  };

  /**
   * НОВОЕ УДОБНОЕ API (СИНХРОННО):
   * profileLinkMeta(id, name) -> { html, found, id, name }
   * Работает по тем же правилам, но возвращает флаг found.
   * Полезно, когда name уже известен/получен заранее.
   */
  window.profileLinkMeta = function profileLinkMeta(id, name) {
    const html = window.profileLink(id, name);
    const found = typeof html === 'string' && !/\bfmv-missing\b/.test(html);
    return {
      html: String(html || ''),
      found,
      id: String(Number(id)),
      name: (typeof name === 'string' && name.trim()) ? name.trim() : null
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // РЕЗОЛВ ИМЕНИ ПО ID (с кэшем, запасными источниками) + АСИНХРОННОЕ META API
  // ───────────────────────────────────────────────────────────────────────────

  // Кэш имён
  const nameCache = new Map();

  // Конфигурация списка удалённых профилей (опционально)
  // Ожидается, что верхний код проекта задаёт window.EX_PROFILES = { topicID, commentID}.
  let exProfilesMap = null;
  let exProfilesPromise = null;

  async function loadExProfiles() {
    if (exProfilesMap) return exProfilesMap;
    if (exProfilesPromise) return exProfilesPromise;

    // Проверка наличия window.EX_PROFILES
    if (!window.EX_PROFILES || typeof window.EX_PROFILES !== 'object') {
      console.error('[loadExProfiles] Ошибка: window.EX_PROFILES не задан или имеет неверный формат');
      exProfilesMap = new Map();
      return exProfilesMap;
    }

    const { topicID, commentID } = window.EX_PROFILES;

    // Проверка наличия обязательных полей
    if (topicID == null || commentID == null) {
      console.error('[loadExProfiles] Ошибка: отсутствует topicID или commentID в window.EX_PROFILES');
      exProfilesMap = new Map();
      return exProfilesMap;
    }

    // Формируем URL из topicID и commentID
    const url = `/viewtopic.php?id=${encodeURIComponent(topicID)}#p${encodeURIComponent(commentID)}`;

    exProfilesPromise = (async () => {
      const html = await fetchHtml(url);
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      const map  = new Map();
      for (const a of doc.querySelectorAll('a[href*="profile.php?id="]')) {
        const m = (a.getAttribute('href') || '').match(/profile\.php\?id=(\d+)/i);
        if (!m) continue;
        const id = String(Number(m[1]));
        const nm = (a.textContent || '').trim().toLowerCase();
        if (nm && !map.has(id)) map.set(id, nm);
      }
      exProfilesMap = map;
      return map;
    })();

    return exProfilesPromise;
  }

  async function getExProfileName(id) {
    const map = await loadExProfiles();
    return map.get(String(Number(id))) || null;
  }

  /**
   * Асинхронно получить имя профиля по id.
   * Источники:
   *  1) DOM текущей страницы
   *  2) Загрузка /profile.php?id=...
   *  3) Список удалённых профилей (если EX_PROFILES_URL задан)
   * Возвращает: string | null
   */
  async function getProfileNameById(id) {
    id = String(Number(id));
    if (nameCache.has(id)) return nameCache.get(id);

    // 1) попытка вытащить имя со страницы
    let name = getNameFromPageById(id);

    // 2) загрузить сам профиль
    if (!name) {
      try {
        const html = await fetchHtml(`/profile.php?id=${id}`);
        const doc  = new DOMParser().parseFromString(html, 'text/html');
        name = extractNameFromDoc(doc);
      } catch {}
    }

    // 3) резерв: список "ex" профилей
    if (!name) {
      try {
        const exName = await getExProfileName(id);
        if (exName) name = `[ex] ${exName}`;
      } catch {}
    }

    nameCache.set(id, name || null);
    return name || null;
  }

  function getNameFromPageById(id) {
    const anchors = Array.from(document.querySelectorAll(`a[href*="profile.php?id=${id}"]`));
    for (const a of anchors) {
      const t = (a.textContent || '').trim();
      // пропускаем служебные "Профиль"/"Profile"
      if (t && !/Профил|Profile/i.test(t)) return t;
    }
    return null;
  }

  function extractNameFromDoc(doc) {
    const usernameEl =
      doc.querySelector('.user-ident .username') ||
      doc.querySelector('.user-box .username') ||
      null;
    if (usernameEl) {
      const name = (usernameEl.textContent || '').trim();
      if (name) return name;
    }

    const headings = [
      '#pun-title span','h1 span','h1','h2.hn','.hn','.title','.subhead h2'
    ].map(sel => doc.querySelector(sel)).filter(Boolean)
     .map(el => (el.textContent || '').trim()).filter(Boolean);

    const title = (doc.querySelector('title')?.textContent || '').trim();
    if (title) headings.unshift(title);

    const PROFILE_PATTERNS = [
      /Профил[ья]\s*[:\-—–]\s*(.+)$/i,
      /Просмотр\s+профиля\s*[:\-—–]\s*(.+)$/i,
      /Profile\s*[:\-—–]\s*(.+)$/i
    ];

    for (let t of headings) {
      t = t.replace(/\s+/g, ' ').trim();
      for (const re of PROFILE_PATTERNS) {
        const m = t.match(re);
        if (m) {
          const raw   = m[1].trim();
          const clean = raw.replace(/^[«"'\\[]|[»"'\\]]$/g, '').trim();
          if (clean) return clean;
        }
      }
    }
    return null;
  }

  /**
   * НОВОЕ УДОБНОЕ API (АСИНХРОННО):
   * profileLinkByIdAsync(id) -> Promise<{ html, found, id, name }>
   * Сам находит имя (getProfileNameById), а дальше рендерит ссылку/бейдж.
   */
  window.profileLinkByIdAsync = async function profileLinkByIdAsync(id) {
    const uid  = String(Number(id));
    const name = await getProfileNameById(uid);
    const meta = window.profileLinkMeta(uid, name);
    return meta; // { html, found, id, name }
  };

  // Экспортируем вспомогательные функции (если кому-то пригодится)
  window.extractUserIdsFromString = extractUserIdsFromString;
  window.getProfileNameById      = getProfileNameById;

})();

/* MODULE 4: check_group.js */
// ───────────────── пользовательская группа ─────────────────
function getCurrentGroupId() {
  const bodyGroup = Number(document.body?.dataset?.groupId || NaN);
  const groupId = Number(
    (window && window.GroupID) ??
    (window && window.PUNBB && window.PUNBB.group_id) ??
    (window && window.PUNBB && window.PUNBB.user && window.PUNBB.user.g_id) ??
    bodyGroup
  );
  return Number.isFinite(groupId) ? groupId : null;
}

async function ensureAllowed(group_ids) {
  const gid = getCurrentGroupId();
  const allow = new Set(group_ids.map(String));
  return gid !== null && allow.has(String(gid));
}

/* MODULE 5: load_main_users_money.js */
/*!
 * money-upd-slim.js — один экспорт: getFieldValue({ doc, fieldId }) -> string
 * - Заменяет <!-- main: usrN --> в li#pa-fldN
 * - Предоставляет window.MainUsrFieldResolver.getFieldValue
 */
(function () {
  "use strict";

  // Проверка наличия MoneyID
  if (!window.PROFILE_FIELDS?.MoneyID) {
    console.error("Ошибка: не найдено значение PROFILE_FIELDS.MoneyID");
    return; // Останавливаем выполнение скрипта
  }

  // ===== Настройки поля =====
  const idNum = String(window.PROFILE_FIELDS?.MoneyID);
  const fieldName = `pa-fld${idNum}`;

  // ===== Утилиты =====
  const esc = CSS.escape || ((s) => String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));
  const RE_MAIN = /^\s*main:\s*usr(\d+)\s*$/i;
  const selectorForField = (fname) => `#${esc(fname)}, .${esc(fname)}`;

  // Декодирование HTML с возможной windows-1251
  const tdUtf8 = new TextDecoder("utf-8");
  let tdWin1251;
  const win1251 = () => (tdWin1251 ||= new TextDecoder("windows-1251"));
  async function fetchHtml(url) {
    const r = await fetch(url, { credentials: "same-origin" });
    const buf = await r.arrayBuffer();
    let html = tdUtf8.decode(buf);
    if (/charset\s*=\s*windows-1251/i.test(html) || html.includes("�")) {
      try { html = win1251().decode(buf); } catch {}
    }
    return html;
  }

  function extractLocalValue(rootDoc, fname) {
    const li = rootDoc.querySelector(selectorForField(fname));
    const strong = li?.querySelector("strong, b");
    let v = strong?.textContent?.trim();
    if (!v) {
      const t = (li?.textContent || "").trim();
      v = t.split(":").slice(-1)[0]?.trim();
    }
    return (v || "").replace(/\u00A0/g, " ").trim();
  }

  // Кеш по uid -> Promise<string>
  const cache = new Map();
  function getRemoteFieldValue(uid, fname) {
    if (cache.has(uid)) return cache.get(uid);
    const p = (async () => {
      const html = await fetchHtml(`/profile.php?id=${encodeURIComponent(uid)}`);
      const doc = new DOMParser().parseFromString(html, "text/html");
      return extractLocalValue(doc, fname);
    })();
    cache.set(uid, p);
    return p;
  }

  function findUsrFromComment(liEl) {
    if (!liEl) return null;
    const walker = liEl.ownerDocument.createTreeWalker(liEl, NodeFilter.SHOW_COMMENT);
    for (let n; (n = walker.nextNode()); ) {
      const m = (n.nodeValue || "").match(RE_MAIN);
      if (m) return m[1];
    }
    return null;
  }

  // ===== Публичное API (единственная функция) =====
  async function getFieldValue({ doc = document, fieldId } = {}) {
    const id = String(fieldId ?? idNum).replace(/\D/g, "") || idNum;
    const fname = `pa-fld${id}`;
    const li = doc.querySelector(selectorForField(fname));

    // если есть <!-- main: usrN -->, берём значение у usrN
    const refUid = findUsrFromComment(li);
    if (refUid) {
      try { return await getRemoteFieldValue(refUid, fname); }
      catch (e) { console.warn("[main-field] remote error:", e); }
    }
    // иначе — локальное значение
    return extractLocalValue(doc, fname);
  }

  // Экспорт в window (без перетирания)
  window.MainUsrFieldResolver = window.MainUsrFieldResolver || {};
  if (!window.MainUsrFieldResolver.getFieldValue) {
    window.MainUsrFieldResolver.getFieldValue = getFieldValue;
  }

  // ===== Поведение «как раньше»: заменить комментарии на текст в DOM =====
  function replaceCommentsUnder(root, fname) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const items = [];
    for (let n; (n = walker.nextNode()); ) {
      const m = (n.nodeValue || "").match(RE_MAIN);
      if (m) items.push({ node: n, uid: m[1] });
    }
    items.forEach(({ node, uid }) => {
      getRemoteFieldValue(uid, fname)
        .then((val) => { if (node?.isConnected) node.replaceWith(document.createTextNode(val)); })
        .catch((e) => console.error("[main-field] replace error usr" + uid, e));
    });
  }

  function run() {
    document.querySelectorAll(selectorForField(fieldName)).forEach((el) => replaceCommentsUnder(el, fieldName));
  }

  (document.readyState === "loading")
    ? document.addEventListener("DOMContentLoaded", run, { once: true })
    : run();
})();

/* MODULE 6: bank_common.js */
async function scrapeUsers() {
  const PATH = "/userlist.php?sort_by=registered";
  const MAX_PAGES = 1000;
  const DELAY_MS = 300;
  const CELL_SELECTOR = "td.tcl.username span.usersname";
  const LINK_SELECTOR = "a[href*='id=']";

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const extractId = href => {
    if (!href) return null;
    const m = href.match(/(?:[?&/])id=(\d+)/i);
    return m ? Number(m[1]) : null;
  };

  async function fetchUsers(page) {
    const url = `${PATH}&p=${page}`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const users = [];
    doc.querySelectorAll(CELL_SELECTOR).forEach(cell => {
      const a = cell.querySelector(LINK_SELECTOR);
      const name = (a?.textContent || "").trim();
      const id = extractId(a?.getAttribute("href") || "");
      if (name && Number.isFinite(id)) users.push({ name, id });
    });
    return users;
  }

  const seen = new Set();
  const result = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const users = await fetchUsers(page);
    const newUsers = users.filter(u => !seen.has(u.id));
    if (!newUsers.length) break;
    newUsers.forEach(u => { seen.add(u.id); result.push(u); });
    await sleep(DELAY_MS);
  }

  window.scrapedUsers = result;
  return result;
}

async function fetchProfileInfo(userId = window.UserID) {
  if (userId == null) throw new Error("UserID не задан (ни аргументом, ни в window.UserID)");

  const url = `/profile.php?id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // утилиты
  const txt = (sel, root = doc) =>
    (root.querySelector(sel)?.textContent || "").replace(/\u00A0/g, " ").trim();

  const firstSignedInt = (s) => {
    if (!s) return null;
    const norm = String(s).replace(/[^\d+-]/g, "");
    const m = norm.match(/^[+-]?\d+/);
    return m ? Number(m[0]) : null;
  };

  const dateToArray = (s) => {
    const m = (s || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) return null;
    const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
    return [yyyy, mm, dd];
  };

  const parseMessages = (s) => firstSignedInt((s || "").split(" - ")[0]);

  // --- money: одна строка — получаем СТРОКУ через код 2 (или фолбэк)
  const moneyStr = await (async () => {
    const api = window.MainUsrFieldResolver?.getFieldValue;
    if (api) {
      try { return await api({ doc, fieldId: 6 }); } // pa-fld6
      catch (e) { console.warn("[fetchProfileInfo] getFieldValue error:", e); }
    }
    // фолбэк, если код 2 недоступен
    const strong = txt("li#pa-fld6 strong");
    if (strong) return strong;
    const raw = txt("li#pa-fld6");
    return raw ? raw.split(":").slice(-1)[0].trim() : "";
  })();

  const moneyVal = (() => {
    const n = firstSignedInt(moneyStr);
    return Number.isFinite(n) ? n : 0;
  })();

  // остальные поля
  const dateStr = txt("li#pa-register-date strong");
  const respectStr = txt("li#pa-respect strong");
  const positiveStr = txt("li#pa-positive strong");
  const messagesStr = txt("li#pa-posts strong");

  return {
    id: Number(userId),
    date: dateToArray(dateStr),                 // [yyyy, mm, dd] | null
    respect: firstSignedInt(respectStr),        // number | null
    positive: firstSignedInt(positiveStr),      // number | null
    messages: parseMessages(messagesStr),       // number | null
    money: moneyVal                             // number (или 0)
  };
}

function encodeWithSep(text, with_and = false) {
  const words = text.trim().split(/\s+/);

  // Кодируем каждый символ, кроме безопасных
  const encodedWords = words.map(w =>
    w.split('').map(ch => {
      // оставляем только латиницу, цифры, апостроф, обратную кавычку, тильду и подчёркивание
      // дефис НЕ включаем, чтобы он стал %2D
      if (/[A-Za-z0-9'`~_]/.test(ch)) return ch;
      return encodeURIComponent(ch);
    }).join('')
  );

  const merger = with_and ? '+AND+' : '+';
  return encodedWords.join(merger);
}


/**
 * scrapePosts(author, forums, stopOnFirstNonEmpty?, last_src?, options?)
 *
 * @param {string} author — author автора (обязательно)
 * @param {Array<string>|string} forums — список ID форумов (обязательно)
 * @param {boolean} [stopOnFirstNonEmpty=false] — true: вернуть первый непустой ДО last_src (или []), false: собрать все ДО last_src
 * @param {string}  [last_src=""] — пост-граница; сам пост не обрабатываем
 * @param {Object}  [options]
 * @param {number}  [options.maxPages=999]
 * @param {number}  [options.delayMs=300]
 * @returns {Promise<Array<{title:string,src:string,text:string,html:string,symbols_num:number}>>}
 */
async function scrapePosts(author, forums, stopOnFirstNonEmpty = false, last_src = "", { maxPages = 999, delayMs = 300 } = {}) {
  if (!author) throw new Error("author обязателен");
  if (!forums || (Array.isArray(forums) && forums.length === 0)) throw new Error("forums обязателен");
  const basePath    = "/search.php";
  const forumsParam = Array.isArray(forums) ? forums.join(",") : String(forums);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const buildUrl = (p) => {
    const u = new URL(basePath, location.origin);
    u.search = new URLSearchParams({ action:"search", author:encodeWithSep(author), forums:forumsParam, sort_dir:"DESC", p:String(p) }).toString();
    return u.toString();
  };

  async function getDoc(url) {
    if (window.FMV?.fetchDoc) return await window.FMV.fetchDoc(url);
    if (typeof fetchCP1251Doc === "function") return await fetchCP1251Doc(url);
    if (typeof fetchHtml === "function") {
      const html = await fetchHtml(url);
      return new DOMParser().parseFromString(html, "text/html");
    }
    const res = await fetch(url, { credentials: "include" });
    const html = await res.text();
    return new DOMParser().parseFromString(html, "text/html");
  }
  const hash = (s) => { let h=0; for (const c of s) { h=((h<<5)-h)+c.charCodeAt(0); h|=0; } return h; };

  // ---------- HTML → чистый текст ----------
  const htmlToMultilineText = (html = "") => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;

    // скрытые цитаты -> только blockquote
    tmp.querySelectorAll(".quote-box.hide-box").forEach(box => {
      const bq = box.querySelector("blockquote");
      if (bq) { const repl = document.createElement("div"); repl.innerHTML = bq.innerHTML; box.replaceWith(repl); }
    });
    // убрать шапки цитат
    tmp.querySelectorAll("cite").forEach(n => n.remove());
    // code-box -> только текст из <pre>
    tmp.querySelectorAll(".code-box").forEach(box => {
      const pre = box.querySelector("pre"); const codeText = pre ? pre.textContent : "";
      const repl = document.createElement("div"); repl.textContent = codeText || ""; box.replaceWith(repl);
    });
    // служебные/скрытые
    tmp.querySelectorAll(".custom_tag, .hidden_tag, characters, location, order").forEach(n => n.remove());
    // script type="text/html" -> парсим и соблюдаем <p>/<br>
    tmp.querySelectorAll('script[type="text/html"]').forEach(s => {
      const innerTmp = document.createElement("div"); innerTmp.innerHTML = s.textContent || "";
      innerTmp.querySelectorAll("p, br").forEach(el => el.insertAdjacentText("afterend", "\n"));
      let t = (innerTmp.textContent || "").replace(/\u00A0/g, " ").replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n");
      s.insertAdjacentText("beforebegin", t ? `\n${t}\n` : ""); s.remove();
    });
    // переносы для блочных
    const blockTags = ["ADDRESS","ARTICLE","ASIDE","BLOCKQUOTE","DIV","DL","DT","DD","FIELDSET","FIGCAPTION","FIGURE","FOOTER","FORM","H1","H2","H3","H4","H5","H6","HEADER","HR","LI","MAIN","NAV","OL","P","PRE","SECTION","TABLE","THEAD","TBODY","TFOOT","TR","UL","BR"];
    tmp.querySelectorAll(blockTags.join(",")).forEach(el => { if (el.tagName==="BR") el.insertAdjacentText("beforebegin","\n"); else el.insertAdjacentText("afterend","\n"); });

    // нормализация
    let t = (tmp.textContent || "").replace(/\u00A0/g," ");
    t = t.replace(/\[\/?indent\]/gi,"").replace(/\[\/?float(?:=[^\]]+)?\]/gi,"").replace(/\[DiceFM[^\]]*?\]/gi,"");
    t = t.replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n").replace(/ {2,}/g," ").replace(/\n{2,}/g,"\n");

    const out=[]; for (const raw of t.split("\n")) { const line = raw.trim(); if (line==="") { if (out.length && out[out.length-1] !== "") out.push(""); } else out.push(line); }
    return out.join("\n").replace(/ {2,}/g," ").replace(/\n{2,}/g,"\n").replace(/^\n+|\n+$/g,"").trim();
  };
  const expandBBHtmlToText = (html="") => html.replace(/\[html\]([\s\S]*?)\[\/html\]/gi,(_,inner)=>htmlToMultilineText(inner));

  const extractOne = (post) => {
    const span = post.querySelector("h3 > span");
    const a = span ? span.querySelectorAll("a") : [];
    const title = a[1]?.textContent?.trim() || "";
    const src   = a[2] ? new URL(a[2].getAttribute("href"), location.href).href : "";
    const contentEl = post.querySelector(".post-content");
    let html = contentEl?.innerHTML?.trim() || "";
    html = expandBBHtmlToText(html);
    const text = htmlToMultilineText(html);
    return { title, src, text, html, symbols_num: text.length };
  };
  const extractPosts = (doc) => [...doc.querySelectorAll(".post")].map(extractOne);
  const pageSignature = (items) => hash(items.map(i=>i.src).join("\n"));

  // ---------- режим A: первый непустой ДО last_src ----------
  async function findFirstNonEmptyBeforeLastSrc() {
    const doc1 = await getDoc(buildUrl(1)); const posts1 = extractPosts(doc1);
    if (!posts1.length) return finalize([]);
    const baseSig = pageSignature(posts1);

    for (const post of posts1) {
      if (last_src && post.src === last_src) return finalize([]);
      if (post.symbols_num > 0) return finalize([post]);
    }
    await sleep(delayMs);

    for (let p=2; p<=maxPages; p++) {
      const doc = await getDoc(buildUrl(p)); const posts = extractPosts(doc);
      if (!posts.length) break;
      if (pageSignature(posts) === baseSig) break;
      for (const post of posts) {
        if (last_src && post.src === last_src) return finalize([]);
        if (post.symbols_num > 0) return finalize([post]);
      }
      await sleep(delayMs);
    }
    return finalize([]);
  }

  // ---------- режим B: собрать ВСЕ ДО last_src (или всё, если он не задан) ----------
  async function collectAllBeforeLastSrc() {
    const acc = [];

    const doc1 = await getDoc(buildUrl(1)); const posts1 = extractPosts(doc1);
    if (!posts1.length) return finalize([]);
    const baseSig = pageSignature(posts1);

    const pushUntilBorder = (list) => {
      for (const post of list) {
        if (last_src && post.src === last_src) return true; // встретили границу -> прекращаем набор
        acc.push(post);
      }
      return false;
    };

    if (pushUntilBorder(posts1)) return finalize(acc);
    await sleep(delayMs);

    for (let p=2; p<=maxPages; p++) {
      const doc = await getDoc(buildUrl(p)); const posts = extractPosts(doc);
      if (!posts.length) break;
      if (pageSignature(posts) === baseSig) break;
      if (pushUntilBorder(posts)) return finalize(acc);
      await sleep(delayMs);
    }
    return finalize(acc);
  }

  // ------ запуск нужного режима ------
  if (stopOnFirstNonEmpty) {
    return await findFirstNonEmptyBeforeLastSrc();
  } else {
    return await collectAllBeforeLastSrc();
  }

  // ------ финализация: reverse + вывод ------
  function finalize(arr) {
    const finalArr = arr.slice().reverse();
    try {
      console.table(finalArr.map(r => ({
        title: r.title,
        src: r.src,
        symbols_num: r.symbols_num,
        textPreview: r.text.slice(0,120).replace(/\s+/g," ")
      })));
    } catch { console.log(finalArr); }
    window.__scrapedPosts = finalArr;
    return finalArr;
  }
}


async function scrapeTopicFirstPostLinks(author, forums, { maxPages = 999, delayMs = 300 } = {}) {
  if (!author) throw new Error("author обязателен");
  if (!Array.isArray(forums) || forums.length === 0) throw new Error("forums обязателен и должен быть массивом");

  const forumsParam = forums.join(",");
  const basePath = "/search.php";
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const buildSearchUrl = (p) => {
    const u = new URL(basePath, location.origin);
    u.search = new URLSearchParams({
      action: "search", author:encodeWithSep(author), forums: forumsParam,
      sort_dir: "DESC", show_as: "topics", p: String(p)
    }).toString();
    return u.toString();
  };

  async function getDoc(url) {
    if (window.FMV?.fetchDoc) return await window.FMV.fetchDoc(url);
    if (typeof fetchCP1251Doc === "function") return await fetchCP1251Doc(url);
    if (typeof fetchHtml === "function") {
      const html = await fetchHtml(url);
      return new DOMParser().parseFromString(html, "text/html");
    }
    const res = await fetch(url, { credentials: "include" });
    const html = await res.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  const hash = (s) => { let h=0; for (const c of s) { h=((h<<5)-h)+c.charCodeAt(0); h|=0; } return h; };

  function getDirectChildAnchor(el) {
    for (const ch of el.children) if (ch.tagName === "A") return ch;
    return null;
  }

  function extractTopicPageLinks(doc) {
    const cons = [...doc.querySelectorAll(".tclcon")];
    const out = [];
    for (const con of cons) {
      let name = con.querySelector(".byuser-username")?.textContent?.trim();
      if (!name) {
        const tr = con.closest("tr");
        name = tr?.querySelector(".tcr .byuser-username")?.textContent?.trim() || "";
      }
      if (name !== targetAuthor) continue;

      const a = getDirectChildAnchor(con);
      const href = a?.getAttribute("href");
      if (!href) continue;

      out.push(new URL(href, location.href).href);
    }
    return out;
  }

  function normalizeToViewtopicIdHref(hrefAbs) {
    try {
      const u = new URL(hrefAbs, location.href);
      if ((u.pathname === "/viewtopic.php" || u.pathname.endsWith("/viewtopic.php")) && u.searchParams.has("id")) {
        const nu = new URL("/viewtopic.php", u.origin);
        nu.searchParams.set("id", u.searchParams.get("id"));
        return nu.href;
      }
      if (u.searchParams.has("id")) {
        const nu = new URL("/viewtopic.php", u.origin);
        nu.searchParams.set("id", u.searchParams.get("id"));
        return nu.href;
      }
      return u.href;
    } catch { return hrefAbs; }
  }

  function findFirstPostPermalink(doc, topicUrl) {
    let a = doc.querySelector(".post.topicpost a.permalink");
    if (a?.getAttribute("href")) return new URL(a.getAttribute("href"), topicUrl).href;

    a = doc.querySelector(".post.topicpost h3 a[href*='#p']");
    if (a?.getAttribute("href")) return new URL(a.getAttribute("href"), topicUrl).href;

    a = doc.querySelector(".post.topicpost a[href*='#p']");
    if (a?.getAttribute("href")) return new URL(a.getAttribute("href"), topicUrl).href;

    try {
      const topicId = new URL(topicUrl).searchParams.get("id");
      if (topicId) {
        for (const link of doc.querySelectorAll("a[href*='#p']")) {
          const abs = new URL(link.getAttribute("href"), topicUrl);
          if (abs.pathname.endsWith("/viewtopic.php") && abs.searchParams.get("id") === topicId) {
            return abs.href;
          }
        }
      }
    } catch {}
    return null;
  }

  const doc1 = await getDoc(buildSearchUrl(1));
  const links1 = extractTopicPageLinks(doc1);
  const sig1 = hash(links1.join("\n"));
  const topics = [...links1];
  await sleep(delayMs);

  for (let p = 2; p <= maxPages; p++) {
    const doc = await getDoc(buildSearchUrl(p));
    const links = extractTopicPageLinks(doc);
    const sig = hash(links.join("\n"));
    if (sig === sig1) break;
    topics.push(...links);
    await sleep(delayMs);
  }

  const uniqTopics = [...new Set(topics)];
  const firstPostLinks = [];

  for (const rawTopic of uniqTopics) {
    const topicUrl = normalizeToViewtopicIdHref(rawTopic);
    try {
      const doc = await getDoc(topicUrl);
      const perm = findFirstPostPermalink(doc, topicUrl);
      if (perm) {
        // преобразуем в формат с pid=K#pK
        const m = perm.match(/#p(\d+)/);
        if (m) {
          const pid = m[1];
          const base = new URL(perm, topicUrl);
          const nu = new URL("/viewtopic.php", base.origin);
          nu.searchParams.set("pid", pid);
          firstPostLinks.push(`${nu.href}#p${pid}`);
        } else {
          firstPostLinks.push(perm);
        }
      }
    } catch {}
    await sleep(delayMs);
  }

  window.__scrapedTopicFirstPosts = firstPostLinks;
  return firstPostLinks;
}
