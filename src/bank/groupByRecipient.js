// ============================================================================
// groupByRecipient.js — Группировка операций по получателям
// ============================================================================

/* ===== Система логирования ===== */
const DEBUG = true; // false чтобы отключить все console.log()

const log = DEBUG ? console.log.bind(console) : () => { };
const warn = DEBUG ? console.warn.bind(console) : () => { };
const error = DEBUG ? console.error.bind(console) : () => { };

/**
 * Создаёт из BACKUP_DATA словарь операций, сгруппированных по получателям
 * @param {Object} backupData - объект с данными из BACKUP_DATA
 * @returns {Object} объект вида { "recipient_id": [operations], "recipient_id": [operations], ... }
 */
export function groupOperationsByRecipient(backupData) {
  log('[groupByRecipient] Входные данные:', backupData);
  log('[groupByRecipient] backupData существует?', !!backupData);
  log('[groupByRecipient] backupData.fullData существует?', !!backupData?.fullData);
  log('[groupByRecipient] backupData.fullData:', backupData?.fullData);

  if (!backupData || !backupData.fullData) {
    warn('[groupByRecipient] Некорректные данные backup');
    return [];
  }

  // Извлекаем USER_ID из environment
  const defaultUserId = backupData.environment?.USER_ID || 0;
  log('[groupByRecipient] defaultUserId:', defaultUserId);

  if (!defaultUserId) {
    warn('[groupByRecipient] USER_ID не найден в backupData.environment');
    return [];
  }

  // Список form_id операций, которые нужно исключить
  const excludedForms = [
    'form-income-needrequest',      // Размещение заявки на нужного
    'form-income-firstpost',        // Первый пост на профиле
    'form-income-personalpost',     // Каждый личный пост
    'form-income-plotpost',         // Каждый сюжетный пост
    'form-income-ep-personal',      // Завершённый личный эпизод
    'form-income-ep-plot',          // Завершённый сюжетный эпизод
    'form-income-100msgs',          // Каждые 100 сообщений
    'form-income-100rep',           // Каждые 100 репутации
    'form-income-100pos',           // Каждые 100 позитива
    'form-income-month',            // Каждый игровой месяц
    'form-income-flyer',            // Каждая рекламная листовка
    'form-income-contest',          // Участие в конкурсе
    'form-income-avatar',           // Аватарка для другого игрока
    'form-income-design-other',     // Другой дизайн для другого игрока
    'form-income-run-contest',      // Проведение конкурса
    'form-income-mastering',        // Мастеринг сюжета
    'form-income-rpgtop',           // Голос в RPG-top
    'form-income-banner-reno',      // Баннер FMV в подписи на Рено
    'form-income-banner-mayak',     // Баннер FMV в подписи на Маяке
    'form-exp-thirdchar',           // Третий и следующие персонажи
    'form-exp-changeapp',           // Смена внешности
    'form-exp-changechar',          // Смена персонажа
    'form-exp-refuse',              // Отказ от персонажа
    'gift-discount'                 // Автоскидки
  ];

  // Словарь для группировки: { recipient_id: [operations] }
  const grouped = {};

  backupData.fullData.forEach((operation) => {
    // Пропускаем исключённые операции по form_id
    if (excludedForms.includes(operation.form_id)) {
      log('[groupByRecipient] Пропущена операция:', operation.form_id, operation.title);
      return;
    }

    // Пропускаем операции типа 'discount', 'coupon', 'adjustment'
    if (['discount', 'adjustment'].includes(operation.type)) {
      log('[groupByRecipient] Пропущен тип операции:', operation.type, operation.title);
      return;
    }
    // Для каждой записи (entry) в операции
    operation.entries.forEach((entry) => {
      const data = entry.data || {};

      // Извлекаем всех получателей из entry.data
      const recipientKeys = Object.keys(data).filter(k => /^recipient_\d+$/.test(k));

      if (recipientKeys.length > 0) {
        // Если есть получатели - группируем по каждому
        recipientKeys.forEach(key => {
          const recipientId = Number(data[key]) || 0;
          if (recipientId > 0) {
            if (!grouped[recipientId]) {
              grouped[recipientId] = [];
            }

            // Извлекаем индекс получателя из ключа (например, "recipient_1" -> "1")
            const index = key.match(/^recipient_(\d+)$/)?.[1];

            // Создаём объект с данными только для этого получателя
            const recipientData = {};

            // Добавляем amount_N, если есть
            if (index && data[`amount_${index}`] !== undefined) {
              recipientData.amount = data[`amount_${index}`];
            }

            // Добавляем quantity_N, если есть
            if (index && data[`quantity_${index}`] !== undefined) {
              recipientData.quantity = data[`quantity_${index}`];
            }

            // Добавляем thousand_N, если есть
            if (index && data[`thousand_${index}`] !== undefined) {
              recipientData.thousand = data[`thousand_${index}`];
            }

            // Добавляем from_N, если есть (для подарков)
            if (index && data[`from_${index}`] !== undefined) {
              recipientData.from = data[`from_${index}`];
            }

            // Добавляем wish_N, если есть (для подарков)
            if (index && data[`wish_${index}`] !== undefined) {
              recipientData.wish = data[`wish_${index}`];
            }

            // Добавляем gift_id_N, если есть (для подарков)
            if (index && data[`gift_id_${index}`] !== undefined) {
              recipientData.gift_id = data[`gift_id_${index}`];
            }

            grouped[recipientId].push({
              form_id: operation.form_id,
              title: operation.title,
              type: operation.type,
              kind: operation.kind,
              price: operation.price,
              bonus: operation.bonus,
              mode: operation.mode,
              modalAmount: operation.modalAmount,
              entry_data: recipientData,
              entry_key: key
            });
          }
        });
      } else {
        // Нет получателей - относим к USER_ID
        if (!grouped[defaultUserId]) {
          grouped[defaultUserId] = [];
        }
        grouped[defaultUserId].push({
          form_id: operation.form_id,
          title: operation.title,
          type: operation.type,
          kind: operation.kind,
          price: operation.price,
          bonus: operation.bonus,
          mode: operation.mode,
          modalAmount: operation.modalAmount,
          entry_data: data,
          entry_key: null
        });
      }
    });
  });

  // Возвращаем словарь как есть (без преобразования в массив)
  log('[groupByRecipient] Сгруппированные данные:', grouped);
  return grouped;
}

