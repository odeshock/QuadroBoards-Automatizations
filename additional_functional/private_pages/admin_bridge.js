// admin_bridge.js (fix cp1251)
(function () {
  'use strict';
  if (window.skinAdmin) return;

  // 1) берём твой умный загрузчик с авто-детекцией кодировки
  const getHtml = (typeof window.fetchHtml === 'function')
    ? window.fetchHtml                                        // из helpers.js
    : async (url) => (await fetch(url, {credentials: 'include'})).text();

  // маленький парсер
  function toDoc(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  async function loadSkinAdmin(n) {
    const url = new URL(`/admin_pages.php?edit_page=usr${n}_skin`, location.origin).toString();

    // 2) Грузим HTML правильно (UTF-8/CP1251 → как надо)
    const html = await getHtml(url);                          // ← тут «кракозябры» исчезают
    const doc  = toDoc(html);

    // проверка недоступности
    const bodyText = (doc.body && doc.body.textContent) || '';
    if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./.test(bodyText)) {
      return { status: 'ошибка доступа к персональной странице' };
    }

    const form = doc.querySelector('form[action*="admin_pages.php"]') || doc.querySelector('form');
    const ta   = doc.querySelector('#page-content');
    if (!form || !ta) return { status: 'ошибка: не найдены форма или textarea' };

    const initialHtml = ta.value || '';

    // 3) сохранение: если есть CP1251-утилиты — используем их; иначе обычный FormData
    async function save(newHtml) {
      // возьмём свежую форму и поля (чтобы не промахнуться по hidden-токенам)
      const freshHtml = await getHtml(url);
      const freshDoc  = toDoc(freshHtml);
      const fForm = freshDoc.querySelector('form[action*="admin_pages.php"]') || freshDoc.querySelector('form');
      const fTa   = freshDoc.querySelector('#page-content');
      if (!fForm || !fTa) return { ok: false, status: 'ошибка: не найдены форма/textarea при сохранении' };

      fTa.value = newHtml;

      // a) путь с CP1251-сериализацией (желательно для старых движков)
      if (typeof window.serializeFormCP1251_SelectSubmit === 'function' &&
          typeof window.fetchCP1251Text === 'function') {
        const body = window.serializeFormCP1251_SelectSubmit(fForm, 'save');
        const { res, text } = await window.fetchCP1251Text(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        const ok = res.ok && /Сохранено|успешно|изменения|сохранены/i.test(text);
        return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
      }

      // b) запасной современный путь
      const fd = new FormData(fForm);
      fd.set(fTa.getAttribute('name') || 'content', fTa.value);
      const res = await fetch(url, { method: 'POST', credentials: 'include', body: fd });
      return { ok: res.ok, status: res.ok ? 'успешно' : 'ошибка сохранения' };
    }

    return { status: 'ok', initialHtml, save };
  }

  window.skinAdmin = { load: loadSkinAdmin };
})();
