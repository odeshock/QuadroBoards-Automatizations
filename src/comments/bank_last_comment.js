// ==UserScript==
// @name         Profile → last post in topic by title (search with pagination)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  if (!window.jQuery) return;
  var $ = jQuery;

  var PROFILE_RIGHT_SEL = "#viewprofile #profile-right";

  // запуск строго на /profile.php?id=...
  if (!/\/profile\.php$/i.test(location.pathname)) return;
  if (!/[?&]id=\d+/.test(location.search)) return;
  console.log("на месте");

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
        <span>Банковские операции:</span>
        <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a></strong>
      </li>
    `);
    var $after = $right.find('#pa-last-visit');
    if ($after.length) {
      $li.insertAfter($after);
    } else {
      $right.append($li);
    }
    return $li.find("a");
  }
  function setEmpty($a, reason) {
    var text = "Не найдена";
    $a.addClass("is-empty").attr({ href:"#", title: reason || text }).text(text);
  }
  function setLink($a, href) {
    $a.removeClass("is-empty").attr({ href }).text("Последняя");
  }

  $(async function () {
    var $slot = insertSlot();
    if (!$slot || !$slot.length) return;

    if (typeof window.scrapePosts !== "function") {
      setEmpty($slot, "нет доступа к поиску");
      return;
    }

    if (!window.UserLogin || !window.SITE_URL) {
      setEmpty($slot, "нет данных пользователя");
      return;
    }

    var forums = Array.isArray(window.BANK_FORUMS) ? window.BANK_FORUMS : [];

    try {
      var posts = await window.scrapePosts(
        window.UserLogin,
        forums,
        {
          title_prefix: "Гринготтс",
          stopOnFirstNonEmpty: true,
          keywords: "ДОХОДЫ OR РАСХОДЫ AND ИТОГО"
        }
      );

      if (Array.isArray(posts) && posts.length && posts[0]?.src) {
        var href = String(window.SITE_URL || "").replace(/\/$/, "") + "/viewtopic.php?" + posts[0].src;
        setLink($slot, href);
      } else {
        setEmpty($slot);
      }
    } catch (err) {
      console.error("[bank_last_comment] scrapePosts failed", err);
      setEmpty($slot, "ошибка поиска");
    }
  });
})();
