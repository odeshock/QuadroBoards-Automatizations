const MAKE_NAMES_LINKS = (window.MAKE_NAMES_LINKS ?? false);

// ─────────────── userN → имя ───────────────
  function extractUserIdsFromString(s){
    const ids = new Set();
    (s||'').replace(/user(\d+)/gi, (_,d)=>{ ids.add(String(Number(d))); return _; });
    return Array.from(ids);
  }
  function profileLink(id, name){
    const txt = name || ('user'+id);
    if (!MAKE_NAMES_LINKS) return txt;
    const a = document.createElement('a');
    a.href = '/profile.php?id='+encodeURIComponent(id);
    a.textContent = txt;
    return a.outerHTML;
  }
  function replaceUserTokens(s, idToNameMap){
    return escapeHtml(s||'').replace(/user(\d+)/gi, (m,d)=>{
      const id = String(Number(d));
      const nm = idToNameMap.get(id) || ('user'+id);
      return profileLink(id, nm);
    });
  }
  function replaceUserInPairs(s, idToNameMap){
    return (s||'').split(/\s*;\s*/).filter(Boolean).map(pair=>{
      const [left,right] = pair.split('=');
      if (!right) return replaceUserTokens(left, idToNameMap);
      const replacedLeft = replaceUserTokens(left, idToNameMap);
      return `${replacedLeft}=${escapeHtml(right)}`;
    }).join('; ');
  }
  function escapeHtml(s){
    return (s||'').replace(/[&<>\"']/g, ch => (
      {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]
    ));
  }

// ─────────────── userN → Имя профиля (с кэшем) ───────────────
  const nameCache = new Map();
  async function getProfileNameById(id){
    id = String(Number(id));
    if (nameCache.has(id)) return nameCache.get(id);
    let name = getNameFromPageById(id);
    if (!name){
      try{
        const html = await fetchHtml(`/profile.php?id=${id}`);
        const doc  = new DOMParser().parseFromString(html, 'text/html');
        name = extractNameFromDoc(doc);
      }catch{}
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
  // profile_from_user (1).js

function extractNameFromDoc(doc){
  // 1) Надёжный маркер: ник в блоке идентификации профиля
  const usernameEl =
    doc.querySelector('.user-ident .username') ||
    doc.querySelector('.user-box .username') || // на всякий случай альтернативный шаблон
    null;
  if (usernameEl) {
    const name = (usernameEl.textContent || '').trim();
    if (name) return name;
  }

  // 2) Заголовки, но ТОЛЬКО если явно это страница профиля
  const headings = [
    '#pun-title span','h1 span','h1','h2.hn','.hn','.title','.subhead h2'
  ].map(sel => doc.querySelector(sel)).filter(Boolean)
   .map(el => (el.textContent || '').trim()).filter(Boolean);

  const title = (doc.querySelector('title')?.textContent || '').trim();
  if (title) headings.unshift(title);

  // Разрешаем брать имя из заголовка только при явных ключевых словах страницы профиля
  const PROFILE_PATTERNS = [
    /Профил[ья]\s*[:\-—–]\s*(.+)$/i,           // «Профиль: murmur»
    /Просмотр\s+профиля\s*[:\-—–]\s*(.+)$/i,   // «Просмотр профиля — murmur»
    /Profile\s*[:\-—–]\s*(.+)$/i               // англ. вариант
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

  // Ничего убедительного — это не профиль
  return null;
}
