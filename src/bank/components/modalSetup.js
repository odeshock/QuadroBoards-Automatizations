// ============================================================================
// modalSetup.js — Setup-функции для различных типов модальных окон
// ============================================================================

import {
  COUNTER_POLL_INTERVAL_MS,
  FORM_TIMEOUT_MS,
  AMS_TIMEOUT_MS,
  GIFT_TIMEOUT_MS,
  counterConfigs,
  counterPrefixMap
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
  TEXT_MESSAGES
} from '../constants.js';

import {
  BANNER_ALREADY_PROCESSED_CONFIG
} from './modalConfig.js';

// Вспомогательные функции импортируются из других модулей
// updateModalAmount, updateNote, setHiddenField и т.д. определены в components.js

export function handleBannerAlreadyProcessed({ template, modalTitle, modalFields, btnSubmit, backdrop }) {
  const config = BANNER_ALREADY_PROCESSED_CONFIG[template.id];
  if (!config) return { handled: false, shouldReturn: false };

  const flagValue = typeof window !== 'undefined' ? window[config.flagKey] : undefined;
  if (typeof flagValue === 'undefined' || flagValue !== false) {
    return { handled: false, shouldReturn: false };
  }

  modalFields.innerHTML = `<p><strong>${config.message}</strong></p>`;
  btnSubmit.style.display = 'none';

  backdrop.setAttribute('open', '');

  return { handled: true, shouldReturn: true };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================


import {
  renderLog,
  buildOperationsArray,
  showConfirmModal,
  calculateCost,
  updateModalAmount,
  cleanupCounterWatcher,
  updateNote,
  setHiddenField
} from './results.js';

// Re-export for backward compatibility
export { renderLog, buildOperationsArray, showConfirmModal, calculateCost };

// ============================================================================
// HELPER FUNCTIONS (moved to results.js)
// ============================================================================
// nodeToBBCode, buildOperationsArray, renderLog moved to results.js

// ============================================================================
// ADMIN FLOWS
// ============================================================================

export function setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount = null, basePrice = null }) {
  // 1) убрать лишние инфо-плашки из шаблона
  (() => {
    modalFields.querySelectorAll('.gift-note, .muted-note, .note-error, .callout, [data-info]')
      .forEach(el => el.remove());
    const maybeInfo = Array.from(modalFields.children)
      .find(el => /Начисление производит администратор/i.test(el.textContent || ''));
    if (maybeInfo) maybeInfo.remove();
  })();

  // 2) показать «ждём…» (якорь для ошибок)
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = TEXT_MESSAGES.PLEASE_WAIT;
  modalFields.prepend(waitNote);

  const hideWait = () => { const el = modalFields.querySelector('.admin-wait-note'); if (el) el.remove(); };
  const showError = (msg) => {
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      const anchor = modalFields.querySelector('.admin-wait-note');
      if (anchor) anchor.insertAdjacentElement('afterend', err);
      else modalFields.prepend(err);
    }
    err.textContent = msg || 'Произошла ошибка. Попробуйте обновить страницу.';
  };
  const clearError = () => { const err = modalFields.querySelector('.note-error.admin-error'); if (err) err.remove(); };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    hideWait();
    showError('Произошла ошибка. Попробуйте обновить страницу.');
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
    cancel();
  };

  const renderAdminPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();
    clearError();

    const wrap = document.createElement('div');
    wrap.className = 'field';

    const chosen = document.createElement('div');
    chosen.className = 'chips';
    wrap.appendChild(chosen);

    const block = document.createElement('div');
    block.className = 'field anketa-combobox';

    const label = document.createElement('label');
    label.textContent = 'Кому начислить*';
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

    const norm = (s) => String(s ?? '').trim().toLowerCase();
    const picked = new Set();

    const syncHiddenFields = () => {
      modalFields.querySelectorAll('input[type="hidden"][name^="recipient_"]').forEach(n => n.remove());
      let i = 1;
      picked.forEach((id) => {
        const hid = document.createElement('input');
        hid.type = 'hidden';
        hid.name = `recipient_${i++}`;
        hid.value = String(id);
        modalFields.appendChild(hid);
      });
      btnSubmit.style.display = picked.size ? '' : 'none';
      btnSubmit.disabled = picked.size === 0;

      // Обновляем modalAmount: price × количество получателей
      if (modalAmount && basePrice !== null) {
        const price = Number(basePrice) || 0;
        const totalRecipients = picked.size;
        if (totalRecipients > 0) {
          updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(price), bonus: '0' } }, { items: totalRecipients });
        } else {
          modalAmount.textContent = formatNumber(price);
        }
      }
    };

    const addChip = (user) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';

      const text = document.createElement('span');
      text.textContent = `${user.name} (id: ${user.id})`;

      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.title = 'Удалить';
      del.style.border = 'none';
      del.style.background = 'transparent';
      del.style.cursor = 'pointer';
      del.style.fontSize = '16px';
      del.addEventListener('click', () => {
        picked.delete(String(user.id));
        chip.remove();
        syncHiddenFields();
      });

      chip.append(text, del);
      chosen.appendChild(chip);
    };

    const portalList = list;
    portalList.style.position = 'fixed';
    portalList.style.zIndex = '9999';
    let portalMounted = false;
    const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
    const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
    const positionPortal = () => {
      const r = input.getBoundingClientRect();
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
        const sid = String(u.id);
        if (picked.has(sid)) { closeSuggest(); input.value = ''; return; }
        picked.add(sid);
        addChip(u);
        syncHiddenFields();
        input.value = '';
        closeSuggest();
        input.focus();
      });
      return item;
    };

    const doSearch = () => {
      const q = norm(input.value);
      portalList.innerHTML = '';
      if (!q) { closeSuggest(); return; }
      const res = users
        .filter(u => norm(u.name).includes(q) || String(u.id).includes(q))
        .slice(0, 20);
      if (!res.length) { closeSuggest(); return; }
      res.forEach(u => portalList.appendChild(buildItem(u)));
      openSuggest();
    };

    input.addEventListener('input', doSearch);
    input.addEventListener('focus', doSearch);
    document.addEventListener('click', (e) => {
      if (!block.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
    });
    window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
    window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

    // Prefill из data
    if (data) {
      const ids = Object.keys(data)
        .filter(k => /^recipient_\d+$/.test(k))
        .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10))
        .map(k => String(data[k]).trim())
        .filter(Boolean);

      ids.forEach((id) => {
        if (picked.has(id)) return;
        const u = Array.isArray(users) ? users.find(x => String(x.id) === id) : null;
        if (u) {
          picked.add(String(u.id));
          addChip(u);
        } else {
          picked.add(id);
          addChip({ name: 'Неизвестный', id });
        }
      });

      syncHiddenFields();
    }

    if (!picked.size) {
      btnSubmit.style.display = 'none';
      btnSubmit.disabled = true;
    }
  };

  const to = setTimeout(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) return fail();
    return fail();
  }, timeoutMs);

  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderAdminPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

