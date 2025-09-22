// admin_bridge.js (UTF8/CP1251-safe loader + correct POST + post-verify + main-marker redirect + DEBUG logs)
// Экспортирует: window.skinAdmin.load(userId) -> { status, initialHtml, save(newHtml), targetUserId }

(function () {
  'use strict';
  if (window.skinAdmin) return;

  // === DEBUG ===
  // Включение логов: поставь window.SKIN_DEBUG = true (или DEBUG_SKIN_ADMIN)
  const DEBUG = !!(window.SKIN_DEBUG || (window.SKIN && window.SKIN.debug) || window.DEBUG_SKIN_ADMIN || true);
  const LOGTAG = '[admin_bridge]';
  const log = (...a) => { if (DEBUG) try { console.log(LOGTAG, ...a); } catch {} };
  const warn = (...a) => { if (DEBUG) try { console.warn(LOGTAG, ...a); } catch {} };
  const err = (...a) => { try { console.error(LOGTAG, ...a); } catch {} };

  // Универсальный загрузчик HTML (если есть твой fetchHtml — используем его)
  const getHtml = (typeof window.fetchHtml === 'function')
    ? window.fetchHtml
    : async (url) => (await fetch(url, { credentials: 'include' })).text();

  const toDoc = (html) => new DOMParser().parseFromString(html, 'text/html');

  function normalizeHtml(s) {
    return String(s || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/&quot;/g, '"')
      .replace(/>\s+</g, '><')
      .replace(/[ \t\n]+/g, ' ')
      .replace(/\s*=\s*/g, '=')
      .trim();
  }

  async function loadSkinAdmin(userId) {
    log('start loadSkinAdmin()', { requestedUserId: String(userId), from: location.href });

    const mkEditUrl = (uid) => new URL(`/admin_pages.php?edit_page=usr${uid}_skin`, location.origin).toString();
    const findMainMarker = (html) => {
      const m = String(html || '').match(/<!--\s*main:\s*usr(\d+)_skin\s*-->/i);
      return m ? m[1] : null; // "M" либо null
    };

    // Шаг 0: грузим исходную N-страницу
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

    // Шаг 1: проверяем маркер <!-- main: usrM_skin -->
    const mainId1 = findMainMarker(html);
    log('main marker on initial?', { currentId, marker: mainId1 || 'none' });

    if (mainId1) {
      if (mainId1 === currentId) {
        err('Найден цикл (self-reference)', { currentId, editUrl });
        return { status: 'ошибка: найден цикл main-страниц' };
      }
      // переходим на M
      const nextId  = mainId1;
      const nextUrl = mkEditUrl(nextId);
      log('redirecting to main', { fromId: currentId, toId: nextId, nextUrl });

      const html2   = await getHtml(nextUrl);
      log('main page loaded', { nextId, nextUrl, length: (html2 || '').length });

      const doc2    = toDoc(html2);

      const bodyText2 = (doc2.body && doc2.body.textContent || '').trim();
      if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText2)) {
        warn('access denied on main page', { nextId, nextUrl });
        return { status: 'ошибка доступа к персональной странице' };
      }

      const mainId2 = findMainMarker(html2);
      log('main marker on redirected?', { nextId, marker: mainId2 || 'none' });

      if (mainId2) {
        err('Найден цикл (chain)', { startId: currentId, firstMain: mainId1, secondMain: mainId2 });
        return { status: 'ошибка: найден цикл main-страниц' };
      }

      // фиксация целевой страницы
      currentId = nextId;
      editUrl   = nextUrl;
      html      = html2;
      doc       = doc2;
      log('target fixed', { targetUserId: currentId, editUrl });
    } else {
      log('no main marker, stay on initial', { targetUserId: currentId, editUrl });
    }

    // Шаг 2: находим форму/textarea на ЦЕЛЕВОЙ странице
    log('parsing form & textarea on target page', { targetUserId: currentId, editUrl });
    const form = doc.querySelector('form[action*="admin_pages.php"]') || doc.querySelector('form');
    const ta   = doc.querySelector('#page-content,[name="content"]');
    if (!form || !ta) {
      err('form or textarea not found on target page', { targetUserId: currentId, editUrl });
      return { status: 'ошибка: не найдены форма или textarea' };
    }

    const initialHtml = ta.value || '';
    log('initialHtml extracted', { targetUserId: currentId, length: initialHtml.length });

    // Пост-верификация чтением именно целевой страницы
    async function verifySaved(expectedHtml) {
      try {
        log('verifySaved() begin', { targetUserId: currentId, editUrl });
        const checkHtml = await getHtml(editUrl);
        const checkDoc  = toDoc(checkHtml);
        const checkTa   = checkDoc.querySelector('#page-content,[name="content"]');
        if (!checkTa) {
          warn('verifySaved: textarea not found on re-read', { targetUserId: currentId, editUrl });
          return false;
        }
        const ok = normalizeHtml(checkTa.value) === normalizeHtml(expectedHtml);
        log('verifySaved() end', { targetUserId: currentId, ok });
        return ok;
      } catch (e) {
        warn('verifySaved error', e);
        return false;
      }
    }

    // Шаг 3: save(newHtml) — сохраняем на ЦЕЛЕВОЙ странице (currentId)
    async function save(newHtml) {
      log('save() begin', { targetUserId: currentId, editUrl, newHtmlLength: (newHtml || '').length });

      // берём СВЕЖУЮ форму (на случай токенов/hidden)
      const freshHtml = await getHtml(editUrl);
      const freshDoc  = toDoc(freshHtml);
      const fForm = freshDoc.querySelector('form[action*="admin_pages.php"]') || freshDoc.querySelector('form');
      const fTa   = freshDoc.querySelector('#page-content,[name="content"]');
      if (!fForm || !fTa) {
        err('save(): form/textarea not found on fresh read', { targetUserId: currentId, editUrl });
        return { ok: false, status: 'ошибка: не найдены форма/textarea при сохранении' };
      }

      // новый контент
      fTa.value = newHtml;

      // фактический адрес POST — из action формы
      const postUrl = new URL(fForm.getAttribute('action') || editUrl, location.origin).toString();
      log('save() POST', { targetUserId: currentId, postUrl });

      // имя submit-кнопки
      const submitBtn = [...fForm.elements].find(el =>
        el.type === 'submit' && (el.name === 'save' || /сохр|save/i.test(el.value || el.textContent || ''))
      );
      const submitName  = submitBtn?.name  || 'save';
      const submitValue = submitBtn?.value || '1';

      // --- Ветвь A: CP1251-инструменты доступны
      if (typeof window.serializeFormCP1251_SelectSubmit === 'function' &&
          typeof window.fetchCP1251Text === 'function') {

        const body = window.serializeFormCP1251_SelectSubmit(fForm, submitName);
        const { res, text } = await window.fetchCP1251Text(postUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=windows-1251' },
          referrer: editUrl,
          referrerPolicy: 'strict-origin-when-cross-origin',
          body
        });

        const okByText = /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text);
        let ok = (res.ok || okByText || res.redirected);
        if (!ok) ok = await verifySaved(newHtml); // пост-верификация
        log('save() end [CP1251]', { targetUserId: currentId, resOk: res.ok, redirected: res.redirected, okByText, ok });
        return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
      }

      // --- Ветвь B: современный путь — FormData + submit + проверка текста
      const fd = new FormData(fForm);
      fd.set(fTa.getAttribute('name') || 'content', fTa.value);
      fd.append(submitName, submitValue);

      const res  = await fetch(postUrl, {
        method: 'POST',
        credentials: 'include',
        body: fd,
        referrer: editUrl,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });
      const text = await res.text();

      const okByText = /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text);
      let ok = (res.ok || okByText || res.redirected);
      if (!ok) ok = await verifySaved(newHtml); // пост-верификация
      log('save() end [FormData]', { targetUserId: currentId, resOk: res.ok, redirected: res.redirected, okByText, ok });

      return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
    }

    log('loadSkinAdmin() ready', { targetUserId: currentId, editUrl });
    return { status: 'ok', initialHtml, save, targetUserId: currentId };
  }

  window.skinAdmin = { load: loadSkinAdmin };
})();
