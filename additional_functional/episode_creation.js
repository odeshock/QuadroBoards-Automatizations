(function(){
  // защита от двойной инициализации
  if (window.__FMV_SCRIPT_INIT__) return; window.__FMV_SCRIPT_INIT__=true;

  // --- таргетинг: только post.php?fid=8|9 ---
  if (!/\/post\.php(\?|$)/.test(location.pathname)) return;
  var fid = +(new URLSearchParams(location.search).get('fid')||0);
  if ([8,9].indexOf(fid)===-1) return;

  // --- форма и textarea ---
  var $form = $('#post form, form[action*="post.php"]').first();
  if (!$form.length) return;
  if ($form.data('fmvBound')) return; $form.data('fmvBound', true);
  var $area = $form.find('textarea[name="req_message"], textarea#main-reply, .questionary-post textarea').first();
  if (!$area.length) return;

  // --- кэш участников (30 мин) ---
  var CACHE_KEY='fmv_participants_cache_v5', TTL_MS=30*60*1000;
  function readCache(){try{var r=sessionStorage.getItem(CACHE_KEY);if(!r)return null;var o=JSON.parse(r);return(Date.now()-o.time>TTL_MS)?null:o.data}catch(e){return null}}
  function writeCache(list){try{sessionStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(),data:list}))}catch(e){}}

  // --- парсинг userlist + пагинация ---
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
    // сортируем по имени (ru, case-insensitive)
    return Object.values(map).sort(function(a,b){ return a.name.localeCompare(b.name,'ru',{sensitivity:'base'}) });
  }
  function fetchAllParticipants(){
    var c=readCache(); if(c) return $.Deferred().resolve(c).promise();
    var dfd=$.Deferred();
    $.get('/userlist.php').done(function(h1){
      var first=extractUsersFromHTML(h1), all=[].concat(first.users);
      var MAX_PAGES=Math.min(first.lastPage,50), batchSize=5, tasks=[];
      for(var p=2;p<=MAX_PAGES;p++) tasks.push(p);
      function fetchPage(p){return $.get(urlForPage(first.base,p)).then(function(h){all=all.concat(extractUsersFromHTML(h).users)})}
      (function run(i){
        if(i>=tasks.length){ var list=dedupeSort(all); writeCache(list); dfd.resolve(list); return; }
        var batch=tasks.slice(i,i+batchSize).map(fetchPage);
        $.when.apply($,batch).always(function(){run(i+batchSize)});
      })(0);
    }).fail(function(){ dfd.reject('Не удалось загрузить список участников'); });
    return dfd.promise();
  }

  // --- UI: поиск + селект + кнопка + Локация + список (в столбик) ---
  var $wrap=$('<div class="msg-with-characters"/>');

  var $row=$('<div class="char-row"/>');
  var $search=$('<input class="search" type="text" placeholder="Поиск персонажа…">');
  var $select=$('<select/>',{id:'character-select','aria-label':'Выберите персонажа'});
  var $addBtn=$('<button type="button">Добавить персонажа</button>');

  var $placeRow=$('<div class="place-row"/>');
  var $placeLabel=$('<label for="fmv-place" style="font-weight:600">Локация:</label>');
  var $placeInput=$('<input type="text" id="fmv-place" placeholder="Укажите локацию" required>'); // required

  var $chips=$('<div class="chips"/>');
  var $hint=$('<div class="hint">Добавьте одного или нескольких персонажей; у каждого могут быть маски. Локация пишется в [FMVplace].</div>');
  var $err=$('<div class="error" style="display:none"></div>');

  $select.append($('<option/>',{value:'',text:'— Персонаж —',disabled:true,selected:true}));
  var $loadingOpt=$('<option/>',{value:'',text:'Загружается список…',disabled:true});
  $select.append($loadingOpt);

  $area.before($wrap);
  $row.append($search,$select,$addBtn);
  $placeRow.append($placeLabel,$placeInput);
  $wrap.append($row,$placeRow,$chips,$hint,$err,$area);

  // --- состояние выбранных ---
  // элемент: {code:'user4', name:'Имя', masks:['m1','m2']}
  var selected=[], knownUsers=[];

  // --- рендер в столбик + drag&drop ---
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

      // Enter как ОК
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

      // DnD
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
        // переставим
        var itemFrom = selected.splice(from,1)[0];
        selected.splice(to,0,itemFrom);
        renderChips();
      });

      $chip.append($drag,$name,$masks,$addMask,$remove,$maskBox);
      $chips.append($chip);
    });
  }

  // --- добавление из селекта ---
  $addBtn.on('click', function(){
    var v=$select.val();
    if(!v){ $select[0].reportValidity && $select[0].reportValidity(); return; }
    var $opt=$select.find('option[value="'+v.replace(/"/g,'\\"')+'"]');
    var name=$opt.data('name') || $opt.text();
    if (selected.some(function(x){return x.code===v})) return;
    selected.push({code:v, name:name, masks:[]});
    renderChips();
    $select.val('');
  });

  // --- загрузка участников ---
  var originalOptions=[]; // для фильтра
  fetchAllParticipants().done(function(list){
    knownUsers=list;
    $loadingOpt.remove();
    list.forEach(function(u){
      var $o=$('<option/>',{value:u.code,text:u.name});
      $o.attr('data-name',u.name);
      $select.append($o);
    });
    originalOptions = $select.find('option').clone();
    // префилл из textarea
    prefillFromTextarea($area.val()||'');
    renderChips();
  }).fail(function(msg){ $loadingOpt.text(msg||'Ошибка загрузки'); });

  // --- поиск по селекту ---
  $search.on('input', function(){
    var q = $(this).val().toLowerCase();
    var $keep = originalOptions.filter(function(){
      var t = ($(this).text()||'').toLowerCase();
      return !q || t.indexOf(q)!==-1 || $(this).val()==='';
    });
    $select.empty().append($keep.clone());
  });

  // --- сериализация FMV в одну строку ---
  function buildFMVCast(){ // [FMVcast]user4;user2[/FMVcast]
    if(!selected.length) return '';
    var codes = selected.map(function(i){ return i.code; }).join(';');
    return '[FMVcast]'+codes+'[/FMVcast]';
  }
  function buildFMVMask(){ // [FMVmask]user4=mask1;user4=mask2;user2=mask3[/FMVmask]
    var pairs=[];
    selected.forEach(function(i){ (i.masks||[]).forEach(function(m){ pairs.push(i.code+'='+m); }); });
    return pairs.length ? '[FMVmask]'+pairs.join(';')+'[/FMVmask]' : '';
  }
  function buildFMVPlace(){ // [FMVplace]ответ[/FMVplace]
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
    // строго подряд, БЕЗ переводов и пробелов
    var parts = [buildFMVCast(), buildFMVMask(), buildFMVPlace()].filter(Boolean);
    return parts.join('');
  }

  // --- обратный парсинг при редактировании ---
  function prefillFromTextarea(text){
    var mc=text.match(/\[FMVcast\]([\s\S]*?)\[\/FMVcast\]/i);
    var codes=[];
    if(mc && mc[1]) codes = mc[1].split(';').map(function(s){return s.trim()}).filter(Boolean);

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

  // --- предпросмотр: не менять textarea ---
  var isPreview = false;
  $form.find('input[name="preview"], button[name="preview"]').on('click', function(){ isPreview = true; });

  // --- сабмит: валидируем и пишем в textarea БЕЗ перевода строки ---
  $form.off('submit.fmv').on('submit.fmv', function(){
    if (isPreview) { isPreview = false; return true; }

    // Валидация: минимум 1 персонаж и обязательная локация
    var placeOk = ($placeInput.val()||'').trim().length>0;
    if(!selected.length || !placeOk){
      // софт-подсветка ошибок
      var msg = !selected.length && !placeOk
        ? 'Выберите хотя бы одного персонажа и укажите локацию'
        : (!selected.length ? 'Выберите хотя бы одного персонажа' : 'Укажите локацию');
      $err.text(msg).show();
      if (!placeOk) { $placeInput[0].reportValidity && $placeInput[0].reportValidity(); $placeInput.focus(); }
      setTimeout(function(){ $err.fadeOut(400); }, 2000);
      return false;
    }

    // обязательные поля формы не пустые
    var $subject = $form.find('input[name="req_subject"]');
    var subjectOk = !$subject.length || ($subject.val()||'').trim().length>0;
    var messageOk = ($area.val()||'').trim().length>0;
    if(!subjectOk || !messageOk){
      return true; // не трогаем textarea — пускай отвалидируется
    }

    // сборка: одна строка меты + сразу основной текст (без \n)
    var metaLine = buildMetaLine();
    var plain = stripOldFMV($area.val()).replace(/^\n+/, '');
    $area.val( metaLine + plain );
    return true;
  });

  // направляем BB-кнопки в нашу textarea
  $area.on('focus', function(){
    $('.questionary-post textarea').removeAttr('id');
    if(this.id!=='main-reply') this.id='main-reply';
  }).on('blur', function(){
    if($(this).is($area)) $(this).removeAttr('id');
  });
})();
