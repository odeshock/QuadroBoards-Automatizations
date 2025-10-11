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
  hideWaitMessage,
  showErrorMessage,
  disableSubmitButton,
  clearModalFields,
  waitForGlobalArray
} from './helpers.js';

/**
 * Универсальная функция для рендеринга gift picker
 * @param {Object} config - Конфигурация
 * @param {Array} config.users - Список пользователей
 * @param {HTMLElement} config.modalFields - Контейнер полей
 * @param {HTMLElement} config.btnSubmit - Кнопка сохранения
 * @param {Object} config.data - Данные для prefill
 * @param {HTMLElement} config.modalAmount - Элемент для отображения суммы
 * @param {string} config.giftId - ID подарка
 * @param {string} config.giftIcon - Иконка подарка
 * @param {string} config.price - Цена подарка
 * @param {Function} config.updateTotalCost - Функция пересчета стоимости
 * @param {boolean} config.showPreview - Показывать preview с иконкой
 * @param {boolean} config.includeGiftDataField - Включить поле "Данные для подарка"
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
  includeGiftDataField = false
}) {
  hideWaitMessage(modalFields);

  // Превью подарка (если нужно)
  if (showPreview) {
    const preview = document.createElement('div');
    preview.className = 'preview';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon-prw';
    iconSpan.innerHTML = giftIcon || '';

    const idSpan = document.createElement('span');
    idSpan.style.fontWeight = '600';
    idSpan.textContent = `ID: ${giftId || ''}`;

    preview.append(iconSpan, idSpan);
    modalFields.appendChild(preview);
  }

  const groupsContainer = document.createElement('div');
  groupsContainer.className = 'gift-groups';
  groupsContainer.setAttribute('data-gift-container', '');
  modalFields.appendChild(groupsContainer);

  const giftGroups = [];

  const syncHiddenFields = () => {
    // Очищаем предыдущие скрытые поля
    const selectors = includeGiftDataField
      ? 'input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="from_"], input[type="hidden"][name^="wish_"], input[type="hidden"][name^="gift_data_"], input[type="hidden"][name^="gift_id_"], input[type="hidden"][name^="gift_icon_"]'
      : 'input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="from_"], input[type="hidden"][name^="wish_"], input[type="hidden"][name^="gift_id_"], input[type="hidden"][name^="gift_icon_"]';

    modalFields.querySelectorAll(selectors).forEach(n => n.remove());

    // Пересобираем для каждого получателя
    giftGroups.forEach((group, index) => {
      const i = index + 1;

      const hidR = document.createElement('input');
      hidR.type = 'hidden';
      hidR.name = `recipient_${i}`;
      hidR.value = String(group.recipientId);

      const hidFrom = document.createElement('input');
      hidFrom.type = 'hidden';
      hidFrom.name = `from_${i}`;
      hidFrom.value = group.fromInput.value.trim();

      const hidWish = document.createElement('input');
      hidWish.type = 'hidden';
      hidWish.name = `wish_${i}`;
      hidWish.value = group.wishInput.value.trim();

      const hidGiftId = document.createElement('input');
      hidGiftId.type = 'hidden';
      hidGiftId.name = `gift_id_${i}`;
      hidGiftId.value = giftId || '';

      const hidGiftIcon = document.createElement('input');
      hidGiftIcon.type = 'hidden';
      hidGiftIcon.name = `gift_icon_${i}`;
      hidGiftIcon.value = giftIcon || '';

      if (includeGiftDataField) {
        const hidData = document.createElement('input');
        hidData.type = 'hidden';
        hidData.name = `gift_data_${i}`;
        hidData.value = group.giftDataInput.value.trim();
        modalFields.append(hidR, hidFrom, hidWish, hidData, hidGiftId, hidGiftIcon);
      } else {
        modalFields.append(hidR, hidFrom, hidWish, hidGiftId, hidGiftIcon);
      }
    });

    const { totalCount } = updateTotalCost(giftGroups);
    const hasAny = totalCount > 0;
    btnSubmit.style.display = hasAny ? '' : 'none';
    btnSubmit.disabled = !hasAny;
  };

  const removeGroup = (group) => {
    const index = giftGroups.indexOf(group);
    if (index !== -1) {
      giftGroups.splice(index, 1);
      group.el.remove();
      syncHiddenFields();
    }
  };

  const createGiftGroup = (prefillRecipientId = '', prefillFrom = '', prefillWish = '', prefillGiftData = '') => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'gift-group';
    groupDiv.setAttribute('data-gift-group', '');

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-extra gift-remove';
    removeBtn.setAttribute('data-gift-remove', '');
    removeBtn.setAttribute('aria-label', 'Удалить получателя');
    removeBtn.textContent = '×';
    removeBtn.disabled = giftGroups.length === 0;

    // Поле "Получатель"
    const recipientField = document.createElement('div');
    recipientField.className = 'field gift-field';
    recipientField.setAttribute('data-gift-label', 'recipient');

    const recipientLabel = document.createElement('label');
    recipientLabel.textContent = 'Получатель *';

    const recipientInput = document.createElement('input');
    recipientInput.type = 'text';
    recipientInput.required = true;
    recipientInput.placeholder = 'Начните вводить имя или id...';
    recipientInput.setAttribute('autocomplete', 'off');

    const suggestDiv = document.createElement('div');
    suggestDiv.className = 'suggest';
    suggestDiv.setAttribute('role', 'listbox');

    recipientField.appendChild(recipientLabel);
    recipientField.appendChild(recipientInput);

    // Поле "От кого"
    const fromField = document.createElement('div');
    fromField.className = 'field gift-field';
    fromField.setAttribute('data-gift-label', 'from');

    const fromLabel = document.createElement('label');
    fromLabel.textContent = 'От кого';

    const fromInput = document.createElement('input');
    fromInput.type = 'text';
    fromInput.placeholder = 'От тайного поклонника';

    fromField.appendChild(fromLabel);
    fromField.appendChild(fromInput);

    // Поле "Комментарий"
    const wishField = document.createElement('div');
    wishField.className = 'field gift-field';
    wishField.setAttribute('data-gift-label', 'wish');

    const wishLabel = document.createElement('label');
    wishLabel.textContent = 'Комментарий';

    const wishInput = document.createElement('input');
    wishInput.type = 'text';
    wishInput.placeholder = 'Например, с праздником!';

    wishField.appendChild(wishLabel);
    wishField.appendChild(wishInput);

    // Добавляем в группу
    groupDiv.appendChild(removeBtn);
    groupDiv.appendChild(recipientField);
    groupDiv.appendChild(fromField);
    groupDiv.appendChild(wishField);

    // Дополнительное поле "Данные для подарка" (если нужно)
    let giftDataInput = null;
    if (includeGiftDataField) {
      const giftDataField = document.createElement('div');
      giftDataField.className = 'field gift-field';
      giftDataField.setAttribute('data-gift-label', 'gift_data');

      const giftDataLabel = document.createElement('label');
      giftDataLabel.textContent = 'Данные для подарка *';

      giftDataInput = document.createElement('textarea');
      giftDataInput.required = true;
      giftDataInput.placeholder = 'Ссылки на исходники (если есть) и/или комментарии, по которым мы сможем собрать подарок';
      giftDataInput.rows = 3;

      giftDataField.appendChild(giftDataLabel);
      giftDataField.appendChild(giftDataInput);
      groupDiv.appendChild(giftDataField);
    }

    groupsContainer.appendChild(groupDiv);

    const group = {
      el: groupDiv,
      recipientId: '',
      recipientInput,
      fromInput,
      wishInput,
      giftDataInput,
      suggestDiv
    };

    giftGroups.push(group);

    // Автокомплит
    const portalList = suggestDiv;
    portalList.style.position = 'fixed';
    portalList.style.zIndex = '9999';
    let portalMounted = false;
    const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
    const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
    const positionPortal = () => {
      const r = recipientInput.getBoundingClientRect();
      portalList.style.left = `${r.left}px`;
      portalList.style.top = `${r.bottom + 6}px`;
      portalList.style.width = `${r.width}px`;
    };
    const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
    const openSuggest = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

    const buildItem = (u) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'suggest-item';
      item.setAttribute('role', 'option');
      item.textContent = u.name;
      item.addEventListener('click', () => {
        recipientInput.value = u.name;
        group.recipientId = u.id;
        recipientInput.setCustomValidity('');
        closeSuggest();
        syncHiddenFields();
        recipientInput.focus();
      });
      return item;
    };

    const norm = (s) => String(s ?? '').trim().toLowerCase();
    const doSearch = () => {
      const q = norm(recipientInput.value);
      portalList.innerHTML = '';
      if (!q) { closeSuggest(); return; }
      const res = users
        .filter(u => norm(u.name).includes(q) || String(u.id).includes(q))
        .slice(0, 20);
      if (!res.length) { closeSuggest(); return; }
      res.forEach(u => portalList.appendChild(buildItem(u)));
      openSuggest();
    };

    recipientInput.addEventListener('input', () => {
      group.recipientId = '';
      recipientInput.setCustomValidity('Выберите получателя из списка');
      doSearch();
    });
    recipientInput.addEventListener('focus', doSearch);

    document.addEventListener('click', (e) => {
      if (!recipientField.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
    });
    window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
    window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

    removeBtn.addEventListener('click', () => removeGroup(group));

    // Prefill
    if (prefillRecipientId) {
      const user = users.find(u => String(u.id) === String(prefillRecipientId));
      if (user) {
        recipientInput.value = user.name;
        group.recipientId = user.id;
        recipientInput.setCustomValidity('');
      }
    } else {
      recipientInput.setCustomValidity('Выберите получателя из списка');
    }
    if (prefillFrom) fromInput.value = prefillFrom;
    if (prefillWish) wishInput.value = prefillWish;
    if (prefillGiftData && giftDataInput) giftDataInput.value = prefillGiftData;

    fromInput.addEventListener('input', syncHiddenFields);
    wishInput.addEventListener('input', syncHiddenFields);
    if (giftDataInput) giftDataInput.addEventListener('input', syncHiddenFields);

    syncHiddenFields();
    return group;
  };

  // Кнопка "+ Еще"
  const addMoreBtn = document.createElement('div');
  addMoreBtn.className = 'field';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = '+ Еще';
  btn.addEventListener('click', () => createGiftGroup());
  addMoreBtn.appendChild(btn);
  modalFields.appendChild(addMoreBtn);

  // Prefill из data
  if (data) {
    const entries = Object.entries(data);
    const recipientEntries = entries.filter(([k]) => k.startsWith('recipient_'));

    if (recipientEntries.length > 0) {
      recipientEntries.forEach(([key, userId]) => {
        const idx = key.replace('recipient_', '');
        const fromVal = data[`from_${idx}`] || '';
        const wishVal = data[`wish_${idx}`] || '';
        const giftDataVal = includeGiftDataField ? (data[`gift_data_${idx}`] || '') : '';
        createGiftGroup(userId, fromVal, wishVal, giftDataVal);
      });
    } else {
      createGiftGroup();
    }
  } else {
    createGiftGroup();
  }
}

export function setupCustomGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, price }) {
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
      if (totalCount > 0) {
        updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(itemPrice), bonus: '0' } }, { items: totalCount });
      } else {
        modalAmount.textContent = '';
      }
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
      includeGiftDataField: true
    });
  };

  // 4) Ожидаем USERS_LIST и создаём gift picker
  counterWatcher = waitForGlobalArray('USERS_LIST', timeoutMs, renderCustomGiftPicker, fail);
  return counterWatcher;
}

// ============================================================================
// SETUP GIFT FLOW - Подарки
// ============================================================================

export function setupGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, price }) {
  // 1) Очищаем модальное окно
  clearModalFields(modalFields);

  // 2) Показываем сообщение ожидания
  showWaitMessage(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

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
      if (totalCount > 0) {
        updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(itemPrice), bonus: '0' } }, { items: totalCount });
      } else {
        modalAmount.textContent = '';
      }
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
      showPreview: true,
      includeGiftDataField: false
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
    ? setupCustomGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId: config.giftId, giftIcon: config.giftIcon, price: config.price })
    : setupGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId: config.giftId, giftIcon: config.giftIcon, price: config.price });

  return { handled: true, counterWatcher };
}
