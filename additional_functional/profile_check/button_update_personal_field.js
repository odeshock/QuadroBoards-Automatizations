// button_update_personal_field.init.js
(() => {
  'use strict';

  // Настраиваем параметры и вызываем уже подключённую createForumButton (из button.js)
  createForumButton({
    // какие группы и форумы допускать — ПЕРЕДАЁМ ПАРАМЕТРАМИ
    allowedGroups: (PROFILE_CHECK && PROFILE_CHECK.GroupID) || [],
    allowedForums: (PROFILE_CHECK && PROFILE_CHECK.ForumIDs) || [],
    label: 'Установить плашку',

    // Вся бизнес-логика — внутри onClick
    async onClick({ statusEl }) {
      // 1) Готовим контекст (как в твоём исходном файле)
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

      // arg1 — из заголовка темы
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) { statusEl.textContent = '✖ не найдено имя темы (arg1)'; statusEl.style.color = 'red'; return; }

      // userId/arg2 — из ссылки на профиль
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await waitFor('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      const userId = idMatch ? idMatch[1] : '';
      const arg2 = userId ? `usr${userId}` : '';
      if (!userId) { statusEl.textContent = '✖ не найден userId'; statusEl.style.color = 'red'; return; }

      // 2) Готовим поле и значение по шаблону (как в исходнике)
      const fieldId = PROFILE_CHECK.PPageFieldID;
      const rawTemplate = PROFILE_CHECK.PPageFieldTemplate;
      const fieldValue = String(rawTemplate).replace(/\bID\b/g, arg2);

      // 3) Вызываем твою функцию обновления поля
      if (typeof window.FMVreplaceFieldData !== 'function') {
        statusEl.textContent = '✖ функция обновления не найдена (FMVreplaceFieldData)';
        statusEl.style.color = 'red';
        return;
      }

      statusEl.textContent = 'Обновляем…';
      statusEl.style.color = '#555';

      try {
        // контракт: FMVreplaceFieldData(userId, fieldId, value)
        const res = await window.FMVreplaceFieldData(userId, fieldId, fieldValue);

        // статус
        switch (res?.status) {
          case 'updated':  statusEl.textContent = '✔ обновлено'; break;
          case 'nochange': statusEl.textContent = 'ℹ изменений нет'; break;
          case 'error':    statusEl.textContent = '✖ ошибка'; break;
          default:         statusEl.textContent = '❔ неизвестный результат';
        }
        statusEl.style.color = res?.status === 'updated' ? 'green' :
                               res?.status === 'nochange' ? 'red' :
                               res?.status === 'error' ? 'red' : '#b80';

        // при желании можно логнуть детали в консоль
        console.log('[update personal field]', {
          httpStatus: res?.httpStatus,
          serverMessage: res?.serverMessage,
          fieldId: res?.fieldId ?? fieldId,
          userId: res?.userId ?? userId,
          valueTried: fieldValue,
          details: res?.details
        });
      } catch (err) {
        statusEl.textContent = '✖ сеть/транспорт';
        statusEl.style.color = 'red';
        console.error(err);
      }
    }
  });
})();
