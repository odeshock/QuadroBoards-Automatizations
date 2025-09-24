(function () {
  // ================= настройки =================
  const SOURCE_BLOCK_SELECTOR = '#pun-main .container';
  const INFO_PAGE_TEXT = 'Ссылка, по которой Вы пришли, неверная или устаревшая.';
  const DEFAULT_CHARSET = 'windows-1251';
  const CHARACTER_SELECTOR = '.character[data-id]';
  const SKIN_TARGET_SELECTOR = '.skin_info';
  const CHRONO_TARGET_SELECTOR = '.chrono_info';
  const REDIR_SKIN_RE = /<!--\s*main:\s*usr(\d+)_skin\s*-->/i; // <!-- main: usrM_skin -->
  const DEBUG = false; // включи true, если нужны подробные логи в консоли
  // =============================================

  const log = (...a) => DEBUG && console.log('[collect]', ...a);
  const warn = (...a) => DEBUG && console.warn('[collect]', ...a);

  async function fetchDecoded(url) {
    log('fetch:', url);
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) {
      warn('HTTP error', res.status, url);
      return null;
    }
    const ct = res.headers.get('content-type') || '';
    const m = ct.match(/charset=([^;]+)/i);
    const charset = (m ? m[1] : DEFAULT_CHARSET).toLowerCase();
    const buf = await res.arrayBuffer();
    try {
      const html = new TextDecoder(charset).decode(buf);
      log('decoded with', charset, 'len=', html.length);
      return html;
    } catch {
      const html = new TextDecoder('utf-8').decode(buf);
      warn('fallback utf-8 decode; len=', html.length);
      return html;
    }
  }

  function getSourceNodeFromHTML(html) {
    if (!html) return null;
    if (html.includes(INFO_PAGE_TEXT)) {
      log('info-page text matched, skipping');
      return null;
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const node = doc.querySelector(SOURCE_BLOCK_SELECTOR);
    if (!node) {
      warn('SOURCE_BLOCK not found:', SOURCE_BLOCK_SELECTOR);
      return null;
    }
    return node; // DOM-узел (не строка!)
  }

  function injectNodeClone(targetEl, sourceNode) {
    if (!targetEl || !sourceNode) return;
    targetEl.innerHTML = '';
    // Клонируем целый узел, чтобы не ломать вложенность/незакрытые теги
    targetEl.appendChild(sourceNode.cloneNode(true));
  }

  async function loadSkin(N, root) {
    const target = root.querySelector(SKIN_TARGET_SELECTOR);
    if (!target) { log('no skin target'); return; }

    const firstHTML = await fetchDecoded(`/pages/usr${N}_skin`);
    if (!firstHTML) return;

    // редирект по комментарию <!-- main: usrM_skin -->
    const redirectMatch = REDIR_SKIN_RE.exec(firstHTML);
    if (redirectMatch) {
      const M = redirectMatch[1];
      log('skin redirect to usr' + M + '_skin');
      const secondHTML = await fetchDecoded(`/pages/usr${M}_skin`);
      if (!secondHTML) return;
      if (REDIR_SKIN_RE.test(secondHTML)) {
        log('second redirect detected — abort (return empty)');
        return; // второй редирект — ничего не вставляем
      }
      const node = getSourceNodeFromHTML(secondHTML);
      injectNodeClone(target, node);
      return;
    }

    // обычный случай
    const node = getSourceNodeFromHTML(firstHTML);
    injectNodeClone(target, node);
  }

  async function loadChrono(N, root) {
    const target = root.querySelector(CHRONO_TARGET_SELECTOR);
    if (!target) { log('no chrono target'); return; }

    const html = await fetchDecoded(`/pages/usr${N}_chrono`);
    if (!html) return;

    const node = getSourceNodeFromHTML(html);
    injectNodeClone(target, node);
  }

  async function initIn(root) {
    if (!root) return;
    const charEl = root.querySelector(CHARACTER_SELECTOR);
    if (!charEl) { log('no .character[data-id] in root'); return; }
    const N = (charEl.getAttribute('data-id') || '').trim();
    if (!N) { warn('character has no data-id'); return; }
    log('init root, N=', N);

    await Promise.all([
      loadSkin(N, root),
      loadChrono(N, root),
    ]);
  }

  // Публичный ручной запуск
  window.loadUserSections = function ({ root, rootSelector } = {}) {
    const r = root || (rootSelector ? document.querySelector(rootSelector) : document);
    initIn(r);
  };

  // Автозапуск для статичного DOM
  document.addEventListener('DOMContentLoaded', () => initIn(document));

  // Автозапуск для динамических вставок (модалки и т.п.)
  const seen = new WeakSet();
  const observer = new MutationObserver((records) => {
    // Быстро проверяем, появились ли новые .character[data-id]
    for (const rec of records) {
      rec.addedNodes && rec.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        // сам узел .character…
        if (n.matches && n.matches(CHARACTER_SELECTOR) && !seen.has(n)) {
          seen.add(n);
          const root = n.closest('.modal_wrap, .reveal-modal, body') || document;
          log('observer hit (self), root=', root);
          initIn(root);
        }
        // …или потомки внутри добавленного фрагмента
        n.querySelectorAll && n.querySelectorAll(CHARACTER_SELECTOR).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          const root = el.closest('.modal_wrap, .reveal-modal, body') || document;
          log('observer hit (desc), root=', root);
          initIn(root);
        });
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
