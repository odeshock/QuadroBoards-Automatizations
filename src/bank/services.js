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
import { autoDiscounts } from './data.js';

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

// Универсальная функция для применения автоматических скидок
export function updateAutoDiscounts() {
  // Находим существующую группу скидок
  const discountKey = buildGroupKey({
    templateSelector: FORM_GIFT_DISCOUNT,
    title: TEXT_MESSAGES.AUTO_DISCOUNTS_TITLE,
    amount: '',
    amountLabel: TEXT_MESSAGES.DISCOUNT_LABEL,
    kind: 'income'
  });

  const discountGroupIndex = submissionGroups.findIndex(g => g.key === discountKey);
  const entries = [];
  let totalDiscount = 0;

  // Проходим по всем правилам скидок
  autoDiscounts.forEach(rule => {
    const { id, title, forms, type, discountValue, roundResult, condition } = rule;

    // Определяем, какие группы подходят под это правило
    const matchingGroups = submissionGroups.filter(g => {
      if (forms === 'all') return true;
      return forms.includes(g.templateSelector);
    });

    if (matchingGroups.length === 0) return;

    // Подсчитываем общее количество элементов
    let totalItems = 0;
    matchingGroups.forEach(group => {
      group.entries.forEach(entry => {
        const dataObj = entry.data || {};
        const recipientKeys = Object.keys(dataObj).filter(k => REGEX.RECIPIENT.test(k));
        totalItems += recipientKeys.filter(key => String(dataObj[key] || '').trim()).length;
      });
    });

    // Проверяем условие
    let conditionMet = false;
    if (condition.type === 'none') {
      conditionMet = true;
    } else if (condition.type === 'min_items') {
      conditionMet = totalItems >= condition.value;
    }

    if (!conditionMet || totalItems === 0) return;

    // Вычисляем скидку в зависимости от типа
    let discount = 0;
    let calculation = '';

    if (type === 'per_item') {
      // Скидка за каждый элемент
      discount = discountValue * totalItems;
      calculation = `${discountValue} × ${totalItems}`;
    } else if (type === 'fixed') {
      // Фиксированная скидка
      discount = discountValue;
      calculation = String(discountValue);
    } else if (type === 'percent') {
      // Процентная скидка - нужно вычислить общую стоимость
      let operationTotal = 0;
      matchingGroups.forEach(group => {
        const price = Number.parseInt(group.giftPrice1, 10) || 0;
        group.entries.forEach(entry => {
          const dataObj = entry.data || {};
          const recipientKeys = Object.keys(dataObj).filter(k => REGEX.RECIPIENT.test(k));
          const count = recipientKeys.filter(key => String(dataObj[key] || '').trim()).length;
          operationTotal += price * count;
        });
      });
      discount = operationTotal * (discountValue / 100);
      if (roundResult) {
        discount = Math.round(discount);
      }
      calculation = `${formatNumber(operationTotal)} × ${discountValue}%`;
    }

    if (discount > 0) {
      totalDiscount += discount;
      entries.push({
        id: incrementEntrySeq(),
        template_id: `auto-discount-${id}`,
        data: {
          discount_id: id,
          discount_title: title,
          discount_type: type,
          total_items: totalItems,
          discount_amount: discount,
          calculation
        },
        multiplier: 1
      });
    }
  });

  // Обновляем или удаляем группу скидок
  if (entries.length > 0) {
    if (discountGroupIndex === -1) {
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
      const group = submissionGroups[discountGroupIndex];
      group.amount = totalDiscount;
      group.entries = entries;
    }
  } else if (discountGroupIndex !== -1) {
    submissionGroups.splice(discountGroupIndex, 1);
  }
}

// Оставляем старую функцию для обратной совместимости (будет удалена позже)
export function updateGiftDiscountEntry() {
  updateAutoDiscounts();
}
