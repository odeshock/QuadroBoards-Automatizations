// button_personal_page.js
// Запускается только после AMS (ждёт customEvent 'ams:ready') и конфига PROFILE_CHECK.

(() => {
  // --- утилиты ---
  const waitForGlobal = (testFn, timeout = 8000, step = 50) =>
    new Promise((resolve, reject) => {
      const start = performance.now();
      (function tick() {
        try { const v = testFn(); if (v) return resolve(v); } catch {}
        if (performance.now() - start >= timeout) return reject(new Error('timeout'));
        setTimeout(tick, step);
      })();
    });

  const domReady = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  const getNumber = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  // --- основной код ---
  (async () => {
    try {
      await domReady;

      // 1) Ждём AMS
      const amsReady = new Promise(res =>
        window.addEventListener('ams:ready', e => res(e.detail?.node || true), { once: true })
      );
      const amsNode =
        window.__ams_ready === true
          ? (document.querySelector('.ams_info') || true)
          : await amsReady;
      if (!amsNode) return;

      // 2) Ждём конфиг
      const PROFILE = await waitForGlobal(() => {
        const pc = window.PROFILE_CHECK;
        return pc && Array.isArray(pc.GroupID) && Array.isArray(pc.ForumIDs) ? pc : null;
      });
      if (!PROFILE) return;

      // 3) Проверка группы
      const bodyGroup = getNumber(document.body?.dataset?.groupId);
      const groupId = getNumber(
        window.GroupID
        ?? window?.PUNBB?.group_id
        ?? window?.PUNBB?.user?.g_id
        ?? bodyGroup
      );
      if (!PROFILE.GroupID.includes(groupId)) return;

      // 4) Проверка форума
      const crumbs = document.querySelector('.crumbs')
        || document.querySelector('#pun-crumbs')
        || document.querySelector('.pun_crumbs')
        || document.querySelector('.container .crumbs');
      if (!crumbs) return;

      const inAllowedForum = Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          return u.pathname.endsWith('/viewforum.php') &&
                 PROFILE.ForumIDs.includes(u.searchParams.get('id'));
        } catch { return false; }
      });
      if (!inAllowedForum) return;

      // 5) Аргументы
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) return;

      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) return;
      const idMatch = String(profLink.getAttribute('href') || '').match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) return;
      const arg2 = `usr${idMatch[1]}`;
      const arg3 = PROFILE.PPageTemplate ?? '';
      const arg4 = '';
      const arg5 = PROFILE.PPageGroupIDs ?? '';
      const arg6 = '0';

      // 6) Вставляем элементы управления в последний .ams_info
      const target = [...document.querySelectorAll('.ams_info')].pop();
      if (!target) return;

      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-top:.5rem; display:flex; flex-wrap:wrap; gap:.5rem; align-items:center;';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Создать личную страницу';
      btn.style.cssText = 'padding:.45rem .8rem; border-radius:8px; border:1px solid #d0d7de; background:#fff; cursor:pointer;';

      const statusSpan = document.createElement('span');
      statusSpan.style.cssText = 'font:400 12px/1.3 system-ui; color:#57606a;';

      const link = document.createElement('a');
      link.target = '_blank';
      link.rel = 'noopener';
      link.style.display = 'none';

      const pre = document.createElement('pre');
      pre.style.cssText = 'margin:0; padding:0; white-space:pre-wrap; font:12px/1.4 ui-monospace, monospace; color:#57606a;';

      wrap.appendChild(btn);
      wrap.appendChild(statusSpan);
      wrap.appendChild(link);
      target.appendChild(wrap);
      target.appendChild(pre);

      statusSpan.textContent =
        (typeof window.FMVcreatePersonalPage === 'function')
          ? 'готово'
          : 'ожидание FMVcreatePersonalPage…';

      // 7) Клик: твой оригинальный блок
      btn.addEventListener('click', async () => {
        if (typeof window.FMVcreatePersonalPage !== 'function') {
          statusSpan.textContent = '✖ функция не найдена';
          statusSpan.style.color = 'red';
          return;
        }
        try {
          const res = await window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6);
          switch (res?.status) {
            case 'created': statusSpan.textContent = '✔ создано'; statusSpan.style.color = 'green'; break;
            case 'exists':  statusSpan.textContent = 'ℹ уже существует'; statusSpan.style.color = 'red'; break;
            case 'error':   statusSpan.textContent = '✖ ошибка'; statusSpan.style.color = 'red'; break;
            default:        statusSpan.textContent = '❔ не удалось подтвердить'; statusSpan.style.color = '#b80';
          }
          if (res?.url) {
            link.href = res.url;
            link.textContent = 'Открыть страницу';
            link.style.display = 'inline';
          }
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
    } catch (e) {
      console.log('[FMV injector] error:', e);
    }
  })();
})();
