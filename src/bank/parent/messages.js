/* =============== основной поток: СКРЕЙПЫ ПОСЛЕДОВАТЕЛЬНО + ОТПРАВКИ С ОЧЕРЕДЬЮ =============== */
document.addEventListener("DOMContentLoaded", () => {
  const headTitle = document.querySelector("head > title")?.textContent || "";
  if (!headTitle.startsWith("Гринготтс")) {
    return;
  }

  // === 15s барьер перед ЛЮБЫМ вызовом scrapePosts ===
  window.BankPreScrapeBarrier = (async () => {
    // window.BankMessagesLog("🟨 [WAIT] pre-scrape barrier: 5000ms");
    // await window.BankDelay(5000);
    // window.BankMessagesLog("🟢 [GO]   pre-scrape barrier passed");
    return true;
  })();
  window.preScrapeBarrier = window.BankPreScrapeBarrier;

  const textArea = document.querySelector('textarea[name="req_message"]');
  const iframeReadyP = window.BankWaitForIframeReady(window.BANK_IFRAME_ORIGIN);

  // Функция для редактирования комментариев из backup
  async function bankCommentEditFromBackup(user_id, ts, NEW_COMMENT_ID = 0, current_bank = 0, { NEW_IS_ADMIN_TO_EDIT = false } = {}) {
    window.BankMessagesLog(`🟦 [BACKUP] bankCommentEditFromBackup called: user_id=${user_id}, ts=${ts}, comment_id=${NEW_COMMENT_ID}, current_bank=${current_bank}, NEW_IS_ADMIN_TO_EDIT=${NEW_IS_ADMIN_TO_EDIT}`);

    // Проверка на bank_ams_done для всех (включая админов)
    const commentContent = document.querySelector(`#p${NEW_COMMENT_ID}-content`);
    if (commentContent) {
      const hasAmsDone = commentContent.querySelector('bank_ams_done');
      if (hasAmsDone) {
        window.BankMessagesWarn('⚠️ [BACKUP] Обнаружен bank_ams_done, редактирование запрещено');
        alert("Извините! Администратор уже обработал Вашу запись в банке. Пожалуйста, обратитесь в Приёмную, если нужно будет внести изменения.");
        return;
      }
    }

    // Проверки для НЕ-админ редактирования
    if (!NEW_IS_ADMIN_TO_EDIT) {
      // 1. Проверка на NEW_COMMENT_ID = 0
      if (NEW_COMMENT_ID === 0) {
        window.BankMessagesError('❌ [BACKUP] NEW_COMMENT_ID = 0, редактирование невозможно');
        alert("Извините! Произошла ошибка. Пожалуйста, обратитесь в Приёмную.");
        return;
      }

      // 2. Проверка на наличие bank_ams_check
      if (commentContent) {
        const hasAmsCheck = commentContent.querySelector('bank_ams_check');

        if (hasAmsCheck) {
          window.BankMessagesWarn('⚠️ [BACKUP] Обнаружен bank_ams_check, редактирование запрещено');
          alert("Извините! Администратор уже начал обрабатывать Вашу запись в банке. Пожалуйста, обратитесь в Приёмную, если нужно будет внести изменения.");
          return;
        }
      } else {
        window.BankMessagesWarn(`⚠️ [BACKUP] Элемент #p${NEW_COMMENT_ID}-content не найден`);
      }
    }

    const current_storage = await FMVbank.storageGet(user_id, 'fmv_bank_info_');
    window.BankMessagesLog(`🟦 [BACKUP] current_storage:`, current_storage);

    const BACKUP_DATA = current_storage[ts];
    window.BankMessagesLog(`🟦 [BACKUP] BACKUP_DATA for ts=${ts}:`, BACKUP_DATA);

    // Отправляем НЕМЕДЛЕННО, минуя очередь
    if (BACKUP_DATA) {
      window.BankSendMessageImmediately(iframeReadyP, () => ({
        type: window.BankPostMessagesType.comment_info,
        NEW_COMMENT_TIMESTAMP: ts,
        NEW_COMMENT_ID,
        NEW_CURRENT_BANK: (Number(window.user_id) == 2) ? 99999999 : current_bank,
        NEW_IS_ADMIN_TO_EDIT
      }), "comment_info");
      window.BankSendMessageImmediately(iframeReadyP, () => ({
        type: window.BankPostMessagesType.backup_data,
        BACKUP_DATA
      }), "backup_data");

      // Скроллим страницу к div.post.topicpost
      const topicPost = document.querySelector("div.post.topicpost");
      if (topicPost) {
        topicPost.scrollIntoView({ behavior: "smooth", block: "start" });
        window.BankMessagesLog("🟦 [BACKUP] Скролл к div.post.topicpost выполнен");
      } else {
        window.BankMessagesWarn("⚠️ [BACKUP] div.post.topicpost не найден");
      }
    }
  }

  // Экспортируем функцию в глобальную область видимости для использования в onclick
  window.bankCommentEditFromBackup = bankCommentEditFromBackup;

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
    const ts = e.data.timestamp;
    const current_storage = await FMVbank.storageGet(window.UserID, 'fmv_bank_info_');
    current_storage[ts] = e.data;
    const storage_set_flag = FMVbank.storageSet(current_storage, window.UserID, 'fmv_bank_info_');
    if (!storage_set_flag) { alert("Попробуйте нажать на кнопку еще раз."); } else {
      if (textArea) {
        textArea.value = `[FMVbank]${ts}[/FMVbank]${newText}`;
        const button = document.querySelector(
          'input[type="submit"].button.submit[name="submit"][value="Отправить"][accesskey="s"]'
        );
        if (button) {
          button.click();
          window.BankMessagesLog("🟩 [SENT]  PURCHASE form submitted");
        } else {
          window.BankMessagesWarn("❌ [ERROR] Submit button not found.");
        }
      }
    }
  });

  // обработчик EDIT_PURCHASE
  window.addEventListener("message", async (e) => {
    if (e.origin !== window.BANK_IFRAME_ORIGIN) return;
    if (!e.data || e.data.type !== "EDIT_PURCHASE") return;

    window.BankMessagesLog("🟦 [STEP] EDIT_PURCHASE received");
    const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');
    const newText = formatBankText(e.data);
    const ts = e.data.timestamp;
    const comment_ts = e.data.comment_timestamp;
    const comment_id = e.data.comment_id;
    const comment_user_id = e.data.comment_user_id;
    const is_admin_to_edit = e.data.is_admin_to_edit || false;
    const admin_flag = (!is_admin_to_edit) ? "" : "[FMVbankAmsCheck]";

    // Открываем страницу редактирования в скрытом iframe
    window.BankMessagesLog("🟦 [EDIT] Открываем страницу редактирования комментария:", comment_id);

    const editIframe = document.createElement('iframe');
    editIframe.style.display = 'none';
    editIframe.src = `${SITE_URL}/edit.php?id=${comment_id}`;
    document.body.appendChild(editIframe);

    // Ждём загрузки iframe и отправляем форму
    editIframe.onload = async function () {
      try {
        const iframeDoc = editIframe.contentDocument || editIframe.contentWindow.document;
        const iframeTextArea = iframeDoc.querySelector('textarea[name="req_message"]');
        const iframeSubmitButton = iframeDoc.querySelector(
          'input[type="submit"].button.submit[name="submit"][value="Отправить"][accesskey="s"]'
        );

        if (!iframeTextArea || !iframeSubmitButton) {
          window.BankMessagesWarn("❌ [ERROR] Не найдена форма редактирования в iframe");
          editIframe.remove();
          return;
        }

        // Проверяем наличие [FMVbankAmsDone] если это НЕ админ-редактирование
        if (!is_admin_to_edit && iframeTextArea.value.includes('[FMVbankAmsDone]')) {
          window.BankMessagesWarn("⚠️ [EDIT] Обнаружен [FMVbankAmsDone], редактирование запрещено");
          editIframe.remove();
          alert("Извините! Администратор уже обработал Вашу запись в банке. Пожалуйста, обратитесь в Приёмную, если нужно будет внести изменения.");
          return;
        }

        // Проверяем наличие [FMVbankAmsCheck] если это НЕ админ-редактирование
        if (!is_admin_to_edit && iframeTextArea.value.includes('[FMVbankAmsCheck]')) {
          window.BankMessagesWarn("⚠️ [EDIT] Обнаружен [FMVbankAmsCheck], редактирование запрещено");
          editIframe.remove();
          alert("Извините! Администратор уже начал обрабатывать Вашу запись в банке. Пожалуйста, обратитесь в Приёмную, если нужно будет внести изменения.");
          return;
        }

        // Сохраняем данные в storage ПОСЛЕ проверки
        const current_storage = await FMVbank.storageGet(comment_user_id, 'fmv_bank_info_');
        current_storage[ts] = e.data;
        delete current_storage[comment_ts];
        const storage_set_flag = FMVbank.storageSet(current_storage, comment_user_id, 'fmv_bank_info_');

        if (!storage_set_flag) {
          editIframe.remove();
          alert("Попробуйте нажать на кнопку еще раз.");
          return;
        }

        // Вставляем текст
        iframeTextArea.value = `${admin_flag}[FMVbank]${ts}[/FMVbank]${newText}`;
        window.BankMessagesLog("✅ [EDIT] Текст вставлен в форму редактирования");

        // Отслеживаем редирект после отправки
        let redirectUrl = null;
        let redirectDetected = false;
        let redirectCheckInterval;

        const checkRedirect = () => {
          try {
            const currentUrl = editIframe.contentWindow.location.href;
            window.BankMessagesLog("🔍 [EDIT] Проверяем URL iframe:", currentUrl);
            if (currentUrl.includes('/viewtopic.php?')) {
              redirectUrl = currentUrl;
              redirectDetected = true;
              window.BankMessagesLog("✅ [EDIT] Обнаружен редирект на:", redirectUrl);

              // Очищаем интервал
              clearInterval(redirectCheckInterval);

              // Удаляем iframe
              editIframe.remove();

              // Переходим в основном окне (принудительная перезагрузка)
              window.BankMessagesLog("🟩 [EDIT] Переходим по ссылке:", redirectUrl);
              window.location.reload();
            }
          } catch (err) {
            window.BankMessagesLog("⚠️ [EDIT] CORS или другая ошибка при проверке redirect:", err.message);
          }
        };

        // Проверяем редирект каждые 500ms
        redirectCheckInterval = setInterval(checkRedirect, 500);

        // Останавливаем проверку через 10 секунд
        setTimeout(() => {
          clearInterval(redirectCheckInterval);
          if (!redirectDetected) {
            window.BankMessagesWarn("⚠️ [EDIT] Редирект не обнаружен за 10 секунд");
            editIframe.remove();
          }
        }, 10000);

        // Отправляем форму
        iframeSubmitButton.click();
        window.BankMessagesLog("🟩 [SENT] EDIT_PURCHASE form submitted в iframe");

      } catch (error) {
        window.BankMessagesError("❌ [ERROR] Ошибка при работе с iframe:", error);
        editIframe.remove();
      }
    };

    // Обработка ошибки загрузки iframe
    editIframe.onerror = function () {
      window.BankMessagesError("❌ [ERROR] Не удалось загрузить страницу редактирования");
      editIframe.remove();
    };
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
        () => window.scrapePosts(window.UserLogin, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.banner_mayak.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 800, maxDelay: 7000, timeoutMs: 15000 },
        "scrapePosts(banner_mayak)"
      );
      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.banner_mayak,
        banner_mayak_flag: Array.isArray(coms_banner_mayak) ? coms_banner_mayak.length === 0 : true
      }), "banner_mayak_flag");
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (banner_mayak)");

      // 4) BANNER_RENO_FLAG
      const coms_banner_reno = await window.BankRetry(
        () => window.scrapePosts(window.UserLogin, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.banner_reno.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 800, maxDelay: 7000, timeoutMs: 15000 },
        "scrapePosts(banner_reno)"
      );
      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.banner_reno,
        banner_reno_flag: Array.isArray(coms_banner_reno) ? coms_banner_reno.length === 0 : true
      }), "banner_reno_flag");
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (banner_reno)");

      // 5) ADS_POSTS (seed -> sendPosts)
      const ads_seed = await window.BankRetry(
        () => window.scrapePosts(window.UserLogin, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.ads.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(ads_seed)"
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
        () => window.scrapePosts(window.UserLogin, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.first_post.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 15000 },
        "scrapePosts(first_post)"
      );
      window.BankQueueMessage(iframeReadyP, () => ({
        type: window.BankPostMessagesType.first_post,
        first_post_flag: Array.isArray(first_post_coms) ? first_post_coms.length === 0 : true
      }), "first_post_flag");
      await window.BankHumanPause(window.SCRAPE_BASE_GAP_MS, window.SCRAPE_JITTER_MS, "between scrapes (first_post)");

      // 7) PERSONAL_POSTS
      const personal_seed = await window.BankRetry(
        () => window.scrapePosts(window.UserLogin, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 1,
          keywords: window.BankLabel.personal_posts.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(personal_seed)"
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
        () => window.scrapePosts(window.UserLogin, window.BankForums.bank, {
          title_prefix: window.BankPrefix.bank,
          stopOnNthPost: 10,
          keywords: window.BankLabel.plot_posts.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(plot_seed)"
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