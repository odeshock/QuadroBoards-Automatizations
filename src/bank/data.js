// ============================================================================
// data.js — Данные для доходов, расходов и подарков
// ============================================================================

import {
  FORM_INCOME_ANKETA, FORM_INCOME_AKCION, FORM_INCOME_NEEDCHAR, FORM_INCOME_NEEDREQUEST,
  FORM_INCOME_FIRSTPOST, FORM_INCOME_PERSONALPOST, FORM_INCOME_PLOTPOST,
  FORM_INCOME_EP_PERSONAL, FORM_INCOME_EP_PLOT, FORM_INCOME_100MSGS, FORM_INCOME_100REP,
  FORM_INCOME_100POS, FORM_INCOME_MONTH, FORM_INCOME_FLYER, FORM_INCOME_CONTEST,
  FORM_INCOME_AVATAR, FORM_INCOME_DESIGN_OTHER, FORM_INCOME_RUN_CONTEST, FORM_INCOME_MASTERING,
  FORM_INCOME_RPGTOP, FORM_INCOME_BANNER_RENO, FORM_INCOME_BANNER_MAYAK,
  FORM_INCOME_ACTIVIST, FORM_INCOME_WRITER, FORM_INCOME_EPISODE_OF, FORM_INCOME_POST_OF,
  FORM_INCOME_TOPUP, FORM_INCOME_AMS,
  FORM_EXP_FACE_1M, FORM_EXP_FACE_3M, FORM_EXP_FACE_6M,
  FORM_EXP_CHAR_1M, FORM_EXP_CHAR_3M, FORM_EXP_CHAR_6M,
  FORM_EXP_FACE_OWN_1M, FORM_EXP_FACE_OWN_3M, FORM_EXP_FACE_OWN_6M,
  FORM_EXP_NEED_1W, FORM_EXP_NEED_2W, FORM_EXP_NEED_1M,
  FORM_EXP_MASK, FORM_EXP_BONUS1D1, FORM_EXP_BONUS2D1, FORM_EXP_BONUS1W1, FORM_EXP_BONUS2W1,
  FORM_EXP_BONUS1M1, FORM_EXP_BONUS2M1, FORM_EXP_BONUS1M3, FORM_EXP_BONUS2M3,
  FORM_EXP_THIRDCHAR, FORM_EXP_CHANGECHAR, FORM_EXP_REFUSE, FORM_EXP_CLEAN, FORM_EXP_TRANSFER,
  FORM_GIFT_PRESENT, FORM_GIFT_CUSTOM,
  FORM_ICON_CUSTOM,
  CALC_MODES,
  toSelector
} from './constants.js';

// ============================================================================
// РЕЖИМЫ РАСЧЕТА
// ============================================================================
// - price_per_item: итого = price × items
// - price_per_item_w_bonus: итого = price × items + bonus × additional_items
// - entered_amount: итого = sum(entered_amount), показ entered_amount у каждого получателя
// - price_w_entered_amount: итого = sum(entered_amount) + price × items

// ============================================================================
// КОНСТАНТЫ ДЛЯ ПОДСЧЁТА
// ============================================================================

// Минимальное количество символов для учёта личного поста
export const MIN_PERSONAL_POST_SYMBOLS = 0;

// Минимальное количество символов для учёта сюжетного поста
export const MIN_PLOT_POST_SYMBOLS = 50;

// ============================================================================
// ДОХОДЫ
// ============================================================================

