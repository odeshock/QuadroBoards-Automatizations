// button_update_money_field.init.js
(() => {
  'use strict';

  createForumButton({
    // доступы передаём параметрами (ничего не объединяем внутри)
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Выдать монетки',
    order: 3, // задайте нужное место среди других кнопок

    async onClick({ setStatus, setDetails }) {
      // 1) Контекст: userId (для кого обновляем поле)
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch { }
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }
      const userId = idMatch[1];

      // 2) Проверяем персональную страницу /pages/usrN
      const fieldId = window.PROFILE_CHECK?.MoneyFieldID;
      const rawTemplate = window.PROFILE_CHECK?.MoneyFieldTemplate;
      let fieldValue;

      try {
        const pageUrl = `/pages/usr${userId}`;
        const response = await fetch(pageUrl);
        if (!response.ok) {
          setStatus('✖ ошибка загрузки страницы', 'red');
          setDetails(`Не удалось загрузить ${pageUrl}: HTTP ${response.status}`);
          return;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Проверяем наличие ошибки "неверная или устаревшая"
        const infoDiv = doc.querySelector('.info .container');
        if (infoDiv && /неверная или устаревшая/i.test(infoDiv.textContent)) {
          setStatus('✖ страница не создана', 'red');
          setDetails('Необходимо создать персональную страницу');
          return;
        }

        // Проверяем наличие modal_script с data-main-user_id
        const modalScript = doc.querySelector('.modal_script[data-main-user_id]');
        const mainUserId = modalScript?.getAttribute('data-main-user_id');

        if (mainUserId && mainUserId.trim()) {
          // Используем <!-- main: usrK -->
          fieldValue = `<!-- main: usr${mainUserId.trim()} -->`;
        } else {
          // Используем шаблонное значение
          fieldValue = String(rawTemplate);
        }
      } catch (err) {
        setStatus('✖ ошибка проверки страницы', 'red');
        setDetails(`Ошибка при загрузке /pages/usr${userId}: ${err.message}`);
        console.error('[button_update_money_field]', err);
        return;
      }

      if (typeof window.FMVreplaceFieldData !== 'function') {
        setStatus('✖ функция обновления не найдена', 'red');
        setDetails('Ожидалась window.FMVreplaceFieldData(userId, fieldId, value)');
        return;
      }

      // 3) Вызов обновления
      setStatus('Обновляем…', '#555');
      setDetails('');
      try {
        // контракт: FMVreplaceFieldData(userId, fieldId, value)
        const res = await window.FMVreplaceFieldData(userId, fieldId, fieldValue);

        // статусы
        switch (res?.status) {
          case 'updated': setStatus('✓ обновлено', 'green'); break;
          case 'nochange': setStatus('ℹ изменений нет', 'green'); break;
          case 'error': setStatus('✖ ошибка', 'red'); break;
          default: setStatus('❔ не удалось подтвердить', '#b80');
        }

        // детали
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus) lines.push('HTTP: ' + res.httpStatus);
        lines.push('Поле: ' + (res?.fieldId ?? fieldId));
        lines.push('Пользователь: ' + (res?.userId ?? userId));
        lines.push('Значение: ' + fieldValue);
        if (res?.details) lines.push('Details: ' + res.details);
        setDetails(lines.join('\n'));

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_update_money_field]', err);
      }
    }
  });
})();
