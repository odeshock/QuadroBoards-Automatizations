// ==UserScript==
// @name         get_all
// @description  Сбор всех страниц темы в один список (с участниками/масками как в chrono)
// @match        *://*/*viewtopic.php?id=*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------------- small utils ----------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  async function waitForDeps(timeout=12000){
    const t0 = performance.now();
    while (performance.now()-t0 < timeout){
      if (window.parseChronoTagsRaw &&
          window.resolveChronoData   &&
          typeof window.escapeHtml   === 'function' &&
          typeof window.profileLink  === 'function') return true;
      await sleep(120);
    }
    console.warn('[get_all] deps not ready');
    return false;
  }

  // ---------------- entry ----------------
  const ready = document.readyState === 'complete' || document.readyState === 'interactive';
  if (!ready) document.addEventListener('DOMContentLoaded', mount); else mount();

  async function mount(){
    if (!await waitForDeps()) return;

    // куда положить кнопку
    const h2 = $('div.topic > h2, #pun-viewtopic h2, .topic h2') || document.body;
    const btn = document.createElement('button');
    btn.textContent = 'Собрать хронологию';
    btn.style.cssText = `
      margin:6px 0 12px; padding:6px 10px; border-radius:6px; border:1px solid #bbb;
      background:#fafafa; cursor:pointer; font-size:14px;
    `;
    h2.insertAdjacentElement('afterend', btn);

    const out = document.createElement('div');
    out.id = 'get-all-output';
    h2.insertAdjacentElement('afterend', out);

    btn.addEventListener('click', async ()=>{
      btn.disabled = true; btn.textContent = 'Собираю…';
      try{
        const items = await collectTopic();
        out.innerHTML = buildWrappedHTML(items);
      } finally {
        btn.disabled = false; btn.textContent = 'Собрать хронологию';
      }
    });
  }

  // ---------------- core: collect pages ----------------
  async function collectTopic(){
    const pages = getAllPageLinks();
    const results = [];
    for (let i=0; i<pages.length; i++){
      const url = pages[i];
      const html = await fetchText(url);
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // первый пост на странице
      const first = doc.querySelector('.topic .post.topicpost, .post.topicpost, .message:first-of-type');
      if (!first) continue;

      // заголовок/таймстемп страницы (оставляю максимально просто)
      const timeLink = first.querySelector('h3 .permalink, h3 a[href*="#p"]');
      const when = timeLink ? timeLink.textContent.trim() : '';

      const titleNode = doc.querySelector('#pun-viewtopic h2, .topic > h2') || document.title;
      const title = (titleNode && titleNode.textContent) ? titleNode.textContent.trim() : (''+titleNode);

      // --- chrono tags: "сырьё"
      const raw = window.parseChronoTagsRaw(first);

      // --- order: целое число или ошибка
      let order = null, orderBad = false;
      if (raw.order && raw.order.trim()){
        const v = raw.order.trim();
        if (/^-?\d+$/.test(v)) order = Number(v);
        else orderBad = true;
      }

      // --- резолв имён/ссылок/не-найдены (как в chrono)
      const resolved = await window.resolveChronoData(raw);

      results.push({
        pageUrl: url,
        when, title,
        // «сырьё» если нужно для сортировок/фильтров:
        participantsLower: raw.participantsLower,
        masks: raw.masks,
        location: raw.location,
        order,
        orderBad,
        rawOrder: raw.order || '',
        // готовый HTML для вывода:
        participantsHtml: resolved.participantsHtml,
        masksHtml: resolved.masksHtml
      });
    }
    return results;
  }

  function getAllPageLinks(){
    // ссылки пагинации в шапке/подвале
    const base = location.href.replace(/(&|\\?)p=\\d+/, '');
    const anchors = $$('div.topic h2 a, .pagelink a, .pagemenu a, .pages a')
      .map(a => a.href).filter(Boolean);
    // включим текущую страницу
    if (!anchors.includes(location.href)) anchors.unshift(location.href);
    // дедуп + нормализация
    const uniq = Array.from(new Set(anchors.map(u => u.split('#')[0])));
    // гарантированно полные URL одной темы
    return uniq.filter(u => /viewtopic\\.php\\?id=/.test(u))
               .sort((a,b)=>pageNum(a)-pageNum(b));

    function pageNum(u){
      const m = /[?&]p=(\\d+)/.exec(u); return m ? +m[1] : 1;
    }
  }

  async function fetchText(url){
    const res = await fetch(url, {credentials:'include'});
    if (!res.ok) throw new Error('HTTP '+res.status);
    return await res.text();
  }

  // ---------------- render ----------------
  function buildWrappedHTML(items){
    if (!items.length) return '<div class="ga-wrap">ничего не нашлось</div>';

    const MISS_STYLE = 'color:#c00;background:#ffe6e6;border-radius:6px;padding:0 .35em;font-weight:700;';
    const rows = items.map((e, i) => {
      // участники
      const names = e.participantsHtml && e.participantsHtml.trim()
        ? e.participantsHtml
        : `<span style="${MISS_STYLE}">не указаны</span>`;

      // маски (опционально — можно убрать эту строку, если не нужно)
      const masks = e.masksHtml && e.masksHtml.trim()
        ? ` / роли: ${e.masksHtml}`
        : '';

      // badge order: число или ошибка
      let orderBadge = '';
      if (e.orderBad) {
        orderBadge = ` <span style="${MISS_STYLE}">order: неверный формат</span>`;
      } else if (e.order != null) {
        orderBadge = ` [${window.escapeHtml(String(e.order))}]`;
      }

      const when = window.escapeHtml(e.when || '');
      const title = window.escapeHtml(e.title || '');

      return `
        <div class="ga-row">
          <div class="ga-line">
            <span class="ga-num">${i+1}.</span>
            <a class="ga-link" href="${e.pageUrl}">${title}</a>${orderBadge}
          </div>
          <div class="ga-sub">
            <span class="ga-when">${when}</span>
            <span class="ga-part"> / ${names}${masks}</span>
            ${e.location ? ` <span class="ga-loc"> / локация: ${window.escapeHtml(e.location)}</span>` : ''}
          </div>
        </div>
      `;
    });

    const css = `
      #get-all-output .ga-row{padding:8px 10px;border:1px solid #e1e1e1;border-radius:8px;margin:8px 0;background:#fff}
      #get-all-output .ga-line{font-weight:700;margin-bottom:2px}
      #get-all-output .ga-num{opacity:.6;margin-right:6px}
      #get-all-output .ga-sub{opacity:.9}
      #get-all-output .ga-link{text-decoration:none}
      #get-all-output .ga-link:hover{text-decoration:underline}
    `;

    return `<style>${css}</style>${rows.join('')}`;
  }

})();
