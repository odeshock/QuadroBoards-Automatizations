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
