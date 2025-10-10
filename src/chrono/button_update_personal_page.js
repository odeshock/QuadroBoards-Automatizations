// update_personal (1).js
// Делает точечный апдейт персональной страницы usr{ID}_chrono,
// используя collectChronoByUser и общий билдер FMV.buildChronoHtml.
// Плюс — массовое обновление поверх этого же вызова.

// === КНОПКА: массовое обновление персоналок (обёртка над runBulkChronoUpdate) ===
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ForumInfo'])) {
    console.warn('[button_update_personal_page] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID        = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID        = (window.CHRONO_CHECK.AmsForumID).map(String);
  const SECTIONS   = window.CHRONO_CHECK.ForumInfo;

  if (!window.FMV) window.FMV = {};

  /** ============================
   *  Валидации окружения
   *  ============================ */
  function requireFn(name) {
    const fn = getByPath(name);
    if (typeof fn !== "function") {
      throw new Error(`${name} не найден — подключите соответствующий скрипт`);
    }
    return fn;
  }
  function getByPath(path) {
    return path.split(".").reduce((o,k)=>o && o[k], window);
  }

  /** ============================
   *  Точечный апдейт одного пользователя
   *  ============================ */
  /**
  * @param {string|number} userId
  * @param {Object} [opts]
  * @param {Array}  [opts.sections]   список секций (если у вас есть CHRONO_CHECK.ForumInfo, можно оставить пустым)
  * @returns {Promise<{id:string,status:string, page?:string}>}
  */
  async function updateChronoForUser(userId, opts = {}) {
    const FMVeditPersonalPage = requireFn("FMVeditPersonalPage");
    const collectChronoByUser = requireFn("collectChronoByUser");
    const buildChronoHtml     = requireFn("FMV.buildChronoHtml");

    const id = String(userId);
    const pageName = `usr${id}_chrono`;

    // Источник секций (не обязательно)
    const sectionsArg = opts.sections;

    // 1) Собираем хронологию по пользователям
    let byUser;
    try {
      byUser = await collectChronoByUser({ sections: sectionsArg });
    } catch (e) {
      return { id, status: `ошибка collectChronoByUser: ${e?.message || e}` };
    }

    // 2) Берём только нужного юзера
    const data = byUser?.[id];
    if (!data) {
      return { id, status: "нет данных (пользователь не найден в хроно-коллекции)" };
    }

    // 3) Строим HTML через общий билдер
    let html;
    try {
      html = buildChronoHtml(data, { titlePrefix: "Хронология" });
    } catch (e) {
      return { id, status: `ошибка buildChronoHtml: ${e?.message || e}` };
    }

    // 4) Сохраняем личную страницу
    let res;
    try {
      res = await FMVeditPersonalPage(pageName, { content: html });
    } catch (e) {
      return { id, status: `ошибка сохранения: ${e?.message || e}` };
    }

    const saved = normalizeSaveStatus(res);
    return { id, status: saved, page: pageName };
  };

  /** ============================
   *  Массовое обновление
   *  ============================ */
  /**
  * @param {Object} [opts]
  * @param {Array<string|number>} [opts.ids] — явный список id; если не задан, будет вызван FMV.fetchUsers()
  * @param {number} [opts.delayMs=200] — пауза между сохранениями
  * @param {Array} [opts.sections]
  * @returns {Promise<Array<{id:string,status:string,page?:string}>>}
  */
  async function runBulkChronoUpdate(opts = {}) {
    const delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : 200;

    // Источник пользователей
    let users;
    if (Array.isArray(opts.ids) && opts.ids.length) {
      users = opts.ids.map(x => ({ id: String(x) }));
    } else {
      // Пробуем взять из FMV.fetchUsers()
      const fetchUsers = getByPath("FMV.fetchUsers");
      if (typeof fetchUsers !== "function") {
        throw new Error("Не заданы ids и отсутствует FMV.fetchUsers()");
      }
      const arr = await fetchUsers();
      users = Array.isArray(arr) ? arr : [];
    }

    const results = [];
    for (const u of users) {
      const r = await updateChronoForUser(u.id, {
        sections: opts.sections
      });
      results.push(r);
      if (delayMs) await FMV.sleep(delayMs);
    }
    try { console.table(results.map(x => ({ id: x.id, status: x.status }))); } catch {}
    return results;
  };

  /** ============================
   *  Вспомогательные
   *  ============================ */
  function normalizeSaveStatus(res) {
    // Набор типичных статусов, подстройтесь под ваш FMVeditPersonalPage.
    const s = (res && (res.status || res.result || res.ok)) ?? "unknown";
    if (s === true || s === "ok" || s === "saved" || s === "success") return "обновлено";
    if (s === "forbidden" || s === "noaccess") return "нет доступа";
    if (s === "notfound") return "страница не найдена";
    return String(s);
  }

  // Хелперы ссылок/экрановки — совместимы с другими кнопками
  if (typeof window.userLinkHtml !== 'function') {
    window.userLinkHtml = (id, name) =>
      `${FMV.escapeHtml(String(name || id))}`;
  }

  // Получаем карту имен для красивых ссылок
  async function getUserNameMap(explicitIds) {
    // 1) если есть FMV.fetchUsers(), возьмём оттуда
    const fetchUsers = (window.FMV && typeof FMV.fetchUsers === 'function') ? FMV.fetchUsers : null;
    let list = [];
    if (Array.isArray(explicitIds) && explicitIds.length) {
      list = explicitIds.map(x => ({ id: String(x) }));
    } else if (fetchUsers) {
      try {
        const arr = await fetchUsers();
        list = Array.isArray(arr) ? arr : [];
      } catch { /* no-op */ }
    }
    const map = new Map();
    for (const u of list) {
      if (!u) continue;
      const id = String(u.id ?? '');
      const nm = String(u.name ?? '').trim();
      if (id) map.set(id, nm || id);
    }
    return map;
  }

  function normalizeInfoStatus(status) {
    const s = String(status || '').toLowerCase();
    // маппим внутренние формулировки на требуемые пользователем
    if (s.includes('нет доступа')) return 'нет доступа';
    if (s.includes('нет данных') || s.includes('не найден')) return 'пользователь не упоминается в хронологии';
    return ''; // не интересует для "Показать детали"
  }

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    label: 'обновить личные страницы',
    order: 4,
    showStatus: true,
    showDetails: true,
    showLink: false,

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});

      setDetails('');
      try {
        // Этап 1: сбор подготовительных данных/сечений
        setStatus('Собираю…');

        const explicitIds = Array.isArray(window.CHRONO_CHECK?.UserIDs) ? window.CHRONO_CHECK.UserIDs : undefined;
        const nameMap = await getUserNameMap(explicitIds);

        // Этап 2: массовое обновление
        setStatus('Обновляю…');

        const results = await runBulkChronoUpdate({
          ids: explicitIds,
          sections: SECTIONS
        }); // вернёт [{ id, status, page? }] — см. реализацию в update_personal

        // Пост-обработка результатов
        const lines = [];
        for (const r of (results || [])) {
          const info = normalizeInfoStatus(r?.status);
          if (!info) continue; // нас интересуют только 2 типа
          const id = String(r?.id || '');
          const name = nameMap.get(id) || id;
          lines.push(`${userLinkHtml(id, name)} — ${FMV.escapeHtml(info)}`);
        }

        // Если сам вызов отработал — это «Готово», даже если были частичные "нет доступа"/"не упоминается"
        setStatus('Готово');
        setDetails(lines.length ? lines.join('\n') : ''); // пусто — если нет «проблемных» юзеров
      } catch (e) {
        setStatus('Ошибка');
        setDetails(e?.message || String(e));
      }
    }
  });
})();
