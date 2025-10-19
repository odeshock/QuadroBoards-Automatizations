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
   * Создаёт комментарий в теме логов
   */
  async function createCommentInLog(userId) {
    const topicUrl = '/viewtopic.php?id=' + LOG_FIELD_ID;

    // 1. Загружаем страницу темы
    const response = await fetch(topicUrl, { credentials: 'include' });
    if (!response.ok) {
      throw new Error('Не удалось загрузить тему логов');
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 2. Находим textarea и CSRF токен
    const textarea = doc.querySelector('textarea#main-reply[name="req_message"]');
    const csrfInput = doc.querySelector('input[name="csrf_token"]');

    if (!textarea) {
      throw new Error('textarea не найдена на странице темы');
    }

    const csrfToken = csrfInput ? csrfInput.value : '';

    // 3. Формируем содержимое комментария
    const profileUrl = window.SITE_URL + '/profile.php?id=' + userId;

    // 4. Отправляем форму
    const formData = new FormData();
    formData.append('req_message', profileUrl);
    formData.append('submit', 'Отправить');
    if (csrfToken) {
      formData.append('csrf_token', csrfToken);
    }

    console.log('[button_create_storage] Отправляю комментарий для userId=' + userId);

    const submitResponse = await fetch(topicUrl, {
      method: 'POST',
      credentials: 'include',
      body: formData,
      redirect: 'manual' // Не следуем редиректу автоматически
    });

    // 5. Получаем URL редиректа
    const redirectUrl = submitResponse.headers.get('Location');
    if (!redirectUrl) {
      throw new Error('Не получен URL редиректа после создания комментария');
    }

    console.log('[button_create_storage] Редирект на:', redirectUrl);

    // 6. Парсим comment_id из URL вида /viewtopic.php?pid=<COMMENT_ID>
    const match = redirectUrl.match(/[?&]pid=(\d+)/);
    if (!match) {
      throw new Error('Не удалось извлечь comment_id из URL: ' + redirectUrl);
    }

    const commentId = Number(match[1]);
    console.log('[button_create_storage] Создан комментарий с ID:', commentId);

    return commentId;
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

    // Обновляем только comment_id и last_timestamp
    const baseData = currentData && typeof currentData === 'object' ? currentData : {};

    baseData.comment_id = commentId;
    baseData.last_timestamp = Math.floor(Date.now() / 1000);

    // Убеждаемся, что остальные поля существуют
    if (!baseData.chrono) baseData.chrono = {};
    if (!baseData.gift) baseData.gift = [];
    if (!baseData.coupon) baseData.coupon = [];
    if (!baseData.icon) baseData.icon = [];
    if (!baseData.plashka) baseData.plashka = [];
    if (!baseData.background) baseData.background = [];

    // Сохраняем
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
