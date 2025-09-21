/* ===================== поиск поста / блока ===================== */
function findChronoRendered(root) {
  const cand = Array.from(root.querySelectorAll('*')).find(n => /Собранная\s+хронология/i.test(n.textContent || ''));
  if (!cand) return null;
  return cand.closest('.quote-box, .media, .spoiler-box, .content, .post, div, section') || cand;
}

// --- parseParagraph: делим <p> на 4 логические строки по <br> ---
function parseParagraph(p) {
  const lines = [[], [], [], []]; // 0: дата+тема, 1: мета, 2: участники, 3: локация (+ всё остальное)
  let i = 0;
  for (const node of p.childNodes) {
    if (node.nodeType === 1 && node.tagName === 'BR') { i = Math.min(i + 1, 3); continue; }
    lines[i].push(node);
  }
  const dateTitleNodes = lines[0];
  const metaNodes      = lines[1];
  const partNodes      = lines[2];
  const locNodes       = lines[3];

  // ссылка темы — только <a href*="viewtopic.php?id="> из первой строки
  const tmp = document.createElement('div');
  dateTitleNodes.forEach(n => tmp.appendChild(n.cloneNode(true)));
  const a = tmp.querySelector('a[href*="viewtopic.php?id="]') || p.querySelector('a[href*="viewtopic.php?id="]');

  const { type, status, order, dateStart, dateEnd, title } =
    parseHeaderNew(dateTitleNodes, metaNodes, a);

  const { participants, masksLines } = parseParticipants(partNodes);
  const location = cleanLocation(textFromNodes(locNodes));

  const start = (type === 'au') ? '' : (dateStart || '');
  const end   = (type === 'au') ? '' : (dateEnd   || start || '');

  return {
    type, status,
    title, href: a?.href || '',
    dateStart: start, dateEnd: end,
    order: Number.isFinite(order) ? order : 0,
    participants, masksLines, location
  };
}

// --- parseHeaderNew: 1-я строка (дата — тема), 2-я строка ([тип / статус / порядок]) ---
function parseHeaderNew(dateTitleNodes, metaNodes, linkEl) {
  // ТЕМА: только текст из <a>
  const title = (linkEl?.textContent || '').trim();

  // 1-я строка как временный DOM
  const wrap = document.createElement('div');
  dateTitleNodes.forEach(n => wrap.appendChild(n.cloneNode(true)));
  const l1Text = (wrap.textContent || '').replace(/\s+/g, ' ').trim();

  // --- ДАТА: только если реально дата ---
  let dateStart = '', dateEnd = '';

  // (а) strong приоритетнее
  let datePart = (wrap.querySelector('strong')?.textContent || '').trim();

  if (!datePart) {
    // (б) искать дату только В НАЧАЛЕ строки
    const m = l1Text.match(/^\s*(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{1,2}\.\d{4}|\d{4})(?:\s*[-—–]\s*(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{1,2}\.\d{4}|\d{4}))?/);
    if (m) {
      dateStart = m[1];
      dateEnd   = m[2] || '';
    }
  } else {
    // распарсить диапазон из strong, если он есть
    const norm = datePart.replace(/[\u2012-\u2015\u2212—–−]/g, '-').replace(/\s*-\s*/g, '-');
    const duo = norm.split('-').slice(0, 2).map(s => s.trim());
    dateStart = duo[0] || '';
    dateEnd   = duo[1] || '';
  }

  // если встречается "дата не указана" — пусто
  if (/дата\s+не\s+указан/i.test(datePart || '')) { dateStart = ''; dateEnd = ''; }

  // --- МЕТА: [тип / статус / порядок] — 2-я строка
  const metaText = textFromNodes(metaNodes);
  let type = '', status = '', order = 0;
  const box = metaText.match(/\[([^\]]+)\]/);
  if (box) {
    const parts = box[1].split('/').map(s => s.trim());
    type   = (parts[0] || '').toLowerCase();
    status = (parts[1] || '').toLowerCase();
    if (parts[2]) { const n = parseInt(parts[2], 10); if (Number.isFinite(n)) order = n; }
  }

  return { type, status, order, dateStart, dateEnd, title };
}

