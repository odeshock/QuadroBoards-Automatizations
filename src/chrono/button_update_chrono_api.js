// button_update_chrono_api.js
// Сохраняет хронологию пользователей через FMVbank.storageSet с api_key_label = 'chrono_'
// Использует collectChronoByUser для сбора данных по всем пользователям.

// === КНОПКА: массовое сохранение хронологии в API ===
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ForumInfo'])) {
    console.warn('[button_update_chrono_api] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID = (window.CHRONO_CHECK.AmsForumID).map(String);
  const SECTIONS = window.CHRONO_CHECK.ForumInfo;

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
    return path.split(".").reduce((o, k) => o && o[k], window);
  }

  /** ============================
   *  Точечное сохранение данных одного пользователя через API
   *  ============================ */
  /**
  * @param {string|number} userId
  * @param {Object} data - данные хронологии для этого пользователя
  * @returns {Promise<{id:string,status:string}>}
  */
  async function saveChronoToApi(userId, data) {
    const FMVbankStorageSet = requireFn("FMVbank.storageSet");

    const id = String(userId);

    // Проверяем данные
    if (!data || typeof data !== 'object') {
      return { id, status: "нет данных для сохранения" };
    }

    // Сохраняем через FMVbank.storageSet с api_key_label = 'chrono_'
    let res;
    try {
      res = await FMVbankStorageSet(data, Number(id), 'chrono_');
    } catch (e) {
      return { id, status: `ошибка сохранения: ${e?.message || e}` };
    }

    const saved = normalizeSaveStatus(res);
    return { id, status: saved };
  };

  /** ============================
   *  Массовое обновление
   *  ============================ */
  /**
  * @param {Object} [opts]
  * @param {Array<string|number>} [opts.ids] — явный список id; если не задан, будет вызван FMV.fetchUsers()
  * @param {number} [opts.delayMs=200] — пауза между сохранениями
  * @param {Array} [opts.sections]
  * @returns {Promise<Array<{id:string,status:string}>>}
  */
  async function runBulkChronoApiUpdate(opts = {}) {
    const delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : 200;
    const collectChronoByUser = requireFn("collectChronoByUser");

    // Источник секций (не обязательно)
    const sectionsArg = opts.sections;

    // 1) Собираем хронологию по всем пользователям один раз
    let byUser;
    try {
      byUser = await collectChronoByUser({ sections: sectionsArg });
    } catch (e) {
      throw new Error(`Ошибка collectChronoByUser: ${e?.message || e}`);
    }

    if (!byUser || typeof byUser !== 'object') {
      throw new Error('collectChronoByUser вернул пустой результат');
    }

    // 2) Источник пользователей
    let users;
    if (Array.isArray(opts.ids) && opts.ids.length) {
      users = opts.ids.map(x => ({ id: String(x) }));
    } else {
      // Берём всех пользователей из собранных данных
      users = Object.keys(byUser).map(id => ({ id: String(id) }));
    }

    const results = [];
    for (const u of users) {
      const data = byUser[u.id];
      if (!data) {
        results.push({ id: u.id, status: "нет данных (пользователь не найден в хроно-коллекции)" });
        continue;
      }

      const r = await saveChronoToApi(u.id, data);
      results.push(r);
      if (delayMs) await FMV.sleep(delayMs);
    }
    try { console.table(results.map(x => ({ id: x.id, status: x.status }))); } catch { }
    return results;
  };

  /** ============================
   *  Вспомогательные
   *  ============================ */
  function normalizeSaveStatus(res) {
    // res от FMVbank.storageSet — это boolean
    if (res === true) return "сохранено";
    if (res === false) return "ошибка сохранения";
    return String(res);
  }

  // Хелперы ссылок/экрановки
  if (typeof window.userLinkHtml !== 'function') {
    window.userLinkHtml = (id, name) =>
      `${FMV.escapeHtml(String(name || id))}`;
  }

  // Получаем карту имен для красивых ссылок
  async function getUserNameMap(explicitIds) {
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
    if (s.includes('ошибка сохранения')) return 'ошибка сохранения';
    if (s.includes('нет данных') || s.includes('не найден')) return 'пользователь не упоминается в хронологии';
    return ''; // не интересует для "Показать детали"
  }

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    label: 'Сохранить хронологию в API',
    order: 5,
    showStatus: true,
    showDetails: true,
    showLink: false,

    async onClick(api) {
      const setStatus = api?.setStatus || (() => { });
      const setDetails = api?.setDetails || (() => { });

      setDetails('');
      try {
        // Этап 1: сбор подготовительных данных
        setStatus('Собираю…');

        const explicitIds = Array.isArray(window.CHRONO_CHECK?.UserIDs) ? window.CHRONO_CHECK.UserIDs : undefined;
        const nameMap = await getUserNameMap(explicitIds);

        // Этап 2: массовое сохранение в API
        setStatus('Сохраняю…');

        const results = await runBulkChronoApiUpdate({
          ids: explicitIds,
          sections: SECTIONS
        }); // вернёт [{ id, status }]

        // Пост-обработка результатов
        const lines = [];
        for (const r of (results || [])) {
          const info = normalizeInfoStatus(r?.status);
          if (!info) continue; // нас интересуют только проблемные
          const id = String(r?.id || '');
          const name = nameMap.get(id) || id;
          lines.push(`${userLinkHtml(id, name)} — ${FMV.escapeHtml(info)}`);
        }

        // Если сам вызов отработал — это «Готово»
        setStatus('Готово');
        setDetails(lines.length ? lines.join('\n') : ''); // пусто — если нет проблемных юзеров
      } catch (e) {
        setStatus('Ошибка');
        setDetails(e?.message || String(e));
      }
    }
  });
})();