export function setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount = null, basePrice = null }) {
  // удалить инфо-элементы
  (() => {
    modalFields.querySelectorAll('.gift-note, .muted-note, .note-error, .callout, [data-info]')
      .forEach(el => el.remove());
    const maybeInfo = Array.from(modalFields.children)
      .find(el => /Начисление производит администратор/i.test(el.textContent || ''));
    if (maybeInfo) maybeInfo.remove();
  })();

  // "ждём..."
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = TEXT_MESSAGES.PLEASE_WAIT;
  modalFields.prepend(waitNote);

  const hideWait = () => { const el = modalFields.querySelector('.admin-wait-note'); if (el) el.remove(); };
  const showError = (msg) => {
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      const anchor = modalFields.querySelector('.admin-wait-note');
      if (anchor) anchor.insertAdjacentElement('afterend', err);
      else modalFields.prepend(err);
    }
    err.textContent = msg || 'Произошла ошибка. Попробуйте обновить страницу.';
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    hideWait();
    showError('Произошла ошибка. Попробуйте обновить страницу.');
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
    cancel();
  };

  const renderAdminPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    const block = document.createElement('div');
    block.className = 'field anketa-combobox';

    const label = document.createElement('label');
    label.textContent = 'Получатель *';
    block.appendChild(label);

    const box = document.createElement('div');
    box.className = 'combo';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Начните вводить имя или id...';
    input.setAttribute('autocomplete', 'off');
    input.required = true;

    const list = document.createElement('div');
    list.className = 'suggest';
    list.setAttribute('role', 'listbox');

    box.appendChild(input);
    box.appendChild(list);
    block.appendChild(box);
    modalFields.appendChild(block);

    // единственный выбранный id (строка)
    let pickedId = '';
    let pickedName = '';

    const syncHiddenFields = () => {
      modalFields.querySelectorAll('input[type="hidden"][name^="recipient_"]').forEach(n => n.remove());
      if (pickedId) {
        const hid = document.createElement('input');
        hid.type = 'hidden';
        hid.name = 'recipient_1';
        hid.value = pickedId;
        modalFields.appendChild(hid);
      }
      btnSubmit.style.display = pickedId ? '' : 'none';
      btnSubmit.disabled = !pickedId;

      // Обновляем modalAmount: показываем price (для 1 получателя)
      if (modalAmount && basePrice !== null) {
        const price = Number(basePrice) || 0;
        modalAmount.textContent = formatNumber(price);
      }
    };

    const portalList = list;
    portalList.style.position = 'fixed';
    portalList.style.zIndex = '9999';
    let portalMounted = false;
    const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
    const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
    const positionPortal = () => {
      const r = input.getBoundingClientRect();
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
        pickedId = String(u.id);
        pickedName = u.name;
        input.value = `${u.name} (id: ${u.id})`;
        syncHiddenFields();
        closeSuggest();
      });
      return item;
    };

    const norm = (s) => String(s ?? '').trim().toLowerCase();
    const doSearch = () => {
      const q = norm(input.value);
      portalList.innerHTML = '';
      if (!q) { closeSuggest(); return; }
      const res = users
        .filter(u => norm(u.name).includes(q) || String(u.id).includes(q))
        .slice(0, 20);
      if (!res.length) { closeSuggest(); return; }
      res.forEach(u => portalList.appendChild(buildItem(u)));
      openSuggest();
    };

    input.addEventListener('input', doSearch);
    input.addEventListener('focus', doSearch);
    document.addEventListener('click', (e) => {
      if (!block.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
    });
    window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
    window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

    // Prefill из data (берём только первого)
    if (data) {
      const ids = Object.keys(data)
        .filter(k => /^recipient_\d+$/.test(k))
        .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10))
        .map(k => String(data[k]).trim())
        .filter(Boolean);
      const first = ids[0];
      if (first) {
        const u = users.find(x => String(x.id) === first);
        if (u) {
          pickedId = String(u.id);
          pickedName = u.name;
          input.value = `${u.name} (id: ${u.id})`;
        } else {
          pickedId = first;
          pickedName = 'Неизвестный';
          input.value = `Неизвестный (id: ${first})`;
        }
      }
      syncHiddenFields();
    }

    // изначально скрыта
    if (!pickedId) {
      btnSubmit.style.display = 'none';
      btnSubmit.disabled = true;
    }
  };

  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderAdminPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

