// Admin: универсальные панели выбора (external-режим + builder)
// createChoicePanel({ title, targetClass, library, ...opts })
// Точечные правки:
// 1) Добавлен buildSelectedInnerAll() — собирает HTML всех выбранных.
// 2) В PANELS.getSelectedInner теперь buildSelectedInnerAll, а не buildSelectedInnerHTML одиночного ряда.
// 3) В builder() и submit-хуке используем buildSelectedInnerAll().
// Остальная логика — без изменений.

(function(){
  'use strict';

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
  .ufo-card{display:grid;grid-template-columns:auto 1fr auto auto;grid-template-rows:auto auto;grid-template-areas:"id full date actions" "id title title actions";gap:8px;background:#fff;border:1px solid #e7e7ef;border-radius:8px;padding:8px;margin:6px 0;max-width:100%;position:relative;overflow:hidden}
  .ufo-idtag{grid-area:id;font-size:11px;opacity:.7;align-self:start}
  .ufo-actions{grid-area:actions;display:flex;align-items:center;gap:6px}
  .ufo-btn{border:1px solid #d7d7e0;background:#f3f3f7;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;line-height:1.15;display:inline-flex;align-items:center}
  .ufo-btn:hover{background:#ececf4}
  .ufo-card.disabled{opacity:.4;pointer-events:none}
  .ufo-full{grid-area:full;box-sizing:border-box;margin:0;padding:0;border:0;background:transparent;overflow:hidden}
  .ufo-full .item{position:relative;margin:0}
  .ufo-full .item .modal-link{display:block}
  .ufo-full .item img{display:block;max-width:100%;height:auto;border-radius:6px}
  .ufo-lib .ufo-full .item img{height:90px;width:100%;object-fit:cover}
  .ufo-lib .ufo-full a{pointer-events:none}
  .ufo-title-edit{grid-area:title;border:1px dashed #aaa;border-radius:6px;padding:6px 8px;background:#fffef7;font-size:13px;white-space:pre-wrap;overflow:visible}
  .ufo-title-edit:focus{outline:none;background:#fffdf1}
  .ufo-date-edit{grid-area:date;border:1px dashed #aaa;border-radius:6px;padding:6px 8px;background:#fffef7;font-size:13px;align-self:start}
  .ufo-date-edit input{border:none;background:transparent;font-size:13px;width:100%;font-family:inherit}
  .ufo-date-edit input:focus{outline:none}
  `;
  (function injectCSS(){
    const s=document.createElement('style'); s.textContent=baseCSS; document.head.appendChild(s);
    if (typeof GM_addStyle==='function') GM_addStyle(baseCSS);
  })();

  const PANELS = [];
  const mkBtn = (txt, onClick) => { const b=document.createElement('button'); b.type='button'; b.className='ufo-btn'; b.textContent=txt; b.addEventListener('click', onClick); return b; };

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
  function firstVisibleCard(container){ const cards = [...container.querySelectorAll('.ufo-card')]; return cards.find(c => getComputedStyle(c).display !== 'none') || null; }
  function computeTwoRowMaxLib(container){ const card = firstVisibleCard(container); if (!card) { container.style.maxHeight=''; return; } const ch = card.getBoundingClientRect().height; const cs = getComputedStyle(container); const rowGap = parseFloat(cs.rowGap) || 0; const pt = parseFloat(cs.paddingTop) || 0; const pb = parseFloat(cs.paddingBottom) || 0; const max = Math.round(ch * 2 + rowGap + pt + pb); container.style.maxHeight = max + 'px'; }
  function observeSelected(container){ const mo = new MutationObserver(()=> computeTwoRowMaxSelected(container)); mo.observe(container, { childList: true, subtree: true, attributes: true }); window.addEventListener('resize', ()=> computeTwoRowMaxSelected(container)); computeTwoRowMaxSelected(container); }
  function observeLib(container){ const mo = new MutationObserver(()=> computeTwoRowMaxLib(container)); mo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter:['style','class'] }); window.addEventListener('resize', ()=> computeTwoRowMaxLib(container)); computeTwoRowMaxLib(container); }
  const safeComment = (s) => String(s).replace(/--/g,'—');

  function rewriteSectionHTML(pageHtml, opts, selectedInner, selectedIds){
    const { targetClass, itemSelector = '.item', idAttr = 'data-id' } = opts;
    const libIds = new Set((opts.library || []).map(x => String(x.id)));
    
    const root=document.createElement('div'); root.innerHTML=pageHtml;
    const block=root.querySelector('div.'+targetClass);
    
    const nodeToPreservedComment = (node) => {
      if (node.nodeType===1){
        const el=node;
        if (el.matches(itemSelector)) {
          let id = el.getAttribute(idAttr);
          if (id == null) id = 'undefined';
          // новый порядок:
          // 1) любые элементы из библиотеки — УДАЛЯЕМ (секцию строим заново из выбранных)
          if (libIds.has(String(id))) return '';
          // 2) всё, что не из библиотеки — сохраняем в комментарии
          return `<!-- preserved (${idAttr}="${safeComment(id)}")\n${safeComment(el.outerHTML)}\n-->`;
        }
        // не .item — тоже сохраняем как preserved
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
      const div=document.createElement('div'); div.className=targetClass; div.innerHTML=selectedInner; root.appendChild(div);
    }
    return root.innerHTML;
  }

  function ensureGlobalSubmitHook(textareaSelector){
    if (ensureGlobalSubmitHook._installed) return; ensureGlobalSubmitHook._installed = true;
    const form = $('#editpage') || $('form[action*="admin_pages.php"]'); if (!form) return;
    form.addEventListener('submit', ()=>{
      const ta = $(textareaSelector) || $('#page-content');
      const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
      let current = ''; if (tm) current = tm.getContent(); else if (ta) current = ta.value || '';
      for (const p of PANELS) {
        const selectedInner = p.getSelectedInner(); // FIX: берём общий HTML всех выбранных
        const selectedIds = p.getSelectedIds();
        current = rewriteSectionHTML(current, p.opts, selectedInner, selectedIds);
      }
      if (tm) tm.setContent(current); if (ta) ta.value = current;
    }, true);
  }

  function createChoicePanel(userOpts){
    const opts = Object.assign({
      title: 'Библиотека и выбранные', targetClass: '_section', library: [], startOpen: false,
      textareaSelector: '#page-content', anchorSelector: null, itemSelector: '.item', idAttr: 'data-id', editableAttr: 'title',
      searchPlaceholder: 'поиск по id', mountEl: null, initialHtml: null, external: false,
      allowMultiAdd: false,            // ← НОВОЕ: разрешать многоразовое добавление одного и того же id
      expirableAttr: null              // ← НОВОЕ: если задано (например 'data-expired-date'), добавляем инпут для даты
    }, userOpts || {});
    if (!Array.isArray(opts.library)) opts.library = [];

    const uid = 'ufo_' + (opts.targetClass || 'section').replace(/\W+/g,'_') + '_' + Math.random().toString(36).slice(2,7);

    const details = document.createElement('details'); details.className = 'ufo-panel'; details.open = !!opts.startOpen;
    const summary = document.createElement('summary'); summary.textContent = opts.title || 'Панель';
    const wrap = document.createElement('div'); wrap.className='ufo-wrap';

    const libCol = document.createElement('div'); libCol.className='ufo-col';
    const hLib = document.createElement('h4'); hLib.textContent='Библиотека';
    const search = document.createElement('input'); search.type='text'; search.placeholder = opts.searchPlaceholder || 'поиск по id'; search.className='ufo-search'; hLib.appendChild(search);
    const libBox = document.createElement('div'); libBox.className='ufo-lib'; libBox.id = uid+'-lib';
    libCol.append(hLib, libBox);

    const selCol = document.createElement('div'); selCol.className='ufo-col'; selCol.innerHTML = '<h4>Выбранные (сверху — новее)</h4>';
    const selBox = document.createElement('div'); selBox.className='ufo-selected'; selBox.id = uid+'-selected';
    selCol.appendChild(selBox);

    wrap.append(libCol, selCol); details.append(summary, wrap);

    (async ()=>{ if (opts.mountEl) { opts.mountEl.appendChild(details); } else { await ensureTextarea(opts.textareaSelector); const anchor = opts.anchorSelector ? $(opts.anchorSelector) : $(opts.textareaSelector); if (anchor) anchor.insertAdjacentElement('afterend', details);} })();

    function renderLibItem(item){
      const card=document.createElement('div'); card.className='ufo-card'; card.dataset.id=item.id;
      const id=document.createElement('div'); id.className='ufo-idtag'; id.textContent='#'+item.id;
      const full=document.createElement('div'); full.className='ufo-full';
      const tmp=document.createElement('div'); tmp.innerHTML=item.html.trim(); full.appendChild(tmp.firstElementChild);
      const actions=document.createElement('div'); actions.className='ufo-actions';
      actions.appendChild(mkBtn('Добавить ↑', (e)=>{e.preventDefault(); e.stopPropagation(); addToSelected(item); }));
      card.append(id, full, actions); return card;
    }
    opts.library.forEach(x => libBox.appendChild(renderLibItem(x)));

    function addToSelected(item, o){
      o = o || {};
      const libCard = libBox.querySelector(`.ufo-card[data-id="${item.id}"]`);
      // в обычных секциях — блокируем дубль и «гасим» карточку в библиотеке
      if (!opts.allowMultiAdd) {
        if (libCard) libCard.classList.add('disabled');
        if (selBox.querySelector(`.ufo-card[data-id="${item.id}"]`)) return;
      }
      const row=document.createElement('div'); row.className='ufo-card'; row.draggable=true; row.dataset.id=item.id;
      const id=document.createElement('div'); id.className='ufo-idtag'; id.textContent='#'+item.id;
      const full=document.createElement('div'); full.className='ufo-full';
      const tmp=document.createElement('div'); tmp.innerHTML=(o.usePageHtml ? o.usePageHtml : item.html).trim(); full.appendChild(tmp.firstElementChild);
      const editor=document.createElement('div'); editor.className='ufo-title-edit'; editor.contentEditable=true;
      const elItem = full.querySelector(opts.itemSelector); const currentAttr = elItem ? (elItem.getAttribute(opts.editableAttr) || '') : '';
      editor.textContent = currentAttr;

      // Если включен expirableAttr, добавляем поле для даты
      let dateEditor = null;
      if (opts.expirableAttr) {
        dateEditor = document.createElement('div');
        dateEditor.className = 'ufo-date-edit';
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        const currentDate = elItem ? (elItem.getAttribute(opts.expirableAttr) || '') : '';
        dateInput.value = currentDate;
        dateEditor.appendChild(dateInput);
      }

      const actions=document.createElement('div'); actions.className='ufo-actions';
      const recalc = ()=> computeTwoRowMaxSelected(selBox);
      const btnUp=mkBtn('↑', (e)=>{e.preventDefault(); e.stopPropagation(); if (row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling); recalc();});
      const btnDown=mkBtn('↓', (e)=>{e.preventDefault(); e.stopPropagation(); if (row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row); recalc();});
      const btnRemove=mkBtn('✕', (e)=>{
        e.preventDefault(); e.stopPropagation();
        row.remove();
        if (!opts.allowMultiAdd && libCard) libCard.classList.remove('disabled');
        recalc();
      });
      actions.append(btnUp, btnDown, btnRemove);
      row.dataset.html = item.html.trim();
      // если карточка пришла из текущей страницы — сохраним этот HTML,
      // чтобы при сборке не терять её фактический title:
      if (o.usePageHtml) {
        row.dataset.pageHtml = o.usePageHtml.trim();
      }
      if (o.usePageHtml) {
        // запомним «как было на странице», чтобы при сборке беречь его title
        row.dataset.pageHtml = o.usePageHtml.trim();
      }
      row.append(id, full, actions, editor);
      if (dateEditor) row.appendChild(dateEditor);
      selBox.insertBefore(row, selBox.firstChild); recalc();
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
      libBox.querySelectorAll('.ufo-card').forEach(c=>{ c.style.display = (!v || c.dataset.id.includes(v)) ? '' : 'none'; });
      computeTwoRowMaxLib(libBox);
    });

    const mo1=new MutationObserver(()=>computeTwoRowMaxSelected(selBox)); mo1.observe(selBox,{childList:true,subtree:true,attributes:true});
    const mo2=new MutationObserver(()=>computeTwoRowMaxLib(libBox)); mo2.observe(libBox,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
    window.addEventListener('resize',()=>{computeTwoRowMaxLib(libBox); computeTwoRowMaxSelected(selBox);});
    computeTwoRowMaxLib(libBox); computeTwoRowMaxSelected(selBox);

    // Гидратация: переносим уже присутствующие в секции элементы (если их id есть в библиотеке) в «Выбранные»
    (function hydrateFromPage(){
      let current='';
      if (typeof opts.initialHtml === 'string') current = opts.initialHtml;
      else {
        const ta = $(opts.textareaSelector);
        const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
        if (tm) current = tm.getContent(); else if (ta) current = ta.value || '';
      }
      if (!current) return;
      const root=document.createElement('div'); root.innerHTML=current;
      const block=root.querySelector('div.'+opts.targetClass); if (!block) return;
      const libIds = new Set(opts.library.map(x=>x.id));
      const items=[];
      block.childNodes.forEach(n=>{
        if (n.nodeType===1 && n.matches(opts.itemSelector)){
          const id = n.getAttribute(opts.idAttr) || '';
          if (id && libIds.has(id)) items.push({ id, pageHtml:n.outerHTML, lib: opts.library.find(x=>x.id===id) });
        }
      });
      for (let i=items.length-1; i>=0; i--){
        const it=items[i];
        addToSelected({ id: it.id, html: it.lib.html }, { usePageHtml: it.pageHtml });
        const libCard = libBox.querySelector(`.ufo-card[data-id="${it.id}"]`);
        if (!opts.allowMultiAdd && libCard) libCard.classList.add('disabled');
      }
    })();

    function getSelectedIds(){ return new Set([...selBox.querySelectorAll('.ufo-card')].map(r=>r.dataset.id||'').filter(Boolean)); }

    // Билдер для одной «выбранной» карточки (как было)
    function buildSelectedInnerHTML(row, html, opts = {}) {
      if (!row || typeof row.querySelector !== 'function') return String(html || '');
    
      const ATTR = opts.editableAttr || 'title';
      // База: предпочитаем HTML, который реально был на странице (с текущим title),
      // затем — библиотечный, затем — то, что пришло в аргументах.
      const base = row.dataset.pageHtml || row.dataset.html || String(html || '');
    
      // Текст из редактора
      const ed = row.querySelector('.ufo-title-edit');
      const cleanTitle = String(ed ? ed.innerHTML : '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
      // Работаем через DOM, чтобы править только .item
      const tmp = document.createElement('div');
      tmp.innerHTML = base.trim();
      const itemEl = tmp.querySelector((opts && opts.itemSelector) || '.item');
    
      if (itemEl) {
        if (cleanTitle) {
          itemEl.setAttribute(ATTR, cleanTitle);
        } // если пусто — оставляем исходный title как есть

        // Если включен expirableAttr, читаем дату и применяем атрибут + span.coupon_deadline
        if (opts.expirableAttr) {
          const dateEdit = row.querySelector('.ufo-date-edit input');
          if (dateEdit) {
            const dateValue = (dateEdit.value || '').trim(); // yyyy-mm-dd из input type="date"

            // Удаляем старый span.coupon_deadline если есть
            const oldSpan = itemEl.querySelector('.coupon_deadline');
            if (oldSpan) oldSpan.remove();

            // Создаём новый span.coupon_deadline после img
            const imgEl = itemEl.querySelector('img');
            const newSpan = document.createElement('span');
            newSpan.className = 'coupon_deadline';

            if (dateValue) {
              // Конвертируем yyyy-mm-dd -> dd/mm/yy для отображения
              const parts = dateValue.split('-');
              if (parts.length === 3) {
                const year = parts[0].slice(2); // берём последние 2 цифры года
                const month = parts[1];
                const day = parts[2];
                newSpan.textContent = `${day}/${month}/${year}`;
              }
              // Устанавливаем data-expired-date в формате yyyy-mm-dd
              itemEl.setAttribute(opts.expirableAttr, dateValue);
            } else {
              // Если дата не заполнена, span остаётся пустым
              newSpan.textContent = '';
              itemEl.removeAttribute(opts.expirableAttr);
            }

            // Вставляем span после img (или в конец если img нет)
            if (imgEl && imgEl.nextSibling) {
              itemEl.insertBefore(newSpan, imgEl.nextSibling);
            } else if (imgEl) {
              imgEl.parentNode.appendChild(newSpan);
            } else {
              itemEl.appendChild(newSpan);
            }
          }
        }
      }

      // (Опционально) перенести текст в <wrds> из .ufo-text-edit
      const edText = row.querySelector('.ufo-text-edit');
      if (edText && itemEl) {
        const rawText = edText.innerHTML || edText.textContent || '';
        const cleanText = String(rawText)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '')
          .replace(/\s+$/g, '')
          .trim();
        const wrdsEl = itemEl.querySelector('wrds');
        if (cleanText && wrdsEl) wrdsEl.textContent = cleanText;
      }
    
      return tmp.innerHTML;
    }

    // NEW: собрать HTML ВСЕХ «выбранных»
    function buildSelectedInnerAll(){
      const rows = [...selBox.querySelectorAll('.ufo-card')];
      return rows.map(row => {
        const html = row.dataset.html || '';
        return buildSelectedInnerHTML(row, html, {
          editableAttr: opts.editableAttr,
          expirableAttr: opts.expirableAttr,
          itemSelector: opts.itemSelector
        });
      }).join('\n');
    }

    // регистрируем панель для submit-хука (админка)
    PANELS.push({ uid, opts, rootEl: details, selectedBox: selBox, libBox, getSelectedInner: buildSelectedInnerAll, getSelectedIds });

    if (!opts.external) ensureGlobalSubmitHook(opts.textareaSelector);

    // external-builder: переписывает секцию targetClass, вставляя ВСЕ выбранные в начало
    function builder(fullHtmlOpt){
      let current = '';
      if (typeof fullHtmlOpt === 'string') current = fullHtmlOpt;
      else if (typeof opts.initialHtml === 'string') current = opts.initialHtml;
      else {
        const ta = $(opts.textareaSelector);
        const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
        if (tm) current = tm.getContent(); else if (ta) current = ta.value || '';
      }
      const inner = buildSelectedInnerAll();
      const ids = getSelectedIds();
      return rewriteSectionHTML(current, opts, inner, ids);
    }

    return { details, builder, getSelectedIds };
  }

  window.createChoicePanel = createChoicePanel;
})();
