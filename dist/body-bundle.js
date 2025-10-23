/*!
 * QuadroBoards Automatizations - BODY BUNDLE
 * @version 1.0.0
 */

/* ДАЙСЫ utilities/gamification/dices.js */
// ===== DiceFM (ES5): детерминированно; порядок учитывается только среди одинаковых; причина не влияет =====

// --- утилиты
function dfm_escape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function dfm_insertAtCaret(el, text) {
  el.focus();
  var a = (typeof el.selectionStart === "number") ? el.selectionStart : el.value.length;
  var b = (typeof el.selectionEnd === "number") ? el.selectionEnd : el.value.length;
  el.value = el.value.slice(0, a) + text + el.value.slice(b);
  el.selectionStart = el.selectionEnd = a + text.length;
  try {
    el.dispatchEvent(new Event("input", {
      bubbles: true
    }));
  } catch (e) {}
}

// --- FNV-1a 32-bit hash
function dfm_hash32(str) {
  var h = 0x811c9dc5,
    i, c;
  for (i = 0; i < str.length; i++) {
    c = str.charCodeAt(i);
    h ^= c;
    h = (h >>> 0) * 0x01000193;
  }
  return h >>> 0;
}
// --- xorshift32 ПСГ
function dfm_prng(seed) {
  var x = (seed >>> 0) || 0x9e3779b9;
  return function() {
    x ^= (x << 13);
    x ^= (x >>> 17);
    x ^= (x << 5);
    x >>>= 0;
    return x / 4294967296;
  };
}

function dfm_rng_int(prng, min, max) {
  var r = prng();
  return min + Math.floor(r * (max - min + 1));
}

function dfm_roll_det(n, s, seed) {
  var prng = dfm_prng(seed),
    out = [],
    i;
  for (i = 0; i < n; i++) out.push(dfm_rng_int(prng, 1, s));
  return out;
}

// --- канон (для сида причина игнорируется)
function dfm_canon(n, k, b) {
  var cN = String(parseInt(n, 10));
  var cK = String(parseInt(k, 10));
  var cB = parseInt(b, 10);
  cB = (cB >= 0 ? ("+" + cB) : ("" + cB));
  return cN + ":" + cK + ":" + cB;
}

// --- сид: пост + канон + индекс внутри группы одинаковых тегов
function dfm_makeSeed(postEl, canonStr, groupIndex) {
  var postIdStr = postEl && postEl.id ? postEl.id : "";
  var postIdNum = (postIdStr.match(/\d+/) || [0])[0];
  var posted = postEl ? (postEl.getAttribute("data-posted") || "0") : "0";
  return dfm_hash32("DiceFM|" + postIdNum + "|" + posted + "|" + canonStr + "|" + groupIndex);
}

// --- вставка тега [DiceFM N:K:+B:Причина?] (финальный ":" обязателен)
function dfm_attach() {
  var btn = document.getElementById("dicefm-btn"); // ← НИКАКИХ поисков/созданий submit
  var field = document.getElementById("main-reply");
  if (!btn || !field) return;

  btn.addEventListener("click", function() {
    var cStr = prompt("Сколько дайсов бросаем?", "1");
    if (cStr === null) return;
    var c = parseInt(cStr, 10);
    if (!(c >= 1 && c <= 100)) {
      alert("Значение должно быть в пределах [1;100]");
      return;
    }

    var sStr = prompt("Сколько граней у каждого дайса?", "6");
    if (sStr === null) return;
    var s = parseInt(sStr, 10);
    if (!(s >= 2 && s <= 100000)) {
      alert("Значение должно быть в пределах [2;100000]");
      return;
    }

    var bStr = prompt("Есть ли бонус/штраф?", "+0");
    if (bStr === null) return;
    bStr = (bStr || "").trim();
    if (!/^[+-]?\d+$/.test(bStr)) {
      alert("Нужен формат +1 или -1");
      return;
    }
    var b = parseInt(bStr, 10);
    if (Math.abs(b) > 100000) {
      alert("Абсолютное значение должно быть не больше 100000");
      return;
    }
    var bOut = (b >= 0 ? ("+" + b) : ("" + b));

    var reason = prompt("Причина броска (опционально)", "") || "";
    reason = reason.replace(/\]/g, " ").replace(/\s+/g, " ").trim();

    var tag = "[DiceFM " + c + ":" + s + ":" + bOut + ":" + (reason ? reason : "") + "]";
    dfm_insertAtCaret(field, tag);
  });
}

// --- рендер одного тега → HTML (бонус/штраф — ВНЕ скобок; заголовок NdK)
function dfm_render(n, k, b, reason, seed) {
  var c = parseInt(n, 10),
    s = parseInt(k, 10),
    bonus = parseInt(b, 10);
  if (!(c >= 1 && c <= 100) || !(s >= 2 && s <= 100000) || !(Math.abs(bonus) <= 100000)) throw new Error("Проблема с данными");

  var rolls = dfm_roll_det(c, s, seed),
    i, base = 0,
    list = "";
  for (i = 0; i < rolls.length; i++) {
    base += rolls[i];
    list += (i ? "+" : "") + rolls[i];
  }
  var total = base + bonus;
  var outside = bonus === 0 ? "" : (bonus > 0 ? "+" + bonus : "" + bonus);
  var resultExpr = "(" + list + ")" + outside + "=" + total;

  var header = '<b>Бросок ' + c + 'd' + s + (bonus === 0 ? '' : (bonus > 0 ? ' с бонусом ' + bonus : ' со штрафом ' + bonus)) + '</b>';
  var reasonHTML = reason ? "<br><em>" + dfm_escape(reason) + "</em>" : "";

  return '<div class="quote-box"><blockquote style="text-align:left"><p>' +
    header +
    reasonHTML +
    '<br><br><b>Результат:</b> ' + resultExpr +
    '</p></blockquote></div>';
}

// --- замена тегов (строго двоеточия, финальный ":" обязателен).
// Порядок учитывается ТОЛЬКО внутри группы одинаковых N:K:+B.
function dfm_replace(postContentEl) {
  if (!postContentEl) return;
  var postEl = postContentEl.closest ? postContentEl.closest(".post") : null;
  var before = postContentEl.innerHTML;

  // счётчики по группе канона
  var counters = {}; // { "N:K:+B": nextIndex }

  var after = before.replace(
    /\[(?:DiceFM)\s+(\d+)\s*:\s*(\d+)\s*:\s*([+-]?\d+)\s*:\s*(?:"([^"]*)"|([^\]]*))\s*\]/gi,
    function(match, n, k, b, reasonQ, reasonU) {
      try {
        var reason = ((reasonQ != null ? reasonQ : reasonU) || "").replace(/\s+/g, " ").trim();
        var canon = dfm_canon(n, k, b);
        var idx = (counters[canon] || 0); // 0 для первого такого тега, 1 для второго и т.д.
        counters[canon] = idx + 1;

        var seed = dfm_makeSeed(postEl, canon, idx);
        return dfm_render(n, k, b, reason, seed);
      } catch (e) {
        return match;
      }
    }
  );

  if (after !== before) postContentEl.innerHTML = after;
}

// --- init
function dfm_init() {
  if (typeof FORUM !== "undefined" && !FORUM.topic) return;
  var list = document.querySelectorAll ? document.querySelectorAll(".post-content") : [];
  for (var i = 0; i < list.length; i++) dfm_replace(list[i]);
}

// --- старт
if (window.jQuery) {
  jQuery(function() {
    dfm_attach();
    dfm_init();
  });
  jQuery(document).on('pun_post', function() {
    dfm_init();
  });
  jQuery(document).on('pun_edit', function() {
    dfm_init();
  });
} else {
  if (document.addEventListener) document.addEventListener("DOMContentLoaded", function() {
    dfm_attach();
    dfm_init();
  });
}

/* ЗАМЕНА ДЕФИСОВ utilities/text/hyphens_replacing.js */
/* ----------------------------------------------------------- */
/* ЗАМЕНА ДЕФИСОВ, КОРОТКИХ ТИРЕ, МИНУСОВ НА ДЛИННОЕ ТИРЕ
   если:
   — стоит в начале строки+пробел
   — если отделено пробелами с двух сторон */
/* ----------------------------------------------------------- */

$.fn.fixDashes = function() {
  // расширенные пробелы + BOM/ZWJ/ZWNJ
  var SPACE_CLASS = '[\\s\\u00A0\\u202F\\u2009\\u2002-\\u2008\\u200A\\u200B\\uFEFF\\u200C\\u200D]';
  var SPACE_RE = new RegExp(SPACE_CLASS);
  var ONLY_SPACES_RE = new RegExp('^' + SPACE_CLASS + '*$');

  function isSpace(ch) {
    return !!ch && SPACE_RE.test(ch);
  }

  function isBlankText(s) {
    return !s || ONLY_SPACES_RE.test(s);
  }

  function isDashish(ch) {
    return ch === '-' || ch === '\u2212' || (ch && ch >= '\u2010' && ch <= '\u2015');
  }

  // локальные правила
  var RE_BETWEEN = new RegExp('(' + SPACE_CLASS + ')(?:-|[\\u2010-\\u2015]|\\u2212)(?=' + SPACE_CLASS + ')', 'g');
  // быстрый тест хвоста: ... ␠(dash)[␠]*
  var LEFT_TAIL_HINT = new RegExp(SPACE_CLASS + '(?:-|[\\u2010-\\u2015]|\\u2212)' + SPACE_CLASS + '*$');

  // блочные элементы — границы
  var BLOCK = {
    'ADDRESS': 1,
    'ARTICLE': 1,
    'ASIDE': 1,
    'BLOCKQUOTE': 1,
    'DIV': 1,
    'DL': 1,
    'DT': 1,
    'DD': 1,
    'FIELDSET': 1,
    'FIGCAPTION': 1,
    'FIGURE': 1,
    'FOOTER': 1,
    'FORM': 1,
    'H1': 1,
    'H2': 1,
    'H3': 1,
    'H4': 1,
    'H5': 1,
    'H6': 1,
    'HEADER': 1,
    'HR': 1,
    'LI': 1,
    'MAIN': 1,
    'NAV': 1,
    'OL': 1,
    'P': 1,
    'PRE': 1,
    'SECTION': 1,
    'TABLE': 1,
    'THEAD': 1,
    'TBODY': 1,
    'TFOOT': 1,
    'TR': 1,
    'TD': 1,
    'TH': 1,
    'UL': 1
  };
  var SKIP_TAG = {
    'SCRIPT': 1,
    'STYLE': 1,
    'CODE': 1,
    'PRE': 1,
    'KBD': 1,
    'SAMP': 1
  };

  function lastNonSpaceIdx(s) {
    for (var i = s.length - 1; i >= 0; i--)
      if (!isSpace(s.charAt(i))) return i;
    return -1;
  }

  function firstNonSpaceIdx(s) {
    for (var i = 0; i < s.length; i++)
      if (!isSpace(s.charAt(i))) return i;
    return -1;
  }

  function firstTextDesc(node) {
    var stack = [node],
      n, c;
    while (stack.length) {
      n = stack.shift();
      for (c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3 && !isBlankText(c.nodeValue)) return c;
        if (c.nodeType === 1) {
          var tag = c.nodeName.toUpperCase();
          if (SKIP_TAG[tag]) continue;
          stack.push(c);
        }
      }
    }
    return null;
  }

  function inQuoteBox(el) {
    for (var n = el; n; n = n.parentNode) {
      if (n.nodeType !== 1) continue;
      var cls = n.className || '';
      if (typeof cls === 'string' &&
        cls.indexOf('quote-box') !== -1 &&
        cls.indexOf('spoiler-box') !== -1 &&
        cls.indexOf('media-box') !== -1) return true;
    }
    return false;
  }

  function tryBoundary(prevText, rightText) {
    if (!prevText || !rightText) return;
    var a = prevText.nodeValue;
    if (!LEFT_TAIL_HINT.test(a)) return; // быстрый отсев

    var ia = lastNonSpaceIdx(a);
    if (ia === -1) return;
    var a_last = a.charAt(ia);
    var a_prev = ia > 0 ? a.charAt(ia - 1) : '';
    if (!(isDashish(a_last) && isSpace(a_prev))) return;

    var b = rightText.nodeValue;
    if (!(b.length && isSpace(b.charAt(0)))) return;

    prevText.nodeValue = a.slice(0, ia) + '—' + a.slice(ia + 1);
  }

  // обработка script[type="text/html"] в .quote-box.spoiler-box.media-box как HTML
  function processScriptTemplate(scriptEl, processBlockFn) {
    try {
      var type = (scriptEl.getAttribute('type') || '').toLowerCase();
      if (type !== 'text/html') return;

      var src = scriptEl.text || scriptEl.textContent || '';
      if (!src) return;

      var tmp = document.createElement('div');
      tmp.innerHTML = src; // распарсили
      processBlockFn(tmp); // применили правила
      var out = tmp.innerHTML; // собрали

      scriptEl.text = out; // для старых IE
      scriptEl.textContent = out;
    } catch (e) {
      /* noop */
    }
  }

  function processBlock(root) {
    var prevText = null; // предыдущий НЕпустой текст-узел
    var gapHasSpace = false; // между prev и текущим были «пустые» ноды с пробелами

    (function walk(node) {
      for (var child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3) {
          var t = child.nodeValue;

          if (isBlankText(t)) {
            if (prevText) gapHasSpace = true;
            continue;
          }

          // === локальные замены ===
          // между пробелами: " ␠(dash)␠ " → " ␠—␠ "
          t = t.replace(RE_BETWEEN, '$1—');

          // в начале текст-ноды с учётом ведущих пробелов: "^␠*(dash)␠"
          // только если слева реально граница (начало блока) или пробел
          var allowLeading = (!prevText) || gapHasSpace ||
            (prevText && prevText.nodeValue.length &&
              isSpace(prevText.nodeValue.charAt(prevText.nodeValue.length - 1)));
          var i0 = firstNonSpaceIdx(t);
          if (allowLeading && i0 !== -1 && isDashish(t.charAt(i0))) {
            var after = (i0 + 1 < t.length) ? t.charAt(i0 + 1) : '';
            if (isSpace(after)) {
              t = t.slice(0, i0) + '—' + t.slice(i0 + 1);
            }
          }
          child.nodeValue = t;

          // === межузловая граница: prevText ... | child ===
          if (prevText) {
            var a = prevText.nodeValue;
            var rightStartsWithSpace = t.length && isSpace(t.charAt(0));
            if (LEFT_TAIL_HINT.test(a)) {
              var ia = lastNonSpaceIdx(a);
              if (ia !== -1) {
                var a_last = a.charAt(ia);
                var a_prev = ia > 0 ? a.charAt(ia - 1) : '';
                if (isDashish(a_last) && isSpace(a_prev) && (rightStartsWithSpace || gapHasSpace)) {
                  prevText.nodeValue = a.slice(0, ia) + '—' + a.slice(ia + 1);
                }
              }
            }
          }

          prevText = child;
          gapHasSpace = false; // сброс
        } else if (child.nodeType === 1) {
          var tag = child.nodeName.toUpperCase();

          // особый случай: обрабатываем шаблоны внутри quote-box
          if (tag === 'SCRIPT' && inQuoteBox(child)) {
            processScriptTemplate(child, processBlock);
            prevText = null;
            gapHasSpace = false;
            continue;
          }

          if (SKIP_TAG[tag]) {
            prevText = null;
            gapHasSpace = false;
            continue;
          }
          if (tag === 'BR') {
            prevText = null;
            gapHasSpace = false;
            continue;
          }

          if (BLOCK[tag] && child !== root) {
            processBlock(child); // отдельный блок — свой проход
            prevText = null;
            gapHasSpace = false;
          } else {
            // попытка склейки на границе prevText | первый текст внутри inline-узла
            if (prevText) {
              var firstT = firstTextDesc(child);
              if (firstT) tryBoundary(prevText, firstT);
            }
            walk(child);
          }
        }
      }
    })(root);
  }

  return this.each(function() {
    processBlock(this);
  });
};

// запуск
$(function() {
  $('.post-content').fixDashes();
});

/* UI Components (button.js загружается в head-bundle) */
(() => {
  const ready = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  (async () => {
    try {
      await ready;

      // === Переменные для настроек и проверок ===
      const bodyGroup  = Number(document.body?.dataset?.groupId || NaN);
      const groupId    = window.GroupID ? Number(window.GroupID) : null;

      // объединяем списки для удобства
      const allowedGroups = [
        ...(window.PROFILE_CHECK?.GroupID || []),
        ...(window.CHRONO_CHECK?.GroupID || [])
      ];
      const allowedForums = [
        ...(window.PROFILE_CHECK?.ForumID || []),
        ...(window.CHRONO_CHECK?.ForumID || []),
        ...(window.CHRONO_CHECK?.AmsForumID || []),
      ];

      const isAllowedGroup = allowedGroups.includes(groupId);

      const crumbs = document.querySelector('.container.crumbs');

      const isAllowedForum = crumbs && Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          const id = u.searchParams.get('id');
          const check = id ? allowedForums.includes(Number(id)) : false;
          return u.pathname.endsWith('/viewforum.php') && check;
        } catch { return false; }
      });

      // === Используем переменные ===
      if (!isAllowedGroup || !isAllowedForum) return;

      // === Вставляем div ===
      let bodies = document.querySelectorAll('.topicpost .post-body .post-box .post-content');
      if (!bodies.length) {
        try {
          await FMV.waitForSelector('.topicpost .post-body .post-box .post-content', 5000);
          bodies = document.querySelectorAll('.topicpost .post-body .post-box .post-content');
        } catch { return; }
      }

      const target = bodies[bodies.length - 1];
      if (!target || target.querySelector('.ams_info')) return;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'ams_info';
      infoDiv.textContent = '';

      target.appendChild(document.createElement('br'));
      target.appendChild(infoDiv);

      window.__ams_ready = true;
      window.dispatchEvent(new CustomEvent('ams:ready', { detail: { node: infoDiv } }));
      if (typeof window.__amsReadyResolve === 'function') window.__amsReadyResolve(infoDiv);
    } catch (e) {
      console.log('[AMS injector] error:', e);
    }
  })();
})();
(function () {
  // -------- утилиты --------
  function $(sel, root) { return (root||document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  function selectNodeContents(el){
    try{
      var r=document.createRange();
      r.selectNodeContents(el);
      var s=window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }catch(e){}
  }

  function getText(pre){
    return (pre && (pre.innerText || pre.textContent) || '').replace(/\s+$/,'');
  }

  function copyFromSelection(){
    try{ return document.execCommand && document.execCommand('copy'); }
    catch(e){ return false; }
  }

  async function copyTextPreferClipboard(text){
    if(navigator.clipboard && window.isSecureContext){
      try{ await navigator.clipboard.writeText(text); return true; }catch(e){}
    }
    return copyFromSelection();
  }

  // -------- управление выделением после копирования --------
  let activePre = null;

  function setActivePre(pre){
    activePre = pre || null;
  }

  function hardClearSelection() {
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
      if (document.selection && document.selection.empty) document.selection.empty(); // старый IE
    } catch(e) {}

    try {
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
    } catch(e) {}

    const b = document.body;
    const prevUS = b.style.userSelect;
    const prevWk = b.style.webkitUserSelect;
    b.style.userSelect = 'none';
    b.style.webkitUserSelect = 'none';
    void b.offsetHeight; // форсим рефлоу
    b.style.userSelect = prevUS;
    b.style.webkitUserSelect = prevWk;
  }

  function needClearByTarget(t) {
    if (!activePre) return false;
    return !activePre.contains(t);
  }

  function globalDown(e) {
    const t = e.target || e.srcElement;
    if (needClearByTarget(t)) {
      activePre = null;
      hardClearSelection();
    }
  }

  function onSelectionChange() {
    if (!activePre) return;
    const sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) {
      activePre = null;
      return;
    }
    const n = sel.anchorNode;
    if (n && !activePre.contains(n)) {
      activePre = null;
      hardClearSelection();
    }
  }

  // -------- инициализация коробок --------
  function ensureButton(box){
    // ищем/создаём .legend
    let lg = box.querySelector('.legend');
    if (!lg) {
      lg = document.createElement('strong');
      lg.className = 'legend';
      box.insertBefore(lg, box.firstChild);
    }
    if (lg.dataset.copyReady) return;

    // если внутри нет кнопки — вставляем
    if (!lg.querySelector('.code-copy')) {
      let label = (lg.textContent || '').trim();
      if (!label || /^код:?\s*$/i.test(label)) label = 'Скопировать код';
      lg.textContent = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = label;
      lg.appendChild(btn);
    }
    lg.dataset.copyReady = '1';
  }

  function armBox(box){
    ensureButton(box);
    if (box.__armed) return;
    box.__armed = true;

    // обработчик клика по кнопке (и по самой legend)
    box.addEventListener('click', async function(e){
      const target = (e.target.closest && e.target.closest('.code-copy, .legend')) || null;
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      const pre = box.querySelector('pre');
      if (!pre) return;

      // выделяем и копируем
      selectNodeContents(pre);
      setActivePre(pre);
      await copyTextPreferClipboard(getText(pre));
    }, true);
  }

  function init(ctx){
    $all('.code-box', ctx).forEach(armBox);
  }

  // первичная инициализация
  init();

  // если движок форума шлёт это событие — доинициализируем
  document.addEventListener('pun_main_ready', function(){ init(); });

  // MutationObserver — подхватываем динамически появляющиеся блоки
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      (m.addedNodes||[]).forEach(function(n){
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches('.code-box')) armBox(n);
        n.querySelectorAll && n.querySelectorAll('.code-box').forEach(armBox);
      });
    });
  }).observe(document.body, {childList:true, subtree:true});

  // глобальные «крючки» для гарантированного снятия выделения
  window.addEventListener('pointerdown', globalDown, true);
  document.addEventListener('mousedown', globalDown, true);
  document.addEventListener('click', globalDown, true);
  document.addEventListener('touchstart', globalDown, true);
  document.addEventListener('focusin', globalDown, true);
  document.addEventListener('scroll', function () {
    if (activePre) { activePre = null; hardClearSelection(); }
  }, true);
  document.addEventListener('selectionchange', onSelectionChange, true);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { activePre = null; hardClearSelection(); }
  }, true);
  window.addEventListener('blur', function () {
    if (activePre) { activePre = null; hardClearSelection(); }
  }, true);
})();

/* Private Pages */
// admin_bridge_json.js — API bridge для работы напрямую с JSON
// Загружает данные из API и сохраняет обратно БЕЗ HTML-прослойки

(function () {
  'use strict';

  /**
   * Загружает страницу /pages/usrN и извлекает user_id из .modal_script
   * Приоритет: data-main-user_id > N из URL
   */
  async function getUserIdFromPage(profileId) {
    try {
      const pageUrl = `/pages/usr${profileId}`;
      const response = await fetch(pageUrl);
      if (!response.ok) {
        console.error(`[admin_bridge_json] Не удалось загрузить ${pageUrl}`);
        return Number(profileId); // fallback на profileId
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const modalScript = doc.querySelector('.modal_script');
      if (!modalScript) {
        console.warn(`[admin_bridge_json] .modal_script не найден в ${pageUrl}, используем profileId=${profileId}`);
        return Number(profileId);
      }

      const mainUserId = modalScript.getAttribute('data-main-user_id');
      if (mainUserId && mainUserId.trim()) {
        return Number(mainUserId.trim());
      }

      // Если data-main-user_id не указан, используем profileId
      return Number(profileId);
    } catch (err) {
      console.error('[admin_bridge_json] Ошибка загрузки страницы:', err);
      return Number(profileId);
    }
  }

  /**
   * Загружает данные из API (единый объект skin_<userId>)
   * Фильтрует истекшие купоны (expired_date < today)
   * @param {number} userId
   * @param {object} libraryIds - { icon: Set, plashka: Set, ... }
   * @returns {Promise<object>} { data: { icon: [], ... }, chrono: {}, comment_id: null }
   */
  async function loadAllDataFromAPI(userId, libraryIds) {
    const data = {
      icon: [],
      plashka: [],
      background: [],
      gift: [],
      coupon: []
    };

    let chrono = {};
    let comment_id = null;
    let last_timestamp = null;

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageGet не найден');
      return { data, chrono, comment_id, last_timestamp };
    }

    // Функция для получения текущей даты в МСК (yyyy-mm-dd)
    const getTodayMoscow = () => {
      const now = new Date();
      const moscowOffset = 3 * 60; // UTC+3
      const localOffset = now.getTimezoneOffset(); // минуты от UTC
      const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60000);

      const year = moscowTime.getFullYear();
      const month = String(moscowTime.getMonth() + 1).padStart(2, '0');
      const day = String(moscowTime.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    };

    const today = getTodayMoscow();

    try {
      // Загружаем единый объект skin_<userId>
      const response = await window.FMVbank.storageGet(userId, 'skin_');

      if (!response || typeof response !== 'object') {
        console.warn('[admin_bridge_json] Нет данных в API для userId=' + userId);
        return { data, chrono, comment_id, last_timestamp };
      }

      // Извлекаем chrono, comment_id и last_timestamp
      chrono = response.chrono || {};
      comment_id = response.comment_id || null;
      last_timestamp = response.last_timestamp || null;

      // Обрабатываем категории скинов
      const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

      for (const key of categories) {
        const items = response[key] || [];
        if (!Array.isArray(items)) continue;

        items.forEach(item => {
          // Для купонов: фильтруем истекшие (expired_date < today)
          if (key === 'coupon' && item.expired_date) {
            if (item.expired_date < today) {
              console.log(`[admin_bridge_json] Пропущен истекший купон: ${item.id}, expired_date=${item.expired_date} < ${today}`);
              return; // Пропускаем истекший купон
            }
          }

          // Добавляем элемент в данные (все элементы видимы)
          data[key].push(item);
        });
      }
    } catch (err) {
      console.error('[admin_bridge_json] Ошибка загрузки данных:', err);
    }

    return { data, chrono, comment_id, last_timestamp };
  }

  /**
   * Сохраняет данные в API (единый объект skin_<userId>)
   * ВАЖНО: Сначала делает GET, затем частично обновляет только категории скинов, сохраняя chrono и comment_id
   * Удаляет истекшие купоны (expired_date < today)
   *
   * @param {number} userId
   * @param {object} skinData - { icon: [], plashka: [], ... } данные из панели
   * @param {number|null} initialTimestamp - last_timestamp из первоначальной загрузки
   * @returns {Promise<boolean>}
   */
  async function saveAllDataToAPI(userId, skinData, initialTimestamp = null) {
    console.log('[admin_bridge_json] 🔥 СОХРАНЕНИЕ ДЛЯ userId:', userId);
    console.log('[admin_bridge_json] 🔥 skinData:', JSON.parse(JSON.stringify(skinData)));

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function' || typeof window.FMVbank.storageSet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageGet или storageSet не найдены');
      return false;
    }

    // Функция для получения текущей даты в МСК (yyyy-mm-dd)
    const getTodayMoscow = () => {
      const now = new Date();
      const moscowOffset = 3 * 60; // UTC+3
      const localOffset = now.getTimezoneOffset(); // минуты от UTC
      const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60000);

      const year = moscowTime.getFullYear();
      const month = String(moscowTime.getMonth() + 1).padStart(2, '0');
      const day = String(moscowTime.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    };

    const today = getTodayMoscow();

    try {
      // ШАГ 1: Сначала получаем текущие данные из API
      console.log('[admin_bridge_json] 📥 Загружаю текущие данные из API...');
      const currentData = await window.FMVbank.storageGet(userId, 'skin_');

      // Если данных нет, создаём пустой объект
      const baseData = currentData && typeof currentData === 'object' ? currentData : {};

      console.log('[admin_bridge_json] 📥 Текущие данные из API:', JSON.parse(JSON.stringify(baseData)));

      // ШАГ 1.5: Проверяем last_timestamp
      if (initialTimestamp !== null) {
        const currentTimestamp = baseData.last_timestamp || null;
        console.log('[admin_bridge_json] 🕐 Проверка timestamp: initial=' + initialTimestamp + ', current=' + currentTimestamp);

        if (currentTimestamp !== null && currentTimestamp !== initialTimestamp) {
          alert('К сожалению, за время работы на странице данные для этого пользователя были изменены. Пожалуйста, откройте новую вкладку и заполните обновления снова.');
          console.error('[admin_bridge_json] ❌ Конфликт: данные были изменены другим пользователем');
          return false;
        }
      }

      // ПРОВЕРКА: comment_id должен быть указан (берём из текущих данных API)
      const commentId = baseData.comment_id;
      if (!commentId) {
        alert('Укажите id комментария для юзера.');
        console.error('[admin_bridge_json] ❌ comment_id не указан');
        return false;
      }
      console.log('[admin_bridge_json] ✅ comment_id:', commentId);

      // ШАГ 2: Обновляем только категории скинов
      const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

      for (const key of categories) {
        let items = skinData[key] || [];

        // Для купонов: удаляем истекшие (expired_date < today)
        if (key === 'coupon') {
          const before = items.length;
          items = items.filter(item => {
            if (item.expired_date && item.expired_date < today) {
              console.log(`[admin_bridge_json] Удалён истекший купон: ${item.id}, expired_date=${item.expired_date} < ${today}`);
              return false;
            }
            return true;
          });
          const after = items.length;
          if (before !== after) {
            console.log(`[admin_bridge_json] 🗑️ Купоны: удалено ${before - after} истекших`);
          }
        }

        console.log('[admin_bridge_json] 📦 ' + key + ': ' + items.length + ' элементов');

        // Сохраняем в базовый объект (даже если пустой массив)
        baseData[key] = items;
      }

      // ШАГ 3: НЕ трогаем chrono и comment_id - они остаются как есть из GET!

      // ШАГ 4: Обновляем last_timestamp
      baseData.last_timestamp = Math.floor(Date.now() / 1000);

      console.log('[admin_bridge_json] 💾 Финальный объект для сохранения:', JSON.parse(JSON.stringify(baseData)));

      // ШАГ 5: Сохраняем весь объект
      const result = await window.FMVbank.storageSet(baseData, userId, 'skin_');
      if (!result) {
        console.error('[admin_bridge_json] ❌ Не удалось сохранить данные');
        return false;
      }

      console.log('[admin_bridge_json] ✅ Данные успешно сохранены в API');

      // ШАГ 6: Обновляем комментарий на форуме
      console.log('[admin_bridge_json] 📝 Обновляю комментарий #' + commentId);
      const commentUpdated = await updateCommentWithSkins(commentId, userId, baseData);
      if (!commentUpdated) {
        console.error('[admin_bridge_json] ❌ Не удалось обновить комментарий');
        return false;
      }

      console.log('[admin_bridge_json] ✅ Комментарий успешно обновлён');
      return true;
    } catch (err) {
      console.error('[admin_bridge_json] Ошибка сохранения:', err);
      return false;
    }
  }

  /**
   * Обновляет комментарий на форуме с данными скинов через iframe
   * @param {number} commentId - ID комментария
   * @param {number} userId - ID пользователя (для ссылки на профиль)
   * @param {object} data - Полный объект данных (с категориями скинов)
   * @returns {Promise<boolean>}
   */
  async function updateCommentWithSkins(commentId, userId, data) {
    return new Promise((resolve, reject) => {
      try {
        // Подготавливаем данные для комментария (весь объект data, но без content в элементах)
        const dataForComment = { ...data };
        const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

        for (const key of categories) {
          const items = data[key] || [];
          // Удаляем поле content из каждого элемента
          dataForComment[key] = items.map(item => {
            const cleanItem = { ...item };
            delete cleanItem.content;
            return cleanItem;
          });
        }

        // JSON минифицированный (без отступов и переносов)
        const commentJson = JSON.stringify(dataForComment);

        // Ссылка на профиль + JSON
        const profileUrl = window.SITE_URL + '/profile.php?id=' + userId;
        const commentData = profileUrl + '\n' + commentJson;

        const editUrl = '/edit.php?id=' + commentId;

        console.log('[admin_bridge_json] 🌐 Создаём iframe для редактирования комментария:', editUrl);

        // Создаём скрытый iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = editUrl;
        document.body.appendChild(iframe);

        // Таймаут на случай зависания
        const timeout = setTimeout(() => {
          iframe.remove();
          reject(new Error('Таймаут обновления комментария (10 секунд)'));
        }, 10000);

        // Счетчик загрузок
        let onloadCount = 0;

        iframe.onload = function() {
          onloadCount++;
          console.log('[admin_bridge_json] iframe onload #' + onloadCount);

          // Первая загрузка - форма редактирования
          if (onloadCount === 1) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              const textarea = iframeDoc.querySelector('textarea[name="req_message"]');
              const submitButton = iframeDoc.querySelector('input[type="submit"][name="submit"]');

              if (!textarea || !submitButton) {
                clearTimeout(timeout);
                iframe.remove();
                reject(new Error('Форма редактирования не найдена'));
                return;
              }

              // Вставляем данные в textarea
              textarea.value = commentData;
              console.log('[admin_bridge_json] 📝 Данные вставлены в форму, длина:', commentData.length);

              // Отправляем форму
              console.log('[admin_bridge_json] 📤 Нажимаю кнопку отправки');
              submitButton.click();

            } catch (error) {
              clearTimeout(timeout);
              iframe.remove();
              reject(error);
            }
            return;
          }

          // Вторая загрузка - после редиректа
          if (onloadCount === 2) {
            console.log('[admin_bridge_json] ✅ Форма успешно отправлена, комментарий обновлён');
            clearTimeout(timeout);
            iframe.remove();
            resolve(true);
          }
        };

        iframe.onerror = function() {
          clearTimeout(timeout);
          iframe.remove();
          reject(new Error('Не удалось загрузить страницу редактирования'));
        };

      } catch (err) {
        console.error('[admin_bridge_json] Ошибка обновления комментария:', err);
        reject(err);
      }
    });
  }

  /**
   * Главная функция load
   * @param {string} profileId - id из URL (/profile.php?id=N)
   * @param {object} libraryIds - { icon: Set, plashka: Set, ... }
   * @returns {Promise<object>} { status, visibleData, invisibleData, chrono, comment_id, save, targetUserId }
   */
  async function load(profileId, libraryIds) {
    // Загружаем страницу /pages/usrN и извлекаем правильный userId
    const targetUserId = await getUserIdFromPage(profileId);

    if (!targetUserId) {
      return {
        status: 'error',
        visibleData: {},
        chrono: {},
        comment_id: null,
        save: null,
        targetUserId: null
      };
    }

    // Загружаем данные из API (фильтруем истекшие купоны)
    const { data, chrono, comment_id, last_timestamp } = await loadAllDataFromAPI(targetUserId, libraryIds);

    /**
     * Функция сохранения
     * @param {object} skinData - { icon: [], plashka: [], ... } данные из панели
     * @returns {Promise<object>} { ok, status }
     */
    async function save(skinData) {
      const success = await saveAllDataToAPI(targetUserId, skinData, last_timestamp);
      return {
        ok: success,
        status: success ? 'успешно' : 'ошибка сохранения'
      };
    }

    return {
      status: 'ok',
      visibleData: data,
      chrono: chrono,
      comment_id: comment_id,
      save,
      targetUserId
    };
  }

  // Экспортируем в window.skinAdmin
  window.skinAdmin = { load };
})();
// get_skin_api.js — Загрузка данных скинов из API вместо страниц

