// auto_chrono_converter_to_excel.js
(() => {
  'use strict';

  /* ===== входные ===== */
  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();
  const OPEN_URL = (new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href)).href;

  if (!GID.length || !FID.length || !TID || !PID) {
    console.warn('[auto_chrono_converter_to_excel] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID');
    return;
  }

  let lastBlobUrl = '';

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'выгрузить Excel (.xlsx)',
    order: 57,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'скачать',
    linkHref: '',
    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});
      setLink('', ''); // прячем ссылку на время работы

      try {
        setStatus('Загружаю комментарий…');
        setDetails('');

        const doc  = await FMV.fetchDoc(OPEN_URL);
        const post = findPostNode(doc, PID);
        if (!post) throw new Error(`Не нашёл пост #${PID}`);

        const root = post.querySelector('.post-content, .postmsg, .entry-content, .content, .post-body, .post') || post;

        // приоритет — сырой HTML в <script type="text/html"> под спойлером
        let rows = [];
        const scriptTpl = root.querySelector('.quote-box.spoiler-box.media-box script[type="text/html"], .spoiler-box script[type="text/html"], .media-box script[type="text/html"]');
        if (scriptTpl && scriptTpl.textContent) rows = parseFromScriptHTML(scriptTpl.textContent);

        // fallback — отрисованный блок
        if (!rows.length) {
          const media = findChronoRendered(root) || root;
          rows = parseFromRendered(media);
        }
        if (!rows.length) throw new Error('Не удалось найти блок «Собранная хронология».');

        setStatus('Формирую .xlsx…');
        const { blob, filename } = buildXLSX(rows);

        if (lastBlobUrl) { try { URL.revokeObjectURL(lastBlobUrl); } catch {} }
        lastBlobUrl = URL.createObjectURL(blob);

        setStatus('Готово');
        setLink(lastBlobUrl, 'скачать');
        const a = api?.wrap?.querySelector('a.fmv-action-link');
        if (a) a.setAttribute('download', filename);

        setDetails(`<b>Строк:</b> ${rows.length}<br><b>Источник:</b> <a href="${FMV.escapeHtml(OPEN_URL)}" target="_blank">комментарий</a><br><b>Файл:</b> ${FMV.escapeHtml(filename)}`);
      } catch (e) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        api?.setLink?.('', '');
      }
    }
  });

  /* ===================== поиск поста / блока ===================== */
  function findPostNode(doc, pid) {
    const id = `p${pid}`;
    let node = doc.getElementById(id);
    if (node) return node;
    const a = doc.querySelector(`a[name="${id}"]`);
    if (a) return a.closest('.post') || a.closest('.blockpost') || a.parentElement;
    node = doc.querySelector(`[id^="p${pid}"]`);
    return node;
  }
  function findChronoRendered(root) {
    const cand = Array.from(root.querySelectorAll('*')).find(n => /Собранная\s+хронология/i.test(n.textContent || ''));
    if (!cand) return null;
    return cand.closest('.quote-box, .media, .spoiler-box, .content, .post, div, section') || cand;
  }

  /* ===================== парсинг ===================== */
  function parseFromScriptHTML(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${htmlText}</div>`, 'text/html');
    const wrap = doc.body.firstElementChild;
    const out = [];
    wrap.querySelectorAll('p').forEach(p => { const row = parseParagraph(p); if (row) out.push(row); });
    return out;
  }
  function parseFromRendered(container) {
    const ps = container.querySelectorAll('p');
    if (ps.length) return Array.from(ps).map(parseParagraph).filter(Boolean);
    const html = container.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    return html.split(/\n{2,}/).map(chunk => {
      const div = document.createElement('div');
      div.innerHTML = `<p>${chunk}</p>`;
      return parseParagraph(div.firstElementChild);
    }).filter(Boolean);
  }

  function parseParagraph(p) {
    const headNodes = [], partNodes = [], locNodes = [];
    let mode = 'head';
    for (const node of p.childNodes) {
      if (node.nodeType === 1 && node.tagName === 'BR') { mode = (mode==='head') ? 'part' : 'loc'; continue; }
      if (mode === 'head') headNodes.push(node);
      else if (mode === 'part') partNodes.push(node);
      else locNodes.push(node);
    }
    const a = p.querySelector('a[href*="viewtopic.php?id="]');
    const { type, status, dateStart, dateEnd, order } = parseHeader(headNodes);
    const title = (a?.textContent || '').trim();
    const href  = a?.href || '';

    const { participants, masksLines } = parseParticipants(partNodes);
    const location = cleanLocation(textFromNodes(locNodes));

    const start = (type === 'au') ? '' : (dateStart || '');
    const end   = (type === 'au') ? '' : (dateEnd   || start || '');

    return {
      type, status, title, href,
      dateStart: start, dateEnd: end,
      order: Number.isFinite(order) ? order : 0,
      participants,      // [{name, href}]
      masksLines,        // ["Имя — маска1, маска2", ...]
      location
    };
  }

  function parseHeader(nodes) {
    const text = textFromNodes(nodes);
    let type = '', status = '';
    const mTS = text.match(/^\s*\[([^\]]+)\]/);
    if (mTS) { const pair = mTS[1].split('/').map(s => s.trim().toLowerCase()); type=pair[0]||''; status=pair[1]||''; }
    const mOrd = text.match(/\[\s*порядок:\s*(\d+)\s*\]/i);
    const order = mOrd ? parseInt(mOrd[1],10) : 0;

    let tail = text.replace(/^\s*\[[^\]]+\]\s*/,'').trim();
    let datePart = '';
    const mdash = tail.indexOf(' — '), ndash = tail.indexOf(' - ');
    const pos = (mdash>=0)?mdash:(ndash>=0?ndash:-1);
    if (pos>=0) datePart = tail.slice(0,pos).trim();
    if (/дата\s+не\s+указан/i.test(datePart)) datePart='';

    let dateStart='', dateEnd='';
    if (datePart) {
      const duo = datePart.replace(/[\u2012-\u2015\u2212—–−]/g,'-').replace(/\s*-\s*/g,'-').split('-').slice(0,2);
      if (duo.length===1) dateStart=duo[0]; else { dateStart=duo[0]; dateEnd=duo[1]; }
    }
    return { type, status, dateStart, dateEnd, order };
  }

  function parseParticipants(nodes) {
    const list = []; let cur=null; const push=()=>{ if(cur){ list.push(cur); cur=null; } };
    const masksMap = new Map(); // name -> [mask1, mask2]
    for (const node of nodes) {
      if (node.nodeType===3) {
        const t=node.nodeValue||'';
        if (/^\s*,\s*$/.test(t)) { push(); continue; }
        const m=t.match(/\[\s*as\s+([^\]]+)\]/i);
        if (m && cur) {
          const arr=m[1].split(/\s*,\s*/).filter(Boolean);
          if (arr.length){ if(!masksMap.has(cur.name)) masksMap.set(cur.name,[]); masksMap.get(cur.name).push(...arr); }
        } else if (/\S/.test(t) && !cur) { cur={name:t.trim(), href:''}; }
        continue;
      }
      if (node.nodeType===1) {
        const el=node;
        if (el.tagName==='A') { push(); cur={name:(el.textContent||'').trim(), href: el.href||''}; continue; }
        if (/^(SPAN|MARK)$/i.test(el.tagName)) { const name=(el.textContent||'').trim(); if(name){ push(); cur={name, href:''}; } }
      }
    }
    push();
    const masksLines = [];
    for (const p of list) { const m=masksMap.get(p.name); if (m && m.length) masksLines.push(`${p.name} — ${m.join(', ')}`); }
    return { participants: list, masksLines };
  }

  function textFromNodes(nodes) {
    return nodes.map(n => n.nodeType===3 ? (n.nodeValue||'') : (n.nodeType===1 ? (n.textContent||'') : ''))
      .join('').replace(/\s+/g,' ').trim();
  }
  function cleanLocation(s) {
    const t=String(s||'').trim();
    if (!t) return '';
    if (/^локац/i.test(t) && /не\s+указан/i.test(t)) return '';
    if (/^не\s+указан/i.test(t)) return '';
    return t;
  }

  /* ===================== XLSX builder — ПРОВЕРЕННЫЙ ZIP из твоей рабочей версии ===================== */

  // helpers
  const str2u8 = s => new TextEncoder().encode(s);
  const u16 = n => new Uint8Array([n&255,(n>>>8)&255]);
  const u32 = n => new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
  const concat = arrs => { let len=0; arrs.forEach(a=>len+=a.length); const out=new Uint8Array(len); let o=0; arrs.forEach(a=>{out.set(a,o); o+=a.length;}); return out; };
  const CRC_TABLE = (()=>{ let t=new Uint32Array(256), c; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0;} return t;})();
  const crc32 = (u8)=>{ let c=0^(-1); for(let i=0;i<u8.length;i++) c=(c>>>8)^CRC_TABLE[(c^u8[i])&255]; return (c^(-1))>>>0; };
  const dosDateTime=(d=new Date())=>{
    const time=((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31);
    const date=(((d.getFullYear()-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31);
    return {time,date};
  };
  const xmlEscape = s => String(s||'').replace(/[<>&"]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const q = s => String(s||'').replace(/"/g,'""');

  function cellInline(v){ return `<c t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v).replace(/\r?\n/g,'&#10;')}</t></is></c>`; }
  function cellNumber(n){ return `<c><v>${Number(n)||0}</v></c>`; }
  function cellFormula(f){ return `<c><f>${xmlEscape(f)}</f></c>`; }
  function linkCell(url, label){
    if (url && label) return cellFormula(`HYPERLINK("${q(url)}","${q(label)}")`);
    if (url && !label) return cellFormula(`HYPERLINK("${q(url)}","${q(url)}")`);
    return cellInline(label||'');
  }

  // Лист: наши 9 колонок (как просила)
  function sheetChronoXML(rows){
    const header = ['Тип','Статус','Тема','Дата начала','Дата конца','Порядок','Участники','Маски','Локация'];
    const headerRow = `<row r="1">${header.map(cellInline).join('')}</row>`;
    const dataRows = rows.map((r,i)=>{
      const start = r.dateStart || '';
      const end   = r.dateEnd || start || '';
      const participantsText = (r.participants||[]).map(p=> p.href ? `${p.name} — ${p.href}` : `${p.name}`).join('\n');
      const masksText = (r.masksLines||[]).join('\n');
      const cells = [
        cellInline(r.type||''),
        cellInline(r.status||''),
        linkCell(r.href||'', r.title || r.href || ''),
        cellInline(start),
        cellInline(end),
        cellNumber(r.order||0),
        cellInline(participantsText),
        cellInline(masksText),
        cellInline(r.location||'')
      ];
      return `<row r="${i+2}">${cells.join('')}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;
  }

  // Минимальный рабочий пакет XLSX (как у тебя в рабочем файле): workbook + 1 worksheet, без docProps/rels-листов
  function buildXLSX(rows){
    const files=[], add=(name,content)=>files.push({name, data:str2u8(content)}); // имена ASCII — UTF-8 флаг не нужен

    const wbRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

    const wbXML = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Хронология" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"          ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

    add('[Content_Types].xml', contentTypes);
    add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
    add('xl/workbook.xml', wbXML);
    add('xl/_rels/workbook.xml.rels', wbRels);
    add('xl/worksheets/sheet1.xml', sheetChronoXML(rows));

    const blobZip = makeZip(files);
    const filename = `chronology_${new Date().toISOString().slice(0,10)}.xlsx`;
    // Blob ZIP = valid xlsx (xlsx — это zip-контейнер)
    return { blob: blobZip, filename };
  }

  // ZIP из твоей рабочей версии (без сжатия, максимально совместимый)
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
    return new Blob([concat([...locals, centralDir, end])], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

})();
