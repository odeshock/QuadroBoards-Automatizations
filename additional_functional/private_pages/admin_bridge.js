async function loadSkinAdmin(userId) {
  // DEBUG helpers (оставь как есть, если у тебя уже заведены логгеры)
  const DEBUG = !!(window.SKIN_DEBUG || (window.SKIN && window.SKIN.debug) || window.DEBUG_SKIN_ADMIN || true);
  const LOGTAG = '[admin_bridge]';
  const log  = (...a) => { if (DEBUG) try { console.log(LOGTAG, ...a); } catch {} };
  const warn = (...a) => { if (DEBUG) try { console.warn(LOGTAG, ...a); } catch {} };
  const err  = (...a) => { try { console.error(LOGTAG, ...a); } catch {} };

  const mkEditUrl = (uid) => new URL(`/admin_pages.php?edit_page=usr${uid}_skin`, location.origin).toString();

  // нормализуем строки и даём две регексы: обычную и для HTML-энкодинга
  const MAIN_RX_RAW  = /<!--\s*main\s*:\s*usr\s*(\d+)\s*_skin\s*-->/i;
  const MAIN_RX_HTML = /&lt;!--\s*main\s*:\s*usr\s*(\d+)\s*_skin\s*--&gt;/i;

  const htmlDecode = (s) => {
    const d = document.createElement('textarea');
    d.innerHTML = String(s || '');
    return d.value;
  };

  // пытаемся вытащить mainId из разных «слоёв»
  function extractMainIdFromDoc(doc, pageHtml, whereTag) {
    // 1) textarea.value
    const ta = doc.querySelector('#page-content,[name="content"]');
    if (ta) {
      const v = String(ta.value || '');
      let m = v.match(MAIN_RX_RAW);
      if (m) { log('main marker found in textarea (raw)', { at: whereTag, id: m[1] }); return m[1]; }
      // textarea могла содержать HTML-энкодинг — декодируем и ищем
      const dv = htmlDecode(v);
      m = dv.match(MAIN_RX_RAW);
      if (m) { log('main marker found in textarea (decoded)', { at: whereTag, id: m[1] }); return m[1]; }
      // иногда сам комментарий в textarea приходит закодированным прямо как &lt;!-- ... --&gt;
      m = v.match(MAIN_RX_HTML);
      if (m) { log('main marker found in textarea (html-encoded)', { at: whereTag, id: m[1] }); return m[1]; }
    }

    // 2) весь HTML страницы (вдруг маркер не в textarea, а где-то рядом)
    if (pageHtml) {
      let m = String(pageHtml).match(MAIN_RX_RAW);
      if (m) { log('main marker found in full HTML (raw)', { at: whereTag, id: m[1] }); return m[1]; }
      m = String(pageHtml).match(MAIN_RX_HTML);
      if (m) { log('main marker found in full HTML (html-encoded)', { at: whereTag, id: m[1] }); return m[1]; }
      const dec = htmlDecode(pageHtml);
      m = String(dec).match(MAIN_RX_RAW);
      if (m) { log('main marker found in full HTML (decoded)', { at: whereTag, id: m[1] }); return m[1]; }
    }

    log('main marker not found', { at: whereTag });
    return null;
  }

  // === 0) грузим исходную N-страницу
  let currentId = String(userId);
  let editUrl   = mkEditUrl(currentId);
  log('fetch initial page', { currentId, editUrl });

  let html = await getHtml(editUrl);
  log('initial page loaded', { currentId, editUrl, length: (html || '').length });

  let doc  = toDoc(html);

  // доступ
  const bodyText = (doc.body && doc.body.textContent || '').trim();
  if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText)) {
    warn('access denied on initial page', { currentId, editUrl });
    return { status: 'ошибка доступа к персональной странице' };
  }

  // === 1) ищем main-маркер где угодно (см. extractMainIdFromDoc)
  const mainId1 = extractMainIdFromDoc(doc, html, 'initial');
  if (mainId1) {
    if (mainId1 === currentId) {
      err('Найден цикл (self-reference)', { currentId, editUrl });
      return { status: 'ошибка: найден цикл main-страниц' };
    }

    // переходим на M
    const nextId  = mainId1;
    const nextUrl = mkEditUrl(nextId);
    log('redirecting to main', { fromId: currentId, toId: nextId, nextUrl });

    const html2 = await getHtml(nextUrl);
    log('main page loaded', { nextId, nextUrl, length: (html2 || '').length });

    const doc2  = toDoc(html2);

    const bodyText2 = (doc2.body && doc2.body.textContent || '').trim();
    if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText2)) {
      warn('access denied on main page', { nextId, nextUrl });
      return { status: 'ошибка доступа к персональной странице' };
    }

    const mainId2 = extractMainIdFromDoc(doc2, html2, 'redirected');
    if (mainId2) {
      err('Найден цикл (chain)', { startId: currentId, firstMain: mainId1, secondMain: mainId2 });
      return { status: 'ошибка: найден цикл main-страниц' };
    }

    // фиксируем целевую страницу
    currentId = nextId;
    editUrl   = nextUrl;
    html      = html2;
    doc       = doc2;
    log('target fixed', { targetUserId: currentId, editUrl });
  } else {
    log('no main marker, stay on initial', { targetUserId: currentId, editUrl });
  }

  // === 2) форма/textarea на ЦЕЛЕВОЙ странице
  log('parsing form & textarea on target page', { targetUserId: currentId, editUrl });
  const form = doc.querySelector('form[action*="admin_pages.php"]') || doc.querySelector('form');
  const ta   = doc.querySelector('#page-content,[name="content"]');
  if (!form || !ta) {
    err('form or textarea not found on target page', { targetUserId: currentId, editUrl });
    return { status: 'ошибка: не найдены форма или textarea' };
  }

  const initialHtml = ta.value || '';
  const preview = String(initialHtml).slice(0, 200).replace(/\n/g, '\\n');
  log('initialHtml extracted', { targetUserId: currentId, length: initialHtml.length, preview });

  // === 3) verifySaved / save — как раньше, но для editUrl (целевой страницы)
  async function verifySaved(expectedHtml) {
    try {
      log('verifySaved() begin', { targetUserId: currentId, editUrl });
      const checkHtml = await getHtml(editUrl);
      const checkDoc  = toDoc(checkHtml);
      const checkTa   = checkDoc.querySelector('#page-content,[name="content"]');
      if (!checkTa) { warn('verifySaved: textarea not found on re-read', { targetUserId: currentId, editUrl }); return false; }
      const ok = normalizeHtml(checkTa.value) === normalizeHtml(expectedHtml);
      log('verifySaved() end', { targetUserId: currentId, ok });
      return ok;
    } catch (e) { warn('verifySaved error', e); return false; }
  }

  async function save(newHtml) {
    log('save() begin', { targetUserId: currentId, editUrl, newHtmlLength: (newHtml || '').length });

    const freshHtml = await getHtml(editUrl);
    const freshDoc  = toDoc(freshHtml);
    const fForm = freshDoc.querySelector('form[action*="admin_pages.php"]') || freshDoc.querySelector('form');
    const fTa   = freshDoc.querySelector('#page-content,[name="content"]');
    if (!fForm || !fTa) {
      err('save(): form/textarea not found on fresh read', { targetUserId: currentId, editUrl });
      return { ok: false, status: 'ошибка: не найдены форма/textarea при сохранении' };
    }

    fTa.value = newHtml;
    const postUrl = new URL(fForm.getAttribute('action') || editUrl, location.origin).toString();
    log('save() POST', { targetUserId: currentId, postUrl });

    const submitBtn = [...fForm.elements].find(el => el.type === 'submit' && (el.name === 'save' || /сохр|save/i.test(el.value || el.textContent || '')));
    const submitName  = submitBtn?.name  || 'save';
    const submitValue = submitBtn?.value || '1';

    if (typeof window.serializeFormCP1251_SelectSubmit === 'function' &&
        typeof window.fetchCP1251Text === 'function') {
      const body = window.serializeFormCP1251_SelectSubmit(fForm, submitName);
      const { res, text } = await window.fetchCP1251Text(postUrl, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=windows-1251' },
        referrer: editUrl, referrerPolicy: 'strict-origin-when-cross-origin', body
      });
      const okByText = /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text);
      let ok = (res.ok || okByText || res.redirected);
      if (!ok) ok = await verifySaved(newHtml);
      log('save() end [CP1251]', { targetUserId: currentId, resOk: res.ok, redirected: res.redirected, okByText, ok });
      return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
    }

    const fd = new FormData(fForm);
    fd.set(fTa.getAttribute('name') || 'content', fTa.value);
    fd.append(submitName, submitValue);

    const res  = await fetch(postUrl, {
      method: 'POST', credentials: 'include', body: fd,
      referrer: editUrl, referrerPolicy: 'strict-origin-when-cross-origin'
    });
    const text = await res.text();

    const okByText = /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text);
    let ok = (res.ok || okByText || res.redirected);
    if (!ok) ok = await verifySaved(newHtml);
    log('save() end [FormData]', { targetUserId: currentId, resOk: res.ok, redirected: res.redirected, okByText, ok });

    return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
  }

  log('loadSkinAdmin() ready', { targetUserId: currentId, editUrl });
  return { status: 'ok', initialHtml, save, targetUserId: currentId };
}
