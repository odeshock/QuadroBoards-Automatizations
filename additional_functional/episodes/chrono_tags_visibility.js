// ==UserScript==
// @name         chrono_tags_visibility (unified characters)
// @description  Показывает мета-инфо темы (участники, маски, локация, сортировка) из единого <characters>
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  // ждём зависимости: общий модуль + profile_from_user
  const ok = await waitFor(() =>
    window.FMV &&
    typeof FMV.readTagText === 'function' &&
    typeof FMV.escapeHtml === 'function' &&
    typeof FMV.parseOrderStrict === 'function' &&
    typeof FMV.buildIdToNameMapFromTags === 'function' &&
    typeof FMV.parseCharactersUnified === 'function' &&
    typeof window.profileLink === 'function'
  , { timeout: 15000 });
  if (!ok) return;

  // первый пост темы
  const first = await waitFor(() =>
    document.querySelector('.topic .post.topicpost, .post.topicpost, .message:first-of-type')
  , { timeout: 15000 });
  if (!first) return;

  // (опц.) фильтр по группам, если подключён check_group
  if (typeof window.ensureAllowed === 'function' && !window.ensureAllowed()) return;

  // читаем СЫРЫЕ теги
  const rawChars = FMV.readTagText(first, 'characters'); // формат: userN; userM=mask; userM=mask; userK
  const rawLoc   = FMV.readTagText(first, 'location');
  const rawOrder = FMV.readTagText(first, 'order');

  // карта id->имя ровно по тем userID, что есть в characters
  const idToNameMap = await FMV.buildIdToNameMapFromTags(rawChars);

  // единый парсер участников/масок
  const uni = FMV.parseCharactersUnified(rawChars, idToNameMap, window.profileLink);

  // формируем строки
  const lines = [];

  if (rawChars) {
    if (!uni.ok) {
      lines.push(
        `<div class="fmv-row"><span class="fmv-label">Участники:</span>${uni.htmlError}</div>`
      );
    } else {
      lines.push(
        `<div class="fmv-row"><span class="fmv-label">Участники:</span>${uni.htmlParticipants}</div>`
      );
      if (uni.htmlMasks) {
        lines.push(
          `<div class="fmv-row"><span class="fmv-label">Маски:</span>${uni.htmlMasks}</div>`
        );
      }
    }
  }

  if (rawLoc) {
    lines.push(
      `<div class="fmv-row"><span class="fmv-label">Локация:</span>${FMV.escapeHtml(rawLoc)}</div>`
    );
  }

  if (rawOrder) {
    const ord = FMV.parseOrderStrict(rawOrder);
    lines.push(
      `<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${ord.html}</div>`
    );
  }

  if (!lines.length) return;

  // вставка блока (перед контентом первого поста)
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

  // поведение кнопки
  const btn  = block.querySelector('.fmv-toggle');
  const body = block.querySelector('.fmv-body');
  btn.addEventListener('click', () => {
    const show = body.style.display === 'none';
    body.style.display = show ? '' : 'none';
    btn.textContent = show ? '▾' : '▸';
  });

  // стили
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
