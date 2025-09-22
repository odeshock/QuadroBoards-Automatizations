// get_skin.patched.js
// Универсальная панель выбора для одного блока (_plashka/_icon/_back)
// Не делает сетевых запросов и не сохраняет. Только рендер + сборка итогового HTML.
//
// API:
//   const panel = await get_skin({
//     mountEl,            // HTMLElement: сюда рисуем панель
//     title,              // 'Плашки' | 'Иконки' | 'Фон' ... (любой текст)
//     targetClass,        // '_plashka' | '_icon' | '_back' (как в HTML)
//     library,            // [{id:'1', html:'<div class="item" data-id="1" ...>...</div>'}, ...]
//     initialHtml         // ПОЛНЫЙ HTML из textarea админки (строка)
//   });
//   // panel.builder() -> вернёт ПОЛНЫЙ HTML с заменённым только targetClass
//
// Отрисовка и UX такие же, как мы вместе доводили ранее:
// - библиотека (grid, много в строку, скролл после 2 рядов),
// - выбранные (списком, скролл после 2 рядов), dnd + ↑/↓ + ✕,
// - id слева от картинки, редактирование title в выбранных,
// - если title пуст — атрибут удаляем при сборке,
// - библиотека не показывает полный title (обрезка), но в выбранных title — полный и редактируемый.


