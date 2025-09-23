// admin_bridge.js — загрузка/сохранение страницы с проверкой main-маркера (только textarea)
// Экспорт: window.skinAdmin.load(userId) -> { status, initialHtml, save(newHtml), targetUserId }

(function () {
  'use strict';
  if (window.skinAdmin && typeof window.skinAdmin.load === 'function') return;

  const getHtml = (typeof window.fetchHtml === 'function')
    ? window.fetchHtml
    : async (url) => (await fetch(url, { credentials: 'include' })).text();

  const toDoc = (html) => new DOMParser().parseFromString(html, 'text/html');

  const normalizeHtml = (s) =>
    String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/&quot;/g, '"').replace(/>\s+</g, '><')
      .replace(/[ \t\n]+/g, ' ').replace(/\s*=\s*/g, '=').trim();

  async function loadSkinAdmin(userId) {
    const mkUrl = (uid) => new URL(`/admin_pages.php?edit_page=usr${uid}_skin`, location.origin).toString();
    const RX_RAW  = /<!--\s*main\s*:\s*usr\s*(\d+)\s*_skin\s*-->/i;
    const RX_HTML = /&lt;!--\s*main\s*:\s*usr\s*(\d+)\s*_skin\s*--&gt;/i;
    const htmlDecode = (s) => { const t=document.createElement('textarea'); t.innerHTML=String(s||''); return t.value; };

    const getMainId = (doc) => {
      const ta = doc.querySelector('#page-content,[name="content"]');
      if (!ta) return { id: null, value: '' };
      const v = String(ta.value || '');
      let m = v.match(RX_RAW);  if (m) return { id: m[1], value: v };
      m = htmlDecode(v).match(RX_RAW); if (m) return { id: m[1], value: v };
      m = v.match(RX_HTML); if (m) return { id: m[1], value: v };
      return { id: null, value: v };
    };

    let id = String(userId);
    let url = mkUrl(id);

    // исходная страница
    let html = await getHtml(url);
    let doc  = toDoc(html);
    if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(doc.body?.textContent || ''))
      return { status: 'ошибка доступа к персональной странице' };

    // проверка маркера
    let { id: main1, value: val1 } = getMainId(doc);
    if (main1) {
      if (main1 === id) return { status: 'ошибка: найден цикл main-страниц' };
      // редирект на основную
      id  = main1;
      url = mkUrl(id);
      html = await getHtml(url);
      doc  = toDoc(html);
      if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(doc.body?.textContent || ''))
        return { status: 'ошибка доступа к персональной странице' };
      const { id: main2, value: val2 } = getMainId(doc);
      if (main2) return { status: 'ошибка: найден цикл main-страниц' };
      val1 = val2;
    }

    const form = doc.querySelector('form[action*="admin_pages.php"]') || doc.querySelector('form');
    const ta   = doc.querySelector('#page-content,[name="content"]');
    if (!form || !ta) return { status: 'ошибка: не найдены форма или textarea' };

    const initialHtml = String(val1 ?? ta.value ?? '');

    async function verifySaved(expected) {
      try {
        const chk = await getHtml(url);
        const chkTa = toDoc(chk).querySelector('#page-content,[name="content"]');
        return chkTa && normalizeHtml(chkTa.value) === normalizeHtml(expected);
      } catch { return false; }
    }

    async function save(newHtml) {
      const fresh = await getHtml(url);
      const freshDoc = toDoc(fresh);
      const fForm = freshDoc.querySelector('form[action*="admin_pages.php"]') || freshDoc.querySelector('form');
      const fTa   = freshDoc.querySelector('#page-content,[name="content"]');
      if (!fForm || !fTa) return { ok: false, status: 'ошибка: не найдены форма/textarea при сохранении' };

      fTa.value = newHtml;
      const postUrl = new URL(fForm.getAttribute('action') || url, location.origin).toString();
      const submitBtn = [...fForm.elements].find(el =>
        el.type === 'submit' && (el.name === 'save' || /сохр|save/i.test(el.value || el.textContent || '')));
      const submitName  = submitBtn?.name  || 'save';
      const submitValue = submitBtn?.value || '1';

      if (typeof window.serializeFormCP1251_SelectSubmit === 'function' &&
          typeof window.fetchCP1251Text === 'function') {
        const body = window.serializeFormCP1251_SelectSubmit(fForm, submitName);
        const { res, text } = await window.fetchCP1251Text(postUrl, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=windows-1251' },
          referrer: url, referrerPolicy: 'strict-origin-when-cross-origin', body
        });
        const ok = res.ok || res.redirected || /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text)
                   || await verifySaved(newHtml);
        return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
      }

      const fd = new FormData(fForm);
      fd.set(fTa.getAttribute('name') || 'content', fTa.value);
      fd.append(submitName, submitValue);

      const res  = await fetch(postUrl, {
        method: 'POST', credentials: 'include', body: fd,
        referrer: url, referrerPolicy: 'strict-origin-when-cross-origin'
      });
      const text = await res.text();
      const ok = res.ok || res.redirected || /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text)
                 || await verifySaved(newHtml);
      return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
    }

    return { status: 'ok', initialHtml, save, targetUserId: id };
  }

  window.skinAdmin = { load: loadSkinAdmin };
})();
