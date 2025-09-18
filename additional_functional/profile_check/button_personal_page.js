// button_personal_page.js
// Работает ТОЛЬКО после AMS + при наличии PROFILE_CHECK.
// Безопасен к порядку загрузки: ждёт события/селекторы/глобалы.

(() => {
  // ---------- Утилиты ----------
  const waitFor = (selector, timeout = 5000, step = 50, root = document) =>
    new Promise((resolve, reject) => {
      const t0 = performance.now();
      const tick = () => {
        const n = root.querySelector(selector);
        if (n) return resolve(n);
        if (performance.now() - t0 >= timeout) return reject(new Error(`timeout: ${selector}`));
        setTimeout(tick, step);
      };
      tick();
    });

  const waitForGlobal = (testFn, timeout = 8000, step = 50) =>
    new Promise((resolve, reject) => {
      const t0 = performance.now();
      const tick = () => {
        try {
          const v = testFn();
          if (v) return resolve(v);
        } catch {}
        if (performance.now() - t0 >= timeout) return reject(new Error('timeout: global'));
        setTimeout(tick, step);
      };
      tick();
    });

  const domReady = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  const getNumber = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  const last = arr => (arr && arr.length ? arr[arr.length - 1] : null);

  // ---------- Основной поток ----------
  (async () => {
    try {
      await domReady;

      // 1) Ждём AMS: событие ИЛИ селектор (что случится раньше).
      const amsReadyEvt = new Promise(res =>
        window.addEventListener('ams:ready', e => res(e?.detail?.node || true), { once: true })
      );

      const amsSel = waitFor('.ams_info', 5000).catch(() => null);

      const amsNode = window.__ams_ready === true
        ? (document.querySelector('.ams_info') || true)
        : await Promise.race([amsReadyEvt, amsSel]);

      if (!amsNode) return; // AMS не отработал — выходим молча.

      // 2) Ждём конфиг PROFILE_CHECK из отдельного файла.
      const PROFILE = await waitForGlobal(() => {
        const pc = window.PROFILE_CHECK;
        return pc
          && Array.isArray(pc.GroupID)
          && Array.isArray(pc.ForumIDs)
          ? pc
          : null;
      }, 8000);

      // 3) Проверяем группу пользователя.
      const bodyGroup = getNumber(document.body?.dataset?.groupId);
      const groupId = getNumber(
        window.GroupID
        ?? window?.PUNBB?.group_id
        ?? window?.PUNBB?.user?.g_id
        ?? bodyGroup
      );
      if (!PROFILE.GroupID.includes(groupId)) return;

      // 4) Проверяем, что мы в разрешённом форуме.
      const crumbs = document.querySelector('.crumbs')
        || document.querySelector('#pun-crumbs')
        || document.querySelector('.pun_crumbs')
        || document.querySelector('.container .crumbs');
      if (!crumbs) return;

      const inAllowedForum = Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          return u.pathname.endsWith('/viewforum.php') && PROFILE.ForumIDs.includes(u.searchParams.get('id'));
        } catch { return false; }
      });

      if (!inAllowedForum) return;

      // 5) Достаём имя пользователя (arg1) и id (arg2).
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) return;

      // Пытаемся найти ссылку на профиль.
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try {
          await waitFor('a[href*="profile.php?id="]', 3000);
          profLink = document.querySelector('a[href*="profile.php?id="]');
        } catch {}
      }
      if (!profLink) return;

      const idMatch = String(profLink.getAttribute('href') || '').match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) return;

      const arg2 = `usr${idMatch[1]}`;
      const arg3 = PROFILE.PPageTemplate ?? '';
      const arg4 = ''; // резерв
      const arg5 = PROFILE.PPageGroupIDs ?? '';
      const arg6 = '0';

      // 6) Куда вставлять кнопку: в последний .ams_info
      const containers = Array.from(document.querySelectorAll('.ams_info'));
      const target = last(containers);
      if (!target || !(target instanceof HTMLElement)) return;

      // 7) Создаём/вставляем кнопку.
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'fmv-ppage-btn';
      btn.textContent = 'Создать личную страницу';
      btn.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:.5rem',
        'padding:.45rem .8rem',
        'border-radius:8px',
        'border:1px solid #d0d7de',
        'background:#fff',
        'cursor:pointer',
        'font:600 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
        'box-shadow:0 1px 0 rgba(27,31,36,.04)',
        'transition:background .15s ease, transform .02s ease'
      ].join(';');

      btn.addEventListener('mouseenter', () => { btn.style.background = '#f6f8fa'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = '#fff'; });
      btn.addEventListener('mousedown',  () => { btn.style.transform = 'translateY(1px)'; });
      btn.addEventListener('mouseup',    () => { btn.style.transform = 'translateY(0)'; });

      const status = document.createElement('span');
      status.className = 'fmv-ppage-status';
      status.style.cssText = 'margin-left:.5rem; font:400 12px/1.3 system-ui; color:#57606a;';

      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; margin-top:.5rem;';
      wrap.appendChild(btn);
      wrap.appendChild(status);

      target.appendChild(wrap);

      // 8) Поведение кнопки.
      const invoke = () => {
        if (typeof window.FMVcreatePersonalPage !== 'function') {
          status.textContent = '✖ функция не найдена';
          status.style.color = '#d1242f';
          return;
        }
        try {
          // FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6)
          window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6);
          status.textContent = '✓ отправлено';
          status.style.color = '#1a7f37';
        } catch (e) {
          console.log('[FMV injector] error:', e);
          status.textContent = '✖ ошибка выполнения';
          status.style.color = '#d1242f';
        }
      };

      btn.addEventListener('click', invoke);

      // 9) Мягкая инициализация статуса — подсказать, чего ждёт кнопка
      if (typeof window.FMVcreatePersonalPage !== 'function') {
        status.textContent = 'ожидание FMVcreatePersonalPage…';
      } else {
        status.textContent = 'готово';
      }
    } catch (e) {
      console.log('[FMV injector] error:', e);
    }
  })();
})();
