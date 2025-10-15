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
  MoneyTemplate: 10,
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
    'personal':['personal','black'], 
    'plot':['plot','black'], 
    'au':['au','black'],
  }, 
  EpisodeMapStat: { // отображение статусов форумов с эпизодами
    'on':['active','green'],
    'off':['closed','teal'],
    'archived':['archived','maroon'],
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
    const keywordsRaw   = String(keywords ?? "").trim();

    const buildSearchUrl = (p) => {
      // используем старый «совместимый» формат: forum=, show_as=topics
      const params = [
        ['action',   'search'],
        ['keywords', keywordsRaw ? encodeForSearch(keywordsRaw.trim()) : ''],
        ['author',   encodeForSearch(author.trim())],
        ['forums',    forumsParam],
        ['search_in','0'],
        ['sort_by',  '0'],
        ['sort_dir', 'DESC'],
        ['show_as',  'topics'],
        ['search',   encodeForSearch('Отправить')],
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
  * @returns {Promise<Array<{title:string,src:string,text:string,html:string,symbols_num:number,date_ts:number|null,date_iso:string|null}>>}
  */

  window.scrapePosts = async function scrapePosts(
    author,
    forums,
    {
      stopOnFirstNonEmpty = false,
      last_src = [],
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

    const hash = (s) => { let h=0; for (const c of s) { h=((h<<5)-h)+c.charCodeAt(0); h|=0; } return h; };
    const pageSignature = (items) => hash(items.join("\n"));

    const buildUrl = (p) => {
      console.log("[scrapePosts] keywords:", `${keywordsRaw}`);
      const params = [
        ['action',   'search'],
        ['keywords', keywordsRaw ? encodeForSearch(keywordsRaw.trim()) : ''],
        ['author',   encodeForSearch(author.trim())],
        ['forums',    forumsParam],
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
    // ----- извлечение одного поста -----
    const extractOne = (post) => {
      const span = post.querySelector("h3 > span");
      const a = span ? span.querySelectorAll("a") : [];

      // title в нижнем регистре для сопоставления
      const title = (a[1]?.textContent?.trim() || "").toLocaleLowerCase('ru');

      // ссылка на сам пост
      const rawHref = a[2] ? new URL(a[2].getAttribute("href"), location.href).href : "";
      const src     = rawHref ? toPidHashFormat(rawHref) : "";

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
        const doc   = (p === 1) ? doc1 : await getDoc(buildUrl(p));

        // СТОП 1: служебная страница "Информация / ничего не найдено"
        if (isNoResultsPage(doc)) return finalize(acc);

        const posts = extractPosts(doc); // уже отфильтрованные (prefix, comments_only)
        const raw   = extractRawSrcs(doc);           // «сырые» ссылки
        const sig   = pageSignature(raw);

        // СТОП 2: пустая страница по DOM (нет постов и «сырых» ссылок)
        if (!raw.length && !doc.querySelector('.post')) return finalize(acc);

        // СТОП 3: повтор предыдущей страницы (сервер вернул ту же)
        if (prevSig !== null && sig === prevSig) return finalize(acc);
        prevSig = sig;

        // (опционально) СТОП 4: повтор базовой страницы
        // if (p > 1 && sig === baseSig) return finalize(acc);

        for (const post of posts) {
          if (lastSrcKeys.size && lastSrcKeys.has(post.src)) {
            console.log(`[scrapePosts] найден last_src: ${post.src}, остановка`);
            return finalize(acc);
          }
          if (post.symbols_num > 0) {
            acc.push(post);
            if (acc.length >= maxResults) return finalize(acc);
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
      console.log(finalArr);
      try {
        console.table(finalArr.map(r => ({
          title: r.title,
          src: r.src,
          symbols_num: r.symbols_num,
          html: r.html,
          textPreview: r.text.slice(0,120).replace(/\s+/g," "),
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
  (function autoDetectToken(){
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
      throw new Error("[FMVbank] storageSet: ожидался объект JSON");
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

/* MODULE 8: bank/parent.js */
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

  // -1) САМЫЕ-ПЕРВЫЕ (без amount): списки получателей с ценой item.price
  const earliestIds = [
    "form-income-anketa",
    "form-income-akcion",
    "form-income-needchar",
    "form-income-episode-of",
    "form-income-post-of",
    "form-income-writer",
    "form-income-activist",
  ];

  // -0.5) сразу после earliestIds (без amount): пополнения/АМС
  const topupAmsIds = ["form-income-topup", "form-income-ams"];

  // 0) самые-первые: "первый пост" (без quote)
  const firstPostIds = ["form-income-firstpost"];

  // 1) посты
  const postIds = ["form-income-personalpost", "form-income-plotpost"];

  // 2) флаеры
  const flyerIds = ["form-income-flyer"];

  // 3) первые после постов/флаеров
  const firstIds = [
    "form-income-100msgs",
    "form-income-100pos",
    "form-income-100rep",
    "form-income-month",
  ];

  // 4) income (общий случай — нумерованный список значений data)
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

  // 5) баннеры
  const bannerIds = ["form-income-banner-mayak", "form-income-banner-reno"];

  // 6) exp (обычные — количество)
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

  // 7) самые последние (группы)
  const thirdCharIds  = ["form-exp-thirdchar"];
  const changeCharIds = ["form-exp-changechar"];
  const refuseIds     = ["form-exp-refuse"];
  const transferIds   = ["form-exp-transfer"];

  // 8) самые последние (финальные EXP)
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

  // 9) САМЫЕ-САМЫЕ ПОСЛЕДНИЕ: иконки/бейджи/фоны/подарки
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

  // 10) ПОЗДНЕЕ ВСЕХ: пересчёт цены
  const priceAdjustmentIds = ["price-adjustment"];

  // 11) САМОЕ-САМОЕ ПОСЛЕДНЕЕ: скидки на подарки (с amount в заголовке)
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
      if (q !== undefined && q!== null) lines.push(`[b]Количество[/b]: ${q}`);
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
        const rec  = obj[`recipient_${suffix}`];
        const qty  = obj[`quantity_${suffix}`];
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
        const rec   = obj[`recipient_${suffix}`];
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
        const t  = item?.adjustment_title ?? "";
        const aa = item?.adjustment_amount ?? "";
        lines.push(`${idx}. [b]${t}:[/b] -${aa}`);
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
        const t  = item?.discount_title ?? "";
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

  const hasIncomeGroup  = items.some(it => incomeSet.has(it.form_id));
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

  // режим "last_value" не зависит от "Каждый личный пост"
  if (mode === 'last_value') {
    return extractLastValue(root);
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

/* MODULE 9: bank/parent_messages.js */
/* =============== базовые утилиты: delay + timeout + retry с логами =============== */
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
const SCRAPE_BASE_GAP_MS = 1200;
const SCRAPE_JITTER_MS   = 800;
// пауза между ОТПРАВКАМИ в iframe
const SEND_BASE_GAP_MS   = 900;
const SEND_JITTER_MS     = 500;

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
  ads:  window.FORUMS_IDS?.Ads     || [0],
  bank: window.FORUMS_IDS?.Bank    || [0],
  personal_posts:  window.FORUMS_IDS?.PersonalPosts || [0],
  plot_posts:  window.FORUMS_IDS?.PlotPosts || [0]
};

const BankLabel = {
  ads:            "— Каждая рекламная листовка",
  banner_mayak:   "— Баннер FMV в подписи на Маяке",
  banner_reno:    "— Баннер FMV в подписи на Рено",
  first_post:     "— Первый пост на профиле",
  message100:     "— Каждые 100 сообщений",
  positive100:    "— Каждые 100 позитива",
  reputation100:  "— Каждые 100 репутации",
  month:          "— Каждый игровой месяц",
  personal_posts: "— Каждый личный пост",
  plot_posts:     "— Каждый сюжетный пост",
};

const BankPostMessagesType = {
  ads:               "ADS_POSTS",
  banner_mayak:      "BANNER_MAYAK_FLAG",
  banner_reno:       "BANNER_RENO_FLAG",
  first_post:        "FIRST_POST_FLAG",
  first_post_missed: "FIRST_POST_MISSED_FLAG",
  personal_posts:    "PERSONAL_POSTS",
  plot_posts:        "PLOT_POSTS",
  profile_info:      "PROFILE_INFO",
  user_info:         "USER_INFO",
  users_list:        "USERS_LIST",
};

// === 15s барьер перед ЛЮБЫМ вызовом scrapePosts ===
const preScrapeBarrier = (async () => {
  console.log("🟨 [WAIT] pre-scrape barrier: 15000ms");
  await delay(15000);
  console.log("🟢 [GO]   pre-scrape barrier passed");
  return true;
})();

const _origScrapePosts = window.scrapePosts?.bind(window);
if (typeof _origScrapePosts === "function") {
  window.scrapePosts = async (...args) => {
    await preScrapeBarrier;            // ← гарантированная суммарная задержка до всех scrapePosts
    return _origScrapePosts(...args);  // ← дальше — как было, со всеми retry/timeout
  };
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
    const first = Array.isArray(seedPosts) ? seedPosts[0] : null;
    const posts_html = (first && typeof first.html === "string") ? first.html : "";

    const rawLinks = posts_html
      ? getBlockquoteTextFromHtml(posts_html, label, 'link')
      : null;

    const used_posts_links = Array.isArray(rawLinks)
      ? rawLinks
      : (typeof rawLinks === "string" && rawLinks.trim() !== "" ? [rawLinks] : []);

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
async function getLastValue(default_value, {label, is_month = false }) {
  try {
    const seed = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnFirstNonEmpty: true,
          keywords: label.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(personal_seed)"
      );

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
  const textArea = document.querySelector('textarea[name="req_message"]');
  const iframeReadyP = waitForIframeReady(IFRAME_ORIGIN);

  // user_info — можно отправить сразу после готовности iframe (без данных)
  queueMessage(iframeReadyP, () => ({
    type: BankPostMessagesType.user_info,
    user_id: window.UserID,
    user_name: window.UserLogin,
    is_admin: window.UserID == 2
  }), "user_info");

  // обработчик PURCHASE
  window.addEventListener("message", async (e) => {
    if (e.origin !== IFRAME_ORIGIN) return;
    if (!e.data || e.data.type !== "PURCHASE") return;

    console.log("🟦 [STEP] PURCHASE received");
    const encode = encodeJSON(e.data);
    const newText = formatBankText(e.data);
    const ts = Date.now();
    const current_storage = await FMVbank.storageGet(window.UserID);
    current_storage[ts] = e.data;
    FMVbank.storageSet(current_storage, window.UserID);
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
      console.log(BankProfileInfo.date);

      // последовательно (ретраи уже внутри getLastValue), плюс пауза между вызовами
      const msg100_old = await getLastValue(0, { label: BankLabel.message100 });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (msg100_old)");

      const rep100_old = await getLastValue(0, { label: BankLabel.reputation100 });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (rep100_old)");

      const pos100_old = await getLastValue(0, { label: BankLabel.positive100 });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (pos100_old)");

      const month_old  = await getLastValue(BankProfileInfo.date, { label: BankLabel.month, is_month: true });
      console.log(month_old);

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
          stopOnFirstNonEmpty: true,
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
          stopOnFirstNonEmpty: true,
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
          stopOnFirstNonEmpty: true,
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
          stopOnFirstNonEmpty: true,
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
          stopOnFirstNonEmpty: true,
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
          stopOnFirstNonEmpty: true,
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

/* MODULE 10: utilities/text/profile_fields_as_html.js */
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
