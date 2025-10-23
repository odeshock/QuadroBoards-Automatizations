// button_personal_page.init.js
(() => {
  'use strict';

  createForumButton({
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Создать страницу',
    order: 1, // чем меньше — тем выше среди других кнопок

    async onClick({ setStatus, setDetails, setLink }) {
      // --- арг1: имя темы
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) { setStatus('✖ нет имени темы', 'red'); setDetails('Ожидался #pun-main h1 span'); return; }

      // --- арг2: usr{id} из ссылки профиля
      let profLink = document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch { }
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }
      const userId = idMatch[1];
      const arg2 = `usr${userId}`;

      // --- остальные аргументы из PROFILE_CHECK
      // Заменяем N в data-id="N" на userId
      const rawTemplate = window.PROFILE_CHECK?.PPageTemplate || '';
      const arg3 = rawTemplate.replace(/data-id="N"/g, `data-id="${userId}"`);
      const arg4 = '';
      const arg5 = window.PROFILE_CHECK?.PPageGroupID;
      const arg6 = '0';

      if (typeof window.FMVcreatePersonalPage !== 'function') {
        setStatus('✖ функция не найдена', 'red');
        setDetails('Ожидалась window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6)');
        return;
      }

      // --- вызов
      setStatus('Создаём…', '#555');
      setDetails('');
      setLink(null);

      try {
        const res = await window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6);

        switch (res?.status) {
          case 'created': setStatus('✔ создано', 'green'); break;
          case 'exists': setStatus('ℹ уже существует', 'red'); break;
          case 'error': setStatus('✖ ошибка', 'red'); break;
          default: setStatus('❔ не удалось подтвердить', '#b80');
        }

        if (res?.url) setLink(res.url, 'Открыть страницу');

        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus) lines.push('HTTP: ' + res.httpStatus);
        if (res?.title) lines.push('Пользователь: ' + res.title);
        if (res?.name) lines.push('Адресное имя: ' + res.name);
        if (res?.details) lines.push('Details: ' + res.details);
        setDetails(lines.join('\n') || 'Нет дополнительных данных');

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails(err?.message || String(err));
        console.error('[button_personal_page]', err);
      }
    }
  });
})();
