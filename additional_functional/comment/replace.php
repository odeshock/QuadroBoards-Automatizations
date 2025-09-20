// fmv.replace_comment.js
(() => {
  'use strict';

  /**
   * Заменяет текст комментария у поста.
   * @param {Array<number|string>} allowedGroups  Разрешённые ID групп
   * @param {number|string} postId                ID поста
   * @param {string} newText                      Новый текст (HTML/BBcode)
   * @returns {Promise<{
   *   ok:boolean, status:string, postId:string, oldText?:string, newText:string,
   *   httpStatus?:number, infoMessage?:string, errorMessage?:string
   * }>}
   */
  async function replaceComment(allowedGroups, postId, newText) {
    // --- 0) проверка группы (готовая функция getCurrentGroupId) ---
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
    const editUrl = `/edit.php?id=${encodeURIComponent(PID)}`;

    try {
      // --- 1) грузим страницу редактирования ТОЛЬКО по /edit.php?id=PID ---
      let doc, form, msgField;
      try {
        doc = await fetchCP1251Doc(editUrl); // helper из helpers.js
        // поле сообщения (как в твоём шаблоне)
        msgField = doc.querySelector(
          'textarea#main-reply[name="req_message"], textarea[name="req_message"]'
        );
        if (msgField) {
          form = msgField.closest('form');
        }
      } catch {}

      if (!form || !msgField) {
        const msg = 'Форма редактирования не найдена по адресу edit.php';
        console.error('[replaceComment]', msg);
        return {
          ok: false,
          status: 'noform',
          postId: PID,
          newText,
          errorMessage: msg
        };
      }

      // --- 2) старый текст ---
      const oldText = String(msgField.value || '').trim();

      // --- 3) подставляем новый текст ---
      msgField.value = newText;

      // --- 4) сериализация формы и POST (готовые helpers) ---
      const submitName =
        [...form.elements].find(el =>
          el.type === 'submit' &&
          (el.name || /Отправ|Сохран|Submit|Save/i.test(el.value || ''))
        )?.name || 'submit';

      const body = serializeFormCP1251_SelectSubmit(form, submitName); // helper

      const { res, text } = await fetchCP1251Text(editUrl, {           // helper
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        referrer: editUrl,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });

      // --- 5) анализ ответа (как в create) ---
      const infoMessage  = extractInfoMessage(text);  // из common.js
      const errorMessage = extractErrorMessage(text); // из common.js
      const status       = classifyResult(text);      // из common.js

      if (res.ok && status === 'ok') {
        console.info(`[replaceComment] ✅ #${PID} обновлён.${infoMessage ? ' ' + infoMessage : ''}`);
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
        console.error(`[replaceComment] ✖ #${PID} не обновлён. Статус: ${status || 'server'}`);
        if (errorMessage) console.error(errorMessage);
        else if (infoMessage) console.info(infoMessage);
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

  // экспорт под FMV
  window.FMV = window.FMV || {};
  window.FMV.replaceComment = replaceComment;

})();