function isProfileFieldsPage() {
  try {
    const u = new URL(location.href);
    return /\/profile\.php$/i.test(u.pathname) &&
           u.searchParams.get('section') === 'fields' &&
           /^\d+$/.test(u.searchParams.get('id') || '');
  } catch { return false; }
}

function getProfileId() {
  const u = new URL(location.href);
  return u.searchParams.get('id') || '';
}

/**
 * Загружает страницу /pages/usrN и извлекает user_id из .modal_script
 * Приоритет: data-main-user_id > N из URL
 */
async function getUserIdFromPage(profileId) {
  try {
    const pageUrl = `/pages/usr${profileId}`;
    const response = await fetch(pageUrl);
    if (!response.ok) {
      console.error(`[get_skin_api] Не удалось загрузить ${pageUrl}`);
      return Number(profileId);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const modalScript = doc.querySelector('.modal_script');
    if (!modalScript) {
      console.warn(`[get_skin_api] .modal_script не найден в ${pageUrl}, используем profileId=${profileId}`);
      return Number(profileId);
    }

    const mainUserId = modalScript.getAttribute('data-main-user_id');
    if (mainUserId && mainUserId.trim()) {
      console.log(`[get_skin_api] Найден data-main-user_id=${mainUserId}`);
      return Number(mainUserId.trim());
    }

    // Если data-main-user_id не указан, используем profileId
    return Number(profileId);
  } catch (err) {
    console.error('[get_skin_api] Ошибка загрузки страницы:', err);
    return Number(profileId);
  }
}

/**
 * Загружает данные из API для всех категорий
 */
async function loadSkinsFromAPI(userId) {
  console.log('[get_skin_api] Загружаю данные из API для userId:', userId);

  if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
    console.error('[get_skin_api] FMVbank.storageGet не найден');
    return { icons: [], plashki: [], backs: [] };
  }

  const result = {
    icons: [],
    plashki: [],
    backs: []
  };

  try {
    // Загружаем единый объект skin_<userId>
    const response = await window.FMVbank.storageGet(userId, 'skin_');
    console.log('[get_skin_api] skin_ ответ:', response);

    if (!response || typeof response !== 'object') {
      console.warn('[get_skin_api] Нет данных в skin_ для userId:', userId);
      return result;
    }

    // Маппинг ключей API -> результат
    const mapping = {
      icon: 'icons',
      plashka: 'plashki',
      background: 'backs'
    };

    for (const [apiKey, resultKey] of Object.entries(mapping)) {
      const items = response[apiKey];
      if (Array.isArray(items)) {
        // Конвертируем каждый item в HTML
        result[resultKey] = items.map(item => item.content || '').filter(Boolean);
        console.log(`[get_skin_api] ${resultKey} загружено ${items.length} элементов`);
      } else {
        console.log(`[get_skin_api] ${resultKey} отсутствует или не массив`);
      }
    }

  } catch (e) {
    console.error('[get_skin_api] Ошибка загрузки данных:', e);
  }

  console.log('[get_skin_api] Результат:', result);
  return result;
}

/**
 * Загружает данные скинов из API и возвращает массивы HTML
 * { icons: string[], plashki: string[], backs: string[] }
 */
async function collectSkinSets() {
  console.log('[get_skin_api] collectSkinSets вызван');

  if (!isProfileFieldsPage()) {
    console.log('[get_skin_api] Не страница fields');
    return { icons: [], plashki: [], backs: [] };
  }

  const profileId = getProfileId();
  console.log('[get_skin_api] profileId:', profileId);

  // Получаем целевой userId с учётом data-main-user_id (async!)
  const userId = await getUserIdFromPage(profileId);
  console.log('[get_skin_api] Целевой userId:', userId);

  // Загружаем из API
  const result = await loadSkinsFromAPI(userId);

  console.log('[get_skin_api] Данные загружены:', result);
  return result;
}
// collect_skins_api.js — Загрузка и отображение скинов из API на страницах персонажей

(function () {


  const CHARACTER_SELECTOR = '.modal_script[data-id]';
  const DEBUG = false;

  const log = (...a) => DEBUG && console.log('[collect_skins_api]', ...a);

  log('[collect_skins_api] Скрипт загружен');

  // Селекторы для вставки данных
  const SECTION_SELECTORS = {
    icon: '._icon',
    plashka: '._plashka',
    background: '._background',
    gift: '._gift',
    coupon: '._coupon'
  };

  /**
   * Получает userId из атрибутов .modal_script
   * Приоритет: data-main-user_id > data-id
   */
  function getUserIdFromCharacter(charEl) {
    if (!charEl) {
      log('getUserIdFromCharacter: charEl отсутствует');
      return null;
    }

    const mainUserId = charEl.getAttribute('data-main-user_id');
    log('getUserIdFromCharacter: data-main-user_id =', mainUserId);

    if (mainUserId && mainUserId.trim()) {
      const result = Number(mainUserId.trim());
      log('getUserIdFromCharacter: используем data-main-user_id =', result);
      return result;
    }

    const dataId = charEl.getAttribute('data-id');
    log('getUserIdFromCharacter: data-id =', dataId);

    if (dataId && dataId.trim()) {
      const result = Number(dataId.trim());
      log('getUserIdFromCharacter: используем data-id =', result);
      return result;
    }

    log('getUserIdFromCharacter: userId не найден');
    return null;
  }

  /**
   * Загружает данные из API
   */
  async function loadDataFromAPI(userId) {
    log('Загружаю данные из API для userId', userId);

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      console.error('[collect_skins_api] FMVbank.storageGet не найден');
      return null;
    }

    const result = {
      icon: [],
      plashka: [],
      background: [],
      gift: [],
      coupon: []
    };

    try {
      // Загружаем единый объект skin_<userId>
      const response = await window.FMVbank.storageGet(userId, 'skin_');
      log('skin_ ответ:', response);

      if (!response || typeof response !== 'object') {
        log('Нет данных в skin_ для userId', userId);
        return result;
      }

      // Извлекаем каждую категорию из единого объекта
      const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

      categories.forEach(key => {
        const items = response[key];

        if (Array.isArray(items)) {
          // Фильтруем только видимые элементы (is_visible !== false)
          const filtered = items.filter(item => item.is_visible !== false);
          result[key] = filtered;
          log(`${key} загружено ${filtered.length} видимых элементов из ${items.length}`);
        } else {
          log(`${key} отсутствует или не массив`);
          result[key] = [];
        }
      });

      log('Все данные загружены:', result);
      return result;

    } catch (e) {
      console.error('[collect_skins_api] Ошибка загрузки данных:', e);
      return result;
    }
  }

  /**
   * Вставляет данные в DOM
   */
  function injectData(scope, data) {
    log('Вставляю данные в DOM:', data);

    for (const [key, selector] of Object.entries(SECTION_SELECTORS)) {
      const target = scope.querySelector(selector);
      if (!target) {
        log(`Контейнер ${selector} не найден`);
        continue;
      }

      const items = data[key] || [];
      if (items.length === 0) {
        log(`Нет данных для ${key}`);
        target.innerHTML = '';
        continue;
      }

      // Оборачиваем content в <div class="item"> с атрибутами
      const html = items.map(item => {
        const attrs = [
          `data-id="${escapeAttr(item.id)}"`,
          `title="${escapeAttr(item.title || '')}"`
        ];

        // Добавляем все остальные data-* атрибуты
        Object.keys(item).forEach(itemKey => {
          if (itemKey !== 'id' && itemKey !== 'title' && itemKey !== 'content' && itemKey !== 'is_visible') {
            // Конвертируем подчёркивания обратно в дефисы (coupon_type -> coupon-type)
            const attrName = 'data-' + itemKey.replace(/_/g, '-');
            attrs.push(`${attrName}="${escapeAttr(item[itemKey] || '')}"`);
          }
        });

        return `<div class="item" ${attrs.join(' ')}>${item.content || ''}</div>`;
      }).join('\n');

      target.innerHTML = html;
      log(`Вставлено ${items.length} элементов в ${selector}`);
    }
  }

  function escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  /**
   * Находит scope вокруг персонажа
   */
  function scopeForCharacter(el) {
    return el.closest('.modal_wrap, .reveal-modal, .container, #character') || el.parentElement || document;
  }

  /**
   * Переносит контейнеры внутрь .character если нужно
   */
  function normalizeStructure(scope) {
    const char = scope.querySelector(CHARACTER_SELECTOR);
    if (!char) return;

    Object.values(SECTION_SELECTORS).forEach(selector => {
      const container = scope.querySelector(selector);
      if (container && container.parentElement !== char) {
        char.appendChild(container);
      }
    });
  }

  /**
   * Инициализация для конкретного персонажа
   */
  async function initIn(root) {
    log('initIn вызван, root:', root);
    if (!root) {
      log('root не передан');
      return;
    }

    // Проверяем наличие FMVbank
    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      console.warn('[collect_skins_api] FMVbank.storageGet не найден');
      return;
    }

    // Ищем .modal_script
    const charEl = root.querySelector(CHARACTER_SELECTOR) || document.querySelector(CHARACTER_SELECTOR);
    log('charEl:', charEl);
    if (!charEl) {
      log('character не найден');
      return;
    }

    const scope = scopeForCharacter(charEl);
    log('scope:', scope);
    normalizeStructure(scope);

    const userId = getUserIdFromCharacter(charEl);
    log('userId:', userId);
    if (!userId) {
      log('userId не найден');
      return;
    }

    // Загружаем данные из API
    log('Загружаю данные для userId', userId);
    const data = await loadDataFromAPI(userId);

    if (!data) {
      log('Данные не загружены');
      return;
    }

    // Вставляем в DOM
    injectData(scope, data);
    log('Данные вставлены для userId', userId);
  }

  // Ручной запуск
  window.loadUserSkinsFromApi = function ({ root, rootSelector } = {}) {
    const r = root || (rootSelector ? document.querySelector(rootSelector) : document);
    initIn(r);
  };

  // Автозапуск при загрузке страницы
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded событие');
    initIn(document);
  });

  // Динамическое появление персонажей (модалки)
  const seen = new WeakSet();
  const observer = new MutationObserver((recs) => {
    recs.forEach(rec => {
      rec.addedNodes && rec.addedNodes.forEach(n => {
        if (!(n instanceof Element)) return;

        if (n.matches && n.matches(CHARACTER_SELECTOR) && !seen.has(n)) {
          seen.add(n);
          log('Обнаружен новый character:', n);
          initIn(scopeForCharacter(n));
        }

        n.querySelectorAll && n.querySelectorAll(CHARACTER_SELECTOR).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          log('Обнаружен вложенный character:', el);
          initIn(scopeForCharacter(el));
        });
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  log('Скрипт инициализирован');
})();
(function () {
  console.log('[collect_api] Скрипт загружен');

  // ==== настройки ====
  const CHARACTER_SELECTOR = '.modal_script[data-id]';
  const CHRONO_TARGET_SEL = '.chrono_info';
  const DEBUG = true;
  const API_KEY_LABEL = 'chrono_'; // Используем ключ chrono_ для хронологии

  // ====================

  const log = (...a) => DEBUG && console.log('[collect_api]', ...a);

  // Проверка наличия FMVbank
  function requireFMVbank() {
    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      throw new Error('FMVbank не найден — подключите src/bank/api.js');
    }
  }

  // Получение данных хронологии из API (из единого объекта info_)
  async function fetchChronoFromApi(userId) {
    requireFMVbank();
    try {
      const fullData = await window.FMVbank.storageGet(Number(userId), API_KEY_LABEL);
      log('Получены данные для userId', userId, ':', fullData);

      // Извлекаем только chrono из полного объекта
      if (fullData && typeof fullData === 'object' && fullData.chrono) {
        log('Извлечены данные chrono:', fullData.chrono);
        return fullData.chrono;
      }

      log('Данные chrono не найдены в API');
      return null;
    } catch (e) {
      console.error(`[collect_api] Ошибка получения данных для userId ${userId}:`, e);
      return null;
    }
  }

  // Построение HTML из данных хронологии
  function buildChronoHtml(data) {
    if (!data || typeof data !== 'object') {
      return '<p>Нет данных хронологии</p>';
    }

    // Проверяем наличие FMV.buildChronoHtml
    if (window.FMV && typeof window.FMV.buildChronoHtml === 'function') {
      try {
        return window.FMV.buildChronoHtml(data, { titlePrefix: 'Хронология' });
      } catch (e) {
        console.error('[collect_api] Ошибка FMV.buildChronoHtml:', e);
      }
    }

    // Fallback: простой вывод данных
    log('FMV.buildChronoHtml не найден, используем fallback');
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return '<p>Хронология пуста</p>';
    }

    let html = '<div class="chrono-data">';
    for (const [key, value] of entries) {
      html += `<div><strong>${key}:</strong> ${JSON.stringify(value)}</div>`;
    }
    html += '</div>';
    return html;
  }

  // Вставка HTML в контейнер
  function injectHtml(target, html) {
    if (!target) return;
    target.innerHTML = html;
  }

  // Переносит .chrono_info внутрь .character, если они оказались соседями
  function normalizeStructure(scope) {
    const char = scope.querySelector(CHARACTER_SELECTOR);
    if (!char) return;
    const chrono = scope.querySelector(CHRONO_TARGET_SEL);
    if (chrono && chrono.parentElement !== char) char.appendChild(chrono);
  }

  // Находим «узкий» scope вокруг конкретного персонажа
  function scopeForCharacter(el) {
    return el.closest('.modal_wrap, .reveal-modal, .container, #character') || el.parentElement || document;
  }

  // Загрузка и вставка хронологии из API
  async function loadChronoFromApi(userId, scope) {
    console.log('[collect_api] loadChronoFromApi, ищем', CHRONO_TARGET_SEL, 'в scope');
    const target = scope.querySelector(CHRONO_TARGET_SEL);
    console.log('[collect_api] target найден:', target);
    if (!target) {
      log('chrono_info не найден для userId', userId);
      return;
    }

    // Показываем индикатор загрузки
    console.log('[collect_api] Показываем индикатор загрузки');
    target.innerHTML = '<p>Загрузка хронологии...</p>';

    // Получаем данные из API
    console.log('[collect_api] Запрашиваем данные из API');
    const data = await fetchChronoFromApi(userId);
    console.log('[collect_api] Получены данные:', data);

    if (!data) {
      console.log('[collect_api] Данные не получены');
      target.innerHTML = '<p>Не удалось загрузить данные хронологии</p>';
      return;
    }

    // Строим HTML
    console.log('[collect_api] Строим HTML');
    const html = buildChronoHtml(data);
    console.log('[collect_api] HTML построен, длина:', html.length);

    // Вставляем в контейнер
    injectHtml(target, html);
    console.log('[collect_api] Хронология загружена для userId', userId);
  }

  async function initIn(root) {
    console.log('[collect_api] initIn вызван, root:', root);
    if (!root) {
      console.log('[collect_api] root не передан');
      return;
    }

    // Проверяем наличие FMVbank
    try {
      requireFMVbank();
      console.log('[collect_api] FMVbank найден');
    } catch (e) {
      console.warn('[collect_api]', e.message);
      return;
    }

    // берём конкретного character, а не первый на документе
    const charEl = root.querySelector(CHARACTER_SELECTOR) || document.querySelector(CHARACTER_SELECTOR);
    console.log('[collect_api] charEl:', charEl);
    if (!charEl) {
      log('no character');
      return;
    }

    const scope = scopeForCharacter(charEl);
    console.log('[collect_api] scope:', scope);
    normalizeStructure(scope);

    const userId = charEl.getAttribute('data-id')?.trim();
    console.log('[collect_api] userId:', userId);
    if (!userId) {
      log('no data-id');
      return;
    }

    // Загружаем хронологию из API
    console.log('[collect_api] Вызываем loadChronoFromApi для userId', userId);
    await loadChronoFromApi(userId, scope);
  }

  // ручной запуск
  window.loadUserChronoFromApi = function ({ root, rootSelector } = {}) {
    const r = root || (rootSelector ? document.querySelector(rootSelector) : document);
    initIn(r);
  };

  // автозапуск
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[collect_api] DOMContentLoaded событие');
    initIn(document);
  });

  // динамика (модалки)
  const seen = new WeakSet();
  const observer = new MutationObserver((recs) => {
    recs.forEach(rec => {
      rec.addedNodes && rec.addedNodes.forEach(n => {
        if (!(n instanceof Element)) return;
        // если добавили .character — запускаемся в его scope
        if (n.matches && n.matches(CHARACTER_SELECTOR) && !seen.has(n)) {
          seen.add(n);
          initIn(scopeForCharacter(n));
        }
        // или если .character появился как потомок
        n.querySelectorAll && n.querySelectorAll(CHARACTER_SELECTOR).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          initIn(scopeForCharacter(el));
        });
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
// button_create_storage.js
// Кнопка "Создать хранилище данных" для создания comment_id в info_<userId>

(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!window.PROFILE_CHECK || !window.PROFILE_CHECK.GroupID || !window.SKIN || !window.PROFILE_CHECK.ForumID || !window.SKIN.LogFieldID) {
    console.warn('[button_create_storage] Требуется window.PROFILE_CHECK с GroupID, ForumID и window.SKIN с LogFieldID');
    return;
  }

  const GID = window.PROFILE_CHECK.GroupID.map(Number);
  const LOG_FIELD_ID = window.SKIN.LogFieldID;
  const AMS_FORUM_ID = window.PROFILE_CHECK.ForumID || [];

  if (!window.FMV) window.FMV = {};

  /**
   * Извлекает userId из профиля в текущем контейнере
   */
  function getUserIdFromProfile(container) {
    const profileLink = container.querySelector('.pl-email.profile a[href*="profile.php?id="]');
    if (!profileLink) return null;

    const match = profileLink.href.match(/profile\.php\?id=(\d+)/);
    return match ? Number(match[1]) : null;
  }

  /**
   * Проверяет наличие skin_<userId> и comment_id
   * @returns {Promise<{skinExists: boolean, commentId: number|null, data: object|null, error: boolean}>}
   */
  async function checkStorage(userId) {
    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      throw new Error('FMVbank.storageGet не найден');
    }

    try {
      const data = await window.FMVbank.storageGet(userId, 'skin_');

      // Если data существует
      if (data && typeof data === 'object') {
        return {
          skinExists: true,
          commentId: data.comment_id || null,
          data: data,
          error: false
        };
      }

      // Данных нет
      return { skinExists: false, commentId: null, data: null, error: false };
    } catch (error) {
      // Ошибка (404 или другая)
      console.log('[button_create_storage] Ошибка при проверке skin_:', error);
      return { skinExists: false, commentId: null, data: null, error: true };
    }
  }

  /**
   * Проверяет персональную страницу /pages/usrN
   * @returns {Promise<{valid: boolean, error: string|null, hasMainUser: boolean}>}
   */
  async function checkPersonalPage(userId) {
    try {
      const pageUrl = `/pages/usr${userId}`;
      const response = await fetch(pageUrl);

      if (!response.ok) {
        return { valid: false, error: `HTTP ${response.status}`, hasMainUser: false };
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Проверка 1: Страница не создана
      const infoDiv = doc.querySelector('.info .container');
      if (infoDiv && /неверная или устаревшая/i.test(infoDiv.textContent)) {
        return { valid: false, error: 'Необходимо создать персональную страницу', hasMainUser: false };
      }

      // Проверка 2: Используется основной профиль
      const modalScript = doc.querySelector('.modal_script[data-main-user_id]');
      const mainUserId = modalScript?.getAttribute('data-main-user_id');

      if (mainUserId && mainUserId.trim()) {
        return { valid: false, error: 'Используется хранилище основного профиля', hasMainUser: true };
      }

      // Всё ок
      return { valid: true, error: null, hasMainUser: false };
    } catch (error) {
      return { valid: false, error: `Ошибка загрузки страницы: ${error.message}`, hasMainUser: false };
    }
  }

  /**
   * Создаёт комментарий в теме логов через iframe
   */
  async function createCommentInLog(userId) {
    return new Promise((resolve, reject) => {
      const topicUrl = '/viewtopic.php?id=' + LOG_FIELD_ID;
      const profileUrl = window.SITE_URL + '/profile.php?id=' + userId;

      console.log('[button_create_storage] Создаём iframe для топика:', topicUrl);

      // Создаём iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = topicUrl;
      document.body.appendChild(iframe);

      // Счетчик загрузок iframe
      let onloadCount = 0;

      // Таймаут на случай зависания
      const timeout = setTimeout(() => {
        iframe.remove();
        reject(new Error('Таймаут создания комментария (15 секунд)'));
      }, 15000);

      // Ждём загрузки iframe
      iframe.onload = function() {
        onloadCount++;
        console.log('[button_create_storage] onload событие #' + onloadCount);

        // Первая загрузка - форма ответа
        if (onloadCount === 1) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const textarea = iframeDoc.querySelector('textarea#main-reply[name="req_message"]');
            const submitButton = iframeDoc.querySelector('input[type="submit"][name="submit"]');

            if (!textarea || !submitButton) {
              clearTimeout(timeout);
              iframe.remove();
              reject(new Error('Не найдена форма ответа в теме логов'));
              return;
            }

            // Вставляем текст
            textarea.value = profileUrl;
            console.log('[button_create_storage] Текст вставлен в textarea:', profileUrl);

            // Отправляем форму
            console.log('[button_create_storage] Нажимаю кнопку отправки');
            submitButton.click();

          } catch (error) {
            clearTimeout(timeout);
            iframe.remove();
            reject(error);
          }
          return;
        }

        // Вторая загрузка - страница после редиректа
        if (onloadCount === 2) {
          console.log('[button_create_storage] Вторая загрузка - пытаемся извлечь comment_id');

          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

            // Пытаемся найти созданный комментарий по классу
            // В rusff комментарии имеют id вида "p<comment_id>"
            const posts = iframeDoc.querySelectorAll('div.post[id^="p"]');
            console.log('[button_create_storage] Найдено постов с id:', posts.length);

            if (posts.length > 0) {
              // Берем последний пост (свежесозданный)
              const lastPost = posts[posts.length - 1];
              const postId = lastPost.id; // Например "p12345"
              console.log('[button_create_storage] ID последнего поста:', postId);

              const match = postId.match(/^p(\d+)$/);
              if (match) {
                const commentId = Number(match[1]);
                console.log('[button_create_storage] ✅ Извлечён comment_id:', commentId);

                clearTimeout(timeout);
                iframe.remove();
                resolve(commentId);
                return;
              }
            }

            // Если не нашли по div.post, пробуем через URL (может быть доступен)
            try {
              const currentUrl = iframe.contentWindow.location.href;
              console.log('[button_create_storage] URL после редиректа:', currentUrl);

              // Ищем pid в параметрах
              const pidMatch = currentUrl.match(/[?&]pid=(\d+)/);
              if (pidMatch) {
                const commentId = Number(pidMatch[1]);
                console.log('[button_create_storage] ✅ Извлечён comment_id из URL:', commentId);

                clearTimeout(timeout);
                iframe.remove();
                resolve(commentId);
                return;
              }

              // Ищем якорь #p123
              const anchorMatch = currentUrl.match(/#p(\d+)/);
              if (anchorMatch) {
                const commentId = Number(anchorMatch[1]);
                console.log('[button_create_storage] ✅ Извлечён comment_id из якоря:', commentId);

                clearTimeout(timeout);
                iframe.remove();
                resolve(commentId);
                return;
              }
            } catch (urlError) {
              console.log('[button_create_storage] Не удалось прочитать URL (CORS):', urlError.message);
            }

            // Не нашли comment_id
            clearTimeout(timeout);
            iframe.remove();
            reject(new Error('Не удалось извлечь comment_id после создания комментария'));

          } catch (error) {
            clearTimeout(timeout);
            iframe.remove();
            reject(error);
          }
        }
      };

      // Обработка ошибки загрузки iframe
      iframe.onerror = function() {
        clearTimeout(timeout);
        clearInterval(redirectCheckInterval);
        iframe.remove();
        reject(new Error('Не удалось загрузить страницу темы'));
      };
    });
  }

  /**
   * Сохраняет comment_id в skin_<userId>
   * @param {object|null} existingData - Существующие данные из GET (если были)
   */
  async function saveCommentId(userId, commentId, existingData = null) {
    if (!window.FMVbank || typeof window.FMVbank.storageSet !== 'function') {
      throw new Error('FMVbank не найден');
    }

    // Используем существующие данные или создаём новый объект
    const baseData = existingData && typeof existingData === 'object' ? existingData : {};

    // Обновляем comment_id и last_timestamp
    baseData.comment_id = commentId;
    baseData.last_timestamp = Math.floor(Date.now() / 1000);

    // Сохраняем (все остальные поля остаются как есть из existingData)
    const result = await window.FMVbank.storageSet(baseData, userId, 'skin_');
    if (!result) {
      throw new Error('Не удалось сохранить данные в API');
    }

    console.log('[button_create_storage] comment_id сохранён в API');
    return true;
  }

  /**
   * Основная логика кнопки
   */
  async function createStorage(userId, setStatus, setDetails, setLink) {
    try {
      setStatus('Проверяю...');
      setDetails('');
      if (setLink) setLink('');

      const siteUrl = window.SITE_URL || window.location.origin;

      // 1. Проверяем наличие skin_<userId>
      const storage = await checkStorage(userId);

      // Если НЕ ошибка и skin_ существует
      if (!storage.error && storage.skinExists) {
        // 1.1. Проверяем comment_id
        if (storage.commentId) {
          // comment_id уже указан
          setStatus('✓ уже указано', 'green');
          setDetails(`Хранилище уже создано (comment_id: ${storage.commentId})`);
          if (setLink) {
            const commentUrl = `${siteUrl}/viewtopic.php?id=${LOG_FIELD_ID}#p${storage.commentId}`;
            setLink(commentUrl);
          }
          return;
        }

        // 1.2. comment_id не указан - продолжаем с существующими данными
        console.log('[button_create_storage] skin_ существует, но comment_id не указан');
      }

      // 2. Если ошибка ИЛИ skin_ не существует - проверяем персональную страницу
      if (storage.error || !storage.skinExists) {
        console.log('[button_create_storage] skin_ не найден или ошибка, проверяем /pages/usr' + userId);
      }

      // 3. Проверяем персональную страницу
      setStatus('Проверяю страницу...');
      const pageCheck = await checkPersonalPage(userId);

      if (!pageCheck.valid) {
        setStatus('✖ ошибка', 'red');
        setDetails(pageCheck.error);
        return;
      }

      // 4. Создаём комментарий
      setStatus('Создаю комментарий...');
      const commentId = await createCommentInLog(userId);

      // 5. Сохраняем comment_id в API (с существующими данными если были)
      setStatus('Сохраняю...');
      await saveCommentId(userId, commentId, storage.data);

      // 6. Успех
      setStatus('✓ готово', 'green');
      setDetails(`Хранилище создано (comment_id: ${commentId})`);
      if (setLink) {
        const commentUrl = `${siteUrl}/viewtopic.php?id=${LOG_FIELD_ID}#p${commentId}`;
        setLink(commentUrl);
      }

    } catch (error) {
      setStatus('✖ ошибка', 'red');
      setDetails(error?.message || String(error));
      console.error('[button_create_storage] Ошибка:', error);
    }
  }

  // Создаём кнопку
  if (typeof window.createForumButton === 'function') {
    window.createForumButton({
      allowedGroups: GID,
      allowedForums: AMS_FORUM_ID,
      label: 'Создать хранилище данных',
      order: 4.5, // Под кнопкой "Создать страницу" (обычно order=4)
      showStatus: true,
      showDetails: true,
      showLink: true,

      async onClick(api) {
        const setStatus = api?.setStatus || (() => { });
        const setDetails = api?.setDetails || (() => { });
        const setLink = api?.setLink || (() => { });

        // Находим контейнер с кнопкой
        const container = document.querySelector('div.post.topicpost');
        if (!container) {
          setStatus('✖ ошибка', 'red');
          setDetails('Не найден контейнер div.post.topicpost');
          return;
        }

        // Извлекаем userId из профиля
        const userId = getUserIdFromProfile(container);
        if (!userId) {
          setStatus('✖ ошибка', 'red');
          setDetails('Не удалось определить ID пользователя');
          return;
        }

        console.log('[button_create_storage] userId:', userId);

        // Запускаем создание хранилища
        await createStorage(userId, setStatus, setDetails, setLink);
      }
    });
  } else {
    console.warn('[button_create_storage] createForumButton не найдена');
  }
})();
// button_load_library.js
// Кнопка "Подгрузить библиотеку" для загрузки данных из постов библиотеки в API

