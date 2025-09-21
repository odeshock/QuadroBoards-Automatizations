// button_update_total — просто собирает данные и пишет в пост
(() => {
  'use strict';

  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();
  const OPEN_URL = new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href).href;

  if (!GID.length || !FID.length || !TID || !PID) return;

  const SECTIONS = Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
    ? window.CHRONO_CHECK.ForumInfo
    : [];

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить общее хроно',
    order: 1,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Открыть ссылку',
    linkHref: OPEN_URL,

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});
      const setLinkVis = api?.setLinkVisible || (()=>{});

      try {
        setStatus('Собираю…');
        setDetails('');
        setLink('', ''); setLinkVis(false);

        // 1) собираем эпизоды через парсер
        const episodes = await collectEpisodesFromForums({ sections: SECTIONS });

        // 2) рендерим общий блок
        const rows = (episodes || []).map(e => {
          const date = e.dateStart
            ? `[b]${FMV.escapeHtml(e.dateEnd && e.dateEnd !== e.dateStart
                 ? `${e.dateStart}-${e.dateEnd}` : e.dateStart)}[/b]`
            : `[mark]дата не указана[/mark]`;
          const title = `[url=${FMV.escapeHtml(e.href || '')}]${FMV.escapeHtml(e.title || '')}[/url]`;
          const status = renderStatus(e.type, e.status);
          const order  = FMV.escapeHtml(String(e.order ?? 0));
          const names  = (e.participants || []).map(p =>
            p.id ? userLink(p.id, p.name) : missingUser(p.name)
          ).join(', ') || '[mark]не указаны[/mark]';
          const loc    = e.location ? FMV.escapeHtml(e.location) : '[mark]локация не указана[/mark]';
          const mark   = e.isTitleNormalized ? '' :
                         (e.type === 'au' ? ' [mark]нет [au][/mark]' : ' [mark]нет [с][/mark]');
          return `${date} — ${title}${mark}\n${status} / [${order}]\n[i]${names}[/i]\n${loc}\n\n`;
        }).join('');

        const bbcode = `[media="Общая хронология"]${rows}[/media]`;

        // 3) записываем в целевой пост
        setStatus('Записываю…');
        const html = FMV.toCp1251Entities(bbcode);
        const res  = await FMV.replaceComment(GID, PID, html);

        const ok = !!res?.ok || String(res?.status).toLowerCase() === 'ok';
        setStatus(ok ? 'Готово' : 'Ошибка');
        if (ok) { setLink(OPEN_URL, 'Открыть ссылку'); setLinkVis(true); }

        const info  = (res?.infoMessage || '').replace(/<[^>]*>/g,' ').trim();
        const error = (res?.errorMessage || '').replace(/<[^>]*>/g,' ').trim();
        const lines = [`Статус: ${ok ? 'ok' : (res?.status || 'unknown')}`];
        if (info)  lines.push(info);
        if (error) lines.push(error);
        setDetails(lines.join('\n'));

      } catch (err) {
        setStatus('Ошибка');
        setDetails(err?.message || String(err));
        setLink('', ''); setLinkVis(false);
      }
    }
  });
})();
