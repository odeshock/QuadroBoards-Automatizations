// ============================================================================
// modalConfig.js — Конфигурационные объекты для модальных окон
// ============================================================================

import {
  FORM_TIMEOUT_MS,
  PROMO_TIMEOUT_MS,
  NEEDED_TIMEOUT_MS,
  TOPUP_TIMEOUT_MS,
  AMS_TIMEOUT_MS,
  TRANSFER_TIMEOUT_MS,
  BEST_EPISODE_TIMEOUT_MS,
  BEST_POST_TIMEOUT_MS,
  BEST_WRITER_TIMEOUT_MS,
  BEST_ACTIVIST_TIMEOUT_MS,
  PERSONAL_TIMEOUT_MS,
  PLOT_TIMEOUT_MS
} from '../config.js';

import {
  FORM_INCOME_BANNER_RENO,
  FORM_INCOME_BANNER_MAYAK,
  FORM_INCOME_ANKETA,
  FORM_INCOME_AKCION,
  FORM_INCOME_NEEDCHAR,
  FORM_INCOME_TOPUP,
  FORM_INCOME_AMS,
  FORM_EXP_TRANSFER,
  FORM_INCOME_EPISODE_OF,
  FORM_INCOME_POST_OF,
  FORM_INCOME_WRITER,
  FORM_INCOME_ACTIVIST,
  FORM_INCOME_PERSONALPOST,
  FORM_INCOME_PLOTPOST
} from '../constants.js';

import {
  MIN_PERSONAL_POST_SYMBOLS,
  MIN_PLOT_POST_SYMBOLS
} from '../data.js';

import {
  formatNumber
} from '../services.js';

// Таймауты для форм админских начислений с несколькими получателями
export const ADMIN_RECIPIENT_FLOW_TIMEOUTS = {
  [FORM_INCOME_ANKETA]: FORM_TIMEOUT_MS,
  [FORM_INCOME_AKCION]: PROMO_TIMEOUT_MS,
  [FORM_INCOME_NEEDCHAR]: NEEDED_TIMEOUT_MS,
  [FORM_INCOME_EPISODE_OF]: BEST_EPISODE_TIMEOUT_MS
};

// Таймауты для форм админских начислений с одним получателем
export const ADMIN_SINGLE_RECIPIENT_TIMEOUTS = {
  [FORM_INCOME_POST_OF]: BEST_POST_TIMEOUT_MS,
  [FORM_INCOME_WRITER]: BEST_WRITER_TIMEOUT_MS,
  [FORM_INCOME_ACTIVIST]: BEST_ACTIVIST_TIMEOUT_MS
};

// Конфигурация для форм админских начислений с указанием суммы
export const ADMIN_AMOUNT_CONFIG = {
  [FORM_INCOME_TOPUP]: {
    timeoutMs: TOPUP_TIMEOUT_MS,
    setupFn: 'setupAdminTopupFlow',
    requireComment: false
  },
  [FORM_INCOME_AMS]: {
    timeoutMs: AMS_TIMEOUT_MS,
    setupFn: 'setupAdminTopupFlow',
    requireComment: true
  },
  [FORM_EXP_TRANSFER]: {
    timeoutMs: TRANSFER_TIMEOUT_MS,
    setupFn: 'setupTransferFlow',
    requireComment: false
  }
};

// Конфигурация для форм начисления за посты
export const POST_CONFIG = {
  [FORM_INCOME_PERSONALPOST]: {
    hiddenFieldName: 'personal_posts_json',
    postsKey: 'PERSONAL_POSTS',
    timeoutMs: PERSONAL_TIMEOUT_MS,
    previewId: 'personal-preview',
    infoBuilder: ({ price, bonus }) => (
      `<strong>Система подсчета:</strong><br>
      — фиксированная выплата за пост — ${formatNumber(price)},<br>
      — дополнительная выплата за каждую тысячу символов в посте — ${formatNumber(bonus)}.`
    ),
    additionalItemsAggregator: (items) => items.reduce(
      (sum, item) => sum + Math.floor(item.symbols_num / 1000),
      0
    ),
    itemCountFilter: (items) => items.filter(item => item.symbols_num >= MIN_PERSONAL_POST_SYMBOLS).length
  },
  [FORM_INCOME_PLOTPOST]: {
    hiddenFieldName: 'plot_posts_json',
    postsKey: 'PLOT_POSTS',
    timeoutMs: PLOT_TIMEOUT_MS,
    previewId: 'plot-preview',
    infoBuilder: ({ price, bonus }) => (
      `<strong>Система подсчета:</strong><br>
      — фиксированная выплата за пост — ${formatNumber(price)},<br>
      — дополнительная выплата за каждую тысячу символов в посте (но не более, чем за три тысячи) — ${formatNumber(bonus)}.`
    ),
    additionalItemsAggregator: (items) => items.reduce((sum, item) => {
      const thousands = Math.floor(item.symbols_num / 1000);
      return sum + Math.min(Math.max(0, thousands), 3);
    }, 0),
    itemCountFilter: (items) => items.filter(item => item.symbols_num >= MIN_PLOT_POST_SYMBOLS).length
  }
};

// Конфигурация для баннеров (проверка флага "уже обработано")
export const BANNER_ALREADY_PROCESSED_CONFIG = {
  [FORM_INCOME_BANNER_RENO]: {
    flagKey: 'BANNER_RENO_FLAG',
    message: 'Начисление за баннер на Рено уже производилось.'
  },
  [FORM_INCOME_BANNER_MAYAK]: {
    flagKey: 'BANNER_MAYAK_FLAG',
    message: 'Начисление за баннер на Маяке уже производилось.'
  }
};
