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
    showLink: true,        // <a> создаём сразу; видимость контролируем setLink('', '')
    linkText: 'скачать',
    linkHref: '',

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});

      setLink('', ''); // скрыть во время работы

      try {
        setStatus('Загружаю комментарий…');
        setDetails('');

        const doc  = await FMV.fetchDoc(OPEN_URL);
        const post = findPostNode(doc, PID);
        if (!post) throw new Error(`Не нашёл пост #${PID}`);

        const root = post.querySelector('.post-content, .postmsg, .entry-content, .content, .post-body, .post') || post;

        // 1) сначала пробуем исходный HTML в <script type="text/html"> внутри спойлера
        let events = [];
        const scriptTpl = root.querySelector('.quote-box.spoiler-box.media-box script[type="text/html"], .spoiler-box script[type="text/html"], .media-box script[type="text/html"]');
        if (scriptTpl && scriptTpl.textContent) events = parseFromScriptHTML(scriptTpl.textContent);

        // 2) иначе — парсим отрендерённый блок
        if (!events.length) {
          const media = findChronoRendered(root) || root;
          events = parseFromRendered(media);
        }

        if (!events.length) throw new Error('Не нашёл блок «Собранная хронология».');

        setStatus('Формирую .xlsx…');
        const { blob, filename } = buildXLSX(events);

        // revoke предыдущий урл
        if (lastBlobUrl) { try { URL.revokeObjectURL(lastBlobUrl); } catch {} }
        lastBlobUrl = URL.createObjectURL(blob);

        setStatus('Готово');
        setLink(lastBlobUrl, 'скачать');
        const a = api?.wrap?.querySelector('a.fmv-action-link');
        if (a) a.setAttribute('download', filename);

        setDetails(`<b>Строк:</b> ${events.length}<br><b>Источник:</b> <a href="${FMV.escapeHtml(OPEN_URL)}" target="_blank">комментарий</a><br><b>Файл:</b> ${FMV.escapeHtml(filename)}`);
      } catch (e) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        api?.setLink?.('', '');
      }
    }
  });

  /* ===================== ПОИСК/БЛОК ===================== */

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

  /* ===================== ПАРСИНГ (из <script type="text/html">) ===================== */

  function parseFromScriptHTML(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${htmlText}</div>`, 'text/html');
    const wrap = doc.body.firstElementChild;
    const out = [];
    wrap.querySelectorAll('p').forEach(p => {
      const row = parseParagraph(p);
      if (row) out.push(row);
    });
    return out;
  }

  /* ===================== ПАРСИНГ (fallback: отрендерённый HTML) ===================== */

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

  /* ===================== Разбор одного <p> ===================== */

  function parseParagraph(p) {
    // три "строки": заголовок / участники / локация
    const headNodes = [];
    const partNodes = [];
    const locNodes  = [];
    let mode = 'head';
    for (const node of p.childNodes) {
      if (node.nodeType === 1 && node.tagName === 'BR') { mode = (mode==='head') ? 'part' : 'loc'; continue; }
      if (mode === 'head') headNodes.push(node);
      else if (mode === 'part') partNodes.push(node);
      else locNodes.push(node);
    }

    // заголовок
    const a = p.querySelector('a[href*="viewtopic.php?id="]');
    const { type, status, dateStart, dateEnd, order } = parseHeader(headNodes);
    const title = (a?.textContent || '').trim();
    const href  = a?.href || '';

    // участники/маски
    const { participants, masksLines } = parseParticipants(partNodes);

    // локация
    const location = cleanLocation(textFromNodes(locNodes));

    const start = (type === 'au') ? '' : (dateStart || '');
    const end   = (type === 'au') ? '' : (dateEnd   || start || '');

    return {
      type, status, title, href,
      dateStart: start, dateEnd: end,
      order: Number.isFinite(order) ? order : 0,
      participants,  // [{name, href}] в нужном порядке
      masksLines,    // ["Имя — маска1, маска2", ...]
      location
    };
  }

  function parseHeader(nodes) {
    const text = textFromNodes(nodes);
    let type = '', status = '';
    const mTS = text.match(/^\s*\[([^\]]+)\]/);
    if (mTS) {
      const pair = mTS[1].split('/').map(s => s.trim().toLowerCase());
      type   = pair[0] || '';
      status = pair[1] || '';
    }
    const mOrd = text.match(/\[\s*порядок:\s*(\d+)\s*\]/i);
    const order = mOrd ? parseInt(mOrd[1], 10) : 0;

    let tail = text.replace(/^\s*\[[^\]]+\]\s*/,'').trim();
    let datePart = '';
    const mdash = tail.indexOf(' — '), ndash = tail.indexOf(' - ');
    const pos = (mdash >= 0) ? mdash : (ndash >= 0 ? ndash : -1);
    if (pos >= 0) datePart = tail.slice(0, pos).trim();

    if (/дата\s+не\s+указан/i.test(datePart)) datePart = '';

    let dateStart = '', dateEnd = '';
    if (datePart) {
      const norm = datePart.replace(/[\u2012-\u2015\u2212—–−]/g, '-').replace(/\s*-\s*/g, '-');
      const duo  = norm.split('-').slice(0,2);
      if (duo.length === 1) dateStart = duo[0]; else { dateStart = duo[0]; dateEnd = duo[1]; }
    }
    return { type, status, dateStart, dateEnd, order };
  }

  function parseParticipants(nodes) {
    const list = [];
    let cur = null;
    const push = () => { if (cur) { list.push(cur); cur = null; } };
    const masksMap = new Map(); // name -> [m1, m2]

    for (const node of nodes) {
      if (node.nodeType === 3) {
        const t = node.nodeValue || '';
        if (/^\s*,\s*$/.test(t)) { push(); continue; }     // разделитель
        const m = t.match(/\[\s*as\s+([^\]]+)\]/i);
        if (m && cur) {
          const arr = m[1].split(/\s*,\s*/).filter(Boolean);
          if (arr.length) {
            if (!masksMap.has(cur.name)) masksMap.set(cur.name, []);
            masksMap.get(cur.name).push(...arr);
          }
        } else if (/\S/.test(t) && !cur) {
          cur = { name: t.trim(), href: '' };
        }
        continue;
      }
      if (node.nodeType === 1) {
        const el = node;
        if (el.tagName === 'A') {
          push();
          cur = { name: (el.textContent||'').trim(), href: el.href || '' };
          continue;
        }
        if (/^(SPAN|MARK)$/i.test(el.tagName)) {
          const name = (el.textContent||'').trim();
          if (name) { push(); cur = { name, href: '' }; }
        }
      }
    }
    push();

    const masksLines = [];
    for (const p of list) {
      const m = masksMap.get(p.name);
      if (m && m.length) masksLines.push(`${p.name} — ${m.join(', ')}`);
    }
    return { participants: list, masksLines };
  }

  function textFromNodes(nodes) {
    return nodes.map(n => {
      if (n.nodeType === 3) return n.nodeValue || '';
      if (n.nodeType === 1) return n.textContent || '';
      return '';
    }).join('').replace(/\s+/g,' ').trim();
  }

  function cleanLocation(s) {
    const t = String(s || '').trim();
    if (!t) return '';
    if (/^локац/i.test(t) && /не\s+указан/i.test(t)) return '';
    if (/^не\s+указан/i.test(t)) return '';
    return t;
  }

  /* ===================== XLSX builder (минимальный OpenXML + ZIP) ===================== */

  // --- утилиты ZIP ---
  const encUTF8 = s => new TextEncoder().encode(s);

  // CRC32 (для zip)
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n=0; n<256; n++){
      let c = n;
      for (let k=0; k<8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8){
    let c = 0 ^ (-1);
    for (let i=0; i<u8.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ u8[i]) & 0xFF];
    return (c ^ (-1)) >>> 0;
  }
  function toDOSDateTime(d = new Date()){
    const time =
      (d.getHours()   << 11) |
      (d.getMinutes() << 5)  |
      ((d.getSeconds()/2)|0);
    const date =
      ((d.getFullYear()-1980) << 9) |
      ((d.getMonth()+1) << 5) |
      d.getDate();
    return { date, time };
  }
  function ZipBuilder(){
    const files = [];
    let offset = 0;
    const chunks = [];
    return {
      add(name, u8){
        const {date,time} = toDOSDateTime();
        const crc = crc32(u8);
        const local =
          [0x04034b50, 20, 0, 0, time, date, crc, u8.length, u8.length, name.length, 0]; // no extra
        const localU8 = new Uint8Array(30 + name.length);
        const dv = new DataView(localU8.buffer);
        let p=0;
        for (const v of local){ dv.setUint32(p, v>>>0, true); p+=4; }
        for (let i=0;i<name.length;i++) localU8[30+i] = name.charCodeAt(i);
        chunks.push(localU8, u8);
        const headerOffset = offset;
        offset += localU8.length + u8.length;

        files.push({name, crc, size:u8.length, comp:u8.length, date, time, headerOffset});
      },
      finalize(){
        // central directory
        const cds = [];
        let cdSize = 0;
        for (const f of files){
          const name = f.name;
          const cdHead =
            [0x02014b50, 0, 20, 0, 0, f.time, f.date, f.crc, f.size, f.size, name.length, 0, 0, 0, 0, 0, f.headerOffset];
          const u8 = new Uint8Array(46 + name.length);
          const dv = new DataView(u8.buffer); let p=0;
          for (const v of cdHead){ dv.setUint32(p, v>>>0, true); p+=4; }
          for (let i=0;i<name.length;i++) u8[46+i] = name.charCodeAt(i);
          cds.push(u8); cdSize += u8.length;
        }
        const cdStart = offset;
        chunks.push(...cds);
        offset += cdSize;

        const end =
          [0x06054b50, 0,0, files.length, files.length, cdSize, cdStart, 0];
        const endU8 = new Uint8Array(22);
        const dv = new DataView(endU8.buffer); let p=0;
        for (const v of end){ dv.setUint32(p, v>>>0, true); p+=4; }
        chunks.push(endU8);

        // concat
        let total=0; for (const c of chunks) total+=c.length;
        const out = new Uint8Array(total);
        let off=0; for (const c of chunks){ out.set(c, off); off+=c.length; }
        return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      }
    };
  }

  // --- конвертация данных в OpenXML parts ---
  function colLetter(n){ // 0 -> A
    let s=''; n++;
    while(n){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=(n-m-1)/26|0; }
    return s;
  }

  function buildXLSX(rows){
    // Генерим минимальные части пакета XLSX
    const zip = ZipBuilder();

    // 0) [Content_Types].xml
    const CT =
`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/_rels/sheet1.xml.rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
</Types>`;
    zip.add('[Content_Types].xml', encUTF8(CT));

    // 1) _rels/.rels
    const RELS =
`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
    zip.add('_rels/.rels', encUTF8(RELS));

    // 2) xl/workbook.xml
    const WORKBOOK =
`<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Лист 1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
    zip.add('xl/workbook.xml', encUTF8(WORKBOOK));

    // 3) xl/_rels/workbook.xml.rels
    const WB_RELS =
`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
    zip.add('xl/_rels/workbook.xml.rels', encUTF8(WB_RELS));

    // 4) xl/styles.xml (wrapText стиль #1)
    const STYLES =
`<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
    zip.add('xl/styles.xml', encUTF8(STYLES));

    // 5) xl/worksheets/sheet1.xml (+ rels для гиперссылок темы)
    const header = ['Тип','Статус','Тема','Дата начала','Дата конца','Порядок','Участники','Маски','Локация'];

    const wrapStyle = 1; // индекс в cellXfs

    const rowsXml = [];
    // row 1 — заголовок
    rowsXml.push(rowXML(1, header.map((v,i)=> cellInlineStr(i,1,v,0))));

    // гиперссылки (только в колонке C)
    const hlinks = [];
    rows.forEach((r, idx) => {
      const rnum = idx + 2;
      const cells = [];

      // A: Тип
      cells.push(cellInlineStr(0, rnum, r.type, 0));
      // B: Статус
      cells.push(cellInlineStr(1, rnum, r.status, 0));
      // C: Тема (inline string + hyperlink)
      const cRef = "C"+rnum;
      cells.push(cellInlineStr(2, rnum, r.title || '', 0));
      if (r.href) hlinks.push({ ref:cRef, href:r.href });

      // D: Дата начала
      cells.push(cellInlineStr(3, rnum, r.dateStart || '', 0));
      // E: Дата конца (или дубль начала)
      cells.push(cellInlineStr(4, rnum, r.dateEnd || (r.dateStart || ''), 0));
      // F: Порядок (число)
      cells.push(cellNumber(5, rnum, Number(r.order)||0));

      // G: Участники — "Имя — ссылка" по строкам
      const participantsText = (r.participants||[])
        .map(p => p.href ? `${p.name} — ${p.href}` : `${p.name}`)
        .join('\n');
      cells.push(cellInlineStr(6, rnum, participantsText, wrapStyle));

      // H: Маски — каждая строка "Имя — маски"
      cells.push(cellInlineStr(7, rnum, (r.masksLines||[]).join('\n'), wrapStyle));

      // I: Локация
      cells.push(cellInlineStr(8, rnum, r.location || '', wrapStyle));

      rowsXml.push(rowXML(rnum, cells));
    });

    const dim = `A1:${colLetter(header.length-1)}${rows.length+1}`;
    const SHEET =
`<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dim}"/>
  <sheetData>
