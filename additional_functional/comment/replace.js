// fmv.replace_comment.js
(() => {
  'use strict';

  // безопасные заглушки, если common.js не дал функций
  if (typeof window.extractErrorMessage !== 'function') window.extractErrorMessage = () => '';
  if (typeof window.extractInfoMessage  !== 'function') window.extractInfoMessage  = () => '';
  if (typeof window.classifyResult      !== 'function') window.classifyResult      = () => 'ok';

  /**
   * Заменяет текст комментария у поста (только /edit.php?id=PID).
   * Требуются helpers/common: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit,
   * classifyResult, extractInfoMessage, extractErrorMessage, getCurrentGroupId.
   *
   * @param {Array<number|string>} allowedGroups
   * @param {number|string} postId
   * @param {string} newText
   * @returns {Promise<{ok:boolean,status:string,rawStatus?:any,postId:string,oldText?:string,newText:string,httpStatus?:number,infoMessage?:string,errorMessage?:string}>}
   */
  async function replaceComment(allowedGroups, postId, newText) {
    // 0) проверка группы
    const gid = (typeof window.getCurrentGroupId === 'function') ? window.getCurrentGroupId() : null;
    const allow = new Set((allowedGroups || []).map(x => String(Number(x))));
    if (!gid || !allow.has(String(Number(gid)))) {
      const msg = 'Нет доступа по группе';
      console.warn('[replaceComment]', msg, { gid, allowedGroups });
      return { ok:false, status:'forbidden', postId:String(postId), newText, errorMessage:msg };
    }

    // 1) проверим postId
    const pidNum = parseInt(postId, 10);
    if (!Number.isFinite(pidNum)) {
      const msg = `Некорректный postId: ${postId}`;
      console.error('[replaceComment]', msg);
      return { ok:false, status:'badid', postId:String(postId), newText, errorMessage:msg };
    }

    const PID = String(pidNum);
    const editUrl = `/edit.php?id=${encodeURIComponent(PID)}`;

    try {
      // 2) GET формы редактирования
      console.log(`[replaceComment] → GET ${editUrl}`);
      let doc, form, msgField, pageHtml = '';
      try {
        doc = await fetchCP1251Doc(editUrl);
        pageHtml = doc.documentElement ? doc.documentElement.outerHTML : '';
        msgField = doc.querySelector('textarea#main-reply[name="req_message"], textarea[name="req_message"]');
        if (msgField) form = msgField.closest('form');
      } catch (e) {
        const msg = e?.message || String(e);
        console.error('[replaceComment] Транспортная ошибка при GET:', msg);
        return { ok:false, status:'transport', postId:PID, newText, errorMessage:msg };
      }

      if (!form || !msgField) {
        // нет формы — вернём статус и сообщения из страницы
        const infoMessage  = pageHtml ? extractInfoMessage(pageHtml)  : '';
        const errorMessage = pageHtml ? extractErrorMessage(pageHtml) : '';
        const status       = pageHtml ? (classifyResult(pageHtml) || 'noform') : 'noform';
        console.error(`[replaceComment] ✖ Форма редактирования не найдена (статус: ${status}).`);
        if (errorMessage) console.error(errorMessage); else if (infoMessage) console.info(infoMessage);
        return { ok:false, status, postId:PID, newText, infoMessage, errorMessage };
      }

      // 3) старый текст → подставляем новый
      const oldText = String(msgField.value || '').trim();
      msgField.value = newText;

      // 4) сериализация и POST
      const submitName =
        [...form.elements].find(el => el.type === 'submit' && (el.name || /Отправ|Сохран|Submit|Save/i.test(el.value || '')))?.name
        || 'submit';

      const body = serializeFormCP1251_SelectSubmit(form, submitName);

      console.log(`[replaceComment] → POST ${editUrl}`);
      const { res, text } = await fetchCP1251Text(editUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        referrer: editUrl,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });

      // 5) разбор ответа
      const infoMessage  = extractInfoMessage(text) || '';
      const errorMessage = extractErrorMessage(text) || '';
      const statusRaw    = classifyResult(text);
      const statusText =
        (typeof statusRaw === 'string') ? statusRaw :
        (statusRaw && (statusRaw.status || statusRaw.code || (statusRaw.ok ? 'ok' : 'server'))) || 'server';

      const clip = s => (s && s.length > 500 ? s.slice(0, 500) + '…' : s);

      if (res.ok && statusText === 'ok') {
        console.info(`[replaceComment] ✅ #${PID} обновлён.${infoMessage ? ' ' + clip(infoMessage) : ''}`);
        return { ok:true, status:statusText, rawStatus:statusRaw, postId:PID, oldText, newText, httpStatus:res.status, infoMessage };
      } else {
        console.error(`[replaceComment] ✖ #${PID} не обновлён. Статус: ${statusText}`);
        const em = clip(errorMessage) || clip(infoMessage);
        if (em) console.error(em);
        return { ok:false, status:statusText, rawStatus:statusRaw, postId:PID, oldText, newText, httpStatus:res.status, infoMessage, errorMessage };
      }

    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[replaceComment] Ошибка выполнения:', msg);
      return { ok:false, status:'transport', postId:String(postId), newText, errorMessage:msg };
    }
  }

  // экспорт
  window.FMV = window.FMV || {};
  window.FMV.replaceComment = replaceComment;
})();
