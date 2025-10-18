(function () {
  // ==== настройки ====
  const SOURCE_BLOCK = '#pun-main .container';
  const INFO_TEXT = 'Ссылка, по которой Вы пришли, неверная или устаревшая.';
  const DEFAULT_CHARSET = 'windows-1251';
  const CHARACTER_SELECTOR = '.modal_script[data-id]';
  const SKIN_TARGET_SEL = '.skin_info';
  const CHRONO_TARGET_SEL = '.chrono_info';
  const DEBUG = false;

  // соответствия "имя секции" -> "селектор целевого контейнера"
  // важное: для _background страница называется usrN_back
  const SECTION_MAP = {
    skin: '.skin_info',          // /pages/usrN_skin
    chrono: '.chrono_info',      // /pages/usrN_chrono
    gift: '._gift',              // /pages/usrN_gift
    plashka: '._plashka',        // /pages/usrN_plashka
    icon: '._icon',              // /pages/usrN_icon
    background: '._background',  // /pages/usrN_background 
    coupon: '._coupon'           // /pages/usrN_coupon
  };
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
  // (оставляем как в оригинале; при необходимости можно добавить и новые секции)
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

  // универсальная загрузка секции с поддержкой комментария-редиректа <!-- main: usrM_<section> -->
  async function loadSection(N, scope, name, selector) {
    const target = scope.querySelector(selector);
    if (!target) return;

    // формируем suffix страницы: back — особый случай, остальные = name как есть
    const suffix = (name === 'back') ? 'back' : name;

    // 1-я попытка
    const firstHTML = await fetchDecoded(`/pages/usr${N}_${suffix}`);
    if (!firstHTML) return;

    // проверяем универсальный редирект через комментарий
    const redirectRe = new RegExp(`<!--\\s*main:\\s*usr(\\d+)_${suffix}\\s*-->`, 'i');
    const match = redirectRe.exec(firstHTML);
    if (match) {
      const M = match[1];
      // 2-я попытка по "основному" пользователю
      const secondHTML = await fetchDecoded(`/pages/usr${M}_${suffix}`);
      if (!secondHTML || redirectRe.test(secondHTML)) return; // страховка от зацикливания
      const node = extractNode(secondHTML);
      injectNodeClone(target, node);
      return;
    }

    const node = extractNode(firstHTML);
    injectNodeClone(target, node);
  }

  async function initIn(root) {
    if (!root) return;
    // берём конкретного character, а не первый на документе
    const charEl = root.querySelector(CHARACTER_SELECTOR) || document.querySelector(CHARACTER_SELECTOR);
    if (!charEl) { log('no character'); return; }

    const scope = scopeForCharacter(charEl);
    normalizeStructure(scope); // выравниваем вложенность, как в оригинале

    const N = charEl.getAttribute('data-id')?.trim();
    if (!N) return;

    // параллельно грузим все зарегистрированные секции
    await Promise.all(
      Object.entries(SECTION_MAP).map(([name, selector]) => loadSection(N, scope, name, selector))
    );
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
  const observer = new MutationObserver((recs) => {
    recs.forEach(rec => {
      rec.addedNodes && rec.addedNodes.forEach(n => {
        if (!(n instanceof Element)) return;
        // если добавили .character — запускаемся в его scope
        if (n.matches && n.matches(CHARACTER_SELECTOR) && !seen.has(n)) {
          seen.add(n);
          initIn(scopeForCharacter(n));
        }
        // или если .character появился как потомок
        n.querySelectorAll && n.querySelectorAll(CHARACTER_SELECTOR).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          initIn(scopeForCharacter(el));
        });
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
