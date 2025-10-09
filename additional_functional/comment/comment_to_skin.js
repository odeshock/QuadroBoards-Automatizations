/**
 * Загружает карточки из текущего домена.
 * @param {string} topic_id  id темы (viewtopic.php?id=<topic_id>)
 * @param {string} comment_id  id поста (#p<comment_id>-content)
 * @returns {Promise<Array<{id:string, html:string}>>}
 */
async function fetchCardsWrappedClean(topic_id, comment_id) {
  const topicUrl = `${location.origin.replace(/\/$/, '')}/viewtopic.php?id=${encodeURIComponent(String(topic_id))}`;

  const normSpace = (typeof FMV?.normSpace === 'function')
    ? FMV.normSpace
    : s => String(s ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();

  const decodeEntities = s => {
    const d = document.createElement('div');
    d.innerHTML = String(s ?? '');
    return d.textContent || d.innerText || '';
  };
  const toDoc = html => new DOMParser().parseFromString(html, 'text/html');

  async function smartFetchHtml(url) {
    if (typeof window.fetchHtml === 'function') return window.fetchHtml(url);
    const res = await fetch(url, { credentials: 'include' });
    const buf = await res.arrayBuffer();
    const declared = /charset=([^;]+)/i.exec(res.headers.get('content-type') || '')?.[1]?.toLowerCase();
    const tryDec = enc => { try { return new TextDecoder(enc).decode(buf); } catch { return null; } };
    if (declared) { const s = tryDec(declared); if (s) return s; }
    const utf = tryDec('utf-8') ?? '';
    const cp  = tryDec('windows-1251') ?? '';
    const bad = s => (s.match(/\uFFFD/g) || []).length;
    if (bad(cp) && !bad(utf)) return utf;
    if (bad(utf) && !bad(cp)) return cp;
    const cyr = s => (s.match(/[\u0400-\u04FF]/g) || []).length;
    return cyr(cp) > cyr(utf) ? cp : utf;
  }

  const pageHtml = await smartFetchHtml(topicUrl);
  const doc = toDoc(pageHtml);

  const post = doc.querySelector(`#p${String(comment_id)}-content`);
  if (!post) {
    console.warn(`Не найден #p${comment_id}-content на ${topicUrl}`);
    return [];
  }

  const scripts = [...post.querySelectorAll('script[type="text/html"]')];
  if (!scripts.length) return [];

  const combined = scripts.map(s => s.textContent || s.innerHTML || '').join('\n');
  const decoded = decodeEntities(combined).replace(/\u00A0/g, ' ');
  const innerDoc = toDoc(decoded);

  const result = [...innerDoc.querySelectorAll('#grid .card')].map(card => {
    const id        = normSpace(card.querySelector('.id')?.textContent || '');
    const rawTitle  = normSpace(card.querySelector('.desc')?.textContent || '');
    const content   = (card.querySelector('.content')?.innerHTML || '').replace(/\u00A0/g, ' ').trim();
    const titleAttr = rawTitle ? ` title="${rawTitle}"` : '';
    const html      = `<div class="item" data-id="${id}"${titleAttr}>${content}</div>`;
    return { id, html };
  });

  return result;
}
