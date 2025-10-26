/* =============== MESSAGES UTILS MODULE =============== */
(function () {
  'use strict';

  /* =============== система логирования =============== */
  const DEBUG = false; // false чтобы отключить все log()

  window.BankMessagesLog = DEBUG ? console.log.bind(console) : () => { };
  window.BankMessagesWarn = DEBUG ? console.warn.bind(console) : () => { };
  window.BankMessagesError = DEBUG ? console.error.bind(console) : () => { };

  /* =============== базовые утилиты: delay + timeout + retry =============== */
  window.BankPreScrapeBarrier = Promise.resolve(true);

  window.BankDelay = (ms) => new Promise(r => setTimeout(r, ms));

  window.BankWithTimeout = async function (promise, ms, label = "request") {
    let to;
    const t = new Promise((_, rej) => { to = setTimeout(() => rej(new Error(`${label} timeout after ${ms} ms`)), ms); });
    try { return await Promise.race([promise, t]); }
    finally { clearTimeout(to); }
  };

  window.BankRetry = async function (fn, { retries = 3, baseDelay = 600, maxDelay = 6000, timeoutMs = 15000 } = {}, label = "request") {
    let lastErr;
    window.BankMessagesLog("🟦 [STEP] " + label + " start");
    for (let i = 0; i < retries; i++) {
      try {
        const res = await window.BankWithTimeout(fn(), timeoutMs, label);
        window.BankMessagesLog("✅ [OK]   " + label + " success (try " + (i + 1) + "/" + retries + ")");
        return res;
      } catch (e) {
        lastErr = e;
        const isLast = i === retries - 1;
        if (isLast) {
          window.BankMessagesWarn("❌ [ERROR] " + label + " failed after " + retries + " tries:", e?.message || e);
          break;
        }
        const jitter = 0.8 + Math.random() * 0.4;  // 0.8—1.2
        const backoff = Math.min(baseDelay * 2 ** i, maxDelay) * jitter;
        window.BankMessagesLog("⚠️  [RETRY] " + label + " try " + (i + 1) + " failed: " + (e?.message || e) + ". Waiting " + Math.round(backoff) + "ms before retry...");
        await window.BankDelay(backoff);
      }
    }
    throw lastErr;
  };

  /* =============== конфиг пауз (чтобы не казаться ботом) =============== */
  window.SCRAPE_BASE_GAP_MS = 500;
  window.SCRAPE_JITTER_MS = 800;
  window.SEND_BASE_GAP_MS = 900;
  window.SEND_JITTER_MS = 500;

  window.BankHumanPause = function (base, jitter, reason = "pause") {
    const gap = base + Math.floor(Math.random() * jitter);
    window.BankMessagesLog("🟨 [WAIT] " + reason + ": " + gap + "ms");
    return window.BankDelay(gap);
  };

  /* =============== сервис: дата, готовность iframe =============== */
  window.BankGetToday = function () {
    const d = new Date();
    return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  };

  window.BankWaitForIframeReady = function (origin) {
    return new Promise((resolve) => {
      function onMsg(e) {
        if (e.origin !== origin) return;
        if (e.data?.type !== "IFRAME_READY") return;
        window.removeEventListener("message", onMsg);
        const w = e.source;
        w.postMessage({ type: "IFRAME_ACK" }, origin);
        window.BankMessagesLog("✅ [IFRAME] ACK sent, iframe ready");
        resolve(w);
      }
      window.addEventListener("message", onMsg);
      window.BankMessagesLog("🟦 [STEP] waiting for IFRAME_READY…");
    });
  };

  window.BankMessagesLog("✅ [MODULE] messages-utils.js loaded");
})();
