/* =============== MESSAGES QUEUE MODULE =============== */
(function() {
  'use strict';

  const sendQueue = [];
  let sending = false;

  async function processQueue() {
    if (sending) return;
    sending = true;
    const queueLen = sendQueue.length;
    window.BankMessagesLog("🟦 [STEP] send queue started (items: " + queueLen + ")");
    try {
      while (sendQueue.length) {
        const task = sendQueue.shift();
        try {
          await task();
        } catch (e) {
          window.BankMessagesWarn("❌ [ERROR] send task failed:", e?.message || e);
        }
        await window.BankHumanPause(window.SEND_BASE_GAP_MS, window.SEND_JITTER_MS, "gap between sends");
      }
    } finally {
      sending = false;
      window.BankMessagesLog("✅ [OK]   send queue drained");
    }
  }

  // добавляет задачу отправки произвольной работы, зависящей от iframe
  window.BankQueueJob = function(iframeReadyP, jobFactory) {
    iframeReadyP.then((iframeWindow) => {
      sendQueue.push(async () => {
        const startedAt = Date.now();
        window.BankMessagesLog("🟪 [QUEUE] job started");
        await jobFactory(iframeWindow);
        const duration = Date.now() - startedAt;
        window.BankMessagesLog("🟩 [SENT]  job done in " + duration + "ms");
      });
      const queueSize = sendQueue.length;
      window.BankMessagesLog("🟪 [QUEUE] job enqueued (size: " + queueSize + ")");
      processQueue();
    }).catch(err => window.BankMessagesWarn("queueJob skipped:", err?.message || err));
  };

  // добавляет задачу отправки простого сообщения
  window.BankQueueMessage = function(iframeReadyP, buildMessage, label) {
    label = label || "message";
    window.BankQueueJob(iframeReadyP, async (iframeWindow) => {
      const msg = buildMessage();
      if (msg) {
        iframeWindow.postMessage(msg, window.BANK_IFRAME_ORIGIN);
        window.BankMessagesLog("🟩 [SENT]  " + label + ":", msg.type || "(no type)");
      } else {
        window.BankMessagesLog("⚪ [SKIP]  " + label + ": empty message");
      }
    });
  };

  // отправляет сообщение немедленно, минуя очередь (для bankCommentEditFromBackup)
  window.BankSendMessageImmediately = function(iframeReadyP, buildMessage, label) {
    label = label || "message";
    iframeReadyP.then((iframeWindow) => {
      const msg = buildMessage();
      if (msg) {
        iframeWindow.postMessage(msg, window.BANK_IFRAME_ORIGIN);
        window.BankMessagesLog("🟢 [IMMEDIATE] " + label + ":", msg.type || "(no type)");
      } else {
        window.BankMessagesLog("⚪ [SKIP]  " + label + ": empty message");
      }
    }).catch(err => window.BankMessagesWarn("sendMessageImmediately skipped:", err?.message || err));
  };

  if (window.BankMessagesLog) {
    window.BankMessagesLog("✅ [MODULE] messages-queue.js loaded");
  }
})();
