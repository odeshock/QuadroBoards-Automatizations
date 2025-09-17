(function(){
  /* ---- защита от двойной инициализации ---- */
  if (window.__FMV_SCRIPT_INIT__) return; window.__FMV_SCRIPT_INIT__=true;

  /* ---- только для post.php?fid=8|9 ---- */
  if (!/\/post\.php(\?|$)/.test(location.pathname)) return;
  var fid=+(new URLSearchParams(location.search).get('fid')||0);
  if ([8,9].indexOf(fid)===-1) return;

  var $form=$('#post form, form[action*="post.php"]').first(); if(!$form.length) return;
  if ($form.data('fmvBound')) return; $form.data('fmvBound', true);

  var $area=$form.find('textarea[name="req_message"], textarea#main-reply, .questionary-post textarea').first();
  if(!$area.length) return;

  /* ---- один раз ставим id для тулбаров форума, без фокусов/блюров ---- */
  if ($('#main-reply').length===0) $area.attr('id','main-reply');

  /* подчистим старый наш UI, если вдруг был */
  $form.find('.msg-with-characters').remove();

  /* ===== кэш участников ===== */
  var CACHE_KEY='fmv_participants_cache_v11', TTL=30*60*1000;
  function readCache(){try{var r=sessionStorage.getItem(CACHE_KEY);if(!r)return null;var o=JSON.parse(r);return(Date.now()-o.time>TTL)?null:o.data}catch(e){return null}}
  function writeCache(list){try{sessionStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(),data:list}))}catch(e){}}

  /* ===== /userlist.php с пагинацией ===== */
  function extractUsersFromHTML(html){
    var $doc=$('<div/>').html(html);
    var users=$doc.find('a[href*="profile.php?id="]').map(function(){
      var a=$(this)[0], name=$(this).text().trim(), m=a.href.match(/profile\.php\?id=(\d+)/);
      if(!m) return null; return {id:+m[1], code:'user'+m[1], name:name};
    }).get().filter(Boolean);

    var pages=$doc.find('a[href*="userlist.php"]').map(function(){
      var u=new URL($(this)[0].href,location.origin);
      return +(u.searchParams.get('p')||0);
    }).get();
    var last=Math.max(1,...pages,1);
    var any=$doc.find('a[href*="userlist.php"]').first().attr('href')||'userlist.php';
    return {users:users,last:last,base:new URL(any,location.origin)};
  }
  function urlForPage(base,p){var u=new URL(base,location.origin); if(p>1)u.searchParams.set('p',p); else u.searchParams.delete('p'); return u.pathname+(u.search||'');}
  function uniqSort(arr){var map={};arr.forEach(u=>map[u.code]=u);return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));}
  function fetchUsers(){
    var c=readCache(); if(c) return $.Deferred().resolve(c).promise();
    var d=$.Deferred();
    $.get('/userlist.php').done(function(h1){
      var first=extractUsersFromHTML(h1), all=[].concat(first.users);
      var MAX=Math.min(first.last,50), B=5, tasks=[]; for(var p=2;p<=MAX;p++) tasks.push(p);
      function step(p){return $.get(urlForPage(first.base,p)).then(h=>{all=all.concat(extractUsersFromHTML(h).users)})}
      (function run(i){if(i>=tasks.length){var list=uniqSort(all);writeCache(list);d.resolve(list);return;}
        $.when.apply($,tasks.slice(i,i+B).map(step)).always(()=>run(i+B));})(0);
    }).fail(()=>d.reject('Не удалось загрузить список участников'));
    return d.promise();
  }

  /* ===== UI ===== */
  var $wrap=$('<div class="msg-with-characters"/>');

  // Комбобокс (поиск+выбор)
  var $row=$('<div class="char-row"/>');
  var $combo=$('<div class="combo"/>');
  var $comboInput=$('<input type="text" id="character-combo" placeholder="Наберите имя персонажа…" autocomplete="off">');
  var $ac=$('<div class="ac-list" role="listbox" aria-label="Варианты персонажей"></div>');
  $combo.append($comboInput,$ac); $row.append($combo);

  // Локация
  var $placeRow=$('<div class="place-row"/>');
  var $placeLabel=$('<label for="fmv-place" style="font-weight:600">Локация:</label>');
  var $placeInput=$('<input type="text" id="fmv-place" placeholder="Укажите локацию">'); // валидируем сами
  $placeRow.append($placeLabel,$placeInput);

  var $chips=$('<div class="chips"/>');
  var $hint=$('<div class="hint">Добавьте одного или нескольких персонажей; у каждого могут быть маски. Локация обязательна. Маски: Enter=Ок.</div>');
  var $err=$('<div class="error" style="display:none"></div>');

  $area.before($wrap);
  $wrap.append($row,$placeRow,$chips,$hint,$err,$area);

  /* ===== state ===== */
  var selected=[], knownUsers=[];

  /* ===== chips + DnD ===== */
  function renderChips(){
    $chips.empty();
    selected.forEach(function(item, idx){
      var $chip=$('<div class="chip" draggable="true" data-idx="'+idx+'"/>');
      var $drag=$('<span class="drag" title="Перетащите для изменения порядка">↕</span>');
      var $name=$('<span class="name"/>').text(item.name+' ('+item.code+')');
      var masksText=item.masks&&item.masks.length?'маски: '+item.masks.join(', '):'масок нет';
      var $masks=$('<span class="masks"/>').text(' — '+мasksText);
      var $addMask=$('<button class="add-mask" type="button">добавить маску</button>');
      var $remove=$('<button class="x" type="button" aria-label="Удалить">×</button>');

      var $maskBox=$('<span class="mask-input"></span>');
      var $maskInput=$('<input type="text" placeholder="маска (текст)">');
      var $maskOk=$('<button type="button">Ок</button>');
      var $maskCancel=$('<button type="button">Отмена</button>');
      $maskBox.append($maskInput,$maskOk,$maskCancel);

      $maskInput.on('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); $maskOk.click(); }});
      $addMask.on('click', ()=>{ $maskBox.show(); $maskInput.val('').focus(); });
      $maskOk.on('click', ()=>{ var v=$.trim($maskInput.val()); if(!v) return; (item.masks||(item.masks=[])).push(v); renderChips(); });
      $maskCancel.on('click', ()=>{ $maskBox.hide(); });
      $remove.on('click', ()=>{ selected.splice(idx,1); renderChips(); });

      $chip.append($drag,$name,$masks,$addMask,$remove,$maskBox);
      $chips.append($chip);
    });
  }
  $chips.on('dragstart','.chip',function(e){$(this).addClass('dragging');e.originalEvent.dataTransfer.setData('text/plain',$(this).data('idx'));});
  $chips.on('dragend','.chip',function(){$(this).removeClass('dragging');});
  $chips.on('dragover',e=>e.preventDefault());
  $chips.on('drop',function(e){
    e.preventDefault(); var from=+e.originalEvent.dataTransfer.getData('text/plain');
    var $t=$(e.target).closest('.chip'); if(!$t.length) return; var to=+$t.data('idx');
    if(isNaN(from)||isNaN(to)||from===to) return; var it=selected.splice(from,1)[0]; selected.splice(to,0,it); renderChips();
  });

  /* ===== добавление персонажа ===== */
  function addByCode(code){
    if(!code) return; if(selected.some(x=>x.code===code)) return;
    var u=knownUsers.find(x=>x.code===code); selected.push({code:code,name:(u?u.name:code),masks:[]});
    renderChips(); $comboInput.val(''); $ac.hide().empty();
  }
  function pickByInput(){
    var q=($comboInput.val()||'').trim(); if(!q) return null; var qq=q.toLowerCase();
    var pool=knownUsers.filter(u=>!selected.some(x=>x.code===u.code));
    var exact=pool.find(u=>u.name.toLowerCase()===qq) || pool.find(u=>u.code.toLowerCase()===qq);
    if(exact) return exact.code;
    var list=pool.filter(u=>u.name.toLowerCase().includes(qq)||u.code.toLowerCase().includes(qq));
    return list.length===1 ? list[0].code : null;
  }

  /* ===== автодополнение ===== */
  function renderAC(q){
    var qq=(q||'').trim().toLowerCase();
    var items=knownUsers.filter(u=>!selected.some(x=>x.code===u.code))
      .filter(u=>!qq||u.name.toLowerCase().includes(qq)||u.code.toLowerCase().includes(qq))
      .slice().sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));
    $ac.empty();
    if(!items.length){ $ac.append('<div class="ac-item"><span class="muted">Ничего не найдено</span></div>').show(); return; }
    items.slice(0,30).forEach(u=>{
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
    else if(e.key==='Enter'){ e.preventDefault(); var code=$ac.is(':visible')?getActiveCode():pickByInput(); if(code) addByCode(code); else renderAC(this.value); }
    else if(e.key==='Escape'){ $ac.hide(); }
  });
  $ac.on('mousedown','.ac-item',function(){var code=$(this).data('code'); if(code) addByCode(code);});
  $(document).on('click',e=>{ if(!$(e.target).closest($combo).length) $ac.hide(); });

  /* ===== загрузка участников и префилл ===== */
  fetchUsers().done(list=>{
    knownUsers=list.slice().sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));
    prefillFromTextarea($area.val()||''); renderChips();
  }).fail(msg=>{ $ac.html('<div class="ac-item"><span class="muted">'+(msg||'Ошибка загрузки')+'</span></div>').show(); });

  /* ===== сериализация одной строкой ===== */
  function castStr(){return selected.length ? '[FMVcast]'+selected.map(i=>i.code).join(';')+'[/FMVcast]' : '';}
  function maskStr(){var pairs=[];selected.forEach(i=>(i.masks||[]).forEach(m=>pairs.push(i.code+'='+m)));return pairs.length?'[FMVmask]'+pairs.join(';')+'[/FMVmask]':'';}
  function placeStr(){var v=($placeInput.val()||'').trim();return v?'[FMVplace]'+v+'[/FMVplace]':'';}
  function stripFMV(t){return (t||'').replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig,'').replace(/\[FMVmask\][\s\S]*?\[\/FMVmask\]/ig,'').replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig,'').replace(/^\s+|\s+$/g,'');}
  function metaLine(){return [castStr(),maskStr(),placeStr()].filter(Boolean).join('');}

  function prefillFromTextarea(text){
    var mc=text.match(/\[FMVcast\]([\s\S]*?)\[\/FMVcast\]/i);
    var codes=(mc&&mc[1])?mc[1].split(';').map(s=>s.trim()).filter(Boolean):[];
    var mm=text.match(/\[FMVmask\]([\s\S]*?)\[\/FMVmask\]/i), masks={};
    if(mm&&mm[1]) mm[1].split(';').forEach(p=>{var i=p.indexOf('='); if(i<=0)return; var c=p.slice(0,i).trim(), v=p.slice(i+1).trim(); if(!c||!v)return; (masks[c]||(masks[c]=[])).push(v);});
    var mp=text.match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i); if(mp&&typeof mp[1]==='string') $placeInput.val(mp[1].trim());
    codes.forEach(code=>{ if(selected.some(x=>x.code===code))return; var u=knownUsers.find(x=>x.code===code); selected.push({code:code,name:(u?u.name:code),masks:(masks[code]||[])}); });
    Object.keys(masks).forEach(code=>{ if(selected.some(x=>x.code===code))return; var u=knownUsers.find(x=>x.code===code); selected.push({code:code,name:(u?u.name:code),masks:masks[code]}); });
  }

  /* ===== определяем какую кнопку нажали ===== */
  var lastSubmitter=null;
  $form.on('click.fmv','input[type=submit],button[type=submit]',function(){ lastSubmitter=this; });

  /* ===== сабмит: вставляем мету ТОЛЬКО если можно отправить ===== */
  $form.off('submit.fmv').on('submit.fmv', function(e){
    // если это предпросмотр — ничего не меняем, пропускаем
    if (lastSubmitter && (/preview/i.test(lastSubmitter.name) || /предпрос/i.test(lastSubmitter.value||''))) {
      lastSubmitter=null; return; // не preventDefault
    }

    // автодобавление персонажа, если поле не пусто
    if(!selected.length){ var pick=pickByInput(); if(pick) addByCode(pick); }

    // наша валидация: нужен ≥1 персонаж и непустая локация
    var placeOk=($placeInput.val()||'').trim().length>0;
    if(!selected.length || !placeOk){
      e.preventDefault();
      var msg=!selected.length && !placeOk ? 'Выберите хотя бы одного персонажа и укажите локацию'
               : (!selected.length ? 'Выберите хотя бы одного персонажа' : 'Укажите локацию');
      $err.text(msg).show(); setTimeout(()=>{$err.fadeOut(400);},2000);
      if(!selected.length) $comboInput.focus(); else $placeInput.focus();
      lastSubmitter=null; return;
    }

    /* >>> НОВОЕ: проверяем, что обязательные поля формы не пустые */
    var $subject  = $form.find('input[name="req_subject"]');
    var subjectOk = !$subject.length || ($subject.val()||'').trim().length > 0;
    var messageOk = ($area.val()||'').trim().length > 0;

    if (!subjectOk || !messageOk) {
      // ничего НЕ вставляем — пусть браузер/форум сам заблокирует отправку
      lastSubmitter = null;
      return; // не preventDefault
    }
    /* <<< КОНЕЦ НОВОГО */

    // всё ок — вписываем мету одной строкой и даём форме уйти нативно
    var meta=metaLine();
    var plain=stripFMV($area.val()).replace(/^\n+/, '');
    $area.val(meta+plain);
    lastSubmitter=null; // пусть отправляется как обычно
  });

})();
