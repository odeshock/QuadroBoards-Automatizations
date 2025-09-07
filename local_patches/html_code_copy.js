(function () {
  // -------- утилиты --------
  function $(sel, root) { return (root||document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  function selectNodeContents(el){
    try{
      var r=document.createRange();
      r.selectNodeContents(el);
      var s=window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }catch(e){}
  }

  function getText(pre){
    return (pre && (pre.innerText || pre.textContent) || '').replace(/\s+$/,'');
  }

  function copyFromSelection(){
    try{ return document.execCommand && document.execCommand('copy'); }
    catch(e){ return false; }
  }

  async function copyTextPreferClipboard(text){
    if(navigator.clipboard && window.isSecureContext){
      try{ await navigator.clipboard.writeText(text); return true; }catch(e){}
    }
    return copyFromSelection();
  }

  // -------- управление выделением после копирования --------
  let activePre = null;

  function setActivePre(pre){
    activePre = pre || null;
  }

  function hardClearSelection() {
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
      if (document.selection && document.selection.empty) document.selection.empty(); // старый IE
    } catch(e) {}

    try {
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
    } catch(e) {}

    const b = document.body;
    const prevUS = b.style.userSelect;
    const prevWk = b.style.webkitUserSelect;
    b.style.userSelect = 'none';
    b.style.webkitUserSelect = 'none';
    void b.offsetHeight; // форсим рефлоу
    b.style.userSelect = prevUS;
    b.style.webkitUserSelect = prevWk;
  }

  function needClearByTarget(t) {
    if (!activePre) return false;
    return !activePre.contains(t);
  }

  function globalDown(e) {
    const t = e.target || e.srcElement;
    if (needClearByTarget(t)) {
      activePre = null;
      hardClearSelection();
    }
  }

  function onSelectionChange() {
    if (!activePre) return;
    const sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) {
      activePre = null;
      return;
    }
    const n = sel.anchorNode;
    if (n && !activePre.contains(n)) {
      activePre = null;
      hardClearSelection();
    }
  }

  // -------- инициализация коробок --------
  function ensureButton(box){
    // ищем/создаём .legend
    let lg = box.querySelector('.legend');
    if (!lg) {
      lg = document.createElement('strong');
      lg.className = 'legend';
      box.insertBefore(lg, box.firstChild);
    }
    if (lg.dataset.copyReady) return;

    // если внутри нет кнопки — вставляем
    if (!lg.querySelector('.code-copy')) {
      let label = (lg.textContent || '').trim();
      if (!label || /^код:?\s*$/i.test(label)) label = 'Скопировать код';
      lg.textContent = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = label;
      lg.appendChild(btn);
    }
    lg.dataset.copyReady = '1';
  }

  function armBox(box){
    ensureButton(box);
    if (box.__armed) return;
    box.__armed = true;

    // обработчик клика по кнопке (и по самой legend)
    box.addEventListener('click', async function(e){
      const target = (e.target.closest && e.target.closest('.code-copy, .legend')) || null;
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      const pre = box.querySelector('pre');
      if (!pre) return;

      // выделяем и копируем
      selectNodeContents(pre);
      setActivePre(pre);
      await copyTextPreferClipboard(getText(pre));
    }, true);
  }

  function init(ctx){
    $all('.code-box', ctx).forEach(armBox);
  }

  // первичная инициализация
  init();

  // если движок форума шлёт это событие — доинициализируем
  document.addEventListener('pun_main_ready', function(){ init(); });

  // MutationObserver — подхватываем динамически появляющиеся блоки
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      (m.addedNodes||[]).forEach(function(n){
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches('.code-box')) armBox(n);
        n.querySelectorAll && n.querySelectorAll('.code-box').forEach(armBox);
      });
    });
  }).observe(document.body, {childList:true, subtree:true});

  // глобальные «крючки» для гарантированного снятия выделения
  window.addEventListener('pointerdown', globalDown, true);
  document.addEventListener('mousedown', globalDown, true);
  document.addEventListener('click', globalDown, true);
  document.addEventListener('touchstart', globalDown, true);
  document.addEventListener('focusin', globalDown, true);
  document.addEventListener('scroll', function () {
    if (activePre) { activePre = null; hardClearSelection(); }
  }, true);
  document.addEventListener('selectionchange', onSelectionChange, true);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { activePre = null; hardClearSelection(); }
  }, true);
  window.addEventListener('blur', function () {
    if (activePre) { activePre = null; hardClearSelection(); }
  }, true);
})();
