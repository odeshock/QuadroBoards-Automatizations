// button_update_personal_field.init.js
(() => {
  'use strict';

  // выносим всю механику в универсальную кнопку
  createForumButton({
    // передаём правила доступа параметрами (ничего не объединяем внутри)
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Установить плашку',
    order: 2, // при необходимости расстановки — можно менять

    async onClick({ setStatus, setDetails }) {
      // 1) Контекст: arg1 из заголовка темы, userId/arg2 из ссылки на профиль
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) { setStatus('✖ не найдено имя темы (arg1)', 'red'); setDetails('Ожидался #pun-main h1 span'); return; }

      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      const userId = idMatch ? idMatch[1] : '';
      const arg2 = userId ? `usr${userId}` : '';
      if (!userId) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }

      // 2) Поле и значение: берём из PROFILE_CHECK и подставляем ID → arg2
      const fieldId = window.PROFILE_CHECK?.PPageFieldID;
      const rawTemplate = window.PROFILE_CHECK?.PPageFieldTemplate;
      const fieldValue = String(rawTemplate).replace(/\bID\b/g, arg2);

      if (typeof window.FMVreplaceFieldData !== 'function') {
        setStatus('✖ функция не найдена', 'red');
        setDetails('Ожидалась window.FMVreplaceFieldData(userId, fieldId, value)');
        return;
      }

      // 3) Вызов обновления
      setStatus('Обновляю…', '#555');
      setDetails('');
      try {
        // контракт: FMVreplaceFieldData(userId, fieldId, value)
        const res = await window.FMVreplaceFieldData(userId, fieldId, fieldValue);

        // статусы
        switch (res?.status) {
          case 'updated':  setStatus('✔ обновлено', 'green'); break;
          case 'nochange': setStatus('ℹ изменений нет', 'red'); break;
          case 'error':    setStatus('✖ ошибка', 'red'); break;
          default:         setStatus('❔ неизвестный результат', '#b80');
        }

        // детали
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
        lines.push('Поле: ' + (res?.fieldId ?? fieldId));
        lines.push('Пользователь: ' + (res?.userId ?? userId));
        lines.push('Значение (template→arg2): ' + fieldValue);
        if (res?.details)       lines.push('Details: ' + res.details);
        setDetails(lines.join('\n') || 'Нет дополнительных данных');
      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_update_personal_field]', err);
      }
    }
  });
})();
