// ============================================================================
// constants.js — Константы приложения
// ============================================================================

// ============================================================================
// HELPER ФУНКЦИЯ
// ============================================================================

/**
 * Добавляет # к ID формы для использования в качестве селектора
 * @param {string} formId - ID формы (с # или без)
 * @returns {string} - ID формы с #
 */
export const toSelector = (formId) => {
  if (!formId) return '';
  return formId.startsWith('#') ? formId : `#${formId}`;
};

// ============================================================================
// СЕЛЕКТОРЫ ФОРМ (без #, используйте toSelector() для селекторов)
// ============================================================================

// Доходы
export const FORM_INCOME_ANKETA = 'form-income-anketa';
export const FORM_INCOME_AKCION = 'form-income-akcion';
export const FORM_INCOME_NEEDCHAR = 'form-income-needchar';
export const FORM_INCOME_NEEDREQUEST = 'form-income-needrequest';
export const FORM_INCOME_FIRSTPOST = 'form-income-firstpost';
export const FORM_INCOME_PERSONALPOST = 'form-income-personalpost';
export const FORM_INCOME_PLOTPOST = 'form-income-plotpost';
export const FORM_INCOME_EP_PERSONAL = 'form-income-ep-personal';
export const FORM_INCOME_EP_PLOT = 'form-income-ep-plot';
export const FORM_INCOME_100MSGS = 'form-income-100msgs';
export const FORM_INCOME_100REP = 'form-income-100rep';
export const FORM_INCOME_100POS = 'form-income-100pos';
export const FORM_INCOME_MONTH = 'form-income-month';
export const FORM_INCOME_FLYER = 'form-income-flyer';
export const FORM_INCOME_CONTEST = 'form-income-contest';
export const FORM_INCOME_AVATAR = 'form-income-avatar';
export const FORM_INCOME_DESIGN_OTHER = 'form-income-design-other';
export const FORM_INCOME_RUN_CONTEST = 'form-income-run-contest';
export const FORM_INCOME_MASTERING = 'form-income-mastering';
export const FORM_INCOME_RPGTOP = 'form-income-rpgtop';
export const FORM_INCOME_BANNER_RENO = 'form-income-banner-reno';
export const FORM_INCOME_BANNER_MAYAK = 'form-income-banner-mayak';
export const FORM_INCOME_ACTIVIST = 'form-income-activist';
export const FORM_INCOME_WRITER = 'form-income-writer';
export const FORM_INCOME_EPISODE_OF = 'form-income-episode-of';
export const FORM_INCOME_POST_OF = 'form-income-post-of';
export const FORM_INCOME_TOPUP = 'form-income-topup';
export const FORM_INCOME_AMS = 'form-income-ams';

// Расходы
export const FORM_EXP_FACE_1M = 'form-exp-face-1m';
export const FORM_EXP_FACE_3M = 'form-exp-face-3m';
export const FORM_EXP_FACE_6M = 'form-exp-face-6m';
export const FORM_EXP_CHAR_1M = 'form-exp-char-1m';
export const FORM_EXP_CHAR_3M = 'form-exp-char-3m';
export const FORM_EXP_CHAR_6M = 'form-exp-char-6m';
export const FORM_EXP_FACE_OWN_1M = 'form-exp-face-own-1m';
export const FORM_EXP_FACE_OWN_3M = 'form-exp-face-own-3m';
export const FORM_EXP_FACE_OWN_6M = 'form-exp-face-own-6m';
export const FORM_EXP_NEED_1W = 'form-exp-need-1w';
export const FORM_EXP_NEED_2W = 'form-exp-need-2w';
export const FORM_EXP_NEED_1M = 'form-exp-need-1m';
export const FORM_EXP_MASK = 'form-exp-mask';
export const FORM_EXP_BONUS1D1 = 'form-exp-bonus1d1';
export const FORM_EXP_BONUS2D1 = 'form-exp-bonus2d1';
export const FORM_EXP_BONUS1W1 = 'form-exp-bonus1w1';
export const FORM_EXP_BONUS2W1 = 'form-exp-bonus2w1';
export const FORM_EXP_BONUS1M1 = 'form-exp-bonus1m1';
export const FORM_EXP_BONUS2M1 = 'form-exp-bonus2m1';
export const FORM_EXP_BONUS1M3 = 'form-exp-bonus1m3';
export const FORM_EXP_BONUS2M3 = 'form-exp-bonus2m3';
export const FORM_EXP_THIRDCHAR = 'form-exp-thirdchar';
export const FORM_EXP_CHANGECHAR = 'form-exp-changechar';
export const FORM_EXP_REFUSE = 'form-exp-refuse';
export const FORM_EXP_CLEAN = 'form-exp-clean';
export const FORM_EXP_TRANSFER = 'form-exp-transfer';

