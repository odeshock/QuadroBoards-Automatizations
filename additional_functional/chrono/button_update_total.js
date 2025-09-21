// button_update_total (через collectEpisodesFromForums)
(() => {
  'use strict';

  const GID = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const PID = String(window.CHRONO_CHECK?.TotalChronoPostID || '').trim();
  const OPEN_URL = (new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href)).href;

  if (!GID.length || !FID.length || !TID || !PID) {
    console.warn('[button_update_total] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID');
    return;
  }

  const SECTIONS = Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
    ? window.CHRONO_CHECK.ForumInfo
    : [];

  let busy = false;

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
      if (busy) return;
      busy = true;
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      if (api?.setLinkVisible) api.setLinkVisible(false);
      if (api?.setLink)        api.setLink('', '');

      try {
        setStatus('Выполняю…');
        setDetails('');

        const episodes = await collectEpisodesFromForums({ sections: SECTIONS });

        const html = FMV.toCp1251Entities(renderChronoFromEpisodes(episodes));
        const res  = await FMV.replaceComment(GID, PID, html);

        const st = normStatus(res.status);
        const success = !!res.ok || st === 'ok';

        setStatus(success ? 'Готово' : 'Ошибка');
        if (success) {
          api?.setLink?.(OPEN_URL, 'Открыть ссылку');
          api?.setLinkVisible?.(true);
        } else {
          api?.setLink?.('', '');
          api?.setLinkVisible?.(false);
        }

        const lines = [];
        lines.push(`Статус: ${success ? 'ok' : st || 'unknown'}`);
        const info  = toPlainShort(res.infoMessage || '');
        const error = toPlainShort(res.errorMessage || '');
        if (info)  lines.push(info);
        if (error) lines.push(`<span style="color:#b00020">${FMV.escapeHtml(error)}</span>`);
        setDetails(lines.join('<br>'));

      } catch (e) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        api?.setLinkVisible?.(false);
        api?.setLink?.('', '');
      } finally {
        busy = false;
      }
    }
  });

  /* ===================== РЕНДЕР ===================== */

  function normalizeEpisodeTitle(type, rawTitle, dateRaw) {
    const title = String(rawTitle || '');
    let err = '';
    if (type === 'plot') {
      const suffRx = /\s\[(?:с|c)\]\s*$/i;
      if (!suffRx.test(title)) err = `[mark]нужен суффикс " [с]"[/mark]`;
      return { title: title.replace(suffRx, '').trimEnd(), err };
    }
    if (type === 'au') {
      const hasPrefix = /^\s*au\s*$/i.test(String(dateRaw || ''));
      if (!hasPrefix) err = `[mark]нужен префикс "[au] "[/mark]`;
      return { title: title.replace(/^[\uFEFF\u00A0\s]*\[\s*au\s*\]\s*/i, ''), err };
    }
    return { title, err: '' };
  }

  function renderChronoFromEpisodes(episodes) {
    const rows = (episodes || []).map(e => {
      const status = renderStatus(e.type, e.status);
      const dateDisplay = (e.type === 'au')
        ? ''
        : (e.dateStart
            ? `[b]${FMV.escapeHtml(e.dateEnd && e.dateEnd !== e.dateStart ? `${e.dateStart}-${e.dateEnd}` : e.dateStart)}[/b]`
            : `[mark]дата не указана[/mark]`);
      const url = FMV.escapeHtml(e.href || '');
      const ttl  = FMV.escapeHtml(e.title || '');
      const errBeforeOrder = e.isTitleNormalized 
        ? '' 
        : ((e.type === 'au') ? ' [mark]в названии нет [au][/mark]' : ' [mark]в названии нет [с][/mark]');
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
      const loc = e.location
        ? FMV.escapeHtml(e.location)
        : `[mark]локация не указана[/mark]`;
      const dash = dateDisplay ? ' — ' : ' ';
      return `${dateDisplay}${dash}[url=${url}]${ttl}[/url]${errBeforeOrder}\n${status} / ${ord}\n[i]${names}[/i]\n${loc}\n\n`;
    });
    return `[media="Общая хронология"]${rows.join('') || ''}[/media]`;
  }

  /* ===================== УТИЛИТЫ ===================== */

  function normStatus(s) {
    if (s == null) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return String(s.status || s.code || (s.ok ? 'ok' : 'unknown'));
    return String(s);
  }
  function toPlainShort(s = '', limit = 200) {
    const t = String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > limit ? t.slice(0, limit) + '…' : t;
  }
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
})();
