(() => {
  // Работать только на нужной странице
  try {
    const u = new URL(location.href);
    if (!(u.hostname === 'testfmvoice.rusff.me' &&
          u.pathname === '/viewtopic.php' &&
          u.searchParams.get('id') === '13')) {
      return;
    }
  } catch { return; }

  // ===== НАСТРОЙКИ =====
  // ИД профилей, которых нужно пропустить (добавьте свои id)
  const EXCLUDED_PROFILE_IDS = [
    /* пример: 1, 2, 3 */
  ];
  const MAX_USER_PAGES = 200; // предохранитель

  // ===== ИНИЦИАЛИЗАЦИЯ UI =====
  const init = () => {
    const anchor = document.querySelector('#fmv-chrono-inline');
    if (!anchor) return;

    // Уже создано?
    if (document.getElementById('fmv-chrono-people-inline')) return;

    const box = document.createElement('div');
    box.id = 'fmv-chrono-people-inline';
    const btn = document.createElement('a');
    btn.id = 'fmv-chrono-people-inline-btn';
    btn.className = 'button';
    btn.href = 'javascript:void(0)';
    btn.textContent = 'Собрать персонажную хронологию';

    const note = document.createElement('span');
    note.id = 'fmv-chrono-people-inline-note';
    note.style.marginLeft = '10px';
    note.style.opacity = '0';

    box.appendChild(btn);
    box.appendChild(note);

    // Вставить сразу после #p82-content
    anchor.insertAdjacentElement('afterend', box);

    btn.addEventListener('click', async () => {
      note.style.opacity = '1';
      note.textContent = 'Собираю...';

      try {
        const episodes = parseEpisodesFromP83();
        if (!episodes.length) {
          throw new Error('Не найдена собранная хронология');
        }

        const users = await fetchAllUsers();
        const filteredUsers = users.filter(u => !EXCLUDED_PROFILE_IDS.includes(u.id));

        const html = buildChronologies(episodes, filteredUsers);

        const target = document.querySelector('#p92-content');
        if (!target) throw new Error('Не найден контейнер #p92-content');
        target.innerHTML = html || '<p>Пусто</p>';

        note.textContent = 'Готово';
      } catch (e) {
        console.error(e);
        note.textContent = 'Ошибка: ' + (e?.message || e);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // ===== ПАРСИНГ ОБЩЕЙ ХРОНОЛОГИИ =====
  function parseEpisodesFromP83() {
    const container = document.querySelector('#p83-content .quote-box blockquote');
    if (!container) return [];
    const items = container.querySelectorAll(':scope > p');

    const episodes = [];
    items.forEach(p => {
      const firstLink = p.querySelector('a[href*="viewtopic.php"]');
      if (!firstLink) return;

      // Тип/статус — первые два <span> ДО ссылки
      const spansBefore = [];
      for (const node of p.childNodes) {
        if (node === firstLink) break;
        if (node.nodeType === 1 && node.tagName === 'SPAN') spansBefore.push(node);
      }
      const type = (spansBefore[0]?.textContent || '').trim().toLowerCase();
      const status = (spansBefore[1]?.textContent || '').trim().toLowerCase();

      // Дата — между закрывающей ']' и первым '—'
      // --- извлекаем сырой фрагмент даты между ']' и последним тире перед заголовком
      const fullText = (p.textContent || '').replace(/\s+/g, ' ').trim();
      const bracketEnd = fullText.indexOf(']');
      
      const titleText = (firstLink.textContent || '').replace(/\s+/g, ' ').trim();
      const titlePos  = titleText ? fullText.indexOf(titleText) : -1;
      
      let dashIndex = -1;
      if (titlePos !== -1) {
        dashIndex = Math.max(
          fullText.lastIndexOf(' — ', titlePos),
          fullText.lastIndexOf(' – ', titlePos),
          fullText.lastIndexOf(' - ', titlePos),
          fullText.lastIndexOf('—', titlePos - 1),
          fullText.lastIndexOf('–', titlePos - 1),
          fullText.lastIndexOf('-', titlePos - 1),
        );
      } else {
        const from = Math.max(0, bracketEnd + 1);
        const candidates = [' — ', ' – ', ' - ', '—', '–', '-']
          .map(sep => fullText.indexOf(sep, from))
          .filter(i => i !== -1)
          .sort((a, b) => a - b);
        dashIndex = candidates.length ? candidates[0] : -1;
      }
      
      let rawDate = '';
      if (bracketEnd !== -1 && dashIndex !== -1 && dashIndex > bracketEnd) {
        rawDate = fullText.slice(bracketEnd + 1, dashIndex).trim();
      }
      
      // --- разбиваем диапазон и нормализуем каждую часть в числовые форматы
      const [dateStartRaw, dateEndRaw] = splitDate(rawDate);
      const dateStart = normalizeNumericDate(dateStartRaw);
      const dateEnd   = normalizeNumericDate(dateEndRaw);


      // Участники (в <i>), вместе с масками
      const iEl = p.querySelector(':scope > i');
      const participants = iEl ? parseParticipants(iEl) : [];

      // Локация — после </i> и " / "
      const location = extractLocation(p, iEl);

      episodes.push({
        type,
        status,
        dateStart,
        dateEnd,
        title: (firstLink.textContent || '').trim(),
        href: firstLink.href,
        participants,
        location
      });
    });

    return episodes;
  }

  function splitDate(s) {
    if (!s || !s.trim()) return ['не указана', 'не указана'];
    // поддержка -, – и —
    const parts = s.split(/\s*[–—-]\s*/).filter(Boolean);
    if (parts.length === 1) return [parts[0], parts[0]];
    // если несколько тире, всё правее первого считаем концом
    return [parts[0], parts.slice(1).join('—')];
  }

  // Приводит строку к одному из форматов: dd.mm.yyyy, mm.yyyy или yyyy
  // Всё остальное возвращает как есть (без «умного» распознавания).
  function normalizeNumericDate(raw) {
    if (!raw) return 'не указана';
    const s = raw.trim();
  
    // dd.mm.yyyy
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
      const d  = String(+m[1]).padStart(2, '0');
      const mo = String(+m[2]).padStart(2, '0');
      const y  = m[3];
      return `${d}.${mo}.${y}`;
    }
  
    // mm.yyyy
    m = s.match(/^(\d{1,2})\.(\d{4})$/);
    if (m) {
      const mo = String(+m[1]).padStart(2, '0');
      const y  = m[2];
      return `${mo}.${y}`;
    }
  
    // yyyy
    m = s.match(/^(\d{4})$/);
    if (m) return m[1];
  
    // Иначе — возвращаем как есть (например, если текстовый месяц)
    return s;
  }
  
  function parseParticipants(iEl) {
    const out = [];
    const kids = Array.from(iEl.childNodes);
    for (let i = 0; i < kids.length; i++) {
      const n = kids[i];
      if (n.nodeType === 1 && (n.tagName === 'A' || n.tagName === 'SPAN')) {
        const name = (n.textContent || '').trim();
        let href = null, id = null;
        if (n.tagName === 'A') {
          href = n.href;
          const m = href.match(/profile\.php\?id=(\d+)/);
          if (m) id = Number(m[1]);
        }
        // собрать текст до следующего A|SPAN — там может быть [as ...]
        let buff = '';
        let j = i + 1;
        while (j < kids.length && !(kids[j].nodeType === 1 && (kids[j].tagName === 'A' || kids[j].tagName === 'SPAN'))) {
          buff += kids[j].textContent || '';
          j++;
        }
        const m2 = buff.match(/\[as\s*([^\]]+)\]/i);
        const mask = m2 ? m2[1].trim() : null;

        out.push({ name, href, id, mask });
      }
    }
    return out;
  }

  function extractLocation(p, iEl) {
    if (!iEl) return 'не указана';
    const cn = Array.from(p.childNodes);
    const idx = cn.indexOf(iEl);
    if (idx === -1) return 'не указана';
    const after = cn.slice(idx + 1);
    const loc = after.map(n => n.textContent || '').join('').replace(/^\s*\/\s*/, '').trim();
    return loc || 'не указана';
  }

  // ===== ЗАГРУЗКА СПИСКА ПОЛЬЗОВАТЕЛЕЙ С ПАГИНАЦИЕЙ =====
  async function fetchAllUsers() {
    const map = new Map(); // id -> {id,name,href}
    for (let page = 1; page <= MAX_USER_PAGES; page++) {
      const url = page === 1 ? '/userlist.php' : `/userlist.php?p=${page}`;
      const html = await fetchHtml(url);
      if (!html) break;

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const links = Array.from(doc.querySelectorAll('a[href*="profile.php?id="]'));

      const before = map.size;
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        const m = href.match(/profile\.php\?id=(\d+)/);
        if (!m) continue;
        const id = Number(m[1]);
        if (map.has(id)) continue;
        const name = (a.textContent || '').trim();
        // отсекаем мусорные ссылки без имени
        if (!name) continue;
        map.set(id, { id, name, href: new URL(href, location.origin).href });
      }
      if (map.size === before) {
        // новая страница не дала новых профилей — дальше смысла нет
        break;
      }
    }
    // алфавит по имени (русская локаль)
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  // замените fetchHtml на вариант с явной декодировкой
  async function fetchHtml(relUrl) {
    try {
      const resp = await fetch(relUrl, { credentials: 'include' });
      if (!resp.ok) return null;
  
      const buf = await resp.arrayBuffer();
  
      // 1) попытка достать charset из заголовка
      let enc = 'utf-8';
      const ct = resp.headers.get('content-type') || '';
      const m = ct.match(/charset=([^;]+)/i);
      if (m) enc = m[1].toLowerCase();
  
      // 2) первичная декодировка
      let html = new TextDecoder(enc).decode(buf);
  
      // 3) если в <meta> указан другой charset — декодируем повторно
      const mm = html.match(/<meta[^>]+charset=["']?([\w-]+)/i);
      if (mm && mm[1] && mm[1].toLowerCase() !== enc) {
        enc = mm[1].toLowerCase();
        html = new TextDecoder(enc).decode(buf);
      }
  
      // 4) грубый fallback для русских форумов
      if (/����/.test(html) && enc === 'utf-8') {
        try { html = new TextDecoder('windows-1251').decode(buf); } catch {}
      }
  
      return html;
    } catch {
      return null;
    }
  }
  
  const nameByIdFromEpisodes = new Map();
  for (const ep of episodes) {
    for (const p of ep.participants) {
      if (p.id != null && p.name) nameByIdFromEpisodes.set(p.id, p.name);
    }
  }
  
  for (const u of filteredUsers) {
    const fixed = nameByIdFromEpisodes.get(u.id);
    if (fixed) u.name = fixed; // имя уже из DOM текущей страницы, без проблем с кодировкой
  }

  

  // ===== СБОРКА ИТОГОВОЙ РАЗМЕТКИ =====
  function buildChronologies(episodes, users) {
    // индекс эпизодов по id профиля (только те, кто отмечен ссылкой)
    const byUser = new Map();
    for (const ep of episodes) {
      const ids = ep.participants.filter(p => p.id != null).map(p => p.id);
      for (const id of ids) {
        if (!byUser.has(id)) byUser.set(id, []);
        byUser.get(id).push(ep);
      }
    }

    const frag = document.createDocumentFragment();

    for (const user of users) {
      if (EXCLUDED_PROFILE_IDS.includes(user.id)) continue;
      const eps = byUser.get(user.id);
      if (!eps || eps.length === 0) continue;

      const wrap = document.createElement('div');
      wrap.className = 'quote-box spoiler-box media-box';

      const head = document.createElement('div');
      head.setAttribute('onclick', 'toggleSpoiler(this)');
      const link = document.createElement('a');
      link.href = user.href;
      link.rel = 'nofollow';
      link.textContent = user.name;
      head.appendChild(document.createTextNode(' '));
      head.appendChild(link);

      const body = document.createElement('blockquote');

      for (const ep of eps) {
        const selfPart = ep.participants.find(p => p.id === user.id);
        const selfMask = selfPart?.mask || '';

        const others = ep.participants
          .filter(p => p.id !== user.id) // включает и тех, у кого нет id (SPAN)
          .map(p => {
            const nm = p.name;
            const mk = p.mask ? ` [as ${p.mask}]` : '';
            return nm + mk;
          })
          .join(', ');

        const pEl = document.createElement('p');
        pEl.innerHTML = [
          `тип - ${safe(ep.type) || 'не указан'}`,
          `статус - ${safe(ep.status) || 'не указан'}`,
          `дата начала - ${safe(ep.dateStart) || 'не указана'}`,
          `дата завершения - ${safe(ep.dateEnd) || 'не указана'}`,
          `название - ${safe(ep.title)}`,
          `ссылка - <a href="${ep.href}" rel="nofollow">${safe(ep.title)}</a>`,
          `маска - ${selfMask ? safe(selfMask) : '—'}`,
          `локация - ${safe(ep.location)}`,
          `участники - ${others || '—'}`
        ].join('<br>');
        body.appendChild(pEl);
      }

      wrap.appendChild(head);
      wrap.appendChild(body);
      frag.appendChild(wrap);
    }

    const holder = document.createElement('div');
    holder.appendChild(frag);
    return holder.innerHTML;
  }

  function safe(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  }
})();
