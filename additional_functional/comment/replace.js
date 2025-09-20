// fmv.replace_comment.js
(() => {
  'use strict';

  /**
   * Заменяет текст комментария у поста.
   * Использует только /edit.php?id=PID
   *
   * Требует подключённых helpers/common:
   *  - fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit
   *  - classifyResult, extractInfoMessage, extractErrorMessage
   *  - getCurrentGroupId (из check_group.js)
   *
   * @param {Array<number|string>} allowedGroups  Разрешённые ID групп
   * @param {number|string} postId                ID поста
   * @param {string} newText                      Новый текст (BBCode/HTML как нужно форуму)
   * @returns {Promise<{
   *   ok:boolean, status:string, postId:string, oldText?:string, newText:string,
   *   httpStatus?:number, infoMessage?:string, errorMessage?:string
   * }>}
   */
  async function replaceComment(allowedGroups, postId, newText) {
    // 0) Проверка группы
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
      // 1) Грузим страницу редактирования (ТОЛЬКО /edit.php?id=PID)
      console.log(`[replaceComment] → GET ${editUrl}`);
      let doc, form, msgField, pageHtml = '';
      try {
        doc = await fetchCP1251Doc(editUrl); // helper
        pageHtml = doc.documentElement ? doc.documentElement.outerHTML : '';

        // Основное поле твоего шаблона:
        msgField = doc.querySelector(
          'textarea#main-reply[name="req_message"], textarea[name="req_message"]'
        );
        if (msgField) form = msgField.closest('form');
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        console.error('[replaceComment] Транспортная ошибка при GET:', msg);
        return {
          ok: false,
          status: 'transport',
          postId: PID,
          newText,
          errorMessage: msg
        };
      }

      if (!form || !msgField) {
        // Формы нет — разберём сообщение, которое отдал форум (например, «нет прав»)
        const infoMessage  = pageHtml ? extractInfoMessage(pageHtml)  : '';
        const errorMessage = pageHtml ? extractErrorMessage(pageHtml) : '';
        const status       = pageHtml ? (classifyResult(pageHtml) || 'noform') : 'noform';

        console.error(`[replaceComment] ✖ Форма редактирования не найдена по edit.php (статус: ${status}).`);
        if (errorMessage) console.error(errorMessage);
        else if (infoMessage) console.info(infoMessage);

        return {
          ok: false,
          status,
          postId: PID,
          newText,
          infoMessage,
          errorMessage
        };
      }

      // 2) Старый текст
      const oldText = String(msgField.value || '').trim();

      // 3) Подставляем новый текст
      msgField.value = newText;

      // 4) Сериализация формы и POST
      const submitName =
        [...form.elements].find(el =>
          el.type === 'submit' &&
          (el.name || /Отправ|Сохран|Submit|Save/i.test(el.value || ''))
        )?.name || 'submit';

      const body = serializeFormCP1251_SelectSubmit(form, submitName); // helper

      console.log(`[replaceComment] → POST ${editUrl}`);
      const { res, text } = await fetchCP1251Text(editUrl, {           // helper
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        referrer: editUrl,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });

      // 5) Разбор ответа (как в create)
      const infoMessage  = extractInfoMessage(text);
      const errorMessage = extractErrorMessage(text);
      const status       = classifyResult(text);

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
      console.error('[replaceComment] Ошибка выполнения:', msg);
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
