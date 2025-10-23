// collect_skins_api.js — Загрузка и отображение скинов из API на страницах персонажей

(function () {


  const CHARACTER_SELECTOR = '.modal_script[data-id]';
  const DEBUG = false;

  const log = (...a) => DEBUG && console.log('[collect_skins_api]', ...a);

  log('[collect_skins_api] Скрипт загружен');

  // Селекторы для вставки данных
  const SECTION_SELECTORS = {
    icon: '._icon',
    plashka: '._plashka',
    background: '._background',
    gift: '._gift',
    coupon: '._coupon'
  };

  /**
   * Получает userId из атрибутов .modal_script
   * Приоритет: data-main-user_id > data-id
   */
  function getUserIdFromCharacter(charEl) {
    if (!charEl) {
      log('getUserIdFromCharacter: charEl отсутствует');
      return null;
    }

    const mainUserId = charEl.getAttribute('data-main-user_id');
    log('getUserIdFromCharacter: data-main-user_id =', mainUserId);

    if (mainUserId && mainUserId.trim()) {
      const result = Number(mainUserId.trim());
      log('getUserIdFromCharacter: используем data-main-user_id =', result);
      return result;
    }

    const dataId = charEl.getAttribute('data-id');
    log('getUserIdFromCharacter: data-id =', dataId);

    if (dataId && dataId.trim()) {
      const result = Number(dataId.trim());
      log('getUserIdFromCharacter: используем data-id =', result);
      return result;
    }

    log('getUserIdFromCharacter: userId не найден');
    return null;
  }

  /**
   * Загружает данные из API
   */
  async function loadDataFromAPI(userId) {
    log('Загружаю данные из API для userId', userId);

    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      console.error('[collect_skins_api] FMVbank.storageGet не найден');
      return null;
    }

    const result = {
      icon: [],
      plashka: [],
      background: [],
      gift: [],
      coupon: []
    };

    try {
      // Загружаем единый объект skin_<userId>
      const response = await window.FMVbank.storageGet(userId, 'skin_');
      log('skin_ ответ:', response);

      if (!response || typeof response !== 'object') {
        log('Нет данных в skin_ для userId', userId);
        return result;
      }

      // Извлекаем каждую категорию из единого объекта
      const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

      categories.forEach(key => {
        const items = response[key];

        if (Array.isArray(items)) {
          // Фильтруем только видимые элементы (is_visible !== false)
          const filtered = items.filter(item => item.is_visible !== false);
          result[key] = filtered;
          log(`${key} загружено ${filtered.length} видимых элементов из ${items.length}`);
        } else {
          log(`${key} отсутствует или не массив`);
          result[key] = [];
        }
      });

      log('Все данные загружены:', result);
      return result;

    } catch (e) {
      console.error('[collect_skins_api] Ошибка загрузки данных:', e);
      return result;
    }
  }

  /**
   * Вставляет данные в DOM
   */
  function injectData(scope, data) {
    log('Вставляю данные в DOM:', data);

    for (const [key, selector] of Object.entries(SECTION_SELECTORS)) {
      const target = scope.querySelector(selector);
      if (!target) {
        log(`Контейнер ${selector} не найден`);
        continue;
      }

      const items = data[key] || [];
      if (items.length === 0) {
        log(`Нет данных для ${key}`);
        target.innerHTML = '';
        continue;
      }

      // Оборачиваем content в <div class="item"> с атрибутами
      const html = items.map(item => {
        const attrs = [
          `data-id="${escapeAttr(item.id)}"`,
          `title="${escapeAttr(item.title || '')}"`
        ];

        // Добавляем все остальные data-* атрибуты
        Object.keys(item).forEach(itemKey => {
          if (itemKey !== 'id' && itemKey !== 'title' && itemKey !== 'content' && itemKey !== 'is_visible') {
            // Конвертируем подчёркивания обратно в дефисы (coupon_type -> coupon-type)
            const attrName = 'data-' + itemKey.replace(/_/g, '-');
            attrs.push(`${attrName}="${escapeAttr(item[itemKey] || '')}"`);
          }
        });

        return `<div class="item" ${attrs.join(' ')}>${item.content || ''}</div>`;
      }).join('\n');

      target.innerHTML = html;
      log(`Вставлено ${items.length} элементов в ${selector}`);
    }
  }

  function escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  /**
   * Находит scope вокруг персонажа
   */
  function scopeForCharacter(el) {
    return el.closest('.modal_wrap, .reveal-modal, .container, #character') || el.parentElement || document;
  }

  /**
   * Переносит контейнеры внутрь .character если нужно
   */
  function normalizeStructure(scope) {
    const char = scope.querySelector(CHARACTER_SELECTOR);
    if (!char) return;

    Object.values(SECTION_SELECTORS).forEach(selector => {
      const container = scope.querySelector(selector);
      if (container && container.parentElement !== char) {
        char.appendChild(container);
      }
    });
  }

  /**
   * Инициализация для конкретного персонажа
   */
  async function initIn(root) {
    log('initIn вызван, root:', root);
    if (!root) {
      log('root не передан');
      return;
    }

    // Проверяем наличие FMVbank
    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      console.warn('[collect_skins_api] FMVbank.storageGet не найден');
      return;
    }

    // Ищем .modal_script
    const charEl = root.querySelector(CHARACTER_SELECTOR) || document.querySelector(CHARACTER_SELECTOR);
    log('charEl:', charEl);
    if (!charEl) {
      log('character не найден');
      return;
    }

    const scope = scopeForCharacter(charEl);
    log('scope:', scope);
    normalizeStructure(scope);

    const userId = getUserIdFromCharacter(charEl);
    log('userId:', userId);
    if (!userId) {
      log('userId не найден');
      return;
    }

    // Загружаем данные из API
    log('Загружаю данные для userId', userId);
    const data = await loadDataFromAPI(userId);

    if (!data) {
      log('Данные не загружены');
      return;
    }

    // Вставляем в DOM
    injectData(scope, data);
    log('Данные вставлены для userId', userId);
  }

  // Ручной запуск
  window.loadUserSkinsFromApi = function ({ root, rootSelector } = {}) {
    const r = root || (rootSelector ? document.querySelector(rootSelector) : document);
    initIn(r);
  };

  // Автозапуск при загрузке страницы
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded событие');
    initIn(document);
  });

  // Динамическое появление персонажей (модалки)
  const seen = new WeakSet();
  const observer = new MutationObserver((recs) => {
    recs.forEach(rec => {
      rec.addedNodes && rec.addedNodes.forEach(n => {
        if (!(n instanceof Element)) return;

        if (n.matches && n.matches(CHARACTER_SELECTOR) && !seen.has(n)) {
          seen.add(n);
          log('Обнаружен новый character:', n);
          initIn(scopeForCharacter(n));
        }

        n.querySelectorAll && n.querySelectorAll(CHARACTER_SELECTOR).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          log('Обнаружен вложенный character:', el);
          initIn(scopeForCharacter(el));
        });
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  log('Скрипт инициализирован');
})();
