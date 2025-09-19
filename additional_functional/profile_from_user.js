const MAKE_NAMES_LINKS = (window.MAKE_NAMES_LINKS ?? false);

// ─────────────── userN → имя ───────────────
function extractUserIdsFromString(s){
  const ids = new Set();
  (s||'').replace(/user(\d+)/gi, (_,d)=>{ ids.add(String(Number(d))); return _; });
  return Array.from(ids);
}

function profileLink(id, name) {
  const withNameTxt = (typeof name === 'string' && name.length) ? name : null;

  // 1) Если имя не найдено — просто "userN (не найден)" БЕЗ <a>
  if (!withNameTxt) {
    return `user${id} (<span class="fmv-missing">не найден</span>)`;
  }

  // 2) Имя найдено:
  //    - если включены ссылки — вернём <a>
  //    - если выключены — просто текст
  if (MAKE_NAMES_LINKS) {
    const a = document.createElement('a');
    a.href = '/profile.php?id=' + encodeURIComponent(id);
    a.textContent = withNameTxt;
    return a.outerHTML;
  }
  return withNameTxt;
}

// ─────────────── userN → Имя профиля (с кэшем) ───────────────
const nameCache = new Map();

// --- ДОБАВЛЕНО: подгрузка имён удалённых профилей -------------
let exProfilesMap = null;
let exProfilesPromise = null;

async function loadExProfiles() {
  if (exProfilesMap) return exProfilesMap;
  if (exProfilesPromise) return exProfilesPromise;

  exProfilesPromise = (async () => {
    const html = await fetchHtml(EX_PROFILES_URL);       // глобальная функция у вас уже есть
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    const map  = new Map();
    for (const a of doc.querySelectorAll('a[href*="profile.php?id="]')) {
      const m = (a.getAttribute('href') || '').match(/profile\.php\?id=(\d+)/i);
      if (!m) continue;
      const id = String(Number(m[1]));
      const nm = (a.textContent || '').trim();
      if (nm && !map.has(id)) map.set(id, nm);
    }
    exProfilesMap = map;
    return map;
  })();
  return exProfilesPromise;
}

async function getExProfileName(id) {
  const map = await loadExProfiles();
  return map.get(String(Number(id))) || null;
}
// ----------------------------------------------------------------

async function getProfileNameById(id){
  id = String(Number(id));
  if (nameCache.has(id)) return nameCache.get(id);

  // 1) ищем на текущей странице
  let name = getNameFromPageById(id);

  // 2) пробуем загрузить сам профиль
  if (!name){
    try{
      const html = await fetchHtml(`/profile.php?id=${id}`);
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      name = extractNameFromDoc(doc);
    }catch{}
  }

  // 3) fallback: смотрим в список удалённых профилей
  if (!name){
    try {
        const exName = await getExProfileName(id);
        if (exName) name = `[ex] ${exName}`;
    } catch {}
  }

  nameCache.set(id, name || null);
  return name || null;
}

function getNameFromPageById(id){
  const anchors = Array.from(document.querySelectorAll(`a[href*="profile.php?id=${id}"]`));
  for (const a of anchors){
    const t = (a.textContent||'').trim();
    if (t && !/Профил|Profile/i.test(t)) return t;
  }
  return null;
}

function extractNameFromDoc(doc){
  const usernameEl =
    doc.querySelector('.user-ident .username') ||
    doc.querySelector('.user-box .username') ||
    null;
  if (usernameEl) {
    const name = (usernameEl.textContent || '').trim();
    if (name) return name;
  }

  const headings = [
    '#pun-title span','h1 span','h1','h2.hn','.hn','.title','.subhead h2'
  ].map(sel => doc.querySelector(sel)).filter(Boolean)
   .map(el => (el.textContent || '').trim()).filter(Boolean);

  const title = (doc.querySelector('title')?.textContent || '').trim();
  if (title) headings.unshift(title);

  const PROFILE_PATTERNS = [
    /Профил[ья]\s*[:\-—–]\s*(.+)$/i,
    /Просмотр\s+профиля\s*[:\-—–]\s*(.+)$/i,
    /Profile\s*[:\-—–]\s*(.+)$/i
  ];

  for (let t of headings){
    t = t.replace(/\s+/g,' ').trim();
    for (const re of PROFILE_PATTERNS){
      const m = t.match(re);
      if (m) {
        const raw = m[1].trim();
        const clean = raw.replace(/^[«"'\\[]|[»"'\\]]$/g,'').trim();
        if (clean) return clean;
      }
    }
  }
  return null;
}
