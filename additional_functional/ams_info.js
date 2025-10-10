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
      const groupId    = window.GroupID ? Number(window.GroupID) : null;

      // объединяем списки для удобства
      const allowedGroups = [
        ...(window.PROFILE_CHECK?.GroupID || []),
        ...(window.CHRONO_CHECK?.GroupID || [])
      ];
      const allowedForums = [
        ...(window.PROFILE_CHECK?.ForumIDs || []),
        ...(window.CHRONO_CHECK?.ForumID || []),
        ...(window.CHRONO_CHECK?.AmsForumID || []),
      ];

      const isAllowedGroup = allowedGroups.includes(groupId);

      const crumbs = document.querySelector('.container.crumbs');

      const isAllowedForum = crumbs && Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          const id = u.searchParams.get('id');
          const check = id ? allowedForums.includes(Number(id)) : false;
          return u.pathname.endsWith('/viewforum.php') && check;
        } catch { return false; }
      });

      // === Используем переменные ===
      if (!isAllowedGroup || !isAllowedForum) return;

      // === Вставляем div ===
      let bodies = document.querySelectorAll('.topicpost .post-body .post-box .post-content');
      if (!bodies.length) {
        try {
          await waitFor('.topicpost .post-body .post-box .post-content', 5000);
          bodies = document.querySelectorAll('.topicpost .post-body .post-box .post-content');
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
    } catch (e) {
      console.log('[AMS injector] error:', e);
    }
  })();
})();
