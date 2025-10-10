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
// ДОХОДЫ
// ============================================================================

export const incomeItems = [
  { title: 'Приём анкеты', amount: 'ч', price: 1, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_ANKETA },
  { title: 'Взятие акционного персонажа', amount: 'ч', price: 2, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_AKCION },
  { title: 'Взятие нужного персонажа', amount: 'ч', price: 3, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_NEEDCHAR },
  { title: 'Размещение заявки на «нужного»', amount: 'ч', price: 4, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_NEEDREQUEST },
  { title: 'Первый пост на профиле', amount: 'ч', price: 5, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_FIRSTPOST },
  { title: 'Личный пост', amount: 'ч', price: 6, bonus: 7, mode: CALC_MODES.PRICE_PER_ITEM_W_BONUS, form: FORM_INCOME_PERSONALPOST },
  { title: 'Сюжетный пост', amount: 'ч', price: 8, bonus: 9, mode: CALC_MODES.PRICE_PER_ITEM_W_BONUS, form: FORM_INCOME_PLOTPOST },
  { title: 'Завершённый личный эпизод', amount: 'ч', price: 10, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_EP_PERSONAL },
  { title: 'Завершённый сюжетный эпизод', amount: 'ч', price: 11, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_EP_PLOT },
  { title: 'Каждые 100 сообщений', amount: 'ч', price: 12, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_100MSGS },
  { title: 'Каждые 100 репутации', amount: 'ч', price: 13, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_100REP },
  { title: 'Каждые 100 позитива', amount: 'ч', price: 14, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_100POS },
  { title: 'Каждый игровой месяц', amount: 'ч', price: 15, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_MONTH },
  { title: 'Каждая листовка', amount: 'ч', price: 16, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_FLYER },
  { title: 'Участие в конкурсе', amount: 'ч', price: 17, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_CONTEST },
  { title: 'Аватарка для галереи', amount: 'ч', price: 18, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_AVATAR },
  { title: 'Другой дизайн для галереи', amount: 'ч', price: 19, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_DESIGN_OTHER },
  { title: 'Проведение конкурса', amount: 'ч', price: 20, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_RUN_CONTEST },
  { title: 'Мастеринг сюжета', amount: 'ч', price: 21, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_MASTERING },
  { title: 'Голос в RPG-top (раз в неделю)', amount: 'ч', price: 22, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_RPGTOP },
  { title: 'Баннер FMV в подписи на Рено', amount: 'ч', price: 23, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_BANNER_RENO },
  { title: 'Баннер FMV в подписи на Маяке', amount: 'ч', price: 24, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_BANNER_MAYAK },
  { title: 'Активист полумесяца', amount: 'ч', price: 25, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_ACTIVIST },
  { title: 'Постописец полумесяца', amount: 'ч', price: 26, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_WRITER },
  { title: 'Эпизод полумесяца', amount: 'ч', price: 27, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_EPISODE_OF },
  { title: 'Пост полумесяца', amount: 'ч', price: 28, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_POST_OF },
  { title: 'Докупить кредиты', amount: 'ч', price: 29, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_TOPUP },
  { title: 'Выдать денежку дополнительно', amount: 'ч', price: 30, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_INCOME_AMS },
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
  { title: 'Маска-смена внешности', amount: 'ч', price: 13, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_MASK },
  { title: 'Бонус +1 день к эпизоду (1 день)', amount: 'ч', price: 14, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS1D1 },
  { title: 'Бонус +2 дня к эпизоду (1 день)', amount: 'ч', price: 15, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS2D1 },
  { title: 'Бонус +1 день к эпизоду (1 неделя)', amount: 'ч', price: 16, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS1W1 },
  { title: 'Бонус +2 дня к эпизоду (1 неделя)', amount: 'ч', price: 17, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS2W1 },
  { title: 'Бонус +1 день к эпизоду (1 месяц)', amount: 'ч', price: 18, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS1M1 },
  { title: 'Бонус +2 дня к эпизоду (1 месяц)', amount: 'ч', price: 19, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS2M1 },
  { title: 'Бонус +1 день к эпизоду (3 месяца)', amount: 'ч', price: 20, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS1M3 },
  { title: 'Бонус +2 дня к эпизоду (3 месяца)', amount: 'ч', price: 21, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_BONUS2M3 },
  { title: 'Третий персонаж', amount: 'ч', price: 22, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_THIRDCHAR },
  { title: 'Смена персонажа', amount: 'ч', price: 23, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_CHANGECHAR },
  { title: 'Отказ от персонажа', amount: 'ч', price: 24, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_REFUSE },
  { title: 'Спасительный жилет-билет от чистки', amount: 'ч', price: 25, mode: CALC_MODES.PRICE_PER_ITEM, form: FORM_EXP_CLEAN },
  { title: 'Перевод средств другому (комиссия)', amount: 'ч', price: 26, mode: CALC_MODES.PRICE_W_ENTERED_AMOUNT, form: FORM_EXP_TRANSFER }
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

export const giftItems = [
  { id: 'custom', icon: '✨', title: 'Индивидуальный подарок' },
  { id: '1', icon: '<img class="gift" src="https://upforme.ru/uploads/001c/8a/af/3/999003.png">', title: 'Подарить подарок' },
  { id: '2', icon: '<img class="gift" src="https://upforme.ru/uploads/001c/8a/af/3/427793.png">', title: 'Подарить подарок' },
  { id: '3', icon: '<img class="gift" src="https://upforme.ru/uploads/001c/8a/af/3/899654.png">', title: 'Подарить подарок' },
  { id: '4', icon: '<img class="gift" src="https://upforme.ru/uploads/001c/8a/af/3/772108.png">', title: 'Подарить подарок' }
];

// ============================================================================
// ИКОНКИ
// ============================================================================

export const iconItems = [
  { id: 'custom', icon: '✨', title: 'Индивидуальная иконка' },
  { id: '1', icon: '<img class="icon" src="https://static.thenounproject.com/png/2185221-200.png">', title: 'Иконка 1' },
  { id: '2', icon: '<img class="icon" src="https://cdn2.iconfinder.com/data/icons/harry-potter-colour-collection/60/07_-_Harry_Potter_-_Colour_-_Golden_Snitch-512.png">', title: 'Иконка 2' },
  { id: '3', icon: '<img class="icon" src="https://upforme.ru/uploads/001c/8a/af/3/35168.png">', title: 'Иконка 3' }
];

// ============================================================================
// ПЛАШКИ
// ============================================================================

export const badgeItems = [
  { id: 'custom', icon: '✨', title: 'Индивидуальная плашка' },
  { id: '1', icon: '<a class="modal-link"><img src="https://upforme.ru/uploads/001c/8a/af/3/87678.png" class="plashka"></a>', title: 'Плашка 1' },
  { id: '2', icon: '<a class="modal-link"><img src="https://upforme.ru/uploads/001c/8a/af/3/22368.png" class="plashka"></a>', title: 'Плашка 2' },
  { id: '3', icon: '<a class="modal-link"><img src="https://upforme.ru/uploads/001c/8a/af/3/333802.png" class="plashka"></a>', title: 'Плашка 3' },
  { id: '4', icon: '<a class="modal-link"><img src="https://upforme.ru/uploads/001c/8a/af/3/378106.png" class="plashka"></a>', title: 'Плашка 4' }
];

// ============================================================================
// ФОНЫ
// ============================================================================

export const backgroundItems = [
  { id: 'custom', icon: '✨', title: 'Индивидуальный фон' },
  { id: '1', icon: '<img class="back" src="https://upforme.ru/uploads/001c/8a/af/3/123607.png">', title: 'Фон 1' },
  { id: '2', icon: '<img class="back" src="https://upforme.ru/uploads/001c/8a/af/3/275271.png">', title: 'Фон 2' },
  { id: '3', icon: '<img class="back" src="https://upforme.ru/uploads/001c/8a/af/3/235283.png">', title: 'Фон 3' },
  { id: '4', icon: '<img class="back" src="https://upforme.ru/uploads/001c/8a/af/3/305050.png">', title: 'Фон 4' }
];

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
 *   - 'percent': процентная скидка (discountValue = процент, например 20 для 20%)
 *   - 'fixed': фиксированная скидка (discountValue = фиксированная сумма)
 *   - 'per_item': скидка за каждый элемент (discountValue = сумма за штуку)
 *   - 'per_batch': скидка за каждые N элементов (discountValue = сумма за партию, batchSize = размер партии)
 * - discountValue: значение скидки (зависит от type)
 * - batchSize: размер партии (только для type='per_batch', например 5 = за каждые 5 штук)
 * - roundResult: округлять ли результат (true/false), применяется для percent
 * - condition: условие применения скидки
 *   - type: 'none' | 'min_items' | 'min_operation_total' | 'min_grand_total'
 *   - value: пороговое значение
 *
 * Примеры:
 * 1. Скидка 20% на подарки при сумме операции >= 300
 * 2. Фиксированная скидка 50 галлеонов при итоговой сумме >= 1000
 * 3. Скидка 4 галлеона за каждый подарок при количестве >= 5
 * 4. Скидка 20 галлеонов за каждые 5 подарков (per_batch)
 */
export const autoDiscounts = [
  {
    id: 'gift-collection-bulk-discount',
    title: 'Скидка за каждые 5 подарков из коллекции',
    forms: [toSelector(FORM_GIFT_PRESENT)], // Только подарки из коллекции (не custom!)
    type: 'per_batch',
    discountValue: itemPrices.gift.collection*5 - itemDiscountPrices.gift.collection.per5,
    batchSize: 5,      // за каждые 5 подарков
    roundResult: false,
    condition: {
      type: 'min_items', // минимальное количество элементов в операциях этого типа
      value: 5
    }
  },
  {
    id: 'global-75-percent-discount',
    title: 'Скидка 75% на все расходы',
    forms: 'all', // Применяется ко всем расходам (kind === 'expense')
    type: 'percent',
    discountValue: 75, // 75% скидка
    roundResult: true,
    condition: {
      type: 'none' // Всегда работает
    }
  },
  {
    id: 'gift-custom-bulk-discount',
    title: 'Скидка за каждые 5 индивидуальных подарков',
    forms: [toSelector(FORM_GIFT_CUSTOM)], // Только индивидуальные подарки (custom!)
    type: 'per_batch',
    discountValue: itemPrices.gift.custom*5 - itemDiscountPrices.gift.custom.per5,
    batchSize: 5,      // за каждые 5 подарков
    roundResult: false,
    condition: {
      type: 'min_items', // минимальное количество элементов в операциях этого типа
      value: 5
    }
  },
  // Можно добавить больше правил скидок здесь
];
