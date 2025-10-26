// scrapePosts_legacy.js
// Старые версии функций scrapePosts и scrapeTopicFirstPostLinks
// Этот файл НЕ включается в бандлы, но сохранен для совместимости
// Используйте вместо них scrapePostsByAuthorTag из src/episodes/scrape_posts_by_author_tag.js

(function() {
  'use strict';

  const DEBUG = true; // false чтобы отключить все log()

  const log = DEBUG ? console.log.bind(console) : () => { };
  const warn = DEBUG ? console.warn.bind(console) : () => { };
  const table = DEBUG ? console.table.bind(console) : () => { };
  const groupCollapsed = DEBUG ? console.groupCollapsed.bind(console) : () => { };
  const groupEnd = DEBUG ? console.groupEnd.bind(console) : () => { };

  /* ---------- scrapeTopicFirstPostLinks - парсинг первых постов топиков ---------- */
  /**
   * Парсит ссылки на первые посты топиков автора
   * @param {string} author - Имя автора (обязательно)
   * @param {Array<string>} forums - Список ID форумов (обязательно)
   * @param {Object} [options]
   * @param {number} [options.maxPages=999]
   * @param {number} [options.delayMs=300]
   * @param {string}  [options.keywords=""] - Дополнительные ключевые слова для поиска
   * @returns {Promise<Array<string>>} список ссылок вида ...viewtopic.php?pid=K#pK
   */
  window.scrapeTopicFirstPostLinks = async function scrapeTopicFirstPostLinks(
    author,
    forums,
    { maxPages = 999, delayMs = 300, keywords = "" } = {}
  ) {
    if (!author) throw new Error("author обязателен");
    if (!Array.isArray(forums) || forums.length === 0) throw new Error("forums обязателен и должен быть массивом");

    const forumsParam = forums.join(",");
    const basePath = "/search.php";
    const targetAuthor = author;
    const keywordsRaw = String(keywords ?? "").trim();

    const buildSearchUrl = (p) => {
      // используем старый «совместимый» формат: forum=, show_as=topics
      const params = [
        ['action', 'search'],
        ['keywords', keywordsRaw ? encodeForSearch(keywordsRaw.trim()) : ''],
        ['author', encodeForSearch(author.trim())],
        ['forums', forumsParam],
        ['search_in', '0'],
        ['sort_by', '0'],
        ['sort_dir', 'DESC'],
        ['show_as', 'topics'],
        ['search', encodeForSearch('Отправить')],
        ['p', String(p)]
      ].filter(([_, v]) => v !== '');

      const query = params.map(([k, v]) => `${k}=${v}`).join('&');
      log("[scrapePosts] search params:", `?${query}`);
      return new URL(`${basePath}?${query}`, location.origin).toString();
    };

    async function getDoc(url) {
      if (window.FMV?.fetchDoc) return await window.FMV.fetchDoc(url);
      if (typeof fetchCP1251Doc === "function") return await fetchCP1251Doc(url);
      if (typeof fetchHtml === "function") {
        const html = await fetchHtml(url);
        return new DOMParser().parseFromString(html, "text/html");
      }
      const res = await fetch(url, { credentials: "include" });
      const html = await res.text();
      return new DOMParser().parseFromString(html, "text/html");
    }

    const hash = (s) => { let h = 0; for (const c of s) { h = ((h << 5) - h) + c.charCodeAt(0); h |= 0; } return h; };

    function getDirectChildAnchor(el) {
      for (const ch of el.children) if (ch.tagName === "A") return ch;
      return null;
    }

    function extractTopicPageLinks(doc) {
      const cons = [...doc.querySelectorAll(".tclcon")];
      const out = [];
      for (const con of cons) {
        let name = con.querySelector(".byuser-username")?.textContent?.trim();
        if (!name) {
          const tr = con.closest("tr");
          name = tr?.querySelector(".tcr .byuser-username")?.textContent?.trim() || "";
        }
        if (name !== targetAuthor) continue;

        const a = getDirectChildAnchor(con);
        const href = a?.getAttribute("href");
        if (!href) continue;

        out.push(new URL(href, location.href).href);
      }
      return out;
    }

    function normalizeToViewtopicIdHref(hrefAbs) {
      try {
        const u = new URL(hrefAbs, location.href);
        if ((u.pathname === "/viewtopic.php" || u.pathname.endsWith("/viewtopic.php")) && u.searchParams.has("id")) {
          const nu = new URL("/viewtopic.php", u.origin);
          nu.searchParams.set("id", u.searchParams.get("id"));
          return nu.href;
        }
        if (u.searchParams.has("id")) {
          const nu = new URL("/viewtopic.php", u.origin);
          nu.searchParams.set("id", u.searchParams.get("id"));
          return nu.href;
        }
        return u.href;
      } catch { return hrefAbs; }
    }

    function findFirstPostPermalink(doc, topicUrl) {
      let a = doc.querySelector(".post.topicpost a.permalink");
      if (a?.getAttribute("href")) return new URL(a.getAttribute("href"), topicUrl).href;

      a = doc.querySelector(".post.topicpost h3 a[href*='#p']");
      if (a?.getAttribute("href")) return new URL(a.getAttribute("href"), topicUrl).href;

      a = doc.querySelector(".post.topicpost a[href*='#p']");
      if (a?.getAttribute("href")) return new URL(a.getAttribute("href"), topicUrl).href;

      try {
        const topicId = new URL(topicUrl).searchParams.get("id");
        if (topicId) {
          for (const link of doc.querySelectorAll("a[href*='#p']")) {
            const abs = new URL(link.getAttribute("href"), topicUrl);
            if (abs.pathname.endsWith("/viewtopic.php") && abs.searchParams.get("id") === topicId) {
              return abs.href;
            }
          }
        }
      } catch { }
      return null;
    }

    const doc1 = await getDoc(buildSearchUrl(1));
    const links1 = extractTopicPageLinks(doc1);
    const topics = [...links1];
    await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));

    for (let p = 2; p <= maxPages; p++) {
      const doc = await getDoc(buildSearchUrl(p));
      const currentPageNum = Number(doc.querySelector('div.linkst div.pagelink strong')?.textContent || 1);
      if (currentPageNum === 1 && p !== 1) {
        // сервер снова выдал первую страницу — выходим из цикла
        break;
      }

      const links = extractTopicPageLinks(doc, keywords = keywords);
      if (!links.length) break;

      topics.push(...links);
      await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));
    }

    const uniqTopics = [...new Set(topics)];
    const firstPostLinks = [];

    for (const rawTopic of uniqTopics) {
      const topicUrl = normalizeToViewtopicIdHref(rawTopic);
      try {
        const doc = await getDoc(topicUrl);
        const perm = findFirstPostPermalink(doc, topicUrl);
        if (perm) {
          // -> формат pid=K#pK
          const m = perm.match(/#p(\d+)/);
          if (m) {
            const pid = m[1];
            const base = new URL(perm, topicUrl);
            const nu = new URL("/viewtopic.php", base.origin);
            nu.searchParams.set("pid", pid);
            firstPostLinks.push(`${nu.href}#p${pid}`);
          } else {
            firstPostLinks.push(perm);
          }
        }
      } catch { }
      await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));
    }

    window.__scrapedTopicFirstPosts = firstPostLinks;
    return firstPostLinks;
  };

  /* ---------- scrapePosts - парсинг постов автора ---------- */
  /**
   * Парсит посты автора из результатов поиска
   * @param {string} author - Имя автора (обязательно)
   * @param {Array<string>|string} forums - Список ID форумов (обязательно)
   * @param {Object} [options]
   * @param {number}  [options.stopOnNthPost] - Остановиться после N-го поста (undefined = собрать все до last_src)
   * @param {string}  [options.last_src=""] - Пост-граница; сам пост не обрабатываем
   * @param {string}  [options.title_prefix=""] - Начало названия поста для фильтрации
   * @param {number}  [options.maxPages=999]
   * @param {number}  [options.delayMs=300]
   * @param {string}  [options.keywords=""] - Дополнительные ключевые слова для поиска
   * @param {boolean} [options.comments_only=false] - Если true, исключаем первые посты топиков
  * @returns {Promise<Array<{title:string,src:string,text:string,html:string,symbols_num:number,date_ts:number|null,date_iso:string|null}>>}
  */

  window.scrapePosts = async function scrapePosts(
    author,
    forums,
    {
      stopOnNthPost,
      last_src = [],
      title_prefix = "",
      maxPages = 999,
      delayMs = 300,
      keywords = "",
      comments_only = false,
      min_symbols_num = -1
    } = {}
  ) {
    if (!author) throw new Error("author обязателен");
    if (!forums || (Array.isArray(forums) && forums.length === 0)) throw new Error("forums обязателен");

    const forumsParam = Array.isArray(forums) ? forums.join(",") : String(forums);
    const keywordsRaw = String(keywords ?? "").trim();
    const titlePrefixLC = String(title_prefix || "").trim().toLocaleLowerCase('ru');

    // Приводим last_src к массиву строк
    const lastSrcArr = Array.isArray(last_src) ? last_src : [last_src].filter(Boolean);
    const lastSrcKeys = new Set(lastSrcArr.map(toPidHashFormat));

    const basePath = "/search.php";

    // --- нормализация ссылки поста к ключу вида "pid=K#pK" (для сравнения/исключения)
    function toPidHashFormat(hrefAbs) {
      try {
        const u = new URL(hrefAbs, location.href);
        const mHash = u.hash && u.hash.match(/^#p(\d+)$/);
        if (mHash) {
          const pid = mHash[1];
          return `pid=${pid}#p${pid}`;
        }
        const pid = u.searchParams.get('pid');
        if (pid) return `pid=${pid}#p${pid}`;
        const p = u.searchParams.get('p');
        if (p) return `pid=${p}#p${p}`;
        return u.toString();
      } catch {
        return hrefAbs;
      }
    }

    // --- извлечь "сырые" src для сигнатуры (без фильтров)
    function extractRawSrcs(doc) {
      const out = [];
      for (const post of doc.querySelectorAll('.post')) {
        const span = post.querySelector('h3 > span');
        const a = span ? span.querySelectorAll('a') : [];
        const href = a[2]?.getAttribute('href');
        if (href) out.push(new URL(href, location.href).href);
      }
      return out;
    }

    const hash = (s) => { let h = 0; for (const c of s) { h = ((h << 5) - h) + c.charCodeAt(0); h |= 0; } return h; };
    const pageSignature = (items) => hash(items.join("\n"));

    const buildUrl = (p) => {
      log("[scrapePosts] keywords:", `${keywordsRaw}`);
      const params = [
        ['action', 'search'],
        ['keywords', keywordsRaw ? encodeForSearch(keywordsRaw.trim()) : ''],
        ['author', encodeForSearch(author.trim())],
        ['forums', forumsParam],
        ['search_in', '0'],
        ['sort_by', '0'],
        ['sort_dir', 'DESC'],
        ['show_as', 'posts'],
        ['search', encodeForSearch('Отправить')], // %CE%F2%EF%F0%E0%E2%E8%F2%FC
        ['p', String(p)]
      ].filter(([_, v]) => v !== '');

      const query = params.map(([k, v]) => `${k}=${v}`).join('&');
      log("[scrapePosts] search params:", `?${query}`);
      return new URL(`${basePath}?${query}`, location.origin).toString();
    };

    async function getDoc(url) {
      if (window.FMV?.fetchDoc) return await window.FMV.fetchDoc(url);
      if (typeof fetchCP1251Doc === "function") return await fetchCP1251Doc(url);
      if (typeof fetchHtml === "function") {
        const html = await fetchHtml(url);
        return new DOMParser().parseFromString(html, "text/html");
      }
      const res = await fetch(url, { credentials: "include" });
      const html = await res.text();
      return new DOMParser().parseFromString(html, "text/html");
    }

    // помощник: детект служебной страницы "Информация / ничего не найдено"
    function isNoResultsPage(doc) {
      const title = (doc.querySelector('title')?.textContent || '').trim();
      if (title === 'Информация') {
        const info = doc.querySelector('#pun-main .info .container');
        if (info && /ничего не найдено/i.test(info.textContent)) {
          return true;
        }
      }
      return false;
    }

    // ---------- HTML → чистый текст ----------
    const htmlToMultilineText = (html = "") => {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;

      // скрытые цитаты -> только blockquote
      tmp.querySelectorAll(".quote-box.hide-box").forEach(box => {
        const bq = box.querySelector("blockquote");
        if (bq) { const repl = document.createElement("div"); repl.innerHTML = bq.innerHTML; box.replaceWith(repl); }
      });
      // убрать шапки цитат
      tmp.querySelectorAll("cite").forEach(n => n.remove());
      // code-box -> только текст из <pre>
      tmp.querySelectorAll(".code-box").forEach(box => {
        const pre = box.querySelector("pre"); const codeText = pre ? pre.textContent : "";
        const repl = document.createElement("div"); repl.textContent = codeText || ""; box.replaceWith(repl);
      });
      // служебные/скрытые
      tmp.querySelectorAll(".custom_tag, .hidden_tag, characters, location, order").forEach(n => n.remove());
      // script type="text/html" -> парсим и соблюдаем <p>/<br>
      tmp.querySelectorAll('script[type="text/html"]').forEach(s => {
        const innerTmp = document.createElement("div"); innerTmp.innerHTML = s.textContent || "";
        innerTmp.querySelectorAll("p, br").forEach(el => el.insertAdjacentText("afterend", "\n"));
        let t = (innerTmp.textContent || "").replace(/\u00A0/g, " ").replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n");
        s.insertAdjacentText("beforebegin", t ? `\n${t}\n` : ""); s.remove();
      });
      // переносы для блочных
      const blockTags = ["ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "DL", "DT", "DD", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "UL", "BR"];
      tmp.querySelectorAll(blockTags.join(",")).forEach(el => { if (el.tagName === "BR") el.insertAdjacentText("beforebegin", "\n"); else el.insertAdjacentText("afterend", "\n"); });

      // нормализация
      let t = (tmp.textContent || "").replace(/\u00A0/g, " ");
      t = t.replace(/\[\/?indent\]/gi, "").replace(/\[\/?float(?:=[^\]]+)?\]/gi, "").replace(/\[DiceFM[^\]]*?\]/gi, "");
      t = t.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/ {2,}/g, " ").replace(/\n{2,}/g, "\n");

      const out = []; for (const raw of t.split("\n")) { const line = raw.trim(); if (line === "") { if (out.length && out[out.length - 1] !== "") out.push(""); } else out.push(line); }
      return out.join("\n").replace(/ {2,}/g, " ").replace(/\n{2,}/g, "\n").replace(/^\n+|\n+$/g, "").trim();
    };
    const expandBBHtmlToText = (html = "") => html.replace(/\[html\]([\s\S]*?)\[\/html\]/gi, (_, inner) => htmlToMultilineText(inner));

    // ----- извлечение одного поста -----
    // ----- извлечение одного поста -----
    const extractOne = (post) => {
      const span = post.querySelector("h3 > span");
      const a = span ? span.querySelectorAll("a") : [];

      // title в нижнем регистре для сопоставления
      const title = (a[1]?.textContent?.trim() || "").toLocaleLowerCase('ru');

      // ссылка на сам пост
      const rawHref = a[2] ? new URL(a[2].getAttribute("href"), location.href).href : "";
      const src = rawHref ? toPidHashFormat(rawHref) : "";

      // текст из ссылки — это дата в читаемом виде
      const date_text = a[2]?.innerText?.trim() || "";

      // --- дата из атрибута data-posted (всегда в секундах)
      const postedRaw = post.getAttribute("data-posted");
      const date_ts = Number(postedRaw);

      // --- контент поста
      const contentEl = post.querySelector(".post-content");
      let html = contentEl?.innerHTML?.trim() || "";
      const html_bb = expandBBHtmlToText(html);
      const text = htmlToMultilineText(html_bb);

      return {
        title,
        src,
        text,
        html,
        symbols_num: text.length,
        date_ts,
        date_text,
      };
    };


    // ----- фильтрация по title_prefix -----
    const titleMatchesPrefix = (t) => {
      if (!titlePrefixLC) return true;
      return t.startsWith(titlePrefixLC);
    };

    // предварительно соберём Set ссылок первых постов (для comments_only)
    let excludeFirstPosts = new Set();
    if (comments_only && typeof window.scrapeTopicFirstPostLinks === 'function') {
      try {
        const forumsArr = Array.isArray(forums) ? forums : [forums];
        const firstLinks = await window.scrapeTopicFirstPostLinks(author, forumsArr, { maxPages, delayMs });
        excludeFirstPosts = new Set(firstLinks.map(toPidHashFormat));
      } catch (e) {
        warn('[scrapePosts] cannot preload first-post links:', e);
      }
    }

    // ----- список постов с применением фильтров -----
    const extractPosts = (doc) => {
      const all = [...doc.querySelectorAll(".post")].map(extractOne);

      groupCollapsed(`[scrapePosts] Найдено ${all.length} постов на странице`);
      for (const p of all) {
        log("→", p.title, "| символов:", p.symbols_num, "| src:", p.src);
      }
      groupEnd();

      let list = all.filter(p => titleMatchesPrefix(p.title));

      groupCollapsed(`[scrapePosts] После фильтрации title_prefix='${title_prefix}' → ${list.length} постов`);
      for (const p of list) {
        log("✓", p.title, "| символов:", p.symbols_num, "| src:", p.src);
      }
      groupEnd();

      if (comments_only && excludeFirstPosts.size) {
        const before = list.length;
        list = list.filter(p => !excludeFirstPosts.has(p.src));
        log(`[scrapePosts] comments_only: исключено ${before - list.length} первых постов тем`);
      }

      return list;
    };



    const lastSrcKey = last_src ? toPidHashFormat(last_src) : "";

    async function collectUpTo(maxResults) {
      const acc = [];

      const doc1 = await getDoc(buildUrl(1));
      // СТОП 0: сразу выходим, если это «Информация / ничего не найдено»
      if (isNoResultsPage(doc1)) return finalize(acc);

      let prevSig = null;

      for (let p = 1; p <= maxPages; p++) {
        const doc = (p === 1) ? doc1 : await getDoc(buildUrl(p));

        // СТОП 1: служебная страница "Информация / ничего не найдено"
        if (isNoResultsPage(doc)) return finalize(acc);

        const posts = extractPosts(doc); // уже отфильтрованные (prefix, comments_only)
        const raw = extractRawSrcs(doc);           // «сырые» ссылки
        const sig = pageSignature(raw);

        // СТОП 2: пустая страница по DOM (нет постов и «сырых» ссылок)
        if (!raw.length && !doc.querySelector('.post')) return finalize(acc);

        // СТОП 3: повтор предыдущей страницы (сервер вернул ту же)
        if (prevSig !== null && sig === prevSig) return finalize(acc);
        prevSig = sig;

        // (опционально) СТОП 4: повтор базовой страницы
        // if (p > 1 && sig === baseSig) return finalize(acc);

        for (const post of posts) {
          // 1) сначала фильтрация по длине
          const passLen = post.symbols_num > min_symbols_num;
          if (!passLen) continue;

          // 2) только для прошедших проверяем last_src
          if (lastSrcKeys.size && lastSrcKeys.has(post.src)) {
            log(`[scrapePosts] найден last_src (после фильтра по длине): ${post.src}, остановка`);
            return finalize(acc);
          }

          // 3) копим результат
          acc.push(post);
          if (acc.length >= maxResults) return finalize(acc);
        }

        await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));
      }

      return finalize(acc);
    }


    // Определяем количество постов для сбора
    const wanted = (stopOnNthPost !== undefined && stopOnNthPost > 0) ? stopOnNthPost : Number.POSITIVE_INFINITY;
    return await collectUpTo(wanted);

    // ------ финализация: reverse + вывод ------
    function finalize(arr) {
      const finalArr = arr.slice().reverse();
      log(finalArr);
      try {
        table(finalArr.map(r => ({
          title: r.title,
          src: r.src,
          symbols_num: r.symbols_num,
          html: r.html,
          textPreview: r.text.slice(0, 120).replace(/\s+/g, " "),
          date: r.date_ts
        })));
      } catch { log(finalArr); }
      window.__scrapedPosts = finalArr;
      return finalArr;
    }
  };

})();
