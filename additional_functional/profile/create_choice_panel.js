// ==UserScript==
// @name         Admin: универсальные панели выбора (external-режим + builder)
// @namespace    upforme-helper
// @version      2.1.0
// @description  createChoicePanel({ title, targetClass, library, ...opts }) с поддержкой внешнего вызова: mountEl, initialHtml, external=true.
// @match        *://*/admin_pages.php*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript>

/* ====== ИСХОДНАЯ ОСНОВА ТВОЕГО КОДА (уплотнено) + маленькие ДОБАВКИ =====
 * Новые опции:
 * - mountEl?: HTMLElement — если задан, панель вставляется сюда (вместо after textarea)
 * - initialHtml?: string  — если задан, берём этот HTML как исходный (вместо чтения из textarea/tinymce)
 * - external?: boolean    — если true, НЕ ставим общий submit-хук; возвращаем объект { details, builder, getSelectedIds }
 *
 * Внутренняя логика, стили и UX не трогал.
 */

const $ = (sel, root = document) => root.querySelector(sel);
const ready = (sel, root = document) => new Promise((res) => {
  const el = root.querySelector(sel);
  if (el) return res(el);
  const obs = new MutationObserver(() => {
    const el2 = root.querySelector(sel);
    if (el2) { obs.disconnect(); res(el2); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
});
const ensureTextarea = async (sel) => ready(sel);

const baseCSS = `
details.ufo-panel{margin-top:12px;border:1px solid #d0d0d7;border-radius:10px;background:#fff}
details.ufo-panel>summary{cursor:pointer;list-style:none;padding:10px 14px;font-weight:600;background:#f6f6f8;border-bottom:1px solid #e6e6ef;border-radius:10px}
details.ufo-panel>summary::-webkit-details-marker{display:none}
.ufo-wrap{display:flex;flex-direction:column;gap:16px;padding:14px}
.ufo-col{display:flex;flex-direction:column;gap:8px}
.ufo-col h4{margin:0;font-size:14px;opacity:.8;display:flex;justify-content:space-between;align-items:center}
.ufo-search{padding:6px 10px;font-size:13px;border:1px solid #d0d0d7;border-radius:8px;background:#f5f2e8}
.ufo-lib,.ufo-selected{border:1px dashed #c9c9d9;border-radius:8px;background:#fafafd;padding:8px;overflow:auto}
.ufo-lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.ufo-lib .ufo-card{margin:0}
.ufo-card{display:grid;grid-template-columns:auto 1fr auto;grid-template-rows:auto auto;grid-template-areas:"id full actions" "id title actions";gap:8px;background:#fff;border:1px solid #e7e7ef;border-radius:8px;padding:8px;margin:6px 0;max-width:100%;position:relative;overflow:hidden}
.ufo-idtag{grid-area:id;font-size:11px;opacity:.7;align-self:start}
.ufo-actions{grid-area:actions;display:flex;align-items:center;gap:6px}
.ufo-btn{border:1px solid #d7d7e0;background:#f3f3f7;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;line-height:1.15;display:inline-flex;align-items:center}
.ufo-btn:hover{background:#ececf4}
.ufo-card.disabled{opacity:.4;pointer-events:none}
.ufo-full{grid-area:full;box-sizing:border-box;margin:0;padding:0;border:0;background:transparent;overflow:hidden}
.ufo-full .item{position:relative;display:block;margin:0}
.ufo-full .item .modal-link{display:block}
.ufo-full .item img{display:block;max-width:100%;height:auto;border-radius:6px}
.ufo-lib .ufo-full .item img{height:90px;width:100%;object-fit:cover}
.ufo-lib .ufo-full a{pointer-events:none}
.ufo-title-edit{grid-area:title;border:1px dashed #aaa;border-radius:6px;padding:6px 8px;background:#fffef7;font-size:13px;white-space:pre-wrap;overflow:visible}
.ufo-title-edit:focus{outline:none;background:#fffdf1}
`;
(function injectCSS(){
  const s=document.createElement('style');
  s.textContent=baseCSS;
  document.head.appendChild(s);
  if (typeof GM_addStyle==='function') GM_addStyle(baseCSS);
})();

const PANELS = [];
const mkBtn = (txt, onClick) => {
  const b=document.createElement('button');
  b.type='button'; b.className='ufo-btn'; b.textContent=txt;
  b.addEventListener('click', onClick);
  return b;
};
function computeTwoRowMaxSelected(container){
  const first = container.querySelector('.ufo-card');
  if (!first) { container.style.maxHeight = ''; return; }
  const style = getComputedStyle(first);
  const h = first.getBoundingClientRect().height;
  const mt = parseFloat(style.marginTop) || 0;
  const mb = parseFloat(style.marginBottom) || 0;
  const cStyle = getComputedStyle(container);
  const pt = parseFloat(cStyle.paddingTop) || 0;
  const pb = parseFloat(cStyle.paddingBottom) || 0;
  const max = Math.round(h * 2 + (mt + mb) * 3 + pt + pb);
  container.style.maxHeight = max + 'px';
}
function firstVisibleCard(container){
  const cards = [...container.querySelectorAll('.ufo-card')];
  return cards.find(c => getComputedStyle(c).display !== 'none') || null;
}
function computeTwoRowMaxLib(container){
  const card = firstVisibleCard(container);
  if (!card) { container.style.maxHeight=''; return; }
  const ch = card.getBoundingClientRect().height;
  const cs = getComputedStyle(container);
  const rowGap = parseFloat(cs.rowGap) || 0;
  const pt = parseFloat(cs.paddingTop) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  const max = Math.round(ch * 2 + rowGap + pt + pb);
  container.style.maxHeight = max + 'px';
}
function observeSelected(container){
  const mo = new MutationObserver(()=> computeTwoRowMaxSelected(container));
  mo.observe(container, { childList: true, subtree: true, attributes: true });
  window.addEventListener('resize', ()=> computeTwoRowMaxSelected(container));
  computeTwoRowMaxSelected(container);
}
function observeLib(container){
  const mo = new MutationObserver(()=> computeTwoRowMaxLib(container));
  mo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter:['style','class'] });
  window.addEventListener('resize', ()=> computeTwoRowMaxLib(container));
  computeTwoRowMaxLib(container);
}
const safeComment = (s) => String(s).replace(/--/g,'—');

function rewriteSectionHTML(pageHtml, opts, selectedInner, selectedIds){
  const { targetClass, itemSelector = '.item', idAttr = 'data-id' } = opts;
  const root=document.createElement('div'); root.innerHTML=pageHtml;
  const block=root.querySelector('div.'+targetClass);
  const nodeToPreservedComment = (node) => {
    if (node.nodeType===1){
      const el=node;
      if (el.matches(itemSelector)) {
        let id = el.getAttribute(idAttr);
        if (id == null) id = 'undefined';
        if (id !== 'undefined' && selectedIds.has(id)) return '';
        return `<!-- preserved (${idAttr}="${safeComment(id)}")\n${safeComment(el.outerHTML)}\n-->`;
      }
      return `<!-- preserved (${idAttr}="undefined")\n${safeComment(el.outerHTML)}\n-->`;
    } else if (node.nodeType===8){
      return `<!--${safeComment(node.nodeValue)}-->`;
    } else if (node.nodeType===3){
      const txt=node.nodeValue; if (txt.trim()==='') return '';
      return `<!-- preserved (${idAttr}="undefined")\n${safeComment(txt)}\n-->`;
    }
    return '';
  };
  if (block){
    const preserved=[];
    block.childNodes.forEach(n=>preserved.push(nodeToPreservedComment(n)));
    block.innerHTML = (selectedInner?selectedInner+'\n':'') + preserved.filter(Boolean).join('\n');
  } else {
    const div=document.createElement('div'); div.className=targetClass; div.innerHTML=selectedInner;
    root.appendChild(div);
  }
  return root.innerHTML;
}

// общий submit-хук только для админки
function ensureGlobalSubmitHook(textareaSelector){
  if (ensureGlobalSubmitHook._installed) return;
  ensureGlobalSubmitHook._installed = true;
  const form = $('#editpage') || $('form[action*="admin_pages.php"]');
  if (!form) return;
  form.addEventListener('submit', ()=>{
    const ta = $(textareaSelector) || $('#page-content');
    const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
    let current = '';
    if (tm) current = tm.getContent();
    else if (ta) current = ta.value || '';
    for (const p of PANELS) {
      const selectedInner = p.getSelectedInner();
      const selectedIds = p.getSelectedIds();
      current = rewriteSectionHTML(current, p.opts, selectedInner, selectedIds);
    }
    if (tm) tm.setContent(current);
    if (ta) ta.value = current;
  }, true);
}

// ==== ГЛАВНАЯ ФУНКЦИЯ ====
function createChoicePanel(userOpts){
  const opts = Object.assign({
    title: 'Библиотека и выбранные',
    targetClass: '_section',
    library: [],
    startOpen: false,
    textareaSelector: '#page-content',
    anchorSelector: null,
    itemSelector: '.item',
    idAttr: 'data-id',
    editableAttr: 'title',
    searchPlaceholder: 'поиск по id',
    mountEl: null,         // NEW: для профиля
    initialHtml: null,     // NEW: для профиля
    external: false        // NEW: true — не ставим submit-хук, возвращаем builder()
  }, userOpts || {});
  if (!Array.isArray(opts.library)) opts.library = [];

  const LIB_ID_SET = new Set(opts.library.map(x => x.id));
  const LIB_MAP = new Map(opts.library.map(x => [x.id, x]));
  const uid = 'ufo_' + (opts.targetClass || 'section').replace(/\W+/g,'_') + '_' + Math.random().toString(36).slice(2,7);

  const details = document.createElement('details');
  details.className = 'ufo-panel';
  details.open = !!opts.startOpen;
  const summary = document.createElement('summary'); summary.textContent = opts.title || 'Панель';
  const wrap = document.createElement('div'); wrap.className='ufo-wrap';

  const libCol = document.createElement('div'); libCol.className='ufo-col';
  const hLib = document.createElement('h4'); hLib.textContent='Библиотека';
  const search = document.createElement('input');
  search.type='text'; search.placeholder = opts.searchPlaceholder || 'поиск по id'; search.className='ufo-search';
  hLib.appendChild(search);
  const libBox = document.createElement('div'); libBox.className='ufo-lib'; libBox.id = uid+'-lib';
  libCol.append(hLib, libBox);

  const selCol = document.createElement('div'); selCol.className='ufo-col';
  selCol.innerHTML = '<h4>Выбранные (сверху — новее)</h4>';
  const selBox = document.createElement('div'); selBox.className='ufo-selected'; selBox.id = uid+'-selected';
  selCol.appendChild(selBox);

  wrap.append(libCol, selCol);
  details.append(summary, wrap);

  // КУДА вставлять
  (async ()=>{
    if (opts.mountEl) {
      opts.mountEl.appendChild(details);
    } else {
      await ensureTextarea(opts.textareaSelector);
      const anchor = opts.anchorSelector ? $(opts.anchorSelector) : $(opts.textareaSelector);
      if (anchor) anchor.insertAdjacentElement('afterend', details);
    }
  })();

  function renderLibItem(item){
    const card=document.createElement('div'); card.className='ufo-card'; card.dataset.id=item.id;
    const id=document.createElement('div'); id.className='ufo-idtag'; id.textContent='#'+item.id;
    const full=document.createElement('div'); full.className='ufo-full';
    const tmp=document.createElement('div'); tmp.innerHTML=item.html.trim(); full.appendChild(tmp.firstElementChild);
    const actions=document.createElement('div'); actions.className='ufo-actions';
    actions.appendChild(mkBtn('Добавить ↑', (e)=>{e.preventDefault(); e.stopPropagation(); addToSelected(item);}));
    card.append(id, full, actions);
    return card;
  }
  opts.library.forEach(x => libBox.appendChild(renderLibItem(x)));

  function addToSelected(item, o){
    o = o || {};
    const libCard = libBox.querySelector(`.ufo-card[data-id="${item.id}"]`);
    if (libCard) libCard.classList.add('disabled');
    if (selBox.querySelector(`.ufo-card[data-id="${item.id}"]`)) return;

    const row=document.createElement('div'); row.className='ufo-card'; row.draggable=true; row.dataset.id=item.id;
    const id=document.createElement('div'); id.className='ufo-idtag'; id.textContent='#'+item.id;
    const full=document.createElement('div'); full.className='ufo-full';
    const tmp=document.createElement('div'); tmp.innerHTML=(o.usePageHtml ? o.usePageHtml : item.html).trim();
    full.appendChild(tmp.firstElementChild);

    const editor=document.createElement('div'); editor.className='ufo-title-edit'; editor.contentEditable=true;
    const elItem = full.querySelector(opts.itemSelector);
    const currentAttr = elItem ? (elItem.getAttribute(opts.editableAttr) || '') : '';
    editor.textContent = currentAttr;

    const actions=document.createElement('div'); actions.className='ufo-actions';
    const recalc = ()=> computeTwoRowMaxSelected(selBox);
    const btnUp=mkBtn('↑', (e)=>{e.preventDefault(); e.stopPropagation(); if (row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling); recalc();});
    const btnDown=mkBtn('↓', (e)=>{e.preventDefault(); e.stopPropagation(); if (row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row); recalc();});
    const btnRemove=mkBtn('✕', (e)=>{e.preventDefault(); e.stopPropagation(); row.remove(); if (libCard) libCard.classList.remove('disabled'); recalc();});
    actions.append(btnUp, btnDown, btnRemove);

    row.dataset.html = item.html.trim();
    row.append(id, full, actions, editor);
    selBox.insertBefore(row, selBox.firstChild);
    recalc();
  }

  (function enableDnd(container){
    let dragEl=null;
    container.addEventListener('dragstart', (e)=>{const card=e.target.closest('.ufo-card'); if(!card) return; dragEl=card; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','');});
    container.addEventListener('dragover', (e)=>{e.preventDefault(); const over=e.target.closest('.ufo-card'); if(!over || over===dragEl) return; const r=over.getBoundingClientRect(); const before=(e.clientY-r.top)/r.height<0.5; over.parentElement.insertBefore(dragEl, before?over:over.nextSibling);});
    container.addEventListener('drop', (e)=>{e.preventDefault(); dragEl=null; computeTwoRowMaxSelected(container);});
    container.addEventListener('dragend', ()=>{dragEl=null; computeTwoRowMaxSelected(container);});
  })(selBox);

  search.addEventListener('input', ()=>{
    const v = search.value.trim();
    libBox.querySelectorAll('.ufo-card').forEach(c=>{
      c.style.display = (!v || c.dataset.id.includes(v)) ? '' : 'none';
    });
    computeTwoRowMaxLib(libBox);
  });

  const mo1=new MutationObserver(()=>computeTwoRowMaxSelected(selBox));
  mo1.observe(selBox,{childList:true,subtree:true,attributes:true});
  const mo2=new MutationObserver(()=>computeTwoRowMaxLib(libBox));
  mo2.observe(libBox,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  window.addEventListener('resize',()=>{computeTwoRowMaxLib(libBox); computeTwoRowMaxSelected(selBox);});
  computeTwoRowMaxLib(libBox); computeTwoRowMaxSelected(selBox);

  // --- ГИДРАТАЦИЯ ---
  (function hydrateFromPage(){
    let current='';
    if (typeof opts.initialHtml === 'string') {
      current = opts.initialHtml;
    } else {
      const ta = $(opts.textareaSelector);
      const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
      if (tm) current = tm.getContent();
      else if (ta) current = ta.value || '';
    }
    if (!current) return;
    const root=document.createElement('div'); root.innerHTML=current;
    const block=root.querySelector('div.'+opts.targetClass); if (!block) return;
    const items=[];
    block.childNodes.forEach(n=>{
      if (n.nodeType===1 && n.matches(opts.itemSelector)){
        const id = n.getAttribute(opts.idAttr) || '';
        if (id && new Set(opts.library.map(x=>x.id)).has(id)){
          items.push({ id, pageHtml:n.outerHTML, lib: opts.library.find(x=>x.id===id) });
        }
      }
    });
    for (let i=items.length-1; i>=0; i--){
      const it=items[i];
      addToSelected({ id: it.id, html: it.lib.html }, { usePageHtml: it.pageHtml });
      const libCard = libBox.querySelector(`.ufo-card[data-id="${it.id}"]`);
      if (libCard) libCard.classList.add('disabled');
    }
  })();

  function getSelectedIds(){
    return new Set([...selBox.querySelectorAll('.ufo-card')].map(r=>r.dataset.id||'').filter(Boolean));
  }
  // === robust title-aware builder for selected row ===
  function buildSelectedInnerHTML(row, html, opts = {}) {
    // row  — DOM-строка выбранного элемента (в ней есть .ufo-title-edit и .ufo-text-edit ?)
    // html — исходный HTML карточки из библиотеки (часто уже содержит title="пример №…")
    // opts.editableAttr — имя атрибута (обычно 'title')
  
    const ATTR = (opts.editableAttr || 'title');
  
    // 1) достаём введённый заголовок из contenteditable
    const ed = row.querySelector('.ufo-title-edit');
  
    // берём innerHTML и жёстко чистим всё «невидимое»
    const rawTitle = ed ? ed.innerHTML : '';
    const cleanTitle = String(rawTitle)
      .replace(/<br\s*\/?>/gi, '\n')                        // <br> -> перенос строки
      .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '') // NBSP и zero-width
      .replace(/\s+/g, ' ')                                  // схлопываем пробелы
      .trim();
  
    // 2) убираем существующий title где бы он ни встретился
    function stripAttr(h, attrName) {
      // у opening-тэга .item (самый частый случай)
      h = h.replace(/(<div\s+class="item"\b[^>]*?)\s+title="[^"]*"/i, '$1');
      // на всякий случай снимем у любых тегов, если вдруг где-то ещё всплыло
      h = h.replace(/\s+title="[^"]*"/gi, '');
      return h;
    }
  
    // 3) добавляем title ТОЛЬКО если после чистки он не пуст
    function addAttrToItem(h, attrName, value) {
      const safe = String(value).replace(/"/g, '&quot;');
      return h.replace(/(<div\s+class="item"\b)/i, `$1 ${attrName}="${safe}"`);
    }
  
    // сначала всегда снимаем дефолтный title из шаблона библиотеки
    let out = stripAttr(html, ATTR);
  
    // если пользователь реально что-то ввёл — ставим title заново
    if (cleanTitle) {
      out = addAttrToItem(out, ATTR, cleanTitle);
    }
  
    // 4) (опционально) если у вас есть поле текста .ufo-text-edit — подставьте его внутрь wrds/подписи
    const edText = row.querySelector('.ufo-text-edit');
    if (edText) {
      const rawText = edText.innerHTML || edText.textContent || '';
      const cleanText = String(rawText)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/\s+$/g, '')
        .trim();
  
      // пример: вставляем в <wrds>…</wrds> если такой контейнер есть
      if (cleanText) {
        if (/<wrds>[\s\S]*?<\/wrds>/i.test(out)) {
          out = out.replace(/<wrds>[\s\S]*?<\/wrds>/i, `<wrds>${cleanText}</wrds>`);
        }
      } else {
        // если пусто — не затираем существующее из библиотеки; оставляем как есть
        // (если нужно наоборот — раскомментируй строку ниже)
        // out = out.replace(/<wrds>[\s\S]*?<\/wrds>/i, '<wrds></wrds>');
      }
    }
  
    return out;
  }

  // регистрация панели (для админки)
  PANELS.push({
    uid, opts, rootEl: details, selectedBox: selBox, libBox,
    getSelectedInner: buildSelectedInnerHTML,
    getSelectedIds
  });

  // В админке — автосохранение через submit; в external — НЕТ
  if (!opts.external) ensureGlobalSubmitHook(opts.textareaSelector);

  // В external-режиме вернём builder()
  function builder(fullHtmlOpt){
    let current = '';
    if (typeof fullHtmlOpt === 'string') current = fullHtmlOpt;
    else if (typeof opts.initialHtml === 'string') current = opts.initialHtml;
    else {
      const ta = $(opts.textareaSelector);
      const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
      if (tm) current = tm.getContent();
      else if (ta) current = ta.value || '';
    }
    const inner = buildSelectedInnerHTML();
    const ids = getSelectedIds();
    return rewriteSectionHTML(current, opts, inner, ids);
  }

  return { details, builder, getSelectedIds };
}

// экспорт
window.createChoicePanel = createChoicePanel;