export function setupAdminTopupFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, requireComment = false, modalAmount, basePrice = null }) {
  // === 1) Удаляем дисклеймер и прочие инфо-элементы — у админа их быть НЕ должно ===
  modalFields.querySelectorAll('.info, .gift-note, .muted-note, .note-error, .callout, [data-info]')
    .forEach(el => el.remove());
  const maybeInfo = Array.from(modalFields.children)
    .find(el => /Начисление производит администратор/i.test(el.textContent || ''));
  if (maybeInfo) maybeInfo.remove();

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
      modalFields.prepend(err);
    }
    err.textContent = msg || 'Произошла ошибка. Попробуйте обновить страницу.';
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Попробуйте обновить страницу.');
    cancel();
  };

  // === 3) Когда USERS_LIST готов — рисуем пикер с суммой на каждого ===
  const renderAdminPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    // Каркас
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const chosen = document.createElement('div');
    chosen.className = 'chips';
    wrap.appendChild(chosen);

    const block = document.createElement('div');
    block.className = 'field anketa-combobox';

    const label = document.createElement('label');
    label.textContent = 'Кому начислить и сколько*';
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
      chip.className = 'chip';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';

      const text = document.createElement('span');
      text.textContent = `${user.name} (id: ${user.id})`;

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '1';
      amount.step = '1';
      amount.placeholder = 'сколько';
      amount.value = prefillAmount || '';
      amount.required = true;
      amount.style.width = '90px';
      amount.addEventListener('input', syncHiddenFields);

      let commentInput = null;
      if (requireComment) {
        commentInput = document.createElement('input');
        commentInput.type = 'text';
        commentInput.placeholder = 'за что *';
        commentInput.value = prefillComment || '';
        commentInput.style.width = '150px';
        commentInput.required = true;
        commentInput.addEventListener('input', syncHiddenFields);
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.title = 'Удалить';
      del.style.border = 'none';
      del.style.background = 'transparent';
      del.style.cursor = 'pointer';
      del.style.fontSize = '16px';
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
    const portalList = list;
    portalList.style.position = 'fixed';
    portalList.style.zIndex = '9999';
    let portalMounted = false;
    const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
    const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
    const positionPortal = () => {
      const r = input.getBoundingClientRect();
      portalList.style.left = `${r.left}px`;
      portalList.style.top  = `${r.bottom + 6}px`;
      portalList.style.width = `${r.width}px`;
    };
    const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
    const openSuggest  = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

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
        closeSuggest();
        input.focus();
      });
      return item;
    };
    const doSearch = () => {
      const q = norm(input.value);
      portalList.innerHTML = '';
      if (!q) { closeSuggest(); return; }
      const res = users.filter(u => norm(u.name).includes(q) || String(u.id).includes(q)).slice(0, 20);
      if (!res.length) { closeSuggest(); return; }
      res.forEach(u => portalList.appendChild(buildItem(u)));
      openSuggest();
    };
    input.addEventListener('input', doSearch);
    input.addEventListener('focus', doSearch);
    document.addEventListener('click', (e) => {
      if (!block.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
    });
    window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
    window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

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
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  // === 4) Ждём USERS_LIST с таймаутом ===
  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderAdminPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

// ============================================================================
// SETUP TRANSFER FLOW - Перевод средств другому (комиссия)
// ============================================================================

export function setupTransferFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, basePrice = null }) {
  // === 1) Удаляем существующие поля формы ===
  modalFields.querySelectorAll('.info, .gift-note, .muted-note, .note-error, .callout, [data-info], .field')
    .forEach(el => el.remove());

  // Устанавливаем начальное значение modalAmount
  if (modalAmount && basePrice !== null) {
    modalAmount.textContent = formatNumber(basePrice);
  }

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
      chip.className = 'chip';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';

      const text = document.createElement('span');
      text.textContent = `${user.name} (id: ${user.id})`;

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '1';
      amount.step = '1';
      amount.placeholder = 'сколько';
      amount.value = prefillAmount || '';
      amount.required = true;
      amount.style.width = '90px';
      amount.addEventListener('input', syncHiddenFields);

      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.title = 'Удалить';
      del.style.border = 'none';
      del.style.background = 'transparent';
      del.style.cursor = 'pointer';
      del.style.fontSize = '16px';
      del.addEventListener('click', () => removeChip(sid));

      chip.append(text, amount, del);
      chosen.appendChild(chip);

      picked.set(sid, { id: sid, name: user.name, amountInput: amount, el: chip });
      syncHiddenFields();
    };

    // Подсказки (портал)
    const portalList = list;
    portalList.style.position = 'fixed';
    portalList.style.zIndex = '9999';

    const hideList = () => { portalList.innerHTML = ''; portalList.style.display = 'none'; };

    const showList = (items) => {
      portalList.innerHTML = '';
      if (!items.length) { hideList(); return; }

      items.forEach(u => {
        const item = document.createElement('div');
        item.className = 'suggest-item';
        item.textContent = `${u.name} (id: ${u.id})`;
        item.setAttribute('role', 'option');
        item.addEventListener('click', () => {
          addChip(u);
          input.value = '';
          hideList();
        });
        portalList.appendChild(item);
      });

      const rect = input.getBoundingClientRect();
      portalList.style.left = rect.left + 'px';
      portalList.style.top = rect.bottom + 'px';
      portalList.style.width = rect.width + 'px';
      portalList.style.display = 'block';
    };

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { hideList(); return; }
      const matches = users
        .filter(u => u.name.toLowerCase().includes(q) || String(u.id).includes(q))
        .slice(0, 10);
      showList(matches);
    });

    input.addEventListener('blur', () => setTimeout(hideList, 200));

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
  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderTransferPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

