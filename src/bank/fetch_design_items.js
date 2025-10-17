/**
 * Загружает фоны/иконки/плашки из комментариев форума.
 * Использует window.fetchHtml если доступна, иначе fallback на базовый fetch.
 * @param {number} topic_id - ID темы (viewtopic.php?id=<topic_id>)
 * @param {Array<number>} comment_ids - ID постов (#p<comment_id>-content)
 * @returns {Promise<Array<{id: string, icon: string, title: string}>>}
 */
async function fetchDesignItems(topic_id, comment_ids) {
  const topicUrl = `${location.origin.replace(/\/$/, '')}/viewtopic.php?id=${encodeURIComponent(String(topic_id))}`;

  const decodeEntities = s => {
    const d = document.createElement('div');
    d.innerHTML = String(s ?? '');
    return d.textContent || d.innerText || '';
  };

  // Используем window.fetchHtml если доступна (из helpers.js, уже с retry)
  // Fallback: используем fetchWithRetry если доступна, иначе обычный fetch
  const pageHtml = typeof window.fetchHtml === 'function'
    ? await window.fetchHtml(topicUrl)
    : await (async () => {
        const fetchFunc = typeof window.fetchWithRetry === 'function'
          ? window.fetchWithRetry
          : fetch;
        const res = await fetchFunc(topicUrl, { credentials: 'include' });
        return res.text();
      })();

  const doc = new DOMParser().parseFromString(pageHtml, 'text/html');

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
    const innerDoc = new DOMParser().parseFromString(decoded, 'text/html');

    // Выбираем только article.card БЕЗ класса hidden
    const result = [...innerDoc.querySelectorAll('#grid article.card:not(.hidden)')].map(card => {
      const id = FMV.normSpace(card.querySelector('.id')?.textContent || '');
      const title = FMV.normSpace(card.querySelector('.title')?.textContent || '');
      const icon = (card.querySelector('.content')?.innerHTML || '').replace(/\u00A0/g, ' ').trim();

      return { id, icon, title };
    });

    allResults.push(...result);
  }

  return allResults;
}

window.fetchDesignItems = fetchDesignItems;
