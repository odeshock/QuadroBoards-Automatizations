// ============================================================================
// adminForms.js — Административные формы (начисления, докупки, переводы)
// ============================================================================

import {
  COUNTER_POLL_INTERVAL_MS,
  FORM_TIMEOUT_MS
} from '../config.js';

import {
  formatNumber,
  parseNumericAmount,
  roundNewToAnchorDOM,
  fullMonthsDiffVirtualDOM,
  fmtYMD,
  updateAutoDiscounts
} from '../services.js';

import {
  TEXT_MESSAGES,
  ADMIN_RECIPIENT_MULTI_FORMS,
  ADMIN_SINGLE_RECIPIENT_FORMS,
  ADMIN_AMOUNT_FORMS
} from '../constants.js';

import {
  ADMIN_RECIPIENT_FLOW_TIMEOUTS,
  ADMIN_SINGLE_RECIPIENT_TIMEOUTS,
  ADMIN_AMOUNT_CONFIG
} from './config.js';

import {
  updateModalAmount
} from '../results.js';

import {
  clearModalFields,
  showWaitMessage,
  hideWaitMessage,
  showErrorMessage,
  disableSubmitButton,
  waitForGlobalArray,
  createPortal
} from './helpers.js';

import { createUserPicker } from './userPicker.js';
import { createSingleUserPicker } from './singleUserPicker.js';

