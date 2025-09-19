// ==UserScript==
// @name         chrono_tags_visibility
// @description  Показывает мета-инфо темы (участники, маски, локация, сортировка) c общей валидацией
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  // ——— зависимости: общий модуль + profile_from_user ———
  const ok = await waitFor(() =>
    window.FMV &&
    typeof FMV.escapeHtml === 'function' &&
    typeof FMV.parseCharactersStrict === 'function' &&
    typeof FMV.parseMasksStrict === 'function' &&
    typeof window.profileLink === 'function'
  , { timeout: 12000 });
  if (!ok) return;

  // ——— первый пост ———
  const first = await waitFor(() =>
    document.querySelector('.topic .post.topicpost, .post.topicpost, .message:first-of-type')
  );
  if (!first) return;

  // (опц.) фильтр по группам
  if (typeof window.ensureAllowed === 'function' && !window.ensureAllowed()) return;

  // ——— читаем СЫРЫЕ теги ———
  const rawChars = FMV.readTagText(first, 'characters'); // строка вида "user1;user2"
  const rawMasks = FMV.readTagText(first, 'masks');      // строка вида "user1=маска;user2=маска"
  const rawLoc   = FMV.readTagText(first, 'location');
  const rawOrder = FMV.readTagText(first, 'order');

  // карта id->имя (если глобальная есть — возьмём её; иначе с текущей страницы)
  const idToNameMap =
    (window.__FMV_ID_TO_NAME_MAP__ instanceof Map && window.__FMV_ID_TO_NAME_MAP__.size)
      ? window.__FMV_ID_TO_NAME_MAP__
      : FMV.idToNameFromPage();

  // ——— ЕДИНАЯ строгая валидация/рендер ———
  const chars = FMV.parseCharactersStrict(rawChars, idToNameMap, window.profileLink);
  const masks = FMV.parseMasksStrict(rawMasks,      idToNameMap, window.profileLink);

  const lines = [];

  if (rawChars) {
    lines.push(`<div class="fmv-row"><span class="fmv-label">Участники:</span>${chars.html}</div>`);
  }
  if (rawMasks) {
    lines.push(`<div class="fmv-row"><span class="fmv-label">Маски:</span>${masks.html}</div>`);
  }
  if (rawLoc) {
    lines.push(`<div class="fmv-row"><span class="fmv-label">Локация:</span>${FMV.escapeHtml(rawLoc)}</div>`);
  }
  if (rawOrder) {
    const ord = FMV.parseOrderStrict(rawOrder);
    lines.push(`<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${ord.html}</div>`);
  }

  if (!lines.length) return;

  // ——— вставка блока (перед контентом первого поста) ———
  const block = document.createElement('div');
  block.className = 'fmv-meta';
  block.innerHTML = `
    <button class="fmv-toggle" aria-label="toggle">▸</button>
    <div class="fmv-body" style="display:none">${lines.join('\n')}</div>
  `;

  const postBox   = first.querySelector('.post-box');
  const contentEl = postBox?.querySelector('.post-content, [id$="-content"]');

  (first.querySelector('.post-box > .fmv-meta') ||
   first.querySelector('.post-content + .fmv-meta'))?.remove();

  if (postBox && contentEl) {
    postBox.insertBefore(block, contentEl);
  } else if (postBox) {
    postBox.insertBefore(block, postBox.firstChild);
  } else {
    first.insertBefore(block, first.firstChild);
  }

  // ——— поведение кнопки ———
  const btn  = block.querySelector('.fmv-toggle');
  const body = block.querySelector('.fmv-body');
  btn.addEventListener('click', () => {
    const show = body.style.display === 'none';
    body.style.display = show ? '' : 'none';
    btn.textContent = show ? '▾' : '▸';
  });

  // ——— стили ———
  injectStyle(`
    .fmv-meta{
      margin:8px 0; padding:8px; border:1px solid #d7d7d7;
      background:#f7f7f7; border-radius:6px; position:relative;
    }
    .fmv-row{margin:.25em 0}
    .fmv-label{font-weight:700;margin-right:.25em}
    .fmv-missing{color:#c00;background:#ffe6e6;border-radius:6px;padding:0 .35em;font-weight:700}
    .fmv-toggle{
      position:absolute; top:4px; left:4px; background:none; border:none; padding:0; margin:0;
      color:#aaa; font-size:12px; line-height:1; cursor:pointer; opacity:.3; transition:opacity .2s,color .2s
    }
    .fmv-toggle:hover,.fmv-toggle:focus{opacity:1;color:#555;outline:none}
  `);

  // ——— утилиты ———
  function injectStyle(css){
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
  async function waitFor(fn, {timeout=10000, interval=100}={}) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      try { const v = fn(); if (v) return v; } catch(_) {}
      await sleep(interval);
    }
    return null;
  }
})();
