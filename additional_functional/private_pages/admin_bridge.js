// ИЩЕМ МАРКЕР ТОЛЬКО В TEXTAREA: <!-- main: usrM_skin -->
async function loadSkinAdmin(userId) {
  const DEBUG = !!(window.SKIN_DEBUG || (window.SKIN && window.SKIN.debug) || window.DEBUG_SKIN_ADMIN);
  const log  = (...a) => { if (DEBUG) try { console.log('[admin_bridge]', ...a); } catch {} };
  const err  = (...a) => { try { console.error('[admin_bridge]', ...a); } catch {} };

  const mkEditUrl = (uid) => new URL(`/admin_pages.php?edit_page=usr${uid}_skin`, location.origin).toString();

  // Регексы на маркер в textarea; допускают лишние пробелы
  const MAIN_RX_RAW  = /<!--\s*main\s*:\s*usr\s*(\d+)\s*_skin\s*-->/i;
  const MAIN_RX_HTML = /&lt;!--\s*main\s*:\s*usr\s*(\d+)\s*_skin\s*--&gt;/i;
  const htmlDecode = (s) => { const t=document.createElement('textarea'); t.innerHTML = String(s||''); return t.value; };

  // Возвращает ID из textarea И ТОЛЬКО ИЗ НЕЁ (raw → decoded → html-encoded)
  function extractMainIdFromTextarea(doc, whereTag) {
    const ta = doc.querySelector('#page-content,[name="content"]');
    if (!ta) return { id: null, value: '' };
    const v = String(ta.value || '');
    let m = v.match(MAIN_RX_RAW);
    if (m) { log('main marker (textarea raw)', { at: whereTag, id: m[1] }); return { id: m[1], value: v }; }
    const dv = htmlDecode(v);
    m = dv.match(MAIN_RX_RAW);
    if (m) { log('main marker (textarea decoded)', { at: whereTag, id: m[1] }); return { id: m[1], value: v }; }
    m = v.match(MAIN_RX_HTML);
    if (m) { log('main marker (textarea html-encoded)', { at: whereTag, id: m[1] }); return { id: m[1], value: v }; }
    log('no main marker in textarea', { at: whereTag });
    return { id: null, value: v };
  }

  // 0) грузим исходную N-страницу
  let currentId = String(userId);
  let editUrl   = mkEditUrl(currentId);
  log('fetch initial page', { currentId, editUrl });

  const html = await getHtml(editUrl);
  const doc  = toDoc(html);

  // доступ
  const bodyText = (doc.body && doc.body.textContent || '').trim();
  if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText)) {
    return { status: 'ошибка доступа к персональной странице' };
  }

  // ищем маркер ТОЛЬКО в textarea исходной страницы
  const { id: mainId1, value: taVal1 } = extractMainIdFromTextarea(doc, 'initial');
  if (mainId1) {
    if (mainId1 === currentId) {
      err('Найден цикл (self-reference)', { currentId, editUrl });
      return { status: 'ошибка: найден цикл main-страниц' };
    }

    // 1) редирект на M
    const nextId  = mainId1;
    const nextUrl = mkEditUrl(nextId);
    log('redirecting to main', { fromId: currentId, toId: nextId, nextUrl });

    const html2 = await getHtml(nextUrl);
    const doc2  = toDoc(html2);

    const bodyText2 = (doc2.body && doc2.body.textContent || '').trim();
    if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText2)) {
      return { status: 'ошибка доступа к персональной странице' };
    }

    // 2) проверяем textarea целевой страницы на второй маркер (цикл?)
    const { id: mainId2, value: taVal2 } = extractMainIdFromTextarea(doc2, 'redirected');
    if (mainId2) {
      err('Найден цикл (chain)', { startId: currentId, firstMain: mainId1, secondMain: mainId2 });
      return { status: 'ошибка: найден цикл main-страниц' };
    }

    // целевая страница зафиксирована
    currentId = nextId;
    editUrl   = nextUrl;

    // финализируем с doc2/taVal2
    return finalize(currentId, editUrl, doc2, taVal2);
  }

  // без маркера — работаем по исходной
  return finalize(currentId, editUrl, doc, taVal1);

  // --- общий хвост: парсим форму, готовим save/verify на targetUrl
  async function finalize(targetId, targetUrl, parsedDoc, textareaValue) {
    log('finalize on target', { targetUserId: targetId, targetUrl });

    const form = parsedDoc.querySelector('form[action*="admin_pages.php"]') || parsedDoc.querySelector('form');
    const ta   = parsedDoc.querySelector('#page-content,[name="content"]');
    if (!form || !ta) return { status: 'ошибка: не найдены форма или textarea' };

    const initialHtml = String(textareaValue ?? ta.value ?? '');

    async function verifySaved(expectedHtml) {
      try {
        const checkHtml = await getHtml(targetUrl);
        const checkDoc  = toDoc(checkHtml);
        const checkTa   = checkDoc.querySelector('#page-content,[name="content"]');
        if (!checkTa) return false;
        return normalizeHtml(checkTa.value) === normalizeHtml(expectedHtml);
      } catch { return false; }
    }

    async function save(newHtml) {
      const freshHtml = await getHtml(targetUrl);
      const freshDoc  = toDoc(freshHtml);
      const fForm = freshDoc.querySelector('form[action*="admin_pages.php"]') || freshDoc.querySelector('form');
      const fTa   = freshDoc.querySelector('#page-content,[name="content"]');
      if (!fForm || !fTa) return { ok: false, status: 'ошибка: не найдены форма/textarea при сохранении' };

      fTa.value = newHtml;
      const postUrl = new URL(fForm.getAttribute('action') || targetUrl, location.origin).toString();

      const submitBtn = [...fForm.elements].find(el => el.type === 'submit' && (el.name === 'save' || /сохр|save/i.test(el.value || el.textContent || '')));
      const submitName  = submitBtn?.name  || 'save';
      const submitValue = submitBtn?.value || '1';

      if (typeof window.serializeFormCP1251_SelectSubmit === 'function' &&
          typeof window.fetchCP1251Text === 'function') {
        const body = window.serializeFormCP1251_SelectSubmit(fForm, submitName);
        const { res, text } = await window.fetchCP1251Text(postUrl, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=windows-1251' },
          referrer: targetUrl, referrerPolicy: 'strict-origin-when-cross-origin', body
        });
        const okByText = /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text);
        let ok = (res.ok || okByText || res.redirected);
        if (!ok) ok = await verifySaved(newHtml);
        return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
      }

      const fd = new FormData(fForm);
      fd.set(fTa.getAttribute('name') || 'content', fTa.value);
      fd.append(submitName, submitValue);

      const res  = await fetch(postUrl, {
        method: 'POST', credentials: 'include', body: fd,
        referrer: targetUrl, referrerPolicy: 'strict-origin-when-cross-origin'
      });
      const text = await res.text();
      const okByText = /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text);
      let ok = (res.ok || okByText || res.redirected);
      if (!ok) ok = await verifySaved(newHtml);
      return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
    }

    return { status: 'ок', initialHtml, save, targetUserId: targetId };
  }
}
