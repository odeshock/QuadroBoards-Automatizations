/**
 * Загружает карточки из текущего домена.
 * @param {number} topic_id  id темы (viewtopic.php?id=<topic_id>)
 * @param {Array<number>} comment_ids  id поста (#p<comment_id>-content)
 * @param {Object} options - дополнительные опции
 * @param {boolean} options.isCoupon - true если обрабатываем купоны (добавляет data-coupon-* атрибуты)
 * @returns {Promise<Array<{id:string, html:string}>>}
 */
async function fetchCardsWrappedClean(topic_id, comment_ids, options = {}) {
  const { isCoupon = false } = options;
  const topicUrl = `${location.origin.replace(/\/$/, '')}/viewtopic.php?id=${encodeURIComponent(String(topic_id))}`;

  const decodeEntities = s => {
    const d = document.createElement('div');
    d.innerHTML = String(s ?? '');
    return d.textContent || d.innerText || '';
  };
  const toDoc = html => new DOMParser().parseFromString(html, 'text/html');

  async function smartFetchHtml(url) {
    // Используем window.fetchHtml если доступна (уже с retry)
    if (typeof window.fetchHtml === 'function') return window.fetchHtml(url);

    // Fallback: используем fetchWithRetry если доступна, иначе обычный fetch
    const fetchFunc = typeof window.fetchWithRetry === 'function'
      ? window.fetchWithRetry
      : fetch;

    const res = await fetchFunc(url, { credentials: 'include' });
    const buf = await res.arrayBuffer();
    const declared = /charset=([^;]+)/i.exec(res.headers.get('content-type') || '')?.[1]?.toLowerCase();
    const tryDec = enc => { try { return new TextDecoder(enc).decode(buf); } catch { return null; } };
    if (declared) { const s = tryDec(declared); if (s) return s; }
    const utf = tryDec('utf-8') ?? '';
    const cp = tryDec('windows-1251') ?? '';
    const bad = s => (s.match(/\uFFFD/g) || []).length;
    if (bad(cp) && !bad(utf)) return utf;
    if (bad(utf) && !bad(cp)) return cp;
    const cyr = s => (s.match(/[\u0400-\u04FF]/g) || []).length;
    return cyr(cp) > cyr(utf) ? cp : utf;
  }

  const pageHtml = await smartFetchHtml(topicUrl);
  const doc = toDoc(pageHtml);

  const allResults = [];

  for (const comment_id of comment_ids) {
    const post = doc.querySelector(`#p${String(comment_id)}-content`);
    if (!post) {
      console.warn(`Не найден #p${comment_id}-content на ${topicUrl}`);
      continue;
    }

    const scripts = [...post.querySelectorAll('script[type="text/html"]')];
    if (!scripts.length) continue;

    const combined = scripts.map(s => s.textContent || s.innerHTML || '').join('\n');
    const decoded = decodeEntities(combined).replace(/\u00A0/g, ' ');
    const innerDoc = toDoc(decoded);

    const result = [...innerDoc.querySelectorAll('#grid article.card')].map(card => {
      const id = FMV.normSpace(card.querySelector('.id')?.textContent || '');
      const rawTitle = FMV.normSpace(card.querySelector('.desc')?.textContent || '');
      const content = (card.querySelector('.content')?.innerHTML || '').replace(/\u00A0/g, ' ').trim();

      // Формируем базовые атрибуты
      const titleAttr = rawTitle ? ` title="${rawTitle}"` : '';

      // Для купонов извлекаем дополнительные поля
      let couponAttrs = '';
      if (isCoupon) {
        const couponTitle = FMV.normSpace(card.querySelector('.title')?.textContent || '');
        const couponType = FMV.normSpace(card.querySelector('.type')?.textContent || '');
        const couponForm = FMV.normSpace(card.querySelector('.form')?.textContent || '');
        const couponValue = FMV.normSpace(card.querySelector('.value')?.textContent || '');

        const couponTitleAttr = couponTitle ? ` data-coupon-title="${couponTitle}"` : '';
        const couponTypeAttr = couponType ? ` data-coupon-type="${couponType}"` : '';
        const couponFormAttr = couponForm ? ` data-coupon-form="${couponForm}"` : '';
        const couponValueAttr = couponValue ? ` data-coupon-value="${couponValue}"` : '';

        couponAttrs = `${couponTitleAttr}${couponTypeAttr}${couponFormAttr}${couponValueAttr}`;
      }

      const html = `<div class="item" data-id="${id}"${titleAttr}${couponAttrs}>${content}</div>`;
      return { id, html };
    });

    allResults.push(...result); // 🔸 добавляем карточки в общий массив
  }

  return allResults;
}
