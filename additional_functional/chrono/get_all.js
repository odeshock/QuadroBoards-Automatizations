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
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---- ограничения показа кнопки: URL + GroupID ----
  function allowedByConfig() {
    // 1) если есть готовая проверка — используем её
    if (typeof window.ensureAllowed === 'function') {
      try { if (!window.ensureAllowed()) return false; } catch(_) {}
    }
    // 2) ручная проверка по CHRONO_CHECK (если есть)
    const cfg = window.CHRONO_CHECK || {};
    const needUrl  = cfg.URL || '';
    const needGids = Array.isArray(cfg.GroupID) ? cfg.GroupID : [];

    // URL: сравниваем pathname+search, игнорируя hash (якоря типа #p12)
    const here = location.pathname + location.search; // без hash
    const urlOk = needUrl ? here.startsWith(needUrl) : true;

    // GroupID: если список задан — текущая группа должна быть в списке
    let groupOk = true;
    if (needGids.length) {
      // где взять текущую группу:
      // 1) из CHRONO_CHECK.UserGroupID, если есть;
      // 2) иначе — из DOM (атрибут data-group-id у первого поста);
      let cur = cfg.UserGroupID;
      if (!cur) {
        const first = document.querySelector('.topic .post.topicpost, .post.topicpost, .message:first-of-type');
        if (first) cur = first.getAttribute('data-group-id') || '';
      }
      groupOk = cur ? needGids.includes(String(cur)) : false;
    }
    return urlOk && groupOk;
  }

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
    // показать кнопку только при соблюдении ограничений
    if (!allowedByConfig()) return;

    // дождёмся зависимостей (кнопку покажем сразу, но включим, когда всё готово)
    const deps = await waitForDeps(200); // быстрый тик
    const { topic } = await waitForTopic();
    if (!topic) {
      console.warn('[get_all] не нашли topic-контейнер');
      return;
    }

    const btn = ensureButton(topic);
    if (!deps) {
      btn.disabled = true; btn.style.opacity = '0.6';
      const ok = await waitForDeps();
      btn.disabled = !ok; btn.style.opacity = ok ? '1' : '0.6';
      if (!ok) btn.title = 'Зависимости не загрузились (helpers/profile_from_user)';
    }

    btn.addEventListener('click', onClick);
  }

  async function onClick(){
    // проверим deps ещё раз
    if (!(window.parseChronoTagsRaw && window.resolveChronoData && window.escapeHtml && window.profileLink)) {
      alert('Ещё не загрузились зависимости (helpers/profile_from_user). Обновите страницу.');
      return;
    }
    const btn = this;
    const out = document.getElementById('get-all-output');
    btn.disabled = true; btn.textContent = 'Собираю…';
    try{
      const items = await collectTopic();
      out.innerHTML = buildWrappedHTML(items);
    } catch (e) {
      console.error(e);
      out.innerHTML = `<div style="color:#c00">Ошибка: ${window.escapeHtml(String(e.message||e))}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Собрать хронологию';
    }
  }

  // ---------------- wait helpers ----------------
  async function waitForTopic({timeout=15000, interval=100}={}){
    const t0 = performance.now();
    while (performance.now()-t0 < timeout){
      const topic = document.querySelector('#topic_t28, [id^="topic_t"], .topic') || null;
      const first  = topic && (topic.querySelector('.post.topicpost') || topic.querySelector('.message'));
      if (topic && first) return {topic, first};
      await sleep(interval);
    }
    return {topic:null, first:null};
  }

  // ---------------- create UI ----------------
  function ensureButton(hostTopic){
    let btn = document.getElementById('ga-collect-btn');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = 'ga-collect-btn';
    btn.textContent = 'Собрать хронологию';
    btn.style.cssText = `
      margin:6px 0 12px; padding:6px 10px; border-radius:6px; border:1px solid #bbb;
      background:#fafafa; cursor:pointer; font-size:14px; display:inline-block;
    `;

    const h2 = hostTopic.querySelector('h2');
    if (h2) h2.insertAdjacentElement('afterend', btn);
    else hostTopic.insertBefore(btn, hostTopic.firstChild);

    if (!document.getElementById('get-all-output')){
      const out = document.createElement('div');
      out.id = 'get-all-output';
      btn.insertAdjacentElement('afterend', out);
    }
    return btn;
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

      // дата/ссылка этой страницы
      const timeLink = first.querySelector('h3 .permalink, h3 a[href*="#p"]');
      const when = timeLink ? timeLink.textContent.trim() : '';

      // общий заголовок темы (не обязателен)
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

      // --- имена/ссылки/не-найдены (как в chrono)
      const resolved = await window.resolveChronoData(raw);

      results.push({
        pageUrl: url,
        when, title,
        // сырьё:
        participantsLower: raw.participantsLower,
        masks: raw.masks,
        location: raw.location,
        order,
        orderBad,
        rawOrder: raw.order || '',
        // HTML для вывода:
        participantsHtml: resolved.participantsHtml,
        masksHtml: resolved.masksHtml
      });
    }
    return results;
  }

  function getAllPageLinks(){
    const anchors = $$('div.topic h2 a, .pagelink a, .pagemenu a, .pages a')
      .map(a => a.href).filter(Boolean);
    if (!anchors.includes(location.href)) anchors.unshift(location.href);
    const uniq = Array.from(new Set(anchors.map(u => u.split('#')[0])));
    return uniq
      .filter(u => /viewtopic\.php\?id=/.test(u))
      .sort((a,b)=>pageNum(a)-pageNum(b));

    function pageNum(u){
      const m = /[?&]p=(\d+)/.exec(u); return m ? +m[1] : 1;
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
      const names = e.participantsHtml && e.participantsHtml.trim()
        ? e.participantsHtml
        : `<span style="${MISS_STYLE}">не указаны</span>`;

      const masks = e.masksHtml && e.masksHtml.trim()
        ? ` / роли: ${e.masksHtml}`
        : '';

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
