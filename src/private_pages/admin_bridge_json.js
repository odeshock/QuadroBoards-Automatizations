// admin_bridge_json.js — API bridge для работы напрямую с JSON
// Загружает данные из API и сохраняет обратно БЕЗ HTML-прослойки

(function () {
  'use strict';

  /**
   * Загружает страницу /pages/usrN и извлекает user_id из .modal_script
   * Приоритет: data-main-user_id > N из URL
   */
  async function getUserIdFromPage(profileId) {
    try {
      const pageUrl = `/pages/usr${profileId}`;
      const response = await fetch(pageUrl);
      if (!response.ok) {
        console.error(`[admin_bridge_json] Не удалось загрузить ${pageUrl}`);
        return Number(profileId); // fallback на profileId
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const modalScript = doc.querySelector('.modal_script');
      if (!modalScript) {
        console.warn(`[admin_bridge_json] .modal_script не найден в ${pageUrl}, используем profileId=${profileId}`);
        return Number(profileId);
      }

      const mainUserId = modalScript.getAttribute('data-main-user_id');
      if (mainUserId && mainUserId.trim()) {
        return Number(mainUserId.trim());
      }

      // Если data-main-user_id не указан, используем profileId
      return Number(profileId);
    } catch (err) {
      console.error('[admin_bridge_json] Ошибка загрузки страницы:', err);
      return Number(profileId);
    }
  }

  /**
   * Загружает данные из API (единый объект skin_<userId>)
   * Фильтрует истекшие купоны (expired_date < today)
   * @param {number} userId
   * @param {object} libraryIds - { icon: Set, plashka: Set, ... }
   * @returns {Promise<object>} { data: { icon: [], ... }, chrono: {}, comment_id: null }
   */
  async function loadAllDataFromAPI(userId, libraryIds) {
    const data = {
      icon: [],
      plashka: [],
      background: [],
      gift: [],
      coupon: []
    };

    let chrono = {};
    let comment_id = null;

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageGet не найден');
      return { data, chrono, comment_id };
    }

    // Функция для получения текущей даты в МСК (yyyy-mm-dd)
    const getTodayMoscow = () => {
      const now = new Date();
      const moscowOffset = 3 * 60; // UTC+3
      const localOffset = now.getTimezoneOffset(); // минуты от UTC
      const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60000);

      const year = moscowTime.getFullYear();
      const month = String(moscowTime.getMonth() + 1).padStart(2, '0');
      const day = String(moscowTime.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    };

    const today = getTodayMoscow();

    try {
      // Загружаем единый объект skin_<userId>
      const response = await window.FMVbank.storageGet(userId, 'skin_');

      if (!response || typeof response !== 'object') {
        console.warn('[admin_bridge_json] Нет данных в API для userId=' + userId);
        return { data, chrono, comment_id };
      }

      // Извлекаем chrono и comment_id
      chrono = response.chrono || {};
      comment_id = response.comment_id || null;

      // Обрабатываем категории скинов
      const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

      for (const key of categories) {
        const items = response[key] || [];
        if (!Array.isArray(items)) continue;

        items.forEach(item => {
          // Для купонов: фильтруем истекшие (expired_date < today)
          if (key === 'coupon' && item.expired_date) {
            if (item.expired_date < today) {
              console.log(`[admin_bridge_json] Пропущен истекший купон: ${item.id}, expired_date=${item.expired_date} < ${today}`);
              return; // Пропускаем истекший купон
            }
          }

          // Добавляем элемент в данные (все элементы видимы)
          data[key].push(item);
        });
      }
    } catch (err) {
      console.error('[admin_bridge_json] Ошибка загрузки данных:', err);
    }

    return { data, chrono, comment_id };
  }

  /**
   * Сохраняет данные в API (единый объект skin_<userId>)
   * ВАЖНО: Сначала делает GET, затем частично обновляет только категории скинов, сохраняя chrono и comment_id
   * Удаляет истекшие купоны (expired_date < today)
   *
   * @param {number} userId
   * @param {object} skinData - { icon: [], plashka: [], ... } данные из панели
   * @returns {Promise<boolean>}
   */
  async function saveAllDataToAPI(userId, skinData) {
    console.log('[admin_bridge_json] 🔥 СОХРАНЕНИЕ ДЛЯ userId:', userId);
    console.log('[admin_bridge_json] 🔥 skinData:', JSON.parse(JSON.stringify(skinData)));

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function' || typeof window.FMVbank.storageSet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageGet или storageSet не найдены');
      return false;
    }

    // Функция для получения текущей даты в МСК (yyyy-mm-dd)
    const getTodayMoscow = () => {
      const now = new Date();
      const moscowOffset = 3 * 60; // UTC+3
      const localOffset = now.getTimezoneOffset(); // минуты от UTC
      const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60000);

      const year = moscowTime.getFullYear();
      const month = String(moscowTime.getMonth() + 1).padStart(2, '0');
      const day = String(moscowTime.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    };

    const today = getTodayMoscow();

    try {
      // ШАГ 1: Сначала получаем текущие данные из API
      console.log('[admin_bridge_json] 📥 Загружаю текущие данные из API...');
      const currentData = await window.FMVbank.storageGet(userId, 'skin_');

      // Если данных нет, создаём пустой объект
      const baseData = currentData && typeof currentData === 'object' ? currentData : {};

      console.log('[admin_bridge_json] 📥 Текущие данные из API:', JSON.parse(JSON.stringify(baseData)));

      // ПРОВЕРКА: comment_id должен быть указан (берём из текущих данных API)
      const commentId = baseData.comment_id;
      if (!commentId) {
        alert('Укажите id комментария для юзера.');
        console.error('[admin_bridge_json] ❌ comment_id не указан');
        return false;
      }
      console.log('[admin_bridge_json] ✅ comment_id:', commentId);

      // ШАГ 2: Обновляем только категории скинов
      const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

      for (const key of categories) {
        let items = skinData[key] || [];

        // Для купонов: удаляем истекшие (expired_date < today)
        if (key === 'coupon') {
          const before = items.length;
          items = items.filter(item => {
            if (item.expired_date && item.expired_date < today) {
              console.log(`[admin_bridge_json] Удалён истекший купон: ${item.id}, expired_date=${item.expired_date} < ${today}`);
              return false;
            }
            return true;
          });
          const after = items.length;
          if (before !== after) {
            console.log(`[admin_bridge_json] 🗑️ Купоны: удалено ${before - after} истекших`);
          }
        }

        console.log('[admin_bridge_json] 📦 ' + key + ': ' + items.length + ' элементов');

        // Сохраняем в базовый объект (даже если пустой массив)
        baseData[key] = items;
      }

      // ШАГ 3: НЕ трогаем chrono и comment_id - они остаются как есть из GET!

      // ШАГ 4: Обновляем last_timestamp
      baseData.last_timestamp = Math.floor(Date.now() / 1000);

      console.log('[admin_bridge_json] 💾 Финальный объект для сохранения:', JSON.parse(JSON.stringify(baseData)));

      // ШАГ 5: Сохраняем весь объект
      const result = await window.FMVbank.storageSet(baseData, userId, 'skin_');
      if (!result) {
        console.error('[admin_bridge_json] ❌ Не удалось сохранить данные');
        return false;
      }

      console.log('[admin_bridge_json] ✅ Данные успешно сохранены в API');

      // ШАГ 6: Обновляем комментарий на форуме
      console.log('[admin_bridge_json] 📝 Обновляю комментарий #' + commentId);
      const commentUpdated = await updateCommentWithSkins(commentId, userId, baseData);
      if (!commentUpdated) {
        console.error('[admin_bridge_json] ❌ Не удалось обновить комментарий');
        return false;
      }

      console.log('[admin_bridge_json] ✅ Комментарий успешно обновлён');
      return true;
    } catch (err) {
      console.error('[admin_bridge_json] Ошибка сохранения:', err);
      return false;
    }
  }

  /**
   * Обновляет комментарий на форуме с данными скинов через iframe
   * @param {number} commentId - ID комментария
   * @param {number} userId - ID пользователя (для ссылки на профиль)
   * @param {object} data - Полный объект данных (с категориями скинов)
   * @returns {Promise<boolean>}
   */
  async function updateCommentWithSkins(commentId, userId, data) {
    return new Promise((resolve, reject) => {
      try {
        // Подготавливаем данные для комментария (весь объект data, но без content в элементах)
        const dataForComment = { ...data };
        const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

        for (const key of categories) {
          const items = data[key] || [];
          // Удаляем поле content из каждого элемента
          dataForComment[key] = items.map(item => {
            const cleanItem = { ...item };
            delete cleanItem.content;
            return cleanItem;
          });
        }

        // JSON минифицированный (без отступов и переносов)
        const commentJson = JSON.stringify(dataForComment);

        // Ссылка на профиль + JSON
        const profileUrl = window.SITE_URL + '/profile.php?id=' + userId;
        const commentData = profileUrl + '\n' + commentJson;

        const editUrl = '/edit.php?id=' + commentId;

        console.log('[admin_bridge_json] 🌐 Создаём iframe для редактирования комментария:', editUrl);

        // Создаём скрытый iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = editUrl;
        document.body.appendChild(iframe);

        // Таймаут на случай зависания
        const timeout = setTimeout(() => {
          iframe.remove();
          reject(new Error('Таймаут обновления комментария (10 секунд)'));
        }, 10000);

        // Счетчик загрузок
        let onloadCount = 0;

        iframe.onload = function() {
          onloadCount++;
          console.log('[admin_bridge_json] iframe onload #' + onloadCount);

          // Первая загрузка - форма редактирования
          if (onloadCount === 1) {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              const textarea = iframeDoc.querySelector('textarea[name="req_message"]');
              const submitButton = iframeDoc.querySelector('input[type="submit"][name="submit"]');

              if (!textarea || !submitButton) {
                clearTimeout(timeout);
                iframe.remove();
                reject(new Error('Форма редактирования не найдена'));
                return;
              }

              // Вставляем данные в textarea
              textarea.value = commentData;
              console.log('[admin_bridge_json] 📝 Данные вставлены в форму, длина:', commentData.length);

              // Отправляем форму
              console.log('[admin_bridge_json] 📤 Нажимаю кнопку отправки');
              submitButton.click();

            } catch (error) {
              clearTimeout(timeout);
              iframe.remove();
              reject(error);
            }
            return;
          }

          // Вторая загрузка - после редиректа
          if (onloadCount === 2) {
            console.log('[admin_bridge_json] ✅ Форма успешно отправлена, комментарий обновлён');
            clearTimeout(timeout);
            iframe.remove();
            resolve(true);
          }
        };

        iframe.onerror = function() {
          clearTimeout(timeout);
          iframe.remove();
          reject(new Error('Не удалось загрузить страницу редактирования'));
        };

      } catch (err) {
        console.error('[admin_bridge_json] Ошибка обновления комментария:', err);
        reject(err);
      }
    });
  }

  /**
   * Главная функция load
   * @param {string} profileId - id из URL (/profile.php?id=N)
   * @param {object} libraryIds - { icon: Set, plashka: Set, ... }
   * @returns {Promise<object>} { status, visibleData, invisibleData, chrono, comment_id, save, targetUserId }
   */
  async function load(profileId, libraryIds) {
    // Загружаем страницу /pages/usrN и извлекаем правильный userId
    const targetUserId = await getUserIdFromPage(profileId);

    if (!targetUserId) {
      return {
        status: 'error',
        visibleData: {},
        chrono: {},
        comment_id: null,
        save: null,
        targetUserId: null
      };
    }

    // Загружаем данные из API (фильтруем истекшие купоны)
    const { data, chrono, comment_id } = await loadAllDataFromAPI(targetUserId, libraryIds);

    /**
     * Функция сохранения
     * @param {object} skinData - { icon: [], plashka: [], ... } данные из панели
     * @returns {Promise<object>} { ok, status }
     */
    async function save(skinData) {
      const success = await saveAllDataToAPI(targetUserId, skinData);
      return {
        ok: success,
        status: success ? 'успешно' : 'ошибка сохранения'
      };
    }

    return {
      status: 'ok',
      visibleData: data,
      chrono: chrono,
      comment_id: comment_id,
      save,
      targetUserId
    };
  }

  // Экспортируем в window.skinAdmin
  window.skinAdmin = { load };
})();
