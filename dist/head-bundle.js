/*!
 * QuadroBoards Automatizations - HEAD BUNDLE
 * @version 1.0.0
 */

/* MODULE 0: src/consts_from_form.js */
var SITE_URL = location.origin;

var ALLOWED_PARENTS = [
  "https://testfmvoice.rusff.me",   // тест
  "https://followmyvoice.rusff.me"        // прод
];

var GROUP_IDS = {
  Admin: 1,
  Moderator: 2,
  Guest: 3,
  User: 4,
  Player: 5,
  Listener: -1,
  Ads: -2,
};

var PROFILE_FIELDS = { // дополнительные поля профиля 
  MoneyID: 6,
  MoneyTemplate: 0,
  IconID: 5,
  BackgroundID: 4,
  PlashkaID: 3,
  PlashkaTemplate: `<a id="ID" class="modal-link" data-reveal-id="character">личная страница</a>`,
};

var FIELDS_WITH_HTML = [
  PROFILE_FIELDS.PlashkaID,
  PROFILE_FIELDS.BackgroundID,
  PROFILE_FIELDS.IconID
]; // поля, для которых нужен рендеринг HTML

var EPS_FORUM_INFO = [ // информация по форумам с эпизодами
  { id: 8, type: 'au', status: 'on' },
  { id: 9, type: 'plot', status: 'archived' },
  { id: 5, type: 'personal', status: 'archived' },
  { id: 4, type: 'personal', status: 'off' },
];

var FORUMS_IDS = { // информация о соответствии форумов конкретным задачам
  Ams: [6], // форумы для админов
  Ads: [3], //  форумы с рекламными листовками
  Bank: [1], // форумы с банком
  PersonalPosts: EPS_FORUM_INFO.filter(item => item.type !== 'plot').map(item => item.id), // форумы с несюжетными постами
  PlotPosts: EPS_FORUM_INFO.filter(item => item.type === 'plot').map(item => item.id), // форумы с сюжетными постами
  NewForm: [10] // форумы с анкетами на проверке
};

var EX_PROFILES = { // информация, где храним админский список удаленных для работы хроно
  topicID: 31,
  commentID: 117
};

var CHRONO_CHECK = {
  GroupID: [GROUP_IDS.Admin],  // кому из групп разрешено использовать сбор хроно
  AllowedUser: [], // или кому из юзеров разрешено использовать сбор хроно
  ForumID: EPS_FORUM_INFO.map(item => item.id), // в каких форумах работает вставка с тегами
  AmsForumID: FORUMS_IDS.Ams, // в каком форуме расположены админские темы
  ChronoTopicID: 13, // в каком теме расположен сбор хроно
  TotalChronoPostID: 83, // в каком посте расположен сбор общего хроно
  PerPersonChronoPostID: 92, // в каком посте расположен сбор хроно по персонажам
  EpisodeMapType: { // отображение типов форумов с эпизодами
    'personal': ['personal', 'black'],
    'plot': ['plot', 'black'],
    'au': ['au', 'black'],
  },
  EpisodeMapStat: { // отображение статусов форумов с эпизодами
    'on': ['active', 'green'],
    'off': ['closed', 'teal'],
    'archived': ['archived', 'maroon'],
  },
  ForumInfo: EPS_FORUM_INFO,
};

var PROFILE_CHECK = { // для работы проверки анкет
  GroupID: [GROUP_IDS.Admin],  // кому из групп разрешено проводить проверку анкет
  GroupUserID: GROUP_IDS.User, // ID группы 'Пользователь'
  GroupPlayerID: GROUP_IDS.Player, // ID группы ''Игрок'
  ForumID: FORUMS_IDS.NewForm,  // в каких форумах работает вставка с кнопками
  PPageTemplate: '<div class="character">шаблон</div>', // шаблон персональной страницы
  PPageGroupID: [GROUP_IDS.Admin, GROUP_IDS.Moderator, GROUP_IDS.User, GROUP_IDS.Player], // каким группам видна персональная страница
  PPageFieldID: PROFILE_FIELDS.PlashkaID, // поле с плашкой
  PPageFieldTemplate: PROFILE_FIELDS.PlashkaTemplate, // шаблон для плашки
  MoneyFieldID: PROFILE_FIELDS.MoneyID, // поле с денежками,
  MoneyFieldTemplate: PROFILE_FIELDS.MoneyTemplate, // шаблон для денежек
};

var BANK_CHECK = { // для проверки банковских операций
  GroupID: [GROUP_IDS.Admin], // кому из групп разрешено проверять банк
  UserID: [2], // кому из юзеров из этих групп разрешено проверять банк
  ForumID: FORUMS_IDS.Bank, // форум, где лежит банк
};

var SKIN = { // для работы с библиотекой скинов
  GroupID: [GROUP_IDS.Admin], // кому из групп разрешено назначать в хранилище скины
  LibraryFieldID: 41, // ID темы с библиотекой
  LibraryGiftPostID: [133], // ID комментариев с подарками
  LibraryPlashkaPostID: [134], // ID комментариев с плашками
  LibraryIconPostID: [135], // ID комментариев с иконками
  LibraryBackPostID: [136], // ID комментариев с фонами
  LibraryCouponPostID: [222], // ID комментариев с купонами
  PlashkaFieldID: PROFILE_FIELDS.PlashkaID, // ID поля с плашками в профиле
  IconFieldID: PROFILE_FIELDS.IconID, // ID поля с иконками в профиле
  BackFieldID: PROFILE_FIELDS.BackgroundID, // ID поля с фонами в профиле 
};

/* MODULE 1: common.js */
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


  /* ---------- scrapeTopicFirstPostLinks - парсинг первых постов топиков ---------- */
  /**
   * Парсит ссылки на первые посты топиков автора
   * @param {string} author - Имя автора (обязательно)
   * @param {Array<string>} forums - Список ID форумов (обязательно)
   * @param {Object} [options]
   * @param {number} [options.maxPages=999]
   * @param {number} [options.delayMs=300]
   * @param {string}  [options.keywords=""] - Дополнительные ключевые слова для поиска
   * @returns {Promise<Array<string>>} список ссылок вида ...viewtopic.php?pid=K#pK
   */
  window.scrapeTopicFirstPostLinks = async function scrapeTopicFirstPostLinks(
    author,
    forums,
    { maxPages = 999, delayMs = 300, keywords = "" } = {}
  ) {
    if (!author) throw new Error("author обязателен");
    if (!Array.isArray(forums) || forums.length === 0) throw new Error("forums обязателен и должен быть массивом");

    const forumsParam = forums.join(",");
    const basePath = "/search.php";
    const targetAuthor = author;
    const keywordsRaw = String(keywords ?? "").trim();

    const buildSearchUrl = (p) => {
      // используем старый «совместимый» формат: forum=, show_as=topics
      const params = [
        ['action', 'search'],
        ['keywords', keywordsRaw ? encodeForSearch(keywordsRaw.trim()) : ''],
        ['author', encodeForSearch(author.trim())],
        ['forums', forumsParam],
        ['search_in', '0'],
        ['sort_by', '0'],
        ['sort_dir', 'DESC'],
        ['show_as', 'topics'],
        ['search', encodeForSearch('Отправить')],
        ['p', String(p)]
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

    const hash = (s) => { let h = 0; for (const c of s) { h = ((h << 5) - h) + c.charCodeAt(0); h |= 0; } return h; };

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
      } catch { }
      return null;
    }

    const doc1 = await getDoc(buildSearchUrl(1));
    const links1 = extractTopicPageLinks(doc1);
    const topics = [...links1];
    await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));

    for (let p = 2; p <= maxPages; p++) {
      const doc = await getDoc(buildSearchUrl(p));
      const currentPageNum = Number(doc.querySelector('div.linkst div.pagelink strong')?.textContent || 1);
      if (currentPageNum === 1 && p !== 1) {
        // сервер снова выдал первую страницу — выходим из цикла
        break;
      }

      const links = extractTopicPageLinks(doc, keywords = keywords);
      if (!links.length) break;

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
      } catch { }
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
   * @param {number}  [options.stopOnNthPost] - Остановиться после N-го поста (undefined = собрать все до last_src)
   * @param {string}  [options.last_src=""] - Пост-граница; сам пост не обрабатываем
   * @param {string}  [options.title_prefix=""] - Начало названия поста для фильтрации
   * @param {number}  [options.maxPages=999]
   * @param {number}  [options.delayMs=300]
   * @param {string}  [options.keywords=""] - Дополнительные ключевые слова для поиска
   * @param {boolean} [options.comments_only=false] - Если true, исключаем первые посты топиков
  * @returns {Promise<Array<{title:string,src:string,text:string,html:string,symbols_num:number,date_ts:number|null,date_iso:string|null}>>}
  */

  window.scrapePosts = async function scrapePosts(
    author,
    forums,
    {
      stopOnNthPost,
      last_src = [],
      title_prefix = "",
      maxPages = 999,
      delayMs = 300,
      keywords = "",
      comments_only = false,
      min_symbols_num = -1
    } = {}
  ) {
    if (!author) throw new Error("author обязателен");
    if (!forums || (Array.isArray(forums) && forums.length === 0)) throw new Error("forums обязателен");

    const forumsParam = Array.isArray(forums) ? forums.join(",") : String(forums);
    const keywordsRaw = String(keywords ?? "").trim();
    const titlePrefixLC = String(title_prefix || "").trim().toLocaleLowerCase('ru');

    // Приводим last_src к массиву строк
    const lastSrcArr = Array.isArray(last_src) ? last_src : [last_src].filter(Boolean);
    const lastSrcKeys = new Set(lastSrcArr.map(toPidHashFormat));

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

    const hash = (s) => { let h = 0; for (const c of s) { h = ((h << 5) - h) + c.charCodeAt(0); h |= 0; } return h; };
    const pageSignature = (items) => hash(items.join("\n"));

    const buildUrl = (p) => {
      console.log("[scrapePosts] keywords:", `${keywordsRaw}`);
      const params = [
        ['action', 'search'],
        ['keywords', keywordsRaw ? encodeForSearch(keywordsRaw.trim()) : ''],
        ['author', encodeForSearch(author.trim())],
        ['forums', forumsParam],
        ['search_in', '0'],
        ['sort_by', '0'],
        ['sort_dir', 'DESC'],
        ['show_as', 'posts'],
        ['search', encodeForSearch('Отправить')], // %CE%F2%EF%F0%E0%E2%E8%F2%FC
        ['p', String(p)]
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

    // помощник: детект служебной страницы "Информация / ничего не найдено"
    function isNoResultsPage(doc) {
      const title = (doc.querySelector('title')?.textContent || '').trim();
      if (title === 'Информация') {
        const info = doc.querySelector('#pun-main .info .container');
        if (info && /ничего не найдено/i.test(info.textContent)) {
          return true;
        }
      }
      return false;
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
      const blockTags = ["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "DL", "DT", "DD", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "UL", "BR"];
      tmp.querySelectorAll(blockTags.join(",")).forEach(el => { if (el.tagName === "BR") el.insertAdjacentText("beforebegin", "\n"); else el.insertAdjacentText("afterend", "\n"); });

      // нормализация
      let t = (tmp.textContent || "").replace(/\u00A0/g, " ");
      t = t.replace(/\[\/?indent\]/gi, "").replace(/\[\/?float(?:=[^\]]+)?\]/gi, "").replace(/\[DiceFM[^\]]*?\]/gi, "");
      t = t.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/ {2,}/g, " ").replace(/\n{2,}/g, "\n");

      const out = []; for (const raw of t.split("\n")) { const line = raw.trim(); if (line === "") { if (out.length && out[out.length - 1] !== "") out.push(""); } else out.push(line); }
      return out.join("\n").replace(/ {2,}/g, " ").replace(/\n{2,}/g, "\n").replace(/^\n+|\n+$/g, "").trim();
    };
    const expandBBHtmlToText = (html = "") => html.replace(/\[html\]([\s\S]*?)\[\/html\]/gi, (_, inner) => htmlToMultilineText(inner));

    // ----- извлечение одного поста -----
    // ----- извлечение одного поста -----
    const extractOne = (post) => {
      const span = post.querySelector("h3 > span");
      const a = span ? span.querySelectorAll("a") : [];

      // title в нижнем регистре для сопоставления
      const title = (a[1]?.textContent?.trim() || "").toLocaleLowerCase('ru');

      // ссылка на сам пост
      const rawHref = a[2] ? new URL(a[2].getAttribute("href"), location.href).href : "";
      const src = rawHref ? toPidHashFormat(rawHref) : "";

      // текст из ссылки — это дата в читаемом виде
      const date_text = a[2]?.innerText?.trim() || "";

      // --- дата из атрибута data-posted (всегда в секундах)
      const postedRaw = post.getAttribute("data-posted");
      const date_ts = Number(postedRaw);

      // --- контент поста
      const contentEl = post.querySelector(".post-content");
      let html = contentEl?.innerHTML?.trim() || "";
      const html_bb = expandBBHtmlToText(html);
      const text = htmlToMultilineText(html_bb);

      return {
        title,
        src,
        text,
        html,
        symbols_num: text.length,
        date_ts,
        date_text,
      };
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

      console.groupCollapsed(`[scrapePosts] Найдено ${all.length} постов на странице`);
      for (const p of all) {
        console.log("→", p.title, "| символов:", p.symbols_num, "| src:", p.src);
      }
      console.groupEnd();

      let list = all.filter(p => titleMatchesPrefix(p.title));

      console.groupCollapsed(`[scrapePosts] После фильтрации title_prefix='${title_prefix}' → ${list.length} постов`);
      for (const p of list) {
        console.log("✓", p.title, "| символов:", p.symbols_num, "| src:", p.src);
      }
      console.groupEnd();

      if (comments_only && excludeFirstPosts.size) {
        const before = list.length;
        list = list.filter(p => !excludeFirstPosts.has(p.src));
        console.log(`[scrapePosts] comments_only: исключено ${before - list.length} первых постов тем`);
      }

      return list;
    };



    const lastSrcKey = last_src ? toPidHashFormat(last_src) : "";

    async function collectUpTo(maxResults) {
      const acc = [];

      const doc1 = await getDoc(buildUrl(1));
      // СТОП 0: сразу выходим, если это «Информация / ничего не найдено»
      if (isNoResultsPage(doc1)) return finalize(acc);

      let prevSig = null;

      for (let p = 1; p <= maxPages; p++) {
        const doc = (p === 1) ? doc1 : await getDoc(buildUrl(p));

        // СТОП 1: служебная страница "Информация / ничего не найдено"
        if (isNoResultsPage(doc)) return finalize(acc);

        const posts = extractPosts(doc); // уже отфильтрованные (prefix, comments_only)
        const raw = extractRawSrcs(doc);           // «сырые» ссылки
        const sig = pageSignature(raw);

        // СТОП 2: пустая страница по DOM (нет постов и «сырых» ссылок)
        if (!raw.length && !doc.querySelector('.post')) return finalize(acc);

        // СТОП 3: повтор предыдущей страницы (сервер вернул ту же)
        if (prevSig !== null && sig === prevSig) return finalize(acc);
        prevSig = sig;

        // (опционально) СТОП 4: повтор базовой страницы
        // if (p > 1 && sig === baseSig) return finalize(acc);

        for (const post of posts) {
          // 1) сначала фильтрация по длине
          const passLen = post.symbols_num > min_symbols_num;
          if (!passLen) continue;

          // 2) только для прошедших проверяем last_src
          if (lastSrcKeys.size && lastSrcKeys.has(post.src)) {
            console.log(`[scrapePosts] найден last_src (после фильтра по длине): ${post.src}, остановка`);
            return finalize(acc);
          }

          // 3) копим результат
          acc.push(post);
          if (acc.length >= maxResults) return finalize(acc);
        }

        await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));
      }

      return finalize(acc);
    }


    // Определяем количество постов для сбора
    const wanted = (stopOnNthPost !== undefined && stopOnNthPost > 0) ? stopOnNthPost : Number.POSITIVE_INFINITY;
    return await collectUpTo(wanted);

    // ------ финализация: reverse + вывод ------
    function finalize(arr) {
      const finalArr = arr.slice().reverse();
      console.log(finalArr);
      try {
        console.table(finalArr.map(r => ({
          title: r.title,
          src: r.src,
          symbols_num: r.symbols_num,
          html: r.html,
          textPreview: r.text.slice(0, 120).replace(/\s+/g, " "),
          date: r.date_ts
        })));
      } catch { console.log(finalArr); }
      window.__scrapedPosts = finalArr;
      return finalArr;
    }
  };
})();
/* MODULE 2: common_users.js (FMV.fetchUsers) */
// ===== FMV.fetchUsers - обёртка вокруг window.scrapeUsers =====
(function () {
  'use strict';

  if (!window.FMV) window.FMV = {};

  /**
   * Загружает список всех пользователей форума с кэшированием
   * Использует window.scrapeUsers из common.js
   * @param {Object} [opts] - Опции загрузки
   * @param {boolean} [opts.force=false] - Игнорировать кэш
   * @param {number} [opts.maxPages=1000] - Максимум страниц для загрузки
   * @param {number} [opts.batchSize=5] - Количество страниц загружаемых параллельно
   * @returns {Promise<Array<{id: number, code: string, name: string}>>}
   */
  FMV.fetchUsers = async function (opts = {}) {
    if (typeof window.scrapeUsers !== 'function') {
      throw new Error('window.scrapeUsers не найдена. Убедитесь, что common.js загружен.');
    }
    return await window.scrapeUsers(opts);
  };

  /**
   * Очистить кэш пользователей
   */
  FMV.invalidateUsersCache = function () {
    try {
      sessionStorage.removeItem('fmv_users_cache_v2');
      sessionStorage.removeItem('fmv_users_cache_v1'); // старый кэш тоже удалим
    } catch (_) {}
  };

})();

