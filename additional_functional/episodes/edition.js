// episode_edit_boot.js — монтирует общий виджет на /edit.php?id=N&topicpost=1
(function(){
  try{
    if (!/\/edit\.php$/i.test(location.pathname)) return;
    var q = new URLSearchParams(location.search);
    if (q.get('topicpost') !== '1') return;

    var $form = $('#post form, form[action*="edit.php"]').first();
    var $area = $form.find('textarea[name="req_message"], #main-reply, .questionary-post textarea').first();
    if(!$form.length || !$area.length) return;

    if (!window.FMV || !FMV.UI || typeof FMV.UI.attach !== 'function') {
      console.error('FMV.UI.attach не найден — подключите fmv.ui.js');
      return;
    }
    // ВАЖНО: показываем виджет ТОЛЬКО если в тексте уже есть FMVcast
    FMV.UI.attach({ form:$form, textarea:$area, prefill:true, showOnlyIfFMVcast:true });
  }catch(e){ console.error('episode_edit_boot error:', e); }
})();
