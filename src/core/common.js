// ===== FMV common (unified characters + users loader) =====
(function () {
  'use strict';

  const FMV = (window.FMV = window.FMV || {});

  /* ---------- tiny utils ---------- */
  /**
   * Экранирование HTML-символов
   * @param {string} s - Строка для экранирования
   * @returns {string}
   */
  FMV.escapeHtml = FMV.escapeHtml || function (s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  FMV.normSpace = FMV.normSpace || function (s) {
    return String(s ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  };

  /**
   * Ждёт появления элемента в DOM
   * @param {string} selector - CSS селектор
   * @param {number} [timeout=8000] - Таймаут в миллисекундах
   * @returns {Promise<Element>}
   */
  FMV.waitForSelector = FMV.waitForSelector || function (selector, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const node = document.querySelector(selector);
      if (node) return resolve(node);
      const obs = new MutationObserver(() => {
        const n = document.querySelector(selector);
        if (n) { obs.disconnect(); resolve(n); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('timeout: ' + selector)); }, timeout);
    });
  };

  /**
   * Задержка выполнения
   * @param {number} ms - Миллисекунды
   * @returns {Promise<void>}
   */
  FMV.sleep = FMV.sleep || function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  /* ---------- users loader (REMOVED - moved to common_users.js) ---------- */
  // FMV.fetchUsers теперь определяется в common_users.js с новой реализацией

  /* ---------- scrapeUsers - глобальная функция загрузки пользователей ---------- */
  /**
   * Загружает список всех пользователей форума с кэшированием
   * @param {Object} [opts] - Опции загрузки
   * @param {boolean} [opts.force=false] - Игнорировать кэш
   * @param {number} [opts.maxPages=1000] - Максимум страниц для загрузки
   * @param {number} [opts.batchSize=5] - Количество страниц загружаемых параллельно
   * @returns {Promise<Array<{id: number, code: string, name: string}>>}
   */
  window.scrapeUsers = async function scrapeUsers(opts = {}) {
    const force = opts.force || false;
    const maxPages = opts.maxPages || 1000;
    const batchSize = opts.batchSize || 5;

    const CACHE_KEY = 'fmv_users_cache_v2';
    const TTL_MS = 30 * 60 * 1000; // 30 минут
    const PATH = "/userlist.php";
    const CELL_SELECTOR = "td.tcl.username span.usersname";
    const LINK_SELECTOR = "a[href*='id=']";

    const extractId = href => {
      if (!href) return null;
      const m = href.match(/(?:[?&/])id=(\d+)/i);
      return m ? Number(m[1]) : null;
    };

    // Кэширование
    const readCache = () => {
      if (force) return null;
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || !obj.time || !obj.data) return null;
        if (Date.now() - obj.time > TTL_MS) return null;
        return obj.data;
      } catch (_) { return null; }
    };

    const writeCache = list => {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          time: Date.now(),
          data: list
        }));
      } catch (_) {}
    };

    // Проверка кэша
    const cached = readCache();
    if (cached) {
      window.scrapedUsers = cached;
      return cached;
    }

    // Загрузка одной страницы с CP1251 поддержкой
    async function fetchPage(page) {
      const url = `${PATH}?p=${page}`;

      // Используем fetchHtml если доступна (для CP1251)
      let html;
      if (typeof window.fetchHtml === 'function') {
        html = await window.fetchHtml(url);
      } else {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
        html = await res.text();
      }

      const doc = new DOMParser().parseFromString(html, "text/html");

      const users = [];
      doc.querySelectorAll(CELL_SELECTOR).forEach(cell => {
        const a = cell.querySelector(LINK_SELECTOR);
        const name = FMV.normSpace(a?.textContent || "");
        const id = extractId(a?.getAttribute("href") || "");
        if (name && Number.isFinite(id)) {
          users.push({
            id: id,
            code: 'user' + id,
            name: name
          });
        }
      });
      return users;
    }

    // Параллельная загрузка
    const seen = new Set();
    const result = [];

    // Загружаем первую страницу
    const firstPage = await fetchPage(1);
    firstPage.forEach(u => {
      if (!seen.has(u.code)) {
        seen.add(u.code);
        result.push(u);
      }
    });

    // Загружаем остальные страницы параллельно
    for (let start = 2; start <= maxPages; start += batchSize) {
      const pages = [];
      for (let i = 0; i < batchSize && (start + i) <= maxPages; i++) {
        pages.push(start + i);
      }

      const results = await Promise.all(
        pages.map(page => fetchPage(page).catch(() => []))
      );

      let hasNew = false;
      for (const users of results) {
        const newUsers = users.filter(u => !seen.has(u.code));
        if (newUsers.length > 0) {
          hasNew = true;
          newUsers.forEach(u => {
            seen.add(u.code);
            result.push(u);
          });
        }
      }

      // Если на всех страницах батча не было новых пользователей - выходим
      if (!hasNew) break;

      // Задержка между батчами
      if (start + batchSize <= maxPages) {
        await FMV.sleep(300);
      }
    }

    // Сортировка по имени (locale-aware)
    result.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));

    // Сохраняем в кэш
    writeCache(result);
    window.scrapedUsers = result;

    return result;
  };

  /* ---------- fetchProfileInfo - загрузка данных профиля ---------- */
  /**
   * Загружает данные профиля пользователя
   * @param {number} [userId=window.UserID] - ID пользователя
   * @returns {Promise<{id: number, date: Array|null, respect: number|null, positive: number|null, messages: number|null, money: number}>}
   */
  window.fetchProfileInfo = async function fetchProfileInfo(userId = window.UserID) {
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
  };


  window.encodeForSearch = function encodeWin1251(text) {
    let out = '';
    for (const ch of String(text)) {
      const cp = ch.codePointAt(0);
      let b;
      if (cp <= 0x7F) {
        b = cp; // ASCII
      } else if (cp >= 0x0410 && cp <= 0x044F) { // А..я
        b = 0xC0 + (cp - 0x0410);
      } else if (cp === 0x0401) { // Ё
        b = 0xA8;
      } else if (cp === 0x0451) { // ё
        b = 0xB8;
      } else {
        b = 0x3F; // '?'
      }
      out += (b === 0x20) ? '+' : '%' + b.toString(16).toUpperCase().padStart(2, '0');
    }
    return out;
  };


  /* ---------- scrapeTopicFirstPostLinks - парсинг первых постов топиков ---------- */
  /**
   * Парсит ссылки на первые посты топиков автора
   * @param {string} author - Имя автора (обязательно)
   * @param {Array<string>} forums - Список ID форумов (обязательно)
   * @param {Object} [options]
   * @param {number} [options.maxPages=999]
   * @param {number} [options.delayMs=300]
   * @returns {Promise<Array<string>>} список ссылок вида ...viewtopic.php?pid=K#pK
   */
  window.scrapeTopicFirstPostLinks = async function scrapeTopicFirstPostLinks(
    author,
    forums,
    { maxPages = 999, delayMs = 300 } = {}
  ) {
    if (!author) throw new Error("author обязателен");
    if (!Array.isArray(forums) || forums.length === 0) throw new Error("forums обязателен и должен быть массивом");

    const forumsParam = forums.join(",");
    const basePath = "/search.php";
    const targetAuthor = author;

    const buildSearchUrl = (p) => {
      // используем старый «совместимый» формат: forum=, show_as=topics
      const params = [
        ['action',   'search'],
        ['author',   encodeForSearch(targetAuthor.trim())],
        ['forum',    forumsParam],
        ['sort_dir', 'DESC'],
        ['show_as',  'topics'],
        ['p',        String(p)],
      ];
      const query = params.map(([k, v]) => `${k}=${v}`).join('&');
      console.log("[scrapeTopicFirstPostLinks] search params:", `?${query}`);
      return new URL(`${basePath}?${query}`, location.origin).toString();
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
    await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));

    for (let p = 2; p <= maxPages; p++) {
      const doc = await getDoc(buildSearchUrl(p));
      const links = extractTopicPageLinks(doc);
      const sig = hash(links.join("\n"));
      if (sig === sig1) break;
      topics.push(...links);
      await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));
    }

    const uniqTopics = [...new Set(topics)];
    const firstPostLinks = [];

    for (const rawTopic of uniqTopics) {
      const topicUrl = normalizeToViewtopicIdHref(rawTopic);
      try {
        const doc = await getDoc(topicUrl);
        const perm = findFirstPostPermalink(doc, topicUrl);
        if (perm) {
          // -> формат pid=K#pK
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
      await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));
    }

    window.__scrapedTopicFirstPosts = firstPostLinks;
    return firstPostLinks;
  };

  /* ---------- scrapePosts - парсинг постов автора ---------- */
  /**
   * Парсит посты автора из результатов поиска
   * @param {string} author - Имя автора (обязательно)
   * @param {Array<string>|string} forums - Список ID форумов (обязательно)
   * @param {Object} [options]
   * @param {boolean} [options.stopOnFirstNonEmpty=false] - true: вернуть первый непустой ДО last_src (или []), false: собрать все ДО last_src
   * @param {string}  [options.last_src=""] - Пост-граница; сам пост не обрабатываем
   * @param {string}  [options.title_prefix=""] - Начало названия поста для фильтрации
   * @param {number}  [options.maxPages=999]
   * @param {number}  [options.delayMs=300]
   * @param {string}  [options.keywords=""] - Дополнительные ключевые слова для поиска
   * @param {boolean} [options.comments_only=false] - Если true, исключаем первые посты топиков
   * @returns {Promise<Array<{title:string,src:string,text:string,html:string,symbols_num:number}>>}
   */
  window.scrapePosts = async function scrapePosts(
    author,
    forums,
    {
      stopOnFirstNonEmpty = false,
      last_src = "",
      title_prefix = "",
      maxPages = 999,
      delayMs = 300,
      keywords = "",
      comments_only = false,
    } = {}
  ) {
    if (!author) throw new Error("author обязателен");
    if (!forums || (Array.isArray(forums) && forums.length === 0)) throw new Error("forums обязателен");

    const forumsParam   = Array.isArray(forums) ? forums.join(",") : String(forums);
    const keywordsRaw   = String(keywords ?? "").trim();
    const titlePrefixLC = String(title_prefix || "").trim().toLocaleLowerCase('ru');

    const basePath = "/search.php";

    // --- нормализация ссылки поста к ключу вида "pid=K#pK" (для сравнения/исключения)
    function toPidHashFormat(hrefAbs) {
      try {
        const u = new URL(hrefAbs, location.href);
        const mHash = u.hash && u.hash.match(/^#p(\d+)$/);
        if (mHash) {
          const pid = mHash[1];
          return `pid=${pid}#p${pid}`;
        }
        const pid = u.searchParams.get('pid');
        if (pid) return `pid=${pid}#p${pid}`;
        const p = u.searchParams.get('p');
        if (p) return `pid=${p}#p${p}`;
        return u.toString();
      } catch {
        return hrefAbs;
      }
    }

    // --- извлечь "сырые" src для сигнатуры (без фильтров)
    function extractRawSrcs(doc) {
      const out = [];
      for (const post of doc.querySelectorAll('.post')) {
        const span = post.querySelector('h3 > span');
        const a = span ? span.querySelectorAll('a') : [];
        const href = a[2]?.getAttribute('href');
        if (href) out.push(new URL(href, location.href).href);
      }
      return out;
    }

    const hash = (s) => { let h=0; for (const c of s) { h=((h<<5)-h)+c.charCodeAt(0); h|=0; } return h; };
    const pageSignature = (items) => hash(items.join("\n"));

    const buildUrl = (p) => {
      const params = [
        ['action',   'search'],
        ['keywords', keywordsRaw ? encodeForSearch(keywordsRaw.trim()) : ''],
        ['author',   encodeForSearch(author.trim())],
        ['forum',    forumsParam],
        ['search_in','0'],
        ['sort_by',  '0'],
        ['sort_dir', 'DESC'],
        ['show_as',  'posts'],
        ['search',   encodeForSearch('Отправить')], // %CE%F2%EF%F0%E0%E2%E8%F2%FC
        ['p',        String(p)]
      ].filter(([_, v]) => v !== '');

      const query = params.map(([k, v]) => `${k}=${v}`).join('&');
      console.log("[scrapePosts] search params:", `?${query}`);
      return new URL(`${basePath}?${query}`, location.origin).toString();
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

    // ----- извлечение одного поста -----
    const extractOne = (post) => {
      const span = post.querySelector("h3 > span");
      const a = span ? span.querySelectorAll("a") : [];
      // title в нижнем регистре для сопоставления
      const title = (a[1]?.textContent?.trim() || "").toLocaleLowerCase('ru');
      const rawHref = a[2] ? new URL(a[2].getAttribute("href"), location.href).href : "";
      const src     = rawHref ? toPidHashFormat(rawHref) : "";
      const contentEl = post.querySelector(".post-content");
      let html = contentEl?.innerHTML?.trim() || "";
      html = expandBBHtmlToText(html);
      const text = htmlToMultilineText(html);
      return { title, src, text, html, symbols_num: text.length };
    };

    // ----- фильтрация по title_prefix -----
    const titleMatchesPrefix = (t) => {
      if (!titlePrefixLC) return true;
      return t.startsWith(titlePrefixLC);
    };

    // предварительно соберём Set ссылок первых постов (для comments_only)
    let excludeFirstPosts = new Set();
    if (comments_only && typeof window.scrapeTopicFirstPostLinks === 'function') {
      try {
        const forumsArr = Array.isArray(forums) ? forums : [forums];
        const firstLinks = await window.scrapeTopicFirstPostLinks(author, forumsArr, { maxPages, delayMs });
        excludeFirstPosts = new Set(firstLinks.map(toPidHashFormat));
      } catch (e) {
        console.warn('[scrapePosts] cannot preload first-post links:', e);
      }
    }

    // ----- список постов с применением фильтров -----
    const extractPosts = (doc) => {
      const all = [...doc.querySelectorAll(".post")].map(extractOne);
      let list = all.filter(p => titleMatchesPrefix(p.title));
      if (comments_only && excludeFirstPosts.size) {
        list = list.filter(p => !excludeFirstPosts.has(p.src));
      }
      return list;
    };


    const lastSrcKey = last_src ? toPidHashFormat(last_src) : "";

    async function collectUpTo(maxResults) {
      const acc = [];

      const doc1 = await getDoc(buildUrl(1));
      const baseSig = pageSignature(extractRawSrcs(doc1));

      for (let p = 1; p <= maxPages; p++) {
        const doc   = (p === 1) ? doc1 : await getDoc(buildUrl(p));
        const posts = extractPosts(doc);                 // уже отфильтрованные (prefix, comments_only, exclude)
        const sig   = pageSignature(extractRawSrcs(doc));
        if (p > 1 && sig === baseSig) break;            // повтор страницы — стоп

        for (const post of posts) {
          if (lastSrcKey && post.src === lastSrcKey) {
            return finalize(acc);                       // граница — отдаём то, что есть (или [])
          }
          if (post.symbols_num > 0) {
            acc.push(post);
            if (acc.length >= maxResults) {
              return finalize(acc);                     // набрали нужное кол-во
            }
          }
        }
        await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));
      }
      return finalize(acc);
    }

    // Вместо двух режимов:
    const wanted = stopOnFirstNonEmpty ? 1 : Number.POSITIVE_INFINITY;
    return await collectUpTo(wanted);

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
  };
})();