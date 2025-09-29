/*!
 * money-upd.js (fast + verbose + persistent cache)
 * Читает номер из window.MoneyFieldUpdID (например "6"),
 * заменяет <!-- main: usrN --> внутри <li id|class="pa-fld{N}">
 * на текст из /profile.php?id=N, с кэшем localStorage.
 */
(function () {
  'use strict';

  // ===== Конфиг =====
  const ID_NUM = (typeof window.MoneyFieldUpdID === 'string') ? window.MoneyFieldUpdID.trim() : '';
  if (!ID_NUM) { console.log('[money-upd] старт отменён: MoneyFieldUpdID не задан'); return; }

  const FIELD_NAME = `pa-fld${ID_NUM}`;
  const esc = (window.CSS && CSS.escape) ? CSS.escape : (s) => s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const ROOT_SEL = `li#${esc(FIELD_NAME)}, li.${esc(FIELD_NAME)}`;
  const COMMENT_RE = /^\s*main:\s*usr(\d+)\s*$/i;

  // кэш в памяти + persistent в localStorage
  const LS_KEY = 'money-upd-cache::v1';
  const TTL_MS = 24 * 60 * 60 * 1000; // 24ч; можно уменьшить, напр. 5 * 60 * 1000
  let fetchCount = 0;

  console.log('[money-upd] конфиг:', { MoneyFieldUpdID: ID_NUM, FIELD_NAME, ROOT_SEL, TTL_H: TTL_MS/3600000 });

  function readLS() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (_) { return {}; }
  }
  function writeLS(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (_) {}
  }
  const LS = readLS();            // { [userId]: {v: "20", ts: 1700000000000} }
  const RAM = new Map();          // userId -> Promise<string>
  const targets = new Map();      // userId -> Set<HTMLElement> (куда писать значение)

  function getFromCache(uid) {
    const rec = LS[uid];
    if (!rec) return null;
    if ((Date.now() - rec.ts) > TTL_MS) return null;
    return String(rec.v);
    }

  function saveToCache(uid, val) {
    LS[uid] = { v: String(val), ts: Date.now() };
    writeLS(LS);
  }

  // «умное» чтение HTML (utf-8 / windows-1251)
  async function fetchHtml(url) {
    fetchCount++;
    console.log('[money-upd] fetch →', url);
    const resp = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
    console.log('[money-upd] status', resp.status);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    const buf = await resp.arrayBuffer();
    let html = new TextDecoder('utf-8').decode(buf);
    if (/charset\s*=\s*windows-1251/i.test(html) || html.includes('�')) {
      try { html = new TextDecoder('windows-1251').decode(buf); console.log('[money-upd] декод windows-1251'); } catch {}
    }
    return html;
  }

  function getValue(uid) {
    if (RAM.has(uid)) return RAM.get(uid);
    const p = (async () => {
      // 1) если есть свежий localStorage — вернём сразу (ускорение)
      const cached = getFromCache(uid);
      if (cached != null) {
        console.log(`[money-upd] cache(localStorage) hit usr${uid} → "${cached}"`);
        return cached;
      }
      console.log(`[money-upd] cache miss usr${uid} — идём в профиль`);
      // 2) сеть
      const html = await fetchHtml(`/profile.php?id=${uid}`);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const li = doc.querySelector(`#${esc(FIELD_NAME)}, .${esc(FIELD_NAME)}`);
      if (!li) throw new Error(`на профиле usr${uid} нет ${FIELD_NAME}`);
      const strong = li.querySelector('strong, b');
      let value = strong?.textContent?.trim();
      if (!value) {
        const txt = (li.textContent || '').trim();
        value = txt.split(':').slice(-1)[0].trim();
      }
      value = value || '';
      saveToCache(uid, value); // положим в persistent-кэш
      console.log(`[money-upd] usr${uid} ← "${value}" (saved to LS)`);
      return value;
    })();
    RAM.set(uid, p);
    return p;
  }

  // заменяем комментарий на спан-плейсхолдер (чтобы можно было обновить позже)
  function replaceCommentWithSpan(commentNode, uid, initialText) {
    const span = document.createElement('span');
    span.className = 'money-upd-val';
    span.dataset.usr = uid;
    span.textContent = initialText;
    commentNode.replaceWith(span);
    if (!targets.has(uid)) targets.set(uid, new Set());
    targets.get(uid).add(span);
    return span;
  }

  // основной проход
  async function run() {
    console.log('[money-upd] запуск');
    const roots = document.querySelectorAll(ROOT_SEL);
    console.log('[money-upd] найдено элементов:', roots.length);

    const needFetch = new Set(); // какие userId надо дозакачать

    roots.forEach((root, idx) => {
      // ищем комментарии везде внутри root
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
      let node;
      let found = 0;
      while ((node = walker.nextNode())) {
        const m = (node.nodeValue || '').match(COMMENT_RE);
        if (!m) continue;
        found++;
        const uid = m[1];
        const cached = getFromCache(uid);
        if (cached != null) {
          // СРАЗУ показываем из кэша — моментальная подстановка
          console.log(`[money-upd] root[${idx}] usr${uid} → мгновенно из LS: "${cached}"`);
          replaceCommentWithSpan(node, uid, cached);
          // но всё равно обновим фоном, если в RAM ещё нет запроса
          needFetch.add(uid);
        } else {
          // ставим лёгкий плейсхолдер, чтобы не мигал комментарий
          replaceCommentWithSpan(node, uid, '…');
          needFetch.add(uid);
        }
      }
      if (!found) console.log(`[money-upd] root[${idx}] без комментариев`);
    });

    // параллельно дозакачиваем всех уникальных uid и обновляем плейсхолдеры
    await Promise.all([...needFetch].map(async (uid) => {
      try {
        const val = await getValue(uid);
        const set = targets.get(uid);
        if (set) {
          set.forEach(el => { if (el && el.isConnected) el.textContent = val; });
        }
      } catch (e) {
        console.error('[money-upd] ошибка загрузки usr' + uid, e);
      }
    }));

    console.log('[money-upd] готово. уникальных профилей:', RAM.size, 'реальных запросов:', fetchCount);
  }

  if (document.readyState === 'loading') {
    console.log('[money-upd] ждём DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
