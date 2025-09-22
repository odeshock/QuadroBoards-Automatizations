

// === get_skin.js (с твоей отрисовкой внутри; ниже только мини-патч) ===

// NEW: окружение (определяем где мы, читаем/пишем контент, куда монтироваться)
const __skinEnv = (() => {
  const isAdmin  = /\/admin_pages\.php/.test(location.pathname);
  const adminURL = new URL('/admin_pages.php?edit_page=usr2_skin', location.origin).toString();

  const pickMount = () =>
    (isAdmin
      ? (document.getElementById('page-content') || document.body)
      : (document.querySelector('#viewprofile #container') ||
         document.querySelector('#viewprofile') ||
         document.querySelector('#container') ||
         document.body));

  async function fetchDoc(url){
    const res = await fetch(url, { credentials:'include' });
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    return {ok: res.ok, html, doc};
  }

  async function loadPageHTML() {
    if (isAdmin) {
      const ta = document.getElementById('page-content');
      return ta ? (ta.value || ta.textContent || '') : '';
    }
    const admin = await fetchDoc(adminURL);
    const ta = admin.doc.querySelector('#page-content');
    return ta ? (ta.value || '') : '';
  }

  async function savePageHTML(newWholeHTML) {
    if (isAdmin) {
      const tm = (window.tinymce && window.tinymce.get && window.tinymce.get('page-content')) || null;
      if (tm) tm.setContent(newWholeHTML);
      const ta = document.getElementById('page-content');
      if (ta) ta.value = newWholeHTML;
      return true;
    }
    // профиль: берём свежую форму из админки, подменяем textarea и шлём POST
    const admin = await fetchDoc(adminURL);
    const form = admin.doc.querySelector('form[action*="admin_pages.php"]') || admin.doc.querySelector('form');
    const ta   = admin.doc.querySelector('#page-content');
    if (!form || !ta) throw new Error('Не нашли форму/textarea в админке');
    ta.value = newWholeHTML;
    const fd = new FormData(form);
    fd.set(ta.getAttribute('name') || 'content', ta.value);
    const res = await fetch(adminURL, { method:'POST', credentials:'include', body: fd });
    return res.ok;
  }

  return { isAdmin, pickMount, loadPageHTML, savePageHTML };
})();

// NEW: мягкий гард — больше не завязываемся на URL, только на наличие textarea
function __ensureTextareaExists() {
  const ta = document.getElementById('page-content');
  return !!ta;
}

/**
 * Публичная функция (минимальная правка): принимаем класс блока
 * @param {string} blockClassOneOf - '_plashka' | '_icon' | '_background'
 */
window.get_skin = async function get_skin(blockClassOneOf = '_plashka') {

  // === ПРАВКА №1: вместо жёсткого URL-гарда используем мягкий ===
  if (!__ensureTextareaExists()) {
    // если запускаемся на профиле — раннер создаст скрытую textarea (см. код ниже)
    // если её нет — просто выходим
    return;
  }

  // === ПРАВКА №2: читаем исходный HTML не напрямую из DOM, а универсально ===
  const originalFullHTML = await __skinEnv.loadPageHTML();

  // --- дальше ИДЁТ ТВОЯ СУЩЕСТВУЮЩАЯ ЛОГИКА ---
  // 1) парсишь originalFullHTML
  // 2) вытягиваешь из него конкретный блок по blockClassOneOf (например, div._plashka)
  // 3) строишь панель (details, списки, drag-drop, т.п.)
  // 4) генерация «выбранных» и т.д.
  //
  // !!! Важно: когда тебе нужно записать результат — получи полный новый HTML
  // и вызови __skinEnv.savePageHTML(newWholeHTML). Это ПРАВКА №3.

  // Пример двух утилит, которые часто нужны (оставь если удобны):

  function rewriteOnlyBlock(fullHtml, blockClass, newInner) {
    const host = document.createElement('div'); host.innerHTML = fullHtml;
    const block = host.querySelector('div.' + blockClass);
    if (!block) {
      const d = document.createElement('div'); d.className = blockClass; d.innerHTML = newInner || '';
      host.appendChild(d);
      return host.innerHTML;
    }
    // preserved: комментариями сохраним прежнее содержимое
    const preserved = [];
    const esc = (s) => String(s).replace(/--/g,'—');
    block.childNodes.forEach(n=>{
      if (n.nodeType===1){ // element
        const id = n.getAttribute('data-id'); const pid = (id==null)?'undefined':id;
        preserved.push(`<!-- preserved (data-id="${esc(pid)}")\n${esc(n.outerHTML)}\n-->`);
      } else if (n.nodeType===3){ // text
        const t = n.nodeValue; if (t.trim()) preserved.push(`<!-- preserved (data-id="undefined")\n${esc(t)}\n-->`);
      } else if (n.nodeType===8){ // comment
        preserved.push(`<!--${esc(n.nodeValue)}-->`);
      }
    });
    block.innerHTML = (newInner ? newInner + '\n' : '') + preserved.join('\n');
    return host.innerHTML;
  }

  // === В МОМЕНТ «СОХРАНИТЬ» ДЕЛАЙ ТАК (ПРАВКА №3) ===
  async function onSave(newInnerForThisBlock) {
    const freshFull = await __skinEnv.loadPageHTML();
    const newFull   = rewriteOnlyBlock(freshFull, blockClassOneOf, newInnerForThisBlock);
    const ok        = await __skinEnv.savePageHTML(newFull);
    alert(ok ? 'Успешно' : 'Ошибка');
  }

  // ------------------------------------------------------------
  // ВАЖНО: ниже НЕ меняй твою отрисовку.
  // Просто в нужной кнопке вызови onSave( innerHTML_выбранных ).
  // А для монтирования панели вместо «после textarea»
  // используй __skinEnv.pickMount() (если у тебя была привязка к ta):
  //
  // Пример:
  // const mount = __skinEnv.pickMount();
  // mount.insertAdjacentElement('afterend', panelEl);
  //
  // Всё остальное — как у тебя сейчас.
  // ------------------------------------------------------------
};


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

