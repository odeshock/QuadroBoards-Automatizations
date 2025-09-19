// ==UserScript==
// @name         chrono_tags_visibility
// @description  Показывает мета-информацию темы (участники, маски, локация, сортировка)
// @match        *://*/*
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  // --- небольшие утилиты ожидания ---
  const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));
  async function waitFor(fn, {timeout=8000, interval=100}={}) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  // 1) ждём зависимости из helpers/profile_from_user
  const depsOK = await waitFor(() =>
    window.parseChronoTagsRaw &&
    window.resolveChronoData &&
    typeof window.profileLink === 'function' &&
    typeof window.escapeHtml === 'function'
  , {timeout: 10000});

  if (!depsOK) {
    console.warn('[FMV] chrono: нет зависимостей (helpers/profile_from_user)');
    return;
  }

  // 2) ждём появление первого поста
  const firstNode = await waitFor(() =>
    document.querySelector('.message:first-of-type') ||
    document.querySelector('.post') ||
    document.querySelector('.pun-viewtopic .post')
  , {timeout: 10000});
  if (!firstNode) {
    console.warn('[FMV] chrono: не нашли первый пост');
    return;
  }

  // 3) проверка группы (если функция есть)
  if (typeof window.ensureAllowed === 'function' && !window.ensureAllowed()) return;

  // --- твой основной код ниже можно оставить без изменений ---
  const raw = window.parseChronoTagsRaw(firstNode);

  const TEMPLATE_USERS = /^\s*user\d+(?:\s*;\s*user\d+)*\s*$/i;
  const TEMPLATE_MASKS = /^\s*user\d+\s*=\s*[^;]+(?:\s*;\s*user\d+\s*=\s*[^;]+)*\s*$/i;

  let validationErrors = [];
  if (raw.participantsLower.length && !TEMPLATE_USERS.test(raw.participantsLower.join('; '))) {
    validationErrors.push('Участники не соответствуют шаблону userN;userN;…');
  }
  const masksJoined = Object.entries(raw.masks).map(([k,v]) => `${k}=${v}`).join('; ');
  if (masksJoined && !TEMPLATE_MASKS.test(masksJoined)) {
    validationErrors.push('Маски не соответствуют шаблону userN=маска;userN=маска');
  }

  const data = await window.resolveChronoData(raw);

  const lines = [];
  if (validationErrors.length) {
    lines.push(
      `<div class="fmv-row"><span class="fmv-missing">${escapeHtml(validationErrors.join('; '))}</span></div>`
    );
  } else {
    if (raw.participantsLower.length) {
      lines.push(`<div class="fmv-row"><span class="fmv-label">Участники:</span>${data.participantsHtml}</div>`);
    }
    if (Object.keys(raw.masks).length) {
      lines.push(`<div class="fmv-row"><span class="fmv-label">Маски:</span>${data.masksHtml}</div>`);
    }
    if (raw.location) {
      lines.push(`<div class="fmv-row"><span class="fmv-label">Локация:</span>${escapeHtml(raw.location)}</div>`);
    }
    if (raw.order) {
      lines.push(`<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${escapeHtml(raw.order)}</div>`);
    }
  }

  const block = document.createElement('div');
  block.className = 'fmv-meta';
  block.innerHTML = `
    <button class="fmv-toggle">▸</button>
    <div class="fmv-body" style="display:none">${lines.join('\n')}</div>
  `;
  firstNode.insertBefore(block, firstNode.firstChild);

  const btn  = block.querySelector('.fmv-toggle');
  const body = block.querySelector('.fmv-body');
  btn.addEventListener('click', () => {
    body.style.display = body.style.display === 'none' ? '' : 'none';
    btn.textContent = body.style.display === 'none' ? '▸' : '▾';
  });

  // стили (как были)
  const style = document.createElement('style');
  style.textContent = `
    .fmv-meta{margin:1em 0;padding:.5em;border:1px solid #ccc;background:#f9f9f9}
    .fmv-row{margin:.25em 0}
    .fmv-label{font-weight:bold;margin-right:.25em}
    .fmv-missing{color:#c00;font-weight:bold}
    .fmv-toggle{background:none;border:none;cursor:pointer;font-size:14px}
  `;
  document.head.appendChild(style);
})();