function parseParticipants(nodes) {
  // расплющим DOM в токены "link" и "text"
  const toks = [];
  (function flat(nl){
    Array.from(nl).forEach(n => {
      if (n.nodeType === 3) toks.push({ t:'text', v:n.nodeValue || '' });
      else if (n.nodeType === 1) {
        if (n.tagName === 'A') toks.push({ t:'link', name:(n.textContent||'').trim(), href:n.href||'' });
        else flat(n.childNodes);
      }
    });
  })(nodes);

  const participants = [];            // {name, href}
  const maskMap = new Map();          // name -> [mask,...]
  let lastName = null;

  const addMask = (name, list) => {
    if (!name || !list || !list.length) return;
    if (!maskMap.has(name)) maskMap.set(name, []);
    maskMap.get(name).push(...list);
  };

  for (const tk of toks) {
    if (tk.t === 'link') {
      const name = tk.name;
      participants.push({ name, href: tk.href });
      lastName = name;
      continue;
    }

    if (tk.t === 'text') {
      let t = tk.v || '';
      // если встречаем "не указаны" — обе колонки пустые
      if (/\bне\s*указан/i.test(t)) return { participants: [], masksLines: [] };

      // вытащить маски и привязать к последнему участнику
      t = t.replace(/\[\s*as\s*([^\]]+)\]/ig, (_m, g) => {
        const arr = g.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
        addMask(lastName, arr);
        return ''; // удалить из текста
      });

      // оставшиеся имена (без масок) через запятую
      t.split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
        if (/^[–—-]+$/.test(name)) return;                 // мусорные тире
        if (/^\[.*\]$/.test(name)) return;                 // остаточные скобки
        participants.push({ name, href: '' });
        lastName = name;
      });
    }
  }

  // собрать строки для колонки "Маски" (по одной маске в строке)
  const masksLines = [];
  for (const p of participants) {
    const arr = maskMap.get(p.name);
    if (arr && arr.length) arr.forEach(msk => masksLines.push(`${p.name} — ${msk}`));
  }

  return { participants, masksLines };
}
function cleanLocation(s) {
  const t=String(s||'').trim();
  if (!t) return '';
  if (/^локац/i.test(t) && /не\s+указан/i.test(t)) return '';
  if (/^не\s+указан/i.test(t)) return '';
  return t;
}

/**
   * Собирает словарь: userId -> [episodes...]
   * Учитывает только участников со ссылкой на профиль (/profile.php?id=...).
   * Текстовые ники (без ссылки) полностью игнорируются.
   *
   * @param {Object} [opts]
   * @param {string|number} [opts.topicId]      - id темы; по умолчанию из CHRONO_CHECK.ChronoTopicID
   * @param {string|number} [opts.postId]       - id поста; по умолчанию из CHRONO_CHECK.TotalChronoPostID
   * @param {Array<number|string>} [opts.groupIds] - допустимые группы; по умолчанию CHRONO_CHECK.GroupID
   * @param {Array<string|number>} [opts.forumIds] - допустимые форумы; по умолчанию CHRONO_CHECK.AmsForumID
   * @param {boolean} [opts.respectAccess=true] - выполнять проверки доступа (группа/форум/тема), если есть хелперы
   * @returns {Promise<Object>} словарь { "<userId>": Episode[] }
   */
/**
 * collectChronoByUser
 * Возвращает объект { "<userId>": { name: <имя профиля>, episodes: Episode[] } }
 */