export const incomeItems = [
  { title: 'Принятие анкеты', amount: 'ч', price: 1, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_ANKETA },
  { title: 'Взятие акционного персонажа', amount: 'ч', price: 2, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_AKCION },
  { title: 'Взятие нужного персонажа', amount: 'ч', price: 3, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_NEEDCHAR },
  { title: 'Размещение заявки на нужного', amount: 'ч', price: 4, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_NEEDREQUEST },
  { title: 'Первый пост на профиле', amount: 'ч', price: 5, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_FIRSTPOST },
  { title: 'Каждый личный пост', amount: 'ч', price: 6, bonus: 7, mode: CALC_MODES.PRICE_PER_ITEM_W_BONUS, form: FORM_INCOME_PERSONALPOST },
  { title: 'Каждый сюжетный пост', amount: 'ч', price: 8, bonus: 9, mode: CALC_MODES.PRICE_PER_ITEM_W_BONUS, form: FORM_INCOME_PLOTPOST },
  { title: 'Завершённый личный эпизод', amount: 'ч', price: 10, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_EP_PERSONAL },
  { title: 'Завершённый сюжетный эпизод', amount: 'ч', price: 11, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_EP_PLOT },
  { title: 'Каждые 100 сообщений', amount: 'ч', price: 12, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_100MSGS },
  { title: 'Каждые 100 репутации', amount: 'ч', price: 13, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_100REP },
  { title: 'Каждые 100 позитива', amount: 'ч', price: 14, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_100POS },
  { title: 'Каждый игровой месяц', amount: 'ч', price: 15, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_MONTH },
  { title: 'Каждая рекламная листовка', amount: 'ч', price: 16, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_FLYER },
  { title: 'Участие в конкурсе', amount: 'ч', price: 17, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_CONTEST },
  { title: 'Аватарка для другого игрока', amount: 'ч', price: 18, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_AVATAR },
  { title: 'Другой дизайн для другого игрока', amount: 'ч', price: 19, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_DESIGN_OTHER },
  { title: 'Проведение конкурса', amount: 'ч', price: 20, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_RUN_CONTEST },
  { title: 'Мастеринг сюжета', amount: 'ч', price: 21, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_MASTERING },
  { title: 'Голос в RPG-top', amount: 'ч', price: 22, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_RPGTOP },
  { title: 'Баннер FMV в подписи на Рено', amount: 'ч', price: 23, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_BANNER_RENO },
  { title: 'Баннер FMV в подписи на Маяке', amount: 'ч', price: 24, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_BANNER_MAYAK },
  { title: 'Эпизод полумесяца', amount: 'ч', price: 27, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_EPISODE_OF },
  { title: 'Пост полумесяца', amount: 'ч', price: 28, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_POST_OF },
  { title: 'Постописец полумесяца', amount: 'ч', price: 26, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_WRITER },
  { title: 'Активист полумесяца', amount: 'ч', price: 25, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_ACTIVIST },
  { title: 'Пополнение фонда форума', amount: 'ч', mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_TOPUP },
  { title: 'Индивидуальные выплаты', amount: 'ч', mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_AMS },
];

// ============================================================================
// РАСХОДЫ
// ============================================================================

export const expenseItems = [
  { title: 'Выкуп внешности для заявки на 1 месяц', amount: 'ч', price: 1, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_FACE_1M },
  { title: 'Выкуп внешности для заявки на 3 месяца', amount: 'ч', price: 2, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_FACE_3M },
  { title: 'Выкуп внешности для заявки на 6 месяцев', amount: 'ч', price: 3, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_FACE_6M },
  { title: 'Выкуп персонажа для заявки на 1 месяц', amount: 'ч', price: 4, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_CHAR_1M },
  { title: 'Выкуп персонажа для заявки на 3 месяца', amount: 'ч', price: 5, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_CHAR_3M },
  { title: 'Выкуп персонажа для заявки на 6 месяцев', amount: 'ч', price: 6, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_CHAR_6M },
  { title: 'Выкуп внешности для собственного пользования на 1 месяц', amount: 'ч', price: 7, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_FACE_OWN_1M },
  { title: 'Выкуп внешности для собственного пользования на 3 месяца', amount: 'ч', price: 8, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_FACE_OWN_3M },
  { title: 'Выкуп внешности для собственного пользования на 6 месяцев', amount: 'ч', price: 9, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_FACE_OWN_6M },
  { title: 'Выкуп места в шапке для одного нужного на 1 неделю', amount: 'ч', price: 10, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_NEED_1W },
  { title: 'Выкуп места в шапке для одного нужного на 2 недели', amount: 'ч', price: 11, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_NEED_2W },
  { title: 'Выкуп места в шапке для одного нужного на 1 месяц', amount: 'ч', price: 12, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_NEED_1M },
  { title: 'Маска для сюжета', amount: 'ч', price: 13, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_MASK },
  { title: 'Бонус +1 на 1 день', amount: 'ч', price: 14, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS1D1 },
  { title: 'Бонус +2 на 1 день', amount: 'ч', price: 15, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS2D1 },
  { title: 'Бонус +1 на 1 неделю', amount: 'ч', price: 16, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS1W1 },
  { title: 'Бонус +2 на 1 неделю', amount: 'ч', price: 17, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS2W1 },
  { title: 'Бонус +1 на 1 месяц', amount: 'ч', price: 18, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS1M1 },
  { title: 'Бонус +2 на 1 месяц', amount: 'ч', price: 19, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS2M1 },
  { title: 'Бонус +1 на 3 месяца', amount: 'ч', price: 20, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS1M3 },
  { title: 'Бонус +2 на 3 месяца', amount: 'ч', price: 21, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS2M3 },
  { title: 'Третий и следующие персонажи', amount: 'ч', price: 22, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_THIRDCHAR },
  { title: 'Смена персонажа', amount: 'ч', price: 23, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_CHANGECHAR },
  { title: 'Отказ от персонажа', amount: 'ч', price: 24, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_REFUSE },
  { title: 'Спасение от чистки', amount: 'ч', price: 25, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_CLEAN },
  { title: 'Перевод галлеонов другому игроку', amount: 'ч', price: 26, mode: CALC_MODES.PRICE_W_ENTERED_AMOUNT, form: FORM_EXP_TRANSFER }
];

