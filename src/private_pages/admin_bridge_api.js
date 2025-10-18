// admin_bridge_api.js — загрузка/сохранение данных через API вместо страниц
// Экспорт: window.skinAdmin.load(userId) -> { status, initialHtml, save(newHtml), targetUserId }

(function () {
  'use strict';

  console.log('[admin_bridge_api] Загружается версия с API');

  // Не перезаписываем, если уже есть
  if (window.skinAdmin && window.skinAdmin.__apiVersion) {
    console.log('[admin_bridge_api] Уже загружен');
    return;
  }

  /**
   * Получает user_id из .modal_script
   * Приоритет: data-main-user_id > data-id
   */
  function getUserIdFromPage(fallbackUserId) {
    const modal = document.querySelector('.modal_script[data-id]');
    if (modal) {
      const mainUserId = modal.getAttribute('data-main-user_id');
      if (mainUserId && mainUserId.trim()) {
        return Number(mainUserId.trim());
      }
      const dataId = modal.getAttribute('data-id');
      if (dataId && dataId.trim()) {
        return Number(dataId.trim());
      }
    }
    return fallbackUserId ? Number(fallbackUserId) : null;
  }

  /**
   * Загружает данные из API для всех категорий
   */
  async function loadAllDataFromAPI(userId) {
    console.log('[admin_bridge_api] Загружаю данные из API для userId:', userId);

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      throw new Error('FMVbank.storageGet не найден');
    }

    const result = {
      icon: [],
      plashka: [],
      background: [],
      gift: [],
      coupon: []
    };

    const apiLabels = {
      icon: 'icon_',
      plashka: 'plashka_',
      background: 'background_',
      gift: 'gift_',
      coupon: 'coupon_'
    };

    for (const [key, label] of Object.entries(apiLabels)) {
      try {
        const response = await window.FMVbank.storageGet(userId, label);
        console.log(`[admin_bridge_api] ${key} ответ:`, response);

        // Новый формат: { last_update_ts, data: [...] }
        if (response && typeof response === 'object' && Array.isArray(response.data)) {
          result[key] = response.data;
          console.log(`[admin_bridge_api] ${key} загружено ${response.data.length} элементов, last_update_ts: ${response.last_update_ts}`);
        } else {
          console.warn(`[admin_bridge_api] ${key} данные в неправильном формате:`, response);
        }
      } catch (e) {
        console.error(`[admin_bridge_api] Ошибка загрузки ${key}:`, e);
      }
    }

    console.log('[admin_bridge_api] Все данные загружены:', result);
    return result;
  }

  /**
   * Сохраняет данные в API для всех категорий
   */
  async function saveAllDataToAPI(userId, jsonData) {
    console.log('[admin_bridge_api] Сохраняю данные в API для userId:', userId, jsonData);

    if (!window.FMVbank || typeof window.FMVbank.storageSet !== 'function') {
      throw new Error('FMVbank.storageSet не найден');
    }

    const apiLabels = {
      icon: 'icon_',
      plashka: 'plashka_',
      background: 'background_',
      gift: 'gift_',
      coupon: 'coupon_'
    };

    const results = {};

    for (const [key, label] of Object.entries(apiLabels)) {
      const categoryData = jsonData[key] || [];

      // Формируем данные в новом формате: { last_update_ts, data: [...] }
      const saveData = {
        last_update_ts: Math.floor(Date.now() / 1000), // timestamp в секундах
        data: categoryData
      };

      try {
        const result = await window.FMVbank.storageSet(saveData, userId, label);
        results[key] = result;
        console.log(`[admin_bridge_api] ${key} сохранено:`, result);
      } catch (e) {
        console.error(`[admin_bridge_api] Ошибка сохранения ${key}:`, e);
        results[key] = false;
      }
    }

    // Проверяем, все ли успешно
    const allSuccess = Object.values(results).every(r => r === true);
    console.log('[admin_bridge_api] Результаты сохранения:', results, 'Все успешно:', allSuccess);

    return allSuccess;
  }

  async function loadSkinAdmin(userId) {
    console.log('[admin_bridge_api] loadSkinAdmin вызван для userId:', userId);

    // Определяем целевой userId (с учётом data-main-user_id)
    const targetUserId = getUserIdFromPage(userId) || Number(userId);
    console.log('[admin_bridge_api] Целевой userId:', targetUserId);

    try {
      // Загружаем данные из API
      const jsonData = await loadAllDataFromAPI(targetUserId);

      // Конвертируем JSON в HTML для панелей
      let initialHtml = '';
      if (window.FMV && typeof window.FMV.parseJsonToHtml === 'function') {
        initialHtml = window.FMV.parseJsonToHtml(jsonData);
        console.log('[admin_bridge_api] HTML построен из JSON, длина:', initialHtml.length);
      } else {
        console.warn('[admin_bridge_api] FMV.parseJsonToHtml не найден');
      }

      // Функция сохранения
      async function save(newHtml) {
        console.log('[admin_bridge_api] save() вызван, HTML длина:', newHtml.length);

        // Парсим HTML в JSON
        let jsonData;
        if (window.FMV && typeof window.FMV.parseHtmlToJson === 'function') {
          jsonData = window.FMV.parseHtmlToJson(newHtml);
          console.log('[admin_bridge_api] HTML распарсен в JSON:', jsonData);
        } else {
          console.error('[admin_bridge_api] FMV.parseHtmlToJson не найден');
          return { ok: false, status: 'ошибка: парсер не найден' };
        }

        // Сохраняем в API
        const success = await saveAllDataToAPI(targetUserId, jsonData);

        return {
          ok: success,
          status: success ? 'успешно' : 'ошибка сохранения'
        };
      }

      return {
        status: 'ok',
        initialHtml,
        save,
        targetUserId
      };

    } catch (e) {
      console.error('[admin_bridge_api] Ошибка:', e);
      return {
        status: 'ошибка: ' + (e.message || String(e))
      };
    }
  }

  window.skinAdmin = {
    load: loadSkinAdmin,
    __apiVersion: true
  };

  console.log('[admin_bridge_api] Загружен и готов');
})();
