(function () {
  // ——— утилиты ———
  function ensureButton(box){
    const lg = box.querySelector('.legend') || box.insertBefore(document.createElement('strong'), box.firstChild);
    lg.classList.add('legend');
    if(!lg.querySelector('.code-copy')){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = (lg.textContent||'').trim() || 'Скопировать код';
      lg.textContent = '';
      lg.appendChild(btn);
    }
  }
  function selectNodeContents(el){
    try{
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }catch(e){}
  }
  async function copy(text){
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch(e){}
    try{ return document.execCommand && document.execCommand('copy'); }
    catch(e){ return false; }
  }

  // ——— логика «скопировать» + авто-сброс выделения ———
  function arm(box){
    if(box.__armed) return;
    box.__armed = true;
    ensureButton(box);

    box.addEventListener('click', async (e)=>{
      const isBtn = e.target.closest && e.target.closest('.code-copy, .legend');
      if(!isBtn) return;

      e.preventDefault(); e.stopPropagation();

      const pre = box.querySelector('pre');
      if(!pre) return;

      // 1) выделяем текст и копируем
      selectNodeContents(pre);
      const text = (pre.innerText || pre.textContent || '').replace(/\s+$/,'');
      await copy(text);

      // 2) оставляем подсветку, но очищаем её,
      //    как только пользователь начнёт выделять/кликать в другом месте
      const s = window.getSelection();
      let active = true;

      function clear(){
        if(!active) return;
        active = false;
        try{ s.removeAllRanges(); }catch(e){}
        off();
      }
      function onEsc(ev){ if(ev.key === 'Escape') clear(); }
      function onDown(ev){ if(!box.contains(ev.target)) clear(); }
      function onSelChange(){
        const sel = window.getSelection();
        if(!sel.rangeCount || sel.isCollapsed) return clear();
        const n = sel.anchorNode;
        // если выделение ушло из текущего <pre> — очищаем старую подсветку
        if(!pre.contains(n)) clear();
      }
      function off(){
        document.removeEventListener('keydown', onEsc, true);
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('selectionchange', onSelChange, true);
      }
      document.addEventListener('keydown', onEsc, true);
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('selectionchange', onSelChange, true);
    }, true);
  }

  function init(ctx){
    (ctx||document).querySelectorAll('.code-box').forEach(arm);
  }

  // первичная инициализация
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>init());
  } else {
    init();
  }

  // если форум дорисовывает контент событием — подхватим
  document.addEventListener('pun_main_ready', ()=>init());

  // инициализация для динамически добавленных блоков
  new MutationObserver(muts=>{
    muts.forEach(m=>{
      (m.addedNodes||[]).forEach(n=>{
        if(n.nodeType!==1) return;
        if(n.matches && n.matches('.code-box')) arm(n);
        n.querySelectorAll && n.querySelectorAll('.code-box').forEach(arm);
      });
    });
  }).observe(document.body, {childList:true, subtree:true});
})();
