/*!
 * money-upd-slim.js — один экспорт: getFieldValue({ doc, fieldId }) -> string
 * - Заменяет <!-- main: usrN --> в li#pa-fldN
 * - Предоставляет window.MainUsrFieldResolver.getFieldValue
 */
(function () {
  "use strict";

  // ===== Настройки поля =====
  const DEFAULT_FIELD_ID = "6";
  const idNum = String(window.MoneyFieldUpdID ?? DEFAULT_FIELD_ID).trim().replace(/\D/g, "") || DEFAULT_FIELD_ID;
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
