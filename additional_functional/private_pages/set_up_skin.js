// ==UserScript==
// @name         Admin: универсальные панели выбора (сетка, автопорог 2 ряда, автоподхват, частичное сохранение)
// @namespace    upforme-helper
// @version      2.0.0
// @description  Многоразовая функция createChoicePanel({ title, targetClass, library, ...opts }) для страниц редактирования. Несколько панелей на странице, каждая правит только свой блок по классу. Скролл включается, когда элементов > 2 рядов (порог вычисляется автоматически). Пустой editableAttr удаляется.
// @match        *://*/admin_pages.php*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

// --- утилиты среды страницы ---
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

// нам нужен #page-content; если его нет — тихо выходим
// (вы можете сами вызывать createChoicePanel только на нужных страницах)
const ensureTextarea = async (sel) => ready(sel);

// --- общие стили один раз ---
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

// ===== Реестр панелей для единого сохранения =====
const PANELS = []; // { uid, opts, rootEl, selectedBox, libBox, getSelectedInner, getSelectedIds }

// ===== Общие вспомогательные функции =====
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

// безопасный комментарий (без "--")
const safeComment = (s) => String(s).replace(/--/g,'—');

// ===== Сохранение (для одной панели) =====
function rewriteSectionHTML(pageHtml, opts, selectedInner, selectedIds){
  const { targetClass, itemSelector = '.item', idAttr = 'data-id' } = opts;
  const root=document.createElement('div'); root.innerHTML=pageHtml;
  const block=root.querySelector('div.'+targetClass);
  const nodeToPreservedComment = (node) => {
    if (node.nodeType===1){
      const el=node;
      // если это .item с id, и он выбран сейчас — не сохраняем как preserved
      if (el.matches(itemSelector)) {
        let id = el.getAttribute(idAttr);
        if (id == null) id = 'undefined';
        if (id !== 'undefined' && selectedIds.has(id)) return '';
        return `<!-- preserved (${idAttr}="${safeComment(id)}")\n${safeComment(el.outerHTML)}\n-->`;
      }
      // для прочих тегов — просто консервируем как undefined
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

// ===== Единый submit: последовательно применяем все панели =====
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

    // прогоняем все панели по очереди
    for (const p of PANELS) {
      const selectedInner = p.getSelectedInner();
      const selectedIds = p.getSelectedIds();
      current = rewriteSectionHTML(current, p.opts, selectedInner, selectedIds);
    }

    if (tm) tm.setContent(current);
    if (ta) ta.value = current;
  }, true);
}

