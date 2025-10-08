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
  CALC_MODES
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
  { title: 'Докупить кредиты', amount: 'ч', price: 29, mode: CALC_MODES.ENTERED_AMOUNT, form: FORM_INCOME_TOPUP },
  { title: 'Выдать денежку дополнительно', amount: 'ч', price: 30, mode: CALC_MODES.ENTERED_AMOUNT, form: FORM_INCOME_AMS },
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

export const giftItems = [
  { id: 'custom', icon: '✨', title: 'Индивидуальный подарок', price1: 100, price5: 400 },
  { id: '1', icon: '<img src="https://i.ibb.co/3cHvbLW/piksy.png">', title: 'Подарить подарок', price1: 60, price5: 140 },
  { id: '2', icon: '<img src="https://i.ibb.co/njG4qpB/animsl2.png">', title: 'Подарить подарок', price1: 60, price5: 140 },
  { id: '3', icon: '<img src="https://i.ibb.co/4265yGb/Thunderbird1.png">', title: 'Подарить подарок', price1: 60, price5: 140 },
  { id: '4', icon: '<img src="https://i.ibb.co/pRkBCwq/Hippogriff11.png">', title: 'Подарить подарок', price1: 60, price5: 140 }
];

export const iconItems = [
  { id: 'icon-custom', icon: '✨', title: 'Индивидуальная иконка', price1: 120, price5: 480 },
  { id: '1', icon: '<img src="https://i.ibb.co/DPrgbYx1/42.png">', title: 'Иконка 1', price1: 30, price5: 70 },
  { id: '2', icon: '<img src="https://upforme.ru/uploads/001c/14/5b/440/110503.png">', title: 'Иконка 1', price1: 30, price5: 70 },
  { id: '3', icon: '<img src="https://upforme.ru/uploads/001c/14/5b/6/566301.png">', title: 'Иконка 1', price1: 30, price5: 70 },
  { id: '4', icon: '<img src="https://upforme.ru/uploads/001c/14/5b/6/592300.png">', title: 'Иконка 1', price1: 30, price5: 70 },
  { id: '5', icon: '<img src="https://upforme.ru/uploads/001c/14/5b/440/453346.png">', title: 'Иконка 1', price1: 30, price5: 70 }
];

export const badgeItems = [
  { id: 'badge-custom', icon: '✨', title: 'Индивидуальная плашка', price1: 190, price5: 760 },
  { id: 'badge-1', icon: '🏷️', title: 'Плашка 1', price1: 45, price5: 105 }
];

export const backgroundItems = [
  { id: 'bg-custom', icon: '✨', title: 'Индивидуальный фон', price1: 155, price5: 620 },
  { id: 'bg-1', icon: '🌆', title: 'Фон 1', price1: 40, price5: 90 }
];
