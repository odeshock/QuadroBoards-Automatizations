// === helpers: cp1251 + сериализация формы «как браузер» (как в твоём файле) ===
const __cp1251Map = (()=>{const m={};for(let u=1040;u<=1103;u++)m[u]=u-848;m[1025]=168;m[1105]=184;return m;})();
function encodeURIcp1251(str){
  const out=[]; for(const ch of String(str)){ let code=ch.charCodeAt(0);
    if(__cp1251Map[code]!==undefined) code=__cp1251Map[code];
    if(code<=0xFF){
      if((code>=0x30&&code<=0x39)||(code>=0x41&&code<=0x5A)||(code>=0x61&&code<=0x7A)||code===0x2D||code===0x2E||code===0x5F||code===0x7E)
        out.push(String.fromCharCode(code));
      else out.push('%'+code.toString(16).toUpperCase().padStart(2,'0'));
    }else{
      const ent=`&#${ch.charCodeAt(0)};`;
      for(const e of ent){ const c=e.charCodeAt(0);
        if((c>=0x30&&c<=0x39)||(c>=0x41&&c<=0x5A)||(c>=0x61&&c<=0x7A)||c===0x2D||c===0x2E||c===0x5F||c===0x7E)
          out.push(String.fromCharCode(c));
        else out.push('%'+c.toString(16).toUpperCase().padStart(2,'0'));
      }
    }
  }
  return out.join('').replace(/\+/g,'%2B');
}
function serializeFormCP1251_SelectSubmit(form, chosenName='save'){
  const pairs=[];
  for(const el of Array.from(form.elements||[])){
    if(!el.name || el.disabled) continue;
    const t=(el.type||'').toLowerCase();

    // только один submit (save); preview и др. не тащим
    if(t==='submit' || t==='button'){
      if(el.name===chosenName) pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(el.value||''));
      continue;
    }
    if(el.name==='preview') continue;

    if((t==='checkbox'||t==='radio') && !el.checked) continue;
    if(el.tagName==='SELECT' && el.multiple){
      for(const opt of el.options) if(opt.selected)
        pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(opt.value));
      continue;
    }
    pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(el.value ?? ''));
  }
  return pairs.join('&');
}
async function fetchCP1251Doc(url){
  const res = await fetch(url, { credentials:'include' });
  if(!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const html = new TextDecoder('windows-1251').decode(buf);
  return new DOMParser().parseFromString(html, 'text/html');
}
async function fetchCP1251Text(url, init){
  const res = await fetch(url, init);
  const buf = await res.arrayBuffer();
  return { res, text: new TextDecoder('windows-1251').decode(buf) };
}
function serializeFormCP1251(form){
  const pairs = [];
  for (const el of Array.from(form.elements||[])) {
    if (!el.name || el.disabled) continue;
    if ((el.type==='checkbox'||el.type==='radio') && !el.checked) continue;
    if (el.tagName==='SELECT' && el.multiple) {
      for (const opt of el.options) if (opt.selected)
        pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(opt.value));
      continue;
    }
    pairs.push(encodeURIcp1251(el.name)+'='+encodeURIcp1251(el.value));
  }
  return pairs.join('&');
}

async function fetchHtml(url){
  const res = await fetch(url, { credentials:'include' });
  if (!res.ok) throw new Error('HTTP '+res.status);
  const buf = await res.arrayBuffer();
  let html = new TextDecoder('windows-1251').decode(buf);
  if (!/[А-Яа-яЁё]/.test(html)) html = new TextDecoder('utf-8').decode(buf);
  return html;
}

function escapeHtml(s){
  return (s||'').replace(/[&<>\"']/g, ch => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]
  ));
}

// helpers.js
window.parseChronoTagsRaw = function(firstNode){
  const pick = sel => firstNode.querySelector(sel)?.textContent.trim() || '';

  const charsStr = pick('characters');
  const masksStr = pick('masks');

  const participantsLower = (charsStr ? charsStr.split(/\s*;\s*/) : [])
    .map(s => s.trim().toLowerCase()).filter(Boolean);

  const masks = {};
  (masksStr || '').split(/\s*;\s*/).forEach(pair=>{
    const i = pair.indexOf('=');
    if (i>0) masks[pair.slice(0,i).trim().toLowerCase()] = pair.slice(i+1).trim();
  });

  const all = new Set(participantsLower);
  Object.keys(masks).forEach(k=>all.add(k));

  return {
    participantsLower: Array.from(all),
    masks,
    location: pick('location'),
    order: pick('order'),
  };
};

// Резолвер имён и готового HTML (использует profileLink / getProfileNameById)
window.resolveChronoData = async function(raw, opts = {}){
  const out = { ...raw, idToName: new Map(), participantsHtml: '', masksHtml: '' };

  const ids = new Set();
  for (const tok of raw.participantsLower) { const m = /^user(\d+)$/i.exec(tok); if (m) ids.add(String(+m[1])); }
  for (const tok of Object.keys(raw.masks||{})) { const m = /^user(\d+)$/i.exec(tok); if (m) ids.add(String(+m[1])); }

  for (const id of ids) {
    try { out.idToName.set(id, await getProfileNameById(id) || null); }
    catch { out.idToName.set(id, null); }
  }

  const renderLeft = (token) => {
    const m = /^user(\d+)$/i.exec(token);
    if (!m) return escapeHtml(token);
    const id = String(+m[1]);
    const name = out.idToName.get(id) || null;
    return profileLink(id, name); // ← ГЛАВНОЕ: именно тут появится <a> или (не найден)
  };

  out.participantsHtml = raw.participantsLower.map(renderLeft).join('; ');
  out.masksHtml = Object.entries(raw.masks||{}).map(([k,v]) => `${renderLeft(k)}=${escapeHtml(v)}`).join('; ');

  return out;
};

/**
 * userLink – вывод ссылки на профиль в HTML или BB-коде
 * @param {string|number} id   – числовой ID пользователя
 * @param {string}        name – отображаемое имя (если есть)
 * @param {boolean}       asBB – true → вернуть BB-код, false → HTML
 * @returns {string}
 */
function userLink(id, name = '', asBB = false) {
  const uid   = String(id);
  const label = name || `user${uid}`;

  if (asBB) {
    // BB-код
    return `[url=${SITE_URL}/profile.php?id=${uid}]${label}[/url]`;
  }

  // HTML через штатную profileLink, если она определена
  if (typeof window.profileLink === 'function') {
    return window.profileLink(uid, label);
  }

  // запасной вариант простая <a>
  return `<a href="/profile.php?id=${uid}">${label}</a>`;
}

/**
 * missingUser – оформление «не найденного» пользователя
 * @param {string} token – исходное имя/токен (например user11)
 * @param {boolean} asBB – true → BB-код, false → HTML
 */
function missingUser(token, asBB = false) {
  const raw = String(token);
  return asBB
    ? `[i][color=#b00020]${raw}[/color][/i]`
    : `<span class="fmv-missing" data-found="0">${raw}</span>`;
}
