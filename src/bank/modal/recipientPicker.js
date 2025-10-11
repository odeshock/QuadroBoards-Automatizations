// ============================================================================
// recipientPicker.js — Универсальный picker для выбора получателей
// ============================================================================

import { TEXT_MESSAGES } from '../constants.js';
import { hideWaitMessage } from './helpers.js';

/**
 * Универсальная функция для создания picker'а с группами получателей
 * @param {Object} config - Конфигурация
 * @param {Array} config.users - Список пользователей
 * @param {HTMLElement} config.modalFields - Контейнер для полей формы
 * @param {HTMLElement} config.btnSubmit - Кнопка отправки
 * @param {Object} config.data - Данные для prefill при редактировании
 * @param {HTMLElement} config.modalAmount - Элемент для отображения суммы
 *
 * @param {boolean} config.showQuantityField - Показывать ли поле "Количество"
 * @param {boolean} config.showGiftDataField - Показывать ли поле "Данные для подарка"
 * @param {boolean} config.showPreview - Показывать ли превью (например, подарка)
 * @param {boolean} config.allowDuplicateRecipients - Разрешить ли добавлять одного получателя несколько раз
 *
 * @param {Object} config.giftData - Данные подарка (для форм подарков)
 * @param {string} config.giftData.id - ID подарка
 * @param {string} config.giftData.icon - Иконка подарка
 *
 * @param {Object} config.priceData - Данные для расчёта цены (для форм с количеством)
 * @param {number} config.priceData.basePrice - Базовая цена за единицу
 *
 * @param {Function} config.updateCostCallback - Функция для обновления итоговой стоимости
 * @param {Function} config.syncCallback - Дополнительный callback после синхронизации
 */