/* MODULE 3: helpers.js */
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
 * Выполняет fetch запрос с повторными попытками при серверных ошибках (5xx)
 * @param {string} url - URL для загрузки
 * @param {RequestInit} init - Параметры fetch
 * @param {number} maxRetries - Максимальное количество повторных попыток (по умолчанию 3)
 * @param {number} delayMs - Задержка между попытками в мс (по умолчанию 1000)
 * @returns {Promise<Response>} Promise с ответом
 * @throws {Error} При ошибке после всех попыток
 */
async function fetchWithRetry(url, init = {}, maxRetries = 3, delayMs = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);

      // Если статус < 500 (не серверная ошибка), возвращаем ответ
      if (res.status < 500) {
        return res;
      }

      // Серверная ошибка (5xx)
      lastError = new Error(`HTTP ${res.status}`);

      // Если это последняя попытка, выбрасываем ошибку
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Логируем повторную попытку
      console.warn(`[fetchWithRetry] HTTP ${res.status} для ${url}, повтор ${attempt + 1}/${maxRetries} через ${delayMs}мс`);

      // Задержка перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, delayMs));

    } catch (error) {
      lastError = error;

      // Если это сетевая ошибка (не HTTP), тоже пытаемся повторить
      if (attempt === maxRetries) {
        throw lastError;
      }

      console.warn(`[fetchWithRetry] Ошибка для ${url}: ${error.message}, повтор ${attempt + 1}/${maxRetries} через ${delayMs}мс`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Загружает HTML документ с URL и декодирует его из CP1251
 * @param {string} url - URL для загрузки
 * @returns {Promise<Document>} Promise с распарсенным HTML документом
 * @throws {Error} При ошибке HTTP
 */
async function fetchCP1251Doc(url){
  const res = await fetchWithRetry(url, { credentials:'include' });
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
  const res = await fetchWithRetry(url, init);
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
  const res = await fetchWithRetry(url, { credentials: 'include' });
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

  /**
   * Экспортируем fetchWithRetry для использования в других модулях
   */
  window.fetchWithRetry = window.fetchWithRetry || fetchWithRetry;
})();

/* MODULE 4: profile_from_user.js */
// profile_from_user.js
(() => {
  'use strict';

  // Можно переопределить глобально: window.MAKE_NAMES_LINKS = false
  const MAKE_NAMES_LINKS = (window.MAKE_NAMES_LINKS ?? true);

  // ───────────────────────────────────────────────────────────────────────────
  // УТИЛИТЫ
  // ───────────────────────────────────────────────────────────────────────────
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
      return `<span class="fmv-missing" data-user-id="${uid}" data-found="0">${FMV.escapeHtml(label)}</span>`;
    }

    const safeName = FMV.escapeHtml(name.trim());
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

/* MODULE 5: check_group.js */
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

/* MODULE 6: load_main_users_money.js */
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

/* MODULE 6.5: ui/button.js (createForumButton framework) */
// button.js
(() => {
  'use strict';

  const ready = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  async function waitAmsReady() {
    await ready;
    if (window.__ams_ready) return;
    await new Promise(r => window.addEventListener('ams:ready', r, { once: true }));
  }

  // проверка форума по ссылкам на viewforum.php
  function isAllowedForum(forumIds) {
    const allow = (forumIds || []).map(String);
    const crumbs = document.querySelector('.container.crumbs');

    const matchIn = (root) => Array.from(root.querySelectorAll('a[href]')).some(a => {
      try {
        const u = new URL(a.getAttribute('href'), location.href);
        if (!u.pathname.includes('viewforum.php')) return false;
        const id = (u.searchParams.get('id') || '').trim();
        return id && allow.includes(id);
      } catch { return false; }
    });

    if (crumbs && matchIn(crumbs)) return true;
    if (matchIn(document)) return true;

    const bodyForumId = document.body?.dataset?.forumId;
    if (bodyForumId && allow.includes(String(bodyForumId))) return true;

    return false;
  }

  // НОВОЕ: проверка, что мы на нужной теме /viewtopic.php?id=N (p/K/#pM игнорируем)
  function isOnTopicId(topicId) {
    if (topicId == null) return true; // проверка не запрошена
    const want = String(topicId).trim();
    if (!want) return false;

    try {
      const u = new URL(location.href);
      if (!u.pathname.includes('viewtopic.php')) return false;
      const got = (u.searchParams.get('id') || '').trim();
      return got === want;
    } catch {
      return false;
    }
  }

  /**
   * Универсальный конструктор кнопки.
   *
   * @param {Object}   opts
   * @param {string[]} [opts.allowedGroups=[]]
   * @param {string[]} [opts.allowedForums=[]]
   * @param {string[]} [opts.allowedUsers=[]]
   * @param {string}   [opts.label='Действие']
   * @param {Function} opts.onClick  async ({statusEl, linkEl, detailsEl, setStatus, setDetails, setLink, wrap}) => void
   * @param {string}   [opts.containerSelector='.ams_info']
   * @param {number}   [opts.order=0]
   * @param {boolean}  [opts.showStatus=true]
   * @param {boolean}  [opts.showDetails=true]
   * @param {boolean}  [opts.showLink=true]
   * @param {string|number|null} [opts.topicId=null]  // НОВОЕ: если задано — рендерить только на /viewtopic.php?id=topicId
   */
  window.createForumButton = async function createForumButton(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      allowedUsers = [],
      label = 'Действие',
      onClick,
      containerSelector = '.ams_info',
      order = 0,
      showStatus = true,
      showDetails = true,
      showLink = true,
      topicId = null,               // НОВОЕ
    } = opts || {};

    console.log(`[createForumButton] Вызов для "${label}":`, { allowedGroups, allowedForums, allowedUsers, containerSelector });

    if (typeof onClick !== 'function') {
      console.log(`[createForumButton] "${label}": onClick не функция, выход`);
      return;
    }

    await waitAmsReady();
    console.log(`[createForumButton] "${label}": AMS готов`);

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    console.log(`[createForumButton] "${label}": текущая группа = ${gid}, разрешённые = [${allowedGroups}]`);

    // строгая проверка группы
    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) {
      console.log(`[createForumButton] "${label}": allowedGroups пустой, выход`);
      return;
    }
    if (!allowedGroups.map(Number).includes(Number(gid))) {
      console.log(`[createForumButton] "${label}": группа ${gid} не в списке, выход`);
      return;
    }

    console.log(`[createForumButton] "${label}": проверка группы пройдена`);

    // строгая проверка форума
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) {
      console.log(`[createForumButton] "${label}": allowedForums пустой, выход`);
      return;
    }
    if (!isAllowedForum(allowedForums)) {
      console.log(`[createForumButton] "${label}": форум не разрешён, выход`);
      return;
    }

    console.log(`[createForumButton] "${label}": проверка форума пройдена`);

    // проверка пользователей (если задано)
    if (Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      const uid = Number(window.UserID);
      console.log(`[createForumButton] "${label}": текущий UserID = ${uid}, разрешённые = [${allowedUsers}]`);
      if (!allowedUsers.map(Number).includes(uid)) {
        console.log(`[createForumButton] "${label}": пользователь ${uid} не в списке, выход`);
        return;
      }
    }

    console.log(`[createForumButton] "${label}": проверка пользователей пройдена`);

    // НОВОЕ: строгая проверка нужной темы
    if (!isOnTopicId(topicId)) {
      console.log(`[createForumButton] "${label}": topicId не совпадает, выход`);
      return;
    }

    console.log(`[createForumButton] "${label}": ищем контейнер "${containerSelector}"`);

    const container = await FMV.waitForSelector(containerSelector, 5000).catch(() => null);
    if (!container) {
      console.log(`[createForumButton] "${label}": контейнер "${containerSelector}" не найден, выход`);
      return;
    }

    console.log(`[createForumButton] "${label}": контейнер найден, создаём кнопку`);

    // ---------- UI ----------
    const br = document.createElement('br');
    const wrap = document.createElement('div');
    wrap.dataset.order = order;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'button';
    btn.textContent = label;

    // статус (опционально)
    const status = showStatus ? document.createElement('span') : null;
    if (status) {
      status.style.marginLeft = '10px';
      status.style.fontSize = '14px';
      status.style.color = '#555';
    }

    // встроенная ссылка рядом со статусом (опционально)
    const link = showLink ? document.createElement('a') : null;
    if (link) {
      link.className = 'fmv-action-link';
      link.target = '_blank';
      link.rel = 'noopener';
      link.style.marginLeft = '10px';
      link.style.fontSize = '14px';
      link.style.display = 'none';
    }

    // блок деталей (опционально)
    const details = showDetails ? document.createElement('details') : null;
    let pre = null;
    if (details) {
      details.style.marginTop = '6px';
      const summary = document.createElement('summary');
      summary.textContent = 'Показать детали';
      summary.style.cursor = 'pointer';
      pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.margin = '6px 0 0';
      pre.style.fontSize = '12px';
      details.appendChild(summary);
      details.appendChild(pre);
    }

    // собираем wrap
    wrap.appendChild(btn);
    if (status) wrap.appendChild(status);
    if (link) wrap.appendChild(link);
    if (details) wrap.appendChild(details);

    container.appendChild(br);

    // вставка по order
    const siblings = Array.from(container.querySelectorAll('div[data-order]'));
    const next = siblings.find(el => Number(el.dataset.order) > Number(order));
    if (next) container.insertBefore(wrap, next);
    else container.appendChild(wrap);

    // helpers
    const setStatus = (text, color = '#555') => {
      if (!status) return;
      status.textContent = text;
      status.style.color = color;
    };
    const setDetails = (text = '') => {
      if (!pre) return;
      pre.textContent = String(text || '');
    };
    const setLink = (url, text = 'Открыть') => {
      if (!link) return;
      if (url) {
        link.href = url;
        link.textContent = text;
        link.style.display = 'inline';
      } else {
        link.style.display = 'none';
        link.textContent = '';
        link.removeAttribute('href');
      }
    };

    btn.addEventListener('click', async () => {
      if (showStatus) setStatus('Выполняю…', '#555');
      if (showDetails) setDetails('');
      if (showLink) setLink(null);

      try {
        await onClick({
          statusEl: status || null,
          linkEl: link || null,
          detailsEl: pre || null,
          setStatus,
          setDetails,
          setLink,
          wrap
        });
      } catch (err) {
        if (showStatus) setStatus('✖ Ошибка', 'red');
        if (showDetails) setDetails((err && err.message) ? err.message : String(err));
        console.error('[createForumButton]', err);
      }
    });
  };
})();

