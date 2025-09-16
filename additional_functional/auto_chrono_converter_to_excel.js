/* Только после https://github.com/odeshock/QuadroBoards-Automatizations/blob/main/additional_functional/auto_chrono.js */

(() => {
  /* ===== Активируемся только в нужной теме ===== */
  try {
    const u = new URL(location.href);
    if (!(u.hostname === 'testfmvoice.rusff.me' &&
          u.pathname === '/viewtopic.php' &&
          u.searchParams.get('id') === '13')) {
      return;
    }
  } catch { return; }

  /* ===== Вставка кнопки строго в #fmv-chrono-inline (ждём, если нужно) ===== */
  function insertButtonIfReady() {
    const inlineBox = document.querySelector('#fmv-chrono-inline');
    if (!inlineBox) return false;
    if (inlineBox.querySelector('#dl-chrono-btn')) return true;

    const btn = document.createElement('a');
    btn.id = 'dl-chrono-btn';
    btn.href = 'javascript:void(0)';
    btn.textContent = 'Скачать хронологию в Excel';
    btn.className = 'button';
    btn.style.marginLeft = '10px';
    inlineBox.appendChild(btn);

    btn.addEventListener('click', onDownloadClick);
    return true;
  }

  if (!insertButtonIfReady()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insertButtonIfReady, { once: true });
    }
    const obs = new MutationObserver(() => { if (insertButtonIfReady()) obs.disconnect(); });
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 120000);
  }

  /* ===== Утилиты ===== */
  const pad2 = n => String(n).padStart(2,'0');
  const text = n => n ? (n.textContent || '').trim() : '';
  const safeUrl = href => { try { const u=new URL(href, location.href); return /^https?:/i.test(u.protocol) ? u.href : ''; } catch { return ''; } };
  const validDate = (d,m,y) => { const yy=+y, mm=+m, dd=+d, dt=new Date(yy,mm-1,dd); return dt.getFullYear()===yy && dt.getMonth()+1===mm && dt.getDate()===dd; };
  const toYMD = (d,m,y) => `${y}-${pad2(m)}-${pad2(d)}`;
  const isValidMonth = m => (+m)>=1 && (+m)<=12;
  const isValidYear  = y => (+y)>=1 && (+y)<=9999;

  /* ===== Даты: все заданные форматы ===== */
  // Возвращает { start, end } как строки: YYYY-MM-DD / YYYY-MM / YYYY. Некорректное -> ''.
  function parseDateRange(raw){
    if (!raw) return {start:'', end:''};
    const s = raw.replace(/\s+/g,'').toLowerCase();
    let m;

    // dd.mm.yyyy
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
      const [_, dd, mm, yy] = m;
      if (!validDate(dd,mm,yy)) return {start:'', end:''};
      const d = toYMD(pad2(dd), pad2(mm), yy); return {start:d, end:d};
    }
    // dd-dd.mm.yyyy
    if ((m = s.match(/^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
      const [_, d1, d2, mm, yy] = m;
      if (isValidMonth(mm) && isValidYear(yy) && validDate(d1,mm,yy) && validDate(d2,mm,yy))
        return {start: toYMD(pad2(d1),pad2(mm),yy), end: toYMD(pad2(d2),pad2(mm),yy)};
      return {start:'', end:''};
    }
    // dd.mm-dd.mm.yyyy
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
      const [_, d1, m1, d2, m2, yy] = m;
      if (isValidMonth(m1)&&isValidMonth(m2)&&isValidYear(yy)&&validDate(d1,m1,yy)&&validDate(d2,m2,yy))
        return {start: toYMD(pad2(d1),pad2(m1),yy), end: toYMD(pad2(d2),pad2(m2),yy)};
      return {start:'', end:''};
    }
    // dd.mm.yyyy-dd.mm.yyyy
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
      const [_, d1,m1,y1, d2,m2,y2] = m;
      if (validDate(d1,m1,y1) && validDate(d2,m2,y2))
        return {start: toYMD(pad2(d1),pad2(m1),y1), end: toYMD(pad2(d2),pad2(m2),y2)};
      return {start:'', end:''};
    }
    // mm.yyyy
    if ((m = s.match(/^(\d{1,2})\.(\d{4})$/))) {
      const [_, mm, yy] = m;
      if (isValidMonth(mm) && isValidYear(yy)) { const v=`${yy}-${pad2(mm)}`; return {start:v,end:v}; }
      return {start:'', end:''};
    }
    // mm-mm.yyyy
    if ((m = s.match(/^(\d{1,2})-(\d{1,2})\.(\d{4})$/))) {
      const [_, m1, m2, yy] = m;
      if (isValidMonth(m1)&&isValidMonth(m2)&&isValidYear(yy))
        return {start:`${yy}-${pad2(m1)}`, end:`${yy}-${pad2(m2)}`};
      return {start:'', end:''};
    }
    // yyyy
    if ((m = s.match(/^(\d{4})$/))) {
      const yy = m[1]; if (isValidYear(yy)) return {start:yy, end:yy}; return {start:'', end:''};
    }
    // yyyy-yyyy
    if ((m = s.match(/^(\d{4})-(\d{4})$/))) {
      const [_, y1, y2] = m; if (isValidYear(y1)&&isValidYear(y2)) return {start:y1, end:y2};
      return {start:'', end:''};
    }
    return {start:'', end:''};
  }

  /* ===== Извлечение полей из <p> ===== */
  function extractMasksFromItalic(iElem){
    const masks=[]; if(!iElem) return masks;
    let lastHref=null;
    iElem.childNodes.forEach(n=>{
      if(n.nodeType===1 && n.tagName==='A'){ lastHref = safeUrl(n.getAttribute('href')||''); }
      else if(n.nodeType===3){
        const m = (n.textContent||'').match(/\[as([^\]]+)\]/i);
        if(m && lastHref){
          m[1].split(',').map(s=>s.trim()).filter(Boolean).forEach(role=>masks.push({label:role, href:lastHref}));
        }
      }
    });
    return masks;
  }

  // Участники: не выбрасываем имена без ссылки
  function extractParticipantsFromItalic(iElem){
    const parts=[]; if(!iElem) return parts;

    // Ссылки
    iElem.querySelectorAll('a[href]').forEach(a=>{
      const href=safeUrl(a.getAttribute('href')||'');
      const label=text(a);
      if (label) parts.push({label, href});  // href может быть пустой
    });

    // Текст между ссылками — как имена без ссылок (очень аккуратно)
    iElem.childNodes.forEach(n=>{
      if (n.nodeType === 3) {
        const t = (n.textContent||'').trim();
        if (!t) return;
        // разбиваем по запятым/точкам с запятой
        t.split(/[,;]+/).map(s=>s.trim()).filter(Boolean).forEach(name=>{
          if (name && !/^\[as .*\]$/i.test(name)) parts.push({label:name, href:''});
        });
      }
    });

    // убрать точные дубли
    const seen = new Set(); const out=[];
    parts.forEach(p=>{
      const key = p.label + '|' + (p.href||'');
      if (!seen.has(key)) { seen.add(key); out.push(p); }
    });
    return out;
  }

  function extractLocation(pElem){
    const iElem = pElem.querySelector('i'); if(!iElem) return '';
    const chunks=[]; let after=false;
    pElem.childNodes.forEach(n=>{
      if(n===iElem){ after=true; return; }
      if(!after) return;
      chunks.push(n.textContent||'');
    });
    const clean = chunks.join(' ').replace(/\s+/g,' ').trim().replace(/^\/\s*/,'');
    return /не указана/i.test(clean) ? '' : clean;
  }

  function extractMeta(leftText){
    const m = leftText.match(/\[\s*([^\]/]+)\s*\/\s*([^\]]+)\s*\]\s*(.*)$/);
    if(!m) return {type:'',status:'',start:'',end:''};
    const type=(m[1]||'').trim().toLowerCase();
    const status=(m[2]||'').trim().toLowerCase();
    const {start,end}=parseDateRange((m[3]||'').trim());
    return {type,status,start,end};
  }

  function extractTitleLink(rightContainer){
    const a = rightContainer.querySelector('a[href]');
    if(!a) return {title:'',href:''};
    const href = safeUrl(a.getAttribute('href')||'');
    const title = text(a);
    return {title: title||'', href: href||''};
  }

  function collectRows(){
    const source = document.querySelector('#p83-content blockquote');
    if (!source) return [];
    const ps = Array.from(source.querySelectorAll('p'));
    const rows=[];
    ps.forEach(p=>{
      // разделяем по первому «—»
      let leftText='', foundDash=false, rightFrag=document.createElement('span');
      p.childNodes.forEach(node=>{
        const t=(node.textContent||'');
        if(!foundDash && /—/.test(t)){
          const idx=t.indexOf('—');
          leftText += t.slice(0,idx).trim();
          const rest=t.slice(idx+1); if(rest) rightFrag.appendChild(document.createTextNode(rest));
          foundDash=true;
        } else if(!foundDash){
          leftText += t;
        } else {
          rightFrag.appendChild(node.cloneNode(true));
        }
      });
      leftText = leftText.replace(/\s+/g,' ').trim();

      const {type,status,start,end} = extractMeta(leftText);
      const {title, href} = extractTitleLink(rightFrag);
      const italic = p.querySelector('i');
      const participantsList = extractParticipantsFromItalic(italic);
      const masksList = extractMasksFromItalic(italic);
      const participants = participantsList.map(x=> x.href ? `[${x.label}](${x.href})` : x.label).join('\n');
      const masks = masksList.map(x=> x.href ? `[${x.label}](${x.href})` : x.label).join('\n');
      const location = extractLocation(p);
      const d=new Date();
      const ts = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

      rows.push({
        start, end,
        title: title||'',
        link: href||'',
        participants,
        masks,
        location: location||'',
        order:'',
        type: type||'',
        status: status||'',
        ts,
        participants_list: participantsList,
        masks_list: masksList
      });
    });
    return rows;
  }

  /* ===== XLSX (минимальный ZIP, с гиперссылками) ===== */
  const CRC_TABLE = (()=>{let c,t=[],n; for(n=0;n<256;n++){c=n;for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0;} return t;})();
  const crc32 = (u8)=>{ let c=0^(-1); for(let i=0;i<u8.length;i++) c=(c>>>8)^CRC_TABLE[(c^u8[i])&255]; return (c^(-1))>>>0; };
  const str2u8 = s => new TextEncoder().encode(s);
  const u16 = n => new Uint8Array([n&255,(n>>>8)&255]);
  const u32 = n => new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
  const concat = arrs => { let len=0; arrs.forEach(a=>len+=a.length); const out=new Uint8Array(len); let o=0; arrs.forEach(a=>{out.set(a,o); o+=a.length;}); return out; };
  const dosDateTime=(d=new Date())=>{
    const time=((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31);
    const date=(((d.getFullYear()-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31);
    return {time,date};
  };

  function makeZip(files){
    const now=dosDateTime();
    const locals=[], centrals=[]; let offset=0;
    files.forEach(f=>{
      const nameU8=str2u8(f.name), data=f.data, crc=crc32(data);
      const local=concat([ u32(0x04034b50), u16(20), u16(0), u16(0), u16(now.time), u16(now.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameU8.length), u16(0), nameU8, data ]);
      const central=concat([ u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(now.time), u16(now.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameU8.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameU8 ]);
      locals.push(local); centrals.push(central); offset += local.length;
    });
    const centralDir = concat(centrals);
    const cdOffset = locals.reduce((a,b)=>a+b.length,0);
    const cdSize = centralDir.length;
    const end = concat([ u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(cdOffset), u16(0) ]);
    return new Blob([concat([...locals, centralDir, end])], {type:'application/zip'});
  }

  const xmlEscape = s => String(s||'').replace(/[<>&"]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const q = s => String(s||'').replace(/"/g,'""'); // экранирование для формул Excel

  function cellInline(v){ return `<c t="inlineStr"><is><t>${xmlEscape(v)}</t></is></c>`; }
  function cellFormula(formula){ return `<c><f>${xmlEscape(formula)}</f></c>`; }
  function linkCell(url, label){
    if (url && label) return cellFormula(`HYPERLINK("${q(url)}","${q(label)}")`);
    if (url && !label) return cellFormula(`HYPERLINK("${q(url)}","${q(url)}")`);
    return cellInline(label||'');
  }
  function multiLinksText(list){
    // если один с URL — пусть будет формула в linkCell (вернём null)
    if (list.length===1 && list[0].href) return null;
    return list.map(x => x.href ? `${x.label} — ${x.href}` : `${x.label}`).join('\n');
  }

  function buildSheetXML(rows){
    const header = ['Дата начала','Дата завершения','Название','Ссылка','Участники','Маски','Локация','Порядок','Тип','Статус','Timestamp обновления'];

    const headerRow = `<row r="1">${header.map(cellInline).join('')}</row>`;
    const dataRows = rows.map((r,i)=>{
      const cells = [];
      cells.push(cellInline(r.start||''));             // дата начала (текст)
      cells.push(cellInline(r.end||''));               // дата завершения (текст)
      cells.push(cellInline(r.title||''));             // название
      cells.push(linkCell(r.link, r.title || r.link)); // ссылка

      // участники
      let pCell;
      if (r.participants_list && r.participants_list.length){
        const tmp = multiLinksText(r.participants_list);
        pCell = (tmp===null) ? linkCell(r.participants_list[0].href, r.participants_list[0].label)
                             : cellInline(tmp);
      } else {
        pCell = cellInline(r.participants||'');
      }
      cells.push(pCell);

      // маски
      let mCell;
      if (r.masks_list && r.masks_list.length){
        const tmp = multiLinksText(r.masks_list);
        mCell = (tmp===null) ? linkCell(r.masks_list[0].href, r.masks_list[0].label)
                             : cellInline(tmp);
      } else {
        mCell = cellInline(r.masks||'');
      }
      cells.push(mCell);

      cells.push(cellInline(r.location||'')); // локация
      cells.push(cellInline(r.order||''));    // порядок (пока пусто)
      cells.push(cellInline(r.type||''));     // тип
      cells.push(cellInline(r.status||''));   // статус
      cells.push(cellInline(r.ts||''));       // timestamp

      return `<row r="${i+2}">${cells.join('')}</row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${headerRow}
    ${dataRows}
  </sheetData>
</worksheet>`;
  }

  function buildXLSX(rows){
    const files=[], add=(name,content)=>files.push({name, data:str2u8(content)});
    add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
    add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
    add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Хронология" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`);
    add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
    add('xl/worksheets/sheet1.xml', buildSheetXML(rows));
    return makeZip(files);
  }

  function downloadXLSX(blob, filename='chronology.xlsx'){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 200);
  }

  /* ===== Обработчик кнопки ===== */
  function onDownloadClick(){
    const rows = collectRows();
    if (!rows.length) { alert('Не нашёл хронологию в #p83-content.'); return; }
    const xlsx = buildXLSX(rows);
    downloadXLSX(xlsx);
  }
})();
