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

  // ===== Единый парсер <characters> с масками =====
  FMV.parseCharactersUnified = function(charsText, idToNameMap, profileLink = window.profileLink) {
    const raw = String(charsText || '').trim();
    if (!raw) {
      return {
        participantsLower: [],
        masksByCharLower: new Map(),
        htmlParticipants: '',
        htmlMasks: '',
        htmlError: ''
      };
    }
  
    // Шаблон: userN или userN=mask, разделитель ;
    const TEMPLATE = /^\s*user\d+(?:\s*=\s*[^;]+)?(?:\s*;\s*user\d+(?:\s*=\s*[^;]+)?)*\s*$/i;
    if (!TEMPLATE.test(raw)) {
      return {
        participantsLower: [],
        masksByCharLower: new Map(),
        htmlParticipants: '',
        htmlMasks: '',
        htmlError: `<span class="fmv-missing">Ошибка формата! ` +
                   `Нужен вид: userN; userM=маска; userM=маска; …</span>`
      };
    }
  
    const parts = raw.split(/\s*;\s*/).filter(Boolean);
    const participantsSet = new Set();
    const masksByCharLower = new Map();
    const htmlMaskPairs = [];
    const htmlPeople = [];
  
    for (const p of parts) {
      const [left, right] = p.split('=');
      const id = String(Number((left.match(/user(\d+)/i) || [,''])[1]));
      const key = ('user' + id).toLowerCase();
      participantsSet.add(key);
  
      const personHtml = profileLink(id, idToNameMap?.get(id));
      if (right) {
        const mask = FMV.normSpace(right);
        if (!masksByCharLower.has(key)) masksByCharLower.set(key, new Set());
        masksByCharLower.get(key).add(mask.toLowerCase());
        htmlMaskPairs.push(`${personHtml}=${FMV.escapeHtml(mask)}`);
      }
      htmlPeople.push(personHtml);
    }
  
    const participantsLower = Array.from(participantsSet);
    const htmlParticipants = participantsLower.map(low => {
      const roles = Array.from(masksByCharLower.get(low) || []);
      const id = String(+low.replace(/^user/i,''));
      const base = profileLink(id, idToNameMap?.get(id));
      return roles.length ? `${base} [as ${FMV.escapeHtml(roles.join(', '))}]` : base;
    }).join('; ');
  
    return {
      participantsLower,
      masksByCharLower,
      htmlParticipants,
      htmlMasks: htmlMaskPairs.join('; '),
      htmlError: ''
    };
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
      html: `<span class="fmv-missing">Нужен формат целого числа (пример: -3 или 5)</span>` +
            ` — ${FMV.escapeHtml(raw)}`
    };
  };

  // --- извлечение userID из сырого текста тегов ---
  FMV.extractUserIdsFromTags = function (charsText, masksText) {
    const ids = new Set();
    const scan = (s) => String(s || '').replace(/user(\d+)/gi, (_, d) => {
      ids.add(String(Number(d)));
      return _;
    });
    scan(charsText);
    scan(masksText);
    return Array.from(ids);
  };
  
  // --- построение карты id -> имя по userID из <characters>/<masks> ---
  FMV.buildIdToNameMapFromTags = async function (charsText, masksText) {
    // если есть глобальный кэш — используем его
    if (window.__FMV_ID_TO_NAME_MAP__ instanceof Map && window.__FMV_ID_TO_NAME_MAP__.size) {
      return window.__FMV_ID_TO_NAME_MAP__;
    }
  
    // иначе резолвим только те id, что реально указаны в тегах
    const ids = FMV.extractUserIdsFromTags(charsText, masksText);
    const map = new Map();
  
    // getProfileNameById — из profile_from_user.js
    if (typeof window.getProfileNameById !== 'function') return map;
  
    await Promise.all(ids.map(async (id) => {
      try {
        const name = await window.getProfileNameById(id);
        if (name) map.set(id, name);
      } catch { /* no-op */ }
    }));
  
    return map;
  };

})();
