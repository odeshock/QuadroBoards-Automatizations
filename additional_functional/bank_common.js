async function scrapeUsers() {
  const PATH = "/userlist.php?sort_by=registered";
  const MAX_PAGES = 1000;
  const DELAY_MS = 300;
  const CELL_SELECTOR = "td.tcl.username span.usersname";
  const LINK_SELECTOR = "a[href*='id=']";

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const extractId = href => {
    if (!href) return null;
    const m = href.match(/(?:[?&/])id=(\d+)/i);
    return m ? Number(m[1]) : null;
  };

  async function fetchUsers(page) {
    const url = `${PATH}&p=${page}`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const users = [];
    doc.querySelectorAll(CELL_SELECTOR).forEach(cell => {
      const a = cell.querySelector(LINK_SELECTOR);
      const name = (a?.textContent || "").trim();
      const id = extractId(a?.getAttribute("href") || "");
      if (name && Number.isFinite(id)) users.push({ name, id });
    });
    return users;
  }

  const seen = new Set();
  const result = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const users = await fetchUsers(page);
    const newUsers = users.filter(u => !seen.has(u.id));
    if (!newUsers.length) break;
    newUsers.forEach(u => { seen.add(u.id); result.push(u); });
    await sleep(DELAY_MS);
  }

  window.scrapedUsers = result;
  return result;
}

async function fetchProfileInfo(userId = window.UserID) {
  if (userId == null) throw new Error("UserID не задан (ни аргументом, ни в window.UserID)");

  const url = `/profile.php?id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  // утилиты
  const txt = (sel) =>
    (doc.querySelector(sel)?.textContent || "")
      .replace(/\u00A0/g, " ")  // NBSP -> space
      .trim();

  const firstSignedInt = (s) => {
    if (!s) return null;
    // поддержка "1 234", "1 234", "1.234", "+123", "-45"
    const norm = s.replace(/[^\d+-]/g, ""); // оставляем цифры и знак
    const m = norm.match(/^[+-]?\d+/);
    return m ? Number(m[0]) : null;
  };

  // дата "dd.mm.yyyy" -> [yyyy, mm, dd]
  const dateToArray = (s) => {
    const m = (s || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) return null;
    const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
    return [yyyy, mm, dd];
  };

  // сообщения: берём всё ДО первого " - ", затем число
  const parseMessages = (s) => {
    const head = (s || "").split(" - ")[0];
    return firstSignedInt(head);
  };

  // извлекаем поля
  const dateStr = txt("li#pa-register-date strong");
  const respectStr = txt("li#pa-respect strong");
  const positiveStr = txt("li#pa-positive strong");
  const messagesStr = txt("li#pa-posts strong");

  const profile = {
    id: Number(userId),
    date: dateToArray(dateStr),                 // [yyyy, mm, dd] или null
    respect: firstSignedInt(respectStr),        // число или null
    positive: firstSignedInt(positiveStr),      // число или null
    messages: parseMessages(messagesStr)        // число или null
  };

  return profile;
}
