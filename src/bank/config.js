// ============================================================================
// config.js — Константы и конфигурации
// ============================================================================

import {
  FORM_INCOME_100MSGS,
  FORM_INCOME_100REP,
  FORM_INCOME_100POS,
  FORM_INCOME_MONTH
} from './constants.js';

export const ALLOWED_PARENTS = Array.isArray(window.ALLOWED_PARENTS)
  ? window.ALLOWED_PARENTS
  : [
      "https://testfmvoice.rusff.me",   // тест
      "https://followmyvoice.rusff.me"  // прод
    ];
export const BASE_URL = 'http://followmyvoice.rusff.me';

// Базовые таймауты (3 минуты = 180000 мс)
export const DEFAULT_TIMEOUT_MS = 180000;
export const COUNTER_POLL_INTERVAL_MS = 500;

// Используем единый таймаут для всех форм
export const MSG_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const REP_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const POS_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const MONTH_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const ADS_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const PERSONAL_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const PLOT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const FIRST_POST_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const FORM_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const PROMO_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const NEEDED_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const BEST_EPISODE_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const BEST_POST_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const BEST_WRITER_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const BEST_ACTIVIST_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const TOPUP_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const AMS_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const TRANSFER_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const GIFT_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const BANNER_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

// Конфигурация для счётчиков (сообщения, репутация, позитив, месяцы)
export const counterConfigs = {
  [FORM_INCOME_100MSGS]: {
    prefix: 'msg',
    oldVar: 'MSG100_OLD',
    newVar: 'MSG100_NEW',
    unitLabel: 'сообщений',
    diffNoteLabel: 'новых сообщений',
    logDiffLabel: 'Новые учитанные сообщения',
    timeout: MSG_TIMEOUT_MS,
    step: 100
  },
  [FORM_INCOME_100REP]: {
    prefix: 'rep',
    oldVar: 'REP100_OLD',
    newVar: 'REP100_NEW',
    unitLabel: 'уважения',
    diffNoteLabel: 'уважения',
    logDiffLabel: 'Новое учитанное уважение',
    timeout: REP_TIMEOUT_MS,
    step: 100
  },
  [FORM_INCOME_100POS]: {
    prefix: 'pos',
    oldVar: 'POS100_OLD',
    newVar: 'POS100_NEW',
    unitLabel: 'позитива',
    diffNoteLabel: 'позитива',
    logDiffLabel: 'Новый учитанный позитив',
    timeout: POS_TIMEOUT_MS,
    step: 100
  },
  [FORM_INCOME_MONTH]: {
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
  msg: counterConfigs[FORM_INCOME_100MSGS],
  rep: counterConfigs[FORM_INCOME_100REP],
  pos: counterConfigs[FORM_INCOME_100POS],
  month: counterConfigs[FORM_INCOME_MONTH]
};
