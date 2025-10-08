// ============================================================================
// constants.js — Константы приложения
// ============================================================================

// ============================================================================
// СЕЛЕКТОРЫ ФОРМ
// ============================================================================

// Доходы
export const FORM_INCOME_ANKETA = '#form-income-anketa';
export const FORM_INCOME_AKCION = '#form-income-akcion';
export const FORM_INCOME_NEEDCHAR = '#form-income-needchar';
export const FORM_INCOME_NEEDREQUEST = '#form-income-needrequest';
export const FORM_INCOME_FIRSTPOST = '#form-income-firstpost';
export const FORM_INCOME_PERSONALPOST = '#form-income-personalpost';
export const FORM_INCOME_PLOTPOST = '#form-income-plotpost';
export const FORM_INCOME_EP_PERSONAL = '#form-income-ep-personal';
export const FORM_INCOME_EP_PLOT = '#form-income-ep-plot';
export const FORM_INCOME_100MSGS = '#form-income-100msgs';
export const FORM_INCOME_100REP = '#form-income-100rep';
export const FORM_INCOME_100POS = '#form-income-100pos';
export const FORM_INCOME_MONTH = '#form-income-month';
export const FORM_INCOME_FLYER = '#form-income-flyer';
export const FORM_INCOME_CONTEST = '#form-income-contest';
export const FORM_INCOME_AVATAR = '#form-income-avatar';
export const FORM_INCOME_DESIGN_OTHER = '#form-income-design-other';
export const FORM_INCOME_RUN_CONTEST = '#form-income-run-contest';
export const FORM_INCOME_MASTERING = '#form-income-mastering';
export const FORM_INCOME_RPGTOP = '#form-income-rpgtop';
export const FORM_INCOME_BANNER_RENO = '#form-income-banner-reno';
export const FORM_INCOME_BANNER_MAYAK = '#form-income-banner-mayak';
export const FORM_INCOME_ACTIVIST = '#form-income-activist';
export const FORM_INCOME_WRITER = '#form-income-writer';
export const FORM_INCOME_EPISODE_OF = '#form-income-episode-of';
export const FORM_INCOME_POST_OF = '#form-income-post-of';
export const FORM_INCOME_TOPUP = '#form-income-topup';
export const FORM_INCOME_AMS = '#form-income-ams';

// Расходы
export const FORM_EXP_FACE_1M = '#form-exp-face-1m';
export const FORM_EXP_FACE_3M = '#form-exp-face-3m';
export const FORM_EXP_FACE_6M = '#form-exp-face-6m';
export const FORM_EXP_CHAR_1M = '#form-exp-char-1m';
export const FORM_EXP_CHAR_3M = '#form-exp-char-3m';
export const FORM_EXP_CHAR_6M = '#form-exp-char-6m';
export const FORM_EXP_FACE_OWN_1M = '#form-exp-face-own-1m';
export const FORM_EXP_FACE_OWN_3M = '#form-exp-face-own-3m';
export const FORM_EXP_FACE_OWN_6M = '#form-exp-face-own-6m';
export const FORM_EXP_NEED_1W = '#form-exp-need-1w';
export const FORM_EXP_NEED_2W = '#form-exp-need-2w';
export const FORM_EXP_NEED_1M = '#form-exp-need-1m';
export const FORM_EXP_MASK = '#form-exp-mask';
export const FORM_EXP_BONUS1D1 = '#form-exp-bonus1d1';
export const FORM_EXP_BONUS2D1 = '#form-exp-bonus2d1';
export const FORM_EXP_BONUS1W1 = '#form-exp-bonus1w1';
export const FORM_EXP_BONUS2W1 = '#form-exp-bonus2w1';
export const FORM_EXP_BONUS1M1 = '#form-exp-bonus1m1';
export const FORM_EXP_BONUS2M1 = '#form-exp-bonus2m1';
export const FORM_EXP_BONUS1M3 = '#form-exp-bonus1m3';
export const FORM_EXP_BONUS2M3 = '#form-exp-bonus2m3';
export const FORM_EXP_THIRDCHAR = '#form-exp-thirdchar';
export const FORM_EXP_CHANGECHAR = '#form-exp-changechar';
export const FORM_EXP_REFUSE = '#form-exp-refuse';
export const FORM_EXP_CLEAN = '#form-exp-clean';
export const FORM_EXP_TRANSFER = '#form-exp-transfer';

// Подарки
export const FORM_GIFT_CUSTOM = '#form-gift-custom';
export const FORM_GIFT_PRESENT = '#form-gift-present';

// Оформление
export const FORM_ICON_CUSTOM = '#form-icon-custom';
export const FORM_ICON_PRESENT = '#form-icon-present';
export const FORM_BADGE_CUSTOM = '#form-badge-custom';
export const FORM_BADGE_PRESENT = '#form-badge-present';
export const FORM_BG_CUSTOM = '#form-bg-custom';
export const FORM_BG_PRESENT = '#form-bg-present';

// Системные
export const FORM_GIFT_DISCOUNT = '#gift-discount';

// ============================================================================
// ГРУППЫ СЕЛЕКТОРОВ
// ============================================================================

export const BONUS_FORMS = [
  FORM_EXP_BONUS1D1,
  FORM_EXP_BONUS2D1,
  FORM_EXP_BONUS1W1,
  FORM_EXP_BONUS2W1,
  FORM_EXP_BONUS1M1,
  FORM_EXP_BONUS2M1,
  FORM_EXP_BONUS1M3,
  FORM_EXP_BONUS2M3
];

export const SPECIAL_EXPENSE_FORMS = [
  ...BONUS_FORMS,
  FORM_EXP_MASK,
  FORM_EXP_CLEAN
];

