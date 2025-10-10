// ============================================================================
// services.js — Бизнес-логика: данные, расчёты, утилиты
// ============================================================================

import { counterPrefixMap } from './config.js';
import {
  REGEX,
  TEXT_MESSAGES,
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
// АВТОМАТИЧЕСКИЕ СКИДКИ
// ============================================================================

// Вычисляет реальную стоимость группы на основе её записей
function calculateGroupCost(group) {
  let total = 0;

  const mode = group.mode || 'price_per_item';
  const price = Number(group.price) || 0;
  const bonus = Number(group.bonus) || 0;

  group.entries.forEach(entry => {
    const dataObj = entry.data || {};
    const multiplier = Number(entry.multiplier) || 1;

    // Подсчёт элементов (получателей)
    const recipientKeys = Object.keys(dataObj).filter(k => REGEX.RECIPIENT.test(k));
    const recipientCount = recipientKeys.filter(key => String(dataObj[key] || '').trim()).length;

    // Подсчёт количества через quantity_N (для форм типа спасительный жилет)
    const quantityKeys = Object.keys(dataObj).filter(k => /^quantity_\d+$/.test(k));
    let totalQuantity = 0;
    quantityKeys.forEach(key => {
      const idx = key.match(/^quantity_(\d+)$/)[1];
      const recipientKey = `recipient_${idx}`;
      // Учитываем quantity только если есть получатель
      if (String(dataObj[recipientKey] || '').trim()) {
        totalQuantity += Number(dataObj[key]) || 0;
      }
    });

    // Проверяем простое поле quantity (без индекса)
    if (totalQuantity === 0 && dataObj.quantity) {
      totalQuantity = Number(dataObj.quantity) || 0;
    }

    // Если есть quantity - используем его, иначе - количество получателей
    const items = totalQuantity > 0 ? totalQuantity : recipientCount;

    // Подсчёт дополнительных элементов (тысячи)
    const thousandKeys = Object.keys(dataObj).filter(k => /^thousand_\d+$/.test(k));
    const additional_items = thousandKeys.reduce((sum, key) => {
      return sum + (Number(dataObj[key]) || 0);
    }, 0);

    // Введённая сумма
    let entered_amount = 0;
    if (dataObj.amount) {
      entered_amount = parseNumericAmount(String(dataObj.amount));
    }

    // Для topup/ams - суммируем все topup_N значения
    const topupKeys = Object.keys(dataObj).filter(k => /^topup_\d+$/.test(k));
    if (topupKeys.length > 0) {
      entered_amount = topupKeys.reduce((sum, key) => {
        return sum + (Number(dataObj[key]) || 0);
      }, 0);
    }

    // Для переводов - суммируем все amount_N значения
    const amountKeys = Object.keys(dataObj).filter(k => /^amount_\d+$/.test(k));
    if (amountKeys.length > 0) {
      entered_amount = amountKeys.reduce((sum, key) => {
        const idx = key.match(/^amount_(\d+)$/)[1];
        const recipientKey = `recipient_${idx}`;
        // Учитываем amount только если есть получатель
        if (String(dataObj[recipientKey] || '').trim()) {
          return sum + (parseNumericAmount(String(dataObj[key] || '0')));
        }
        return sum;
      }, 0);
    }

    // Расчёт стоимости в зависимости от режима
    let entryCost = 0;
    switch (mode) {
      case 'price_per_item':
        // Если нет получателей, считаем 1 единицу (для фиксированных операций)
        entryCost = price * (items > 0 ? items : 1);
        break;
      case 'price_per_item_w_bonus':
        entryCost = price * (items > 0 ? items : 1) + bonus * additional_items;
        break;
      case 'entered_amount':
        entryCost = entered_amount;
        break;
      case 'price_w_entered_amount':
        entryCost = entered_amount + price * (items > 0 ? items : 1);
        break;
      default:
        entryCost = 0;
    }
    
    total += entryCost * multiplier;
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
      // Для 'all' берём только расходы (kind === 'expense')
      if (forms === 'all') return g.kind === 'expense';
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

    // Для процентной скидки не требуем totalItems > 0, т.к. считаем по суммам
    if (!conditionMet) return;
    if (totalItems === 0 && type !== 'percent') return;

    // Вычисляем скидку в зависимости от типа
    let discount = 0;
    let calculation = '';

    if (type === 'per_item') {
      // Скидка за каждый элемент
      discount = discountValue * totalItems;
      calculation = `${discountValue} × ${totalItems}`;
    } else if (type === 'per_batch') {
      // Скидка за каждые N элементов
      const { batchSize = 1 } = rule;
      const batches = Math.floor(totalItems / batchSize);
      discount = discountValue * batches;
      calculation = `${discountValue} × ${batches}`;
    } else if (type === 'fixed') {
      // Фиксированная скидка
      discount = discountValue;
      calculation = String(discountValue);
    } else if (type === 'percent') {
      // Процентная скидка - вычисляем общую стоимость операций
      let operationTotal = 0;
      matchingGroups.forEach(group => {
        // Вычисляем реальную стоимость группы на основе записей
        const groupCost = calculateGroupCost(group);
        operationTotal += Math.abs(groupCost); // Используем abs, т.к. расходы могут быть отрицательными
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
