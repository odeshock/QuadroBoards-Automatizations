async function fetchCardsWrappedClean(baseUrl, N, K, wrapClass) {
  const topicUrl = `${baseUrl.replace(/\/$/, '')}/viewtopic.php?id=${encodeURIComponent(N)}`;

  // ---------------- helpers ----------------
  const normSpace = (typeof FMV?.normSpace === 'function')
    ? FMV.normSpace
    : (s => String(s ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim());

  const decodeEntities = (s) => {  // &lt;div&gt; -> <div>
    const d = document.createElement('div');
    d.innerHTML = String(s ?? '');
    return d.textContent || d.innerText || '';
  };

  const toDoc = (html) => new DOMParser().parseFromString(html, 'text/html');

  // умный fetch с автоопределением кодировки (UTF-8/Win-1251)
  async function smartFetchHtml(url) {
    if (typeof window.fetchHtml === 'function') {
      return window.fetchHtml(url); // твой хелпер, если подключён
    }
    const res = await fetch(url, { credentials: 'include' });
    const buf = await res.arrayBuffer();

    const contentType = res.headers.get('content-type') || '';
    const declared = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase();

    const tryDecode = (enc) => {
      try { return new TextDecoder(enc).decode(buf); } catch { return null; }
    };

    // 1) если сервер объявил charset — уважаем
    if (declared) {
      const s = tryDecode(declared);
      if (s) return s;
    }

    // 2) пробуем UTF-8, если много � — перепробуем 1251 и выберем лучший
    const sUtf = tryDecode('utf-8') ?? '';
    const badUtf = (sUtf.match(/\uFFFD/g) || []).length;

    const s1251 = tryDecode('windows-1251') ?? '';
    const bad1251 = (s1251.match(/\uFFFD/g) || []).length;

    if (bad1251 && !badUtf) return sUtf;
    if (badUtf && !bad1251) return s1251;

    // 3) равная ситуация — эвристика: если кириллицы больше в одном, берём его
    const cyr = (s) => (s.match(/[\u0400-\u04FF]/g) || []).length;
    return cyr(s1251) > cyr(sUtf) ? s1251 : sUtf;
  }
  // ------------------------------------------

  // 1) тянем страницу темы корректной кодировкой
  const pageHtml = await smartFetchHtml(topicUrl);
  const doc = toDoc(pageHtml);

  // 2) пост
  const post = doc.querySelector(`#p${K}-content`);
  if (!post) {
    console.warn(`Не найден #p${K}-content на ${topicUrl}`);
    return [];
  }

  // 3) берём HTML из <script type="text/html"> (там лежит grid)
  const scripts = [...post.querySelectorAll('script[type="text/html"]')];
  if (!scripts.length) {
    console.warn('В посте нет <script type="text/html">');
    return [];
  }

  // склеиваем, декодируем энтити, убираем NBSP
  const combined = scripts.map(s => s.textContent || s.innerHTML || '').join('\n');
  const decoded = decodeEntities(combined).replace(/\u00A0/g, ' ');
  const innerDoc = toDoc(decoded);

  // 4) собираем карточки и строим обёртку
  const result = [...innerDoc.querySelectorAll('#grid .card')].map(card => {
    const id = normSpace(card.querySelector('.id')?.textContent || '');
    const rawTitle = normSpace(card.querySelector('.desc')?.textContent || '');
    const contentHtml = (card.querySelector('.content')?.innerHTML || '').replace(/\u00A0/g, ' ').trim();

    const titleAttr = rawTitle ? ` title="${rawTitle}"` : '';
    const html = `<div class="${wrapClass}" data-id="${id}"${titleAttr}>${contentHtml}</div>`;

    return { id, html };
  });

  console.log(result);
  return result;
}
