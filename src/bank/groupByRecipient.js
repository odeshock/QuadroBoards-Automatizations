// ============================================================================
// groupByRecipient.js — Группировка операций по получателям
// ============================================================================

/**
 * Создаёт из BACKUP_DATA словарь операций, сгруппированных по получателям
 * @param {Object} backupData - объект с данными из BACKUP_DATA
 * @returns {Object} объект вида { "recipient_id": [operations], "recipient_id": [operations], ... }
 */
export function groupOperationsByRecipient(backupData) {
  console.log('[groupByRecipient] Входные данные:', backupData);
  console.log('[groupByRecipient] backupData существует?', !!backupData);
  console.log('[groupByRecipient] backupData.fullData существует?', !!backupData?.fullData);
  console.log('[groupByRecipient] backupData.fullData:', backupData?.fullData);

  if (!backupData || !backupData.fullData) {
    console.warn('[groupByRecipient] Некорректные данные backup');
    return [];
  }

  // Извлекаем USER_ID из environment
  const defaultUserId = backupData.environment?.USER_ID || 0;
  console.log('[groupByRecipient] defaultUserId:', defaultUserId);

  if (!defaultUserId) {
    console.warn('[groupByRecipient] USER_ID не найден в backupData.environment');
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
    'form-exp-changechar',          // Смена персонажа
    'form-exp-refuse',              // Отказ от персонажа
    'gift-discount'                 // Автоскидки
  ];

  // Словарь для группировки: { recipient_id: [operations] }
  const grouped = {};

  backupData.fullData.forEach((operation) => {
    // Пропускаем исключённые операции по form_id
    if (excludedForms.includes(operation.form_id)) {
      console.log('[groupByRecipient] Пропущена операция:', operation.form_id, operation.title);
      return;
    }

    // Пропускаем операции типа 'discount', 'coupon', 'adjustment'
    if (['discount', 'adjustment'].includes(operation.type)) {
      console.log('[groupByRecipient] Пропущен тип операции:', operation.type, operation.title);
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
  console.log('[groupByRecipient] Сгруппированные данные:', grouped);
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
 * Группирует операции из результата groupOperationsByRecipient по категориям
 * @param {Object} groupedData - Результат работы groupOperationsByRecipient
 * @param {Object} backupData - Оригинальные данные из BACKUP_DATA (для доступа к totalSum и USER_ID)
 * @returns {Object} { byRecipient: {...}, customByRecipient: {...} }
 */
export function groupByRecipientWithGifts(groupedData, backupData) {
  if (!groupedData || typeof groupedData !== 'object') {
    console.warn('[groupByRecipientWithGifts] Входные данные невалидны:', groupedData);
    return { byRecipient: {}, customByRecipient: {} };
  }

  const byRecipient = {};
  const customByRecipient = {};

  // Получаем USER_ID и totalSum из backupData
  const userId = backupData?.environment?.USER_ID ? String(backupData.environment.USER_ID) : null;
  const totalSum = backupData?.totalSum ? Number(backupData.totalSum) : 0;

  // Маппинг form_id на категории
  const formToCategory = {
    'form-gift-collection': 'gift',
    'form-icon-collection': 'icon',
    'form-badge-collection': 'badge',
    'form-back-collection': 'back',
    'form-gift-custom': 'gift',
    'form-icon-custom': 'icon',
    'form-badge-custom': 'badge',
    'form-back-custom': 'back'
  };

  // Обрабатываем каждого получателя
  for (const [recipientId, operations] of Object.entries(groupedData)) {
    if (!Array.isArray(operations) || operations.length === 0) {
      continue;
    }

    // Инициализируем структуру для получателя
    if (!byRecipient[recipientId]) {
      byRecipient[recipientId] = {
        amount: 0,
        gift: [],
        icon: [],
        badge: [],
        back: [],
        coupon: []
      };
    }

    // Обрабатываем каждую операцию
    for (const operation of operations) {
      const formId = operation.form_id;
      const isCustom = formId && formId.includes('-custom');
      const category = formToCategory[formId];
      const entryData = operation.entry_data || {};
      const title = createTitle(entryData.from, entryData.wish);

      // Если это custom форма - добавляем в отдельную структуру по получателям
      if (isCustom && category) {
        // Инициализируем структуру для получателя в customByRecipient
        if (!customByRecipient[recipientId]) {
          customByRecipient[recipientId] = {
            gift: [],
            icon: [],
            badge: [],
            back: []
          };
        }

        const customItem = {
          gift_id: entryData.gift_id || '',
          title
        };
        customByRecipient[recipientId][category].push(customItem);
        continue;
      }

      // Суммируем amount для получателя
      if (entryData.amount !== undefined && entryData.amount !== null) {
        const amount = Number(entryData.amount);
        if (!isNaN(amount)) {
          byRecipient[recipientId].amount += amount;
        }
      }

      // Если это подарок/оформление из коллекции - добавляем в соответствующую категорию
      if (category && !isCustom) {
        const item = {
          gift_id: entryData.gift_id || '',
          title
        };
        byRecipient[recipientId][category].push(item);
        continue;
      }

      // Все остальные операции - в coupon (дублируем quantity раз)
      if (!category) {
        const quantity = Number(entryData.quantity) || 1;
        const couponItem = {
          form: formId || '',
          title
        };

        // Добавляем в массив quantity раз
        for (let i = 0; i < quantity; i++) {
          byRecipient[recipientId].coupon.push({ ...couponItem });
        }
      }
    }
  }

  // Добавляем totalSum к amount получателя с USER_ID
  if (userId && byRecipient[userId]) {
    byRecipient[userId].amount += totalSum;
    console.log(`[groupByRecipientWithGifts] Добавлен totalSum (${totalSum}) к получателю ${userId}`);
  }

  // Удаляем получателей из byRecipient, у которых всё пусто
  for (const recipientId of Object.keys(byRecipient)) {
    const recipient = byRecipient[recipientId];
    const isEmpty =
      recipient.amount === 0 &&
      recipient.gift.length === 0 &&
      recipient.icon.length === 0 &&
      recipient.badge.length === 0 &&
      recipient.back.length === 0 &&
      recipient.coupon.length === 0;

    if (isEmpty) {
      delete byRecipient[recipientId];
    }
  }

  console.log('[groupByRecipientWithGifts] Результат группировки:', {
    byRecipient,
    customByRecipient
  });

  return { byRecipient, customByRecipient };
}