(() => {
  'use strict';

  // Флаг отладки - установите в true для вывода логов
  const DEBUG = false;

  // Функция логирования с проверкой DEBUG
  const log = (...args) => {
    if (DEBUG) console.log('[button_load_library]', ...args);
  };

  log('Скрипт загружен');
  log('window.SKIN:', window.SKIN);

  // Проверяем наличие нужных полей
  if (!window.SKIN || !window.SKIN.LibraryFieldID) {
    console.warn('[button_load_library] Требуется window.SKIN с LibraryFieldID');
    console.warn('[button_load_library] window.SKIN:', window.SKIN);
    return;
  }

  const LIBRARY_FORUM_ID = [window.SKIN.LibraryForumID];
  const GID = window.SKIN.GroupID || [];
  const TID = String(window.SKIN.LibraryFieldID).trim();

  log('LIBRARY_FORUM_ID:', LIBRARY_FORUM_ID);
  log('GID:', GID);
  log('TID (LibraryFieldID):', TID);

  // ID постов библиотеки
  const LIBRARY_POSTS = {
    gift: window.SKIN.LibraryGiftPostID || [],
    plashka: window.SKIN.LibraryPlashkaPostID || [],
    icon: window.SKIN.LibraryIconPostID || [],
    background: window.SKIN.LibraryBackPostID || [],
    coupon: window.SKIN.LibraryCouponPostID || []
  };

  /**
   * Парсит article.card для обычных скинов (gift, plashka, icon, background)
   */
  function parseCardArticle(article) {
    const idEl = article.querySelector('.id');
    const contentEl = article.querySelector('.content');
    const descEl = article.querySelector('.desc');

    if (!idEl) return null;

    const id = idEl.textContent.trim();
    if (!id) return null;

    const item = {
      id: id,
      content: contentEl ? contentEl.innerHTML.trim() : '',
      t: descEl ? descEl.textContent.trim() : '' // title -> t
    };

    // Проверяем классы (сохраняем как 1/0)
    item.h = article.classList.contains('hidden') ? 1 : 0;  // hidden -> h
    item.c = article.classList.contains('custom') ? 1 : 0;  // custom -> c
    item.s = article.classList.contains('system') ? 1 : 0;  // system -> s

    return item;
  }

  /**
   * Парсит article.card для купонов
   */
  function parseCouponArticle(article) {
    const idEl = article.querySelector('.id');
    const contentEl = article.querySelector('.content');
    const descEl = article.querySelector('.desc');
    const titleEl = article.querySelector('.title');
    const typeEl = article.querySelector('.type');
    const formEl = article.querySelector('.form');
    const valueEl = article.querySelector('.value');

    if (!idEl) return null;

    const id = idEl.textContent.trim();
    if (!id) return null;

    const item = {
      id: id,
      content: contentEl ? contentEl.innerHTML.trim() : '',
      t: descEl ? descEl.textContent.trim() : '' // title -> t
    };

    // Дополнительные поля для купонов (могут отсутствовать)
    if (titleEl) {
      const titleText = titleEl.textContent.trim();
      if (titleText) {
        item.s_t = titleText; // system_title -> s_t
      }
    }

    if (typeEl) {
      const typeText = typeEl.textContent.trim();
      if (typeText) {
        item.type = typeText;
      }
    }

    if (formEl) {
      const formText = formEl.textContent.trim();
      if (formText) {
        item.f = formText; // form -> f
      }
    }

    if (valueEl) {
      const val = valueEl.textContent.trim();
      if (val) {
        const numVal = Number(val);
        if (!isNaN(numVal)) {
          item.v = numVal; // value -> v
        }
      }
    }

    // У купонов НЕТ полей hidden, custom, system

    return item;
  }

  /**
   * Декодирует HTML entities
   */
  function decodeEntities(str) {
    const div = document.createElement('div');
    div.innerHTML = String(str ?? '');
    return div.textContent || div.innerText || '';
  }

  /**
   * Загружает HTML с правильной кодировкой
   */
  async function smartFetchHtml(url) {
    const res = await fetch(url, { credentials: 'include' });
    const buf = await res.arrayBuffer();

    const tryDec = enc => {
      try {
        return new TextDecoder(enc).decode(buf);
      } catch {
        return null;
      }
    };

    // Пробуем UTF-8 и Windows-1251
    const utf = tryDec('utf-8') ?? '';
    const cp = tryDec('windows-1251') ?? '';

    // Считаем количество �� (replacement characters)
    const bad = s => (s.match(/\uFFFD/g) || []).length;

    if (bad(cp) && !bad(utf)) return utf;
    if (bad(utf) && !bad(cp)) return cp;

    // Считаем кириллицу
    const cyr = s => (s.match(/[\u0400-\u04FF]/g) || []).length;
    return cyr(cp) > cyr(utf) ? cp : utf;
  }

  /**
   * Загружает и парсит пост библиотеки
   */
  async function loadLibraryPost(postId, isCoupon = false) {
    try {
      const url = `/viewtopic.php?pid=${postId}#p${postId}`;
      log(`Загружаю URL: ${url}`);

      const html = await smartFetchHtml(url);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Ищем конкретный пост по ID: #p<postId>-content
      const postContent = doc.querySelector(`#p${postId}-content`);
      if (!postContent) {
        console.warn(`[button_load_library] Не найден #p${postId}-content`);
        return [];
      }

      log(`Найден #p${postId}-content`);

      // Ищем script[type="text/html"] внутри поста
      const scripts = [...postContent.querySelectorAll('script[type="text/html"]')];
      log(`Найдено script[type="text/html"]: ${scripts.length}`);

      if (!scripts.length) {
        console.warn(`[button_load_library] Нет script[type="text/html"] в посте ${postId}`);
        return [];
      }

      // Извлекаем и декодируем HTML из скриптов
      const combined = scripts.map(s => s.textContent || s.innerHTML || '').join('\n');
      const decoded = decodeEntities(combined).replace(/\u00A0/g, ' ');

      // Парсим декодированный HTML
      const innerDoc = parser.parseFromString(decoded, 'text/html');

      // Ищем article.card внутри #grid
      const articles = innerDoc.querySelectorAll('#grid article.card');
      log(`Найдено article.card: ${articles.length}`);

      const items = [];

      for (const article of articles) {
        const item = isCoupon ? parseCouponArticle(article) : parseCardArticle(article);
        if (item) {
          items.push(item);
        }
      }

      return items;
    } catch (error) {
      console.error(`[button_load_library] Ошибка загрузки поста ${postId}:`, error);
      return [];
    }
  }

  /**
   * Собирает данные из всех постов библиотеки
   */
  async function collectLibraryData() {
    const result = {
      gift: [],
      plashka: [],
      icon: [],
      background: [],
      coupon: []
    };

    for (const [category, postIds] of Object.entries(LIBRARY_POSTS)) {
      if (!Array.isArray(postIds) || postIds.length === 0) {
        log(`Нет постов для категории ${category}`);
        continue;
      }

      const isCoupon = category === 'coupon';

      for (const postId of postIds) {
        log(`Загружаю пост ${postId} для ${category}...`);
        const items = await loadLibraryPost(postId, isCoupon);
        result[category].push(...items);
        log(`Загружено ${items.length} элементов из поста ${postId}`);
      }
    }

    return result;
  }

  /**
   * Сохраняет данные библиотеки в API (в отдельные ключи)
   */
  async function saveLibraryToAPI(data) {
    if (!window.FMVbank || typeof window.FMVbank.storageSet !== 'function') {
      throw new Error('FMVbank.storageSet не найден');
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Сохраняем каждую категорию в отдельный ключ
    const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

    for (const category of categories) {
      const saveData = {
        items: data[category] || [],
        last_timestamp: timestamp
      };

      log(`Сохраняю ${category}:`, saveData);

      // Сохраняем с userId=1 и api_key_label='library_<category>_'
      const result = await window.FMVbank.storageSet(saveData, 1, `library_${category}_`);

      if (!result) {
        throw new Error(`Не удалось сохранить данные для ${category} в API`);
      }
    }

    return true;
  }

  // Создаём кнопку
  log('Проверяем createForumButton:', typeof window.createForumButton);
  if (typeof window.createForumButton === 'function') {
    log('Создаём кнопку с параметрами:', {
      allowedGroups: GID,
      allowedForums: LIBRARY_FORUM_ID,
      topicId: TID,
      label: 'Подгрузить библиотеку'
    });

    window.createForumButton({
      allowedGroups: GID,
      allowedForums: LIBRARY_FORUM_ID,
      topicId: TID,
      label: 'Подгрузить библиотеку',
      order: 1,
      showStatus: true,
      showDetails: true,
      showLink: false,

      async onClick(api) {
        const setStatus = api?.setStatus || (() => { });
        const setDetails = api?.setDetails || (() => { });

        try {
          setStatus('Собираю данные...');
          setDetails('');

          // Собираем данные из постов
          const libraryData = await collectLibraryData();

          // Подсчитываем общее количество элементов
          const total = Object.values(libraryData).reduce((sum, arr) => sum + arr.length, 0);

          if (total === 0) {
            setStatus('✓ готово', 'green');
            setDetails('Не найдено элементов в постах библиотеки');
            return;
          }

          setStatus('Сохраняю...');

          // Сохраняем в API
          await saveLibraryToAPI(libraryData);

          setStatus('✓ готово', 'green');
          const details = Object.entries(libraryData)
            .map(([key, arr]) => `${key}: ${arr.length} шт.`)
            .join('<br>');
          setDetails(`Загружено элементов:<br>${details}<br>Всего: ${total}`);

        } catch (error) {
          setStatus('✖ ошибка', 'red');
          setDetails(error?.message || String(error));
          console.error('[button_load_library] Ошибка:', error);
        }
      }
    });
    log('Кнопка создана');
  } else {
    console.warn('[button_load_library] createForumButton не найдена');
  }

  log('Инициализация завершена');
})();
// chrono_filter.js — модульная, корне-изолированная версия
(() => {
  function makeFilterAPI(root) {
    const $  = (sel, r = root) => r.querySelector(sel);
    const $$ = (sel, r = root) => Array.from(r.querySelectorAll(sel));
    const parseDate = v => (v ? new Date(v) : null);
    const getChecked = (box, name) =>
      Array.from(box?.querySelectorAll(`input[name="${name}"]:checked`) || []).map(i => i.value);

    const filters = $('#filters');
    const list    = $('#list');
    if (!filters || !list) {
      return { apply: () => [], reset: () => [], getVisible: () => [], destroy: () => {} };
    }

    const elDateStart = $('#dateStart');
    const elDateEnd   = $('#dateEnd');
    const elReset     = $('#resetBtn');

    const typeBox     = $('#typeList');
    const statusBox   = $('#statusList');
    const maskBox     = $('#maskList');
    const playerBox   = $('#playerList');
    const locationBox = $('#locationList');

    // дропдауны
    function wireToggle(btnSel, listEl) {
      const btn  = $(btnSel);
      if (!btn || !listEl) return () => {};
      const onBtn = (e) => { e.stopPropagation(); listEl.style.display = listEl.style.display === 'block' ? 'none' : 'block'; };
      const onDoc = (e) => { if (!listEl.contains(e.target) && !btn.contains(e.target)) listEl.style.display = 'none'; };
      btn.addEventListener('click', onBtn);
      document.addEventListener('click', onDoc);
      return () => { btn.removeEventListener('click', onBtn); document.removeEventListener('click', onDoc); };
    }

    const unTypeTgl     = wireToggle('#typeToggle',     typeBox);
    const unStatusTgl   = wireToggle('#statusToggle',   statusBox);
    const unMaskTgl     = wireToggle('#maskToggle',     maskBox);
    const unPlayerTgl   = wireToggle('#playerToggle',   playerBox);
    const unLocationTgl = wireToggle('#locationToggle', locationBox);

    const episodes = $$('#list .episode').map(el => {
      const masks   = (el.dataset.mask    || '').split(';').map(s => s.trim()).filter(Boolean);
      const players = (el.dataset.players || '').split(';').map(s => s.trim()).filter(Boolean);
      return {
        el,
        type:    (el.dataset.type    || '').trim(),
        status:  (el.dataset.status  || '').trim(),
        startL:  parseDate(el.dataset.startL),
        startR:  parseDate(el.dataset.startR),
        endL:    parseDate(el.dataset.endL),
        endR:    parseDate(el.dataset.endR),
        masks, players,
        location: (el.dataset.location || '').trim()
      };
    });

    function apply() {
      const ds = elDateStart?.value ? new Date(elDateStart.value) : null;
      const de = elDateEnd?.value   ? new Date(elDateEnd.value)   : null;

      const selType     = getChecked(typeBox,     'type');
      const selStatus   = getChecked(statusBox,   'status');
      const selMask     = getChecked(maskBox,     'mask');
      const selPlayer   = getChecked(playerBox,   'player');
      const selLocation = getChecked(locationBox, 'location');

      const visible = [], hidden = [];

      episodes.forEach(ep => {
        let ok = true;
        if (ok && ds && ep.endL   && ep.endL   < ds) ok = false;
        if (ok && de && ep.startR && ep.startR > de) ok = false;
        if (ok && selType.length     && !selType.includes(ep.type))           ok = false;
        if (ok && selStatus.length   && !selStatus.includes(ep.status))       ok = false;
        if (ok && selMask.length     && !ep.masks.some(m => selMask.includes(m)))   ok = false;
        if (ok && selPlayer.length   && !ep.players.some(p => selPlayer.includes(p))) ok = false;
        if (ok && selLocation.length && !selLocation.includes(ep.location))   ok = false;

        ep.el.style.display = ok ? '' : 'none';
        (ok ? visible : hidden).push(ep.el);
      });

      // событие — от корня модалки
      root.dispatchEvent(new CustomEvent('chrono:filtered', { detail: { visible, hidden } }));
      return visible;
    }

    function reset() {
      if (elDateStart) elDateStart.value = '';
      if (elDateEnd)   elDateEnd.value   = '';
      $$('#filters .dropdown-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      return apply();
    }

    function onChange(e) {
      if (e.target.closest('#filters .dropdown-list') && e.target.matches('input[type="checkbox"]')) apply();
    }
    root.addEventListener('change', onChange);
    elDateStart?.addEventListener('change', apply);
    elDateEnd?.addEventListener('change', apply);
    elReset?.addEventListener('click', (e) => { e.preventDefault(); reset(); });

    apply();

    return {
      apply, reset,
      getVisible: () => episodes.filter(ep => ep.el.style.display !== 'none').map(ep => ep.el),
      destroy: () => {
        root.removeEventListener('change', onChange);
        elDateStart?.removeEventListener('change', apply);
        elDateEnd?.removeEventListener('change', apply);
        elReset?.removeEventListener('click', reset);
        unTypeTgl(); unStatusTgl(); unMaskTgl(); unPlayerTgl(); unLocationTgl();
      }
    };
  }

  // Публичный API — то, что ждёт modal_loader
  window.ChronoFilter = {
    init({ root } = {}) { return makeFilterAPI(root || document); },
    apply: () => [],
    reset: () => [],
    getVisible: () => [],
    destroy: () => {}
  };
})();
// chrono_info_parser.js
// Глобальный namespace
(function () {
  if (!window.FMV) window.FMV = {};

  /** ============================
   *  Утилиты
   *  ============================ */
  const esc = s => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const escAttr = s => esc(s).replace(/"/g, "&quot;");
  const unique = arr => Array.from(new Set((arr || []).filter(Boolean)));
  const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  // Экспорт утилит (если где-то используются)
  FMV.utils = { esc, escAttr, unique, capitalize };

  // Отображаемые метки для типа/статуса (оставляю как у тебя)
  const TYPE_RU = {
    personal: { label: "личный", emoji: "<иконка>" },
    plot: { label: "сюжетный", emoji: "<иконка>" },
    au: { label: "au", emoji: "<иконка>" },
  };
  const STATUS_RU = {
    on: { label: "активен", emoji: "<иконка>" },
    archived: { label: "неактуален", emoji: "<иконка>" },
    off: { label: "закрыт", emoji: "<иконка>" },
  };

  /** ============================
   *  Работа с датами (ТОЛЬКО эта часть изменялась)
   *  ============================ */
  const pad = n => String(n).padStart(2, "0");
  const lastDayOfMonth = (y, m) => new Date(y, m, 0).getDate();
  const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  // Поддерживаем: dd.mm.yyyy | yyyy-mm-dd | mm.yyyy | yyyy
  function parseDateSmart(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return { y: +m[3], m: +m[2], d: +m[1], g: "day" };
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { y: +m[1], m: +m[2], d: +m[3], g: "day" };
    m = s.match(/^(\d{1,2})\.(\d{4})$/);
    if (m) return { y: +m[2], m: +m[1], d: 1, g: "month" };
    m = s.match(/^(\d{4})$/);
    if (m) return { y: +m[1], m: 1, d: 1, g: "year" };
    return null;
  }

  // Рамки для data-* по твоим правилам (месяц/год → растягиваем до начала/конца)
  function calcBounds(startRaw, endRaw) {
    const ps = parseDateSmart(startRaw);
    const pe = endRaw ? parseDateSmart(endRaw) : null;

    if (!ps && !pe) return { startL: "", startR: "", endL: "", endR: "" };

    // --- START ---
    let startL = "", startR = "";
    if (ps) {
      if (ps.g === "day") {
        startL = toISO(ps.y, ps.m, 1);
        startR = toISO(ps.y, ps.m, ps.d);
      } else if (ps.g === "month") {
        startL = toISO(ps.y, ps.m, 1);
        startR = toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      } else { // year
        startL = toISO(ps.y, 1, 1);
        startR = toISO(ps.y, 12, 31);
      }
    } else if (pe) {
      if (pe.g === "day") {
        startL = toISO(pe.y, pe.m, 1);
        startR = toISO(pe.y, pe.m, pe.d);
      } else if (pe.g === "month") {
        startL = toISO(pe.y, pe.m, 1);
        startR = toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
      } else {
        startL = toISO(pe.y, 1, 1);
        startR = toISO(pe.y, 12, 31);
      }
    }

    // --- END ---
    let endL = "", endR = "";
    if (pe) {
      if (pe.g === "day") {
        endL = toISO(pe.y, pe.m, pe.d);
        endR = toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
      } else if (pe.g === "month") {
        endL = toISO(pe.y, pe.m, 1);
        endR = toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
      } else { // year
        endL = toISO(pe.y, 1, 1);
        endR = toISO(pe.y, 12, 31);
      }
    } else if (ps) {
      if (ps.g === "day") {
        endL = toISO(ps.y, ps.m, ps.d);
        endR = toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      } else if (ps.g === "month") {
        endL = toISO(ps.y, ps.m, 1);
        endR = toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      } else {
        endL = toISO(ps.y, 1, 1);
        endR = toISO(ps.y, 12, 31);
      }
    }

    return { startL, startR, endL, endR };
  }

  // Человеческое отображение в <span class="muted">…</span> по твоим правилам
  function formatHumanRange(startRaw, endRaw) {
    const s = parseDateSmart(startRaw);
    const e = parseDateSmart(endRaw);

    const fmtDay = (o) => `${pad(o.d)}.${pad(o.m)}.${o.y}`;
    const fmtMon = (o) => `${pad(o.m)}.${o.y}`;
    const fmtYear = (o) => `${o.y}`;

    if (!s && !e) return ""; // 0: нет даже года — не выводим

    // Совпадают?
    const equal = (() => {
      if (!s || !e) return false;
      if (s.g === 'day' && e.g === 'day' && s.y === e.y && s.m === e.m && s.d === e.d) return true;
      if (s.g === 'month' && e.g === 'month' && s.y === e.y && s.m === e.m) return true;
      if (s.g === 'year' && e.g === 'year' && s.y === e.y) return true;
      return false;
    })();

    if (equal) {
      if (s.g === 'day') return fmtDay(s);   // dd.mm.yyyy
      if (s.g === 'month') return fmtMon(s);   // mm.yyyy
      if (s.g === 'year') return fmtYear(s);  // yyyy
    }

    // Разные, но одна пустая → ничего
    if (!s || !e) return "";

    // Нормализация a/b/c:
    const S = { ...s };
    const E = { ...e };
    const ensureDay = (obj, month, day = 1) => {
      obj.m = (typeof month === 'number') ? month : (obj.m ?? 1);
      obj.d = day;
      obj.g = 'day';
    };
    const ensureMonth = (obj, month) => {
      obj.m = (typeof month === 'number') ? month : (obj.m ?? 1);
      obj.d = 1;
      obj.g = 'month';
    };
    // a) день vs месяц
    if (S.g === 'day' && E.g === 'month') ensureDay(E, E.m, 1);
    if (E.g === 'day' && S.g === 'month') ensureDay(S, S.m, 1);
    // b) день vs год
    if (S.g === 'day' && E.g === 'year') ensureDay(E, 1, 1);
    if (E.g === 'day' && S.g === 'year') ensureDay(S, 1, 1);
    // c) месяц vs год
    if (S.g === 'month' && E.g === 'year') ensureMonth(E, S.m);
    if (E.g === 'month' && S.g === 'year') ensureMonth(S, E.m);

    // Классы вывода
    if (S.g === 'day' && E.g === 'day') {
      if (S.y === E.y && S.m === E.m && S.d === E.d) return fmtDay(S);
      if (S.y === E.y && S.m === E.m) return `${pad(S.d)}-${pad(E.d)}.${pad(S.m)}.${S.y}`;
      if (S.y === E.y && S.m !== E.m) return `${pad(S.d)}.${pad(S.m)}-${pad(E.d)}.${pad(E.m)}.${S.y}`;
      return `${fmtDay(S)}-${fmtDay(E)}`;
    }
    if (S.g === 'month' && E.g === 'month') {
      if (S.y === E.y && S.m === E.m) return fmtMon(S);
      if (S.y === E.y && S.m !== E.m) return `${pad(S.m)}-${pad(E.m)}.${S.y}`;
      return `${fmtMon(S)}-${fmtMon(E)}`;
    }
    if (S.g === 'year' && E.g === 'year') {
      if (S.y === E.y) return fmtYear(S);
      return `${fmtYear(S)}-${fmtYear(E)}`;
    }
    // Смешанные случаи
    if (S.g === 'day' && E.g === 'month') {
      if (S.y === E.y && S.m === E.m) return fmtDay(S);
      if (S.y === E.y) return `${pad(S.d)}.${pad(S.m)}-${pad(E.m)}.${S.y}`;
      return `${fmtDay(S)}-${fmtMon(E)}`;
    }
    if (S.g === 'month' && E.g === 'day') {
      if (S.y === E.y && S.m === E.m) return fmtDay(E);
      if (S.y === E.y) return `${pad(S.m)}.${S.y}-${pad(E.d)}.${pad(E.m)}.${E.y}`;
      return `${fmtMon(S)}-${fmtDay(E)}`;
    }
    if (S.g === 'day' && E.g === 'year') {
      if (S.y === E.y) return fmtDay(S);
      return `${fmtDay(S)}-${fmtYear(E)}`;
    }
    if (S.g === 'year' && E.g === 'day') {
      if (S.y === E.y) return fmtDay(E);
      return `${fmtYear(S)}-${fmtDay(E)}`;
    }
    if (S.g === 'month' && E.g === 'year') {
      if (S.y === E.y) return fmtMon(S);
      return `${fmtMon(S)}-${fmtYear(E)}`;
    }
    if (S.g === 'year' && E.g === 'month') {
      if (S.y === E.y) return fmtMon(E);
      return `${fmtYear(S)}-${fmtMon(E)}`;
    }
    return "";
  }

  /** ============================
   *  Общий билдер HTML (остальное не трогаю)
   *  ============================ */
  FMV.buildChronoHtml = function buildChronoHtml(userData, opts = {}) {
    const titlePrefix = opts.titlePrefix || "Хронология";
    const userName = esc(userData?.name || "");
    const episodes = Array.isArray(userData?.episodes) ? userData.episodes : [];

    // Справочники
    const masksAll = unique(episodes.flatMap(e => Array.isArray(e?.masks) ? e.masks : []));
    const playersAll = unique(
      episodes.flatMap(e =>
        (Array.isArray(e?.participants) ? e.participants : [])
          .map(p => {
            const masksArr = Array.isArray(p?.masks)
              ? p.masks.filter(Boolean).map(x => String(x).trim()).filter(Boolean)
              : (typeof p?.mask === 'string' && p.mask.trim() ? [p.mask.trim()] : []);
            return masksArr.length ? masksArr.join(", ") : String(p?.name || "").trim();
          })
          .map(t => t.replace(/;/g, " ")) // чтобы не ломать разделитель ;
          .filter(Boolean)
      )
    );
    const locationsAll = unique(episodes.map(e => e?.location).filter(Boolean));

    // Посчитаем рамки и min/max для дефолтов дат
    let globalMin = null, globalMax = null;
    const boundsArr = episodes.map(e => {
      const b = calcBounds(e?.dateStart, e?.dateEnd);
      if (b.startL && (!globalMin || b.startL < globalMin)) globalMin = b.startL;
      if (b.endR && (!globalMax || b.endR > globalMax)) globalMax = b.endR;
      return b;
    });

    // Фильтры
    const typeOptions = Object.entries(TYPE_RU)
      .map(([key, t]) => `<label><input type="checkbox" name="type" value="${escAttr(key)}"> ${esc(t.label)}</label>`)
      .join("");
    const statusOptions = Object.entries(STATUS_RU)
      .map(([key, s]) => `<label><input type="checkbox" name="status" value="${escAttr(key)}"> ${esc(s.label)}</label>`)
      .join("");
    const maskOptions = unique(masksAll)
      .map(m => `<label><input type="checkbox" name="mask" value="${escAttr(m)}"> ${esc(m)}</label>`)
      .join("");
    const playerOptions = playersAll
      .map(p => `<label><input type="checkbox" name="player" value="${escAttr(p)}"> ${esc(p)}</label>`)
      .join("");
    const locationOptions = locationsAll
      .map(l => `<label><input type="checkbox" name="location" value="${escAttr(l)}"> ${esc(l)}</label>`)
      .join("");

    // Шапка + фильтры
    let html = `<div class="filters" id="filters">
    <div class="f">
      <label>Дата начала фильтра</label>
      <input type="date" id="dateStart" value="${escAttr(globalMin || "")}">
    </div>
    <div class="f">
      <label>Дата конца фильтра</label>
      <input type="date" id="dateEnd" value="${escAttr(globalMax || "")}">
    </div>
    <div class="f">
      <label>Тип</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="typeToggle">Выбрать тип</button>
        <div class="dropdown-list" id="typeList">
          ${typeOptions}
        </div>
      </div>
    </div>
    <div class="f">
      <label>Статус</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="statusToggle">Выбрать статус</button>
        <div class="dropdown-list" id="statusList">
          ${statusOptions}
        </div>
      </div>
    </div>
    <div class="f">
      <label>Маска</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="maskToggle">Выбрать маску</button>
        <div class="dropdown-list" id="maskList">
          ${maskOptions}
        </div>
      </div>
    </div>
    <div class="f">
      <label>Участник</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="playerToggle">Выбрать участника</button>
        <div class="dropdown-list" id="playerList">
          ${playerOptions}
        </div>
      </div>
    </div>
    <div class="f">
      <label>Локация</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="locationToggle">Выбрать локацию</button>
        <div class="dropdown-list" id="locationList">
          ${locationOptions}
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="button" id="resetBtn">Сбросить</button>
    </div>
  </div>
  
  <div class="list" id="list">
    `;

    // Эпизоды
    if (!episodes.length) {
      html += `<div class="meta">Нет эпизодов</div></section>`;
      return html;
    }

    episodes.forEach((ep, idx) => {
      const typeMeta = TYPE_RU[ep?.type] || TYPE_RU.au;
      const statusMeta = STATUS_RU[ep?.status] || STATUS_RU.archived;

      const typeLabel = ep?.type || "";
      const typeBadge = `${capitalize(typeLabel)} ${typeMeta.emoji}`;
      const statusLabel = ep?.status || "";
      const statusBadge = `${capitalize(statusLabel)} ${statusMeta.emoji}`;

      const masks = Array.isArray(ep?.masks) ? ep.masks.filter(Boolean) : [];
      // массив с токенами для data-players (как раньше: маски или имя)
      const participantTokens = (Array.isArray(ep?.participants) ? ep.participants : [])
        .map(p => {
          const masksArr = Array.isArray(p?.masks)
            ? p.masks.filter(Boolean).map(x => String(x).trim()).filter(Boolean)
            : (typeof p?.mask === 'string' && p.mask.trim() ? [p.mask.trim()] : []);
          const token = masksArr.length ? masksArr.join(", ") : String(p?.name || "").trim();
          return token.replace(/;/g, " ");
        })
        .filter(Boolean);

      const playersData = participantTokens.join(";"); // для data-players

      // а вот для текстового вывода делаем ссылки
      const playersHuman = (Array.isArray(ep?.participants) ? ep.participants : [])
        .map(p => {
          const display = (Array.isArray(p?.masks) && p.masks.length)
            ? p.masks.join(", ")
            : String(p?.name || "").trim();
          const id = p?.id ? String(p.id).trim() : "";
          return id
            ? `<a href="/profile.php?id=${escAttr(id)}">${esc(display)}</a>`
            : esc(display);
        })
        .filter(Boolean)
        .join(", ");
      const loc = ep?.location || "";

      const b = boundsArr[idx];
      const human = formatHumanRange(ep?.dateStart, ep?.dateEnd);
      const dateBlock = human ? `<span class="muted">${esc(human)} — </span>` : "";



      html += `
  <div class="episode" 
       data-type="${escAttr(typeLabel)}" 
       data-status="${escAttr(statusLabel)}" 
       data-start-l="${escAttr(b.startL)}" data-start-r="${escAttr(b.startR)}" 
       data-end-l="${escAttr(b.endL)}" data-end-r="${escAttr(b.endR)}"
       ${masks.length ? `data-mask="${escAttr(masks.join(';'))}"` : ``}
       ${loc ? `data-location="${escAttr(loc)}"` : ``}
       ${participantTokens.length ? `data-players="${escAttr(playersData)}"` : ``}>
    <div>тип: ${esc(typeBadge)}; статус: ${esc(statusBadge)}</div>
    <div>${dateBlock}<span class="title"><a href="${esc(ep?.href || "#")}">${esc(ep?.title || "")}</a></span>
      ${masks.length ? ` [as ${esc(masks.join(", "))}]` : ""}</div>
    <div>локация: ${esc(loc)}</div>
    <div>участники: ${playersHuman}</div>
  </div>`;
    });

    html += `</div>`;
    return html;
  };
})();
// === проверка через ?edit_page=SLUG ===
async function pageExistsViaEditEndpoint(slug){
  // если в slug есть небезопасные символы — энкодим как в адресной строке (но сам движок принимает ASCII)
  const url = `/admin_pages.php?edit_page=${encodeURIComponent(slug)}`;
  const doc = await fetchCP1251Doc(url);

  // надёжные признаки страницы «редактирование»:
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const h1    = (doc.querySelector('h1, .pagetitle, .tclcon h2')?.textContent || '').trim();

  const looksLikeEditTitle = /Страница создана/i.test(title);

  // форма редактирования обычно содержит hidden name="edit_page" или submit "Сохранить"
  const hasEditHidden = !!doc.querySelector('input[name="edit_page"]');
  const hasSaveBtn = !![...doc.querySelectorAll('input[type="submit"],button[type="submit"]')]
    .find(b => /сохран/i.test(b.value||b.textContent||''));

  // страница «Информация»:
  const looksLikeInfo = /Информация/i.test(title) || /Информация/i.test(h1);

  if (looksLikeEditTitle || hasEditHidden || hasSaveBtn) return true;
  if (looksLikeInfo) return false;

  // fallback: если нет явных признаков, считаем что не существует
  return false;
}

// тянем текст сообщения из «Информация»
function extractInfoMessage(html){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const containers = [
    ...doc.querySelectorAll('.message, .msg, .infobox, .warn, .error, #pun-main p, .block p, .box p')
  ];
  const text = containers.map(n => n.textContent.trim()).filter(Boolean).join('\n').trim();
  return (title ? `[${title}] ` : '') + (text || '').trim();
}

function classifyResult(html){
  const msg = extractInfoMessage(html).toLowerCase();
  if (/уже существует|занято|должно быть уникаль/.test(msg)) return {status:'duplicate', msg};
  if (/страница создана|добавлен|успешно|сохранена/.test(msg))  return {status:'created', msg};
  if (/ошибка|forbidden|нет прав|не удалось|некоррект|заполните/.test(msg)) return {status:'error', msg};
  // когда движок просто возвращает список без явного сообщения
  return {status:'unknown', msg};
}

// === ГЛАВНЫЙ ФЛОУ ===
/**
 * @typedef {Object} CreatePageResult
 * @property {'created'|'exists'|'error'|'uncertain'} status
 * @property {string} title
 * @property {string} name
 * @property {string=} serverMessage
 * @property {number=} httpStatus
 * @property {string=} url
 * @property {string=} details
 */

/**
 * Возвращает промис с результатом; транспортные сбои — через throw/reject.
 */
async function FMVcreatePersonalPage(new_title, new_name, new_content, new_tags, enable_group_ids, announcement) {
  const addUrl = '/admin_pages.php?action=adddel';

  try {
    // A) проверка существования
    const existedBefore = await pageExistsViaEditEndpoint(new_name);
    if (existedBefore) {
      return /** @type {CreatePageResult} */({
        status: 'exists',
        title: new_title,
        name: new_name,
        serverMessage: `Страница "${new_name}" уже существует (до отправки формы).`,
        url: `/admin_pages.php?edit_page=${encodeURIComponent(new_name)}`
      });
    }

    // B) загрузка формы
    const doc = await fetchCP1251Doc(addUrl);
    const form = [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('/admin_pages.php'))
              || doc.querySelector('form[action*="admin_pages.php"]');
    if (!form) {
      return {
        status: 'error',
        title: new_title,
        name: new_name,
        serverMessage: 'Форма добавления не найдена',
        details: 'admin_pages.php без формы'
      };
    }

    // C) заполнение
    (form.querySelector('[name="title"]')   || {}).value = new_title;
    (form.querySelector('[name="name"]')    || {}).value = new_name;
    (form.querySelector('[name="content"]') || {}).value = new_content;
    const tags = form.querySelector('[name="tags"]'); if (tags) tags.value = new_tags;
    const annSel = form.querySelector('select[name="announcement"]');
    if (annSel) annSel.value = announcement;
    else [...form.querySelectorAll('input[name="announcement"]')].forEach(r => r.checked = (r.value===announcement));
    for (const id of enable_group_ids) {
      const cb = form.querySelector(`[name="group[${id}]"]`); if (cb) cb.checked = true;
    }

    let submitName = 'add_page';
    const addBtn = [...form.elements].find(el => el.type==='submit' && (el.name==='add_page' || /создать/i.test(el.value||'')));
    if (addBtn?.name) submitName = addBtn.name;

    const body = serializeFormCP1251_SelectSubmit(form, submitName);

    // D) POST
    const {res, text} = await fetchCP1251Text(addUrl, {
      method:'POST',
      credentials:'include',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      referrer: addUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    });

    const resultParsed = classifyResult(text);          // ваша текущая функция-классификатор
    const serverMsg = extractInfoMessage(text) || '';   // ваша функция извлечения сообщения

    // E) окончательная проверка
    const existsAfter = await pageExistsViaEditEndpoint(new_name);

    // --- нормализация в единый формат ---
    if (resultParsed.status === 'created' || existsAfter) {
      console.log(serverMsg || 'Страница создана');
      return {
        status: 'created',
        title: new_title,
        name: new_name,
        serverMessage: serverMsg || 'Страница создана',
        httpStatus: res.status,
        url: `/admin_pages.php?edit_page=${encodeURIComponent(new_name)}`
      };
    }

    if (resultParsed.status === 'duplicate') {
      console.log(serverMsg || 'Уже существует страница с таким адресным именем');
      return {
        status: 'exists',
        title: new_title,
        name: new_name,
        serverMessage: serverMsg || 'Уже существует страница с таким адресным именем',
        httpStatus: res.status,
        url: `/admin_pages.php?edit_page=${encodeURIComponent(new_name)}`
      };
    }

    if (resultParsed.status === 'error') {
      console.log(resultParsed.msg || serverMsg || 'Ошибка при создании');
      return {
        status: 'error',
        title: new_title,
        name: new_name,
        serverMessage: resultParsed.msg || serverMsg || 'Ошибка при создании',
        httpStatus: res.status
      };
    }

    console.log(serverMsg || 'Не удалось подтвердить создание. Проверьте админку.');
    return {
      status: 'uncertain',
      title: new_title,
      name: new_name,
      serverMessage: serverMsg || 'Не удалось подтвердить создание. Проверьте админку.',
      httpStatus: res.status
    };

  } catch (e) {
    // транспорт/исключения — наружу
    const err = (e && e.message) ? e.message : String(e);
    const wrapped = new Error('Transport/Runtime error: ' + err);
    wrapped.cause = e;
    console.log(err);
    throw wrapped;
  }
}
// ============================= EDIT (update) =============================
/**
 * Обновляет персональную страницу в админке.
 *
 * @param {string} name               Адресное имя (например "usr2_skin")
 * @param {Object} patch              Что меняем
 * @param {string=} patch.title       Новый заголовок (если нужно)
 * @param {string=} patch.content     Новый HTML для textarea (#page-content)
 * @param {string|number=} patch.announcement  "0"|"1" или соответствующее значение селекта/радио
 * @param {string=} patch.tags        Строка тегов
 * @param {number[]=} patch.groupsOn  Список ID групп, которые должны быть включены (галочки)
 * @param {number[]=} patch.groupsOff Список ID групп, которые должны быть сняты
 *
 * @returns {Promise<{status:'saved'|'error'|'forbidden'|'notfound'|'unknown', serverMessage?:string, httpStatus?:number, url?:string}>}
 */
async function FMVeditPersonalPage(name, patch = {}) {
  if (!name) throw new Error('FMVeditPersonalPage: "name" is required');

  const editUrl = `/admin_pages.php?edit_page=${encodeURIComponent(name)}`;

  // --- 1) грузим HTML формы в CP1251 ---
  const doc = await (typeof fetchCP1251Doc === 'function'
    ? fetchCP1251Doc(editUrl)
    : (async () => {
        const html = await fetch(editUrl, { credentials:'include' }).then(r => r.text());
        return new DOMParser().parseFromString(html, 'text/html');
      })()
  );

  // Проверка на «нет доступа / устаревшая ссылка / инфо-страница»
  const bodyText = (doc.body && doc.body.textContent || '').trim();
  if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText)) {
    return { status:'forbidden', serverMessage:'Ссылка неверная или устаревшая', url:editUrl };
  }

  const form = [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('admin_pages.php'))
            || doc.querySelector('form');
  if (!form) {
    return { status:'notfound', serverMessage:'Форма редактирования не найдена', url:editUrl };
  }

  // --- 2) подставляем значения в DOM формы ---
  // title
  if (patch.title != null) {
    const t = form.querySelector('[name="title"]'); if (t) t.value = String(patch.title);
  }
  // content
  if (patch.content != null) {
    const ta = form.querySelector('#page-content,[name="content"]'); if (ta) ta.value = String(patch.content);
  }
  // announcement (select или radio)
  if (patch.announcement != null) {
    const annSel = form.querySelector('select[name="announcement"]');
    if (annSel) annSel.value = String(patch.announcement);
    else {
      const radios = [...form.querySelectorAll('input[name="announcement"]')];
      if (radios.length) radios.forEach(r => r.checked = (r.value == patch.announcement));
    }
  }
  // tags
  if (patch.tags != null) {
    const tags = form.querySelector('[name="tags"]'); if (tags) tags.value = String(patch.tags);
  }
  // groups (checkboxes like name="group[ID]")
  if (Array.isArray(patch.groupsOn)) {
    for (const id of patch.groupsOn) {
      const cb = form.querySelector(`[name="group[${id}]"]`); if (cb) cb.checked = true;
    }
  }
  if (Array.isArray(patch.groupsOff)) {
    for (const id of patch.groupsOff) {
      const cb = form.querySelector(`[name="group[${id}]"]`); if (cb) cb.checked = false;
    }
  }

  // --- 3) выбираем корректное имя сабмита ---
  // Обычно "save", но подстрахуемся: ищем submit-кнопку с текстом "Сохранить"
  let submitName = 'save';
  const saveBtn = [...form.elements].find(el =>
    el.type === 'submit' && (
      el.name === 'save' || /сохр|save/i.test(el.value || el.textContent || '')
    )
  );
  if (saveBtn?.name) submitName = saveBtn.name;

  // --- 4) сериализация формы в CP1251 + POST ---
  let res, text;
  
  // ВАЖНО: постим на фактический action формы (обычно "/admin_pages.php")
  const postUrl = new URL(form.getAttribute('action') || editUrl, location.origin).toString();
  
  if (typeof serializeFormCP1251_SelectSubmit === 'function' && typeof fetchCP1251Text === 'function') {
    const body = serializeFormCP1251_SelectSubmit(form, submitName);
    ({ res, text } = await fetchCP1251Text(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=windows-1251' },
      referrer: editUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    }));
  } else {
    const fd = new FormData(form);
    fd.append(submitName, saveBtn?.value || '1');
    res  = await fetch(postUrl, { method:'POST', credentials:'include', body: fd });
    text = await res.text();
  }

  // --- 5) анализ ответа ---
  const okByText = /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text);
  const msg = (typeof extractInfoMessage === 'function' ? extractInfoMessage(text) : '') || '';

  const redirectedToAdminList =
    res.ok &&
    (res.url && /\/admin_pages\.php(?:\?|$)/.test(res.url)) &&
    !/ошибк|forbidden|нет прав|устаревш/i.test((text || '').toLowerCase());

  // NEW: содержимое ответа похоже на страницу списка админ-страниц
  const looksLikeAdminList =
    /Администрировани[ея]\s*[–-]\s*Страниц[ыь]/i.test(text) ||      // «Администрирование – Страницы»
    /Список\s+персональных\s+страниц/i.test(text);                   // на некоторых шаблонах так

  if (res.ok && (okByText || redirectedToAdminList || looksLikeAdminList)) {
    return { status:'saved', serverMessage: msg || 'Изменения сохранены', httpStatus: res.status, url: editUrl };
  }

  // если есть твой классификатор — используем
  let cls = { status:'unknown', msg };
  if (typeof classifyResult === 'function') {
    try { cls = classifyResult(text); } catch {}
  }
  if (/ошибк|forbidden|нет прав|устаревш/i.test((msg || cls.msg || '').toLowerCase())) {
    return { status:'forbidden', serverMessage: msg || cls.msg || 'Нет прав/ошибка сохранения', httpStatus: res.status, url: editUrl };
  }

  return { status:'error', serverMessage: msg || 'Ошибка сохранения', httpStatus: res.status, url: editUrl };
}
// =========================== /EDIT (update) ============================

