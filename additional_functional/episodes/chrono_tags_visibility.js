// ==UserScript==
// @name         chrono_tags_visibility
// @description  Показывает мета-инфо темы (участники, маски, локация, сортировка)
// @match        *://*/*
// @grant        none
// ==/UserScript==

(async function () {
  'use strict';

  // ---------- утилиты ожидания ----------
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  async function waitFor(fn, {timeout=10000, interval=100}={}) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  // ---------- зависимости из helpers/profile_from_user ----------
  const depsOK = await waitFor(() =>
    window.parseChronoTagsRaw &&
    window.resolveChronoData &&
    typeof window.escapeHtml === 'function' &&
    typeof window.profileLink === 'function'
  );
  if (!depsOK) return console.warn('[FMV] chrono: нет зависимостей');

  // ---------- первый пост в топике ----------
  const firstNode = await waitFor(() =>
    document.querySelector('#topic_* .post.topicpost, .topic .post.topicpost, .post.topicpost, .message:first-of-type, .post:first-of-type')
  );
  if (!firstNode) return console.warn('[FMV] chrono: не нашли первый пост');

  // ---------- (опц.) проверка группы ----------
  if (typeof window.ensureAllowed === 'function' && !window.ensureAllowed()) return;

  // ---------- парсинг и резолв ----------
  const raw  = window.parseChronoTagsRaw(firstNode);
  const data = await window.resolveChronoData(raw);

  // строгие шаблоны (как договаривались)
  const TEMPLATE_USERS = /^\s*user\d+(?:\s*;\s*user\d+)*\s*$/i;
  const TEMPLATE_MASKS = /^\s*user\d+\s*=\s*[^;]+(?:\s*;\s*user\d+\s*=\s*[^;]+)*\s*$/i;

  const lines = [];
  // валидируем только если исходные строки есть
  const charsJoined = raw.participantsLower.join('; ');
  const masksJoined = Object.entries(raw.masks).map(([k,v])=>`${k}=${v}`).join('; ');

  if (charsJoined && !TEMPLATE_USERS.test(charsJoined)) {
    lines.push(`<div class="fmv-row"><span class="fmv-missing">Аааа! Надо пересобрать по шаблону: userN;userN;userN</span> — ${escapeHtml(charsJoined)}</div>`);
  } else if (raw.participantsLower.length) {
    lines.push(`<div class="fmv-row"><span class="fmv-label">Участники:</span>${data.participantsHtml}</div>`);
  }

  if (masksJoined && !TEMPLATE_MASKS.test(masksJoined)) {
    const human = masksJoined.replace(/\s*;\s*/g, '; ');
    lines.push(`<div class="fmv-row"><span class="fmv-missing">Аааа! Надо пересобрать по шаблону: userN=маска;userN=маска</span> — ${escapeHtml(human)}</div>`);
  } else if (Object.keys(raw.masks).length) {
    lines.push(`<div class="fmv-row"><span class="fmv-label">Маски:</span>${data.masksHtml}</div>`);
  }

  if (raw.location) {
    lines.push(`<div class="fmv-row"><span class="fmv-label">Локация:</span>${escapeHtml(raw.location)}</div>`);
  }
  if (raw.order) {
    lines.push(`<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${escapeHtml(raw.order)}</div>`);
  }

  // ---------- сборка блока ----------
  const block = document.createElement('div');
  block.className = 'fmv-meta';
  block.innerHTML = `
    <button class="fmv-toggle">▸</button>
    <div class="fmv-body" style="display:none">${lines.join('\n')}</div>
  `;

  // ---------- точка вставки: СРАЗУ ПОСЛЕ .post-content ----------
  const contentEl =
    firstNode.querySelector('.post-content') ||
    firstNode.querySelector('[id$="-content"]');
  const fallbackHost =
    firstNode.querySelector('.post-body, .postright, .post-box, .post') || firstNode;

  // удалить предыдущую копию, если перезапуск
  const old = firstNode.querySelector('.post-content + .fmv-meta, :scope > .fmv-meta');
  if (old) old.remove();

  if (contentEl) {
    contentEl.insertAdjacentElement('afterend', block);
  } else {
    fallbackHost.insertBefore(block, fallbackHost.firstChild);
  }

  // ---------- поведение кнопки ----------
  const btn  = block.querySelector('.fmv-toggle');
  const body = block.querySelector('.fmv-body');
  btn.addEventListener('click', () => {
    body.style.display = body.style.display === 'none' ? '' : 'none';
    btn.textContent = body.style.display === 'none' ? '▸' : '▾';
  });

  // ---------- стили ----------
  const style = document.createElement('style');
  style.textContent = `
    .fmv-meta{margin:8px 0;padding:8px;border:1px solid #d7d7d7;background:#f7f7f7;border-radius:4px}
    .fmv-row{margin:.25em 0}
    .fmv-label{font-weight:700;margin-right:.25em}
    .fmv-missing{color:#c00;background:#ffe6e6;border-radius:6px;padding:0 .35em;font-weight:700}
    .fmv-toggle{background:none;border:none;cursor:pointer;font-size:14px;line-height:1}
  `;
  document.head.appendChild(style);
})();
