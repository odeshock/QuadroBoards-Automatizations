/* =============== базовые утилиты: delay + timeout + retry с логами =============== */
let preScrapeBarrier = Promise.resolve(true);
const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function withTimeout(promise, ms, label = "request") {
  let to;
  const t = new Promise((_, rej) => { to = setTimeout(() => rej(new Error(`${label} timeout after ${ms} ms`)), ms); });
  try { return await Promise.race([promise, t]); }
  finally { clearTimeout(to); }
}

async function retry(fn, { retries = 3, baseDelay = 600, maxDelay = 6000, timeoutMs = 15000 } = {}, label = "request") {
  let lastErr;
  console.log(`🟦 [STEP] ${label} start`);
  for (let i = 0; i < retries; i++) {
    try {
      const res = await withTimeout(fn(), timeoutMs, label);
      console.log(`✅ [OK]   ${label} success (try ${i + 1}/${retries})`);
      return res;
    } catch (e) {
      lastErr = e;
      const isLast = i === retries - 1;
      if (isLast) {
        console.warn(`❌ [ERROR] ${label} failed after ${retries} tries:`, e?.message || e);
        break;
      }
      const jitter = 0.8 + Math.random() * 0.4;  // 0.8—1.2
      const backoff = Math.min(baseDelay * 2 ** i, maxDelay) * jitter;
      console.log(`⚠️  [RETRY] ${label} try ${i + 1} failed: ${e?.message || e}. Waiting ${Math.round(backoff)}ms before retry...`);
      await delay(backoff);
    }
  }
  throw lastErr;
}

/* =============== конфиг пауз (чтобы не казаться ботом) =============== */
// пауза между СКРЕЙПАМИ (запросами к сайту)
const SCRAPE_BASE_GAP_MS = 1000;
const SCRAPE_JITTER_MS = 800;
// пауза между ОТПРАВКАМИ в iframe
const SEND_BASE_GAP_MS = 900;
const SEND_JITTER_MS = 500;

function humanPause(base, jitter, reason = "pause") {
  const gap = base + Math.floor(Math.random() * jitter);
  console.log(`🟨 [WAIT] ${reason}: ${gap}ms`);
  return delay(gap);
}

/* =============== константы и словари =============== */
const IFRAME_ORIGIN = "https://forumscripts.ru";

const BankPrefix = {
  ads: "Реклама",
  bank: "Гринготтс"
};

const BankForums = {
  ads: window.FORUMS_IDS?.Ads || [0],
  bank: window.FORUMS_IDS?.Bank || [0],
  personal_posts: window.FORUMS_IDS?.PersonalPosts || [0],
  plot_posts: window.FORUMS_IDS?.PlotPosts || [0]
};

const BankLabel = {
  ads: "— Каждая рекламная листовка",
  banner_mayak: "— Баннер FMV в подписи на Маяке",
  banner_reno: "— Баннер FMV в подписи на Рено",
  first_post: "— Первый пост на профиле",
  message100: "— Каждые 100 сообщений",
  positive100: "— Каждые 100 позитива",
  reputation100: "— Каждые 100 репутации",
  month: "— Каждый игровой месяц",
  personal_posts: "— Каждый личный пост",
  plot_posts: "— Каждый сюжетный пост",
};

const BankPostMessagesType = {
  ads: "ADS_POSTS",
  banner_mayak: "BANNER_MAYAK_FLAG",
  banner_reno: "BANNER_RENO_FLAG",
  coupons: "PERSONAL_DISCOUNTS",
  first_post: "FIRST_POST_FLAG",
  first_post_missed: "FIRST_POST_MISSED_FLAG",
  skin: "SKIN",
  personal_posts: "PERSONAL_POSTS",
  plot_posts: "PLOT_POSTS",
  profile_info: "PROFILE_INFO",
  user_info: "USER_INFO",
  users_list: "USERS_LIST",
};

const BankSkinFieldID = window.SKIN?.LibraryFieldID || 0;

const BankSkinPostID = {
  Plashka: window.SKIN?.LibraryPlashkaPostID || [],
  Icon: window.SKIN?.LibraryIconPostID || [],
  Back: window.SKIN?.LibraryBackPostID || [],
  Gift: window.SKIN?.LibraryGiftPostID || []
}


/* =============== сервис: дата, готовность iframe =============== */
function getBankToday() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}

function waitForIframeReady(origin) {
  return new Promise((resolve) => {
    function onMsg(e) {
      if (e.origin !== origin) return;
      if (e.data?.type !== "IFRAME_READY") return;
      window.removeEventListener("message", onMsg);
      const w = e.source;
      w.postMessage({ type: "IFRAME_ACK" }, origin);
      console.log("✅ [IFRAME] ACK sent, iframe ready");
      resolve(w);
    }
    window.addEventListener("message", onMsg);
    console.log("🟦 [STEP] waiting for IFRAME_READY…");
  });
}

