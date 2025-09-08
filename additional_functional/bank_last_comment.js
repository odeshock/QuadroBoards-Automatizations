// ==UserScript==
// @name         Profile → last post in topic by title (search with pagination)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  if (!window.jQuery) return;
  var $ = jQuery;

  // ==== настройки ====
  var TOPIC_TITLE = "hideprofile";   // искомый заголовок темы
  var FORUM_IDS   = [];         // [] = искать везде; иначе, например: [8,19]
  var REQUEST_TIMEOUT_MS = 6000;
  var MAX_PAGES = 10;
  var PROFILE_RIGHT_SEL = "#viewprofile #profile-right";

  // запуск строго на /profile.php?id=...
  if (!/\/profile\.php$/i.test(location.pathname)) return;
  if (!/[?&]id=\d+/.test(location.search)) return;

  // оформление «пустого» состояния
  $("<style>").text(`
    #pa-bank-link a.is-empty{
      color:#999!important;text-decoration:none!important;
      pointer-events:none;cursor:default;opacity:.8;
    }`).appendTo(document.head || document.documentElement);

  function insertSlot() {
    var $right = $(PROFILE_RIGHT_SEL);
    if (!$right.length) return null;
    var scope = FORUM_IDS.length ? ` (разделы ${FORUM_IDS.join(",")})` : "";
    var $li = $(`
      <li id="pa-bank-link">
        <span>Полезные ссылки</span>
        <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a></strong>
      </li>
    `);
    $right.prepend($li);
    return $li.find("a");
  }
  function setEmpty($a, reason) {
    var text = "Последняя банковская операция не найдена";
    $a.addClass("is-empty").attr({ href:"#", title: reason || text }).text(text);
  }
  function setLink($a, href) {
    $a.removeClass("is-empty").attr({ href }).text("Последняя банковская операция");
  }
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
  function isAccessDenied(html) {
    var s = (html||"").toLowerCase();
    return s.includes('id="pun-login"') ||
           s.includes("недостаточно прав") ||
           s.includes("вы не авторизованы") ||
           s.includes("нет доступа");
  }
  function isEmptySearch(html) {
    var s = (html||"").toLowerCase();
    return s.includes("по вашему запросу ничего не найдено") ||
           !/<div[^>]+class="post\b/i.test(html||"");
  }
  function findFirstMatch($doc) {
    var tt = TOPIC_TITLE.toLowerCase();
    var link = null;
    $doc.find("div.post").each(function () {
      var $p = $(this);
      var $topic = $p.find("h3 a[href*='viewtopic.php?id=']").last();
      if ($topic.length && $topic.text().trim().toLowerCase() === tt) {
        var $msg = $p.find(".post-links a[href*='viewtopic.php?pid=']").first();
        if ($msg.length) { link = $msg.attr("href"); return false; }
      }
    });
    return link;
  }
  function getNextPageUrl($doc) {
    var $next = $doc.find(".linkst .pagelink a.next").first();
    if ($next.length) return $next.attr("href");
    $next = $doc.find(".linksb .pagelink a.next").first();
    if ($next.length) return $next.attr("href");
    return null;
  }

  $(function () {
    var $slot = insertSlot();
    if (!$slot || !$slot.length) return;

    var userName = resolveUserName();
    if (!userName) { setEmpty($slot, "не удалось определить ник"); return; }

    // базовый URL поиска
    var base = "/search.php?action=search"
             + "&keywords="
             + "&author=" + encodeURIComponent(userName)
             + "&search_in=1&sort_by=0&sort_dir=DESC&show_as=posts";
    if (FORUM_IDS.length) {
      var ids = encodeURIComponent(FORUM_IDS.join(","));
      base += "&forum=" + ids + "&forums=" + ids; // совместимость
    }

    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      setEmpty($slot, "таймаут запроса к поиску");
    }, REQUEST_TIMEOUT_MS);

    var visited = 0;
    function crawl(url) {
      if (done) return;
      if (++visited > MAX_PAGES) {
        done = true;
        clearTimeout(timer);
        setEmpty($slot, `не нашли "${TOPIC_TITLE}" на первых ${MAX_PAGES} стр.`);
        return;
      }
      var pageUrl = url || base;

      $.get(pageUrl, function (html) {
        if (done) return;
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (done) return;
          done = true;
          setEmpty($slot, "таймаут запроса к поиску");
        }, REQUEST_TIMEOUT_MS);

        if (isAccessDenied(html)) { done = true; clearTimeout(timer); setEmpty($slot, "доступ к поиску закрыт"); return; }
        if (isEmptySearch(html))  { done = true; clearTimeout(timer); setEmpty($slot, "поиск ничего не нашёл"); return; }

        try {
          var $doc = $(html);
          var href = findFirstMatch($doc);
          if (href) {
            done = true;
            clearTimeout(timer);
            setLink($slot, href);
            return;
          }
          var next = getNextPageUrl($doc);
          if (next) crawl(next);
          else { done = true; clearTimeout(timer); setEmpty($slot, `нет постов в теме "${TOPIC_TITLE}"`); }
        } catch (e) {
          done = true;
          clearTimeout(timer);
          setEmpty($slot, "ошибка разбора результата");
        }
      }, "html").fail(function () {
        if (done) return;
        clearTimeout(timer);
        done = true;
        setEmpty($slot, "ошибка загрузки поиска");
      });
    }

    crawl(null);
  });
})();