// ============================================================================
// Группировка по категориям (подарки, оформление, купоны)
// ============================================================================

/**
 * Формирует title из from и wish
 * @param {string} from - От кого
 * @param {string} wish - Пожелание
 * @returns {string|undefined} - Сформированный title или undefined
 */
function createTitle(from, wish) {
  const fromTrimmed = (from || '').trim();
  const wishTrimmed = (wish || '').trim();

  if (fromTrimmed !== '' && wishTrimmed !== '') {
    return `${fromTrimmed}: ${wishTrimmed}`;
  } else if (fromTrimmed !== '' || wishTrimmed !== '') {
    return `${fromTrimmed}${wishTrimmed}`;
  }
  return undefined;
}

/**
 * Загружает страницу /pages/usrN и извлекает user_id из .modal_script
 * Приоритет: data-main-user_id > N из URL
 */
async function getUserIdFromPage(profileId) {
  try {
    const pageUrl = `/pages/usr${profileId}`;
    const response = await fetch(pageUrl);
    if (!response.ok) {
      warn(`[groupByRecipient] Не удалось загрузить ${pageUrl}`);
      return Number(profileId);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const modalScript = doc.querySelector('.modal_script');
    if (!modalScript) {
      warn(`[groupByRecipient] .modal_script не найден в ${pageUrl}, используем profileId=${profileId}`);
      return Number(profileId);
    }

    const mainUserId = modalScript.getAttribute('data-main-user_id');
    if (mainUserId && mainUserId.trim()) {
      log(`[groupByRecipient] Найден data-main-user_id=${mainUserId} для profileId=${profileId}`);
      return Number(mainUserId.trim());
    }

    // Если data-main-user_id не указан, используем profileId
    return Number(profileId);
  } catch (err) {
    error('[groupByRecipient] Ошибка загрузки страницы:', err);
    return Number(profileId);
  }
}

/**
 * Проверяет есть ли у пользователя в API уже указанный gift_id
 * @param {number} userId - ID пользователя
 * @param {string} category - Категория (icon, plashka, background, gift)
 * @param {string} giftId - ID элемента для проверки
 * @returns {Promise<boolean>} - true если элемент уже существует
 */
async function checkIfItemExists(userId, category, giftId) {
  if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
    warn('[groupByRecipient] FMVbank.storageGet недоступен');
    return false;
  }

  try {
    const data = await window.FMVbank.storageGet(userId, 'info_');
    if (!data || typeof data !== 'object') {
      return false;
    }

    const items = data[category] || [];
    if (!Array.isArray(items)) {
      return false;
    }

    // Проверяем есть ли элемент с таким id
    return items.some(item => String(item.id) === String(giftId));
  } catch (err) {
    error(`[groupByRecipient] Ошибка проверки существования ${category}/${giftId}:`, err);
    return false;
  }
}

