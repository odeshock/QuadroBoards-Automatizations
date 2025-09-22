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
  const pointerOnProfile = findMainPointerId(document);
  const targetId = pointerOnProfile || profileId;

  const doc = await fetchDocSmart(`/pages/usr${targetId}_skin`);
  if (!doc) return { icons: [], plashki: [], backs: [] };

  // Защита от цикла
  if (findMainPointerId(doc)) {
    console.log('Найден цикл');
    return { icons: [], plashki: [], backs: [] };
  }

  // Собираем все innerHTML внутри .item
  return {
    icons:   pickItemsHTML(doc, '#pun-main ._icon .item'),
    plashki: pickItemsHTML(doc, '#pun-main ._plashka .item'),
    backs:   pickItemsHTML(doc, '#pun-main ._background .item')
  };
}
