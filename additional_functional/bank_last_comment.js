// ==UserScript==
// @name         Profile: last post in "банк" via search (forums 8 & 19) — with logs & robust username
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

  function log(){ console.log("[bank-link]", ...arguments); }

  // --- НОВОЕ: надёжное определение ника (асинхронно) ---
  function getUserIdFromURL() {
    var m = location.search.match(/[?&]id=(\d+)/);
    return m ? +m[1] : null;
  }
  function cleanNick(s){
    return (s||"").replace(/^Профиль:\s*/i,"").replace(/[«»]/g,"").trim();
  }
  function resolveUserName() {
    return new Promise(function(resolve){
      // 1) DOM-варианты на странице профиля
      var candidates = [
        $("#viewprofile h1 span").text(),
        $("#viewprofile h1").text(),
        $('#viewprofile #profile-right .pa-author strong').first().text(),
        $('#viewprofile #profile-left .pa-author strong').first().text(),
      ].map(cleanNick).filter(Boolean);

      if (candidates[0]) { log("ник из DOM (h1/span):", candidates[0]); return resolve(candidates[0]); }
      if (candidates[1]) { log("ник из DOM (h1):", candidates[1]);     return resolve(candidates[1]); }
      if (candidates[2]) { log("ник из правой панели:", candidates[2]); return resolve(candidates[2]); }
      if (candidates[3]) { log("ник из левой панели:", candidates[3]);  return resolve(candidates[3]); }

      // 2) <title>
      var fromTitle = cleanNick(document.title);
      if (fromTitle) { log("ник из <title>:", fromTitle); return resolve(fromTitle); }

      // 3) Фолбэк: подтянем эту же страницу без шапки и распарсим
      var uid = getUserIdFromURL();
      if (!uid) { log("uid не найден, имя не извлечь"); return resolve(null); }
      var url = "/profile.php?id=" + uid + "&nohead=1";
      log("тянем nohead для ника:", url);
      $.get(url, function(html){
        try {
          var $doc = $(html);
          var tryList = [
            $doc.find("#viewprofile h1 span").text(),
            $doc.find("#viewprofile h1").text(),
            $doc.find('#viewprofile #profile-right .pa-author strong').first().text(),
            $doc.find('#viewprofile #profile-left .pa-author strong').first().text()
          ].map(cleanNick).filter(Boolean);
          var name = tryList[0] || tryList[1] || tryList[2] || tryList[3] || null;
          log("ник из nohead:", name);
          resolve(name);
        } catch(e){
          log("ошибка парсинга nohead:", e);
          resolve(null);
        }
      },"html").fail(function(){
        log("nohead не загрузился");
        resolve(null);
      });
    });
  }
  // -----------------------------------------------------

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

  $(async function () {
    const $slot = insertSlot();
    if (!$slot || !$slot.length) { log("нет слота, выходим"); return; }

    const userName = await resolveUserName();
    log("итоговое имя пользователя:", userName);
    if (!userName) { setEmpty($slot, "не удалось определить ник"); return; }

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
      log("получен ответ от search.php, длина:", html ? html.length : 0);

      if (isAccessDenied(html)) { finishOnce(function(){ setEmpty($slot, "доступ к поиску закрыт"); }); return; }
      if (isEmptySearch(html))  { finishOnce(function(){ setEmpty($slot, "поиск ничего не нашёл"); }); return; }

      try {
        var $doc = $(html);
        var href = findFirstBankPostLink($doc);
        if (href) finishOnce(function(){ setLink($slot, href); });
        else      finishOnce(function(){ setEmpty($slot, "нет постов в теме «банк»"); });
      } catch (e) {
        log("ошибка разбора:", e);
        finishOnce(function(){ setEmpty($slot, "ошибка разбора результата"); });
      }
    }, "html").fail(function () {
      if (done) return;
      clearTimeout(timer);
      log("ошибка сети при загрузке search.php");
      finishOnce(function(){ setEmpty($slot, "ошибка загрузки поиска"); });
    });
  });
})();
