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
  hideWaitMessage,
  showErrorMessage,
  disableSubmitButton,
  clearModalFields,
  waitForGlobalArray
} from './helpers.js';

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

    hideWaitMessage(modalFields);

    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'gift-groups';
    groupsContainer.setAttribute('data-gift-container', '');
    modalFields.appendChild(groupsContainer);

    const itemGroups = [];
    let groupCounter = 0;
    const price = Number.parseInt(basePrice, 10) || 0;

    // Показываем базовую цену сразу
    if (modalAmount) {
      modalAmount.textContent = formatNumber(price);
    }

    const syncHiddenFields = () => {
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="from_"], input[type="hidden"][name^="wish_"], input[type="hidden"][name^="quantity_"]')
        .forEach(n => n.remove());

      let totalQuantity = 0;
      itemGroups.forEach((group, index) => {
        if (!group.recipientId) return;
        const i = index + 1;
        const qty = Number(group.quantityInput.value) || 0;
        if (qty <= 0) return;

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

        const hidQty = document.createElement('input');
        hidQty.type = 'hidden';
        hidQty.name = `quantity_${i}`;
        hidQty.value = String(qty);

        modalFields.append(hidR, hidFrom, hidWish, hidQty);
        totalQuantity += qty;
      });

      if (modalAmount) {
        if (totalQuantity > 0) {
          updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(price), bonus: '0' } }, { items: totalQuantity });
        } else {
          // Показываем базовую цену даже когда нет получателей
          modalAmount.textContent = formatNumber(price);
        }
      }

      const hasAny = totalQuantity > 0;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
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

    const createGroup = (prefillUser = null, prefillQty = '1', prefillFrom = '', prefillWish = '') => {
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
      recipientLabel.setAttribute('for', `bonus-recipient-${idx}`);
      recipientLabel.textContent = `${TEXT_MESSAGES.RECIPIENT_LABEL} *`;

      const comboDiv = document.createElement('div');
      comboDiv.className = 'combo';

      const recipientInput = document.createElement('input');
      recipientInput.id = `bonus-recipient-${idx}`;
      recipientInput.setAttribute('data-gift-recipient', '');
      recipientInput.type = 'text';
      recipientInput.placeholder = 'Начните вводить имя или id...';
      recipientInput.required = true;
      recipientInput.setAttribute('autocomplete', 'off');
      if (prefillUser) {
        recipientInput.value = prefillUser.name;
      }

      const suggestDiv = document.createElement('div');
      suggestDiv.className = 'suggest';
      suggestDiv.setAttribute('role', 'listbox');
      suggestDiv.style.display = 'none';

      comboDiv.append(recipientInput, suggestDiv);
      recipientField.append(recipientLabel, comboDiv);

      // Количество
      const quantityField = document.createElement('div');
      quantityField.className = 'field gift-field';
      const qtyLabel = document.createElement('label');
      qtyLabel.setAttribute('for', `bonus-quantity-${idx}`);
      qtyLabel.textContent = `${TEXT_MESSAGES.QUANTITY_LABEL} *`;
      const qtyInput = document.createElement('input');
      qtyInput.id = `bonus-quantity-${idx}`;
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.value = prefillQty;
      qtyInput.required = true;
      quantityField.append(qtyLabel, qtyInput);

      // От кого
      const fromField = document.createElement('div');
      fromField.className = 'field gift-field';
      fromField.setAttribute('data-gift-label', 'from');
      const fromLabel = document.createElement('label');
      fromLabel.setAttribute('for', `bonus-from-${idx}`);
      fromLabel.textContent = TEXT_MESSAGES.FROM_LABEL;
      const fromInput = document.createElement('input');
      fromInput.id = `bonus-from-${idx}`;
      fromInput.setAttribute('data-gift-from', '');
      fromInput.type = 'text';
      fromInput.value = prefillFrom;
      fromInput.placeholder = 'От ...';
      fromField.append(fromLabel, fromInput);

      // Комментарий
      const wishField = document.createElement('div');
      wishField.className = 'field gift-field';
      wishField.setAttribute('data-gift-label', 'wish');
      const wishLabel = document.createElement('label');
      wishLabel.setAttribute('for', `bonus-wish-${idx}`);
      wishLabel.textContent = TEXT_MESSAGES.COMMENT_LABEL;
      const wishInput = document.createElement('input');
      wishInput.id = `bonus-wish-${idx}`;
      wishInput.setAttribute('data-gift-wish', '');
      wishInput.type = 'text';
      wishInput.value = prefillWish;
      wishInput.placeholder = 'Комментарий';
      wishField.append(wishLabel, wishInput);

      groupDiv.append(removeBtn, recipientField, quantityField, fromField, wishField);
      groupsContainer.appendChild(groupDiv);

      const group = {
        el: groupDiv,
        recipientId: prefillUser ? prefillUser.id : '',
        recipientInput,
        quantityInput: qtyInput,
        fromInput,
        wishInput,
        suggestDiv
      };

      itemGroups.push(group);

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

        const alreadyAdded = itemGroups.map(g => String(g.recipientId)).filter(Boolean);
        const matches = users.filter(u =>
          !alreadyAdded.includes(String(u.id)) &&
          (norm(u.name).includes(q) || String(u.id).includes(q))
        ).slice(0, 10);

        if (matches.length === 0) {
          closeSuggest();
          return;
        }

        matches.forEach(u => portalList.appendChild(buildItem(u)));
        openSuggest();
      };

      recipientInput.addEventListener('input', () => {
        group.recipientId = '';
        doSearch();
        syncHiddenFields();
      });
      recipientInput.addEventListener('focus', doSearch);
      recipientInput.addEventListener('blur', () => setTimeout(closeSuggest, 200));

      qtyInput.addEventListener('input', syncHiddenFields);
      fromInput.addEventListener('input', syncHiddenFields);
      wishInput.addEventListener('input', syncHiddenFields);
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

    // Восстановление данных при редактировании или создание первой группы
    if (data && typeof data === 'object') {
      const recipientKeys = Object.keys(data)
        .filter(k => /^recipient_\d+$/.test(k))
        .map(k => k.match(/^recipient_(\d+)$/)[1])
        .sort((a, b) => Number(a) - Number(b));

      if (recipientKeys.length > 0) {
        recipientKeys.forEach((idx) => {
          const rid = String(data[`recipient_${idx}`] ?? '').trim();
          if (!rid) return;
          const user = users.find(u => String(u.id) === rid);
          if (!user) return;

          const qty = String(data[`quantity_${idx}`] ?? '1');
          const from = String(data[`from_${idx}`] ?? '');
          const wish = String(data[`wish_${idx}`] ?? '');

          createGroup(user, qty, from, wish);
        });
      } else {
        // Создаём первую пустую группу
        createGroup();
      }
    } else {
      // При создании новой записи создаём первую пустую группу
      createGroup();
    }

    syncHiddenFields();
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
