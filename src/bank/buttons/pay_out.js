/**
 * Кнопка "Выплатить"
 * Показывается после нажатия "В правках не нуждается"
 * Пока просто возвращает true при нажатии
 */

(function () {
  'use strict';

  // Проверяем, что заголовок страницы начинается с "Гринготтс"
  if (!document.title.startsWith('Гринготтс')) {
    return;
  }

  /**
   * Создаёт кнопки "Выплатить" для каждого подходящего поста
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

    console.log('[PAY_OUT] Начинаем создание кнопок');

    // Получаем все посты
    const posts = Array.from(document.querySelectorAll('div.post'));
    console.log(`[PAY_OUT] Найдено постов: ${posts.length}`);

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

      console.log(`[PAY_OUT] Пост #${index}: подходит для кнопки`);

      // Ищем контейнер .ams_info
      const amsInfo = postContent.querySelector('.ams_info');
      if (!amsInfo) {
        console.warn(`[PAY_OUT] Пост #${index}: не найден .ams_info`);
        continue;
      }

      // Проверяем, не создана ли уже кнопка
      if (amsInfo.querySelector('.btn-pay-out')) {
        console.log(`[PAY_OUT] Пост #${index}: кнопка уже существует`);
        continue;
      }

      // Создаём кнопку
      const button = document.createElement('button');
      button.className = 'btn-pay-out';
      button.textContent = 'Выплатить';
      button.style.cssText = 'margin: 5px; padding: 5px 10px; cursor: pointer; display: none;'; // скрыта по умолчанию

      // Обработчик нажатия
      button.addEventListener('click', function () {
        console.log(`[PAY_OUT] Кнопка нажата для поста #${index}`);
        console.log(`[PAY_OUT] Возвращаем true`);
        return true;
      });

      // Вставляем кнопку в .ams_info
      amsInfo.appendChild(button);
      console.log(`[PAY_OUT] Кнопка добавлена в пост #${index} (скрыта)`);
    }
  }

  // Запускаем создание кнопок с параметрами из window.BANK_CHECK
  const config = {
    allowedGroups: (window.BANK_CHECK?.GroupID) || [],
    allowedForums: (window.BANK_CHECK?.ForumID) || [],
    allowedUsers: (window.BANK_CHECK?.UserID) || []
  };

  createPostButtons(config).catch(err => {
    console.error('[PAY_OUT] Ошибка при создании кнопок:', err);
  });
})();
