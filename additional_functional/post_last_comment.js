// ==UserScript==
// @name         Profile → "Последний пост:" (форумы 3,6; сравнение по ключам; логи; дата + TZ)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  if (!window.jQuery) return;
  if (window.__POST_LAST_GUARD__) return; // защита от двойного запуска
  window.__POST_LAST_GUARD__ = true;

  var $ = jQuery;

  // === настройки ===
  var FORUM_IDS = [3, 6];
  var REQUEST_TIMEOUT_MS = 8000;
  var MAX_PAGES = 20; // на поток
  var PROFILE_RIGHT_SEL = "#viewprofile #profile-right";

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
    var $right = $(PROFILE_RIGHT_SEL);
    if (!$right.length) return null;
    if ($right.find('#pa-lastpost-link').length) return $right.find('#pa-lastpost-link'); // если уже есть — не дублируем

    var $li = $(`
      <li id="pa-lastpost-link">
        <span>Последний пост:</span>
        <strong>
          <a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a>
        </strong>
      </li>
    `);
    var $after = $right.find('#pa-last-visit');
    if ($after.length) $li.insertAfter($after);
    else $right.append($li);
    return $li;
  }
  function setEmpty($slot, reason) {
    var text = "Не найден";
    $slot.find("a").addClass("is-empty").attr({ href:"#", title: reason || text }).text(text);
    console.info('[Последний пост] Завершено: ' + (reason || text));
  }
  function setLink($slot, href, ts) {
    var label = ts ? formatUnix(ts) : 'Открыть пост';
    $slot.find("a").removeClass("is-empty").attr({ href }).text(label);
    console.info('[Последний пост] Результат:', href, ts ? '('+label+')' : '');
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

  // нормализация ключей
  function extractParam(href, name) {
    var m = href.match(new RegExp('[?&]'+name+'=(\\d+)'));
    return m ? m[1] : null;
  }
  function extractPidFromHash(href) {
    var m = href.match(/#p(\d+)/);
    return m ? m[1] : null;
  }
  // Посты (R1): нужно получить topic id (из H3 ссылки) и pid (из .post-links)
  function normalizeKeyFromPost($p) {
    var $topic = $p.find("h3 a[href*='viewtopic.php?id=']").last();
    var topicId = $topic.length ? extractParam($topic.attr("href"), "id") : null;
    var $msg = $p.find(".post-links a[href*='viewtopic.php?pid=']").first();
    var pid = $msg.length ? (extractParam($msg.attr("href"), "pid") || extractPidFromHash($msg.attr("href"))) : null;
    if (topicId && pid) return "id="+topicId+"#p"+pid;
    return null;
  }
  // Темы (R2): берём из tcr <a> — там уже есть id и #pNN; игнорируем &p=
  function normalizeKeyFromTopicRow($tr) {
    var $a = $tr.find("td.tcr a[href*='viewtopic.php']");
    if (!$a.length) return null;
    var href = $a.attr("href");
    var topicId = extractParam(href, "id");
    var pid = extractPidFromHash(href);
    if (topicId && pid) return "id="+topicId+"#p"+pid;
    return null;
  }

  // парсеры
  function parsePosts(html) {
    var $doc = $(html);
    var out = [];
    $doc.find("div.post").each(function(){
      var $p = $(this);
      var ts = parseInt($p.attr("data-posted"),10) || null; // только для вывода
      var key = normalizeKeyFromPost($p);
      var $lnk = $p.find(".post-links a[href*='viewtopic.php?pid=']").first();
      var href = $lnk.length ? $lnk.attr("href") : null;
      if (key && href) out.push({ key, href, ts });
    });
    return out;
  }
  function parseTopics(html) {
    var $doc = $(html);
    var out = [];
    $doc.find("tbody.hasicon tr").each(function(){
      var $tr = $(this);
      var $a = $tr.find("td.tcr a[href*='viewtopic.php']");
      if (!$a.length) return;
      var href = $a.attr("href");
      var key = normalizeKeyFromTopicRow($tr);
      if (key && href) out.push({ key, href });
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
    if (!userName) { setEmpty($slot, "не удалось определить ник"); return; }

    console.group('[Последний пост] Отладка');
    console.log('Форумы:', FORUM_IDS.join(','), 'Пользователь:', userName);

    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      setEmpty($slot, "таймаут");
      console.groupEnd();
    }, REQUEST_TIMEOUT_MS);

    var pPage=1, tPage=1, pBuf=[], tBuf=[], pEnd=false, tEnd=false;

    function refill(which, cb) {
      if (done) return;
      var url = which==="posts" ? buildPostsURL(userName, pPage) : buildTopicsURL(userName, tPage);
      console.log('Загрузка '+(which==='posts'?'R1(посты)':'R2(темы)')+' страница', (which==='posts'?pPage:tPage), url);
      $.get(url, function(html){
        if (done) return;
        clearTimeout(timer);
        timer = setTimeout(function(){ if(!done){ done=true; setEmpty($slot,"таймаут"); console.groupEnd(); } }, REQUEST_TIMEOUT_MS);

        if (isAccessDenied(html)) { done=true; clearTimeout(timer); setEmpty($slot, "доступ закрыт"); console.groupEnd(); return; }
        var empty = which==="posts" ? isEmptySearchPosts(html) : isEmptySearchTopics(html);
        var $doc = $(html);
        if (empty) {
          if (which==="posts") { pBuf=[]; pEnd=true; }
          else { tBuf=[]; tEnd=true; }
          console.log((which==='posts'?'R1':'R2')+': пусто');
          cb(); return;
        }

        if (which==="posts") {
          pBuf = parsePosts(html);
          // лог содержимого
          console.log('R1 items:', pBuf.map(x=>x.key));
          if (!getNextPageUrlPosts($doc) || pPage>=MAX_PAGES) pEnd = true; else pPage++;
        } else {
          tBuf = parseTopics(html);
          console.log('R2 items:', tBuf.map(x=>x.key));
          if (!getNextPageUrlTopics($doc) || tPage>=MAX_PAGES) tEnd = true; else tPage++;
        }
        cb();
      }, "html").fail(function(){
        if (done) return;
        clearTimeout(timer);
        done=true;
        setEmpty($slot, "ошибка сети");
        console.groupEnd();
      });
    }

    function step() {
      if (done) return;

      // заполняем буферы по необходимости
      if (!pBuf.length && !pEnd) return refill("posts", step);
      if (!tBuf.length && !tEnd) return refill("topics", step);

      // если оба пусты — финиш
      if (!pBuf.length && !tBuf.length) { done=true; clearTimeout(timer); setEmpty($slot); console.groupEnd(); return; }

      // если темы пусты — просто берём верхний пост
      if (!tBuf.length) {
        var p = pBuf.shift();
        console.log('R2 пусто, берём R1:', p && p.key);
        if (p) { done=true; clearTimeout(timer); setLink($slot, p.href, p.ts); console.groupEnd(); return; }
        return step();
      }
      // если посты пусты — догружаем посты
      if (!pBuf.length) return refill("posts", step);

      // сравнение верхних элементов по «ключу» (id=#pNN), порядок убывающий уже задан сервером
      var p = pBuf[0], t = tBuf[0];
      if (!p || !t) { // на всякий случай
        if (!p) pBuf.shift();
        if (!t) tBuf.shift();
        return step();
      }
      console.log('Сравнение:', 'R1=', p.key, 'vs', 'R2=', t.key);

      if (p.key !== t.key) {
        // ключи различаются → пост из R1 не является «первым постом темы» → он и есть победитель
        pBuf.shift();
        done=true; clearTimeout(timer);
        console.log('Победа R1: ключи разные');
        setLink($slot, p.href, p.ts);
        console.groupEnd();
        return;
      } else {
        // ключи совпали → это «первый пост темы», выкидываем оба и идём дальше
        console.log('Ключи равны, инкремент обоих списков');
        pBuf.shift(); tBuf.shift();
        return step();
      }
    }

    // старт
    step();
  });
})();
