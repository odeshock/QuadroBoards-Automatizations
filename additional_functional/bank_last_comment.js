// ==UserScript==
// @name         Profile: last post in "банк" via search (forums 8 & 19) — with logs
// @match        *://*/profile.php?id=*
// @run-at       document-end
// ==/UserScript==
(function () {
  if (!window.jQuery) return;
  var $ = jQuery;

  var TOPIC_TITLE = "банк";
  var FORUM_IDS   = [8, 19];
  var PROFILE_RIGHT_SEL = "#viewprofile #profile-right";
  var REQUEST_TIMEOUT_MS = 6000;

  $("<style>").text(`
    #pa-bank-link a.is-empty {
      color:#999 !important; text-decoration:none !important;
      pointer-events:none; cursor:default; opacity:.8;
    }
  `).appendTo(document.head || document.documentElement);

  function log(...args) {
    console.log("[bank-link]", ...args);
  }

  function getUserName() {
    var raw = $("#viewprofile h1 span").text().trim();
    var name = raw.replace(/^Профиль:\s*/i, "").trim();
    if (!name) name = $('#viewprofile #profile-left .pa-author strong').first().text().trim();
    log("определили имя пользователя:", name);
    return name || null;
  }
  function insertSlot() {
    var $right = $(PROFILE_RIGHT_SEL);
    if (!$right.length) return null;
    var $li = $(`
      <li id="pa-bank-link">
        <span>Последний пост в «${TOPIC_TITLE}» (разделы 8/19):</span>
        <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty" title="идёт поиск">ищу…</a></strong>
      </li>
    `);
    $right.prepend($li);
    log("вставили слот в профиль");
    return $li.find("a");
  }
  function setEmpty($a, reason) {
    var text = "либо войдите как игрок, либо ещё ничего не писал";
    $a.addClass("is-empty").attr({ href:"#", title: reason || text }).text(text);
    log("результат: пусто →", reason || text);
  }
  function setLink($a, href) {
    $a.removeClass("is-empty").attr({ href, title:"перейти к сообщению" }).text("перейти к сообщению");
    log("результат: ссылка найдена →", href);
  }
  function isAccessDenied(html) {
    if (!html || typeof html !== "string") return true;
    var s = html.toLowerCase();
    return s.includes('id="pun-login"') ||
           s.includes("недостаточно прав") ||
           s.includes("вы не авторизованы") ||
           s.includes("нет доступа");
  }
  function isEmptySearch(html) {
    if (!html || typeof html !== "string") return false;
    var s = html.toLowerCase();
    return s.includes("по вашему запросу ничего не найдено") ||
           !/<div[^>]+class="post\b/.test(html);
  }
  function findFirstBankPostLink($doc) {
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

  $(function () {
    var userName = getUserName();
    var $slot = insertSlot();
    if (!userName || !$slot || !$slot.length) {
      log("не нашли профиль или имя пользователя, выходим");
      return;
    }

    var url = "/search.php?action=search"
            + "&keywords="
            + "&author=" + encodeURIComponent(userName)
            + "&forum=" + encodeURIComponent(FORUM_IDS.join(","))
            + "&search_in=1&sort_by=0&sort_dir=DESC&show_as=posts";

    log("формируем запрос:", url);

    var done = false;
    var finishOnce = function (fn) { if (done) return; done = true; fn(); };

    var timer = setTimeout(function () {
      finishOnce(function () { setEmpty($slot, "таймаут запроса к поиску"); });
    }, REQUEST_TIMEOUT_MS);

    $.get(url, function (html) {
      if (done) return;
      clearTimeout(timer);

      log("получен ответ от search.php, длина:", html.length);

      if (isAccessDenied(html)) {
        finishOnce(function () { setEmpty($slot, "доступ к поиску закрыт"); });
        return;
      }
      if (isEmptySearch(html)) {
        finishOnce(function () { setEmpty($slot, "поиск ничего не нашёл"); });
        return;
      }

      try {
        var $doc = $(html);
        var href = findFirstBankPostLink($doc);
        if (href) finishOnce(function () { setLink($slot, href); });
        else      finishOnce(function () { setEmpty($slot, "нет постов в теме «банк»"); });
      } catch (e) {
        finishOnce(function () { setEmpty($slot, "ошибка разбора результата"); });
        log("ошибка разбора:", e);
      }
    }, "html").fail(function () {
      if (done) return;
      clearTimeout(timer);
      finishOnce(function () { setEmpty($slot, "ошибка загрузки поиска"); });
      log("ошибка сети при загрузке search.php");
    });
  });
})();
