// fmv-all-in-one.js — единый виджет + подключатели для создания и редактирования
(function(){
  'use strict';

  // Требуется общий модуль, где есть FMV.fetchUsers
  if (!window.FMV || typeof window.FMV.fetchUsers !== 'function') {
    console.error('[FMV] Требуется общий модуль с FMV.fetchUsers (подключите common раньше этого файла)');
  }

  // ───────────────── UI-модуль ─────────────────
  if (!window.FMV) window.FMV = {};
  if (!window.FMV.UI) {
    (function(){
      // mini utils
      function splitBySemicolon(s){
        return String(s || '').split(';').map(v => v.trim()).filter(Boolean);
      }
      function parseFMVcast(text){
        const mc = String(text || '').match(/\[FMVcast\]([\s\S]*?)\[\/FMVcast\]/i);
        const items = mc && mc[1] ? splitBySemicolon(mc[1]) : [];
        const by = {};
        items.forEach(tok => {
          const m = tok.match(/^(user\d+)(?:=(.+))?$/i);
          if (!m) return;
          const code = m[1];
          const mask = (m[2] || '').trim();
          const ref = by[code] || (by[code] = { code, masks: [] });
          if (mask) ref.masks.push(mask);
        });
        return by;
      }
      function buildFMVcast(selected){
        const parts = [];
        (selected || []).forEach(it => {
          const masks = Array.isArray(it.masks) ? it.masks.filter(Boolean) : [];
          if (!masks.length) parts.push(it.code);
          else masks.forEach(msk => parts.push(it.code + '=' + msk));
        });
        return parts.length ? '[FMVcast]' + parts.join(';') + '[/FMVcast]' : '';
      }
      function buildFMVplace(val){
        val = String(val || '').trim();
        return val ? '[FMVplace]' + val + '[/FMVplace]' : '';
      }
      function stripFMV(text){
        return String(text || '')
          .replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig,'')
          .replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig,'')
          .replace(/^\s+|\s+$/g,'');
      }

      // CSS (компактный скин)
      let cssInjected = false;
      function injectCSS(){
        if (cssInjected) return; cssInjected = true;
        const css = `
        :root{
          --fmv-bg:#f7f4ea; --fmv-b:#d8d1c3; --fmv-chip:#fff;
          --fmv-radius:10px; --fmv-gap:8px; --fmv-text:#2d2a26; --fmv-muted:#6b6359;
        }
        .msg-with-characters.fmv{margin:10px 0; padding:10px; border:1px solid var(--fmv-b); background:var(--fmv-bg); border-radius:var(--fmv-radius)}
        .fmv .char-row{display:flex; gap:var(--fmv-gap); align-items:flex-start; flex-wrap:wrap}
        .fmv .combo{position:relative; flex:1 1 480px}
        .fmv .combo input,
        .fmv .place-row input{
          width:100%; height:36px;
          padding:8px 10px; border:1px solid var(--fmv-b); border-radius:8px;
          background:#efe9dc; color:var(--fmv-text); font-size:14px;
        }
        .fmv .place-row{margin-top:8px}
        .fmv .place-row label{display:block; margin-bottom:4px; font-weight:600; color:var(--fmv-text)}
        .fmv .ac-list{
          position:absolute; z-index:50; left:0; right:0; background:#fff;
          border:1px solid var(--fmv-b); border-radius:8px; margin-top:4px; max-height:240px; overflow:auto
        }
        .fmv .ac-item{padding:.45em .65em; cursor:pointer; font-size:14px}
        .fmv .ac-item.active,.fmv .ac-item:hover{background:#f0efe9}
        .fmv .ac-item .muted{color:var(--fmv-muted)}

        /* Чипы — влево, не по центру */
        .fmv .chips .chip{
          display:flex; align-items:center; justify-content:flex-start;
          gap:10px; padding:.45em .6em; background:var(--fmv-chip);
          border:1px solid var(--fmv-b); border-radius:8px; margin:.35em 0; font-size:14px
        }
        .fmv .chip .drag{cursor:grab; margin-right:.4em; color:#8b8378}
        .fmv .chip .name{font-weight:600}

        /* Список масок возле имени */
        .fmv .masks{display:flex; align-items:center; gap:6px; flex-wrap:wrap; color:var(--fmv-muted)}
        .fmv .masks .masks-label{ color:var(--fmv-muted); margin-right:2px; }
        .fmv .mask-badge{
          display:inline-flex; align-items:center; gap:6px;
          padding:2px 8px; border:1px solid var(--fmv-b); border-radius:999px;
          background:#efe9dc; font-size:13px; color:var(--fmv-text);
        }
        .fmv .mask-badge .mask-remove{
          border:0; background:none; cursor:pointer; line-height:1;
          color:#8b8378; font-size:14px; padding:0 2px;
        }

        .fmv .chip .add-mask{border:0; background:none; color:#2e5aac; cursor:pointer; padding:0; text-decoration:underline; margin-left:auto}
        .fmv .chip .x{border:0; background:none; font-size:16px; line-height:1; cursor:pointer; color:#8b8378; margin-left:8px}

        /* Форма добавления маски: по умолчанию скрыта; когда открыта — справа */
        .fmv .chip .mask-input{ display:none; margin-left:auto; }
        .fmv .chip .mask-input.is-open{ display:flex; align-items:center; gap:8px; }
        .fmv .chip .mask-input input{
          flex:1; min-width:260px; height:30px;
          padding:6px 8px; border:1px solid var(--fmv-b); border-radius:6px;
          background:#efe9dc; color:var(--fmv-text);
        }
        .fmv .chip .btn{
          border:1px solid var(--fmv-b); border-radius:6px;
          background:#fff; padding:6px 10px; cursor:pointer; line-height:1;
        }
        .fmv .chip .btn-ok{ background:#e9f6e9; }
        .fmv .chip .btn-cancel{ background:#f4eeee; }

        .fmv .hint{font-size:13px; color:var(--fmv-muted); margin-top:6px}
        .fmv .error{color:#b00; margin-top:6px}
        `;
        const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
      }

      function attach(opts){
        injectCSS();
        const $form = typeof opts.form === 'string' ? $(opts.form) : opts.form;
        const $area = typeof opts.textarea === 'string' ? $(opts.textarea) : opts.textarea;
        if (!$form || !$form.length || !$area || !$area.length) return null;
        if (opts.showOnlyIfFMVcast && !/\[FMVcast\][\s\S]*?\[\/FMVcast\]/i.test($area.val() || '')) return null;
        if ($form.data('fmvBoundUI')) return $form.data('fmvBoundUI');

        const wrapClass = 'msg-with-characters fmv ' + (opts.className || '');
        const $wrap=$('<div/>',{class:wrapClass});
        const $row =$('<div class="char-row"/>');
        const $combo=$('<div class="combo"/>');
        const $comboInput=$('<input type="text" id="character-combo" placeholder="Наберите имя персонажа…" autocomplete="off">');
        const $ac=$('<div class="ac-list" role="listbox" aria-label="Варианты персонажей"></div>');
        $combo.append($comboInput,$ac); $row.append($combo);

        const $placeRow  =$('<div class="place-row"/>');
        const $placeLabel=$('<label for="fmv-place" style="font-weight:600">Локация:</label>');
        const $placeInput=$('<input type="text" id="fmv-place" placeholder="Укажите локацию">');
        $placeRow.append($placeLabel,$placeInput);

        const $chips=$('<div class="chips"/>');
        const $hint =$('<div class="hint">Участники/маски/локация. Сохранится как: [FMVcast]userN;userM=маска…[/FMVcast] + [FMVplace]…[/FMVplace].</div>');
        const $err  =$('<div class="error" style="display:none"></div>');

        // Вставляем: поиск → ЧИПЫ → Локация → подсказка → ошибки
        $area.before($wrap);
        $wrap.append($row, $chips, $placeRow, $hint, $err);

        let selected=[], knownUsers=[];

        function renderChips(){
          $chips.empty();
          selected.forEach(function(item, idx){
            const $chip=$('<div class="chip" draggable="true" data-idx="'+idx+'"/>');
            const $drag=$('<span class="drag" title="Перетащите для изменения порядка">↕</span>');
            const $name=$('<span class="name"/>').text(item.name+' ('+item.code+')');

            // Маски как бейджи
            const $masks = $('<span class="masks"/>');
            if (item.masks && item.masks.length){
              $masks.append($('<span class="masks-label">— маски:</span>'));
              item.masks.forEach(function(msk, mi){
                const $badge = $('<span class="mask-badge" data-mi="'+mi+'"></span>');
                $badge.append($('<span class="mask-text"></span>').text(msk));
                $badge.append($('<button type="button" class="mask-remove" aria-label="Удалить маску">×</button>'));
                $masks.append($badge);
              });
            } else {
              $masks.text(' — масок нет');
            }

            const $addMask=$('<button class="add-mask" type="button">добавить маску</button>');
            const $remove=$('<button class="x" type="button" aria-label="Удалить">×</button>');

            // Поле добавления маски (по клику)
            const $maskBox   =$('<span class="mask-input"></span>').hide();
            const $maskInput =$('<input type="text" placeholder="маска (текст)">');
            const $maskOk    =$('<button type="button" class="btn btn-ok">Ок</button>');
            const $maskCancel=$('<button type="button" class="btn btn-cancel">Отмена</button>');
            $maskBox.append($maskInput,$maskOk,$maskCancel);

            $maskInput.on('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); $maskOk.click(); } });
            $addMask.on('click', function(){
              $chip.find('.mask-input').removeClass('is-open').hide();
              $maskBox.addClass('is-open').show();
              $maskInput.val('').focus();
            });
            $maskOk.on('click', function(){
              const v=$.trim($maskInput.val()); if(!v) return;
              (item.masks||(item.masks=[])).push(v);
              renderChips(); // перерисуем; форма снова будет скрыта
            });
            $maskCancel.on('click', function(){ $maskBox.removeClass('is-open').hide(); });

            $remove.on('click', function(){ selected.splice(idx,1); renderChips(); });

            // порядок: перетаскивание, имя, маски, ссылка, поле, крестик
            $chip.append($drag,$name,$masks,$addMask,$maskBox,$remove);
            $chips.append($chip);
          });
        }

        // DnD
        $chips.on('dragstart','.chip',function(e){
          $(this).addClass('dragging');
          e.originalEvent.dataTransfer.setData('text/plain',$(this).data('idx'));
        });
        $chips.on('dragend','.chip',function(){ $(this).removeClass('dragging'); });
        $chips.on('dragover',function(e){ e.preventDefault(); });
        $chips.on('drop',function(e){
          e.preventDefault();
          const from=+e.originalEvent.dataTransfer.getData('text/plain');
          const $t=$(e.target).closest('.chip'); if(!$t.length) return;
          const to=+$t.data('idx');
          if(isNaN(from)||isNaN(to)||from===to) return;
          const it=selected.splice(from,1)[0]; selected.splice(to,0,it); renderChips();
        });

        // Удаление конкретной маски по крестику на бейдже
        $chips.on('click', '.mask-remove', function(){
          const $chip = $(this).closest('.chip');
          const idx = +$chip.data('idx');
          const mi  = +$(this).closest('.mask-badge').data('mi');
          if (isNaN(idx) || isNaN(mi)) return;
          if (Array.isArray(selected[idx].masks)) {
            selected[idx].masks.splice(mi, 1);
            renderChips();
          }
        });

        // Добавление участника
        function addByCode(code){
          if(!code) return;
          if(selected.some(x => x.code===code)) return;
          const u=knownUsers.find(x => x.code===code);
          selected.push({ code, name:(u?u.name:code), masks:[] });
          renderChips(); $comboInput.val(''); $ac.hide().empty();
        }

        // Поиск по вводу
        function pickByInput(){
          const q=($.trim($comboInput.val())||'').toLowerCase();
          if(!q) return null;
          const pool=knownUsers.filter(u => !selected.some(x => x.code===u.code));
          const exact=pool.find(u => u.name.toLowerCase()===q) || pool.find(u => u.code.toLowerCase()===q);
          if(exact) return exact.code;
          const list=pool.filter(u => u.name.toLowerCase().includes(q) || u.code.toLowerCase().includes(q));
          if(list.length===1) return list[0].code;
          const prefix=list.filter(u => u.name.toLowerCase().startsWith(q));
          if(prefix.length===1) return prefix[0].code;
          return null;
        }

        // Autocomplete
        function renderAC(q){
          const qq=(q||'').trim().toLowerCase();
          const items=knownUsers
            .filter(u => !selected.some(x => x.code===u.code))
            .filter(u => !qq || u.name.toLowerCase().includes(qq) || u.code.toLowerCase().includes(qq))
            .slice().sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));
          $ac.empty();
          if(!items.length){ $ac.append('<div class="ac-item"><span class="muted">Ничего не найдено</span></div>').show(); return; }
          items.slice(0,40).forEach(u => {
            $ac.append($('<div class="ac-item" role="option"/>').attr('data-code',u.code).text(u.name+' ('+u.code+')'));
          });
          $ac.show(); setActive(0);
        }
        function setActive(i){
          const $it=$ac.children('.ac-item');
          $it.removeClass('active'); if(!$it.length) return;
          i=(i+$it.length)%$it.length; $it.eq(i).addClass('active'); $ac.data('activeIndex',i);
        }
        function getActiveCode(){
          const i=$ac.data('activeIndex')|0; const $it=$ac.children('.ac-item').eq(i); return $it.data('code');
        }
        $comboInput.on('input', function(){ renderAC(this.value); });
        $comboInput.on('keydown', function(e){
          const idx=$ac.data('activeIndex')|0;
          if(e.key==='ArrowDown'&&$ac.is(':visible')){e.preventDefault();setActive(idx+1);}
          else if(e.key==='ArrowUp'&&$ac.is(':visible')){e.preventDefault();setActive(idx-1);}
          else if(e.key==='Enter'){
            e.preventDefault();
            const code=$ac.is(':visible')?getActiveCode():pickByInput();
            if(code) addByCode(code); else renderAC(this.value);
          } else if(e.key==='Escape'){ $ac.hide(); }
        });
        $ac.on('mousedown','.ac-item',function(){ const code=$(this).data('code'); if(code) addByCode(code); });
        $(document).on('click',function(e){ if(!$(e.target).closest($combo).length) $ac.hide(); });

        // Префилл из FMVcast/FMВplace
        function prefillFrom(text){
          selected = [];
          const by = parseFMVcast(text || '');
          const mp = String(text || '').match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i);
          if (mp && typeof mp[1] === 'string') $placeInput.val(mp[1].trim());
          Object.keys(by).forEach(code => {
            const u=knownUsers.find(x => x.code===code);
            selected.push({ code, name:(u?u.name:code), masks:by[code].masks });
          });
          renderChips();
        }

        function metaLine(){
          return [ buildFMVcast(selected), buildFMVplace($placeInput.val()) ].filter(Boolean).join('');
        }

        // загрузка участников и префилл
        if (window.FMV && typeof FMV.fetchUsers === 'function') {
          FMV.fetchUsers().done(function(list){
            knownUsers = (list || []).slice();
            if (opts.prefill !== false) prefillFrom($area.val() || '');
          }).fail(function(msg){
            $ac.html('<div class="ac-item"><span class="muted">'+(msg||'Ошибка загрузки')+'</span></div>').show();
          });
        }

        // submit hook: подставляем мету в начало
        $form.on('submit.fmv.ui', function(){
          const meta = metaLine();
          const rest = stripFMV($area.val()).replace(/^\n+/, '');
          $area.val(meta + (rest ? '\n\n' + rest : ''));
        });

        const api = {
          prefillFrom,
          serialize: () => metaLine(),
          stripFMV,
          mountPoint: $wrap,
          setKnownUsers: list => { knownUsers = (list||[]).slice(); },
          getSelected: () => selected.slice(),
          getPlace: () => String($placeInput.val() || '')
        };
        $form.data('fmvBoundUI', api);
        return api;
      }

      window.FMV.UI = { attach: attach };
    })();
  }

  // ───────────────── Bootstraps ─────────────────

  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  onReady(function(){
    if (!window.FMV || !FMV.UI || typeof FMV.UI.attach !== 'function') return;

    const path = location.pathname;

    // /post.php?fid=8|9
    if (/\/post\.php(\?|$)/i.test(path)) {
      const fid = +(new URLSearchParams(location.search).get('fid')||0);
      if ([8,9].indexOf(fid) !== -1) {
        const $form = $('#post form, form[action*="post.php"]').first();
        const $area = $form.find('textarea[name="req_message"], #main-reply, .questionary-post textarea').first();
        if ($form.length && $area.length) {
          FMV.UI.attach({ form:$form, textarea:$area, prefill:true, showOnlyIfFMVcast:false, className:'fmv--compact' });
        }
      }
    }

    // /edit.php?id=N&topicpost=1
    if (/\/edit\.php$/i.test(path)) {
      const q = new URLSearchParams(location.search);
      if (q.get('topicpost') === '1') {
        const $form = $('#post form, form[action*="edit.php"]').first();
        const $area = $form.find('textarea[name="req_message"], #main-reply, .questionary-post textarea').first();
        if ($form.length && $area.length) {
          FMV.UI.attach({ form:$form, textarea:$area, prefill:true, showOnlyIfFMVcast:true, className:'fmv--compact' });
        }
      }
    }
  });

})();
