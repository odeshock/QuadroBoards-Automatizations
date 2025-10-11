// ============================================================================
// expenseForms.js — Формы расходов (бонусы, маска, спасительный жилет)
// ============================================================================

import {
  AMS_TIMEOUT_MS
} from '../config.js';

import {
  formatNumber,
  parseNumericAmount
} from '../services.js';

import {
  TEXT_MESSAGES,
  SPECIAL_EXPENSE_FORMS,
  toSelector
} from '../constants.js';

import {
  updateModalAmount
} from '../results.js';

import {
  showWaitMessage,
  showErrorMessage,
  disableSubmitButton,
  clearModalFields,
  waitForGlobalArray
} from './helpers.js';

import { renderRecipientPickerUniversal } from './recipientPicker.js';

export function setupBonusMaskCleanFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, basePrice }) {
  // 1) Очищаем модальное окно
  clearModalFields(modalFields);

  // 2) Добавляем disclaimer
  const disclaimer = document.createElement('div');
  disclaimer.className = 'info';
  disclaimer.textContent = TEXT_MESSAGES.PLAYER_CHOICE_INFO;
  modalFields.insertBefore(disclaimer, modalFields.firstChild);

  // 3) Показываем сообщение ожидания
  showWaitMessage(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  // 4) Функция для отображения ошибки
  const fail = () => {
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    disableSubmitButton(btnSubmit);
  };

  const renderPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    const price = Number.parseInt(basePrice, 10) || 0;

    renderRecipientPickerUniversal({
      users,
      modalFields,
      btnSubmit,
      data,
      modalAmount,

      showQuantityField: true,
      showGiftDataField: false,
      showPreview: false,
      allowDuplicateRecipients: false,

      giftData: null,
      priceData: { basePrice: price },

      updateCostCallback: null,
      syncCallback: () => {
        // Дополнительная логика для обновления суммы через updateModalAmount
        const itemGroups = Array.from(modalFields.querySelectorAll('[data-gift-group]'))
          .map(el => {
            const recipientId = el.querySelector('[data-gift-recipient]')?.dataset?.selectedId || '';
            const qtyInput = el.querySelector('input[type="number"]');
            return {
              recipientId,
              quantityInput: qtyInput
            };
          });

        let totalQuantity = 0;
        itemGroups.forEach(group => {
          if (!group.recipientId) return;
          const qty = Number(group.quantityInput?.value) || 0;
          if (qty > 0) totalQuantity += qty;
        });

        if (modalAmount) {
          if (totalQuantity > 0) {
            updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(price), bonus: '0' } }, { items: totalQuantity });
          } else {
            modalAmount.textContent = formatNumber(price);
          }
        }
      }
    });
  };

  // === 3) Ждём USERS_LIST ===
  counterWatcher = waitForGlobalArray('USERS_LIST', timeoutMs, renderPicker, fail);
  return counterWatcher;
}

// ============================================================================
// HANDLER
// ============================================================================

export function handleBonusMaskCleanForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, price }) {
  if (!SPECIAL_EXPENSE_FORMS.includes(toSelector(template.id))) return { handled: false, counterWatcher };

  counterWatcher = setupBonusMaskCleanFlow({
    modalFields,
    btnSubmit,
    counterWatcher,
    timeoutMs: AMS_TIMEOUT_MS,
    data,
    modalAmount,
    basePrice: price
  });
  return { handled: true, counterWatcher };
}
