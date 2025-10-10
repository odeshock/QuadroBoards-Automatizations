// ============================================================================
// services.js — Бизнес-логика: данные, расчёты, утилиты
// ============================================================================

import { counterPrefixMap } from './config.js';
import {
  REGEX,
  TEXT_MESSAGES,
  FORM_GIFT_PRESENT,
  FORM_GIFT_CUSTOM,
  FORM_GIFT_DISCOUNT
} from './constants.js';
import {
  pad2,
  formatNumber,
  parseNumericAmount,
  roundNewToAnchorDOM,
  fullMonthsDiffVirtualDOM,
  fmtYMD
} from './utils.js';

// Реэкспортируем для обратной совместимости
export {
  pad2,
  formatNumber,
  parseNumericAmount,
  roundNewToAnchorDOM,
  fullMonthsDiffVirtualDOM,
  fmtYMD
};

// ============================================================================
// УПРАВЛЕНИЕ ДАННЫМИ — хранение групп и записей
// ============================================================================

export const submissionGroups = [];
export let groupSeq = 0;
export let entrySeq = 0;

export const buildGroupKey = ({ templateSelector = '', title = '', amount = '', amountLabel = '', kind = '', giftId = '' }) =>
  [templateSelector, title, amount, amountLabel, kind, giftId].join('||');

export function incrementGroupSeq() {
  groupSeq += 1;
  return groupSeq;
}

export function incrementEntrySeq() {
  entrySeq += 1;
  return entrySeq;
}

// ============================================================================
// УТИЛИТЫ — форматирование ключей для отображения в логе
// ============================================================================

export function formatEntryKey(key) {
  if (key === 'quantity') return TEXT_MESSAGES.QUANTITY_LABEL;
  if (key === 'reason') return TEXT_MESSAGES.COMMENT_LABEL;

  const recipientMatch = key.match(REGEX.RECIPIENT);
  if (recipientMatch) return recipientMatch[1] === '1' ? TEXT_MESSAGES.RECIPIENT_LABEL : `${TEXT_MESSAGES.RECIPIENT_LABEL} ${recipientMatch[1]}`;

  const fromMatch = key.match(REGEX.FROM);
  if (fromMatch) return fromMatch[1] === '1' ? TEXT_MESSAGES.FROM_LABEL : `${TEXT_MESSAGES.FROM_LABEL} ${fromMatch[1]}`;

  const wishMatch = key.match(REGEX.WISH);
  if (wishMatch) return wishMatch[1] === '1' ? TEXT_MESSAGES.COMMENT_LABEL : `${TEXT_MESSAGES.COMMENT_LABEL} ${wishMatch[1]}`;

  const counterMatch = key.match(REGEX.COUNTER);
  if (counterMatch) {
    const [, prefix, suffix] = counterMatch;
    const cfg = counterPrefixMap[prefix];
    if (cfg) {
      if (suffix === 'old') return 'Предыдущее значение';
      if (suffix === 'new') return 'Новое значение';
      if (suffix === 'rounded')
        return cfg.prefix === 'month'
          ? 'Новое значение (условно округлено)'
          : 'Новое значение (округлено)';
      if (suffix === 'diff') return cfg.logDiffLabel || 'Новый учитанный объем';
    }
  }
  return key;
}

// ============================================================================
// СКИДКИ НА ПОДАРКИ
// ============================================================================

// Подсчитывает общее количество подарков (получателей) во всех группах подарков
export function countTotalGifts() {
  let total = 0;
  submissionGroups.forEach((group) => {
    const isGift = group.templateSelector === FORM_GIFT_PRESENT ||
                   REGEX.GIFT_TITLE.test(group.title || '');
    if (!isGift) return;

    group.entries.forEach((item) => {
      const dataObj = item.data || {};
      const recipientKeys = Object.keys(dataObj).filter(k => REGEX.RECIPIENT.test(k));
      recipientKeys.forEach((key) => {
        const rid = String(dataObj[key] ?? '').trim();
        if (rid) total++;
      });
    });
  });
  return total;
}

// Подсчитывает общее количество индивидуальных подарков
export function countTotalCustomGifts() {
  let total = 0;
  submissionGroups.forEach((group) => {
    const isCustomGift = group.templateSelector === FORM_GIFT_CUSTOM ||
                         REGEX.CUSTOM_GIFT_TITLE.test(group.title || '');
    if (!isCustomGift) return;

    group.entries.forEach((item) => {
      const dataObj = item.data || {};
      const recipientKeys = Object.keys(dataObj).filter(k => REGEX.RECIPIENT.test(k));
      recipientKeys.forEach((key) => {
        const rid = String(dataObj[key] ?? '').trim();
        if (rid) total++;
      });
    });
  });
  return total;
}

