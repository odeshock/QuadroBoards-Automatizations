/**
 * Загружает фоны/иконки/плашки/подарки/купоны из API.
 * Каждая категория хранится в отдельном ключе: library_icon_1, library_plashka_1, и т.д.
 * @returns {Promise<{plashka: Array, icon: Array, back: Array, gift: Array, coupon: Array}>}
 */
async function fetchLibraryItems() {
  // Загружаем каждую категорию из отдельного ключа
  const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];
  const result = {
    plashka: [],
    icon: [],
    back: [],
    gift: [],
    coupon: []
  };

  for (const category of categories) {
    try {
      const data = await window.FMVbank.storageGet(1, `library_${category}_`);

      if (!data || !data.items || !Array.isArray(data.items)) {
        console.warn(`[fetchLibraryItems] library_${category}_1 не найдена или пуста`);
        continue;
      }

      // Конвертируем API формат в формат для банка
      // API: {id, content, t, h, c, s} где t=title, h=hidden, c=custom, s=system (значения 1/0)
      // Bank: {id, icon, hidden, custom, system} где icon=content (значения true/false)

      if (category === 'coupon') {
        // Купоны: {id, content, t, s_t, type, f, v}
        result.coupon = data.items.map(item => {
          const converted = {
            id: item.id,
            icon: item.content || ''
          };

          // Добавляем дополнительные поля если они есть
          if (item.s_t) converted.system_title = item.s_t; // system_title
          if (item.type) converted.type = item.type;
          if (item.f) converted.form = item.f; // form
          if (item.v !== undefined) converted.value = item.v; // value

          return converted;
        });
      } else {
        // Обычные скины: {id, content, t, h, c, s}
        // НЕ фильтруем hidden здесь - фильтрация происходит в data.js в зависимости от IS_ADMIN
        const items = data.items.map(item => {
          const converted = {
            id: item.id,
            icon: item.content || ''
          };

          // Конвертируем 1/0 в true/false
          if (item.h !== undefined) converted.hidden = item.h === 1;
          if (item.c !== undefined) converted.custom = item.c === 1;
          if (item.s !== undefined) converted.system = item.s === 1;

          return converted;
        });

        // Сопоставляем категории с ключами результата
        const targetKey = category === 'background' ? 'back' : category;
        result[targetKey] = items;
      }
    } catch (error) {
      console.error(`[fetchLibraryItems] Ошибка загрузки ${category}:`, error);
    }
  }

  return result;
}

window.fetchLibraryItems = fetchLibraryItems;
