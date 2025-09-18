(() => {
  'use strict';

  // ----- локальные утилиты -----
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

    // ⬇️ Ждём событие от AMS или глобал
    if (!window.__ams_ready) {
      await new Promise(resolve =>
        window.addEventListener('ams:ready', () => resolve(), { once: true })
      );
    }

    // --- остальная логика без изменений ---
    const amsDiv = document.querySelector('div.ams_info');
    if (!amsDiv) return;

    const bodyGroup = Number(document.body?.dataset?.groupId || NaN);
    const groupId = Number(window.GroupID ?? window?.PUNBB?.group_id ?? window?.PUNBB?.user?.g_id ?? bodyGroup);
    if (!PROFILE_CHECK.GroupID.includes(groupId)) return;

    const crumbs = document.querySelector('.crumbs') || document.querySelector('#pun-crumbs') ||
                   document.querySelector('.pun_crumbs') || document.querySelector('.container .crumbs');
    if (!crumbs) return;
    const inAllowedForum = Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
      try {
        const u = new URL(a.getAttribute('href'), location.href);
        return u.pathname.endsWith('/viewforum.php') &&
               PROFILE_CHECK.ForumIDs.includes(u.searchParams.get('id'));
      } catch { return false; }
    });
    if (!inAllowedForum) return;

    const nameSpan = document.querySelector('#pun-main h1 span');
    const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
    if (!arg1) return;

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

    const arg3 = PROFILE_CHECK.PPageTemplate;
    const arg4 = '';
    const arg5 = PROFILE_CHECK.PPageGroupIDs;
    const arg6 = '0';

    let bodies = document.querySelectorAll('.ams_info');
    if (!bodies.length) {
      try { await waitFor('.ams_info', 5000); bodies = document.querySelectorAll('.ams_info'); }
      catch { return; }
    }
    const target = bodies[bodies.length - 1];
    if (!target || target.querySelector('.fmv-create-page')) return;

    const br = document.createElement('br');
    const wrap = document.createElement('div');
    wrap.className = 'fmv-create-page';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'button';
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

    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener';
    link.style.marginLeft = '10px';
    link.style.fontSize = '14px';
    link.style.display = 'none';

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

    wrap.appendChild(btn);
    wrap.appendChild(statusSpan);
    wrap.appendChild(link);
    wrap.appendChild(details);
    target.appendChild(br);
    target.appendChild(br);
    target.appendChild(wrap);

    console.log('[FMV injector] кнопка/статус добавлены (после ams:ready)');
  } catch (e) {
    console.log('[FMV injector] error:', e);
  }
})();
