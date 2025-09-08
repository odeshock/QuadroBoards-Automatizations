// ==UserScript==
// @name         Profile: last post in "банк" via search (8&19) — jQuery + logs
// @match        https://followmyvoice.rusff.me/*
// @match        http://followmyvoice.rusff.me/*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  if (!window.jQuery) { console.log("[bank-link] jQuery not found"); return; }
  var $ = jQuery;

  var TOPIC_TITLE = "hideprofile";          // <- твой заголовок
  var FORUM_IDS = [];                  // <- пусто = искать по всем разделам
  var PROFILE_RIGHT_SEL = "#viewprofile #profile-right";
  var REQUEST_TIMEOUT_MS = 6000;

  $("<style>").text(`
    #pa-bank-link a.is-empty{
      color:#999!important;text-decoration:none!important;
      pointer-events:none;cursor:default;opacity:.8;
    }`).appendTo(document.head || document.documentElement);

  function log(){ console.log("[bank-link]", ...arguments); }

  function insertSlot() {
    var $right = $(PROFILE_RIGHT_SEL);
    if (!$right.length) return null;
    var $li = $(`
      <li id="pa-bank-link">
        <span>Последний пост в «${TOPIC_TITLE}» (разделы ${FORUM_IDS.length?FORUM_IDS.join(","):"все"}):</span>
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

  function resolveUserName() {
    var name = $("#profile-name > strong").first().text().trim();
    if (name) { log("ник из #profile-name:", name); return name; }
    var cands = [
      $("#viewprofile h1 span").text(),
      $("#viewprofile h1").text(),
      $("#viewprofile #profile-right .pa-author strong").first().text(),
      $("#viewprofile #profile-left .pa-author strong").first().text(),
      (document.title || "")
    ].map(s => (s||"").replace(/^Профиль:\s*/i,"").replace(/[«»]/g,"").trim()).filter(Boolean);
    if (cands.length) { log("ник из DOM:", cands[0]); return cands[0]; }
    log("ник не найден");
    return null;
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

  // LOG: собираем и печатаем все темы, найденные на странице поиска;
  // возвращаем ссылку на первый пост в теме с нужным названием
  function findFirstBankPostLinkAndLog($doc) {
    var tt = TOPIC_TITLE.toLowerCase();
    var allTopics = [];
    var link = null;

    $doc.find("div.post").each(function () {
      var $p = $(this);
      var $topic = $p.find("h3 a[href*='viewtopic.php?id=']").last();
      if ($topic.length) {
        var title = $topic.text().trim();
        allTopics.push(title);
        if (!link && title.toLowerCase() === tt) {
          var $msg = $p.find(".post-links a[href*='viewtopic.php?pid=']").first();
          if ($msg.length) {
            link = $msg.attr("href");
            // LOG: нашли совпадение — показываем тему и ссылку
            log('нашли тему совпадающую с "', TOPIC_TITLE, '":', title, "→", link);
          }
        }
      }
    });

    // LOG: выведем уникальные заголовки тем, встреченных в выдаче
    var uniq = Array.from(new Set(allTopics));
    log("темы в выдаче поиска:", uniq);

    return link;
  }

  $(function () {
    if (!/\/profile\.php\b/i.test(location.pathname)) { log("не профиль — выходим"); return; }

    var $slot = insertSlot();
    if (!$slot || !$slot.length) { log("слот не вставился"); return; }

    var userName = resolveUserName();
    log("итоговое имя пользователя:", userName || "(пусто)");
    if (!userName) { setEmpty($slot, "не удалось определить ник"); return; }

    var url = "/search.php?action=search"
            + "&keywords="
            + "&author=" + encodeURIComponent(userName)
            + (FORUM_IDS.length ? "&forum=" + encodeURIComponent(FORUM_IDS.join(",")) : "")
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
      log("получен ответ, длина:", html ? html.length : 0);

      if (isAccessDenied(html)) { finishOnce(function () { setEmpty($slot, "доступ к поиску закрыт"); }); return; }
      if (isEmptySearch(html))  { finishOnce(function () { setEmpty($slot, "поиск ничего не нашёл"); }); return; }

      try {
        var $doc = $(html);
        var href = findFirstBankPostLinkAndLog($doc); // LOG: здесь и печатаем
        if (href) finishOnce(function () { setLink($slot, href); });
        else      finishOnce(function () { setEmpty($slot, 'нет постов в теме "'+TOPIC_TITLE+'"'); });
      } catch (e) {
        console.log("[bank-link] ошибка разбора:", e);
        finishOnce(function () { setEmpty($slot, "ошибка разбора результата"); });
      }
    }, "html").fail(function () {
      if (done) return;
      clearTimeout(timer);
      console.log("[bank-link] ошибка сети при загрузке search.php");
      finishOnce(function () { setEmpty($slot, "ошибка загрузки поиска"); });
    });
  });
})();
