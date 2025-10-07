// ============================================================================
// config.js — Константы и конфигурации
// ============================================================================

// Timeouts для различных форм (3 минуты = 180000 мс)
export const MSG_TIMEOUT_MS = 180000;
export const REP_TIMEOUT_MS = 180000;
export const POS_TIMEOUT_MS = 180000;
export const MONTH_TIMEOUT_MS = 180000;
export const COUNTER_POLL_INTERVAL_MS = 500;
export const ADS_TIMEOUT_MS = 180000;
export const PERSONAL_TIMEOUT_MS = 180000;
export const PLOT_TIMEOUT_MS = 180000;
export const FIRST_POST_TIMEOUT_MS = 180000;
export const FORM_TIMEOUT_MS = 180000;
export const PROMO_TIMEOUT_MS = 180000;
export const NEEDED_TIMEOUT_MS = 180000;
export const BEST_EPISODE_TIMEOUT_MS = 180000;
export const BEST_POST_TIMEOUT_MS = 180000;
export const BEST_WRITER_TIMEOUT_MS = 180000;
export const BEST_ACTIVIST_TIMEOUT_MS = 180000;
export const TOPUP_TIMEOUT_MS = 180000;
export const AMS_TIMEOUT_MS = 180000;
export const TRANSFER_TIMEOUT_MS = 180000;
export const GIFT_TIMEOUT_MS = 180000;

// Конфигурация для счётчиков (сообщения, репутация, позитив, месяцы)
export const counterConfigs = {
  'form-income-100msgs': {
    prefix: 'msg',
    oldVar: 'MSG100_OLD',
    newVar: 'MSG100_NEW',
    unitLabel: 'сообщений',
    diffNoteLabel: 'новых сообщений',
    logDiffLabel: 'Новые учитанные сообщения',
    timeout: MSG_TIMEOUT_MS,
    step: 100
  },
  'form-income-100rep': {
    prefix: 'rep',
    oldVar: 'REP100_OLD',
    newVar: 'REP100_NEW',
    unitLabel: 'уважения',
    diffNoteLabel: 'уважения',
    logDiffLabel: 'Новое учитанное уважение',
    timeout: REP_TIMEOUT_MS,
    step: 100
  },
  'form-income-100pos': {
    prefix: 'pos',
    oldVar: 'POS100_OLD',
    newVar: 'POS100_NEW',
    unitLabel: 'позитива',
    diffNoteLabel: 'позитива',
    logDiffLabel: 'Новый учитанный позитив',
    timeout: POS_TIMEOUT_MS,
    step: 100
  },
  'form-income-month': {
    prefix: 'month',
    oldVar: 'MONTH_OLD',
    newVar: 'MONTH_NEW',
    unitLabel: 'месяцев',
    diffNoteLabel: 'новых месяцев пребывания',
    logDiffLabel: 'Новые учтённые месяцы пребывания',
    timeout: MONTH_TIMEOUT_MS,
    step: 1
  },
};

// Маппинг префиксов на конфигурации
export const counterPrefixMap = {
  msg: counterConfigs['form-income-100msgs'],
  rep: counterConfigs['form-income-100rep'],
  pos: counterConfigs['form-income-100pos'],
  month: counterConfigs['form-income-month']
};