const baseCSS = `
details.ufo-panel{margin-top:12px;border:1px solid #d0d0d7;border-radius:10px;background:#fff}
details.ufo-panel>summary{cursor:pointer;list-style:none;padding:10px 14px;font-weight:600;background:#f6f6f8;border-bottom:1px solid #e6e6ef;border-radius:10px}
details.ufo-panel>summary::-webkit-details-marker{display:none}
.ufo-wrap{display:flex;flex-direction:column;gap:16px;padding:14px}
.ufo-col{display:flex;flex-direction:column;gap:8px}
.ufo-col h4{margin:0;font-size:14px;opacity:.8;display:flex;justify-content:space-between;align-items:center}
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

if (!document.getElementById('__get_skin_css__')) {
  const s=document.createElement('style'); s.id='__get_skin_css__'; s.textContent=baseCSS; document.head.appendChild(s);
}

function computeTwoRowMaxList(container){
  const first = container.querySelector('.ufo-card');
  if (!first){ container.style.maxHeight=''; return; }
  const st = getComputedStyle(first);
  const h  = first.getBoundingClientRect().height;
  const mt = parseFloat(st.marginTop)||0, mb = parseFloat(st.marginBottom)||0;
  const cs = getComputedStyle(container);
  const pt = parseFloat(cs.paddingTop)||0, pb = parseFloat(cs.paddingBottom)||0;
  container.style.maxHeight = Math.round(h*2 + (mt+mb)*3 + pt + pb) + 'px';
}
function computeTwoRowMaxGrid(container){
  const card = [...container.querySelectorAll('.ufo-card')].find(c=>getComputedStyle(c).display!=='none');
  if (!card){ container.style.maxHeight=''; return; }
  const ch = card.getBoundingClientRect().height;
  const cs = getComputedStyle(container);
  const rowGap = parseFloat(cs.rowGap)||0;
  const pt = parseFloat(cs.paddingTop)||0, pb = parseFloat(cs.paddingBottom)||0;
  container.style.maxHeight = Math.round(ch*2 + rowGap + pt + pb) + 'px';
}

const escCom = (s)=>String(s).replace(/--/g,'—');

function rewriteOnlyBlock(fullHtml, targetClass, newInner) {
  const host=document.createElement('div'); host.innerHTML=fullHtml;
  const block=host.querySelector('div.'+targetClass);
  const preservedFrom=(node)=>{
    if (node.nodeType===1){
      const id=node.getAttribute('data-id'); const pid=(id==null)?'undefined':id;
      return `<!-- preserved (data-id="${escCom(pid)}")\n${escCom(node.outerHTML)}\n-->`;
    } else if (node.nodeType===3){
      const t=node.nodeValue; if (!t.trim()) return '';
      return `<!-- preserved (data-id="undefined")\n${escCom(t)}\n-->`;
    } else if (node.nodeType===8){
      return `<!--${escCom(node.nodeValue)}-->`;
    }
    return '';
  };
  if (!block){
    const d=document.createElement('div'); d.className=targetClass; d.innerHTML=newInner||'';
    host.appendChild(d); return host.innerHTML;
  }
  const preserved=[]; block.childNodes.forEach(n=>preserved.push(preservedFrom(n)));
  block.innerHTML=(newInner?newInner+'\n':'') + preserved.filter(Boolean).join('\n');
  return host.innerHTML;
}

function mkBtn(txt, onClick){
  const b=document.createElement('button'); b.type='button'; b.className='ufo-btn'; b.textContent=txt;
  b.addEventListener('click', onClick); return b;
}

async function get_skin({ mountEl, title, targetClass, library, initialHtml }) {
  if (!(mountEl instanceof HTMLElement)) throw new Error('get_skin: mountEl обязателен');
  targetClass = targetClass || '_plashka';
  title = title || 'Набор';
  library = Array.isArray(library) ? library : [];
  initialHtml = String(initialHtml||'');

  const LIB_MAP = new Map(library.map(x=>[x.id, x]));
  const LIB_SET = new Set(library.map(x=>x.id));

  const details = document.createElement('details');
  details.className='ufo-panel';
  details.open=false;
  const summary=document.createElement('summary'); summary.textContent = `${title}: библиотека и выбранные`;
  const wrap=document.createElement('div'); wrap.className='ufo-wrap';

  // left: library
  const libCol=document.createElement('div'); libCol.className='ufo-col';
  const hLib=document.createElement('h4'); hLib.textContent='Библиотека';
  const search=document.createElement('input'); search.type='text'; search.placeholder='поиск по id'; search.className='ufo-search';
  hLib.appendChild(search);
  const libBox=document.createElement('div'); libBox.className='ufo-lib';
  libCol.append(hLib, libBox);

  // right: selected
  const selCol=document.createElement('div'); selCol.className='ufo-col';
  selCol.innerHTML='<h4>Выбранные (сверху — новее)</h4>';
  const selBox=document.createElement('div'); selBox.className='ufo-selected';
  selCol.appendChild(selBox);

  wrap.append(libCol, selCol);
  details.append(summary, wrap);
  mountEl.appendChild(details);

  function renderLibItem(item){
    const card=document.createElement('div'); card.className='ufo-card'; card.dataset.id=item.id;
    const id=document.createElement('div'); id.className='ufo-idtag'; id.textContent='#'+item.id;
    const full=document.createElement('div'); full.className='ufo-full';
    const tmp=document.createElement('div'); tmp.innerHTML=item.html.trim(); full.appendChild(tmp.firstElementChild);
    const actions=document.createElement('div'); actions.className='ufo-actions';
    actions.appendChild(mkBtn('Добавить ↑', (e)=>{e.preventDefault(); e.stopPropagation(); addToSelected(item);}));
    card.append(id, full, actions); return card;
  }
  library.forEach(x=>libBox.appendChild(renderLibItem(x)));

  function addToSelected(item, {usePageHtml}={}){
    if (selBox.querySelector(`.ufo-card[data-id="${item.id}"]`)) return;
    const libCard=libBox.querySelector(`.ufo-card[data-id="${item.id}"]`);
    if (libCard) libCard.classList.add('disabled');

    const row=document.createElement('div'); row.className='ufo-card'; row.draggable=true; row.dataset.id=item.id;
    const id=document.createElement('div'); id.className='ufo-idtag'; id.textContent='#'+item.id;
    const full=document.createElement('div'); full.className='ufo-full';
    const tmp=document.createElement('div'); tmp.innerHTML=(usePageHtml || item.html).trim(); full.appendChild(tmp.firstElementChild);

    const editor=document.createElement('div'); editor.className='ufo-title-edit'; editor.contentEditable=true;
    const elItem=full.querySelector('.item'); editor.textContent = elItem ? (elItem.getAttribute('title')||'') : '';

    const actions=document.createElement('div'); actions.className='ufo-actions';
    const btnUp=mkBtn('↑',(e)=>{e.preventDefault();e.stopPropagation(); if (row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);});
    const btnDown=mkBtn('↓',(e)=>{e.preventDefault();e.stopPropagation(); if (row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row);});
    const btnRm=mkBtn('✕',(e)=>{e.preventDefault();e.stopPropagation(); row.remove(); if (libCard) libCard.classList.remove('disabled');});
    actions.append(btnUp, btnDown, btnRm);

    row.dataset.html=item.html.trim();
    row.append(id, full, actions, editor);
    selBox.insertBefore(row, selBox.firstChild);
  }

  // DnD
  (function enableDnd(container){
    let dragEl=null;
    container.addEventListener('dragstart',(e)=>{const card=e.target.closest('.ufo-card'); if(!card)return; dragEl=card; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','');});
    container.addEventListener('dragover',(e)=>{e.preventDefault(); const over=e.target.closest('.ufo-card'); if(!over||over===dragEl) return; const r=over.getBoundingClientRect(); const before=(e.clientY-r.top)/r.height<0.5; over.parentElement.insertBefore(dragEl, before?over:over.nextSibling);});
    container.addEventListener('drop',(e)=>{e.preventDefault(); dragEl=null;});
    container.addEventListener('dragend',()=>{dragEl=null;});
  })(selBox);

  // поиск
  search.addEventListener('input',()=>{
    const v=search.value.trim();
    libBox.querySelectorAll('.ufo-card').forEach(c=>{ c.style.display = (!v || c.dataset.id.includes(v)) ? '' : 'none'; });
    computeTwoRowMaxGrid(libBox);
  });

  // двухрядные ограничения
  const obs1=new MutationObserver(()=>computeTwoRowMaxList(selBox));
  obs1.observe(selBox,{childList:true,subtree:true,attributes:true});
  const obs2=new MutationObserver(()=>computeTwoRowMaxGrid(libBox));
  obs2.observe(libBox,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  window.addEventListener('resize',()=>{computeTwoRowMaxGrid(libBox); computeTwoRowMaxList(selBox);});
  computeTwoRowMaxGrid(libBox); computeTwoRowMaxList(selBox);

  // гидратация из initialHtml
  (function hydrate(){
    if (!initialHtml) return;
    const host=document.createElement('div'); host.innerHTML=initialHtml;
    const block=host.querySelector('div.'+targetClass);
    if (!block) return;
    const items=[];
    block.childNodes.forEach(n=>{
      if (n.nodeType===1 && n.classList.contains('item')){
        const id=n.getAttribute('data-id')||'';
        if (id && LIB_SET.has(id)){
          items.push({id, pageHtml:n.outerHTML, lib:LIB_MAP.get(id)});
        }
      }
    });
    for (let i=items.length-1;i>=0;i--){
      const it=items[i];
      addToSelected({id:it.id, html:it.lib.html},{usePageHtml:it.pageHtml});
      const libCard=libBox.querySelector(`.ufo-card[data-id="${it.id}"]`); if (libCard) libCard.classList.add('disabled');
    }
  })();

  // сборка inner выбранных (пустой title — удалить)
  function buildSelectedInnerHTML(){
    const cards=[...selBox.querySelectorAll('.ufo-card')];
    return cards.map(row=>{
      let html=row.dataset.html||'';
      const ed=row.querySelector('.ufo-title-edit'); const t=ed?ed.textContent.trim():'';
      if (t){
        const safe=t.replace(/"/g,'&quot;');
        if (/title="[^"]*"/.test(html)) html=html.replace(/title="[^"]*"/,'title="'+safe+'"');
        else html=html.replace(/<div\s+class="item"\b([^>]*)>/,(m,attrs)=>`<div class="item" title="${safe}"${attrs}>`);
      } else {
        html=html.replace(/(<div\s+class="item"\b[^>]*?)\s+title="[^"]*"(.*?>)/,'$1$2');
      }
      return html;
    }).join('\n');
  }

  // внешний builder: принимает (необязательно) входной fullHtml, но по умолчанию использует initialHtml
  function builder(fullHtmlOpt){
    const baseFull = typeof fullHtmlOpt==='string' ? fullHtmlOpt : initialHtml;
    const newInner = buildSelectedInnerHTML();
    return rewriteOnlyBlock(baseFull, targetClass, newInner);
  }

  return { details, builder };
}
