// лучше ставить в самый низ, чтобы вся инициализация DOMа прошла уже

(function($){
  function selectNodeContents(el){
    try{
      var r=document.createRange();
      r.selectNodeContents(el);
      var s=window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }catch(e){}
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

  // «вооружаем» legend: если кнопки нет — вставляем; если уже есть — не трогаем
  function arm(box){
    var $legend=$(box).find('.legend').first();
    if(!$legend.length || $legend.data('copy-ready')) return;

    if(!$legend.find('.code-copy').length){
      var label = ($legend.text()||'').trim();
      if(!label || /^код:?\s*$/i.test(label)) label='Скопировать код';
      $legend.empty().append('<button type="button" class="code-copy">'+label+'</button>');
    }
    $legend.data('copy-ready',1);
  }

  function init(ctx){ (ctx||document).querySelectorAll('.code-box').forEach(arm); }

  // Клик: ловим на всей коробке, но реагируем только если цель — кнопка или легенда
  $(document).on('click', '.code-box', function(e){
    var target = e.target.closest ? e.target.closest('.code-copy, .legend') : null;
    if(!target) return;

    e.preventDefault();
    e.stopPropagation();

    var pre = this.querySelector('pre');
    if(!pre) return;

    selectNodeContents(pre);

    var text = (pre.innerText || pre.textContent || '').replace(/\s+$/,'');
    copyTextPreferClipboard(text);
  });

  // первичная инициализация + когда форум дорисует
  $(init);
  $(document).on('pun_main_ready', function(){ init(); });

  // подхватываем динамику
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      (m.addedNodes||[]).forEach(function(n){
        if(n.nodeType!==1) return;
        if(n.matches && n.matches('.code-box')) arm(n);
        n.querySelectorAll && n.querySelectorAll('.code-box').forEach(arm);
      });
    });
  }).observe(document.body,{childList:true,subtree:true});
})(jQuery);
