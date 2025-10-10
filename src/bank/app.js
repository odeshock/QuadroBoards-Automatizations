// ============================================================================
// app.js — Основная точка входа
// ============================================================================

import { submissionGroups, buildGroupKey, incrementGroupSeq, incrementEntrySeq, updateGiftDiscountEntry } from './services.js';
import { renderLog, openModal, closeModal, showConfirmModal } from './components.js';
import { injectTemplates } from './templates.js';
import { incomeItems, expenseItems, giftItems, iconItems, badgeItems, backgroundItems, itemPrices } from './data.js';
import {
  ADMIN_ALLOWED_ITEMS,
  TEXT_MESSAGES,
  FORM_GIFT_PRESENT,
  FORM_GIFT_CUSTOM,
  REGEX
} from './constants.js';
import { parseNumericAmount } from './utils.js';

// ============================================================================
// DOM REFERENCES
// ============================================================================

const backdrop = document.getElementById('backdrop');
const modalTitle = document.getElementById('modal-title');
const modalFields = document.getElementById('modal-fields');
const modalAmount = document.getElementById('modal-amount');
const modalAmountLabel = document.getElementById('modal-amount-label');
const btnClose = document.getElementById('btn-close');
const btnSubmit = document.getElementById('btn-submit');
const form = document.getElementById('modal-form');
const log = document.getElementById('log');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// ============================================================================
// STATE
// ============================================================================

let counterWatcher = null;

// ============================================================================
// TAB SWITCHING
// ============================================================================

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('is-active')) return;
    const target = btn.getAttribute('data-tab-target');

    tabButtons.forEach((other) => {
      const isActive = other === btn;
      other.classList.toggle('is-active', isActive);
      other.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    tabPanels.forEach((panel) => {
      const shouldShow = panel.id === `tab-${target}`;
      panel.classList.toggle('is-active', shouldShow);
      if (shouldShow) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
  });
});

// ============================================================================
// MODAL ACTIONS
// ============================================================================

function handleOpenModal(config) {
  counterWatcher = openModal({
    backdrop,
    modalTitle,
    modalFields,
    modalAmount,
    modalAmountLabel,
    btnSubmit,
    form,
    counterWatcher,
    config
  });
}

function handleCloseModal() {
  closeModal({ backdrop, form, modalFields, counterWatcher });
  counterWatcher = null;
}

// ============================================================================
// ADMIN ACCESS CONTROL
// ============================================================================

function isItemAllowedForAdmin(formId) {
  if (typeof window.IS_ADMIN === 'undefined' || !window.IS_ADMIN) {
    return true; // Для обычных пользователей все доступно
  }
  return ADMIN_ALLOWED_ITEMS.includes(formId);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

// Кнопка открытия модального окна
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-add');
  if (!btn) return;

  // Проверка доступа
  if (btn.disabled) {
    e.preventDefault();
    return;
  }

  const selector = btn.getAttribute('data-form');
  const kind = btn.getAttribute('data-kind') || '';
  const amount = btn.getAttribute('data-amount') || '';
  const row = btn.parentElement.querySelector('.title');
  const overrideTitle = btn.getAttribute('data-title');
  const titleText = overrideTitle || (row ? row.textContent.trim() : 'Пункт');
  const amountLabel = kind === 'expense' ? 'Стоимость' : 'Начисление';

  // Дополнительная проверка доступа (по ID формы)
  if (!isItemAllowedForAdmin(selector)) {
    e.preventDefault();
    return;
  }

  // Дополнительные данные для подарков
  const giftId = btn.getAttribute('data-gift-id');
  const giftIcon = btn.getAttribute('data-gift-icon');
  const giftPrice1 = btn.getAttribute('data-gift-price-1');
  const giftPrice5 = btn.getAttribute('data-gift-price-5');

  // Данные из data.js (price, bonus, mode)
  const price = btn.getAttribute('data-price');
  const bonus = btn.getAttribute('data-bonus');
  const mode = btn.getAttribute('data-mode');

  const meta = {
    templateSelector: selector,
    title: titleText,
    amount,
    kind,
    amountLabel,
    giftId,
    giftIcon,
    giftPrice1,
    giftPrice5,
    price: price !== null ? Number(price) : null,
    bonus: bonus !== null ? Number(bonus) : null,
    mode
  };

  const key = buildGroupKey(meta);
  const existingGroup = submissionGroups.find((group) => group.key === key);

  if (existingGroup && existingGroup.entries.length) {
    const lastEntry = existingGroup.entries[existingGroup.entries.length - 1];
    handleOpenModal({
      ...meta,
      data: lastEntry.data,
      entryId: lastEntry.id,
      groupId: existingGroup.id
    });
  } else {
    handleOpenModal(meta);
  }
});

