// button_collect_chrono_to_media.js
(() => {
  'use strict';

  const GID        = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID        = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID        = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const TARGET_PID = String(window.CHRONO_CHECK?.PerPersonChronoPostID || '').trim();
  const SITE_URL   = (window.SITE_URL || location.origin).replace(/\/+$/, '');

  if (!GID.length || !FID.length || !TID || !TARGET_PID) return;

  const SECTIONS = Array.isArray(window.CHRONO_CHECK?.ForumInfo) && window.CHRONO_CHECK.ForumInfo.length
    ? window.CHRONO_CHECK.ForumInfo
    : [];

  // === новые константы карт типов и статусов ===
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

  const lc = s => String(s || '').trim();

  const fmtDateBold = (start, end) => {
    const s = lc(start), e = lc(end);
    if (!s && !e) return '';
    if (!e || e === s) return `[b]${s}[/b]`;
    return `[b]${s}-${e}[/b]`;
  };

  const fmtParticipants = (arr = []) => {
    if (!arr.length) return '';
    const items = arr.map(p => {
      const masks = (p.masks && p.masks.length) ? ` [as ${p.masks.join(', ')}]` : '';
      return `${p.name}${masks}`;
    });
    return `[i]${items.join(', ')}[/i]`;
  };

  // первая строка эпизода: дата (если есть) + " — " + ссылка-название + " [as <маски владельца>]" (если есть)
  function fmtEpisode(ep) {
    const headDate  = fmtDateBold(ep.dateStart, ep.dateEnd);
    const linkTitle = `[url=${lc(ep.href)}]${lc(ep.title) || lc(ep.href)}[/url]`;
    const ownerMasks = (ep.masks && ep.masks.length) ? ` [as ${ep.masks.join(', ')}]` : '';
    const head = headDate ? `${headDate} — ${linkTitle}${ownerMasks}` : `${linkTitle}${ownerMasks}`;

    const status = renderStatus(e.type, e.status);
    const ord = `${FMV.escapeHtml(String(e.order ?? 0))}]`;
    const meta = `[${status} / ${ord}]`;
    const ppl  = fmtParticipants(ep.participants || []);
    const out = [head, meta];
    if (ppl) out.push(ppl);
    if (lc(ep.location)) out.push(lc(ep.location));
    return out.join('\n');
  }

  // внутренний блок на персонажа
  function buildPersonBlock(name, episodes = []) {
    const nameLink = `[url=${SITE_URL}/viewtopic.php?id=${TID}]${lc(name)}[/url]`;
    const body = episodes.map(fmtEpisode).join('\n\n');
    return `[media="${nameLink}"]\n${body}\n[/media]`;
  }

  // общий внешний блок-обёртка
  function wrapAll(blocksText) {
    return `[media="Хронология по персонажам"]\n${blocksText}\n[/media]`;
  }

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

      // прячем линк на время работы
      setLink('', ''); if (setLinkVis) setLinkVis(false);

      try {
        setStatus('Собираю…'); setDetails('');

        // 1) словарь { id: { name, episodes } }
        const byUser = await window.collectChronoByUser();

        // 2) массив и сортировка по name (ru, без регистра)
        const users = Object.entries(byUser)
          .map(([id, v]) => ({ id, name: v.name || '', episodes: v.episodes || [] }))
          .filter(u => u.name)
          .sort((a,b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));

        if (!users.length) {
          setStatus('Пусто');
          setDetails('Нет данных для вывода.');
          return;
        }

        setStatus('Формирую текст…');

        // 3) внутренние блоки по персонажам
        const perPerson = users.map(u => buildPersonBlock(u.name, u.episodes)).join('\n\n');

        // 4) внешний общий блок
        const finalBb = wrapAll(perPerson);

        // 5) запись в пост
        setStatus('Записываю…');
        const html = FMV.toCp1251Entities(finalBb);
        const res  = await FMV.replaceComment(GID, TARGET_PID, html);

        const st = String(res?.status || '');
        const success = !!res?.ok || st === 'ok';

        setStatus(success ? 'Готово' : 'Ошибка');

        // показать ссылку сбоку (без confirm) только при успехе
        if (success) { setLink(OPEN_URL, 'Открыть пост'); if (setLinkVis) setLinkVis(true); }
        else         { setLink('', ''); if (setLinkVis) setLinkVis(false); }

        const info  = (res?.infoMessage || '').replace(/<[^>]*>/g,' ').trim();
        const error = (res?.errorMessage || '').replace(/<[^>]*>/g,' ').trim();
        const lines = [`Статус: ${success ? 'ok' : (st || 'unknown')}`];
        if (info)  lines.push(info);
        if (error) lines.push(error);
        setDetails(lines.join('\n'));
      } catch (e) {
        setStatus('Ошибка');
        setDetails(e?.message || String(e));
        setLink('', ''); if (setLinkVis) setLinkVis(false);
      }
    }
  });
})();
