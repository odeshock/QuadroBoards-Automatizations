/**
 * Кнопка "В правках не нуждается"
 * Блокирует кнопку "Внести правки" и показывает кнопку "Выплатить"
 */

(function () {
  'use strict';

  // Проверяем, что заголовок страницы начинается с "Гринготтс"
  if (!document.title.startsWith('Гринготтс')) {
    return;
  }

  /**
   * Создаёт кнопки "В правках не нуждается" для каждого подходящего поста
   */
  async function createPostButtons(opts) {
    const allowedGroups = opts?.allowedGroups || [];
    const allowedForums = opts?.allowedForums || [];
    const allowedUsers = opts?.allowedUsers || [];

    // Проверяем права доступа
    const userGroup = Number(window.UserGroup) || 0;
    const currentForum = Number(window.ForumID) || 0;
    const uid = Number(window.UserID) || 0;

    // Проверяем группу
    if (Array.isArray(allowedGroups) && allowedGroups.length > 0) {
      if (!allowedGroups.map(Number).includes(userGroup)) {
        return;
      }
    }

    // Проверяем форум
    if (Array.isArray(allowedForums) && allowedForums.length > 0) {
      if (!allowedForums.map(Number).includes(currentForum)) {
        return;
      }
    }

    // Проверяем пользователя
    if (Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      if (!allowedUsers.map(Number).includes(uid)) {
        return;
      }
    }

    // Ждём готовности gringotts
    if (!window.__gringotts_ready) {
      await new Promise(resolve => {
        window.addEventListener('gringotts:ready', resolve, { once: true });
      });
    }

    console.log('[NO_EDITS_NEEDED] Начинаем создание кнопок');

    // Получаем все посты
    const posts = Array.from(document.querySelectorAll('div.post'));
    console.log(`[NO_EDITS_NEEDED] Найдено постов: ${posts.length}`);

    for (let index = 0; index < posts.length; index++) {
      const post = posts[index];
      const postContent = post.querySelector('div.post-content');

      if (!postContent) continue;

      // Проверяем наличие bank_ams_check и отсутствие bank_ams_done
      const hasAmsCheck = !!postContent.querySelector('bank_ams_check');
      const hasAmsDone = !!postContent.querySelector('bank_ams_done');

      if (!hasAmsCheck || hasAmsDone) {
        continue;
      }

      console.log(`[NO_EDITS_NEEDED] Пост #${index}: подходит для кнопки`);

      // Ищем контейнер .ams_info
      const amsInfo = postContent.querySelector('.ams_info');
      if (!amsInfo) {
        console.warn(`[NO_EDITS_NEEDED] Пост #${index}: не найден .ams_info`);
        continue;
      }

      // Проверяем, не создана ли уже кнопка
      if (amsInfo.querySelector('.btn-no-edits-needed')) {
        console.log(`[NO_EDITS_NEEDED] Пост #${index}: кнопка уже существует`);
        continue;
      }

      // Создаём кнопку
      const button = document.createElement('button');
      button.className = 'btn-no-edits-needed';
      button.textContent = 'В правках не нуждается';
      button.style.cssText = 'margin: 5px; padding: 5px 10px; cursor: pointer;';

      // Обработчик нажатия
      button.addEventListener('click', function () {
        console.log(`[NO_EDITS_NEEDED] Кнопка нажата для поста #${index}`);

        // Блокируем кнопку "Внести правки"
        const adminEditBtn = amsInfo.querySelector('.btn-admin-edit');
        if (adminEditBtn) {
          adminEditBtn.disabled = true;
          adminEditBtn.style.opacity = '0.5';
          adminEditBtn.style.cursor = 'not-allowed';
          console.log(`[NO_EDITS_NEEDED] Заблокирована кнопка "Внести правки"`);
        }

        // Скрываем текущую кнопку
        button.style.display = 'none';

        // Показываем кнопку "Выплатить"
        const payOutBtn = amsInfo.querySelector('.btn-pay-out');
        if (payOutBtn) {
          payOutBtn.style.display = 'inline-block';
          console.log(`[NO_EDITS_NEEDED] Показана кнопка "Выплатить"`);
        }
      });

      // Вставляем кнопку в .ams_info
      amsInfo.appendChild(button);
      console.log(`[NO_EDITS_NEEDED] Кнопка добавлена в пост #${index}`);
    }
  }

  // Запускаем создание кнопок с параметрами из window.BANK_CHECK
  const config = {
    allowedGroups: (window.BANK_CHECK?.GroupID) || [],
    allowedForums: (window.BANK_CHECK?.ForumID) || [],
    allowedUsers: (window.BANK_CHECK?.UserID) || []
  };

  createPostButtons(config).catch(err => {
    console.error('[NO_EDITS_NEEDED] Ошибка при создании кнопок:', err);
  });
})();
