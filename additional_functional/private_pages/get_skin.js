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

// Универсальный fetch→Document: использует твои хелперы при наличии
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

// Ищем комментарий <!-- main: usrN_skin --> в #pun-main .container (или .pun-main .container)
function findMainPointerId(doc) {
  const container =
    doc.querySelector('#pun-main .container') ||
    doc.querySelector('.pun-main .container');
  if (!container) return null;

  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  let node = walker.nextNode();
  while (node) {
    const m = /main:\s*usr(\d+)_skin/i.exec(node.nodeValue || '');
    if (m) return m[1]; // строка с цифрами
    node = walker.nextNode();
  }
  return null;
}

// Достаём outerHTML ссылок <a.modal-link> по заданному селектору
function pickLinks(doc, baseSelector) {
  return Array.from(
    doc.querySelectorAll(`${baseSelector} > a.modal-link, ${baseSelector} a.modal-link`)
  )
    .map(a => a.outerHTML.trim())
    .filter(Boolean);
}

/**
 * Загружает /pages/usrN_skin и возвращает три массива:
 * { icons: string[], plashki: string[], backs: string[] }
 * Логика:
 *  - если на текущей странице есть <!-- main: usrX_skin --> → берём X;
 *  - грузим /pages/usrX_skin;
 *  - если и там снова найден такой комментарий → "Найден цикл", выходим с пустыми списками;
 *  - иначе парсим три набора.
 */
async function collectSkinSets() {
  if (!isProfileFieldsPage()) return { icons: [], plashki: [], backs: [] };

  const profileId = getProfileId();
  const pointerOnProfile = findMainPointerId(document);

  // Кого грузить: либо X из комментария, либо текущего пользователя
  const targetId = pointerOnProfile || profileId;
  const doc = await fetchDocSmart(`/pages/usr${targetId}_skin`);
  if (!doc) return { icons: [], plashki: [], backs: [] };

  // Цикл/рекурсия запрещены: если на целевой странице снова есть этот "маяк" — выходим
  const pointerOnTarget = findMainPointerId(doc);
  if (pointerOnTarget) {
    console.log('Найден цикл');
    return { icons: [], plashki: [], backs: [] };
  }

  // Парсинг наборов
  return {
    icons:   pickLinks(doc, '#pun-main ._icon .item'),
    plashki: pickLinks(doc, '#pun-main ._plashka .item'),
    backs:   pickLinks(doc, '#pun-main ._background .item'),
  };
}