// Обновляет объект скидки: создаёт если >= 5 подарков, удаляет если < 5
export function updateGiftDiscountEntry() {
  const totalGifts = countTotalGifts();
  const totalCustomGifts = countTotalCustomGifts();

  // Находим существующую группу скидки
  const discountKey = buildGroupKey({
    templateSelector: FORM_GIFT_DISCOUNT,
    title: TEXT_MESSAGES.AUTO_DISCOUNTS_TITLE,
    amount: '',
    amountLabel: TEXT_MESSAGES.DISCOUNT_LABEL,
    kind: 'income'
  });

  const discountGroupIndex = submissionGroups.findIndex(g => g.key === discountKey);

  const hasRegularDiscount = totalGifts >= 5;
  const hasCustomDiscount = totalCustomGifts >= 5;

  if (hasRegularDiscount || hasCustomDiscount) {
    const entries = [];
    let totalDiscount = 0;

    // Скидка на обычные подарки
    if (hasRegularDiscount) {
      const fivesCount = Math.floor(totalGifts / 5);

      let giftPrice1 = 60;
      let giftPrice5 = 140;

      const firstGiftGroup = submissionGroups.find(g =>
        g.templateSelector === FORM_GIFT_PRESENT ||
        REGEX.GIFT_TITLE.test(g.title || '')
      );

      if (firstGiftGroup) {
        giftPrice1 = Number.parseInt(firstGiftGroup.giftPrice1, 10) || 60;
        giftPrice5 = Number.parseInt(firstGiftGroup.giftPrice5, 10) || 140;
      }

      const discount = (giftPrice1 * fivesCount * 5) - (giftPrice5 * fivesCount);
      totalDiscount += discount;

      entries.push({
        id: incrementEntrySeq(),
        template_id: 'gift-discount-regular',
        data: {
          discount_type: 'regular',
          total_gifts: totalGifts,
          fives_count: fivesCount,
          discount_amount: discount,
          price_1: giftPrice1,
          price_5: giftPrice5,
          calculation: `(${giftPrice1} × ${fivesCount} × 5) - (${giftPrice5} × ${fivesCount})`
        },
        multiplier: 1
      });
    }

    // Скидка на индивидуальные подарки
    if (hasCustomDiscount) {
      const fivesCount = Math.floor(totalCustomGifts / 5);

      let customPrice1 = 100;
      let customPrice5 = 400;

      const firstCustomGiftGroup = submissionGroups.find(g =>
        g.templateSelector === FORM_GIFT_CUSTOM ||
        REGEX.CUSTOM_GIFT_TITLE.test(g.title || '')
      );

      if (firstCustomGiftGroup) {
        customPrice1 = Number.parseInt(firstCustomGiftGroup.giftPrice1, 10) || 100;
        customPrice5 = Number.parseInt(firstCustomGiftGroup.giftPrice5, 10) || 400;
      }

      const discount = (customPrice1 * fivesCount * 5) - (customPrice5 * fivesCount);
      totalDiscount += discount;

      entries.push({
        id: incrementEntrySeq(),
        template_id: 'gift-discount-custom',
        data: {
          discount_type: 'custom',
          total_gifts: totalCustomGifts,
          fives_count: fivesCount,
          discount_amount: discount,
          price_1: customPrice1,
          price_5: customPrice5,
          calculation: `(${customPrice1} × ${fivesCount} × 5) - (${customPrice5} × ${fivesCount})`
        },
        multiplier: 1
      });
    }

    if (discountGroupIndex === -1) {
      // Создаём новую группу
      const newGroup = {
        id: incrementGroupSeq(),
        key: discountKey,
        templateSelector: FORM_GIFT_DISCOUNT,
        title: TEXT_MESSAGES.AUTO_DISCOUNTS_TITLE,
        amount: totalDiscount,
        amountLabel: TEXT_MESSAGES.DISCOUNT_LABEL,
        kind: 'income',
        entries,
        isDiscount: true
      };
      submissionGroups.push(newGroup);
    } else {
      // Обновляем существующую
      const group = submissionGroups[discountGroupIndex];
      group.amount = totalDiscount;
      group.entries = entries;
    }
  } else if (discountGroupIndex !== -1) {
    // Удаляем группу скидки, если нет подарков >= 5
    submissionGroups.splice(discountGroupIndex, 1);
  }
}
