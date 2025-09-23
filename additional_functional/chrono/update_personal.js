// Поместите это в свой скрипт или вставьте в консоль
async function updateAllChrono() {
  if (!window.FMV?.fetchUsers || !window.FMVeditPersonalPage || !window.collectChronoByUser) {
    throw new Error("Нужны FMV.fetchUsers, FMVeditPersonalPage и collectChronoByUser.");
  }

  const results = [];
  const users = await FMV.fetchUsers();
  console.log(`Найдено пользователей: ${users.length}`);

  for (const u of users) {
    const pageName = `usr${u.id}_chrono`;
    const adminUrl = `/admin_pages.php?edit_page=${pageName}`;

    try {
      const check = await fetch(adminUrl, { method: "GET", credentials: "include" });
      if (!check.ok) {
        results.push(`user${u.id} — страница недоступна (HTTP ${check.status})`);
        continue;
      }

      const chrono = await window.collectChronoByUser({});
      const userChrono = chrono[u.id];
      if (!userChrono) {
        results.push(`user${u.id} — данных нет`);
        continue;
      }

      const text = `[b]${userChrono.name}[/b]\n` + userChrono.episodes.map(ep =>
        `• ${ep.dateStart || ""}${ep.dateEnd && ep.dateEnd !== ep.dateStart ? " - " + ep.dateEnd : ""} — ${ep.title}`
      ).join("\n");

      const res = await FMVeditPersonalPage(pageName, { content: text });

      if (res.status === "saved") {
        results.push(`user${u.id} — успешно обновлено`);
      } else if (res.status === "forbidden") {
        results.push(`user${u.id} — нет доступа`);
      } else if (res.status === "notfound") {
        results.push(`user${u.id} — форма не найдена`);
      } else {
        results.push(`user${u.id} — ошибка: ${res.serverMessage || res.status}`);
      }

    } catch (e) {
      results.push(`user${u.id} — исключение: ${e.message}`);
    }
  }

  console.table(results.map(r => {
    const m = /^user(\d+)\s+—\s+(.*)$/.exec(r);
    return m ? { id: m[1], статус: m[2] } : { id: "?", статус: r };
  }));

  return results;
}