/* MODULE 7.0: bank/gringotts_page_update.js */
document.addEventListener("DOMContentLoaded", () => {
    // Проверяем, что заголовок страницы начинается с "Гринготтс"
    if (!document.title.startsWith("Гринготтс")) return;

    const postForm = document.getElementById('post-form');
    const inputFirst = document.querySelector('#post-form input[id="fld10"]');

    if (postForm && (!inputFirst)) {
        postForm.style.display = 'none'; // Скрываем элемент
    }

    // Создаём .ams_info только для разрешённых пользователей
    const allowedUsers = (window.BANK_CHECK?.UserID) || [];
    const currentUser = Number(window.UserID);

    if (allowedUsers.length > 0 && allowedUsers.map(Number).includes(currentUser)) {
        let createdCount = 0;
        document.querySelectorAll('div.post').forEach((post) => {
            // Пропускаем topicpost
            if (post.classList.contains('topicpost')) return;

            const postContent = post.querySelector('.post-content');
            if (!postContent) return;

            // Проверяем, что нет тега bank_ams_done
            const hasAmsDone = postContent.querySelector('bank_ams_done');

            if (!hasAmsDone && !postContent.querySelector('.ams_info')) {
                const amsInfo = document.createElement('div');
                amsInfo.className = 'ams_info';
                postContent.appendChild(amsInfo);
                createdCount++;
            }
        });

        console.log(`[gringotts_page_update] .ams_info создано для UserID=${currentUser}: ${createdCount}`);
    } else {
        console.log(`[gringotts_page_update] UserID=${currentUser} не в списке allowedUsers=[${allowedUsers}], .ams_info не создаётся`);
    }

    // Проходим по всем контейнерам постов (асинхронно для поддержки MainUsrFieldResolver)
    document.querySelectorAll("div.post").forEach(async (container) => {
        try {
            // Ищем кнопку "Редактировать"
            const editLink = container.querySelector(".pl-edit a");
            if (!editLink) return;

            // Проверяем, что внутри контейнера есть div.post, но не div.post.topicpost
            const post = container;
            if (!post || post.classList.contains("topicpost")) return;

            // Ищем ID профиля (N)
            const profileLink = container.querySelector('.pl-email.profile a');
            const profileUrl = (!profileLink) ? undefined : new URL(profileLink.href);
            const usr_id = (!profileUrl) ? 0 : Number(profileUrl.searchParams.get("id"));

            // Ищем K — число в теге <bank_data>
            const bankData = container.querySelector("bank_data");
            const ts = (!bankData) ? 0 : Number(bankData.textContent.trim());

            // Извлекаем comment_id из href ссылки редактирования
            // Формат: https://testfmvoice.rusff.me/edit.php?id=154
            let comment_id = 0;
            try {
                const editUrl = new URL(editLink.href);
                comment_id = Number(editUrl.searchParams.get("id")) || 0;
            } catch (e) {
                console.warn("Не удалось извлечь comment_id из href:", e);
            }

            // Извлекаем текущее значение денег из профиля (поле MoneyID)
            let current_bank = 0;
            try {
                const moneyFieldClass = `pa-fld${window.PROFILE_FIELDS?.MoneyID || 0}`;
                const moneyField = container.querySelector(`.${moneyFieldClass}`);

                if (moneyField) {
                    // Проверяем наличие комментария <!-- main: usrN -->
                    const walker = document.createTreeWalker(moneyField, NodeFilter.SHOW_COMMENT);
                    let hasMainComment = false;
                    const RE_MAIN = /^\s*main:\s*usr(\d+)\s*$/i;

                    for (let node; (node = walker.nextNode());) {
                        const match = (node.nodeValue || "").match(RE_MAIN);
                        if (match) {
                            hasMainComment = true;
                            // Если есть комментарий <!-- main: usrN -->, используем API для получения значения
                            if (window.MainUsrFieldResolver?.getFieldValue) {
                                try {
                                    const value = await window.MainUsrFieldResolver.getFieldValue({
                                        doc: document,
                                        fieldId: window.PROFILE_FIELDS?.MoneyID || 0
                                    });
                                    current_bank = Number(value) || 0;
                                } catch (err) {
                                    console.warn("Ошибка получения значения через MainUsrFieldResolver:", err);
                                    current_bank = 0;
                                }
                            }
                            break;
                        }
                    }

                    // Если нет комментария, берём текстовое значение из li (вне span)
                    if (!hasMainComment) {
                        // Ищем текст вне <span class="fld-name">
                        const fieldNameSpan = moneyField.querySelector('span.fld-name');
                        let textContent = moneyField.textContent || '';

                        if (fieldNameSpan) {
                            // Убираем текст из span.fld-name
                            textContent = textContent.replace(fieldNameSpan.textContent, '');
                        }

                        // Очищаем от пробелов и неразрывных пробелов
                        textContent = textContent.replace(/\u00A0/g, ' ').trim();

                        // Извлекаем число
                        const match = textContent.match(/-?\d+(?:\.\d+)?/);
                        if (match) {
                            current_bank = Number(match[0]) || 0;
                        }
                    }
                } else {
                    current_bank = 0;
                }
            } catch (e) {
                console.warn("Не удалось извлечь current_bank:", e);
            }

            // Заменяем поведение кнопки
            editLink.removeAttribute("href");
            editLink.removeAttribute("rel");
            editLink.setAttribute("onclick", `bankCommentEditFromBackup(${usr_id}, ${ts}, ${comment_id}, ${current_bank})`);
        } catch (e) {
            console.error("Ошибка при обработке контейнера:", e);
        }
    });

    // Отправляем событие в конце и устанавливаем флаг
    window.__gringotts_ready = true;
    window.dispatchEvent(new CustomEvent('gringotts:ready'));
    console.log('[gringotts_page_update] Событие gringotts:ready отправлено, флаг установлен');
});
/* MODULE 7.1: bank/buttons/start_ams_check.js */
/**
 * Кнопка "Начать проверку АМС"
 * Добавляет метку [FMVbankAmsCheck] в начало комментария и отправляет форму редактирования
 */

(function () {
  'use strict';

  // Проверяем, что заголовок страницы начинается с "Гринготтс"
  if (!document.title.startsWith('Гринготтс')) {
    return;
  }

  const TAG = '[FMVbankAmsCheck]';
  const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');

  /**
   * Извлекает comment_id из поста
   */
  function getCommentId(post) {
    const editLink = post.querySelector('.pl-edit a');
    if (!editLink) return 0;

    try {
      const editUrl = new URL(editLink.href);
      return Number(editUrl.searchParams.get('id')) || 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Запускает проверку АМС для указанного комментария
   */
  async function startAmsCheck(commentId, { setStatus, setDetails }) {
    try {
      setStatus('⏳ Загрузка...');

      // Создаём скрытый iframe для редактирования
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `${SITE_URL}/edit.php?id=${commentId}`;
      document.body.appendChild(iframe);

      // Ждём загрузки iframe
      await new Promise((resolve, reject) => {
        iframe.onload = resolve;
        iframe.onerror = () => reject(new Error('Не удалось загрузить страницу редактирования'));
        setTimeout(() => reject(new Error('Таймаут загрузки страницы редактирования')), 10000);
      });

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const textarea = iframeDoc.querySelector('textarea[name="req_message"]');
      const submitButton = iframeDoc.querySelector('input[type="submit"].button.submit[name="submit"][value="Отправить"][accesskey="s"]');

      if (!textarea || !submitButton) {
        throw new Error('Не найдена форма редактирования');
      }

      // Добавляем тег в начало, если его ещё нет
      const currentValue = textarea.value || '';
      if (!currentValue.includes(TAG)) {
        textarea.value = TAG + currentValue;
        setDetails(`Тег ${TAG} добавлен`);
      } else {
        setDetails(`Тег ${TAG} уже присутствует`);
      }

      setStatus('⏳ Отправка...');

      // Отслеживаем редирект после отправки
      let redirectUrl = null;
      let redirectDetected = false;

      const checkRedirect = () => {
        try {
          const currentUrl = iframe.contentWindow.location.href;
          if (currentUrl.includes('/viewtopic.php?')) {
            redirectUrl = currentUrl;
            redirectDetected = true;
          }
        } catch (err) {
          // Игнорируем CORS ошибки
        }
      };

      const redirectCheckInterval = setInterval(checkRedirect, 500);

      setTimeout(() => {
        clearInterval(redirectCheckInterval);
        if (!redirectDetected) {
          iframe.remove();
        }
      }, 10000);

      // Отправляем форму
      submitButton.click();

      // Ждём редирект
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (redirectDetected) {
            clearInterval(interval);
            clearInterval(redirectCheckInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 10000);
      });

      // Удаляем iframe
      iframe.remove();

      if (redirectDetected) {
        setStatus('✅ Проверка запущена');
        setDetails(`Комментарий ${commentId} обновлён`);

        // Перезагружаем страницу через 2 секунды
        setTimeout(() => {
          window.location.reload();
        }, 2000);

        return { success: true, redirectUrl };
      } else {
        throw new Error('Не удалось обнаружить редирект после отправки');
      }

    } catch (error) {
      setStatus('❌ Ошибка');
      setDetails(error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Создаёт кнопку для каждого поста (аналог createForumButton, но для постов)
   */
  async function createPostButtons(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      allowedUsers = [],
      label = 'Действие',
      onClick,
      containerSelector = '.ams_info',
      order = 0,
      postSelector = 'div.post',
      showStatus = true,
      showDetails = true,
    } = opts || {};

    console.log(`[createPostButtons] "${label}": Вызов с параметрами:`, { allowedGroups, allowedForums, allowedUsers, containerSelector, postSelector });

    // Проверяем заголовок страницы
    if (!document.title.startsWith('Гринготтс')) {
      console.log(`[createPostButtons] "${label}": Страница не Гринготтс, выход`);
      return;
    }

    if (typeof onClick !== 'function') {
      console.log(`[createPostButtons] "${label}": onClick не функция, выход`);
      return;
    }

    // Ждём события gringotts:ready от gringotts_page_update.js
    if (!window.__gringotts_ready) {
      console.log(`[createPostButtons] "${label}": Ждём события gringotts:ready`);
      await new Promise(r => window.addEventListener('gringotts:ready', r, { once: true }));
    } else {
      console.log(`[createPostButtons] "${label}": gringotts уже готов (флаг установлен)`);
    }
    console.log(`[createPostButtons] "${label}": Продолжаем работу`);

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    console.log(`[createPostButtons] "${label}": текущая группа = ${gid}, разрешённые = [${allowedGroups}]`);

    // Проверка группы
    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) {
      console.log(`[createPostButtons] "${label}": allowedGroups пустой, выход`);
      return;
    }
    if (!allowedGroups.map(Number).includes(Number(gid))) {
      console.log(`[createPostButtons] "${label}": группа ${gid} не в списке, выход`);
      return;
    }

    console.log(`[createPostButtons] "${label}": проверка группы пройдена`);

    // Проверка форума
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) {
      console.log(`[createPostButtons] "${label}": allowedForums пустой, выход`);
      return;
    }

    // Проверка форума через isAllowedForum (из button.js)
    const isAllowedForum = (forumIds) => {
      const allow = (forumIds || []).map(String);
      const crumbs = document.querySelector('.container.crumbs');

      const matchIn = (root) => Array.from(root.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          if (!u.pathname.includes('viewforum.php')) return false;
          const id = (u.searchParams.get('id') || '').trim();
          return id && allow.includes(id);
        } catch { return false; }
      });

      if (crumbs && matchIn(crumbs)) return true;
      if (matchIn(document)) return true;

      const bodyForumId = document.body?.dataset?.forumId;
      if (bodyForumId && allow.includes(String(bodyForumId))) return true;

      return false;
    };

    if (!isAllowedForum(allowedForums)) {
      console.log(`[createPostButtons] "${label}": форум не разрешён, выход`);
      return;
    }

    console.log(`[createPostButtons] "${label}": проверка форума пройдена`);

    // Проверка пользователей (если задано)
    if (Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      const uid = Number(window.UserID);
      console.log(`[createPostButtons] "${label}": текущий UserID = ${uid}, разрешённые = [${allowedUsers}]`);
      if (!allowedUsers.map(Number).includes(uid)) {
        console.log(`[createPostButtons] "${label}": пользователь ${uid} не в списке, выход`);
        return;
      }
    }

    console.log(`[createPostButtons] "${label}": проверка пользователей пройдена`);

    // Находим все подходящие посты
    const posts = document.querySelectorAll(postSelector);
    console.log(`[createPostButtons] "${label}": Найдено постов по селектору "${postSelector}":`, posts.length);

    let addedCount = 0;
    posts.forEach((post, index) => {
      const postContent = post.querySelector('.post-content');
      if (!postContent) {
        console.log(`[createPostButtons] "${label}": Пост ${index}: нет .post-content, пропуск`);
        return;
      }

      // Проверяем, что нет тегов bank_ams_check и bank_ams_done
      const hasAmsCheck = postContent.querySelector('bank_ams_check');
      const hasAmsDone = postContent.querySelector('bank_ams_done');
      if (hasAmsCheck || hasAmsDone) {
        console.log(`[createPostButtons] "${label}": Пост ${index}: есть bank_ams_check или bank_ams_done, пропуск`);
        return;
      }

      const container = postContent.querySelector(containerSelector);
      if (!container) {
        console.log(`[createPostButtons] "${label}": Пост ${index}: контейнер "${containerSelector}" не найден, пропуск`);
        return;
      }

      // Проверяем, не добавлена ли уже кнопка
      if (container.querySelector(`[data-post-button-label="${label}"]`)) {
        console.log(`[createPostButtons] "${label}": Пост ${index}: кнопка уже добавлена, пропуск`);
        return;
      }

      const commentId = getCommentId(post);
      if (!commentId) {
        console.log(`[createPostButtons] "${label}": Пост ${index}: не удалось получить commentId, пропуск`);
        return;
      }

      console.log(`[createPostButtons] "${label}": Пост ${index}: добавляем кнопку для комментария ${commentId}`);

      // Создаём UI
      const wrap = document.createElement('div');
      wrap.dataset.order = order;
      wrap.dataset.postButtonLabel = label;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'button';
      btn.textContent = label;

      const status = showStatus ? document.createElement('span') : null;
      if (status) {
        status.style.marginLeft = '10px';
        status.style.fontSize = '14px';
        status.style.color = '#555';
      }

      const details = showDetails ? document.createElement('details') : null;
      let pre = null;
      if (details) {
        details.style.marginTop = '6px';
        const summary = document.createElement('summary');
        summary.textContent = 'Показать детали';
        summary.style.cursor = 'pointer';
        pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.margin = '6px 0 0';
        pre.style.fontSize = '12px';
        details.appendChild(summary);
        details.appendChild(pre);
      }

      wrap.appendChild(btn);
      if (status) wrap.appendChild(status);
      if (details) wrap.appendChild(details);

      // Вставка по order
      const siblings = Array.from(container.querySelectorAll('div[data-order]'));
      const next = siblings.find(el => Number(el.dataset.order) > Number(order));
      if (next) container.insertBefore(wrap, next);
      else container.appendChild(wrap);

      // Helpers
      const setStatus = (text, color = '#555') => {
        if (!status) return;
        status.textContent = text;
        status.style.color = color;
      };
      const setDetails = (text = '') => {
        if (!pre) return;
        pre.textContent = String(text || '');
      };

      btn.addEventListener('click', async () => {
        if (showStatus) setStatus('Выполняю…', '#555');
        if (showDetails) setDetails('');

        try {
          await onClick({
            commentId,
            post,
            statusEl: status || null,
            detailsEl: pre || null,
            setStatus,
            setDetails,
            wrap
          });
        } catch (err) {
          if (showStatus) setStatus('✖ Ошибка', 'red');
          if (showDetails) setDetails((err && err.message) ? err.message : String(err));
        }
      });

      addedCount++;
    });

    console.log(`[createPostButtons] "${label}": Добавлено кнопок: ${addedCount}`);
  }

  // Используем createPostButtons для создания кнопок
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    await createPostButtons({
      allowedGroups: (window.BANK_CHECK?.GroupID) || [],
      allowedForums: (window.BANK_CHECK?.ForumID) || [],
      allowedUsers: (window.BANK_CHECK?.UserID) || [],
      label: 'Начать проверку',
      order: 1,
      containerSelector: '.ams_info',
      postSelector: 'div.post',
      onClick: async ({ commentId, setStatus, setDetails }) => {
        await startAmsCheck(commentId, { setStatus, setDetails });
      }
    });
  }

  // Экспортируем функции
  window.startAmsCheck = startAmsCheck;
  window.createPostButtons = createPostButtons;
})();

/* MODULE 7.2: bank/buttons/admin_edit.js */
/**
 * Кнопка "Внести правки"
 * Вызывает bankCommentEditFromBackup с флагом NEW_ADMIN_EDIT = true
 */

