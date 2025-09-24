(function () {
  // ==== настройки ====
  const SOURCE_BLOCK = '#pun-main .container';
  const INFO_TEXT = 'Ссылка, по которой Вы пришли, неверная или устаревшая.';
  const DEFAULT_CHARSET = 'windows-1251';
  const REDIR_SKIN_RE = /<!--\s*main:\s*usr(\d+)_skin\s*-->/i;
  const CHARACTER_SELECTOR = '.character[data-id]';
  const SKIN_TARGET_SEL = '.skin_info';
  const CHRONO_TARGET_SEL = '.chrono_info';
  // ====================

  async function fetchDecoded(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || '';
    const m = ct.match(/charset=([^;]+)/i);
    const charset = (m ? m[1] : DEFAULT_CHARSET).toLowerCase();
    try {
      return new TextDecoder(charset).decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf);
    }
  }

  function extractNode(html) {
    if (!html || html.includes(INFO_TEXT)) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.querySelector(SOURCE_BLOCK);
  }

  async function loadSkin(N, root) {
    const target = root.querySelector(SKIN_TARGET_SEL);
    if (!target) return;

    const firstHTML = await fetchDecoded(`/pages/usr${N}_skin`);
    if (!firstHTML) return;

    const redirectMatch = REDIR_SKIN_RE.exec(firstHTML);
    if (redirectMatch) {
      const M = redirectMatch[1];
      const secondHTML = await fetchDecoded(`/pages/usr${M}_skin`);
      if (!secondHTML) return;
      if (REDIR_SKIN_RE.test(secondHTML)) return; // второй редирект — выходим
      const node = extractNode(secondHTML);
      if (!node) return;
      target.innerHTML = '';
      target.appendChild(node.cloneNode(true));
      return;
    }

    const node = extractNode(firstHTML);
    if (!node) return;
    target.innerHTML = '';
    target.appendChild(node.cloneNode(true));
  }

  async function loadChrono(N, root) {
    const target = root.querySelector(CHRONO_TARGET_SEL);
    if (!target) return;

    const html = await fetchDecoded(`/pages/usr${N}_chrono`);
    if (!html) return;
    const node = extractNode(html);
    if (!node) return;
    target.innerHTML = '';
    target.appendChild(node.cloneNode(true));
  }

  // ——— инициализация для указанного контейнера (root) ———
  async function initIn(root) {
    if (!root) return;
    const characterEl = root.querySelector(CHARACTER_SELECTOR);
    const N = characterEl && characterEl.getAttribute('data-id')?.trim();
    if (!N) return;
    await Promise.all([loadSkin(N, root), loadChrono(N, root)]);
  }

  // Экспортируем функцию на всякий случай (ручной вызов)
  window.loadUserSections = function (opts = {}) {
    const root =
      opts.root ||
      (typeof opts.rootSelector === 'string'
        ? document.querySelector(opts.rootSelector)
        : document);
    initIn(root);
  };

  // 1) Автозапуск для всей страницы
  document.addEventListener('DOMContentLoaded', () => initIn(document));

  // 2) Автозапуск для динамических вставок (модалка и т.п.)
  const seen = new WeakSet();
  const observer = new MutationObserver(() => {
    document.querySelectorAll(CHARACTER_SELECTOR).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      // корень — ближайший контейнер, где будут .skin_info/.chrono_info
      const root = el.closest('.modal_wrap, .reveal-modal, body') || document;
      initIn(root);
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