// Подарки
export const FORM_GIFT_CUSTOM = 'form-gift-custom';
export const FORM_GIFT_PRESENT = 'form-gift-present';

// Оформление
export const FORM_ICON_CUSTOM = 'form-icon-custom';
export const FORM_ICON_PRESENT = 'form-icon-present';
export const FORM_BADGE_CUSTOM = 'form-badge-custom';
export const FORM_BADGE_PRESENT = 'form-badge-present';
export const FORM_BG_CUSTOM = 'form-bg-custom';
export const FORM_BG_PRESENT = 'form-bg-present';

// Системные
export const FORM_GIFT_DISCOUNT = '#gift-discount';
export const FORM_PERSONAL_COUPON = '#personal-coupon';

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

// Массивы с селекторами (с #) - используем toSelector()
export const SPECIAL_EXPENSE_FORMS = [
  ...BONUS_FORMS.map(toSelector),
  toSelector(FORM_EXP_MASK),
  toSelector(FORM_EXP_CLEAN)
];

export const DESIGN_FORMS = [
  toSelector(FORM_ICON_CUSTOM),
  toSelector(FORM_ICON_PRESENT),
  toSelector(FORM_BADGE_CUSTOM),
  toSelector(FORM_BADGE_PRESENT),
  toSelector(FORM_BG_CUSTOM),
  toSelector(FORM_BG_PRESENT)
];

export const GIFT_FORMS = [
  toSelector(FORM_GIFT_CUSTOM),
  toSelector(FORM_GIFT_PRESENT)
];

// Объединенный массив подарков и оформления (все используют setupGiftFlow/setupCustomGiftFlow)
export const GIFT_AND_DESIGN_FORMS = [
  ...GIFT_FORMS,
  ...DESIGN_FORMS
];

// Формы с получателями (для рендеринга списком)
export const RECIPIENT_LIST_FORMS = [
  toSelector(FORM_INCOME_ANKETA),
  toSelector(FORM_INCOME_AKCION),
  toSelector(FORM_INCOME_NEEDCHAR),
  toSelector(FORM_INCOME_EPISODE_OF),
  toSelector(FORM_INCOME_TOPUP),
  toSelector(FORM_INCOME_AMS),
  toSelector(FORM_EXP_TRANSFER),
  ...SPECIAL_EXPENSE_FORMS,
  ...DESIGN_FORMS,
  ...GIFT_FORMS
];

// Формы без списка получателей (прямой рендеринг)
export const DIRECT_RENDER_FORMS = [
  toSelector(FORM_INCOME_ACTIVIST),
  toSelector(FORM_INCOME_WRITER),
  toSelector(FORM_INCOME_POST_OF)
];

// Формы выкупа персонажей (только количество)
export const BUYOUT_FORMS = [
  toSelector(FORM_EXP_FACE_1M), toSelector(FORM_EXP_FACE_3M), toSelector(FORM_EXP_FACE_6M),
  toSelector(FORM_EXP_CHAR_1M), toSelector(FORM_EXP_CHAR_3M), toSelector(FORM_EXP_CHAR_6M),
  toSelector(FORM_EXP_FACE_OWN_1M), toSelector(FORM_EXP_FACE_OWN_3M), toSelector(FORM_EXP_FACE_OWN_6M),
  toSelector(FORM_EXP_NEED_1W), toSelector(FORM_EXP_NEED_2W), toSelector(FORM_EXP_NEED_1M)
];

