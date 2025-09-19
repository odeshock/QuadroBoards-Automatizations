// episode_creation_boot.js — монтирует общий виджет на /post.php?fid=8|9
(function(){
  try{
    if (!/\/post\.php(\?|$)/.test(location.pathname)) return;
    var fid = +(new URLSearchParams(location.search).get('fid')||0);
    if ([8,9].indexOf(fid) === -1) return;

    var $form = $('#post form, form[action*="post.php"]').first();
    var $area = $form.find('textarea[name="req_message"], #main-reply, .questionary-post textarea').first();
    if(!$form.length || !$area.length) return;

    if (!window.FMV || !FMV.UI || typeof FMV.UI.attach !== 'function') {
      console.error('FMV.UI.attach не найден — подключите fmv.ui.js');
      return;
    }
    FMV.UI.attach({
  form: $('#post form, form[action*="post.php"]').first(),
  textarea: $('textarea[name="req_message"], #main-reply, .questionary-post textarea').first(),
  prefill: true,
  showOnlyIfFMVcast: false,
  className: 'fmv--compact'   // просто добавочный класс, если хочешь отличать темы
});

  }catch(e){ console.error('episode_creation_boot error:', e); }
})();
