(() => {
  // 1) Берём номер поля из глобального объекта
  const idNum = window.MoneyFieldUpdID;
  if (!idNum) {
    console.log('[money] PROFILE_UPD.MoneyFieldID не задано — скрипт не запущен');
    return;
  }

  const fieldName = `pa-fld${idNum}`;
  const selector = `li#${CSS.escape(fieldName)}, li.${CSS.escape(fieldName)}`;
  const commentRe = /^\s*main:\s*usr(\d+)\s*$/i;
  const cache = new Map();

  async function fetchHtml(url) {
    const resp = await fetch(url, { credentials: 'same-origin' });
    const buf = await resp.arrayBuffer();
    let html = new TextDecoder('utf-8').decode(buf);
    if (/charset\s*=\s*windows-1251/i.test(html) || html.includes('�')) {
      try { html = new TextDecoder('windows-1251').decode(buf); } catch {}
    }
    return html;
  }

  function getValue(uid) {
    if (!cache.has(uid)) {
      cache.set(uid, (async () => {
        const html = await fetchHtml(`/profile.php?id=${uid}`);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const li = doc.querySelector(`#${fieldName}, .${fieldName}`);
        const strong = li?.querySelector('strong, b');
        if (strong) return strong.textContent.trim();
        const txt = (li?.textContent || '').trim();
        return txt.split(':').slice(-1)[0].trim();
      })());
    }
    return cache.get(uid);
  }

  // Обходим все элементы и ищем комментарии в любом месте
  document.querySelectorAll(selector).forEach(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    for (let n; (n = walker.nextNode()); ) {
      const m = (n.nodeValue || '').match(commentRe);
      if (m) getValue(m[1]).then(v => n.replaceWith(document.createTextNode(v || '')));
    }
  });
})();
