// update_personal (1).js
// Делает точечный апдейт персональной страницы usr{ID}_chrono,
// используя collectChronoByUser и общий билдер FMV.buildChronoHtml.
// Плюс — массовое обновление поверх этого же вызова.
(function () {
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
   * @param {boolean} [opts.verify=false]  верифицировать чтением страницы после сохранения
   * @param {string} [opts.titlePrefix="Хронология"]  префикс заголовка в билдере
   * @returns {Promise<{id:string,status:string, page?:string}>}
   */
  FMV.updateChronoForUser = async function updateChronoForUser(userId, opts = {}) {
    const FMVeditPersonalPage = requireFn("FMVeditPersonalPage");
    const collectChronoByUser = requireFn("collectChronoByUser");
    const buildChronoHtml     = requireFn("FMV.buildChronoHtml");

    const VERIFY = !!opts.verify;
    const id = String(userId);
    const pageName = `usr${id}_chrono`;

    // Источник секций (не обязательно)
    const SECTIONS = Array.isArray(opts.sections) && opts.sections.length
      ? opts.sections
      : (Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
          ? window.CHRONO_CHECK.ForumInfo
          : undefined);

    // 1) Собираем хронологию по пользователям
    let byUser;
    try {
      byUser = await collectChronoByUser({ sections: SECTIONS });
    } catch (e) {
      return { id, status: `ошибка collectChronoByUser: ${e?.message || e}` };
    }
    console.log(byUser);

    // 2) Берём только нужного юзера
    const data = byUser?.[id];
    console.log(id, data);
    if (!data) {
      return { id, status: "нет данных (пользователь не найден в хроно-коллекции)" };
    }

    // 3) Строим HTML через общий билдер
    let html;
    try {
      html = buildChronoHtml(data, { titlePrefix: opts.titlePrefix || "Хронология" });
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

    // Нормализуем ответ
    const saved = normalizeSaveStatus(res);
    if (!VERIFY) return { id, status: saved, page: pageName };

    // 5) Верификация (опционально)
    try {
      const ok = await verifyPageContains(pageName, data?.name || "");
      return { id, status: ok ? `${saved} (подтверждено)` : `${saved} (не подтвердилось чтением)` , page: pageName };
    } catch (e) {
      return { id, status: `${saved} (ошибка верификации: ${e?.message || e})`, page: pageName };
    }
  };

  /** ============================
   *  Массовое обновление
   *  ============================ */
  /**
   * @param {Object} [opts]
   * @param {Array<string|number>} [opts.ids] — явный список id; если не задан, будет вызван FMV.fetchUsers()
   * @param {number} [opts.delayMs=200] — пауза между сохранениями
   * @param {boolean} [opts.verify=false]
   * @param {Array} [opts.sections]
   * @param {string} [opts.titlePrefix]
   * @returns {Promise<Array<{id:string,status:string,page?:string}>>}
   */
  FMV.runBulkChronoUpdate = async function runBulkChronoUpdate(opts = {}) {
    const delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : 200;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      const r = await FMV.updateChronoForUser(u.id, {
        sections: opts.sections,
        verify:   !!opts.verify,
        titlePrefix: opts.titlePrefix
      });
      results.push(r);
      if (delayMs) await sleep(delayMs);
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

  async function verifyPageContains(pageName, needle) {
    if (!needle) return false;
    const url = `/admin_pages.php?edit_page=${encodeURIComponent(pageName)}`;

    // Если у вас есть кастомный загрузчик CP1251:
    if (typeof window.fetchCP1251Doc === "function") {
      const doc = await window.fetchCP1251Doc(url);
      const ta = doc?.querySelector?.('#page-content,[name="content"]');
      const val = (ta && (ta.value || ta.textContent)) || doc?.body?.innerText || "";
      return String(val).includes(needle);
    }

    // Обычный fetch
    const html = await fetch(url, { credentials: "include" }).then(r => r.text());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ta = doc.querySelector('#page-content,[name="content"]');
    const val = (ta && (ta.value || ta.textContent)) || doc.body?.innerText || "";
    return String(val).includes(needle);
  }
})();