// Формы с URL полями
export const URL_FIELD_FORMS = [
  toSelector(FORM_INCOME_NEEDREQUEST), toSelector(FORM_INCOME_EP_PERSONAL), toSelector(FORM_INCOME_EP_PLOT),
  toSelector(FORM_INCOME_CONTEST), toSelector(FORM_INCOME_AVATAR), toSelector(FORM_INCOME_DESIGN_OTHER),
  toSelector(FORM_INCOME_RUN_CONTEST), toSelector(FORM_INCOME_MASTERING), toSelector(FORM_INCOME_RPGTOP)
];

// Формы с баннерами и третьим персонажем
export const BANNER_FORMS = [
  toSelector(FORM_INCOME_BANNER_RENO),
  toSelector(FORM_INCOME_BANNER_MAYAK),
  toSelector(FORM_EXP_THIRDCHAR)
];

// Формы смены персонажа и первого поста
export const CHARACTER_CHANGE_FORMS = [
  toSelector(FORM_EXP_CHANGECHAR),
  toSelector(FORM_INCOME_FIRSTPOST)
];

// Форма отказа от персонажа
export const REFUSE_FORMS = [
  toSelector(FORM_EXP_REFUSE)
];

// Формы счетчиков (100 сообщений/репутации/позитива, месяц)
export const COUNTER_FORMS = [
  toSelector(FORM_INCOME_100MSGS),
  toSelector(FORM_INCOME_100REP),
  toSelector(FORM_INCOME_100POS),
  toSelector(FORM_INCOME_MONTH)
];

// Формы с административными получателями
export const ADMIN_RECIPIENT_FORMS = [
  toSelector(FORM_INCOME_ANKETA),
  toSelector(FORM_INCOME_AKCION),
  toSelector(FORM_INCOME_NEEDCHAR),
  toSelector(FORM_INCOME_EPISODE_OF)
];

// ============================================================================
// ТЕКСТОВЫЕ КОНСТАНТЫ
// ============================================================================

