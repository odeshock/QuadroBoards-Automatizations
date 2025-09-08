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

  var TOPIC_TITLE = "уавмаумув";          // <- твой заголовок
  var FORUM_IDS   = [];                // <- пусто = искать везде; иначе [8,19]
  var PROFILE_RIGHT_SEL = "#viewprofile #profile-right";
  var REQUEST_TIMEOUT_MS = 6000;

  // Сколько страниц максимум обходить, если тема не на первой
  var MAX_PAGES = 10;

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
        <span>Последний пост в «${TOPIC_TITLE}»${FORUM_IDS.length?` (разделы ${FORUM_IDS.join(",")})`:""}:</span>
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

  // печатаем темы на странице и возвращаем ссылку на первый пост в нужной теме (если есть)
  function findFirstMatchAndLog($doc) {
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
            log('нашли тему "', TOPIC_TITLE, '":', title, "→", link);
          }
        }
      }
    });

    var uniq = Array.from(new Set(allTopics));
    log("темы в выдаче поиска:", uniq);
    return link;
  }

  // достаём из выдачи ссылку «следующая страница», если она есть
  function getNextPageUrl($doc) {
    var $next = $doc.find(".linkst .pagelink a.next").first();
    if ($next.length) return $next.attr("href");
    // иногда внизу: .linksb
    $next = $doc.find(".linksb .pagelink a.next").first();
    if ($next.length) return $next.attr("href");
    return null;
  }

  $(function () {
    if (!/\/profile\.php\b/i.test(location.pathname)) { log("не профиль — выходим"); return; }

    var $slot = insertSlot();
    if (!$slot || !$slot.length) { log("слот не вставился"); return; }

    var userName = resolveUserName();
    log("итоговое имя пользователя:", userName || "(пусто)");
    if (!userName) { setEmpty($slot, "не удалось определить ник"); return; }

    // Базовый URL поиска (без параметров страниц)
    var base = "/search.php?action=search"
             + "&keywords="
             + "&author=" + encodeURIComponent(userName)
             + "&search_in=1&sort_by=0&sort_dir=DESC&show_as=posts";

    // Если ограничиваем форумами — добавим ДВА варианта параметров для совместимости
    if (FORUM_IDS.length) {
      var ids = encodeURIComponent(FORUM_IDS.join(","));
      base += "&forum=" + ids + "&forums=" + ids;
    }

    log("база запроса:", base);

    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      setEmpty($slot, "таймаут запроса к поиску");
    }, REQUEST_TIMEOUT_MS);

    // рекурсивный обход страниц поиска
    var visited = 0;
    function crawl(url) {
      if (done) return;
      if (++visited > MAX_PAGES) {
        log("достигли лимита страниц =", MAX_PAGES);
        done = true;
        clearTimeout(timer);
        setEmpty($slot, `не нашли "${TOPIC_TITLE}" на первых ${MAX_PAGES} стр.`);
        return;
      }
      // если url без &p= — используем base, иначе берём как есть
      var pageUrl = url || base;
      log(`сканирую страницу #${visited}:`, pageUrl);

      $.get(pageUrl, function (html) {
        if (done) return;
        // сбрасываем таймер на каждую полученную страницу
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (done) return;
          done = true;
          setEmpty($slot, "таймаут запроса к поиску");
        }, REQUEST_TIMEOUT_MS);

        log("получен ответ, длина:", html ? html.length : 0);
        if (isAccessDenied(html)) { done = true; clearTimeout(timer); return setEmpty($slot, "доступ к поиску закрыт"); }
        if (isEmptySearch(html))  { done = true; clearTimeout(timer); return setEmpty($slot, "поиск ничего не нашёл"); }

        try {
          var $doc = $(html);
          var href = findFirstMatchAndLog($doc);
          if (href) {
            done = true;
            clearTimeout(timer);
            setLink($slot, href);
            return;
          }
          var next = getNextPageUrl($doc);
          if (next) {
            crawl(next); // идём дальше
          } else {
            done = true;
            clearTimeout(timer);
            setEmpty($slot, `нет постов в теме "${TOPIC_TITLE}"`);
          }
        } catch (e) {
          console.log("[bank-link] ошибка разбора:", e);
          done = true;
          clearTimeout(timer);
          setEmpty($slot, "ошибка разбора результата");
        }
      }, "html").fail(function () {
        if (done) return;
        clearTimeout(timer);
        console.log("[bank-link] ошибка сети при загрузке search.php");
        done = true;
        setEmpty($slot, "ошибка загрузки поиска");
      });
    }

    // Стартуем с базовой страницы (1-я). Далее crawl сам перейдёт на &p=2, &p=3 …
    crawl(null);
  });
})();
