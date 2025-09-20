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

      // === Переменные для настроек и проверок ===
      const bodyGroup  = Number(document.body?.dataset?.groupId || NaN);
      const groupId    = Number(window.GroupID ?? window?.PUNBB?.group_id ?? window?.PUNBB?.user?.g_id ?? bodyGroup);

      // объединяем списки для удобства
      const allowedGroups = [
        ...(PROFILE_CHECK.GroupID || []),
        ...(CHRONO_CHECK.GroupID || [])
      ];
      const allowedForums = [
        ...(PROFILE_CHECK.ForumIDs || []),
        ...(CHRONO_CHECK.ForumID || [])
      ];

      const isAllowedGroup = allowedGroups.includes(groupId);

      const crumbs = document.querySelector('.crumbs') ||
                     document.querySelector('#pun-crumbs') ||
                     document.querySelector('.pun_crumbs') ||
                     document.querySelector('.container .crumbs');

      const isAllowedForum = crumbs && Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          return u.pathname.endsWith('/viewforum.php') &&
                 allowedForums.includes(u.searchParams.get('id'));
        } catch { return false; }
      });

      // === Используем переменные ===
      if (!isAllowedGroup || !isAllowedForum) return;

      // === Вставляем div ===
      let bodies = document.querySelectorAll('.topic .post-body .post-box .post-content');
      if (!bodies.length) {
        try {
          await waitFor('.topic .post-body .post-box .post-content', 5000);
          bodies = document.querySelectorAll('.topic .post-body .post-box .post-content');
        } catch { return; }
      }

      const target = bodies[bodies.length - 1];
      if (!target || target.querySelector('.ams_info')) return;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'ams_info';
      infoDiv.textContent = '';

      target.appendChild(document.createElement('br'));
      target.appendChild(infoDiv);

      window.__ams_ready = true;
      window.dispatchEvent(new CustomEvent('ams:ready', { detail: { node: infoDiv } }));
      if (typeof window.__amsReadyResolve === 'function') window.__amsReadyResolve(infoDiv);

      console.log('[AMS injector] div .ams_info добавлен');
    } catch (e) {
      console.log('[AMS injector] error:', e);
    }
  })();
})();
