/* ----------------------------------------------------------- */
/* ЗАМЕНА ДЕФИСОВ, КОРОТКИХ ТИРЕ, МИНУСОВ НА ДЛИННОЕ ТИРЕ
   если:
   — стоит в начале строки+пробел
   — если отделено пробелами с двух сторон */
/* ----------------------------------------------------------- */

<script>
  $.fn.fixDashes = function () {
    // расширенные пробелы + BOM/ZWJ/ZWNJ
    var SPACE_CLASS = '[\\s\\u00A0\\u202F\\u2009\\u2002-\\u2008\\u200A\\u200B\\uFEFF\\u200C\\u200D]';
    var SPACE_RE = new RegExp(SPACE_CLASS);
    var ONLY_SPACES_RE = new RegExp('^' + SPACE_CLASS + '*$');
    function isSpace(ch){ return !!ch && SPACE_RE.test(ch); }
    function isBlankText(s){ return !s || ONLY_SPACES_RE.test(s); }
    function isDashish(ch){ return ch === '-' || ch === '\u2212' || (ch && ch >= '\u2010' && ch <= '\u2015'); }

    // локальные правила
    var RE_BETWEEN = new RegExp('(' + SPACE_CLASS + ')(?:-|[\\u2010-\\u2015]|\\u2212)(?=' + SPACE_CLASS + ')', 'g');
    // быстрый тест хвоста: ... ␠(dash)[␠]*
    var LEFT_TAIL_HINT = new RegExp(SPACE_CLASS + '(?:-|[\\u2010-\\u2015]|\\u2212)' + SPACE_CLASS + '*$');

    // блочные элементы — границы
    var BLOCK = {
      'ADDRESS':1,'ARTICLE':1,'ASIDE':1,'BLOCKQUOTE':1,'DIV':1,'DL':1,'DT':1,'DD':1,'FIELDSET':1,'FIGCAPTION':1,'FIGURE':1,
      'FOOTER':1,'FORM':1,'H1':1,'H2':1,'H3':1,'H4':1,'H5':1,'H6':1,'HEADER':1,'HR':1,'LI':1,'MAIN':1,'NAV':1,'OL':1,'P':1,'PRE':1,
      'SECTION':1,'TABLE':1,'THEAD':1,'TBODY':1,'TFOOT':1,'TR':1,'TD':1,'TH':1,'UL':1
    };
    var SKIP_TAG = { 'SCRIPT':1,'STYLE':1,'CODE':1,'PRE':1,'KBD':1,'SAMP':1 };

    function lastNonSpaceIdx(s){ for (var i=s.length-1;i>=0;i--) if (!isSpace(s.charAt(i))) return i; return -1; }
    function firstNonSpaceIdx(s){ for (var i=0;i<s.length;i++)   if (!isSpace(s.charAt(i))) return i; return -1; }

    function firstTextDesc(node){
      var stack=[node], n, c;
      while (stack.length){
        n = stack.shift();
        for (c = n.firstChild; c; c = c.nextSibling){
          if (c.nodeType === 3 && !isBlankText(c.nodeValue)) return c;
          if (c.nodeType === 1){
            var tag = c.nodeName.toUpperCase();
            if (SKIP_TAG[tag]) continue;
            stack.push(c);
          }
        }
      }
      return null;
    }

    function inQuoteBox(el){
      for (var n = el; n; n = n.parentNode){
        if (n.nodeType !== 1) continue;
        var cls = n.className || '';
        if (typeof cls === 'string' &&
            cls.indexOf('quote-box') !== -1 &&
            cls.indexOf('spoiler-box') !== -1 &&
            cls.indexOf('media-box') !== -1) return true;
      }
      return false;
    }

    function tryBoundary(prevText, rightText){
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
    function processScriptTemplate(scriptEl, processBlockFn){
      try {
        var type = (scriptEl.getAttribute('type') || '').toLowerCase();
        if (type !== 'text/html') return;

        var src = scriptEl.text || scriptEl.textContent || '';
        if (!src) return;

        var tmp = document.createElement('div');
        tmp.innerHTML = src;       // распарсили
        processBlockFn(tmp);       // применили правила
        var out = tmp.innerHTML;   // собрали

        scriptEl.text = out;       // для старых IE
        scriptEl.textContent = out;
      } catch (e) { /* noop */ }
    }

    function processBlock(root){
      var prevText = null;      // предыдущий НЕпустой текст-узел
      var gapHasSpace = false;  // между prev и текущим были «пустые» ноды с пробелами

      (function walk(node){
        for (var child=node.firstChild; child; child=child.nextSibling){
          if (child.nodeType === 3){
            var t = child.nodeValue;

            if (isBlankText(t)) { if (prevText) gapHasSpace = true; continue; }

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
          } else if (child.nodeType === 1){
            var tag = child.nodeName.toUpperCase();

            // особый случай: обрабатываем шаблоны внутри quote-box
            if (tag === 'SCRIPT' && inQuoteBox(child)) {
              processScriptTemplate(child, processBlock);
              prevText = null; gapHasSpace = false; continue;
            }

            if (SKIP_TAG[tag]) { prevText = null; gapHasSpace = false; continue; }
            if (tag === 'BR'){ prevText = null; gapHasSpace = false; continue; }

            if (BLOCK[tag] && child !== root){
              processBlock(child);        // отдельный блок — свой проход
              prevText = null; gapHasSpace = false;
            } else {
              // попытка склейки на границе prevText | первый текст внутри inline-узла
              if (prevText){
                var firstT = firstTextDesc(child);
                if (firstT) tryBoundary(prevText, firstT);
              }
              walk(child);
            }
          }
        }
      })(root);
    }

    return this.each(function(){ processBlock(this); });
  };

  // запуск
  $(function(){
    $('.post-content').fixDashes();
  });
</script>
