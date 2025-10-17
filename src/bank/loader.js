/**
 * Loader для банковского интерфейса
 * Этот файл нужно вставить в iframe страницы банка
 *
 * Использование:
 * <script src="https://odeshock.github.io/QuadroBoards-Automatizations/src/bank/loader.js"></script>
 *
 * Функции:
 * - Устанавливает handshake с родительским окном
 * - Динамически загружает app.js после получения ACK
 * - Принимает данные пользователя и профиля от родителя
 * - Управляет прелоадером (минимум 5 секунд)
 */

console.log("✅ loader.js загружен");

const ALLOWED_PARENTS = [
  "https://testfmvoice.rusff.me",      // тест
  "https://followmyvoice.rusff.me/"    // прод
];

(function () {
  let ack = false,
    tries = 0,
    appLoaded = false,
    startTime = Date.now(),
    MIN_PRELOAD_TIME = 5_000; // 5 секунд

  function hidePreloader(force = false) {
    const elapsed = Date.now() - startTime;
    if (!force && (elapsed < MIN_PRELOAD_TIME || !ack || !appLoaded)) {
      // ждём, пока всё готово и прошло 5 сек
      setTimeout(() => hidePreloader(true), MIN_PRELOAD_TIME - elapsed);
      return;
    }
    document.getElementById("preloader")?.style.setProperty("display", "none");
    console.log("✨ Прелоадер убран через", Math.round(elapsed / 1000), "сек");
  }

  function sendReady() {
    if (ack || tries >= 100) return;
    tries++;
    for (const origin of ALLOWED_PARENTS) {
      try { window.parent.postMessage({ type: "IFRAME_READY" }, origin); } catch { }
    }
    setTimeout(sendReady, 100);
  }
  sendReady();

  window.addEventListener("message", (e) => {
    if (!ALLOWED_PARENTS.includes(e.origin)) return;
    const d = e.data || {};

    if (d.type === "IFRAME_ACK") {
      ack = true;
      console.log("[iframe] ACK от", e.origin);

      if (!window.__APP_LOADED__) {
        window.__APP_LOADED__ = true;

        // Создаём script с type="module" для загрузки app.js
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://odeshock.github.io/QuadroBoards-Automatizations/src/bank/app.js?v=' + Date.now();
        script.onload = () => {
          appLoaded = true;
          console.log("✅ app.js загружен");
          hidePreloader();
        };
        script.onerror = (err) => {
          console.error("❌ Ошибка загрузки app.js", err);
        };
        document.head.appendChild(script);
      }
    }



    // --- получение данных ---
    if (d.type === "USER_INFO") {
      window.USER_ID = d.user_id;
      window.IS_ADMIN = !!d.is_admin;
    }

    if (d.type === "USERS_LIST") {
      window.USERS_LIST = Array.isArray(d.users_list) ? d.users_list : [];
    }

    if (d.type === "PROFILE_INFO") {
      window.MSG100_OLD = d.msg100_old || 0;
      window.MSG100_NEW = d.msg100_new || 0;
      window.REP100_OLD = d.rep100_old || 0;
      window.REP100_NEW = d.rep100_new || 0;
      window.POS100_OLD = d.pos100_old || 0;
      window.POS100_NEW = d.pos100_new || 0;
      window.MONTH_OLD = Array.isArray(d.month_old) ? d.month_old : null;
      window.MONTH_NEW = Array.isArray(d.month_new) ? d.month_new : null;
      window.CURRENT_BANK = d.money || 0;
    }

    if (d.type === "SKIN") {
      window.SKIN_DATA_PLASHKA = d.skin_data_plashka || [];
      window.SKIN_DATA_ICON = d.skin_data_icon || [];
      window.SKIN_DATA_BACK = d.skin_data_back || [];
      window.SKIN_DATA_GIFT = d.skin_data_gift || [];
    }

    if (d.type === "PERSONAL_DISCOUNTS") {
      window.COUPONS_DATA = d.coupons_data || [];
    }

    if (d.type === "PERSONAL_POSTS") window.PERSONAL_POSTS = d.posts || [];
    if (d.type === "ADS_POSTS") window.ADS_POSTS = d.posts || [];
    if (d.type === "PLOT_POSTS") window.PLOT_POSTS = d.posts || [];

    if (d.type === "FIRST_POST_FLAG") window.FIRST_POST_FLAG = !!d.first_post_flag;
    if (d.type === "FIRST_POST_MISSED_FLAG") window.FIRST_POST_MISSED_FLAG = !!d.first_post_missed_flag;
    if (d.type === "BANNER_MAYAK_FLAG") window.BANNER_MAYAK_FLAG = !!d.banner_mayak_flag;
    if (d.type === "BANNER_RENO_FLAG") window.BANNER_RENO_FLAG = !!d.banner_reno_flag;

    // Проверяем, все ли критические данные загружены
    if (window.USER_ID !== undefined &&
      window.IS_ADMIN !== undefined &&
      window.USERS_LIST !== undefined &&
      window.SKIN_DATA_PLASHKA !== undefined &&
      window.SKIN_DATA_ICON !== undefined &&
      window.SKIN_DATA_BACK !== undefined &&
      window.SKIN_DATA_GIFT !== undefined
    ) {
      hidePreloader();
    }
  });
})();