export function renderRecipientPickerUniversal({
  users,
  modalFields,
  btnSubmit,
  data,
  modalAmount,

  showQuantityField = false,
  showGiftDataField = false,
  showPreview = false,
  allowDuplicateRecipients = true,

  giftData = null,
  priceData = null,

  updateCostCallback = null,
  syncCallback = null
}) {
  hideWaitMessage(modalFields);

  // Превью (например, для подарков)
  if (showPreview && giftData) {
    const preview = document.createElement('div');
    preview.className = 'preview';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon-prw';
    iconSpan.innerHTML = giftData.icon || '';

    const idSpan = document.createElement('span');
    idSpan.style.fontWeight = '600';
    idSpan.textContent = `ID: ${giftData.id || ''}`;

    preview.append(iconSpan, idSpan);
    modalFields.appendChild(preview);
  }

  const groupsContainer = document.createElement('div');
  groupsContainer.className = 'gift-groups';
  groupsContainer.setAttribute('data-gift-container', '');
  modalFields.appendChild(groupsContainer);

  const itemGroups = [];
  let groupCounter = 0;

  const syncHiddenFields = () => {
    // Определяем какие hidden fields нужно удалить
    const hiddenFieldNames = ['recipient_', 'from_', 'wish_'];
    if (showQuantityField) hiddenFieldNames.push('quantity_');
    if (showGiftDataField) hiddenFieldNames.push('gift_data_');
    if (giftData) {
      hiddenFieldNames.push('gift_id_', 'gift_icon_');
    }

    const selector = hiddenFieldNames.map(name => `input[type="hidden"][name^="${name}"], textarea[type="hidden"][name^="${name}"]`).join(', ');
    modalFields.querySelectorAll(selector).forEach(n => n.remove());

    // Пересобираем hidden fields для каждой группы
    let validGroupIndex = 0;
    itemGroups.forEach((group) => {
      if (!group.recipientId) return;

      // Для форм с количеством проверяем, что qty > 0
      if (showQuantityField) {
        const qty = Number(group.quantityInput.value) || 0;
        if (qty <= 0) return;
      }

      validGroupIndex++;
      const i = validGroupIndex;

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

      const fieldsToAppend = [hidR, hidFrom, hidWish];

      if (showQuantityField) {
        const hidQty = document.createElement('input');
        hidQty.type = 'hidden';
        hidQty.name = `quantity_${i}`;
        hidQty.value = String(Number(group.quantityInput.value) || 0);
        fieldsToAppend.push(hidQty);
      }

      if (showGiftDataField && group.giftDataInput) {
        const hidData = document.createElement('input');
        hidData.type = 'hidden';
        hidData.name = `gift_data_${i}`;
        hidData.value = group.giftDataInput.value.trim();
        fieldsToAppend.push(hidData);
      }

      if (giftData) {
        const hidGiftId = document.createElement('input');
        hidGiftId.type = 'hidden';
        hidGiftId.name = `gift_id_${i}`;
        hidGiftId.value = giftData.id || '';

        const hidGiftIcon = document.createElement('input');
        hidGiftIcon.type = 'hidden';
        hidGiftIcon.name = `gift_icon_${i}`;
        hidGiftIcon.value = giftData.icon || '';

        fieldsToAppend.push(hidGiftId, hidGiftIcon);
      }

      modalFields.append(...fieldsToAppend);
    });

    // Обновление итоговой стоимости
    if (updateCostCallback) {
      const result = updateCostCallback(itemGroups);
      const hasAny = result.totalCount > 0;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
    } else if (showQuantityField && priceData && modalAmount) {
      // Для форм с количеством и ценой (бонусы, маски и т.д.)
      let totalQuantity = 0;
      itemGroups.forEach((group) => {
        if (!group.recipientId) return;
        const qty = Number(group.quantityInput.value) || 0;
        if (qty > 0) totalQuantity += qty;
      });

      if (totalQuantity > 0 && priceData.basePrice) {
        const totalCost = totalQuantity * priceData.basePrice;
        modalAmount.textContent = totalCost.toLocaleString('ru-RU');
      } else {
        modalAmount.textContent = String(priceData.basePrice || 0);
      }

      const hasAny = totalQuantity > 0;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
    } else {
      // Простой подсчёт групп с валидными получателями
      const validCount = itemGroups.filter(g => g.recipientId).length;
      btnSubmit.style.display = validCount > 0 ? '' : 'none';
      btnSubmit.disabled = validCount === 0;
    }

    if (syncCallback) syncCallback();
  };

  const removeGroup = (group) => {
    const idx = itemGroups.indexOf(group);
    if (idx > -1) itemGroups.splice(idx, 1);
    if (group.el) group.el.remove();
    updateRemoveButtons();
    syncHiddenFields();
  };

  const updateRemoveButtons = () => {
    const allRemoveBtns = groupsContainer.querySelectorAll('.gift-remove');
    allRemoveBtns.forEach((btn, i) => {
      btn.disabled = i === 0;
    });
  };

  const createGroup = (prefillUser = null, prefillQty = '1', prefillFrom = '', prefillWish = '', prefillGiftData = '') => {
    groupCounter++;
    const idx = groupCounter;
    const isFirst = itemGroups.length === 0;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'gift-group';
    groupDiv.setAttribute('data-gift-group', '');

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-extra gift-remove';
    removeBtn.setAttribute('data-gift-remove', '');
    removeBtn.setAttribute('aria-label', 'Удалить получателя');
    removeBtn.textContent = '×';
    removeBtn.disabled = isFirst;

    // Получатель с автокомплитом
    const recipientField = document.createElement('div');
    recipientField.className = 'field gift-field anketa-combobox';
    recipientField.setAttribute('data-gift-label', 'recipient');

    const recipientLabel = document.createElement('label');
    recipientLabel.setAttribute('for', `recipient-${idx}`);
    recipientLabel.textContent = `${TEXT_MESSAGES.RECIPIENT_LABEL} *`;

    const comboDiv = document.createElement('div');
    comboDiv.className = 'combo';

    const recipientInput = document.createElement('input');
    recipientInput.id = `recipient-${idx}`;
    recipientInput.setAttribute('data-gift-recipient', '');
    recipientInput.type = 'text';
    recipientInput.placeholder = 'Начните вводить имя или id...';
    recipientInput.required = true;
    recipientInput.setAttribute('autocomplete', 'off');
    if (prefillUser) {
      recipientInput.value = prefillUser.name;
    } else {
      recipientInput.setCustomValidity('Выберите получателя из списка');
    }

    const suggestDiv = document.createElement('div');
    suggestDiv.className = 'suggest';
    suggestDiv.setAttribute('role', 'listbox');
    suggestDiv.style.display = 'none';

    comboDiv.append(recipientInput, suggestDiv);
    recipientField.append(recipientLabel, comboDiv);

    groupDiv.appendChild(removeBtn);
    groupDiv.appendChild(recipientField);

    // Поле "Количество" (опционально)
    let quantityInput = null;
    if (showQuantityField) {
      const quantityField = document.createElement('div');
      quantityField.className = 'field gift-field';
      const qtyLabel = document.createElement('label');
      qtyLabel.setAttribute('for', `quantity-${idx}`);
      qtyLabel.textContent = `${TEXT_MESSAGES.QUANTITY_LABEL} *`;
      quantityInput = document.createElement('input');
      quantityInput.id = `quantity-${idx}`;
      quantityInput.type = 'number';
      quantityInput.min = '1';
      quantityInput.value = prefillQty;
      quantityInput.required = true;
      quantityField.append(qtyLabel, quantityInput);
      groupDiv.appendChild(quantityField);
    }

    // От кого
    const fromField = document.createElement('div');
    fromField.className = 'field gift-field';
    fromField.setAttribute('data-gift-label', 'from');
    const fromLabel = document.createElement('label');
    fromLabel.setAttribute('for', `from-${idx}`);
    fromLabel.textContent = TEXT_MESSAGES.FROM_LABEL;
    const fromInput = document.createElement('input');
    fromInput.id = `from-${idx}`;
    fromInput.setAttribute('data-gift-from', '');
    fromInput.type = 'text';
    fromInput.value = prefillFrom;
    fromInput.placeholder = showQuantityField ? 'От ...' : 'От тайного поклонника';
    fromField.append(fromLabel, fromInput);
    groupDiv.appendChild(fromField);

    // Комментарий
    const wishField = document.createElement('div');
    wishField.className = 'field gift-field';
    wishField.setAttribute('data-gift-label', 'wish');
    const wishLabel = document.createElement('label');
    wishLabel.setAttribute('for', `wish-${idx}`);
    wishLabel.textContent = TEXT_MESSAGES.COMMENT_LABEL;
    const wishInput = document.createElement('input');
    wishInput.id = `wish-${idx}`;
    wishInput.setAttribute('data-gift-wish', '');
    wishInput.type = 'text';
    wishInput.value = prefillWish;
    wishInput.placeholder = showQuantityField ? 'Комментарий' : 'Например, с праздником!';
    wishField.append(wishLabel, wishInput);
    groupDiv.appendChild(wishField);

    // Поле "Данные для подарка" (опционально)
    let giftDataInput = null;
    if (showGiftDataField) {
      const giftDataField = document.createElement('div');
      giftDataField.className = 'field gift-field';
      giftDataField.setAttribute('data-gift-label', 'gift_data');

      const giftDataLabel = document.createElement('label');
      giftDataLabel.textContent = 'Данные для подарка *';

      giftDataInput = document.createElement('textarea');
      giftDataInput.required = true;
      giftDataInput.placeholder = 'Ссылки на исходники (если есть) и/или комментарии, по которым мы сможем собрать подарок';
      giftDataInput.rows = 3;
      giftDataInput.value = prefillGiftData;

      giftDataField.appendChild(giftDataLabel);
      giftDataField.appendChild(giftDataInput);
      groupDiv.appendChild(giftDataField);
    }

    groupsContainer.appendChild(groupDiv);

    const group = {
      el: groupDiv,
      recipientId: prefillUser ? prefillUser.id : '',
      recipientInput,
      quantityInput,
      fromInput,
      wishInput,
      giftDataInput,
      suggestDiv
    };

    itemGroups.push(group);

    // Автокомплит с portal
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
      });
      return item;
    };

    const norm = (s) => String(s ?? '').trim().toLowerCase();
    const doSearch = () => {
      const q = norm(recipientInput.value);
      portalList.innerHTML = '';

      if (!q) {
        closeSuggest();
        return;
      }

      let matches;
      if (allowDuplicateRecipients) {
        // Разрешаем дубликаты - показываем всех подходящих пользователей
        matches = users.filter(u =>
          norm(u.name).includes(q) || String(u.id).includes(q)
        ).slice(0, 20);
      } else {
        // Исключаем уже добавленных получателей
        const alreadyAdded = itemGroups.map(g => String(g.recipientId)).filter(Boolean);
        matches = users.filter(u =>
          !alreadyAdded.includes(String(u.id)) &&
          (norm(u.name).includes(q) || String(u.id).includes(q))
        ).slice(0, 10);
      }

      if (matches.length === 0) {
        closeSuggest();
        return;
      }

      matches.forEach(u => portalList.appendChild(buildItem(u)));
      openSuggest();
    };

    recipientInput.addEventListener('input', () => {
      group.recipientId = '';
      recipientInput.setCustomValidity('Выберите получателя из списка');
      doSearch();
      syncHiddenFields();
    });
    recipientInput.addEventListener('focus', doSearch);

    // При потере фокуса проверяем точное совпадение с именем
    recipientInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (!group.recipientId && recipientInput.value.trim()) {
          // Ищем точное совпадение по имени
          const exactMatch = users.find(u =>
            norm(u.name) === norm(recipientInput.value)
          );
          if (exactMatch) {
            recipientInput.value = exactMatch.name;
            group.recipientId = exactMatch.id;
            recipientInput.setCustomValidity('');
            syncHiddenFields();
          }
        }
      }, 200);
    });

    document.addEventListener('click', (e) => {
      if (!recipientField.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
    });
    window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
    window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

    if (quantityInput) quantityInput.addEventListener('input', syncHiddenFields);
    fromInput.addEventListener('input', syncHiddenFields);
    wishInput.addEventListener('input', syncHiddenFields);
    if (giftDataInput) giftDataInput.addEventListener('input', syncHiddenFields);
    removeBtn.addEventListener('click', () => removeGroup(group));

    updateRemoveButtons();
    syncHiddenFields();
    return group;
  };

  // Кнопка "+ Еще"
  const addMoreBtn = document.createElement('button');
  addMoreBtn.type = 'button';
  addMoreBtn.className = 'btn';
  addMoreBtn.textContent = '+ Еще';
  addMoreBtn.setAttribute('data-add-gift-group', '');
  addMoreBtn.addEventListener('click', () => {
    createGroup();
  });

  const addMoreField = document.createElement('div');
  addMoreField.className = 'field';
  addMoreField.appendChild(addMoreBtn);
  modalFields.appendChild(addMoreField);

  // Показываем базовую цену сразу (для форм с ценой)
  if (showQuantityField && priceData && modalAmount) {
    modalAmount.textContent = String(priceData.basePrice || 0);
  }

  // Восстановление данных при редактировании
  if (data && typeof data === 'object') {
    const recipientKeys = Object.keys(data)
      .filter(k => /^recipient_\d+$/.test(k))
      .map(k => k.match(/^recipient_(\d+)$/)[1])
      .sort((a, b) => Number(a) - Number(b));

    if (recipientKeys.length > 0) {
      recipientKeys.forEach((i) => {
        const rid = String(data[`recipient_${i}`] ?? '').trim();
        if (!rid) return;
        const user = users.find(u => String(u.id) === rid);
        if (!user) return;

        const qty = showQuantityField ? String(data[`quantity_${i}`] ?? '1') : '1';
        const from = String(data[`from_${i}`] ?? '');
        const wish = String(data[`wish_${i}`] ?? '');
        const giftDataVal = showGiftDataField ? String(data[`gift_data_${i}`] ?? '') : '';

        createGroup(user, qty, from, wish, giftDataVal);
      });
    } else {
      createGroup();
    }
  } else {
    createGroup();
  }

  syncHiddenFields();
}
