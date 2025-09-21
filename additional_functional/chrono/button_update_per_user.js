// button_collect_chrono_to_media.js — через collectChronoByUser (sections)
(() => {
  'use strict';

  const GID        = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID        = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID        = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const TARGET_PID = String(window.CHRONO_CHECK?.PerPersonChronoPostID || '').trim();
  const SITE_URL   = (window.SITE_URL || location.origin).replace(/\/+$/, '');

  if (!GID.length || !FID.length || !TID || !TARGET_PID) return;

  // при наличии — явно прокинем sections
  const SECTIONS = Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
    ? window.CHRONO_CHECK.ForumInfo
    : undefined;

  // хелперы ссылок
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

  const lc = s => String(s || '').trim();

  function renderStatus(type, status) {
    const t = MAP_TYPE[type] || MAP_TYPE.au;
    const s = MAP_STAT[status] || MAP_STAT.archived;
    return `[[color=${t[1]}]${t[0]}[/color] / [color=${s[1]}]${s[0]}[/color]]`;
  }
  function fmtDateBold(start, end) {
    const s = lc(start), e = lc(end);
    if (!s && !e) return '';
    if (!e || e === s) return `[b]${s}[/b]`;
    return `[b]${s}-${e}[/b]`;
  }
  function fmtParticipants(arr = []) {
    if (!arr.length) return '';
    const items = arr.map(p => {
      const asBB = true;
      const link = (p.id != null && String(p.id) !== '')
        ? userLink(String(p.id), p.name, asBB)
        : missingUser(String(p.name || ''), asBB);
      const masks = Array.isArray(p.masks) && p.masks.length ? ` [as ${FMV.escapeHtml(p.masks.join(', '))}]` : '';
      return `${link}${masks}`;
    });
    return `[i]${items.join(', ')}[/i]`;
  }

  // одна запись-эпизод пользователя
  function fmtEpisode(ep) {
    const headDate   = fmtDateBold(ep.dateStart, ep.dateEnd);
    const linkTitle  = `[url=${FMV.escapeHtml(lc(ep.href))}]${FMV.escapeHtml(lc(ep.title) || lc(ep.href))}[/url]`;
    const ownerMasks = (Array.isArray(ep.masks) && ep.masks.length) ? ` [as ${FMV.escapeHtml(ep.masks.join(', '))}]` : '';
    const head = headDate ? `${headDate} — ${linkTitle}${ownerMasks}` : `${linkTitle}${ownerMasks}`;

    const metaStatus = renderStatus(ep.type, ep.status);
    const metaOrder  = `${FMV.escapeHtml(String(ep.order ?? 0))}`;
    const meta = `${metaStatus} [${metaOrder}]`;

    const ppl = fmtParticipants(ep.participants || []);
    const out = [head, meta];
    if (ppl) out.push(ppl);
    if (lc(ep.location)) out.push(FMV.escapeHtml(lc(ep.location)));
    return out.join('\n');
  }

  // блок для одного персонажа (media с кликабельным названием)
  function buildPersonBlock(name, episodes = []) {
    const topicLink = `[url=${SITE_URL}/viewtopic.php?id=${TID}]${FMV.escapeHtml(lc(name))}[/url]`;
    const body = episodes.map(fmtEpisode).join('\n\n');
    return `[media="${topicLink}"]\n${body}\n[/media]`;
  }
  // общий контейнер
  const wrapAll = blocksText => `[media="Хронология по персонажам"]\n${blocksText}\n[/media]`;

  const OPEN_URL = `${SITE_URL}/viewtopic.php?id=${TID}#p${TARGET_PID}`;

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить хроно по персам',
    order: 3,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Открыть пост',
    linkHref: OPEN_URL,

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});
      const setLinkVis = api?.setLinkVisible || (()=>{});

      setLink('', ''); setLinkVis?.(false);

      try {
        setStatus('Собираю…'); setDetails('');

        // 1) берём готовую раскладку: { "<userId>": { name, episodes[] } }
        const byUser = await (window.collectChronoByUser
          ? window.collectChronoByUser({ sections: SECTIONS })
          : Promise.reject(new Error('collectChronoByUser недоступна')));

        // 2) в массив и сортировка по name
        const users = Object.entries(byUser || {})
          .map(([id, v]) => ({ id, name: v?.name || '', episodes: Array.isArray(v?.episodes) ? v.episodes : [] }))
          .filter(u => u.name)
          .sort((a,b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));

        if (!users.length) {
          setStatus('Пусто');
          setDetails('Нет данных для вывода.');
          return;
        }

        setStatus('Формирую текст…');

        // 3) блоки по персонажам
        const perPerson = users.map(u => buildPersonBlock(u.name, u.episodes)).join('\n\n');

        // 4) общий блок
        const finalBb = wrapAll(perPerson);

        // 5) записываем в целевой пост
        setStatus('Записываю…');
        const html = FMV.toCp1251Entities(finalBb);
        const res  = await FMV.replaceComment(GID, TARGET_PID, html);

        const st = String(res?.status || '');
        const success = !!res?.ok || st === 'ok';

        setStatus(success ? 'Готово' : 'Ошибка');

        if (success) { setLink(OPEN_URL, 'Открыть пост'); setLinkVis?.(true); }
        else         { setLink('', ''); setLinkVis?.(false); }

        const info  = (res?.infoMessage || '').replace(/<[^>]*>/g,' ').trim();
        const error = (res?.errorMessage || '').replace(/<[^>]*>/g,' ').trim();
        const lines = [`Статус: ${success ? 'ok' : (st || 'unknown')}`];
        if (info)  lines.push(info);
        if (error) lines.push(error);
        setDetails(lines.join('\n'));
      } catch (e) {
        setStatus('Ошибка');
        setDetails(e?.message || String(e));
        setLink('', ''); setLinkVis?.(false);
      }
    }
  });
})();