export function setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount = null, basePrice = null }) {
  // 1) Очищаем модальное окно (включая disclaimer)
  clearModalFields(modalFields, { includeInfo: true });

  // 2) Показываем сообщение ожидания
  showWaitMessage(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  // 3) Функция для отображения ошибки
  const fail = () => {
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    disableSubmitButton(btnSubmit);
  };

  // 4) Ожидаем USERS_LIST и создаём user picker
  counterWatcher = waitForGlobalArray(
    'USERS_LIST',
    timeoutMs,
    (users) => {
      hideWaitMessage(modalFields);
      createUserPicker({
        modalFields,
        btnSubmit,
        users,
        data,
        modalAmount,
        basePrice,
        labelText: 'Кому начислить *',
        placeholder: 'Начните вводить имя или id...'
      });
    },
    fail
  );

  return counterWatcher;
}

export function setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount = null, basePrice = null }) {
  // 1) Очищаем модальное окно (включая disclaimer)
  clearModalFields(modalFields, { includeInfo: true });

  // 2) Показываем сообщение ожидания
  showWaitMessage(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  // 3) Функция для отображения ошибки
  const fail = () => {
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    disableSubmitButton(btnSubmit);
  };

  // 4) Ожидаем USERS_LIST и создаём single user picker
  counterWatcher = waitForGlobalArray(
    'USERS_LIST',
    timeoutMs,
    (users) => {
      hideWaitMessage(modalFields);
      createSingleUserPicker({
        modalFields,
        btnSubmit,
        users,
        data,
        modalAmount,
        basePrice,
        labelText: 'Получатель *',
        placeholder: 'Начните вводить имя или id...'
      });
    },
    fail
  );

  return counterWatcher;
}

/**
 * Рендерит пикер для администраторского начисления с вводом суммы на каждого получателя
 * @param {Array} users - Список пользователей (гарантированно массив от waitForGlobalArray)
 */
function renderAdminTopupPicker({ users, modalFields, btnSubmit, data, requireComment, modalAmount, basePrice }) {
  hideWaitMessage(modalFields);

  // Каркас
  const wrap = document.createElement('div');
  wrap.className = 'field';

  const chosen = document.createElement('div');
  chosen.className = 'chips';
  wrap.appendChild(chosen);

  const block = document.createElement('div');
  block.className = 'field anketa-combobox';

  const label = document.createElement('label');
  label.textContent = 'Кому начислить и сколько *';
  block.appendChild(label);

  const box = document.createElement('div');
  box.className = 'combo';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Начните вводить имя или id...';
  input.setAttribute('autocomplete', 'off');

  const list = document.createElement('div');
  list.className = 'suggest';
  list.setAttribute('role', 'listbox');

  box.appendChild(input);
  box.appendChild(list);
  block.appendChild(box);
  wrap.appendChild(block);
  modalFields.appendChild(wrap);

  // Выбранные: Map<id, { id, name, amountInput, commentInput, el }>
  const picked = new Map();

  const isValidAmount = (raw) => {
    const num = parseNumericAmount(raw);
    return Number.isFinite(num) && num > 0;
  };

  const syncHiddenFields = () => {
    // очищаем прошлые скрытые
    modalFields
      .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="topup_"], input[type="hidden"][name^="comment_"]')
      .forEach(n => n.remove());

    // пересобираем пары recipient_i + topup_i (+ comment_i для AMS) только для валидных сумм
    let i = 1;
    let totalAmount = 0;
    for (const { id, amountInput, commentInput } of picked.values()) {
      const val = amountInput?.value ?? '';
      if (!isValidAmount(val)) continue;

      // Для AMS проверяем наличие комментария
      if (requireComment) {
        const comment = commentInput?.value?.trim() ?? '';
        if (!comment) continue;
      }

      const hidR = document.createElement('input');
      hidR.type = 'hidden';
      hidR.name = `recipient_${i}`;
      hidR.value = String(id);

      const hidA = document.createElement('input');
      hidA.type = 'hidden';
      hidA.name = `topup_${i}`;
      hidA.value = String(val).trim().replace(',', '.');

      modalFields.append(hidR, hidA);

      // Для AMS добавляем комментарий
      if (requireComment && commentInput) {
        const hidC = document.createElement('input');
        hidC.type = 'hidden';
        hidC.name = `comment_${i}`;
        hidC.value = commentInput.value.trim();
        modalFields.append(hidC);
      }

      // Суммируем количество получателей для расчета итого
      totalAmount += parseNumericAmount(val) || 0;
      i++;
    }

    const hasAny = i > 1;
    btnSubmit.style.display = hasAny ? '' : 'none';
    btnSubmit.disabled = !hasAny;

    // Обновляем modal-amount: price × total = итого
    if (modalAmount && basePrice !== null) {
      const price = Number(basePrice);
      const total = price * totalAmount;
      modalAmount.textContent = `${formatNumber(price)} × ${totalAmount} = ${formatNumber(total)}`;
    }
  };

  const removeChip = (id) => {
    const item = picked.get(id);
    if (item && item.el) item.el.remove();
    picked.delete(id);
    syncHiddenFields();
  };

  const addChip = (user, prefillAmount = '', prefillComment = '') => {
    const sid = String(user.id);
    if (picked.has(sid)) return;

    const chip = document.createElement('span');
    chip.className = 'chip chip--flex';

    const text = document.createElement('span');
    text.textContent = `${user.name} (id: ${user.id})`;

    const amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '1';
    amount.step = '1';
    amount.placeholder = 'сколько';
    amount.value = prefillAmount || '';
    amount.required = true;
    amount.addEventListener('input', syncHiddenFields);

    let commentInput = null;
    if (requireComment) {
      commentInput = document.createElement('input');
      commentInput.type = 'text';
      commentInput.placeholder = 'за что *';
      commentInput.value = prefillComment || '';
      commentInput.required = true;
      commentInput.addEventListener('input', syncHiddenFields);
    }

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'chip__delete-btn';
    del.textContent = '×';
    del.title = 'Удалить';
    del.addEventListener('click', () => removeChip(sid));

    if (requireComment) {
      chip.append(text, amount, commentInput, del);
    } else {
      chip.append(text, amount, del);
    }
    chosen.appendChild(chip);

    picked.set(sid, { id: sid, name: user.name, amountInput: amount, commentInput, el: chip });
    syncHiddenFields();
  };

  // Подсказки (портал)
  const portal = createPortal(list, input, block);

  const norm = (s) => String(s ?? '').trim().toLowerCase();
  const buildItem = (u) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggest-item';
    item.setAttribute('role', 'option');
    item.textContent = `${u.name} (id: ${u.id})`;
    item.addEventListener('click', () => {
      addChip(u);
      input.value = '';
      portal.close();
      input.focus();
    });
    return item;
  };
  const doSearch = () => {
    const q = norm(input.value);
    list.innerHTML = '';
    if (!q) { portal.close(); return; }
    const res = users.filter(u => norm(u.name).includes(q) || String(u.id).includes(q)).slice(0, 20);
    if (!res.length) { portal.close(); return; }
    res.forEach(u => list.appendChild(buildItem(u)));
    portal.open();
  };
  input.addEventListener('input', doSearch);
  input.addEventListener('focus', doSearch);

  // Prefill из data: recipient_i + topup_i (+ comment_i для AMS)
  if (data) {
    const ids = Object.keys(data)
      .filter(k => /^recipient_\d+$/.test(k))
      .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10));
    ids.forEach((rk) => {
      const idx = rk.slice(10);
      const rid = String(data[rk]).trim();
      if (!rid) return;
      const amount = String(data[`topup_${idx}`] ?? '').trim();
      const comment = requireComment ? String(data[`comment_${idx}`] ?? '').trim() : '';
      const u = users.find(x => String(x.id) === rid);
      if (u) addChip(u, amount, comment);
      else   addChip({ id: rid, name: 'Неизвестный' }, amount, comment);
    });
    syncHiddenFields();
  }

  // изначально submit скрыт, пока нет валидных пар
  disableSubmitButton(btnSubmit);
}

