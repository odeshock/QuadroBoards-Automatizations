// ============================================================================
// giftForms.js — Подарки и оформление (иконки, плашки, фоны)
// ============================================================================

import {
  COUNTER_POLL_INTERVAL_MS,
  GIFT_TIMEOUT_MS
} from '../config.js';

import {
  formatNumber,
  parseNumericAmount
} from '../services.js';

import {
  TEXT_MESSAGES,
  GIFT_AND_DESIGN_FORMS
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

/**
 * Обёртка над универсальной функцией для совместимости с gift forms
 * @deprecated Используйте renderRecipientPickerUniversal напрямую
 */
function renderGiftPickerUniversal({
  users,
  modalFields,
  btnSubmit,
  data,
  modalAmount,
  giftId,
  giftIcon,
  price,
  updateTotalCost,
  showPreview = false,
  includeGiftDataField = false,
  title = null
}) {
  return renderRecipientPickerUniversal({
    users,
    modalFields,
    btnSubmit,
    data,
    modalAmount,

    showQuantityField: false,
    showGiftDataField: includeGiftDataField,
    showPreview: showPreview,
    allowDuplicateRecipients: true,
    allowRemoveFirstGroup: true,
    allowEmptySubmit: true,
    prefillCurrentUser: false,
    hideFieldsForCurrentUser: false,

    giftData: { id: giftId, icon: giftIcon, title: title },
    priceData: null,

    updateCostCallback: updateTotalCost,
    syncCallback: null
  });
}

export function setupCustomGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, price, title }) {
  // 1) Очищаем модальное окно
  clearModalFields(modalFields);

  // 2) Показываем сообщение ожидания
  showWaitMessage(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  // 3) Функция для отображения ошибки
  const fail = () => {
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    disableSubmitButton(btnSubmit);
  };

  
  const updateTotalCost = (giftGroups) => {
    const totalCount = giftGroups.length;
    const itemPrice = Number.parseInt(price, 10) || 100;

    if (modalAmount) {
      // Всегда показываем формулу, даже когда totalCount === 0 (будет price × 0 = 0)
      updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(itemPrice), bonus: '0' } }, { items: totalCount });
    }

    const totalCost = itemPrice * totalCount;
    return { totalCount, totalCost };
  };

  const renderCustomGiftPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    return renderGiftPickerUniversal({
      users,
      modalFields,
      btnSubmit,
      data,
      modalAmount,
      giftId,
      giftIcon,
      price,
      updateTotalCost,
      showPreview: false,
      includeGiftDataField: true,
      title
    });
  };

  // 4) Ожидаем USERS_LIST и создаём gift picker
  counterWatcher = waitForGlobalArray('USERS_LIST', timeoutMs, renderCustomGiftPicker, fail);
  return counterWatcher;
}

// ============================================================================
// SETUP GIFT FLOW - Подарки
// ============================================================================

export function setupGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, price, title }) {
  // 1) Очищаем модальное окно
  clearModalFields(modalFields);

  // 2) Показываем сообщение ожидания
  showWaitMessage(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  // 3) Предзагружаем иконку и показываем превью только когда она загрузится
  if (giftIcon && title) {
    // Создаём временный контейнер для парсинга HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = giftIcon;
    const imgElement = tempDiv.querySelector('img');

    const showPreview = (preloadedImg = null) => {
      const preview = document.createElement('div');
      preview.className = 'preview';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'icon-prw';

      // Если есть предзагруженное изображение, используем его
      if (preloadedImg) {
        iconSpan.appendChild(preloadedImg);
      } else {
        iconSpan.innerHTML = giftIcon;
      }

      const titleSpan = document.createElement('span');
      titleSpan.style.fontWeight = '600';
      titleSpan.textContent = title;

      preview.append(iconSpan, titleSpan);
      // Вставляем в самое начало
      modalFields.insertBefore(preview, modalFields.firstChild);
    };

    if (imgElement && imgElement.src) {
      // Есть img - предзагружаем
      const preloadImg = new Image();
      // Копируем все атрибуты из оригинального img
      Array.from(imgElement.attributes).forEach(attr => {
        preloadImg.setAttribute(attr.name, attr.value);
      });
      preloadImg.onload = () => showPreview(preloadImg);
      preloadImg.onerror = () => showPreview(); // Показываем без картинки если загрузка не удалась
      preloadImg.src = imgElement.src;
    } else {
      // Нет img (например, эмодзи) - показываем сразу
      showPreview();
    }
  }

  // 3) Функция для отображения ошибки
  const fail = () => {
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    disableSubmitButton(btnSubmit);
  };

  // === 3) Функция подсчета стоимости подарков (простое умножение цена × количество) ===
  const updateTotalCost = (giftGroups) => {
    const totalCount = giftGroups.length;
    const itemPrice = Number.parseInt(price, 10) || 60;

    if (modalAmount) {
      // Всегда показываем формулу, даже когда totalCount === 0 (будет price × 0 = 0)
      updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(itemPrice), bonus: '0' } }, { items: totalCount });
    }

    const totalCost = itemPrice * totalCount;
    return { totalCount, totalCost };
  };

  // === 4) Когда USERS_LIST готов — рисуем интерфейс выбора получателей ===
  const renderGiftPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    return renderGiftPickerUniversal({
      users,
      modalFields,
      btnSubmit,
      data,
      modalAmount,
      giftId,
      giftIcon,
      price,
      updateTotalCost,
      showPreview: false, // Превью уже показано выше
      includeGiftDataField: false,
      title
    });
  };

  // === 5) Ждём USERS_LIST с таймаутом ===
  counterWatcher = waitForGlobalArray('USERS_LIST', timeoutMs, renderGiftPicker, fail);
  return counterWatcher;
}

// ============================================================================
// HANDLER
// ============================================================================

export function handleGiftsAndDesignForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, config }) {
  if (!GIFT_AND_DESIGN_FORMS.map(f => f.replace("#", "")).includes(template.id)) {
    return { handled: false, counterWatcher };
  }

  const isCustom = template.id.includes('custom');
  const timeoutMs = config.timeoutMs || GIFT_TIMEOUT_MS;

  counterWatcher = isCustom
    ? setupCustomGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId: config.giftId, giftIcon: config.giftIcon, price: config.price, title: config.title })
    : setupGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId: config.giftId, giftIcon: config.giftIcon, price: config.price, title: config.title });

  return { handled: true, counterWatcher };
}
