// ============================================================================
// app.js — Основная точка входа
// ============================================================================

import { submissionGroups, buildGroupKey, incrementGroupSeq, incrementEntrySeq, restoreFromBackup } from './services.js';
import { openModal, closeModal } from './modal/index.js';
import { renderLog, showConfirmModal } from './results.js';
import { injectTemplates } from './templates.js';
import { incomeItems, expenseItems, giftItems, iconItems, badgeItems, backgroundItems, itemPrices } from './data.js';
import {
  ADMIN_ALLOWED_ITEMS,
  TEXT_MESSAGES,
  FORM_GIFT_PRESENT,
  FORM_GIFT_CUSTOM,
  FORM_ICON_PRESENT,
  FORM_ICON_CUSTOM,
  FORM_BADGE_PRESENT,
  FORM_BADGE_CUSTOM,
  FORM_BG_PRESENT,
  FORM_BG_CUSTOM,
  toSelector
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
  counterWatcher = closeModal({ backdrop, form, modalFields, counterWatcher });
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
  // Убираем # для сравнения с константами
  const selectorWithoutHash = selector ? selector.replace('#', '') : '';
  if (!isItemAllowedForAdmin(selectorWithoutHash)) {
    e.preventDefault();
    return;
  }

  // Дополнительные данные для подарков
  const giftId = btn.getAttribute('data-gift-id');
  const giftIcon = btn.getAttribute('data-gift-icon');

  // Данные из data.js (price, bonus, mode)
  const price = btn.getAttribute('data-price');
  const bonus = btn.getAttribute('data-bonus');
  const mode = btn.getAttribute('data-mode');

  // Для подарков из коллекции используем общий title вместо названия конкретного подарка
  let finalTitle = titleText;
  if (giftId && giftId !== 'custom') {
    // Определяем тип формы для правильного названия
    if (selector === '#form-gift-present') {
      finalTitle = `Подарок из коллекции (#${giftId})`;
    } else if (selector === '#form-icon-present') {
      finalTitle = `Иконка из коллекции (#${giftId})`;
    } else if (selector === '#form-badge-present') {
      finalTitle = `Плашка из коллекции (#${giftId})`;
    } else if (selector === '#form-bg-present') {
      finalTitle = `Фон из коллекции (#${giftId})`;
    }
  }

  const meta = {
    templateSelector: selector,
    title: finalTitle,
    amount,
    kind,
    amountLabel,
    giftId,
    giftIcon,
    price: price !== null ? Number(price) : null,
    bonus: bonus !== null ? Number(bonus) : null,
    mode
  };

  const key = buildGroupKey(meta);
  const existingGroup = submissionGroups.find((group) => group.key === key);

  // Отладочный лог
  console.log('🔍 Поиск существующей группы:');
  console.log('  Ключ для поиска:', key);
  console.log('  Найдена группа:', existingGroup);
  console.log('  Все группы:', submissionGroups.map(g => ({ key: g.key, title: g.title })));

  if (existingGroup && existingGroup.entries.length) {
    const lastEntry = existingGroup.entries[existingGroup.entries.length - 1];
    console.log('  ✅ Открываем с данными последней записи');
    handleOpenModal({
      ...meta,
      data: lastEntry.data,
      entryId: lastEntry.id,
      groupId: existingGroup.id
    });
  } else {
    console.log('  ❌ Группа не найдена или пустая, открываем пустую форму');
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

  // ID - это строки, сравниваем напрямую
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
      group.entries.splice(entryIndex, 1);
      if (!group.entries.length) {
        const groupIndex = submissionGroups.findIndex((item) => item.id === groupId);
        if (groupIndex !== -1) submissionGroups.splice(groupIndex, 1);
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

  // Проверяем: если это форма с URL полями и все поля удалены (нет данных),
  // то удаляем запись или не создаём новую
  const templateSelector = form.dataset.templateSelector;
  const isUrlFieldForm = templateSelector && [
    '#form-income-needrequest',
    '#form-income-rpgtop',
    '#form-income-ep-personal',
    '#form-income-ep-plot',
    '#form-income-contest',
    '#form-income-avatar',
    '#form-income-design-other',
    '#form-income-run-contest',
    '#form-income-mastering'
  ].includes(templateSelector);

  // Если это URL форма и нет полей с данными (кроме системных полей вроде quantity)
  // Все URL поля теперь имеют формат {prefix}_extra_N
  const hasUrlFields = isUrlFieldForm && Object.keys(obj).some(key => key.includes('_extra_'));

  const editingEntryId = form.dataset.editingId || null;
  const editingGroupId = form.dataset.groupId || null;

  // Если URL форма без данных - удаляем entry и выходим
  if (isUrlFieldForm && !hasUrlFields) {
    if (editingEntryId) {
      // Удаляем существующую запись
      const originGroup = submissionGroups.find((item) =>
        item.entries.some((entry) => entry.id === editingEntryId)
      );
      if (originGroup) {
        const idx = originGroup.entries.findIndex((entry) => entry.id === editingEntryId);
        if (idx !== -1) {
          originGroup.entries.splice(idx, 1);
          // Если группа стала пустой - удаляем её
          if (!originGroup.entries.length) {
            const groupIndex = submissionGroups.findIndex((item) => item.id === originGroup.id);
            if (groupIndex !== -1) submissionGroups.splice(groupIndex, 1);
          }
        }
      }
      renderLog(log);
    }
    // Просто закрываем модалку, не создавая новую запись
    handleCloseModal();
    return;
  }

  // Проверяем формы с получателями (бонусы/маска/спасительный билет)
  // Если все группы удалены (нет получателей), удаляем операцию или не создаём новую
  const isRecipientForm = templateSelector && [
    '#form-exp-bonus1d1',
    '#form-exp-bonus2d1',
    '#form-exp-bonus1w1',
    '#form-exp-bonus2w1',
    '#form-exp-bonus1m1',
    '#form-exp-bonus2m1',
    '#form-exp-bonus1m3',
    '#form-exp-bonus2m3',
    '#form-exp-mask',
    '#form-exp-clean'
  ].includes(templateSelector);

  // Проверяем наличие хотя бы одного получателя (recipient_N поля)
  const hasRecipients = isRecipientForm && Object.keys(obj).some(key => /^recipient_\d+$/.test(key) && obj[key]);

  if (isRecipientForm && !hasRecipients) {
    if (editingEntryId) {
      // Удаляем существующую запись
      const originGroup = submissionGroups.find((item) =>
        item.entries.some((entry) => entry.id === editingEntryId)
      );
      if (originGroup) {
        const idx = originGroup.entries.findIndex((entry) => entry.id === editingEntryId);
        if (idx !== -1) {
          originGroup.entries.splice(idx, 1);
          // Если группа стала пустой - удаляем её
          if (!originGroup.entries.length) {
            const groupIndex = submissionGroups.findIndex((item) => item.id === originGroup.id);
            if (groupIndex !== -1) submissionGroups.splice(groupIndex, 1);
          }
        }
      }
      renderLog(log);
    }
    // Просто закрываем модалку, не создавая новую запись
    handleCloseModal();
    return;
  }

  // Проверяем формы подарков и оформления (иконки, плашки, фоны)
  // Если все группы удалены (нет получателей), удаляем операцию или не создаём новую
  const isGiftOrDesignForm = templateSelector && [
    '#form-gift-custom',
    '#form-gift-present',
    '#form-icon-custom',
    '#form-icon-present',
    '#form-badge-custom',
    '#form-badge-present',
    '#form-bg-custom',
    '#form-bg-present'
  ].includes(templateSelector);

  // Проверяем наличие хотя бы одного получателя
  const hasGiftRecipients = isGiftOrDesignForm && Object.keys(obj).some(key => /^recipient_\d+$/.test(key) && obj[key]);

  if (isGiftOrDesignForm && !hasGiftRecipients) {
    if (editingEntryId) {
      // Удаляем существующую запись
      const originGroup = submissionGroups.find((item) =>
        item.entries.some((entry) => entry.id === editingEntryId)
      );
      if (originGroup) {
        const idx = originGroup.entries.findIndex((entry) => entry.id === editingEntryId);
        if (idx !== -1) {
          originGroup.entries.splice(idx, 1);
          // Если группа стала пустой - удаляем её
          if (!originGroup.entries.length) {
            const groupIndex = submissionGroups.findIndex((item) => item.id === originGroup.id);
            if (groupIndex !== -1) submissionGroups.splice(groupIndex, 1);
          }
        }
      }
      renderLog(log);
    }
    // Просто закрываем модалку, не создавая новую запись
    handleCloseModal();
    return;
  }

  // Проверяем админские формы с получателями (анкета, акция, нужный персонаж, эпизод полумесяца, пополнение, индивидуальные выплаты)
  // Если все получатели удалены, удаляем операцию или не создаём новую
  const isAdminRecipientForm = templateSelector && [
    '#form-income-anketa',
    '#form-income-akcion',
    '#form-income-needchar',
    '#form-income-episode-of',
    '#form-income-topup',
    '#form-income-ams'
  ].includes(templateSelector);

  // Проверяем наличие хотя бы одного получателя
  const hasAdminRecipients = isAdminRecipientForm && Object.keys(obj).some(key => /^recipient_\d+$/.test(key) && obj[key]);

  if (isAdminRecipientForm && !hasAdminRecipients) {
    if (editingEntryId) {
      // Удаляем существующую запись
      const originGroup = submissionGroups.find((item) =>
        item.entries.some((entry) => entry.id === editingEntryId)
      );
      if (originGroup) {
        const idx = originGroup.entries.findIndex((entry) => entry.id === editingEntryId);
        if (idx !== -1) {
          originGroup.entries.splice(idx, 1);
          // Если группа стала пустой - удаляем её
          if (!originGroup.entries.length) {
            const groupIndex = submissionGroups.findIndex((item) => item.id === originGroup.id);
            if (groupIndex !== -1) submissionGroups.splice(groupIndex, 1);
          }
        }
      }
      renderLog(log);
    }
    // Просто закрываем модалку, не создавая новую запись
    handleCloseModal();
    return;
  }

  // amount используется только для отображения в UI
  const displayAmount = form.dataset.amount || '';

  const meta = {
    templateSelector: form.dataset.templateSelector,
    title: form.dataset.title || modalTitle.textContent,
    amount: displayAmount, // только для отображения
    amountLabel: form.dataset.amountLabel || modalAmountLabel.textContent,
    kind: form.dataset.kind || '',
    giftId: form.dataset.giftId || '',
    price: form.dataset.price ? Number(form.dataset.price) : null,
    bonus: form.dataset.bonus ? Number(form.dataset.bonus) : null,
    mode: form.dataset.mode || ''
  };

  const key = buildGroupKey(meta);
  let group = null;

  const multiplierValue = Number.parseFloat(form.dataset.currentMultiplier || '1');
  const normalizedMultiplier = Number.isFinite(multiplierValue) && multiplierValue >= 0 ? multiplierValue : 1;

  if (editingGroupId) {
    group = submissionGroups.find((item) => item.id === editingGroupId) || null;
  }
  if (!group) {
    // Ищем существующую группу по ключу (включая подарки с одинаковым giftId)
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
    // Убираем # для сравнения с константами
    const formIdWithoutHash = formId ? formId.replace('#', '') : '';

    if (!ADMIN_ALLOWED_ITEMS.includes(formIdWithoutHash)) {
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
    btn.setAttribute('data-form', toSelector(item.form));
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
    btn.setAttribute('data-form', toSelector(item.form));
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
    btn.setAttribute('data-form', toSelector(isCustom ? FORM_GIFT_CUSTOM : FORM_GIFT_PRESENT));
    btn.setAttribute('data-kind', 'expense');
    btn.setAttribute('data-amount', String(price));
    btn.setAttribute('data-price', String(price));
    btn.setAttribute('data-title', item.title);
    btn.setAttribute('data-gift-id', item.id);
    btn.setAttribute('data-gift-icon', item.icon);
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
      btn.setAttribute('data-form', toSelector(isCustom ? FORM_ICON_CUSTOM : FORM_ICON_PRESENT));
      btn.setAttribute('data-kind', 'expense');
      btn.setAttribute('data-amount', String(price));
      btn.setAttribute('data-gift-id', item.id);
      btn.setAttribute('data-gift-icon', item.icon);
      btn.setAttribute('data-price', String(price));
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
      btn.setAttribute('data-form', toSelector(isCustom ? FORM_BADGE_CUSTOM : FORM_BADGE_PRESENT));
      btn.setAttribute('data-kind', 'expense');
      btn.setAttribute('data-amount', String(price));
      btn.setAttribute('data-gift-id', item.id);
      btn.setAttribute('data-gift-icon', item.icon);
      btn.setAttribute('data-price', String(price));
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
      btn.setAttribute('data-form', toSelector(isCustom ? FORM_BG_CUSTOM : FORM_BG_PRESENT));
      btn.setAttribute('data-kind', 'expense');
      btn.setAttribute('data-amount', String(price));
      btn.setAttribute('data-gift-id', item.id);
      btn.setAttribute('data-gift-icon', item.icon);
      btn.setAttribute('data-price', String(price));
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

// Функция обработки BACKUP_DATA
function checkAndRestoreBackup() {
  if (typeof window.BACKUP_DATA !== 'undefined' && window.BACKUP_DATA) {
    const backupData = window.BACKUP_DATA;
    // Сразу очищаем, чтобы не обрабатывать дважды
    window.BACKUP_DATA = undefined;

    showConfirmModal('Обнаружены сохранённые данные. Восстановить банковскую операцию?')
      .then((confirmed) => {
        if (confirmed) {
          try {
            restoreFromBackup(backupData);
            renderLog(log);
            console.log('Операции успешно восстановлены из backup');
          } catch (error) {
            console.error('Ошибка при восстановлении операций:', error);
            alert('Ошибка при восстановлении данных. Проверьте консоль для деталей.');
          }
        }
      });
  }
}

// Проверка наличия BACKUP_DATA при загрузке и каждую секунду
checkAndRestoreBackup();
setInterval(checkAndRestoreBackup, 1000);
