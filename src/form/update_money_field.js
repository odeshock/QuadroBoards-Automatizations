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
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }
      const userId = idMatch[1];

      // 2) Поле и значение (как в исходнике: берём шаблон «как есть»)
      const fieldId = window.PROFILE_CHECK?.MoneyFieldID;
      const rawTemplate = window.PROFILE_CHECK?.MoneyFieldTemplate;
      const fieldValue = String(rawTemplate);

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
          case 'updated':  setStatus('✔ обновлено', 'green'); break;
          case 'nochange': setStatus('ℹ изменений нет', 'red'); break;
          case 'error':    setStatus('✖ ошибка', 'red'); break;
          default:         setStatus('❔ не удалось подтвердить', '#b80');
        }

        // детали
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
        lines.push('Поле: ' + (res?.fieldId ?? fieldId));
        lines.push('Пользователь: ' + (res?.userId ?? userId));
        lines.push('Значение: ' + fieldValue);
        if (res?.details)       lines.push('Details: ' + res.details);
        setDetails(lines.join('\n'));

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_update_money_field]', err);
      }
    }
  });
})();
