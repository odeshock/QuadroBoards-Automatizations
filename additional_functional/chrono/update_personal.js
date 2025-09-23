// FMV.runBulkChronoUpdate — массовое обновление usr{ID}_chrono из collectChronoByUser
(function () {
  if (!window.FMV) window.FMV = {};

  const esc = s => String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");

  function buildHtml(data, fallbackName) {
    const title = esc(data?.name ?? fallbackName);
    const eps = Array.isArray(data?.episodes) ? data.episodes : [];
    if (!eps.length) return `<p><strong>${title}</strong></p><p>(нет эпизодов)</p>`;
    const items = eps.map(ep => {
      const ds = esc(ep?.dateStart || "");
      const de = esc(ep?.dateEnd || "");
      const range = (de && de !== ds) ? ` – ${de}` : "";
      return `<li>${ds}${range} — ${esc(ep?.title || "")}</li>`;
    }).join("");
    return `<p><strong>${title}</strong></p><ul>${items}</ul>`;
  }

  function getFromMap(byUser, id) {
    const k = String(id);
    return byUser?.[k]
        ?? null;
  }

  /**
   * @param {Object} [opts]
   * @param {number[]} [opts.ids]    ограничить списком ID; по умолчанию — все из /userlist.php
   * @param {number}   [opts.delayMs=200] задержка между пользователями
   * @param {boolean}  [opts.verify=false] перечитывать страницу и проверять textarea при неоднозначном статусе
   */
  FMV.runBulkChronoUpdate = async function runBulkChronoUpdate(opts = {}) {
    if (!window.FMV?.fetchUsers) throw new Error("FMV.fetchUsers не найден");
    if (typeof window.FMVeditPersonalPage !== "function") throw new Error("FMVeditPersonalPage не найден");
    if (typeof window.collectChronoByUser !== "function") throw new Error("collectChronoByUser не найден");

    const DELAY  = Number.isFinite(opts.delayMs) ? opts.delayMs : 200;
    const VERIFY = !!opts.verify;
    const sleep  = ms => new Promise(r => setTimeout(r, ms));

    // 1) sections — как в кнопке
    const SECTIONS =
      Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
        ? window.CHRONO_CHECK.ForumInfo
        : undefined;

    // 2) общая карта по всем пользователям
    const byUser = await window.collectChronoByUser({ sections: SECTIONS });

    // 3) список пользователей (с пагинацией внутри)
    const users = Array.isArray(opts.ids)
      ? opts.ids.map(String).map(id => ({ id }))
      : await FMV.fetchUsers();

    const results = [];

    for (const u of users) {
      const id = String(u.id);
      const pageName = `usr${id}_chrono`;

      const data = getFromMap(byUser, id);
      if (!data) {
        results.push({ id, status: "нет данных" });
        if (DELAY) await sleep(DELAY);
        continue;
      }

      const html = buildHtml(data, "user"+id);

      try {
        const res = await FMVeditPersonalPage(pageName, { content: html });

        if (res.status === "saved") {
          results.push({ id, status: "обновлено" });
        } else if (res.status === "forbidden") {
          results.push({ id, status: "нет доступа/устарело" });
        } else if (res.status === "notfound") {
          results.push({ id, status: "страница не найдена" });
        } else if (VERIFY) {
          // бэкап-проверка содержимого
          const url = `/admin_pages.php?edit_page=${encodeURIComponent(pageName)}`;
          const doc = (typeof fetchCP1251Doc === "function")
            ? await fetchCP1251Doc(url)
            : new DOMParser().parseFromString(await fetch(url, { credentials: "include" }).then(r=>r.text()), "text/html");
          const ta = doc.querySelector('#page-content,[name="content"]');
          const ok = !!ta && String(ta.value || "").includes(data?.name || "");
          results.push({ id, status: ok ? "обновлено (подтверждено)" : `ошибка: ${res.serverMessage || res.status}` });
        } else {
          results.push({ id, status: `ошибка: ${res.serverMessage || res.status}` });
        }
      } catch (e) {
        results.push({ id, status: `исключение: ${e.message}` });
      }

      if (DELAY) await sleep(DELAY);
    }

    try { console.table(results.map(r => ({ id: r.id, status: r.status }))); } catch {}
    return results;
  };
})();
