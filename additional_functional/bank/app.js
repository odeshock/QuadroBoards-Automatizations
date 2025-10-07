// ============================================================================
// app.js — Основная точка входа
// ============================================================================

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

// Список пунктов, доступных для IS_ADMIN = true
const ADMIN_ALLOWED_ITEMS = [
  'За прием анкеты',
  'Взятие акционного персонажа',
  'Взятие нужного персонажа',
  'Докупить кредиты',
  'Постописец полумесяца',
  'Пост полумесяца',
  'Эпизод полумесяца',
  'Активист полумесяца',
  'Персональные начисления'
];

function isItemAllowedForAdmin(titleText) {
  if (typeof window.IS_ADMIN === 'undefined' || !window.IS_ADMIN) {
    return true; // Для обычных пользователей все доступно
  }
  return ADMIN_ALLOWED_ITEMS.includes(titleText);
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

  // Дополнительная проверка доступа
  if (!isItemAllowedForAdmin(titleText)) {
    e.preventDefault();
    return;
  }

  // Дополнительные данные для подарков
  const giftId = btn.getAttribute('data-gift-id');
  const giftIcon = btn.getAttribute('data-gift-icon');
  const giftPrice1 = btn.getAttribute('data-gift-price-1');
  const giftPrice5 = btn.getAttribute('data-gift-price-5');

  const meta = {
    templateSelector: selector,
    title: titleText,
    amount,
    kind,
    amountLabel,
    giftId,
    giftIcon,
    giftPrice1,
    giftPrice5
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
log.addEventListener('click', (e) => {
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
    handleOpenModal({
      templateSelector: group.templateSelector,
      title: group.title,
      amount: group.baseAmount || group.amount,
      kind: group.kind,
      amountLabel: group.amountLabel,
      giftPrice1: group.giftPrice1,
      giftPrice5: group.giftPrice5,
      giftId: group.giftId,
      giftIcon: group.giftIcon,
      data: entry.data,
      entryId: entry.id,
      groupId: group.id
    });
    return;
  }

  if (action === 'delete') {
    if (!entryId) return;

    // Подтверждение удаления
    const confirmed = confirm('Вы уверены, что хотите удалить эту запись?');
    if (!confirmed) return;

    const entryIndex = group.entries.findIndex((item) => item.id === entryId);
    if (entryIndex !== -1) {
      const isGift = group.templateSelector === '#form-gift-present' ||
                     /Подарить подарок|Праздничный подарок|Подарок-сюрприз|Воздушный подарок/i.test(group.title || '');

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

  // Если есть quantity, умножаем amount
  const quantity = obj.quantity ? Number(obj.quantity) : null;
  const baseAmount = form.dataset.baseAmount || form.dataset.amount || '';
  let finalAmount = baseAmount;

  if (quantity && quantity >= 1) {
    const baseAmountNum = parseFloat(baseAmount);
    if (!isNaN(baseAmountNum)) {
      finalAmount = String(baseAmountNum * quantity);
    }
  }

  const meta = {
    templateSelector: form.dataset.templateSelector,
    title: form.dataset.title || modalTitle.textContent,
    amount: finalAmount,
    baseAmount: baseAmount,
    amountLabel: form.dataset.amountLabel || modalAmountLabel.textContent,
    kind: form.dataset.kind || '',
    giftPrice1: form.dataset.giftPrice1 || '',
    giftPrice5: form.dataset.giftPrice5 || '',
    giftId: form.dataset.giftId || ''
  };

  const key = buildGroupKey(meta);
  let group = null;

  const multiplierValue = Number.parseFloat(form.dataset.currentMultiplier || '1');
  const normalizedMultiplier = Number.isFinite(multiplierValue) && multiplierValue >= 0 ? multiplierValue : 1;

  // Для подарков всегда создаём новую группу (не группируем)
  const isGift = meta.templateSelector === '#form-gift-present' || meta.templateSelector === '#form-gift-custom';

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
    group.amount = meta.amount;
    group.baseAmount = meta.baseAmount;
    group.amountLabel = meta.amountLabel;
    group.kind = meta.kind;
    group.giftPrice1 = meta.giftPrice1;
    group.giftPrice5 = meta.giftPrice5;
    group.giftId = meta.giftId;
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
    const row = btn.parentElement.querySelector('.title');
    const overrideTitle = btn.getAttribute('data-title');
    const titleText = overrideTitle || (row ? row.textContent.trim() : '');

    if (!ADMIN_ALLOWED_ITEMS.includes(titleText)) {
      btn.disabled = true;
      btn.classList.add('btn-disabled');
      btn.style.opacity = '0.3';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Недоступно для администратора';
    }
  });
}

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
