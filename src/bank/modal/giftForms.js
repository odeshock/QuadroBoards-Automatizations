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

export function setupCustomGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, price }) {
  // Удаляем всё кроме дисклеймера
  modalFields.querySelectorAll('.gift-note, .muted-note, .note-error, .callout, [data-info], .field, .gift-groups')
    .forEach(el => el.remove());

  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = TEXT_MESSAGES.PLEASE_WAIT;
  // Вставляем после дисклеймера
  const disclaimer = modalFields.querySelector('.info');
  if (disclaimer) {
    disclaimer.insertAdjacentElement('afterend', waitNote);
  } else {
    modalFields.prepend(waitNote);
  }

  const hideWait = () => {
    const el = modalFields.querySelector('.admin-wait-note');
    if (el) el.remove();
  };

  const showError = (msg) => {
    hideWait();
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      err.style.color = 'var(--danger)';
      if (disclaimer) {
        disclaimer.insertAdjacentElement('afterend', err);
      } else {
        modalFields.prepend(err);
      }
    }
    err.textContent = msg || 'Произошла ошибка. Пожалуйста, обновите страницу.';
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Пожалуйста, обновите страницу.');
    cancel();
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

    hideWait();

    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'gift-groups';
    groupsContainer.setAttribute('data-gift-container', '');
    modalFields.appendChild(groupsContainer);

    const giftGroups = [];

    const syncHiddenFields = () => {
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="from_"], input[type="hidden"][name^="wish_"], input[type="hidden"][name^="gift_data_"], input[type="hidden"][name^="gift_id_"], input[type="hidden"][name^="gift_icon_"]')
        .forEach(n => n.remove());

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

        const hidData = document.createElement('input');
        hidData.type = 'hidden';
        hidData.name = `gift_data_${i}`;
        hidData.value = group.giftDataInput.value.trim();

        const hidGiftId = document.createElement('input');
        hidGiftId.type = 'hidden';
        hidGiftId.name = `gift_id_${i}`;
        hidGiftId.value = giftId || '';

        const hidGiftIcon = document.createElement('input');
        hidGiftIcon.type = 'hidden';
        hidGiftIcon.name = `gift_icon_${i}`;
        hidGiftIcon.value = giftIcon || '';

        modalFields.append(hidR, hidFrom, hidWish, hidData, hidGiftId, hidGiftIcon);
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

    const createCustomGiftGroup = (prefillRecipientId = '', prefillFrom = '', prefillWish = '', prefillGiftData = '') => {
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

      // Дополнительное поле "Данные для подарка"
      const giftDataField = document.createElement('div');
      giftDataField.className = 'field gift-field';
      giftDataField.setAttribute('data-gift-label', 'gift_data');

      const giftDataLabel = document.createElement('label');
      giftDataLabel.textContent = 'Данные для подарка *';

      const giftDataInput = document.createElement('textarea');
      giftDataInput.required = true;
      giftDataInput.placeholder = 'Ссылки на исходники (если есть) и/или комментарии, по которым мы сможем собрать подарок';
      giftDataInput.rows = 3;

      giftDataField.appendChild(giftDataLabel);
      giftDataField.appendChild(giftDataInput);

      groupDiv.appendChild(removeBtn);
      groupDiv.appendChild(recipientField);
      groupDiv.appendChild(fromField);
      groupDiv.appendChild(wishField);
      groupDiv.appendChild(giftDataField);

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

      // Автокомплит (копия из setupGiftFlow)
      const portalList = suggestDiv;
      portalList.style.position = 'fixed';
      portalList.style.zIndex = '9999';
      let portalMounted = false;
      const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
      const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
      const positionPortal = () => {
        const r = recipientInput.getBoundingClientRect();
        portalList.style.left = `${r.left}px`;
        portalList.style.top  = `${r.bottom + 6}px`;
        portalList.style.width = `${r.width}px`;
      };
      const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
      const openSuggest  = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

      const buildItem = (u) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'suggest-item';
        item.setAttribute('role', 'option');
        item.textContent = `${u.name} (id: ${u.id})`;
        item.addEventListener('click', () => {
          recipientInput.value = `${u.name} (id: ${u.id})`;
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

      if (prefillRecipientId) {
        const user = users.find(u => String(u.id) === String(prefillRecipientId));
        if (user) {
          recipientInput.value = `${user.name} (id: ${user.id})`;
          group.recipientId = user.id;
          recipientInput.setCustomValidity('');
        }
      }
      if (prefillFrom) fromInput.value = prefillFrom;
      if (prefillWish) wishInput.value = prefillWish;
      if (prefillGiftData) giftDataInput.value = prefillGiftData;

      fromInput.addEventListener('input', syncHiddenFields);
      wishInput.addEventListener('input', syncHiddenFields);
      giftDataInput.addEventListener('input', syncHiddenFields);

      syncHiddenFields();
      return group;
    };

    const addMoreBtn = document.createElement('div');
    addMoreBtn.className = 'field';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = '+ Еще';
    btn.addEventListener('click', () => createCustomGiftGroup());
    addMoreBtn.appendChild(btn);
    modalFields.appendChild(addMoreBtn);

    if (data) {
      const entries = Object.entries(data);
      const recipientEntries = entries.filter(([k]) => k.startsWith('recipient_'));

      if (recipientEntries.length > 0) {
        recipientEntries.forEach(([key, userId]) => {
          const idx = key.replace('recipient_', '');
          const fromVal = data[`from_${idx}`] || '';
          const wishVal = data[`wish_${idx}`] || '';
          const giftDataVal = data[`gift_data_${idx}`] || '';
          createCustomGiftGroup(userId, fromVal, wishVal, giftDataVal);
        });
      } else {
        createCustomGiftGroup();
      }
    } else {
      createCustomGiftGroup();
    }
  };

  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderCustomGiftPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

// ============================================================================
// SETUP GIFT FLOW - Подарки
// ============================================================================

export function setupGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, price }) {
  console.log('[DEBUG setupGiftFlow] price:', price, 'giftId:', giftId);

  // === 1) Удаляем существующие поля формы ===
  modalFields.querySelectorAll('.info, .gift-note, .muted-note, .note-error, .callout, [data-info], .field, .gift-groups')
    .forEach(el => el.remove());

  // === 2) Показываем "Пожалуйста, подождите..." пока ждём USERS_LIST ===
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = TEXT_MESSAGES.PLEASE_WAIT;
  modalFields.prepend(waitNote);

  const hideWait = () => {
    const el = modalFields.querySelector('.admin-wait-note');
    if (el) el.remove();
  };

  const showError = (msg) => {
    hideWait();
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      err.style.color = 'var(--danger)';
      modalFields.prepend(err);
    }
    err.textContent = msg || 'Произошла ошибка. Пожалуйста, обновите страницу.';
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Пожалуйста, обновите страницу.');
    cancel();
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

    hideWait();

    // Превью подарка (иконка + ID)
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

    // Контейнер для групп подарков
    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'gift-groups';
    groupsContainer.setAttribute('data-gift-container', '');
    modalFields.appendChild(groupsContainer);

    // Массив групп (получателей)
    const giftGroups = [];

    const syncHiddenFields = () => {
      // Очищаем предыдущие скрытые поля
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="from_"], input[type="hidden"][name^="wish_"], input[type="hidden"][name^="gift_id_"], input[type="hidden"][name^="gift_icon_"]')
        .forEach(n => n.remove());

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

        modalFields.append(hidR, hidFrom, hidWish, hidGiftId, hidGiftIcon);
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

    const createGiftGroup = (prefillRecipientId = '', prefillFrom = '', prefillWish = '') => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'gift-group';
      groupDiv.setAttribute('data-gift-group', '');

      // Кнопка удаления
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-extra gift-remove';
      removeBtn.setAttribute('data-gift-remove', '');
      removeBtn.setAttribute('aria-label', 'Удалить получателя');
      removeBtn.textContent = '×';
      removeBtn.disabled = giftGroups.length === 0; // Первая группа не удаляется

      // Поле "Получатель" с автокомплитом
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

      // Собираем группу
      groupDiv.appendChild(removeBtn);
      groupDiv.appendChild(recipientField);
      groupDiv.appendChild(fromField);
      groupDiv.appendChild(wishField);

      groupsContainer.appendChild(groupDiv);

      // Объект группы
      const group = {
        el: groupDiv,
        recipientId: '',
        recipientInput,
        fromInput,
        wishInput,
        suggestDiv
      };

      giftGroups.push(group);

      // Автокомплит для получателя (portal approach)
      const portalList = suggestDiv;
      portalList.style.position = 'fixed';
      portalList.style.zIndex = '9999';
      let portalMounted = false;
      const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
      const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
      const positionPortal = () => {
        const r = recipientInput.getBoundingClientRect();
        portalList.style.left = `${r.left}px`;
        portalList.style.top  = `${r.bottom + 6}px`;
        portalList.style.width = `${r.width}px`;
      };
      const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
      const openSuggest  = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

      const buildItem = (u) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'suggest-item';
        item.setAttribute('role', 'option');
        item.textContent = `${u.name} (id: ${u.id})`;
        item.addEventListener('click', () => {
          recipientInput.value = `${u.name} (id: ${u.id})`;
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

      // Обработчик кнопки удаления
      removeBtn.addEventListener('click', () => removeGroup(group));

      // Prefill
      if (prefillRecipientId) {
        const user = users.find(u => String(u.id) === String(prefillRecipientId));
        if (user) {
          recipientInput.value = `${user.name} (id: ${user.id})`;
          group.recipientId = user.id;
          recipientInput.setCustomValidity('');
        }
      }
      if (prefillFrom) fromInput.value = prefillFrom;
      if (prefillWish) wishInput.value = prefillWish;

      fromInput.addEventListener('input', syncHiddenFields);
      wishInput.addEventListener('input', syncHiddenFields);

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

    // Восстановление данных при редактировании
    if (data) {
      const entries = Object.entries(data);
      const recipientEntries = entries.filter(([k]) => k.startsWith('recipient_'));

      if (recipientEntries.length > 0) {
        recipientEntries.forEach(([key, userId]) => {
          const idx = key.replace('recipient_', '');
          const fromVal = data[`from_${idx}`] || '';
          const wishVal = data[`wish_${idx}`] || '';
          createGiftGroup(userId, fromVal, wishVal);
        });
      } else {
        // Создаем одну пустую группу
        createGiftGroup();
      }
    } else {
      // Создаем одну пустую группу
      createGiftGroup();
    }
  };

  // === 5) Ждём USERS_LIST с таймаутом ===
  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderGiftPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

// ============================================================================
// OPEN MODAL
// ============================================================================

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
    ? setupCustomGiftFlow({
        modalFields, btnSubmit, counterWatcher,
        timeoutMs, data, modalAmount,
        giftId: config.giftId,
        giftIcon: config.giftIcon,
        price: config.price
      })
    : setupGiftFlow({
        modalFields, btnSubmit, counterWatcher,
        timeoutMs, data, modalAmount,
        giftId: config.giftId,
        giftIcon: config.giftIcon,
        price: config.price
      });
  return { handled: true, counterWatcher };
}
