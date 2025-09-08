<script>
(function () {
  const LOG = (...a) => console.log("[bank-link]", ...a);
  const ERR = (...a) => console.error("[bank-link]", ...a);

  // 0) страховка: ловим ошибки
  window.addEventListener("error", e => ERR("JS error:", e.message, e.filename+":"+e.lineno));

  // 1) запускаемся строго на страницах profile.php
  if (!/\/profile\.php\b/i.test(location.pathname)) {
    LOG("не профиль, выходим:", location.pathname);
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    try { main(); } catch (e) { ERR("fatal in main:", e); }
  });

  async function main() {
    LOG("boot");

    // 2) вставляем строку в правую колонку профиля
    const right = document.querySelector("#viewprofile #profile-right");
    if (!right) { ERR("не найден контейнер #viewprofile #profile-right"); return; }

    const li = document.createElement("li");
    li.id = "pa-bank-link";
    li.innerHTML = `
      <span>Последний пост в «банк» (разделы 8/19):</span>
      <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty" title="идёт поиск">ищу…</a></strong>
    `;
    right.prepend(li);

    const a = li.querySelector("a");
    addEmptyStyleOnce();

    // 3) определяем ник
    const user = resolveUserName();
    LOG("определили имя пользователя:", user || "(пусто)");
    if (!user) return setEmpty(a, "не удалось определить ник");

    // 4) собираем URL поиска (через имя, только форумы 8 и 19)
    const url = `/search.php?action=search&keywords=&author=${encodeURIComponent(user)}&forum=8,19&search_in=1&sort_by=0&sort_dir=DESC&show_as=posts`;
    LOG("формируем запрос:", url);

    // 5) тянем HTML с таймаутом
    let html;
    try {
      html = await fetchWithTimeout(url, { credentials: "same-origin" }, 8000);
    } catch (e) {
      ERR("fetch fail:", e);
      return setEmpty(a, "ошибка загрузки поиска");
    }
    LOG("получен ответ, длина:", html.length);

    // 6) проверки доступа/пустоты
    if (isAccessDenied(html))        return setEmpty(a, "доступ к поиску закрыт");
    if (isEmptySearch(html))         return setEmpty(a, "поиск ничего не нашёл");

    // 7) парсим и ищем первый пост в теме «банк»
    const href = findFirstBankPostLink(html, "банк");
    if (href) {
      setLink(a, href);
      LOG("готово →", href);
    } else {
      setEmpty(a, "нет постов в теме «банк»");
    }
  }

  // ===== helpers =====

  function addEmptyStyleOnce() {
    if (document.getElementById("bank-link-empty-style")) return;
    const st = document.createElement("style");
    st.id = "bank-link-empty-style";
    st.textContent = `
      #pa-bank-link a.is-empty{
        color:#999!important;text-decoration:none!important;
        pointer-events:none;cursor:default;opacity:.8;
      }`;
    (document.head || document.documentElement).appendChild(st);
  }

  function resolveUserName() {
    // приоритет: <li id="profile-name"><strong>Ник</strong></li>
    const a = document.querySelector("#profile-name > strong");
    if (a && a.textContent.trim()) { LOG("ник из #profile-name"); return a.textContent.trim(); }

    const tryText = sel => (document.querySelector(sel)?.textContent || "").trim();
    const candidates = [
      tryText("#viewprofile h1 span"),
      tryText("#viewprofile h1"),
      tryText("#viewprofile #profile-right .pa-author strong"),
      tryText("#viewprofile #profile-left .pa-author strong"),
      (document.title || "").trim()
    ].map(s => s.replace(/^Профиль:\s*/i, "").replace(/[«»]/g,"").trim()).filter(Boolean);

    if (candidates.length) {
      LOG("ник из DOM:", candidates[0]);
      return candidates[0];
    }
    return null;
  }

  async function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("timeout"), ms);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("HTTP "+res.status);
    return res.text();
  }

  function isAccessDenied(html) {
    const s = html.toLowerCase();
    const hit = s.includes('id="pun-login"') || s.includes("недостаточно прав") ||
                s.includes("вы не авторизованы") || s.includes("нет доступа");
    if (hit) LOG("детектирован признак закрытого доступа");
    return hit;
  }
  function isEmptySearch(html) {
    const s = html.toLowerCase();
    const none = s.includes("по вашему запросу ничего не найдено");
    const hasPosts = /<div[^>]+class="post\b/i.test(html);
    const res = none || !hasPosts;
    if (res) LOG("детектирован пустой результат поиска");
    return res;
  }

  function findFirstBankPostLink(html, topicTitle) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const posts = doc.querySelectorAll("div.post");
    const tt = topicTitle.toLowerCase();

    for (const p of posts) {
      // в заголовке h3 обычно идут: раздел → тема → дата; берём ссылку на тему (последнюю из id=)
      const topicLinks = p.querySelectorAll("h3 a[href*='viewtopic.php?id=']");
      const topic = topicLinks[topicLinks.length - 1];
      if (!topic) continue;
      if ((topic.textContent || "").trim().toLowerCase() !== tt) continue;

      const msg = p.querySelector(".post-links a[href*='viewtopic.php?pid=']");
      if (msg && msg.getAttribute("href")) return msg.getAttribute("href");
    }
    return null;
  }

  function setEmpty(a, reason) {
    const text = "либо войдите как игрок, либо ещё ничего не писал";
    a.classList.add("is-empty");
    a.setAttribute("href", "#");
    a.setAttribute("title", reason || text);
    a.textContent = text;
    LOG("результат: пусто →", reason || text);
  }
  function setLink(a, href) {
    a.classList.remove("is-empty");
    a.setAttribute("href", href);
    a.setAttribute("title", "перейти к сообщению");
    a.textContent = "перейти к сообщению";
  }
})();
</script>
