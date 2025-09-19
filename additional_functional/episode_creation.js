(function(){
  try{
    if (window.__FMV_SCRIPT_INIT__) return; window.__FMV_SCRIPT_INIT__=true;

    // только постинг в fid=8|9
    if (!/\/post\.php(\?|$)/.test(location.pathname)) return;
    var fid=+(new URLSearchParams(location.search).get('fid')||0);
    if ([8,9].indexOf(fid)===-1) return;

    var $form=$('#post form, form[action*="post.php"]').first(); if(!$form.length) return;
    if ($form.data('fmvBound')) return; $form.data('fmvBound', true);

    var $area=$form.find('textarea[name="req_message"], #main-reply, .questionary-post textarea').first();
    if(!$area.length) return;
    if ($('#main-reply').length===0) $area.attr('id','main-reply');

    $form.find('.msg-with-characters').remove();

    // кеш участников
    var CACHE_KEY='fmv_participants_cache_v12', TTL=30*60*1000;
    function readCache(){try{var r=sessionStorage.getItem(CACHE_KEY);if(!r)return null;var o=JSON.parse(r);return(Date.now()-o.time>TTL)?null:o.data}catch(e){return null}}
    function writeCache(list){try{sessionStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(),data:list}))}catch(e){}}

    // парсинг userlist
    function extractUsersFromHTML(html){
      var $doc=$('<div/>').html(html);
      var users=$doc.find('a[href*="profile.php?id="]').map(function(){
        var a=$(this)[0], name=$(this).text().trim(), m=a.href.match(/profile\.php\?id=(\d+)/);
        if(!m) return null; return {id:+m[1], code:'user'+m[1], name:name};
      }).get().filter(Boolean);
      var pages=$doc.find('a[href*="userlist.php"]').map(function(){
        var u=new URL($(this)[0].href,location.origin); return +(u.searchParams.get('p')||0);
      }).get();
      var last=Math.max(1,...pages,1);
      var any=$doc.find('a[href*="userlist.php"]').first().attr('href')||'userlist.php';
      return {users:users,last:last,base:new URL(any,location.origin)};
    }
    function urlForPage(base,p){var u=new URL(base,location.origin); if(p>1)u.searchParams.set('p',p); else u.searchParams.delete('p'); return u.pathname+(u.search||'');}
    function uniqSort(arr){var map={};arr.forEach(u=>map[u.code]=u);return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'})});}
    function fetchUsers(){
      var c=readCache(); if(c) return $.Deferred().resolve(c).promise();
      var d=$.Deferred();
      $.get('/userlist.php').done(function(h1){
        var first=extractUsersFromHTML(h1), all=[].concat(first.users);
        var MAX=Math.min(first.last,50), B=5, tasks=[]; for(var p=2;p<=MAX;p++) tasks.push(p);
        function step(p){return $.get(urlForPage(first.base,p)).then(h=>{all=all.concat(extractUsersFromHTML(h).users)})}
        (function run(i){
          if(i>=tasks.length){var list=uniqSort(all); writeCache(list); d.resolve(list); return;}
          $.when.apply($,tasks.slice(i,i+B).map(step)).always(()=>run(i+B));
        })(0);
      }).fail(()=>d.reject('Не удалось загрузить список участников'));
      return d.promise();
    }

    // UI
    var $wrap=$('<div class="msg-with-characters"/>');
    var $row=$('<div class="char-row"/>');
    var $combo=$('<div class="combo"/>');
    var $comboInput=$('<input type="text" id="character-combo" placeholder="Наберите имя персонажа…" autocomplete="off">');
    var $ac=$('<div class="ac-list" role="listbox" aria-label="Варианты персонажей"></div>');
    $combo.append($comboInput,$ac); $row.append($combo);

    var $placeRow=$('<div class="place-row"/>');
    var $placeLabel=$('<label for="fmv-place" style="font-weight:600">Локация:</label>');
    var $placeInput=$('<input type="text" id="fmv-place" placeholder="Укажите локацию">');
    $placeRow.append($placeLabel,$placeInput);

    var $chips=$('<div class="chips"/>');
    var $hint=$('<div class="hint">Добавьте одного или нескольких персонажей; у каждого могут быть маски. Локация обязательна. Маски: Enter=Ок.</div>');
    var $err=$('<div class="error" style="display:none"></div>');

    $area.before($wrap);
    $wrap.append($row,$placeRow,$chips,$hint,$err,$area);

    // state
    var selected=[], knownUsers=[];

    // chips + DnD
    function renderChips(){
      $chips.empty();
      selected.forEach(function(item, idx){
        var $chip=$('<div class="chip" draggable="true" data-idx="'+idx+'"/>');
        var $drag=$('<span class="drag" title="Перетащите для изменения порядка">↕</span>');
        var $name=$('<span class="name"/>').text(item.name+' ('+item.code+')');
        var masksText=item.masks&&item.masks.length?'маски: '+item.masks.join(', '):'масок нет';
        var $masks=$('<span class="masks"/>').text(' — '+masksText);
        var $addMask=$('<button class="add-mask" type="button">добавить маску</button>');
        var $remove=$('<button class="x" type="button" aria-label="Удалить">×</button>');

        var $maskBox=$('<span class="mask-input"></span>');
        var $maskInput=$('<input type="text" placeholder="маска (текст)">');
        var $maskOk=$('<button type="button">Ок</button>');
        var $maskCancel=$('<button type="button">Отмена</button>');
        $maskBox.append($maskInput,$maskOk,$maskCancel);

        $maskInput.on('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); $maskOk.click(); }});
        $addMask.on('click', function(){ $maskBox.show(); $maskInput.val('').focus(); });
        $maskOk.on('click', function(){ var v=$.trim($maskInput.val()); if(!v) return; (item.masks||(item.masks=[])).push(v); renderChips(); });
        $maskCancel.on('click', function(){ $maskBox.hide(); });
        $remove.on('click', function(){ selected.splice(idx,1); renderChips(); });

        $chip.append($drag,$name,$masks,$addMask,$remove,$maskBox);
        $chips.append($chip);
      });
    }
    $chips.on('dragstart','.chip',function(e){$(this).addClass('dragging');e.originalEvent.dataTransfer.setData('text/plain',$(this).data('idx'));});
    $chips.on('dragend','.chip',function(){$(this).removeClass('dragging');});
    $chips.on('dragover',function(e){e.preventDefault();});
    $chips.on('drop',function(e){
      e.preventDefault(); var from=+e.originalEvent.dataTransfer.getData('text/plain');
      var $t=$(e.target).closest('.chip'); if(!$t.length) return; var to=+$t.data('idx');
      if(isNaN(from)||isNaN(to)||from===to) return; var it=selected.splice(from,1)[0]; selected.splice(to,0,it); renderChips();
    });

    // добавление персонажа
    function addByCode(code){
      if(!code) return;
      if(selected.some(function(x){return x.code===code})) return;
      var u=knownUsers.find(function(x){return x.code===code}); 
      selected.push({code:code,name:(u?u.name:code),masks:[]});
      renderChips(); $comboInput.val(''); $ac.hide().empty();
    }

    // логика подбора по введённой строке
    function pickByInput(){
      var q=($comboInput.val()||'').trim(); if(!q) return null;
      var qq=q.toLowerCase();
      var pool=knownUsers.filter(function(u){return !selected.some(function(x){return x.code===u.code});});
      var exact=pool.find(function(u){return u.name.toLowerCase()===qq}) || pool.find(function(u){return u.code.toLowerCase()===qq});
      if(exact) return exact.code;
      var list=pool.filter(function(u){return u.name.toLowerCase().indexOf(qq)!==-1 || u.code.toLowerCase().indexOf(qq)!==-1});
      if(list.length===1) return list[0].code;
      var prefix=list.filter(function(u){return u.name.toLowerCase().startsWith(qq)}); 
      if(prefix.length===1) return prefix[0].code;
      return null;
    }

    // автодополнение
    function renderAC(q){
      var qq=(q||'').trim().toLowerCase();
      var items=knownUsers
        .filter(function(u){return !selected.some(function(x){return x.code===u.code});})
        .filter(function(u){return !qq || u.name.toLowerCase().indexOf(qq)!==-1 || u.code.toLowerCase().indexOf(qq)!==-1;})
        .slice().sort(function(a,b){return a.name.localeCompare(b.name,'ru',{sensitivity:'base'})});
      $ac.empty();
      if(!items.length){ $ac.append('<div class="ac-item"><span class="muted">Ничего не найдено</span></div>').show(); return; }
      items.slice(0,40).forEach(function(u){
        $ac.append($('<div class="ac-item" role="option"/>').attr('data-code',u.code).text(u.name+' ('+u.code+')'));
      });
      $ac.show(); setActive(0);
    }
    function setActive(i){var $it=$ac.children('.ac-item');$it.removeClass('active');if(!$it.length)return;i=(i+$it.length)%$it.length;$it.eq(i).addClass('active');$ac.data('activeIndex',i);}
    function getActiveCode(){var i=$ac.data('activeIndex')|0;var $it=$ac.children('.ac-item').eq(i);return $it.data('code');}

    $comboInput.on('input', function(){ renderAC(this.value); });
    $comboInput.on('keydown', function(e){
      var idx=$ac.data('activeIndex')|0;
      if(e.key==='ArrowDown'&&$ac.is(':visible')){e.preventDefault();setActive(idx+1);}
      else if(e.key==='ArrowUp'&&$ac.is(':visible')){e.preventDefault();setActive(idx-1);}
      else if(e.key==='Enter'){
        e.preventDefault();
        var code=$ac.is(':visible')?getActiveCode():pickByInput();
        if(code) addByCode(code); else renderAC(this.value);
      } else if(e.key==='Escape'){ $ac.hide(); }
    });
    $ac.on('mousedown','.ac-item',function(e){ var code=$(this).data('code'); if(code) addByCode(code); });
    $ac.on('click','.ac-item',function(e){ var code=$(this).data('code'); if(code) addByCode(code); });
    $(document).on('click',function(e){ if(!$(e.target).closest($combo).length) $ac.hide(); });

    // загрузка участников
    fetchUsers().done(function(list){
      knownUsers=list.slice().sort(function(a,b){return a.name.localeCompare(b.name,'ru',{sensitivity:'base'})});
      prefillFromTextarea($area.val()||''); renderChips();
      if(window.FMV && window.FMV.log) window.FMV.log('users_loaded', knownUsers.length);
    }).fail(function(msg){
      $ac.html('<div class="ac-item"><span class="muted">'+(msg||'Ошибка загрузки')+'</span></div>').show();
    });

    // ───────────────────── сериализация/парсинг — ТОЛЬКО FMVcast ─────────────────────
    function castStr(){
      if (!selected.length) return '';
      var parts = [];
      selected.forEach(function(item){
        var masks = Array.isArray(item.masks) ? item.masks.filter(Boolean) : [];
        if (masks.length === 0) {
          parts.push(item.code);                 // без маски → userN
        } else {
          masks.forEach(function(msk){           // с масками → userN=mask1; userN=mask2; ...
            parts.push(item.code + '=' + msk);
          });
        }
      });
      return parts.length ? '[FMVcast]' + parts.join(';') + '[/FMVcast]' : '';
    }

    function placeStr(){var v=($placeInput.val()||'').trim();return v?'[FMVplace]'+v+'[/FMVplace]':'';}

    function stripFMV(text){
      return (text||'')
        .replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig,'')
        .replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig,'')
        .replace(/^\s+|\s+$/g,'');
    }

    function metaLine(){
      return [castStr(), placeStr()].filter(Boolean).join('');
    }

    // префилл только из FMVcast/FMВplace
    function prefillFromTextarea(text){
      selected = [];
      text = text || '';

      var mc = text.match(/\[FMVcast\]([\s\S]*?)\[\/FMVcast\]/i);
      var items = [];
      if (mc && typeof mc[1] === 'string') {
        items = mc[1].split(';').map(function(s){ return s.trim(); }).filter(Boolean);
      }

      var byCode = {};
      items.forEach(function(tok){
        var m = tok.match(/^(user\d+)(?:=(.+))?$/i);
        if (!m) return;
        var code = m[1], mask = (m[2]||'').trim();
        var obj = byCode[code] || (byCode[code] = { code: code, name: code, masks: [] });
        if (mask) obj.masks.push(mask);
      });

      var mp = text.match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i);
      if (mp && typeof mp[1] === 'string') $placeInput.val(mp[1].trim());

      Object.keys(byCode).forEach(function(code){
        var u = knownUsers.find(function(x){ return x.code === code; });
        var entry = byCode[code];
        selected.push({ code: code, name: (u ? u.name : code), masks: entry.masks });
      });
    }

    // какая кнопка нажата
    var lastSubmitter=null;
    $form.on('click.fmv','input[type=submit],button[type=submit]',function(){ lastSubmitter=this; });

    // submit: вставляем мету ТОЛЬКО если можно отправить
    $form.off('submit.fmv').on('submit.fmv', function(e){
      if (lastSubmitter && (/preview/i.test(lastSubmitter.name) || /предпрос/i.test(lastSubmitter.value||''))) {
        lastSubmitter=null; return;
      }
      if(!selected.length){ var pick=pickByInput(); if(pick) addByCode(pick); }

      var placeOk=($placeInput.val()||'').trim().length>0;
      if(!selected.length || !placeOk){
        e.preventDefault();
        var msg=!selected.length && !placeOk ? 'Выберите хотя бы одного персонажа и укажите локацию'
                 : (!selected.length ? 'Выберите хотя бы одного персонажа' : 'Укажите локацию');
        $err.text(msg).show(); setTimeout(function(){ $err.fadeOut(400); }, 2000);
        if(!selected.length) $comboInput.focus(); else $placeInput.focus();
        lastSubmitter=null; return;
      }

      var $subject=$form.find('input[name="req_subject"]');
      var subjectOk=!$subject.length || ($subject.val()||'').trim().length>0;
      var messageOk=($area.val()||'').trim().length>0;
      if(!subjectOk || !messageOk){ lastSubmitter=null; return; }

      var meta=metaLine();
      var plain=stripFMV($area.val()).replace(/^\n+/, '');
      $area.val(meta+plain);
      lastSubmitter=null;
    });

    // мини-диагностика
    window.FMV = {
      diag: function(){
        console.log('[FMV diag]', {
          users_loaded: knownUsers.length,
          selected: selected.map(function(x){return x.code}),
          place: $placeInput.val(),
          has_subject: !!$form.find('input[name="req_subject"]').length,
          subject_val: ($form.find('input[name="req_subject"]').val()||'').trim(),
          message_len: ($area.val()||'').length
        });
      },
      log: function(){ try{ console.log.apply(console, arguments);}catch(e){} }
    };

  }catch(err){
    console.error('FMV fatal error:', err);
  }
})();
