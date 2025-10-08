/*!
 * money-upd.js — чистый текст + безопасная замена + публичное API
 */
(function () {
  'use strict';

  // === ПАРАМЕТР ПОЛЯ ===
  const idNum = (typeof window.MoneyFieldUpdID === 'string') ? window.MoneyFieldUpdID.trim() : '';
  if (!idNum) {
    console.log('[money-upd] MoneyFieldUpdID не задан');
  }
  const fieldName = idNum ? `pa-fld${idNum}` : ''; // может быть пустым, если не задан

  // === УТИЛИТЫ ===
  const esc = (CSS.escape || ((s) => s.replace(/[^a-zA-Z0-9_-]/g, '\\$&')));
  const sel = fieldName ? `li#${esc(fieldName)}, li.${esc(fieldName)}` : '';
  const RE_MAIN = /^\s*main:\s*usr(\d+)\s*$/i;

  const cache = new Map();
  let fetchCount = 0;

  async function fetchHtml(url) {
    fetchCount++;
    const r = await fetch(url, { credentials: 'same-origin' });
    const buf = await r.arrayBuffer();
    let html = new TextDecoder('utf-8').decode(buf);
    if (/charset\s*=\s*windows-1251/i.test(html) || html.includes('�')) {
      try { html = new TextDecoder('windows-1251').decode(buf); } catch {}
    }
    return html;
  }

  // Возвращает ПЛЕЙН-ТЕКСТ значения текущего поля у пользователя uid
  function getValue(uid) {
    if (cache.has(uid)) return cache.get(uid);
    const p = (async () => {
      const html = await fetchHtml(`/profile.php?id=${uid}`);
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      const li   = fieldName
        ? doc.querySelector(`#${esc(fieldName)}, .${esc(fieldName)}`)
        : null;

      const strong = li?.querySelector('strong, b');
      let v = strong?.textContent?.trim();
      if (!v) {
        const t = (li?.textContent || '').trim();
        v = t.split(':').slice(-1)[0].trim();
      }
      return (v || '').replace(/\u00A0/g, ' ').trim();
    })();
    cache.set(uid, p);
    return p;
  }

  // Ищем комментарий <!-- main: usrN --> внутри конкретного узла списка
  function findUsrFromComment(liEl) {
    if (!liEl) return null;
    const walker = liEl.ownerDocument.createTreeWalker(liEl, NodeFilter.SHOW_COMMENT);
    for (let n; (n = walker.nextNode()); ) {
      const m = (n.nodeValue || '').match(RE_MAIN);
      if (m) return m[1];
    }
    return null;
  }

  // Достаём ПЛЕЙН-ТЕКСТ значения поля из переданного документа (без походов в сеть)
  function extractLocalValue(rootDoc, _fieldName) {
    const li = rootDoc.querySelector(`#${esc(_fieldName)}, .${esc(_fieldName)}`);
    const strong = li?.querySelector('strong, b');
    let v = strong?.textContent?.trim();
    if (!v) {
      const t = (li?.textContent || '').trim();
      v = t.split(':').slice(-1)[0].trim();
    }
    return (v || '').replace(/\u00A0/g, ' ').trim();
  }

  // === ОСНОВНАЯ ОБРАБОТКА ДЛЯ СУЩЕСТВУЮЩЕГО ПОВЕДЕНИЯ ===
  function process(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const matches = []; // {node, uid}
    for (let n; (n = walker.nextNode()); ) {
      const m = (n.nodeValue || '').match(RE_MAIN);
      if (m) matches.push({ node: n, uid: m[1] });
    }
    matches.forEach(({ node, uid }) => {
      getValue(uid).then(val => {
        if (node && node.isConnected && node.parentNode) {
          node.replaceWith(document.createTextNode(val));
        }
      }).catch(e => console.error('[money-upd] usr' + uid + ' error:', e));
    });
  }

  function run() {
    if (!sel) return; // ничего не делаем, если поле не задано
    document.querySelectorAll(sel).forEach(process);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  // === ПУБЛИЧНОЕ API ДЛЯ КОДА 1 ===
  // Возвращает ПЛЕЙН-ТЕКСТ значения поля (поддерживает <!-- main: usrN -->).
  // Параметры:
  //   doc: Document (по умолчанию текущий doc из кода 1)
  //   fieldId: номер поля (например 6). Если не задан, берём window.MoneyFieldUpdID.
  async function resolveMainFieldValue({ doc = document, fieldId } = {}) {
    const id = (fieldId != null)
      ? String(fieldId).replace(/\D/g, '')
      : (idNum || '').replace(/\D/g, '');

    if (!id) throw new Error('[money-upd] resolveMainFieldValue: fieldId не задан и MoneyFieldUpdID пуст');

    const fname = `pa-fld${id}`;
    const li = doc.querySelector(`#${esc(fname)}, .${esc(fname)}`);

    // 1) если стоит <!-- main: usrN --> — берём значение у usrN
    const refUid = findUsrFromComment(li);
    if (refUid) {
      try { return await getValue(refUid); }
      catch (e) { console.error('[money-upd] resolveMainFieldValue:', e); }
    }

    // 2) локальное значение
    return extractLocalValue(doc, fname);
  }

  // Маленький помощник: превращает строку в целое со знаком, иначе возвращает 0
  function toSignedIntOrZero(s) {
    if (!s) return 0;
    const norm = String(s).replace(/[^\d+-]/g, '');
    const m = norm.match(/^[+-]?\d+/);
    return m ? Number(m[0]) : 0;
  }

  // Пробрасываем API наружу (не перетираем, если уже есть)
  window.MainUsrFieldResolver = window.MainUsrFieldResolver || {};
  window.MainUsrFieldResolver.resolveMainFieldValue = window.MainUsrFieldResolver.resolveMainFieldValue || resolveMainFieldValue;
  window.MainUsrFieldResolver.toSignedIntOrZero    = window.MainUsrFieldResolver.toSignedIntOrZero    || toSignedIntOrZero;

})();