// ===== Создание панели =====
function createChoicePanel(userOpts){
  const opts = Object.assign({
    title: 'Библиотека и выбранные',
    targetClass: '_section',
    library: [],
    startOpen: false,
    textareaSelector: '#page-content',
    anchorSelector: null,              // если null — вставим после textarea
    itemSelector: '.item',
    idAttr: 'data-id',
    editableAttr: 'title',
    searchPlaceholder: 'поиск по id'
  }, userOpts || {});
  if (!opts.library || !Array.isArray(opts.library)) opts.library = [];

  const LIB_ID_SET = new Set(opts.library.map(x => x.id));
  const LIB_MAP = new Map(opts.library.map(x => [x.id, x]));

  const uid = 'ufo_' + (opts.targetClass || 'section').replace(/\W+/g,'_') + '_' + Math.random().toString(36).slice(2,7);

  // элементы панели
  const details = document.createElement('details');
  details.className = 'ufo-panel';
  details.open = !!opts.startOpen;

  const summary = document.createElement('summary');
  summary.textContent = opts.title || 'Панель';
  const wrap = document.createElement('div'); wrap.className='ufo-wrap';

  // библиотека
  const libCol = document.createElement('div'); libCol.className='ufo-col';
  const hLib = document.createElement('h4'); hLib.textContent='Библиотека';
  const search = document.createElement('input');
  search.type='text'; search.placeholder = opts.searchPlaceholder || 'поиск по id'; search.className='ufo-search';
  hLib.appendChild(search);
  const libBox = document.createElement('div'); libBox.className='ufo-lib'; libBox.id = uid+'-lib';
  libCol.append(hLib, libBox);

  // выбранные
  const selCol = document.createElement('div'); selCol.className='ufo-col';
  selCol.innerHTML = '<h4>Выбранные (сверху — новее)</h4>';
  const selBox = document.createElement('div'); selBox.className='ufo-selected'; selBox.id = uid+'-selected';
  selCol.appendChild(selBox);

  wrap.append(libCol, selCol);
  details.append(summary, wrap);

  // куда вставлять
  (async ()=>{
    await ensureTextarea(opts.textareaSelector);
    const anchor = opts.anchorSelector ? $(opts.anchorSelector) : $(opts.textareaSelector);
    if (anchor) anchor.insertAdjacentElement('afterend', details);
  })();

  // ——— рендер карточек библиотеки ———
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

  // ——— добавление в выбранные ———
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

  // DnD
  (function enableDnd(container){
    let dragEl=null;
    container.addEventListener('dragstart', (e)=>{const card=e.target.closest('.ufo-card'); if(!card) return; dragEl=card; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','');});
    container.addEventListener('dragover', (e)=>{e.preventDefault(); const over=e.target.closest('.ufo-card'); if(!over || over===dragEl) return; const r=over.getBoundingClientRect(); const before=(e.clientY-r.top)/r.height<0.5; over.parentElement.insertBefore(dragEl, before?over:over.nextSibling);});
    container.addEventListener('drop', (e)=>{e.preventDefault(); dragEl=null; computeTwoRowMaxSelected(container);});
    container.addEventListener('dragend', ()=>{dragEl=null; computeTwoRowMaxSelected(container);});
  })(selBox);

  // поиск
  search.addEventListener('input', ()=>{
    const v = search.value.trim();
    libBox.querySelectorAll('.ufo-card').forEach(c=>{
      c.style.display = (!v || c.dataset.id.includes(v)) ? '' : 'none';
    });
    computeTwoRowMaxLib(libBox);
  });

  // автопорог для обоих контейнеров
  observeLib(libBox);
  observeSelected(selBox);

  // ——— автоподхват из targetClass ———
  (function hydrateFromPage(){
    const ta = $(opts.textareaSelector);
    const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
    let current=''; if (tm) current=tm.getContent(); else if (ta) current=ta.value||'';
    if (!current) return;

    const root=document.createElement('div'); root.innerHTML=current;
    const block=root.querySelector('div.'+opts.targetClass); if (!block) return;

    const items=[];
    block.childNodes.forEach(n=>{
      if (n.nodeType===1 && n.matches(opts.itemSelector)){
        const id = n.getAttribute(opts.idAttr) || '';
        if (id && LIB_ID_SET.has(id)){
          items.push({ id, pageHtml:n.outerHTML, lib: LIB_MAP.get(id) });
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

  // ——— подготовка данных к сохранению ———
  function getSelectedIds(){
    return new Set([...selBox.querySelectorAll('.ufo-card')].map(r=>r.dataset.id||'').filter(Boolean));
  }
  function buildSelectedInnerHTML(){
    const cards=[...selBox.querySelectorAll('.ufo-card')];
    return cards.map((row)=>{
      let html=row.dataset.html||'';
      const ed=row.querySelector('.ufo-title-edit');
      const t = ed ? ed.textContent.trim() : '';

      if (t) {
        const safe = t.replace(/"/g,'&quot;');
        if (new RegExp(`${opts.editableAttr}="[^"]*"`).test(html)) {
          const re = new RegExp(`${opts.editableAttr}="[^"]*"`);
          html = html.replace(re, `${opts.editableAttr}="${safe}"`);
        } else {
          // вставим в открывающий тег .item
          const reOpen = new RegExp(`<div\\s+class="item"\\b([^>]*)>`);
          html = html.replace(reOpen, (m, attrs)=>`<div class="item" ${opts.editableAttr}="${safe}"${attrs}>`);
        }
      } else {
        // удалить атрибут, если пусто
        const reAttr = new RegExp(`(<div\\s+class="item"\\b[^>]*?)\\s+${opts.editableAttr}="[^"]*"(.*?>)`);
        html = html.replace(reAttr, '$1$2');
      }
      return html;
    }).join('\n');
  }

  // ——— зарегистрируем панель в реестре для общего submit ———
  PANELS.push({
    uid,
    opts,
    rootEl: details,
    selectedBox: selBox,
    libBox,
    getSelectedInner: buildSelectedInnerHTML,
    getSelectedIds
  });

  // поставим общий submit-хук (один раз на страницу)
  ensureGlobalSubmitHook(opts.textareaSelector);

  return details; // вдруг захочется руками двигать панель
}
