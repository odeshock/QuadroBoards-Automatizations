(function(){
  try{
    if (window.__FMV_SCRIPT_INIT__) return; window.__FMV_SCRIPT_INIT__=true;

    // работать только на формировании поста в нужных разделах (пример как у вас было)
    if (!/\/post\.php(\?|$)/.test(location.pathname)) return;
    var fid=+(new URLSearchParams(location.search).get('fid')||0);
    if ([8,9].indexOf(fid)===-1) return;

    // (опц.) фильтр по группам — берём вашу функцию, если она есть (может быть async)
    if (typeof window.ensureAllowed === 'function') {
      try {
        var allowRes = window.ensureAllowed();
        if (allowRes && typeof allowRes.then === 'function') {
          allowRes.then(function(ok){ if(!ok){ throw 'forbidden'; } }).catch(function(){ throw 'forbidden'; });
        } else if(!allowRes) {
          throw 'forbidden';
        }
      } catch(_) { return; }
    }

    var $form=$('#post form, form[action*="post.php"]').first(); if(!$form.length) return;
    if ($form.data('fmvBound')) return; $form.data('fmvBound', true);

    var $area=$form.find('textarea[name="req_message"], #main-reply, .questionary-post textarea').first();
    if(!$area.length) return;
    if ($('#main-reply').length===0) $area.attr('id','main-reply');

    // убрать прежний блок, если был
    $form.find('.msg-with-characters').remove();

    // ───────────────────── зависимости / утилиты ─────────────────────
    // fetchHtml/escapeHtml — берём из helpers (8).js, если есть; иначе — фолбэк
    var fetchHtml = (typeof window.fetchHtml === 'function') ? window.fetchHtml : async function(url){
      const res = await fetch(url, { credentials:'include' });
      if(!res.ok) throw new Error('HTTP '+res.status);
      // пробуем как cp1251, если нет кириллицы — как utf-8
      const buf = await res.arrayBuffer();
      let txt = new TextDecoder('windows-1251').decode(buf);
      if (!/[А-Яа-яЁё]/.test(txt)) txt = new TextDecoder('utf-8').decode(buf);
      return txt;
    };
    var escapeHtml = (typeof window.escapeHtml === 'function') ? window.escapeHtml : function(s){
      return String(s||'').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    };

    // split/serialize по «;» с поддержкой \;
    function splitTagsSemicolon(input){
      var out=[], cur='', esc=false, s=String(input||'');
      for (var i=0;i<s.length;i++){
        var ch=s[i];
        if (esc){ cur+=ch; esc=false; continue; }
        if (ch==='\\'){ esc=true; continue; }
        if (ch===';'){ var t=cur.trim(); if(t) out.push(t); cur=''; continue; }
        cur+=ch;
      }
      var t=cur.trim(); if(t) out.push(t);
      return out;
    }
    function serializeTagsSemicolon(arr){
      return (arr||[]).map(function(t){ return String(t).replace(/;/g,'\\;'); }).join(';');
    }

    // парсинг [FMVcast] → { code, masks[] } по новой схеме
    function parseFMVcast(text){
      var mc=text.match(/\[FMVcast\]([\s\S]*?)\[\/FMVcast\]/i);
      var items=(mc&&mc[1])?splitTagsSemicolon(mc[1]):[];
      var byCode={};
      items.forEach(function(tok){
        var m = String(tok).trim().match(/^(user\d+)(?:=(.+))?$/i);
        if(!m) return;
        var code = m[1], mask = (m[2]||'').trim();
        var obj  = byCode[code] || (byCode[code] = { code:code, name:code, masks:[] });
        if (mask) obj.masks.push(mask);
      });
      var list=[]; Object.keys(byCode).forEach(function(k){ list.push(byCode[k]); });
      return list;
    }

    // сериализация selected → [FMVcast]userN;userN=mask1;userN=mask2[/FMVcast]
    function buildFMVcast(selected){
      var parts=[];
      selected.forEach(function(item){
        var masks=Array.isArray(item.masks)?item.masks.filter(Boolean):[];
        if (masks.length===0) {
          parts.push(item.code);
        } else {
          masks.forEach(function(msk){ parts.push(item.code + '=' + msk); });
        }
      });
      return parts.length ? '[FMVcast]' + serializeTagsSemicolon(parts) + '[/FMVcast]' : '';
    }

    // [FMVplace]
    function buildFMVplace(v){
      v=(v||'').trim(); return v ? '[FMVplace]' + v + '[/FMVplace]' : '';
    }

    // вырезать прежние блоки из текста
    function stripFMV(text){
      return (text||'')
        .replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig,'')
        .replace(/\[FMVmask\][\s\S]*?\[\/FMVmask\]/ig,'') // на всякий
        .replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig,'')
        .replace(/^\s+|\s+$/g,'');
    }

    // ───────────────────── UI ─────────────────────
    var $wrap=$('<div class="msg-with-characters"/>');
    var $row =$('<div class="char-row"/>');
    var $combo=$('<div class="combo"/>');
    var $comboInput=$('<input type="text" id="character-combo" placeholder="Наберите имя или userN… (маска через =)" autocomplete="off">');
    var $ac   =$('<div class="ac-list" role="listbox" aria-label="Варианты"></div>');
    $combo.append($comboInput,$ac); $row.append($combo);

    var $placeRow  =$('<div class="place-row"/>');
    var $placeLabel=$('<label for="fmv-place" style="font-weight:600">Локация:</label>');
    var $placeInput=$('<input type="text" id="fmv-place" placeholder="Укажите локацию">');
    $placeRow.append($placeLabel,$placeInput);

    var $chips=$('<div class="chips"/>');
    var $hint =$('<div class="hint">Добавьте участников: userN или по имени; маски — как <code>userN=маска</code> (ещё маска — ещё один такой токен). Разделитель — «;». Enter — добавить.</div>');
    var $err  =$('<div class="error" style="display:none"></div>');

    $area.before($wrap);
    $wrap.append($row,$placeRow,$chips,$hint,$err,$area);

    // состояние
    var selected=[], knownUsers=[];

    // рендер чипсов
    function renderChips(){
      $chips.empty();
      selected.forEach(function(it, idx){
        var $p=$('<p class="chip"></p>');
        var masks = (Array.isArray(it.masks)?it.masks:[]).filter(Boolean);
        var left  = $('<span class="chip-left"></span>').text(it.name || it.code);
        var right = $('<span class="chip-right"></span>');
        // показать маски как подписи
        if (masks.length) right.append($('<span class="chip-masks"></span>').text(' = ' + masks.join('; ')));
        var $del=$('<a href="#" class="chip-del">Удалить</a>').on('click', function(e){ e.preventDefault(); selected.splice(idx,1); renderChips(); });
        right.append($del);
        $p.append(left,right);
        $chips.append($p);
      });
    }

    // добавить/обновить участника по коду userN и (опц.) маске
    function addParticipant(code, mask){
      if (!/^user\d+$/i.test(code||'')) return;
      var ex = selected.find(function(x){return x.code.toLowerCase()===code.toLowerCase();});
      if (!ex){
        var u = knownUsers.find(function(x){return x.code.toLowerCase()===code.toLowerCase();});
        ex = { code: code, name: (u?u.name:code), masks: [] };
        selected.push(ex);
      }
      if (mask && !ex.masks.includes(mask)) ex.masks.push(mask);
      renderChips();
    }

    // парсинг ввода: "user5=маска"; "user5"; "Имя Фамилия" → userN (если найден)
    function resolveInputToken(q){
      q=(q||'').trim(); if(!q) return null;
      // userN=mask
      var m=q.match(/^(user\d+)\s*=\s*(.+)$/i);
      if (m) return { code: m[1], mask: m[2].trim() };
      // просто userN
      if (/^user\d+$/i.test(q)) return { code: q, mask: null };
      // по имени/id из списка
      var qq=q.toLowerCase();
      var u = knownUsers.find(function(u){ return u.name.toLowerCase()===qq || u.code.toLowerCase()===qq; }) ||
              knownUsers.find(function(u){ return u.name.toLowerCase().indexOf(qq)!==-1 || u.code.toLowerCase().indexOf(qq)!==-1; });
      if (u) return { code: u.code, mask: null };
      return null;
    }

    function addFromCombo(){
      var raw = ($comboInput.val()||'').trim();
      if (!raw) return;
      // поддержим множественный ввод через ; (с экранированием \;)
      splitTagsSemicolon(raw).forEach(function(tok){
        var r = resolveInputToken(tok);
        if (r) addParticipant(r.code, r.mask);
      });
      $comboInput.val(''); $ac.hide().empty();
    }

    // автодополнение
    function renderAC(q){
      var qq=(q||'').trim().toLowerCase();
      var items=knownUsers
        .filter(function(u){return !selected.some(function(x){return x.code===u.code});})
        .filter(function(u){return !qq || u.name.toLowerCase().indexOf(qq)!==-1 || u.code.toLowerCase().indexOf(qq)!==-1;})
        .slice().sort(function(a,b){return a.name.localeCompare(b.name,'ru',{sensitivity:'base'})});
      $ac.empty();
      items.slice(0,20).forEach(function(u){
        var $it=$('<div class="ac-item" role="option"></div>').text(u.name+' ('+u.code+')');
        $it.on('click', function(){ addParticipant(u.code); $comboInput.val(''); $ac.hide().empty(); });
        $ac.append($it);
      });
      if (!items.length) $ac.append('<div class="ac-item muted">Ничего не найдено</div>');
      $ac.show();
    }

    $comboInput.on('input', function(){ var v=$(this).val()||''; if(v.trim()) renderAC(v); else $ac.hide().empty(); });
    $comboInput.on('keydown', function(e){
      if (e.key==='Enter'){ e.preventDefault(); addFromCombo(); }
      if (e.key==='Escape'){ $ac.hide().empty(); }
    });

    // загрузка участников (как у вас было: парсим userlist)
    // кэш в sessionStorage
    var CACHE_KEY='fmv_participants_cache_v13', TTL=30*60*1000;
    function readCache(){
      try{ var r=sessionStorage.getItem(CACHE_KEY); if(!r) return null;
        var o=JSON.parse(r); if(!o||!o.time||!o.data) return null;
        return (Date.now()-o.time>TTL)?null:o.data;
      }catch(_){ return null; }
    }
    function writeCache(list){
      try{ sessionStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(),data:list})) }catch(_){}
    }

    function uniqSort(arr){
      var map={}; arr.forEach(function(u){ map[u.code]=u; });
      var out=Object.keys(map).map(function(k){return map[k]});
      out.sort(function(a,b){ return a.name.localeCompare(b.name,'ru',{sensitivity:'base'}) });
      return out;
    }

    function extractUsersFromHTML(html){
      var doc = document.implementation.createHTMLDocument('');
      doc.documentElement.innerHTML = html;
      var anchors=doc.querySelectorAll('a[href*="profile.php?id="]');
      var users=[];
      anchors.forEach(function(a){
        var name=(a.textContent||'').trim();
        var m=(a.getAttribute('href')||'').match(/profile\.php\?id=(\d+)/);
        if(!m) return;
        users.push({ id:+m[1], code:'user'+(+m[1]), name:name });
      });
      // пагинация
      var pages=[1];
      doc.querySelectorAll('a[href*="userlist.php"]').forEach(function(a){
        var u=new URL(a.getAttribute('href'), location.origin); var p=+(u.searchParams.get('p')||0); if(p) pages.push(p);
      });
      var last=Math.max.apply(null, pages);
      var any = (doc.querySelector('a[href*="userlist.php"]')||{}).getAttribute?.('href') || 'userlist.php';
      return { users:users, last:last, base:new URL(any, location.origin) };
    }

    function urlForPage(base, p){
      var u=new URL(base,location.origin); if(p>1) u.searchParams.set('p', String(p)); else u.searchParams.delete('p');
      return u.pathname + (u.search||'');
    }

    function fetchUsers(){
      var c=readCache(); if(c) return $.Deferred().resolve(c).promise();
      var d=$.Deferred();
      (async function(){
        try{
          var html = await fetchHtml('/userlist.php');
          var first = extractUsersFromHTML(html);
          var all = first.users.slice();

          // дозагружаем остальные страницы параллельно (но не слишком)
          var pages=[]; for(var p=2;p<=first.last;p++) pages.push(p);
          var chunks=[]; while(pages.length) chunks.push(pages.splice(0,5));
          for (var i=0;i<chunks.length;i++){
            await Promise.all(chunks[i].map(async function(p){
              var h = await fetchHtml(urlForPage(first.base, p));
              var part = extractUsersFromHTML(h);
              all = all.concat(part.users);
            }));
          }
          var list = uniqSort(all);
          writeCache(list);
          d.resolve(list);
        }catch(err){
          d.reject('Не удалось загрузить список участников');
        }
      })();
      return d.promise();
    }

    // префилл по существующему тексту
    function prefillFromTextarea(text){
      selected = parseFMVcast(text||'');
      // подтянем имена для уже выбранных кодов
      selected.forEach(function(item){
        var u = knownUsers.find(function(x){ return x.code===item.code; });
        if (u) item.name = u.name;
      });
      // локация
      var mp=(text||'').match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i);
      if (mp && typeof mp[1]==='string') $placeInput.val(mp[1].trim());
    }

    // загрузка пула участников → префилл
    fetchUsers().done(function(list){
      knownUsers=list.slice();
      prefillFromTextarea($area.val()||'');
      renderChips();
    }).fail(function(msg){
      $ac.html('<div class="ac-item"><span class="muted">'+escapeHtml(msg||'Ошибка загрузки')+'</span></div>').show();
    });

    // сборка мета-строки
    function metaLine(){
      var cast  = buildFMVcast(selected);
      var place = buildFMVplace($placeInput.val());
      return [cast, place].filter(Boolean).join('');
    }

    // подмена текста при отправке
    var lastSubmitter=null;
    $form.on('click.fmv','input[type=submit],button[type=submit]',function(){ lastSubmitter=this; });

    $form.on('submit.fmv', function(ev){
      try{
        var mline = metaLine();
        var rest  = stripFMV($area.val()||'');
        var text  = (mline ? (mline + '\n\n') : '') + rest;
        $area.val(text);
      }catch(e){
        // покажем ошибку, но не блокируем сабмит
        $err.text('FMV: '+(e.message||e)).show();
      }
    });

    // ─────────── CSS ───────────
    (function injectStyle(css){
      var style=document.createElement('style'); style.textContent=css; document.head.appendChild(style);
    })(`
      .msg-with-characters{margin:8px 0; padding:8px; border:1px solid #d7d7d7; background:#f7f7f7; border-radius:6px}
      .char-row{display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap}
      .combo{position:relative; flex:1 1 420px}
      .combo input{width:100%; padding:.5em .6em; border:1px solid #ccc; border-radius:6px}
      .ac-list{position:absolute; z-index:50; left:0; right:0; background:#fff; border:1px solid #ccc; border-radius:6px; margin-top:2px; max-height:240px; overflow:auto}
      .ac-item{padding:.4em .6em; cursor:pointer}
      .ac-item:hover{background:#f0f0f0}
      .ac-item.muted{color:#888; cursor:default}
      .chips .chip{display:flex; justify-content:space-between; gap:8px; padding:.35em .5em; background:#fff; border:1px solid #ddd; border-radius:6px; margin:.25em 0}
      .chip-left{font-weight:600}
      .chip-right{white-space:nowrap}
      .chip-right .chip-masks{margin-right:.5em; color:#555}
      .chip-del{color:#b00; text-decoration:none}
      .chip-del:hover{text-decoration:underline}
      .place-row{margin-top:6px}
      .place-row input{width:100%; padding:.4em .6em; border:1px solid #ccc; border-radius:6px}
      .hint{font-size:.9em; color:#666; margin-top:6px}
      .error{color:#b00; margin-top:6px}
    `);

    // ─────────── лёгкий лог для отладки ───────────
    window.FMV = window.FMV || {};
    window.FMV.log = window.FMV.log || function(){ try{ console.log.apply(console, arguments);}catch(e){} };

  }catch(err){
    console.error('FMV fatal error:', err);
  }
})();