/**
 * Удобный шорткат: заменить только textarea (#page-content).
 * @param {string} name
 * @param {string} newHtml
 */
async function FMVeditTextareaOnly(name, newHtml) {
  return FMVeditPersonalPage(name, { content: newHtml });
}

/* Forms */
// button_personal_page.init.js
(() => {
  'use strict';

  createForumButton({
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Создать страницу',
    order: 1, // чем меньше — тем выше среди других кнопок

    async onClick({ setStatus, setDetails, setLink }) {
      // --- арг1: имя темы
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) { setStatus('✖ нет имени темы', 'red'); setDetails('Ожидался #pun-main h1 span'); return; }

      // --- арг2: usr{id} из ссылки профиля
      let profLink = document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch { }
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }
      const userId = idMatch[1];
      const arg2 = `usr${userId}`;

      // --- остальные аргументы из PROFILE_CHECK
      // Заменяем N в data-id="N" на userId
      const rawTemplate = window.PROFILE_CHECK?.PPageTemplate || '';
      const arg3 = rawTemplate.replace(/data-id="N"/g, `data-id="${userId}"`);
      const arg4 = '';
      const arg5 = window.PROFILE_CHECK?.PPageGroupID;
      const arg6 = '0';

      if (typeof window.FMVcreatePersonalPage !== 'function') {
        setStatus('✖ функция не найдена', 'red');
        setDetails('Ожидалась window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6)');
        return;
      }

      // --- вызов
      setStatus('Создаём…', '#555');
      setDetails('');
      setLink(null);

      try {
        const res = await window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6);

        switch (res?.status) {
          case 'created': setStatus('✓ создано', 'green'); break;
          case 'exists': setStatus('ℹ уже существует', 'green'); break;
          case 'error': setStatus('✖ ошибка', 'red'); break;
          default: setStatus('❔ не удалось подтвердить', '#b80');
        }

        if (res?.url) setLink(res.url, 'Открыть страницу');

        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus) lines.push('HTTP: ' + res.httpStatus);
        if (res?.title) lines.push('Пользователь: ' + res.title);
        if (res?.name) lines.push('Адресное имя: ' + res.name);
        if (res?.details) lines.push('Details: ' + res.details);
        setDetails(lines.join('\n') || 'Нет дополнительных данных');

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails(err?.message || String(err));
        console.error('[button_personal_page]', err);
      }
    }
  });
})();
// button_update_group.init.js
(() => {
  'use strict';

  createForumButton({
    // доступ ограничиваем извне заданными списками
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Сменить группу',
    order: 4,

    async onClick({ setStatus, setDetails }) {
      // --- 0) Проверка конфигурации PROFILE_CHECK ---
      const fromStr = (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupUserID) || '';
      const toStr   = (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupPlayerID) || '';

      if (!fromStr || !toStr) {
        const missing = [
          !fromStr ? 'PROFILE_CHECK.GroupUserID' : null,
          !toStr   ? 'PROFILE_CHECK.GroupPlayerID' : null
        ].filter(Boolean).join(', ');
        setStatus('✖ замена не выполнена', 'red');
        setDetails(
          'Не удалось запустить изменение группы: ' +
          (missing
            ? `не заданы параметры ${missing}. Укажите значения и повторите.`
            : 'отсутствуют необходимые параметры.')
        );
        return;
      }

      // --- 1) Контекст: извлекаем userId из ссылки "Профиль" в теме ---
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      const userId = idMatch ? idMatch[1] : '';
      if (!userId) {
        setStatus('✖ не найден userId', 'red');
        setDetails('Не удалось извлечь profile.php?id=... из страницы темы');
        return;
      }

      // --- 2) Наличие основной функции ---
      if (typeof window.FMVupdateGroupIfEquals !== 'function') {
        setStatus('✖ функция недоступна', 'red');
        setDetails('Ожидалась window.FMVupdateGroupIfEquals(userId, fromId, toId)');
        return;
      }

      // --- 3) Запуск смены группы (только если текущая == fromStr) ---
      setStatus('Проверяю и обновляю…', '#555');
      setDetails('');
      try {
        const res = await window.FMVupdateGroupIfEquals(userId, fromStr, toStr);

        // пробуем вытащить текущее значение из details (формат: "current=..."), если есть
        let currentVal = '';
        if (res?.details) {
          const m = String(res.details).match(/current=([^\s]+)/);
          if (m) currentVal = m[1];
        }

        switch (res?.status) {
          case 'updated':
            setStatus('✓ группа изменена', 'green');
            break;

          case 'nochange':
            setStatus('ℹ изменений нет — пользователь уже в целевой группе', 'green');
            break;

          case 'skipped':
            setStatus('✖ исходная группа не совпадает', 'red');
            setDetails(
              `Исходное значение группы — ${currentVal || 'не определено'}.\n` +
              'Либо вы пытаетесь поправить не тот профиль, либо выполните замену вручную ' +
              'для дополнительной валидации.'
            );
            return;

          case 'uncertain':
            setStatus('❔ не удалось подтвердить результат', '#b80');
            break;

          case 'error':
          default:
            setStatus('✖ ошибка при сохранении', 'red');
        }

        // Доп. сведения — в «детали»
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
        lines.push('Пользователь: ' + (res?.userId ?? userId));
        lines.push(`Замена: ${fromStr} → ${toStr}`);
        if (currentVal)         lines.push('Текущее (до попытки): ' + currentVal);
        if (res?.details && !currentVal) lines.push('Details: ' + res.details);
        setDetails(lines.join('\n') || 'Нет дополнительных данных');

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_update_group]', err);
      }
    }
  });
})();
// button_update_money_field.init.js
(() => {
  'use strict';

  createForumButton({
    // доступы передаём параметрами (ничего не объединяем внутри)
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Выдать монетки',
    order: 3, // задайте нужное место среди других кнопок

    async onClick({ setStatus, setDetails }) {
      // 1) Контекст: userId (для кого обновляем поле)
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch { }
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }
      const userId = idMatch[1];

      // 2) Проверяем персональную страницу /pages/usrN
      const fieldId = window.PROFILE_CHECK?.MoneyFieldID;
      const rawTemplate = window.PROFILE_CHECK?.MoneyFieldTemplate;
      let fieldValue;

      try {
        const pageUrl = `/pages/usr${userId}`;
        const response = await fetch(pageUrl);
        if (!response.ok) {
          setStatus('✖ ошибка загрузки страницы', 'red');
          setDetails(`Не удалось загрузить ${pageUrl}: HTTP ${response.status}`);
          return;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Проверяем наличие ошибки "неверная или устаревшая"
        const infoDiv = doc.querySelector('.info .container');
        if (infoDiv && /неверная или устаревшая/i.test(infoDiv.textContent)) {
          setStatus('✖ страница не создана', 'red');
          setDetails('Необходимо создать персональную страницу');
          return;
        }

        // Проверяем наличие modal_script с data-main-user_id
        const modalScript = doc.querySelector('.modal_script[data-main-user_id]');
        const mainUserId = modalScript?.getAttribute('data-main-user_id');

        if (mainUserId && mainUserId.trim()) {
          // Используем <!-- main: usrK -->
          fieldValue = `<!-- main: usr${mainUserId.trim()} -->`;
        } else {
          // Используем шаблонное значение
          fieldValue = String(rawTemplate);
        }
      } catch (err) {
        setStatus('✖ ошибка проверки страницы', 'red');
        setDetails(`Ошибка при загрузке /pages/usr${userId}: ${err.message}`);
        console.error('[button_update_money_field]', err);
        return;
      }

      if (typeof window.FMVreplaceFieldData !== 'function') {
        setStatus('✖ функция обновления не найдена', 'red');
        setDetails('Ожидалась window.FMVreplaceFieldData(userId, fieldId, value)');
        return;
      }

      // 3) Вызов обновления
      setStatus('Обновляем…', '#555');
      setDetails('');
      try {
        // контракт: FMVreplaceFieldData(userId, fieldId, value)
        const res = await window.FMVreplaceFieldData(userId, fieldId, fieldValue);

        // статусы
        switch (res?.status) {
          case 'updated': setStatus('✓ обновлено', 'green'); break;
          case 'nochange': setStatus('ℹ изменений нет', 'green'); break;
          case 'error': setStatus('✖ ошибка', 'red'); break;
          default: setStatus('❔ не удалось подтвердить', '#b80');
        }

        // детали
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus) lines.push('HTTP: ' + res.httpStatus);
        lines.push('Поле: ' + (res?.fieldId ?? fieldId));
        lines.push('Пользователь: ' + (res?.userId ?? userId));
        lines.push('Значение: ' + fieldValue);
        if (res?.details) lines.push('Details: ' + res.details);
        setDetails(lines.join('\n'));

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_update_money_field]', err);
      }
    }
  });
})();

/* Profile */
// fetch_libraries.js — Загрузка библиотек (плашки, иконки, фон, подарки, купоны)

/**
 * Загружает все библиотеки из API (library_icon_1, library_plashka_1, и т.д.)
 * @returns {Promise<Object>} { plashka: [], icon: [], back: [], gift: [], coupon: [] }
 */
async function fetchAllLibraries() {
  console.log('[fetchAllLibraries] Загружаю библиотеки из API');

  // Проверка наличия FMVbank
  if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
    console.error('[fetchAllLibraries] FMVbank.storageGet не найден');
    return {
      plashka: [],
      icon: [],
      back: [],
      gift: [],
      coupon: []
    };
  }

  function escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const result = {
    plashka: [],
    icon: [],
    back: [],
    gift: [],
    coupon: []
  };

  const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

  for (const category of categories) {
    try {
      // Загружаем каждую категорию из отдельного ключа
      const data = await window.FMVbank.storageGet(1, `library_${category}_`);

      if (!data || !data.items || !Array.isArray(data.items)) {
        console.warn(`[fetchAllLibraries] library_${category}_1 не найдена или пуста`);
        continue;
      }

      // Конвертируем данные из API в формат для панелей
      // Формат API: { id, content, t, h, c, s } где t=title, h=hidden, c=custom, s=system (значения 1/0)
      // Формат панели: { id, html } где html = <div class="item" data-id="..." title="...">content</div>

      if (category === 'coupon') {
        // Купоны: {id, content, t, s_t, type, f, v}
        result.coupon = data.items.map(item => {
          const titleAttr = item.t ? ` title="${escapeAttr(item.t)}"` : '';
          const systemTitleAttr = item.s_t ? ` data-coupon-title="${escapeAttr(item.s_t)}"` : '';
          const typeAttr = item.type ? ` data-coupon-type="${escapeAttr(item.type)}"` : '';
          const formAttr = item.f ? ` data-coupon-form="${escapeAttr(item.f)}"` : '';
          const valueAttr = item.v !== undefined ? ` data-coupon-value="${escapeAttr(String(item.v))}"` : '';

          return {
            id: item.id,
            html: `<div class="item" data-id="${escapeAttr(item.id)}"${titleAttr}${systemTitleAttr}${typeAttr}${formAttr}${valueAttr}>${item.content || ''}</div>`
          };
        });
      } else {
        // Обычные скины: {id, content, t, h, c, s}
        const items = data.items
          .filter(item => item.h !== 1) // Фильтруем hidden
          .map(item => ({
            id: item.id,
            html: `<div class="item" data-id="${escapeAttr(item.id)}" title="${escapeAttr(item.t || '')}">${item.content || ''}</div>`
          }));

        // Сопоставляем категории с ключами результата
        const targetKey = category === 'background' ? 'back' : category;
        result[targetKey] = items;
      }
    } catch (error) {
      console.error(`[fetchAllLibraries] Ошибка загрузки ${category}:`, error);
    }
  }

  return result;
}

// Экспортируем в window
window.fetchAllLibraries = fetchAllLibraries;
// Admin: универсальные панели выбора (JSON-режим для API)
// createChoicePanelJSON({ title, targetClass, library, ...opts })
// Возвращает { getData(), init(jsonArray) }

(function(){
  'use strict';


  const baseCSS = `
  details.ufo-panel{margin-top:12px;border:1px solid #d0d0d7;border-radius:10px;background:#fff}
  details.ufo-panel>summary{cursor:pointer;list-style:none;padding:10px 14px;font-weight:600;background:#f6f6f8;border-bottom:1px solid #e6e6ef;border-radius:10px}
  details.ufo-panel>summary::-webkit-details-marker{display:none}
  .ufo-wrap{display:flex;flex-direction:column;gap:16px;padding:14px}
  .ufo-col{display:flex;flex-direction:column;gap:8px}
  .ufo-col h4{margin:0;font-size:14px;opacity:.8;display:flex;justify-content:space-between;align-items:center}
  .ufo-search{padding:6px 10px;font-size:13px;border:1px solid #d0d0d7;border-radius:8px;background:#f5f2e8}
  .ufo-lib,.ufo-selected{border:1px dashed #c9c9d9;border-radius:8px;background:#fafafd;padding:8px;overflow:auto}
  .ufo-lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
  .ufo-lib .ufo-card{margin:0}
  .ufo-card{display:grid;grid-template-columns:auto 1fr auto auto;grid-template-rows:auto auto;grid-template-areas:"id full date actions" "id title title actions";gap:8px;background:#fff;border:1px solid #e7e7ef;border-radius:8px;padding:8px;margin:6px 0;max-width:100%;position:relative;overflow:hidden}
  .ufo-idtag{grid-area:id;font-size:11px;opacity:.7;align-self:start}
  .ufo-actions{grid-area:actions;display:flex;align-items:center;gap:6px}
  .ufo-btn{border:1px solid #d7d7e0;background:#f3f3f7;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;line-height:1.15;display:inline-flex;align-items:center}
  .ufo-btn:hover{background:#ececf4}
  .ufo-card.disabled{opacity:.4;pointer-events:none}
  .ufo-full{grid-area:full;box-sizing:border-box;margin:0;padding:0;border:0;background:transparent;overflow:hidden}
  .ufo-full .item{position:relative;margin:0}
  .ufo-full .item .modal-link{display:block}
  .ufo-full .item img{display:block;max-width:100%;height:auto;border-radius:6px}
  .ufo-lib .ufo-full .item img{height:90px;width:100%;object-fit:cover}
  .ufo-lib .ufo-full a{pointer-events:none}
  .ufo-title-edit{grid-area:title;border:1px dashed #aaa;border-radius:6px;padding:6px 8px;background:#fffef7;font-size:13px;white-space:pre-wrap;overflow:visible}
  .ufo-title-edit:focus{outline:none;background:#fffdf1}
  .ufo-date-edit{grid-area:date;border:1px dashed #aaa;border-radius:6px;padding:6px 8px;background:#fffef7;font-size:13px;align-self:start}
  .ufo-date-edit input{border:none;background:transparent;font-size:13px;width:100%;font-family:inherit}
  .ufo-date-edit input:focus{outline:none}
  `;
  (function injectCSS(){
    if (window.__ufoCSS) return;
    window.__ufoCSS = true;
    const s=document.createElement('style'); s.textContent=baseCSS; document.head.appendChild(s);
    if (typeof GM_addStyle==='function') GM_addStyle(baseCSS);
  })();

  const mkBtn = (txt, onClick) => { const b=document.createElement('button'); b.type='button'; b.className='ufo-btn'; b.textContent=txt; b.addEventListener('click', onClick); return b; };

  function computeTwoRowMaxSelected(container){
    const first = container.querySelector('.ufo-card');
    if (!first) { container.style.maxHeight = ''; return; }
    const style = getComputedStyle(first);
    const h = first.getBoundingClientRect().height;
    const mt = parseFloat(style.marginTop) || 0;
    const mb = parseFloat(style.marginBottom) || 0;
    const cStyle = getComputedStyle(container);
    const pt = parseFloat(cStyle.paddingTop) || 0;
    const pb = parseFloat(cStyle.paddingBottom) || 0;
    const max = Math.round(h * 2 + (mt + mb) * 3 + pt + pb);
    container.style.maxHeight = max + 'px';
  }
  function firstVisibleCard(container){ const cards = [...container.querySelectorAll('.ufo-card')]; return cards.find(c => getComputedStyle(c).display !== 'none') || null; }
  function computeTwoRowMaxLib(container){ const card = firstVisibleCard(container); if (!card) { container.style.maxHeight=''; return; } const ch = card.getBoundingClientRect().height; const cs = getComputedStyle(container); const rowGap = parseFloat(cs.rowGap) || 0; const pt = parseFloat(cs.paddingTop) || 0; const pb = parseFloat(cs.paddingBottom) || 0; const max = Math.round(ch * 2 + rowGap + pt + pb); container.style.maxHeight = max + 'px'; }

  function createChoicePanelJSON(userOpts){
    const opts = Object.assign({
      title: 'Библиотека и выбранные',
      targetClass: '_section',
      library: [],           // [{ id, html }]
      startOpen: false,
      itemSelector: '.item',
      idAttr: 'data-id',
      editableAttr: 'title',
      searchPlaceholder: 'поиск по id',
      mountEl: null,
      allowMultiAdd: false,
      expirableAttr: null    // например 'data-expired-date' для купонов
    }, userOpts || {});
    if (!Array.isArray(opts.library)) opts.library = [];

    const uid = 'ufo_' + (opts.targetClass || 'section').replace(/\W+/g,'_') + '_' + Math.random().toString(36).slice(2,7);

    // Массив выбранных элементов (внутреннее состояние)
    // Каждый элемент: { id, title, content, expired_date?, ...data-attrs }
    let selectedItems = [];

    const details = document.createElement('details'); details.className = 'ufo-panel'; details.open = !!opts.startOpen;
    const summary = document.createElement('summary'); summary.textContent = opts.title || 'Панель';
    const wrap = document.createElement('div'); wrap.className='ufo-wrap';

    const libCol = document.createElement('div'); libCol.className='ufo-col';
    const hLib = document.createElement('h4'); hLib.textContent='Библиотека';
    const search = document.createElement('input'); search.type='text'; search.placeholder = opts.searchPlaceholder || 'поиск по id'; search.className='ufo-search'; hLib.appendChild(search);
    const libBox = document.createElement('div'); libBox.className='ufo-lib'; libBox.id = uid+'-lib';
    libCol.append(hLib, libBox);

    const selCol = document.createElement('div'); selCol.className='ufo-col'; selCol.innerHTML = '<h4>Выбранные (сверху — новее)</h4>';
    const selBox = document.createElement('div'); selBox.className='ufo-selected'; selBox.id = uid+'-selected';
    selCol.appendChild(selBox);

    wrap.append(libCol, selCol); details.append(summary, wrap);

    if (opts.mountEl) {
      opts.mountEl.appendChild(details);
    }

    function renderLibItem(item){
      const card=document.createElement('div'); card.className='ufo-card'; card.dataset.id=item.id;
      const id=document.createElement('div'); id.className='ufo-idtag'; id.textContent='#'+item.id;
      const full=document.createElement('div'); full.className='ufo-full';
      const tmp=document.createElement('div'); tmp.innerHTML=item.html.trim(); full.appendChild(tmp.firstElementChild);
      const actions=document.createElement('div'); actions.className='ufo-actions';
      actions.appendChild(mkBtn('Добавить ↑', (e)=>{e.preventDefault(); e.stopPropagation(); addItemFromLibrary(item); }));
      card.append(id, full, actions); return card;
    }
    opts.library.forEach(x => libBox.appendChild(renderLibItem(x)));

    /**
     * Добавляет элемент из библиотеки в selectedItems
     */
    function addItemFromLibrary(libItem) {
      const libCard = libBox.querySelector(`.ufo-card[data-id="${libItem.id}"]`);

      // Блокировка дублей (если allowMultiAdd = false)
      if (!opts.allowMultiAdd) {
        if (selectedItems.some(i => i.id === libItem.id)) return;
        if (libCard) libCard.classList.add('disabled');
      }

      // Парсим HTML из библиотеки, извлекаем данные
      const tmp = document.createElement('div');
      tmp.innerHTML = libItem.html.trim();
      const itemEl = tmp.querySelector(opts.itemSelector);

      const newItem = {
        id: libItem.id,
        title: itemEl ? (itemEl.getAttribute(opts.editableAttr) || '') : '',
        content: itemEl ? itemEl.innerHTML.trim() : '', // Только innerHTML, без обёртки
      };

      // Извлекаем ВСЕ data-* атрибуты из элемента
      if (itemEl && itemEl.attributes) {
        for (let i = 0; i < itemEl.attributes.length; i++) {
          const attr = itemEl.attributes[i];
          if (attr.name.startsWith('data-') && attr.name !== 'data-id') {
            // Убираем префикс "data-" и заменяем дефисы на подчёркивания
            const key = attr.name.substring(5).replace(/-/g, '_');
            newItem[key] = attr.value;
          }
        }
      }

      // Если есть expirableAttr, извлекаем дату (может перезаписать то, что извлекли выше)
      if (opts.expirableAttr && itemEl) {
        newItem.expired_date = itemEl.getAttribute(opts.expirableAttr) || '';
      }

      selectedItems.unshift(newItem); // добавляем в начало (новее сверху)
      renderSelected();
    }

    /**
     * Рендерит UI из selectedItems
     */
    function renderSelected() {
      selBox.innerHTML = '';
      selectedItems.forEach((item, index) => {
        const row = createSelectedCard(item, index);
        selBox.appendChild(row);
      });
      computeTwoRowMaxSelected(selBox);
    }

    /**
     * Создаёт DOM-карточку для выбранного элемента
     */
    function createSelectedCard(item, index) {
      const row = document.createElement('div');
      row.className = 'ufo-card';
      row.draggable = true;
      row.dataset.id = item.id;
      row.dataset.index = index;

      const id = document.createElement('div');
      id.className = 'ufo-idtag';
      id.textContent = '#' + item.id;

      const full = document.createElement('div');
      full.className = 'ufo-full';
      const tmp = document.createElement('div');
      tmp.innerHTML = item.content.trim();
      full.appendChild(tmp.firstElementChild);

      const editor = document.createElement('div');
      editor.className = 'ufo-title-edit';
      editor.contentEditable = true;
      editor.textContent = item.title || '';
      editor.addEventListener('blur', () => {
        const cleanTitle = String(editor.innerHTML || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        selectedItems[index].title = cleanTitle;
      });

      let dateEditor = null;
      if (opts.expirableAttr) {
        dateEditor = document.createElement('div');
        dateEditor.className = 'ufo-date-edit';
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.value = item.expired_date || '';
        dateInput.addEventListener('change', () => {
          selectedItems[index].expired_date = dateInput.value;
        });
        dateEditor.appendChild(dateInput);
      }

      const actions = document.createElement('div');
      actions.className = 'ufo-actions';
      const recalc = () => computeTwoRowMaxSelected(selBox);

      const btnUp = mkBtn('↑', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (index > 0) {
          [selectedItems[index - 1], selectedItems[index]] = [selectedItems[index], selectedItems[index - 1]];
          renderSelected();
        }
      });
      const btnDown = mkBtn('↓', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (index < selectedItems.length - 1) {
          [selectedItems[index], selectedItems[index + 1]] = [selectedItems[index + 1], selectedItems[index]];
          renderSelected();
        }
      });
      const btnRemove = mkBtn('✕', (e) => {
        e.preventDefault(); e.stopPropagation();
        selectedItems.splice(index, 1);
        if (!opts.allowMultiAdd) {
          const libCard = libBox.querySelector(`.ufo-card[data-id="${item.id}"]`);
          if (libCard) libCard.classList.remove('disabled');
        }
        renderSelected();
      });

      actions.append(btnUp, btnDown, btnRemove);

      row.append(id, full, actions, editor);
      if (dateEditor) row.appendChild(dateEditor);

      return row;
    }

    // Drag & Drop для переупорядочивания
    (function enableDnd(container) {
      let dragIndex = null;
      container.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.ufo-card');
        if (!card) return;
        dragIndex = parseInt(card.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      });
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const over = e.target.closest('.ufo-card');
        if (!over || dragIndex === null) return;
        const overIndex = parseInt(over.dataset.index, 10);
        if (dragIndex === overIndex) return;
        // Меняем местами в массиве
        const temp = selectedItems[dragIndex];
        selectedItems.splice(dragIndex, 1);
        selectedItems.splice(overIndex, 0, temp);
        dragIndex = overIndex;
        renderSelected();
      });
      container.addEventListener('drop', (e) => {
        e.preventDefault();
        dragIndex = null;
      });
      container.addEventListener('dragend', () => {
        dragIndex = null;
      });
    })(selBox);

    // Поиск в библиотеке
    search.addEventListener('input', () => {
      const v = search.value.trim();
      libBox.querySelectorAll('.ufo-card').forEach(c => {
        c.style.display = (!v || c.dataset.id.includes(v)) ? '' : 'none';
      });
      computeTwoRowMaxLib(libBox);
    });

    const mo1 = new MutationObserver(() => computeTwoRowMaxSelected(selBox));
    mo1.observe(selBox, { childList: true, subtree: true, attributes: true });
    const mo2 = new MutationObserver(() => computeTwoRowMaxLib(libBox));
    mo2.observe(libBox, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', () => { computeTwoRowMaxLib(libBox); computeTwoRowMaxSelected(selBox); });
    computeTwoRowMaxLib(libBox);
    computeTwoRowMaxSelected(selBox);

    /**
     * Инициализация из массива JSON
     * @param {Array} jsonArray - [{ id, title, content, ...data-attrs }]
     */
    function init(jsonArray) {
      if (!Array.isArray(jsonArray)) return;
      selectedItems = [];
      jsonArray.forEach(item => {
        // Добавляем элемент как есть
        selectedItems.push({ ...item });

        // Блокируем в библиотеке если нужно
        if (!opts.allowMultiAdd) {
          const libCard = libBox.querySelector(`.ufo-card[data-id="${item.id}"]`);
          if (libCard) libCard.classList.add('disabled');
        }
      });
      renderSelected();
    }

    /**
     * Возвращает массив данных для сохранения в API
     * @returns {Array} [{ id, title, content, ...data-attrs }]
     */
    function getData() {
      return selectedItems.map(item => {
        // Создаём временный элемент для применения изменений
        const tmp = document.createElement('div');
        tmp.innerHTML = item.content.trim();

        // Если купоны (expirableAttr), всегда добавляем/обновляем span.coupon_deadline
        if (opts.expirableAttr) {
          // Находим img и добавляем span после него
          const imgEl = tmp.querySelector('img');
          if (imgEl) {
            // Удаляем старый span если есть
            const oldSpan = imgEl.parentNode.querySelector('.coupon_deadline');
            if (oldSpan) oldSpan.remove();

            // Создаём новый span
            const deadlineSpan = document.createElement('span');
            deadlineSpan.className = 'coupon_deadline';

            if (item.expired_date) {
              // Конвертируем yyyy-mm-dd -> dd/mm/yy
              const parts = item.expired_date.split('-');
              if (parts.length === 3) {
                const year = parts[0].slice(2);
                const month = parts[1];
                const day = parts[2];
                deadlineSpan.textContent = `${day}/${month}/${year}`;
              }
            }
            // Если даты нет, span остаётся пустым

            // Вставляем span после img
            if (imgEl.nextSibling) {
              imgEl.parentNode.insertBefore(deadlineSpan, imgEl.nextSibling);
            } else {
              imgEl.parentNode.appendChild(deadlineSpan);
            }
          }
        }

        // Применяем title к атрибуту (если нужно)
        if (item.title) {
          const titleAttrElements = tmp.querySelectorAll(`[${opts.editableAttr}]`);
          titleAttrElements.forEach(el => {
            el.setAttribute(opts.editableAttr, item.title);
          });
        }

        // Собираем результат
        const result = {
          id: item.id,
          title: item.title || '',
          content: tmp.innerHTML.trim()
        };

        // Добавляем все data-* атрибуты (кроме id, title, content)
        Object.keys(item).forEach(key => {
          if (key !== 'id' && key !== 'title' && key !== 'content') {
            result[key] = item[key];
          }
        });

        return result;
      });
    }

    return { details, init, getData };
  }

  window.createChoicePanelJSON = createChoicePanelJSON;
})();
// skin_set_up_json.js
// setupSkinsJSON(container, opts?) -> Promise<{ getData() => object, panels }>