// ============================================================================
// SETUP CUSTOM GIFT FLOW - Индивидуальные подарки
// ============================================================================

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
// SETUP BONUS/MASK/CLEAN FLOW - Бонусы, Маска, Жилет
// ============================================================================

export function setupBonusMaskCleanFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, basePrice }) {
  // === 1) Удаляем существующие поля формы ===
  modalFields.querySelectorAll('.info, .gift-note, .muted-note, .note-error, .callout, [data-info], .field, .gift-groups')
    .forEach(el => el.remove());

  const disclaimer = document.createElement('div');
  disclaimer.className = 'info';
  disclaimer.textContent = 'Можете выбрать себя или другого игрока';
  modalFields.insertBefore(disclaimer, modalFields.firstChild);

  // === 2) Показываем "Пожалуйста, подождите..." пока ждём USERS_LIST ===
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = TEXT_MESSAGES.PLEASE_WAIT;
  modalFields.appendChild(waitNote);

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
      disclaimer.insertAdjacentElement('afterend', err);
    }
    err.textContent = msg || 'Произошла ошибка. Пожалуйста, обновите страницу.';
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  let canceled = false;
  const cancel = () => { canceled = true; };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Пожалуйста, обновите страницу.');
    cancel();
  };

  const renderPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

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
      recipientLabel.textContent = 'Получатель *';

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
        recipientInput.value = `${prefillUser.name} (id: ${prefillUser.id})`;
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
      qtyLabel.textContent = 'Количество *';
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
      fromLabel.textContent = 'От кого';
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
      wishLabel.textContent = 'Комментарий';
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
        item.textContent = `${u.name} (id: ${u.id})`;
        item.addEventListener('click', () => {
          recipientInput.value = `${u.name} (id: ${u.id})`;
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
  let counter = 0;
  const poll = setInterval(() => {
    if (canceled) return;
    if (window.USERS_LIST && Array.isArray(window.USERS_LIST)) {
      clearInterval(poll);
      clearTimeout(to);
      renderPicker(window.USERS_LIST);
    } else {
      counter++;
    }
  }, 100);

  const to = setTimeout(() => {
    if (!canceled) {
      clearInterval(poll);
      fail();
    }
  }, timeoutMs);

  return counterWatcher;
}

export function normalizePostItem(raw) {
  const candidate = (raw && (raw.link || raw.a || raw)) || raw || null;
  const src = candidate && typeof candidate.src === 'string' ? candidate.src : null;
  if (!src) return null;
  const text = candidate.text || src;
  const symbolsRaw = candidate.symbols_num;
  const numericSymbols = Number.isFinite(symbolsRaw)
    ? symbolsRaw
    : Number.parseInt(typeof symbolsRaw === 'string' ? symbolsRaw : '', 10) || 0;
  return { src, text, symbols_num: Math.max(0, numericSymbols) };
}

export function setupPostsModalFlow({
  modalFields,
  btnSubmit,
  counterWatcher,
  form,
  modalAmount,
  modalAmountLabel,
  hiddenFieldName,
  postsKey,
  timeoutMs,
  previewId,
  infoBuilder,
  additionalItemsAggregator
}) {
  const waitEl = updateNote(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  const price = Number(form.dataset.price) || 0;
  const bonus = Number(form.dataset.bonus) || 0;

  const info = document.createElement('div');
  info.className = 'calc-info';
  info.innerHTML = infoBuilder({ price, bonus });

  if (waitEl && waitEl.parentNode) {
    waitEl.parentNode.insertBefore(info, waitEl);
  } else {
    modalFields.appendChild(info);
  }

  let canceled = false;
  let poll = null;
  let timeoutHandle = null;

  const cancel = () => {
    canceled = true;
    if (poll) clearInterval(poll);
    if (timeoutHandle) clearTimeout(timeoutHandle);
  };

  counterWatcher = { cancel };

  const setSummary = (count, additionalItems) => {
    modalAmountLabel.textContent = form.dataset.amountLabel || 'Начисление';
    updateModalAmount(modalAmount, form, {
      items: count,
      additional_items: additionalItems
    });
  };

  const fail = () => {
    if (canceled) return;
    updateNote(modalFields, 'Произошла ошибка. Попробуйте обновить страницу.', { error: true });
    btnSubmit.style.display = 'none';
    setHiddenField(modalFields, hiddenFieldName, '');
    cancel();
  };

  const renderList = (items) => {
    const caption = document.createElement('p');
    caption.className = 'list-caption';
    caption.innerHTML = '<strong>Список постов:</strong>';
    modalFields.appendChild(caption);

    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `
      <div style="max-height:320px; overflow:auto">
        <ol class="entry-list" id="${previewId}"></ol>
      </div>`;
    modalFields.appendChild(wrap);

    const listEl = wrap.querySelector(`#${previewId}`);
    items.forEach(({ src, text, symbols_num }) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = src;
      link.textContent = text || src;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      li.appendChild(link);
      li.appendChild(document.createTextNode(` [${symbols_num} символов]`));
      listEl.appendChild(li);
    });
  };

  const succeed = (posts) => {
    if (canceled) return;

    const items = Array.isArray(posts) ? posts.map(normalizePostItem).filter(Boolean) : [];
    if (!items.length) {
      updateNote(modalFields, '**Для новых начислений не хватает новых постов.**');
      btnSubmit.style.display = 'none';
      setHiddenField(modalFields, hiddenFieldName, '');
      setSummary(0, 0);
      cancel();
      return;
    }

    setHiddenField(modalFields, hiddenFieldName, JSON.stringify(items));

    const note = updateNote(modalFields, '');
    if (note) note.remove();

    renderList(items);

    const additionalItems = additionalItemsAggregator(items);
    setSummary(items.length, additionalItems);

    form.dataset.currentMultiplier = String(items.length);
    btnSubmit.style.display = '';
    btnSubmit.disabled = false;
    cancel();
  };

  const globalObj = typeof window !== 'undefined' ? window : undefined;

  timeoutHandle = setTimeout(fail, timeoutMs);

  poll = setInterval(() => {
    if (!globalObj) return;
    const value = globalObj[postsKey];
    if (typeof value !== 'undefined' && !Array.isArray(value)) {
      fail();
      return;
    }
    if (Array.isArray(value)) {
      clearInterval(poll);
      poll = null;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      succeed(value);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