async function collectChronoByUser(opts = {}) {
  const GID = (opts.groupIds ?? window.CHRONO_CHECK?.GroupID ?? []).map(Number);
  const FID = (opts.forumIds ?? window.CHRONO_CHECK?.AmsForumID ?? []).map(String);
  const TID = String(opts.topicId ?? window.CHRONO_CHECK?.ChronoTopicID ?? '').trim();
  const PID = String(opts.postId  ?? window.CHRONO_CHECK?.TotalChronoPostID ?? '').trim();

  if (!TID || !PID) throw new Error('Нужны topicId и postId');

  const fetchDoc            = window.FMV?.fetchDoc || window.fetchDoc;
  const parseFromScriptHTML = window.parseFromScriptHTML;
  const parseFromRendered   = window.parseFromRendered;
  const findPostNode        = window.findPostNode;
  const findChronoRendered  = window.findChronoRendered;

  const OPEN_URL = new URL(`/viewtopic.php?id=${TID}#p${PID}`, window.location.href);

  const pickIdFromHref = (href) => {
    if (!href) return null;
    try {
      const u = new URL(href, window.location.href);
      if (!/profile\.php/i.test(u.pathname)) return null;
      return (u.searchParams.get('id') || '').trim() || null;
    } catch { return null; }
  };

  function makeMasksMap(lines = []) {
    const m = new Map();
    for (const line of lines) {
      const [rawName, ...rest] = String(line).split('—');
      const name = rawName?.trim();
      const mask = rest.join('—').trim();
      if (!name || !mask) continue;
      const arr = m.get(name) || [];
      if (!arr.includes(mask)) arr.push(mask);
      m.set(name, arr);
    }
    return m;
  }

  function normalizeParticipants(participants = [], masksMap) {
    return participants
      .map(p => {
        const id = pickIdFromHref(p.href || '');
        if (!id) return null;
        return { id, name: p.name || '', masks: masksMap.get(p.name) || [] };
      })
      .filter(Boolean);
  }

  async function loadRows() {
    const doc = await fetchDoc(OPEN_URL.href);
    let post = (typeof findPostNode === 'function') ? findPostNode(doc, PID) : null;
    if (!post) post = doc.getElementById(`p${PID}`) || doc.querySelector(`#p${PID}, [id="p${PID}"]`);
    if (!post) throw new Error(`Не нашёл пост #${PID}`);

    const root =
      post.querySelector('.post-content, .postmsg, .entry-content, .content, .post-body, .post') || post;

    const tpl = root.querySelector(
      '.quote-box.spoiler-box.media-box script[type="text/html"], ' +
      '.spoiler-box script[type="text/html"], ' +
      '.media-box script[type="text/html"]'
    );
    if (tpl?.textContent && typeof parseFromScriptHTML === 'function') {
      return parseFromScriptHTML(tpl.textContent);
    }
    const rendered =
      (typeof findChronoRendered === 'function' && findChronoRendered(root)) || root;

    return parseFromRendered(rendered);
  }

  const rows = await loadRows();
  const byUser = Object.create(null);

  rows.forEach((r, idx) => { r.__sourceOrder = idx; });

  for (const r of rows) {
    const masksMap = makeMasksMap(r.masksLines || []);
    const people   = normalizeParticipants(r.participants || [], masksMap);

    for (const self of people) {
      const others = people
        .filter(p => p !== self)
        .map(p => ({ id: p.id, name: p.name, masks: p.masks }));

      const episode = {
        dateStart: r.dateStart || '',
        dateEnd:   r.dateEnd || (r.dateStart || ''),
        type:      r.type || '',
        status:    r.status || '',
        title:     r.title || '',
        href:      r.href || '',
        order:     Number(r.order ?? r.__sourceOrder ?? 0),
        location:  r.location || '',
        masks:     self.masks || [],   // маски владельца
        participants: others
      };

      if (!byUser[self.id]) {
        byUser[self.id] = { name: self.name, episodes: [] };
      }
      byUser[self.id].episodes.push(episode);
    }
  }

  return byUser;
}
