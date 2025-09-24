(function () {
  // ==== настройки ====
  const SOURCE_BLOCK = '#pun-main .container';
  const INFO_TEXT = 'Ссылка, по которой Вы пришли, неверная или устаревшая.';
  const DEFAULT_CHARSET = 'windows-1251';
  const REDIR_SKIN_RE = /<!--\s*main:\s*usr(\d+)_skin\s*-->/i;
  const CHARACTER_SELECTOR = '.character[data-id]';
  const SKIN_TARGET_SEL = '.skin_info';
  const CHRONO_TARGET_SEL = '.chrono_info';
  const DEBUG = false;
  // ====================

  const log = (...a) => DEBUG && console.log('[collect]', ...a);

  async function fetchDecoded(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || '';
    const m = ct.match(/charset=([^;]+)/i);
    const charset = (m ? m[1] : DEFAULT_CHARSET).toLowerCase();
    try { return new TextDecoder(charset).decode(buf); }
    catch { return new TextDecoder('utf-8').decode(buf); }
  }

  function extractNode(html) {
    if (!html || html.includes(INFO_TEXT)) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.querySelector(SOURCE_BLOCK);
  }

  function injectNodeClone(target, node) {
    if (!target || !node) return;
    target.innerHTML = '';
    target.appendChild(node.cloneNode(true));
  }

  // Переносит .skin_info / .chrono_info внутрь .character, если они оказались соседями
  function normalizeStructure(scope) {
    const char = scope.querySelector(CHARACTER_SELECTOR);
    if (!char) return;
    const skin = scope.querySelector(SKIN_TARGET_SEL);
    const chrono = scope.querySelector(CHRONO_TARGET_SEL);
    if (skin && skin.parentElement !== char) char.appendChild(skin);
    if (chrono && chrono.parentElement !== char) char.appendChild(chrono);
  }

  // Находим «узкий» scope вокруг конкретного персонажа
  function scopeForCharacter(el) {
    return el.closest('.modal_wrap, .reveal-modal, .container, #character') || el.parentElement || document;
  }

  async function loadSkin(N, scope) {
    const target = scope.querySelector(SKIN_TARGET_SEL);
    if (!target) return;

    const firstHTML = await fetchDecoded(`/pages/usr${N}_skin`);
    if (!firstHTML) return;

    const redirectMatch = REDIR_SKIN_RE.exec(firstHTML);
    if (redirectMatch) {
      const M = redirectMatch[1];
      const secondHTML = await fetchDecoded(`/pages/usr${M}_skin`);
      if (!secondHTML || REDIR_SKIN_RE.test(secondHTML)) return;
      const node = extractNode(secondHTML);
      injectNodeClone(target, node);
      return;
    }

    const node = extractNode(firstHTML);
    injectNodeClone(target, node);
  }

  async function loadChrono(N, scope) {
    const target = scope.querySelector(CHRONO_TARGET_SEL);
    if (!target) return;
    const html = await fetchDecoded(`/pages/usr${N}_chrono`);
    const node = extractNode(html);
    injectNodeClone(target, node);
  }

  async function initIn(root) {
    if (!root) return;
    // берём конкретного character, а не первый на документе
    const charEl = root.querySelector(CHARACTER_SELECTOR) || document.querySelector(CHARACTER_SELECTOR);
    if (!charEl) { log('no character'); return; }

    const scope = scopeForCharacter(charEl);
    normalizeStructure(scope);             // <— выравниваем вложенность

    const N = charEl.getAttribute('data-id')?.trim();
    if (!N) return;

    await Promise.all([ loadSkin(N, scope), loadChrono(N, scope) ]);
  }

  // ручной запуск
  window.loadUserSections = function ({ root, rootSelector } = {}) {
    const r = root || (rootSelector ? document.querySelector(rootSelector) : document);
    initIn(r);
  };

  // автозапуск
  document.addEventListener('DOMContentLoaded', () => initIn(document));

  // динамика (модалки)
  const seen = new WeakSet();
  const observer = new MutationObserver((recs) =>
