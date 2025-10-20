// fetch_libraries.js — Загрузка библиотек (плашки, иконки, фон, подарки, купоны)

/**
 * Загружает все библиотеки из API (library_skin_1)
 * @returns {Promise<Object>} { plashka: [], icon: [], back: [], gift: [], coupon: [] }
 */
async function fetchAllLibraries() {
  console.log('[fetchAllLibraries] Загружаю библиотеки из API');

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

  try {
    // Загружаем библиотеку из API (userId=1, api_key_label='library_skin_')
    const libraryData = await window.FMVbank.storageGet(1, 'library_skin_');
    console.log('[fetchAllLibraries] Данные из API:', libraryData);

    if (!libraryData || typeof libraryData !== 'object') {
      console.warn('[fetchAllLibraries] Нет данных в library_skin_1');
      return {
        plashka: [],
        icon: [],
        back: [],
        gift: [],
        coupon: []
      };
    }

    // Конвертируем данные из API в формат для панелей
    // Формат API: { id, content, title, hidden, custom, ... }
    // Формат панели: { id, html } где html = <div class="item" data-id="..." title="...">content</div>

    const convertToLibraryFormat = (items, isHidden = false) => {
      return (items || [])
        .filter(item => isHidden ? item.hidden === true : item.hidden !== true) // фильтруем по hidden
        .map(item => ({
          id: item.id,
          html: `<div class="item" data-id="${escapeAttr(item.id)}" title="${escapeAttr(item.title || '')}">${item.content || ''}</div>`
        }));
    };

    const convertCouponsToLibraryFormat = (items) => {
      return (items || []).map(item => {
        const titleAttr = item.title ? ` title="${escapeAttr(item.title)}"` : '';
        const systemTitleAttr = item.system_title ? ` data-coupon-title="${escapeAttr(item.system_title)}"` : '';
        const typeAttr = item.type ? ` data-coupon-type="${escapeAttr(item.type)}"` : '';
        const formAttr = item.form ? ` data-coupon-form="${escapeAttr(item.form)}"` : '';
        const valueAttr = item.value !== undefined ? ` data-coupon-value="${escapeAttr(String(item.value))}"` : '';

        return {
          id: item.id,
          html: `<div class="item" data-id="${escapeAttr(item.id)}"${titleAttr}${systemTitleAttr}${typeAttr}${formAttr}${valueAttr}>${item.content || ''}</div>`
        };
      });
    };

    function escapeAttr(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    return {
      plashka: convertToLibraryFormat(libraryData.plashka),
      icon: convertToLibraryFormat(libraryData.icon),
      back: convertToLibraryFormat(libraryData.background),
      gift: convertToLibraryFormat(libraryData.gift),
      coupon: convertCouponsToLibraryFormat(libraryData.coupon)
    };

  } catch (error) {
    console.error('[fetchAllLibraries] Ошибка загрузки библиотек:', error);
    return {
      plashka: [],
      icon: [],
      back: [],
      gift: [],
      coupon: []
    };
  }
}

// Экспортируем в window
window.fetchAllLibraries = fetchAllLibraries;
