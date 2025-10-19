/* =============== функция редактирования комментариев из backup =============== */

import { log, warn, error } from './messages-utils.js';
import { BankPostMessagesType } from './messages-config.js';
import { sendMessageImmediately } from './messages-queue.js';

export async function createBankCommentEditFromBackup(iframeReadyP) {
  // Функция для редактирования комментариев из backup
  async function bankCommentEditFromBackup(user_id, ts, NEW_COMMENT_ID = 0, current_bank = 0, { NEW_IS_ADMIN_TO_EDIT = false } = {}) {
    log(`🟦 [BACKUP] bankCommentEditFromBackup called: user_id=${user_id}, ts=${ts}, comment_id=${NEW_COMMENT_ID}, current_bank=${current_bank}, NEW_IS_ADMIN_TO_EDIT=${NEW_IS_ADMIN_TO_EDIT}`);

    // Проверка на bank_ams_done для всех (включая админов)
    const commentContent = document.querySelector(`#p${NEW_COMMENT_ID}-content`);
    if (commentContent) {
      const hasAmsDone = commentContent.querySelector('bank_ams_done');
      if (hasAmsDone) {
        warn('⚠️ [BACKUP] Обнаружен bank_ams_done, редактирование запрещено');
        alert("Извините! Администратор уже обработал Вашу запись в банке. Пожалуйста, обратитесь в Приёмную, если нужно будет внести изменения.");
        return;
      }
    }

    // Проверки для НЕ-админ редактирования
    if (!NEW_IS_ADMIN_TO_EDIT) {
      // 1. Проверка на NEW_COMMENT_ID = 0
      if (NEW_COMMENT_ID === 0) {
        error('❌ [BACKUP] NEW_COMMENT_ID = 0, редактирование невозможно');
        alert("Извините! Произошла ошибка. Пожалуйста, обратитесь в Приёмную.");
        return;
      }

      // 2. Проверка на наличие bank_ams_check
      if (commentContent) {
        const hasAmsCheck = commentContent.querySelector('bank_ams_check');

        if (hasAmsCheck) {
          warn('⚠️ [BACKUP] Обнаружен bank_ams_check, редактирование запрещено');
          alert("Извините! Администратор уже начал обрабатывать Вашу запись в банке. Пожалуйста, обратитесь в Приёмную, если нужно будет внести изменения.");
          return;
        }
      } else {
        warn(`⚠️ [BACKUP] Элемент #p${NEW_COMMENT_ID}-content не найден`);
      }
    }

    const current_storage = await window.FMVbank.storageGet(user_id, 'fmv_bank_info_');
    log(`🟦 [BACKUP] current_storage:`, current_storage);

    const BACKUP_DATA = current_storage[ts];
    log(`🟦 [BACKUP] BACKUP_DATA for ts=${ts}:`, BACKUP_DATA);

    // Отправляем НЕМЕДЛЕННО, минуя очередь
    if (BACKUP_DATA) {
      sendMessageImmediately(iframeReadyP, () => ({
        type: BankPostMessagesType.comment_info,
        NEW_COMMENT_TIMESTAMP: ts,
        NEW_COMMENT_ID,
        NEW_CURRENT_BANK: (Number(window.user_id) == 2) ? 99999999 : current_bank,
        NEW_IS_ADMIN_TO_EDIT
      }), "comment_info");
      sendMessageImmediately(iframeReadyP, () => ({
        type: BankPostMessagesType.backup_data,
        BACKUP_DATA
      }), "backup_data");

      // Скроллим страницу к div.post.topicpost
      const topicPost = document.querySelector("div.post.topicpost");
      if (topicPost) {
        topicPost.scrollIntoView({ behavior: "smooth", block: "start" });
        log("🟦 [BACKUP] Скролл к div.post.topicpost выполнен");
      } else {
        warn("⚠️ [BACKUP] div.post.topicpost не найден");
      }
    }
  }

  // Экспортируем функцию в глобальную область видимости для использования в onclick
  window.bankCommentEditFromBackup = bankCommentEditFromBackup;
  return bankCommentEditFromBackup;
}
