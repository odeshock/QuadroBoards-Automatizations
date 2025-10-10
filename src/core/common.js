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

    // Нормализация пробелов (аналог FMV.normSpace)
    const normSpace = str => String(str || '')
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .trim();

    const sleep = ms => new Promise(r => setTimeout(r, ms));

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
        const name = normSpace(a?.textContent || "");
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
        await sleep(300);
      }
    }

    // Сортировка по имени (locale-aware)
    result.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));

    // Сохраняем в кэш
    writeCache(result);
    window.scrapedUsers = result;

    return result;
  };

})();
