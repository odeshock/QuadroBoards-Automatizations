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
    showLink: true,          // <a> создаётся; видимость контролируем setLink('', '')
    linkText: 'скачать',
    linkHref: '',

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});

      // скрыть линк на время работы
      setLink('', '');

      try {
        setStatus('Загружаю комментарий…');
        setDetails('');

        /* 1) тянем страницу с постом и находим сам пост */
        const doc = await FMV.fetchDoc(OPEN_URL);
        const post = findPostNode(doc, PID);
        if (!post) throw new Error(`Не нашёл пост #${PID}`);

        /* 2) выдёргиваем «медиаблок» с хронологией (или берём весь контент поста) */
        const content = post.querySelector('.post-content, .postmsg, .entry-content, .content, .post-body, .post') || post;
        const media = findChronoBlock(content) || content;

        /* 3) размечаем строки (header / participants / location) и разбираем по шаблону */
        setStatus('Парсю…');
        const events = parseChronoFromRendered(media);

        /* 4) готовим Excel (HTML-XLS) */
        setStatus('Формирую файл…');
        const { blob, filename } = buildXls(events);

        if (lastBlobUrl) { try { URL.revokeObjectURL(lastBlobUrl); } catch {} }
        lastBlobUrl = URL.createObjectURL(blob);

        /* 5) успех — показываем ссылку */
        setStatus('Готово');
        setLink(lastBlobUrl, 'скачать');

        // дать имя через download=
        const a = api?.wrap?.querySelector('a.fmv-action-link');
        if (a) a.setAttribute('download', filename);

        setDetails(`<b>Строк:</b> ${events.length}<br><b>Источник:</b> <a href="${FMV.escapeHtml(OPEN_URL)}" target="_blank">комментарий</a><br><b>Файл:</b> ${FMV.escapeHtml(filename)}`);

      } catch (err) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(err?.message || String(err)));
        setLink('', '');
      }
    }
  });

  /* ===================== ПОИСК ПОСТА / БЛОКА ===================== */

  function findPostNode(doc, pid) {
    const id = `p${pid}`;
    let node = doc.getElementById(id);
    if (node) return node;
    // иногда якорь <a name="p123">
    const a = doc.querySelector(`a[name="${id}"]`);
    if (a) return a.closest('.post') || a.closest('.blockpost') || a.parentElement;
    // fallback: любой узел, чей id начинается с p{pid}
    node = doc.querySelector(`[id^="p${pid}"]`);
    return node;
  }

  function findChronoBlock(root) {
    // блок с заголовком «Собранная хронология»
    const candidates = Array.from(root.querySelectorAll('*'))
      .filter(n => /Собранная\s+хронология/i.test(n.textContent || ''));
    // выбираем ближайший «контейнер» с множеством <br> и ссылок
    for (const n of candidates) {
      const box = n.closest('.quotebox, .media, .codebox, .content, .post, div, section') || n;
      const brs = box.querySelectorAll('br').length;
      const links = box.querySelectorAll('a[href]').length;
      if (brs >= 3 && links >= 1) return box;
    }
    return null;
  }

  /* ===================== РАЗБОР С РЕНДЕРЕННОГО HTML ===================== */

  function parseChronoFromRendered(container) {
    // плоская раскладка: узлы и маркеры BR
    const flat = [];
    (function walk(node){
      for (const ch of node.childNodes) {
        if (ch.nodeType === 1) { // element
          const tag = ch.tagName;
          if (tag === 'BR') { flat.push({t:'br'}); continue; }
          if (/^(P|DIV|SECTION|UL|OL|LI|H\d)$/i.test(tag)) { flat.push({t:'br'}); walk(ch); flat.push({t:'br'}); continue; }
          flat.push({t:'el', el: ch});
          if (ch.firstChild) walk(ch);
        } else if (ch.nodeType === 3) { // text
          const txt = ch.nodeValue;
          if (txt) flat.push({t:'text', node: ch});
        }
      }
    })(container);

    // все ссылки на viewtopic — это заголовки эпизодов
    const headLinks = Array.from(container.querySelectorAll('a[href*="viewtopic.php?id="]'));

    const events = [];
    for (const a of headLinks) {
      // найдём «линию» вокруг ссылки: от предыдущего BR до следующего BR
      const idx = flat.findIndex(x => x.t === 'el' && x.el === a);
      if (idx < 0) continue;

      const headStart = findBoundary(flat, idx, -1);
      const headEnd   = findBoundary(flat, idx, +1);

      const headNodes = flat.slice(headStart+1, headEnd)  // узлы первой строки
                            .filter(x => x.t !== 'br');

      // вторая строка (участники): от headEnd до следующего BR
      const pStart = headEnd;
      const pEnd   = findBoundary(flat, pStart, +1);
      const partNodes = flat.slice(pStart+1, pEnd).filter(x => x.t !== 'br');

      // третья строка (локация): от pEnd до следующего BR
      const lStart = pEnd;
      const lEnd   = findBoundary(flat, lStart, +1);
      const locNodes = flat.slice(lStart+1, lEnd).filter(x => x.t !== 'br');

      const header = parseHeaderLine(headNodes, a);
      const { participantsHtml, masksHtml } = parseParticipants(partNodes);
      const location = cleanLocation(textFromNodes(locNodes));

      events.push({
        type: header.type,
        status: header.status,
        title: header.title,
        href: header.href,
        dateStart: header.dateStart,
        dateEnd: header.dateEnd,
        order: header.order,
        participantsHtml,
        masksHtml,
        location
      });
    }
    return events;
  }

  function findBoundary(flat, i, dir) {
    for (let k = i; k >= 0 && k < flat.length; k += dir) {
      if (k !== i && flat[k].t === 'br') return k;
    }
    // если не нашли — край
    return dir < 0 ? -1 : flat.length;
  }

  function textFromNodes(nodes) {
    return nodes.map(x => {
      if (x.t === 'text') return x.node.nodeValue;
      if (x.t === 'el') return x.el.tagName === 'A' ? x.el.textContent : x.el.textContent;
      return '';
    }).join('').replace(/\s+/g,' ').trim();
  }

  function parseHeaderLine(nodes, a) {
    // общий текст первой строки (без ссылок тоже берём — они в nodes)
    const fullText = nodes.map(x => x.t==='text' ? x.node.nodeValue : (x.t==='el' ? x.el.textContent : ''))
                          .join('').replace(/\s+/g,' ').trim();

    // [Тип / Статус]
    let type = '', status = '';
    const mTS = fullText.match(/^\s*\[([^\]]+)\]/);
    if (mTS) {
      const pair = mTS[1].split('/').map(s => s.trim().toLowerCase());
      type   = pair[0] || '';
      status = pair[1] || '';
    }

    // дата: между ] и длинным тире (если оно есть)
    let afterTS = fullText.replace(/^\s*\[[^\]]+\]\s*/,'');   // после [type/status]
    let datePart = '';
    const mdash = afterTS.match(/\s[—-]\s/); // ' — ' или ' - '
    if (mdash) {
      datePart = afterTS.slice(0, mdash.index).trim();
    } else {
      // для au даты нет — пусто
      datePart = '';
    }

    // порядок
    const mOrd = fullText.match(/\[\s*порядок:\s*(\d+)\s*\]/i);
    const order = mOrd ? parseInt(mOrd[1], 10) : 0;

    // название — текст линка; ссылка — href
    const title = (a.textContent || '').trim();
    const href  = a.href;

    // разбивка даты на начало/конец
    let dateStart = '', dateEnd = '';
    if (datePart) {
      const norm = datePart.replace(/[\u2012-\u2015\u2212—–−]/g, '-').replace(/\s*-\s*/g, '-');
      const duo  = norm.split('-').slice(0,2);
      if (duo.length === 1) {
        dateStart = duo[0];
        dateEnd   = ''; // по правилу ниже при выгрузке продублируем
      } else {
        dateStart = duo[0];
        dateEnd   = duo[1];
      }
    }
    // если дата конца не указана — дублируем начало
    if (dateStart && !dateEnd) dateEnd = dateStart;

    // убрать «подсказки» типа [mark]…[/mark] из заголовка мы и так не тащим — берём чистый текст ссылки

    return { type, status, title, href, dateStart, dateEnd, order };
  }

  function parseParticipants(nodes) {
    // перебираем узлы до <br>, выделяем «записи», разделённые запятыми верхнего уровня
    const parts = [];
    let cur = null;

    function pushCur() { if (cur) { parts.push(cur); cur = null; } }

    for (const x of nodes) {
      if (x.t === 'text') {
        const t = x.node.nodeValue;
        if (!t) continue;
        // запятая — разделитель
        if (/^\s*,\s*$/.test(t)) { pushCur(); continue; }
        // маски вида ' [as ...]'
        const m = t.match(/\[\s*as\s+([^\]]+)\]/i);
        if (m && cur) {
          const masks = m[1].split(/\s*,\s*/).filter(Boolean);
          cur.masks.push(...masks);
        }
        // голый текст имени (редкий случай) — заведём участника
        if (!m && /\S/.test(t) && !cur) {
          cur = { name: t.trim(), href: '', masks: [] };
        }
        continue;
      }

      if (x.t === 'el') {
        const el = x.el;
        if (el.tagName === 'A') {
          // новый участник с ссылкой
          pushCur();
          cur = { name: (el.textContent||'').trim(), href: el.href || '', masks: [] };
          continue;
        }
        // «пропавший» участник (span/mark)
        if (/^(SPAN|MARK)$/i.test(el.tagName)) {
          const name = (el.textContent||'').trim();
          if (name) { pushCur(); cur = { name, href:'', masks: [] }; }
          continue;
        }
        // прочие узлы игнорим (em/strong и т.п.)
      }
    }
    pushCur();

    // преобразуем в HTML для ячеек (с переносами строк)
    const participantsHtml = parts
      .map(p => p.href ? `<a href="${FMV.escapeHtml(p.href)}">${FMV.escapeHtml(p.name)}</a>` : FMV.escapeHtml(p.name))
      .join('<br>');

    const masksHtml = parts
      .filter(p => p.masks.length)
      .map(p => `${FMV.escapeHtml(p.name)} — ${FMV.escapeHtml(p.masks.join(', '))}`)
      .join('<br>');

    return { participantsHtml, masksHtml };
  }

  function cleanLocation(s) {
    const t = String(s || '').trim();
    if (!t) return '';
    if (/^локац/i.test(t) && /не\s+указан/i.test(t)) return '';
    if (/^не\s+указан/i.test(t)) return '';
    return t;
  }

  /* ===================== EXCEL (HTML-XLS) ===================== */

  function buildXls(events) {
    // колонки: Тип, Статус, Тема, Дата начала, Дата конца, Порядок, Участники, Маски, Локация
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const rows = events.map(e => {
      const topicLink = e.href
        ? `<a href="${esc(e.href)}">${esc(e.title)}</a>`
        : esc(e.title);

      return `<tr>
        <td>${esc(e.type)}</td>
        <td>${esc(e.status)}</td>
        <td>${topicLink}</td>
        <td>${esc(e.dateStart || '')}</td>
        <td>${esc(e.dateEnd || (e.dateStart || ''))}</td>
        <td>${esc(e.order ?? 0)}</td>
        <td>${e.participantsHtml || ''}</td>
        <td>${e.masksHtml || ''}</td>
        <td>${esc(e.location || '')}</td>
      </tr>`;
    }).join('');

    const html =
`<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
<style>
  table{border-collapse:collapse;font-size:12px;font-family:Inter,Arial,sans-serif}
  th,td{border:1px solid #ccc;padding:4px 6px;vertical-align:top}
  th{background:#f5f5f5}
  a{color:#1155cc;text-decoration:underline}
</style>
</head><body>
<table>
  <thead><tr>
    <th>Тип</th>
    <th>Статус</th>
    <th>Тема</th>
    <th>Дата начала</th>
    <th>Дата конца</th>
    <th>Порядок</th>
    <th>Участники</th>
    <th>Маски</th>
    <th>Локация</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const filename = `chronology_${new Date().toISOString().slice(0,10)}.xls`;
    return { blob, filename };
  }

})();
