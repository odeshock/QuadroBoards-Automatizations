(function () {


  // ==== настройки ====
  const CHARACTER_SELECTOR = '.modal_script[data-id]';
  const CHRONO_TARGET_SEL = '.chrono_info';
  const DEBUG = true;
  const API_KEY_LABEL = 'chrono_'; // Используем ключ chrono_ для хронологии

  // ====================

  const log = (...a) => DEBUG && console.log('[collect_api]', ...a);

  log('[collect_api] Скрипт загружен');

  // Проверка наличия FMVbank
  function requireFMVbank() {
    if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
      throw new Error('FMVbank не найден — подключите src/bank/api.js');
    }
  }

  // Получение данных хронологии из API (из единого объекта info_)
  async function fetchChronoFromApi(userId) {
    requireFMVbank();
    try {
      const fullData = await window.FMVbank.storageGet(Number(userId), API_KEY_LABEL);
      log('Получены данные для userId', userId, ':', fullData);

      // Извлекаем только chrono из полного объекта
      if (fullData && typeof fullData === 'object' && fullData.chrono) {
        log('Извлечены данные chrono:', fullData.chrono);
        return fullData.chrono;
      }

      log('Данные chrono не найдены в API');
      return null;
    } catch (e) {
      console.error(`[collect_api] Ошибка получения данных для userId ${userId}:`, e);
      return null;
    }
  }

  // Построение HTML из данных хронологии
  function buildChronoHtml(data) {
    if (!data || typeof data !== 'object') {
      return '<p>Нет данных хронологии</p>';
    }

    // Проверяем наличие FMV.buildChronoHtml
    if (window.FMV && typeof window.FMV.buildChronoHtml === 'function') {
      try {
        return window.FMV.buildChronoHtml(data, { titlePrefix: 'Хронология' });
      } catch (e) {
        console.error('[collect_api] Ошибка FMV.buildChronoHtml:', e);
      }
    }

    // Fallback: простой вывод данных
    log('FMV.buildChronoHtml не найден, используем fallback');
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return '<p>Хронология пуста</p>';
    }

    let html = '<div class="chrono-data">';
    for (const [key, value] of entries) {
      html += `<div><strong>${key}:</strong> ${JSON.stringify(value)}</div>`;
    }
    html += '</div>';
    return html;
  }

  // Вставка HTML в контейнер
  function injectHtml(target, html) {
    if (!target) return;
    target.innerHTML = html;
  }

  // Переносит .chrono_info внутрь .character, если они оказались соседями
  function normalizeStructure(scope) {
    const char = scope.querySelector(CHARACTER_SELECTOR);
    if (!char) return;
    const chrono = scope.querySelector(CHRONO_TARGET_SEL);
    if (chrono && chrono.parentElement !== char) char.appendChild(chrono);
  }

  // Находим «узкий» scope вокруг конкретного персонажа
  function scopeForCharacter(el) {
    return el.closest('.modal_wrap, .reveal-modal, .container, #character') || el.parentElement || document;
  }

  // Загрузка и вставка хронологии из API
  async function loadChronoFromApi(userId, scope) {
    console.log('[collect_api] loadChronoFromApi, ищем', CHRONO_TARGET_SEL, 'в scope');
    const target = scope.querySelector(CHRONO_TARGET_SEL);
    console.log('[collect_api] target найден:', target);
    if (!target) {
      log('chrono_info не найден для userId', userId);
      return;
    }

    // Показываем индикатор загрузки
    console.log('[collect_api] Показываем индикатор загрузки');
    target.innerHTML = '<p>Загрузка хронологии...</p>';

    // Получаем данные из API
    console.log('[collect_api] Запрашиваем данные из API');
    const data = await fetchChronoFromApi(userId);
    console.log('[collect_api] Получены данные:', data);

    if (!data) {
      console.log('[collect_api] Данные не получены');
      target.innerHTML = '<p>Не удалось загрузить данные хронологии</p>';
      return;
    }

    // Строим HTML
    console.log('[collect_api] Строим HTML');
    const html = buildChronoHtml(data);
    console.log('[collect_api] HTML построен, длина:', html.length);

    // Вставляем в контейнер
    injectHtml(target, html);
    console.log('[collect_api] Хронология загружена для userId', userId);
  }

  async function initIn(root) {
    console.log('[collect_api] initIn вызван, root:', root);
    if (!root) {
      console.log('[collect_api] root не передан');
      return;
    }

    // Проверяем наличие FMVbank
    try {
      requireFMVbank();
      console.log('[collect_api] FMVbank найден');
    } catch (e) {
      console.warn('[collect_api]', e.message);
      return;
    }

    // берём конкретного character, а не первый на документе
    const charEl = root.querySelector(CHARACTER_SELECTOR) || document.querySelector(CHARACTER_SELECTOR);
    console.log('[collect_api] charEl:', charEl);
    if (!charEl) {
      log('no character');
      return;
    }

    const scope = scopeForCharacter(charEl);
    console.log('[collect_api] scope:', scope);
    normalizeStructure(scope);

    const userId = charEl.getAttribute('data-id')?.trim();
    console.log('[collect_api] userId:', userId);
    if (!userId) {
      log('no data-id');
      return;
    }

    // Загружаем хронологию из API
    console.log('[collect_api] Вызываем loadChronoFromApi для userId', userId);
    await loadChronoFromApi(userId, scope);
  }

  // ручной запуск
  window.loadUserChronoFromApi = function ({ root, rootSelector } = {}) {
    const r = root || (rootSelector ? document.querySelector(rootSelector) : document);
    initIn(r);
  };

  // автозапуск
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[collect_api] DOMContentLoaded событие');
    initIn(document);
  });

  // динамика (модалки)
  const seen = new WeakSet();
  const observer = new MutationObserver((recs) => {
    recs.forEach(rec => {
      rec.addedNodes && rec.addedNodes.forEach(n => {
        if (!(n instanceof Element)) return;
        // если добавили .character — запускаемся в его scope
        if (n.matches && n.matches(CHARACTER_SELECTOR) && !seen.has(n)) {
          seen.add(n);
          initIn(scopeForCharacter(n));
        }
        // или если .character появился как потомок
        n.querySelectorAll && n.querySelectorAll(CHARACTER_SELECTOR).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          initIn(scopeForCharacter(el));
        });
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