// ============================================================================
// ЦЕНЫ
// ============================================================================

export const itemPrices = {
  gift: {
    collection: 40,   // Подарки из коллекции
    custom: 101       // Индивидуальный подарок
  },
  icon: {
    collection: 31,   // Иконки из коллекции
    custom: 111       // Индивидуальная иконка
  },
  badge: {
    collection: 41,   // Плашки из коллекции
    custom: 191       // Индивидуальная плашка
  },
  background: {
    collection: 51,   // Фоны из коллекции
    custom: 151       // Индивидуальный фон
  }
};

export const itemDiscountPrices = {
  gift: {
    collection: {
      per5: 180,  // Цена за 5 подарков из коллекции (40×5=200, скидка 20₲)
    },
    custom: {
      per5: 480,  // Цена за 5 индивидуальных подарков (100×5=500, скидка 20₲)
    }
  }
};

// ============================================================================
// ПОДАРКИ
// ============================================================================

let _giftItemsCache = null;

// Создаём setter/getter для отслеживания изменений
if (!window.hasOwnProperty('SKIN_DATA_GIFT')) {
  Object.defineProperty(window, 'SKIN_DATA_GIFT', {
    get() {
      return this._SKIN_DATA_GIFT;
    },
    set(value) {
      this._SKIN_DATA_GIFT = value;
      _giftItemsCache = null; // Сбрасываем кэш
    },
    configurable: true
  });
}

function _getGiftItems() {
  if (_giftItemsCache) return _giftItemsCache;

  const customItem = { id: 'custom', icon: '✨', custom: true };
  const skinData = window.SKIN_DATA_GIFT || [];
  const isAdmin = window.IS_ADMIN === true;
  const isAdminToEdit = window.IS_ADMIN_TO_EDIT === true;

  let filteredItems;

  if (isAdmin || isAdminToEdit) {
    // Админ (и при начальной загрузке, и при редактировании):
    // hidden: false ИЛИ (hidden: true И custom: true) ИЛИ (hidden: true И system: true)
    filteredItems = skinData.filter(item =>
      item.hidden !== true || item.custom === true || item.system === true
    );
  } else {
    // Обычный пользователь: только hidden: false И custom: false И system: false
    filteredItems = skinData.filter(item =>
      item.hidden !== true && item.custom !== true && item.system !== true
    );
  }

  // Всегда добавляем customItem в начало
  _giftItemsCache = [customItem, ...filteredItems];
  return _giftItemsCache;
}

export const giftItems = new Proxy([], {
  get(_target, prop) {
    const items = _getGiftItems();

    // Специальная обработка для методов массива
    if (typeof items[prop] === 'function') {
      return items[prop].bind(items);
    }

    if (prop === Symbol.iterator) return items[Symbol.iterator].bind(items);
    if (prop === 'length') return items.length;
    if (typeof prop === 'string' && !isNaN(prop)) return items[prop];
    return items[prop];
  }
});

// ============================================================================
// ИКОНКИ
// ============================================================================

let _iconItemsCache = null;