(function () {
  'use strict';

  /**
   * @param {HTMLElement} container         куда рисовать панели
   * @param {Object=}     opts
   *   @param {boolean=}  opts.withHeaders  показывать заголовки секций (по умолчанию true)
   *   @param {boolean=}  opts.startOpen    панели раскрыты при старте (по умолчанию false)
   *   @param {Object=}   opts.initialData  начальные данные { icon: [], plashka: [], background: [], gift: [], coupon: [] }
   *
   * @returns {Promise<{ getData: ()=>object, panels: { plashka, icon, back, gift, coupon } }>}
   */
  async function setupSkinsJSON(container, opts = {}) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('[setupSkinsJSON] container обязателен и должен быть HTMLElement');
    }
    if (typeof window.createChoicePanelJSON !== 'function') {
      throw new Error('[setupSkinsJSON] createChoicePanelJSON не найден. Подключите файл с панелью раньше.');
    }

    if (window.__skinsSetupJSONMounted) {
      return window.__skinsSetupJSONMounted;
    }

    const withHeaders = opts.withHeaders ?? true;
    const startOpen   = opts.startOpen   ?? false;
    const initialData = opts.initialData || {};

    // Проверка наличия fetchAllLibraries
    if (typeof window.fetchAllLibraries !== 'function') {
      console.error('[setupSkinsJSON] window.fetchAllLibraries не найдена. Подключите fetch_libraries.js');
      return;
    }

    // Загружаем все библиотеки
    const libraries = await window.fetchAllLibraries();
    const libPlashka0 = libraries.plashka;
    const libIcon0 = libraries.icon;
    const libBack0 = libraries.back;
    const libGift0 = libraries.gift;
    const libCoupon0 = libraries.coupon;

    // --- контейнер под панели
    let grid = container.querySelector('.skins-setup-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'skins-setup-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr';
      grid.style.gap = '16px';
      container.appendChild(grid);
    }

    // --- панели (JSON-режим)
    const panelGift = window.createChoicePanelJSON({
      title: withHeaders ? 'Подарки' : undefined,
      targetClass: '_gift',
      library: libGift0,
      mountEl: grid,
      startOpen,
      allowMultiAdd: true
    });

    const panelCoupon = window.createChoicePanelJSON({
      title: withHeaders ? 'Купоны' : undefined,
      targetClass: '_coupon',
      library: libCoupon0,
      mountEl: grid,
      startOpen,
      allowMultiAdd: true,
      expirableAttr: 'data-expired-date'
    });

    const panelPlashka = window.createChoicePanelJSON({
      title: withHeaders ? 'Плашки' : undefined,
      targetClass: '_plashka',
      library: libPlashka0,
      mountEl: grid,
      startOpen
    });

    const panelIcon = window.createChoicePanelJSON({
      title: withHeaders ? 'Иконки' : undefined,
      targetClass: '_icon',
      library: libIcon0,
      mountEl: grid,
      startOpen
    });

    const panelBack = window.createChoicePanelJSON({
      title: withHeaders ? 'Фон' : undefined,
      targetClass: '_background',
      library: libBack0,
      mountEl: grid,
      startOpen
    });

    // --- Инициализация данными из API
    if (initialData.gift) panelGift.init(initialData.gift);
    if (initialData.coupon) panelCoupon.init(initialData.coupon);
    if (initialData.plashka) panelPlashka.init(initialData.plashka);
    if (initialData.icon) panelIcon.init(initialData.icon);
    if (initialData.background) panelBack.init(initialData.background);

    // --- getData: собирает данные из всех панелей
    function getData() {
      return {
        icon: panelIcon.getData(),
        plashka: panelPlashka.getData(),
        background: panelBack.getData(),
        gift: panelGift.getData(),
        coupon: panelCoupon.getData()
      };
    }

    // --- getLibraryIds: возвращает Set id для каждой категории
    function getLibraryIds() {
      return {
        icon: new Set(libIcon0.map(x => String(x.id))),
        plashka: new Set(libPlashka0.map(x => String(x.id))),
        background: new Set(libBack0.map(x => String(x.id))),
        gift: new Set(libGift0.map(x => String(x.id))),
        coupon: new Set(libCoupon0.map(x => String(x.id)))
      };
    }

    const api = {
      getData,
      getLibraryIds,
      panels: { plashka: panelPlashka, icon: panelIcon, back: panelBack, gift: panelGift, coupon: panelCoupon },
    };
    window.__skinsSetupJSONMounted = api;
    return api;
  }

  window.setupSkinsJSON = setupSkinsJSON;
})();
// profile_runner_json.js — запуск JSON-панелей со страницы профиля (EDIT-режим)
(function () {
  'use strict';

  if (window.__profileRunnerJSONMounted) return;
  window.__profileRunnerJSONMounted = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  function onReady() {
    return new Promise((res) => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') return res();
      document.addEventListener('DOMContentLoaded', () => res(), { once: true });
    });
  }

  async function waitMount() {
    await onReady();
    const box = qs('#viewprofile .container') || qs('#viewprofile') || qs('#pun-main') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'fmv-skins-panel';
    wrap.style.margin = '16px 0';
    wrap.innerHTML = `
       <details open style="border:1px solid #d6d6de;border-radius:10px;background:#fff">
        <summary style="list-style:none;padding:10px 14px;border-bottom:1px solid #e8e8ef;border-radius:10px;font-weight:600;background:#f6f7fb;cursor:pointer">
          Обновление скинов
        </summary>
        <div class="fmv-skins-body" style="padding:14px"></div>
        <div class="fmv-skins-footer" style="display:flex;gap:8px;align-items:center;padding:10px 14px;border-top:1px solid #eee">
          <button type="button" class="fmv-save"
            style="background:#2f67ff;color:#fff;border:1px solid #2f67ff;border-radius:8px;padding:8px 14px;cursor:pointer">
            Сохранить
          </button>
          <span class="fmv-status" style="margin-left:8px;font-size:14px;color:#666"></span>
        </div>
      </details>
    `;
    box.appendChild(wrap);
    return wrap.querySelector('.fmv-skins-body');
  }

  (async () => {
    // 1) URL-гейт: только /profile.php?id=N и никаких других параметров
    if (location.pathname !== '/profile.php') return;
    const sp = new URLSearchParams(location.search);
    if (!sp.has('id') || [...sp.keys()].some(k => k !== 'id')) return;

    const id = (sp.get('id') || '').trim();
    if (!id) return;

    const group_ids = window.SKIN?.GroupID || [];

    if (typeof window.ensureAllowed === 'function') {
      const ok = await window.ensureAllowed(group_ids);
      if (!ok) return; // не в нужной группе — выходим тихо
    } else {
      return; // подстраховка: нет функции — никому не показываем
    }

    const mount = await waitMount();

    // Сначала создаём панели, чтобы получить libraryIds
    let getData = null;
    let getLibraryIds = null;
    if (typeof window.setupSkinsJSON === 'function') {
      try {
        const api = await window.setupSkinsJSON(mount, { initialData: {} });
        if (api && typeof api.getData === 'function') getData = api.getData;
        if (api && typeof api.getLibraryIds === 'function') getLibraryIds = api.getLibraryIds;
      } catch (e) {
        console.error('setupSkinsJSON() error:', e);
      }
    }

    if (!getData || !getLibraryIds) {
      console.error('[profile_runner_json] Не удалось инициализировать панели');
      return;
    }

    // Получаем libraryIds
    const libraryIds = getLibraryIds();

    if (!window.skinAdmin || typeof window.skinAdmin.load !== 'function') {
      console.error('[profile_runner_json] skinAdmin.load не найден.');
      return;
    }

    // Загружаем данные с учетом libraryIds
    const { status, visibleData, save } = await window.skinAdmin.load(id, libraryIds);
    if (status !== 'ok' && status !== 'ок') {
      console.error('[profile_runner_json] Не удалось загрузить данные со скинами');
      return;
    }

    // Инициализируем панели только видимыми данными
    if (window.__skinsSetupJSONMounted && window.__skinsSetupJSONMounted.panels) {
      const panels = window.__skinsSetupJSONMounted.panels;
      if (visibleData.gift && panels.gift) panels.gift.init(visibleData.gift);
      if (visibleData.coupon && panels.coupon) panels.coupon.init(visibleData.coupon);
      if (visibleData.plashka && panels.plashka) panels.plashka.init(visibleData.plashka);
      if (visibleData.icon && panels.icon) panels.icon.init(visibleData.icon);
      if (visibleData.background && panels.back) panels.back.init(visibleData.background);
    }

    const panelRoot = document.getElementById('fmv-skins-panel');
    const btnSave  = panelRoot?.querySelector('.fmv-save');
    const statusEl = panelRoot?.querySelector('.fmv-status');
    if (!btnSave) return;

    btnSave.addEventListener('click', async () => {
      try {
        if (statusEl) {
          statusEl.textContent = 'Сохраняю…';
          statusEl.style.color = '#666';
        }

        const jsonData = getData ? getData() : null;
        if (!jsonData) {
          if (statusEl) {
            statusEl.textContent = 'Нечего сохранять';
            statusEl.style.color = '#c24141';
          }
          return;
        }

        let r = null;
        if (typeof save === 'function') {
          r = await save(jsonData);
        } else {
          if (statusEl) {
            statusEl.textContent = 'Нет функции сохранения';
            statusEl.style.color = '#c24141';
          }
          return;
        }

        const ok = !!(r && (r.ok || r.status === 'saved' || r.status === 'успешно' || r.status === 'ok'));

        if (statusEl) {
          if (ok) {
            statusEl.textContent = '✓ Успешно сохранено';
            statusEl.style.color = '#16a34a';
            setTimeout(() => location.reload(), 1000);
          } else {
            statusEl.textContent = 'Ошибка сохранения';
            statusEl.style.color = '#c24141';
          }
        }
      } catch (e) {
        console.error(e);
        if (statusEl) {
          statusEl.textContent = 'Ошибка сохранения';
          statusEl.style.color = '#c24141';
        }
      }
    });
  })();
})();
/*!
 * money-upd-slim.js — один экспорт: getFieldValue({ doc, fieldId }) -> string
 * - Заменяет <!-- main: usrN --> в li#pa-fldN
 * - Предоставляет window.MainUsrFieldResolver.getFieldValue
 */
(function () {
  "use strict";

  // Проверка наличия MoneyID
  if (!window.PROFILE_FIELDS?.MoneyID) {
    console.error("Ошибка: не найдено значение PROFILE_FIELDS.MoneyID");
    return; // Останавливаем выполнение скрипта
  }

  // ===== Настройки поля =====
  const idNum = String(window.PROFILE_FIELDS?.MoneyID);
  const fieldName = `pa-fld${idNum}`;

  // ===== Утилиты =====
  const esc = CSS.escape || ((s) => String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));
  const RE_MAIN = /^\s*main:\s*usr(\d+)\s*$/i;
  const selectorForField = (fname) => `#${esc(fname)}, .${esc(fname)}`;

  // Декодирование HTML с возможной windows-1251
  const tdUtf8 = new TextDecoder("utf-8");
  let tdWin1251;
  const win1251 = () => (tdWin1251 ||= new TextDecoder("windows-1251"));
  async function fetchHtml(url) {
    const r = await fetch(url, { credentials: "same-origin" });
    const buf = await r.arrayBuffer();
    let html = tdUtf8.decode(buf);
    if (/charset\s*=\s*windows-1251/i.test(html) || html.includes("�")) {
      try { html = win1251().decode(buf); } catch {}
    }
    return html;
  }

  function extractLocalValue(rootDoc, fname) {
    const li = rootDoc.querySelector(selectorForField(fname));
    const strong = li?.querySelector("strong, b");
    let v = strong?.textContent?.trim();
    if (!v) {
      const t = (li?.textContent || "").trim();
      v = t.split(":").slice(-1)[0]?.trim();
    }
    return (v || "").replace(/\u00A0/g, " ").trim();
  }

  // Кеш по uid -> Promise<string>
  const cache = new Map();
  function getRemoteFieldValue(uid, fname) {
    if (cache.has(uid)) return cache.get(uid);
    const p = (async () => {
      const html = await fetchHtml(`/profile.php?id=${encodeURIComponent(uid)}`);
      const doc = new DOMParser().parseFromString(html, "text/html");
      return extractLocalValue(doc, fname);
    })();
    cache.set(uid, p);
    return p;
  }

  function findUsrFromComment(liEl) {
    if (!liEl) return null;
    const walker = liEl.ownerDocument.createTreeWalker(liEl, NodeFilter.SHOW_COMMENT);
    for (let n; (n = walker.nextNode()); ) {
      const m = (n.nodeValue || "").match(RE_MAIN);
      if (m) return m[1];
    }
    return null;
  }

  // ===== Публичное API (единственная функция) =====
  async function getFieldValue({ doc = document, fieldId } = {}) {
    const id = String(fieldId ?? idNum).replace(/\D/g, "") || idNum;
    const fname = `pa-fld${id}`;
    const li = doc.querySelector(selectorForField(fname));

    // если есть <!-- main: usrN -->, берём значение у usrN
    const refUid = findUsrFromComment(li);
    if (refUid) {
      try { return await getRemoteFieldValue(refUid, fname); }
      catch (e) { console.warn("[main-field] remote error:", e); }
    }
    // иначе — локальное значение
    return extractLocalValue(doc, fname);
  }

  // Экспорт в window (без перетирания)
  window.MainUsrFieldResolver = window.MainUsrFieldResolver || {};
  if (!window.MainUsrFieldResolver.getFieldValue) {
    window.MainUsrFieldResolver.getFieldValue = getFieldValue;
  }

  // ===== Поведение «как раньше»: заменить комментарии на текст в DOM =====
  function replaceCommentsUnder(root, fname) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const items = [];
    for (let n; (n = walker.nextNode()); ) {
      const m = (n.nodeValue || "").match(RE_MAIN);
      if (m) items.push({ node: n, uid: m[1] });
    }
    items.forEach(({ node, uid }) => {
      getRemoteFieldValue(uid, fname)
        .then((val) => { if (node?.isConnected) node.replaceWith(document.createTextNode(val)); })
        .catch((e) => console.error("[main-field] replace error usr" + uid, e));
    });
  }

  function run() {
    document.querySelectorAll(selectorForField(fieldName)).forEach((el) => replaceCommentsUnder(el, fieldName));
  }

  (document.readyState === "loading")
    ? document.addEventListener("DOMContentLoaded", run, { once: true })
    : run();
})();
/* ================== КОНСТАНТЫ UI ================== */
const IP_ROWS = 1;        // сколько строк карточек видно без скролла
const IP_GAP  = 8;        // расстояние между карточками, px
const IP_REQUIRED = true; // если есть варианты — пустым не оставляем

/* ================== УТИЛИТЫ ================== */
function isProfileFieldsPage() {
  try {
    const u = new URL(location.href);
    if (!/\/profile\.php$/i.test(u.pathname)) return false;
    const s = u.searchParams;
    if (s.get('section') !== 'fields') return false;
    const id = s.get('id');
    return !!id && /^\d+$/.test(id);
  } catch { return false; }
}

const STYLE_ID = 'ip-style-clean';
function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
    /* скрываем исходный textarea/input */
    .ip-hidden {
      display: none !important;
      resize: none !important;
      visibility: hidden !important;
    }

    /* Белый контейнер подстраивается под ширину контента */
    .ip-box {
      position: relative;
      display: inline-block;          /* ширина = контенту */
      max-width: 100%;
      border: 1px solid #ccc;
      border-radius: 10px;
      background: #fff;
      padding: 6px;
    }

    /* Вертикальный скролл */
    .ip-scroll {
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      max-height: calc(var(--ip-rows,1) * var(--ip-h,44px)
                      + (var(--ip-rows,1) - 1) * var(--ip-gap,8px));
    }

    /* Сетка: перенос вниз, ширина по контенту */
    .ip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ip-gap,8px);
      align-content: flex-start;
      justify-content: flex-start;
    }

    .ip-btn {
      position: relative;
      overflow: hidden;
      width: var(--ip-w,44px);
      height: var(--ip-h,44px);
      border: 2px solid #d0d0d0;
      border-radius: 10px;
      background: #fff;
      padding: 0;
      cursor: pointer;
      touch-action: manipulation;
    }
    .ip-btn[selected] {
      border-color: #0b74ff;
      box-shadow: 0 0 0 3px rgba(11,116,255,.15);
    }

    .ip-slot {
      position: relative;
      width: 100%;
      height: 100%;
    }
    .ip-slot img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
    .ip-slot * {
      pointer-events: none;
    }
  `;
  document.head.appendChild(st);
}

// поиск поля по суффиксу: работает и для input, и для textarea
function resolveFieldBySuffix(suffix) {
  const id = `fld${String(suffix)}`;
  const name = `form[fld${String(suffix)}]`;
  return (
    document.querySelector(`#${CSS.escape(id)}[name="${name}"]`) ||
    document.getElementById(id) ||
    document.querySelector(`[name="${name}"]`)
  );
}

// нормализация на ЗАГРУЗКЕ: у <a.modal-link> сохраняем только class и style
function normalizeModalLinkAttrs(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  t.content.querySelectorAll('a.modal-link').forEach(a => {
    Array.from(a.attributes).forEach(attr => {
      if (attr.name !== 'class' && attr.name !== 'style') a.removeAttribute(attr.name);
    });
  });
  return t.innerHTML.trim();
}

// ПЕРЕД СОХРАНЕНИЕМ: каждой <a.modal-link> добавить data-reveal-id и id="usrN"
function prepareModalLinkAttrs(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  const anchors = t.content.querySelectorAll('a.modal-link');
  if (anchors.length) {
    const u = new URL(location.href);
    const n = u.searchParams.get('id');
    const usrId = (n && /^\d+$/.test(n)) ? `usr${n}` : null;
    anchors.forEach(a => {
      a.setAttribute('data-reveal-id', 'character');
      if (usrId) a.setAttribute('id', usrId);
    });
  }
  return t.innerHTML.trim();
}

// превью карточки: если строка даёт DOM — вставляем, иначе <img>
function createThumbSlot(htmlOrUrl) {
  const slot = document.createElement('div');
  slot.className = 'ip-slot';
  const raw = String(htmlOrUrl ?? '').trim();
  if (!raw) return slot;
  const t = document.createElement('template'); t.innerHTML = raw;
  if (t.content.querySelector('*')) {
    slot.appendChild(t.content.cloneNode(true));
  } else {
    const img = document.createElement('img');
    img.src = raw; img.alt = ''; img.loading = 'lazy';
    slot.appendChild(img);
  }
  return slot;
}

function keyFor(str) { const s=String(str??''); let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i); return 'k'+(h>>>0).toString(36); }

// реестр полей на форме: form -> { entries: [{input, fieldSuffix, prepareOne}], hooked }
const FORM_STATE = new WeakMap();

/* ================== ОСНОВНАЯ ФУНКЦИЯ ==================
   image_set: массив СТРОК (HTML или URL)
   fieldSuffix (number): 5 → 'fld5' / 'form[fld5]' 
   opts: { btnWidth?: number, btnHeight?: number, gridColSize?: number, modalLinkMode?: boolean }
*/
function applyImagePicker(image_set, fieldSuffix, opts = {}) {
  if (!isProfileFieldsPage()) return;
  injectStylesOnce();

  const modalLinkMode = !!opts.modalLinkMode;
  const RAW = Array.isArray(image_set) ? image_set : [];
  const ITEMS = RAW.map(s => String(s ?? ''));

  const input = resolveFieldBySuffix(fieldSuffix);
  if (!input) return;

  // скрываем исходный контрол
  input.classList.add('ip-hidden');

  // размеры карточек / сетки
  const w   = Number.isFinite(opts.btnWidth)   ? Math.max(1, opts.btnWidth)   : 44;
  const h   = Number.isFinite(opts.btnHeight)  ? Math.max(1, opts.btnHeight)  : 44;
  const col = Number.isFinite(opts.gridColSize)? Math.max(1, opts.gridColSize): w;

  // нормализованные строки (как храним внутри textarea/input)
  const NORMS = ITEMS.map(v => modalLinkMode ? normalizeModalLinkAttrs(v) : v);
  const allowed = new Set(NORMS);
  const keyByNorm = new Map(NORMS.map(n => [n, keyFor(n)]));

  // берём текущее значение поля (textarea.value уже отдаёт текст)
  const currentNorm = modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '');

  // строим UI, если есть варианты
  let grid = null;
  if (ITEMS.length > 0) {
    const box = document.createElement('div');
    box.className = 'ip-box';
    box.style.setProperty('--ip-rows', String(IP_ROWS));
    box.style.setProperty('--ip-gap',  `${IP_GAP}px`);
    box.style.setProperty('--ip-w',    `${w}px`);
    box.style.setProperty('--ip-h',    `${h}px`);
    box.style.setProperty('--ip-col',  `${col}px`);

    const scroll = document.createElement('div'); scroll.className = 'ip-scroll';
    const g = document.createElement('div'); g.className = 'ip-grid';

    const byFor = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
    const anchor = input.closest('label') || byFor || input;
    anchor.insertAdjacentElement('afterend', box);

    // клики по сетке не должны триггерить внешние хэндлеры
    scroll.addEventListener('pointerdown', e => e.stopPropagation());
    scroll.addEventListener('click', e => e.stopPropagation());

    NORMS.forEach((norm, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ip-btn';
      btn.dataset.key = keyByNorm.get(norm);

      // превью показываем: при modalLinkMode — нормализованную версию, иначе исходную
      const display = modalLinkMode ? norm : ITEMS[idx];
      btn.appendChild(createThumbSlot(display));

      const pick = (e) => { e.preventDefault(); e.stopPropagation(); setValue(norm); };
      btn.addEventListener('pointerdown', pick);
      btn.addEventListener('click', pick);

      g.appendChild(btn);
    });

    scroll.appendChild(g);
    box.appendChild(scroll);
    grid = g;
  }

  // подсветка выбранной
  function highlight(normStr) {
    if (!grid) return;
    const key = keyByNorm.get(String(normStr)) || '';
    grid.querySelectorAll('.ip-btn').forEach(b => b.removeAttribute('selected'));
    if (key) {
      const btn = grid.querySelector(`.ip-btn[data-key="${key}"]`);
      if (btn) btn.setAttribute('selected', '');
    }
  }

  // установка значения в скрытый контрол
  let internal = false;
  function setValue(normVal) {
    const v = String(normVal ?? '');
    if (input.value !== v) {
      internal = true;
      input.value = v;
      input.dispatchEvent(new Event('input',  { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      internal = false;
    }
    highlight(v);
  }

  // начальное значение
  const firstNorm   = NORMS[0] || '';
  const initialNorm = ITEMS.length
    ? (allowed.has(currentNorm) ? currentNorm : (IP_REQUIRED ? firstNorm : ''))
    : '';
  input.dataset.ipInitial = initialNorm;
  setValue(initialNorm);

  // синхронизация внешних правок
  input.addEventListener('input',  () => { if (!internal) highlight(modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '')); });
  input.addEventListener('change', () => { if (!internal) highlight(modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '')); });

  /* ===== РЕЕСТР ФОРМЫ: готовим ВСЕ поля перед отправкой ===== */
  const form = input.closest('form');
  if (!form) return { set: setValue };

  let state = FORM_STATE.get(form);
  if (!state) {
    state = { entries: [], hooked: false };
    FORM_STATE.set(form, state);
  }

  // подготовка одного поля
  const prepareOne = () => {
    let curNorm = modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '');

    if (!ITEMS.length) {
      const preparedEmpty = modalLinkMode ? prepareModalLinkAttrs('') : '';
      input.value = preparedEmpty;
      return preparedEmpty;
    }

    if (!allowed.has(curNorm)) {
      const fallback = input.dataset.ipInitial ?? (IP_REQUIRED ? firstNorm : '');
      curNorm = String(fallback);
      setValue(curNorm);
    }

    const finalVal = modalLinkMode ? prepareModalLinkAttrs(curNorm) : curNorm;
    input.value = finalVal;
    return finalVal;
  };

  state.entries.push({ input, fieldSuffix, prepareOne });

  if (!state.hooked) {
    state.hooked = true;
    const nativeSubmit = form.submit;

    const prepareAll = () => {
      state.entries.forEach(({ prepareOne }) => { prepareOne(); });
    };

    // обычный submit
    form.addEventListener('submit', (e) => {
      if (form.dataset.ipResuming === '1') return;
      prepareAll();
    }, true);

    // new FormData(form)
    form.addEventListener('formdata', (e) => {
      prepareAll();
      // гарантируем, что в FormData уйдут обновлённые значения
      state.entries.forEach(({ input, fieldSuffix }) => {
        try {
          const name = input.name || `form[fld${fieldSuffix}]`;
          e.formData.set(name, input.value);
        } catch(_) {}
      });
    });

    // программный form.submit()
    form.submit = function(...args){
      if (form.dataset.ipResuming === '1') return nativeSubmit.apply(this, args);
      prepareAll();
      return nativeSubmit.apply(this, args);
    };
  }

  return { set: setValue };
}
// const icon_set = [
//  `<img class="icon" src="https://static.thenounproject.com/png/2185221-200.png">`,
//  `<img class="icon" src="https://cdn2.iconfinder.com/data/icons/harry-potter-colour-collection/60/07_-_Harry_Potter_-_Colour_-_Golden_Snitch-512.png">`,
//  `<img class="icon" src="https://i.pinimg.com/474x/c2/72/cb/c272cbe4f31c5a8d96f8b95256924e95.jpg">`,
// ];

// const plashka_set = [
//   `<a class="modal-link">
//    <img src="https://upforme.ru/uploads/001c/14/5b/440/247944.gif" class="plashka">
//    <wrds>я не подарок, но и ты не шаверма</wrds></a>`,
//   `<a class="modal-link">
//    <img src="https://upforme.ru/uploads/001c/14/5b/440/561829.gif" class="plashka">
//    <wrds>twinkle twinkle little star</wrds></a>`
// ];

// const back_set = [
//  `<img class="back" src="https://upforme.ru/uploads/001c/14/5b/440/238270.gif">`,
//  `<img class="back" src="https://forumstatic.ru/files/001c/83/91/88621.png">`,
// ];

(async () => {
  // Флаг отладки - установите в true для вывода логов
  const DEBUG = false;

  // Функция логирования с проверкой DEBUG
  const log = (...args) => {
    if (DEBUG) console.log('[skin_data]', ...args);
  };

  log('Начало загрузки данных скинов');
  log('window.SKIN:', window.SKIN);

  const result = await collectSkinSets();
  log('collectSkinSets вернул:', result);

  const icons = result?.icons || [];
  const plashki = result?.plashki || [];
  const backs = result?.backs || [];

  log('icons:', icons.length, 'plashki:', plashki.length, 'backs:', backs.length);

  // Плашка
  if (window.SKIN?.PlashkaFieldID) {
    log('Применяем плашку, fieldID:', window.SKIN.PlashkaFieldID);
    applyImagePicker(plashki, SKIN.PlashkaFieldID, {
      btnWidth: 229,
      btnHeight: 42,
      modalLinkMode: true,
    });
  } else {
    log('PlashkaFieldID не найден');
  }

  // Фон
  if (window.SKIN?.BackFieldID) {
    log('Применяем фон, fieldID:', window.SKIN.BackFieldID);
    applyImagePicker(backs, SKIN.BackFieldID, {
      btnWidth: 229,
      btnHeight: 42,
      modalLinkMode: true,
    });
  } else {
    log('BackFieldID не найден');
  }

  // Иконка
  if (window.SKIN?.IconFieldID) {
    log('Применяем иконку, fieldID:', window.SKIN.IconFieldID);
    applyImagePicker(icons, SKIN.IconFieldID, {
      btnWidth: 44,
    });
  } else {
    log('IconFieldID не найден');
  }

  log('Завершено');
})();
/**
 * @typedef {Object} ReplaceFieldResult
 * @property {'updated'|'error'|'uncertain'} status
 * @property {string} fieldId
 * @property {string} value
 * @property {string=} serverMessage
 * @property {number=} httpStatus
 * @property {string=} details
 */

/**
 * Обновляет пользовательское поле профиля «как из формы», даже если вы не на странице редактирования.
 * Требует: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit.
 *
 * @param {string|number} user_id
 * @param {string|number} field_id           // без # — только номер (например "3")
 * @param {string} new_value
 * @param {boolean} [overwriteIfExists=false] // если true — перезаписывать даже если там уже «что-то» есть
 * @returns {Promise<ReplaceFieldResult>}
 */
async function FMVreplaceFieldData(user_id, field_id, new_value, overwriteIfExists = false) {
  const editUrl = `/profile.php?section=fields&id=${encodeURIComponent(user_id)}&nohead`;
  const FIELD_SELECTOR = '#fld' + field_id;

  // helper: "есть ли что-то" — всё, кроме "", " ", "0"
  const hasSomething = (v) => v !== '' && v !== ' ';

  try {
    // A) загрузка формы редактирования
    const doc = await fetchCP1251Doc(editUrl);

    // форма редактирования (часто id="profile8"; подстрахуемся по action)
    const form =
      doc.querySelector('form#profile8') ||
      [...doc.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));

    if (!form) {
      return {
        status: 'error',
        fieldId: String(field_id),
        value: new_value,
        serverMessage: 'Форма редактирования профиля не найдена',
        details: 'profile.php без формы'
      };
    }

    // B0) найдём поле и прочитаем текущее значение ДО изменения
    const fld = form.querySelector(FIELD_SELECTOR);
    if (!fld) {
      return {
        status: 'error',
        fieldId: String(field_id),
        value: new_value,
        serverMessage: `Поле ${FIELD_SELECTOR} не найдено. Проверьте номер fld.`
      };
    }

    const prevValue = fld.value ?? '';

    // B1) если уже есть «что-то» и перезаписывать нельзя — выходим с ошибкой и сообщением
    if (hasSomething(prevValue) && !overwriteIfExists) {
      return {
        status: 'nochange',
        fieldId: String(field_id),
        value: new_value,
        serverMessage: 'Поле уже содержит значение. Перезапись запрещена.',
        details: `Прежнее значение: ${String(prevValue)}`
      };
    }

    // B2) заполнение нового значения
    fld.value = new_value;

    // ensure name="update" (некоторые шаблоны требуют наличия этого поля)
    if (![...form.elements].some(el => el.name === 'update')) {
      const hidden = doc.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'update';
      hidden.value = '1';
      form.appendChild(hidden);
    }

    // C) выбрать реальное имя submit-кнопки (как в create)
    let submitName = 'update';
    const submitEl = [...form.elements].find(el =>
      el.type === 'submit' && (el.name || /сохран|обнов/i.test(el.value || ''))
    );
    if (submitEl?.name) submitName = submitEl.name;

    // сериализация формы с учётом выбранного submit
    const body = serializeFormCP1251_SelectSubmit(form, submitName);

    // D) POST «как будто со страницы редактирования» — важен referrer
    const postUrl = form.getAttribute('action') || '/profile.php';
    const { res } = await fetchCP1251Text(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      referrer: editUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    });

    if (!res.ok) {
      return {
        status: 'error',
        fieldId: String(field_id),
        value: new_value,
        httpStatus: res.status,
        serverMessage: `HTTP ${res.status} при сохранении`
      };
    }

    // E) контрольное чтение — подтверждаем, что значение действительно сохранилось
    const doc2 = await fetchCP1251Doc(editUrl);
    const form2 =
      doc2.querySelector('form#profile8') ||
      [...doc2.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));
    const v2 = form2?.querySelector(FIELD_SELECTOR)?.value ?? null;

    if (v2 === new_value) {
      return {
        status: 'updated',
        fieldId: String(field_id),
        value: new_value,
        httpStatus: res.status,
        serverMessage: 'Значение успешно обновлено'
      };
    }

    // сервер ответил 200, но подтвердить новое значение не удалось
    return {
      status: 'uncertain',
      fieldId: String(field_id),
      value: new_value,
      httpStatus: res.status,
      serverMessage: 'Не удалось подтвердить новое значение, проверьте вручную'
    };

  } catch (e) {
    // транспорт/исключения — наружу в виде throw (как в create)
    const err = (e && e.message) ? e.message : String(e);
    const wrapped = new Error('Transport/Runtime error: ' + err);
    wrapped.cause = e;
    throw wrapped;
  }
}

// (по желанию) экспорт в глобал, если требуется из других скриптов
// window.FMVreplaceFieldData = FMVreplaceFieldData;
/**
 * @typedef {Object} UpdateGroupResult
 * @property {'updated'|'skipped'|'nochange'|'uncertain'|'error'} status
 * @property {string} userId
 * @property {string} fromGroupId
 * @property {string} toGroupId
 * @property {number=} httpStatus
 * @property {string=} serverMessage
 * @property {string=} details
 */

/**
 * Смена группы пользователя «как из формы администрирования», но только если текущее значение
 * равно указанному fromGroupId. Иначе — пропуск без изменений.
 *
 * Требует: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit.
 *
 * @param {string|number} user_id
 * @param {string|number} fromGroupId  // менять только из этой группы…
 * @param {string|number} toGroupId    // …вот на эту
 * @param {{ overwriteSame?: boolean }} [opts]
 * @returns {Promise<UpdateGroupResult>}
 */