(function () {
  'use strict';

  // Проверяем, что заголовок страницы начинается с "Гринготтс"
  if (!document.title.startsWith('Гринготтс')) {
    return;
  }

  /**
   * Извлекает данные из поста для вызова bankCommentEditFromBackup
   */
  async function getPostData(post) {
    // Извлекаем usr_id из профиля
    const profileLink = post.querySelector('.pl-email.profile a');
    const profileUrl = profileLink ? new URL(profileLink.href) : null;
    const usr_id = profileUrl ? Number(profileUrl.searchParams.get("id")) || 0 : 0;

    // Извлекаем ts из тега <bank_data>
    const bankData = post.querySelector('bank_data');
    const ts = bankData ? Number(bankData.textContent.trim()) || 0 : 0;

    // Извлекаем comment_id из h3 span .permalink по хешу (#p346)
    let comment_id = 0;
    const permalink = post.querySelector('h3 span .permalink');
    if (permalink && permalink.href) {
      try {
        const url = new URL(permalink.href);
        const hash = url.hash; // например, "#p346"
        if (hash && hash.startsWith('#p')) {
          comment_id = Number(hash.substring(2)) || 0; // убираем "#p" и берём число
        }
      } catch (e) {
        console.warn('[adminEdit] Не удалось извлечь comment_id из permalink:', e);
      }
    }

    // Извлекаем current_bank из поля MoneyID (аналогично gringotts_page_update.js)
    let current_bank = 0;
    try {
      const moneyFieldClass = `pa-fld${window.PROFILE_FIELDS?.MoneyID || 0}`;
      const moneyField = post.querySelector(`.${moneyFieldClass}`);

      if (moneyField) {
        // Проверяем наличие комментария <!-- main: usrN -->
        const walker = document.createTreeWalker(moneyField, NodeFilter.SHOW_COMMENT);
        let hasMainComment = false;
        const RE_MAIN = /^\s*main:\s*usr(\d+)\s*$/i;

        for (let node; (node = walker.nextNode());) {
          const match = (node.nodeValue || "").match(RE_MAIN);
          if (match) {
            hasMainComment = true;
            // Если есть комментарий <!-- main: usrN -->, используем API для получения значения
            if (window.MainUsrFieldResolver?.getFieldValue) {
              try {
                const value = await window.MainUsrFieldResolver.getFieldValue({
                  doc: document,
                  fieldId: window.PROFILE_FIELDS?.MoneyID || 0
                });
                current_bank = Number(value) || 0;
              } catch (err) {
                console.warn("Ошибка получения значения через MainUsrFieldResolver:", err);
                current_bank = 0;
              }
            }
            break;
          }
        }

        // Если нет комментария, берём текстовое значение из li (вне span)
        if (!hasMainComment) {
          const fieldNameSpan = moneyField.querySelector('span.fld-name');
          let textContent = moneyField.textContent || '';

          if (fieldNameSpan) {
            textContent = textContent.replace(fieldNameSpan.textContent, '');
          }

          textContent = textContent.replace(/\u00A0/g, ' ').trim();
          const match = textContent.match(/-?\d+(?:\.\d+)?/);
          if (match) {
            current_bank = Number(match[0]) || 0;
          }
        }
      }
    } catch (e) {
      console.warn('[adminEdit] Не удалось извлечь current_bank:', e);
    }

    return { usr_id, ts, comment_id, current_bank };
  }

  /**
   * Создаёт кнопку для каждого поста
   */
  async function createAdminEditButtons(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      allowedUsers = [],
      label = 'Внести правки',
      containerSelector = '.ams_info',
      order = 2,
      postSelector = 'div.post',
      showStatus = true,
      showDetails = true,
    } = opts || {};

    console.log(`[adminEdit] "${label}": Вызов с параметрами:`, { allowedGroups, allowedForums, allowedUsers });

    // Проверяем заголовок страницы
    if (!document.title.startsWith('Гринготтс')) {
      console.log(`[adminEdit] "${label}": Страница не Гринготтс, выход`);
      return;
    }

    // Ждём события gringotts:ready
    if (!window.__gringotts_ready) {
      console.log(`[adminEdit] "${label}": Ждём события gringotts:ready`);
      await new Promise(r => window.addEventListener('gringotts:ready', r, { once: true }));
    } else {
      console.log(`[adminEdit] "${label}": gringotts уже готов`);
    }

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    console.log(`[adminEdit] "${label}": текущая группа = ${gid}, разрешённые = [${allowedGroups}]`);

    // Проверка группы
    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) {
      console.log(`[adminEdit] "${label}": allowedGroups пустой, выход`);
      return;
    }
    if (!allowedGroups.map(Number).includes(Number(gid))) {
      console.log(`[adminEdit] "${label}": группа ${gid} не в списке, выход`);
      return;
    }

    // Проверка форума
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) {
      console.log(`[adminEdit] "${label}": allowedForums пустой, выход`);
      return;
    }

    // Проверка форума через isAllowedForum
    const isAllowedForum = (forumIds) => {
      const allow = (forumIds || []).map(String);
      const crumbs = document.querySelector('.container.crumbs');

      const matchIn = (root) => Array.from(root.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          if (!u.pathname.includes('viewforum.php')) return false;
          const id = (u.searchParams.get('id') || '').trim();
          return id && allow.includes(id);
        } catch { return false; }
      });

      if (crumbs && matchIn(crumbs)) return true;
      if (matchIn(document)) return true;

      const bodyForumId = document.body?.dataset?.forumId;
      if (bodyForumId && allow.includes(String(bodyForumId))) return true;

      return false;
    };

    if (!isAllowedForum(allowedForums)) {
      console.log(`[adminEdit] "${label}": форум не разрешён, выход`);
      return;
    }

    // Проверка пользователей
    if (Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      const uid = Number(window.UserID);
      console.log(`[adminEdit] "${label}": текущий UserID = ${uid}, разрешённые = [${allowedUsers}]`);
      if (!allowedUsers.map(Number).includes(uid)) {
        console.log(`[adminEdit] "${label}": пользователь ${uid} не в списке, выход`);
        return;
      }
    }

    // Находим все подходящие посты
    const posts = document.querySelectorAll(postSelector);
    console.log(`[adminEdit] "${label}": Найдено постов: ${posts.length}`);

    let addedCount = 0;
    for (let index = 0; index < posts.length; index++) {
      const post = posts[index];

      // Пропускаем topicpost
      if (post.classList.contains('topicpost')) continue;

      const postContent = post.querySelector('.post-content');
      if (!postContent) continue;

      // Проверяем, что ЕСТЬ bank_ams_check, но НЕТ bank_ams_done
      const hasAmsCheck = postContent.querySelector('bank_ams_check');
      const hasAmsDone = postContent.querySelector('bank_ams_done');
      if (!hasAmsCheck || hasAmsDone) {
        console.log(`[adminEdit] "${label}": Пост ${index}: hasAmsCheck=${!!hasAmsCheck}, hasAmsDone=${!!hasAmsDone}, пропуск`);
        continue;
      }

      const container = postContent.querySelector(containerSelector);
      if (!container) continue;

      // Проверяем, не добавлена ли уже кнопка
      if (container.querySelector(`[data-post-button-label="${label}"]`)) continue;

      const postData = await getPostData(post);
      console.log(`[adminEdit] "${label}": Пост ${index}: getPostData вернул:`, postData);

      const { usr_id, ts, comment_id, current_bank } = postData;
      if (!usr_id || !ts || !comment_id) {
        console.log(`[adminEdit] "${label}": Пост ${index}: проверка не прошла - usr_id=${usr_id}, ts=${ts}, comment_id=${comment_id}`);
        continue;
      }

      console.log(`[adminEdit] "${label}": Пост ${index}: данные OK - usr_id=${usr_id}, ts=${ts}, comment_id=${comment_id}, current_bank=${current_bank}`);

      // Создаём UI
      const wrap = document.createElement('div');
      wrap.dataset.order = order;
      wrap.dataset.postButtonLabel = label;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'button';
      btn.textContent = label;

      const status = showStatus ? document.createElement('span') : null;
      if (status) {
        status.style.marginLeft = '10px';
        status.style.fontSize = '14px';
        status.style.color = '#555';
      }

      const details = showDetails ? document.createElement('details') : null;
      let pre = null;
      if (details) {
        details.style.marginTop = '6px';
        const summary = document.createElement('summary');
        summary.textContent = 'Показать детали';
        summary.style.cursor = 'pointer';
        pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.margin = '6px 0 0';
        pre.style.fontSize = '12px';
        details.appendChild(summary);
        details.appendChild(pre);
      }

      wrap.appendChild(btn);
      if (status) wrap.appendChild(status);
      if (details) wrap.appendChild(details);

      // Вставка по order
      const siblings = Array.from(container.querySelectorAll('div[data-order]'));
      const next = siblings.find(el => Number(el.dataset.order) > Number(order));
      if (next) container.insertBefore(wrap, next);
      else container.appendChild(wrap);

      // Обработчик клика
      btn.addEventListener('click', async () => {
        console.log(`[adminEdit] Вызов bankCommentEditFromBackup с NEW_ADMIN_EDIT=true`);
        if (status) {
          status.textContent = 'Выполняю…';
          status.style.color = '#555';
        }
        if (pre) pre.textContent = '';

        try {
          if (typeof window.bankCommentEditFromBackup === 'function') {
            await window.bankCommentEditFromBackup(usr_id, ts, comment_id, current_bank, { NEW_ADMIN_EDIT: true });
            if (status) {
              status.textContent = '✅ Готово';
              status.style.color = 'green';
            }
            if (pre) pre.textContent = `Вызвано с NEW_ADMIN_EDIT=true`;
          } else {
            throw new Error('Функция bankCommentEditFromBackup недоступна');
          }
        } catch (err) {
          if (status) {
            status.textContent = '✖ Ошибка';
            status.style.color = 'red';
          }
          if (pre) pre.textContent = (err && err.message) ? err.message : String(err);
          console.error('[adminEdit] Ошибка:', err);
        }
      });

      addedCount++;
    }

    console.log(`[adminEdit] "${label}": Добавлено кнопок: ${addedCount}`);
  }

  // Инициализация
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    await createAdminEditButtons({
      allowedGroups: (window.BANK_CHECK?.GroupID) || [],
      allowedForums: (window.BANK_CHECK?.ForumID) || [],
      allowedUsers: (window.BANK_CHECK?.UserID) || [],
      label: 'Внести правки',
      order: 2,
      containerSelector: '.ams_info',
      postSelector: 'div.post',
    });
  }

  // Экспортируем функцию
  window.createAdminEditButtons = createAdminEditButtons;
})();

