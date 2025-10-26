// ===== FMV common (unified characters + users loader) =====
(function () {
  'use strict';

  const FMV = (window.FMV = window.FMV || {});

  /* ===== Система логирования ===== */
  const DEBUG = true; // false чтобы отключить все log()

  const log = DEBUG ? console.log.bind(console) : () => { };
  const warn = DEBUG ? console.warn.bind(console) : () => { };
  const error = DEBUG ? console.error.bind(console) : () => { };
  const table = DEBUG ? console.table.bind(console) : () => { };
  const groupCollapsed = DEBUG ? console.groupCollapsed.bind(console) : () => { };
  const groupEnd = DEBUG ? console.groupEnd.bind(console) : () => { };

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
    const participantsSet = new Set();
    const masksByCharLower = new Map();
    const htmlMaskPairs = [];

    for (const p of parts) {
      const [left, right] = p.split('=');
      const id = String(Number((left.match(/user(\d+)/i) || [, ''])[1]));
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
      const id = String(+low.replace(/^user/i, ''));
      const base = (typeof profileLink === 'function')
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
      } catch (_) { }
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
      const moneyFieldId = window.PROFILE_FIELDS?.MoneyID;
      const api = window.MainUsrFieldResolver?.getFieldValue;
      if (api) {
        try { return await api({ doc, fieldId: moneyFieldId }); }
        catch (e) { warn("[fetchProfileInfo] getFieldValue error:", e); }
      }
      // фолбэк, если код 2 недоступен
      const selector = `li#pa-fld${moneyFieldId}`;
      const strong = txt(`${selector} strong`);
      if (strong) return strong;
      const raw = txt(selector);
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

  // drop-in замена
  window.encodeForSearch = function encodeWin1251(text) {
    // Нормализуем форму Юникода, чтобы не ловить странные составные символы
    text = String(text).normalize('NFC');

    // Доп. соответствия для CP1251 (частая пунктуация и символы)
    const CP1251_PUNCT = new Map([
      [0x00A0, 0xA0], // NBSP
      [0x00AB, 0xAB], // «
      [0x00BB, 0xBB], // »
      [0x2026, 0x85], // …
      [0x2013, 0x96], // – en dash
      [0x2014, 0x97], // — em dash
      [0x2018, 0x91], // ‘
      [0x2019, 0x92], // ’
      [0x201C, 0x93], // “
      [0x201D, 0x94], // ”
      [0x00B7, 0xB7], // ·
      [0x2116, 0xB9], // №
      [0x00A9, 0xA9], // ©
      [0x00AE, 0xAE], // ®
      [0x2122, 0x99], // ™
    ]);

    // Доп. кириллица CP1251 за пределами русского алфавита
    const CP1251_EXTRA = new Map([
      [0x0404, 0xAA], // Є
      [0x0454, 0xBA], // є
      [0x0406, 0xB2], // І
      [0x0456, 0xB3], // і
      [0x0407, 0xAF], // Ї
      [0x0457, 0xBF], // ї
      [0x0490, 0xA5], // Ґ
      [0x0491, 0xB4], // ґ
    ]);

    let out = '';
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      let b;

      if (cp <= 0x7F) {
        // ASCII
        b = cp;
      } else if (cp >= 0x0410 && cp <= 0x044F) {
        // А..я
        b = 0xC0 + (cp - 0x0410);
      } else if (cp === 0x0401) { // Ё
        b = 0xA8;
      } else if (cp === 0x0451) { // ё
        b = 0xB8;
      } else if (CP1251_EXTRA.has(cp)) {
        b = CP1251_EXTRA.get(cp);
      } else if (CP1251_PUNCT.has(cp)) {
        b = CP1251_PUNCT.get(cp);
      } else if (cp === 0x2010 || cp === 0x2212 || cp === 0x002D) {
        // все виды «минуса/дефиса» → ASCII '-'
        b = 0x2D;
      } else {
        // неизвестное → вопрос: можно заменить на пробел, если хочешь не «мусорить» %3F
        b = 0x3F; // '?'
      }

      out += (b === 0x20) ? '+' : '%' + b.toString(16).toUpperCase().padStart(2, '0');
    }
    return out;
  };

  // ПРИМЕЧАНИЕ: Старые функции scrapePosts и scrapeTopicFirstPostLinks
  // были перенесены в src/core/scrapePosts_legacy.js
  // Используйте вместо них scrapePostsByAuthorTag из src/episodes/scrape_posts_by_author_tag.js

})();
