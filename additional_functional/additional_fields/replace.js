// == cp1251 helpers (совместимо с тем, как сериализует 90999.js) ==
const __cp1251Map = (() => {
  const m = {};
  for (let u = 1040; u <= 1103; u++) m[u] = u - 848; // А..я -> 192..255
  m[1025] = 168; m[1105] = 184; // Ё/ё
  return m;
})();
function encodeURIcp1251(str){
  const out = [];
  for (const ch of String(str)) {
    let code = ch.charCodeAt(0);
    if (__cp1251Map[code] !== undefined) code = __cp1251Map[code];
    if (code <= 0xFF) {
      if ((code>=0x30&&code<=0x39)||(code>=0x41&&code<=0x5A)||(code>=0x61&&code<=0x7A)||
          code===0x2D||code===0x2E||code===0x5F||code===0x7E) out.push(String.fromCharCode(code));
      else out.push('%' + code.toString(16).toUpperCase().padStart(2,'0'));
    } else {
      const ent = `&#${ch.charCodeAt(0)};`;
      for (const e of ent) {
        const c = e.charCodeAt(0);
        if ((c>=0x30&&c<=0x39)||(c>=0x41&&c<=0x5A)||(c>=0x61&&c<=0x7A)||
            c===0x2D||c===0x2E||c===0x5F||c===0x7E) out.push(String.fromCharCode(c));
        else out.push('%' + c.toString(16).toUpperCase().padStart(2,'0'));
      }
    }
  }
  return out.join('').replace(/\+/g,'%2B');
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
async function fetchCP1251Doc(url){
  const res = await fetch(url, { credentials:'include' });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const html = new TextDecoder('windows-1251').decode(buf);
  return new DOMParser().parseFromString(html, 'text/html');
}

// == УСТАНОВИТЬ ЗНАЧЕНИЕ ==
async function FMVreplaceFieldData(user_id, new_value) {
  try {
    const editUrl = `/profile.php?section=fields&id=${encodeURIComponent(user_id)}&nohead`;
    const doc = await fetchCP1251Doc(editUrl);

    // форма редактирования (на многих темах id="profile8"; подстрахуемся по action)
    const FIELD_SELECTOR = '#fld' + PROFILE_CHECK.PPageFieldID;
    const form = doc.querySelector('form#profile8') ||
                 [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('/profile.php'));
    if (!form) throw new Error('Не нашла форму редактирования профиля.');

    // ставим новое значение в #fld3 (в просмотре это pa-fld3)
    const fld = form.querySelector(FIELD_SELECTOR);
    if (!fld) throw new Error(`Поле ${FIELD_SELECTOR} не найдено. Проверьте номер fld.`);
    fld.value = PROFILE_CHECK.PPageFieldTemplate;

    // ensure name="update" присутствует (некоторые шаблоны требуют)
    if (![...form.elements].some(el => el.name === 'update')) {
      const hidden = doc.createElement('input');
      hidden.type = 'hidden'; hidden.name = 'update'; hidden.value = '1';
      form.appendChild(hidden);
    }

    // отправляем как x-www-form-urlencoded с cp1251 percent-encoding
    const postUrl = form.getAttribute('action') || '/profile.php';
    const body = serializeFormCP1251(form);
    const save = await fetch(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!save.ok) throw new Error(`POST ${postUrl} → HTTP ${save.status}`);

    // контрольное чтение (не обязательно, но полезно)
    const doc2 = await fetchCP1251Doc(editUrl);
    const form2 = doc2.querySelector('form#profile8') ||
                  [...doc2.querySelectorAll('form')].find(f => (f.action||'').includes('/profile.php'));
    const v2 = form2?.querySelector(FIELD_SELECTOR)?.value ?? null;

    console.log('✅ Установлено новое значение:', new_value, '| Прочитано из формы:', v2);
  } catch (e) {
    console.error('❌ Ошибка:', e);
  }
};