${rowsXml.join('\n')}
  </sheetData>
  ${hlinks.length ? `<hyperlinks>${hlinks.map((h,i)=>`<hyperlink ref="${h.ref}" r:id="rId${i+1}"/>`).join('')}</hyperlinks>` : ''}
</worksheet>`;
    zip.add('xl/worksheets/sheet1.xml', encUTF8(SHEET));

    // rels для гиперссылок листа
    const HL_RELS =
`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hlinks.map((h,i)=>`  <Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlAttr(h.href)}" TargetMode="External"/>`).join('\n')}
</Relationships>`;
    zip.add('xl/worksheets/_rels/sheet1.xml.rels', encUTF8(HL_RELS));

    const blob = zip.finalize();
    const filename = `chronology_${new Date().toISOString().slice(0,10)}.xlsx`;
    return { blob, filename };

    // helpers for sheet xml
    function cellRef(ci, ri){ return colLetter(ci) + ri; }
    function escText(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function xmlAttr(s){ return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
    function cellInlineStr(ci, ri, text, styleId){
      const t = escText(text).replace(/\r?\n/g,'&#10;'); // \n внутри
      const sAttr = styleId ? ` s="${styleId}"` : '';
      return `<c r="${cellRef(ci,ri)}" t="inlineStr"${sAttr}><is><t xml:space="preserve">${t}</t></is></c>`;
    }
    function cellNumber(ci, ri, num, styleId){
      const sAttr = styleId ? ` s="${styleId}"` : '';
      return `<c r="${cellRef(ci,ri)}"${sAttr}><v>${Number(num)||0}</v></c>`;
    }
    function rowXML(ri, cells){
      return `    <row r="${ri}">${cells.join('')}</row>`;
    }
  }

})();
