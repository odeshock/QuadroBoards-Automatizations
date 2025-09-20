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
  // Ожидается, что верхний код проекта задаёт window.EX_PROFILES_URL при необходимости.
  let exProfilesMap = null;
  let exProfilesPromise = null;

  async function loadExProfiles() {
    if (exProfilesMap) return exProfilesMap;
    if (exProfilesPromise) return exProfilesPromise;

    if (!window.EX_PROFILES_URL) { exProfilesMap = new Map(); return exProfilesMap; }

    exProfilesPromise = (async () => {
      const html = await fetchHtml(window.EX_PROFILES_URL);
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      const map  = new Map();
      for (const a of doc.querySelectorAll('a[href*="profile.php?id="]')) {
        const m = (a.getAttribute('href') || '').match(/profile\.php\?id=(\d+)/i);
        if (!m) continue;
        const id = String(Number(m[1]));
        const nm = (a.textContent || '').trim();
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
