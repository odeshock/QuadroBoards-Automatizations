// button_update_total — собирает из collectEpisodesFromForums({ sections }) и пишет в "Общую хронологию"
(() => {
  'use strict';

  createForumButton({
    // allowed* выставим сразу, но основные значения всё равно перечитаем внутри onClick
    allowedGroups: (window.CHRONO_CHECK?.GroupID || []).map(Number),
    allowedForums: (window.CHRONO_CHECK?.AmsForumID || []).map(String),
    topicId: String(window.CHRONO_CHECK?.ChronoTopicID || '').trim(),
    label: 'обновить общее хроно',
    order: 1,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Открыть ссылку',
    linkHref: '#',

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});
      const setLinkVis = api?.setLinkVisible || (()=>{});

      try {
        // 1) перечитываем всё из CHRONO_CHECK на момент клика
        const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
        const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
        const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
        const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();
        const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');
        const OPEN_URL = `${SITE_URL}/viewtopic.php?id=${TID}#p${PID}`;
        const SECTIONS = Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
          ? window.CHRONO_CHECK.ForumInfo
          : undefined;

        if (!GID.length || !FID.length || !TID || !PID) {
          setStatus('Ошибка');
          setDetails('Нужны GroupID, AmsForumID, ChronoTopicID, TotalChronoPostID');
          setLink('', ''); setLinkVis?.(false);
          return;
        }

        setStatus('Собираю…'); setDetails(''); setLink('', ''); setLinkVis?.(false);

        // 2) собираем эпизоды через парсер (как в per_user — передаём sections)
        if (!window.collectEpisodesFromForums) throw new Error('collectEpisodesFromForums недоступна');
        const episodes = await window.collectEpisodesFromForums({ sections: SECTIONS });

        // 3) формируем BBCode и пишем в пост
        setStatus('Формирую текст…');
        const bb = renderChronoFromEpisodes(episodes, SITE_URL);
        setStatus('Записываю…');
        const html = FMV.toCp1251Entities(bb);
        const res  = await FMV.replaceComment(GID, PID, html);

        const st = typeof res?.status === 'string' ? res.status : (res?.ok ? 'ok' : 'unknown');
        const success = !!res?.ok || st === 'ok';

        setStatus(success ? 'Готово' : 'Ошибка');
        setLink(success ? OPEN_URL : '', success ? 'Открыть ссылку' : '');
        setLinkVis?.(!!success);

        const info  = (res?.infoMessage || '').replace(/<[^>]*>/g,' ').trim();
        const error = (res?.errorMessage || '').replace(/<[^>]*>/g,' ').trim();
        const lines = [`Статус: ${success ? 'ok' : (st || 'unknown')}`];
        if (info)  lines.push(info);
        if (error) lines.push(`[error] ${error}`);
        setDetails(lines.join('\n'));

      } catch (e) {
        setStatus('Ошибка');
        setDetails(e?.message || String(e));
        setLink('', ''); setLinkVis?.(false);
      }
    }
  });

  /* ============== ВСПОМОГАТЕЛЬНОЕ (как в per_user) ============== */

  const MAP_TYPE = window.CHRONO_CHECK?.EpisodeMapType || {
    personal: ['personal', 'black'],
    plot:     ['plot',     'black'],
    au:       ['au',       'black']
  };
  const MAP_STAT = window.CHRONO_CHECK?.EpisodeMapStat || {
    on:       ['active',   'green'],
    off:      ['closed',   'teal'],
    archived: ['archived', 'maroon']
  };

  function renderStatus(type, status) {
    const t = MAP_TYPE[type] || MAP_TYPE.au;
    const s = MAP_STAT[status] || MAP_STAT.archived;
    return `[[color=${t[1]}]${t[0]}[/color] / [color=${s[1]}]${s[0]}[/color]]`;
  }

  const lc = s => String(s || '').trim();

  if (typeof window.userLink !== 'function') {
    window.userLink = (id, name, asBB = true) =>
      asBB ? `[url=/profile.php?id=${FMV.escapeHtml(String(id))}]${FMV.escapeHtml(String(name))}[/url]`
           : `<a href="/profile.php?id=${FMV.escapeHtml(String(id))}">${FMV.escapeHtml(String(name))}</a>`;
  }
  if (typeof window.missingUser !== 'function') {
    window.missingUser = (name, asBB = true) =>
      asBB ? `[i]${FMV.escapeHtml(String(name))}[/i]`
           : `<i>${FMV.escapeHtml(String(name))}</i>`;
  }

  function renderChronoFromEpisodes(episodes, SITE_URL) {
    const rows = (episodes || []).map(e => {
      const status = renderStatus(e.type, e.status);
      const dateDisplay = (e.type === 'au')
        ? ''
        : (e.dateStart
            ? `[b]${FMV.escapeHtml(e.dateEnd && e.dateEnd !== e.dateStart ? `${e.dateStart}-${e.dateEnd}` : e.dateStart)}[/b]`
            : `[mark]дата не указана[/mark]`);

      const url = FMV.escapeHtml(e.href || '');
      const ttl = FMV.escapeHtml(e.title || '');
      const errBeforeOrder = e.isTitleNormalized
        ? ''
        : (e.type === 'au'
            ? ' [mark]в названии нет [au][/mark]'
            : ' [mark]в названии нет [с][/mark]');

      const ord = `${FMV.escapeHtml(String(e.order ?? 0))}]`;
      const asBB = true;

      const names = (Array.isArray(e.participants) && e.participants.length)
        ? e.participants.map(p => {
            const display = (p.id != null && p.id !== '')
              ? userLink(String(p.id), p.name, asBB)
              : missingUser(String(p.name || ''), asBB);
            const roles = Array.isArray(p.masks) ? p.masks : [];
            const tail  = roles.length ? ` [as ${FMV.escapeHtml(roles.join(', '))}]` : '';
            return `${display}${tail}`;
          }).join(', ')
        : `[mark]не указаны[/mark]`;

      const loc = e.location ? FMV.escapeHtml(e.location) : `[mark]локация не указана[/mark]`;
      const dash = dateDisplay ? ' — ' : ' ';

      return `${dateDisplay}${dash}[url=${url}]${ttl}[/url]${errBeforeOrder}\n${status} / ${ord}\n[i]${names}[/i]\n${loc}\n\n`;
    });

    return `[media="Общая хронология"]${rows.join('') || ''}[/media]`;
  }
})();
