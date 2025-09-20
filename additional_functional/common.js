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

    const htmlParticipants = participantsLower.map(tok => {
      const roles = Array.from(masksByCharLower.get(tok) || []);
    
      // пытаемся распознать user<ID>, если не получилось — это произвольное имя
      const m = /^user(\d+)$/i.exec(String(tok).trim());
      const id = m ? m[1] : null;
      const found = id && idToNameMap?.has(id);
      const displayName = found ? (idToNameMap.get(id) || `user${id}`) : String(tok);
    
      const tail = roles.length
        ? ` [as ${FMV.escapeHtml(roles.join(', '))}]`
        : '';
    
      if (found) {
        // есть профиль
        const link = (typeof profileLink === 'function')
          ? profileLink(id, displayName)
          : `<a href="/profile.php?id=${id}">${FMV.escapeHtml(displayName)}</a>`;
        return `${link}${tail}`;
      } else {
        // произвольное слово или неизвестный user<ID>
        return `<span class="fmv-missing" data-found="0">${FMV.escapeHtml(displayName)}${tail}</span>`;
      }
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
