// ============================================================================
// singleUserPicker.js — Компонент выбора ОДНОГО пользователя (single select)
// ============================================================================

import { formatNumber } from '../services.js';
import { clearRecipientFields } from './helpers.js';

/**
 * Создаёт интерактивный компонент выбора ОДНОГО пользователя
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
    portalList.style.left = r.left + 'px';
    portalList.style.top = (r.bottom + 6) + 'px';
    portalList.style.width = r.width + 'px';
  };
  const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
  const openSuggest = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

  const buildItem = (u) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggest-item';
    item.setAttribute('role', 'option');
    item.textContent = u.name + ' (id: ' + u.id + ')';
    item.addEventListener('click', () => {
      pickedId = String(u.id);
      pickedName = u.name;
      input.value = u.name + ' (id: ' + u.id + ')';
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
        input.value = u.name + ' (id: ' + u.id + ')';
      } else {
        pickedId = first;
        pickedName = 'Неизвестный';
        input.value = 'Неизвестный (id: ' + first + ')';
      }
      syncHiddenFields();
    }
  }

  if (!pickedId) {
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  }

  return {
    getSelectedId: () => pickedId,
    getSelectedUser: () => (pickedId ? { id: pickedId, name: pickedName } : null),
    setUser: (user) => {
      pickedId = String(user.id);
      pickedName = user.name;
      input.value = user.name + ' (id: ' + user.id + ')';
      syncHiddenFields();
    },
    clear: () => { pickedId = ''; pickedName = ''; input.value = ''; syncHiddenFields(); },
    destroy: () => { unmountPortal(); block.remove(); }
  };
}