if (!window.hasOwnProperty('SKIN_DATA_ICON')) {
  Object.defineProperty(window, 'SKIN_DATA_ICON', {
    get() {
      return this._SKIN_DATA_ICON;
    },
    set(value) {
      this._SKIN_DATA_ICON = value;
      _iconItemsCache = null;
    },
    configurable: true
  });
}

function _getIconItems() {
  if (_iconItemsCache) return _iconItemsCache;

  const customItem = { id: 'custom', icon: '✨', custom: true };
  const skinData = window.SKIN_DATA_ICON || [];
  const isAdmin = window.IS_ADMIN === true;
  const isAdminToEdit = window.IS_ADMIN_TO_EDIT === true;

  let filteredItems;

  if (isAdmin || isAdminToEdit) {
    // Админ (и при начальной загрузке, и при редактировании):
    // hidden: false ИЛИ (hidden: true И custom: true) ИЛИ (hidden: true И system: true)
    filteredItems = skinData.filter(item =>
      item.hidden !== true || item.custom === true || item.system === true
    );
  } else {
    // Обычный пользователь: только hidden: false И custom: false И system: false
    filteredItems = skinData.filter(item =>
      item.hidden !== true && item.custom !== true && item.system !== true
    );
  }

  // Всегда добавляем customItem в начало
  _iconItemsCache = [customItem, ...filteredItems];
  return _iconItemsCache;
}

export const iconItems = new Proxy([], {
  get(_target, prop) {
    const items = _getIconItems();
    if (typeof items[prop] === 'function') {
      return items[prop].bind(items);
    }
    if (prop === Symbol.iterator) return items[Symbol.iterator].bind(items);
    if (prop === 'length') return items.length;
    if (typeof prop === 'string' && !isNaN(prop)) return items[prop];
    return items[prop];
  }
});

// ============================================================================
// ПЛАШКИ
// ============================================================================

let _badgeItemsCache = null;

if (!window.hasOwnProperty('SKIN_DATA_PLASHKA')) {
  Object.defineProperty(window, 'SKIN_DATA_PLASHKA', {
    get() {
      return this._SKIN_DATA_PLASHKA;
    },
    set(value) {
      this._SKIN_DATA_PLASHKA = value;
      _badgeItemsCache = null;
    },
    configurable: true
  });
}

function _getBadgeItems() {
  if (_badgeItemsCache) return _badgeItemsCache;

  const customItem = { id: 'custom', icon: '✨', custom: true };
  const skinData = window.SKIN_DATA_PLASHKA || [];
  const isAdmin = window.IS_ADMIN === true;
  const isAdminToEdit = window.IS_ADMIN_TO_EDIT === true;

  let filteredItems;

  if (isAdmin || isAdminToEdit) {
    // Админ (и при начальной загрузке, и при редактировании):
    // hidden: false ИЛИ (hidden: true И custom: true) ИЛИ (hidden: true И system: true)
    filteredItems = skinData.filter(item =>
      item.hidden !== true || item.custom === true || item.system === true
    );
  } else {
    // Обычный пользователь: только hidden: false И custom: false И system: false
    filteredItems = skinData.filter(item =>
      item.hidden !== true && item.custom !== true && item.system !== true
    );
  }

  // Всегда добавляем customItem в начало
  _badgeItemsCache = [customItem, ...filteredItems];
  return _badgeItemsCache;
}

export const badgeItems = new Proxy([], {
  get(_target, prop) {
    const items = _getBadgeItems();
    if (typeof items[prop] === 'function') {
      return items[prop].bind(items);
    }
    if (prop === Symbol.iterator) return items[Symbol.iterator].bind(items);
    if (prop === 'length') return items.length;
    if (typeof prop === 'string' && !isNaN(prop)) return items[prop];
    return items[prop];
  }
});

// ============================================================================
// ФОНЫ
// ============================================================================

let _backgroundItemsCache = null;

if (!window.hasOwnProperty('SKIN_DATA_BACK')) {
  Object.defineProperty(window, 'SKIN_DATA_BACK', {
    get() {
      return this._SKIN_DATA_BACK;
    },
    set(value) {
      this._SKIN_DATA_BACK = value;
      _backgroundItemsCache = null;
    },
    configurable: true
  });
}

