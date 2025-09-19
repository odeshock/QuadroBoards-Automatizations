// ==UserScript==
// @name         chrono_tags_visibility
// @description  Показывает мета-информацию темы (участники, маски, локация, сортировка)
// @match        *://*/*
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  //---------------------------------------------------------------------
  // Проверка группы – можно оставить как было
  //---------------------------------------------------------------------
  if (!ensureAllowed()) return;

  //---------------------------------------------------------------------
  // Получаем первый пост темы
  //---------------------------------------------------------------------
  const firstNode = document.querySelector('.message:first-of-type');
  if (!firstNode) return;

  //---------------------------------------------------------------------
  // 1. Парсим исходные теги в сыром виде
  //---------------------------------------------------------------------
  const raw = window.parseChronoTagsRaw(firstNode);

  //---------------------------------------------------------------------
  // 2. Строгая валидация шаблонов (если что-то не так – сразу подсветка)
  //---------------------------------------------------------------------
  const TEMPLATE_USERS = /^\s*user\d+(?:\s*;\s*user\d+)*\s*$/i;
  const TEMPLATE_MASKS = /^\s*user\d+\s*=\s*[^;]+(?:\s*;\s*user\d+\s*=\s*[^;]+)*\s*$/i;

  let validationErrors = [];
  if (raw.participantsLower.length &&
      !TEMPLATE_USERS.test(raw.participantsLower.join('; '))) {
    validationErrors.push('Участники не соответствуют шаблону userN;userN;…');
  }
  const masksJoined = Object.entries(raw.masks).map(([k,v]) => `${k}=${v}`).join('; ');
  if (masksJoined && !TEMPLATE_MASKS.test(masksJoined)) {
    validationErrors.push('Маски не соответствуют шаблону userN=маска;userN=маска');
  }

  //---------------------------------------------------------------------
  // 3. Резолвим имена профилей и готовим HTML (использует profileLink)
  //---------------------------------------------------------------------
  const data = await window.resolveChronoData(raw);

  //---------------------------------------------------------------------
  // 4. Собираем HTML блока
  //---------------------------------------------------------------------
  const lines = [];

  if (validationErrors.length) {
    lines.push(
      `<div class="fmv-row"><span class="fmv-missing">` +
      escapeHtml(validationErrors.join('; ')) + `</span></div>`
    );
  } else {
    if (raw.participantsLower.length) {
      lines.push(
        `<div class="fmv-row"><span class="fmv-label">Участники:</span>${data.participantsHtml}</div>`
      );
    }
    if (Object.keys(raw.masks).length) {
      lines.push(
        `<div class="fmv-row"><span class="fmv-label">Маски:</span>${data.masksHtml}</div>`
      );
    }
    if (raw.location) {
      lines.push(
        `<div class="fmv-row"><span class="fmv-label">Локация:</span>${escapeHtml(raw.location)}</div>`
      );
    }
    if (raw.order) {
      lines.push(
        `<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${escapeHtml(raw.order)}</div>`
      );
    }
  }

  //---------------------------------------------------------------------
  // 5. Вставляем в DOM
  //---------------------------------------------------------------------
  const block = document.createElement('div');
  block.className = 'fmv-meta';
  block.innerHTML = `
    <button class="fmv-toggle">▸</button>
    <div class="fmv-body" style="display:none">${lines.join('\n')}</div>
  `;
  firstNode.insertBefore(block, firstNode.firstChild);

  //---------------------------------------------------------------------
  // 6. Переключатель разворота
  //---------------------------------------------------------------------
  const btn = block.querySelector('.fmv-toggle');
  const body = block.querySelector('.fmv-body');
  btn.addEventListener('click', () => {
    body.style.display = body.style.display === 'none' ? '' : 'none';
    btn.textContent = body.style.display === 'none' ? '▸' : '▾';
  });

  //---------------------------------------------------------------------
  // 7. Стили (подсветка ошибок и т.д.)
  //---------------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    .fmv-meta   { margin: 1em 0; padding: .5em; border: 1px solid #ccc; background:#f9f9f9; }
    .fmv-row    { margin: .25em 0; }
    .fmv-label  { font-weight: bold; margin-right: .25em; }
    .fmv-missing{ color: #c00; font-weight: bold; }
    .fmv-toggle { background:none; border:none; cursor:pointer; font-size:14px; }
  `;
  document.head.appendChild(style);
})();