export function setupAdminTopupFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, requireComment = false, modalAmount, basePrice = null }) {
  // 1) Очищаем модальное окно (включая disclaimer)
  clearModalFields(modalFields, { includeInfo: true });

  // 2) Показываем сообщение ожидания
  showWaitMessage(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  const fail = () => {
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    disableSubmitButton(btnSubmit);
  };

  // 3) Ждём USERS_LIST и рисуем пикер
  counterWatcher = waitForGlobalArray('USERS_LIST', timeoutMs,
    (users) => renderAdminTopupPicker({ users, modalFields, btnSubmit, data, requireComment, modalAmount, basePrice }),
    fail
  );

  return counterWatcher;
}

// ============================================================================
// SETUP TRANSFER FLOW - Перевод средств другому (комиссия)
// ============================================================================

export function setupTransferFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, basePrice = null }) {
  // 1) Очищаем модальное окно
  clearModalFields(modalFields, { includeInfo: true });

  // Устанавливаем начальное значение modalAmount
  if (modalAmount && basePrice !== null) {
    modalAmount.textContent = formatNumber(basePrice);
  }

  // 2) Показываем сообщение ожидания
  showWaitMessage(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  const fail = () => {
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    disableSubmitButton(btnSubmit);
  };

  // === 3) Функция обновления стоимости ===
  const updateTotalCost = (picked) => {
    let totalAmount = 0;
    let count = 0;

    for (const { amountInput } of picked.values()) {
      const val = amountInput?.value ?? '';
      const num = parseNumericAmount(val);
      if (Number.isFinite(num) && num > 0) {
        totalAmount += num;
        count++;
      }
    }

    if (modalAmount) {
      if (count > 0) {
        // Используем режим 'price_w_entered_amount': entered_amount + price × items
        const priceStr = basePrice !== null ? String(basePrice) : '0';
        updateModalAmount(modalAmount, { dataset: { mode: 'price_w_entered_amount', price: priceStr, bonus: '0' } }, {
          items: count,
          entered_amount: totalAmount
        });
      } else {
        // Показываем базовую цену, если нет получателей
        if (basePrice !== null) {
          modalAmount.textContent = formatNumber(basePrice);
        } else {
          modalAmount.textContent = '';
        }
      }
    }

    const commissionPerPerson = basePrice;
    const commission = count * commissionPerPerson;
    const totalCost = totalAmount + commission;
    return { totalAmount, commission, totalCost, count };
  };

  // === 4) Когда USERS_LIST готов — рисуем пикер с суммой на каждого ===
  const renderTransferPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    // Добавляем информационное сообщение
    const infoBlock = document.createElement('div');
    infoBlock.className = 'info';
    const commissionText = basePrice !== null ? formatNumber(basePrice) : '10';
    infoBlock.innerHTML = `<strong>Система подсчета:</strong> ваша сумма + ${commissionText} галлеонов за каждого пользователя`;
    modalFields.appendChild(infoBlock);

    // Каркас
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const chosen = document.createElement('div');
    chosen.className = 'chips';
    wrap.appendChild(chosen);

    const block = document.createElement('div');
    block.className = 'field anketa-combobox';

    const label = document.createElement('label');
    label.textContent = 'Кому перевести и сколько*';
    block.appendChild(label);

    const box = document.createElement('div');
    box.className = 'combo';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Начните вводить имя или id...';
    input.setAttribute('autocomplete', 'off');

    const list = document.createElement('div');
    list.className = 'suggest';
    list.setAttribute('role', 'listbox');

    box.appendChild(input);
    box.appendChild(list);
    block.appendChild(box);
    wrap.appendChild(block);
    modalFields.appendChild(wrap);

    // Выбранные: Map<id, { id, name, amountInput, el }>
    const picked = new Map();

    const isValidAmount = (raw) => {
      const num = parseNumericAmount(raw);
      return Number.isFinite(num) && num > 0;
    };

    const syncHiddenFields = () => {
      // очищаем прошлые скрытые
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="amount_"]')
        .forEach(n => n.remove());

      // пересобираем пары recipient_i + amount_i только для валидных сумм
      let i = 1;
      for (const { id, amountInput } of picked.values()) {
        const val = amountInput?.value ?? '';
        if (!isValidAmount(val)) continue;

        const hidR = document.createElement('input');
        hidR.type = 'hidden';
        hidR.name = `recipient_${i}`;
        hidR.value = String(id);

        const hidA = document.createElement('input');
        hidA.type = 'hidden';
        hidA.name = `amount_${i}`;
        hidA.value = String(val).trim().replace(',', '.');

        modalFields.append(hidR, hidA);
        i++;
      }

      const { count } = updateTotalCost(picked);
      const hasAny = count > 0;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
    };

    const removeChip = (id) => {
      const item = picked.get(id);
      if (item && item.el) item.el.remove();
      picked.delete(id);
      syncHiddenFields();
    };

    const addChip = (user, prefillAmount = '') => {
      const sid = String(user.id);
      if (picked.has(sid)) return;

      const chip = document.createElement('span');
      chip.className = 'chip chip--flex';

      const text = document.createElement('span');
      text.textContent = `${user.name} (id: ${user.id})`;

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '1';
      amount.step = '1';
      amount.placeholder = 'сколько';
      amount.value = prefillAmount || '';
      amount.required = true;
      amount.addEventListener('input', syncHiddenFields);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'chip__delete-btn';
      del.textContent = '×';
      del.title = 'Удалить';
      del.addEventListener('click', () => removeChip(sid));

      chip.append(text, amount, del);
      chosen.appendChild(chip);

      picked.set(sid, { id: sid, name: user.name, amountInput: amount, el: chip });
      syncHiddenFields();
    };

    // Подсказки (портал)
    const portal = createPortal(list, input, block);

    const buildItem = (u) => {
      const item = document.createElement('div');
      item.className = 'suggest-item';
      item.textContent = `${u.name} (id: ${u.id})`;
      item.setAttribute('role', 'option');
      item.addEventListener('click', () => {
        addChip(u);
        input.value = '';
        portal.close();
      });
      return item;
    };

    const doSearch = () => {
      const q = input.value.trim().toLowerCase();
      list.innerHTML = '';
      if (!q) { portal.close(); return; }
      const matches = users
        .filter(u => u.name.toLowerCase().includes(q) || String(u.id).includes(q))
        .slice(0, 10);
      if (!matches.length) { portal.close(); return; }
      matches.forEach(u => list.appendChild(buildItem(u)));
      portal.open();
    };

    input.addEventListener('input', doSearch);
    input.addEventListener('blur', () => setTimeout(() => portal.close(), 200));

    // Восстановление данных при редактировании
    if (data) {
      const entries = Object.entries(data);
      const recipientEntries = entries.filter(([k]) => k.startsWith('recipient_'));
      recipientEntries.forEach(([key, userId]) => {
        const idx = key.replace('recipient_', '');
        const amountKey = `amount_${idx}`;
        const amountVal = data[amountKey] || '';
        const user = users.find(u => String(u.id) === String(userId));
        if (user) addChip(user, amountVal);
      });
    }

    syncHiddenFields();
  };

  // === 5) Ждём USERS_LIST с таймаутом ===
  counterWatcher = waitForGlobalArray('USERS_LIST', timeoutMs, renderTransferPicker, fail);
  return counterWatcher;
}

