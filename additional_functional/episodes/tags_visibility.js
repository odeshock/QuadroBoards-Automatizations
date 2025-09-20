// tags_visibility_button.init.js
(() => {
  'use strict';

  // ----- настройки кнопки -----
  const BUTTON_LABEL = 'Показать скрытые теги';
  const BUTTON_ORDER = 1;

  // ----- утилиты -----
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function waitFor(fn, { timeout = 10000, interval = 100 } = {}) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      try { const v = fn(); if (v) return v; } catch {}
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
      .fmv-missing{color:#c00;background:#ffe6e6;border-radius:6px;padding:0 .25em;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  // найти контейнер именно этой кнопки
  function findOwnWrap() {
    const container = document.querySelector('.ams_info');
    if (!container) return null;
    return Array.from(container.querySelectorAll('div[data-order]')).find(el => {
      const btn = el.querySelector('button.button');
      return Number(el.dataset.order) === BUTTON_ORDER &&
             btn && btn.textContent.trim() === BUTTON_LABEL;
    }) || null;
  }

  // ---- рендер участников через profileLinkMeta (подсветка не найденных) ----
  function renderParticipantsWithMeta(rawChars, map) {
    const parsed = FMV.parseCharactersUnified(rawChars);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    const parts = items.map((it) => {
      const id = it?.id != null ? String(it.id) : null;
      const knownName = id ? (map.get(id) || null) : null;

      // используем обновлённый profile_from_user
      let headHtml;
      if (id) {
        const meta = (typeof window.profileLinkMeta === 'function')
          ? window.profileLinkMeta(id, knownName)
          : { html: window.profileLink(id, knownName), found: !!knownName };

        if (meta.found) {
          headHtml = meta.html;
        } else {
          const rawText = it?.text ?? knownName ?? `user${id}`;
          headHtml = `<span class="fmv-missing">${FMV.escapeHtml(String(rawText))}</span>`;
        }
      } else {
        const rawText = it?.text ?? it?.name ?? it?.label ?? '';
        headHtml = `<span class="fmv-missing">${FMV.escapeHtml(String(rawText))}</span>`;
      }

      const masks = Array.isArray(it?.masks) && it.masks.length
        ? ` [${it.masks.join(', ')}]`
        : '';
      return headHtml + masks;
    });

    return parts.join('; ');
  }

  // ----- сбор данных и построение блока -----
  async function buildMetaHtml() {
    const ok = await waitFor(() =>
      window.FMV &&
      typeof FMV.readTagText === 'function' &&
      typeof FMV.escapeHtml === 'function' &&
      typeof FMV.parseOrderStrict === 'function' &&
      typeof FMV.buildIdToNameMapFromTags === 'function' &&
      typeof FMV.parseCharactersUnified === 'function' &&
      typeof window.profileLink === 'function'
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
      const participantsHtml = renderParticipantsWithMeta(rawChars, map);
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
    const wrap = findOwnWrap();
    const next = wrap?.nextElementSibling;
    return !!(next && next.classList.contains('fmv-meta'));
  }

  function unmountMetaBlock() {
    const wrap = findOwnWrap();
    const next = wrap?.nextElementSibling;
    if (next && next.classList.contains('fmv-meta')) next.remove();
  }

  async function mountMetaBlock() {
    const wrap = findOwnWrap();
    if (!wrap) return;
    unmountMetaBlock();                       // убираем старый
    const block = await buildMetaHtml();
    if (!block) return;
    wrap.parentNode.insertBefore(block, wrap.nextSibling);
  }

  // ----- кнопка-тумблер -----
  createForumButton({
    allowedGroups: CHRONO_CHECK?.GroupID || [],
    allowedForums: CHRONO_CHECK?.ForumID || [],
    label: BUTTON_LABEL,
    order: BUTTON_ORDER,
    showStatus: false,
    showDetails: false,
    showLink: false,

    async onClick({ wrap }) {
      if (wrap.nextElementSibling?.classList.contains('fmv-meta')) {
        wrap.nextElementSibling.remove();
        localStorage.setItem('fmv:meta:enabled', '0');
      } else {
        const block = await buildMetaHtml();
        if (block) {
          wrap.parentNode.insertBefore(block, wrap.nextSibling);
          localStorage.setItem('fmv:meta:enabled', '1');
        }
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
