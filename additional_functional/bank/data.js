// Данные для доходов, расходов и подарков
const incomeItems = [
  { title: 'Приём анкеты', amount: 110, form: '#form-income-anketa' },
  { title: 'Взятие акционного персонажа', amount: 60, form: '#form-income-akcion' },
  { title: 'Взятие нужного персонажа', amount: 60, form: '#form-income-needchar' },
  { title: 'Размещение заявки на «нужного»', amount: 30, form: '#form-income-needrequest' },
  { title: 'Первый пост на профиле', amount: 100, form: '#form-income-firstpost' },
  { title: 'Личный пост', amount: '5 + x10', form: '#form-income-personalpost' },
  { title: 'Сюжетный пост', amount: '20 + x5', form: '#form-income-plotpost' },
  { title: 'Личный эпизод', amount: 5, form: '#form-income-ep-personal' },
  { title: 'Сюжетный эпизод', amount: 20, form: '#form-income-ep-plot' },
  { title: '100 сообщений', amount: '400 / 100 мс', form: '#form-income-100msgs' },
  { title: '100 репутации', amount: '400 / 100 р', form: '#form-income-100rep' },
  { title: '100 позитива', amount: '100 / 100 п', form: '#form-income-100pos' },
  { title: 'Один игровой месяц', amount: '150 / м', form: '#form-income-month' },
  { title: 'Листовка', amount: 30, form: '#form-income-flyer' },
  { title: 'Участие в конкурсе', amount: 30, form: '#form-income-contest' },
  { title: 'Аватарка для галереи', amount: 10, form: '#form-income-avatar' },
  { title: 'Другой дизайн для галереи', amount: 30, form: '#form-income-design-other' },
  { title: 'Докупить кредиты', amount: 'по потребности', form: '#form-income-topup' },
  { title: 'Выдать денежку дополнительно', amount: 'по потребности', form: '#form-income-ams' },
  { title: 'Проведение конкурса', amount: 50, form: '#form-income-run-contest' },
  { title: 'Мастеринг', amount: 30, form: '#form-income-mastering' },
  { title: 'Постописец полумесяца', amount: 80, form: '#form-income-writer' },
  { title: 'Пост полумесяца', amount: 50, form: '#form-income-post-of' },
  { title: 'Эпизод полумесяца', amount: 100, form: '#form-income-episode-of' },
  { title: 'Активист полумесяца', amount: 80, form: '#form-income-activist' },
  { title: 'Баннер FMV в подписи на Рено', amount: 30, form: '#form-income-banner-reno' },
  { title: 'Баннер FMV в подписи на Маяке', amount: 30, form: '#form-income-banner-mayak' },
  { title: 'Раз в месяц в топ RPG', amount: 30, form: '#form-income-rpgtop' }
];

const expenseItems = [
  { title: 'Выкуп внешности для заявки на 1 месяц', amount: 140, form: '#form-exp-face-1m' },
  { title: 'Выкуп внешности для заявки на 3 месяца', amount: 350, form: '#form-exp-face-3m' },
  { title: 'Выкуп внешности для заявки на 6 месяцев', amount: 560, form: '#form-exp-face-6m' },
  { title: 'Выкуп персонажа для заявки на 1 месяц', amount: 430, form: '#form-exp-char-1m' },
  { title: 'Выкуп персонажа для заявки на 3 месяца', amount: 1075, form: '#form-exp-char-3m' },
  { title: 'Выкуп персонажа для заявки на 6 месяцев', amount: 1720, form: '#form-exp-char-6m' },
  { title: 'Выкуп внешности для собственного пользования на 1 месяц', amount: 70, form: '#form-exp-face-own-1m' },
  { title: 'Выкуп внешности для собственного пользования на 3 месяца', amount: 175, form: '#form-exp-face-own-3m' },
  { title: 'Выкуп внешности для собственного пользования на 6 месяцев', amount: 280, form: '#form-exp-face-own-6m' },
  { title: 'Выкуп места в шапке для одного нужного на 1 неделю', amount: 20, form: '#form-exp-need-1w' },
  { title: 'Выкуп места в шапке для одного нужного на 2 недели', amount: 30, form: '#form-exp-need-2w' },
  { title: 'Выкуп места в шапке для одного нужного на 1 месяц', amount: 50, form: '#form-exp-need-1m' },
  { title: 'Маска-смена внешности', amount: 80, form: '#form-exp-mask' },
  { title: 'Бонус +1 день к эпизоду (1 день)', amount: '40 / д', form: '#form-exp-bonus1d1' },
  { title: 'Бонус +2 дня к эпизоду (1 день)', amount: '80 / д', form: '#form-exp-bonus2d1' },
  { title: 'Бонус +1 день к эпизоду (1 неделя)', amount: '190 / н', form: '#form-exp-bonus1w1' },
  { title: 'Бонус +2 дня к эпизоду (1 неделя)', amount: '380 / н', form: '#form-exp-bonus2w1' },
  { title: 'Бонус +1 день к эпизоду (1 месяц)', amount: '600 / м', form: '#form-exp-bonus1m1' },
  { title: 'Бонус +2 дня к эпизоду (1 месяц)', amount: '1200 / м', form: '#form-exp-bonus2m1' },
  { title: 'Бонус +1 день к эпизоду (3 месяца)', amount: '1500 / 3м', form: '#form-exp-bonus1m3' },
  { title: 'Бонус +2 дня к эпизоду (3 месяца)', amount: '3000 / 3м', form: '#form-exp-bonus2m3' },
  { title: 'Третий персонаж', amount: 150, form: '#form-exp-thirdchar' },
  { title: 'Смена персонажа', amount: 120, form: '#form-exp-changechar' },
  { title: 'Отказ от персонажа', amount: 100, form: '#form-exp-refuse' },
  { title: 'Спасительный жилет-билет от чистки', amount: 55, form: '#form-exp-clean' },
  { title: 'Перевод средств другому (комиссия)', amount: 10, form: '#form-exp-transfer' }
];

const giftItems = [
  { id: 'custom', icon: '✨', title: 'Индивидуальный подарок', price1: 100, price5: 400 },
  { id: 'gift-1', icon: '🎁', title: 'Подарить подарок', price1: 60, price5: 140 }
];

const iconItems = [
  { id: 'icon-custom', icon: '✨', title: 'Индивидуальная иконка', price1: 120, price5: 480 },
  { id: 'icon-1', icon: '🎨', title: 'Иконка 1', price1: 30, price5: 70 }
];

const badgeItems = [
  { id: 'badge-custom', icon: '✨', title: 'Индивидуальная плашка', price1: 190, price5: 760 },
  { id: 'badge-1', icon: '🏷️', title: 'Плашка 1', price1: 45, price5: 105 }
];

const backgroundItems = [
  { id: 'bg-custom', icon: '✨', title: 'Индивидуальный фон', price1: 155, price5: 620 },
  { id: 'bg-1', icon: '🌆', title: 'Фон 1', price1: 40, price5: 90 }
];
