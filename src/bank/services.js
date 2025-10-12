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
import { autoDiscounts, autoPriceAdjustments } from './data.js';

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

    // Для форм с несколькими получателями - суммируем все amount_N значения
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
/**
 * Проверяет, истекла ли скидка на основе времени по Москве (UTC+3)
 * @param {string} expiresAt - Дата окончания в формате 'YYYY-MM-DD' (скидка действует до конца этого дня)
 * @returns {boolean} - true, если скидка истекла
 */
function isDiscountExpired(expiresAt) {
  if (!expiresAt) return false;

  // Получаем текущее время
  const now = new Date();

  // Добавляем время конца дня (23:59:59) к дате
  const expiryDateString = `${expiresAt}T23:59:59`;

  // Парсим дату окончания (предполагаем, что она указана в московском времени)
  const expiryDate = new Date(expiryDateString);

  // Московское время = UTC+3
  // Конвертируем текущее время в московское
  const moscowOffset = 3 * 60; // 3 часа в минутах
  const localOffset = now.getTimezoneOffset(); // смещение локального времени от UTC в минутах (отрицательное для восточных часовых поясов)
  const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60 * 1000);

  return moscowTime >= expiryDate;
}

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
    const { id, title, forms, type, discountValue, condition, expiresAt } = rule;

    // Проверяем, не истекла ли скидка
    if (isDiscountExpired(expiresAt)) {
      return; // Пропускаем истекшую скидку
    }

    // Для процентной скидки проверяем, что значение не больше 100
    if (type === 'percent' && discountValue > 100) {
      return; // Скидка не работает
    }

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

    // Вычисляем сумму операций для этих форм (для проверки лимита скидки)
    let operationTotal = 0;
    matchingGroups.forEach(group => {
      const groupCost = calculateGroupCost(group);
      operationTotal += Math.abs(groupCost);
    });

    // Вычитаем корректировки для этих форм (если есть)
    const adjustmentGroup = submissionGroups.find(g => g.isPriceAdjustment);
    if (adjustmentGroup) {
      adjustmentGroup.entries.forEach(entry => {
        const adjustmentForm = entry.data?.form;
        if (matchingGroups.some(g => g.templateSelector === adjustmentForm)) {
          const adjustmentAmount = Number(entry.data?.adjustment_amount) || 0;
          operationTotal -= adjustmentAmount;
        }
      });
    }

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
      // Процентная скидка
      discount = operationTotal * (discountValue / 100);
      // Всегда округляем в большую сторону
      discount = Math.ceil(discount);
      calculation = `${formatNumber(operationTotal)} × ${discountValue}%`;
    }

    // Скидка не может превышать сумму операций для этих форм
    if (discount > operationTotal) {
      discount = operationTotal;
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

  // Вычисляем общую сумму всех операций (для проверки лимита общей скидки)
  let grandTotal = 0;
  submissionGroups.forEach(g => {
    if (g.isDiscount || g.isPriceAdjustment) return; // Пропускаем скидки и корректировки
    const cost = calculateGroupCost(g);
    grandTotal += Math.abs(cost);
  });

  // Вычитаем все корректировки
  const adjustmentGroup = submissionGroups.find(g => g.isPriceAdjustment);
  if (adjustmentGroup) {
    adjustmentGroup.entries.forEach(entry => {
      const adjustmentAmount = Number(entry.data?.adjustment_amount) || 0;
      grandTotal -= adjustmentAmount;
    });
  }

  // Общая сумма скидок не может превышать общую сумму операций
  if (totalDiscount > grandTotal) {
    // Пропорционально уменьшаем все скидки
    const ratio = grandTotal / totalDiscount;
    entries.forEach(entry => {
      const oldAmount = entry.data.discount_amount;
      entry.data.discount_amount = Math.ceil(oldAmount * ratio);
    });
    totalDiscount = grandTotal;
  }

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

// ============================================================================
// АВТОМАТИЧЕСКАЯ КОРРЕКТИРОВКА ЦЕН
// ============================================================================

export function updateAutoPriceAdjustments() {
  // Константа для идентификатора корректировки
  const FORM_PRICE_ADJUSTMENT = '#price-adjustment';
  const ADJUSTMENT_TITLE = 'Автоматическая корректировка цен';
  const ADJUSTMENT_LABEL = 'Корректировка';

  // Находим существующую группу корректировок
  const adjustmentKey = buildGroupKey({
    templateSelector: FORM_PRICE_ADJUSTMENT,
    title: ADJUSTMENT_TITLE,
    amount: '',
    amountLabel: ADJUSTMENT_LABEL,
    kind: 'expense'
  });

  const adjustmentGroupIndex = submissionGroups.findIndex(g => g.key === adjustmentKey);
  const entries = [];
  let totalAdjustment = 0;

  // Проходим по всем правилам корректировок
  autoPriceAdjustments.forEach(rule => {
    const { id, title, form, batchSize, newPrice } = rule;

    // Находим ВСЕ группы, соответствующие форме
    const targetGroups = submissionGroups.filter(g => g.templateSelector === form);
    if (targetGroups.length === 0) return;

    // Получаем старую цену из первой группы
    const oldPrice = Number(targetGroups[0].price) || 0;
    if (oldPrice === 0) return;

    // Подсчитываем общее количество элементов во ВСЕХ операциях данной формы
    let totalItems = 0;
    targetGroups.forEach(targetGroup => {
      targetGroup.entries.forEach(entry => {
      const dataObj = entry.data || {};

      // Для постов подсчитываем количество постов из JSON
      const personalPostsJson = dataObj.personal_posts_json;
      const plotPostsJson = dataObj.plot_posts_json;

      if (personalPostsJson) {
        try {
          const posts = JSON.parse(personalPostsJson);
          if (Array.isArray(posts)) {
            totalItems += posts.length;
          }
        } catch (_) {}
      }

      if (plotPostsJson) {
        try {
          const posts = JSON.parse(plotPostsJson);
          if (Array.isArray(posts)) {
            totalItems += posts.length;
          }
        } catch (_) {}
      }

      // Для других форм подсчитываем получателей
      if (!personalPostsJson && !plotPostsJson) {
        const recipientKeys = Object.keys(dataObj).filter(k => REGEX.RECIPIENT.test(k));
        totalItems += recipientKeys.filter(key => String(dataObj[key] || '').trim()).length;
      }
      });
    });

    // Проверяем условие применения: itemCount >= batchSize
    if (totalItems < batchSize) return;

    // Вычисляем количество полных партий
    const batches = Math.floor(totalItems / batchSize);
    const batchItems = batches * batchSize;

    // Вычисляем корректировку
    const oldCost = oldPrice * batchItems;
    const newCost = newPrice * batches;
    const adjustment = oldCost - newCost;

    // Проверяем, что корректировка положительная
    if (adjustment <= 0) return;

    // Получаем сумму ВСЕХ операций данной формы
    let operationTotal = 0;
    targetGroups.forEach(group => {
      operationTotal += Math.abs(calculateGroupCost(group));
    });

    // Корректировка не может быть больше суммы операций
    const finalAdjustment = Math.min(adjustment, operationTotal);

    if (finalAdjustment <= 0) return;

    // Формируем название и расчёт
    const adjustmentTitle = title.replace('{title}', targetGroups[0].title || 'Операция');
    const calculation = `${formatNumber(oldPrice)} × ${batches} × ${batchSize} − ${formatNumber(newPrice)} × ${batches}`;

    totalAdjustment += finalAdjustment;
    entries.push({
      id: incrementEntrySeq(),
      template_id: `auto-adjustment-${id}`,
      data: {
        adjustment_id: id,
        adjustment_title: adjustmentTitle,
        form: form,
        batch_size: batchSize,
        old_price: oldPrice,
        new_price: newPrice,
        total_items: totalItems,
        batches: batches,
        adjustment_amount: finalAdjustment,
        calculation
      },
      multiplier: 1
    });
  });

  // Обновляем или удаляем группу корректировок
  if (entries.length > 0) {
    if (adjustmentGroupIndex === -1) {
      const newGroup = {
        id: incrementGroupSeq(),
        key: adjustmentKey,
        templateSelector: FORM_PRICE_ADJUSTMENT,
        title: ADJUSTMENT_TITLE,
        amount: totalAdjustment,
        amountLabel: ADJUSTMENT_LABEL,
        kind: 'expense',
        entries,
        isPriceAdjustment: true
      };
      submissionGroups.push(newGroup);
    } else {
      const group = submissionGroups[adjustmentGroupIndex];
      group.amount = totalAdjustment;
      group.entries = entries;
    }
  } else if (adjustmentGroupIndex !== -1) {
    submissionGroups.splice(adjustmentGroupIndex, 1);
  }
}
