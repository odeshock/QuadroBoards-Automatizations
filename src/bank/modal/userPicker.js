// ============================================================================
// userPicker.js — Компонент выбора пользователей (autocomplete с чипами)
// ============================================================================

import { formatNumber } from '../services.js';
import { updateModalAmount } from '../results.js';
import { clearRecipientFields, disableSubmitButton } from './helpers.js';

/**
 * Создаёт интерактивный компонент выбора пользователей
 * @param {Object} options - Опции компонента
 * @param {HTMLElement} options.modalFields - Контейнер модального окна
 * @param {HTMLElement} options.btnSubmit - Кнопка отправки
 * @param {Array} options.users - Массив пользователей { id, name }
 * @param {Object} options.data - Данные для prefill (recipient_1, recipient_2, ...)
 * @param {HTMLElement} options.modalAmount - Элемент для отображения суммы (опционально)
 * @param {number} options.basePrice - Базовая цена за одного получателя (опционально)
 * @param {string} options.labelText - Текст label (по умолчанию 'Кому начислить*')
 * @param {string} options.placeholder - Placeholder для input
 * @param {Function} options.onUpdate - Колбэк при изменении списка получателей
 */
export function createUserPicker(options) {
  const {
    modalFields,
    btnSubmit,
    users,
    data = null,
    modalAmount = null,
    basePrice = null,
    labelText = 'Кому начислить*',
    placeholder = 'Начните вводить имя или id...',
    onUpdate = null
  } = options;

  if (!Array.isArray(users)) {
    throw new Error('users must be an array');
  }

  // Создаём структуру DOM
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
  input.placeholder = placeholder;
  input.setAttribute('autocomplete', 'off');

  const list = document.createElement('div');
  list.className = 'suggest';
  list.setAttribute('role', 'listbox');

  box.appendChild(input);
  box.appendChild(list);
  block.appendChild(box);
  wrap.appendChild(block);
  modalFields.appendChild(wrap);

  // Хелперы
  const norm = (s) => String(s ?? '').trim().toLowerCase();
  const picked = new Set();

  // Синхронизация скрытых полей
  const syncHiddenFields = () => {
    clearRecipientFields(modalFields);

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

    // Обновляем modalAmount если нужно
    if (modalAmount && basePrice !== null) {
      const price = Number(basePrice) || 0;
      const totalRecipients = picked.size;
      if (totalRecipients > 0) {
        updateModalAmount(
          modalAmount,
          { dataset: { mode: 'price_per_item', price: String(price), bonus: '0' } },
          { items: totalRecipients }
        );
      } else {
        modalAmount.textContent = formatNumber(price);
      }
    }

    // Вызываем колбэк если есть
    if (onUpdate) {
      onUpdate(Array.from(picked));
    }
  };

  // Добавление чипа
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

  // Portal для suggest (выносим за пределы modal)
  const portalList = list;
  portalList.style.position = 'fixed';
  portalList.style.zIndex = '9999';
  let portalMounted = false;

  const mountPortal = () => {
    if (!portalMounted) {
      document.body.appendChild(portalList);
      portalMounted = true;
    }
  };

  const unmountPortal = () => {
    if (portalMounted) {
      portalList.remove();
      portalMounted = false;
    }
  };

  const positionPortal = () => {
    const r = input.getBoundingClientRect();
    portalList.style.left = `${r.left}px`;
    portalList.style.top = `${r.bottom + 6}px`;
    portalList.style.width = `${r.width}px`;
  };

  const closeSuggest = () => {
    portalList.style.display = 'none';
    unmountPortal();
  };

  const openSuggest = () => {
    mountPortal();
    positionPortal();
    portalList.style.display = 'block';
  };

  // Создание элемента списка
  const buildItem = (u) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggest-item';
    item.setAttribute('role', 'option');
    item.textContent = `${u.name} (id: ${u.id})`;
    item.addEventListener('click', () => {
      const sid = String(u.id);
      if (picked.has(sid)) {
        closeSuggest();
        input.value = '';
        return;
      }
      picked.add(sid);
      addChip(u);
      syncHiddenFields();
      input.value = '';
      closeSuggest();
      input.focus();
    });
    return item;
  };

  // Поиск пользователей
  const doSearch = () => {
    const q = norm(input.value);
    portalList.innerHTML = '';
    if (!q) {
      closeSuggest();
      return;
    }
    const res = users
      .filter(u => norm(u.name).includes(q) || String(u.id).includes(q))
      .slice(0, 20);
    if (!res.length) {
      closeSuggest();
      return;
    }
    res.forEach(u => portalList.appendChild(buildItem(u)));
    openSuggest();
  };

  // События
  input.addEventListener('input', doSearch);
  input.addEventListener('focus', doSearch);
  document.addEventListener('click', (e) => {
    if (!block.contains(e.target) && !portalList.contains(e.target)) {
      closeSuggest();
    }
  });
  window.addEventListener('scroll', () => {
    if (portalList.style.display === 'block') positionPortal();
  }, true);
  window.addEventListener('resize', () => {
    if (portalList.style.display === 'block') positionPortal();
  });

  // Prefill из data
  if (data) {
    const ids = Object.keys(data)
      .filter(k => /^recipient_\d+$/.test(k))
      .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10))
      .map(k => String(data[k]).trim())
      .filter(Boolean);

    ids.forEach((id) => {
      if (picked.has(id)) return;
      const u = users.find(x => String(x.id) === id);
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

  // Начальное состояние кнопки
  if (!picked.size) {
    disableSubmitButton(btnSubmit);
  }

  // Возвращаем API
  return {
    getSelectedIds: () => Array.from(picked),
    addUser: (user) => {
      const sid = String(user.id);
      if (!picked.has(sid)) {
        picked.add(sid);
        addChip(user);
        syncHiddenFields();
      }
    },
    removeUser: (userId) => {
      picked.delete(String(userId));
      // Удаляем соответствующий chip
      const chips = chosen.querySelectorAll('.chip');
      chips.forEach(chip => {
        const chipText = chip.textContent;
        if (chipText.includes(`id: ${userId}`)) {
          chip.remove();
        }
      });
      syncHiddenFields();
    },
    clear: () => {
      picked.clear();
      chosen.innerHTML = '';
      syncHiddenFields();
    },
    destroy: () => {
      unmountPortal();
      wrap.remove();
    }
  };
}

/**
 * Создаёт интерактивный компонент выбора ОДНОГО пользователя (single select)
 */
export function createSingleUserPicker(options) {
  const {
    modalFields,
    btnSubmit,
    users,
    data = null,
    modalAmount = null,
    basePrice = null,
    labelText = 'Получатель *',
    placeholder = 'Начните вводить имя или id...',
    onUpdate = null
  } = options;

  if (!Array.isArray(users)) throw new Error('users must be an array');

  const block = document.createElement('div');
  block.className = 'field anketa-combobox';

  const label = document.createElement('label');
  label.textContent = labelText;
  block.appendChild(label);

  const box = document.createElement('div');
  box.className = 'combo';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.setAttribute('autocomplete', 'off');
  input.required = true;

  const list = document.createElement('div');
  list.className = 'suggest';
  list.setAttribute('role', 'listbox');

  box.appendChild(input);
  box.appendChild(list);
  block.appendChild(box);
  modalFields.appendChild(block);

  let pickedId = '';
  let pickedName = '';
  const norm = (s) => String(s ?? '').trim().toLowerCase();

  const syncHiddenFields = () => {
    clearRecipientFields(modalFields);
    if (pickedId) {
      const hid = document.createElement('input');
      hid.type = 'hidden';
      hid.name = 'recipient_1';
      hid.value = pickedId;
      modalFields.appendChild(hid);
    }
    btnSubmit.style.display = pickedId ? '' : 'none';
    btnSubmit.disabled = !pickedId;
    if (modalAmount && basePrice !== null) {
      modalAmount.textContent = formatNumber(Number(basePrice) || 0);
    }
    if (onUpdate) onUpdate(pickedId ? { id: pickedId, name: pickedName } : null);
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
      pickedId = String(u.id);
      pickedName = u.name;
      input.value = `${u.name} (id: ${u.id})`;
      syncHiddenFields();
      closeSuggest();
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

  if (data) {
    const ids = Object.keys(data).filter(k => /^recipient_\d+$/.test(k))
      .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10))
      .map(k => String(data[k]).trim()).filter(Boolean);
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
      syncHiddenFields();
    }
  }

  if (!pickedId) {
    disableSubmitButton(btnSubmit);
  }

  return {
    getSelectedId: () => pickedId,
    getSelectedUser: () => (pickedId ? { id: pickedId, name: pickedName } : null),
    setUser: (user) => {
      pickedId = String(user.id);
      pickedName = user.name;
      input.value = `${user.name} (id: ${user.id})`;
      syncHiddenFields();
    },
    clear: () => { pickedId = ''; pickedName = ''; input.value = ''; syncHiddenFields(); },
    destroy: () => { unmountPortal(); block.remove(); }
  };
}
