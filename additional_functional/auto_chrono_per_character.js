// auto_chrono_per_character.js
// Собирает персональные хронологии ТОЛЬКО из общей хроники (#p83-content).
// Не ходит на /userlist.php — имена и ссылки берутся из DOM текущей страницы,
// поэтому кодировка всегда корректная.
//
// Вставляет кнопку после #p82-content и кладёт результат в #p92-content.
//
// © you, 2025

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
  // ID профилей, которых нужно пропустить
  const EXCLUDED_PROFILE_IDS = [
    // пример: 1, 2, 3
  ];

  // ===== ИНИЦИАЛИЗАЦИЯ UI =====
  const init = () => {
    const anchor = document.querySelector('#fmv-chrono-inline');
    if (!anchor) return;

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

    anchor.insertAdjacentElement('afterend', box);

    btn.addEventListener('click', async () => {
      note.style.opacity = '1';
      note.textContent = 'Собираю...';

      try {
        const episodes = parseEpisodesFromP83();
        if (!episodes.length) throw new Error('Не найдена собранная хронология');

        const users = usersFromEpisodes(episodes);
        const html = buildChronologies(episodes, users);

        const target = document.querySelector('#p92-content');
        if (!target) throw new Error('Не найден комментарий для вставки');
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

  // ===== ПАРСИНГ ОБЩЕЙ ХРОНИКИ (#p83-content) =====
  function parseEpisodesFromP83() {
    const container = document.querySelector('#p83-content .quote-box blockquote');
    if (!container) return [];
    const items = container.querySelectorAll(':scope > p');

    const episodes = [];
    items.forEach(p => {
      const topicLink = p.querySelector('a[href*="viewtopic.php"]');
      if (!topicLink) return;

      // Тип/статус — первые два <span> до ссылки
      const spansBefore = [];
      for (const node of p.childNodes) {
        if (node === topicLink) break;
        if (node.nodeType === 1 && node.tagName === 'SPAN') spansBefore.push(node);
      }
      const type = (spansBefore[0]?.textContent || '').trim().toLowerCase();
      const status = (spansBefore[1]?.textContent || '').trim().toLowerCase();

      // Дата — текст между ']' и первым '—'
      const fullText = (p.textContent || '').replace(/\s+/g, ' ').trim();
      const bracketEnd = fullText.indexOf(']');
      const dashIndex = fullText.indexOf('—', Math.max(0, bracketEnd + 1));
      let rawDate = '';
      if (bracketEnd !== -1 && dashIndex !== -1 && dashIndex > bracketEnd) {
        rawDate = fullText.slice(bracketEnd + 1, dashIndex).trim();
      }
      const [dateStart, dateEnd] = splitDate(rawDate);

      // Участники с масками (элемент <i>)
      const iEl = p.querySelector(':scope > i');
      const participants = iEl ? parseParticipants(iEl) : [];

      // Локация — текст после </i> и " / "
      const location = extractLocation(p, iEl);

      episodes.push({
        type, status, dateStart, dateEnd,
        title: (topicLink.textContent || '').trim(),
        href: topicLink.href,
        participants, location
      });
    });

    return episodes;
  }

  function splitDate(s) {
    if (!s || !s.trim()) return ['не указана', 'не указана'];
    const parts = s.split('-').map(x => x.trim()).filter(Boolean);
    if (parts.length === 1) return [parts[0], parts[0]];
    return [parts[0], parts.slice(1).join('-')];
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
        // Соберём текст между этой нодой и следующей A|SPAN — там может быть [as ...]
        let buff = '';
        let j = i + 1;
        while (j < kids.length && !(kids[j].nodeType === 1 && (kids[j].tagName === 'A' || kids[j].tagName === 'SPAN'))) {
          buff += kids[j].textContent || '';
          j++;
        }
        const m2 = buff.match(/\[as\s*([^\]]+)\]/i);
        const mask = m2 ? m2[1].trim() : null;

        out.push({ id, name, href, mask });
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

  // ===== УЧАСТНИКИ ТОЛЬКО ИЗ ЭПИЗОДОВ =====
  function usersFromEpisodes(episodes) {
    const map = new Map(); // id -> { id, name, href }
    for (const ep of episodes) {
      for (const p of ep.participants) {
        if (p.id == null) continue; // нужен именно профиль (ссылка)
        if (EXCLUDED_PROFILE_IDS.includes(p.id)) continue;
        if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, href: p.href });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }

  // ===== СБОРКА ИТОГОВОЙ РАЗМЕТКИ =====
  function buildChronologies(episodes, users) {
    // Индекс эпизодов по id профиля
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
      head.appendChild(link);

      const body = document.createElement('blockquote');

      for (const ep of eps) {
        const selfPart = ep.participants.find(p => p.id === user.id);
        const selfMask = selfPart?.mask || '';

        const others = ep.participants
          .filter(p => p.id !== user.id)
          .map(p => p.name + (p.mask ? ` [as ${p.mask}]` : ''))
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
