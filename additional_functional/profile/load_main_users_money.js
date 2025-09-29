(() => {
  // Проверяем наличие настроек
  if (
    typeof window.PROFILE_CHECK !== 'object' ||
    typeof window.PROFILE_CHECK.MoneyFieldID !== 'string' ||
    !window.PROFILE_CHECK.MoneyFieldID.trim()
  ) {
    console.log('[money] PROFILE_CHECK.MoneyFieldID не задан — скрипт не запускается');
    return;
  }

  const FIELD_ID = window.PROFILE_CHECK.MoneyFieldID.trim(); // например "pa-fld6"
  const commentRe = /^\s*main:\s*usr(\d+)\s*$/i;
  const cache = new Map();
  let fetchCount = 0;

  async function fetchHtmlSmart(url) {
    fetchCount++;
    const resp = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
    const buf = await resp.arrayBuffer();
    let html = new TextDecoder('utf-8').decode(buf);
    if (/charset\s*=\s*windows-1251/i.test(html) || html.includes('�')) {
      try { html = new TextDecoder('windows-1251').decode(buf); } catch {}
    }
    return html;
  }

  async function getValueFromProfile(userId) {
    if (cache.has(userId)) return cache.get(userId);
    const p = (async () => {
      const html = await fetchHtmlSmart(`/profile.php?id=${userId}`);
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Ищем либо по id, либо по классу
      const li = doc.querySelector(`#${FIELD_ID}, .${FIELD_ID}`);
      if (!li) throw new Error(`нет ${FIELD_ID} на профиле`);
      const strong = li.querySelector('strong, b');
      let value = strong?.textContent?.trim();
      if (!value) {
        const txt = (li.textContent || '').trim();
        value = txt.split(':').slice(-1)[0].trim();
      }
      return value;
    })();
    cache.set(userId, p);
    return p;
  }

  function processNode(node) {
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.COMMENT_NODE) {
        const m = (n.nodeValue || '').match(commentRe);
        if (m) {
          const userId = m[1];
          getValueFromProfile(userId).then((value) => {
            n.replaceWith(document.createTextNode(value ?? ''));
          }).catch((e) => console.error('[money] ошибка:', e));
        }
      } else if (n.childNodes?.length) {
        processNode(n);
      }
    });
  }

  // выбираем все li с этим id или классом
  document.querySelectorAll(`li#${FIELD_ID}, li.${FIELD_ID}`).forEach(processNode);

})();
