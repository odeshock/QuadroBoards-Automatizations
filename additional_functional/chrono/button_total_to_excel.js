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
    label: 'выгрузить Excel',
    order: 56,

    showStatus: true,
    showDetails: true,
    showLink: true,      // <a> создаём сразу; видимость контролируем setLink('', '')
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

        // 1) сначала пробуем «истинный» контент в <script type="text/html"> внутри спойлера
        let parsedEvents = [];
        const scriptTpl = root.querySelector('.quote-box.spoiler-box.media-box script[type="text/html"], .spoiler-box script[type="text/html"], .media-box script[type="text/html"]');
        if (scriptTpl && scriptTpl.textContent) {
          parsedEvents = parseFromScriptHTML(scriptTpl.textContent);
        }

        // 2) если нет — пытаемся разобрать отрендеренный блок
        if (!parsedEvents.length) {
          const media = findChronoRendered(root) || root;
          parsedEvents = parseFromRendered(media);
        }

        if (!parsedEvents.length) throw new Error('Не удалось найти блок «Собранная хронология».');

        setStatus('Формирую файл…');
        const { blob, filename } = buildSpreadsheetML(parsedEvents);

        if (lastBlobUrl) { try { URL.revokeObjectURL(lastBlobUrl); } catch {} }
        lastBlobUrl = URL.createObjectURL(blob);

        setStatus('Готово');
        setLink(lastBlobUrl, 'скачать');
        const a = api?.wrap?.querySelector('a.fmv-action-link');
        if (a) a.setAttribute('download', filename);

        setDetails(`<b>Строк:</b> ${parsedEvents.length}<br><b>Источник:</b> <a href="${FMV.escapeHtml(OPEN_URL)}" target="_blank">комментарий</a><br><b>Файл:</b> ${FMV.escapeHtml(filename)}`);
      } catch (e) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        api?.setLink?.('', '');
      }
    }
  });

  /* ============ Поиск поста и блока ============ */

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
    // ищем контейнер, в котором видна надпись «Собранная хронология»
    const cand = Array.from(root.querySelectorAll('*')).find(n => /Собранная\s+хронология/i.test(n.textContent || ''));
    if (!cand) return null;
    return cand.closest('.quote-box, .media, .spoiler-box, .content, .post, div, section') || cand;
  }

  /* ============ Парсинг из <script type="text/html"> ============ */

  function parseFromScriptHTML(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${htmlText}</div>`, 'text/html');
    const wrap = doc.body.firstElementChild;
    const result = [];
    wrap.querySelectorAll('p').forEach(p => {
      result.push(parseParagraph(p));
    });
    return result.filter(Boolean);
  }

  /* ============ Парсинг из отрендерённого HTML (fallback) ============ */

  function parseFromRendered(container) {
    // каждая запись — это <p> … <br> … <br> …
    const ps = container.querySelectorAll('p');
    if (ps.length) {
      return Array.from(ps).map(parseParagraph).filter(Boolean);
    }
    // если <p> нет — резанём по двойным <br>
    const html = container.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    return html.split(/\n{2,}/).map(chunk => {
      const div = document.createElement('div');
      div.innerHTML = `<p>${chunk}</p>`;
      return parseParagraph(div.firstElementChild);
    }).filter(Boolean);
  }

  /* ============ Разбор одного <p> ============ */

  function parseParagraph(p) {
    // разложим на «три строки»: заголовок / участники / локация
    const headNodes = [];
    const partNodes = [];
    const locNodes  = [];
    let mode = 'head';
    for (const node of p.childNodes) {
      if (node.nodeType === 1 && node.tagName === 'BR') { // переключаемся на следующую «строку»
        mode = (mode === 'head') ? 'part' : (mode === 'part' ? 'loc' : 'loc');
        continue;
      }
      if (mode === 'head') headNodes.push(node);
      else if (mode === 'part') partNodes.push(node);
      else locNodes.push(node);
    }

    // --- заголовок ---
    const a = p.querySelector('a[href*="viewtopic.php?id="]');
    const { type, status, dateStart, dateEnd, order } = parseHeader(headNodes);
    // название и ссылка
    const title = (a?.textContent || '').trim();
    const href  = a?.href || '';

    // --- участники + маски ---
    const { participantsHtml, masksHtml } = parseParticipants(partNodes);

    // --- локация ---
    const location = cleanLocation(textFromNodes(locNodes));

    // правила заполнения для дат
    const start = (type === 'au') ? '' : (dateStart || '');
    const end   = (type === 'au') ? '' : (dateEnd   || start || '');

    return {
      type, status, title, href,
      dateStart: start,
      dateEnd: end,
      order: Number.isFinite(order) ? order : 0,
      participantsHtml,
      masksHtml,
      location
    };
  }

  function parseHeader(nodes) {
    const text = textFromNodes(nodes);
    // [Тип / Статус]
    let type = '', status = '';
    const mTS = text.match(/^\s*\[([^\]]+)\]/);
    if (mTS) {
      const pair = mTS[1].split('/').map(s => s.trim().toLowerCase());
      type   = pair[0] || '';
      status = pair[1] || '';
    }

    // порядок
    const mOrd = text.match(/\[\s*порядок:\s*(\d+)\s*\]/i);
    const order = mOrd ? parseInt(mOrd[1], 10) : 0;

    // «после [type/status]» и до « — »
    let tail = text.replace(/^\s*\[[^\]]+\]\s*/,'').trim();
    let datePart = '';
    const mdash = tail.indexOf(' — ');
    const ndash = tail.indexOf(' - ');
    const pos   = (mdash >= 0) ? mdash : (ndash >= 0 ? ndash : -1);
    if (pos >= 0) {
      datePart = tail.slice(0, pos).trim();
    } else {
      // для AU даты нет вовсе
      datePart = '';
    }

    // «дата не указана» → считаем пустой
    if (/дата\s+не\s+указан/i.test(datePart)) datePart = '';

    let dateStart = '', dateEnd = '';
    if (datePart) {
      const norm = datePart.replace(/[\u2012-\u2015\u2212—–−]/g, '-').replace(/\s*-\s*/g, '-');
      const duo = norm.split('-').slice(0,2);
      if (duo.length === 1) { dateStart = duo[0]; }
      else { dateStart = duo[0]; dateEnd = duo[1]; }
    }
    return { type, status, dateStart, dateEnd, order };
  }

  function parseParticipants(nodes) {
    const parts = [];
    let cur = null;
    const push = () => { if (cur) { parts.push(cur); cur = null; } };

    for (const node of nodes) {
      if (node.nodeType === 3) { // text
        const t = node.nodeValue || '';
        if (/^\s*,\s*$/.test(t)) { push(); continue; } // разделитель элементов
        const m = t.match(/\[\s*as\s+([^\]]+)\]/i);
        if (m && cur) {
          const masks = m[1].split(/\s*,\s*/).filter(Boolean);
          cur.masks.push(...masks);
        } else if (/\S/.test(t) && !cur) {
          cur = { name: t.trim(), href: '', masks: [] };
        }
        continue;
      }
      if (node.nodeType === 1) {
        const el = node;
        if (el.tagName === 'A') {
          push();
          cur = { name: (el.textContent||'').trim(), href: el.href || '', masks: [] };
          continue;
        }
        if (/^(SPAN|MARK)$/i.test(el.tagName)) {
          const name = (el.textContent||'').trim();
          if (name) { push(); cur = { name, href:'', masks: [] }; }
        }
      }
    }
    push();

    // HTML для ячеек (с переносами строк)
    const participantsHtml = parts
      .map(p => p.href ? `<a href="${FMV.escapeHtml(p.href)}">${FMV.escapeHtml(p.name)}</a>` : FMV.escapeHtml(p.name))
      .join('\n'); // реальный перевод строки

    const masksHtml = parts
      .filter(p => p.masks.length)
      .map(p => `${FMV.escapeHtml(p.name)} — ${FMV.escapeHtml(p.masks.join(', '))}`)
      .join('\n');

    return { participantsHtml, masksHtml };
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

  /* ============ Генерация SpreadsheetML (XML Excel 2003) ============ */

  function buildSpreadsheetML(rows) {
    const xmlEsc = s => String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&apos;');

    const makeCell = (txt, href=null, wrap=false) => {
      const wrapAttr = wrap ? ' ss:StyleID="wrap"' : '';
      const hrefAttr = href ? ` ss:HRef="${xmlEsc(href)}"` : '';
      // Excel понимает \n внутри Data при WrapText=1
      return `<Cell${hrefAttr}${wrapAttr}><Data ss:Type="String">${xmlEsc(txt)}</Data></Cell>`;
    };

    const header =
`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="wrap"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
  <Style ss:ID="head"><Font ss:Bold="1"/><Alignment ss:Vertical="Top"/></Style>
 </Styles>
 <Worksheet ss:Name="Лист 1">
  <Table x:FullColumns="1" x:FullRows="1">`;

    const headRow =
`   <Row ss:StyleID="head">
    ${makeCell('Тип')}${makeCell('Статус')}${makeCell('Тема')}
    ${makeCell('Дата начала')}${makeCell('Дата конца')}${makeCell('Порядок')}
    ${makeCell('Участники')}${makeCell('Маски')}${makeCell('Локация')}
   </Row>`;

    const bodyRows = rows.map(r => {
      return `   <Row>
    ${makeCell(r.type)}${makeCell(r.status)}${makeCell(r.title, r.href)}
    ${makeCell(r.dateStart)}${makeCell(r.dateEnd)}${makeCell(String(r.order))}
    ${makeCell(r.participantsHtml, null, true)}
    ${makeCell(r.masksHtml, null, true)}
    ${makeCell(r.location, null, true)}
   </Row>`;
    }).join('\n');

    const footer =
`  </Table>
 </Worksheet>
</Workbook>`;

    const xml = [header, headRow, bodyRows, footer].join('\n');
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const filename = `chronology_${new Date().toISOString().slice(0,10)}.xml`; // SpreadsheetML
    return { blob, filename };
  }

})();