/* MODULE 7: bank/api.js */
(function (w, ns) {
  const API_URL = "/api.php";
  const USER_ID = () => 1; // всегда 1 в запросах
  let ticket = false;

  // utils
  const enc = (o) => new URLSearchParams(o);
  const parseStorage = (json, key) => {
    try {
      const raw = json?.response?.storage?.data?.[key];
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  // авто-подхват токена
  (function autoDetectToken() {
    const guess =
      w.ForumAPITicket ||
      w.ticket ||
      w.TOKEN ||
      w.API_TOKEN ||
      (w.session && w.session.token) ||
      (w.FORUM && w.FORUM.ticket) ||
      null;

    if (guess) {
      ticket = guess;
    } else {
      let tries = 5;
      const iv = setInterval(() => {
        if (ticket || --tries < 0) { clearInterval(iv); return; }
        const late =
          w.ForumAPITicket ||
          w.ticket ||
          w.TOKEN ||
          w.API_TOKEN ||
          (w.session && w.session.token) ||
          (w.FORUM && w.FORUM.ticket) ||
          null;
        if (late) {
          ticket = late;
          clearInterval(iv);
        }
      }, 200);
    }
  })();

  // базовый вызов
  async function callStorage(method, payload = {}, NEEDED_USER_ID = 1) {
    const API_KEY = "fmv_bank_info_" + NEEDED_USER_ID;

    if (method === "storage.get") {
      const qs = enc({ user_id: USER_ID(), method, key: API_KEY });
      const res = await fetch(`${API_URL}?${qs}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      if (!res.ok) throw new Error(`GET ${res.status}`);
      return res.json();
    }

    if (method === "storage.set") {
      const body = enc({ user_id: USER_ID(), token: ticket, method, key: API_KEY, ...payload });
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        credentials: "same-origin",
        body
      });
      if (!res.ok) throw new Error(`POST ${res.status}`);
      return true;
    }

    throw new Error("Unknown method");
  }

  // публичные функции
  async function storageGet(NEEDED_USER_ID = 1) {
    const API_KEY = "fmv_bank_info_" + NEEDED_USER_ID;
    const json = await callStorage("storage.get", {}, NEEDED_USER_ID);
    const parsed = parseStorage(json, API_KEY);
    return parsed;
  }

  async function storageSet(valueObj, NEEDED_USER_ID = 1) {
    if (!valueObj || typeof valueObj !== "object" || Array.isArray(valueObj)) {
      console.log("[FMVbank] storageSet: ожидался объект JSON");
      return false;
    }
    const stringValue = JSON.stringify(valueObj);
    await callStorage("storage.set", { value: stringValue }, NEEDED_USER_ID);
    return true;
  }

  function setTicket(value) { ticket = value; }

  // экспорт
  w[ns] = { setTicket, storageGet, storageSet };

})(window, "FMVbank");

// Пример использования:
// const dataStr = await FMVbank.storageGet(15);
// FMVbank.storageSet({}, 15)
//   .then(ok => {
//     if (ok) console.log("✅ данные успешно записаны");
//     else console.warn("⚠ не удалось подтвердить запись");
//   })
//   .catch(err => console.error("❌ ошибка при записи:", err));

/* MODULE 8: bank/parent/format_text.js */
/**
 * Преобразует входной объект { fullData: [...] } в текст по заданным правилам.
 * Использует modalAmount (fallback — amount).
 */
function formatBankText(data) {
  if (!data || !Array.isArray(data.fullData)) return "";

  // нормализация BASE_URL: window.SITE_URL без завершающего '/'
  let BASE_URL = "";
  if (typeof window !== "undefined" && typeof window.SITE_URL === "string") {
    BASE_URL = window.SITE_URL.trim().replace(/\/+$/, "");
  }

  // 1) Админские основные
  const earliestIds = [
    "form-income-anketa",
    "form-income-akcion",
    "form-income-needchar",
    "form-income-episode-of",
    "form-income-post-of",
    "form-income-writer",
    "form-income-activist",
  ];

  // 2) Пополнения от админов
  const topupAmsIds = ["form-income-topup", "form-income-ams"];

  // 3) Первый пост
  const firstPostIds = ["form-income-firstpost"];

  // 4) Личный и сюжетные посты
  const postIds = ["form-income-personalpost", "form-income-plotpost"];

  // 5) Флаеры
  const flyerIds = ["form-income-flyer"];

  // 6) Каждые 100/месяц
  const firstIds = [
    "form-income-100msgs",
    "form-income-100pos",
    "form-income-100rep",
    "form-income-month",
  ];

  // 7) Нумерованный список ссылок
  const incomeIds = [
    "form-income-needrequest",
    "form-income-contest",
    "form-income-avatar",
    "form-income-avatar",
    "form-income-design-other",
    "form-income-run-contest",
    "form-income-mastering",
    "form-income-rpgtop",
  ];

  // 8) Баннеры
  const bannerIds = ["form-income-banner-mayak", "form-income-banner-reno"];

  // 9) Выкупы
  const expIds = [
    "form-exp-face-1m",
    "form-exp-face-3m",
    "form-exp-face-6m",
    "form-exp-char-1m",
    "form-exp-char-3m",
    "form-exp-char-6m",
    "form-exp-face-own-1m",
    "form-exp-face-own-3m",
    "form-exp-face-own-6m",
    "form-exp-need-1w",
    "form-exp-need-2w",
    "form-exp-need-1m",
  ];

  // 10) Необычные расходы
  const thirdCharIds = ["form-exp-thirdchar"];
  const changeCharIds = ["form-exp-changechar"];
  const refuseIds = ["form-exp-refuse"];
  const transferIds = ["form-exp-transfer"];

  // 11) Маска/бонусы/спасительный билет
  const finalExpIds = [
    "form-exp-mask",
    "form-exp-bonus1d1",
    "form-exp-bonus2d1",
    "form-exp-bonus1w1",
    "form-exp-bonus2w1",
    "form-exp-bonus1m1",
    "form-exp-bonus2m1",
    "form-exp-bonus1m3",
    "form-exp-bonus2m3",
    "form-exp-clean",
  ];

  // 12) Оформление
  const giftLikeIds = [
    "form-icon-custom",
    "form-icon-present",
    "form-badge-custom",
    "form-badge-present",
    "form-bg-custom",
    "form-bg-present",
    "form-gift-custom",
    "form-gift-present",
  ];

  // 13) Корректировки
  const priceAdjustmentIds = ["price-adjustment"];

  // 14) Примененные купоны
  const personalCoupons = ["personal-coupon"];

  // 15) Автоматические скидки
  const giftDiscountIds = ["gift-discount"];

  // Итоговый порядок
  const wantedOrder = [
    ...earliestIds,
    ...topupAmsIds,
    ...firstPostIds,
    ...postIds,
    ...flyerIds,
    ...firstIds,
    ...incomeIds,
    ...bannerIds,
    ...expIds,
    ...thirdCharIds,
    ...changeCharIds,
    ...refuseIds,
    ...transferIds,
    ...finalExpIds,
    ...giftLikeIds,
    ...priceAdjustmentIds,
    ...personalCoupons,
    ...giftDiscountIds,
  ];

  // Карта порядка
  const orderIndex = new Map();
  for (let i = 0; i < wantedOrder.length; i++) {
    if (!orderIndex.has(wantedOrder[i])) orderIndex.set(wantedOrder[i], i);
  }

  // ---- форматтеры ----
  const formatBlock = (title, amountLike, innerLines) => {
    const inside = innerLines.length ? innerLines.join("\n") : "";
    return `[b]— ${title}[/b] = ${amountLike}\n[quote]${inside}[/quote]`;
  };
  const formatSimple = (title, amountLike) => `[b]— ${title}[/b] = ${amountLike}`;
  const formatBlockNoAmount = (title, innerLines) => {
    const inside = innerLines.length ? innerLines.join("\n") : "";
    return `[b]— ${title}[/b]\n[quote]${inside}[/quote]`;
  };

  // ---- утилиты ----
  const pickArray = (raw) => {
    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };
  const nonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== "";

  // САМЫЕ-ПЕРВЫЕ: списки recipient_N, цена из item.price
  const entriesEarliestLines = (entries, price) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data;
      if (!obj || typeof obj !== "object") continue;
      const keys = Object.keys(obj).filter(k => k.startsWith("recipient_"));
      for (const key of keys) {
        const suf = key.split("_")[1];
        const rec = obj[`recipient_${suf}`];
        if (rec) { lines.push(`${idx}. ${BASE_URL}/profile.php?id=${rec} — ${price ?? ""}`); idx++; }
      }
    }
    return lines;
  };

  // СРАЗУ ПОСЛЕ earliestIds: topup/ams
  const entriesTopupAmsLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let globalIdx = 1;
    for (const e of entries) {
      const obj = e?.data;
      if (!obj || typeof obj !== "object") continue;
      const recipients = Object.keys(obj).filter(k => k.startsWith("recipient_"));
      recipients.forEach((key, i) => {
        const suf = key.split("_")[1];
        const rec = obj[`recipient_${suf}`];
        const amt = obj[`amount_${suf}`];
        const cmt = obj[`comment_${suf}`];
        if (!rec) return;

        let block = `${globalIdx}. ${BASE_URL}/profile.php?id=${rec} — ${amt ?? ""}\n`;
        const hasComment = nonEmpty(cmt);
        if (hasComment) block += `\n[b]Комментарий:[/b] ${String(cmt).trim()}\n`;
        const isLast = i === recipients.length - 1;
        if (!isLast && hasComment) block += `[hr]\n`;

        lines.push(block);
        globalIdx++;
      });
    }
    return lines;
  };

  // Посты
  const entriesPostsLines = (entries, which) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data || {};
      const raw = which === "personal"
        ? obj.personal_posts_json ?? obj.personalPostsJson
        : obj.plot_posts_json ?? obj.plotPostsJson;
      for (const it of pickArray(raw)) {
        const src = it?.src ?? "";
        const text = it?.text ?? "";
        const symbols = it?.symbols_num ?? "";
        lines.push(`${idx}. ${src} — ${symbols} символов`);
        idx++;
      }
    }
    return lines;
  };

  // Флаеры
  const entriesFlyerLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data || {};
      for (const it of pickArray(obj.flyer_links_json ?? obj.flyerLinksJson)) {
        const src = it?.src ?? "";
        const text = it?.text ?? "";
        lines.push(`${idx}. ${src}`);
        idx++;
      }
    }
    return lines;
  };

  // Income (общий случай)
  const entriesValuesLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e && e.data && typeof e.data === "object" ? e.data : null;
      if (!obj) continue;
      for (const key of Object.keys(obj)) { lines.push(`${idx}. ${obj[key]}`); idx++; }
    }
    return lines;
  };

  // Exp (количество)
  const entriesQuantityLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const q = e?.data?.quantity;
      if (q !== undefined && q !== null) lines.push(`[b]Количество[/b]: ${q}`);
    }
    return lines;
  };

  // Баннеры
  const entriesBannerLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const url = e?.data?.url;
      if (url) lines.push(`[b]Ссылка:[/b] ${url}`);
    }
    return lines;
  };

  // Первые (100*/month)
  const entriesFirstLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    const pickBySuffix = (obj, suffix) => {
      if (!obj) return undefined;
      const sfx = String(suffix).toLowerCase();
      for (const k of Object.keys(obj)) if (k.toLowerCase().endsWith(sfx)) return obj[k];
      return undefined;
    };
    for (const e of entries) {
      const obj = e && e.data && typeof e.data === "object" ? e.data : null;
      if (!obj) continue;
      const vOld = pickBySuffix(obj, "_old");
      const vNew = pickBySuffix(obj, "_new");
      const vRounded = pickBySuffix(obj, "_rounded");
      const vTimes = e?.multiplier;
      lines.push(
        `[b]Последнее обработанное значение:[/b] ${vOld ?? ""}`,
        `[b]Текущее значение:[/b] ${vNew ?? ""}`,
        `[b]Условно округленное значение:[/b] ${vRounded ?? ""}`,
        `[b]Сколько раз начисляем:[/b] ${vTimes ?? ""}`
      );
    }
    return lines;
  };

  // last groups
  const entriesThirdCharLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const d = e?.data; if (!d) continue;
      const arr = Array.isArray(d) ? d : [d];
      for (const it of arr) { const url = it?.url ?? ""; if (url) lines.push(`[b]Согласование:[/b] ${url}`); }
    }
    return lines;
  };

  const entriesChangeCharLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const d = e?.data; if (!d) continue;
      const arr = Array.isArray(d) ? d : [d];
      for (const it of arr) { const text = it?.text ?? ""; if (text !== "") lines.push(`[b]Новое имя профиля:[/b]\n[code]${text}[/code]`); }
    }
    return lines;
  };

  const entriesRefuseLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const d = e?.data; if (!d) continue;
      const arr = Array.isArray(d) ? d : [d];
      for (const it of arr) { const comment = it?.comment ?? ""; if (comment !== "") lines.push(`[b]Комментарий:[/b]\n${comment}`); }
    }
    return lines;
  };

  const entriesTransferLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data; if (!obj || typeof obj !== "object") continue;
      for (const key of Object.keys(obj)) {
        if (key.startsWith("recipient_")) {
          const suffix = key.split("_")[1];
          const rec = obj[`recipient_${suffix}`];
          const amt = obj[`amount_${suffix}`];
          if (rec) { lines.push(`${idx}. ${BASE_URL}/profile.php?id=${rec} — ${amt ?? ""}`); idx++; }
        }
      }
    }
    return lines;
  };

  const entriesFinalExpLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data; if (!obj || typeof obj !== "object") continue;
      const recipientKeys = Object.keys(obj).filter(k => k.startsWith("recipient_"));
      recipientKeys.forEach((key, i) => {
        const suffix = key.split("_")[1];
        const rec = obj[`recipient_${suffix}`];
        const qty = obj[`quantity_${suffix}`];
        const from = obj[`from_${suffix}`];
        const wish = obj[`wish_${suffix}`];
        const hasFrom = nonEmpty(from);
        const hasWish = nonEmpty(wish);
        if (!rec) return;
        let block = `${idx}. ${BASE_URL}/profile.php?id=${rec} — ${qty ?? ""}\n`;
        if (hasFrom || hasWish) {
          let commentText = "";
          if (hasFrom && hasWish) commentText = `${String(from).trim()}: ${String(wish).trim()}`;
          else if (hasFrom) commentText = String(from).trim();
          else if (hasWish) commentText = String(wish).trim();
          block += `\n[b]Комментарий:[/b]\n[code]${commentText}[/code]`;
        }
        const isLast = i === recipientKeys.length - 1;
        block += (!isLast && (hasFrom || hasWish)) ? `[hr]\n` : ``;
        lines.push(block);
        idx++;
      });
    }
    return lines;
  };

  const entriesGiftLikeLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data; if (!obj || typeof obj !== "object") continue;
      const recipientKeys = Object.keys(obj).filter(k => k.startsWith("recipient_"));
      recipientKeys.forEach((key, i) => {
        const suffix = key.split("_")[1];
        const rec = obj[`recipient_${suffix}`];
        const fromV = obj[`from_${suffix}`];
        const wishV = obj[`wish_${suffix}`];
        const dataV = obj[`gift_data_${suffix}`];
        const hasFrom = nonEmpty(fromV);
        const hasWish = nonEmpty(wishV);
        const hasData = nonEmpty(dataV);
        if (!rec) return;
        let block = `${idx}. ${BASE_URL}/profile.php?id=${rec}\n`;
        if (hasFrom || hasWish) {
          let commentText = "";
          if (hasFrom && hasWish) commentText = `${String(fromV).trim()}: ${String(wishV).trim()}`;
          else if (hasFrom) commentText = String(fromV).trim();
          else if (hasWish) commentText = String(wishV).trim();
          block += `\n[b]Комментарий:[/b]\n[code]${commentText}[/code]`;
        }
        if (hasData) block += `\n[b]Данные:[/b]\n${String(dataV)}\n`;
        const isLast = i === recipientKeys.length - 1;
        block += (!isLast && (hasFrom || hasWish || hasData)) ? `[hr]\n` : ``;
        lines.push(block);
        idx++;
      });
    }
    return lines;
  };

  const entriesPriceAdjustmentLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const d = e?.data; if (!d) { idx++; continue; }
      const pack = Array.isArray(d) ? d : [d];
      for (const item of pack) {
        const t = item?.adjustment_title ?? "";
        const aa = item?.adjustment_amount ?? "";
        lines.push(`${idx}. [b]${t}:[/b] -${aa}`);
      }
      idx++;
    }
    return lines;
  };

  const entriesPersonalCouponsLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const d = e?.data; if (!d) { idx++; continue; }
      const pack = Array.isArray(d) ? d : [d];
      for (const item of pack) {
        const t = item?.coupon_title ?? "";
        const da = item?.discount_amount ?? "";
        lines.push(`${idx}. [b]${t}:[/b] ${da}`);
      }
      idx++;
    }
    return lines;
  };

  const entriesGiftDiscountLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const d = e?.data; if (!d) { idx++; continue; }
      const pack = Array.isArray(d) ? d : [d];
      for (const item of pack) {
        const t = item?.discount_title ?? "";
        const da = item?.discount_amount ?? "";
        lines.push(`${idx}. [b]${t}:[/b] ${da}`);
      }
      idx++;
    }
    return lines;
  };

  // ---- фильтр и сортировка ----
  const items = data.fullData
    .filter((item) => orderIndex.has(item.form_id))
    .sort((a, b) => orderIndex.get(a.form_id) - orderIndex.get(b.form_id));

  // ---- группы/границы ----
  const incomeSet = new Set([
    ...earliestIds, ...topupAmsIds, ...firstPostIds, ...postIds,
    ...flyerIds, ...firstIds, ...incomeIds, ...bannerIds
  ]);

  // ВАЖНО: добавили giftLikeIds в расходы
  const expenseSet = new Set([
    ...expIds, ...thirdCharIds, ...changeCharIds, ...refuseIds,
    ...transferIds, ...finalExpIds, ...priceAdjustmentIds, ...giftLikeIds
  ]);

  const hideSet = new Set([
    ...finalExpIds, ...giftLikeIds, ...priceAdjustmentIds
  ]);

  const hasIncomeGroup = items.some(it => incomeSet.has(it.form_id));
  const firstExpenseIdx = items.findIndex(it => expenseSet.has(it.form_id));
  const hasExpenseGroup = firstExpenseIdx !== -1;

  let firstHideIdx = -1, lastHideIdx = -1;
  items.forEach((it, idx) => {
    if (hideSet.has(it.form_id)) {
      if (firstHideIdx === -1) firstHideIdx = idx;
      lastHideIdx = idx;
    }
  });
  const hasHideGroup = firstHideIdx !== -1;

  const blocks = [];
  if (hasIncomeGroup) blocks.push(`[quote][size=16][b][align=center]ДОХОДЫ[/align][/b][/size][/quote]`);

  items.forEach((item, idx) => {
    if (hasExpenseGroup && idx === firstExpenseIdx) {
      blocks.push(`[quote][size=16][b][align=center]РАСХОДЫ[/align][/b][/size][/quote]`);
    }
    if (hasHideGroup && idx === firstHideIdx) blocks.push(`[hide=99999999]`);

    const title = item?.title ?? "";
    const amountLike = item?.modalAmount ?? item?.amount ?? "";

    let rendered;
    if (earliestIds.includes(item.form_id)) {
      rendered = formatBlockNoAmount(title, entriesEarliestLines(item.entries, item.price));
    } else if (topupAmsIds.includes(item.form_id)) {
      rendered = formatBlockNoAmount(title, entriesTopupAmsLines(item.entries));
    } else if (firstPostIds.includes(item.form_id)) {
      rendered = formatSimple(title, amountLike);
    } else if (postIds.includes(item.form_id)) {
      const which = item.form_id === "form-income-personalpost" ? "personal" : "plot";
      rendered = formatBlock(title, amountLike, entriesPostsLines(item.entries, which));
    } else if (flyerIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesFlyerLines(item.entries));
    } else if (firstIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesFirstLines(item.entries));
    } else if (bannerIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesBannerLines(item.entries));
    } else if (expIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesQuantityLines(item.entries));
    } else if (thirdCharIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesThirdCharLines(item.entries));
    } else if (changeCharIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesChangeCharLines(item.entries));
    } else if (refuseIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesRefuseLines(item.entries));
    } else if (transferIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesTransferLines(item.entries));
    } else if (finalExpIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesFinalExpLines(item.entries));
    } else if (giftLikeIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesGiftLikeLines(item.entries));
    } else if (priceAdjustmentIds.includes(item.form_id)) {
      rendered = formatBlockNoAmount(title, entriesPriceAdjustmentLines(item.entries));
    } else if (personalCoupons.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesPersonalCouponsLines(item.entries));
    } else if (giftDiscountIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesGiftDiscountLines(item.entries));
    } else {
      rendered = formatBlock(title, amountLike, entriesValuesLines(item.entries));
    }

    blocks.push(rendered);
    if (hasHideGroup && idx === lastHideIdx) blocks.push(`[/hide]`);
  });

  let result = blocks.join("\n\n");

  if (typeof data.totalSum !== "undefined" && data.totalSum !== null && data.totalSum !== "") {
    const clr = Number(data.totalSum) < 0 ? "red" : "green";
    const sign = Number(data.totalSum) > 0 ? "+" : "";
    result += `\n\n[quote][size=16][align=center][b]ИТОГО:[/b] [color=${clr}]${sign}${data.totalSum}[/color][/align][/size][/quote]`;
  }

  if (
    data.environment.COMMENT_ID !== "" &&
    data.environment.COMMENT_ID !== null &&
    data.environment.COMMENT_ID !== "undefined" &&
    data.environment.COMMENT_ID !== undefined &&
    data.editLogs !== "" &&
    data.editLogs !== null &&
    data.editLogs !== "undefined" &&
    data.editLogs !== undefined
  ) {
    result += `\n\n[hide=9999999999][b]Комментарий администратора:[/b]\n${data.editLogs}[/hide]`;
  }

  return result;
}

// Функция кодирования JSON в короткий код (base64 + сжатие)
function encodeJSON(obj) {
  const json = JSON.stringify(obj);
  // Преобразуем в UTF-8 и сжимаем через встроенный TextEncoder + base64
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
  const base64 = btoa(binary);
  return base64;
}

// Функция декодирования обратно в JSON
function decodeJSON(code) {
  const binary = atob(code);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

// Ищет в живом DOM (по умолчанию — во всём документе)
function getBlockquoteTextAfterPersonalPost(
  root,
  label,
  mode = ''
) {
  // helper для блока "last_value"
  function extractLastValue(r = root) {
    const target = Array.from(r.querySelectorAll('strong'))
      .find(s => s.textContent.trim().startsWith('Условно округленное значение:'));
    if (!target) return null;

    const parts = [];
    // собираем текстовые/элементные узлы после <strong> до следующего <strong> в том же родителе
    for (let n = target.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType === Node.ELEMENT_NODE && n.tagName?.toLowerCase() === 'strong') break;
      if (n.nodeType === Node.TEXT_NODE) parts.push(n.nodeValue);
      else if (n.nodeType === Node.ELEMENT_NODE) parts.push(n.textContent);
    }
    const val = parts.join(' ').replace(/\s+/g, ' ').trim();
    return val || null;
  }

  // ищем <p>, внутри которого есть <strong> с нужным текстом
  const pWithLabel = Array.from(root.querySelectorAll('p > strong'))
    .map(s => s.closest('p'))
    .find(p => p && p.querySelector('strong')?.textContent?.includes(label));

  if (!pWithLabel) return null;

  // идём по соседям до следующего <p>, ищем первый blockquote
  let blockquote = null;
  for (let el = pWithLabel.nextElementSibling; el; el = el.nextElementSibling) {
    if (el.tagName?.toLowerCase() === 'p') break; // дошли до следующего параграфа — стоп
    const bq = el.matches?.('blockquote') ? el : el.querySelector?.('blockquote');
    if (bq) { blockquote = bq; break; }
  }

  if (!blockquote) return null;

  // режим "last_value" не зависит от "Каждый личный пост"
  if (mode === 'last_value') {
    return extractLastValue(blockquote);
  }

  // режимы возврата
  if (mode === 'link') {
    return Array.from(blockquote.querySelectorAll('a'))
      .map(a => a.getAttribute('href'))
      .filter(Boolean);
  }

  // режим по умолчанию — как было
  return blockquote.innerHTML.trim();
}


function getBlockquoteTextFromHtml(html, label, mode = '') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return getBlockquoteTextAfterPersonalPost(doc, label, mode);
}


window.formatBankText = formatBankText;
window.encodeJSON = encodeJSON;
window.decodeJSON = decodeJSON;
window.getBlockquoteTextAfterPersonalPost = getBlockquoteTextAfterPersonalPost;
window.getBlockquoteTextFromHtml = getBlockquoteTextFromHtml;

/* MODULE 9: bank/parent/fetch_design_items.js.js */
/**
 * Загружает фоны/иконки/плашки из комментариев форума.
 * Использует window.fetchHtml если доступна, иначе fallback на базовый fetch.
 * @param {number} topic_id - ID темы (viewtopic.php?id=<topic_id>)
 * @param {Array<number>} comment_ids - ID постов (#p<comment_id>-content)
 * @returns {Promise<Array<{id: string, icon: string}>>}
 */
async function fetchDesignItems(topic_id, comment_ids) {
  const topicUrl = `${location.origin.replace(/\/$/, '')}/viewtopic.php?id=${encodeURIComponent(String(topic_id))}`;

  const decodeEntities = s => {
    const d = document.createElement('div');
    d.innerHTML = String(s ?? '');
    return d.textContent || d.innerText || '';
  };

  // Используем window.fetchHtml если доступна (из helpers.js, уже с retry)
  // Fallback: используем fetchWithRetry если доступна, иначе обычный fetch
  const pageHtml = typeof window.fetchHtml === 'function'
    ? await window.fetchHtml(topicUrl)
    : await (async () => {
        const fetchFunc = typeof window.fetchWithRetry === 'function'
          ? window.fetchWithRetry
          : fetch;
        const res = await fetchFunc(topicUrl, { credentials: 'include' });
        return res.text();
      })();

  const doc = new DOMParser().parseFromString(pageHtml, 'text/html');

  const allResults = [];

  for (const comment_id of comment_ids) {
    const post = doc.querySelector(`#p${String(comment_id)}-content`);
    if (!post) {
      console.warn(`Не найден #p${comment_id}-content на ${topicUrl}`);
      continue;
    }

    const scripts = [...post.querySelectorAll('script[type="text/html"]')];
    if (!scripts.length) continue;

    const combined = scripts.map(s => s.textContent || s.innerHTML || '').join('\n');
    const decoded = decodeEntities(combined).replace(/\u00A0/g, ' ');
    const innerDoc = new DOMParser().parseFromString(decoded, 'text/html');

    // Выбираем только article.card БЕЗ класса hidden
    const result = [...innerDoc.querySelectorAll('#grid article.card:not(.hidden)')].map(card => {
      const id = FMV.normSpace(card.querySelector('.id')?.textContent || '');
      const icon = (card.querySelector('.content')?.innerHTML || '').replace(/\u00A0/g, ' ').trim();

      return { id, icon };
    });

    allResults.push(...result);
  }

  return allResults;
}

window.fetchDesignItems = fetchDesignItems;

/* MODULE 10: bank/parent/fetch_user_coupons.js */
const typeRank = { item: 0, fixed: 1 };
const rankType = t => (t in typeRank ? typeRank[t] : 2);

// Безопасное приведение value к числу (нечисловые → -Infinity, чтобы улетали в конец при убывании)
const toNumber = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : -Infinity;
};

// Приведение expiresAt к таймстемпу; невалидные/пустые → +Infinity (как «без срока» в конце)
const toTimeOrInf = v => {
  if (v === undefined || v === null || v === "") return Infinity;
  const t = (v instanceof Date) ? v.getTime() : Date.parse(v);
  return Number.isFinite(t) ? t : Infinity;
};

const comparator = (a, b) => {
  // 1) type: item → fixed → остальное
  let diff = rankType(a.type) - rankType(b.type);
  if (diff !== 0) return diff;

  // 2) value: по убыванию
  diff = toNumber(b.value) - toNumber(a.value);
  if (diff !== 0) return diff;

  // 3) expiresAt: присутствующие раньше отсутствующих; внутри — по возрастанию
  const ta = toTimeOrInf(a.expiresAt);
  const tb = toTimeOrInf(b.expiresAt);

  // Если у одного Infinity (нет срока), он идёт позже
  if (ta === Infinity && tb !== Infinity) return 1;
  if (tb === Infinity && ta !== Infinity) return -1;

  // Оба есть или оба Infinity → обычное сравнение
  diff = ta - tb;
  if (diff !== 0) return diff;

  return 0;
};

/**
 * Загружает персональные купоны пользователя с его профильной страницы.
 * Следует редиректам (main: usrK_skin) и валидирует даты истечения.
 *
 * @returns {Promise<Array<{system_id: string, type: string, form: string, value: number, title: string, html: string, expiresAt?: string}>>}
 */
async function fetchUserCoupons() {
  // Получаем ID пользователя
  const userId = window.UserID;
  if (!userId) {
    console.warn('[fetchUserCoupons] window.UserID не определён');
    return [];
  }

  // Используем window.fetchHtml если доступна (из helpers.js), иначе fetchWithRetry
  const fetchFunc = typeof window.fetchHtml === 'function'
    ? window.fetchHtml
    : async (url) => {
      const fetchWithRetry = window.fetchWithRetry || (async (u, init) => fetch(u, init));
      const res = await fetchWithRetry(url, { credentials: 'include' });
      return res.text();
    };

  // Функция для получения текущей даты в МСК (yyyy-mm-dd)
  const getTodayMoscow = () => {
    const now = new Date();
    const moscowOffset = 3 * 60; // UTC+3
    const localOffset = now.getTimezoneOffset(); // минуты от UTC
    const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60000);

    const year = moscowTime.getFullYear();
    const month = String(moscowTime.getMonth() + 1).padStart(2, '0');
    const day = String(moscowTime.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const today = getTodayMoscow();

  // Загружаем страницу пользователя
  let currentUrl = `${location.origin}/pages/usr${userId}_skin`;
  let pageHtml;

  try {
    pageHtml = await fetchFunc(currentUrl);
  } catch (error) {
    console.error(`[fetchUserCoupons] Ошибка загрузки ${currentUrl}:`, error);
    return [];
  }

  const doc = new DOMParser().parseFromString(pageHtml, 'text/html');
  const container = doc.querySelector('div.container');

  if (!container) {
    console.warn('[fetchUserCoupons] Не найден div.container');
    return [];
  }

  // Проверяем на ошибку "неверная ссылка"
  const errorText = 'Ссылка, по которой Вы пришли, неверная или устаревшая.';
  if (container.textContent.includes(errorText)) {
    console.log('[fetchUserCoupons] Страница не найдена (ошибка "неверная ссылка")');
    return [];
  }

  // Проверяем на редирект (<!-- main: usrK_skin -->)
  const commentNodes = Array.from(container.childNodes).filter(node => node.nodeType === Node.COMMENT_NODE);
  const mainComment = commentNodes.find(comment => comment.textContent.trim().startsWith('main: usr'));

  if (mainComment) {
    const match = mainComment.textContent.trim().match(/main:\s*usr(\d+)_skin/);
    if (match) {
      const redirectUserId = match[1];
      console.log(`[fetchUserCoupons] Редирект на usr${redirectUserId}_skin`);

      // Загружаем страницу редиректа
      const redirectUrl = `${location.origin}/pages/usr${redirectUserId}_skin`;
      try {
        pageHtml = await fetchFunc(redirectUrl);
      } catch (error) {
        console.error(`[fetchUserCoupons] Ошибка загрузки редиректа ${redirectUrl}:`, error);
        return [];
      }

      const redirectDoc = new DOMParser().parseFromString(pageHtml, 'text/html');
      const redirectContainer = redirectDoc.querySelector('div.container');

      if (!redirectContainer) {
        console.warn('[fetchUserCoupons] Не найден div.container после редиректа');
        return [];
      }

      // Проверяем снова на ошибку
      if (redirectContainer.textContent.includes(errorText)) {
        console.log('[fetchUserCoupons] Страница редиректа не найдена');
        return [];
      }

      // Используем новый документ для поиска купонов
      return extractCouponsFromDoc(redirectDoc, today);
    }
  }

  // Извлекаем купоны из исходного документа
  return extractCouponsFromDoc(doc, today);
}

/**
 * Извлекает купоны из DOM документа
 * @param {Document} doc - DOM документ
 * @param {string} today - Текущая дата в формате yyyy-mm-dd
 * @returns {Array<Object>} - Массив купонов
 */
function extractCouponsFromDoc(doc, today) {
  const couponSection = doc.querySelector('div._coupon');

  if (!couponSection) {
    console.log('[fetchUserCoupons] Не найден div._coupon');
    return [];
  }

  const items = couponSection.querySelectorAll('div.item[data-coupon-type]');
  const coupons = [];

  items.forEach(item => {
    const systemId = item.getAttribute('data-id') || '';
    const type = item.getAttribute('data-coupon-type') || '';
    const form = item.getAttribute('data-coupon-form') || '';
    const valueStr = item.getAttribute('data-coupon-value') || '0';
    const value = Number(valueStr);
    const title = item.getAttribute('data-coupon-title') || '';
    const expiresAt = item.getAttribute('data-expired-date'); // может быть null

    // Фильтрация по дате истечения
    if (expiresAt) {
      // Сравниваем даты как строки (yyyy-mm-dd формат позволяет это)
      if (expiresAt < today) {
        console.log(`[fetchUserCoupons] Пропущен купон "${title}" (истёк: ${expiresAt} < ${today})`);
        return; // Пропускаем истекший купон
      }
    }

    const html = item.outerHTML;

    const coupon = {
      system_id: systemId,
      type: type,
      form: form,
      value: value,
      title: title,
      html: html
    };

    // Добавляем expiresAt только если он указан
    if (expiresAt) {
      coupon.expiresAt = expiresAt;
    }

    coupons.push(coupon);
  });

  console.log(`[fetchUserCoupons] Загружено купонов: ${coupons.length}`);
  const update_data = coupons.sort(comparator);
  update_data.forEach((item, index) => {
    item.id = String(index + 1);
  });
  return update_data;
}

// Экспортируем в window
window.fetchUserCoupons = fetchUserCoupons;

/* MODULE 11: bank/parent/messages.js */
/* =============== базовые утилиты: delay + timeout + retry с логами =============== */
let preScrapeBarrier = Promise.resolve(true);
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function withTimeout(promise, ms, label = "request") {
  let to;
  const t = new Promise((_, rej) => { to = setTimeout(() => rej(new Error(`${label} timeout after ${ms} ms`)), ms); });
  try { return await Promise.race([promise, t]); }
  finally { clearTimeout(to); }
}

async function retry(fn, { retries = 3, baseDelay = 600, maxDelay = 6000, timeoutMs = 15000 } = {}, label = "request") {
  let lastErr;
  console.log(`🟦 [STEP] ${label} start`);
  for (let i = 0; i < retries; i++) {
    try {
      const res = await withTimeout(fn(), timeoutMs, label);
      console.log(`✅ [OK]   ${label} success (try ${i + 1}/${retries})`);
      return res;
    } catch (e) {
      lastErr = e;
      const isLast = i === retries - 1;
      if (isLast) {
        console.warn(`❌ [ERROR] ${label} failed after ${retries} tries:`, e?.message || e);
        break;
      }
      const jitter = 0.8 + Math.random() * 0.4;  // 0.8—1.2
      const backoff = Math.min(baseDelay * 2 ** i, maxDelay) * jitter;
      console.log(`⚠️  [RETRY] ${label} try ${i + 1} failed: ${e?.message || e}. Waiting ${Math.round(backoff)}ms before retry...`);
      await delay(backoff);
    }
  }
  throw lastErr;
}

/* =============== конфиг пауз (чтобы не казаться ботом) =============== */
// пауза между СКРЕЙПАМИ (запросами к сайту)
const SCRAPE_BASE_GAP_MS = 1000;
const SCRAPE_JITTER_MS = 800;
// пауза между ОТПРАВКАМИ в iframe
const SEND_BASE_GAP_MS = 900;
const SEND_JITTER_MS = 500;

function humanPause(base, jitter, reason = "pause") {
  const gap = base + Math.floor(Math.random() * jitter);
  console.log(`🟨 [WAIT] ${reason}: ${gap}ms`);
  return delay(gap);
}

/* =============== константы и словари =============== */
const IFRAME_ORIGIN = "https://forumscripts.ru";

const BankPrefix = {
  ads: "Реклама",
  bank: "Гринготтс"
};

const BankForums = {
  ads: window.FORUMS_IDS?.Ads || [0],
  bank: window.FORUMS_IDS?.Bank || [0],
  personal_posts: window.FORUMS_IDS?.PersonalPosts || [0],
  plot_posts: window.FORUMS_IDS?.PlotPosts || [0]
};

const BankLabel = {
  ads: "— Каждая рекламная листовка",
  banner_mayak: "— Баннер FMV в подписи на Маяке",
  banner_reno: "— Баннер FMV в подписи на Рено",
  first_post: "— Первый пост на профиле",
  message100: "— Каждые 100 сообщений",
  positive100: "— Каждые 100 позитива",
  reputation100: "— Каждые 100 репутации",
  month: "— Каждый игровой месяц",
  personal_posts: "— Каждый личный пост",
  plot_posts: "— Каждый сюжетный пост",
};

const BankPostMessagesType = {
  ads: "ADS_POSTS",
  backup_data: "BACKUP_DATA",
  banner_mayak: "BANNER_MAYAK_FLAG",
  banner_reno: "BANNER_RENO_FLAG",
  comment_info: "COMMENT_INFO",
  coupons: "PERSONAL_DISCOUNTS",
  first_post: "FIRST_POST_FLAG",
  first_post_missed: "FIRST_POST_MISSED_FLAG",
  skin: "SKIN",
  personal_posts: "PERSONAL_POSTS",
  plot_posts: "PLOT_POSTS",
  profile_info: "PROFILE_INFO",
  user_info: "USER_INFO",
  users_list: "USERS_LIST",
};

const BankSkinFieldID = window.SKIN?.LibraryFieldID || 0;

const BankSkinPostID = {
  Plashka: window.SKIN?.LibraryPlashkaPostID || [],
  Icon: window.SKIN?.LibraryIconPostID || [],
  Back: window.SKIN?.LibraryBackPostID || [],
  Gift: window.SKIN?.LibraryGiftPostID || []
}


/* =============== сервис: дата, готовность iframe =============== */
function getBankToday() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}

function waitForIframeReady(origin) {
  return new Promise((resolve) => {
    function onMsg(e) {
      if (e.origin !== origin) return;
      if (e.data?.type !== "IFRAME_READY") return;
      window.removeEventListener("message", onMsg);
      const w = e.source;
      w.postMessage({ type: "IFRAME_ACK" }, origin);
      console.log("✅ [IFRAME] ACK sent, iframe ready");
      resolve(w);
    }
    window.addEventListener("message", onMsg);
    console.log("🟦 [STEP] waiting for IFRAME_READY…");
  });
}

/* =============== очередь отправок (rate limit на postMessage) =============== */
const sendQueue = [];
let sending = false;

async function processQueue() {
  if (sending) return;
  sending = true;
  console.log(`🟦 [STEP] send queue started (items: ${sendQueue.length})`);
  try {
    while (sendQueue.length) {
      const task = sendQueue.shift();
      try {
        await task();
      } catch (e) {
        console.warn("❌ [ERROR] send task failed:", e?.message || e);
      }
      await humanPause(SEND_BASE_GAP_MS, SEND_JITTER_MS, "gap between sends");
    }
  } finally {
    sending = false;
    console.log("✅ [OK]   send queue drained");
  }
}

// добавляет задачу отправки произвольной работы, зависящей от iframe
function queueJob(iframeReadyP, jobFactory /* (iframeWindow) => Promise<void> */) {
  iframeReadyP.then((iframeWindow) => {
    sendQueue.push(async () => {
      const startedAt = Date.now();
      console.log("🟪 [QUEUE] job started");
      await jobFactory(iframeWindow);
      console.log(`🟩 [SENT]  job done in ${Date.now() - startedAt}ms`);
    });
    console.log(`🟪 [QUEUE] job enqueued (size: ${sendQueue.length})`);
    processQueue();
  }).catch(err => console.warn("queueJob skipped:", err?.message || err));
}

// добавляет задачу отправки простого сообщения
function queueMessage(iframeReadyP, buildMessage /* () => object */, label = "message") {
  queueJob(iframeReadyP, async (iframeWindow) => {
    const msg = buildMessage();
    if (msg) {
      iframeWindow.postMessage(msg, IFRAME_ORIGIN);
      console.log(`🟩 [SENT]  ${label}:`, msg.type || "(no type)");
    } else {
      console.log(`⚪ [SKIP]  ${label}: empty message`);
    }
  });
}

/* =============== отправка пост-списков (внутри очереди) =============== */
async function sendPosts(iframeWindow, { seedPosts, label, forums, type, is_ads = false, title_prefix = "" }) {
  try {
    // Проходимся по всем постам и собираем ссылки из каждого
    const allRawLinks = [];

    if (Array.isArray(seedPosts)) {
      for (const post of seedPosts) {
        const posts_html = (post && typeof post.html === "string") ? post.html : "";

        const rawLinks = posts_html
          ? getBlockquoteTextFromHtml(posts_html, label, 'link')
          : null;

        if (Array.isArray(rawLinks)) {
          allRawLinks.push(...rawLinks);
        } else if (typeof rawLinks === "string" && rawLinks.trim() !== "") {
          allRawLinks.push(rawLinks);
        }
      }
    }

    const used_posts_links = allRawLinks;

    const used_posts = used_posts_links
      .filter((link) => typeof link === "string" && link.includes("/viewtopic.php?"))
      .map((link) => link.split("/viewtopic.php?")[1]);

    console.log(`🟦 [STEP] scrape new posts for ${type} (filter used_posts: ${used_posts.length})`);
    const new_posts_raw = await retry(
      () => window.scrapePosts(window.UserLogin, forums, { last_src: used_posts, comments_only: true, title_prefix }),
      { retries: 4, baseDelay: 800, maxDelay: 8000, timeoutMs: 18000 },
      `scrapePosts(${type})`
    );

    const new_posts = Array.isArray(new_posts_raw)
      ? new_posts_raw.map((item) => ({
        src: `${SITE_URL}/viewtopic.php?${item.src}`,
        text: item.title,
        ...(is_ads ? {} : { symbols_num: item.symbols_num }),
      }))
      : [];

    iframeWindow.postMessage({ type, posts: new_posts }, IFRAME_ORIGIN);
    console.log(`🟩 [SENT]  ${type}: ${new_posts.length} item(s)`);
  } catch (e) {
    console.warn(`❌ [ERROR] sendPosts(${type}) failed after retries:`, e?.message || e);
  }
}

/* =============== получение нового актуального значения (внутри очереди) =============== */
async function getLastValue(default_value, { label, is_month = false }) {
  try {
    const seed = await retry(
      () => window.scrapePosts(window.UserLogin, BankForums.bank, {
        title_prefix: BankPrefix.bank,
        stopOnNthPost: 1,
        keywords: label.split(" ").join(" AND "),
      }),
      { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
      "scrapePosts(personal_seed)"
    );

    const _origScrapePosts = window.scrapePosts?.bind(window);
    if (typeof _origScrapePosts === "function") {
      window.scrapePosts = async (...args) => {
        await (window.preScrapeBarrier ?? preScrapeBarrier ?? Promise.resolve()); // ← гарантированная суммарная задержка до всех scrapePosts
        return _origScrapePosts(...args);  // ← дальше — как было, со всеми retry/timeout
      };
    }

    const first = Array.isArray(seed) ? seed[0] : null;
    const posts_html = (first && typeof first.html === "string") ? first.html : "";

    const rawLinks = posts_html
      ? getBlockquoteTextFromHtml(posts_html, label, 'last_value')
      : null;

    let last_value;

    if (rawLinks == null) {
      last_value = default_value;
    } else if (is_month == true) {
      last_value = rawLinks.trim().split("-").map(Number);
    } else {
      last_value = Number(rawLinks.trim());
    }

    console.log(`🟩 [FOUND] Новое значение ${label}: ${last_value}`);
    return last_value;
  } catch (e) {
    console.warn(`❌ [ERROR] getLastValue(${label}) failed after retries:`, e?.message || e);
    return null;
  }
}

/* =============== основной поток: СКРЕЙПЫ ПОСЛЕДОВАТЕЛЬНО + ОТПРАВКИ С ОЧЕРЕДЬЮ =============== */
document.addEventListener("DOMContentLoaded", () => {
  const headTitle = document.querySelector("head > title")?.textContent || "";
  if (!headTitle.startsWith("Гринготтс")) {
    return;
  }

  // === 15s барьер перед ЛЮБЫМ вызовом scrapePosts ===
  preScrapeBarrier = (async () => {
    // console.log("🟨 [WAIT] pre-scrape barrier: 5000ms");
    // await delay(5000);
    // console.log("🟢 [GO]   pre-scrape barrier passed");
    return true;
  })();
  window.preScrapeBarrier = preScrapeBarrier;

  const textArea = document.querySelector('textarea[name="req_message"]');
  const iframeReadyP = waitForIframeReady(IFRAME_ORIGIN);

  // Функция для редактирования комментариев из backup
  async function bankCommentEditFromBackup(user_id, ts, NEW_COMMENT_ID = 0, current_bank = 0, { NEW_IS_ADMIN_TO_EDIT = false } = {}) {
    console.log(`🟦 [BACKUP] bankCommentEditFromBackup called: user_id=${user_id}, ts=${ts}, comment_id=${NEW_COMMENT_ID}, current_bank=${current_bank}, NEW_IS_ADMIN_TO_EDIT=${NEW_IS_ADMIN_TO_EDIT}`);

    // Проверки для НЕ-админ редактирования
    if (!NEW_IS_ADMIN_TO_EDIT) {
      // 1. Проверка на NEW_COMMENT_ID = 0
      if (NEW_COMMENT_ID === 0) {
        console.error('❌ [BACKUP] NEW_COMMENT_ID = 0, редактирование невозможно');
        alert("Извините! Произошла ошибка. Пожалуйста, обратитесь в Приёмную.");
        return;
      }

      // 2. Проверка на наличие bank_ams_check или bank_ams_done
      const commentContent = document.querySelector(`#p${NEW_COMMENT_ID}-content`);
      if (commentContent) {
        const hasAmsCheck = commentContent.querySelector('bank_ams_check');
        const hasAmsDone = commentContent.querySelector('bank_ams_done');

        if (hasAmsCheck || hasAmsDone) {
          console.warn('⚠️ [BACKUP] Обнаружен bank_ams_check или bank_ams_done, редактирование запрещено');
          alert("Извините! Администратор уже начал обрабатывать Вашу запись в банке. Пожалуйста, обратитесь в Приёмную, если нужно будет внести изменения.");
          return;
        }
      } else {
        console.warn(`⚠️ [BACKUP] Элемент #p${NEW_COMMENT_ID}-content не найден`);
      }
    }

    const current_storage = await FMVbank.storageGet(user_id);
    console.log(`🟦 [BACKUP] current_storage:`, current_storage);

    const BACKUP_DATA = current_storage[ts];
    console.log(`🟦 [BACKUP] BACKUP_DATA for ts=${ts}:`, BACKUP_DATA);

    queueMessage(iframeReadyP, () => ({
      type: BankPostMessagesType.comment_info,
      NEW_COMMENT_TIMESTAMP: ts,
      NEW_COMMENT_ID,
      NEW_CURRENT_BANK: (Number(window.user_id) == 2) ? 99999999 : current_bank,
      NEW_IS_ADMIN_TO_EDIT
    }), "comment_info");
    queueMessage(iframeReadyP, () => ({
      type: BankPostMessagesType.backup_data,
      BACKUP_DATA
    }), "backup_data");

    // Скроллим страницу к div.post.topicpost
    const topicPost = document.querySelector("div.post.topicpost");
    if (topicPost) {
      topicPost.scrollIntoView({ behavior: "smooth", block: "start" });
      console.log("🟦 [BACKUP] Скролл к div.post.topicpost выполнен");
    } else {
      console.warn("⚠️ [BACKUP] div.post.topicpost не найден");
    }
  }

  // Экспортируем функцию в глобальную область видимости для использования в onclick
  window.bankCommentEditFromBackup = bankCommentEditFromBackup;

  // user_info — можно отправить сразу после готовности iframe (без данных)
  queueMessage(iframeReadyP, () => ({
    type: BankPostMessagesType.user_info,
    user_id: window.UserID,
    user_name: window.UserLogin,
    is_admin: window.UserID == 2
  }), "user_info");

  // Загрузка данных скинов и купонов (async)
  (async () => {
    try {
      const skin_data_plashka = await fetchDesignItems(BankSkinFieldID, BankSkinPostID.Plashka);
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between BankSkin Plashka");

      const skin_data_icon = await fetchDesignItems(BankSkinFieldID, BankSkinPostID.Icon);
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between BankSkin Icon");

      const skin_data_back = await fetchDesignItems(BankSkinFieldID, BankSkinPostID.Back);
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between BankSkin Back");

      const skin_data_gift = await fetchDesignItems(BankSkinFieldID, BankSkinPostID.Gift);
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between BankSkin Gift");

      console.log("skin!!!", skin_data_plashka,
        skin_data_icon,
        skin_data_back,
        skin_data_gift);

      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.skin,
        skin_data_plashka,
        skin_data_icon,
        skin_data_back,
        skin_data_gift
      }), "skin_data");

      const coupons_data = await fetchUserCoupons();

      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.coupons,
        coupons_data
      }), "coupons_data");

      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between Coupons");
    } catch (e) {
      console.warn("❌ [ERROR] Skin/Coupons loading failed:", e?.message || e);
    }
  })();

  // обработчик PURCHASE
  window.addEventListener("message", async (e) => {
    if (e.origin !== IFRAME_ORIGIN) return;
    if (!e.data || e.data.type !== "PURCHASE") return;

    console.log("🟦 [STEP] PURCHASE received");
    const encode = encodeJSON(e.data);
    const newText = formatBankText(e.data);
    const ts = e.data.timestamp;
    const current_storage = await FMVbank.storageGet(window.UserID);
    current_storage[ts] = e.data;
    const storage_set_flag = FMVbank.storageSet(current_storage, window.UserID);
    if (!storage_set_flag) { alert("Попробуйте нажать на кнопку еще раз."); } else {
      if (textArea) {
        textArea.value = `[FMVbank]${ts}[/FMVbank]${newText}`;
        const button = document.querySelector(
          'input[type="submit"].button.submit[name="submit"][value="Отправить"][accesskey="s"]'
        );
        if (button) {
          button.click();
          console.log("🟩 [SENT]  PURCHASE form submitted");
        } else {
          console.warn("❌ [ERROR] Submit button not found.");
        }
      }
    }
  });

  // обработчик EDIT_PURCHASE
  window.addEventListener("message", async (e) => {
    if (e.origin !== IFRAME_ORIGIN) return;
    if (!e.data || e.data.type !== "EDIT_PURCHASE") return;

    console.log("🟦 [STEP] EDIT_PURCHASE received");
    const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');
    const newText = formatBankText(e.data);
    const ts = e.data.timestamp;
    const comment_ts = e.data.comment_timestamp;
    const comment_id = e.data.comment_id;
    const comment_user_id = e.data.comment_user_id;
    const is_admin_to_edit = e.data.is_admin_to_edit || false;
    const admin_flag = (!is_admin_to_edit) ? "" : "[FMVbankAmsCheck]";

    // Открываем страницу редактирования в скрытом iframe
    console.log("🟦 [EDIT] Открываем страницу редактирования комментария:", comment_id);

    const editIframe = document.createElement('iframe');
    editIframe.style.display = 'none';
    editIframe.src = `${SITE_URL}/edit.php?id=${comment_id}`;
    document.body.appendChild(editIframe);

    // Ждём загрузки iframe и отправляем форму
    editIframe.onload = async function () {
      try {
        const iframeDoc = editIframe.contentDocument || editIframe.contentWindow.document;
        const iframeTextArea = iframeDoc.querySelector('textarea[name="req_message"]');
        const iframeSubmitButton = iframeDoc.querySelector(
          'input[type="submit"].button.submit[name="submit"][value="Отправить"][accesskey="s"]'
        );

        if (!iframeTextArea || !iframeSubmitButton) {
          console.warn("❌ [ERROR] Не найдена форма редактирования в iframe");
          editIframe.remove();
          return;
        }

        // Проверяем наличие [FMVbankAmsCheck] или [FMVbankAmsDone] если это НЕ админ-редактирование
        if (!is_admin_to_edit && (iframeTextArea.value.includes('[FMVbankAmsCheck]') || iframeTextArea.value.includes('[FMVbankAmsDone]'))) {
          console.warn("⚠️ [EDIT] Обнаружен [FMVbankAmsCheck] или FMVbankAmsDone, редактирование запрещено");
          editIframe.remove();
          alert("Извините! Администратор уже начал обрабатывать Вашу запись в банке. Пожалуйста, обратитесь в Приёмную, если нужно будет внести изменения.");
          return;
        }

        // Сохраняем данные в storage ПОСЛЕ проверки
        const current_storage = await FMVbank.storageGet(comment_user_id);
        current_storage[ts] = e.data;
        delete current_storage[comment_ts];
        const storage_set_flag = FMVbank.storageSet(current_storage, comment_user_id);

        if (!storage_set_flag) {
          editIframe.remove();
          alert("Попробуйте нажать на кнопку еще раз.");
          return;
        }

        // Вставляем текст
        iframeTextArea.value = `${admin_flag}[FMVbank]${ts}[/FMVbank]${newText}`;
        console.log("✅ [EDIT] Текст вставлен в форму редактирования");

        // Отслеживаем редирект после отправки
        let redirectUrl = null;
        const checkRedirect = () => {
          try {
            const currentUrl = editIframe.contentWindow.location.href;
            if (currentUrl.includes('/viewtopic.php?')) {
              redirectUrl = currentUrl;
              console.log("✅ [EDIT] Обнаружен редирект на:", redirectUrl);

              // Переходим в основном окне
              window.location.href = redirectUrl;

              // Удаляем iframe
              editIframe.remove();
            }
          } catch (err) {
            // Игнорируем CORS ошибки
          }
        };

        // Проверяем редирект каждые 500ms
        const redirectCheckInterval = setInterval(checkRedirect, 500);

        // Останавливаем проверку через 10 секунд
        setTimeout(() => {
          clearInterval(redirectCheckInterval);
          if (!redirectUrl) {
            console.warn("⚠️ [EDIT] Редирект не обнаружен за 10 секунд");
            editIframe.remove();
          }
        }, 10000);

        // Отправляем форму
        iframeSubmitButton.click();
        console.log("🟩 [SENT] EDIT_PURCHASE form submitted в iframe");

      } catch (error) {
        console.error("❌ [ERROR] Ошибка при работе с iframe:", error);
        editIframe.remove();
      }
    };

    // Обработка ошибки загрузки iframe
    editIframe.onerror = function () {
      console.error("❌ [ERROR] Не удалось загрузить страницу редактирования");
      editIframe.remove();
    };
  });

  // === ПОСЛЕДОВАТЕЛЬНАЯ ЛЕНТА СКРЕЙПОВ ===
  (async () => {
    try {
      // 1) USERS_LIST
      const BankUsersList = await retry(
        () => scrapeUsers(),
        { retries: 2, baseDelay: 700, maxDelay: 6000, timeoutMs: 15000 },
        "scrapeUsers"
      );
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.users_list,
        users_list: BankUsersList
      }), "users_list");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (users_list)");

      // 2) PROFILE_INFO
      const BankProfileInfo = await retry(
        () => fetchProfileInfo(),
        { retries: 4, baseDelay: 900, maxDelay: 9000, timeoutMs: 20000 },
        "fetchProfileInfo"
      );

      // последовательно (ретраи уже внутри getLastValue), плюс пауза между вызовами
      const msg100_old = await getLastValue(0, { label: BankLabel.message100 });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (msg100_old)");

      const rep100_old = await getLastValue(0, { label: BankLabel.reputation100 });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (rep100_old)");

      const pos100_old = await getLastValue(0, { label: BankLabel.positive100 });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (pos100_old)");

      const month_old = await getLastValue(BankProfileInfo.date, { label: BankLabel.month, is_month: true });

      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.profile_info,
        msg100_old,
        msg100_new: BankProfileInfo.messages,
        rep100_old,
        rep100_new: BankProfileInfo.respect,
        pos100_old,
        pos100_new: BankProfileInfo.positive,
        month_old,
        month_new: getBankToday(),
        money: BankProfileInfo.money
      }), "profile_info");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (pos100_old)");

      // 3) BANNER_MAYAK_FLAG
      const coms_banner_mayak = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: BankLabel.banner_mayak.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 800, maxDelay: 7000, timeoutMs: 15000 },
        "scrapePosts(banner_mayak)"
      );
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.banner_mayak,
        banner_mayak_flag: Array.isArray(coms_banner_mayak) ? coms_banner_mayak.length === 0 : true
      }), "banner_mayak_flag");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (banner_mayak)");

      // 4) BANNER_RENO_FLAG
      const coms_banner_reno = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: BankLabel.banner_reno.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 800, maxDelay: 7000, timeoutMs: 15000 },
        "scrapePosts(banner_reno)"
      );
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.banner_reno,
        banner_reno_flag: Array.isArray(coms_banner_reno) ? coms_banner_reno.length === 0 : true
      }), "banner_reno_flag");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (banner_reno)");

      // 5) ADS_POSTS (seed -> sendPosts)
      const ads_seed = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: BankLabel.ads.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(ads_seed)"
      );
      queueJob(iframeReadyP, async (iframeWindow) => {
        await sendPosts(iframeWindow, {
          seedPosts: ads_seed,
          label: BankLabel.ads,
          forums: BankForums.ads,
          type: BankPostMessagesType.ads,
          is_ads: true,
          title_prefix: BankPrefix.ads
        });
      });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (ads)");

      // 6) FIRST_POST_FLAG
      const first_post_coms = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: BankLabel.first_post.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 15000 },
        "scrapePosts(first_post)"
      );
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.first_post,
        first_post_flag: Array.isArray(first_post_coms) ? first_post_coms.length === 0 : true
      }), "first_post_flag");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (first_post)");

      // 7) PERSONAL_POSTS
      const personal_seed = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: BankLabel.personal_posts.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(personal_seed)"
      );
      queueJob(iframeReadyP, async (iframeWindow) => {
        await sendPosts(iframeWindow, {
          seedPosts: personal_seed,
          label: BankLabel.personal_posts,
          forums: BankForums.personal_posts,
          type: BankPostMessagesType.personal_posts,
          is_ads: false
        });
      });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (personal)");

      // 8) PLOT_POSTS
      const plot_seed = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnNthPost: 10,
          keywords: BankLabel.plot_posts.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(plot_seed)"
      );
      queueJob(iframeReadyP, async (iframeWindow) => {
        await sendPosts(iframeWindow, {
          seedPosts: plot_seed,
          label: BankLabel.plot_posts,
          forums: BankForums.plot_posts,
          type: BankPostMessagesType.plot_posts,
          is_ads: false
        });
      });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (plot)");

      // 9) FIRST_POST_MISSED_FLAG — после personal/plot
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.first_post_missed,
        first_post_missed_flag:
          (Array.isArray(personal_seed) && personal_seed.length > 0) ||
          (Array.isArray(plot_seed) && plot_seed.length > 0)
      }), "first_post_missed_flag");

      console.log("🏁 [DONE] sequential scrape+send flow finished");
    } catch (e) {
      console.warn("❌ [ERROR] Sequential scrape flow aborted:", e?.message || e);
    }
  })();
});
/* MODULE 12: utilities/text/profile_fields_as_html.js */
(function () {
  // === ПУБЛИЧНАЯ ФУНКЦИЯ ==========================================
  // Рендерит указанные доп. поля как HTML (по номерам)
  window.renderExtraFieldsAsHTML = function renderExtraFieldsAsHTML(fields) {    
    // не трогаем форму редактирования доп. полей
    if (/\/profile\.php\b/.test(location.pathname) && /section=fields/.test(location.search)) return;

    const suffixes = normalize(fields);
    if (!suffixes.length) return;

    const decodeEntities = (s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
    const looksLikeHtml  = (s) => /<([a-zA-Z!\/?][^>]*)>/.test(s);

    function removeExtraBreaks(container){
      // <br> прямо внутри <a class="modal-link">
      container.querySelectorAll('a.modal-link').forEach(a=>{
        a.querySelectorAll(':scope > br').forEach(br=>br.remove());
      });
      // <br> верхнего уровня в самом контейнере значения
      container.querySelectorAll(':scope > br').forEach(br=>br.remove());
    }

    function findTargets(n) {
      const set = new Set();
      const sels = [
        `.pa-fld${n}`,
        `[class~="pa-fld${n}"]`,
        `[class*="fld${n}"]`,
        `[id*="fld${n}"]`,
        `[data-fld="${n}"]`,
      ];
      sels.forEach(sel => document.querySelectorAll(sel).forEach(el => set.add(el)));

      const targets = [];
      [...set].forEach(box => {
        const inner = box.querySelector?.('.pa-value, .field-value, .value') || null;
        targets.push(inner || box);
      });

      return targets.filter(node => {
        if (!node) return false;
        const html = (node.innerHTML || '').trim();
        const txt  = (node.textContent || '').trim();
        return html || txt;
      });
    }

    function renderOne(n) {
      const nodes = findTargets(n);
      nodes.forEach(target => {
        if (!target || target.dataset.htmlRendered === '1') return;

        const htmlNow = (target.innerHTML || '').trim();
        const textNow = (target.textContent || '').trim();
        if (!htmlNow && !textNow) return;

        const alreadyHtml = looksLikeHtml(htmlNow) && !htmlNow.includes('&lt;') && !htmlNow.includes('&gt;');

        if (alreadyHtml) {
          removeExtraBreaks(target);
          target.dataset.htmlRendered = '1';
          return;
        }

        const decoded = decodeEntities(htmlNow || textNow);
        if (decoded !== htmlNow || looksLikeHtml(decoded)) {
          target.innerHTML = decoded;
          removeExtraBreaks(target);
          target.dataset.htmlRendered = '1';
        }
      });
    }

    // первичный прогон
    suffixes.forEach(renderOne);

    // если DOM подгружается — дорисуем, повторно не трогаем помеченные
    const mo = new MutationObserver(() => suffixes.forEach(renderOne));
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // ——— утилита нормализации входа
    function normalize(list) {
      const out = new Set();
      (Array.isArray(list) ? list : [list]).forEach(item => {
        const s = String(item).trim();
        if (/^\d+$/.test(s)) { out.add(s); return; }                                   // "5"
        const m1 = s.match(/(?:^|[-_])fld(\d+)$/i); if (m1){ out.add(m1[1]); return; } // "fld5"/"pa-fld5"
        const m2 = s.match(/^(\d+)\s*-\s*(\d+)$/);                                      // "5-8"
        if (m2) { const a=Math.min(+m2[1],+m2[2]), b=Math.max(+m2[1],+m2[2]); for(let i=a;i<=b;i++) out.add(String(i)); }
      });
      return [...out];
    }
  };

  // === АВТОЗАПУСК ОТ ГЛОБАЛЬНОГО МАССИВА ==========================
  // Если window.FIELDS_WITH_HTML существует и это непустой список — запускаем.
  // Если не существует — считаем пустым и ничего не делаем.
  const _raw = window.FIELDS_WITH_HTML;
  const _list =
    Array.isArray(_raw) ? _raw :
    (typeof _raw === 'string' && _raw.trim() ? [_raw.trim()] : []);

  if (_list.length) {
    window.renderExtraFieldsAsHTML(_list);
  }
})();