/**
 * Проверяет существует ли gift_id в библиотеке
 * @param {string} category - Категория (icon, plashka, background, gift)
 * @param {string} giftId - ID элемента для проверки
 * @returns {Promise<boolean>} - true если элемент существует в библиотеке
 */
async function checkIfItemInLibrary(category, giftId) {
  if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
    warn('[groupByRecipient] FMVbank.storageGet недоступен');
    return false;
  }

  try {
    // Конвертируем category в название библиотеки
    const libraryName = category === 'plashka' ? 'plashka' : category;
    const data = await window.FMVbank.storageGet(1, `library_${libraryName}_`);

    if (!data || !data.items || !Array.isArray(data.items)) {
      warn(`[groupByRecipient] library_${libraryName}_1 не найдена или пуста`);
      return false;
    }

    // Проверяем есть ли элемент с таким id
    return data.items.some(item => String(item.id) === String(giftId));
  } catch (err) {
    error(`[groupByRecipient] Ошибка проверки библиотеки ${category}/${giftId}:`, err);
    return false;
  }
}

/**
 * Проверяет существует ли купон с данным system_id у пользователя в info_
 * @param {number} userId - ID пользователя
 * @param {string} systemId - system_id купона (соответствует id в info_)
 * @returns {Promise<boolean>} - true если купон существует
 */
async function checkIfCouponExists(userId, systemId) {
  if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
    warn('[groupByRecipient] FMVbank.storageGet недоступен');
    return false;
  }

  try {
    const data = await window.FMVbank.storageGet(userId, 'info_');
    if (!data || typeof data !== 'object') {
      return false;
    }

    const coupons = data.coupon || [];
    if (!Array.isArray(coupons)) {
      return false;
    }

    // Проверяем есть ли купон с таким id
    return coupons.some(coupon => String(coupon.id) === String(systemId));
  } catch (err) {
    error(`[groupByRecipient] Ошибка проверки существования купона ${systemId}:`, err);
    return false;
  }
}

/**
 * Группирует операции по категориям (подарки, иконки, плашки, фон, купоны)
 * Автоматически вызывает groupOperationsByRecipient внутри
 * С резолвингом data-main-user_id и проверками дубликатов
 * @param {Object} backupData - Оригинальные данные из BACKUP_DATA
 * @returns {Promise<Array>} - массив объектов { recipient_id, amount, items[] }
 */
