/*!
 * money-upd.js — чистый текст
 */
(function () {
  'use strict';

  const idNum = (typeof window.MoneyFieldUpdID === 'string') ? window.MoneyFieldUpdID.trim() : '';
  if (!idNum) return console.log('[money-upd] MoneyFieldUpdID не задан');

  const fieldName = `pa-fld${idNum}`;
  const esc = (CSS.escape || ((s) => s.replace(/[^a-zA-Z0-9_-]/g, '\\$&')));
  const sel = `li#${esc(fieldName)}, li.${esc(fieldName)}`;
  const re  = /^\s*main:\s*usr(\d+)\s*$/i;
  const cache = new Map();
  let fetchCount = 0;

  async function fetchHtml(url) {
    fetchCount++;
    const r = await fetch(url, { credentials: 'same-origin' });
    const buf = await r.arrayBuffer();
    let html = new TextDecoder('utf-8').decode(buf);
    if (/charset\s*=\s*windows-1251/i.test(html) || html.includes('�')) {
      try { html = new TextDecoder('windows-1251').decode(buf); } catch {}
    }
    return html;
  }

  function getValue(uid) {
    if (cache.has(uid)) return cache.get(uid);
    const p = (async () => {
      const html = await fetchHtml(`/profile.php?id=${uid}`);
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      const li   = doc.querySelector(`#${esc(fieldName)}, .${esc(fieldName)}`);
      const strong = li?.querySelector('strong, b');
      let v = strong?.textContent?.trim();
      if (!v) {
        const t = (li?.textContent || '').trim();
        v = t.split(':').slice(-1)[0].trim();
      }
      return v || '';
    })();
    cache.set(uid, p);
    return p;
  }

  function process(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    let n;
    while ((n = w.nextNode())) {
      const m = (n.nodeValue || '').match(re);
      if (m) {
        const uid = m[1];
        getValue(uid).then(val => {
          if (n.parentNode) n.replaceWith(document.createTextNode(val));
        });
      }
    }
  }

  function run() {
    document.querySelectorAll(sel).forEach(process);
    console.log('[money-upd] уникальных профилей:', cache.size, 'запросов:', fetchCount);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', run, { once: true })
    : run();
})();
