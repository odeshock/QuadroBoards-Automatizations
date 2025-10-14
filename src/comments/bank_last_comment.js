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
  console.log('fff');
  function insertSlot() {
    var $right = $(PROFILE_RIGHT_SEL);
    if (!$right.length) return null;
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
  console.log('blyyyyyyy');
  async function ensureScrapePosts(timeoutMs = 8000, intervalMs = 250) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      if (typeof window.scrapePosts === 'function') return true;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
  }

  $(async function () {
    var $slot = insertSlot();
    if (!$slot || !$slot.length) return;

    const hasScrape = await ensureScrapePosts();
    if (!hasScrape) { setEmpty($slot, "нет доступа к поиску"); return; }

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