// Кнопка закрытия
btnClose.addEventListener('click', handleCloseModal);

// Клик по backdrop
backdrop.addEventListener('click', (e) => {
  if (e.target === backdrop) handleCloseModal();
});

// Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && backdrop.hasAttribute('open')) handleCloseModal();
});

// Редактирование/удаление в логе
log.addEventListener('click', async (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (!actionBtn) return;
  const { action, groupId, entryId } = actionBtn.dataset;
  if (!groupId) return;

  const group = submissionGroups.find((item) => item.id === groupId);
  if (!group) return;

  if (action === 'edit') {
    if (!entryId) return;
    const entry = group.entries.find((item) => item.id === entryId);
    if (!entry) return;

    // Для подарков и оформления берём giftId и giftIcon из данных записи (первого получателя)
    let editGiftId = group.giftId;
    let editGiftIcon = group.giftIcon;
    if (entry.data && entry.data.gift_id_1) {
      editGiftId = entry.data.gift_id_1;
      editGiftIcon = entry.data.gift_icon_1 || editGiftIcon;
    }

    handleOpenModal({
      templateSelector: group.templateSelector,
      title: group.title,
      amount: group.amount, // только для отображения
      kind: group.kind,
      amountLabel: group.amountLabel,
      giftPrice1: group.giftPrice1,
      giftPrice5: group.giftPrice5,
      giftId: editGiftId,
      giftIcon: editGiftIcon,
      data: entry.data,
      entryId: entry.id,
      groupId: group.id,
      price: group.price,
      bonus: group.bonus,
      mode: group.mode
    });
    return;
  }

  if (action === 'delete') {
    if (!entryId) return;

    // Подтверждение удаления
    const confirmed = await showConfirmModal(TEXT_MESSAGES.CONFIRM_DELETE);
    if (!confirmed) return;

    const entryIndex = group.entries.findIndex((item) => item.id === entryId);
    if (entryIndex !== -1) {
      const isGift = group.templateSelector === FORM_GIFT_PRESENT ||
                     REGEX.GIFT_TITLE.test(group.title || '');

      group.entries.splice(entryIndex, 1);
      if (!group.entries.length) {
        const groupIndex = submissionGroups.findIndex((item) => item.id === group.id);
        if (groupIndex !== -1) submissionGroups.splice(groupIndex, 1);
      }

      // Обновляем скидку на подарки если удалили подарок
      if (isGift) {
        updateGiftDiscountEntry();
      }

      renderLog(log);
    }
  }
});

