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

    try {
      // Загружаем единый объект info_<userId>
      const response = await window.FMVbank.storageGet(userId, 'info_');
      console.log('[admin_bridge_api] info_ ответ:', response);

      if (!response || typeof response !== 'object') {
        console.warn('[admin_bridge_api] Нет данных в info_ для userId:', userId);
        return result;
      }

      // Извлекаем каждую категорию из единого объекта
      const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

      for (const key of categories) {
        const items = response[key];
        if (Array.isArray(items)) {
          result[key] = items;
          console.log(`[admin_bridge_api] ${key} загружено ${items.length} элементов`);
        } else {
          console.warn(`[admin_bridge_api] ${key} отсутствует или не массив`);
        }
      }

    } catch (e) {
      console.error('[admin_bridge_api] Ошибка загрузки данных:', e);
    }

    console.log('[admin_bridge_api] Все данные загружены:', result);
    return result;
  }

  /**
   * Сохраняет данные в API (единый объект info_<userId>)
   * ВАЖНО: Сначала делает GET, затем частично обновляет данные и сохраняет обратно
   */
  async function saveAllDataToAPI(userId, jsonData) {
    console.log('[admin_bridge_api] Сохраняю данные в API для userId:', userId, jsonData);

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function' || typeof window.FMVbank.storageSet !== 'function') {
      throw new Error('FMVbank.storageGet или storageSet не найдены');
    }

    try {
      // ШАГ 1: Сначала получаем текущие данные из API
      console.log('[admin_bridge_api] 📥 Загружаю текущие данные из API...');
      const currentData = await window.FMVbank.storageGet(userId, 'info_');

      // Если данных нет, создаём пустой объект
      const baseData = currentData && typeof currentData === 'object' ? currentData : {};

      console.log('[admin_bridge_api] 📥 Текущие данные из API:', JSON.parse(JSON.stringify(baseData)));

      // ШАГ 2: Обновляем только категории скинов, сохраняя chrono и comment_id
      baseData.icon = jsonData.icon || [];
      baseData.plashka = jsonData.plashka || [];
      baseData.background = jsonData.background || [];
      baseData.gift = jsonData.gift || [];
      baseData.coupon = jsonData.coupon || [];

      // Сохраняем chrono и comment_id, если они есть
      if (!baseData.chrono) baseData.chrono = {};
      if (!baseData.comment_id) baseData.comment_id = null;

      // ШАГ 3: Обновляем last_timestamp
      baseData.last_timestamp = Math.floor(Date.now() / 1000);

      console.log('[admin_bridge_api] 📤 Данные для сохранения:', JSON.parse(JSON.stringify(baseData)));

      // ШАГ 4: Сохраняем обратно
      const result = await window.FMVbank.storageSet(baseData, userId, 'info_');

      console.log('[admin_bridge_api] ✅ Результат сохранения:', result);
      return result === true;

    } catch (e) {
      console.error('[admin_bridge_api] ❌ Ошибка сохранения:', e);
      return false;
    }
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
