function isProfileFieldsPage() {
  try {
    const u = new URL(location.href);
    return /\/profile\.php$/i.test(u.pathname) &&
           u.searchParams.get('section') === 'fields' &&
           /^\d+$/.test(u.searchParams.get('id') || '');
  } catch { return false; }
}

function getProfileId() {
  const u = new URL(location.href);
  return u.searchParams.get('id') || '';
}

// Универсальный fetch→Document
async function fetchDocSmart(url) {
  if (window.FMV?.fetchDoc) return await FMV.fetchDoc(url);
  if (typeof window.fetchHtml === 'function') {
    const html = await window.fetchHtml(url);
    return new DOMParser().parseFromString(html, 'text/html');
  }
  const res = await fetch(url, { credentials: 'include' });
  const html = await res.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

// Ищем комментарий <!-- main: usrN_skin -->
function findMainPointerId(doc) {
  const container =
    doc.querySelector('#pun-main .container') ||
    doc.querySelector('.pun-main .container');
  if (!container) return null;

  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const m = /main:\s*usr(\d+)_skin/i.exec(n.nodeValue || '');
    if (m) return m[1];
  }
  return null;
}

// Берём innerHTML каждого .item
function pickItemsHTML(doc, selector) {
  return Array.from(doc.querySelectorAll(selector))
    .map(el => (el.innerHTML || '').trim())
    .filter(Boolean);
}

/**
 * Загружает /pages/usrN_skin и возвращает три массива:
 * { icons: string[], plashki: string[], backs: string[] }
 */
async function collectSkinSets() {
  if (!isProfileFieldsPage()) return { icons: [], plashki: [], backs: [] };

  const profileId = getProfileId();

  // 1) открываем /pages/usr<profileId>_skin
  const doc1 = await fetchDocSmart(`/pages/usr${profileId}_skin`);
  if (!doc1) return { icons: [], plashki: [], backs: [] };

  // 2) смотрим "маяк" на ПЕРВОЙ открытой странице
  const ptr1 = findMainPointerId(doc1);

  // Если "маяка" нет — парсим doc1 и выходим
  if (!ptr1) {
    return {
      icons:   pickItemsHTML(doc1, '#pun-main ._icon .item, .pun-main ._icon .item'),
      plashki: pickItemsHTML(doc1, '#pun-main ._plashka .item, .pun-main ._plashka .item'),
      backs:   pickItemsHTML(doc1, '#pun-main ._background .item, .pun-main ._background .item')
    };
  }

  // 3) "маяк" есть → переходим НА СЛЕДУЮЩУЮ страницу /pages/usr<ptr1>_skin
  const doc2 = await fetchDocSmart(`/pages/usr${ptr1}_skin`);
  if (!doc2) return { icons: [], plashki: [], backs: [] };

  // 4) если и здесь снова есть "маяк" — это цикл
  const ptr2 = findMainPointerId(doc2);
  if (ptr2) {
    console.log('Найден цикл');
    return { icons: [], plashki: [], backs: [] };
  }

  // 5) иначе парсим вторую страницу
  return {
    icons:   pickItemsHTML(doc2, '#pun-main ._icon .item, .pun-main ._icon .item'),
    plashki: pickItemsHTML(doc2, '#pun-main ._plashka .item, .pun-main ._plashka .item'),
    backs:   pickItemsHTML(doc2, '#pun-main ._background .item, .pun-main ._background .item')
  };
}
