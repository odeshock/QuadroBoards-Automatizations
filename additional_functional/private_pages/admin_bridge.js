// admin_bridge.js (UTF8/CP1251-safe loader + correct save)
// Экспортирует window.skinAdmin.load(userId) -> { status, initialHtml, save(newHtml) }

(function () {
  'use strict';
  if (window.skinAdmin) return;

  // 1) универсальный загрузчик HTML (если есть твой fetchHtml — используем его)
  const getHtml = (typeof window.fetchHtml === 'function')
    ? window.fetchHtml
    : async (url) => (await fetch(url, { credentials: 'include' })).text();

  const toDoc = (html) => new DOMParser().parseFromString(html, 'text/html');

  async function loadSkinAdmin(userId) {
    const editUrl = new URL(`/admin_pages.php?edit_page=usr${userId}_skin`, location.origin).toString();

    // 2) грузим страницу редактирования
    const html = await getHtml(editUrl);
    const doc  = toDoc(html);

    // базовые проверки доступа
    const bodyText = (doc.body && doc.body.textContent || '').trim();
    if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText)) {
      return { status: 'ошибка доступа к персональной странице' };
    }

    const form = doc.querySelector('form[action*="admin_pages.php"]') || doc.querySelector('form');
    const ta   = doc.querySelector('#page-content,[name="content"]');
    if (!form || !ta) return { status: 'ошибка: не найдены форма или textarea' };

    const initialHtml = ta.value || '';

    // 3) функция сохранения
    async function save(newHtml) {
      // берём СВЕЖУЮ форму (токены/hidden могут меняться)
      const freshHtml = await getHtml(editUrl);
      const freshDoc  = toDoc(freshHtml);
      const fForm = freshDoc.querySelector('form[action*="admin_pages.php"]') || freshDoc.querySelector('form');
      const fTa   = freshDoc.querySelector('#page-content,[name="content"]');
      if (!fForm || !fTa) return { ok: false, status: 'ошибка: не найдены форма/textarea при сохранении' };

      // новый контент
      fTa.value = newHtml;

      // адрес для POST — фактический action формы (обычно "/admin_pages.php")
      const postUrl = new URL(fForm.getAttribute('action') || editUrl, location.origin).toString();

      // имя submit-кнопки
      const submitBtn = [...fForm.elements].find(el =>
        el.type === 'submit' && (el.name === 'save' || /сохр|save/i.test(el.value || el.textContent || ''))
      );
      const submitName  = submitBtn?.name  || 'save';
      const submitValue = submitBtn?.value || '1';

      // a) путь с CP1251-утилитами, если у тебя они есть глобально
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
        return { ok: (res.ok || okByText || res.redirected), status: okByText ? 'успешно' : 'ошибка сохранения' };
      }

      // b) современный путь: FormData + submit-параметр + проверка текста ответа
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
      return { ok: (res.ok || okByText || res.redirected), status: okByText ? 'успешно' : 'ошибка сохранения' };
    }

    return { status: 'ok', initialHtml, save };
  }

  window.skinAdmin = { load: loadSkinAdmin };
})();
