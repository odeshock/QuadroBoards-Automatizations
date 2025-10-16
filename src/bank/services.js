// ============================================================================
// services.js — Бизнес-логика: данные, расчёты, утилиты
// ============================================================================

import { counterPrefixMap } from './config.js';
import {
  REGEX,
  TEXT_MESSAGES,
  FORM_GIFT_DISCOUNT,
  FORM_PERSONAL_COUPON,
  toSelector
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
// УВЕДОМЛЕНИЯ
// ============================================================================

/**
 * Показывает временное всплывающее уведомление
 * @param {string} message - Текст сообщения
 * @param {number} duration - Длительность показа в мс (по умолчанию 3000)
 */
export function showNotification(message, duration = 3000) {
  // Создаём контейнер для уведомлений если его ещё нет
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    `;
    document.body.appendChild(container);
  }

  // Создаём элемент уведомления
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: #333;
    color: #fff;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-size: 14px;
    line-height: 1.4;
    animation: slideIn 0.3s ease-out;
    opacity: 0;
    transform: translateX(100%);
  `;
  notification.textContent = message;

  // Добавляем CSS анимацию если её ещё нет
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes slideOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(notification);

  // Анимация появления
  requestAnimationFrame(() => {
    notification.style.animation = 'slideIn 0.3s ease-out forwards';
  });

  // Удаление через duration мс
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => {
      notification.remove();
      // Удаляем контейнер если он пустой
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);
}

// ============================================================================
// УПРАВЛЕНИЕ ДАННЫМИ — хранение групп и записей
// ============================================================================

export const submissionGroups = [];
export let groupSeq = 0;
export let entrySeq = 0;

// Логи изменений для админов (при редактировании операций)
export const editLogs = [];

/**
 * Добавляет запись в лог изменений (только если IS_ADMIN_TO_EDIT === true)
 * @param {string} message - сообщение для лога
 */
export function addEditLog(message) {
  if (typeof window.IS_ADMIN_TO_EDIT !== 'undefined' && window.IS_ADMIN_TO_EDIT === true) {
    // Если textarea существует, читаем из неё (чтобы сохранить ручные изменения)
    const editLogsField = document.getElementById('edit-logs-field');
    if (editLogsField) {
      const currentText = editLogsField.value;
      const newText = currentText ? `${currentText}\n${message}` : message;
      editLogsField.value = newText;

      // Обновляем массив editLogs из textarea (синхронизация)
      editLogs.length = 0;
      editLogs.push(...newText.split('\n'));

      console.log('📝 Лог изменения (добавлен в textarea):', message);
    } else {
      // Если textarea ещё не создана, добавляем в массив
      editLogs.push(message);
      console.log('📝 Лог изменения (добавлен в массив):', message);
    }
  }
}

// Замороженный список скидок для работы с backup
// - null = используем текущие autoDiscounts (обычный режим)
// - array = используем замороженные скидки (режим backup - редактирование существующей операции)
// frozenDiscounts действует всё время редактирования backup и НЕ сбрасывается до нажатия "Купить"
export let frozenDiscounts = null;

// Функция для сброса замороженных скидок
// Вызывается после успешной отправки операции (нажатие "Купить")
export function resetFrozenDiscounts() {
  frozenDiscounts = null;
  console.log('❄️➡️🔓 Замороженные скидки сброшены, возврат к обычному режиму');
}

// Выбранные персональные купоны
// Массив ID купонов, которые пользователь выбрал для применения
export const selectedPersonalCoupons = [];

export const buildGroupKey = ({ templateSelector = '', giftId = '' }) => {
  // Для подарков используем templateSelector + giftId
  if (giftId) {
    return [templateSelector, giftId].join('||');
  }
  // Для всех остальных форм используем только templateSelector
  return templateSelector;
};

export function incrementGroupSeq() {
  groupSeq += 1;
  return groupSeq;
}

export function incrementEntrySeq() {
  entrySeq += 1;
  return entrySeq;
}

/**
 * Восстанавливает операции из backup данных
 * @param {Object} backupData - объект с fullData из JSON
 */
export function restoreFromBackup(backupData) {
  if (!backupData || !backupData.fullData) {
    throw new Error('Invalid backup data: missing fullData');
  }

  console.log('🔄 Начало восстановления из backup:', backupData);

  // Сохраняем текущий IS_ADMIN_TO_EDIT до загрузки ENVIRONMENT
  window.IS_ADMIN_TO_EDIT = window.IS_ADMIN_TO_EDIT;
  console.log('💾 IS_ADMIN_TO_EDIT сохранён:', window.IS_ADMIN_TO_EDIT);

  // Очищаем логи изменений
  editLogs.length = 0;

  // Восстанавливаем переменные окружения из backup (кроме исключений)
  if (backupData.environment) {
    console.log('🌍 Восстановление переменных окружения...');
    const env = backupData.environment;

    // Список переменных, которые НЕ восстанавливаем (оставляем текущие значения)
    const skipVariables = [
      'USERS_LIST',
      'ALLOWED_PARENTS',
      'BASE_URL',
      'BACKUP_DATA',
      'COMMENT_ID',
      'COMMENT_AUTHOR_ID',
      'COMMENT_AUTHOR_NAME',
      'CURRENT_BANK'
    ];

    // Восстанавливаем все остальные переменные
    Object.keys(env).forEach(key => {
      if (skipVariables.includes(key)) {
        console.log(`  ⏭️ Пропущена переменная ${key} (оставляем текущее значение)`);
        return;
      }

      let value = env[key];

      // Преобразуем строку "undefined" в реальный undefined
      if (value === 'undefined') {
        value = undefined;
      }

      window[key] = value;
      console.log(`  ✅ ${key} = ${value === undefined ? 'undefined' : JSON.stringify(value)}`);
    });
  }

  // Очищаем текущие операции
  submissionGroups.length = 0;

  // Очищаем выбранные купоны (будут восстановлены из backup)
  selectedPersonalCoupons.length = 0;

  // Собираем ID корректировок из backup для проверки дубликатов
  const backupAdjustmentIds = new Set();

  // Восстанавливаем каждую операцию из backup (КРОМЕ СКИДОК - они будут пересчитаны)
  backupData.fullData.forEach((operation) => {
    // Пропускаем скидки - они будут пересчитаны на основе исторических данных
    if (operation.type === 'discount') {
      console.log('🔄 Пропущена скидка из backup (будет пересчитана):', operation.title);
      return;
    }

    // Восстанавливаем персональные купоны
    if (operation.type === 'coupon') {
      console.log('🎫 Восстановление купонов из backup:', operation);
      // Извлекаем ID купонов из entries
      operation.entries.forEach((entry) => {
        const couponId = entry.data?.coupon_id;
        if (couponId) {
          // Проверяем, что купон всё ещё активен
          const activeCoupons = getActivePersonalCoupons();
          const coupon = activeCoupons.find(c => c.id === couponId);

          if (coupon) {
            // Добавляем купон в список выбранных (если ещё не добавлен)
            if (!selectedPersonalCoupons.includes(couponId)) {
              selectedPersonalCoupons.push(couponId);
              console.log(`✅ Купон "${coupon.title}" (ID: ${couponId}) восстановлен`);
            }
          } else {
            console.log(`⚠️ Купон с ID ${couponId} больше недоступен (истёк или удалён)`);
          }
        }
      });
      // Не создаём группу для купонов - они будут пересозданы через updatePersonalCoupons
      return;
    }

    // Создаём группу
    const group = {
      id: `group-${incrementGroupSeq()}`,
      templateSelector: operation.form_id ? `#${operation.form_id}` : '',
      title: operation.title,
      price: operation.price || 0,
      bonus: operation.bonus || 0,
      mode: operation.mode,
      kind: operation.kind,  // Восстанавливаем kind (income/expense)
      amountLabel: operation.amountLabel || 'Сумма',
      entries: []
    };

    // Восстанавливаем дополнительные поля для подарков
    if (operation.giftId) {
      group.giftId = operation.giftId;
    }
    if (operation.giftIcon) {
      group.giftIcon = operation.giftIcon;
    }

    // Пересоздаём amount на основе price, bonus и mode (ДО создания ключа!)
    if (operation.price !== undefined && operation.price !== null) {
      if (operation.bonus && operation.mode === 'price_per_item_w_bonus') {
        group.amount = `${operation.price} + x${operation.bonus}`;
      } else if (operation.bonus) {
        group.amount = `${operation.price} + x${operation.bonus}`;
      } else {
        group.amount = String(operation.price);
      }
    }

    // Пересоздаём правильный key через buildGroupKey (с amount!)
    group.key = buildGroupKey({
      templateSelector: group.templateSelector,
      title: group.title,
      amount: group.amount || '',
      amountLabel: group.amountLabel,
      kind: group.kind || '',
      giftId: group.giftId || ''
    });

    // Восстанавливаем специальные флаги для корректировок
    if (operation.type === 'adjustment') {
      group.isPriceAdjustment = true;
      // Собираем ID корректировок из backup
      operation.entries.forEach((entry) => {
        if (entry.key && typeof entry.key === 'string') {
          const adjustmentId = entry.key.split('_').pop();
          if (adjustmentId) backupAdjustmentIds.add(adjustmentId);
        }
      });
    }

    // Восстанавливаем записи
    operation.entries.forEach((entry) => {
      const restoredEntry = {
        id: `entry-${incrementEntrySeq()}`,
        // Для обычных операций template_id = form_id, для скидок/корректировок берём из entry
        template_id: entry.template_id || operation.form_id,
        key: entry.key || group.key,  // Используем entry.key или group.key как fallback
        data: entry.data || {},
        multiplier: entry.multiplier || 1
      };

      group.entries.push(restoredEntry);
    });

    console.log('✅ Восстановлена группа:', {
      id: group.id,
      key: group.key,
      title: group.title,
      entries: group.entries.length,
      firstEntry: group.entries[0]
    });

    submissionGroups.push(group);
  });

  // Фильтруем операции с получателями, у которых все получатели отсутствуют в USERS_LIST
  if (typeof window.USERS_LIST !== 'undefined' && Array.isArray(window.USERS_LIST)) {
    const validUserIds = new Set(window.USERS_LIST.map(u => String(u.id)));

    // Список form_id, которые требуют получателей
    const recipientForms = [
      'form-income-anketa', 'form-income-akcion', 'form-income-needchar',
      'form-income-episode-of', 'form-income-post-of', 'form-income-writer',
      'form-income-activist', 'form-income-topup', 'form-income-ams',
      'form-exp-transfer',
      'form-exp-bonus1d1', 'form-exp-bonus2d1', 'form-exp-bonus1w1', 'form-exp-bonus2w1',
      'form-exp-bonus1m1', 'form-exp-bonus2m1', 'form-exp-bonus1m3', 'form-exp-bonus2m3',
      'form-exp-mask', 'form-exp-clean',
      'form-gift-custom', 'form-gift-present',
      'form-icon-custom', 'form-icon-present',
      'form-badge-custom', 'form-badge-present',
      'form-bg-custom', 'form-bg-present'
    ];

    // Фильтруем операции
    for (let i = submissionGroups.length - 1; i >= 0; i--) {
      const group = submissionGroups[i];
      const formId = group.templateSelector?.replace('#', '');

      if (recipientForms.includes(formId)) {
        // Проверяем есть ли хоть один валидный получатель в любой entry
        let hasValidRecipient = false;

        for (const entry of group.entries) {
          const data = entry.data || {};
          const recipientKeys = Object.keys(data).filter(k => /^recipient_\d+$/.test(k));

          for (const key of recipientKeys) {
            const recipientId = String(data[key] || '').trim();
            if (recipientId && validUserIds.has(recipientId)) {
              hasValidRecipient = true;
              break;
            }
          }

          if (hasValidRecipient) break;
        }

        // Если нет ни одного валидного получателя, удаляем операцию
        if (!hasValidRecipient) {
          console.log(`🗑️ Удалена операция без валидных получателей: ${group.title} (${formId})`);
          submissionGroups.splice(i, 1);
        }
      }
    }
  }

  const restoredCount = submissionGroups.length;
  console.log(`✅ Восстановлено ${restoredCount} операций из backup`);
  console.log('📋 submissionGroups:', submissionGroups);

  // Применяем корректировки (вечные) и скидки (только те, что были активны на момент backup'а)
  let newAdjustmentsCount = 0;
  let historicalDiscountsCount = 0;

  // Применяем новые автоматические корректировки (только те, которых нет в backup)
  // Сначала получаем текущее количество корректировок из backup
  const adjustmentsFromBackup = submissionGroups.filter(g => g.isPriceAdjustment);

  // Временно удаляем группу корректировок, чтобы updateAutoPriceAdjustments создала новую
  const backupAdjustmentGroup = adjustmentsFromBackup.length > 0 ? adjustmentsFromBackup[0] : null;
  if (backupAdjustmentGroup) {
    const index = submissionGroups.indexOf(backupAdjustmentGroup);
    submissionGroups.splice(index, 1);
  }

  // Применяем ВСЕ актуальные корректировки
  updateAutoPriceAdjustments();

  const currentAdjustments = submissionGroups.filter(g => g.isPriceAdjustment);

  // Если корректировок не было в backup, считаем все новыми
  // Если были, считаем разницу
  newAdjustmentsCount = backupAdjustmentGroup ? (currentAdjustments.length > 0 ? 1 : 0) : currentAdjustments.length;

  // Применяем восстановленные персональные купоны (все 3 фазы)
  if (selectedPersonalCoupons.length > 0) {
    console.log(`🎫 Применяем восстановленные купоны (${selectedPersonalCoupons.length} шт.)`);
    updatePersonalCoupons('item');   // Фаза 1: item купоны (до корректировок уже применены)
    updatePersonalCoupons('fixed');  // Фаза 2: fixed купоны (после корректировок)
    updatePersonalCoupons('percent'); // Фаза 3: percent купоны (после корректировок и fixed)
    console.log(`✅ Купоны применены`);
  }

  // Получаем timestamp из backup'а для определения исторически активных скидок
  const backupTimestamp = backupData.timestamp;

  if (backupTimestamp) {
    console.log(`📅 Backup timestamp: ${backupTimestamp}`);

    // Находим ВСЕ скидки из autoDiscounts, которые были активны на момент backup'а
    frozenDiscounts = autoDiscounts.filter(discount => {
      // Проверяем, была ли скидка активна на момент backup'а
      return wasDiscountActiveAt(discount, backupTimestamp);
    });

    console.log(`❄️ Заморожено ${frozenDiscounts.length} скидок, активных на момент backup'а:`, frozenDiscounts.map(d => d.id));

    // Применяем все исторически активные скидки
    updateAutoDiscounts();

    const appliedDiscounts = submissionGroups.filter(g => g.isDiscount);
    historicalDiscountsCount = appliedDiscounts.length;

    console.log(`✅ Применено ${historicalDiscountsCount} исторических скидок`);
  } else {
    console.warn('⚠️ Backup не содержит timestamp, скидки будут применены из текущих правил');
    frozenDiscounts = null;
  }

  if (newAdjustmentsCount > 0 || historicalDiscountsCount > 0) {
    console.log(`Применено правил: новых корректировок - ${newAdjustmentsCount}, исторических скидок - ${historicalDiscountsCount}`);
  }
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
/**
 * Проверяет, началась ли уже скидка (по московскому времени)
 * @param {string} startDate - дата начала в формате 'YYYY-MM-DD'
 * @returns {boolean} - true если скидка уже началась (текущее московское время >= startDate 00:00:00)
 */
function isDiscountStarted(startDate) {
  if (!startDate) return false;

  // Получаем текущее время
  const now = new Date();

  // Добавляем время начала дня (00:00:00) к дате
  const startDateString = `${startDate}T00:00:00`;

  // Парсим дату начала (предполагаем, что она указана в московском времени)
  const startDateObj = new Date(startDateString);

  // Московское время = UTC+3
  // Конвертируем текущее время в московское
  const moscowOffset = 3 * 60; // 3 часа в минутах
  const localOffset = now.getTimezoneOffset(); // смещение локального времени от UTC в минутах
  const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60 * 1000);

  return moscowTime >= startDateObj;
}

/**
 * Проверяет, истекла ли скидка (по московскому времени)
 * @param {string} expiresAt - дата окончания в формате 'YYYY-MM-DD'
 * @returns {boolean} - true если скидка уже истекла (текущее московское время >= expiresAt 23:59:59)
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

/**
 * Проверяет, была ли скидка активна на указанный момент времени
 * @param {Object} discount - объект скидки с полями startDate и expiresAt
 * @param {string} timestamp - ISO 8601 timestamp (UTC)
 * @returns {boolean} - true если скидка была активна на указанный момент
 */
function wasDiscountActiveAt(discount, timestamp) {
  if (!timestamp) return false;

  // timestamp в секундах (Unix timestamp), конвертируем в миллисекунды
  const ts = new Date(timestamp * 1000);

  // Проверяем startDate
  if (discount.startDate) {
    const startDateString = `${discount.startDate}T00:00:00`;
    const startDateObj = new Date(startDateString);

    // Конвертируем timestamp в московское время для сравнения
    const moscowOffset = 3 * 60; // 3 часа в минутах
    const localOffset = ts.getTimezoneOffset();
    const tsMoscow = new Date(ts.getTime() + (moscowOffset + localOffset) * 60 * 1000);

    if (tsMoscow < startDateObj) return false;
  }

  // Проверяем expiresAt
  if (discount.expiresAt) {
    const expiryDateString = `${discount.expiresAt}T23:59:59`;
    const expiryDate = new Date(expiryDateString);

    // Конвертируем timestamp в московское время для сравнения
    const moscowOffset = 3 * 60; // 3 часа в минутах
    const localOffset = ts.getTimezoneOffset();
    const tsMoscow = new Date(ts.getTime() + (moscowOffset + localOffset) * 60 * 1000);

    if (tsMoscow > expiryDate) return false;
  }

  return true;
}

/**
 * Вычисляет скидку для одного правила
 * @param {Object} rule - правило скидки
 * @param {Array} groups - массив submissionGroups
 * @returns {Object|null} - объект с discount, calculation, totalItems или null если скидка не применима
 */
function calculateDiscountForRule(rule, groups) {
  let { id, title, forms, type, discountValue, condition, startDate, expiresAt } = rule;

  // Для процентной скидки ограничиваем значение до 100
  if (type === 'percent' && discountValue > 100) {
    discountValue = 100;
  }

  // Определяем, какие группы подходят под это правило
  const matchingGroups = groups.filter(g => {
    // Пропускаем скидки и корректировки
    if (g.isDiscount || g.isPriceAdjustment) return false;
    // Для 'all' берём только расходы (kind === 'expense')
    if (forms === 'all') return g.kind === 'expense';
    return forms.includes(g.templateSelector);
  });

  if (matchingGroups.length === 0) return null;

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
  if (!conditionMet) return null;
  if (totalItems === 0 && type !== 'percent') return null;

  // Вычисляем сумму операций для этих форм (для проверки лимита скидки)
  let operationTotal = 0;
  matchingGroups.forEach(group => {
    const groupCost = calculateGroupCost(group);
    operationTotal += Math.abs(groupCost);
  });

  // Вычитаем персональные купоны для этих форм (если есть)
  const couponGroup = groups.find(g => g.isPersonalCoupon);
  if (couponGroup) {
    couponGroup.entries.forEach(entry => {
      const couponForm = entry.data?.form;
      if (matchingGroups.some(g => g.templateSelector === toSelector(couponForm))) {
        const discountAmount = Number(entry.data?.discount_amount) || 0;
        operationTotal -= discountAmount;
      }
    });
  }

  // Вычитаем корректировки для этих форм (если есть)
  const adjustmentGroup = groups.find(g => g.isPriceAdjustment);
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

  if (discount <= 0) return null;

  return { discount, calculation, totalItems };
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
  let accumulatedDiscounts = 0; // Накопленная сумма предыдущих автоскидок

  // Используем frozenDiscounts если он установлен (режим backup), иначе autoDiscounts
  const discountsToApply = frozenDiscounts !== null ? frozenDiscounts : autoDiscounts;

  console.log(`🔍 Применяем скидки из ${frozenDiscounts !== null ? 'замороженного списка' : 'текущих правил'} (${discountsToApply.length} правил)`);

  // Разделяем правила на конкретные формы и "все расходы"
  const specificFormRules = discountsToApply.filter(rule => {
    if (!rule.startDate || isDiscountExpired(rule.expiresAt) || !isDiscountStarted(rule.startDate)) {
      return false;
    }
    return rule.forms !== 'all';
  });

  const allFormsRules = discountsToApply.filter(rule => {
    if (!rule.startDate || isDiscountExpired(rule.expiresAt) || !isDiscountStarted(rule.startDate)) {
      return false;
    }
    return rule.forms === 'all';
  });

  // Сначала применяем скидки на конкретные формы
  const allRulesToApply = [...specificFormRules, ...allFormsRules];

  console.log(`📋 Порядок применения скидок:`);
  allRulesToApply.forEach((rule, index) => {
    console.log(`  ${index + 1}. "${rule.title}" (forms: ${rule.forms === 'all' ? 'all' : 'specific'})`);
  });

  // Проходим по всем правилам скидок в правильном порядке
  allRulesToApply.forEach(rule => {
    let { id, title, forms, type, discountValue, condition, startDate, expiresAt } = rule;

    console.log(`📊 Применяем скидку: "${title}" (forms: ${forms === 'all' ? 'all' : forms.join(', ')}), накоплено: ${accumulatedDiscounts}`);

    // Для процентной скидки ограничиваем значение до 100
    if (type === 'percent' && discountValue > 100) {
      discountValue = 100;
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

    // Вычитаем персональные купоны для этих форм (если есть)
    const couponGroup = submissionGroups.find(g => g.isPersonalCoupon);
    if (couponGroup) {
      couponGroup.entries.forEach(entry => {
        const couponForm = entry.data?.form;
        if (matchingGroups.some(g => g.templateSelector === toSelector(couponForm))) {
          const discountAmount = Number(entry.data?.discount_amount) || 0;
          operationTotal -= discountAmount;
        }
      });
    }

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

    // Вычитаем накопленные автоскидки (для последовательного применения)
    operationTotal -= accumulatedDiscounts;

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
      accumulatedDiscounts += discount; // Накапливаем сумму для следующих скидок

      entries.push({
        id: incrementEntrySeq(),
        template_id: `auto-discount-${id}`,
        data: {
          discount_id: id,
          discount_title: title,
          discount_type: type,
          total_items: totalItems,
          discount_amount: discount,
          calculation,
          startDate: startDate,           // Дата начала действия скидки
          expiresAt: expiresAt || null    // Дата окончания (или null если бессрочно)
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

    // Подсчитываем эффективное количество элементов (с учётом item купонов)
    const formId = form.replace('#', '');
    let totalItems = countEffectiveItemsForForm(formId);

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

// ============================================================================
// ПЕРСОНАЛЬНЫЕ КУПОНЫ
// ============================================================================

/**
 * Получает активные персональные купоны из window.PERSONAL_DISCOUNTS
 * Фильтрует по expiresAt (купоны, которые еще не истекли или без даты истечения)
 * @returns {Array} - массив активных купонов
 */
export function getActivePersonalCoupons() {
  if (typeof window.PERSONAL_DISCOUNTS === 'undefined' || !Array.isArray(window.PERSONAL_DISCOUNTS)) {
    return [];
  }

  return window.PERSONAL_DISCOUNTS.filter(coupon => {
    // Если нет expiresAt, купон активен
    if (!coupon.expiresAt) return true;

    // Проверяем, не истек ли купон (аналогично isDiscountExpired)
    const now = new Date();
    const expiryDateString = `${coupon.expiresAt}T23:59:59`;
    const expiryDate = new Date(expiryDateString);

    // Московское время = UTC+3
    const moscowOffset = 3 * 60;
    const localOffset = now.getTimezoneOffset();
    const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60 * 1000);

    return moscowTime < expiryDate; // Купон активен если еще не истек
  });
}

/**
 * Подсчитывает количество товаров/получателей для формы
 * @param {string} formId - ID формы (без #)
 * @returns {number} - количество
 */
export function countItemsForForm(formId) {
  const formSelector = toSelector(formId);
  let totalItems = 0;

  submissionGroups.forEach(group => {
    if (group.templateSelector === formSelector && !group.isDiscount && !group.isPriceAdjustment && !group.isPersonalCoupon) {
      group.entries.forEach(entry => {
        const dataObj = entry.data || {};

        // Подсчёт получателей
        const recipientKeys = Object.keys(dataObj).filter(k => REGEX.RECIPIENT.test(k));
        const recipientCount = recipientKeys.filter(key => String(dataObj[key] || '').trim()).length;

        // Подсчёт через quantity
        const quantityKeys = Object.keys(dataObj).filter(k => /^quantity_\d+$/.test(k));
        let totalQuantity = 0;
        quantityKeys.forEach(key => {
          const idx = key.match(/^quantity_(\d+)$/)[1];
          const recipientKey = `recipient_${idx}`;
          if (String(dataObj[recipientKey] || '').trim()) {
            totalQuantity += Number(dataObj[key]) || 0;
          }
        });

        if (totalQuantity === 0 && dataObj.quantity) {
          totalQuantity = Number(dataObj.quantity) || 0;
        }

        const items = totalQuantity > 0 ? totalQuantity : recipientCount;
        const multiplier = Number(entry.multiplier) || 1;
        totalItems += items * multiplier;
      });
    }
  });

  return totalItems;
}

/**
 * Получает стоимость операций для формы (до применения купонов)
 * @param {string} formId - ID формы (без #)
 * @returns {number} - стоимость
 */
export function getCostForForm(formId) {
  const formSelector = toSelector(formId);
  let totalCost = 0;

  submissionGroups.forEach(group => {
    if (group.templateSelector === formSelector && !group.isDiscount && !group.isPriceAdjustment && !group.isPersonalCoupon) {
      totalCost += calculateGroupCost(group);
    }
  });

  return totalCost;
}

/**
 * Подсчитывает эффективное количество товаров для формы с учётом item купонов
 * @param {string} formId - ID формы (без #)
 * @returns {number} - количество товаров после вычета купонов типа item
 */
export function countEffectiveItemsForForm(formId) {
  let totalItems = countItemsForForm(formId);

  // Вычитаем товары, использованные item купонами
  const activeCoupons = getActivePersonalCoupons();
  const selectedCoupons = activeCoupons.filter(c => selectedPersonalCoupons.includes(c.id));
  const itemCoupons = selectedCoupons.filter(c => c.type === 'item' && c.form === formId);

  itemCoupons.forEach(coupon => {
    totalItems -= coupon.value;
  });

  return Math.max(0, totalItems);
}

/**
 * Применяет персональные купоны к операциям
 * Разделено на 3 фазы:
 * - Фаза 1 (item): вызывается ДО корректировок
 * - Фаза 2 (fixed): вызывается ПОСЛЕ корректировок, ДО percent
 * - Фаза 3 (percent): вызывается ПОСЛЕ корректировок и fixed
 *
 * @param {string} phase - 'item', 'fixed' или 'percent'
 */
export function updatePersonalCoupons(phase = 'item') {
  // Находим существующую группу купонов
  const existingCouponIndex = submissionGroups.findIndex(g => g.isPersonalCoupon);

  // Если нет выбранных купонов, удаляем группу (если она есть) и выходим
  if (selectedPersonalCoupons.length === 0) {
    if (existingCouponIndex !== -1) {
      submissionGroups.splice(existingCouponIndex, 1);
      console.log('🎫 Группа купонов удалена (нет выбранных купонов)');
    }
    return;
  }

  // Получаем активные купоны
  const activeCoupons = getActivePersonalCoupons();

  // Фильтруем только выбранные
  const selectedCoupons = activeCoupons.filter(c => selectedPersonalCoupons.includes(c.id));

  if (selectedCoupons.length === 0) {
    if (existingCouponIndex !== -1) {
      submissionGroups.splice(existingCouponIndex, 1);
      console.log('🎫 Группа купонов удалена (нет валидных выбранных купонов)');
    }
    return;
  }
  let entries = [];
  let totalDiscount = 0;

  // Если группа существует, берем её entries
  if (existingCouponIndex !== -1) {
    const existingGroup = submissionGroups[existingCouponIndex];
    entries = [...existingGroup.entries];
    totalDiscount = existingGroup.price || 0;
  }

  if (phase === 'item') {
    // ФАЗА 1: item купоны (ДО корректировок)

    // Удаляем старые entries для item (если группа уже существовала), сохраняем fixed и percent
    entries = entries.filter(e => e.data.coupon_type !== 'item');
    totalDiscount = entries.reduce((sum, e) => sum + e.data.discount_amount, 0);

    // Временное хранилище для отслеживания оставшихся товаров по формам
    const remainingItems = {};

    // Применяем купоны типа "item"
    const itemCoupons = selectedCoupons.filter(c => c.type === 'item');
    itemCoupons.forEach(coupon => {
      const formId = coupon.form;
      const itemCount = countItemsForForm(formId);

      // Инициализируем remainingItems для формы
      if (!remainingItems[formId]) {
        remainingItems[formId] = itemCount;
      }

      if (remainingItems[formId] >= coupon.value) {
        // Вычисляем цену купона (price за каждые value товаров)
        // Находим группу для получения price
        const formSelector = toSelector(formId);
        const formGroup = submissionGroups.find(g => g.templateSelector === formSelector && !g.isDiscount && !g.isPriceAdjustment && !g.isPersonalCoupon);

        if (formGroup) {
          const price = Number(formGroup.price) || 0;
          const discount = price * coupon.value;

          remainingItems[formId] -= coupon.value;
          totalDiscount += discount;

          entries.push({
            id: `entry-${incrementEntrySeq()}`,
            template_id: `personal-coupon-${coupon.id}`,
            data: {
              coupon_id: coupon.id,
              coupon_title: coupon.title,
              coupon_type: coupon.type,
              form: formId,
              discount_amount: discount,
              calculation: `${price} × ${coupon.value}`
            },
            multiplier: 1
          });
        }
      }
    });

  } else if (phase === 'fixed') {
    // ФАЗА 2: fixed купоны (ПОСЛЕ корректировок, ДО percent)

    // Удаляем старые entries для fixed (если группа уже существовала), сохраняем item и percent
    entries = entries.filter(e => e.data.coupon_type !== 'fixed');
    totalDiscount = entries.reduce((sum, e) => sum + e.data.discount_amount, 0);

    // Временное хранилище для отслеживания оставшейся стоимости по формам (после item купонов и корректировок)
    const remainingCost = {};

    // Применяем купоны типа "fixed" (фиксированная сумма)
    const fixedCoupons = selectedCoupons.filter(c => c.type === 'fixed');
    fixedCoupons.forEach(coupon => {
      const formId = coupon.form;
      const formSelector = toSelector(formId);
      let formCost = getCostForForm(formId);

      console.log(`🎫 FIXED купон "${coupon.title}" (value: ${coupon.value})`);
      console.log(`   → Базовая стоимость формы: ${formCost}`);

      // Инициализируем remainingCost для формы
      if (!remainingCost[formId]) {
        // Вычитаем примененные item купоны
        const itemDiscountForForm = entries
          .filter(e => e.data.form === formId && e.data.coupon_type === 'item')
          .reduce((sum, e) => sum + e.data.discount_amount, 0);

        console.log(`   → Item скидки для формы: ${itemDiscountForForm}`);
        formCost -= itemDiscountForForm;

        // Вычитаем корректировки для этой формы
        const adjustmentGroup = submissionGroups.find(g => g.isPriceAdjustment);
        if (adjustmentGroup) {
          adjustmentGroup.entries.forEach(entry => {
            const adjustmentForm = entry.data?.form;
            if (adjustmentForm === formSelector) {
              const adjustmentAmount = Number(entry.data?.adjustment_amount) || 0;
              console.log(`   → Корректировка для формы: ${adjustmentAmount}`);
              formCost -= adjustmentAmount;
            }
          });
        }

        console.log(`   → Оставшаяся стоимость после вычетов: ${formCost}`);
        remainingCost[formId] = formCost;
      } else {
        console.log(`   → Используем сохранённую оставшуюся стоимость: ${remainingCost[formId]}`);
      }

      if (remainingCost[formId] > 0) {
        // Применяем скидку, но не больше оставшейся стоимости
        const discount = Math.min(coupon.value, remainingCost[formId]);

        console.log(`   → Применяем скидку: ${discount} (min из ${coupon.value} и ${remainingCost[formId]})`);

        remainingCost[formId] -= discount;
        totalDiscount += discount;

        entries.push({
          id: `entry-${incrementEntrySeq()}`,
          template_id: `personal-coupon-${coupon.id}`,
          data: {
            coupon_id: coupon.id,
            coupon_title: coupon.title,
            coupon_type: coupon.type,
            form: formId,
            discount_amount: discount,
            calculation: String(discount)
          },
          multiplier: 1
        });
      }
    });

  } else if (phase === 'percent') {
    // ФАЗА 2: percent купоны (ПОСЛЕ корректировок)

    // Удаляем старые entries для percent (если они были)
    entries = entries.filter(e => e.data.coupon_type !== 'percent');
    totalDiscount = entries.reduce((sum, e) => sum + e.data.discount_amount, 0);

    // Применяем купоны типа "percent" (процентная скидка)
    const percentCoupons = selectedCoupons.filter(c => c.type === 'percent');
    percentCoupons.forEach(coupon => {
      const formId = coupon.form;
      const formSelector = toSelector(formId);

      // Получаем стоимость формы
      let formCost = getCostForForm(formId);

      // Вычитаем примененные item и fixed купоны
      const itemAndFixedDiscounts = entries
        .filter(e => e.data.form === formId && (e.data.coupon_type === 'item' || e.data.coupon_type === 'fixed'))
        .reduce((sum, e) => sum + e.data.discount_amount, 0);

      formCost -= itemAndFixedDiscounts;

      // Вычитаем корректировки для этой формы
      const adjustmentGroup = submissionGroups.find(g => g.isPriceAdjustment);
      if (adjustmentGroup) {
        adjustmentGroup.entries.forEach(entry => {
          const adjustmentForm = entry.data?.form;
          if (adjustmentForm === formSelector) {
            const adjustmentAmount = Number(entry.data?.adjustment_amount) || 0;
            formCost -= adjustmentAmount;
          }
        });
      }

      if (formCost > 0) {
        let percentValue = coupon.value;
        if (percentValue > 100) percentValue = 100;

        const discount = Math.ceil(formCost * (percentValue / 100));

        totalDiscount += discount;

        entries.push({
          id: `entry-${incrementEntrySeq()}`,
          template_id: `personal-coupon-${coupon.id}`,
          data: {
            coupon_id: coupon.id,
            coupon_title: coupon.title,
            coupon_type: coupon.type,
            form: formId,
            discount_amount: discount,
            calculation: `${formatNumber(formCost)} × ${percentValue}%`
          },
          multiplier: 1
        });
      }
    });
  }

  // Создаем или обновляем группу с купонами
  if (entries.length > 0) {
    if (existingCouponIndex !== -1) {
      // Обновляем существующую группу
      const group = submissionGroups[existingCouponIndex];
      group.price = totalDiscount;
      group.amount = totalDiscount;
      group.amountLabel = 'Скидка';
      group.entries = entries;
      console.log(`🎫 Обновлена группа купонов (${phase}):`, entries.length, 'entries, totalDiscount:', totalDiscount);
      console.log('   Entries:', entries.map(e => `${e.data.coupon_title} (${e.data.coupon_type}): ${e.data.discount_amount}`));
    } else {
      // Создаем новую группу
      const couponGroup = {
        id: `group-${incrementGroupSeq()}`,
        key: FORM_PERSONAL_COUPON,
        templateSelector: FORM_PERSONAL_COUPON,
        title: TEXT_MESSAGES.PERSONAL_COUPONS_TITLE,
        price: totalDiscount,
        amount: totalDiscount,
        bonus: 0,
        amountLabel: 'Скидка',
        kind: 'income',
        entries,
        isPersonalCoupon: true
      };

      submissionGroups.push(couponGroup);
      console.log(`🎫 Создана группа купонов (${phase}):`, entries.length, 'entries, totalDiscount:', totalDiscount);
      console.log('   Entries:', entries.map(e => `${e.data.coupon_title} (${e.data.coupon_type}): ${e.data.discount_amount}`));
    }
  } else if (existingCouponIndex !== -1) {
    // Если купонов нет, удаляем группу
    submissionGroups.splice(existingCouponIndex, 1);
    console.log('🎫 Группа купонов удалена (нет активных купонов)');
  }
}

/**
 * Проверяет и удаляет невалидные купоны из selectedPersonalCoupons
 * Купон становится невалидным, если в корзине больше нет операций для его формы
 * или если не выполняются условия применения (недостаточно товаров/суммы)
 */
export function cleanupInvalidCoupons() {
  if (selectedPersonalCoupons.length === 0) return;

  const activeCoupons = getActivePersonalCoupons();
  const invalidCouponIds = [];

  // Группируем купоны по формам для проверки с учетом порядка применения
  const couponsByForm = {};
  selectedPersonalCoupons.forEach(couponId => {
    const coupon = activeCoupons.find(c => c.id === couponId);
    if (!coupon) {
      invalidCouponIds.push(couponId);
      return;
    }

    if (!couponsByForm[coupon.form]) {
      couponsByForm[coupon.form] = {
        item: [],
        fixed: [],
        percent: []
      };
    }
    couponsByForm[coupon.form][coupon.type].push(coupon);
  });

  // Проверяем купоны для каждой формы в правильном порядке
  Object.keys(couponsByForm).forEach(formId => {
    const coupons = couponsByForm[formId];
    let remainingCost = getCostForForm(formId);

    // 1. Проверяем и применяем item купоны
    coupons.item.forEach(coupon => {
      const itemsInCart = countItemsForForm(formId);
      if (itemsInCart < coupon.value) {
        invalidCouponIds.push(coupon.id);
      } else {
        // Вычитаем стоимость item купона из остатка
        const formSelector = '#' + formId;
        const formGroup = submissionGroups.find(g => g.templateSelector === formSelector && !g.isDiscount && !g.isPriceAdjustment && !g.isPersonalCoupon);
        if (formGroup) {
          const price = Number(formGroup.price) || 0;
          remainingCost -= price * coupon.value;
        }
      }
    });

    // Вычитаем корректировки
    const formSelector = '#' + formId;
    const adjustmentGroup = submissionGroups.find(g => g.isPriceAdjustment);
    if (adjustmentGroup) {
      adjustmentGroup.entries.forEach(entry => {
        const adjustmentForm = entry.data?.form;
        if (adjustmentForm === formSelector) {
          const adjustmentAmount = Number(entry.data?.adjustment_amount) || 0;
          remainingCost -= adjustmentAmount;
        }
      });
    }

    // 2. Проверяем fixed купоны (каждый последующий уменьшает остаток)
    coupons.fixed.forEach(coupon => {
      if (remainingCost <= 0) {
        invalidCouponIds.push(coupon.id);
      } else {
        // Вычитаем скидку этого купона из остатка
        const discount = Math.min(coupon.value, remainingCost);
        remainingCost -= discount;
      }
    });

    // 3. Проверяем percent купоны
    coupons.percent.forEach(coupon => {
      if (remainingCost <= 0) {
        invalidCouponIds.push(coupon.id);
      } else {
        let percentValue = coupon.value;
        if (percentValue > 100) percentValue = 100;
        const discount = Math.ceil(remainingCost * (percentValue / 100));
        remainingCost -= discount;
      }
    });
  });

  // Удаляем невалидные купоны
  if (invalidCouponIds.length > 0) {
    // Удаляем дубликаты
    const uniqueInvalidIds = [...new Set(invalidCouponIds)];
    uniqueInvalidIds.forEach(couponId => {
      const index = selectedPersonalCoupons.indexOf(couponId);
      if (index > -1) {
        selectedPersonalCoupons.splice(index, 1);

        // Находим название купона для уведомления
        const coupon = activeCoupons.find(c => c.id === couponId);
        const couponTitle = coupon ? coupon.title : `ID: ${couponId}`;

        console.log(`🎫❌ Купон ${couponId} автоматически снят (условия не выполняются)`);

        // Показываем уведомление пользователю
        showNotification(
          `Купон "${couponTitle}" автоматически снят, т.к. условия для его применения больше не выполняются`,
          4000 // 4 секунды
        );
      }
    });
  }
}