function _getBackgroundItems() {
  if (_backgroundItemsCache) return _backgroundItemsCache;

  const customItem = { id: 'custom', icon: '✨', custom: true };
  const skinData = window.SKIN_DATA_BACK || [];
  const isAdmin = window.IS_ADMIN === true;
  const isAdminToEdit = window.IS_ADMIN_TO_EDIT === true;

  let filteredItems;

  if (isAdmin || isAdminToEdit) {
    // Админ (и при начальной загрузке, и при редактировании):
    // hidden: false ИЛИ (hidden: true И custom: true) ИЛИ (hidden: true И system: true)
    filteredItems = skinData.filter(item =>
      item.hidden !== true || item.custom === true || item.system === true
    );
  } else {
    // Обычный пользователь: только hidden: false И custom: false И system: false
    filteredItems = skinData.filter(item =>
      item.hidden !== true && item.custom !== true && item.system !== true
    );
  }

  // Всегда добавляем customItem в начало
  _backgroundItemsCache = [customItem, ...filteredItems];
  return _backgroundItemsCache;
}

export const backgroundItems = new Proxy([], {
  get(_target, prop) {
    const items = _getBackgroundItems();
    if (typeof items[prop] === 'function') {
      return items[prop].bind(items);
    }
    if (prop === Symbol.iterator) return items[Symbol.iterator].bind(items);
    if (prop === 'length') return items.length;
    if (typeof prop === 'string' && !isNaN(prop)) return items[prop];
    return items[prop];
  }
});


// ============================================================================
// АВТОМАТИЧЕСКИЕ СКИДКИ
// ============================================================================

/**
 * Конфигурация автоматических скидок
 *
 * Структура:
 * - id: уникальный идентификатор скидки
 * - title: название скидки для отображения
 * - forms: массив form селекторов (например, [toSelector(FORM_GIFT_PRESENT)]) или 'all' для всех операций
 * - type: тип скидки
 *   - 'percent': процентная скидка (discountValue = процент от 0 до 100, всегда округляется вверх)
 *   - 'fixed': фиксированная скидка (discountValue = фиксированная сумма)
 *   - 'per_item': скидка за каждый элемент (discountValue = сумма за штуку)
 *   - 'per_batch': скидка за каждые N элементов (discountValue = сумма за партию, batchSize = размер партии)
 * - discountValue: значение скидки (зависит от type). Для 'percent' значения > 100 автоматически ограничиваются до 100
 * - batchSize: размер партии (только для type='per_batch', например 5 = за каждые 5 штук)
 * - expiresAt: (необязательно) дата окончания действия скидки в формате 'YYYY-MM-DD'
 *   Например: '2025-01-31' означает, что скидка действует до конца 31 января 2025 (23:59:59 по Москве)
 *   Скидка не будет применяться с 1 февраля 2025 00:00:00 по Москве
 * - condition: условие применения скидки
 *   - type: 'none' | 'min_items'
 *   - value: пороговое значение
 *
 * Ограничения:
 * - Скидка для конкретных операций не может превышать сумму этих операций
 * - Общая сумма всех скидок не может превышать общую сумму всех операций
 * - Процентная скидка всегда округляется вверх (Math.ceil)
 *
 * Примеры:
 * 1. Скидка 20% на подарки при количестве >= 5
 * 2. Фиксированная скидка 50 за операцию
 * 3. Скидка 4 за каждый подарок при количестве >= 5
 * 4. Скидка 20 за каждые 5 подарков (per_batch)
 * 5. Временная скидка 75% действует до конца дня 31 января 2025 (expiresAt: '2025-01-31')
 */
