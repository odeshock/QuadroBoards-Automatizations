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
          result[key] = response.data;
        }
      } catch (err) {
        console.error(`[admin_bridge_json] Ошибка загрузки ${key}:`, err);
      }
    }

    return result;
  }

  /**
   * Сохраняет данные в API для всех категорий
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
        const categoryData = jsonData[key] || [];

        const saveData = {
          last_update_ts: Math.floor(Date.now() / 1000),
          data: categoryData
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
