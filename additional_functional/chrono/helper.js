// Проверка, что все указанные поля присутствуют и не пусты в window.CHRONO_CHECK
// Пример:
// if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID'])) return;

(function () {
  'use strict';

  /**
   * Проверяет, что в window.CHRONO_CHECK заданы все указанные поля
   * @param {string[]} keys - список имён полей для проверки
   * @returns {boolean} true, если все поля есть и непустые
   */
  window.checkChronoFields = function (keys = []) {
    const ch = window.CHRONO_CHECK;
    if (!ch || typeof ch !== 'object') return false;
    if (!Array.isArray(keys) || !keys.length) return true;

    return keys.every(k => {
      const v = ch[k];
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return true;
    });
  };
})();
