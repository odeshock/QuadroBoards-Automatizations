// Данные для доходов, расходов и подарков
// Режимы расчета:
// - price_per_item: итого = price × items
// - price_per_item_w_bonus: итого = price × items + bonus × additional_items
// - entered_amount: итого = sum(entered_amount), показ entered_amount у каждого получателя
// - price_w_entered_amount: итого = sum(entered_amount) + price × items

export const incomeItems = [
  { title: 'Приём анкеты', amount: 'ч', price: 110, mode: 'price_per_item', form: '#form-income-anketa' },
  { title: 'Взятие акционного персонажа', amount: 'ч', price: 60, mode: 'price_per_item', form: '#form-income-akcion' },
  { title: 'Взятие нужного персонажа', amount: 'ч', price: 60, mode: 'price_per_item', form: '#form-income-needchar' },
  { title: 'Размещение заявки на «нужного»', amount: 'ч', price: 30, mode: 'price_per_item', form: '#form-income-needrequest' },
  { title: 'Первый пост на профиле', amount: 'ч', price: 100, mode: 'price_per_item', form: '#form-income-firstpost' },
  { title: 'Личный пост', amount: 'ч', price: 5, bonus: 10, mode: 'price_per_item_w_bonus', form: '#form-income-personalpost' },
  { title: 'Сюжетный пост', amount: 'ч', price: 20, bonus: 5, mode: 'price_per_item_w_bonus', form: '#form-income-plotpost' },
  { title: 'Завершённый личный эпизод', amount: 'ч', price: 5, mode: 'price_per_item', form: '#form-income-ep-personal' },
  { title: 'Завершённый сюжетный эпизод', amount: 'ч', price: 20, mode: 'price_per_item', form: '#form-income-ep-plot' },
  { title: 'Каждые 100 сообщений', amount: 'ч', price: 400, mode: 'price_per_item', form: '#form-income-100msgs' },
  { title: 'Каждые 100 репутации', amount: 'ч', price: 400, mode: 'price_per_item', form: '#form-income-100rep' },
  { title: 'Каждые 100 позитива', amount: 'ч', price: 60, mode: 'price_per_item', form: '#form-income-100pos' },
  { title: 'Каждый игровой месяц', amount: 'ч', price: 150, mode: 'price_per_item', form: '#form-income-month' },
  { title: 'Каждая листовка', amount: 'ч', price: 30, mode: 'price_per_item', form: '#form-income-flyer' },
  { title: 'Участие в конкурсе', amount: 'ч', price: 30, mode: 'price_per_item', form: '#form-income-contest' },
  { title: 'Аватарка для галереи', amount: 'ч', price: 10, mode: 'price_per_item', form: '#form-income-avatar' },
  { title: 'Другой дизайн для галереи', amount: 'ч', price: 30, mode: 'price_per_item', form: '#form-income-design-other' },
  { title: 'Проведение конкурса', amount: 'ч', price: 50, mode: 'price_per_item', form: '#form-income-run-contest' },
  { title: 'Мастеринг сюжета', amount: 'ч', price: 10, mode: 'price_per_item', form: '#form-income-mastering' },
  { title: 'Голос в RPG-top (раз в неделю)', amount: 'ч', price: 30, mode: 'price_per_item', form: '#form-income-rpgtop' },
  { title: 'Баннер FMV в подписи на Рено', amount: 'ч', price: 30, mode: 'price_per_item', form: '#form-income-banner-reno' },
  { title: 'Баннер FMV в подписи на Маяке', amount: 'ч', price: 30, mode: 'price_per_item', form: '#form-income-banner-mayak' },
  { title: 'Активист полумесяца', amount: 'ч', price: 80, mode: 'price_per_item', form: '#form-income-activist' },
  { title: 'Постописец полумесяца', amount: 'ч', price: 80, mode: 'price_per_item', form: '#form-income-writer' },
  { title: 'Эпизод полумесяца', amount: 'ч', price: 100, mode: 'price_per_item', form: '#form-income-episode-of' },
  { title: 'Пост полумесяца', amount: 'ч', price: 50, mode: 'price_per_item', form: '#form-income-post-of' },
  { title: 'Докупить кредиты', amount: 'ч', price: 0, mode: 'entered_amount', form: '#form-income-topup' },
  { title: 'Выдать денежку дополнительно', amount: 'ч', price: 0, mode: 'entered_amount', form: '#form-income-ams' },
];