async function FMVupdateGroupIfEquals(user_id, fromGroupId, toGroupId, opts = {}) {
  const overwriteSame = !!opts.overwriteSame;
  const uid = String(user_id);
  const editUrl = `/profile.php?section=admin&id=${encodeURIComponent(uid)}&nohead`;

  try {
    // A) Загрузка страницы администрирования (режим без шапки — быстрее парсится)
    const doc = await fetchCP1251Doc(editUrl);

    // На некоторых стилях id формы различается — ищем по action
    const form =
      doc.querySelector('form#profile8') ||
      [...doc.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));
    if (!form) {
      return {
        status: 'error',
        userId: uid, fromGroupId: String(fromGroupId), toGroupId: String(toGroupId),
        serverMessage: 'Форма администрирования профиля не найдена',
        details: 'profile.php?section=admin без ожидаемой формы'
      };
    }

    // B) Определяем select группы
    const sel =
      form.querySelector('select[name="group_id"]') ||
      form.querySelector('#group_id');
    if (!sel) {
      return {
        status: 'error',
        userId: uid, fromGroupId: String(fromGroupId), toGroupId: String(toGroupId),
        serverMessage: 'Селектор group_id не найден',
      };
    }

    // C) Читаем актуальное значение
    const current = (sel.value ?? '').trim();
    const fromStr = String(fromGroupId).trim();
    const toStr   = String(toGroupId).trim();

    // Если уже в целевой группе
    if (current === toStr && !overwriteSame) {
      return {
        status: 'nochange',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        serverMessage: 'Пользователь уже в целевой группе; перезапись отключена',
        details: `current=${current}`
      };
    }

    // Если текущее значение НЕ совпадает с «разрешённым исходным» — пропускаем
    if (current !== fromStr && !(current === toStr && overwriteSame)) {
      return {
        status: 'skipped',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        serverMessage: 'Текущая группа не совпадает с fromGroupId — изменения не требуются',
        details: `current=${current}`
      };
    }

    // D) Готовим форму к отправке «как из UI»
    sel.value = toStr;

    // Убедимся, что присутствует скрытое поле form_sent=1
    if (![...form.elements].some(el => el.name === 'form_sent')) {
      const hidden = doc.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'form_sent';
      hidden.value = '1';
      form.appendChild(hidden);
    }

    // Определяем имя submit-кнопки (на rusff обычно update_group_membership)
    let submitName = 'update_group_membership';
    const submitEl = [...form.elements].find(el =>
      el.type === 'submit' && (el.name || /сохран|обнов/i.test(el.value || ''))
    );
    if (submitEl?.name) submitName = submitEl.name;

    // E) Сериализуем так же, как «нажатие нужной кнопки» (CP1251)
    const body = serializeFormCP1251_SelectSubmit(form, submitName);

    // F) POST на action формы с корректным referrer
    const postUrl = form.getAttribute('action') || `/profile.php?section=admin&id=${encodeURIComponent(uid)}`;
    const { res, text } = await fetchCP1251Text(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      referrer: editUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    });

    if (!res.ok) {
      return {
        status: 'error',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        httpStatus: res.status,
        serverMessage: `HTTP ${res.status} при сохранении`
      };
    }

    // G) Контрольное чтение — убедимся, что селект действительно стал toStr
    const doc2 = await fetchCP1251Doc(editUrl);
    const form2 =
      doc2.querySelector('form#profile8') ||
      [...doc2.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));
    const sel2 = form2?.querySelector('select[name="group_id"]') || form2?.querySelector('#group_id');
    const v2 = (sel2?.value ?? '').trim();

    if (v2 === toStr) {
      return {
        status: 'updated',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        httpStatus: res.status,
        serverMessage: 'Группа успешно обновлена'
      };
    }

    return {
      status: 'uncertain',
      userId: uid, fromGroupId: fromStr, toGroupId: toStr,
      httpStatus: res.status,
      serverMessage: 'Сервер ответил 200, но подтвердить новое значение не удалось — проверьте вручную',
      details: `readback=${v2}`
    };

  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return {
      status: 'error',
      userId: String(user_id),
      fromGroupId: String(fromGroupId),
      toGroupId: String(toGroupId),
      serverMessage: 'Transport/Runtime error',
      details: msg
    };
  }
}

/* Пример использования:
   // Если пользователь (id=4) сейчас в группе 1 — перевести в 3
   FMVupdateGroupIfEquals(4, 1, 3).then(console.log).catch(console.error);

   // То же, но если он уже в 3 — повторно «сохранить» (редко нужно)
   FMVupdateGroupIfEquals(4, 1, 3, { overwriteSame: true }).then(console.log);
*/

/* Comments & Chrono */
// ==UserScript==
// @name         Profile → last post in topic by title (search with pagination)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  const PROFILE_PATH_RE = /\/profile\.php$/i;
  const PROFILE_ID_RE = /[?&]id=\d+/;
  const PROFILE_RIGHT_SEL = '#viewprofile #profile-right';

  if (!PROFILE_PATH_RE.test(location.pathname)) return;
  if (!PROFILE_ID_RE.test(location.search)) return;

  const style = document.createElement('style');
  style.textContent = `
    #pa-bank-link a.is-empty {
      color: #999 !important;
      text-decoration: none !important;
      pointer-events: none;
      cursor: default;
      opacity: .8;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  async function ensureScrapePosts(timeoutMs = 8000, intervalMs = 250) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      if (typeof window.scrapePosts === 'function') return true;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
  }

  function insertSlot() {
    const right = document.querySelector(PROFILE_RIGHT_SEL);
    if (!right) return null;

    const li = document.createElement('li');
    li.id = 'pa-bank-link';
    li.innerHTML = `
      <span>Банковская операция:</span>
      <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a></strong>
    `;

    const after = right.querySelector('#pa-last-visit');
    if (after && after.parentElement === right) {
      after.insertAdjacentElement('afterend', li);
    } else {
      right.appendChild(li);
    }

    return li.querySelector('a');
  }

  function setEmpty(anchor, reason) {
    const text = 'Не найдена';
    anchor.classList.add('is-empty');
    anchor.href = '#';
    anchor.title = reason || text;
    anchor.textContent = text;
  }

  function setLink(anchor, href) {
    anchor.classList.remove('is-empty');
    anchor.href = href;
    anchor.textContent = 'Последняя';
  }

  ready(async () => {
    const anchor = insertSlot();
    if (!anchor) return;

    const hasScrape = await ensureScrapePosts();
    if (!hasScrape) {
      setEmpty(anchor, 'нет доступа к поиску');
      return;
    }

    if (!window.UserLogin) {
      setEmpty(anchor, 'нет данных пользователя');
      return;
    }

    const forums = window.FORUMS_IDS?.Bank || [0];

    try {
      const posts = await window.scrapePosts(window.UserLogin, forums, {
        title_prefix: 'Гринготтс',
        stopOnNthPost: 1,
        keywords: 'ИТОГО'
      });

      if (Array.isArray(posts) && posts.length && posts[0]?.src) {
        const siteBase = (typeof window.SITE_URL === 'string' && window.SITE_URL.trim())
          ? window.SITE_URL.trim().replace(/\/$/, '')
          : location.origin.replace(/\/$/, '');
        const href = `${siteBase}/viewtopic.php?${posts[0].src}`;
        setLink(anchor, href, posts[0].date_text || posts[0].text || 'Последняя операция');
      } else {
        setEmpty(anchor);
      }
    } catch (error) {
      console.error('[bank_last_comment] scrapePosts failed', error);
      setEmpty(anchor, 'ошибка поиска');
    }
  });
})();
/**
 * Загружает карточки из текущего домена.
 * @param {number} topic_id  id темы (viewtopic.php?id=<topic_id>)
 * @param {Array<number>} comment_ids  id поста (#p<comment_id>-content)
 * @param {Object} options - дополнительные опции
 * @param {boolean} options.isCoupon - true если обрабатываем купоны (добавляет data-coupon-* атрибуты)
 * @returns {Promise<Array<{id:string, html:string}>>}
 */
async function fetchCardsWrappedClean(topic_id, comment_ids, options = {}) {
  const { isCoupon = false } = options;
  const topicUrl = `${location.origin.replace(/\/$/, '')}/viewtopic.php?id=${encodeURIComponent(String(topic_id))}`;

  const decodeEntities = s => {
    const d = document.createElement('div');
    d.innerHTML = String(s ?? '');
    return d.textContent || d.innerText || '';
  };
  const toDoc = html => new DOMParser().parseFromString(html, 'text/html');

  async function smartFetchHtml(url) {
    // Используем window.fetchHtml если доступна (уже с retry)
    if (typeof window.fetchHtml === 'function') return window.fetchHtml(url);

    // Fallback: используем fetchWithRetry если доступна, иначе обычный fetch
    const fetchFunc = typeof window.fetchWithRetry === 'function'
      ? window.fetchWithRetry
      : fetch;

    const res = await fetchFunc(url, { credentials: 'include' });
    const buf = await res.arrayBuffer();
    const declared = /charset=([^;]+)/i.exec(res.headers.get('content-type') || '')?.[1]?.toLowerCase();
    const tryDec = enc => { try { return new TextDecoder(enc).decode(buf); } catch { return null; } };
    if (declared) { const s = tryDec(declared); if (s) return s; }
    const utf = tryDec('utf-8') ?? '';
    const cp = tryDec('windows-1251') ?? '';
    const bad = s => (s.match(/\uFFFD/g) || []).length;
    if (bad(cp) && !bad(utf)) return utf;
    if (bad(utf) && !bad(cp)) return cp;
    const cyr = s => (s.match(/[\u0400-\u04FF]/g) || []).length;
    return cyr(cp) > cyr(utf) ? cp : utf;
  }

  const pageHtml = await smartFetchHtml(topicUrl);
  const doc = toDoc(pageHtml);

  const allResults = [];

  for (const comment_id of comment_ids) {
    const post = doc.querySelector(`#p${String(comment_id)}-content`);
    if (!post) {
      console.warn(`Не найден #p${comment_id}-content на ${topicUrl}`);
      continue;
    }

    const scripts = [...post.querySelectorAll('script[type="text/html"]')];
    if (!scripts.length) continue;

    const combined = scripts.map(s => s.textContent || s.innerHTML || '').join('\n');
    const decoded = decodeEntities(combined).replace(/\u00A0/g, ' ');
    const innerDoc = toDoc(decoded);

    const result = [...innerDoc.querySelectorAll('#grid article.card')].map(card => {
      const id = FMV.normSpace(card.querySelector('.id')?.textContent || '');
      const rawTitle = FMV.normSpace(card.querySelector('.desc')?.textContent || '');
      const content = (card.querySelector('.content')?.innerHTML || '').replace(/\u00A0/g, ' ').trim();

      // Формируем базовые атрибуты
      const titleAttr = rawTitle ? ` title="${rawTitle}"` : '';

      // Для купонов извлекаем дополнительные поля
      let couponAttrs = '';
      if (isCoupon) {
        const couponTitle = FMV.normSpace(card.querySelector('.title')?.textContent || '');
        const couponType = FMV.normSpace(card.querySelector('.type')?.textContent || '');
        const couponForm = FMV.normSpace(card.querySelector('.form')?.textContent || '');
        const couponValue = FMV.normSpace(card.querySelector('.value')?.textContent || '');

        const couponTitleAttr = couponTitle ? ` data-coupon-title="${couponTitle}"` : '';
        const couponTypeAttr = couponType ? ` data-coupon-type="${couponType}"` : '';
        const couponFormAttr = couponForm ? ` data-coupon-form="${couponForm}"` : '';
        const couponValueAttr = couponValue ? ` data-coupon-value="${couponValue}"` : '';

        couponAttrs = `${couponTitleAttr}${couponTypeAttr}${couponFormAttr}${couponValueAttr}`;
      }

      const html = `<div class="item" data-id="${id}"${titleAttr}${couponAttrs}>${content}</div>`;
      return { id, html };
    });

    allResults.push(...result); // 🔸 добавляем карточки в общий массив
  }

  return allResults;
}
// ==UserScript==
// @name         Profile → Последний пост (bank/post_last_comment, без jQuery)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  const PROFILE_PATH_RE = /\/profile\.php$/i;
  const PROFILE_ID_RE = /[?&]id=\d+/;
  const PROFILE_RIGHT_SEL = '#viewprofile #profile-right';

  if (!PROFILE_PATH_RE.test(location.pathname)) return;
  if (!PROFILE_ID_RE.test(location.search)) return;

  const style = document.createElement('style');
  style.textContent = `
    #pa-lastpost-link a.is-empty {
      color: #999 !important;
      text-decoration: none !important;
      pointer-events: none;
      cursor: default;
      opacity: .8;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  async function ensureScrapePosts(timeoutMs = 8000, intervalMs = 250) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      if (typeof window.scrapePosts === 'function') return true;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
  }

  function insertSlot() {
    const right = document.querySelector(PROFILE_RIGHT_SEL);
    if (!right) return null;

    const li = document.createElement('li');
    li.id = 'pa-lastpost-link';
    li.innerHTML = `
      <span>Последний пост:</span>
      <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a></strong>
    `;

    const after = right.querySelector('#pa-last-visit');
    if (after && after.parentElement === right) {
      after.insertAdjacentElement('afterend', li);
    } else {
      right.appendChild(li);
    }

    return li.querySelector('a');
  }

  function setEmpty(anchor, reason) {
    const text = 'Не найдена';
    anchor.classList.add('is-empty');
    anchor.href = '#';
    anchor.title = reason || text;
    anchor.textContent = text;
  }

  function setLink(anchor, href, date_text) {
    anchor.classList.remove('is-empty');
    anchor.href = href;
    anchor.textContent = date_text || 'Последняя';
  }

  ready(async () => {
    const anchor = insertSlot();
    if (!anchor) return;

    const hasScrape = await ensureScrapePosts();
    if (!hasScrape) {
      setEmpty(anchor, 'нет доступа к поиску');
      return;
    }

    if (!window.UserLogin) {
      setEmpty(anchor, 'нет данных пользователя');
      return;
    }

    const forums = [
      ...(window.FORUMS_IDS?.PersonalPosts || [10000]),
      ...(window.FORUMS_IDS?.PlotPosts || [10000])
    ];

    try {
      const posts = await window.scrapePosts(window.UserLogin, forums, {
        stopOnNthPost: 1,
        comments_only: true
      });

      if (Array.isArray(posts) && posts.length && posts[0]?.src) {
        const base = (typeof window.SITE_URL === 'string' && window.SITE_URL.trim())
          ? window.SITE_URL.trim().replace(/\/$/, '')
          : location.origin.replace(/\/$/, '');
        const href = `${base}/viewtopic.php?${posts[0].src}`;
        setLink(anchor, href, posts[0].date_text || 'Последний пост');
      } else {
        setEmpty(anchor);
      }
    } catch (error) {
      console.error('[post_last_comment] scrapePosts failed', error);
      setEmpty(anchor, 'ошибка поиска');
    }
  });
})();
// fmv.replace_comment.js
(() => {
  'use strict';

  // страховки, если common.js чего-то не дал
  if (typeof window.extractErrorMessage !== 'function') window.extractErrorMessage = () => '';
  if (typeof window.extractInfoMessage  !== 'function') window.extractInfoMessage  = () => '';
  if (typeof window.classifyResult      !== 'function') window.classifyResult      = () => 'unknown';

  /**
   * Заменить текст комментария поста через /edit.php?id=PID&action=edit
   * Требует helpers/common: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit
   */
  async function replaceComment(allowedGroups, postId, newText) {
    // 0) доступ по группе
    const gid = (typeof window.getCurrentGroupId === 'function') ? window.getCurrentGroupId() : null;
    const allow = new Set((allowedGroups || []).map(x => String(Number(x))));
    if (!gid || !allow.has(String(Number(gid)))) {
      return { ok:false, status:'forbidden', postId:String(postId), newText, errorMessage:'Нет доступа по группе' };
    }

    // 1) валидный PID
    const pidNum = parseInt(postId, 10);
    if (!Number.isFinite(pidNum)) {
      return { ok:false, status:'badid', postId:String(postId), newText, errorMessage:`Некорректный postId: ${postId}` };
    }
    const PID = String(pidNum);
    const editUrl = `/edit.php?id=${encodeURIComponent(PID)}&action=edit`;

    try {
      // 2) GET формы редактирования
      let doc, form, msgField, pageHtml = '';
      try {
        doc = await fetchCP1251Doc(editUrl);
        pageHtml = doc.documentElement ? doc.documentElement.outerHTML : '';
        msgField = doc.querySelector('textarea#main-reply[name="req_message"], textarea[name="req_message"]');
        if (msgField) form = msgField.closest('form');
      } catch (e) {
        return { ok:false, status:'transport', postId:PID, newText, errorMessage:(e?.message || String(e)) };
      }
      if (!form || !msgField) {
        const infoMessage  = extractInfoMessage(pageHtml)  || '';
        const errorMessage = extractErrorMessage(pageHtml) || '';
        const status       = classifyResult(pageHtml) || 'noform';
        return { ok:false, status, postId:PID, newText, infoMessage, errorMessage };
      }

      // 3) подмена текста
      const oldText = String(msgField.value || '').trim();
      msgField.value = newText;

      // 4) сериализация + POST
      const submitName =
        [...form.elements].find(el => el.type === 'submit' && (el.name || /Отправ|Сохран|Submit|Save/i.test(el.value || '')))?.name
        || 'submit';

      const body = serializeFormCP1251_SelectSubmit(form, submitName);

      const { res, text } = await fetchCP1251Text(editUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        referrer: editUrl,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });

      // 5) разбираем ответ аккуратно (без простыней)
      const infoMessage  = extractInfoMessage(text) || '';
      const errorMessage = extractErrorMessage(text) || '';
      const raw          = classifyResult(text);

      // ► нормализуем статус в СТРОКУ
      let statusText =
        (typeof raw === 'string')
          ? raw
          : (raw && (raw.status || raw.code))
            ? String(raw.status || raw.code)
            : 'unknown';

      // ► если HTTP 200 и явной ошибки нет — принимаем как успех
      if (res.ok && (statusText === 'unknown' || statusText === '')) {
        statusText = 'ok';
      }

      // 6) финал (не логируем содержимое текста)
      if (res.ok && statusText === 'ok') {
        return {
          ok: true,
          status: 'ok',
          postId: PID,
          oldText,
          newText,
          httpStatus: res.status
        };
      } else {
        return {
          ok: false,
          status: statusText,
          postId: PID,
          oldText,
          newText,
          httpStatus: res.status,
          infoMessage:  infoMessage.slice(0, 200),
          errorMessage: errorMessage.slice(0, 200)
        };
      }

    } catch (err) {
      return { ok:false, status:'transport', postId:String(postId), newText, errorMessage:(err?.message || String(err)) };
    }
  }

  window.FMV = window.FMV || {};
  window.FMV.replaceComment = replaceComment;
})();
// Проверка, что все указанные поля присутствуют и не пусты в window.CHRONO_CHECK
// Пример:
// if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID'])) return;

(function () {
  'use strict';

  /**
   * Проверяет, что в window.CHRONO_CHECK заданы все указанные поля
   * @param {string[]} keys - список имён полей для проверки
   * @returns {boolean} true, если все поля есть и непустые
   */
  window.checkChronoFields = function (keys = []) {
    const ch = window.CHRONO_CHECK;
    if (!ch || typeof ch !== 'object') return false;
    if (!Array.isArray(keys) || !keys.length) return true;

    return keys.every(k => {
      const v = ch[k];
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return true;
    });
  };
})();
/* ===================== поиск поста / блока ===================== */
function findChronoRendered(root) {
  const cand = Array.from(root.querySelectorAll('*')).find(n => /Собранная\s+хронология/i.test(n.textContent || ''));
  if (!cand) return null;
  return cand.closest('.quote-box, .media, .spoiler-box, .content, .post, div, section') || cand;
}

function renderStatus(type, status) {
  const MAP_TYPE = window.CHRONO_CHECK?.EpisodeMapType || {
    personal: ['personal', 'black'],
    plot:     ['plot',     'black'],
    au:       ['au',       'black']
  };

  const MAP_STAT = window.CHRONO_CHECK?.EpisodeMapStat || {
    on:       ['active',   'green'],
    off:      ['closed',   'teal'],
    archived: ['archived', 'maroon']
  };
  
  const t = MAP_TYPE[type] || MAP_TYPE.au;
  const s = MAP_STAT[status] || MAP_STAT.archived;
  return `[color=${t[1]}]${t[0]}[/color] / [color=${s[1]}]${s[0]}[/color]`;
}

// --- parseParagraph: делим <p> на 4 логические строки по <br> ---
function parseParagraph(p) {
  const lines = [[], [], [], []]; // 0: дата+тема, 1: мета, 2: участники, 3: локация (+ всё остальное)
  let i = 0;
  for (const node of p.childNodes) {
    if (node.nodeType === 1 && node.tagName === 'BR') { i = Math.min(i + 1, 3); continue; }
    lines[i].push(node);
  }
  const dateTitleNodes = lines[0];
  const metaNodes      = lines[1];
  const partNodes      = lines[2];
  const locNodes       = lines[3];

  // ссылка темы — только <a href*="viewtopic.php?id="> из первой строки
  const tmp = document.createElement('div');
  dateTitleNodes.forEach(n => tmp.appendChild(n.cloneNode(true)));
  const a = tmp.querySelector('a[href*="viewtopic.php?id="]') || p.querySelector('a[href*="viewtopic.php?id="]');

  const { type, status, order, dateStart, dateEnd, title } =
    parseHeaderNew(dateTitleNodes, metaNodes, a);

  const { participants, masksLines } = parseParticipants(partNodes);
  const location = cleanLocation(textFromNodes(locNodes));

  const start = (type === 'au') ? '' : (dateStart || '');
  const end   = (type === 'au') ? '' : (dateEnd   || start || '');

  return {
    type, status,
    title, href: a?.href || '',
    dateStart: start, dateEnd: end,
    order: Number.isFinite(order) ? order : 0,
    participants, masksLines, location
  };
}

// --- parseHeaderNew: 1-я строка (дата — тема), 2-я строка ([тип / статус / порядок]) ---
function parseHeaderNew(dateTitleNodes, metaNodes, linkEl) {
  // ТЕМА: только текст из <a>
  const title = (linkEl?.textContent || '').trim();

  // 1-я строка как временный DOM
  const wrap = document.createElement('div');
  dateTitleNodes.forEach(n => wrap.appendChild(n.cloneNode(true)));
  const l1Text = (wrap.textContent || '').replace(/\s+/g, ' ').trim();

  // --- ДАТА: только если реально дата ---
  let dateStart = '', dateEnd = '';

  // (а) strong приоритетнее
  let datePart = (wrap.querySelector('strong')?.textContent || '').trim();

  if (!datePart) {
        // (б) пытаемся взять префикс до первого « —/–/- » как кандидата на дату
    const head = l1Text.split(/\s[—–-]\s/)[0]?.trim() || '';
    const d = parseDateFlexible(head); // уже умеет все нужные форматы и диапазоны
    if (d && d.hasDate) {
      // сохраняем как текстовые значения для твоей дальнейшей логики
      const show = (a) =>
        a?.y != null
          ? (a.d != null ? `${String(a.d).padStart(2,'0')}.${String(a.m).padStart(2,'0')}.${a.y}`
             : a.m != null ? `${String(a.m).padStart(2,'0')}.${a.y}`
             : String(a.y))
          : '';
      dateStart = show(d.left);
      // ставим dateEnd только если диапазон реально есть
      dateEnd = (d.right && (d.right.y !== d.left.y || d.right.m != null || d.right.d != null))
                  ? show(d.right)
                  : '';
    }
  } else {
    // распарсить диапазон из strong, если он есть
    const norm = datePart.replace(/[\u2012-\u2015\u2212—–−]/g, '-').replace(/\s*-\s*/g, '-');
    const duo = norm.split('-').slice(0, 2).map(s => s.trim());
    dateStart = duo[0] || '';
    dateEnd   = duo[1] || '';
  }

  // если встречается "дата не указана" — пусто
  if (/дата\s+не\s+указан/i.test(datePart || '')) { dateStart = ''; dateEnd = ''; }

  // --- МЕТА: [тип / статус / порядок] — 2-я строка
  const metaText = textFromNodes(metaNodes);
  let type = '', status = '', order = 0;
  const box = metaText.match(/\[([^\]]+)\]/);
  if (box) {
    const parts = box[1].split('/').map(s => s.trim());
    type   = (parts[0] || '').toLowerCase();
    status = (parts[1] || '').toLowerCase();
    if (parts[2]) { const n = parseInt(parts[2], 10); if (Number.isFinite(n)) order = n; }
  }

  return { type, status, order, dateStart, dateEnd, title };
}

function parseParticipants(nodes) {
  // расплющим DOM в токены "link" и "text"
  const toks = [];
  (function flat(nl){
    Array.from(nl).forEach(n => {
      if (n.nodeType === 3) toks.push({ t:'text', v:n.nodeValue || '' });
      else if (n.nodeType === 1) {
        if (n.tagName === 'A') toks.push({ t:'link', name:(n.textContent||'').trim(), href:n.href||'' });
        else flat(n.childNodes);
      }
    });
  })(nodes);

  const participants = [];            // {name, href}
  const maskMap = new Map();          // name -> [mask,...]
  let lastName = null;

  const addMask = (name, list) => {
    if (!name || !list || !list.length) return;
    if (!maskMap.has(name)) maskMap.set(name, []);
    maskMap.get(name).push(...list);
  };

  for (const tk of toks) {
    if (tk.t === 'link') {
      const name = tk.name;
      participants.push({ name, href: tk.href });
      lastName = name;
      continue;
    }

    if (tk.t === 'text') {
      let t = tk.v || '';
      // если встречаем "не указаны" — обе колонки пустые
      if (/\bне\s*указан/i.test(t)) return { participants: [], masksLines: [] };

      // вытащить маски и привязать к последнему участнику
      t = t.replace(/\[\s*as\s*([^\]]+)\]/ig, (_m, g) => {
        const arr = g.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
        addMask(lastName, arr);
        return ''; // удалить из текста
      });

      // оставшиеся имена (без масок) через запятую
      t.split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
        if (/^[–—-]+$/.test(name)) return;                 // мусорные тире
        if (/^\[.*\]$/.test(name)) return;                 // остаточные скобки
        participants.push({ name, href: '' });
        lastName = name;
      });
    }
  }

  // собрать строки для колонки "Маски" (по одной маске в строке)
  const masksLines = [];
  for (const p of participants) {
    const arr = maskMap.get(p.name);
    if (arr && arr.length) arr.forEach(msk => masksLines.push(`${p.name} — ${msk}`));
  }

  return { participants, masksLines };
}
function cleanLocation(s) {
  const t=String(s||'').trim();
  if (!t) return '';
  if (/^локац/i.test(t) && /не\s+указан/i.test(t)) return '';
  if (/^не\s+указан/i.test(t)) return '';
  return t;
}

/**
 * collectEpisodesFromForums (без forumIds/topicId/postId и без CHRONO_CHECK.ForumInfo)
 * Обходит разделы форума и возвращает массив эпизодов:
 * {
 *   dateStart, dateEnd, title, href, type, status, order, location,
 *   participants: [ { id?, name, masks: [] }, ... ]
 * }
 *
 * Параметры (все опциональны):
 *   - sections: [{ id, type?, status? }, ...]  // если не задано — автообнаружение по документу
 *   - maxPagesPerSection: число страниц на раздел (по умолчанию 50)
 *   - groupIds: допустимые группы (если ваша логика доступа это использует где-то снаружи)
 *   - respectAccess: флаг для внешних проверок доступа (пробрасывается как есть)
 */
async function collectEpisodesFromForums(opts = {}) {
    // --- вспомогательная функция для ограниченной параллельной загрузки ---
    async function asyncPool(limit, items, iteratee) {
      const ret = [];
      const executing = new Set();
      for (const item of items) {
        const p = Promise.resolve().then(() => iteratee(item));
        ret.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);
        if (executing.size >= limit) {
          await Promise.race(executing);
        }
      }
      return Promise.all(ret);
    }
  
  // разделы: либо из opts.sections, либо автообнаружение по текущему документу
  let SECTIONS = Array.isArray(opts.sections) && opts.sections.length ? opts.sections.slice() : [];
  if (!SECTIONS.length) {
    // авто: собрать все уникальные forum-id из текущей страницы
    const ids = new Set();
    document.querySelectorAll('a[href*="viewforum.php?id="]').forEach(a => {
      const m = String(a.getAttribute('href') || '').match(/viewforum\.php\?id=(\d+)/i);
      if (m) ids.add(m[1]);
    });
    SECTIONS = Array.from(ids).map(id => ({ id })); // type/status можно добавить позднее при необходимости
  }

  if (!SECTIONS.length) {
    console.warn('[collectEpisodesFromForums] Не удалось определить список разделов (sections)');
    return [];
  }

  const MAX_PAGES_PER_SECTION = 100;

  // ==== утилиты ====
  const abs  = (base, href)=>{ try { return new URL(href, base).href; } catch { return href; } };
  const text = node => (node && (node.innerText ?? node.textContent) || '').trim();

  // чтение заголовка темы: из <title> или хвоста крошек после последнего "»"
  function topicTitleFromCrumbs(doc) {
    const t = (doc.querySelector('title')?.textContent || '').trim();
    if (/\[.+\]\s+.+/.test(t)) return t;
    const crumbs = doc.querySelector('.crumbs, .crumbs-nav, #pun-crumbs1 .crumbs, #pun-crumbs1');
    if (crumbs) {
      const full = (crumbs.textContent || '').replace(/\s+/g, ' ').trim();
      const tail = full.split('»').pop()?.trim() || '';
      if (tail) return tail;
    }
    const a = doc.querySelector('a[href*="viewtopic.php?id="]');
    return (a?.textContent || '').trim();
  }

  // [дата] Заголовок — только если внутри реально дата/диапазон
  function parseTitle(str) {
    const s = String(str || '').trim();
  
    const m = s.match(/^\s*\[(.*?)\]\s*(.*)$/s);
    if (m) {
      const inner = (m[1] || '').trim();
      const rest  = (m[2] || '').trim();
      const d = parseDateFlexible(inner);   // ваша функция разбора дат
  
      if (d && d.hasDate) {
        // это действительно дата → отделяем
        return { dateRaw: inner, episode: rest.replace(/\s+/g, ' ') };
      }
      // НЕ дата → ничего не откусываем
    }
  
    return { dateRaw: '', episode: s.replace(/\s+/g, ' ') };
  }


  // ---- парсинг дат ----
  const DASH_RX = /[\u2012-\u2015\u2212—–−]/g;
  const DOT_RX  = /[.\u2024\u2219\u00B7\u2027\u22C5·∙•]/g;
  const pad2 = x => String(x).padStart(2,'0');
  function toYYYY(n){ const num = Number(n); if (!Number.isFinite(num)) return null; return String(n).length === 2 ? (num > 30 ? 1900 + num : 2000 + num) : num; }
  function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); }
  function parseToken(t) {
    const s = String(t || '').trim().replace(DOT_RX, '.');
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const d  = +m[1], mo = +m[2], y = toYYYY(m[3]);
      if (mo<1 || mo>12) return null;
      if (d<1 || d>daysInMonth(y,mo)) return null;
      return { y, m: mo, d };
    }
    m = s.match(/^(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const mo = +m[1], y = toYYYY(m[2]);
      if (mo>=1 && mo<=12) return { y, m: mo };
    }
    m = s.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (m) {
      const d = +m[1], mo = +m[2];
      if (mo>=1 && mo<=12 && d>=1 && d<=31) return { m: mo, d };
      return null;
    }
    m = s.match(/^(\d{2}|\d{4})$/);
    if (m) return { y: toYYYY(m[1]) };
    return null;
  }
  function displaySingle(a){ return a.d!=null ? `${pad2(a.d)}.${pad2(a.m)}.${a.y}`
                          : a.m!=null ? `${pad2(a.m)}.${a.y}` : String(a.y); }
  function parseDateFlexible(raw) {
    let s = String(raw || '').trim();
    if (!s) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
    s = s.replace(DASH_RX, '-').replace(DOT_RX, '.').replace(/\s*-\s*/g, '-');
    const parts = s.split('-').slice(0,2);
    if (parts.length === 1) {
      const one = parseToken(parts[0]);
      if (!one || !one.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
      const k = [one.y, one.m ?? 0, one.d ?? 0];
      return { hasDate:true, display:displaySingle(one), startSort:k, endSort:k, left:one, right:one };
    }
    const leftRaw  = parts[0].trim();
    const rightRaw = parts[1].trim();
    const R0 = parseToken(rightRaw);
    if (!R0 || !R0.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
    let L0 = parseToken(leftRaw);
    const mSolo = leftRaw.match(/^\d{1,2}$/);
    if (mSolo) {
      const v = +mSolo[0];
      if (R0.d != null && R0.m != null)      L0 = { y:R0.y, m:R0.m, d:v };
      else if (R0.m != null)                 L0 = { y:R0.y, m:v };
      else                                   L0 = { y: toYYYY(v) };
    }

    // если оба — чисто двухзначные годы и получился "перевёрнутый" диапазон,
    // подгоняем век левой границы под правую
    const left2  = /^\d{1,2}$/.test(leftRaw);
    const right2 = /^\d{1,2}$/.test(rightRaw);
    if (left2 && right2 && L0?.y && R0?.y && (L0.m==null && L0.d==null) && (R0.m==null && R0.d==null)) {
      if (L0.y > R0.y) {
        // примем век правой границы для левой
        const century = Math.floor(R0.y / 100) * 100;       // 1900 или 2000
        const yy = +leftRaw;                                 // 22
        L0.y = century + yy;                                 // 1922
      }
    }

    
    if (L0 && L0.y == null && L0.d != null && L0.m != null && R0.y) L0.y = R0.y;
    const okDay = (o)=> (o.d==null) || (o.y && o.m && o.d>=1 && o.d<=daysInMonth(o.y,o.m));
    if (!okDay(L0) || !okDay(R0)) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
    const startKey = [L0.y, L0.m ?? 0, L0.d ?? 0];
    const endKey   = [R0.y ?? L0.y, R0.m ?? 0, R0.d ?? 0];
    function displayRange(a,b){
      if (a.d!=null && b.d!=null) return `${pad2(a.d)}.${pad2(a.m)}.${a.y}-${pad2(b.d)}.${b.m}.${b.y}`;
      if (a.m!=null && b.m!=null) return `${pad2(a.m)}.${a.y}-${pad2(b.m)}.${b.y}`;
      return `${a.y}-${b.y}`;
    }
    return { hasDate:true, startSort:startKey, endSort:endKey, display:displayRange(L0,R0), left:L0, right:R0 };
  }
  function cmpTriple(a, b) { for (let i=0;i<3;i++) { const d = (a[i]??0)-(b[i]??0); if (d) return d; } return 0; }
  function compareEpisodes(a, b) {
    const aHas = !!a.__hasDate, bHas = !!b.__hasDate;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas) {
      const s = cmpTriple(a.__startSort, b.__startSort); if (s) return s;
      const e = cmpTriple(a.__endSort,   b.__endSort);   if (e) return e;
    }
    const ao = a.order ?? 0, bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return String(a.title||'').toLowerCase()
      .localeCompare(String(b.title||'').toLowerCase(), 'ru', { sensitivity:'base' });
  }
  function normalizeEpisodeTitle(type, rawTitle, hasDateForType) {
    const title = String(rawTitle || '').trim();
    let ok = true;
  
    if (type === 'plot') {
      // Требуем: валидная дата есть И суффикс "... [c]" или "... [с]" в самом конце
      const suffixRx = /\s\[\s*(?:c|с)\s*\]$/i; // лат. c или кир. с
      const hasSuffix = suffixRx.test(title);
      ok = !!hasDateForType && hasSuffix;
  
      return {
        title: hasSuffix ? title.replace(suffixRx, '').trim() : title,
        ok
      };
    }
  
    if (type === 'au') {
      // Требуем: начало либо "[au] ", либо "[AU] " (смешанный регистр не допускаем)
      const prefixRx = /^(?:\[\s*au\s*\]\s+|\[\s*AU\s*\]\s+)/;
      const hasPrefix = prefixRx.test(title);
      ok = hasPrefix;
  
      return {
        title: hasPrefix ? title.replace(prefixRx, '').trim() : title,
        ok
      };
    }
  
    return { title, ok };
  }

  // ==== скрапперы ====
  async function scrapeSection(section, seenTopics) {
  let url = abs(location.href, `/viewforum.php?id=${section.id}`);
  const seenPages = new Set();
  const out  = [];
  let n = 0;

  // [NEW] Зафиксируем какие темы уже встречали в этом разделе:
  const sectionSeen = new Set();

  let lastSig = '';

  while (url && !seenPages.has(url) && n < MAX_PAGES_PER_SECTION) {
    n++; seenPages.add(url);
    const doc = await FMV.fetchDoc(url);

    // список тем на странице (id → {url,title})
    const topics = new Map();
    doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
      const href = abs(url, a.getAttribute('href'));
      const m = href.match(/viewtopic\.php\?id=(\d+)/i);
      const ttl = text(a);
      if (!m) return;
      if (/^\s*(RSS|Atom)\s*$/i.test(ttl)) return;
      if (/#p\d+$/i.test(href)) return;
      if (/^\d{1,2}\.\d{1,2}\.\d{2,4}(?:\s+\d{1,2}:\d{2})?$/.test(ttl)) return;
      topics.set(m[1], { url: href, title: ttl });
    });

    // === РАННИЕ ВЫХОДЫ ===

    // (а) Совпала сигнатура со страницей N-1 → дальше листать нет смысла
    const pageIds = Array.from(topics.keys()).sort();
    const sig = pageIds.join(',');
    if (sig && sig === lastSig) break;
    lastSig = sig;

    // (б) На странице нет ни одного нового id относительно уже виденных в этом разделе
    const newIds = pageIds.filter(id => !sectionSeen.has(id));
    if (newIds.length === 0) break;
    newIds.forEach(id => sectionSeen.add(id));

    // --- параллельная загрузка тем с лимитом потоков ---
    const CONCURRENCY = Number.isFinite(+opts?.concurrencyPerPage)
      ? +opts.concurrencyPerPage
      : 6; // дефолт: 6 запросов одновременно
    
    const topicEntries = Array.from(topics.entries());
    
    const rows = await asyncPool(CONCURRENCY, topicEntries,
      async ([tid, { url: turl, title }]) => {
        const key = tid ? `id:${tid}` : `url:${turl.replace(/#.*$/,'')}`;
        if (seenTopics.has(key)) return null;
        const row = await scrapeTopic(turl, title, section.type, section.status);
        return row ? { key, row } : null;
      });
    
    for (const r of rows) {
      if (!r) continue;
      seenTopics.add(r.key);
      out.push(r.row);
    }

    // Переход на следующую страницу
    const next = (function findNextPage(doc){
      const a = doc.querySelector('a[rel="next"], a[href*="&p="]:not([rel="prev"])');
      return a ? a.getAttribute('href') : null;
    })(doc);
    const nextUrl = next ? abs(url, next) : null;
    if (!nextUrl || seenPages.has(nextUrl)) { url = null; break; }
    url = nextUrl;
  }
  return out;
}


  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const doc   = await FMV.fetchDoc(topicUrl);
      const first = doc.querySelector('.post.topicpost .post-content')
                   || doc.querySelector('.post.topicpost') || doc;

      const titleFromCrumbs = topicTitleFromCrumbs(doc);
      const safeTitle = rawTitle || titleFromCrumbs || '';

      const { dateRaw, episode } = parseTitle(safeTitle);
      const parsed = parseDateFlexible(dateRaw);

      const norm = normalizeEpisodeTitle(type, episode || '', parsed.hasDate);

      const rawChars = FMV.readTagText(first, 'characters');
      const rawLoc   = FMV.readTagText(first, 'location');
      const rawOrder = FMV.readTagText(first, 'order');

      const idToNameMap = await FMV.buildIdToNameMapFromTags(rawChars);
      const uni = FMV.parseCharactersUnified(rawChars, idToNameMap, window.profileLink);
      const participantsLower = uni.ok ? uni.participantsLower : [];
      const masksByCharLower  = uni.ok ? uni.masksByCharLower  : new Map();

      const order = (FMV.parseOrderStrict(rawOrder).ok ? FMV.parseOrderStrict(rawOrder).value : 0);

      const locationsLower = rawLoc
        ? rawLoc.split(/\s*[,;]\s*/).map(s => s.trim().toLowerCase()).filter(Boolean)
        : [];

      const participants = participantsLower.map(low => {
        const masks = Array.from(masksByCharLower.get(low) || []);
        const m = /^user(\d+)$/i.exec(String(low));
        if (m) {
          const id = m[1];
          if (idToNameMap && idToNameMap.has(id)) {
            return { id, name: idToNameMap.get(id), masks };
          }
          return { name: `user${id}`, masks };
        }
        return { name: String(low), masks };
      });

      const dateStartStr = parsed.hasDate
        ? ((parsed.left?.d != null) ? displaySingle(parsed.left)
          : (parsed.left?.m != null) ? displaySingle(parsed.left)
          : String(parsed.left?.y ?? ''))
        : '';
      
      const dateEndStr = parsed.hasDate
        ? ((parsed.right?.d != null) ? displaySingle(parsed.right)
          : (parsed.right?.m != null) ? displaySingle(parsed.right)
          : String(parsed.right?.y ?? parsed.left?.y ?? ''))
        : (dateStartStr || '');

      return {
        dateStart: dateStartStr,
        dateEnd:   dateEndStr,
        title:     norm.title || '',
        href:      topicUrl,
        type, status,
        order:     Number(order) || 0,
        location:  locationsLower.join(', '),
        participants,
        isTitleNormalized: norm.ok,
        __hasDate: parsed.hasDate,
        __startSort: parsed.startSort,
        __endSort:   parsed.endSort
      };
    } catch {
      return null;
    }
  }

  // ==== обход и сортировка ====
  const seenTopics = new Set();
  let all = [];
  for (const sec of SECTIONS) {
    const part = await scrapeSection(sec, seenTopics);
    all = all.concat(part);
  }

  all = all.filter(Boolean).sort(compareEpisodes);

  // подчистим служебные поля
  all.forEach(e => { delete e.__hasDate; delete e.__startSort; delete e.__endSort; });

  return all;
}


