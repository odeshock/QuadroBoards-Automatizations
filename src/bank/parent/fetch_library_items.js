/**
 * Загружает фоны/иконки/плашки/подарки/купоны из API (library_skin_1).
 * @returns {Promise<{plashka: Array, icon: Array, back: Array, gift: Array, coupon: Array}>}
 */
async function fetchLibraryItems() {
  // Загружаем из API
  const libraryData = await window.FMVbank.storageGet(1, 'library_skin_');

  if (!libraryData || typeof libraryData !== 'object') {
    console.warn('[fetchLibraryItems] library_skin_1 не найдена в API, возвращаем пустые массивы');
    return {
      plashka: [],
      icon: [],
      back: [],
      gift: [],
      coupon: []
    };
  }

  // Конвертируем API формат в формат для банка
  // API: {id, content, title, hidden, custom}
  // Bank: {id, icon, hidden, custom} где icon = content
  const convertToLibraryFormat = (items) => {
    return (items || [])
      .filter(item => item.hidden !== true)
      .map(item => {
        const result = {
          id: item.id,
          icon: item.content || ''
        };

        // Добавляем hidden и custom если они есть
        if (item.hidden !== undefined) result.hidden = item.hidden;
        if (item.custom !== undefined) result.custom = item.custom;

        return result;
      });
  };

  // Купоны имеют дополнительные поля: system_title, type, form, value
  const convertCouponsToLibraryFormat = (items) => {
    return (items || []).map(item => {
      const result = {
        id: item.id,
        icon: item.content || ''
      };

      // Добавляем дополнительные поля если они есть
      if (item.system_title) result.system_title = item.system_title;
      if (item.type) result.type = item.type;
      if (item.form) result.form = item.form;
      if (item.value !== undefined) result.value = item.value;

      return result;
    });
  };

  return {
    plashka: convertToLibraryFormat(libraryData.plashka),
    icon: convertToLibraryFormat(libraryData.icon),
    back: convertToLibraryFormat(libraryData.background),
    gift: convertToLibraryFormat(libraryData.gift),
    coupon: convertCouponsToLibraryFormat(libraryData.coupon)
  };
}

window.fetchLibraryItems = fetchLibraryItems;