/* =============== очередь отправок (rate limit на postMessage) =============== */
const sendQueue = [];
let sending = false;

async function processQueue() {
  if (sending) return;
  sending = true;
  console.log(`🟦 [STEP] send queue started (items: ${sendQueue.length})`);
  try {
    while (sendQueue.length) {
      const task = sendQueue.shift();
      try {
        await task();
      } catch (e) {
        console.warn("❌ [ERROR] send task failed:", e?.message || e);
      }
      await humanPause(SEND_BASE_GAP_MS, SEND_JITTER_MS, "gap between sends");
    }
  } finally {
    sending = false;
    console.log("✅ [OK]   send queue drained");
  }
}

// добавляет задачу отправки произвольной работы, зависящей от iframe
function queueJob(iframeReadyP, jobFactory /* (iframeWindow) => Promise<void> */) {
  iframeReadyP.then((iframeWindow) => {
    sendQueue.push(async () => {
      const startedAt = Date.now();
      console.log("🟪 [QUEUE] job started");
      await jobFactory(iframeWindow);
      console.log(`🟩 [SENT]  job done in ${Date.now() - startedAt}ms`);
    });
    console.log(`🟪 [QUEUE] job enqueued (size: ${sendQueue.length})`);
    processQueue();
  }).catch(err => console.warn("queueJob skipped:", err?.message || err));
}

// добавляет задачу отправки простого сообщения
function queueMessage(iframeReadyP, buildMessage /* () => object */, label = "message") {
  queueJob(iframeReadyP, async (iframeWindow) => {
    const msg = buildMessage();
    if (msg) {
      iframeWindow.postMessage(msg, IFRAME_ORIGIN);
      console.log(`🟩 [SENT]  ${label}:`, msg.type || "(no type)");
    } else {
      console.log(`⚪ [SKIP]  ${label}: empty message`);
    }
  });
}

/* =============== отправка пост-списков (внутри очереди) =============== */
async function sendPosts(iframeWindow, { seedPosts, label, forums, type, is_ads = false, title_prefix = "" }) {
  try {
    const first = Array.isArray(seedPosts) ? seedPosts[0] : null;
    const posts_html = (first && typeof first.html === "string") ? first.html : "";

    const rawLinks = posts_html
      ? getBlockquoteTextFromHtml(posts_html, label, 'link')
      : null;

    const used_posts_links = Array.isArray(rawLinks)
      ? rawLinks
      : (typeof rawLinks === "string" && rawLinks.trim() !== "" ? [rawLinks] : []);

    const used_posts = used_posts_links
      .filter((link) => typeof link === "string" && link.includes("/viewtopic.php?"))
      .map((link) => link.split("/viewtopic.php?")[1]);

    console.log(`🟦 [STEP] scrape new posts for ${type} (filter used_posts: ${used_posts.length})`);
    const new_posts_raw = await retry(
      () => window.scrapePosts(window.UserLogin, forums, { last_src: used_posts, comments_only: true, title_prefix }),
      { retries: 4, baseDelay: 800, maxDelay: 8000, timeoutMs: 18000 },
      `scrapePosts(${type})`
    );

    const new_posts = Array.isArray(new_posts_raw)
      ? new_posts_raw.map((item) => ({
        src: `${SITE_URL}/viewtopic.php?${item.src}`,
        text: item.title,
        ...(is_ads ? {} : { symbols_num: item.symbols_num }),
      }))
      : [];

    iframeWindow.postMessage({ type, posts: new_posts }, IFRAME_ORIGIN);
    console.log(`🟩 [SENT]  ${type}: ${new_posts.length} item(s)`);
  } catch (e) {
    console.warn(`❌ [ERROR] sendPosts(${type}) failed after retries:`, e?.message || e);
  }
}

