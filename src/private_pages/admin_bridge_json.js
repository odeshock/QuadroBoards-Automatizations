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
   * Помечает каждый элемент is_visible в зависимости от наличия в библиотеке
   * @param {number} userId
   * @param {object} libraryIds - { icon: Set, plashka: Set, ... }
   * @returns {Promise<object>} { visible: { icon: [], ... }, invisible: { icon: [], ... } }
   */
  async function loadAllDataFromAPI(userId, libraryIds) {
    const visible = {
      icon: [],
      plashka: [],
      background: [],
      gift: [],
      coupon: []
    };

    const invisible = {
      icon: [],
      plashka: [],
      background: [],
      gift: [],
      coupon: []
    };

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageGet не найден');
      return { visible, invisible };
    }

    for (const [key, label] of Object.entries(apiLabels)) {
      try {
        const response = await window.FMVbank.storageGet(userId, label);

        // Формат: { last_update_ts, data: [...] }
        if (response && typeof response === 'object' && Array.isArray(response.data)) {
          const libIds = libraryIds[key] || new Set();

          response.data.forEach(item => {
            const isInLibrary = libIds.has(String(item.id));
            const markedItem = { ...item, is_visible: isInLibrary };

            if (isInLibrary) {
              visible[key].push(markedItem);
            } else {
              invisible[key].push(markedItem);
            }
          });
        }
      } catch (err) {
        console.error(`[admin_bridge_json] Ошибка загрузки ${key}:`, err);
      }
    }

    return { visible, invisible };
  }

  /**
   * Сохраняет данные в API для всех категорий
   * Объединяет данные из панели + невидимые элементы
   *
   * @param {number} userId
   * @param {object} visibleData - { icon: [], plashka: [], ... } данные из панели
   * @param {object} invisibleData - { icon: [], plashka: [], ... } невидимые элементы
   * @returns {Promise<boolean>}
   */
  async function saveAllDataToAPI(userId, visibleData, invisibleData) {
    if (!window.FMVbank || typeof window.FMVbank.storageSet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageSet не найден');
      return false;
    }

    try {
      for (const [key, label] of Object.entries(apiLabels)) {
        // Видимые элементы из панели (помечаем is_visible: true)
        const visible = (visibleData[key] || []).map(item => ({ ...item, is_visible: true }));

        // Невидимые элементы (уже помечены is_visible: false)
        const invisible = invisibleData[key] || [];

        // Объединяем: сначала видимые, потом невидимые
        const mergedData = [...visible, ...invisible];

        // ВАЖНО: Сохраняем только если есть данные для этой категории
        // Иначе пустой массив перезапишет существующие данные в других категориях
        if (mergedData.length === 0) {
          console.log(`[admin_bridge_json] Пропускаю сохранение ${key} — нет данных`);
          continue;
        }

        const saveData = {
          last_update_ts: Math.floor(Date.now() / 1000),
          data: mergedData
        };

        const result = await window.FMVbank.storageSet(saveData, userId, label);
        if (!result) {
          console.error(`[admin_bridge_json] Не удалось сохранить ${key}`);
          return false;
        }
        console.log(`[admin_bridge_json] Сохранено ${key}: ${mergedData.length} элементов`);
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
   * @param {object} libraryIds - { icon: Set, plashka: Set, ... }
   * @returns {Promise<object>} { status, visibleData, invisibleData, save, targetUserId }
   */
  async function load(profileId, libraryIds) {
    // Загружаем страницу /pages/usrN и извлекаем правильный userId
    const targetUserId = await getUserIdFromPage(profileId);

    if (!targetUserId) {
      return {
        status: 'error',
        visibleData: {},
        invisibleData: {},
        save: null,
        targetUserId: null
      };
    }

    // Загружаем данные из API и помечаем is_visible
    const { visible, invisible } = await loadAllDataFromAPI(targetUserId, libraryIds);

    /**
     * Функция сохранения
     * @param {object} newVisibleData - { icon: [], plashka: [], ... } данные из панели
     * @returns {Promise<object>} { ok, status }
     */
    async function save(newVisibleData) {
      const success = await saveAllDataToAPI(targetUserId, newVisibleData, invisible);
      return {
        ok: success,
        status: success ? 'успешно' : 'ошибка сохранения'
      };
    }

    return {
      status: 'ok',
      visibleData: visible,
      invisibleData: invisible,
      save,
      targetUserId
    };
  }

  // Экспортируем в window.skinAdmin
  window.skinAdmin = { load };
})();
