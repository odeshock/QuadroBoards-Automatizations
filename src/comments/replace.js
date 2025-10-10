// fmv.replace_comment.js
(() => {
  'use strict';

  // страховки, если common.js чего-то не дал
  if (typeof window.extractErrorMessage !== 'function') window.extractErrorMessage = () => '';
  if (typeof window.extractInfoMessage  !== 'function') window.extractInfoMessage  = () => '';
  if (typeof window.classifyResult      !== 'function') window.classifyResult      = () => 'unknown';

  /**
   * Заменить текст комментария поста через /edit.php?id=PID&action=edit
   * Требует helpers/common: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit
   */
  async function replaceComment(allowedGroups, postId, newText) {
    // 0) доступ по группе
    const gid = (typeof window.getCurrentGroupId === 'function') ? window.getCurrentGroupId() : null;
    const allow = new Set((allowedGroups || []).map(x => String(Number(x))));
    if (!gid || !allow.has(String(Number(gid)))) {
      return { ok:false, status:'forbidden', postId:String(postId), newText, errorMessage:'Нет доступа по группе' };
    }

    // 1) валидный PID
    const pidNum = parseInt(postId, 10);
    if (!Number.isFinite(pidNum)) {
      return { ok:false, status:'badid', postId:String(postId), newText, errorMessage:`Некорректный postId: ${postId}` };
    }
    const PID = String(pidNum);
    const editUrl = `/edit.php?id=${encodeURIComponent(PID)}&action=edit`;

    try {
      // 2) GET формы редактирования
      let doc, form, msgField, pageHtml = '';
      try {
        doc = await fetchCP1251Doc(editUrl);
        pageHtml = doc.documentElement ? doc.documentElement.outerHTML : '';
        msgField = doc.querySelector('textarea#main-reply[name="req_message"], textarea[name="req_message"]');
        if (msgField) form = msgField.closest('form');
      } catch (e) {
        return { ok:false, status:'transport', postId:PID, newText, errorMessage:(e?.message || String(e)) };
      }
      if (!form || !msgField) {
        const infoMessage  = extractInfoMessage(pageHtml)  || '';
        const errorMessage = extractErrorMessage(pageHtml) || '';
        const status       = classifyResult(pageHtml) || 'noform';
        return { ok:false, status, postId:PID, newText, infoMessage, errorMessage };
      }

      // 3) подмена текста
      const oldText = String(msgField.value || '').trim();
      msgField.value = newText;

      // 4) сериализация + POST
      const submitName =
        [...form.elements].find(el => el.type === 'submit' && (el.name || /Отправ|Сохран|Submit|Save/i.test(el.value || '')))?.name
        || 'submit';

      const body = serializeFormCP1251_SelectSubmit(form, submitName);

      const { res, text } = await fetchCP1251Text(editUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        referrer: editUrl,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });

      // 5) разбираем ответ аккуратно (без простыней)
      const infoMessage  = extractInfoMessage(text) || '';
      const errorMessage = extractErrorMessage(text) || '';
      const raw          = classifyResult(text);

      // ► нормализуем статус в СТРОКУ
      let statusText =
        (typeof raw === 'string')
          ? raw
          : (raw && (raw.status || raw.code))
            ? String(raw.status || raw.code)
            : 'unknown';

      // ► если HTTP 200 и явной ошибки нет — принимаем как успех
      if (res.ok && (statusText === 'unknown' || statusText === '')) {
        statusText = 'ok';
      }

      // 6) финал (не логируем содержимое текста)
      if (res.ok && statusText === 'ok') {
        return {
          ok: true,
          status: 'ok',
          postId: PID,
          oldText,
          newText,
          httpStatus: res.status
        };
      } else {
        return {
          ok: false,
          status: statusText,
          postId: PID,
          oldText,
          newText,
          httpStatus: res.status,
          infoMessage:  infoMessage.slice(0, 200),
          errorMessage: errorMessage.slice(0, 200)
        };
      }

    } catch (err) {
      return { ok:false, status:'transport', postId:String(postId), newText, errorMessage:(err?.message || String(err)) };
    }
  }

  window.FMV = window.FMV || {};
  window.FMV.replaceComment = replaceComment;
})();
