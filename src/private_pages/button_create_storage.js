// button_create_storage.js
// Кнопка "Создать хранилище данных" для создания comment_id в info_<userId>

(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!window.PROFILE_CHECK || !window.PROFILE_CHECK.GroupID || !window.SKIN || !window.PROFILE_CHECK.ForumID || !window.SKIN.LogFieldID) {
    console.warn('[button_create_storage] Требуется window.PROFILE_CHECK с GroupID, ForumID и window.SKIN с LogFieldID');
    return;
  }

  const GID = window.PROFILE_CHECK.GroupID.map(Number);
  const LOG_FIELD_ID = window.SKIN.LogFieldID;
  const AMS_FORUM_ID = window.PROFILE_CHECK.ForumID || [];

  if (!window.FMV) window.FMV = {};

  /**
   * Извлекает userId из профиля в текущем контейнере
   */
  function getUserIdFromProfile(container) {
    const profileLink = container.querySelector('.pl-email.profile a[href*="profile.php?id="]');
    if (!profileLink) return null;

    const match = profileLink.href.match(/profile\.php\?id=(\d+)/);
    return match ? Number(match[1]) : null;
  }

  /**
   * Проверяет наличие comment_id в info_<userId>
   * @returns {Promise<{exists: boolean, commentId: number|null}>}
   */
  async function checkCommentId(userId) {
    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      throw new Error('FMVbank.storageGet не найден');
    }

    try {
      const data = await window.FMVbank.storageGet(userId, 'info_');

      // Если data существует и comment_id указан
      if (data && typeof data === 'object' && data.comment_id) {
        return { exists: true, commentId: data.comment_id };
      }

      // comment_id отсутствует или пустой
      return { exists: false, commentId: null };
    } catch (error) {
      // Ошибка 404 или другая ошибка - считаем что данных нет
      console.log('[button_create_storage] Данные не найдены или ошибка:', error);
      return { exists: false, commentId: null };
    }
  }

  /**
   * Создаёт комментарий в теме логов через iframe
   */
  async function createCommentInLog(userId) {
    return new Promise((resolve, reject) => {
      const topicUrl = '/viewtopic.php?id=' + LOG_FIELD_ID;
      const profileUrl = window.SITE_URL + '/profile.php?id=' + userId;

      console.log('[button_create_storage] Создаём iframe для топика:', topicUrl);

      // Создаём iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = topicUrl;
      document.body.appendChild(iframe);

      // Счетчик загрузок iframe
      let onloadCount = 0;

      // Таймаут на случай зависания
      const timeout = setTimeout(() => {
        iframe.remove();
        reject(new Error('Таймаут создания комментария (15 секунд)'));
      }, 15000);

      // Ждём загрузки iframe
      iframe.onload = function() {
        onloadCount++;
        console.log('[button_create_storage] onload событие #' + onloadCount);

        // Первая загрузка - форма ответа
        if (onloadCount === 1) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const textarea = iframeDoc.querySelector('textarea#main-reply[name="req_message"]');
            const submitButton = iframeDoc.querySelector('input[type="submit"][name="submit"]');

            if (!textarea || !submitButton) {
              clearTimeout(timeout);
              iframe.remove();
              reject(new Error('Не найдена форма ответа в теме логов'));
              return;
            }

            // Вставляем текст
            textarea.value = profileUrl;
            console.log('[button_create_storage] Текст вставлен в textarea:', profileUrl);

            // Отправляем форму
            console.log('[button_create_storage] Нажимаю кнопку отправки');
            submitButton.click();

          } catch (error) {
            clearTimeout(timeout);
            iframe.remove();
            reject(error);
          }
          return;
        }

        // Вторая загрузка - страница после редиректа
        if (onloadCount === 2) {
          console.log('[button_create_storage] Вторая загрузка - пытаемся извлечь comment_id');

          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

            // Пытаемся найти созданный комментарий по классу
            // В rusff комментарии имеют id вида "p<comment_id>"
            const posts = iframeDoc.querySelectorAll('div.post[id^="p"]');
            console.log('[button_create_storage] Найдено постов с id:', posts.length);

            if (posts.length > 0) {
              // Берем последний пост (свежесозданный)
              const lastPost = posts[posts.length - 1];
              const postId = lastPost.id; // Например "p12345"
              console.log('[button_create_storage] ID последнего поста:', postId);

              const match = postId.match(/^p(\d+)$/);
              if (match) {
                const commentId = Number(match[1]);
                console.log('[button_create_storage] ✅ Извлечён comment_id:', commentId);

                clearTimeout(timeout);
                iframe.remove();
                resolve(commentId);
                return;
              }
            }

            // Если не нашли по div.post, пробуем через URL (может быть доступен)
            try {
              const currentUrl = iframe.contentWindow.location.href;
              console.log('[button_create_storage] URL после редиректа:', currentUrl);

              // Ищем pid в параметрах
              const pidMatch = currentUrl.match(/[?&]pid=(\d+)/);
              if (pidMatch) {
                const commentId = Number(pidMatch[1]);
                console.log('[button_create_storage] ✅ Извлечён comment_id из URL:', commentId);

                clearTimeout(timeout);
                iframe.remove();
                resolve(commentId);
                return;
              }

              // Ищем якорь #p123
              const anchorMatch = currentUrl.match(/#p(\d+)/);
              if (anchorMatch) {
                const commentId = Number(anchorMatch[1]);
                console.log('[button_create_storage] ✅ Извлечён comment_id из якоря:', commentId);

                clearTimeout(timeout);
                iframe.remove();
                resolve(commentId);
                return;
              }
            } catch (urlError) {
              console.log('[button_create_storage] Не удалось прочитать URL (CORS):', urlError.message);
            }

            // Не нашли comment_id
            clearTimeout(timeout);
            iframe.remove();
            reject(new Error('Не удалось извлечь comment_id после создания комментария'));

          } catch (error) {
            clearTimeout(timeout);
            iframe.remove();
            reject(error);
          }
        }
      };

      // Обработка ошибки загрузки iframe
      iframe.onerror = function() {
        clearTimeout(timeout);
        clearInterval(redirectCheckInterval);
        iframe.remove();
        reject(new Error('Не удалось загрузить страницу темы'));
      };
    });
  }

  /**
   * Сохраняет comment_id в info_<userId>
   */
  async function saveCommentId(userId, commentId) {
    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function' || typeof window.FMVbank.storageSet !== 'function') {
      throw new Error('FMVbank не найден');
    }

    // Делаем GET сначала
    let currentData;
    try {
      currentData = await window.FMVbank.storageGet(userId, 'info_');
    } catch (error) {
      console.log('[button_create_storage] Данные не найдены, создаём новый объект');
      currentData = {};
    }

    // Обновляем ТОЛЬКО comment_id и last_timestamp, всё остальное НЕ ТРОГАЕМ!
    const baseData = currentData && typeof currentData === 'object' ? currentData : {};

    baseData.comment_id = commentId;
    baseData.last_timestamp = Math.floor(Date.now() / 1000);

    // Сохраняем (все остальные поля остаются как есть из GET)
    const result = await window.FMVbank.storageSet(baseData, userId, 'info_');
    if (!result) {
      throw new Error('Не удалось сохранить данные в API');
    }

    console.log('[button_create_storage] comment_id сохранён в API');
    return true;
  }

  /**
   * Основная логика кнопки
   */
  async function createStorage(userId, setStatus, setDetails) {
    try {
      setStatus('Проверяю...');
      setDetails('');

      // 1. Проверяем наличие comment_id
      const check = await checkCommentId(userId);

      if (check.exists) {
        setStatus('Готово');
        setDetails('Хранилище уже установлено (comment_id: ' + check.commentId + ')');
        return;
      }

      // 2. Создаём комментарий
      setStatus('Создаю комментарий...');
      const commentId = await createCommentInLog(userId);

      // 3. Сохраняем comment_id в API
      setStatus('Сохраняю...');
      await saveCommentId(userId, commentId);

      // 4. Успех
      setStatus('Готово');
      setDetails('Хранилище создано, comment_id: ' + commentId);
    } catch (error) {
      setStatus('Ошибка');
      setDetails(error?.message || String(error));
      console.error('[button_create_storage] Ошибка:', error);
    }
  }

  // Создаём кнопку
  if (typeof window.createForumButton === 'function') {
    window.createForumButton({
      allowedGroups: GID,
      allowedForums: AMS_FORUM_ID,
      label: 'Создать хранилище данных',
      order: 4.5, // Под кнопкой "Создать страницу" (обычно order=4)
      showStatus: true,
      showDetails: true,
      showLink: false,

      async onClick(api) {
        const setStatus = api?.setStatus || (() => { });
        const setDetails = api?.setDetails || (() => { });

        // Находим контейнер с кнопкой
        const container = document.querySelector('div.post.topicpost');
        if (!container) {
          setStatus('Ошибка');
          setDetails('Не найден контейнер div.post.topicpost');
          return;
        }

        // Извлекаем userId из профиля
        const userId = getUserIdFromProfile(container);
        if (!userId) {
          setStatus('Ошибка');
          setDetails('Не удалось определить ID пользователя');
          return;
        }

        console.log('[button_create_storage] userId:', userId);

        // Запускаем создание хранилища
        await createStorage(userId, setStatus, setDetails);
      }
    });
  } else {
    console.warn('[button_create_storage] createForumButton не найдена');
  }
})();
