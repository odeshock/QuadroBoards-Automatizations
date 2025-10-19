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
   * Загружает данные из API (единый объект info_<userId>)
   * Помечает каждый элемент is_visible в зависимости от наличия в библиотеке
   * @param {number} userId
   * @param {object} libraryIds - { icon: Set, plashka: Set, ... }
   * @returns {Promise<object>} { visible: { icon: [], ... }, invisible: { icon: [], ... }, chrono: {}, comment_id: null }
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

    let chrono = {};
    let comment_id = null;

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageGet не найден');
      return { visible, invisible, chrono, comment_id };
    }

    try {
      // Загружаем единый объект info_<userId>
      const response = await window.FMVbank.storageGet(userId, 'info_');

      if (!response || typeof response !== 'object') {
        console.warn('[admin_bridge_json] Нет данных в API для userId=' + userId);
        return { visible, invisible, chrono, comment_id };
      }

      // Извлекаем chrono и comment_id
      chrono = response.chrono || {};
      comment_id = response.comment_id || null;

      // Обрабатываем категории скинов
      const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

      for (const key of categories) {
        const items = response[key] || [];
        if (!Array.isArray(items)) continue;

        const libIds = libraryIds[key] || new Set();

        items.forEach(item => {
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
      console.error('[admin_bridge_json] Ошибка загрузки данных:', err);
    }

    return { visible, invisible, chrono, comment_id };
  }

  /**
   * Сохраняет данные в API (единый объект info_<userId>)
   * ВАЖНО: Сначала делает GET, затем частично обновляет данные и сохраняет обратно
   *
   * @param {number} userId
   * @param {object} visibleData - { icon: [], plashka: [], ... } данные из панели
   * @param {object} invisibleData - { icon: [], plashka: [], ... } невидимые элементы
   * @param {object} existingChrono - существующие данные chrono (не изменяем)
   * @param {number|null} existingCommentId - существующий comment_id (не изменяем)
   * @returns {Promise<boolean>}
   */
  async function saveAllDataToAPI(userId, visibleData, invisibleData, existingChrono, existingCommentId) {
    console.log('[admin_bridge_json] 🔥 СОХРАНЕНИЕ ДЛЯ userId:', userId);
    console.log('[admin_bridge_json] 🔥 visibleData:', JSON.parse(JSON.stringify(visibleData)));
    console.log('[admin_bridge_json] 🔥 invisibleData:', JSON.parse(JSON.stringify(invisibleData)));

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function' || typeof window.FMVbank.storageSet !== 'function') {
      console.error('[admin_bridge_json] FMVbank.storageGet или storageSet не найдены');
      return false;
    }

    try {
      // ШАГ 1: Сначала получаем текущие данные из API
      console.log('[admin_bridge_json] 📥 Загружаю текущие данные из API...');
      const currentData = await window.FMVbank.storageGet(userId, 'info_');

      // Если данных нет, создаём пустой объект
      const baseData = currentData && typeof currentData === 'object' ? currentData : {};

      console.log('[admin_bridge_json] 📥 Текущие данные из API:', JSON.parse(JSON.stringify(baseData)));

      // ШАГ 2: Обновляем только категории скинов
      const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

      for (const key of categories) {
        // Видимые элементы из панели (помечаем is_visible: true)
        const visible = (visibleData[key] || []).map(item => ({ ...item, is_visible: true }));

        // Невидимые элементы (уже помечены is_visible: false)
        const invisible = invisibleData[key] || [];

        // Объединяем: сначала видимые, потом невидимые
        const mergedData = [...visible, ...invisible];

        console.log('[admin_bridge_json] 📦 ' + key + ': ' + mergedData.length + ' элементов');

        // Сохраняем в базовый объект (даже если пустой массив)
        baseData[key] = mergedData;
      }

      // ШАГ 3: Сохраняем chrono и comment_id (не изменяем, берём из существующих)
      baseData.chrono = existingChrono || baseData.chrono || {};
      baseData.comment_id = existingCommentId !== undefined ? existingCommentId : (baseData.comment_id || null);

      // ШАГ 4: Обновляем last_timestamp
      baseData.last_timestamp = Math.floor(Date.now() / 1000);

      console.log('[admin_bridge_json] 💾 Финальный объект для сохранения:', JSON.parse(JSON.stringify(baseData)));

      // ШАГ 5: Сохраняем весь объект
      const result = await window.FMVbank.storageSet(baseData, userId, 'info_');
      if (!result) {
        console.error('[admin_bridge_json] ❌ Не удалось сохранить данные');
        return false;
      }

      console.log('[admin_bridge_json] ✅ Данные успешно сохранены');
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
   * @returns {Promise<object>} { status, visibleData, invisibleData, chrono, comment_id, save, targetUserId }
   */
  async function load(profileId, libraryIds) {
    // Загружаем страницу /pages/usrN и извлекаем правильный userId
    const targetUserId = await getUserIdFromPage(profileId);

    if (!targetUserId) {
      return {
        status: 'error',
        visibleData: {},
        invisibleData: {},
        chrono: {},
        comment_id: null,
        save: null,
        targetUserId: null
      };
    }

    // Загружаем данные из API и помечаем is_visible
    const { visible, invisible, chrono, comment_id } = await loadAllDataFromAPI(targetUserId, libraryIds);

    /**
     * Функция сохранения
     * @param {object} newVisibleData - { icon: [], plashka: [], ... } данные из панели
     * @returns {Promise<object>} { ok, status }
     */
    async function save(newVisibleData) {
      const success = await saveAllDataToAPI(targetUserId, newVisibleData, invisible, chrono, comment_id);
      return {
        ok: success,
        status: success ? 'успешно' : 'ошибка сохранения'
      };
    }

    return {
      status: 'ok',
      visibleData: visible,
      invisibleData: invisible,
      chrono: chrono,
      comment_id: comment_id,
      save,
      targetUserId
    };
  }

  // Экспортируем в window.skinAdmin
  window.skinAdmin = { load };
})();
