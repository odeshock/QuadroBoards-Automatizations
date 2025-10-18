// collect_skins_api.js — Загрузка и отображение скинов из API на страницах персонажей

(function () {
  console.log('[collect_skins_api] Скрипт загружен');

  const CHARACTER_SELECTOR = '.modal_script[data-id]';
  const DEBUG = true;

  const log = (...a) => DEBUG && console.log('[collect_skins_api]', ...a);

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
   */
  function getUserIdFromCharacter(charEl) {
    if (!charEl) return null;

    const mainUserId = charEl.getAttribute('data-main-user_id');
    if (mainUserId && mainUserId.trim()) {
      return Number(mainUserId.trim());
    }

    const dataId = charEl.getAttribute('data-id');
    if (dataId && dataId.trim()) {
      return Number(dataId.trim());
    }

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

    const apiLabels = {
      icon: 'icon_',
      plashka: 'plashka_',
      background: 'background_',
      gift: 'gift_',
      coupon: 'coupon_'
    };

    for (const [key, label] of Object.entries(apiLabels)) {
      try {
        const data = await window.FMVbank.storageGet(userId, label);
        log(`${key} данные:`, data);

        // Данные хранятся в формате { "user_id": [...] }
        const userData = data?.[String(userId)];
        if (Array.isArray(userData)) {
          result[key] = userData;
        }
      } catch (e) {
        console.error(`[collect_skins_api] Ошибка загрузки ${key}:`, e);
      }
    }

    log('Все данные загружены:', result);
    return result;
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

      let html = '';
      items.forEach(item => {
        const attrs = [
          `title="${escapeHtml(item.title || '')}"`,
          `data-id="${escapeHtml(item.id || '')}"`
        ];

        // Добавляем все data-* атрибуты
        Object.keys(item).forEach(k => {
          if (k !== 'title' && k !== 'id' && k !== 'content') {
            const attrName = 'data-' + k.replace(/_/g, '-');
            attrs.push(`${attrName}="${escapeHtml(item[k] || '')}"`);
          }
        });

        html += `<div class="item" ${attrs.join(' ')}>${item.content || ''}</div>`;
      });

      target.innerHTML = html;
      log(`Вставлено ${items.length} элементов в ${selector}`);
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
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
