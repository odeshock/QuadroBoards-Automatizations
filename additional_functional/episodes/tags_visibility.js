// tags_visibility_button.init.js
(() => {
  'use strict';

  // ====== Настройки именно этой кнопки ======
  const BUTTON_LABEL = 'Мета-инфо';
  const BUTTON_ORDER = 1;

  // ====== Утилиты ======
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function waitFor(fn, { timeout = 10000, interval = 100 } = {}) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      try { const v = fn(); if (v) return v; } catch (_) {}
      await sleep(interval);
    }
    return null;
  }

  function topicKey() {
    try {
      const u = new URL(location.href);
      const id = u.searchParams.get('id') || u.searchParams.get('tid') || '';
      return `fmv:meta:enabled:${id || u.pathname}`;
    } catch {
      return `fmv:meta:enabled:${location.href}`;
    }
  }

  function injectStyleOnce() {
    if (document.getElementById('fmv-meta-style')) return;
    const style = document.createElement('style');
    style.id = 'fmv-meta-style';
    style.textContent = `
      .fmv-meta{
        margin:8px 0; padding:8px; border:1px solid #d7d7d7;
        background:#f7f7f7; border-radius:6px;
      }
      .fmv-row{margin:.25em 0}
      .fmv-label{font-weight:700;margin-right:.25em}
      .fmv-missing{color:#c00;background:#ffe6e6;border-radius:6px;padding:0 .35em;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  // найти наш wrap (контейнер кнопки) по order и label
  function findOwnWrap() {
    const container = document.querySelector('.ams_info');
    if (!container) return null;
    const candidates = Array.from(container.querySelectorAll('div[data-order]'));
    return candidates.find(el => {
      const btn = el.querySelector('button.button');
      const sameOrder = Number(el.dataset.order) === Number(BUTTON_ORDER);
      const sameLabel = btn && btn.textContent.trim() === BUTTON_LABEL;
      return sameOrder && sameLabel;
    }) || null;
  }

  // ====== Монтаж/демонтаж блока ======
  async function buildMetaHtml() {
    // ждём зависимости FMV (как и раньше)
    const ok = await waitFor(() =>
      window.FMV &&
      typeof FMV.readTagText === 'function' &&
      typeof FMV.escapeHtml === 'function' &&
      typeof FMV.parseOrderStrict === 'function' &&
      typeof FMV.buildIdToNameMapFromTags === 'function' &&
      typeof FMV.parseCharactersUnified === 'function'
    , { timeout: 15000 });
    if (!ok) return null;

    const first = await waitFor(() =>
      document.querySelector('.topic .post.topicpost, .post.topicpost, .message:first-of-type')
    , { timeout: 15000 });
    if (!first) return null;

    if (typeof window.ensureAllowed === 'function' && !window.ensureAllowed()) return null;

    const rawChars = FMV.readTagText(first, 'characters');
    const rawLoc   = FMV.readTagText(first, 'location');
    const rawOrder = FMV.readTagText(first, 'order');

    const map = await FMV.buildIdToNameMapFromTags(rawChars);

    const parts = [];
    if (rawChars) {
      const participantsHtml = FMV.renderParticipantsHtml(rawChars, map, window.profileLink);
      parts.push(`<div class="fmv-row"><span class="fmv-label">Участники:</span>${participantsHtml}</div>`);
    }
    if (rawLoc) {
      parts.push(`<div class="fmv-row"><span class="fmv-label">Локация:</span>${FMV.escapeHtml(rawLoc)}</div>`);
    }
    if (rawOrder) {
      const ord = FMV.parseOrderStrict(rawOrder);
      parts.push(`<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${ord.html}</div>`);
    }

    if (!parts.length) return null;

    injectStyleOnce();

    const block = document.createElement('div');
    block.className = 'fmv-meta';
    block.innerHTML = parts.join('\n');
    return block;
  }

  function isMounted() {
    // блок привязываем как ближайшего соседа под нашим wrap
    const wrap = findOwnWrap();
    if (!wrap) return false;
    const next = wrap.nextElementSibling;
    return !!(next && next.classList && next.classList.contains('fmv-meta'));
  }

  function unmountMetaBlock() {
    const wrap = findOwnWrap();
    if (!wrap) return;
    const next = wrap.nextElementSibling;
    if (next && next.classList && next.classList.contains('fmv-meta')) next.remove();
  }

  async function mountMetaBlock() {
    const wrap = findOwnWrap();
    if (!wrap) return;

    // если уже есть — обновим (на случай, если теги изменились)
    unmountMetaBlock();

    const block = await buildMetaHtml();
    if (!block) return;

    // вставляем СРАЗУ ПОД КНОПКОЙ
    if (wrap.nextSibling) {
      wrap.parentNode.insertBefore(block, wrap.nextSibling);
    } else {
      wrap.parentNode.appendChild(block);
    }
  }

  // ====== Кнопка-тумблер через createForumButton ======
  createForumButton({
    allowedGroups: (PROFILE_CHECK && PROFILE_CHECK.GroupID) || [],
    allowedForums: (PROFILE_CHECK && PROFILE_CHECK.ForumIDs) || [],
    label: BUTTON_LABEL,
    order: BUTTON_ORDER,

    async onClick() {
      if (isMounted()) {
        unmountMetaBlock();
        localStorage.setItem(topicKey(), '0');
      } else {
        await mountMetaBlock();
        localStorage.setItem(topicKey(), '1');
      }
    }
  });

  // авто-восстановление состояния
  (async () => {
    if (localStorage.getItem(topicKey()) === '1' && !isMounted()) {
      await mountMetaBlock();
    }
  })();
})();