export const DESIGN_FORMS = [
  FORM_ICON_CUSTOM,
  FORM_ICON_PRESENT,
  FORM_BADGE_CUSTOM,
  FORM_BADGE_PRESENT,
  FORM_BG_CUSTOM,
  FORM_BG_PRESENT
];

export const GIFT_FORMS = [
  FORM_GIFT_CUSTOM,
  FORM_GIFT_PRESENT
];

// ============================================================================
// ТЕКСТОВЫЕ КОНСТАНТЫ
// ============================================================================

export const TEXT_MESSAGES = {
  // Сообщения об ошибках и подсказки
  ADMIN_INFO: 'Начисление производит администратор при приёме анкеты. Если Вам случайно забыли начислить, пожалуйста, напишите в Приёмную — мы обязательно разберемся.',
  SCRIPT_INFO: 'За вас все посчитает скрипт, просто дайте ему время. Если у вас возникнут вопросы по подсчету или что-то окажется не учтено, пожалуйста, напишите в Приемную — мы обязательно поможем.',
  TOPUP_INFO: 'Начисление производит администратор 1го и 16го числа каждого месяца. Если вам случайно забыли начислить, пожалуйста, напишите в Приемную — мы обязательно разберемся.',
  AMS_INFO: 'Начисление в частных случаях по потребности производит администратор.',
  PLAYER_CHOICE_INFO: 'Можете выбрать себя или другого игрока',
  DESIGN_INFO: 'Правила и размеры: <a href="#" target="_blank" rel="noopener noreferrer">ссылка на правила</a>',
  GRAPHIC_WORK_INFO: 'Учитываются только работы, опубликованные в графической теме. Если несколько работ выложено в одном комментарии, укажите этот комментарий несколько раз. Если выложено несколько версий одной работы с минимальными различиями, учитывается только одна из них.',
  CONTEST_INFO: 'Каждый конкурс учитывается один раз.',
  SCREENSHOT_INFO: 'Загрузите свои скриншоты в «Мои загрузки» и вставьте ссылки на них сюда.',
  THIRDCHAR_INFO: 'Предварительно согласуйте в Приемной и приложите ссылку на комментарий',
  REFUSE_INFO: 'Если у вас несколько профилей, останется только один',

  // Статусные сообщения
  PLEASE_WAIT: 'Пожалуйста, подождите...',
  NO_ENTRIES: 'Пока нет сохранённых карточек.',
  CONFIRM_DELETE: 'Вы уверены, что хотите удалить эту запись?',
  ADMIN_RESTRICTED: 'Недоступно для администратора',

  // Лейблы для UI
  COST_LABEL: 'Стоимость',
  INCOME_LABEL: 'Начисление',
  DISCOUNT_LABEL: 'Скидка',
  RECIPIENT_LABEL: 'Получатель',
  FROM_LABEL: 'От кого',
  COMMENT_LABEL: 'Комментарий',
  QUANTITY_LABEL: 'Количество',
  ENTRIES_COUNT: 'Записей',
  TOTAL_POSITIONS: 'всего позиций',

  // Заголовки
  AUTO_DISCOUNTS_TITLE: 'Автоматические скидки',
  CUSTOM_GIFT_TITLE: 'Индивидуальный подарок',
  CUSTOM_ICON_TITLE: 'Индивидуальная иконка',
  CUSTOM_BADGE_TITLE: 'Индивидуальная плашка',
  CUSTOM_BG_TITLE: 'Индивидуальный фон',
  GIFT_FROM_COLLECTION: 'Подарок из коллекции',
  ICON_FROM_COLLECTION: 'Иконка из коллекции',
  BADGE_FROM_COLLECTION: 'Плашка из коллекции',
  BG_FROM_COLLECTION: 'Фон из коллекции'
};

// ============================================================================
// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
// ============================================================================

export const REGEX = {
  RECIPIENT: /^recipient_(\d+)$/,
  FROM: /^from_(\d+)$/,
  WISH: /^wish_(\d+)$/,
  COUNTER: /^(msg|rep|pos|month)_(old|new|rounded|diff)$/,
  AMOUNT: /^amount_(\d+)$/,
  QUANTITY: /^quantity_(\d+)$/,
  NUMERIC: /^-?\d+(?:\.\d+)?$/,
  GIFT_TITLE: /Подарить подарок|Праздничный подарок|Подарок-сюрприз|Воздушный подарок/i,
  CUSTOM_GIFT_TITLE: /Индивидуальный подарок/i,
  TRANSFER_TITLE: /Перевод средств другому/i,
  AMOUNT_WITH_BONUS: /^\s*(\d+)\s*\+\s*x\s*(\d+)\s*$/i
};

// ============================================================================
// РЕЖИМЫ РАСЧЕТА
// ============================================================================

export const CALC_MODES = {
  PRICE_PER_ITEM: 'price_per_item',
  PRICE_PER_ITEM_W_BONUS: 'price_per_item_w_bonus',
  ENTERED_AMOUNT: 'entered_amount',
  PRICE_W_ENTERED_AMOUNT: 'price_w_entered_amount'
};

// ============================================================================
// КОНТРОЛЬ ДОСТУПА
// ============================================================================

export const ADMIN_ALLOWED_ITEMS = [
  'Приём анкеты',
  'Взятие акционного персонажа',
  'Взятие нужного персонажа',
  'Докупить кредиты',
  'Постописец полумесяца',
  'Пост полумесяца',
  'Эпизод полумесяца',
  'Активист полумесяца',
  'Выдать денежку дополнительно'
];
