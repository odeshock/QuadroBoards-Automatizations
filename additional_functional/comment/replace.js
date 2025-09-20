// fmv.replace_comment.js
(() => {
  'use strict';

  // страховочные заглушки: если common.js чего-то не дал
  if (typeof window.extractErrorMessage !== 'function') window.extractErrorMessage = () => '';
  if (typeof window.extractInfoMessage  !== 'function') window.extractInfoMessage  = () => '';
  if (typeof window.classifyResult      !== 'function') window.classifyResult      = () => 'unknown';

  /**
   * Заменить текст комментария поста через /edit.php?id=PID&action=edit
   * Требует: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit, classifyResult, extractInfoMessage
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
      console.log(`[replaceComment] → GET ${editUrl}`);
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

      console.log(`[replaceComment] → POST ${editUrl}`);
      const { res, text } = await fetchCP1251Text(editUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        referrer: editUrl,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });

      // 5) первичный разбор ответа
      const infoMessage  = extractInfoMessage(text) || '';
      const errorMessage = extractErrorMessage(text) || '';
      const statusRaw    = classifyResult(text);
      let   statusText   =
        (typeof statusRaw === 'string') ? statusRaw :
        (statusRaw && (statusRaw.status || statusRaw.code || (statusRaw.ok ? 'ok' : 'server'))) || 'unknown';

      // 6) если форум не выдал явный «ok», проверим фактически
      if (res.ok && statusText === 'unknown') {
        try {
          // найдём ссылку «вернуться в тему»
          const m = text.match(/href="([^"]*viewtopic\.php\?id=\d+[^"]*)"/i);
          if (m) {
            const topicUrl = new URL(m[1], location.origin).href;
            const vDoc = await fetchCP1251Doc(topicUrl);
            const node = vDoc.querySelector(`#p${PID}-content`);
            const html = (node?.innerHTML || '').trim();
            // простая проверка: значимый фрагмент нового текста попал в пост
            const probe = String(newText).slice(0, 50).replace(/\s+/g, ' ').trim();
            if (probe && html.replace(/\s+/g,' ').includes(probe)) {
              statusText = 'ok'; // считаем успехом
            }
          }
        } catch {/* ignore */}
      }

      // 7) финал
      const clip = s => (s && s.length > 500 ? s.slice(0, 500) + '…' : s);
      if (res.ok && statusText === 'ok') {
        console.info(`[replaceComment] ✅ #${PID} обновлён.`);
        return { ok:true, status:'ok', rawStatus:statusRaw, postId:PID, oldText, newText, httpStatus:res.status, infoMessage };
      } else {
        console.error(`[replaceComment] ✖ #${PID} не обновлён. Статус: ${statusText}`);
        const em = clip(errorMessage) || clip(infoMessage);
        if (em) console.error(em);
        return { ok:false, status:statusText, rawStatus:statusRaw, postId:PID, oldText, newText, httpStatus:res.status, infoMessage, errorMessage };
      }

    } catch (err) {
      return { ok:false, status:'transport', postId:String(postId), newText, errorMessage:(err?.message || String(err)) };
    }
  }

  window.FMV = window.FMV || {};
  window.FMV.replaceComment = replaceComment;
})();
