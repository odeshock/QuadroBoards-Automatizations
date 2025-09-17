(function(){
  // --- таргетинг: только post.php?fid=8|9 ---
  if (!/\/post\.php(\?|$)/.test(location.pathname)) return;
  var fid = +(new URLSearchParams(location.search).get('fid')||0);
  if ([8,9].indexOf(fid)===-1) return;

  // --- форма и textarea ---
  var $form = $('#post form, form[action*="post.php"]').first();
  if (!$form.length) return;
  var $area = $form.find('textarea[name="req_message"], textarea#main-reply, .questionary-post textarea').first();
  if (!$area.length) return;

  // --- кэш участников (30 мин) ---
  var CACHE_KEY='fmv_participants_cache_v4', TTL_MS=30*60*1000;
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

  // --- UI: селект + кнопка + Локация + список (в столбик) ---
  var $wrap=$('<div class="msg-with-characters"/>');

  // селект персон
  var $row=$('<div class="char-row"/>');
  var $select=$('<select/>',{id:'character-select','aria-label':'Выберите персонажа'});
  var $addBtn=$('<button type="button">Добавить персонажа</button>');

  // локация
  var $placeRow=$('<div class="place-row"/>');
  var $placeInput=$('<input type="text" id="fmv-place" placeholder="Локация (необязательно)">');

  // список выбранных
  var $chips=$('<div class="chips"/>');
  var $hint=$('<div class="hint">Добавьте одного или нескольких персонажей; у каждого могут быть маски. Локация пишется в [FMVplace].</div>');

  // initial options
  $select.append($('<option/>',{value:'',text:'— Персонаж —',disabled:true,selected:true}));
  var $loadingOpt=$('<option/>',{value:'',text:'Загружается список…',disabled:true});
  $select.append($loadingOpt);

  // mount
  $area.before($wrap);
  $row.append($select,$addBtn);
  $placeRow.append($('<label for="fmv-place" style="font-weight:600">Локация:</label>'),$placeInput);
  $wrap.append($row,$placeRow,$chips,$hint,$area);

  // --- состояние выбранных ---
  // элемент: {code:'user4', name:'Имя', masks:['m1','m2']}
  var selected=[], knownUsers=[];

  // --- рендер в столбик ---
  function renderChips(){
    $chips.empty();
    selected.forEach(function(item, idx){
      var $chip=$('<div class="chip"/>');
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

      $chip.append($name,$masks,$addMask,$remove,$maskBox);
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
  fetchAllParticipants().done(function(list){
    knownUsers=list;
    $loadingOpt.remove();
    list.forEach(function(u){
      var $o=$('<option/>',{value:u.code,text:u.name});
      $o.attr('data-name',u.name);
      $select.append($o);
    });
    // редактирование: распарсить FMV-блоки из textarea
    prefillFromTextarea($area.val()||'');
    renderChips();
  }).fail(function(msg){ $loadingOpt.text(msg||'Ошибка загрузки'); });

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

  // убрать старые FMV-блоки и вернуть чистый текст
  function stripOldFMV(text){
    return (text||'')
      .replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig,'')
      .replace(/\[FMVmask\][\s\S]*?\[\/FMVmask\]/ig,'')
      .replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig,'')
      .replace(/^\s+|\s+$/g,'') // обрезаем лишние пробелы/переносы по краям
  }

  // собрать одну мета-строку
  function buildMetaLine(){
    var parts = [buildFMVCast(), buildFMVMask(), buildFMVPlace()].filter(Boolean);
    return parts.join(''); // ровно подряд, без переносов и пробелов
  }

  // --- обратный парсинг при редактировании ---
  function prefillFromTextarea(text){
    // FMVcast
    var mc=text.match(/\[FMVcast\]([\s\S]*?)\[\/FMVcast\]/i);
    var codes=[];
    if(mc && mc[1]) codes = mc[1].split(';').map(function(s){return s.trim()}).filter(Boolean);
    // FMVmask
    var mm=text.match(/\[FMVmask\]([\s\S]*?)\[\/FMVmask\]/i);
    var maskPairs={}; // code -> [m1, m2]
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
    // FMVplace
    var mp=text.match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i);
    if(mp && typeof mp[1]==='string'){ $placeInput.val(mp[1].trim()); }

    // восстановим выбранных
    codes.forEach(function(code){
      if (selected.some(function(x){return x.code===code})) return;
      var u = knownUsers.find(function(x){return x.code===code});
      var name = u ? u.name : code;
      selected.push({code:code, name:name, masks:(maskPairs[code]||[])});
    });
    // маски для кодов, которых нет в cast
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

  // --- сабмит: меняем textarea только при валидных полях ---
  $form.off('submit.fmv').on('submit.fmv', function(){
    if (isPreview) { isPreview = false; return true; }

    // должен быть хотя бы один персонаж
    if(!selected.length){
      $select[0].setCustomValidity('Выберите хотя бы одного персонажа');
      $select[0].reportValidity && $select[0].reportValidity();
      setTimeout(function(){ $select[0].setCustomValidity(''); }, 2000);
      return false;
    }

    // обязательные поля не пустые
    var $subject = $form.find('input[name="req_subject"]');
    var subjectOk = !$subject.length || ($subject.val()||'').trim().length>0;
    var messageOk = ($area.val()||'').trim().length>0;
    if(!subjectOk || !messageOk){
      return true; // не трогаем textarea — пускай отвалидируется
    }

    // собираем одну мета-строку
    var metaLine = buildMetaLine(); // без переносов, без пробелов
    // убираем прежние FMV-блоки из текста
    var plain = stripOldFMV($area.val());
    // вставляем: мета-строка + перевод строки + основной текст
    $area.val( metaLine + (metaLine ? '\n' : '') + plain );
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
