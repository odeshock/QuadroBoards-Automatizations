// ============================================================================
// adminForms.js — Административные формы (начисления, докупки, переводы)
// ============================================================================

import {
  COUNTER_POLL_INTERVAL_MS,
  FORM_TIMEOUT_MS,
  BASE_URL
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
  ADMIN_AMOUNT_FORMS,
  FORM_INCOME_TOPUP,
  FORM_INCOME_AMS
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
  waitForGlobalArray
} from './helpers.js';

import { createUserPicker } from './userPicker.js';
import { createSingleUserPicker } from './singleUserPicker.js';

export function setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount = null, basePrice = null }) {
  // 1) Очищаем модальное окно (включая disclaimer)
  clearModalFields(modalFields);

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
  clearModalFields(modalFields);

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
 * Универсальный рендер пикера для выбора пользователей с вводом суммы
 * @param {Object} config - Конфигурация пикера
 * @param {Array} config.users - Список пользователей
 * @param {HTMLElement} config.modalFields - Контейнер модального окна
 * @param {HTMLElement} config.btnSubmit - Кнопка отправки
 * @param {Object} config.data - Данные для prefill
 * @param {boolean} config.requireComment - Требуется ли комментарий
 * @param {HTMLElement} config.modalAmount - Элемент для отображения итоговой суммы
 * @param {number|null} config.basePrice - Базовая цена (для расчетов)
 * @param {string} config.labelText - Текст лейбла
 * @param {string} config.amountFieldName - Имя поля для суммы ('topup' или 'amount')
 * @param {Function} config.onAmountUpdate - Callback для обновления итоговой суммы
 */
function renderUserAmountPicker({
  users,
  modalFields,
  btnSubmit,
  data,
  requireComment = false,
  modalAmount = null,
  basePrice = null,
  labelText = 'Кому начислить и сколько *',
  amountFieldName = 'topup',
  onAmountUpdate = null
}) {
  hideWaitMessage(modalFields);

  // Удаляем старые формы, если они есть
  modalFields.querySelectorAll('.field').forEach(el => el.remove());

  // Каркас
  const wrap = document.createElement('div');
  wrap.className = 'field';

  const chosen = document.createElement('div');
  chosen.className = 'chips';
  wrap.appendChild(chosen);

  const block = document.createElement('div');
  block.className = 'field anketa-combobox';

  const label = document.createElement('label');
  label.textContent = labelText;
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
      .querySelectorAll(`input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="${amountFieldName}_"], input[type="hidden"][name^="comment_"]`)
      .forEach(n => n.remove());

    // пересобираем пары recipient_i + amount_i (+ comment_i) только для валидных сумм
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
      hidA.name = `${amountFieldName}_${i}`;
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

    // Обновляем modal-amount через callback или дефолтную логику
    if (onAmountUpdate) {
      onAmountUpdate(picked, modalAmount, basePrice);
    } else if (modalAmount) {
      // Для форм с basePrice показываем: price × totalAmount = total
      if (basePrice !== null) {
        const price = Number(basePrice);
        const total = price * totalAmount;
        modalAmount.textContent = `${formatNumber(price)} × ${totalAmount} = ${formatNumber(total)}`;
      } else {
        // Для форм без basePrice (TOPUP/AMS) показываем просто сумму
        modalAmount.textContent = totalAmount > 0 ? formatNumber(totalAmount) : '';
      }
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
    text.textContent = user.name;

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

  // Подсказки
  const norm = (s) => String(s ?? '').trim().toLowerCase();
  const buildItem = (u) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggest-item';
    item.setAttribute('role', 'option');
    item.textContent = u.name;
    item.addEventListener('click', () => {
      addChip(u);
      input.value = '';
      list.style.display = 'none';
      input.focus();
    });
    return item;
  };
  const doSearch = () => {
    const q = norm(input.value);
    list.innerHTML = '';
    if (!q) { list.style.display = 'none'; return; }
    const res = users.filter(u => norm(u.name).includes(q) || String(u.id).includes(q)).slice(0, 20);
    if (!res.length) { list.style.display = 'none'; return; }
    res.forEach(u => list.appendChild(buildItem(u)));

    // Позиционируем suggest относительно input (fixed positioning)
    const rect = input.getBoundingClientRect();
    list.style.top = `${rect.bottom + 6}px`;
    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;
    list.style.display = 'block';
  };
  input.addEventListener('input', doSearch);
  input.addEventListener('focus', doSearch);
  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) list.style.display = 'none';
  });

  // Prefill из data: recipient_i + amount_i (+ comment_i если requireComment)
  if (data) {
    const ids = Object.keys(data)
      .filter(k => /^recipient_\d+$/.test(k))
      .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10));
    ids.forEach((rk) => {
      const idx = rk.slice(10);
      const rid = String(data[rk]).trim();
      if (!rid) return;
      const amount = String(data[`${amountFieldName}_${idx}`] ?? '').trim();
      const u = users.find(x => String(x.id) === rid);
      if (u) {
        const comment = requireComment ? String(data[`comment_${idx}`] ?? '').trim() : '';
        addChip(u, amount, comment);
      }
    });
    syncHiddenFields();
  }

  // изначально submit скрыт, пока нет валидных пар
  disableSubmitButton(btnSubmit);
}