export const expenseItems = [
  { title: 'Выкуп внешности для заявки на 1 месяц', amount: 'ч', price: 140, mode: 'price_per_item', form: '#form-exp-face-1m' },
  { title: 'Выкуп внешности для заявки на 3 месяца', amount: 'ч', price: 350, mode: 'price_per_item', form: '#form-exp-face-3m' },
  { title: 'Выкуп внешности для заявки на 6 месяцев', amount: 'ч', price: 560, mode: 'price_per_item', form: '#form-exp-face-6m' },
  { title: 'Выкуп персонажа для заявки на 1 месяц', amount: 'ч', price: 430, mode: 'price_per_item', form: '#form-exp-char-1m' },
  { title: 'Выкуп персонажа для заявки на 3 месяца', amount: 'ч', price: 1075, mode: 'price_per_item', form: '#form-exp-char-3m' },
  { title: 'Выкуп персонажа для заявки на 6 месяцев', amount: 'ч', price: 1720, mode: 'price_per_item', form: '#form-exp-char-6m' },
  { title: 'Выкуп внешности для собственного пользования на 1 месяц', amount: 'ч', price: 70, mode: 'price_per_item', form: '#form-exp-face-own-1m' },
  { title: 'Выкуп внешности для собственного пользования на 3 месяца', amount: 'ч', price: 175, mode: 'price_per_item', form: '#form-exp-face-own-3m' },
  { title: 'Выкуп внешности для собственного пользования на 6 месяцев', amount: 'ч', price: 280, mode: 'price_per_item', form: '#form-exp-face-own-6m' },
  { title: 'Выкуп места в шапке для одного нужного на 1 неделю', amount: 'ч', price: 20, mode: 'price_per_item', form: '#form-exp-need-1w' },
  { title: 'Выкуп места в шапке для одного нужного на 2 недели', amount: 'ч', price: 30, mode: 'price_per_item', form: '#form-exp-need-2w' },
  { title: 'Выкуп места в шапке для одного нужного на 1 месяц', amount: 'ч', price: 50, mode: 'price_per_item', form: '#form-exp-need-1m' },
  { title: 'Маска-смена внешности', amount: 'ч', price: 80, mode: 'price_per_item', form: '#form-exp-mask' },
  { title: 'Бонус +1 день к эпизоду (1 день)', amount: 'ч', price: 40, mode: 'price_per_item', form: '#form-exp-bonus1d1' },
  { title: 'Бонус +2 дня к эпизоду (1 день)', amount: 'ч', price: 80, mode: 'price_per_item', form: '#form-exp-bonus2d1' },
  { title: 'Бонус +1 день к эпизоду (1 неделя)', amount: 'ч', price: 190, mode: 'price_per_item', form: '#form-exp-bonus1w1' },
  { title: 'Бонус +2 дня к эпизоду (1 неделя)', amount: 'ч', price: 380, mode: 'price_per_item', form: '#form-exp-bonus2w1' },
  { title: 'Бонус +1 день к эпизоду (1 месяц)', amount: 'ч', price: 600, mode: 'price_per_item', form: '#form-exp-bonus1m1' },
  { title: 'Бонус +2 дня к эпизоду (1 месяц)', amount: 'ч', price: 1200, mode: 'price_per_item', form: '#form-exp-bonus2m1' },
  { title: 'Бонус +1 день к эпизоду (3 месяца)', amount: 'ч', price: 1500, mode: 'price_per_item', form: '#form-exp-bonus1m3' },
  { title: 'Бонус +2 дня к эпизоду (3 месяца)', amount: 'ч', price: 3000, mode: 'price_per_item', form: '#form-exp-bonus2m3' },
  { title: 'Третий персонаж', amount: 'ч', price: 150, mode: 'price_per_item', form: '#form-exp-thirdchar' },
  { title: 'Смена персонажа', amount: 'ч', price: 120, mode: 'price_per_item', form: '#form-exp-changechar' },
  { title: 'Отказ от персонажа', amount: 'ч', price: 100, mode: 'price_per_item', form: '#form-exp-refuse' },
  { title: 'Спасительный жилет-билет от чистки', amount: 'ч', price: 55, mode: 'price_per_item', form: '#form-exp-clean' },
  { title: 'Перевод средств другому (комиссия)', amount: 'ч', price: 10, mode: 'price_w_entered_amount', form: '#form-exp-transfer' }
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