/**
 * Собирает словарь по пользователям на основе collectEpisodesFromForums.
 * Учитывает только участников со ссылкой на профиль (есть p.id).
 *
 * Параметры:
 * @param {Object} [opts]
 * @param {Array<number|string>} [opts.groupIds] - допустимые группы; по умолчанию берётся из CHRONO_CHECK.GroupID
 * @param {boolean} [opts.respectAccess=true]    - выполнять проверки доступа (если есть хелперы)
 *
 * Возвращает:
 * Promise<{ [userId: string]: { name: string, episodes: Episode[] } }>
 *
 * Episode = {
 *   dateStart: string,
 *   dateEnd:   string,
 *   type:      string,
 *   status:    string,
 *   title:     string,
 *   href:      string,
 *   order:     number,
 *   location:  string,
 *   masks:     string[],  // маски владельца
 *   participants: Array<{ id:string, name:string, masks:string[] }>
 * }
 */
/**
 * Собирает словарь по пользователям на основе collectEpisodesFromForums.
 * Учитывает только участников со ссылкой на профиль (есть p.id).
 *
 * @param {Object} [opts]
 * @param {Array<number|string>} [opts.groupIds] - допустимые группы; по умолчанию CHRONO_CHECK.GroupID
 * @param {boolean} [opts.respectAccess=true]    - выполнять проверки доступа (если есть хелперы)
 * @param {Array<{id:string|number,type?:string,status?:string}>} [opts.sections] - список разделов
 * @param {number} [opts.maxPagesPerSection]     - лимит страниц на раздел
 *
 * @returns {Promise<Object>} { "<userId>": { name: string, episodes: Episode[] } }
 */
async function collectChronoByUser(opts = {}) {
  if (typeof collectEpisodesFromForums !== 'function') {
    throw new Error('collectEpisodesFromForums недоступна');
  }

  let SECTIONS = Array.isArray(opts.sections) && opts.sections.length ? opts.sections.slice() : [];
  const maxPagesPerSection =
    Number.isFinite(+opts.maxPagesPerSection) ? +opts.maxPagesPerSection : undefined;

  // получаем эпизоды с учётом sections
  const episodes = await collectEpisodesFromForums({
    sections: SECTIONS,
    maxPagesPerSection
  });

  const byUser = Object.create(null);

  // стабилизируем порядок
  episodes.forEach((e, i) => { if (!Number.isFinite(e.order)) e.order = i; });

  for (const ep of episodes) {
    const participants = (ep.participants || [])
      .map(p => {
        const id = p?.id ? String(p.id).trim() : '';
        if (!id) return null; // игнорируем ники без id/профиля
        return {
          id,
          name: (p.name || '').trim(),
          masks: Array.isArray(p.masks) ? p.masks.slice() : []
        };
      })
      .filter(Boolean);

    for (const self of participants) {
      const others = participants
        .filter(p => p !== self)
        .map(p => ({ id: p.id, name: p.name, masks: p.masks.slice() }));

      const outEpisode = {
        dateStart: ep.dateStart || '',
        dateEnd:   ep.dateEnd   || ep.dateStart || '',
        type:      ep.type      || '',
        status:    ep.status    || '',
        title:     ep.title     || '',
        href:      ep.href      || '',
        order:     Number(ep.order || 0),
        location:  ep.location  || '',
        masks:     self.masks || [],
        participants: others,
        // если нужно использовать дальше: пробросим валидность названия
        isTitleNormalized: !!ep.isTitleNormalized
      };

      if (!byUser[self.id]) {
        byUser[self.id] = { name: self.name || '', episodes: [] };
      }
      byUser[self.id].episodes.push(outEpisode);
    }
  }

  return byUser;
}

/* Crhono buttons */
// button_update_total — собирает через collectEpisodesFromForums({sections}) и пишет в "Общую хронологию"
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID', 'TotalChronoPostID', 'ForumInfo'])) {
    console.warn('[button_update_total] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID, ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID        = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID        = (window.CHRONO_CHECK.AmsForumID).map(String);
  const TID        = String(window.CHRONO_CHECK.ChronoTopicID).trim();
  const PID        = String(window.CHRONO_CHECK.TotalChronoPostID).trim();
  const OPEN_URL   = new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href).href;
  const SECTIONS   = window.CHRONO_CHECK.ForumInfo;

  let busy = false;

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить общее хроно',
    order: 1,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Открыть ссылку',
    linkHref: OPEN_URL,

    async onClick(api) {
      if (busy) return;
      busy = true;

      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      api?.setLinkVisible?.(false);
      api?.setLink?.('', '');

      try {
        setStatus('Собираю…');
        setDetails('');

        // 1) Сбор эпизодов из парсера (через sections)
        if (typeof collectEpisodesFromForums !== 'function') {
          throw new Error('collectEpisodesFromForums недоступна');
        }
        const episodes = await collectEpisodesFromForums({ sections: SECTIONS });

        // 2) Рендер BBCode
        setStatus('Формирую текст…');
        const bb = renderChronoFromEpisodes(episodes);

        // 3) Запись в пост
        setStatus('Записываю…');
        const html = FMV.toCp1251Entities(bb);
        const res  = await FMV.replaceComment(GID, PID, html);

        const st = normStatus(res.status);
        const success = !!res.ok || st === 'ok';

        setStatus(success ? 'Готово' : 'Ошибка');
        if (success) {
          api?.setLink?.(OPEN_URL, 'Открыть ссылку');
          api?.setLinkVisible?.(true);
        } else {
          api?.setLink?.('', '');
          api?.setLinkVisible?.(false);
        }

        const info  = toPlainShort(res.infoMessage || '');
        const error = toPlainShort(res.errorMessage || '');
        const lines = [`Статус: ${success ? 'ok' : st || 'unknown'}`];
        if (info)  lines.push(info);
        if (error) lines.push(`<span style="color:#b00020">${FMV.escapeHtml(error)}</span>`);
        setDetails(lines.join('<br>'));

      } catch (e) {
        setStatus('✖ ошибка', 'red');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        api?.setLinkVisible?.(false);
        api?.setLink?.('', '');
      } finally {
        busy = false;
      }
    }
  });

  /* ===================== РЕНДЕР ===================== */
  function renderChronoFromEpisodes(episodes) {
    const rows = (episodes || []).map(e => {
      const status = renderStatus(e.type, e.status);

      const dateDisplay = (e.type === 'au')
        ? ''
        : (e.dateStart
            ? `[b]${FMV.escapeHtml(
                e.dateEnd && e.dateEnd !== e.dateStart
                  ? `${e.dateStart}-${e.dateEnd}`
                  : e.dateStart
              )}[/b]`
            : `[mark]дата не указана[/mark]`);

      const url = FMV.escapeHtml(e.href || '');
      const ttl = FMV.escapeHtml(e.title || '');

      const errBeforeOrder = e.isTitleNormalized
        ? ''
        : (e.type === 'au'
            ? ' [mark]в названии нет [au][/mark]'
            : ' [mark]в названии нет [с][/mark]');

      const ord = `${FMV.escapeHtml(String(e.order ?? 0))}`;

      const asBB = true;
      const names = (Array.isArray(e.participants) && e.participants.length)
        ? e.participants.map(p => {
            const display = (p.id != null && p.id !== '')
              ? userLink(String(p.id), p.name, asBB)
              : missingUser(String(p.name || ''), asBB);
            const roles = Array.isArray(p.masks) ? p.masks : [];
            const tail  = roles.length ? ` [as ${FMV.escapeHtml(roles.join(', '))}]` : '';
            return `${display}${tail}`;
          }).join(', ')
        : `[mark]не указаны[/mark]`;

      const loc = e.location
        ? FMV.escapeHtml(e.location)
        : `[mark]локация не указана[/mark]`;

      const dash = dateDisplay ? ' — ' : ' ';

      return `${dateDisplay}${dash}[url=${url}]${ttl}[/url]${errBeforeOrder}\n[${status} / ${ord}]\n[i]${names}[/i]\n${loc}\n\n`;
    });

    return `[media="Общая хронология"]${rows.join('') || ''}[/media]`;
  }

  /* ===================== УТИЛИТЫ ===================== */

  function normStatus(s) {
    if (s == null) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return String(s.status || s.code || (s.ok ? 'ok' : 'unknown'));
    return String(s);
  }

  function toPlainShort(s = '', limit = 200) {
    const t = String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > limit ? t.slice(0, limit) + '…' : t;
  }

  if (typeof window.userLink !== 'function') {
    window.userLink = (id, name, asBB = true) =>
      asBB ? `[url=/profile.php?id=${FMV.escapeHtml(String(id))}]${FMV.escapeHtml(String(name))}[/url]`
           : `<a href="/profile.php?id=${FMV.escapeHtml(String(id))}">${FMV.escapeHtml(String(name))}</a>`;
  }
  if (typeof window.missingUser !== 'function') {
    window.missingUser = (name, asBB = true) =>
      asBB ? `[i]${FMV.escapeHtml(String(name))}[/i]`
           : `<i>${FMV.escapeHtml(String(name))}</i>`;
  }
})();
// button_total_to_excel (через collectEpisodesFromForums)
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID', 'TotalChronoPostID', 'ForumInfo'])) {
    console.warn('[button_total_to_excel] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID, ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID        = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID        = (window.CHRONO_CHECK.AmsForumID).map(String);
  const TID        = String(window.CHRONO_CHECK.ChronoTopicID).trim();
  const PID        = String(window.CHRONO_CHECK.TotalChronoPostID).trim();
  const OPEN_URL   = new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href).href;
  const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');
  const SECTIONS   = window.CHRONO_CHECK.ForumInfo;


  let lastBlobUrl = '';

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'выгрузить общее хроно в excel',
    order: 2,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Скачать',
    linkHref: '',

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});
      api?.setLink?.('', ''); // прячем ссылку на время работы

      try {
        setStatus('Собираю…');
        setDetails('');

        // === берём готовые эпизоды из парсера
        const episodes = await collectEpisodesFromForums({ sections: SECTIONS });
        if (!episodes.length) throw new Error('Эпизоды не найдены.');

        // Маппинг эпизодов → строки таблицы
        // Столбцы: Тип | Статус | Тема (ссылка) | Дата начала | Дата конца | Порядок | Участники | Маски | Локация
        const rows = episodes.map(ep => {
          // колонка «Участники»: "Имя — {SITE_URL}/profile.php?id=ID" или просто "Имя"
          const participantsText = (ep.participants || []).map(p => {
            const name = String(p.name || '').trim();
            if (!name) return '';
            if (p.id != null && p.id !== '') {
              const href = `${SITE_URL}/profile.php?id=${encodeURIComponent(String(p.id))}`;
              return `${name} — ${href}`;
            }
            return name;
          }).filter(Boolean).join('\n');

          // колонка «Маски»: "Имя — mask1, mask2" (только если маски есть)
          const masksLines = (ep.participants || []).flatMap(p => {
            const masks = Array.isArray(p.masks) ? p.masks.filter(Boolean) : [];
            const name  = String(p.name || '').trim() || (p.id != null ? `user${p.id}` : '');
            // Для каждой маски — своя строка "Имя — маска"
            return masks.map(m => `${name} — ${m}`);
          }).filter(Boolean);

          return {
            type: ep.type || '',
            status: ep.status || '',
            title: ep.title || '',
            href: ep.href || '',
            dateStart: ep.dateStart || '',
            dateEnd: ep.dateEnd || ep.dateStart || '',
            order: Number(ep.order || 0) || 0,
            participantsText,
            masksLines,
            location: ep.location || ''
          };
        });

        setStatus('Формирую файл…');
        const { blob, filename } = buildXLSX(rows);

        if (lastBlobUrl) { try { URL.revokeObjectURL(lastBlobUrl); } catch {} }
        lastBlobUrl = URL.createObjectURL(blob);

        setStatus('✓ готово', 'green');
        setDetails(`Строк: ${rows.length}\nИсточник: ${FMV.escapeHtml(OPEN_URL)}\nФайл: ${FMV.escapeHtml(filename)}`);
        setLink(lastBlobUrl, 'Скачать');
        const a = api?.wrap?.querySelector('a.fmv-action-link');
        if (a) a.setAttribute('download', filename);

      } catch (e) {
        setStatus('✖ ошибка', 'red');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        api?.setLink?.('', '');
      }
    }
  });

  /* ===================== XLSX builder ===================== */

  // helpers
  const str2u8 = s => new TextEncoder().encode(s);
  const u16 = n => new Uint8Array([n&255,(n>>>8)&255]);
  const u32 = n => new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
  const concat = arrs => { let len=0; arrs.forEach(a=>len+=a.length); const out=new Uint8Array(len); let o=0; arrs.forEach(a=>{out.set(a,o); o+=a.length;}); return out; };
  const CRC_TABLE = (()=>{ let t=new Uint32Array(256), c; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0;} return t;})();
  const crc32 = (u8)=>{ let c=0^(-1); for(let i=0;i<u8.length;i++) c=(c>>>8)^CRC_TABLE[(c^u8[i])&255]; return (c^(-1))>>>0; };
  const dosDateTime=(d=new Date())=>{
    const time=((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31);
    const date=(((d.getFullYear()-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31);
    return {time,date};
  };
  const xmlEscape = s => String(s||'').replace(/[<>&"]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const q = s => String(s||'').replace(/"/g,'""');

  function cellInline(v){ return `<c t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v).replace(/\r?\n/g,'&#10;')}</t></is></c>`; }
  function cellNumber(n){ return `<c><v>${Number(n)||0}</v></c>`; }
  function cellFormula(f){ return `<c><f>${xmlEscape(f)}</f></c>`; }
  function linkCell(url, label){
    if (url && label) return cellFormula(`HYPERLINK("${q(url)}","${q(label)}")`);
    if (url && !label) return cellFormula(`HYPERLINK("${q(url)}","${q(url)}")`);
    return cellInline(label||'');
  }

  // Лист: 9 колонок
  function sheetChronoXML(rows){
    const header = ['Тип','Статус','Тема','Дата начала','Дата конца','Порядок','Участники','Маски','Локация'];
    const headerRow = `<row r="1">${header.map(cellInline).join('')}</row>`;
    const dataRows = rows.map((r,i)=>{
      const cells = [
        cellInline(r.type||''),
        cellInline(r.status||''),
        linkCell(r.href||'', r.title || r.href || ''),
        cellInline(r.dateStart||''),
        cellInline(r.dateEnd||r.dateStart||''),
        cellNumber(r.order||0),
        cellInline(r.participantsText||''),
        cellInline((r.masksLines||[]).join('\n')),
        cellInline(r.location||'')
      ];
      return `<row r="${i+2}">${cells.join('')}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;
  }

  // Минимальный рабочий пакет XLSX: workbook + 1 worksheet (без компрессии)
  function buildXLSX(rows){
    const files=[], add=(name,content)=>files.push({name, data:str2u8(content)});
    const wbRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;
    const wbXML = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Хронология" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"          ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;
    add('[Content_Types].xml', contentTypes);
    add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
    add('xl/workbook.xml', wbXML);
    add('xl/_rels/workbook.xml.rels', wbRels);
    add('xl/worksheets/sheet1.xml', sheetChronoXML(rows));
    const blobZip = makeZip(files);
    const filename = `chronology_${new Date().toISOString().slice(0,10)}.xlsx`;
    return { blob: blobZip, filename };
  }

  // ZIP (без сжатия)
  function makeZip(files){
    const now=dosDateTime();
    const locals=[], centrals=[]; let offset=0;
    files.forEach(f=>{
      const nameU8=str2u8(f.name), data=f.data, crc=crc32(data);
      const local=concat([ u32(0x04034b50), u16(20), u16(0), u16(0), u16(now.time), u16(now.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameU8.length), u16(0), nameU8, data ]);
      const central=concat([ u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(now.time), u16(now.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameU8.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameU8 ]);
      locals.push(local); centrals.push(central); offset += local.length;
    });
    const centralDir = concat(centrals);
    const cdOffset = locals.reduce((a,b)=>a+b.length,0);
    const cdSize = centralDir.length;
    const end = concat([ u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(cdOffset), u16(0) ]);
    return new Blob([concat([...locals, centralDir, end])], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

})();
// button_collect_chrono_to_media.js — через collectChronoByUser (sections)
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID', 'PerPersonChronoPostID', 'ForumInfo'])) {
    console.warn('[button_update_per_user] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, PerPersonChronoPostID, ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID        = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID        = (window.CHRONO_CHECK.AmsForumID).map(String);
  const TID        = String(window.CHRONO_CHECK.ChronoTopicID).trim();
  const TARGET_PID = String(window.CHRONO_CHECK.PerPersonChronoPostID).trim();
  const SITE_URL   = (window.SITE_URL || location.origin).replace(/\/+$/, '');
  const SECTIONS = window.CHRONO_CHECK.ForumInfo;

  // хелперы ссылок
  if (typeof window.userLink !== 'function') {
    window.userLink = (id, name, asBB = true) =>
      asBB ? `[url=/profile.php?id=${FMV.escapeHtml(String(id))}]${FMV.escapeHtml(String(name))}[/url]`
           : `<a href="/profile.php?id=${FMV.escapeHtml(String(id))}">${FMV.escapeHtml(String(name))}</a>`;
  }
  if (typeof window.missingUser !== 'function') {
    window.missingUser = (name, asBB = true) =>
      asBB ? `[i]${FMV.escapeHtml(String(name))}[/i]`
           : `<i>${FMV.escapeHtml(String(name))}</i>`;
  }

  const lc = s => String(s || '').trim();

  function fmtDateBold(start, end) {
    const s = lc(start), e = lc(end);
    if (!s && !e) return '';
    if (!e || e === s) return `[b]${s}[/b]`;
    return `[b]${s}-${e}[/b]`;
  }
  function fmtParticipants(arr = []) {
    if (!arr.length) return '';
    const items = arr.map(p => {
      const asBB = true;
      const link = (p.id != null && String(p.id) !== '')
        ? userLink(String(p.id), p.name, asBB)
        : missingUser(String(p.name || ''), asBB);
      const masks = Array.isArray(p.masks) && p.masks.length ? ` [as ${FMV.escapeHtml(p.masks.join(', '))}]` : '';
      return `${link}${masks}`;
    });
    return `[i]${items.join(', ')}[/i]`;
  }

  // одна запись-эпизод пользователя
  function fmtEpisode(ep) {
    const headDate   = fmtDateBold(ep.dateStart, ep.dateEnd);
    const linkTitle  = `[url=${FMV.escapeHtml(lc(ep.href))}]${FMV.escapeHtml(lc(ep.title) || lc(ep.href))}[/url]`;
    const ownerMasks = (Array.isArray(ep.masks) && ep.masks.length) ? ` [as ${FMV.escapeHtml(ep.masks.join(', '))}]` : '';
    const head = headDate ? `${headDate} — ${linkTitle}${ownerMasks}` : `${linkTitle}${ownerMasks}`;

    const metaStatus = renderStatus(ep.type, ep.status);
    const metaOrder  = `${FMV.escapeHtml(String(ep.order ?? 0))}`;
    const meta = `[${metaStatus} / ${metaOrder}]`;

    const ppl = fmtParticipants(ep.participants || []);
    const out = [head, meta];
    if (ppl) out.push(ppl);
    if (lc(ep.location)) out.push(FMV.escapeHtml(lc(ep.location)));
    return out.join('\n');
  }

  // блок для одного персонажа (media с кликабельным названием)
  function buildPersonBlock(name, episodes = []) {
    const topicLink = `[url=${SITE_URL}/viewtopic.php?id=${TID}]${FMV.escapeHtml(lc(name))}[/url]`;
    const body = episodes.map(fmtEpisode).join('\n\n');
    return `[media="${topicLink}"]\n${body}\n[/media]`;
  }
  // общий контейнер
  const wrapAll = blocksText => `[media="Хронология по персонажам"]\n${blocksText}\n[/media]`;

  const OPEN_URL = `${SITE_URL}/viewtopic.php?id=${TID}#p${TARGET_PID}`;

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить хроно по персам',
    order: 3,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Открыть пост',
    linkHref: OPEN_URL,

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});
      const setLinkVis = api?.setLinkVisible || (()=>{});

      setLink('', ''); setLinkVis?.(false);

      try {
        setStatus('Собираю…'); setDetails('');

        // 1) берём готовую раскладку: { "<userId>": { name, episodes[] } }
        const byUser = await (window.collectChronoByUser
          ? window.collectChronoByUser({ sections: SECTIONS })
          : Promise.reject(new Error('collectChronoByUser недоступна')));

        // 2) в массив и сортировка по name
        const users = Object.entries(byUser || {})
          .map(([id, v]) => ({ id, name: v?.name || '', episodes: Array.isArray(v?.episodes) ? v.episodes : [] }))
          .filter(u => u.name)
          .sort((a,b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));

        if (!users.length) {
          setStatus('Пусто');
          setDetails('Нет данных для вывода.');
          return;
        }

        setStatus('Формирую текст…');

        // 3) блоки по персонажам
        const perPerson = users.map(u => buildPersonBlock(u.name, u.episodes)).join('\n\n');

        // 4) общий блок
        const finalBb = wrapAll(perPerson);

        // 5) записываем в целевой пост
        setStatus('Записываю…');
        const html = FMV.toCp1251Entities(finalBb);
        const res  = await FMV.replaceComment(GID, TARGET_PID, html);

        const st = String(res?.status || '');
        const success = !!res?.ok || st === 'ok';

        setStatus(success ? 'Готово' : 'Ошибка');

        if (success) { setLink(OPEN_URL, 'Открыть пост'); setLinkVis?.(true); }
        else         { setLink('', ''); setLinkVis?.(false); }

        const info  = (res?.infoMessage || '').replace(/<[^>]*>/g,' ').trim();
        const error = (res?.errorMessage || '').replace(/<[^>]*>/g,' ').trim();
        const lines = [`Статус: ${success ? 'ok' : (st || 'unknown')}`];
        if (info)  lines.push(info);
        if (error) lines.push(error);
        setDetails(lines.join('<br>'));
      } catch (e) {
        setStatus('✖ ошибка', 'red');
        setDetails(e?.message || String(e));
        setLink('', ''); setLinkVis?.(false);
      }
    }
  });
})();
// button_update_chrono_api.js
// Сохраняет хронологию пользователей в единый объект info_<userId>
// ВАЖНО: Делает GET сначала, затем обновляет только chrono и last_timestamp
// Использует collectChronoByUser для сбора данных по всем пользователям.

// === КНОПКА: массовое сохранение хронологии в API ===
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID', 'ForumInfo'])) {
    console.warn('[button_update_chrono_api] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID = (window.CHRONO_CHECK.AmsForumID).map(String);
  const TID = String(window.CHRONO_CHECK.ChronoTopicID).trim();
  const SECTIONS = window.CHRONO_CHECK.ForumInfo;

  if (!window.FMV) window.FMV = {};

  /** ============================
   *  Валидации окружения
   *  ============================ */
  function requireFn(name) {
    const fn = getByPath(name);
    if (typeof fn !== "function") {
      throw new Error(`${name} не найден — подключите соответствующий скрипт`);
    }
    return fn;
  }
  function getByPath(path) {
    return path.split(".").reduce((o, k) => o && o[k], window);
  }

  /** ============================
   *  Точечное сохранение данных одного пользователя через API
   *  ВАЖНО: Сначала GET, затем частичное обновление chrono + last_timestamp
   *  ============================ */
  /**
  * @param {string|number} userId
  * @param {Object} chronoData - данные хронологии для этого пользователя
  * @returns {Promise<{id:string,status:string}>}
  */
  async function saveChronoToApi(userId, chronoData) {
    const FMVbankStorageGet = requireFn("FMVbank.storageGet");
    const FMVbankStorageSet = requireFn("FMVbank.storageSet");

    const id = String(userId);

    // Проверяем данные
    if (!chronoData || typeof chronoData !== 'object') {
      return { id, status: "нет данных для сохранения" };
    }

    try {
      // ШАГ 1: Сначала получаем текущие данные из API (единый объект chrono_)
      const currentData = await FMVbankStorageGet(Number(id), 'chrono_');

      // Если данных нет, создаём пустой объект
      const baseData = currentData && typeof currentData === 'object' ? currentData : {};

      // ШАГ 2: Обновляем ТОЛЬКО chrono и last_timestamp, всё остальное НЕ ТРОГАЕМ!
      baseData.chrono = chronoData;
      baseData.last_timestamp = Math.floor(Date.now() / 1000);

      // ШАГ 3: Сохраняем весь объект обратно (с сохранением всех остальных полей как есть)
      const res = await FMVbankStorageSet(baseData, Number(id), 'chrono_');

      const saved = normalizeSaveStatus(res);
      return { id, status: saved };
    } catch (e) {
      return { id, status: `ошибка сохранения: ${e?.message || e}` };
    }
  };

  /** ============================
   *  Массовое обновление
   *  ============================ */
  /**
  * @param {Object} [opts]
  * @param {Array<string|number>} [opts.ids] — явный список id; если не задан, будет вызван FMV.fetchUsers()
  * @param {number} [opts.delayMs=200] — пауза между сохранениями
  * @param {Array} [opts.sections]
  * @returns {Promise<Array<{id:string,status:string}>>}
  */
  async function runBulkChronoApiUpdate(opts = {}) {
    const delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : 200;
    const collectChronoByUser = requireFn("collectChronoByUser");

    // Источник секций (не обязательно)
    const sectionsArg = opts.sections;

    // 1) Собираем хронологию по всем пользователям один раз
    let byUser;
    try {
      byUser = await collectChronoByUser({ sections: sectionsArg });
    } catch (e) {
      throw new Error(`Ошибка collectChronoByUser: ${e?.message || e}`);
    }

    if (!byUser || typeof byUser !== 'object') {
      throw new Error('collectChronoByUser вернул пустой результат');
    }

    // 2) Источник пользователей
    let users;
    if (Array.isArray(opts.ids) && opts.ids.length) {
      users = opts.ids.map(x => ({ id: String(x) }));
    } else {
      // Берём всех пользователей из собранных данных
      users = Object.keys(byUser).map(id => ({ id: String(id) }));
    }

    const results = [];
    for (const u of users) {
      const data = byUser[u.id];
      if (!data) {
        results.push({ id: u.id, status: "нет данных (пользователь не найден в хроно-коллекции)" });
        continue;
      }

      const r = await saveChronoToApi(u.id, data);
      results.push(r);
      if (delayMs) await FMV.sleep(delayMs);
    }
    try { console.table(results.map(x => ({ id: x.id, status: x.status }))); } catch { }
    return results;
  };

  /** ============================
   *  Вспомогательные
   *  ============================ */
  function normalizeSaveStatus(res) {
    // res от FMVbank.storageSet — это boolean
    if (res === true) return "сохранено";
    if (res === false) return "ошибка сохранения";
    return String(res);
  }

  // Хелперы ссылок/экрановки
  if (typeof window.userLinkHtml !== 'function') {
    window.userLinkHtml = (id, name) =>
      `${FMV.escapeHtml(String(name || id))}`;
  }

  // Получаем карту имен для красивых ссылок
  async function getUserNameMap(explicitIds) {
    const fetchUsers = (window.FMV && typeof FMV.fetchUsers === 'function') ? FMV.fetchUsers : null;
    let list = [];
    if (Array.isArray(explicitIds) && explicitIds.length) {
      list = explicitIds.map(x => ({ id: String(x) }));
    } else if (fetchUsers) {
      try {
        const arr = await fetchUsers();
        list = Array.isArray(arr) ? arr : [];
      } catch { /* no-op */ }
    }
    const map = new Map();
    for (const u of list) {
      if (!u) continue;
      const id = String(u.id ?? '');
      const nm = String(u.name ?? '').trim();
      if (id) map.set(id, nm || id);
    }
    return map;
  }

  function normalizeInfoStatus(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('ошибка сохранения')) return 'ошибка сохранения';
    if (s.includes('нет данных') || s.includes('не найден')) return 'пользователь не упоминается в хронологии';
    return ''; // не интересует для "Показать детали"
  }

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'Сохранить хронологию в API',
    order: 5,
    showStatus: true,
    showDetails: true,
    showLink: false,

    async onClick(api) {
      const setStatus = api?.setStatus || (() => { });
      const setDetails = api?.setDetails || (() => { });

      setDetails('');
      try {
        // Этап 1: сбор подготовительных данных
        setStatus('Собираю…');

        const explicitIds = Array.isArray(window.CHRONO_CHECK?.UserIDs) ? window.CHRONO_CHECK.UserIDs : undefined;
        const nameMap = await getUserNameMap(explicitIds);

        // Этап 2: массовое сохранение в API
        setStatus('Сохраняю…');

        const results = await runBulkChronoApiUpdate({
          ids: explicitIds,
          sections: SECTIONS
        }); // вернёт [{ id, status }]

        // Пост-обработка результатов
        const lines = [];
        for (const r of (results || [])) {
          const info = normalizeInfoStatus(r?.status);
          if (!info) continue; // нас интересуют только проблемные
          const id = String(r?.id || '');
          const name = nameMap.get(id) || id;
          lines.push(`${userLinkHtml(id, name)} — ${FMV.escapeHtml(info)}`);
        }

        // Если сам вызов отработал — это «Готово»
        setStatus('✓ готово', 'green');
        setDetails(lines.length ? lines.join('<br>') : ''); // пусто — если нет проблемных юзеров
      } catch (e) {
        setStatus('✖ ошибка', 'red');
        setDetails(e?.message || String(e));
      }
    }
  });
})();

