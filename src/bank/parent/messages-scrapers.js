/* =============== MESSAGES SCRAPERS MODULE =============== */
(function() {
  'use strict';

  const SITE_URL = window.location.origin;

  /* =============== отправка пост-списков (внутри очереди) =============== */
  window.BankSendPosts = async function(iframeWindow, { seedPosts, label, forums, type, is_ads = false, title_prefix = "" }) {
    try {
      // Проходимся по всем постам и собираем ссылки из каждого
      const allRawLinks = [];

      if (Array.isArray(seedPosts)) {
        for (const post of seedPosts) {
          const posts_html = (post && typeof post.html === "string") ? post.html : "";

          const rawLinks = posts_html
            ? getBlockquoteTextFromHtml(posts_html, label, 'link')
            : null;

          if (Array.isArray(rawLinks)) {
            allRawLinks.push(...rawLinks);
          } else if (typeof rawLinks === "string" && rawLinks.trim() !== "") {
            allRawLinks.push(rawLinks);
          }
        }
      }

      const used_posts_links = allRawLinks;

      const used_posts = used_posts_links
        .filter((link) => typeof link === "string" && link.includes("/viewtopic.php?"))
        .map((link) => link.split("/viewtopic.php?")[1]);

      window.BankMessagesLog("🟦 [STEP] scrape new posts for " + type + " (filter used_posts: " + used_posts.length + ")");
      const new_posts_raw = await window.BankRetry(
        () => window.scrapePostsByAuthorTag(window.UserID, forums, { last_src: used_posts, comments_only: true, title_prefix }),
        { retries: 4, baseDelay: 800, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePostsByAuthorTag(" + type + ")"
      );

      const new_posts = Array.isArray(new_posts_raw)
        ? new_posts_raw.map((item) => ({
          src: SITE_URL + "/viewtopic.php?" + item.src,
          text: item.title,
          ...(is_ads ? {} : { symbols_num: item.symbols_num }),
        }))
        : [];

      iframeWindow.postMessage({ type: type, posts: new_posts }, window.BANK_IFRAME_ORIGIN);
      window.BankMessagesLog("🟩 [SENT]  " + type + ": " + new_posts.length + " item(s)");
    } catch (e) {
      window.BankMessagesWarn("❌ [ERROR] sendPosts(" + type + ") failed after retries:", e?.message || e);
    }
  };

  /* =============== получение нового актуального значения (внутри очереди) =============== */
  window.BankGetLastValue = async function(default_value, { label, is_month = false }) {
    try {
      const seed = await window.BankRetry(
        () => window.scrapePostsByAuthorTag(window.UserID, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: label.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePostsByAuthorTag(personal_seed)"
      );

      const _origScrapeFunc = window.scrapePostsByAuthorTag?.bind(window);
      if (typeof _origScrapeFunc === "function") {
        window.scrapePostsByAuthorTag = async (...args) => {
          await (window.preScrapeBarrier ?? window.BankPreScrapeBarrier ?? Promise.resolve());
          return _origScrapeFunc(...args);
        };
      }

      const first = Array.isArray(seed) ? seed[0] : null;
      const posts_html = (first && typeof first.html === "string") ? first.html : "";

      const rawLinks = posts_html
        ? getBlockquoteTextFromHtml(posts_html, label, 'last_value')
        : null;

      let last_value;

      if (rawLinks == null) {
        last_value = default_value;
      } else if (is_month == true) {
        last_value = rawLinks.trim().split("-").map(Number);
      } else {
        last_value = Number(rawLinks.trim());
      }

      window.BankMessagesLog("🟩 [FOUND] Новое значение " + label + ": " + last_value);
      return last_value;
    } catch (e) {
      window.BankMessagesWarn("❌ [ERROR] getLastValue(" + label + ") failed after retries:", e?.message || e);
      return null;
    }
  };

  if (window.BankMessagesLog) {
    window.BankMessagesLog("✅ [MODULE] messages-scrapers.js loaded");
  }
})();
