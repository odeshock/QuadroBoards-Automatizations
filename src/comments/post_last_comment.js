// ==UserScript==
// @name         Profile → "Последний пост:" (форумы 3,6; show_user_topics; сравнение по unix/теме; дата + TZ)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  if (!window.jQuery) return;
  var $ = jQuery;

  // === настройки ===
  var FORUM_IDS = [11, 12, 13, 20, 21, 23, 24];
  var REQUEST_TIMEOUT_MS = 8000;
  var MAX_PAGES = 20; // лимит на поток
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
    var $li = $(`
      <li id="pa-lastpost-link">
        <span>Последний пост:</span>
        <strong>
          <a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a>
        </strong>
      </li>
    `);
    var $after = $right.find('#pa-last-visit');
    if ($after.length) $li.insertAfter($after); else $right.append($li);
    return $li;
  }
  function setEmpty($slot, reason) {
    var text = "Не найден";
    $slot.find("a").addClass("is-empty").attr({ href:"#", title: reason || text }).text(text);
  }
  function setLink($slot, href, ts) {
    $slot.find("a").removeClass("is-empty").attr({ href }).text(formatUnix(ts));
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

  // часовой пояс
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

  // парсинг «Сегодня/Вчера/дата»
  function parseRuMoment(text) {
    text = (text||"").trim().toLowerCase();
    // варианты: "Сегодня 01:07:11", "Вчера 23:51:19", "18 апреля 2022 18:10:10"
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var t;
    var m;
    if (/^сегодня\s+\d{1,2}:\d{2}:\d{2}$/.test(text)) {
      m = text.match(/(\d{1,2}):(\d{2}):(\d{2})/);
      t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), +m[1], +m[2], +m[3]);
      return Math.floor(t.getTime()/1000);
    }
    if (/^вчера\s+\d{1,2}:\d{2}:\d{2}$/.test(text)) {
      m = text.match(/(\d{1,2}):(\d{2}):(\d{2})/);
      var yest = new Date(today.getTime() - 86400000);
      t = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), +m[1], +m[2], +m[3]);
      return Math.floor(t.getTime()/1000);
    }
    // «18 апреля 2022 18:10:10»
    var months = {января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11};
    m = text.match(/^(\d{1,2})\s+([а-я]+)\s+(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/i);
    if (m && months[m[2]]!=null) {
      t = new Date(+m[3], months[m[2]], +m[1], +m[4], +m[5], +m[6]);
      return Math.floor(t.getTime()/1000);
    }
    // если формат неизвестен — NaN
    return NaN;
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
  function isEmptySearchUserTopics(html) {
    var s = (html||"").toLowerCase();
    return s.includes("по вашему запросу ничего не найдено") ||
           !/<div[^>]+class="forum\b/i.test(html||"");
  }

  // helpers
  function getTopicIdFromHref(href) {
    var m = (href||"").match(/viewtopic\.php\?id=(\d+)/i);
    return m ? +m[1] : NaN;
  }
  function getForumIdFromHref(href) {
    var m = (href||"").match(/viewforum\.php\?id=(\d+)/i);
    return m ? +m[1] : NaN;
  }

  // парсер R1 (посты)
  function parsePosts(html) {
    var $doc = $(html);
    var out = [];
    $doc.find("div.post").each(function(){
      var $p = $(this);
      var ts = parseInt($p.attr("data-posted"),10);
      var $lnk = $p.find(".post-links a[href*='viewtopic.php?pid=']").first();
      var href = $lnk.length ? $lnk.attr("href") : null;
      var topicId = NaN;
      // попробуем достать topicId из заголовка поста
      var $topic = $p.find("h3 a[href*='viewtopic.php?id=']").last();
      if ($topic.length) topicId = getTopicIdFromHref($topic.attr("href"));
      if (ts && href) out.push({ ts, href, topicId });
    });
    return out;
  }
  // парсер R2 (show_user_topics) — фильтруем по forumId ∈ FORUM_IDS
  function parseUserTopics(html) {
    var $doc = $(html);
    var out = [];
    $doc.find("tbody.hasicon tr").each(function(){
      var $tr = $(this);
      var $forum = $tr.find("td.tc2 a[href*='viewforum.php?id=']");
      var forumId = $forum.length ? getForumIdFromHref($forum.attr("href")) : NaN;
      if (!FORUM_IDS.includes(forumId)) return; // фильтр 3/6

      var $topicA = $tr.find("td.tcl a[href*='viewtopic.php?id=']").first();
      var topicId = $topicA.length ? getTopicIdFromHref($topicA.attr("href")) : NaN;

      var $last = $tr.find("td.tcr a[href*='#p']");
      if (!$last.length) return;
      var href = $last.attr("href"); // ссылка на последнее сообщение темы
      // unix рядом с аватаркой — берём текст <a> (Сегодня/Вчера/дата) и парсим
      var whenTxt = ($last.text()||"").trim();
      var ts = parseRuMoment(whenTxt);

      out.push({ ts, href, topicId, forumId });
    });
    return out;
  }

  // пагинация
  function getNextPageUrlPosts($doc) {
    var $next = $doc.find("#pun-searchposts .pagelink a.next").first();
    return $next.length ? $next.attr("href") : null;
  }
  function getNextPageUrlUserTopics($doc) {
    var $next = $doc.find("#pun-searchtopics .pagelink a.next").first();
    return $next.length ? $next.attr("href") : null;
  }

  // URL’ы
  function buildPostsURL(name, page) {
    var ids = FORUM_IDS.join(",");
    return "/search.php?action=search"
      + "&keywords="
      + "&author=" + encodeURIComponent(name)
      + (ids ? "&forum=" + encodeURIComponent(ids) + "&forums=" + encodeURIComponent(ids) : "")
      + "&search_in=1&sort_by=0&sort_dir=DESC&show_as=posts"
      + (page ? "&p="+page : "");
  }
  function buildUserTopicsURL(name, page) {
    // новый источник результата 2
    return "/search.php?action=show_user_topics"
      + "&author=" + encodeURIComponent(name)
      + (page ? "&p="+page : "");
  }

  $(function () {
    var $slot = insertSlot();
    if (!$slot) return;

    var userName = resolveUserName();
    if (!userName) { setEmpty($slot, "не удалось определить ник"); return; }

    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      setEmpty($slot, "таймаут");
    }, REQUEST_TIMEOUT_MS);

    var pPage=1, tPage=1, pBuf=[], tBuf=[], pEnd=false, tEnd=false, pPagesUsed=0, tPagesUsed=0;

    function refill(which, cb) {
      if (done) return;
      var url = which==="posts" ? buildPostsURL(userName, pPage) : buildUserTopicsURL(userName, tPage);
      $.get(url, function(html){
        if (done) return;
        clearTimeout(timer);
        timer = setTimeout(function(){ if(!done){ done=true; setEmpty($slot,"таймаут"); } }, REQUEST_TIMEOUT_MS);

        if (isAccessDenied(html)) { done=true; clearTimeout(timer); setEmpty($slot, "доступ закрыт"); return; }
        if (which==="posts" ? isEmptySearchPosts(html) : isEmptySearchUserTopics(html)) {
          if (which==="posts") { pBuf=[]; pEnd=true; }
          else { tBuf=[]; tEnd=true; }
          cb(); return;
        }
        var $doc = $(html);
        if (which==="posts") {
          pBuf = parsePosts(html);
          var hasNext = !!getNextPageUrlPosts($doc);
          pPagesUsed++;
          if (!hasNext || pPagesUsed>=MAX_PAGES) pEnd = true;
          else pPage++;
        } else {
          tBuf = parseUserTopics(html);
          var hasNext2 = !!getNextPageUrlUserTopics($doc);
          tPagesUsed++;
          if (!hasNext2 || tPagesUsed>=MAX_PAGES) tEnd = true;
          else tPage++;
        }
        cb();
      }, "html").fail(function(){
        if (done) return;
        clearTimeout(timer);
        done=true;
        setEmpty($slot, "ошибка сети");
      });
    }

    function step() {
      if (done) return;

      // пополняем буферы при необходимости
      if (!pBuf.length && !pEnd) return refill("posts", step);
      if (!tBuf.length && !tEnd) return refill("topics", step);

      // оба пусты — нечего сравнивать
      if (!pBuf.length && !tBuf.length) { done=true; clearTimeout(timer); setEmpty($slot); return; }

      // если тём нет (после фильтра/пусто) — берём верхний пост
      if (!tBuf.length) {
        var p = pBuf.shift();
        if (p && isFinite(p.ts)) { done=true; clearTimeout(timer); setLink($slot, p.href, p.ts); return; }
        return step();
      }
      // если постов нет — догружаем посты (или уже pEnd → значит фейл)
      if (!pBuf.length) {
        if (!pEnd) return refill("posts", step);
        // постов больше нет вовсе → не нашли
        done=true; clearTimeout(timer); setEmpty($slot); return;
      }

      // сравнение верхних элементов по новой логике
      var p = pBuf[0], t = tBuf[0];

      // если у R2 нет корректного unix — попробуем просто инкрементнуть R2
      if (!isFinite(t.ts)) { tBuf.shift(); return step(); }

      if (p.ts > t.ts) {
        // R1 свежее → победа
        pBuf.shift();
        done=true; clearTimeout(timer);
        setLink($slot, p.href, p.ts);
        return;
      } else if (p.ts === t.ts) {
        // равенство по времени → сравниваем темы
        if (p.topicId && t.topicId && p.topicId === t.topicId) {
          // это первый пост в этой теме → скипаем оба
          pBuf.shift(); tBuf.shift();
          return step();
        } else {
          // одинаковое время, разные темы → инкремент только результата 2
          tBuf.shift();
          return step();
        }
      } else {
        // p.ts < t.ts → R2 свежее → инкремент R2
        tBuf.shift();
        return step();
      }
    }

    // старт
    step();
  });
})();