// Сабмит формы
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const obj = {};
  formData.forEach((value, key) => {
    obj[key] = value;
  });

  const editingEntryId = form.dataset.editingId || null;
  const editingGroupId = form.dataset.groupId || null;

  // amount используется только для отображения в UI
  const displayAmount = form.dataset.amount || '';

  const meta = {
    templateSelector: form.dataset.templateSelector,
    title: form.dataset.title || modalTitle.textContent,
    amount: displayAmount, // только для отображения
    amountLabel: form.dataset.amountLabel || modalAmountLabel.textContent,
    kind: form.dataset.kind || '',
    giftPrice1: form.dataset.giftPrice1 || '',
    giftPrice5: form.dataset.giftPrice5 || '',
    giftId: form.dataset.giftId || '',
    price: form.dataset.price ? Number(form.dataset.price) : null,
    bonus: form.dataset.bonus ? Number(form.dataset.bonus) : null,
    mode: form.dataset.mode || ''
  };

  const key = buildGroupKey(meta);
  let group = null;

  const multiplierValue = Number.parseFloat(form.dataset.currentMultiplier || '1');
  const normalizedMultiplier = Number.isFinite(multiplierValue) && multiplierValue >= 0 ? multiplierValue : 1;

  // Для подарков всегда создаём новую группу (не группируем)
  const isGift = meta.templateSelector === FORM_GIFT_PRESENT || meta.templateSelector === FORM_GIFT_CUSTOM;

  if (editingGroupId) {
    group = submissionGroups.find((item) => item.id === editingGroupId) || null;
  }
  if (!group && !isGift) {
    // Для НЕ-подарков ищем существующую группу по ключу
    group = submissionGroups.find((item) => item.key === key) || null;
  }
  if (!group) {
    const groupId = `group-${incrementGroupSeq()}`;
    group = {
      id: groupId,
      key,
      ...meta,
      entries: []
    };
    submissionGroups.push(group);
  } else {
    group.key = key;
    group.templateSelector = meta.templateSelector;
    group.title = meta.title;
    group.amount = meta.amount; // только для отображения
    group.amountLabel = meta.amountLabel;
    group.kind = meta.kind;
    group.giftPrice1 = meta.giftPrice1;
    group.giftPrice5 = meta.giftPrice5;
    group.giftId = meta.giftId;
    group.price = meta.price;
    group.bonus = meta.bonus;
    group.mode = meta.mode;
  }

  let entryRecord = null;

  if (editingEntryId) {
    const originGroup = submissionGroups.find((item) => item.entries.some((entry) => entry.id === editingEntryId));
    if (originGroup) {
      const idx = originGroup.entries.findIndex((entry) => entry.id === editingEntryId);
      if (idx !== -1) {
        entryRecord = originGroup.entries.splice(idx, 1)[0];
        if (!originGroup.entries.length && originGroup !== group) {
          const originGroupIndex = submissionGroups.findIndex((item) => item.id === originGroup.id);
          if (originGroupIndex !== -1) submissionGroups.splice(originGroupIndex, 1);
        }
      }
    }
    if (!entryRecord) {
      entryRecord = { id: editingEntryId };
    }
  } else {
    const entryId = `entry-${incrementEntrySeq()}`;
    entryRecord = { id: entryId };
  }

  entryRecord.data = obj;
  entryRecord.multiplier = normalizedMultiplier;
  entryRecord.template_id = meta.templateSelector?.replace('#', '') || '';
  group.entries.push(entryRecord);

  // Обновляем скидку на подарки если это была операция с подарками
  if (isGift) {
    updateGiftDiscountEntry();
  }

  renderLog(log);
  handleCloseModal();
});

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeAccessControl() {
  if (typeof window.IS_ADMIN === 'undefined' || !window.IS_ADMIN) {
    return; // Для обычных пользователей ничего не делаем
  }

  // Для администраторов блокируем недоступные кнопки
  document.querySelectorAll('.btn-add').forEach((btn) => {
    const formId = btn.getAttribute('data-form');

    if (!ADMIN_ALLOWED_ITEMS.includes(formId)) {
      btn.disabled = true;
      btn.classList.add('btn-disabled');
      btn.style.opacity = '0.3';
      btn.style.cursor = 'not-allowed';
      btn.title = TEXT_MESSAGES.ADMIN_RESTRICTED;
    }
  });
}

// ============================================================================
// RENDER LISTS
// ============================================================================

function renderIncomeList() {
  const container = document.querySelector('#tab-bank .panel:first-child .list');
  if (!container) return;

  incomeItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    div.setAttribute('role', 'listitem');

    const btn = document.createElement('button');
    btn.className = 'btn-add';
    btn.setAttribute('data-form', item.form);
    btn.setAttribute('data-kind', 'income');
    btn.setAttribute('data-amount', String(item.amount));
    if (item.price !== undefined) btn.setAttribute('data-price', String(item.price));
    if (item.bonus !== undefined) btn.setAttribute('data-bonus', String(item.bonus));
    if (item.mode) btn.setAttribute('data-mode', item.mode);
    btn.textContent = '+';

    div.innerHTML = `
      <div class="title">${item.title}</div>
      <div class="price">${item.amount}</div>
    `;
    div.appendChild(btn);
    container.appendChild(div);
  });
}

