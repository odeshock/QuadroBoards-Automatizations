// fetch_libraries.js — Загрузка библиотек (плашки, иконки, фон, подарки, купоны)

/**
 * Загружает все библиотеки из API (library_icon_1, library_plashka_1, и т.д.)
 * @returns {Promise<Object>} { plashka: [], icon: [], back: [], gift: [], coupon: [] }
 */
async function fetchAllLibraries() {
  // Флаг отладки - установите в true для вывода логов
  const DEBUG = false;

  // Функция логирования с проверкой DEBUG
  const log = (...args) => {
    if (DEBUG) console.log('[fetchAllLibraries]', ...args);
  };

  log('Загружаю библиотеки из API');

  // Проверка наличия FMVbank
  if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
    console.error('[fetchAllLibraries] FMVbank.storageGet не найден');
    return {
      plashka: [],
      icon: [],
      back: [],
      gift: [],
      coupon: []
    };
  }

  function escapeAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const result = {
    plashka: [],
    icon: [],
    back: [],
    gift: [],
    coupon: []
  };

  const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

  for (const category of categories) {
    try {
      // Загружаем каждую категорию из отдельного ключа
      const data = await window.FMVbank.storageGet(1, `library_${category}_`);

      if (!data || !data.items || !Array.isArray(data.items)) {
        log(`library_${category}_1 не найдена или пуста`);
        continue;
      }

      // Конвертируем данные из API в формат для панелей
      // Формат API: { id, content, t, h, c, s } где t=title, h=hidden, c=custom, s=system (значения 1/0)
      // Формат панели: { id, html } где html = <div class="item" data-id="..." title="...">content</div>

      if (category === 'coupon') {
        // Купоны: {id, content, t, s_t, type, f, v}
        result.coupon = data.items.map(item => {
          const titleAttr = item.t ? ` title="${escapeAttr(item.t)}"` : '';
          const systemTitleAttr = item.s_t ? ` data-coupon-title="${escapeAttr(item.s_t)}"` : '';
          const typeAttr = item.type ? ` data-coupon-type="${escapeAttr(item.type)}"` : '';
          const formAttr = item.f ? ` data-coupon-form="${escapeAttr(item.f)}"` : '';
          const valueAttr = item.v !== undefined ? ` data-coupon-value="${escapeAttr(String(item.v))}"` : '';

          return {
            id: item.id,
            html: `<div class="item" data-id="${escapeAttr(item.id)}"${titleAttr}${systemTitleAttr}${typeAttr}${formAttr}${valueAttr}>${item.content || ''}</div>`
          };
        });
      } else {
        // Обычные скины: {id, content, t, h, c, s}
        const items = data.items
          .filter(item => item.h !== 1) // Фильтруем hidden
          .map(item => ({
            id: item.id,
            html: `<div class="item" data-id="${escapeAttr(item.id)}" title="${escapeAttr(item.t || '')}">${item.content || ''}</div>`
          }));

        // Сопоставляем категории с ключами результата
        const targetKey = category === 'background' ? 'back' : category;
        result[targetKey] = items;
      }
    } catch (error) {
      console.error(`[fetchAllLibraries] Ошибка загрузки ${category}:`, error);
    }
  }

  return result;
}

// Экспортируем в window
window.fetchAllLibraries = fetchAllLibraries;
