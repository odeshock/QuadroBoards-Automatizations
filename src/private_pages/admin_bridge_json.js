// admin_bridge_json.js — API bridge для работы напрямую с JSON
// Загружает данные из API и сохраняет обратно БЕЗ HTML-прослойки

(function () {
  'use strict';

  /**
   * Определяет user_id из .modal_script
   * Приоритет: data-main-user_id > data-id
   */
  function getUserIdFromModalScript() {
    const modalScript = document.querySelector('.modal_script');
    if (!modalScript) return null;

    const mainUserId = modalScript.getAttribute('data-main-user_id');
    if (mainUserId && mainUserId.trim()) {
      return Number(mainUserId.trim());
    }

    const dataId = modalScript.getAttribute('data-id');
    if (dataId && dataId.trim()) {
      return Number(dataId.trim());
    }

    return null;
  }

  /**
   * Маппинг категорий → API labels
   */
  const apiLabels = {
    icon: 'icon_',
    plashka: 'plashka_',
    background: 'background_',
    gift: 'gift_',
    coupon: 'coupon_'
  };

  /**
   * Загружает данные из API для всех категорий
   * Фильтрует только видимые элементы (is_visible !== false)
   * @param {number} userId
   * @returns {Promise<object>} { icon: [], plashka: [], background: [], gift: [], coupon: [] }
   */
  async function loadAllDataFromAPI(userId) {
    const result = {
      icon: [],
      plashka: [],
      background: [],
      gift: [],
      coupon: []
    };

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageGet не найден');
      return result;
    }

    for (const [key, label] of Object.entries(apiLabels)) {
      try {
        const response = await window.FMVbank.storageGet(userId, label);

        // Формат: { last_update_ts, data: [...] }
        if (response && typeof response === 'object' && Array.isArray(response.data)) {
          // Фильтруем только видимые элементы для редактирования
          result[key] = response.data.filter(item => item.is_visible !== false);
        }
      } catch (err) {
        console.error(`[admin_bridge_json] Ошибка загрузки ${key}:`, err);
      }
    }

    return result;
  }

  /**
   * Сохраняет данные в API для всех категорий
   * Логика:
   * 1. GET текущих данных из API
   * 2. Сохраняем только те элементы, которые УЖЕ были is_visible: false (не трогаем их)
   * 3. Все новые элементы из панели → is_visible: true
   * 4. Объединяем: [новые видимые, старые невидимые]
   *
   * @param {number} userId
   * @param {object} jsonData - { icon: [], plashka: [], background: [], gift: [], coupon: [] }
   * @returns {Promise<boolean>}
   */
  async function saveAllDataToAPI(userId, jsonData) {
    if (!window.FMVbank || typeof window.FMVbank.storageSet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageSet не найден');
      return false;
    }

    try {
      for (const [key, label] of Object.entries(apiLabels)) {
        // 1. GET текущих данных из API
        const currentResponse = await window.FMVbank.storageGet(userId, label);
        const currentData = (currentResponse && Array.isArray(currentResponse.data)) ? currentResponse.data : [];

        // 2. Сохраняем только те элементы, которые УЖЕ были is_visible: false
        const invisibleItems = currentData.filter(item => item.is_visible === false);

        // 3. Новые видимые элементы из панели
        const newVisibleItems = (jsonData[key] || []).map(item => ({ ...item, is_visible: true }));

        // 4. Объединяем: сначала видимые, потом невидимые
        const mergedData = [...newVisibleItems, ...invisibleItems];

        const saveData = {
          last_update_ts: Math.floor(Date.now() / 1000),
          data: mergedData
        };

        const result = await window.FMVbank.storageSet(saveData, userId, label);
        if (!result) {
          console.error(`[admin_bridge_json] Не удалось сохранить ${key}`);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('[admin_bridge_json] Ошибка сохранения:', err);
      return false;
    }
  }

  /**
   * Главная функция load
   * @param {string} profileId - id из URL (/profile.php?id=N)
   * @returns {Promise<object>} { status, initialData, save, targetUserId }
   */
  async function load(profileId) {
    const targetUserId = getUserIdFromModalScript() || Number(profileId);

    if (!targetUserId) {
      return {
        status: 'error',
        initialData: {},
        save: null,
        targetUserId: null
      };
    }

    // Загружаем данные из API
    const initialData = await loadAllDataFromAPI(targetUserId);

    /**
     * Функция сохранения
     * @param {object} newData - { icon: [], plashka: [], background: [], gift: [], coupon: [] }
     * @returns {Promise<object>} { ok, status }
     */
    async function save(newData) {
      const success = await saveAllDataToAPI(targetUserId, newData);
      return {
        ok: success,
        status: success ? 'успешно' : 'ошибка сохранения'
      };
    }

    return {
      status: 'ok',
      initialData,
      save,
      targetUserId
    };
  }

  // Экспортируем в window.skinAdmin
  window.skinAdmin = { load };
})();
