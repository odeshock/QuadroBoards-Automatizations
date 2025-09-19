// ==UserScript==
// @name         fmv_common
// @namespace    fmv
// @version      1.0.0
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  const FMV = (window.FMV = window.FMV || {});

  // ---------- базовые утилиты ----------
  FMV.escapeHtml = function (s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  FMV.normSpace = function (s) {
    return String(s ?? '').replace(/\s+/g, ' ').trim();
  };

  FMV.readTagText = function(root, tag) {
    return FMV.normSpace(root?.querySelector(tag)?.textContent || '');
  };

  // на странице может не быть карты id->name; это запасной способ набрать её из DOM
  FMV.idToNameFromPage = function() {
    const map = new Map();
    document.querySelectorAll('.post a[href*="profile.php?id="]').forEach(a=>{
      const m = a.href.match(/id=(\d+)/);
      if (!m) return;
      const id = String(m[1]);
      const name = FMV.normSpace(a.textContent);
      if (id && name) map.set(id, name);
    });
    return map;
  };

  // глобальный флаг «делать имена ссылками»
  FMV.makeLinks = () => !!window.MAKE_NAMES_LINKS;

  // ---------- строгие парсеры, единые для всех скриптов ----------
  // profileLink берём из window.profileLink, но можно передать и параметром
  FMV.parseCharactersStrict = function(charText, idToNameMap, profileLink = window.profileLink) {
    const TEMPLATE = /^\s*user\d+(?:\s*;\s*user\d+)*\s*$/i;
    const human = (charText || '').split(/\s*;\s*/).filter(Boolean).join('; ');

    if (!charText || !TEMPLATE.test(charText)) {
      return {
        ok: false,
        participantsLower: [],
        html: `<span class="fmv-missing">Аааа! Надо пересобрать всё внутри по шаблону: userN;userN;userN</span>` +
              (human ? ' — ' + FMV.escapeHtml(human) : '')
      };
    }

    const ids = (charText.match(/user(\d+)/gi) || [])
      .map(m => String(Number(m.replace(/^\D+/, ''))));

    const htmlParts = ids.map(id => profileLink(id, idToNameMap.get(id)));
    const participantsLower = ids.map(id => ('user' + id).toLowerCase());

    return { ok: true, participantsLower, html: htmlParts.join('; ') };
  };

  FMV.parseMasksStrict = function(maskText, idToNameMap, profileLink = window.profileLink) {
    const TEMPLATE = /^\s*user\d+\s*=\s*[^;]+(?:\s*;\s*user\d+\s*=\s*[^;]+)*\s*$/i;
    const human = (maskText || '').split(/\s*;\s*/).filter(Boolean).join('; ');

    if (!maskText || !TEMPLATE.test(maskText)) {
      return {
        ok: false,
        mapLower: new Map(),
        html: `<span class="fmv-missing">Аааа! Надо пересобрать всё внутри по шаблону: userN=маска;userN=маска</span>` +
              (human ? ' — ' + FMV.escapeHtml(human) : '')
      };
    }

    const mapLower = new Map(); // 'user11' -> Set(['ведущий', ...]) (lower)
    const htmlParts = [];

    maskText.split(';').forEach(pair => {
      const [left, right] = pair.split('=');
      const id = String(Number((left.match(/user(\d+)/i) || [,''])[1]));
      const mask = FMV.normSpace(right);

      if (!id || !mask) return;

      htmlParts.push(`${profileLink(id, idToNameMap.get(id))}=${FMV.escapeHtml(mask)}`);

      const k = ('user' + id).toLowerCase();
      const m = mask.toLowerCase();
      if (!mapLower.has(k)) mapLower.set(k, new Set());
      mapLower.get(k).add(m);
    });

    return { ok: true, mapLower, html: htmlParts.join('; ') };
  };

  // ---------- строгая проверка <order> ----------
  /** 
   * Проверяет, что значение order — целое число.
   * Возвращает:
   *   { ok:true, value:number, html:string }  – если корректно
   *   { ok:false, html:string }               – если ошибка (html с подсветкой)
   */
  FMV.parseOrderStrict = function(orderText) {
    const raw = FMV.normSpace(orderText);
    if (!raw) return { ok: false, html: '' };

    if (/^-?\d+$/.test(raw)) {
      return { ok: true, value: parseInt(raw, 10), html: FMV.escapeHtml(raw) };
    }
    return {
      ok: false,
      html: `<span class="fmv-missing">Ошибка! Нужен формат целого числа (пример: -3 или 5)</span>` +
            ` — ${FMV.escapeHtml(raw)}`
    };
  };

})();
