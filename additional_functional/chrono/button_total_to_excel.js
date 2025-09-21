// button_total_to_excel (через collectEpisodesFromForums)
(() => {
  'use strict';

  /* ===== входные ===== */
  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();
  const OPEN_URL = (new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href)).href;

  if (!GID.length || !FID.length || !TID || !PID) {
    console.warn('[button_total_to_excel] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID');
    return;
  }

  // разделы (можно переопределить через CHRONO_CHECK.ForumInfo)
  const SECTIONS = Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
    ? window.CHRONO_CHECK.ForumInfo
    : [];

  // базовый адрес сайта для ссылок на профиль
  const SITE_URL = (window.FMV?.siteUrl || location.origin || '').replace(/\/+$/, '');

  let lastBlobUrl = '';

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'выгрузить общее хроно в excel',
    order: 2,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Скачать',
    linkHref: '',

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});
      api?.setLink?.('', ''); // прячем ссылку на время работы

      try {
        setStatus('Собираю эпизоды…');
        setDetails('');

        // === берём готовые эпизоды из парсера
        const episodes = await collectEpisodesFromForums({ sections: SECTIONS });
        if (!episodes.length) throw new Error('Эпизоды не найдены.');

        // Маппинг эпизодов → строки таблицы
        // Столбцы: Тип | Статус | Тема (ссылка) | Дата начала | Дата конца | Порядок | Участники | Маски | Локация
        const rows = episodes.map(ep => {
          // колонка «Участники»: "Имя — {SITE_URL}/profile.php?id=ID" или просто "Имя"
          const participantsText = (ep.participants || []).map(p => {
            const name = String(p.name || '').trim();
            if (!name) return '';
            if (p.id != null && p.id !== '') {
              const href = `${SITE_URL}/profile.php?id=${encodeURIComponent(String(p.id))}`;
              return `${name} — ${href}`;
            }
            return name;
          }).filter(Boolean).join('\n');

          // колонка «Маски»: "Имя — mask1, mask2" (только если маски есть)
          const masksLines = (ep.participants || []).flatMap(p => {
            const masks = Array.isArray(p.masks) ? p.masks.filter(Boolean) : [];
            const name  = String(p.name || '').trim() || (p.id != null ? `user${p.id}` : '');
            // Для каждой маски — своя строка "Имя — маска"
            return masks.map(m => `${name} — ${m}`);
          }).filter(Boolean);

          return {
            type: ep.type || '',
            status: ep.status || '',
            title: ep.title || '',
            href: ep.href || '',
            dateStart: ep.dateStart || '',
            dateEnd: ep.dateEnd || ep.dateStart || '',
            order: Number(ep.order || 0) || 0,
            participantsText,
            masksLines,
            location: ep.location || ''
          };
        });

        setStatus('Формирую .xlsx…');
        const { blob, filename } = buildXLSX(rows);

        if (lastBlobUrl) { try { URL.revokeObjectURL(lastBlobUrl); } catch {} }
        lastBlobUrl = URL.createObjectURL(blob);

        setStatus('Готово');
        setDetails(`Строк: ${rows.length}\nИсточник: ${FMV.escapeHtml(OPEN_URL)}\nФайл: ${FMV.escapeHtml(filename)}`);
        setLink(lastBlobUrl, 'Скачать');
        const a = api?.wrap?.querySelector('a.fmv-action-link');
        if (a) a.setAttribute('download', filename);

      } catch (e) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        api?.setLink?.('', '');
      }
    }
  });

  /* ===================== XLSX builder ===================== */

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

  // Лист: 9 колонок
  function sheetChronoXML(rows){
    const header = ['Тип','Статус','Тема','Дата начала','Дата конца','Порядок','Участники','Маски','Локация'];
    const headerRow = `<row r="1">${header.map(cellInline).join('')}</row>`;
    const dataRows = rows.map((r,i)=>{
      const cells = [
        cellInline(r.type||''),
        cellInline(r.status||''),
        linkCell(r.href||'', r.title || r.href || ''),
        cellInline(r.dateStart||''),
        cellInline(r.dateEnd||r.dateStart||''),
        cellNumber(r.order||0),
        cellInline(r.participantsText||''),
        cellInline((r.masksLines||[]).join('\n')),
        cellInline(r.location||'')
      ];
      return `<row r="${i+2}">${cells.join('')}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;
  }

  // Минимальный рабочий пакет XLSX: workbook + 1 worksheet (без компрессии)
  function buildXLSX(rows){
    const files=[], add=(name,content)=>files.push({name, data:str2u8(content)});
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
    return { blob: blobZip, filename };
  }

  // ZIP (без сжатия)
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
