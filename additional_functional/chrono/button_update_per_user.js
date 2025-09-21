// button_collect_chrono_to_media.js
(() => {
  'use strict';

  const GID        = (window.CHRONO_CHECK?.GroupID || []).map(Number);
  const FID        = (window.CHRONO_CHECK?.AmsForumID || []).map(String);
  const TID        = String(window.CHRONO_CHECK?.ChronoTopicID || '').trim();
  const TARGET_PID = String(window.CHRONO_CHECK?.PerPersonChronoPostID || '').trim();
  const SITE_URL   = (window.SITE_URL || location.origin).replace(/\/+$/, '');

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
  if (!window.FMV?.replaceComment || !window.FMV?.toCp1251Entities) {
    console.warn('[collect_chrono_to_media] нет FMV.replaceComment / FMV.toCp1251Entities');
    return;
  }

  // ---------- форматирование BBCode ----------
  const lc = s => String(s || '').trim();
  const fmtDateBold = (start, end) => {
    const s = lc(start), e = lc(end);
    if (!s && !e) return '';
    if (!e || e === s) return `[b]${s}[/b]`;
    return `[b]${s}-${e}[/b]`;
  };
  const fmtParticipants = (arr=[]) => {
    if (!arr.length) return '';
    const items = arr.map(p => {
      const masks = (p.masks && p.masks.length) ? ` [as ${p.masks.join(', ')}]` : '';
      return `${p.name}${masks}`;
    });
    return `[i]${items.join(', ')}[/i]`;
  };
  function fmtEpisode(ep){
    const headDate = fmtDateBold(ep.dateStart, ep.dateEnd);
    const linkT    = `[url=${lc(ep.href)}]${lc(ep.title) || lc(ep.href)}[/url]`;
    const head     = headDate ? `${headDate} — ${linkT}` : `${linkT}`;
    const meta     = `[${lc(ep.type)} / ${lc(ep.status)} / ${Number(ep.order)||0}]`;
    const ppl      = fmtParticipants(ep.participants || []);
    const lines = [head, meta];
    if (ppl) lines.push(ppl);
    if (lc(ep.location)) lines.push(lc(ep.location));
    return lines.join('\n');
  }
  function buildMediaBlock(name, episodes=[]){
    const nameLink = `[url=${SITE_URL}/viewtopic.php?id=${TID}]${lc(name)}[/url]`;
    return `[media="${nameLink}"]\n${episodes.map(fmtEpisode).join('\n\n')}\n[/media]`;
  }

  // ---------- утилиты статуса/деталей как в твоей кнопке ----------
  const normStatus = (s) => {
    if (s == null) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return String(s.status || s.code || (s.ok ? 'ok' : 'unknown'));
    return String(s);
  };
  const toPlainShort = (s='', limit=200) => {
    const t = String(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return t.length > limit ? t.slice(0,limit) + '…' : t;
  };

  // ---------- кнопка ----------
  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить хроно по персонажу',
    order: 4,
    showStatus: true,
    showDetails: true,
    showLink: true,          // на случай, если твой createForumButton поддерживает
    linkText: 'Открыть пост',
    linkHref: `${SITE_URL}/viewtopic.php?id=${TID}#p${TARGET_PID}`,

    async onClick(api){
      const setStatus   = api?.setStatus  || (()=>{});
      const setDetails  = api?.setDetails || (()=>{});
      const setLinkVis  = api?.setLinkVisible || (()=>{});
      const setLink     = api?.setLink || (()=>{});
      setLinkVis(false); setLink('', '');

      try{
        setStatus('Собираю…'); setDetails('');

        // 1) словарь userId -> { name, episodes }
        const byUser = await window.collectChronoByUser();

        // 2) массив и сортировка по name
        const users = Object.entries(byUser)
          .map(([id, v]) => ({ id, name: v.name || '', episodes: v.episodes || [] }))
          .filter(u => u.name)
          .sort((a,b) => a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));

        if (!users.length) {
          setStatus('Пусто'); setDetails('Нет данных для вывода.');
          return;
        }

        setStatus('Формирую текст…');
        const blocks = users.map(u => buildMediaBlock(u.name, u.episodes));
        const bbcode = blocks.join('\n\n');

        // 3) запись в пост (как в твоей кнопке)
        setStatus('Записываю…');
        const htmlEncoded = FMV.toCp1251Entities(bbcode);
        const res = await FMV.replaceComment(GID, TARGET_PID, htmlEncoded); // ← тот же хелпер
        const st  = normStatus(res.status);
        const success = !!res.ok || st === 'ok';

        setStatus(success ? 'Готово' : 'Ошибка');

        // показать ссылку только при успехе
        const linkUrl = `${SITE_URL}/viewtopic.php?id=${TID}#p${TARGET_PID}`;
        if (success) { setLink(linkUrl, 'Открыть пост'); setLinkVis(true); }
        else { setLinkVis(false); setLink('', ''); }

        const info  = toPlainShort(res.infoMessage || '');
        const error = toPlainShort(res.errorMessage || '');
        const lines = [`Статус: ${success ? 'ok' : st || 'unknown'}`];
        if (info)  lines.push(info);
        if (error) lines.push(`<span style="color:#b00020">${FMV.escapeHtml?.(error) || error}</span>`);
        setDetails(lines.join('<br>'));

        // Дополнительно предложим открыть:
        if (success && confirm('Открыть пост с результатом?')) {
          window.open(linkUrl, '_blank', 'noopener');
        }

      } catch(e){
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort?.(e?.message || String(e)) || (e?.message || String(e)));
        setLinkVis(false); setLink('', '');
      }
    }
  });

})();
