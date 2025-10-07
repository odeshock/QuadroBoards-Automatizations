async function scrapeUsers() {
  const PATH = "/userlist.php?sort_by=registered";
  const MAX_PAGES = 1000;
  const DELAY_MS = 300;
  const CELL_SELECTOR = ".tcl.username";
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
