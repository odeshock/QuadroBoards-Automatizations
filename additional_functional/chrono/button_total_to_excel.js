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
    label: 'выгрузить excel',
    order: 2,

    showStatus: true,
    showDetails: true,
    showLink: true,          // <a> создаём сразу; видимость управляем setLink('', '')
    linkText: 'скачать',
    linkHref: '',

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});

      // скрыть ссылку на время работы
      setLink('', '');

      try {
        setStatus('Загружаю комментарий…');
        setDetails('');

        const doc  = await FMV.fetchDoc(OPEN_URL);
        const post = findPostNode(doc, PID);
        if (!post) throw new Error(`Не нашёл пост #${PID}`);

        const root = post.querySelector('.post-content, .postmsg, .entry-content, .content, .post-body, .post') || post;

        // 1) приоритет — исходный HTML внутри спойлера (<script type="text/html">)
        let rows = [];
        const scriptTpl = root.querySelector('.quote-box.spoiler-box.media-box script[type="text/html"], .spoiler-box script[type="text/html"], .media-box script[type="text/html"]');
        if (scriptTpl && scriptTpl.textContent) rows = parseFromScriptHTML(scriptTpl.textContent);

        // 2) иначе — fallback по отрендерённому блоку
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

  /* ===================== ПОИСК ПОСТА / БЛОКА ===================== */

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

  /* ===================== ПАРСИНГ: <script type="text/html"> ===================== */

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

  /* ===================== ПАРСИНГ: отрендерённый HTML (fallback) ===================== */

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
      participants,      // [{name, href}]
      masksLines,        // ["Имя — маска1, маска2", ...]
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
    const masksMap = new Map(); // name -> [mask1, mask2]

    for (const node of nodes) {
      if (node.nodeType === 3) {
        const t = node.nodeValue || '';
        if (/^\s*,\s*$/.test(t)) { push(); continue; }        // разделитель
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

  /* ===================== XLSX builder (OpenXML + ZIP) ===================== */

  const encUTF8 = s => new TextEncoder().encode(s);

  // CRC32
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

  // --- ZIP builder (fixed, UTF-8, no compression) ---
  function ZipBuilder() {
    const chunks = [];
    const files = [];
    let offset = 0;

    const encName = (name) => new TextEncoder().encode(String(name).replace(/\\/g, '/'));

    function writeLocalHeader(nameU8, dataU8, crc, date, time) {
      const u8 = new Uint8Array(30 + nameU8.length);
      const dv = new DataView(u8.buffer);
      let p = 0;
      dv.setUint32(p, 0x04034b50, true); p += 4;          // signature
      dv.setUint16(p, 20, true);        p += 2;           // version needed
      dv.setUint16(p, 0x0800, true);    p += 2;           // UTF-8 flag
      dv.setUint16(p, 0, true);         p += 2;           // compression = 0
      dv.setUint16(p, time, true);      p += 2;
      dv.setUint16(p, date, true);      p += 2;
      dv.setUint32(p, crc, true);       p += 4;
      dv.setUint32(p, dataU8.length, true); p += 4;
      dv.setUint32(p, dataU8.length, true); p += 4;
      dv.setUint16(p, nameU8.length, true); p += 2;
      dv.setUint16(p, 0, true);         p += 2;           // extra len
      u8.set(nameU8, p);
      return u8;
    }

    function writeCentralHeader(nameU8, f) {
      const u8 = new Uint8Array(46 + nameU8.length);
      const dv = new DataView(u8.buffer);
      let p = 0;
      dv.setUint32(p, 0x02014b50, true); p += 4;      // signature
      dv.setUint16(p, 0x031E, true);     p += 2;      // version made by
      dv.setUint16(p, 20, true);         p += 2;      // version needed
      dv.setUint16(p, 0x0800, true);     p += 2;      // UTF-8 flag
      dv.setUint16(p, 0, true);          p += 2;      // compression
      dv.setUint16(p, f.time, true);     p += 2;
      dv.setUint16(p, f.date, true);     p += 2;
      dv.setUint32(p, f.crc, true);      p += 4;
      dv.setUint32(p, f.size, true);     p += 4;      // csize
      dv.setUint32(p, f.size, true);     p += 4;      // usize
      dv.setUint16(p, nameU8.length, true); p += 2;
      dv.setUint16(p, 0, true);          p += 2;      // extra len
      dv.setUint16(p, 0, true);          p += 2;      // file comment len
      dv.setUint16(p, 0, true);          p += 2;      // disk number
      dv.setUint16(p, 0, true);          p += 2;      // internal attrs
      dv.setUint32(p, 0, true);          p += 4;      // external attrs
      dv.setUint32(p, f.headerOffset, true); p += 4;  // relative offset
      u8.set(nameU8, p);
      return u8;
    }

    return {
      add(name, dataU8) {
        const nameU8 = encName(name);
        const { date, time } = toDOSDateTime();
        const crc = crc32(dataU8);

        const local = writeLocalHeader(nameU8, dataU8, crc, date, time);
        const headerOffset = offset;
        chunks.push(local, dataU8);
        offset += local.length + dataU8.length;

        files.push({ nameU8, crc, size: dataU8.length, date, time, headerOffset });
      },

      finalize() {
        // central directory
        let cdSize = 0;
        const cds = files.map(f => {
          const cd = writeCentralHeader(f.nameU8, f);
          cdSize += cd.length;
          return cd;
        });
        const cdStart = offset;
        chunks.push(...cds);
        offset += cdSize;

        // end of central directory
        const end = new Uint8Array(22);
        const dv = new DataView(end.buffer);
        let p = 0;
        dv.setUint32(p, 0x06054b50, true); p += 4;
        dv.setUint16(p, 0, true); p += 2; // disk
        dv.setUint16(p, 0, true); p += 2; // start disk
        dv.setUint16(p, files.length, true); p += 2;
        dv.setUint16(p, files.length, true); p += 2;
        dv.setUint32(p, cdSize, true); p += 4;
        dv.setUint32(p, cdStart, true); p += 4;
        dv.setUint16(p, 0, true); p += 2; // comment len
        chunks.push(end);

        // concat
        let total = 0; for (const c of chunks) total += c.length;
        const out = new Uint8Array(total);
        let off = 0; for (const c of chunks) { out.set(c, off); off += c.length; }
        return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      }
    };
  }

  // ==== helpers for sheet xml ====
  function colLetter(n){ let s=''; n++; while(n){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=(n-m-1)/26|0; } return s; }
  function escText(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function xmlAttr(s){ return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  function cellRef(ci, ri){ return colLetter(ci) + ri; }
  function cellInlineStr(ci, ri, text, styleId){
    const t = escText(text).replace(/\r?\n/g,'&#10;');
    const sAttr = styleId ? ` s="${styleId}"` : '';
    return `<c r="${cellRef(ci,ri)}" t="inlineStr"${sAttr}><is><t xml:space="preserve">${t}</t></is></c>`;
  }
  function cellNumber(ci, ri, num, styleId){
    const sAttr = styleId ? ` s="${styleId}"` : '';
    return `<c r="${cellRef(ci,ri)}"${sAttr}><v>${Number(num)||0}</v></c>`;
  }
  function rowXML(ri, cells){ return `    <row r="${ri}">${cells.join('')}</row>`; }

  // --- XLSX packer ---
  function buildXLSX(rows){
    const zip = ZipBuilder();

    // [Content_Types].xml
    const CT =
`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
    zip.add('[Content_Types].xml', encUTF8(CT));

    // _rels/.rels
    const RELS =
`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
    zip.add('_rels/.rels', encUTF8(RELS));

    // xl/workbook.xml
    const WORKBOOK =
`<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Лист 1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
    zip.add('xl/workbook.xml', encUTF8(WORKBOOK));

    // xl/_rels/workbook.xml.rels
    const WB_RELS =
`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"   Target="styles.xml"/>
</Relationships>`;
    zip.add('xl/_rels/workbook.xml.rels', encUTF8(WB_RELS));

    // xl/styles.xml (wrapText стиль 1)
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

    // xl/worksheets/sheet1.xml (+ hyperlinks rels)
    const header = ['Тип','Статус','Тема','Дата начала','Дата конца','Порядок','Участники','Маски','Локация'];
    const wrapStyle = 1;

    const rowsXml = [];
    rowsXml.push(rowXML(1, header.map((v,i)=> cellInlineStr(i,1,v,0))));

    const hlinks = [];
    rows.forEach((r, idx) => {
      const rnum = idx + 2;
      const cells = [];

      cells.push(cellInlineStr(0, rnum, r.type, 0));
      cells.push(cellInlineStr(1, rnum, r.status, 0));
      // Тема (C) + гиперссылка
      const cref = 'C' + rnum;
      cells.push(cellInlineStr(2, rnum, r.title || '', 0));
      if (r.href) hlinks.push({ ref: cref, href: r.href });

      cells.push(cellInlineStr(3, rnum, r.dateStart || '', 0));
      cells.push(cellInlineStr(4, rnum, r.dateEnd || (r.dateStart || ''), 0));
      cells.push(cellNumber(5, rnum, Number(r.order) || 0, 0));

      const participantsText = (r.participants||[])
        .map(p => p.href ? `${p.name} — ${p.href}` : `${p.name}`)
        .join('\n');
      cells.push(cellInlineStr(6, rnum, participantsText, wrapStyle));
      cells.push(cellInlineStr(7, rnum, (r.masksLines||[]).join('\n'), wrapStyle));
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
  }

})();
