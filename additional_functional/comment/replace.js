// fmv.replace_comment.js
(() => {
  'use strict';

  // страховки, если common.js чего-то не дал
  if (typeof window.extractErrorMessage !== 'function') window.extractErrorMessage = () => '';
  if (typeof window.extractInfoMessage  !== 'function') window.extractInfoMessage  = () => '';
  if (typeof window.classifyResult      !== 'function') window.classifyResult      = () => 'unknown';

  async function replaceComment(allowedGroups, postId, newText) {
    // доступ по группе
    const gid = (typeof window.getCurrentGroupId === 'function') ? window.getCurrentGroupId() : null;
    const allow = new Set((allowedGroups || []).map(x => String(Number(x))));
    if (!gid || !allow.has(String(Number(gid)))) {
      return { ok:false, status:'forbidden', postId:String(postId), newText, errorMessage:'Нет доступа по группе' };
    }

    // корректный PID
    const pidNum = parseInt(postId, 10);
    if (!Number.isFinite(pidNum)) {
      return { ok:false, status:'badid', postId:String(postId), newText, errorMessage:`Некорректный postId: ${postId}` };
    }
    const PID = String(pidNum);
    const editUrl = `/edit.php?id=${encodeURIComponent(PID)}&action=edit`;

    try {
      // GET
      let doc, form, msgField, pageHtml = '';
      try {
        doc = await fetchCP1251Doc(editUrl);
        pageHtml = doc.documentElement ? doc.documentElement.outerHTML : '';
        msgField = doc.querySelector('textarea#main-reply[name="req_message"], textarea[name="req_message"]');
        form = msgField && msgField.closest('form');
      } catch (e) {
        return { ok:false, status:'transport', postId:PID, newText, errorMessage:(e?.message || String(e)) };
      }

      if (!form || !msgField) {
        const infoMessage  = extractInfoMessage(pageHtml)  || '';
        const errorMessage = extractErrorMessage(pageHtml) || '';
        const status       = classifyResult(pageHtml) || 'noform';
        return { ok:false, status, postId:PID, newText, infoMessage, errorMessage };
      }

      // подмена
      const oldText = String(msgField.value || '').trim();
      msgField.value = newText;

      // POST
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

      // разбор
      const infoMessage  = extractInfoMessage(text) || '';
      const errorMessage = extractErrorMessage(text) || '';
      let   statusText   = classifyResult(text) || 'unknown';

      // если 200, но сигнатуры не нашли — считаем, что ок (на деле пост обновился)
      if (res.ok && statusText === 'unknown') {
        statusText = 'ok';
      }

      if (res.ok && statusText === 'ok') {
        // никаких логов содержимого!
        return { ok:true, status:'ok', postId:PID, oldText, newText, httpStatus:res.status, infoMessage };
      } else {
        return { ok:false, status:statusText, postId:PID, oldText, newText, httpStatus:res.status, infoMessage, errorMessage };
      }

    } catch (err) {
      return { ok:false, status:'transport', postId:String(postId), newText, errorMessage:(err?.message || String(err)) };
    }
  }

  window.FMV = window.FMV || {};
  window.FMV.replaceComment = replaceComment;
})();
