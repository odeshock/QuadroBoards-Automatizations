(() => {
  const waitFor = (selector, timeout = 8000) =>
    new Promise((resolve, reject) => {
      const node = document.querySelector(selector);
      if (node) return resolve(node);
      const obs = new MutationObserver(() => {
        const n = document.querySelector(selector);
        if (n) { obs.disconnect(); resolve(n); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('timeout: ' + selector)); }, timeout);
    });

  const ready = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  (async () => {
    try {
      await ready;

      // 1) Только для GroupID 1/2
      const bodyGroup = Number(document.body?.dataset?.groupId || NaN);
      const groupId = Number(window.GroupID ?? window?.PUNBB?.group_id ?? window?.PUNBB?.user?.g_id ?? bodyGroup);
      if (!PROFILE_CHECK.GroupID.includes(groupId)) return;

      // 2) Проверяем крошки на forum id=9/10
      const crumbs = document.querySelector('.crumbs') || document.querySelector('#pun-crumbs') ||
                     document.querySelector('.pun_crumbs') || document.querySelector('.container .crumbs');
      if (!crumbs) return;
      const inAllowedForum = Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          return u.pathname.endsWith('/viewforum.php') && (PROFILE_CHECK.ForumIDs.includes(u.searchParams.get('id')));
        } catch { return false; }
      });
      if (!inAllowedForum) return;

      // 3) Аргумент 1: #pun-main h1 span → lowercase ("Имя Фамилия")
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) return;

      // 4) Аргумент 2: usrN из profile.php?id=N
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await waitFor('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      if (!profLink) return;
      const idMatch = profLink.href.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) return;
      const arg2 = `usr${idMatch[1]}`;

      // 5) Остальные аргументы — фиксированные
      const arg3 = PROFILE_CHECK.PPageTemplate;
      const arg4 = '';
      const arg5 = PROFILE_CHECK.PPageGroupIDs;
      const arg6 = '0';

      // 6) Вставляем кнопку + статус (+ блок подробностей)
      let bodies = document.querySelectorAll('.topic .post-body .post-box');
      if (!bodies.length) {
        try { await waitFor('.topic .post-body .post-box', 5000); bodies = document.querySelectorAll('.topic .post-body .post-box'); } catch { return; }
      }
      const target = bodies[bodies.length - 1];
      if (!target || target.querySelector('.fmv-create-page')) return;

      const wrap = document.createElement('div');
      wrap.className = 'fmv-create-page';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = 'Создать страницу';

      const statusSpan = document.createElement('span');
      statusSpan.style.marginLeft = '10px';
      statusSpan.style.fontSize = '14px';
      statusSpan.style.color = '#555';

      const details = document.createElement('details');
      details.style.marginTop = '6px';
      const summary = document.createElement('summary');
      summary.textContent = 'Показать детали';
      summary.style.cursor = 'pointer';
      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.margin = '6px 0 0';
      pre.style.fontSize = '12px';
      details.appendChild(summary);
      details.appendChild(pre);

      // необязательная кнопка-ссылка на результат
      const link = document.createElement('a');
      link.target = '_blank';
      link.rel = 'noopener';
      link.style.marginLeft = '10px';
      link.style.fontSize = '14px';
      link.style.display = 'none'; // покажем, когда будет URL

      btn.addEventListener('click', async () => {
        statusSpan.textContent = 'Создаём…';
        statusSpan.style.color = '#555';
        link.style.display = 'none';
        link.textContent = '';
        link.removeAttribute('href');
        pre.textContent = '';

        if (typeof window.FMVcreatePersonalPage !== 'function') {
          statusSpan.textContent = '✖ функция не найдена';
          statusSpan.style.color = 'red';
          return;
        }

        try {
          /** ожидаем объект вида:
           * { status:'created'|'exists'|'error'|'uncertain',
           *   serverMessage?: string, httpStatus?: number, url?: string, title?: string, name?: string, details?: string }
           */
          const res = await window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6);

          // статусная надпись
          switch (res?.status) {
            case 'created':
              statusSpan.textContent = '✔ создано';
              statusSpan.style.color = 'green';
              break;
            case 'exists':
              statusSpan.textContent = 'ℹ уже существует';
              statusSpan.style.color = 'red';
              break;
            case 'error':
              statusSpan.textContent = '✖ ошибка';
              statusSpan.style.color = 'red';
              break;
            default:
              statusSpan.textContent = '❔ не удалось подтвердить';
              statusSpan.style.color = '#b80';
          }

          // ссылка (если есть)
          if (res?.url) {
            link.href = res.url;
            link.textContent = 'Открыть страницу';
            link.style.display = 'inline';
          }

          // подробности
          const lines = [];
          if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
          if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
          if (res?.title)         lines.push('Пользователь: ' + res.title);
          if (res?.name)          lines.push('Адресное имя: ' + res.name);
          if (res?.details)       lines.push('Details: ' + res.details);
          pre.textContent = lines.join('\n') || 'Нет дополнительных данных';

        } catch (err) {
          statusSpan.textContent = '✖ сеть/транспорт';
          statusSpan.style.color = 'red';
          pre.textContent = (err && err.message) ? err.message : String(err);
        }
      });

      Object.assign(btn.style, {
        cursor: 'pointer', padding: '6px 10px', borderRadius: '8px',
        border: '1px solid #bbb', background: '#f4f4f4', fontSize: '14px', marginTop: '8px'
      });

      wrap.appendChild(btn);
      wrap.appendChild(statusSpan);
      wrap.appendChild(link);
      wrap.appendChild(details);
      target.appendChild(wrap);
      log('Кнопка/статус добавлены');
    } catch (e) {
      console.error('[FMV injector] error:', e);
    }
  })();
})();