export const autoDiscounts = [
  {
    id: 'global-75-percent-discount',
    title: 'Скидка 75% на все расходы',
    forms: 'all', // Применяется ко всем расходам (kind === 'expense')
    type: 'percent',
    discountValue: 75, // 75% скидка
    startDate: '2024-01-01', // ОБЯЗАТЕЛЬНО: начинает действовать с 00:00 по Москве (формат YYYY-MM-DD)
    // expiresAt: '2025-10-10', // Опционально: действует до конца указанной даты по Москве
    condition: {
      type: 'none' // Всегда работает
    }
  },
  // {
  //   id: 'global-50-percent-discount',
  //   title: 'Скидка 50% на инд. иконки',
  //   forms: [toSelector(FORM_ICON_CUSTOM)], // Применяется ко всем расходам (kind === 'expense')
  //   type: 'percent',
  //   discountValue: 50, // 75% скидка
  //   startDate: '2024-01-01', // ОБЯЗАТЕЛЬНО: начинает действовать с 00:00 по Москве (формат YYYY-MM-DD)
  //   // expiresAt: '2025-10-10', // Опционально: действует до конца указанной даты по Москве
  //   condition: {
  //     type: 'none' // Всегда работает
  //   }
  // },


  // Можно добавить больше правил скидок здесь

  // ============================================================================
  // ПРИМЕРЫ ВРЕМЕННЫХ СКИДОК
  // ============================================================================
  //
  // ОБЯЗАТЕЛЬНЫЕ ПАРАМЕТРЫ:
  // - startDate: 'YYYY-MM-DD' — дата начала действия скидки (00:00 по Москве)
  //
  // ОПЦИОНАЛЬНЫЕ ПАРАМЕТРЫ:
  // - expiresAt: 'YYYY-MM-DD' — скидка действует до конца указанной даты (23:59:59 по Москве)
  //
  // Пример 1: Временная скидка 50% на оформление (работает с 1 по 10 января)
  // {
  //   id: 'new-year-discount',
  //   title: 'Новогодняя скидка 50% на оформление',
  //   forms: 'all',
  //   type: 'percent',
  //   discountValue: 50,
  //   startDate: '2025-01-01',
  //   expiresAt: '2025-01-10',
  //   condition: { type: 'none' }
  // }
  //
  // Пример 2: Скидка на подарки (начинается 15 января, бессрочно)
  // {
  //   id: 'gift-promo',
  //   title: 'Акция на подарки',
  //   forms: [toSelector(FORM_GIFT_PRESENT), toSelector(FORM_GIFT_CUSTOM)],
  //   type: 'percent',
  //   discountValue: 30,
  //   startDate: '2025-01-15',
  //   condition: { type: 'min_items', value: 3 }
  // }

  // {
  //   id: 'new-year-discount',
  //   title: 'Новогодняя скидка 50% на оформление',
  //   forms: 'all',
  //   type: 'percent',
  //   discountValue: 120,
  //   roundResult: true,
  //   expiresAt: '2026-01-10',
  //   condition: { type: 'none' }
  // },
];

// ============================================================================
// АВТОМАТИЧЕСКАЯ КОРРЕКТИРОВКА ЦЕН
// ============================================================================

/**
 * Конфигурация автоматической корректировки цен
 *
 * Структура:
 * - id: уникальный идентификатор корректировки
 * - title: название корректировки для отображения (используется {title} из formData)
 * - form: селектор формы, для которой действует корректировка
 * - batchSize: за сколько элементов считать партию
 * - newPrice: новая цена за партию (batchSize элементов)
 *
 * Формула расчета корректировки:
 * Название: <oldPrice> × (<itemCount> // <batchSize>) × <batchSize> − <newPrice> × (<itemCount> // <batchSize>)
 * Применяется только если: <itemCount> >= <batchSize>
 * Корректировка не может быть больше суммы операции
 *
 * Пример:
 * Для личных постов: старая цена 6, новая цена 20 за 5 постов
 * При 7 постах: 6 × (7 // 5) × 5 − 20 × (7 // 5) = 6 × 1 × 5 − 20 × 1 = 30 − 20 = 10 (корректировка)
 */
export const autoPriceAdjustments = [
  // Пример:
  // {
  //   id: 'personal-post-bulk-adjustment',
  //   title: '{title}', // Будет заменено на название операции
  //   form: toSelector(FORM_INCOME_PERSONALPOST),
  //   batchSize: 5,
  //   newPrice: 20
  // }
  {
    id: 'gift-collection-5-discount',
    title: 'Пересчёт за 5 подарков из коллекции',
    form: toSelector(FORM_GIFT_PRESENT),
    batchSize: 5,
    newPrice: itemDiscountPrices.gift.collection.per5
  },
  {
    id: 'gift-custom-5-discount',
    title: 'Пересчёт за 5 индивидуальных подарков',
    form: toSelector(FORM_GIFT_CUSTOM),
    batchSize: 5,
    newPrice: itemDiscountPrices.gift.custom.per5
  }
];
