// ui.js — FMV: виджет участников/масок/локации/порядка + автоподключение + ручной режим для админов
(function(){
  'use strict';

  // ───────────────────── helpers-конфиг ─────────────────────
  // ожидаем, что check_group.js уже подключен и экспортирует getCurrentGroupId / getCurrentUserId
  function isAllowedAdmin(){
    const groups = (window.CHRONO_CHECK?.GroupID || []).map(String);
    const users  = (window.CHRONO_CHECK?.AllowedUser || []).map(String);
    const gid = (typeof window.getCurrentGroupId === 'function') ? String(window.getCurrentGroupId()) : '';
    const uid = (typeof window.getCurrentUserId === 'function') ? String(window.getCurrentUserId()) : '';
    return (gid && groups.includes(gid)) || (uid && users.includes(uid));
  }

  if (!window.FMV) window.FMV = {};
  if (!window.FMV.fetchUsers) {
    console.warn('[FMV] Подключите общий модуль с FMV.fetchUsers до ui.js');
  }

  // ───────────────────── UI-модуль ─────────────────────
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
      function buildFMVord(val){
        let n = parseInt(String(val||'').trim(), 10);
        if (Number.isNaN(n)) n = 0;
        return '[FMVord]' + n + '[/FMVord]';
      }
      function stripFMV(text){
        return String(text || '')
          .replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig,'')
          .replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig,'')
          .replace(/\[FMVord\][\s\S]*?\[\/FMVord\]/ig,'')
          .replace(/^\s+|\s+$/g,'');
      }

      // CSS (с защитой от переполнения по ширине)
      let cssInjected = false;
      function injectCSS(){
        if (cssInjected) return; cssInjected = true;
        const css = `
        :root{
          --fmv-bg:#f7f4ea; --fmv-b:#d8d1c3; --fmv-chip:#fff;
          --fmv-radius:10px; --fmv-gap:8px; --fmv-text:#2d2a26; --fmv-muted:#6b6359;
        }

        .msg-with-characters.fmv,
        .msg-with-characters.fmv * { box-sizing: border-box; }
        .msg-with-characters.fmv { width:100%; max-width:100%; overflow-x:hidden; }

        .msg-with-characters.fmv{margin:10px 0; padding:10px; border:1px solid var(--fmv-b); background:var(--fmv-bg); border-radius:var(--fmv-radius)}
        .fmv .char-row{display:flex; gap:var(--fmv-gap); align-items:flex-start; flex-wrap:wrap}
        .fmv .combo{position:relative; flex:1 1 480px; width:100%; max-width:100%}
        .fmv .combo input,
        .fmv .place-row input,
        .fmv .order-row input{
          width:100%; max-width:100%; height:36px;
          padding:8px 10px; border:1px solid var(--fmv-b); border-radius:8px;
          background:#efe9dc; color:var(--fmv-text); font-size:14px;
        }
        .fmv .place-row,.fmv .order-row{margin-top:8px; width:100%; max-width:100%}
        .fmv .order-row label{display:block; margin-bottom:4px; font-weight:600; color:var(--fmv-text)}
        .fmv .order-hint,.fmv .hint{font-size:12.5px; color:var(--fmv-muted); margin-top:4px; overflow-wrap:anywhere}

        .fmv .ac-list{
          position:absolute; z-index:50; left:0; right:0; max-width:100%; background:#fff;
          border:1px solid var(--fmv-b); border-radius:8px; margin-top:4px; max-height:240px; overflow:auto
        }
        .fmv .ac-item{padding:.45em .65em; cursor:pointer; font-size:14px}
        .fmv .ac-item.active,.fmv .ac-item:hover{background:#f0efe9}
        .fmv .ac-item .muted{color:var(--fmv-muted)}

        .fmv .chips{ max-width:100%; overflow-x:hidden; }
        .fmv .chips .chip{
          display:flex; align-items:center; justify-content:flex-start;
          gap:10px; padding:.45em .6em; background:var(--fmv-chip);
          border:1px solid var(--fmv-b); border-radius:8px; margin:.35em 0; font-size:14px
        }
        .fmv .chip .drag{cursor:grab; margin-right:.4em; color:#8b8378}
        .fmv .chip .name{font-weight:600}

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

        .fmv .chip .mask-input{ display:none; margin-left:auto; }
        .fmv .chip .mask-input.is-open{ display:flex; align-items:center; gap:8px; }
        .fmv .chip .mask-input input{
          flex:1; min-width:220px; height:30px;
          padding:6px 8px; border:1px solid var(--fmv-b); border-radius:6px;
          background:#efe9dc; color:var(--fmv-text);
        }
        .fmv .chip .btn{ border:1px solid var(--fmv-b); border-radius:6px; background:#fff; padding:6px 10px; cursor:pointer; line-height:1; }
        .fmv .chip .btn-ok{ background:#e9f6e9; }
        .fmv .chip .btn-cancel{ background:#f4eeee; }

        .fmv-admin-tools{display:flex;justify-content:flex-end;margin:6px 0 8px}
        .fmv-admin-tools .fmv-toggle{border:1px solid var(--fmv-b);background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}

        /* заголовок блока */
        .fmv .section-title{
          font-weight:700;
          font-size:14px;
          text-align: center;
          line-height:1.25;
          margin:4px 0 12px;
          color: var(--fmv-text);
        }

        /* делаем «колонку» с равным шагом и без внутренних margin */
        .fmv .combo,
        .fmv .place-row,
        .fmv .order-row {
          display: grid;
          grid-template-columns: 1fr;
          row-gap: 8px;             /* вот этим управляем расстоянием между label ↔ input ↔ hint */
        }
        
        .fmv .place-row label,
        .fmv .order-row label,
        .fmv .combo label,
        .fmv .place-row .hint,
        .fmv .order-row .order-hint,
        .fmv .combo .hint {
          margin: 0;                /* убираем наследованные отступы, чтобы они не «схлопывались» */
        }
        
        /* (оставляем общий верхний зазор секции) */
        .fmv .place-row, .fmv .order-row { margin-top: 8px; }

        .fmv .chip .name { font-weight: 600; }
        .fmv .chip .name .name-code { font-weight: 400; color: var(--fmv-muted); }

        `;
        const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
      }

      function attach(opts){
        injectCSS();

        const $form = typeof opts.form === 'string' ? $(opts.form) : opts.form;
        const $area = typeof opts.textarea === 'string' ? $(opts.textarea) : opts.textarea;
        if (!$form?.length || !$area?.length) return null;

        // исходный текст и решение "монтироваться ли"
        const initialRaw = $area.val() || '';
        const hasAnyFMV = /\[FMV(?:cast|place|ord)\][\s\S]*?\[\/FMV(?:cast|place|ord)\]/i.test(initialRaw);
        if (opts.showOnlyIfFMVcast && !hasAnyFMV) return null;

        // мгновенно скрываем мету в textarea (edit)
        if (opts.stripOnMount) {
          $area.val( stripFMV(initialRaw) );
        }

        if ($form.data('fmvBoundUI')) return $form.data('fmvBoundUI');

        // ── UI ──
        const wrapClass='msg-with-characters fmv '+(opts.className||'');
        const $wrap=$('<div/>',{class:wrapClass});
        const $title = $('<div class="section-title">Для автоматического сбора хронологии</div>');

        // поиск/добавление участника
        const $row  = $('<div class="char-row"/>');
        const $combo = $('<div class="combo"/>');
        const $comboLabel = $('<label for="character-combo" style="font-weight:600;display:block;margin-bottom:4px">Участники эпизода:</label>');
        const $comboInput = $('<input type="text" id="character-combo" placeholder="Наберите имя персонажа…" autocomplete="off">');
        const $ac   = $('<div class="ac-list" role="listbox" aria-label="Варианты персонажей"></div>');
        const $comboHint = $('<div class="hint">Если что-то не работает, напишите в Приемную.</div>');
        $combo.append($comboLabel, $comboInput, $ac, $comboHint);
        $row.append($combo);

        const $chips=$('<div class="chips"/>');

        // локация
        const $placeRow   = $('<div class="place-row"/>');
        const $placeLabel = $('<label for="fmv-place" style="font-weight:600">Локация:</label>');
        const $placeInput = $('<input type="text" id="fmv-place" placeholder="Укажите локацию">');
        const $placeHint  = $('<div class="hint">Лучше указывать в едином формате: Хогвартс, Косой переулок, Лютный переулок, Министерство и т.д.</div>');
        $placeRow.append($placeLabel, $placeInput, $placeHint);

        // порядок в день
        const $ordRow   = $('<div class="order-row"/>');
        const $ordLabel = $('<label for="fmv-ord" style="font-weight:600">Для сортировки эпизодов в один день</label>');
        const $ordInput = $('<input type="number" id="fmv-ord" placeholder="0" value="0" step="1">');
        const $ordHint  = $('<div class="order-hint">Помогает упорядочить эпизоды, которые стоят в один день. Чем больше значение, тем позже эпизод. Лучше оставлять 0.</div>');
        $ordRow.append($ordLabel, $ordInput, $ordHint);

        $area.before($wrap);
        $wrap.append($title, $row, $chips, $placeRow, $ordRow);

        let selected=[], knownUsers=[];

        function renderChips(){
          $chips.empty();
          selected.forEach(function(item, idx){
            const $chip=$('<div class="chip" draggable="true" data-idx="'+idx+'"/>');
            $chip.append('<span class="drag" title="Перетащите для изменения порядка">↕</span>');
            
            const $name = $('<span class="name"/>');
            $name.append(document.createTextNode(item.name + ' '));
            $name.append($('<span class="name-code"/>').text('(' + item.code + ')'));
            $chip.append($name);


            const $masks=$('<span class="masks"/>');
            if (item.masks?.length){
              $masks.append('<span class="masks-label">— маски:</span>');
              item.masks.forEach(function(msk,mi){
                const $b=$('<span class="mask-badge" data-mi="'+mi+'"><span class="mask-text"></span><button type="button" class="mask-remove" aria-label="Удалить маску">×</button></span>');
                $b.find('.mask-text').text(msk); $masks.append($b);
              });
            } else { $masks.text(' — масок нет'); }

            const $addMask=$('<button class="add-mask" type="button">добавить маску</button>');
            const $remove =$('<button class="x" type="button" aria-label="Удалить">×</button>');
            const $maskBox=$('<span class="mask-input"></span>').hide();
            const $maskInput=$('<input type="text" placeholder="маска (текст)">');
            const $maskOk  =$('<button type="button" class="btn btn-ok">Ок</button>');
            const $maskCancel=$('<button type="button" class="btn btn-cancel">Отмена</button>');
            $maskBox.append($maskInput,$maskOk,$maskCancel);

            $maskInput.on('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); $maskOk.click(); }});
            $addMask.on('click',()=>{ $chip.find('.mask-input').removeClass('is-open').hide(); $maskBox.addClass('is-open').show(); $maskInput.val('').focus(); });
            $maskOk.on('click',()=>{ const v=$.trim($maskInput.val()); if(!v) return; (item.masks||(item.masks=[])).push(v); renderChips(); });
            $maskCancel.on('click',()=>{ $maskBox.removeClass('is-open').hide(); });

            $remove.on('click',()=>{ selected.splice(idx,1); renderChips(); });

            $chip.append($masks,$addMask,$maskBox,$remove);
            $chips.append($chip);
          });
        }

        // DnD
        $chips.on('dragstart','.chip',function(e){ $(this).addClass('dragging'); e.originalEvent.dataTransfer.setData('text/plain',$(this).data('idx')); });
        $chips.on('dragend','.chip',function(){ $(this).removeClass('dragging'); });
        $chips.on('dragover',function(e){ e.preventDefault(); });
        $chips.on('drop',function(e){
          e.preventDefault();
          const from=+e.originalEvent.dataTransfer.getData('text/plain');
          const $t=$(e.target).closest('.chip'); if(!$t.length) return;
          const to=+$t.data('idx'); if(isNaN(from)||isNaN(to)||from===to) return;
          const it=selected.splice(from,1)[0]; selected.splice(to,0,it); renderChips();
        });
        // удалить одну маску
        $chips.on('click','.mask-remove',function(){
          const $chip=$(this).closest('.chip'); const idx=+$chip.data('idx'); const mi=+$(this).closest('.mask-badge').data('mi');
          if(!isNaN(idx)&&!isNaN(mi)&&Array.isArray(selected[idx].masks)){ selected[idx].masks.splice(mi,1); renderChips(); }
        });

        // добавление участника
        function addByCode(code){
          if(!code || selected.some(x=>x.code===code)) return;
          const u=knownUsers.find(x=>x.code===code);
          selected.push({ code, name:(u?u.name:code), masks:[] });
          renderChips(); $comboInput.val(''); $ac.hide().empty();
        }
        // поиск
        function pickByInput(){
          const q=($.trim($comboInput.val())||'').toLowerCase(); if(!q) return null;
          const pool=knownUsers.filter(u=>!selected.some(x=>x.code===u.code));
          const exact=pool.find(u=>u.name.toLowerCase()===q)||pool.find(u=>u.code.toLowerCase()===q);
          if(exact) return exact.code;
          const list=pool.filter(u=>u.name.toLowerCase().includes(q)||u.code.toLowerCase().includes(q));
          if(list.length===1) return list[0].code;
          const pref=list.filter(u=>u.name.toLowerCase().startsWith(q));
          if(pref.length===1) return pref[0].code;
          return null;
        }
        // автокомплит
        function renderAC(q){
          const qq=(q||'').trim().toLowerCase();
          const items=knownUsers
            .filter(u=>!selected.some(x=>x.code===u.code))
            .filter(u=>!qq || u.name.toLowerCase().includes(qq) || u.code.toLowerCase().includes(qq))
            .slice().sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));
          $ac.empty();
          if(!items.length){ $ac.append('<div class="ac-item"><span class="muted">Ничего не найдено</span></div>').show(); return; }
          items.slice(0,40).forEach(u=>{ $ac.append($('<div class="ac-item" role="option"/>').attr('data-code',u.code).text(u.name+' ('+u.code+')')); });
          $ac.show(); setActive(0);
        }
        function setActive(i){ const $it=$ac.children('.ac-item'); $it.removeClass('active'); if(!$it.length) return; i=(i+$it.length)%$it.length; $it.eq(i).addClass('active'); $ac.data('activeIndex',i); }
        function getActiveCode(){ const i=$ac.data('activeIndex')|0; const $it=$ac.children('.ac-item').eq(i); return $it.data('code'); }
        $comboInput.on('input',function(){ renderAC(this.value); });
        $comboInput.on('keydown',function(e){
          const idx=$ac.data('activeIndex')|0;
          if(e.key==='ArrowDown'&&$ac.is(':visible')){ e.preventDefault(); setActive(idx+1); }
          else if(e.key==='ArrowUp'&&$ac.is(':visible')){ e.preventDefault(); setActive(idx-1); }
          else if(e.key==='Enter'){ e.preventDefault(); const code=$ac.is(':visible')?getActiveCode():pickByInput(); if(code) addByCode(code); else renderAC(this.value); }
          else if(e.key==='Escape'){ $ac.hide(); }
        });
        $ac.on('mousedown','.ac-item',function(){ const code=$(this).data('code'); if(code) addByCode(code); });
        $(document).on('click',function(e){ if(!$(e.target).closest($combo).length) $ac.hide(); });

        // префилл
        function prefillFrom(text){
          selected=[]; const by=parseFMVcast(text||'');
          const mp=String(text||'').match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i);
          if(mp && typeof mp[1]==='string') $placeInput.val(mp[1].trim());
          const mo=String(text||'').match(/\[FMVord\]([\s\S]*?)\[\/FMVord\]/i);
          if(mo && typeof mo[1]==='string'){ let n=parseInt(mo[1].trim(),10); if(Number.isNaN(n)) n=0; $ordInput.val(n); }
          Object.keys(by).forEach(code=>{ const u=knownUsers.find(x=>x.code===code); selected.push({ code, name:(u?u.name:code), masks:by[code].masks }); });
          renderChips();
        }
        function metaLine(){ return [buildFMVcast(selected), buildFMVplace($placeInput.val()), buildFMVord($ordInput.val())].filter(Boolean).join(''); }

        // загрузка участников и префилл
        if (typeof FMV.fetchUsers==='function'){
          FMV.fetchUsers().done(function(list){
            knownUsers=(list||[]).slice();
            if (opts.prefill!==false) prefillFrom(initialRaw);
          }).fail(function(msg){
            $ac.html('<div class="ac-item"><span class="muted">'+(msg||'Ошибка загрузки')+'</span></div>').show();
          });
        }

        // submit-hook (alert вместо блока ошибки; глушим другие обработчики)
        $form.off('submit.fmv.ui').on('submit.fmv.ui', function(e){
          const $subject=$form.find('input[name="req_subject"]');
          const haveSubject=!$subject.length || $.trim($subject.val()||'').length>0;

          const rest=stripFMV($area.val()||'');
          const haveMessage=$.trim(rest).length>0;

          const haveParticipants=selected.length>0;
          const havePlace=$.trim($placeInput.val()||'').length>0;

          if(!(haveSubject && haveMessage && haveParticipants && havePlace)){
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const miss=[]; if(!haveSubject)miss.push('Заголовок'); if(!haveMessage)miss.push('Основной текст'); if(!haveParticipants)miss.push('Участники'); if(!havePlace)miss.push('Локация');
            alert('Заполните: ' + miss.join(', '));
            return false;
          }

          const meta = metaLine();
          let base = rest.replace(/[ \t]+$/, '');
          const sep = (!base || /\n$/.test(base)) ? '' : '\n';
          $area.val(base + sep + meta);
        });

        // ── admin toggle (ручной режим) — создаём один раз и переиспользуем ──
        if (isAllowedAdmin()) {
          // ищем/создаём один общий контейнер для этой формы
          let $tools = $form.data('fmvAdminTools');
          if (!$tools || !$tools.length) {
            $tools = $(
              '<div class="fmv-admin-tools">' +
                '<button type="button" class="fmv-toggle">Режим ручного редактирования</button>' +
              '</div>'
            );
            $form.data('fmvAdminTools', $tools);
          }
          // размещаем кнопку перед текущим $wrap
          $wrap.before($tools);
        
          const $btn = $tools.find('.fmv-toggle');
        
          // важно: каждый раз при новом attach() снимаем старый обработчик
          $btn.off('click.fmv');
        
          const toRaw = () => {
            const meta = [buildFMVcast(selected), buildFMVplace($placeInput.val()), buildFMVord($ordInput.val())]
              .filter(Boolean).join('');
            const base = stripFMV($area.val() || '').replace(/[ \t]+$/, '');
            const sep  = (!base || /\n$/.test(base)) ? '' : '\n';
            $area.val(base + (meta ? sep + meta : ''));
        
            // удаляем только UI и наш сабмит-хук, кнопку НЕ трогаем
            $wrap.remove();
            $form.off('submit.fmv.ui').removeData('fmvBoundUI');
        
            $btn.data('raw', true).text('Вернуться к удобной форме');
          };
        
          const toUI = () => {
            // повторно монтируем UI; внутри attach() этот же блок снова
            // привяжет обработчик к той же кнопке, но уже с новыми замыканиями
            FMV.UI.attach({
              form: $form,
              textarea: $area,
              prefill: true,
              showOnlyIfFMVcast: false,
              className: 'fmv--compact',
              stripOnMount: true
            });
            $btn.data('raw', false).text('Режим ручного редактирования');
          };
        
          // биндим актуальный обработчик для ТЕКУЩЕГО $wrap
          $btn.on('click.fmv', () => ($btn.data('raw') ? toUI() : toRaw()));
        }

        const api={ serialize:()=>[buildFMVcast(selected), buildFMVplace($placeInput.val()), buildFMVord($ordInput.val())].filter(Boolean).join(''),
                    stripFMV, mountPoint:$wrap };
        $form.data('fmvBoundUI',api);
        return api;
      }

      window.FMV.UI = { attach };
    })();
  }

  // ───────────────────── Bootstraps (автоподключение) ─────────────────────
  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  onReady(function(){
    // защита от повторного монтирования
    if (window.__FMV_BOOTSTRAPPED__) return;
    window.__FMV_BOOTSTRAPPED__ = true;

    if (!FMV.UI || typeof FMV.UI.attach !== 'function') return;

    const url  = new URL(location.href);
    const path = url.pathname;
    const q    = url.searchParams;

    function attachToPage({ strip=false, showOnlyIfCast=false } = {}){
      const $form = $('#post form, form[action*="post.php"], form[action*="edit.php"]').first();
      const $area = $form.find('textarea[name="req_message"], #main-reply, .questionary-post textarea').first();
      if (!$form.length || !$area.length) return null;
      return FMV.UI.attach({
        form: $form,
        textarea: $area,
        prefill: true,
        showOnlyIfFMVcast: !!showOnlyIfCast, // ← «любой FMV-тег»
        className: 'fmv--compact',
        stripOnMount: !!strip
      });
    }

    // /post.php?fid=N без action (старое создание)
    if (/\/post\.php$/i.test(path) && !q.has('action')) {
      const fid = +(q.get('fid')||0);
      const allowed = (window.CHRONO_CHECK?.ForumID || []).map(Number);
      if (allowed.includes(fid)) attachToPage({ strip:false, showOnlyIfCast:false });
    }

    // /edit.php?topicpost=1 (редактирование первого поста) — только если есть FMV-теги
    if (/\/edit\.php$/i.test(path) && q.get('topicpost') === '1') {
      attachToPage({ strip:true, showOnlyIfCast:true });
    }

    // /post.php?action=post&fid=8 — создание, UI всегда (с очисткой textarea)
    if (/\/post\.php$/i.test(path) && q.get('action') === 'post') {
      // 🚫 не подключаем UI если открыто «ответить в теме» (есть tid)
      if (q.has('tid')) return;
    
      const fid = Number(q.get('fid'));
      const allowed = (window.CHRONO_CHECK?.ForumID || []).map(Number);
      if (!fid || allowed.includes(fid)) {
        attachToPage({ strip: true, showOnlyIfCast: false });
      }
    }

    // /edit.php?id=N&action=edit — только если есть любые FMV-теги
    if (/\/edit\.php$/i.test(path) && q.get('action') === 'edit' && q.has('id')) {
      attachToPage({ strip:true, showOnlyIfCast:true });
    }
  });

})();
