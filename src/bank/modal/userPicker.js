// ============================================================================
// userPicker.js — Компонент выбора пользователей (autocomplete с чипами)
// ============================================================================

import { formatNumber } from '../services.js';
import { updateModalAmount } from '../results.js';
import { clearRecipientFields, disableSubmitButton, normalizeString } from './helpers.js';

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
  const norm = normalizeString;
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

    // Кнопка всегда видна и активна (при пустых получателях операция удаляется в app.js)
    btnSubmit.style.display = '';
    btnSubmit.disabled = false;

    // Обновляем modalAmount если нужно
    if (modalAmount && basePrice !== null) {
      const price = Number(basePrice) || 0;
      const totalRecipients = picked.size;
      // Всегда показываем формулу с количеством получателей
      updateModalAmount(
        modalAmount,
        { dataset: { mode: 'price_per_item', price: String(price), bonus: '0' } },
        { items: totalRecipients }
      );
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
    text.textContent = user.name;

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

  // Создание элемента списка
  const buildItem = (u) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggest-item';
    item.setAttribute('role', 'option');
    item.textContent = u.name;
    item.addEventListener('click', () => {
      const sid = String(u.id);
      if (picked.has(sid)) {
        list.style.display = 'none';
        input.value = '';
        return;
      }
      picked.add(sid);
      addChip(u);
      syncHiddenFields();
      input.value = '';
      list.style.display = 'none';
      input.focus();
    });
    return item;
  };

  // Поиск пользователей
  const doSearch = () => {
    const q = norm(input.value);
    list.innerHTML = '';
    if (!q) {
      list.style.display = 'none';
      return;
    }
    const res = users
      .filter(u => norm(u.name).includes(q) || String(u.id).includes(q))
      .slice(0, 20);
    if (!res.length) {
      list.style.display = 'none';
      return;
    }
    res.forEach(u => list.appendChild(buildItem(u)));

    // Позиционируем suggest относительно input (fixed positioning)
    const rect = input.getBoundingClientRect();
    list.style.top = `${rect.bottom + 6}px`;
    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;
    list.style.display = 'block';
  };

  // События
  input.addEventListener('input', doSearch);
  input.addEventListener('focus', doSearch);

  // При потере фокуса проверяем точное совпадение с именем
  input.addEventListener('blur', () => {
    setTimeout(() => {
      const val = input.value.trim();
      if (val) {
        const exactMatch = users.find(u =>
          norm(u.name) === norm(val) && !picked.has(String(u.id))
        );
        if (exactMatch) {
          input.value = '';
          picked.add(String(exactMatch.id));
          addChip(exactMatch);
          syncHiddenFields();
        }
      }
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) list.style.display = 'none';
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
      wrap.remove();
    }
  };
}
