/* ============================================================================
 *  FMV — Автохронология
 *  Версия: 2.0 (переписано под конкретный форум)
 *  Что делает:
 *    • дорисовывает кнопку "Собрать хронологию" в конце #p82 .post-box
 *    • по клику собирает данные всех .post на странице
 *    • заменяет содержимое #p83-content оформленным списком
 *    • экспортирует window.FMV_buildChronology для ручного запуска из консоли
 *  Зависимости: нет (vanilla JS)
 *  Автор: вы + ваш будущий поклонник :) 
 * ============================================================================ */

(function () {
  'use strict';

  // ===== Конфиг =================================================================
  var CFG = {
    sourcePostId: 'p82',            // где рисуем кнопку
    targetPostId: 'p83',            // в какой пост пишем результат
    buttonText: 'Собрать хронологию',
    titleHTML: '<p><span style="display:block;text-align:center"><strong>Хронология</strong></span></p>',
    // Разметка строки. Можно править как угодно.
    rowTemplate: function (row) {
      // row: { num, time, href, author }
      return (
        '<li>' +
          '<span class="fmv-time">' + esc(row.time) + '</span>' +
          ' — ' +
          '<span class="fmv-author">' + esc(row.author) + '</span>' +
          ' — ' +
          '<a href="' + escAttr(row.href) + '">к посту #' + esc(row.num) + '</a>' +
        '</li>'
      );
    },
    // Вставить ли служебные стили компонента
    injectCSS: true,
  };

  // ===== Вспомогалки ============================================================
  var LOG = '[FMV chrono]';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function ready(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function escAttr(s) {
    // для href/src и т.п.
    return esc(String(s).replace(/"/g, '&quot;'));
  }

  function ensureStyles() {
    if (!CFG.injectCSS || $('#fmv-chrono-css')) return;
    var css = document.createElement('style');
    css.id = 'fmv-chrono-css';
    css.textContent =
      '.fmv-chrono-controls{margin-top:8px;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}' +
      '.fmv-chrono-note{font-size:90%;opacity:.8}' +
      '.fmv-chrono-list{margin:.5rem 0 0 1.25rem;padding:0}' +
      '.fmv-chrono-list li{margin:.25rem 0;line-height:1.35}' +
      '.fmv-chrono-list a{word-break:break-word;text-decoration:underline}' +
      '.fmv-time{font-variant-numeric:tabular-nums}' +
      '.fmv-author{font-weight:600}';
    document.head.appendChild(css);
  }

  function log() { try { console.log.apply(console, arguments); } catch (_) {} }

  // ===== Сбор данных по постам ==================================================
  function collectPosts() {
    var topicRoot = $('#pun-viewtopic') || document;
    var posts = $all('.post', topicRoot);
    if (!posts.length) return [];

    return posts.map(function (p) {
      var numEl = $('h3 strong', p);
      var link = $('a.permalink', p);
      var authEl = $('.pa-author a', p);

      var num = numEl ? numEl.textContent.trim() : '';
      var time = link ? link.textContent.trim() : '';
      var href = link ? link.href : ('#' + (p.id || ''));
      var author = authEl ? authEl.textContent.trim() : '';

      return { num: num, time: time, href: href, author: author };
    });
  }

  // ===== Построение HTML хронологии ============================================
  function renderChronologyHTML(rows) {
    var listHTML = rows.map(CFG.rowTemplate).join('');
    return (
      '<div class="fmv-chrono-wrap">' +
        CFG.titleHTML +
        '<ol class="fmv-chrono-list">' + listHTML + '</ol>' +
      '</div>'
    );
  }

  // ===== Вставка результата в target ===========================================
  function writeToTarget(html) {
    // 1) пробуем #p83-content
    var out = $('#' + CFG.targetPostId + '-content');
    // 2) иначе .post-content внутри #p83
    if (!out) out = $('#' + CFG.targetPostId + ' .post-content');
    if (!out) throw new Error('Не нашёл контейнер для вывода (#' + CFG.targetPostId + '-content)');

    out.innerHTML = html;
  }

  // ===== Публичный билдер =======================================================
  function buildChronology() {
    try {
      note('Собираю…');
      var rows = collectPosts();
      if (!rows.length) {
        note('Посты не найдены');
        return;
      }
      var html = renderChronologyHTML(rows);
      writeToTarget(html);
      ensureStyles();
      note('Готово');
      log(LOG, 'Обновлён #' + CFG.targetPostId + '-content');
    } catch (err) {
      note('Ошибка: ' + err.message);
      log(LOG, err);
    }
  }

  // ===== Кнопка в конце #p82 .post-box =========================================
  function injectButton() {
    var container = $('#' + CFG.sourcePostId + ' .post-box') || $('#' + CFG.sourcePostId);
    if (!container) {
      log(LOG, '#' + CFG.sourcePostId + ' не найден — кнопку не вставил');
      return;
    }
    if ($('[data-fmv-chrono-trigger]', container)) {
      // уже есть
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'fmv-chrono-controls';
    wrap.innerHTML =
      '<a href="javascript:void(0)" class="button" data-fmv-chrono-trigger>' + esc(CFG.buttonText) + '</a>' +
      '<span class="fmv-chrono-note" data-fmv-chrono-note></span>';

    container.appendChild(wrap);

    var btn = $('[data-fmv-chrono-trigger]', wrap);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      buildChronology();
    });

    log(LOG, 'Кнопка добавлена (конец #' + CFG.sourcePostId + ' .post-box)');
  }

  function note(text) {
    var el = $('#' + CFG.sourcePostId + ' [data-fmv-chrono-note]');
    if (el) el.textContent = text || '';
  }

  // ===== Инициализация ==========================================================
  function init() {
    ensureStyles();
    injectButton();
  }

  // Экспорт для консоли
  window.FMV_buildChronology = buildChronology;
  window.FMV = window.FMV || {};
  window.FMV.buildChronology = buildChronology;

  // Старт
  ready(init);
  // подстраховка, если что-то дорисовывается после DOMContentLoaded
  window.addEventListener('load', function () {
    // если кнопки нет — попробуем ещё раз
    if (!$('#' + CFG.sourcePostId + ' [data-fmv-chrono-trigger]')) {
      injectButton();
    }
  });

})();