export const TEXT_MESSAGES = {
  // Сообщения об ошибках и подсказки
  ADMIN_INFO: 'Начисление производится администратором при приёме анкеты.<br><br>Если Вас случайно пропустили, пожалуйста, напишите в Приёмную — мы обязательно всё проверим и разберёмся.',
  ADMIN_HALF_MONTH_INFO: 'Начисление производится администратором после публикации соответствующей новости.<br><br>Если Вас случайно пропустили, пожалуйста, напишите в Приёмную — мы обязательно всё проверим и разберёмся.',
  SCRIPT_INFO: 'За Вас всё посчитает скрипт — просто дайте ему немного времени.<br><br>Если у Вас появятся вопросы по подсчёту или что-то окажется не учтено, пожалуйста, напишите в Приёмную — мы обязательно поможем.',
  TOPUP_INFO: 'Начисления происходят <strong>1-го и 16-го числа</strong> каждого месяца.<br><br>Если вдруг что-то было упущено, напишите, пожалуйста, в Приёмную — мы обязательно всё проверим и решим вопрос.',
  AMS_INFO: 'Начисление по необходимости производит администратор.',
  PLAYER_CHOICE_INFO: 'Можете приобрести для себя или другого игрока.',
  DESIGN_INFO: 'Правила и размеры: <a href="#" target="_blank" rel="noopener noreferrer">ссылка на правила</a>',
  GRAPHIC_WORK_INFO: 'Учитываются только работы, опубликованные <strong>в графической теме</strong>.<br><br>Если несколько работ выложено в одном комментарии, укажите этот комментарий <strong>несколько раз</strong>.<br><br>Если выложено несколько версий одной работы с минимальными различиями, учитывается <strong>только одна из них</strong>.',
  CONTEST_INFO: 'Каждый конкурс учитывается <strong>только один раз</strong>.',
  THIRDCHAR_INFO: 'Допустимо иметь <strong>не более пяти персонажей</strong>.<br><br>До оплаты услуги <strong>получите согласие администрации</strong> в Приёмной и приложите сюда ссылку на комментарий.',
  CHANGECHAR_INFO: 'После смены персонажа, пожалуйста, заполните анкету за указанное в правилах время или отпишитесь в теме отпуска.',
  REFUSE_INFO: 'При отказе от роли, Ваш профиль переименовывается в выбранную <strong>фантастическую тварь</strong>.<br><br>Если у Вас несколько профилей, останется <strong>только один — этот</strong>.',
  BANNER_INFO: 'Разместите баннер нашего проекта в подписи своего пользователя на указанном форуме и получите выплату. Приложите ссылку на Ваш профиль или скрин.',
  BANNER_SYSTEM_INFO: 'Для каждого игрока начисление доступно <strong>только один раз</strong>.',

  // Статусные сообщения
  PLEASE_WAIT: 'Пожалуйста, подождите...',
  NO_ENTRIES: 'Пока нет сохранённых карточек.',
  CONFIRM_DELETE: 'Вы уверены, что хотите удалить эту операцию?',
  ADMIN_RESTRICTED: 'Недоступно для администратора.',

  // Сообщения об ошибках
  ERROR_REFRESH: 'Произошла ошибка. Пожалуйста, закройте модальное окно и откройте его заново.',

  // Лейблы для UI
  COST_LABEL: 'Стоимость',
  INCOME_LABEL: 'Начисление',
  DISCOUNT_LABEL: 'Скидка',
  RECIPIENT_LABEL: 'Получатель',
  FROM_LABEL: 'От кого',
  COMMENT_LABEL: 'Комментарий',
  QUANTITY_LABEL: 'Количество',

  // Заголовки
  AUTO_DISCOUNTS_TITLE: 'Автоматические скидки',
  PERSONAL_COUPONS_TITLE: 'Купоны',
  PERSONAL_COUPONS_LABEL: 'Купон',
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
  FORM_INCOME_ANKETA,      // 'Приём анкеты'
  FORM_INCOME_AKCION,      // 'Взятие акционного персонажа'
  FORM_INCOME_NEEDCHAR,    // 'Взятие нужного персонажа'
  FORM_INCOME_TOPUP,       // 'Докупить кредиты'
  FORM_INCOME_WRITER,      // 'Постописец полумесяца'
  FORM_INCOME_POST_OF,     // 'Пост полумесяца'
  FORM_INCOME_EPISODE_OF,  // 'Эпизод полумесяца'
  FORM_INCOME_ACTIVIST,    // 'Активист полумесяца'
  FORM_INCOME_AMS,         // 'Выдать денежку дополнительно'
  // Подарки
  FORM_GIFT_PRESENT,       // 'Подарок из коллекции'
  FORM_GIFT_CUSTOM,        // 'Индивидуальный подарок'
  // Оформление
  FORM_ICON_PRESENT,       // 'Иконка из коллекции'
  FORM_ICON_CUSTOM,        // 'Индивидуальная иконка'
  FORM_BADGE_PRESENT,      // 'Плашка из коллекции'
  FORM_BADGE_CUSTOM,       // 'Индивидуальная плашка'
  FORM_BG_PRESENT,         // 'Фон из коллекции'
  FORM_BG_CUSTOM           // 'Индивидуальный фон'
];

export const ADMIN_RECIPIENT_MULTI_FORMS = [
  FORM_INCOME_ANKETA,
  FORM_INCOME_AKCION,
  FORM_INCOME_NEEDCHAR,
  FORM_INCOME_EPISODE_OF,
  FORM_INCOME_ACTIVIST,
  FORM_INCOME_WRITER
];

// Формы админских начислений с одним получателем (пост полумесяца)
export const ADMIN_SINGLE_RECIPIENT_FORMS = [
  FORM_INCOME_POST_OF
];

// Формы админских начислений с указанием суммы (докупка кредитов, доп.деньги, переводы)
export const ADMIN_AMOUNT_FORMS = [
  FORM_INCOME_TOPUP,
  FORM_INCOME_AMS,
  FORM_EXP_TRANSFER
];

// Формы начисления за посты (личные и сюжетные)
export const POST_FORMS = [
  FORM_INCOME_PERSONALPOST,
  FORM_INCOME_PLOTPOST
];
