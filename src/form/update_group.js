// button_update_group.init.js
(() => {
  'use strict';

  createForumButton({
    // доступ ограничиваем извне заданными списками
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Сменить группу',
    order: 4,

    async onClick({ setStatus, setDetails }) {
      // --- 0) Проверка конфигурации PROFILE_CHECK ---
      const fromStr = (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupUserID) || '';
      const toStr   = (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupPlayerID) || '';

      if (!fromStr || !toStr) {
        const missing = [
          !fromStr ? 'PROFILE_CHECK.GroupUserID' : null,
          !toStr   ? 'PROFILE_CHECK.GroupPlayerID' : null
        ].filter(Boolean).join(', ');
        setStatus('✖ замена не выполнена', 'red');
        setDetails(
          'Не удалось запустить изменение группы: ' +
          (missing
            ? `не заданы параметры ${missing}. Укажите значения и повторите.`
            : 'отсутствуют необходимые параметры.')
        );
        return;
      }

      // --- 1) Контекст: извлекаем userId из ссылки "Профиль" в теме ---
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      const userId = idMatch ? idMatch[1] : '';
      if (!userId) {
        setStatus('✖ не найден userId', 'red');
        setDetails('Не удалось извлечь profile.php?id=... из страницы темы');
        return;
      }

      // --- 2) Наличие основной функции ---
      if (typeof window.FMVupdateGroupIfEquals !== 'function') {
        setStatus('✖ функция недоступна', 'red');
        setDetails('Ожидалась window.FMVupdateGroupIfEquals(userId, fromId, toId)');
        return;
      }

      // --- 3) Запуск смены группы (только если текущая == fromStr) ---
      setStatus('Проверяю и обновляю…', '#555');
      setDetails('');
      try {
        const res = await window.FMVupdateGroupIfEquals(userId, fromStr, toStr);

        // пробуем вытащить текущее значение из details (формат: "current=..."), если есть
        let currentVal = '';
        if (res?.details) {
          const m = String(res.details).match(/current=([^\s]+)/);
          if (m) currentVal = m[1];
        }

        switch (res?.status) {
          case 'updated':
            setStatus('✓ группа изменена', 'green');
            break;

          case 'nochange':
            setStatus('ℹ изменений нет — пользователь уже в целевой группе', 'green');
            break;

          case 'skipped':
            setStatus('✖ исходная группа не совпадает', 'red');
            setDetails(
              `Исходное значение группы — ${currentVal || 'не определено'}.\n` +
              'Либо вы пытаетесь поправить не тот профиль, либо выполните замену вручную ' +
              'для дополнительной валидации.'
            );
            return;

          case 'uncertain':
            setStatus('❔ не удалось подтвердить результат', '#b80');
            break;

          case 'error':
          default:
            setStatus('✖ ошибка при сохранении', 'red');
        }

        // Доп. сведения — в «детали»
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
        lines.push('Пользователь: ' + (res?.userId ?? userId));
        lines.push(`Замена: ${fromStr} → ${toStr}`);
        if (currentVal)         lines.push('Текущее (до попытки): ' + currentVal);
        if (res?.details && !currentVal) lines.push('Details: ' + res.details);
        setDetails(lines.join('\n') || 'Нет дополнительных данных');

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_update_group]', err);
      }
    }
  });
})();
