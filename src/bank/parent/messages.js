/* =============== основной поток: СКРЕЙПЫ ПОСЛЕДОВАТЕЛЬНО + ОТПРАВКИ С ОЧЕРЕДЬЮ =============== */
document.addEventListener("DOMContentLoaded", () => {
  const headTitle = document.querySelector("head > title")?.textContent || "";
  if (!headTitle.startsWith("Гринготтс")) {
    return;
  }

  // === 15s барьер перед ЛЮБЫМ вызовом scrapePostsByAuthorTag ===
  window.BankPreScrapeBarrier = (async () => {
    // window.BankMessagesLog("🟨 [WAIT] pre-scrape barrier: 5000ms");
    // await window.BankDelay(5000);
    // window.BankMessagesLog("🟢 [GO]   pre-scrape barrier passed");
    return true;
  })();
  window.preScrapeBarrier = window.BankPreScrapeBarrier;

  const textArea = document.querySelector('textarea[name="req_message"]');
  const iframeReadyP = window.BankWaitForIframeReady(window.BANK_IFRAME_ORIGIN);

  // user_info — можно отправить сразу после готовности iframe (без данных)
  window.BankQueueMessage(iframeReadyP, () => ({
    type: window.BankPostMessagesType.user_info,
    user_id: window.UserID,
    user_name: window.UserLogin,
    is_admin: window.UserID == 2
  }), "user_info");

  // Загрузка данных скинов из API (async)
  (async () => {
    try {
      // Загружаем библиотеку скинов из API (library_icon_1, library_plashka_1, и т.д.)
      const libraryItems = await fetchLibraryItems();

      window.BankMessagesLog("[SKIN from API]", libraryItems);

      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.skin,
        skin_data_plashka: libraryItems.plashka,
        skin_data_icon: libraryItems.icon,
        skin_data_back: libraryItems.back,
        skin_data_gift: libraryItems.gift
      }), "skin_data");
    } catch (e) {
      window.BankMessagesWarn("❌ [ERROR] Skin loading from API failed:", e?.message || e);
    }
  })();

  // Загрузка персональных купонов пользователя из info_<userId> (async)
  (async () => {
    try {
      const userCoupons = await fetchUserCoupons();

      window.BankMessagesLog("[COUPONS from info_]", userCoupons);

      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.coupons,
        coupons_data: userCoupons
      }), "coupons_data");
    } catch (e) {
      window.BankMessagesWarn("❌ [ERROR] Coupons loading from info_ failed:", e?.message || e);
    }
  })();

  // обработчик PURCHASE
  window.addEventListener("message", async (e) => {
    if (e.origin !== window.BANK_IFRAME_ORIGIN) return;
    if (!e.data || e.data.type !== "PURCHASE") return;

    window.BankMessagesLog("🟦 [STEP] PURCHASE received");
    const encode = encodeJSON(e.data);
    const newText = formatBankText(e.data);

    textArea.value = `${newText}`;
    const button = document.querySelector(
      'input[type="submit"].button.submit[name="submit"][value="Отправить"][accesskey="s"]'
    );
    if (button) {
      button.click();
      window.BankMessagesLog("🟩 [SENT]  PURCHASE form submitted");
    } else {
      window.BankMessagesWarn("❌ [ERROR] Submit button not found.");
    }

  });

  // === ПОСЛЕДОВАТЕЛЬНАЯ ЛЕНТА СКРЕЙПОВ ===
  (async () => {
    try {
      // 1) USERS_LIST
      const BankUsersList = await window.BankRetry(
        () => scrapeUsers(),
        { retries: 2, baseDelay: 700, maxDelay: 6000, timeoutMs: 15000 },
        "scrapeUsers"
      );
      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.users_list,
        users_list: BankUsersList
      }), "users_list");
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (users_list)");

      // 2) PROFILE_INFO
      const BankProfileInfo = await window.BankRetry(
        () => fetchProfileInfo(),
        { retries: 4, baseDelay: 900, maxDelay: 9000, timeoutMs: 20000 },
        "fetchProfileInfo"
      );

      // последовательно (ретраи уже внутри getLastValue), плюс пауза между вызовами
      const msg100_old = await window.BankGetLastValue(0, { label: window.BankLabel.message100 });
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between getLastValue (msg100_old)");

      const rep100_old = await window.BankGetLastValue(0, { label: window.BankLabel.reputation100 });
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between getLastValue (rep100_old)");

      const pos100_old = await window.BankGetLastValue(0, { label: window.BankLabel.positive100 });
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between getLastValue (pos100_old)");

      const month_old = await window.BankGetLastValue(BankProfileInfo.date, { label: window.BankLabel.month, is_month: true });

      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.profile_info,
        msg100_old,
        msg100_new: BankProfileInfo.messages,
        rep100_old,
        rep100_new: BankProfileInfo.respect,
        pos100_old,
        pos100_new: BankProfileInfo.positive,
        month_old,
        month_new: window.BankGetToday(),
        money: BankProfileInfo.money
      }), "profile_info");
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between getLastValue (pos100_old)");

      // 3) BANNER_MAYAK_FLAG
      const coms_banner_mayak = await window.BankRetry(
        () => window.scrapePostsByAuthorTag(window.UserID, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.banner_mayak.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 800, maxDelay: 7000, timeoutMs: 15000 },
        "scrapePostsByAuthorTag(banner_mayak)"
      );
      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.banner_mayak,
        banner_mayak_flag: Array.isArray(coms_banner_mayak) ? coms_banner_mayak.length === 0 : true
      }), "banner_mayak_flag");
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (banner_mayak)");

      // 4) BANNER_RENO_FLAG
      const coms_banner_reno = await window.BankRetry(
        () => window.scrapePostsByAuthorTag(window.UserID, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.banner_reno.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 800, maxDelay: 7000, timeoutMs: 15000 },
        "scrapePostsByAuthorTag(banner_reno)"
      );
      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.banner_reno,
        banner_reno_flag: Array.isArray(coms_banner_reno) ? coms_banner_reno.length === 0 : true
      }), "banner_reno_flag");
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (banner_reno)");

      // 5) ADS_POSTS (seed -> sendPosts)
      const ads_seed = await window.BankRetry(
        () => window.scrapePostsByAuthorTag(window.UserID, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.ads.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePostsByAuthorTag(ads_seed)"
      );
      window.BankQueueJob(iframeReadyP, async (iframeWindow) => {
        await window.BankSendPosts(iframeWindow, {
          seedPosts: ads_seed,
          label: window.BankLabel.ads,
          forums: window.BankForums.ads,
          type: window.BankPostMessagesType.ads,
          is_ads: true,
          title_prefix: window.BankPrefix.ads
        });
      });
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (ads)");

      // 6) FIRST_POST_FLAG
      const first_post_coms = await window.BankRetry(
        () => window.scrapePostsByAuthorTag(window.UserID, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.first_post.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 15000 },
        "scrapePostsByAuthorTag(first_post)"
      );
      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.first_post,
        first_post_flag: Array.isArray(first_post_coms) ? first_post_coms.length === 0 : true
      }), "first_post_flag");
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (first_post)");

      // 7) PERSONAL_POSTS
      const personal_seed = await window.BankRetry(
        () => window.scrapePostsByAuthorTag(window.UserID, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.personal_posts.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePostsByAuthorTag(personal_seed)"
      );
      window.BankQueueJob(iframeReadyP, async (iframeWindow) => {
        await window.BankSendPosts(iframeWindow, {
          seedPosts: personal_seed,
          label: window.BankLabel.personal_posts,
          forums: window.BankForums.personal_posts,
          type: window.BankPostMessagesType.personal_posts,
          is_ads: false
        });
      });
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (personal)");

      // 8) PLOT_POSTS
      const plot_seed = await window.BankRetry(
        () => window.scrapePostsByAuthorTag(window.UserID, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 10,
          keywords: window.BankLabel.plot_posts.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePostsByAuthorTag(plot_seed)"
      );
      window.BankQueueJob(iframeReadyP, async (iframeWindow) => {
        await window.BankSendPosts(iframeWindow, {
          seedPosts: plot_seed,
          label: window.BankLabel.plot_posts,
          forums: window.BankForums.plot_posts,
          type: window.BankPostMessagesType.plot_posts,
          is_ads: false
        });
      });
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (plot)");

      // 9) FIRST_POST_MISSED_FLAG — после personal/plot
      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.first_post_missed,
        first_post_missed_flag:
          (Array.isArray(personal_seed) && personal_seed.length > 0) ||
          (Array.isArray(plot_seed) && plot_seed.length > 0)
      }), "first_post_missed_flag");

      window.BankMessagesLog("🏁 [DONE] sequential scrape+send flow finished");
    } catch (e) {
      window.BankMessagesWarn("❌ [ERROR] Sequential scrape flow aborted:", e?.message || e);
    }
  })();
});