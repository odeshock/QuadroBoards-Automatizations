// tags_visibility_button.init.js
(() => {
  'use strict';

  // --- мелкие утилиты --------------------------------------------------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function waitFor(fn, { timeout = 10000, interval = 100 } = {}) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      try { const v = fn(); if (v) return v; } catch (_) {}
      await sleep(interval);
    }
    return null;
  }

  // ключ для localStorage (привяжем к id темы, если сможем)
  function topicKey() {
    try {
      const u = new URL(location.href);
      const id = u.searchParams.get('id') || u.searchParams.get('tid') || '';
      return `fmv:meta:enabled:${id || u.pathname}`;
    } catch {
      return `fmv:meta:enabled:${location.href}`;
    }
  }

  function injectStyleOnce() {
    if (document.getElementById('fmv-meta-style')) return;
    const style = document.createElement('style');
    style.id = 'fmv-meta-style';
    style.textContent = `
      .fmv-meta{
        margin:8px 0; padding:8px; border:1px solid #d7d7d7;
        background:#f7f7f7; border-radius:6px; position:relative;
      }
      .fmv-row{margin:.25em 0}
      .fmv-label{font-weight:700;margin-right:.25em}
      .fmv-missing{color:#c00;background:#ffe6e6;border-radius:6px;padding:0 .35em;font-weight:700}
      .fmv-toggle{
        position:absolute; top:4px; left:4px; background:none; border:none; padding:0; margin:0;
        color:#aaa; font-size:12px; line-height:1; cursor:pointer; opacity:.3; transition:opacity .2s,color .2s
      }
      .fmv-toggle:hover,.fmv-toggle:focus{opacity:1;color:#555;outline:none}
    `;
    document.head.appendChild(style);
  }

  // --- сбор данных и монтирование блока -------------------------------------
  async function mountMetaBlock() {
    // ждём зависимости из общего модуля FMV + profileLink (как в исходнике)
    const ok = await waitFor(() =>
      window.FMV &&
      typeof FMV.readTagText === 'function' &&
      typeof FMV.escapeHtml === 'function' &&
      typeof FMV.parseOrderStrict === 'function' &&
      typeof FMV.buildIdToNameMapFromTags === 'function' &&
      typeof FMV.parseCharactersUnified === 'function' &&
      typeof window.profileLink === 'function'
    , { timeout: 15000 });
    if (!ok) throw new Error('Не готовы зависимости FMV/profileLink');

    // первый пост темы
    const first = await waitFor(() =>
      document.querySelector('.topic .post.topicpost, .post.topicpost, .message:first-of-type')
    , { timeout: 15000 });
    if (!first) throw new Error('Не найден первый пост темы');

    // (если у тебя есть ensureAllowed — поддержим его, как в оригинале)
    if (typeof window.ensureAllowed === 'function' && !window.ensureAllowed()) {
      throw new Error('Доступ к виджету ограничён политикой ensureAllowed()');
    }

    // читаем сырые теги
    const rawChars = FMV.readTagText(first, 'characters'); // userN; userM=mask; ...
    const rawLoc   = FMV.readTagText(first, 'location');
    const rawOrder = FMV.readTagText(first, 'order');

    const map = await FMV.buildIdToNameMapFromTags(rawChars);

    const lines = [];
    if (rawChars) {
      const participantsHtml = FMV.renderParticipantsHtml(rawChars, map, window.profileLink);
      lines.push(`<div class="fmv-row"><span class="fmv-label">Участники:</span>${participantsHtml}</div>`);
    }
    if (rawLoc) {
      lines.push(`<div class="fmv-row"><span class="fmv-label">Локация:</span>${FMV.escapeHtml(rawLoc)}</div>`);
    }
    if (rawOrder) {
      const ord = FMV.parseOrderStrict(rawOrder);
      lines.push(`<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${ord.html}</div>`);
    }

    if (!lines.length) throw new Error('Нет данных в тегах characters/location/order');

    // соберём блок
    injectStyleOnce();

    // если уже есть старый — удалим (как в исходнике)
    (first.querySelector('.post-box > .fmv-meta') ||
     first.querySelector('.post-content + .fmv-meta'))?.remove();

    const block = document.createElement('div');
    block.className = 'fmv-meta';
    block.innerHTML = `
      <button class="fmv-toggle" aria-label="toggle">▸</button>
      <div class="fmv-body" style="display:none">${lines.join('\n')}</div>
    `;

    const postBox   = first.querySelector('.post-box');
    const contentEl = postBox?.querySelector('.post-content, [id$="-content"]');

    if (postBox && contentEl) {
      postBox.insertBefore(block, contentEl);
    } else if (postBox) {
      postBox.insertBefore(block, postBox.firstChild);
    } else {
      first.insertBefore(block, first.firstChild);
    }

    // поведение маленькой кнопки разворота внутри блока
    const btn  = block.querySelector('.fmv-toggle');
    const body = block.querySelector('.fmv-body');
    btn.addEventListener('click', () => {
      const show = body.style.display === 'none';
      body.style.display = show ? '' : 'none';
      btn.textContent = show ? '▾' : '▸';
    });

    return block;
  }

  function unmountMetaBlock() {
    const block = document.querySelector('.fmv-meta');
    if (block) block.remove();
  }

  function isMounted() {
    return Boolean(document.querySelector('.fmv-meta'));
  }

  // --- кнопка-тумблер на базе createForumButton ------------------------------
  // ВАЖНО: предполагается, что button.js (createForumButton) и check_group.js уже подключены
  createForumButton({
    allowedGroups: (PROFILE_CHECK && PROFILE_CHECK.GroupID) || [],
    allowedForums: (PROFILE_CHECK && PROFILE_CHECK.ForumIDs) || [],
    label: 'Мета-инфо',
    order: 12,

    async onClick({ setStatus, setDetails, setLink }) {
      try {
        setLink(null);

        // если блок уже смонтирован — выключаем
        if (isMounted()) {
          unmountMetaBlock();
          localStorage.setItem(topicKey(), '0');
          setStatus('Выключено', 'red');
          setDetails('Блок «мета-инфо» удалён со страницы.');
          return;
        }

        // иначе пробуем включить
        setStatus('Включаю…', '#555');
        setDetails('');
        const block = await mountMetaBlock();
        localStorage.setItem(topicKey(), '1');
        setStatus('Включено', 'green');

        // немного подсветим, что появилось
        block.style.boxShadow = '0 0 0 2px rgba(0,0,0,.05) inset';
        setTimeout(() => { block.style.boxShadow = ''; }, 600);

        setDetails('Блок «мета-инфо» добавлен. Нажмите на маленький ▸, чтобы раскрыть содержимое.');
      } catch (err) {
        setStatus('✖ Ошибка', 'red');
        setDetails(err?.message || String(err));
        console.error('[tags_visibility_button]', err);
      }
    }
  });

  // --- авто-восстановление состояния (по желанию) ----------------------------
  // Если в прошлый раз было «включено», смонтируем автоматически.
  (async () => {
    try {
      if (localStorage.getItem(topicKey()) === '1' && !isMounted()) {
        await mountMetaBlock();
        // статус обновлять некуда (кнопка ещё не кликалась), так что просто тихо включим
      }
    } catch (e) {
      // не критично
    }
  })();
})();
