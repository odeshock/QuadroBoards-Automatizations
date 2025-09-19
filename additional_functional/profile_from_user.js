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
  function extractNameFromDoc(doc){
    const candidates = [
      '#pun-title span','h1 span','h1','h2.hn','.hn','.title','.subhead h2','.user-ident .username'
    ].map(sel => doc.querySelector(sel)).filter(Boolean)
     .map(el => (el.textContent||'').trim()).filter(Boolean);
    const title = (doc.querySelector('title')?.textContent||'').trim();
    if (title) candidates.unshift(title);
    for (let t of candidates){
      t = t.replace(/\s+/g,' ').trim();
      const m = t.match(/Профил[ья]\s*[:\-—–]\s*(.+)$/i) || t.match(/Просмотр\s+профиля\s*[:\-—–]\s*(.+)$/i);
      if (m) return m[1].trim();
      if (t && !/Профил|Profile|Просмотр|Информация|Страниц/i.test(t)) return t;
    }
    return null;
  }