/* Episodes */
// ui.js — FMV: виджет участников/масок/локации/порядка + автоподключение + ручной режим для админов
(function(){
  'use strict';

  // ───────────────────── helpers-конфиг ─────────────────────
  // ожидаем, что check_group.js уже подключен и экспортирует getCurrentGroupId / getCurrentUserId
  function isAllowedAdmin(){
    const groups = (window.CHRONO_CHECK?.GroupID || []).map(String);
    const users  = (window.CHRONO_CHECK?.AllowedUser || []).map(String);
    const gid = (typeof window.getCurrentGroupId === 'function') ? String(window.getCurrentGroupId()) : '';
    const uid = (typeof window.getCurrentUserId === 'function') ? String(window.getCurrentUserId()) : '';
    return (gid && groups.includes(gid)) || (uid && users.includes(uid));
  }

  if (!window.FMV) window.FMV = {};
  if (!window.FMV.fetchUsers) {
    console.warn('[FMV] Подключите общий модуль с FMV.fetchUsers до ui.js');
  }

  // ───────────────────── UI-модуль ─────────────────────
  if (!window.FMV.UI) {
    (function(){
      // mini utils
      function splitBySemicolon(s){
        return String(s || '').split(';').map(v => v.trim()).filter(Boolean);
      }
      function parseFMVcast(text){
        const mc = String(text || '').match(/\[FMVcast\]([\s\S]*?)\[\/FMVcast\]/i);
        const items = mc && mc[1] ? splitBySemicolon(mc[1]) : [];
        const by = {};
        items.forEach(tok => {
          const m = tok.match(/^(user\d+)(?:=(.+))?$/i);
          if (!m) return;
          const code = m[1];
          const mask = (m[2] || '').trim();
          const ref = by[code] || (by[code] = { code, masks: [] });
          if (mask) ref.masks.push(mask);
        });
        return by;
      }
      function buildFMVcast(selected){
        const parts = [];
        (selected || []).forEach(it => {
          const masks = Array.isArray(it.masks) ? it.masks.filter(Boolean) : [];
          if (!masks.length) parts.push(it.code);
          else masks.forEach(msk => parts.push(it.code + '=' + msk));
        });
        return parts.length ? '[FMVcast]' + parts.join(';') + '[/FMVcast]' : '';
      }
      function buildFMVplace(val){
        val = String(val || '').trim();
        return val ? '[FMVplace]' + val + '[/FMVplace]' : '';
      }
      function buildFMVord(val){
        let n = parseInt(String(val||'').trim(), 10);
        if (Number.isNaN(n)) n = 0;
        return '[FMVord]' + n + '[/FMVord]';
      }
      function stripFMV(text){
        return String(text || '')
          .replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig,'')
          .replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig,'')
          .replace(/\[FMVord\][\s\S]*?\[\/FMVord\]/ig,'')
          .replace(/^\s+|\s+$/g,'');
      }

      // CSS (с защитой от переполнения по ширине)
      let cssInjected = false;
      function injectCSS(){
        if (cssInjected) return; cssInjected = true;
        const css = `
        :root{
          --fmv-bg:#f7f4ea; --fmv-b:#d8d1c3; --fmv-chip:#fff;
          --fmv-radius:10px; --fmv-gap:8px; --fmv-text:#2d2a26; --fmv-muted:#6b6359;
        }

        .msg-with-characters.fmv,
        .msg-with-characters.fmv * { box-sizing: border-box; }
        .msg-with-characters.fmv { width:100%; max-width:100%; overflow-x:hidden; }

        .msg-with-characters.fmv{margin:10px 0; padding:10px; border:1px solid var(--fmv-b); background:var(--fmv-bg); border-radius:var(--fmv-radius)}
        .fmv .char-row{display:flex; gap:var(--fmv-gap); align-items:flex-start; flex-wrap:wrap}
        .fmv .combo{position:relative; flex:1 1 480px; width:100%; max-width:100%}
        .fmv .combo input,
        .fmv .place-row input,
        .fmv .order-row input{
          width:100%; max-width:100%; height:36px;
          padding:8px 10px; border:1px solid var(--fmv-b); border-radius:8px;
          background:#efe9dc; color:var(--fmv-text); font-size:14px;
        }
        .fmv .place-row,.fmv .order-row{margin-top:8px; width:100%; max-width:100%}
        .fmv .order-row label{display:block; margin-bottom:4px; font-weight:600; color:var(--fmv-text)}
        .fmv .order-hint,.fmv .hint{font-size:12.5px; color:var(--fmv-muted); margin-top:4px; overflow-wrap:anywhere}

        .fmv .ac-list{
          position:absolute; z-index:50; left:0; right:0; max-width:100%; background:#fff;
          border:1px solid var(--fmv-b); border-radius:8px; margin-top:4px; max-height:240px; overflow:auto
        }
        .fmv .ac-item{padding:.45em .65em; cursor:pointer; font-size:14px}
        .fmv .ac-item.active,.fmv .ac-item:hover{background:#f0efe9}
        .fmv .ac-item .muted{color:var(--fmv-muted)}

        .fmv .chips{ max-width:100%; overflow-x:hidden; }
        .fmv .chips .chip{
          display:flex; align-items:center; justify-content:flex-start;
          gap:10px; padding:.45em .6em; background:var(--fmv-chip);
          border:1px solid var(--fmv-b); border-radius:8px; margin:.35em 0; font-size:14px
        }
        .fmv .chip .drag{cursor:grab; margin-right:.4em; color:#8b8378}
        .fmv .chip .name{font-weight:600}

        .fmv .masks{display:flex; align-items:center; gap:6px; flex-wrap:wrap; color:var(--fmv-muted)}
        .fmv .masks .masks-label{ color:var(--fmv-muted); margin-right:2px; }
        .fmv .mask-badge{
          display:inline-flex; align-items:center; gap:6px;
          padding:2px 8px; border:1px solid var(--fmv-b); border-radius:999px;
          background:#efe9dc; font-size:13px; color:var(--fmv-text);
        }
        .fmv .mask-badge .mask-remove{
          border:0; background:none; cursor:pointer; line-height:1;
          color:#8b8378; font-size:14px; padding:0 2px;
        }

        .fmv .chip .add-mask{border:0; background:none; color:#2e5aac; cursor:pointer; padding:0; text-decoration:underline; margin-left:auto}
        .fmv .chip .x{border:0; background:none; font-size:16px; line-height:1; cursor:pointer; color:#8b8378; margin-left:8px}

        .fmv .chip .mask-input{ display:none; margin-left:auto; }
        .fmv .chip .mask-input.is-open{ display:flex; align-items:center; gap:8px; }
        .fmv .chip .mask-input input{
          flex:1; min-width:220px; height:30px;
          padding:6px 8px; border:1px solid var(--fmv-b); border-radius:6px;
          background:#efe9dc; color:var(--fmv-text);
        }
        .fmv .chip .btn{ border:1px solid var(--fmv-b); border-radius:6px; background:#fff; padding:6px 10px; cursor:pointer; line-height:1; }
        .fmv .chip .btn-ok{ background:#e9f6e9; }
        .fmv .chip .btn-cancel{ background:#f4eeee; }

        .fmv-admin-tools{display:flex;justify-content:flex-end;margin:6px 0 8px}
        .fmv-admin-tools .fmv-toggle{border:1px solid var(--fmv-b);background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}

        /* заголовок блока */
        .fmv .section-title{
          font-weight:700;
          font-size:14px;
          text-align: center;
          line-height:1.25;
          margin:4px 0 12px;
          color: var(--fmv-text);
        }

        /* делаем «колонку» с равным шагом и без внутренних margin */
        .fmv .combo,
        .fmv .place-row,
        .fmv .order-row {
          display: grid;
          grid-template-columns: 1fr;
          row-gap: 8px;             /* вот этим управляем расстоянием между label ↔ input ↔ hint */
        }
        
        .fmv .place-row label,
        .fmv .order-row label,
        .fmv .combo label,
        .fmv .place-row .hint,
        .fmv .order-row .order-hint,
        .fmv .combo .hint {
          margin: 0;                /* убираем наследованные отступы, чтобы они не «схлопывались» */
        }
        
        /* (оставляем общий верхний зазор секции) */
        .fmv .place-row, .fmv .order-row { margin-top: 8px; }

        .fmv .chip .name { font-weight: 600; }
        .fmv .chip .name .name-code { font-weight: 400; color: var(--fmv-muted); }

        `;
        const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
      }

      function attach(opts){
        injectCSS();

        const $form = typeof opts.form === 'string' ? $(opts.form) : opts.form;
        const $area = typeof opts.textarea === 'string' ? $(opts.textarea) : opts.textarea;
        if (!$form?.length || !$area?.length) return null;

        // исходный текст и решение "монтироваться ли"
        const initialRaw = $area.val() || '';
        const hasAnyFMV = /\[FMV(?:cast|place|ord)\][\s\S]*?\[\/FMV(?:cast|place|ord)\]/i.test(initialRaw);
        if (opts.showOnlyIfFMVcast && !hasAnyFMV) return null;

        // мгновенно скрываем мету в textarea (edit)
        if (opts.stripOnMount) {
          $area.val( stripFMV(initialRaw) );
        }

        if ($form.data('fmvBoundUI')) return $form.data('fmvBoundUI');

        // ── UI ──
        const wrapClass='msg-with-characters fmv '+(opts.className||'');
        const $wrap=$('<div/>',{class:wrapClass});
        const $title = $('<div class="section-title">Для автоматического сбора хронологии</div>');

        // поиск/добавление участника
        const $row  = $('<div class="char-row"/>');
        const $combo = $('<div class="combo"/>');
        const $comboLabel = $('<label for="character-combo" style="font-weight:600;display:block;margin-bottom:4px">Участники эпизода:</label>');
        const $comboInput = $('<input type="text" id="character-combo" placeholder="Наберите имя персонажа…" autocomplete="off">');
        const $ac   = $('<div class="ac-list" role="listbox" aria-label="Варианты персонажей"></div>');
        const $comboHint = $('<div class="hint">Если что-то не работает, напишите в Приемную.</div>');
        $combo.append($comboLabel, $comboInput, $ac, $comboHint);
        $row.append($combo);

        const $chips=$('<div class="chips"/>');

        // локация
        const $placeRow   = $('<div class="place-row"/>');
        const $placeLabel = $('<label for="fmv-place" style="font-weight:600">Локация:</label>');
        const $placeInput = $('<input type="text" id="fmv-place" placeholder="Укажите локацию">');
        const $placeHint  = $('<div class="hint">Лучше указывать в едином формате: Хогвартс, Косой переулок, Лютный переулок, Министерство и т.д.</div>');
        $placeRow.append($placeLabel, $placeInput, $placeHint);

        // порядок в день
        const $ordRow   = $('<div class="order-row"/>');
        const $ordLabel = $('<label for="fmv-ord" style="font-weight:600">Для сортировки эпизодов в один день</label>');
        const $ordInput = $('<input type="number" id="fmv-ord" placeholder="0" value="0" step="1">');
        const $ordHint  = $('<div class="order-hint">Помогает упорядочить эпизоды, которые стоят в один день. Чем больше значение, тем позже эпизод. Лучше оставлять 0.</div>');
        $ordRow.append($ordLabel, $ordInput, $ordHint);

        $area.before($wrap);
        $wrap.append($title, $row, $chips, $placeRow, $ordRow);

        let selected=[], knownUsers=[];

        function renderChips(){
          $chips.empty();
          selected.forEach(function(item, idx){
            const $chip=$('<div class="chip" draggable="true" data-idx="'+idx+'"/>');
            $chip.append('<span class="drag" title="Перетащите для изменения порядка">↕</span>');
            
            const $name = $('<span class="name"/>');
            $name.append(document.createTextNode(item.name + ' '));
            $name.append($('<span class="name-code"/>').text('(' + item.code + ')'));
            $chip.append($name);


            const $masks=$('<span class="masks"/>');
            if (item.masks?.length){
              $masks.append('<span class="masks-label">— маски:</span>');
              item.masks.forEach(function(msk,mi){
                const $b=$('<span class="mask-badge" data-mi="'+mi+'"><span class="mask-text"></span><button type="button" class="mask-remove" aria-label="Удалить маску">×</button></span>');
                $b.find('.mask-text').text(msk); $masks.append($b);
              });
            } else { $masks.text(' — масок нет'); }

            const $addMask=$('<button class="add-mask" type="button">добавить маску</button>');
            const $remove =$('<button class="x" type="button" aria-label="Удалить">×</button>');
            const $maskBox=$('<span class="mask-input"></span>').hide();
            const $maskInput=$('<input type="text" placeholder="маска (текст)">');
            const $maskOk  =$('<button type="button" class="btn btn-ok">Ок</button>');
            const $maskCancel=$('<button type="button" class="btn btn-cancel">Отмена</button>');
            $maskBox.append($maskInput,$maskOk,$maskCancel);

            $maskInput.on('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); $maskOk.click(); }});
            $addMask.on('click',()=>{ $chip.find('.mask-input').removeClass('is-open').hide(); $maskBox.addClass('is-open').show(); $maskInput.val('').focus(); });
            $maskOk.on('click',()=>{ const v=$.trim($maskInput.val()); if(!v) return; (item.masks||(item.masks=[])).push(v); renderChips(); });
            $maskCancel.on('click',()=>{ $maskBox.removeClass('is-open').hide(); });

            $remove.on('click',()=>{ selected.splice(idx,1); renderChips(); });

            $chip.append($masks,$addMask,$maskBox,$remove);
            $chips.append($chip);
          });
        }

        // DnD
        $chips.on('dragstart','.chip',function(e){ $(this).addClass('dragging'); e.originalEvent.dataTransfer.setData('text/plain',$(this).data('idx')); });
        $chips.on('dragend','.chip',function(){ $(this).removeClass('dragging'); });
        $chips.on('dragover',function(e){ e.preventDefault(); });
        $chips.on('drop',function(e){
          e.preventDefault();
          const from=+e.originalEvent.dataTransfer.getData('text/plain');
          const $t=$(e.target).closest('.chip'); if(!$t.length) return;
          const to=+$t.data('idx'); if(isNaN(from)||isNaN(to)||from===to) return;
          const it=selected.splice(from,1)[0]; selected.splice(to,0,it); renderChips();
        });
        // удалить одну маску
        $chips.on('click','.mask-remove',function(){
          const $chip=$(this).closest('.chip'); const idx=+$chip.data('idx'); const mi=+$(this).closest('.mask-badge').data('mi');
          if(!isNaN(idx)&&!isNaN(mi)&&Array.isArray(selected[idx].masks)){ selected[idx].masks.splice(mi,1); renderChips(); }
        });

        // добавление участника
        function addByCode(code){
          if(!code || selected.some(x=>x.code===code)) return;
          const u=knownUsers.find(x=>x.code===code);
          selected.push({ code, name:(u?u.name:code), masks:[] });
          renderChips(); $comboInput.val(''); $ac.hide().empty();
        }
        // поиск
        function pickByInput(){
          const q=($.trim($comboInput.val())||'').toLowerCase(); if(!q) return null;
          const pool=knownUsers.filter(u=>!selected.some(x=>x.code===u.code));
          const exact=pool.find(u=>u.name.toLowerCase()===q)||pool.find(u=>u.code.toLowerCase()===q);
          if(exact) return exact.code;
          const list=pool.filter(u=>u.name.toLowerCase().includes(q)||u.code.toLowerCase().includes(q));
          if(list.length===1) return list[0].code;
          const pref=list.filter(u=>u.name.toLowerCase().startsWith(q));
          if(pref.length===1) return pref[0].code;
          return null;
        }
        // автокомплит
        function renderAC(q){
          const qq=(q||'').trim().toLowerCase();
          const items=knownUsers
            .filter(u=>!selected.some(x=>x.code===u.code))
            .filter(u=>!qq || u.name.toLowerCase().includes(qq) || u.code.toLowerCase().includes(qq))
            .slice().sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));
          $ac.empty();
          if(!items.length){ $ac.append('<div class="ac-item"><span class="muted">Ничего не найдено</span></div>').show(); return; }
          items.slice(0,40).forEach(u=>{ $ac.append($('<div class="ac-item" role="option"/>').attr('data-code',u.code).text(u.name+' ('+u.code+')')); });
          $ac.show(); setActive(0);
        }
        function setActive(i){ const $it=$ac.children('.ac-item'); $it.removeClass('active'); if(!$it.length) return; i=(i+$it.length)%$it.length; $it.eq(i).addClass('active'); $ac.data('activeIndex',i); }
        function getActiveCode(){ const i=$ac.data('activeIndex')|0; const $it=$ac.children('.ac-item').eq(i); return $it.data('code'); }
        $comboInput.on('input',function(){ renderAC(this.value); });
        $comboInput.on('keydown',function(e){
          const idx=$ac.data('activeIndex')|0;
          if(e.key==='ArrowDown'&&$ac.is(':visible')){ e.preventDefault(); setActive(idx+1); }
          else if(e.key==='ArrowUp'&&$ac.is(':visible')){ e.preventDefault(); setActive(idx-1); }
          else if(e.key==='Enter'){ e.preventDefault(); const code=$ac.is(':visible')?getActiveCode():pickByInput(); if(code) addByCode(code); else renderAC(this.value); }
          else if(e.key==='Escape'){ $ac.hide(); }
        });
        $ac.on('mousedown','.ac-item',function(){ const code=$(this).data('code'); if(code) addByCode(code); });
        $(document).on('click',function(e){ if(!$(e.target).closest($combo).length) $ac.hide(); });

        // префилл
        function prefillFrom(text){
          selected=[]; const by=parseFMVcast(text||'');
          const mp=String(text||'').match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i);
          if(mp && typeof mp[1]==='string') $placeInput.val(mp[1].trim());
          const mo=String(text||'').match(/\[FMVord\]([\s\S]*?)\[\/FMVord\]/i);
          if(mo && typeof mo[1]==='string'){ let n=parseInt(mo[1].trim(),10); if(Number.isNaN(n)) n=0; $ordInput.val(n); }
          Object.keys(by).forEach(code=>{ const u=knownUsers.find(x=>x.code===code); selected.push({ code, name:(u?u.name:code), masks:by[code].masks }); });
          renderChips();
        }
        function metaLine(){ return [buildFMVcast(selected), buildFMVplace($placeInput.val()), buildFMVord($ordInput.val())].filter(Boolean).join(''); }

        // загрузка участников и префилл
        if (typeof FMV.fetchUsers==='function'){
          FMV.fetchUsers().then(function(list){
            knownUsers=(list||[]).slice();
            if (opts.prefill!==false) prefillFrom(initialRaw);
          }).catch(function(msg){
            $ac.html('<div class="ac-item"><span class="muted">'+(msg||'Ошибка загрузки')+'</span></div>').show();
          });
        }

        // submit-hook (alert вместо блока ошибки; глушим другие обработчики)
        $form.off('submit.fmv.ui').on('submit.fmv.ui', function(e){
          const $subject=$form.find('input[name="req_subject"]');
          const haveSubject=!$subject.length || $.trim($subject.val()||'').length>0;

          const rest=stripFMV($area.val()||'');
          const haveMessage=$.trim(rest).length>0;

          const haveParticipants=selected.length>0;
          const havePlace=$.trim($placeInput.val()||'').length>0;

          if(!(haveSubject && haveMessage && haveParticipants && havePlace)){
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const miss=[]; if(!haveSubject)miss.push('Заголовок'); if(!haveMessage)miss.push('Основной текст'); if(!haveParticipants)miss.push('Участники'); if(!havePlace)miss.push('Локация');
            alert('Заполните: ' + miss.join(', '));
            return false;
          }

          const meta = metaLine();
          let base = rest.replace(/[ \t]+$/, '');
          const sep = (!base || /\n$/.test(base)) ? '' : '\n';
          $area.val(base + sep + meta);
        });

        // ── admin toggle (ручной режим) — создаём один раз и переиспользуем ──
        if (isAllowedAdmin()) {
          // ищем/создаём один общий контейнер для этой формы
          let $tools = $form.data('fmvAdminTools');
          if (!$tools || !$tools.length) {
            $tools = $(
              '<div class="fmv-admin-tools">' +
                '<button type="button" class="fmv-toggle">Режим ручного редактирования</button>' +
              '</div>'
            );
            $form.data('fmvAdminTools', $tools);
          }
          // размещаем кнопку перед текущим $wrap
          $wrap.before($tools);
        
          const $btn = $tools.find('.fmv-toggle');
        
          // важно: каждый раз при новом attach() снимаем старый обработчик
          $btn.off('click.fmv');
        
          const toRaw = () => {
            const meta = [buildFMVcast(selected), buildFMVplace($placeInput.val()), buildFMVord($ordInput.val())]
              .filter(Boolean).join('');
            const base = stripFMV($area.val() || '').replace(/[ \t]+$/, '');
            const sep  = (!base || /\n$/.test(base)) ? '' : '\n';
            $area.val(base + (meta ? sep + meta : ''));
        
            // удаляем только UI и наш сабмит-хук, кнопку НЕ трогаем
            $wrap.remove();
            $form.off('submit.fmv.ui').removeData('fmvBoundUI');
        
            $btn.data('raw', true).text('Вернуться к удобной форме');
          };
        
          const toUI = () => {
            // повторно монтируем UI; внутри attach() этот же блок снова
            // привяжет обработчик к той же кнопке, но уже с новыми замыканиями
            FMV.UI.attach({
              form: $form,
              textarea: $area,
              prefill: true,
              showOnlyIfFMVcast: false,
              className: 'fmv--compact',
              stripOnMount: true
            });
            $btn.data('raw', false).text('Режим ручного редактирования');
          };
        
          // биндим актуальный обработчик для ТЕКУЩЕГО $wrap
          $btn.on('click.fmv', () => ($btn.data('raw') ? toUI() : toRaw()));
        }

        const api={ serialize:()=>[buildFMVcast(selected), buildFMVplace($placeInput.val()), buildFMVord($ordInput.val())].filter(Boolean).join(''),
                    stripFMV, mountPoint:$wrap };
        $form.data('fmvBoundUI',api);
        return api;
      }

      window.FMV.UI = { attach };
    })();
  }

  // ───────────────────── Bootstraps (автоподключение) ─────────────────────
  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  onReady(function(){
    // защита от повторного монтирования
    if (window.__FMV_BOOTSTRAPPED__) return;
    window.__FMV_BOOTSTRAPPED__ = true;

    if (!FMV.UI || typeof FMV.UI.attach !== 'function') return;

    const url  = new URL(location.href);
    const path = url.pathname;
    const q    = url.searchParams;

    function attachToPage({ strip=false, showOnlyIfCast=false } = {}){
      const $form = $('#post form, form[action*="post.php"], form[action*="edit.php"]').first();
      const $area = $form.find('textarea[name="req_message"], #main-reply, .questionary-post textarea').first();
      if (!$form.length || !$area.length) return null;
      return FMV.UI.attach({
        form: $form,
        textarea: $area,
        prefill: true,
        showOnlyIfFMVcast: !!showOnlyIfCast, // ← «любой FMV-тег»
        className: 'fmv--compact',
        stripOnMount: !!strip
      });
    }

    // /post.php?fid=N без action (старое создание)
    if (/\/post\.php$/i.test(path) && !q.has('action')) {
      const fid = +(q.get('fid')||0);
      const allowed = (window.CHRONO_CHECK?.ForumID || []).map(Number);
      if (allowed.includes(fid)) attachToPage({ strip:false, showOnlyIfCast:false });
    }

    // /edit.php?topicpost=1 (редактирование первого поста) — только если есть FMV-теги
    // if (/\/edit\.php$/i.test(path) && q.get('topicpost') === '1') {
    //   attachToPage({ strip:true, showOnlyIfCast:true });
    // }

    // /post.php?action=post&fid=8 — создание, UI всегда (с очисткой textarea)
    if (/\/post\.php$/i.test(path) && q.get('action') === 'post') {
      // 🚫 не подключаем UI если открыто «ответить в теме» (есть tid)
      if (q.has('tid')) return;
    
      const fid = Number(q.get('fid'));
      const allowed = (window.CHRONO_CHECK?.ForumID || []).map(Number);
      if (!fid || allowed.includes(fid)) {
        attachToPage({ strip: true, showOnlyIfCast: false });
      }
    }

    // /edit.php?id=N&action=edit — только если есть любые FMV-теги
    if (/\/edit\.php$/i.test(path) && q.has('id') && document.querySelector('input[name="firstpost"]')) {
      const link = document.querySelector('.container.crumbs a:nth-of-type(2)');
      if (link && link.href.includes('/viewforum.php?id=') && link.href.split('/viewforum.php?id=').length >= 2) {
        const fid = Number(link.href.split('/viewforum.php?id=')[1]);
        const allowed = (window.CHRONO_CHECK?.ForumID || []).map(Number);
       if (allowed.includes(fid)) attachToPage({ strip:true, showOnlyIfCast:false });
      }
    }
  });

})();
// tags_visibility_button.init.js
(() => {
  'use strict';

  // ----- настройки кнопки -----
  const BUTTON_LABEL = 'Показать скрытые теги';
  const BUTTON_ORDER = 1;

  // ----- утилиты -----
  async function waitFor(fn, { timeout = 10000, interval = 100 } = {}) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      try { const v = fn(); if (v) return v; } catch {}
      await FMV.sleep(interval);
    }
    return null;
  }

  function topicKey() {
    try {
      const u = new URL(location.href);
      const id = u.searchParams.get('id') || u.searchParams.get('tid') || '';
      return `fmv:meta:enabled:${id || u.pathname}`;
    } catch {
      return `fmv:meta:enabled:${location.href}`;
    }
  }

  function injectStyleOnce() {
    if (document.getElementById('fmv-meta-style')) return;
    const style = document.createElement('style');
    style.id = 'fmv-meta-style';
    style.textContent = `
      .fmv-meta{
        margin:8px 0; padding:8px; border:1px solid #d7d7d7;
        background:#f7f7f7; border-radius:6px;
      }
      .fmv-row{margin:.25em 0}
      .fmv-label{font-weight:700;margin-right:.25em}
      .fmv-missing{color:#c00;background:#ffe6e6;border-radius:6px;padding:0 .25em;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  // найти контейнер именно этой кнопки
  function findOwnWrap() {
    const container = document.querySelector('.ams_info');
    if (!container) return null;
    return Array.from(container.querySelectorAll('div[data-order]')).find(el => {
      const btn = el.querySelector('button.button');
      return Number(el.dataset.order) === BUTTON_ORDER &&
             btn && btn.textContent.trim() === BUTTON_LABEL;
    }) || null;
  }

  // ---- рендер участников через profileLinkMeta (подсветка не найденных) ----
  function renderParticipantsWithMeta(rawChars, map) {
    const parsed = FMV.parseCharactersUnified(rawChars);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    const parts = items.map((it) => {
      const id = it?.id != null ? String(it.id) : null;
      const knownName = id ? (map.get(id) || null) : null;

      // используем обновлённый profile_from_user
      let headHtml;
      if (id) {
        const meta = (typeof window.profileLinkMeta === 'function')
          ? window.profileLinkMeta(id, knownName)
          : { html: window.profileLink(id, knownName), found: !!knownName };

        if (meta.found) {
          headHtml = meta.html;
        } else {
          const rawText = it?.text ?? knownName ?? `user${id}`;
          headHtml = `<span class="fmv-missing">${FMV.escapeHtml(String(rawText))}</span>`;
        }
      } else {
        const rawText = it?.text ?? it?.name ?? it?.label ?? '';
        headHtml = `<span class="fmv-missing">${FMV.escapeHtml(String(rawText))}</span>`;
      }

      const masks = Array.isArray(it?.masks) && it.masks.length
        ? ` [${it.masks.join(', ')}]`
        : '';
      return headHtml + masks;
    });

    return parts.join('; ');
  }

  // ----- сбор данных и построение блока -----
  async function buildMetaHtml() {
    const ok = await waitFor(() =>
      window.FMV &&
      typeof FMV.readTagText === 'function' &&
      typeof FMV.escapeHtml === 'function' &&
      typeof FMV.parseOrderStrict === 'function' &&
      typeof FMV.buildIdToNameMapFromTags === 'function' &&
      typeof FMV.parseCharactersUnified === 'function' &&
      typeof window.profileLink === 'function'
    , { timeout: 15000 });
    if (!ok) return null;

    const first = await waitFor(() =>
      document.querySelector('.topic .post.topicpost, .post.topicpost, .message:first-of-type')
    , { timeout: 15000 });
    if (!first) return null;

    const group_ids = window.CHRONO_CHECK?.GroupID || [];

    if (typeof window.ensureAllowed === 'function' && !window.ensureAllowed(group_ids)) return null;

    const rawChars = FMV.readTagText(first, 'characters');
    const rawLoc   = FMV.readTagText(first, 'location');
    const rawOrder = FMV.readTagText(first, 'order');

    const map = await FMV.buildIdToNameMapFromTags(rawChars);
    const parts = [];

    if (rawChars) {
      const participantsHtml = FMV.renderParticipantsHtml(
        rawChars,
        map,
        (id, name) => window.profileLink(id, name) // profileLink вернёт <span class="fmv-missing">…</span> если не найден
      );

      parts.push(`<div class="fmv-row"><span class="fmv-label">Участники:</span>${participantsHtml}</div>`);
    }
    if (rawLoc) {
      parts.push(`<div class="fmv-row"><span class="fmv-label">Локация:</span>${FMV.escapeHtml(rawLoc)}</div>`);
    }
    if (rawOrder) {
      const ord = FMV.parseOrderStrict(rawOrder);
      parts.push(`<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${ord.html}</div>`);
    }

    if (!parts.length) return null;

    injectStyleOnce();
    const block = document.createElement('div');
    block.className = 'fmv-meta';
    block.innerHTML = parts.join('\n');
    return block;
  }

  function isMounted() {
    const wrap = findOwnWrap();
    const next = wrap?.nextElementSibling;
    return !!(next && next.classList.contains('fmv-meta'));
  }

  function unmountMetaBlock() {
    const wrap = findOwnWrap();
    const next = wrap?.nextElementSibling;
    if (next && next.classList.contains('fmv-meta')) next.remove();
  }

  async function mountMetaBlock() {
    const wrap = findOwnWrap();
    if (!wrap) return;
    unmountMetaBlock();                       // убираем старый
    const block = await buildMetaHtml();
    if (!block) return;
    wrap.parentNode.insertBefore(block, wrap.nextSibling);
  }

  // ----- кнопка-тумблер -----
  if (
    window.CHRONO_CHECK &&
    Array.isArray(window.CHRONO_CHECK.GroupID) &&
    Array.isArray(window.CHRONO_CHECK.ForumID)
  ) {
    createForumButton({
      allowedGroups: window.CHRONO_CHECK.GroupID,
      allowedForums: window.CHRONO_CHECK.ForumID,
      label: BUTTON_LABEL,
      order: BUTTON_ORDER,
      showStatus: false,
      showDetails: false,
      showLink: false,

      async onClick({ wrap }) {
        if (wrap.nextElementSibling?.classList.contains('fmv-meta')) {
          wrap.nextElementSibling.remove();
          localStorage.setItem('fmv:meta:enabled', '0');
        } else {
          const block = await buildMetaHtml();
          if (block) {
            wrap.parentNode.insertBefore(block, wrap.nextSibling);
            localStorage.setItem('fmv:meta:enabled', '1');
          }
        }
      }
    });
  } else {
    console.warn('[tags_visibility] Требуются CHRONO_CHECK.GroupID, ForumID');
  }


  // авто-восстановление состояния
  (async () => {
    if (localStorage.getItem(topicKey()) === '1' && !isMounted()) {
      await mountMetaBlock();
    }
  })();
})();
