// button_personal_page.init.js
(() => {
  'use strict';

  // локальная утилита для ожидания узла (исп. при поиске profile-ссылки)
  const waitFor = (selector, timeout = 5000) =>
    new Promise((resolve, reject) => {
      const n0 = document.querySelector(selector);
      if (n0) return resolve(n0);
      const obs = new MutationObserver(() => {
        const n = document.querySelector(selector);
        if (n) { obs.disconnect(); resolve(n); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('timeout: ' + selector)); }, timeout);
    });

  createForumButton({
    // доступы передаём ПАРАМЕТРАМИ (ничего не объединяем внутри)
    allowedGroups: (PROFILE_CHECK && PROFILE_CHECK.GroupID) || [],
    allowedForums: (PROFILE_CHECK && PROFILE_CHECK.ForumIDs) || [],
    label: 'Создать страницу',
    order: 1, // при необходимости расставь порядок среди других кнопок

    async onClick({ setStatus, setDetails, statusEl }) {
      // 1) Собираем контекст: arg1 (имя темы), arg2 (usr{id})
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) { setStatus('✖ не найдено имя темы (arg1)', 'red'); setDetails('Ожидался #pun-main h1 span'); return; }

      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await waitFor('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }
      const arg2 = `usr${idMatch[1]}`;

      // 2) Остальные аргументы — из PROFILE_CHECK (полностью как в исходнике)
      const arg3 = PROFILE_CHECK.PPageTemplate;
      const arg4 = '';
      const arg5 = PROFILE_CHECK.PPageGroupIDs;
      const arg6 = '0';

      if (typeof window.FMVcreatePersonalPage !== 'function') {
        setStatus('✖ функция не найдена', 'red');
        setDetails('Ожидалась window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6)');
        return;
      }

      // подготовим/реиспользуем ссылку рядом со статусом
      let link = statusEl.parentElement.querySelector('a.fmv-open-page');
      if (!link) {
        link = document.createElement('a');
        link.className = 'fmv-open-page';
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.marginLeft = '10px';
        link.style.fontSize = '14px';
        statusEl.parentElement.appendChild(link);
      }
      link.style.display = 'none';
      link.textContent = '';
      link.removeAttribute('href');

      // 3) Вызов создания
      setStatus('Создаём…', '#555');
      setDetails('');
      try {
        const res = await window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6);

        // статус
        switch (res?.status) {
          case 'created': setStatus('✔ создано', 'green'); break;
          case 'exists':  setStatus('ℹ уже существует', 'red'); break;
          case 'error':   setStatus('✖ ошибка', 'red'); break;
          default:        setStatus('❔ не удалось подтвердить', '#b80');
        }

        // ссылка (если пришла)
        if (res?.url) {
          link.href = res.url;
          link.textContent = 'Открыть страницу';
          link.style.display = 'inline';
        }

        // детали
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
        if (res?.title)         lines.push('Пользователь: ' + res.title);
        if (res?.name)          lines.push('Адресное имя: ' + res.name);
        if (res?.details)       lines.push('Details: ' + res.details);
        setDetails(lines.join('\n') || 'Нет дополнительных данных');

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_personal_page]', err);
      }
    }
  });
})();
