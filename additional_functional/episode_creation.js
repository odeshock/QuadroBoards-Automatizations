(function(){
  /* ======= защита от двойной инициализации на странице ======= */
  if (window.__FMV_SCRIPT_INIT__) return; window.__FMV_SCRIPT_INIT__=true;

  /* ======= таргетинг: только post.php?fid=8|9 ======= */
  if (!/\/post\.php(\?|$)/.test(location.pathname)) return;
  var fid = +(new URLSearchParams(location.search).get('fid')||0);
  if ([8,9].indexOf(fid)===-1) return;

  /* ======= получаем форму и textarea ======= */
  var $form = $('#post form, form[action*="post.php"]').first();
  if (!$form.length) return;
  if ($form.data('fmvBound')) return; $form.data('fmvBound', true);
  var $area = $form.find('textarea[name="req_message"], textarea#main-reply, .questionary-post textarea').first();
  if (!$area.length) return;

  /* на всякий случай уберём старый UI (если был) */
  $form.find('.msg-with-characters').remove();

  /* ======= кэш участников (30 мин) ======= */
  var CACHE_KEY='fmv_participants_cache_v6', TTL_MS=30*60*1000;
  function readCache(){try{var r=sessionStorage.getItem(CACHE_KEY);if(!r)return null;var o=JSON.parse(r);return(Date.now()-o.time>TTL_MS)?null:o.data}catch(e){return null}}
  function writeCache(list){try{sessionStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(),data:list}))}catch(e){}}

  /* ======= парсинг /userlist.php + пагинация ======= */
  function extractUsersFromHTML(html){
    var $doc=$('<div/>').html(html);
    var users=$doc.find('a[href*="profile.php?id="]').map(function(){
      var a=$(this)[0], name=$(this).text().trim();
      var m=a && a.href && a.href.match(/profile\.php\?id=(\d+)/);
      if(!m) return null;
      var id=m[1], code='user'+id;
      return {id:+id, code:code, name:name};
    }).get().filter(Boolean);

    var pages=$doc.find('a[href*="userlist.php"]').map(function(){
      var u=new URL($(this)[0].href, location.origin);
      return +(u.searchParams.get('p')||0);
    }).get();
    var lastPage=Math.max(1,...pages,1);
    var any=$doc.find('a[href*="userlist.php"]').first().attr('href')||'userlist.php';
    var base=new URL(any, location.origin);
    return {users:users, lastPage:lastPage, base:base};
  }
  function urlForPage(base,page){
    var u=new URL(base, location.origin);
    if(page>1) u.searchParams.set('p',page); else u.searchParams.delete('p');
    return u.pathname+(u.search||'');
  }
  function dedupeSort(arr){
    var map={}; arr.forEach(function(u){ map[u.code]=u; });
    return Object.values(map).sort(function(a,b){ return a.name.localeCompare(b.name,'ru',{sensitivity:'base'}) });
  }
  function fetchAllParticipants(){
    var c=readCache(); if(c) return $.Deferred().resolve(c).promise();
    var dfd=$.Deferred();
    $.get('/userlist.php').done(function(h1){
      var first=extractUsersFromHTML(h1), all=[].concat(first.users);
      var MAX_PAGES=Math.min(first.lastPage,50), batch=5, tasks=[];
      for(var p=2;p<=MAX_PAGES;p++) tasks.push(p);
      function fetchPage(p){return $.get(urlForPage(first.base,p)).then(function(h){all=all.concat(extractUsersFromHTML(h).users)})}
      (function run(i){
        if(i>=tasks.length){ var list=dedupeSort(all); writeCache(list); dfd.resolve(list); return; }
        var slice=tasks.slice(i,i+batch).map(fetchPage);
        $.when.apply($,slice).always(function(){run(i+batch)});
      })(0);
    }).fail(function(){ dfd.reject('Не удалось загрузить список участников'); });
    return dfd.promise();
  }

  /* ======= UI ======= */
  var $wrap=$('<div class="msg-with-characters"/>');

  // Комбобокс вместо select
  var $row=$('<div class="char-row"/>');
  var $combo=$('<div class="combo"/>');
  var $comboInput=$('<input type="text" id="character-combo" placeholder="Наберите имя персонажа…" autocomplete="off">');
  var $ac=$('<div class="ac-list" role="listbox" aria-label="Варианты персонажей"></div>');
  $combo.append($comboInput,$ac); $row.append($combo);

  // Локация (обязательная)
  var $placeRow=$('<div class="place-row"/>');
  var $placeLabel=$('<label for="fmv-place" style="font-weight:600">Локация:</label>');
  var $placeInput=$('<input type="text" id="fmv-place" placeholder="Укажите локацию" required>');
  $placeRow.append($placeLabel,$placeInput);

  // Выбранные персонажи (в столбик)
  var $chips=$('<div class="chips"/>');
  var $hint=$('<div class="hint">Добавьте одного или нескольких персонажей; у каждого могут быть маски. Локация обязательна. Маски можно вводить и нажимать Enter.</div>');
  var $err=$('<div class="error" style="display:none"></div>');

  // Вставляем перед textarea
  $area.before($wrap);
  $wrap.append($row,$placeRow,$chips,$hint,$err,$area);

  /* ======= состояние ======= */
  // элемент: {code:'user4', name:'Имя', masks:['m1','m2']}
  var selected=[], knownUsers=[];

  /* ======= рендер чипсов + drag&drop ======= */
  function renderChips(){
    $chips.empty();
    selected.forEach(function(item, idx){
      var $chip=$('<div class="chip" draggable="true" data-idx="'+idx+'"/>');
      var $drag=$('<span class="drag" title="Перетащите для изменения порядка">↕</span>');
      var $name=$('<span class="name"/>').text(item.name+' ('+item.code+')');
      var masksText = item.masks && item.masks.length ? 'маски: '+item.masks.join(', ') : 'масок нет';
      var $masks=$('<span class="masks"/>').text(' — '+masksText);
      var $addMask=$('<button class="add-mask" type="button">добавить маску</button>');
      var $remove=$('<button class="x" type="button" aria-label="Удалить">×</button>');

      var $maskBox=$('<span class="mask-input"></span>');
      var $maskInput=$('<input type="text" placeholder="маска (текст)">');
      var $maskOk=$('<button type="button">Ок</button>');
      var $maskCancel=$('<button type="button">Отмена</button>');
      $maskBox.append($maskInput,$maskOk,$maskCancel);

      // Enter = Ок
      $maskInput.on('keydown', function(e){
        if(e.key==='Enter'){ e.preventDefault(); $maskOk.click(); }
      });

      $addMask.on('click', function(){ $maskBox.show(); $maskInput.val('').focus(); });
      $maskOk.on('click', function(){
        var v=$.trim($maskInput.val());
        if(!v) return;
        if(!item.masks) item.masks=[];
        item.masks.push(v);
        renderChips();
      });
      $maskCancel.on('click', function(){ $maskBox.hide(); });

      $remove.on('click', function(){ selected.splice(idx,1); renderChips(); });

      // DnD порядок
      $chip.on('dragstart', function(e){ $(this).addClass('dragging'); e.originalEvent.dataTransfer.setData('text/plain', idx.toString()); });
      $chip.on('dragend', function(){ $(this).removeClass('dragging'); });
      $chips.on('dragover', function(e){ e.preventDefault(); });
      $chips.on('drop', function(e){
        e.preventDefault();
        var from = +e.originalEvent.dataTransfer.getData('text/plain');
        var $target = $(e.target).closest('.chip');
        if(!$target.length) return;
        var to = +$target.data('idx');
        if (isNaN(from) || isNaN(to) || from===to) return;
        var itemFrom = selected.splice(from,1)[0];
        selected.splice(to,0,itemFrom);
        renderChips();
      });

      $chip.append($drag,$name,$masks,$addMask,$remove,$maskBox);
      $chips.append($chip);
    });
  }

  /* ======= добавление персонажа по коду ======= */
  function addCharacterByCode(code){
    if (!code) return;
    if (selected.some(function(x){return x.code===code})) return;
    var u = knownUsers.find(function(x){return x.code===code});
    var name = u ? u.name : code;
    selected.push({code:code, name:name, masks:[]});
    renderChips();
    $comboInput.val('');
    $ac.hide().empty();
  }

  /* ======= автодополнение ======= */
  function renderAC(q){
    var qq=(q||'').trim().toLowerCase();
    var items=knownUsers
      .filter(function(u){ return !selected.some(function(x){return x.code===u.code}); })
      .filter(function(u){ return !qq || u.name.toLowerCase().indexOf(qq)!==-1; })
      .slice().sort(function(a,b){ return a.name.localeCompare(b.name,'ru',{sensitivity:'base'}) });

    $ac.empty();
    if(!items.length){ $ac.append('<div class="ac-item"><span class="muted">Ничего не найдено</span></div>').show(); return; }
    items.slice(0,30).forEach(function(u){
      var $it=$('<div class="ac-item" role="option"/>').attr('data-code',u.code).text(u.name+' ('+u.code+')');
      $ac.append($it);
    });
    $ac.show(); setActive(0);
  }
  function setActive(idx){
    var $items=$ac.children('.ac-item'); $items.removeClass('active');
    if(!$items.length) return;
    idx=(idx+$items.length)%$items.length;
    $items.eq(idx).addClass('active'); $ac.data('activeIndex',idx);
  }
  function getActiveCode(){
    var idx=$ac.data('activeIndex')|0; var $it=$ac.children('.ac-item').eq(idx);
    return $it.data('code');
  }

  $comboInput.on('input', function(){ renderAC(this.value); });
  $comboInput.on('keydown', function(e){
    if(!$ac.is(':visible')) return;
    var idx=$ac.data('activeIndex')|0;
    if(e.key==='ArrowDown'){ e.preventDefault(); setActive(idx+1); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); setActive(idx-1); }
    else if(e.key==='Enter'){ e.preventDefault(); var code=getActiveCode(); if(code) addCharacterByCode(code); }
    else if(e.key==='Escape'){ $ac.hide(); }
  });
  $ac.on('mousedown', '.ac-item', function(){ var code=$(this).data('code'); if(code) addCharacterByCode(code); });
  $(document).on('click', function(e){ if(!$(e.target).closest($combo).length) $ac.hide(); });

  /* ======= загрузка участников и префилл ======= */
  fetchAllParticipants().done(function(list){
    knownUsers=list.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'ru',{sensitivity:'base'}) });
    prefillFromTextarea($area.val()||'');
    renderChips();
  }).fail(function(msg){
    // покажем в комбобоксе ошибку
    $ac.html('<div class="ac-item"><span class="muted">'+(msg||'Ошибка загрузки')+'</span></div>').show();
  });

  /* ======= сериализация FMV (одной строкой, без переводов) ======= */
  function buildFMVCast(){
    if(!selected.length) return '';
    var codes = selected.map(function(i){ return i.code; }).join(';');
    return '[FMVcast]'+codes+'[/FMVcast]';
  }
  function buildFMVMask(){
    var pairs=[];
    selected.forEach(function(i){ (i.masks||[]).forEach(function(m){ pairs.push(i.code+'='+m); }); });
    return pairs.length ? '[FMVmask]'+pairs.join(';')+'[/FMVmask]' : '';
  }
  function buildFMVPlace(){
    var v = ($placeInput.val()||'').trim();
    return v ? '[FMVplace]'+v+'[/FMVplace]' : '';
  }
  function stripOldFMV(text){
    return (text||'')
      .replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig,'')
      .replace(/\[FMVmask\][\s\S]*?\[\/FMVmask\]/ig,'')
      .replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig,'')
      .replace(/^\s+|\s+$/g,'');
  }
  function buildMetaLine(){
    // строго подряд, БЕЗ переносов и пробелов
    var parts=[buildFMVCast(), buildFMVMask(), buildFMVPlace()].filter(Boolean);
    return parts.join('');
  }

  /* ======= обратный парсинг при редактировании ======= */
  function prefillFromTextarea(text){
    var mc=text.match(/\[FMVcast\]([\s\S]*?)\[\/FMVcast\]/i);
    var codes = (mc && mc[1]) ? mc[1].split(';').map(function(s){return s.trim()}).filter(Boolean) : [];

    var mm=text.match(/\[FMVmask\]([\s\S]*?)\[\/FMVmask\]/i);
    var maskPairs={};
    if(mm && mm[1]){
      mm[1].split(';').forEach(function(pair){
        var i=pair.indexOf('=');
        if(i<=0) return;
        var code=pair.slice(0,i).trim();
        var val=pair.slice(i+1).trim();
        if(!code||!val) return;
        if(!maskPairs[code]) maskPairs[code]=[];
        maskPairs[code].push(val);
      });
    }

    var mp=text.match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i);
    if(mp && typeof mp[1]==='string'){ $placeInput.val(mp[1].trim()); }

    codes.forEach(function(code){
      if (selected.some(function(x){return x.code===code})) return;
      var u = knownUsers.find(function(x){return x.code===code});
      var name = u ? u.name : code;
      selected.push({code:code, name:name, masks:(maskPairs[code]||[])});
    });
    Object.keys(maskPairs).forEach(function(code){
      if (selected.some(function(x){return x.code===code})) return;
      var u = knownUsers.find(function(x){return x.code===code});
      var name = u ? u.name : code;
      selected.push({code:code, name:name, masks:maskPairs[code]});
    });
  }

  /* ======= предпросмотр: не менять textarea ======= */
  var isPreview=false;
  $form.find('input[name="preview"], button[name="preview"]').on('click', function(){ isPreview=true; });

  /* ======= submit: валидируем и пишем в textarea БЕЗ перевода строки ======= */
  $form.off('submit.fmv').on('submit.fmv', function(){
    if (isPreview) { isPreview=false; return true; }

    // Требования: хотя бы 1 персонаж и непустая локация
    var placeOk = ($placeInput.val()||'').trim().length>0;
    if(!selected.length || !placeOk){
      var msg = !selected.length && !placeOk
        ? 'Выберите хотя бы одного персонажа и укажите локацию'
        : (!selected.length ? 'Выберите хотя бы одного персонажа' : 'Укажите локацию');
      $err.text(msg).show(); setTimeout(function(){ $err.fadeOut(400); }, 2000);
      if(!placeOk){ $placeInput[0].reportValidity && $placeInput[0].reportValidity(); $placeInput.focus(); }
      return false;
    }

    // Базовые поля формы не пустые — иначе не трогаем textarea
    var $subject=$form.find('input[name="req_subject"]');
    var subjectOk=!$subject.length || ($subject.val()||'').trim().length>0;
    var messageOk=($area.val()||'').trim().length>0;
    if(!subjectOk || !messageOk) return true;

    var metaLine=buildMetaLine();
    var plain=stripOldFMV($area.val()).replace(/^\n+/, '');
    $area.val(metaLine + plain); // одна строка меты + сразу текст, без \n между ними
    return true;
  });

  /* ======= направляем BB-кнопки в нашу textarea ======= */
  $area.on('focus', function(){
    $('.questionary-post textarea').removeAttr('id');
    if(this.id!=='main-reply') this.id='main-reply';
  }).on('blur', function(){
    if($(this).is($area)) $(this).removeAttr('id');
  });
})();