/**
 * Обертка для рендера пикера админского начисления (Докупить кредиты / Выдать денежку дополнительно)
 */
function renderAdminTopupPicker({ users, modalFields, btnSubmit, data, requireComment, modalAmount, basePrice }) {
  return renderUserAmountPicker({
    users,
    modalFields,
    btnSubmit,
    data,
    requireComment,
    modalAmount,
    basePrice,
    labelText: 'Кому начислить и сколько *',
    amountFieldName: 'amount'
  });
}

export function setupAdminTopupFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, requireComment = false, modalAmount, basePrice = null, templateId = null }) {
  // 1) Очищаем модальное окно (включая disclaimer)
  clearModalFields(modalFields);

  // 2) Добавляем информационное сообщение о системе подсчёта (только для FORM_INCOME_TOPUP)
  if (templateId === FORM_INCOME_TOPUP) {
    const systemInfoBlock = document.createElement('div');
    systemInfoBlock.className = 'system-info';
    systemInfoBlock.innerHTML = `<strong>Система подсчета:</strong> по галлеону за 1 кредит или 100 баллов, внесённые в «<strong><a href="${BASE_URL}/mod/foundation" target="_blank">Фонд форума</a></strong>».`;
    modalFields.appendChild(systemInfoBlock);
  }

  // Очищаем modalAmount для админов (будет обновлено при вводе данных)
  if (modalAmount) {
    modalAmount.textContent = '';
  }

  // 3) Показываем сообщение ожидания
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
  clearModalFields(modalFields);

  // 2) Добавляем информационное сообщение о системе подсчёта
  const systemInfoBlock = document.createElement('div');
  systemInfoBlock.className = 'system-info';
  const commissionText = basePrice !== null ? formatNumber(basePrice) : '10';
  systemInfoBlock.innerHTML = `<strong>Система подсчета:</strong> ваша сумма + ${commissionText} галлеонов за каждого пользователя`;
  modalFields.appendChild(systemInfoBlock);

  // Устанавливаем начальное значение modalAmount
  if (modalAmount && basePrice !== null) {
    modalAmount.textContent = formatNumber(basePrice);
  }

  // 3) Показываем сообщение ожидания
  showWaitMessage(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  const fail = () => {
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    disableSubmitButton(btnSubmit);
  };

  // === 3) Callback для обновления стоимости в Transfer форме ===
  const handleTransferAmountUpdate = (picked, modalAmount, basePrice) => {
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

    return renderUserAmountPicker({
      users,
      modalFields,
      btnSubmit,
      data,
      requireComment: false,
      modalAmount,
      basePrice,
      labelText: 'Кому перевести и сколько *',
      amountFieldName: 'amount',
      onAmountUpdate: handleTransferAmountUpdate
    });
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

  const config = ADMIN_AMOUNT_CONFIG[template.id];

  // FORM_EXP_TRANSFER доступен всем пользователям, остальные формы - только админам
  if (config.setupFn === 'setupTransferFlow') {
    counterWatcher = setupTransferFlow({
      modalFields,
      btnSubmit,
      counterWatcher,
      timeoutMs: config.timeoutMs,
      data,
      modalAmount,
      basePrice: price
    });
  } else if (!window.IS_ADMIN) {
    // Для админских форм (TOPUP, AMS) показываем информацию для не-админов
    clearModalFields(modalFields);

    // Для TOPUP показываем info и system-info
    if (template.id === FORM_INCOME_TOPUP) {
      const infoBlock = document.createElement('div');
      infoBlock.className = 'info';
      infoBlock.textContent = TEXT_MESSAGES.TOPUP_INFO;
      modalFields.appendChild(infoBlock);

      const systemInfoBlock = document.createElement('div');
      systemInfoBlock.className = 'system-info';
      systemInfoBlock.innerHTML = `<strong>Система подсчета:</strong> по галлеону за 1 кредит или 100 баллов, внесённые в «<strong><a href="${BASE_URL}/mod/foundation" target="_blank">Фонд форума</a></strong>».`;
      modalFields.appendChild(systemInfoBlock);
    }

    // Для AMS показываем только info
    if (template.id === FORM_INCOME_AMS) {
      const infoBlock = document.createElement('div');
      infoBlock.className = 'info';
      infoBlock.textContent = TEXT_MESSAGES.AMS_INFO;
      modalFields.appendChild(infoBlock);
    }

    // Показываем информационное сообщение для не-админов
    if (modalAmount) {
      modalAmount.textContent = 'определяется индивидуально';
    }

    btnSubmit.style.display = 'none';
  } else {
    // Админские формы для админов
    if (config.setupFn === 'setupAdminTopupFlow') {
      counterWatcher = setupAdminTopupFlow({
        modalFields,
        btnSubmit,
        counterWatcher,
        timeoutMs: config.timeoutMs,
        data,
        requireComment: config.requireComment,
        modalAmount,
        basePrice: price,
        templateId: template.id
      });
    }
  }
  return { handled: true, counterWatcher };
}
