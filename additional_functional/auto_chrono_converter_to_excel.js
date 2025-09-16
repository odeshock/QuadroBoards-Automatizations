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

    inlineBox.appendChild(document.createElement('br'));
    
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

  /* ===== Даты (все форматы) ===== */
  function parseDateRange(raw){
    if (!raw) return {start:'', end:''};
    const s = raw.replace(/\s+/g,'').toLowerCase();
    let m;
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
      const [_, dd, mm, yy] = m;
      if (!validDate(dd,mm,yy)) return {start:'', end:''};
      const d = toYMD(pad2(dd), pad2(mm), yy); return {start:d, end:d};
    }
    if ((m = s.match(/^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
      const [_, d1, d2, mm, yy] = m;
      if (isValidMonth(mm) && isValidYear(yy) && validDate(d1,mm,yy) && validDate(d2,mm,yy))
        return {start: toYMD(pad2(d1),pad2(mm),yy), end: toYMD(pad2(d2),pad2(mm),yy)};
      return {start:'', end:''};
    }
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
      const [_, d1, m1, d2, m2, yy] = m;
      if (isValidMonth(m1)&&isValidMonth(m2)&&isValidYear(yy)&&validDate(d1,m1,yy)&&validDate(d2,m2,yy))
        return {start: toYMD(pad2(d1),pad2(m1),yy), end: toYMD(pad2(d2),pad2(m2),yy)};
      return {start:'', end:''};
    }
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
      const [_, d1,m1,y1, d2,m2,y2] = m;
      if (validDate(d1,m1,y1) && validDate(d2,m2,y2))
        return {start: toYMD(pad2(d1),pad2(m1),y1), end: toYMD(pad2(d2),pad2(m2),y2)};
      return {start:'', end:''};
    }
    if ((m = s.match(/^(\d{1,2})\.(\d{4})$/))) {
      const [_, mm, yy] = m;
      if (isValidMonth(mm) && isValidYear(yy)) { const v=`${yy}-${pad2(mm)}`; return {start:v,end:v}; }
      return {start:'', end:''};
    }
    if ((m = s.match(/^(\d{1,2})-(\d{1,2})\.(\d{4})$/))) {
      const [_, m1, m2, yy] = m;
      if (isValidMonth(m1)&&isValidMonth(m2)&&isValidYear(yy))
        return {start:`${yy}-${pad2(m1)}`, end:`${yy}-${pad2(m2)}`};
      return {start:'', end:''};
    }
    if ((m = s.match(/^(\d{4})$/))) {
      const yy = m[1]; if (isValidYear(yy)) return {start:yy, end:yy}; return {start:'', end:''};
    }
    if ((m = s.match(/^(\d{4})-(\d{4})$/))) {
      const [_, y1, y2] = m; if (isValidYear(y1)&&isValidYear(y2)) return {start:y1, end:y2};
      return {start:'', end:''};
    }
    return {start:'', end:''};
  }

  /* ===== Извлечение из <p> ===== */
  // Точно связываем роли [as ...] с последним именем (ссылка или нет),
  // при этом сами [as ...] не попадают в список участников.
  function parseItalic(iElem){
    const participants = [];
    const masks = [];
    if (!iElem) return {participants, masks};

    // Сначала соберём токены из дочерних узлов: NAME и ROLES
    const tokens = [];
    iElem.childNodes.forEach(n=>{
      if (n.nodeType === 1) {
        if (n.tagName === 'A') {
          const href = safeUrl(n.getAttribute('href')||'');
          const label = text(n);
          if (label) tokens.push({type:'name', label, href});
        } else {
          const label = text(n);
          if (label && !/\[as/i.test(label) && !/не указан/i.test(label)) {
            // это имя без ссылки (например, <span>sebastian</span> или <span>tom</span>)
            tokens.push({type:'name', label, href:''});
          }
          // если внутри элемента может быть [as ...] (редко), достанем тоже
          const mAll = (n.textContent||'').match(/\[as([^\]]+)\]/ig);
          if (mAll) {
            mAll.forEach(m0=>{
              const inside = m0.match(/\[as([^\]]+)\]/i)[1];
              const roles = inside.split(',').map(s=>s.trim()).filter(Boolean);
              if (roles.length) tokens.push({type:'roles', roles});
            });
          }
        }
      } else if (n.nodeType === 3) {
        const t = n.textContent || '';
        // Только роли из текстовых узлов
        const re = /\[as([^\]]+)\]/ig;
        let mm;
        while ((mm = re.exec(t)) !== null) {
          const roles = mm[1].split(',').map(s=>s.trim()).filter(Boolean);
          if (roles.length) tokens.push({type:'roles', roles});
        }
      }
    });

    // Привязываем роли к последнему имени
    let lastName = null;
    tokens.forEach(tok=>{
      if (tok.type === 'name') {
        lastName = tok;
        participants.push({label: tok.label, href: tok.href}); // добавляем участника
      } else if (tok.type === 'roles') {
        if (lastName) {
          tok.roles.forEach(r => masks.push({label: r, href: lastName.href || ''}));
        }
      }
    });

    return {participants, masks};
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
      // отделяем левую часть до «—»
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
      const {participants, masks} = parseItalic(italic);
      const location = extractLocation(p);
      const d=new Date();
      const ts = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

      rows.push({
        start, end,
        title: title||'',
        link: href||'',
        participants_list: participants,                 // [{label, href}]
        masks_list: masks,                               // [{label, href}]
        participants_text: participants.map(x=>x.label).join('\n'),
        masks_text: masks.map(x=>x.label).join('\n'),
        location: location||'',
        order:'',
        type: type||'',
        status: status||'',
        ts
      });
    });
    return rows;
  }

  /* ===== XLSX (3 листа) ===== */
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
  const xmlEscape = s => String(s||'').replace(/[<>&"]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const q = s => String(s||'').replace(/"/g,'""');

  function cellInline(v){ return `<c t="inlineStr"><is><t>${xmlEscape(v)}</t></is></c>`; }
  function cellFormula(f){ return `<c><f>${xmlEscape(f)}</f></c>`; }
  function linkCell(url, label){
    if (url && label) return cellFormula(`HYPERLINK("${q(url)}","${q(label)}")`);
    if (url && !label) return cellFormula(`HYPERLINK("${q(url)}","${q(url)}")`);
    return cellInline(label||'');
  }

  // Лист 1: Хронология (Название = гиперссылка на эп)
  function sheetMainXML(rows){
    const header = ['#','Дата начала','Дата завершения','Название','Участники','Маски','Локация','Порядок','Тип','Статус','Timestamp обновления'];
    const headerRow = `<row r="1">${header.map(cellInline).join('')}</row>`;
    const dataRows = rows.map((r,i)=>{
      const cells = [];
      cells.push(cellInline(String(i+1)));
      cells.push(cellInline(r.start||''));
      cells.push(cellInline(r.end||''));
      cells.push(linkCell(r.link, r.title || r.link));   // Гиперссылка
      cells.push(cellInline(r.participants_text||''));    // только имена
      cells.push(cellInline(r.masks_text||''));           // только роли
      cells.push(cellInline(r.location||''));
      cells.push(cellInline(r.order||''));
      cells.push(cellInline(r.type||''));
      cells.push(cellInline(r.status||''));
      cells.push(cellInline(r.ts||''));
      return `<row r="${i+2}">${cells.join('')}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;
  }

  // Лист 2: Участники — как "Имя | URL"
  function sheetParticipantsXML(rows){
    const header = ['#','Имя','URL'];
    const headerRow = `<row r="1">${header.map(cellInline).join('')}</row>`;
    let rIndex = 2;
    const dataRows = rows.map((row, i)=>{
      const idx = i+1;
      const list = row.participants_list || [];
      return list.map(p=>{
        const c1 = cellInline(String(idx));
        const c2 = cellInline(p.label || '');
        const c3 = cellInline(p.href || '');  // URL как текст: Sheets сделает кликабельным
        const xml = `<row r="${rIndex}">${c1}${c2}${c3}</row>`; rIndex++; return xml;
      }).join('');
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;
  }

  // Лист 3: Маски — как "Роль | URL" (URL берётся у того участника, перед которым стоял [as ...])
  function sheetMasksXML(rows){
    const header = ['#','Роль','URL'];
    const headerRow = `<row r="1">${header.map(cellInline).join('')}</row>`;
    let rIndex = 2;
    const dataRows = rows.map((row, i)=>{
      const idx = i+1;
      const list = row.masks_list || [];
      return list.map(p=>{
        const c1 = cellInline(String(idx));
        const c2 = cellInline(p.label || '');
        const c3 = cellInline(p.href || '');  // может быть пусто (как в примере с "jerry")
        const xml = `<row r="${rIndex}">${c1}${c2}${c3}</row>`; rIndex++; return xml;
      }).join('');
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;
  }

  // ZIP и workbook
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

  function buildXLSX(rows){
    const files=[], add=(name,content)=>files.push({name, data:str2u8(content)});

    const wbRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
</Relationships>`;

    const wbXML = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Хронология" sheetId="1" r:id="rId1"/>
    <sheet name="Участники"  sheetId="2" r:id="rId2"/>
    <sheet name="Маски"      sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"               ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml"      ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml"      ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml"      ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

    add('[Content_Types].xml', contentTypes);
    add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
    add('xl/workbook.xml', wbXML);
    add('xl/_rels/workbook.xml.rels', wbRels);

    add('xl/worksheets/sheet1.xml', sheetMainXML(rows));
    add('xl/worksheets/sheet2.xml', sheetParticipantsXML(rows));
    add('xl/worksheets/sheet3.xml', sheetMasksXML(rows));

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
    if (!rows.length) { alert('Не найдена собранная хронология.'); return; }
    const xlsx = buildXLSX(rows);
    downloadXLSX(xlsx);
  }
})();