export async function groupByRecipientWithGifts(backupData) {
  if (!backupData || typeof backupData !== 'object') {
    warn('[groupByRecipientWithGifts] Входные данные невалидны:', backupData);
    return [];
  }

  // Сначала группируем операции по получателям
  const groupedData = groupOperationsByRecipient(backupData);
  log('[groupByRecipientWithGifts] groupedData после groupOperationsByRecipient:', groupedData);

  // Получаем USER_ID и totalSum из backupData
  const userId = backupData?.environment?.USER_ID ? Number(backupData.environment.USER_ID) : 0;
  const totalSum = backupData?.totalSum ? Number(backupData.totalSum) : 0;

  // Маппинг form_id на категории
  const formToCategory = {
    'form-gift-collection': 'gift',
    'form-icon-collection': 'icon',
    'form-badge-collection': 'plashka',
    'form-back-collection': 'background',
    'form-gift-custom': 'gift',
    'form-icon-custom': 'icon',
    'form-badge-custom': 'plashka',
    'form-back-custom': 'background'
  };

  // Временная группировка по originalRecipientId
  const tempByRecipient = {};

  // Шаг 1: Обрабатываем каждого получателя и собираем items
  for (const [recipientId, operations] of Object.entries(groupedData)) {
    if (!Array.isArray(operations) || operations.length === 0) {
      continue;
    }

    if (!tempByRecipient[recipientId]) {
      tempByRecipient[recipientId] = {
        amount: 0,
        items: []
      };
    }

    // Обрабатываем каждую операцию
    for (const operation of operations) {
      const formId = operation.form_id;
      const isCustom = formId && formId.includes('-custom');
      const category = formToCategory[formId];
      const entryData = operation.entry_data || {};
      const customTitle = createTitle(entryData.from, entryData.wish);

      // Создаём item
      const item = {
        form_id: formId,
        title: operation.title,
        category: category || null,
        is_custom: isCustom
      };

      // Суммируем amount
      if (entryData.amount !== undefined && entryData.amount !== null) {
        const amount = Number(entryData.amount);
        if (!isNaN(amount)) {
          tempByRecipient[recipientId].amount += amount;
          item.amount = amount;
        }
      }

      // Для подарков/оформления (и custom, и collection)
      if (category) {
        item.gift_id = entryData.gift_id || null;
        if (customTitle) {
          item.custom_title = customTitle;
        }
        tempByRecipient[recipientId].items.push(item);
      } else {
        // Для прочих операций (купоны, покупки и т.д.)
        // Добавляем gift_id для всех (включая купоны)
        item.gift_id = entryData.gift_id || null;

        // Только персональные скидки (купоны) помечаем для удаления
        if (operation.type === 'coupon') {
          item.type = 'coupon';
          item.remove = true; // Купоны снимаются (используются)
        }

        const quantity = Number(entryData.quantity) || 1;

        // Добавляем quantity раз
        for (let i = 0; i < quantity; i++) {
          tempByRecipient[recipientId].items.push({ ...item });
        }
      }
    }
  }

  log('[groupByRecipientWithGifts] Временная группировка:', tempByRecipient);

  // Шаг 2: Резолвим data-main-user_id для всех получателей
  const recipientMapping = {}; // originalId -> mainUserId
  const uniqueRecipientIds = Object.keys(tempByRecipient).map(Number);

  for (const recipientId of uniqueRecipientIds) {
    const mainUserId = await getUserIdFromPage(recipientId);
    recipientMapping[recipientId] = mainUserId;
    log(`[groupByRecipientWithGifts] Маппинг: ${recipientId} -> ${mainUserId}`);
  }

  // Шаг 3: Перегруппировываем по mainUserId и объединяем данные
  const finalByRecipient = {};

  for (const [originalId, data] of Object.entries(tempByRecipient)) {
    const mainId = recipientMapping[Number(originalId)];

    if (!finalByRecipient[mainId]) {
      finalByRecipient[mainId] = {
        recipient_id: mainId,
        amount: 0,
        items: []
      };
    }

    // Суммируем amount и объединяем items
    finalByRecipient[mainId].amount += data.amount;
    finalByRecipient[mainId].items.push(...data.items);
  }

  // Добавляем totalSum к userId
  if (userId && finalByRecipient[userId]) {
    finalByRecipient[userId].amount += totalSum;
    log(`[groupByRecipientWithGifts] Добавлен totalSum (${totalSum}) к получателю ${userId}`);
  }

  // Шаг 4: Проверяем дубликаты в API и помечаем ошибки
  for (const [recipientId, data] of Object.entries(finalByRecipient)) {
    for (const item of data.items) {
      // Проверка 1: custom без выбранного ID
      if (item.is_custom && item.category && item.gift_id === 'custom') {
        item.error = 'not_selected_custom';
        error(`[groupByRecipientWithGifts] Найден custom без ID для recipient ${recipientId}:`, item);
        continue;
      }

      // Проверка 2: для купонов с remove: true проверяем существование в info_
      if (item.remove === true && item.type === 'coupon') {
        if (!item.gift_id) {
          item.error = 'not_selected_custom';
          error(`[groupByRecipientWithGifts] Купон без gift_id для recipient ${recipientId}:`, item);
          continue;
        }

        const couponExists = await checkIfCouponExists(Number(recipientId), item.gift_id);
        if (!couponExists) {
          item.error = 'coupon_not_exists';
          warn(`[groupByRecipientWithGifts] Купон с system_id ${item.gift_id} не найден у recipient ${recipientId}`);
        }
        continue; // Для купонов другие проверки не нужны
      }

      // Проверка 3: gift_id существует в библиотеке (только для подарков/оформления)
      if (item.category && item.gift_id && item.gift_id !== 'custom') {
        const inLibrary = await checkIfItemInLibrary(item.category, item.gift_id);
        if (!inLibrary) {
          item.error = 'not_in_library';
          warn(`[groupByRecipientWithGifts] ID ${item.gift_id} не найден в библиотеке ${item.category} для recipient ${recipientId}`);
          continue; // Пропускаем проверку дубликатов если элемента нет в библиотеке
        }

        // Проверка 4: дубликаты в API пользователя
        const exists = await checkIfItemExists(Number(recipientId), item.category, item.gift_id);
        if (exists) {
          item.error = 'already_exists';
          warn(`[groupByRecipientWithGifts] Дубликат ${item.category}/${item.gift_id} для recipient ${recipientId}`);
        }
      }
    }
  }

  // Шаг 5: Конвертируем в массив и фильтруем пустые
  const result = Object.values(finalByRecipient).filter(recipient => {
    return recipient.amount !== 0 || recipient.items.length > 0;
  });

  log('[groupByRecipientWithGifts] Финальный результат:', result);
  return result;
}

// Экспортируем функции в window для использования вне модулей
if (typeof window !== 'undefined') {
  window.groupOperationsByRecipient = groupOperationsByRecipient;
  window.groupByRecipientWithGifts = groupByRecipientWithGifts;
}
