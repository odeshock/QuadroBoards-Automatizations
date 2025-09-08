// ==UserScript==
// @name         Profile → "Последний пост:" (форумы 3,6; посты vs темы; дата + TZ)
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

  // попытка достать часовой пояс из профиля/страницы
  function detectProfileTZ() {
    // 1) попробуем найти что-то вроде "(UTC+03:00)" / "GMT +3" в видимом профиле
    var txt = $("#viewprofile").text() || "";
    var m = txt.match(/UTC\s*([+\-]\d{1,2})(?::?(\d{2}))?/i) || txt.match(/GMT\s*([+\-]\d{1,2})/i);
    if (m) {
      var hh = parseInt(m[1],10), mm = m[2] ? parseInt(m[2],10) : 0;
      return { type:"offset", minutes: hh*60 + (hh>=0?mm:-mm) };
    }
    // 2) некоторые сборки кладут offset в cookie (попробуем типовые)
    var ck = document.cookie;
    var m2 = ck.match(/(?:punbb_tz|timezone|tzoffset)=([+\-]?\d{1,3})/i);
    if (m2) return { type:"offset", minutes: parseInt(m2[1],10) };
    // 3) по умолчанию — системная таймзона браузера
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) return { type:"iana", zone: tz };
    } catch(e){}
    return { type:"browser" };
  }
  var TZ = detectProfileTZ();

  function formatUnix(sec) {
    var d = new Date(sec*1000);
    // Если нашли явный offset — отформатируем «по-старинке», смещая время вручную.
    if (TZ.type === "offset") {
      var d2 = new Date(d.getTime() + (TZ.minutes - d.getTimezoneOffset())*60000);
      return fmtRu(d2);
    }
    // Если есть IANA — используем Intl с этой зоной
    try {
      var zone = (TZ.type==="iana") ? TZ.zone : undefined;
      var f = new Intl.DateTimeFormat('ru-RU', {
        timeZone: zone,
        year: 'numeric', month: 'long', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      // «18 апреля 2022 г., 18:10:10» → уберём «г.,»
      return f.format(d).replace(/\s*г\.,?\s*/,' ').replace(/\u202F/g,' ');
    } catch(e){
      return fmtRu(d);
    }
  }
  function fmtRu(dateObj){
    var months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    function pad(n){ return (n<10?"0":"")+n; }
    return dateObj.getDate()+" "+months[dateObj.getMonth()]+" "+dateObj.getFullYear()+" "+pad(dateObj.getHours())+":"+pad(dateObj.getMinutes())+":"+pad(dateObj.getSeconds());
    // без «г.» как просили
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
    // колонка "Последнее сообщение" — ссылка вида ...#pNN; на многих сборках в <a> кликабельно
    $doc.find("tbody.hasicon tr").each(function(){
      var $tr = $(this);
      var $last = $tr.find("td.tcr a[href*='#p']");
      if (!$last.length) return;
      var href = $last.attr("href");
      // На некоторых темах рядом нет unix — часто он зашит в data-атрибуты в выдаче. Попробуем найти.
      // В test/русфф выдаче unix кладут в <div class="post" data-posted="..."> на странице "посты";
      // В "темах" его нет — поэтому ориентируемся на текст даты + сервер: НО пользователь писал, что unix есть в обоих выдачах.
      // Если на вашей сборке есть data-posted в <tr> — распознайте:
      var ts = NaN;
      var m = ($last.text()||"").match(/(\d{4})\-(\d{2})\-(\d{2})\s+(\d{2})[:.](\d{2})[:.](\d{2})/); // ISO-like
      if (m) {
        ts = Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]) / 1000;
      }
      // Если unix не извлекли — ставим NaN; такие записи проиграют сравнение.
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
    if (!userName) { setEmpty($slot, "не удалось определить ник"); return; }

    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      setEmpty($slot, "таймаут");
    }, REQUEST_TIMEOUT_MS);

    var pPage=1, tPage=1, pBuf=[], tBuf=[], pEnd=false, tEnd=false;

    function refill(which, cb) {
      if (done) return;
      var url = which==="posts" ? buildPostsURL(userName, pPage) : buildTopicsURL(userName, tPage);
      $.get(url, function(html){
        if (done) return;
        clearTimeout(timer);
        timer = setTimeout(function(){ if(!done){ done=true; setEmpty($slot,"таймаут"); } }, REQUEST_TIMEOUT_MS);

        if (isAccessDenied(html)) { done=true; clearTimeout(timer); setEmpty($slot, "доступ закрыт"); return; }
        if (which==="posts" ? isEmptySearchPosts(html) : isEmptySearchTopics(html)) {
          if (which==="posts") { pBuf=[]; pEnd=true; }
          else { tBuf=[]; tEnd=true; }
          cb(); return;
        }
        var $doc = $(html);
        if (which==="posts") {
          pBuf = parsePosts(html);
          if (!getNextPageUrlPosts($doc) || pPage>=MAX_PAGES) pEnd = true;
          else pPage++;
        } else {
          tBuf = parseTopics(html);
          if (!getNextPageUrlTopics($doc) || tPage>=MAX_PAGES) tEnd = true;
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

      // заполняем буферы по необходимости
      if (!pBuf.length && !pEnd) return refill("posts", step);
      if (!tBuf.length && !tEnd) return refill("topics", step);

      // если оба пусты — финиш
      if (!pBuf.length && !tBuf.length) { done=true; clearTimeout(timer); setEmpty($slot); return; }

      // если темы пусты — просто берём верхний пост
      if (!tBuf.length) {
        var p = pBuf.shift();
        if (isFinite(p.ts)) { done=true; clearTimeout(timer); setLink($slot, p.href, p.ts); return; }
        return step();
      }
      // если посты пусты — догружаем посты
      if (!pBuf.length) return refill("posts", step);

      // сравнение верхних элементов
      var p = pBuf[0], t = tBuf[0];
      // если в темах нет unix — отбрасываем такие темы
      if (!isFinite(t.ts)) { tBuf.shift(); return step(); }

      if (p.ts > t.ts) {
        // пост позднее последнего сообщения темы → это «не первый пост в теме»
        pBuf.shift();
        done=true; clearTimeout(timer);
        setLink($slot, p.href, p.ts);
        return;
      } else if (p.ts === t.ts) {
        // совпало по времени → это, скорее всего, первый пост в этой теме — выкидываем оба и идём дальше
        pBuf.shift(); tBuf.shift();
        return step();
      } else {
        // последний апдейт темы позже, чем наш пост → наш пост не «последний» относительно темы,
        // значит, сравниваем со следующим постом
        pBuf.shift();
        return step();
      }
    }

    // старт
    step();
  });
})();
