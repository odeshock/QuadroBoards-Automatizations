/*!
 * money-upd.js (verbose, fixed)
 * Берёт номер из window.MoneyFieldUpdID (например "6"),
 * ищет <!-- main: usrN --> внутри <li id|class="pa-fld{N}">
 * и подставляет текст из /profile.php?id=N
 */
(function () {
  'use strict';

  // ---------- Конфиг ----------
  const idNum = (typeof window.MoneyFieldUpdID === 'string')
    ? window.MoneyFieldUpdID.trim()
    : '';
  const log = (...a) => console.log('[money-upd]', ...a);
  const err = (...a) => console.error('[money-upd]', ...a);

  if (!idNum) {
    log('старт отменён: MoneyFieldUpdID не задан');
    return;
  }

  const fieldName = `pa-fld${idNum}`;
  const esc = (window.CSS && CSS.escape) ? CSS.escape : (s) => s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const rootSelector = `li#${esc(fieldName)}, li.${esc(fieldName)}`;
  log('конфиг:', { MoneyFieldUpdID: idNum, fieldName, rootSelector });

  const commentRe = /^\s*main:\s*usr(\d+)\s*$/i;
  const cache = new Map(); // userId -> Promise<string>
  let fetchCount = 0;

  // ---------- загрузка HTML профиля с авто-декодированием ----------
  async function fetchHtml(url) {
    fetchCount++;
    log('fetch →', url);
    const resp = await fetch(url, { credentials: 'same-origin', redirect: 'follow' });
    log('status', resp.status);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    let html = new TextDecoder('utf-8').decode(buf);
    if (/charset\s*=\s*windows-1251/i.test(html) || html.includes('�')) {
      try {
        html = new TextDecoder('windows-1251').decode(buf);
        log('декод windows-1251');
      } catch {}
    }
    return html;
  }

  // ---------- получение значения из профиля ----------
  function getValue(userId) {
    if (cache.has(userId)) {
      log(`cache hit usr${userId}`);
      return cache.get(userId);
    }
    log(`cache miss usr${userId}`);
    const p = (async () => {
      const html = await fetchHtml(`/profile.php?id=${userId}`);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const li = doc.querySelector(`#${esc(fieldName)}, .${esc(fieldName)}`);
      if (!li) throw new Error(`нет поля ${fieldName} на профиле usr${userId}`);
      const strong = li.querySelector('strong, b');
      let value = strong?.textContent?.trim();
      if (!value) {
        const txt = (li.textContent || '').trim();
        value = txt.split(':').slice(-1)[0].trim();
      }
      log(`usr${userId} → "${value}"`);
      return value || '';
    })();
    cache.set(userId, p);
    return p;
  }

  // ---------- обработка одного <li> ----------
  function processRoot(rootEl, idx) {
    log(`process root[${idx}]`, rootEl);
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_COMMENT, null);
    let n;
    let found = 0;
    const jobs = [];
    while ((n = walker.nextNode())) {
      const txt = n.nodeValue || '';
      const m = txt.match(commentRe);
      if (!m) continue;
      found++;
      const userId = m[1];
      log(`найден комментарий usr${userId}`);

      // КЛЮЧЕВОЕ: захватываем конкретный узел в константу,
      // чтобы асинхронный then не увидел уже "сменившуюся" переменную
      const target = n;

      const job = getValue(userId)
        .then((v) => {
          log(`замена usr${userId} → ${v}`);
          // узел мог исчезнуть/быть заменён — проверим parentNode
          if (target && target.parentNode) {
            target.replaceWith(document.createTextNode(v));
          } else {
            log(`пропуск: комментарий usr${userId} уже не в DOM`);
          }
        })
        .catch((e) => err(`ошибка usr${userId}:`, e));

      jobs.push(job);
    }
    if (!found) log(`root[${idx}] без комментариев`);
    return Promise.allSettled(jobs);
  }

  // ---------- запуск ----------
  async function run() {
    log('запуск');
    const roots = document.querySelectorAll(rootSelector);
    log('найдено элементов:', roots.length);

    const tasks = [];
    roots.forEach((el, i) => tasks.push(processRoot(el, i)));
    await Promise.allSettled(tasks);
    await Promise.allSettled([...cache.values()]);

    log('готово. уникальных профилей:', cache.size, 'реальных запросов:', fetchCount);
  }

  if (document.readyState === 'loading') {
    log('ждём DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