// ============================================================================
// HANDLERS
// ============================================================================

export function handleAdminRecipientMultiForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, price }) {
  if (!ADMIN_RECIPIENT_MULTI_FORMS.includes(template.id)) return { handled: false, counterWatcher };

  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none';
  } else {
    const timeoutMs = ADMIN_RECIPIENT_FLOW_TIMEOUTS[template.id] ?? FORM_TIMEOUT_MS;
    counterWatcher = setupAdminRecipientsFlow({
      modalFields,
      btnSubmit,
      counterWatcher,
      timeoutMs,
      data,
      modalAmount,
      basePrice: price
    });
  }
  return { handled: true, counterWatcher };
}

export function handleAdminSingleRecipientForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, price }) {
  if (!ADMIN_SINGLE_RECIPIENT_FORMS.includes(template.id)) return { handled: false, counterWatcher };

  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none';
  } else {
    const timeoutMs = ADMIN_SINGLE_RECIPIENT_TIMEOUTS[template.id] ?? FORM_TIMEOUT_MS;
    counterWatcher = setupAdminSingleRecipientFlow({
      modalFields,
      btnSubmit,
      counterWatcher,
      timeoutMs,
      data,
      modalAmount,
      basePrice: price
    });
  }
  return { handled: true, counterWatcher };
}

export function handleAdminAmountForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, price }) {
  if (!ADMIN_AMOUNT_FORMS.includes(template.id)) return { handled: false, counterWatcher };

  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none';
  } else {
    const config = ADMIN_AMOUNT_CONFIG[template.id];
    if (config.setupFn === 'setupAdminTopupFlow') {
      counterWatcher = setupAdminTopupFlow({
        modalFields,
        btnSubmit,
        counterWatcher,
        timeoutMs: config.timeoutMs,
        data,
        requireComment: config.requireComment,
        modalAmount,
        basePrice: price
      });
    } else if (config.setupFn === 'setupTransferFlow') {
      counterWatcher = setupTransferFlow({
        modalFields,
        btnSubmit,
        counterWatcher,
        timeoutMs: config.timeoutMs,
        data,
        modalAmount,
        basePrice: price
      });
    }
  }
  return { handled: true, counterWatcher };
}
