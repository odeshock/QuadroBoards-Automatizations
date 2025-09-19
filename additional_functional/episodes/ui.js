// fmv.ui.js — общий виджет участников/масок/локации
(function () {
  'use strict';

  if (!window.FMV) window.FMV = {};
  if (window.FMV.UI) return; // уже подключён

  // требуем только FMV.fetchUsers из общего модуля
  function assertDeps() {
    if (!window.FMV || typeof FMV.fetchUsers !== 'function') {
      throw new Error('FMV.fetchUsers не найден. Подключите общий модуль (common) до fmv.ui.js');
    }
  }

  // ───── мини-утилиты (без дублей) ─────
  function splitBySemicolon(s) {
    // простой split по «;» (без escape), как договорились
    return String(s || '')
      .split(';')
      .map(v => v.trim())
      .filter(Boolean);
  }
  function parseFMVcast(text) {
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
    return by; // { userN: {code, masks[]}, ... }
  }
  function buildFMVcast(selected) {
    const parts = [];
    (selected || []).forEach(it => {
      const masks = Array.isArray(it.masks) ? it.masks.filter(Boolean) : [];
      if (!masks.length) parts.push(it.code);
      else masks.forEach(msk => parts.push(it.code + '=' + msk));
    });
    return parts.length ? '[FMVcast]' + parts.join(';') + '[/FMVcast]' : '';
  }
  function buildFMVplace(val) {
    val = String(val || '').trim();
    return val ? '[FMVplace]' + val + '[/FMVplace]' : '';
  }
  function stripFMV(text) {
    return String(text || '')
      .replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig, '')
      .replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig, '')
      .replace(/^\s+|\s+$/g, '');
  }

  // ───── единый CSS, инжектим один раз ─────
  let cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    const css = `
      .msg-with-characters{margin:8px 0; padding:8px; border:1px solid #d7d7d7; background:#f7f7f7; border-radius:6px}
      .char-row{display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap}
      .combo{position:relative; flex:1 1 420px}
      .combo input{width:100%; padding:.5em .6em; border:1px solid #ccc; border-radius:6px}
      .ac-list{position:absolute; z-index:50; left:0; right:0; background:#fff; border:1px solid #ccc; border-radius:6px; margin-top:2px; max-height:240px; overflow:auto}
      .ac-item{padding:.4em .6em; cursor:pointer}
      .ac-item.active,.ac-item:hover{background:#f0f0f0}
      .ac-item .muted{color:#888}
      .chips .chip{display:flex; justify-content:space-between; gap:8px; padding:.35em .5em; background:#fff; border:1px solid #ddd; border-radius:6px; margin:.25em 0}
      .chip .drag{cursor:grab; margin-right:.5em}
      .place-row{margin-top:6px}
      .place-row input{width:100%; padding:.4em .6em; border:1px solid #ccc; border-radius:6px}
      .hint{font-size:.9em; color:#666; margin-top:6px}
      .error{color:#b00; margin-top:6px}
      .mask-input{display:none; margin-left:8px}
      .mask-input input{width:220px; margin-right:6px}
    `;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ───── ядро виджета ─────
  function attach(opts) {
    assertDeps();
    injectCSS();

    const $form = typeof opts.form === 'string' ? $(opts.form) : opts.form;
    const $area = typeof opts.textarea === 'string' ? $(opts.textarea) : opts.textarea;
    if (!$form || !$form.length || !$area || !$area.length) return null;

    // по требованию для edit: показываем виджет только если в тексте есть FMVcast
    if (opts.showOnlyIfFMVcast && !/\[FMVcast\][\s\S]*?\[\/FMVcast\]/i.test($area.val() || '')) {
      return null;
    }

    // контейнеры (единая разметка)
    const $wrap = $('<div class="msg-with-characters"/>');
    const $row  = $('<div class="char-row"/>');
    const $combo= $('<div class="combo"/>');
    const $comboInput=$('<input type="text" id="character-combo" placeholder="Наберите имя персонажа…" autocomplete="off">');
    const $ac   = $('<div class="ac-list" role="listbox" aria-label="Варианты персонажей"></div>');
    $combo.append($comboInput,$ac); $row.append($combo);

    const $placeRow  = $('<div class="place-row"/>');
    const $placeLabel= $('<label for="fmv-place" style="font-weight:600">Локация:</label>');
    const $placeInput= $('<input type="text" id="fmv-place" placeholder="Укажите локацию">');
    $placeRow.append($placeLabel,$placeInput);

    const $chips=$('<div class="chips"/>');
    const $hint =$('<div class="hint">Участники/маски/локация. На сохранении будет: [FMVcast]userN;userM=маска…[/FMVcast] + [FMVplace]…[/FMVplace].</div>');
    const $err  =$('<div class="error" style="display:none"></div>');

    // вставка перед textarea (визуал одинаковый везде)
    $area.before($wrap);
    $wrap.append($row,$placeRow,$chips,$hint,$err);

    // состояние
    let selected = []; // [{code,name,masks[]}]
    let knownUsers = [];

    function renderChips(){
      $chips.empty();
      selected.forEach(function(item, idx){
        const $chip=$('<div class="chip" draggable="true" data-idx="'+idx+'"/>');
        const $drag=$('<span class="drag" title="Перетащите для изменения порядка">↕</span>');
        const $name=$('<span class="name"/>').text(item.name+' ('+item.code+')');
        const masksText=item.masks&&item.masks.length?'маски: '+item.masks.join(', '):'масок нет';
        const $masks=$('<span class="masks"/>').text(' — '+masksText);
        const $addMask=$('<button class="add-mask" type="button">добавить маску</button>');
        const $remove=$('<button class="x" type="button" aria-label="Удалить">×</button>');

        const $maskBox=$('<span class="mask-input"></span>');
        const $maskInput=$('<input type="text" placeholder="маска (текст)">');
        const $maskOk=$('<button type="button">Ок</button>');
        const $maskCancel=$('<button type="button">Отмена</button>');
        $maskBox.append($maskInput,$maskOk,$maskCancel);

        $maskInput.on('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $maskOk.click(); } });
        $addMask.on('click', function(){ $maskBox.show(); $maskInput.val('').focus(); });
        $maskOk.on('click', function(){ const v=$.trim($maskInput.val()); if(!v) return; (item.masks||(item.masks=[])).push(v); renderChips(); });
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
      e.preventDefault();
      const from=+e.originalEvent.dataTransfer.getData('text/plain');
      const $t=$(e.target).closest('.chip'); if(!$t.length) return;
      const to=+$t.data('idx');
      if(isNaN(from)||isNaN(to)||from===to) return;
      const it=selected.splice(from,1)[0]; selected.splice(to,0,it); renderChips();
    });

    function addByCode(code){
      if(!code) return;
      if(selected.some(x => x.code === code)) return;
      const u=knownUsers.find(x => x.code === code);
      selected.push({ code, name: (u?u.name:code), masks: [] });
      renderChips(); $comboInput.val(''); $ac.hide().empty();
    }

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

    function renderAC(q){
      const qq=(q||'').trim().toLowerCase();
      const items=knownUsers
        .filter(u => !selected.some(x => x.code===u.code))
        .filter(u => !qq || u.name.toLowerCase().includes(qq) || u.code.toLowerCase().includes(qq))
        .slice().sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));
      $ac.empty();
      if(!items.length){ $ac.append('<div class="ac-item"><span class="muted">Ничего не найдено</span></div>').show(); return; }
      items.slice(0,40).forEach(u=>{
        $ac.append($('<div class="ac-item" role="option"/>').attr('data-code',u.code).text(u.name+' ('+u.code+')'));
      });
      $ac.show(); setActive(0);
    }
    function setActive(i){const $it=$ac.children('.ac-item');$it.removeClass('active');if(!$it.length)return;i=(i+$it.length)%$it.length;$it.eq(i).addClass('active');$ac.data('activeIndex',i);}
    function getActiveCode(){const i=$ac.data('activeIndex')|0;const $it=$ac.children('.ac-item').eq(i);return $it.data('code');}

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

    // загрузка людей + префилл
    function prefillFrom(text){
      selected = [];
      const by = parseFMVcast(text || '');
      // локация
      const mp = String(text || '').match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i);
      if (mp && typeof mp[1] === 'string') $placeInput.val(mp[1].trim());
      // заполнить selected
      Object.keys(by).forEach(code => {
        const u = knownUsers.find(x => x.code === code);
        selected.push({ code, name: (u?u.name:code), masks: by[code].masks });
      });
      renderChips();
    }

    function metaLine(){
      return [ buildFMVcast(selected), buildFMVplace($placeInput.val()) ].filter(Boolean).join('');
    }

    // Публичный API контроллера
    const api = {
      prefillFrom,
      setKnownUsers(list){ knownUsers = (list || []).slice(); },
      serialize(){ return metaLine(); },
      stripFMV(text){ return stripFMV(text); },
      getSelected(){ return selected.slice(); },
      getPlace(){ return String($placeInput.val() || ''); },
      mountPoint: $wrap
    };

    // загрузка и первичный префилл
    FMV.fetchUsers().done(function(list){
      api.setKnownUsers(list);
      if (opts.prefill !== false) api.prefillFrom($area.val() || '');
    }).fail(function(msg){
      $ac.html('<div class="ac-item"><span class="muted">'+(msg||'Ошибка загрузки')+'</span></div>').show();
    });

    // подмена текста при submit
    let lastSubmitter=null;
    $form.on('click.fmv.ui','input[type=submit],button[type=submit]',function(){ lastSubmitter=this; });
    $form.on('submit.fmv.ui', function(){
      // не вмешиваемся в «предпросмотр» — при необходимости добавьте проверку имени кнопки
      const meta = api.serialize();
      const rest = api.stripFMV($area.val()).replace(/^\n+/, '');
      $area.val(meta + (rest ? '\n\n' + rest : ''));
    });

    return api;
  }

  // экспорт
  window.FMV.UI = { attach };

})();
