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
