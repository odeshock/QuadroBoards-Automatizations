// button_collect_chrono_to_media.js
(() => {
  'use strict';

  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const TARGET_PID = String(window.CHRONO_CHECK?.PerPersonChronoPostID || '').trim();
  const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');

  if (!GID.length || !FID.length || !TID || !TARGET_PID) {
    console.warn('[collect_chrono_to_media] нужны CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, PerPersonChronoPostID');
    return;
  }
  if (typeof window.createForumButton !== 'function') {
    console.warn('[collect_chrono_to_media] createForumButton не найден');
    return;
  }
  if (typeof window.collectChronoByUser !== 'function') {
    console.warn('[collect_chrono_to_media] collectChronoByUser не найден (подключи parser.js с функцией)');
    return;
  }

  // ---- форматтеры ----
  const lc = (s) => String(s || '').trim();

  function formatDateRangeBold(start, end) {
    const s = lc(start);
    const e = lc(end);
    if (!s && !e) return '';         // обе пустые — строку дат не печатаем
    if (!e || e === s) return `[b]${s}[/b]`;        // только начало
    return `[b]${s}-${e}[/b]`;                      // диапазон
  }

  function formatParticipantsLine(arr = []) {
    if (!arr.length) return '';
    const items = arr.map(p => {
      const masks = (p.masks && p.masks.length) ? ` [as ${p.masks.join(', ')}]` : '';
      return `${p.name}${masks}`;
    });
    return `[i]${items.join(', ')}[/i]`;
  }

  function formatEpisode(ep) {
    const parts = [];
    const dateChunk = formatDateRangeBold(ep.dateStart, ep.dateEnd);
    const linkTitle = `[url=${lc(ep.href)}]${lc(ep.title) || lc(ep.href)}[/url]`;

    // заголовок: дата (если есть) + « — » + ссылка-название
    parts.push(dateChunk ? `${dateChunk} — ${linkTitle}` : `${linkTitle}`);

    // метаданные
    parts.push(`[${lc(ep.type)} / ${lc(ep.status)} / ${Number(ep.order) || 0}]`);

    // участники (другие)
    const ppl = formatParticipantsLine(ep.participants || []);
    if (ppl) parts.push(ppl);

    // локация
    if (lc(ep.location)) parts.push(lc(ep.location));

    return parts.join('\n');
  }

  function buildMediaBlock(name, episodes = []) {
    const nameLink = `[url=${SITE_URL}/viewtopic.php?id=${TID}]${lc(name)}[/url]`;
    const inner = episodes.map(formatEpisode).join('\n\n');
    return `[media="${nameLink}"]\n${inner}\n[/media]`;
  }

  // ---- запись текста в пост ----
  async function writeToPost(pid, html) {
    // предпочитаем уже существующие хелперы из твоих модулей
    if (window.FMV?.updatePost) {
      return await window.FMV.updatePost({ postId: pid, html });
    }
    if (typeof window.updatePostText === 'function') {
      return await window.updatePostText(pid, html);
    }
    if (window.FMV?.savePostHtml) {
      return await window.FMV.savePostHtml(pid, html);
    }
    // если у тебя другой хелпер — поменяй имя тут на свой
    throw new Error('Не найден хелпер для обновления поста (FMV.updatePost / updatePostText / FMV.savePostHtml).');
  }

  // ---- сама кнопка ----
  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить хроно по персонажу',
    order: 3,
    showStatus: true,
    showDetails: true,
    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});

      try {
        setStatus('Собираю…');
        setDetails('');

        // 1) словарь userId -> { name, episodes }
        const byUser = await window.collectChronoByUser();

        // 2) в массив и сортировка по name
        const users = Object.entries(byUser)
          .map(([id, v]) => ({ id, name: v.name || '', episodes: v.episodes || [] }))
          .filter(u => u.name) // на всякий случай
          .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));

        if (!users.length) {
          setStatus('Пусто');
          setDetails('Нет данных для вывода.');
          return;
        }

        setStatus('Формирую текст…');

        // 3) текст по шаблону
        const blocks = users.map(u => buildMediaBlock(u.name, u.episodes));
        const output = blocks.join('\n\n');

        // 4) записываем в пост
        setStatus('Записываю в пост…');
        await writeToPost(TARGET_PID, output);

        setStatus('Готово ✅');
        setDetails(output);

        // 5) предложить открыть ссылку на пост
        const url = `${SITE_URL}/viewtopic.php?id=${TID}#p${TARGET_PID}`;
        if (confirm('Открыть пост с результатом?')) {
          window.open(url, '_blank', 'noopener');
        }
      } catch (err) {
        setStatus('Ошибка');
        setDetails((window.FMV?.escapeHtmlShort || String)(err?.message || String(err)));
      }
    }
  });

})();