// Универсальный fetch→Document
async function fetchDocSmart(url) {
  if (window.FMV?.fetchDoc) return await FMV.fetchDoc(url);
  if (typeof window.fetchHtml === 'function') {
    const html = await window.fetchHtml(url);
    return new DOMParser().parseFromString(html, 'text/html');
  }
  const res = await fetch(url, { credentials: 'include' });
  const html = await res.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

// Ищем комментарий <!-- main: usrN_skin -->
function findMainPointerId(doc) {
  const container =
    doc.querySelector('#pun-main .container') ||
    doc.querySelector('.pun-main .container');
  if (!container) return null;

  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const m = /main:\s*usr(\d+)_skin/i.exec(n.nodeValue || '');
    if (m) return m[1];
  }
  return null;
}

// Берём innerHTML каждого .item
function pickItemsHTML(doc, selector) {
  return Array.from(doc.querySelectorAll(selector))
    .map(el => (el.innerHTML || '').trim())
    .filter(Boolean);
}

/**
 * Загружает /pages/usrN_skin и возвращает три массива:
 * { icons: string[], plashki: string[], backs: string[] }
 */
async function collectSkinSets() {
  if (!isProfileFieldsPage()) return { icons: [], plashki: [], backs: [] };

  const profileId = getProfileId();

  // 1) открываем /pages/usr<profileId>_skin
  const doc1 = await fetchDocSmart(`/pages/usr${profileId}_skin`);
  if (!doc1) return { icons: [], plashki: [], backs: [] };

  // 2) смотрим "маяк" на ПЕРВОЙ открытой странице
  const ptr1 = findMainPointerId(doc1);

  // Если "маяка" нет — парсим doc1 и выходим
  if (!ptr1) {
    return {
      icons:   pickItemsHTML(doc1, '#pun-main ._icon .item, .pun-main ._icon .item'),
      plashki: pickItemsHTML(doc1, '#pun-main ._plashka .item, .pun-main ._plashka .item'),
      backs:   pickItemsHTML(doc1, '#pun-main ._background .item, .pun-main ._background .item')
    };
  }

  // 3) "маяк" есть → переходим НА СЛЕДУЮЩУЮ страницу /pages/usr<ptr1>_skin
  const doc2 = await fetchDocSmart(`/pages/usr${ptr1}_skin`);
  if (!doc2) return { icons: [], plashki: [], backs: [] };

  // 4) если и здесь снова есть "маяк" — это цикл
  const ptr2 = findMainPointerId(doc2);
  if (ptr2) {
    console.log('Найден цикл');
    return { icons: [], plashki: [], backs: [] };
  }

  // 5) иначе парсим вторую страницу
  return {
    icons:   pickItemsHTML(doc2, '#pun-main ._icon .item, .pun-main ._icon .item'),
    plashki: pickItemsHTML(doc2, '#pun-main ._plashka .item, .pun-main ._plashka .item'),
    backs:   pickItemsHTML(doc2, '#pun-main ._background .item, .pun-main ._background .item')
  };
}

