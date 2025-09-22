// admin_bridge.js (UTF8/CP1251-safe loader + correct POST + post-verify + main-marker redirect)
// Экспортирует: window.skinAdmin.load(userId) -> { status, initialHtml, save(newHtml), targetUserId }

(function () {
  'use strict';
  if (window.skinAdmin) return;

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
    const mkEditUrl = (uid) => new URL(`/admin_pages.php?edit_page=usr${uid}_skin`, location.origin).toString();
    const findMainMarker = (html) => {
      const m = String(html || '').match(/<!--\s*main:\s*usr(\d+)_skin\s*-->/i);
      return m ? m[1] : null; // "M" либо null
    };

    // Шаг 0: грузим исходную N-страницу
    let currentId = String(userId);
    let editUrl   = mkEditUrl(currentId);

    let html = await getHtml(editUrl);
    let doc  = toDoc(html);

    // доступ
    const bodyText = (doc.body && doc.body.textContent || '').trim();
    if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText)) {
      return { status: 'ошибка доступа к персональной странице' };
    }

    // Шаг 1: проверяем маркер <!-- main: usrM_skin -->
    const mainId1 = findMainMarker(html);
    if (mainId1) {
      if (mainId1 === currentId) {
        console.error('Найден цикл');
        return { status: 'ошибка: найден цикл main-страниц' };
      }
      // переходим на M
      const nextId  = mainId1;
      const nextUrl = mkEditUrl(nextId);
      const html2   = await getHtml(nextUrl);
      const doc2    = toDoc(html2);

      const bodyText2 = (doc2.body && doc2.body.textContent || '').trim();
      if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText2)) {
        return { status: 'ошибка доступа к персональной странице' };
      }

      const mainId2 = findMainMarker(html2);
      if (mainId2) {
        // второй маркер — считаем цикл (какая-то цепочка)
        console.error('Найден цикл');
        return { status: 'ошибка: найден цикл main-страниц' };
      }

      // фиксация целевой страницы
      currentId = nextId;
      editUrl   = nextUrl;
      html      = html2;
      doc       = doc2;
    }

    // Шаг 2: как и прежде — находим форму/textarea на ЦЕЛЕВОЙ странице
    const form = doc.querySelector('form[action*="admin_pages.php"]') || doc.querySelector('form');
    const ta   = doc.querySelector('#page-content,[name="content"]');
    if (!form || !ta) return { status: 'ошибка: не найдены форма или textarea' };

    const initialHtml = ta.value || '';

    // Пост-верификация чтением именно целевой страницы
    async function verifySaved(expectedHtml) {
      try {
        const checkHtml = await getHtml(editUrl);
        const checkDoc  = toDoc(checkHtml);
        const checkTa   = checkDoc.querySelector('#page-content,[name="content"]');
        if (!checkTa) return false;
        return normalizeHtml(checkTa.value) === normalizeHtml(expectedHtml);
      } catch {
        return false;
      }
    }

    // Шаг 3: save(newHtml) — сохраняем на ЦЕЛЕВОЙ странице (currentId)
    async function save(newHtml) {
      // берём СВЕЖУЮ форму (на случай токенов/hidden)
      const freshHtml = await getHtml(editUrl);
      const freshDoc  = toDoc(freshHtml);
      const fForm = freshDoc.querySelector('form[action*="admin_pages.php"]') || freshDoc.querySelector('form');
      const fTa   = freshDoc.querySelector('#page-content,[name="content"]');
      if (!fForm || !fTa) return { ok: false, status: 'ошибка: не найдены форма/textarea при сохранении' };

      // новый контент
      fTa.value = newHtml;

      // фактический адрес POST — из action формы
      const postUrl = new URL(fForm.getAttribute('action') || editUrl, location.origin).toString();

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

      return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
    }

    // Возвращаем целевой ID — полезно для внешних сохранителей (FMVeditTextareaOnly)
    return { status: 'ok', initialHtml, save, targetUserId: currentId };
  }

  window.skinAdmin = { load: loadSkinAdmin };
})();
