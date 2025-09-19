// ==UserScript==
// @name         RusFF FMV: chrono (split)
// @namespace    fmv-tools
// @match        https://testfmvoice.rusff.me/viewtopic.php?id=*
// @run-at       document-idle
// @grant        none
// @require      file:///<путь>/helpers.js
// @require      file:///<путь>/profile_from_user.js
// @require      file:///<путь>/check_group.js
// ==/UserScript==

(function () {
  'use strict';

  /*** Настройки ***/
  const DEFAULT_COLLAPSED = true;   // блок по умолчанию свёрнут?
  const MAKE_NAMES_LINKS  = false;  // делать имена ссылками на профили
  const isFiniteNum = (x) => x !== null && x !== undefined && isFinite(Number(x));


  // ─────────────── вставка блока с тэгами ───────────────
  let blockCounter = 0;
  function insertBlock(linesHtml, whereEl){
    if (!linesHtml) return;

    const idx = ++blockCounter;
    const storageKey = `fmv:${location.pathname}${location.search}:#${idx}`;

    const container = document.createElement('div');
    container.className = 'fmv-meta is-collapsed';
    container.innerHTML = `
      <button class="fmv-toggle" type="button" aria-expanded="false" title="Показать/скрыть теги" data-key="${storageKey}">▸</button>
      <div class="fmv-body" hidden>
        ${linesHtml}
      </div>
    `;

    const styleId = 'fmv-meta-style';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
        .fmv-meta{
          position:relative; border:1px dashed #bfbfbf; padding:10px 12px;
          margin:10px 0 14px; font-size:14px; line-height:1.5; border-radius:8px; background:#fafafa;
        }
        .fmv-meta.is-collapsed{ display:inline-block; border:none; padding:0; background:transparent; margin:6px 0; }
        .fmv-toggle{
          font:inherit; line-height:1; border:1px solid #d0d0d0; background:#f3f3f3;
          padding:0 4px; border-radius:6px; cursor:pointer; opacity:.7; user-select:none; height:18px; min-width:18px;
          display:inline-flex; align-items:center; justify-content:center;
        }
        .fmv-toggle:hover{ opacity:1; }
        .fmv-body{ margin-top:6px; }
        .fmv-row{ margin:4px 0; }
        .fmv-label{ font-weight:600; margin-right:.35em; }
        .fmv-missing{ background:#ffe5e5; color:#c00; padding:0 .25em; border-radius:4px; font-weight:600; }
        .custom_tag.hidden_tag{ display:none !important; }
      `;
      document.head.appendChild(st);
    }

    if (whereEl) {
      whereEl.parentNode.insertBefore(container, whereEl.nextSibling);
    } else {
      const anchor = document.querySelector('.post, .blockpost, h1, #pun-title') || document.body.firstChild;
      anchor.parentNode.insertBefore(container, anchor);
    }

    const btn  = container.querySelector('.fmv-toggle');
    const body = container.querySelector('.fmv-body');
    const saved = localStorage.getItem(storageKey);
    const startCollapsed = saved === null ? DEFAULT_COLLAPSED : (saved === '1');
    applyCollapsed(startCollapsed);

    btn.addEventListener('click', () => {
      const collapsed = container.classList.toggle('is-collapsed');
      body.hidden = collapsed;
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.textContent = collapsed ? '▸' : '▾';
      localStorage.setItem(storageKey, collapsed ? '1' : '0');
    });

    function applyCollapsed(collapsed){
      if (collapsed){
        container.classList.add('is-collapsed');
        body.hidden = true;
        btn.setAttribute('aria-expanded','false');
        btn.textContent = '▸';
      } else {
        container.classList.remove('is-collapsed');
        body.hidden = false;
        btn.setAttribute('aria-expanded','true');
        btn.textContent = '▾';
      }
    }
  }

  // ─────────────── Основная логика ───────────────
  (async function main(){
    const allowed = await ensureAllowed();
    if (!allowed) return;

    const tagSelectors = [
      'characters.custom_tag_FMVcast, characters.custom_tag.custom_tag_FMVcast',
      'masks.custom_tag_FMVmask, masks.custom_tag.custom_tag_FMVmask',
      'location.custom_tag_FMVplace, location.custom_tag.custom_tag_FMVplace',
      'order.custom_tag_FMVord, order.custom_tag.custom_tag_FMVord'
    ].join(', ');
    const allTags = Array.from(document.querySelectorAll(tagSelectors));
    if (allTags.length === 0) return;

    // Группируем теги по контейнеру поста
    const byContainer = new Map();
    for (const tag of allTags){
      const post = tag.closest('.post, .blockpost, .postmsg, .entry, .msg, .main, article') || document.body;
      if (!byContainer.has(post)) byContainer.set(post, []);
      byContainer.get(post).push(tag);
    }

    // Рисуем блоки
    for (const [post, tags] of byContainer.entries()){
      const charEl = tags.find(el => el.tagName.toLowerCase()==='characters');
      const maskEl = tags.find(el => el.tagName.toLowerCase()==='masks');
      const locEl  = tags.find(el => el.tagName.toLowerCase()==='location');
      const ordEl  = tags.find(el => el.tagName.toLowerCase()==='order');

      const charText = charEl?.textContent.trim() || '';
      const maskText = maskEl?.textContent.trim() || '';
      const locText  = locEl?.textContent.trim() || '';
      const ordText  = ordEl?.textContent.trim() || '';

      // Соберём id из characters/masks
      const ids = new Set([
        ...extractUserIdsFromString(charText),
        ...extractUserIdsFromString(maskText),
      ]);
      const idToNameMap = new Map();
      await Promise.all(Array.from(ids).map(async (id)=>{
        const nm = await getProfileNameById(id);
        if (nm && nm.length) idToNameMap.set(String(Number(id)), nm);
      }));

      const lines = [];
      // стало:
      if (charText) {
        // допустимый шаблон: userN(; userN)*
        const TEMPLATE = /^\s*user\d+(?:\s*;\s*user\d+)*\s*$/i;
      
        // нормализованный вывод (для показа исходного ввода с пробелами)
        const human = charText.split(/\s*;\s*/).filter(Boolean).join('; ');
      
        if (!TEMPLATE.test(charText)) {
          // Совсем не по шаблону — ругаемся и подсвечиваем
          lines.push(
            `<div class="fmv-row"><span class="fmv-label">Участники:</span> ` +
            `<span class="fmv-missing">Аааа! Надо пересобрать всё внутри по шаблону: userN;userN;userN</span> — ${escapeHtml(human)}</div>`
          );
        } else {
          // По шаблону — парсим ids в исходном порядке
          const orderIds = (charText.match(/user(\d+)/gi) || []).map(m => String(Number(m.replace(/^\D+/,'') || '')));
          // превращаем в ссылки/имена или "userN (не найден)" с подсветкой
          const rendered = orderIds.map(id => profileLink(id, idToNameMap.get(id))).join('; ');
          lines.push(`<div class="fmv-row"><span class="fmv-label">Участники:</span>${rendered}</div>`);
        }
      }
      if (maskText){
        const pairs = replaceUserInPairs(maskText, idToNameMap);
        lines.push(`<div class="fmv-row"><span class="fmv-label">Маски:</span>${pairs}</div>`);
      }
      if (locText){
        lines.push(`<div class="fmv-row"><span class="fmv-label">Локация:</span>${escapeHtml(locText)}</div>`);
      }
      if (ordText){
        lines.push(`<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${escapeHtml(ordText)}</div>`);
      }

      if (lines.length) insertBlock(lines.join('\n'), tags[0]);
    }
  })();
})();
