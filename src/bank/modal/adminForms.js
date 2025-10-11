// ============================================================================
// adminForms.js — Административные формы (начисления, докупки, переводы)
// ============================================================================

import {
  COUNTER_POLL_INTERVAL_MS,
  FORM_TIMEOUT_MS,
  AMS_TIMEOUT_MS
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
