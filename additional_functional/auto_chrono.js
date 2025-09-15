/* === FMV: автохронология (кнопка + сборка) ================================ */
(function () {
  var LOGPFX = '[FMV] ';
  function log(){try{console.log.apply(console, arguments)}catch(e){}}
  function $1(s, r){return (r||document).querySelector(s)}
  function $all(s, r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function on(el, ev, fn){ if(!el) return; el.addEventListener(ev, fn, false) }

  // ---------- 1) Реализация сборки ----------
  function buildChronology(opts){
    opts = opts || {};
    var root = $1('#pun-viewtopic') || document;
    var posts = $all('.post', root);
    if (!posts.length){ alert('Постов не найдено'); return }

    var rows = posts.map(function(p, idx){
      var id   = p.id || ('post-' + (idx+1));
      var link = $1('a.permalink', p);
      var time = link ? link.textContent.trim() : '';
      var href = link ? link.href : ('#' + id);
      var author = ($1('.pa-author a', p) || {}).textContent || '';
      author = author.trim();

      // небольшой сниппет текста (по желанию)
      var text = ($1('.post-content', p) || p).innerText
                  .replace(/\s+/g,' ').trim();
      if (text.length > 140) text = text.slice(0, 137) + '…';

      return { id:id, time:time, href:href, author:author, text:text };
    });

    // Вывод по умолчанию — список ссылок; можно поменять формат тут
    var out = rows.map(function(r){
      return '• ['+r.time+'] '+r.author+' → '+r.href;
    }).join('\n');

    // Куда положить: modal | textarea | clipboard
    var target = (opts.target || 'modal');

    if (target === 'textarea') {
      var ta = $1('#main-reply');
      if (ta) {
        ta.value += '\n[spoiler="хронология"]\n' + out + '\n[/spoiler]\n';
        ta.focus();
        return;
      }
    }

    if (target === 'clipboard') {
      try { navigator.clipboard.writeText(out).then(function(){
        alert('Хронология скопирована в буфер обмена');
      }); return; } catch(e){}
    }

    // Модалка с Copy/Вставить
    showModal(out);
  }

  function showModal(text){
    var wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:20px;';
    var box = document.createElement('div');
    box.style.cssText =
      'max-width:900px;width:min(90vw,900px);background:#fff;color:#222;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:16px; font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial;';
    box.innerHTML =
      '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<strong>Хронология</strong>' +
        '<div style="display:flex;gap:8px;">' +
          '<button id="fmv-copy" class="button">Скопировать</button>' +
          '<button id="fmv-to-ta" class="button">Вставить в ответ</button>' +
          '<button id="fmv-close" class="button">Закрыть</button>' +
        '</div>' +
      '</div>' +
      '<textarea id="fmv-out" style="width:100%;height:50vh;white-space:pre;resize:vertical;"></textarea>';
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    $1('#fmv-out', box).value = text;

    on($1('#fmv-close', box), 'click', function(){ wrap.remove() });
    on($1('#fmv-copy',  box), 'click', function(){
      $1('#fmv-out', box).select();
      try{ document.execCommand('copy'); }catch(e){}
    });
    on($1('#fmv-to-ta', box), 'click', function(){
      var ta = $1('#main-reply');
      if (ta) {
        ta.value += '\n[spoiler="хронология"]\n' + text + '\n[/spoiler]\n';
        ta.focus(); wrap.remove();
      } else { alert('Поле быстрого ответа не найдено'); }
    });

    on(wrap, 'click', function(e){ if(e.target === wrap) wrap.remove() });
  }

  // Экспорт в глобал — это и искал твой логгер
  window.FMV = window.FMV || {};
  window.FMV_buildChronology = buildChronology;
  window.FMV.buildChronology = buildChronology;

  // ---------- 2) Отрисовка кнопок ----------
  function renderInlineButtons(){
    $all('.post .post-box').forEach(function(box){
      if (box.querySelector('[data-fmv-chrono-trigger]')) return;
      var bar = document.createElement('div');
      bar.style.cssText='display:flex;gap:.5rem;margin:.35rem 0 0;';
      var btn = document.createElement('a');
      btn.href = 'javascript:void(0)';
      btn.className = 'button';
      btn.setAttribute('data-fmv-chrono-trigger','');
      btn.textContent = 'Собрать хронологию';
      var note = document.createElement('span');
      note.setAttribute('data-fmv-chrono-note','');
      note.style.cssText='font-size:90%;opacity:.8;';
      bar.appendChild(btn); bar.appendChild(note);
      box.appendChild(bar);
    });
  }

  function attachHandlers(){
    on(document, 'click', function(e){
      var t = e.target.closest('[data-fmv-chrono-trigger]');
      if (!t) return;
      e.preventDefault();
      log(LOGPFX+'Нажата инлайн-кнопка');
      if (typeof window.FMV_buildChronology === 'function'){
        window.FMV_buildChronology({ target:'modal' });
      } else {
        console.warn(LOGPFX+'Функция сборки не найдена (ожидали FMV_buildChronology)');
      }
    });
  }

  function renderFallbackFAB(){
    if ($1('#fmv-chrono-fab')) return;
    var b = document.createElement('button');
    b.id='fmv-chrono-fab';
    b.title='Собрать хронологию';
    b.textContent='⏱';
    b.style.cssText='position:fixed;right:16px;bottom:16px;width:44px;height:44px;border-radius:50%;border:none;background:#2d7;box-shadow:0 4px 12px rgba(0,0,0,.25);color:#fff;font-size:20px;cursor:pointer;z-index:99998;';
    on(b,'click',function(){
      if (typeof window.FMV_buildChronology === 'function'){
        window.FMV_buildChronology({ target:'modal' });
      } else {
        console.warn(LOGPFX+'Функция сборки не найдена (ожидали FMV_buildChronology)');
      }
    });
    document.body.appendChild(b);
    log(LOGPFX+'Резервная кнопка поставлена (правый нижний угол)');
  }

  function init(){
    if (!$1('#pun-viewtopic')) return;         // только в теме
    renderInlineButtons();
    attachHandlers();
    renderFallbackFAB();
    log(LOGPFX+'Доступно window.FMV_buildChronology()');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init() }
})();
