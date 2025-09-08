// ==UserScript==
// @name         Profile → "Последний пост:" (debug; форумы 3,6; посты vs темы; дата + TZ)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  if (!window.jQuery) return;
  var $ = jQuery;

  // === настройки ===
  var FORUM_IDS = [3, 6];
  var REQUEST_TIMEOUT_MS = 8000;
  var MAX_PAGES = 20; // на поток
  var PROFILE_RIGHT_SEL = "#viewprofile #profile-right";
  var DEBUG = true;

  function dbg(){ if (!DEBUG) return; try { console.log.apply(console, arguments); } catch(e){} }
  function gstart(label){ if(DEBUG) try{ console.groupCollapsed(label); }catch(e){} }
  function gend(){ if(DEBUG) try{ console.groupEnd(); }catch(e){} }

  // запуск строго на /profile.php?id=...
  if (!/\/profile\.php$/i.test(location.pathname)) return;
  if (!/[?&]id=\d+/.test(location.search)) return;

  // оформление
  $("<style>").text(`
    #pa-lastpost-link a.is-empty{
      color:#999!important;text-decoration:none!important;
      pointer-events:none;cursor:default;opacity:.8;
    }
    #pa-lastpost-link small { opacity:.8; margin-left:.5em; }
  `).appendTo(document.head || document.documentElement);

  // слот
  function insertSlot() {
    if (document.getElementById('pa-lastpost-link')) return $('#pa-lastpost-link');
    var $right = $(PROFILE_RIGHT_SEL);
    if (!$right.length) return null;
    var $li = $(`
      <li id="pa-lastpost-link">
        <span>Последний пост:</span>
        <strong>
          <a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a>
        </strong>
      </li>
    `);
    var $after = $right.find('#pa-last-visit');
    if ($after.length) {
      $li.insertAfter($after);
    } else {
      $right.append($li);
    }
    return $li;
  }
  function setEmpty($slot, reason) {
    var text = "Не найден";
    $slot.find("a").addClass("is-empty").attr({ href:"#", title: reason || text }).text(text);
    dbg('❌ Итог: не найден. Причина:', reason || text);
  }
  function setLink($slot, href, ts) {
    $slot.find("a").removeClass("is-empty").attr({ href }).text(formatUnix(ts));
    dbg('✅ Итог: выбран пост', { href, ts, when: formatUnix(ts) });
  }

  // ник
  function resolveUserName() {
    var name = $("#profile-name > strong").first().text().trim();
    if (name) return name;
    var cands = [
      $("#viewprofile h1 span").text(),
      $("#viewprofile h1").text(),
      $("#viewprofile #profile-right .pa-author strong").first().text(),
      $("#viewprofile #profile-left .pa-author strong").first().text(),
      (document.title || "")
    ].map(s => (s||"").replace(/^Профиль:\s*/i,"").replace(/[«»]/g,"").trim()).filter(Boolean);
    return cands[0] || null;
  }

  // попытка достать часовой пояс из профиля/страницы
  function detectProfileTZ() {
    var txt = $("#viewprofile").text() || "";
    var m = txt.match(/UTC\s*([+\-]\d{1,2})(?::?(\d{2}))?/i) || txt.match(/GMT\s*([+\-]\d{1,2})/i);
    if (m) {
      var hh = parseInt(m[1],10), mm = m[2] ? parseInt(m[2],10) : 0;
      return { type:"offset", minutes: hh*60 + (hh>=0?mm:-mm) };
    }
    var ck = document.cookie;
    var m2 = ck.match(/(?:punbb_tz|timezone|tzoffset)=([+\-]?\d{1,3})/i);
    if (m2) return { type:"offset", minutes: parseInt(m2[1],10) };
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return { type:"iana", zone: tz };
    } catch(e){}
    return { type:"browser" };
  }
  var TZ = detectProfileTZ();

  function formatUnix(sec) {
    var d = new Date(sec*1000);
    if (TZ.type === "offset") {
      var d2 = new Date(d.getTime() + (TZ.minutes - d.getTimezoneOffset())*60000);
      return fmtRu(d2);
    }
    try {
      var zone = (TZ.type==="iana") ? TZ.zone : undefined;
      var f = new Intl.DateTimeFormat('ru-RU', {
        timeZone: zone,
        year: 'numeric', month: 'long', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      return f.format(d).replace(/\s*г\.,?\s*/,' ').replace(/\u202F/g,' ');
    } catch(e){
      return fmtRu(d);
    }
  }
  function fmtRu(dateObj){
    var months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    function pad(n){ return (n<10?"0":"")+n; }
    return dateObj.getDate()+" "+months[dateObj.getMonth()]+" "+dateObj.getFullYear()+" "+pad(dateObj.getHours())+":"+pad(dateObj.getMinutes())+":"+pad(dateObj.getSeconds());
  }

  // служебное
  function isAccessDenied(html) {
    var s = (html||"").toLowerCase();
    return s.includes('id="pun-login"') ||
           s.includes("недостаточно прав") ||
           s.includes("вы не авторизованы") ||
           s.includes("нет доступа");
  }
  function isEmptySearchPosts(html) {
    var s = (html||"").toLowerCase();
    return s.includes("по вашему запросу ничего не найдено") ||
           !/<div[^>]+class="post\b/i.test(html||"");
  }
  function isEmptySearchTopics(html) {
    var s = (html||"").toLowerCase();
    return s.includes("по вашему запросу ничего не найдено") ||
           !/<tbody[^>]*class="hasicon"/i.test(html||"");
  }

  // парсеры (оба возвращают массив объектов с unix и ссылкой)
  function parsePosts(html) {
    var $doc = $(html);
    var out = [];
    $doc.find("div.post").each(function(){
      var $p = $(this);
      var ts = parseInt($p.attr("data-posted"),10);
      var $lnk = $p.find(".post-links a[href*='viewtopic.php?pid=']").first();
      if (ts && $lnk.length) out.push({ ts, href: $lnk.attr("href") });
    });
    return out;
  }
  function parseTopics(html) {
    var $doc = $(html);
    var out = [];
    $doc.find("tbody.hasicon tr").each(function(){
      var $tr = $(this);
      // разные попытки выудить unix
      var ts = NaN, href = null;

      // 1) data-атрибуты на строке/ячейке/ссылке
      ts = ts || parseInt($tr.attr("data-posted"),10);
      var $tcr = $tr.find("td.tcr");
      ts = ts || parseInt($tcr.attr("data-posted"),10);
      var $alast = $tcr.find("a[href*='#p']").first();
      href = $alast.attr('href') || null;
      ts = ts || parseInt($alast.attr("data-posted"),10) || parseInt($alast.attr("data-unix"),10) || parseInt($alast.data("posted"),10) || parseInt($alast.data("unix"),10);

      // 2) иногда unix кладут в скрытый span
      if (!isFinite(ts)) {
        var $hiddenTs = $tcr.find("[data-unix],[data-posted]").first();
        ts = parseInt($hiddenTs.attr("data-unix"),10) || parseInt($hiddenTs.attr("data-posted"),10);
      }

      // 3) fallback — попробовать распарсить видимую дату (ISO-like)
      if (!isFinite(ts) && $alast.length) {
        var txt = ($alast.text()||"").trim();
        var m = txt.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})\s+(\d{2})[:.](\d{2})[:.](\d{2})/);
        if (m) ts = Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]) / 1000;
      }
      out.push({ ts, href });
    });
    return out;
  }
  function getNextPageUrlPosts($doc) {
    var $next = $doc.find("#pun-searchposts .pagelink a.next").first();
    return $next.length ? $next.attr("href") : null;
  }
  function getNextPageUrlTopics($doc) {
    var $next = $doc.find("#pun-searchtopics .pagelink a.next").first();
    return $next.length ? $next.attr("href") : null;
  }

  // построение URL
  function buildPostsURL(name, page) {
    var ids = FORUM_IDS.join(",");
    return "/search.php?action=search"
      + "&keywords="
      + "&author=" + encodeURIComponent(name)
      + (ids ? "&forum=" + encodeURIComponent(ids) + "&forums=" + encodeURIComponent(ids) : "")
      + "&search_in=1&sort_by=0&sort_dir=DESC&show_as=posts"
      + (page ? "&p="+page : "");
  }
  function buildTopicsURL(name, page) {
    var ids = FORUM_IDS.join(",");
    return "/search.php?action=search"
      + "&keywords="
      + "&author=" + encodeURIComponent(name)
      + (ids ? "&forum=" + encodeURIComponent(ids) + "&forums=" + encodeURIComponent(ids) : "")
      + "&search_in=0&sort_by=0&sort_dir=DESC&show_as=topics"
      + (page ? "&p="+page : "");
  }

  $(function () {
    var $slot = insertSlot();
    if (!$slot) return;

    var userName = resolveUserName();
    dbg('👤 Пользователь:', userName);
    dbg('🕒 TZ:', TZ);
    if (!userName) { setEmpty($slot, "не удалось определить ник"); return; }

    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      setEmpty($slot, "таймаут");
    }, REQUEST_TIMEOUT_MS);

    var pPage=1, tPage=1, pBuf=[], tBuf=[], pEnd=false, tEnd=false;

    function logBufs(place){
      if (!DEBUG) return;
      gstart('📦 Буферы ('+place+')');
      dbg('R1 posts pPage=', pPage- (pEnd?0:1), 'end=', pEnd, pBuf.map(x=>({ts:x.ts, when:isFinite(x.ts)?formatUnix(x.ts):'NaN', href:x.href})));
      dbg('R2 topics tPage=', tPage- (tEnd?0:1), 'end=', tEnd, tBuf.map(x=>({ts:x.ts, when:isFinite(x.ts)?formatUnix(x.ts):'NaN', href:x.href})));
      gend();
    }

    function refill(which, cb) {
      if (done) return;
      var url = which==="posts" ? buildPostsURL(userName, pPage) : buildTopicsURL(userName, tPage);
      gstart('🔎 Загрузка '+(which==='posts'?'R1/posts':'R2/topics')+' страница '+(which==='posts'?pPage:tPage));
      dbg('GET', url);
      $.get(url, function(html){
        if (done) return;
        clearTimeout(timer);
        timer = setTimeout(function(){ if(!done){ done=true; setEmpty($slot,"таймаут"); } }, REQUEST_TIMEOUT_MS);

        if (isAccessDenied(html)) { done=true; clearTimeout(timer); setEmpty($slot, "доступ закрыт"); gend(); return; }
        if (which==="posts" ? isEmptySearchPosts(html) : isEmptySearchTopics(html)) {
          if (which==="posts") { pBuf=[]; pEnd=true; }
          else { tBuf=[]; tEnd=true; }
          dbg('Пусто на странице.');
          gend();
          cb(); return;
        }
        var $doc = $(html);
        if (which==="posts") {
          pBuf = parsePosts(html);
          dbg('Парсинг R1/posts →', pBuf.map(x=>({ts:x.ts, when:isFinite(x.ts)?formatUnix(x.ts):'NaN', href:x.href})));
          if (!getNextPageUrlPosts($doc) || pPage>=MAX_PAGES) { pEnd = true; dbg('Нет следующей страницы (posts) или достигнут лимит'); }
          else { pPage++; dbg('Следующая страница posts будет', pPage); }
        } else {
          tBuf = parseTopics(html);
          dbg('Парсинг R2/topics →', tBuf.map(x=>({ts:x.ts, when:isFinite(x.ts)?formatUnix(x.ts):'NaN', href:x.href})));
          if (!getNextPageUrlTopics($doc) || tPage>=MAX_PAGES) { tEnd = true; dbg('Нет следующей страницы (topics) или достигнут лимит'); }
          else { tPage++; dbg('Следующая страница topics будет', tPage); }
        }
        gend();
        cb();
      }, "html").fail(function(){
        if (done) return;
        clearTimeout(timer);
        done=true;
        gend();
        setEmpty($slot, "ошибка сети");
      });
    }

    function step() {
      if (done) return;

      // заполняем буферы по необходимости
      if (!pBuf.length && !pEnd) return refill("posts", step);
      if (!tBuf.length && !tEnd) return refill("topics", step);

      // если оба пусты — финиш
      if (!pBuf.length && !tBuf.length) { done=true; clearTimeout(timer); setEmpty($slot); return; }

      logBufs('step');

      // если темы пусты — просто берём верхний пост
      if (!tBuf.length) {
        var pOnly = pBuf.shift();
        dbg('Темы пусты → берём верхний пост', pOnly);
        if (pOnly && isFinite(pOnly.ts)) { done=true; clearTimeout(timer); setLink($slot, pOnly.href, pOnly.ts); return; }
        return step();
      }
      // если посты пусты — догружаем посты
      if (!pBuf.length) return refill("posts", step);

      // сравнение верхних элементов
      var p = pBuf[0], t = tBuf[0];
      if (!isFinite(t.ts)) {
        dbg('⚠️ В теме нет unix → отбрасываем', t);
        tBuf.shift(); return step();
      }
      dbg('Сравнение:', {
        post: {ts: p.ts, when:isFinite(p.ts)?formatUnix(p.ts):'NaN', href:p.href},
        topic:{ts: t.ts, when:isFinite(t.ts)?formatUnix(t.ts):'NaN', href:t.href}
      });

      if (p.ts > t.ts) {
        dbg('➡️ post.ts > topic.ts → берём этот пост');
        pBuf.shift();
        done=true; clearTimeout(timer);
        setLink($slot, p.href, p.ts);
        return;
      } else if (p.ts === t.ts) {
        dbg('↔️ post.ts == topic.ts → вероятно первый пост темы → выкидываем оба и идём дальше');
        pBuf.shift(); tBuf.shift();
        return step();
      } else {
        dbg('⬅️ topic.ts > post.ts → наш пост старее последнего в теме → берём следующий пост');
        pBuf.shift();
        return step();
      }
    }

    // старт
    step();
  });
})();
