// admin_bridge.js

async function fetchDoc(url){
  const res = await fetch(url, { credentials:'include' });
  const html = await res.text();
  const doc  = new DOMParser().parseFromString(html, 'text/html');
  return { ok: res.ok, html, doc };
}

async function loadSkinAdmin(n){
  const ADMIN_URL = new URL(`/admin_pages.php?edit_page=usr${n}_skin`, location.origin).toString();
  const page = await fetchDoc(ADMIN_URL);
  const bodyText = page.doc?.body?.textContent || '';

  if (!page.ok || /Ссылка, по которой Вы пришли, неверная или устаревшая\./.test(bodyText)) {
    return { status: 'ошибка доступа к персональной странице' };
  }

  const form = page.doc.querySelector('form[action*="admin_pages.php"]') || page.doc.querySelector('form');
  const ta   = page.doc.querySelector('#page-content');
  if (!form || !ta) return { status: 'ошибка: не найдены форма или textarea' };

  const initialHtml = ta.value || '';

  async function save(newHtml){
    const fresh = await fetchDoc(ADMIN_URL);
    const fForm = fresh.doc.querySelector('form[action*="admin_pages.php"]') || fresh.doc.querySelector('form');
    const fTa   = fresh.doc.querySelector('#page-content');
    if (!fForm || !fTa) return { ok:false, status:'ошибка: не найдены форма или textarea при сохранении' };

    fTa.value = newHtml;
    const fd = new FormData(fForm);
    fd.set(fTa.getAttribute('name') || 'content', fTa.value);

    const res = await fetch(ADMIN_URL, { method:'POST', credentials:'include', body: fd });
    return { ok: res.ok, status: res.ok ? 'успешно' : 'ошибка сохранения' };
  }

  return { status:'ok', initialHtml, save };
}