function renderExpenseList() {
  const container = document.querySelector('#tab-bank .panel:last-child .list');
  if (!container) return;

  expenseItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    div.setAttribute('role', 'listitem');

    const btn = document.createElement('button');
    btn.className = 'btn-add';
    btn.setAttribute('data-form', item.form);
    btn.setAttribute('data-kind', 'expense');
    btn.setAttribute('data-amount', String(item.amount));
    if (item.price !== undefined) btn.setAttribute('data-price', String(item.price));
    if (item.bonus !== undefined) btn.setAttribute('data-bonus', String(item.bonus));
    if (item.mode) btn.setAttribute('data-mode', item.mode);
    btn.textContent = '+';

    div.innerHTML = `
      <div class="title">${item.title}</div>
      <div class="price">${item.amount}</div>
    `;
    div.appendChild(btn);
    container.appendChild(div);
  });
}

function renderGiftsList() {
  const container = document.querySelector('#tab-gifts .gift-grid');
  if (!container) return;

  giftItems.forEach(item => {
    const isCustom = item.id === 'custom';
    const price = isCustom ? itemPrices.gift.custom : itemPrices.gift.collection;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gift-card btn-add';
    btn.setAttribute('data-form', isCustom ? '#form-gift-custom' : '#form-gift-present');
    btn.setAttribute('data-kind', 'expense');
    btn.setAttribute('data-amount', String(price));
    btn.setAttribute('data-title', item.title);
    btn.setAttribute('data-gift-id', item.id);
    btn.setAttribute('data-gift-icon', item.icon);
    btn.setAttribute('data-gift-price-1', String(price));
    btn.innerHTML = item.icon;
    container.appendChild(btn);
  });
}

// Функции для рендеринга оформления
function renderDesignLists() {
  // Иконки
  const iconContainer = document.querySelector('#tab-design .icon-grid');
  if (iconContainer) {
    iconItems.forEach(item => {
      const isCustom = item.id === 'custom';
      const price = isCustom ? itemPrices.icon.custom : itemPrices.icon.collection;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon btn-add';
      btn.setAttribute('data-form', isCustom ? '#form-icon-custom' : '#form-icon-present');
      btn.setAttribute('data-kind', 'expense');
      btn.setAttribute('data-amount', String(price));
      btn.setAttribute('data-gift-id', item.id);
      btn.setAttribute('data-gift-icon', item.icon);
      btn.setAttribute('data-gift-price-1', String(price));
      btn.innerHTML = item.icon;
      iconContainer.appendChild(btn);
    });
  }

  // Плашки
  const badgeContainer = document.querySelector('#tab-design .badge-grid');
  if (badgeContainer) {
    badgeItems.forEach(item => {
      const isCustom = item.id === 'custom';
      const price = isCustom ? itemPrices.badge.custom : itemPrices.badge.collection;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'badge btn-add';
      btn.setAttribute('data-form', isCustom ? '#form-badge-custom' : '#form-badge-present');
      btn.setAttribute('data-kind', 'expense');
      btn.setAttribute('data-amount', String(price));
      btn.setAttribute('data-gift-id', item.id);
      btn.setAttribute('data-gift-icon', item.icon);
      btn.setAttribute('data-gift-price-1', String(price));
      btn.innerHTML = item.icon;
      badgeContainer.appendChild(btn);
    });
  }

  // Фоны
  const bgContainer = document.querySelector('#tab-design .bg-grid');
  if (bgContainer) {
    backgroundItems.forEach(item => {
      const isCustom = item.id === 'custom';
      const price = isCustom ? itemPrices.background.custom : itemPrices.background.collection;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bg btn-add';
      btn.setAttribute('data-form', isCustom ? '#form-bg-custom' : '#form-bg-present');
      btn.setAttribute('data-kind', 'expense');
      btn.setAttribute('data-amount', String(price));
      btn.setAttribute('data-gift-id', item.id);
      btn.setAttribute('data-gift-icon', item.icon);
      btn.setAttribute('data-gift-price-1', String(price));
      btn.innerHTML = item.icon;
      bgContainer.appendChild(btn);
    });
  }
}

// Инжектим шаблоны форм
injectTemplates();

// Рендерим списки
renderIncomeList();
renderExpenseList();
renderGiftsList();
renderDesignLists();

renderLog(log);

// Инициализация контроля доступа после загрузки IS_ADMIN
if (typeof window.IS_ADMIN !== 'undefined') {
  initializeAccessControl();
} else {
  // Ждем объявления IS_ADMIN
  const checkAdmin = setInterval(() => {
    if (typeof window.IS_ADMIN !== 'undefined') {
      clearInterval(checkAdmin);
      initializeAccessControl();
    }
  }, 100);
}
