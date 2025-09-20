// fmv.replace_comment.js
(() => {
  'use strict';

  /**
   * Заменяет комментарий поста с учётом проверки группы.
   * @param {Array<string|number>} allowedGroups
   * @param {string|number} postId
   * @param {string} newText
   * @returns {Promise<{
   *   ok: boolean,
   *   status: string,
   *   postId: string,
   *   oldText?: string,
   *   newText: string,
   *   httpStatus?: number,
   *   infoMessage?: string,
   *   errorMessage?: string
   * }>}
   */
  async function replaceComment(allowedGroups, postId, newText) {
    // --- проверка группы ---
    const gid = (typeof window.getCurrentGroupId === 'function')
      ? window.getCurrentGroupId()
      : null;
    const allow = new Set((allowedGroups || []).map(x => String(Number(x))));
    if (!gid || !allow.has(String(Number(gid)))) {
      const msg = `Нет доступа по группе (текущая группа: ${gid})`;
      console.warn('[replaceComment]', msg);
      return {
        ok: false,
        status: 'forbidden',
        postId: String(postId),
        newText,
        errorMessage: msg
      };
    }

    const PID = String(Number(postId));
    const editUrl = `/edit.php?id=${encodeURIComponent(PID)}&action=edit`;

    try {
      // --- грузим форму редактирования ---
      const doc  = await fetchCP1251Doc(editUrl);
      const form = doc.querySelector('form[action*="edit.php"]');
      if (!form) {
        const msg = 'Форма редактирования не найдена';
        console.error('[replaceComment]', msg);
        return {
          ok: false,
          status: 'noform',
          postId: PID,
          newText,
          errorMessage: msg
        };
      }

      // --- старый текст ---
      const msgField = form.querySelector('[name="req_message"], textarea[name="message"]');
      const oldText  = String(msgField?.value || '').trim();

      // --- новый текст ---
      if (msgField) msgField.value = newText;

      // --- сериализация и отправка ---
      const submitName = [...form.elements].find(
        el => el.type === 'submit' && (el.name === 'submit' || /Отправ/i.test(el.value || ''))
      )?.name || 'submit';
      const body = serializeFormCP1251_SelectSubmit(form, submitName);

      const { res, text } = await fetchCP1251Text(editUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        referrer: editUrl,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });

      // --- разбор ответа (как в create) ---
      const infoMessage  = extractInfoMessage(text);
      const errorMessage = extractErrorMessage(text);
      const status       = classifyResult(text);

      if (res.ok && status === 'ok') {
        console.info(`[replaceComment] ✅ #${PID} обновлён. ${infoMessage || ''}`);
        return {
          ok: true,
          status,
          postId: PID,
          oldText,
          newText,
          httpStatus: res.status,
          infoMessage
        };
      } else {
        console.error(`[replaceComment] ✖ #${PID} не обновлён. ${errorMessage || infoMessage || ''}`);
        return {
          ok: false,
          status: status || 'server',
          postId: PID,
          oldText,
          newText,
          httpStatus: res.status,
          infoMessage,
          errorMessage
        };
      }

    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.error('[replaceComment] Транспортная ошибка:', msg);
      return {
        ok: false,
        status: 'transport',
        postId: String(postId),
        newText,
        errorMessage: msg
      };
    }
  }

  // экспорт
  window.FMV = window.FMV || {};
  window.FMV.replaceComment = replaceComment;
})();
