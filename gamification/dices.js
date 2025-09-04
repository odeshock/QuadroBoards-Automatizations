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