/* =============== получение нового актуального значения (внутри очереди) =============== */
async function getLastValue(default_value, { label, is_month = false }) {
  try {
    const seed = await retry(
      () => window.scrapePosts(window.UserLogin, BankForums.bank, {
        title_prefix: BankPrefix.bank,
        stopOnFirstNonEmpty: true,
        keywords: label.split(" ").join(" AND "),
      }),
      { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
      "scrapePosts(personal_seed)"
    );

    const _origScrapePosts = window.scrapePosts?.bind(window);
    if (typeof _origScrapePosts === "function") {
      window.scrapePosts = async (...args) => {
        await (window.preScrapeBarrier ?? preScrapeBarrier ?? Promise.resolve()); // ← гарантированная суммарная задержка до всех scrapePosts
        return _origScrapePosts(...args);  // ← дальше — как было, со всеми retry/timeout
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

    console.log(`🟩 [FOUND] Новое значение ${label}: ${last_value}`);
    return last_value;
  } catch (e) {
    console.warn(`❌ [ERROR] getLastValue(${label}) failed after retries:`, e?.message || e);
    return null;
  }
}

/* =============== основной поток: СКРЕЙПЫ ПОСЛЕДОВАТЕЛЬНО + ОТПРАВКИ С ОЧЕРЕДЬЮ =============== */
document.addEventListener("DOMContentLoaded", () => {
  const headTitle = document.querySelector("head > title")?.textContent || "";
  if (!headTitle.startsWith("Гринготтс")) {
    return;
  }

  // === 15s барьер перед ЛЮБЫМ вызовом scrapePosts ===
  preScrapeBarrier = (async () => {
    // console.log("🟨 [WAIT] pre-scrape barrier: 5000ms");
    // await delay(5000);
    // console.log("🟢 [GO]   pre-scrape barrier passed");
    return true;
  })();
  window.preScrapeBarrier = preScrapeBarrier;

  const textArea = document.querySelector('textarea[name="req_message"]');
  const iframeReadyP = waitForIframeReady(IFRAME_ORIGIN);

  // user_info — можно отправить сразу после готовности iframe (без данных)
  queueMessage(iframeReadyP, () => ({
    type: BankPostMessagesType.user_info,
    user_id: window.UserID,
    user_name: window.UserLogin,
    is_admin: window.UserID == 2
  }), "user_info");

  // Загрузка данных скинов и купонов (async)
  (async () => {
    try {
      const skin_data_plashka = await fetchCardsWrappedClean(BankSkinFieldID, BankSkinPostID.Plashka);
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between BankSkin Plashka");

      const skin_data_icon = await fetchCardsWrappedClean(BankSkinFieldID, BankSkinPostID.Icon);
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between BankSkin Icon");

      const skin_data_back = await fetchCardsWrappedClean(BankSkinFieldID, BankSkinPostID.Back);
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between BankSkin Back");

      const skin_data_gift = await fetchCardsWrappedClean(BankSkinFieldID, BankSkinPostID.Gift);
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between BankSkin Gift");

      console.log("skin!!!", skin_data_plashka,
        skin_data_icon,
        skin_data_back,
        skin_data_gift);

      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.skin,
        skin_data_plashka,
        skin_data_icon,
        skin_data_back,
        skin_data_gift
      }), "skin_data");

      const coupons_data = await fetchUserCoupons();

      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.coupons,
        coupons_data
      }), "coupons_data");

      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between Coupons");
    } catch (e) {
      console.warn("❌ [ERROR] Skin/Coupons loading failed:", e?.message || e);
    }
  })();

  // обработчик PURCHASE
  window.addEventListener("message", async (e) => {
    if (e.origin !== IFRAME_ORIGIN) return;
    if (!e.data || e.data.type !== "PURCHASE") return;

    console.log("🟦 [STEP] PURCHASE received");
    const encode = encodeJSON(e.data);
    const newText = formatBankText(e.data);
    const ts = Date.now();
    const current_storage = await FMVbank.storageGet(window.UserID);
    current_storage[ts] = e.data;
    FMVbank.storageSet(current_storage, window.UserID);
    if (textArea) {
      textArea.value = `[FMVbank]${ts}[/FMVbank]${newText}`;
      const button = document.querySelector(
        'input[type="submit"].button.submit[name="submit"][value="Отправить"][accesskey="s"]'
      );
      if (button) {
        button.click();
        console.log("🟩 [SENT]  PURCHASE form submitted");
      } else {
        console.warn("❌ [ERROR] Submit button not found.");
      }
    }
  });

  // === ПОСЛЕДОВАТЕЛЬНАЯ ЛЕНТА СКРЕЙПОВ ===
  (async () => {
    try {
      // 1) USERS_LIST
      const BankUsersList = await retry(
        () => scrapeUsers(),
        { retries: 2, baseDelay: 700, maxDelay: 6000, timeoutMs: 15000 },
        "scrapeUsers"
      );
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.users_list,
        users_list: BankUsersList
      }), "users_list");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (users_list)");

      // 2) PROFILE_INFO
      const BankProfileInfo = await retry(
        () => fetchProfileInfo(),
        { retries: 4, baseDelay: 900, maxDelay: 9000, timeoutMs: 20000 },
        "fetchProfileInfo"
      );

      // последовательно (ретраи уже внутри getLastValue), плюс пауза между вызовами
      const msg100_old = await getLastValue(0, { label: BankLabel.message100 });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (msg100_old)");

      const rep100_old = await getLastValue(0, { label: BankLabel.reputation100 });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (rep100_old)");

      const pos100_old = await getLastValue(0, { label: BankLabel.positive100 });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (pos100_old)");

      const month_old = await getLastValue(BankProfileInfo.date, { label: BankLabel.month, is_month: true });

      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.profile_info,
        msg100_old,
        msg100_new: BankProfileInfo.messages,
        rep100_old,
        rep100_new: BankProfileInfo.respect,
        pos100_old,
        pos100_new: BankProfileInfo.positive,
        month_old,
        month_new: getBankToday(),
        money: BankProfileInfo.money
      }), "profile_info");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between getLastValue (pos100_old)");

      // 3) BANNER_MAYAK_FLAG
      const coms_banner_mayak = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnFirstNonEmpty: true,
          keywords: BankLabel.banner_mayak.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 800, maxDelay: 7000, timeoutMs: 15000 },
        "scrapePosts(banner_mayak)"
      );
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.banner_mayak,
        banner_mayak_flag: Array.isArray(coms_banner_mayak) ? coms_banner_mayak.length === 0 : true
      }), "banner_mayak_flag");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (banner_mayak)");

      // 4) BANNER_RENO_FLAG
      const coms_banner_reno = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnFirstNonEmpty: true,
          keywords: BankLabel.banner_reno.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 800, maxDelay: 7000, timeoutMs: 15000 },
        "scrapePosts(banner_reno)"
      );
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.banner_reno,
        banner_reno_flag: Array.isArray(coms_banner_reno) ? coms_banner_reno.length === 0 : true
      }), "banner_reno_flag");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (banner_reno)");

      // 5) ADS_POSTS (seed -> sendPosts)
      const ads_seed = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnFirstNonEmpty: true,
          keywords: BankLabel.ads.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(ads_seed)"
      );
      queueJob(iframeReadyP, async (iframeWindow) => {
        await sendPosts(iframeWindow, {
          seedPosts: ads_seed,
          label: BankLabel.ads,
          forums: BankForums.ads,
          type: BankPostMessagesType.ads,
          is_ads: true,
          title_prefix: BankPrefix.ads
        });
      });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (ads)");

      // 6) FIRST_POST_FLAG
      const first_post_coms = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnFirstNonEmpty: true,
          keywords: BankLabel.first_post.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 15000 },
        "scrapePosts(first_post)"
      );
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.first_post,
        first_post_flag: Array.isArray(first_post_coms) ? first_post_coms.length === 0 : true
      }), "first_post_flag");
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (first_post)");

      // 7) PERSONAL_POSTS
      const personal_seed = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnFirstNonEmpty: true,
          keywords: BankLabel.personal_posts.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(personal_seed)"
      );
      queueJob(iframeReadyP, async (iframeWindow) => {
        await sendPosts(iframeWindow, {
          seedPosts: personal_seed,
          label: BankLabel.personal_posts,
          forums: BankForums.personal_posts,
          type: BankPostMessagesType.personal_posts,
          is_ads: false
        });
      });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (personal)");

      // 8) PLOT_POSTS
      const plot_seed = await retry(
        () => window.scrapePosts(window.UserLogin, BankForums.bank, {
          title_prefix: BankPrefix.bank,
          stopOnFirstNonEmpty: true,
          keywords: BankLabel.plot_posts.split(" ").join(" AND "),
        }),
        { retries: 3, baseDelay: 900, maxDelay: 8000, timeoutMs: 18000 },
        "scrapePosts(plot_seed)"
      );
      queueJob(iframeReadyP, async (iframeWindow) => {
        await sendPosts(iframeWindow, {
          seedPosts: plot_seed,
          label: BankLabel.plot_posts,
          forums: BankForums.plot_posts,
          type: BankPostMessagesType.plot_posts,
          is_ads: false
        });
      });
      await humanPause(SCRAPE_BASE_GAP_MS, SCRAPE_JITTER_MS, "between scrapes (plot)");

      // 9) FIRST_POST_MISSED_FLAG — после personal/plot
      queueMessage(iframeReadyP, () => ({
        type: BankPostMessagesType.first_post_missed,
        first_post_missed_flag:
          (Array.isArray(personal_seed) && personal_seed.length > 0) ||
          (Array.isArray(plot_seed) && plot_seed.length > 0)
      }), "first_post_missed_flag");

      console.log("🏁 [DONE] sequential scrape+send flow finished");
    } catch (e) {
      console.warn("❌ [ERROR] Sequential scrape flow aborted:", e?.message || e);
    }
  })();
});