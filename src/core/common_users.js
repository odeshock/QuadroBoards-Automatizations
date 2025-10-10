// ===== FMV.fetchUsers - обёртка вокруг window.scrapeUsers =====
(function () {
  'use strict';

  if (!window.FMV) window.FMV = {};

  /**
   * Загружает список всех пользователей форума с кэшированием
   * Использует window.scrapeUsers из common.js
   * @param {Object} [opts] - Опции загрузки
   * @param {boolean} [opts.force=false] - Игнорировать кэш
   * @param {number} [opts.maxPages=1000] - Максимум страниц для загрузки
   * @param {number} [opts.batchSize=5] - Количество страниц загружаемых параллельно
   * @returns {Promise<Array<{id: number, code: string, name: string}>>}
   */
  FMV.fetchUsers = async function (opts = {}) {
    if (typeof window.scrapeUsers !== 'function') {
      throw new Error('window.scrapeUsers не найдена. Убедитесь, что common.js загружен.');
    }
    return await window.scrapeUsers(opts);
  };

  /**
   * Очистить кэш пользователей
   */
  FMV.invalidateUsersCache = function () {
    try {
      sessionStorage.removeItem('fmv_users_cache_v2');
      sessionStorage.removeItem('fmv_users_cache_v1'); // старый кэш тоже удалим
    } catch (_) {}
  };

})();
