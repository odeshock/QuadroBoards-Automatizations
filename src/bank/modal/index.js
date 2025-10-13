// ============================================================================
// index.js — Главный модуль модальных окон
// ============================================================================

import {
  formatNumber,
  parseNumericAmount
} from '../services.js';

import {
  updateModalAmount,
  cleanupCounterWatcher
} from '../results.js';

import {
  FORM_INCOME_TOPUP,
  FORM_INCOME_AMS,
  URL_FIELD_FORMS,
  POST_FORMS,
  toSelector
} from '../constants.js';


import {
  handleAdminRecipientMultiForms,
  handleAdminSingleRecipientForms,
  handleAdminAmountForms
} from './adminForms.js';

import {
  handleGiftsAndDesignForms
} from './giftForms.js';

import {
  handleBonusMaskCleanForms
} from './expenseForms.js';

import {
  handleFirstPostForm,
  handlePostForms,
  handleFlyerForm
} from './postForms.js';

import {
  handleCounterForms
} from './counterForms.js';

import {
  handleBuyoutForms
} from './buyoutForms.js';

import {
  setupUrlFieldLogic
} from './urlFieldForms.js';

import {
  handleBannerForms
} from './bannerForms.js';

export function openModal({
  backdrop,
  modalTitle,
  modalFields,
  modalAmount,
  modalAmountLabel,
  btnSubmit,
  form,
  counterWatcher,
  config
}) {
  const {
    templateSelector,
    title,
    amount,
    kind,
    amountLabel,
    giftId,
    giftIcon,
    data = null,
    entryId = null,
    groupId = null,
    price = null,
    bonus = null,
    mode = null
  } = config;

  const template = document.querySelector(templateSelector);
  if (!template) return { counterWatcher };

  let resolvedTitle = title || 'Пункт';

  // Для подарков и оформления используем специальные заголовки
  if (giftId) {
    const isCustom = giftId.includes('custom');

    if (templateSelector?.includes('icon')) {
      resolvedTitle = isCustom ? 'Индивидуальная иконка' : `Иконка из коллекции (#${giftId})`;
    } else if (templateSelector?.includes('badge')) {
      resolvedTitle = isCustom ? 'Индивидуальная плашка' : `Плашка из коллекции (#${giftId})`;
    } else if (templateSelector?.includes('bg')) {
      resolvedTitle = isCustom ? 'Индивидуальный фон' : `Фон из коллекции (#${giftId})`;
    } else if (templateSelector?.includes('gift')) {
      resolvedTitle = isCustom ? 'Индивидуальный подарок' : `Подарок из коллекции (#${giftId})`;
    }
  }

  const resolvedAmountLabel = amountLabel || (kind === 'expense' ? 'Стоимость' : 'Начисление');

  modalTitle.textContent = resolvedTitle;
  modalAmountLabel.textContent = resolvedAmountLabel;

  form.dataset.templateSelector = templateSelector;
  form.dataset.kind = kind || '';
  form.dataset.amount = amount || ''; // только для отображения в modalAmount при открытии
  form.dataset.amountLabel = resolvedAmountLabel;
  form.dataset.title = resolvedTitle;
  form.dataset.giftId = giftId || '';
  form.dataset.giftIcon = giftIcon || '';
  form.dataset.price = price !== null ? String(price) : '';
  form.dataset.bonus = bonus !== null ? String(bonus) : '';
  form.dataset.mode = mode || '';

  // Для форм с mode сразу показываем правильный расчет
  // Для форм без mode показываем amount (будет обновлено специфичной логикой)
  if (mode && price !== null) {
    // Определяем начальное количество items
    let initialItems = 0;

    // Для форм с quantity по умолчанию items=1 (будет взято из input)
    const hasQuantityField = templateSelector?.includes('exp-face') ||
                             templateSelector?.includes('exp-char') ||
                             templateSelector?.includes('exp-need');

    if (hasQuantityField) {
      initialItems = 1;
    }

    // Для форм с получателями (бонусы, маска, жилет, подарки) и баннеров показываем базовую цену
    const hasRecipientField = templateSelector?.includes('bonus') ||
                              templateSelector?.includes('mask') ||
                              templateSelector?.includes('clean') ||
                              templateSelector?.includes('gift') ||
                              templateSelector?.includes('icon') ||
                              templateSelector?.includes('badge') ||
                              templateSelector?.includes('bg');

    const isBanner = templateSelector?.includes('banner');

    if (initialItems === 0 && (hasRecipientField || isBanner)) {
      // Показываем просто price за единицу
      modalAmount.textContent = formatNumber(price);
    } else {
      updateModalAmount(modalAmount, form, { items: initialItems });
    }
  } else {
    // Для форм TOPUP и AMS показываем специальные значения
    const isTopupOrAms = templateSelector === toSelector(FORM_INCOME_TOPUP) || templateSelector === toSelector(FORM_INCOME_AMS);
    if (isTopupOrAms) {
      // Не-админам показываем "определяется индивидуально", админам - пусто (обновится при вводе данных)
      modalAmount.textContent = window.IS_ADMIN ? '' : 'определяется индивидуально';
    } else {
      modalAmount.textContent = amount || '';
    }
  }

  if (entryId) {
    form.dataset.editingId = entryId;
  } else {
    delete form.dataset.editingId;
  }
  if (groupId) {
    form.dataset.groupId = groupId;
  } else {
    delete form.dataset.groupId;
  }

  const isInfo = template.hasAttribute('data-info');
  btnSubmit.style.display = isInfo ? 'none' : '';

  counterWatcher = cleanupCounterWatcher(counterWatcher, modalFields, form);
  modalFields.innerHTML = template.innerHTML;

  // Открываем backdrop СРАЗУ после установки контента
  backdrop.setAttribute('open', '');
  backdrop.removeAttribute('aria-hidden');

// === BANNER: баннеры Рено и Маяк ===
const bannerResult = handleBannerForms({ template, modalFields, btnSubmit, counterWatcher, data });
if (bannerResult.handled) {
  counterWatcher = bannerResult.counterWatcher;
  return { counterWatcher };
}

// === ADMIN multi-recipient начисления (анкета, акция, нужный, эпизод) ===
const adminMultiResult = handleAdminRecipientMultiForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, price });
if (adminMultiResult.handled) {
  counterWatcher = adminMultiResult.counterWatcher;
}

// === ADMIN AMOUNT: докупка кредитов, доп.деньги, переводы
const adminAmountResult = handleAdminAmountForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, price });
if (adminAmountResult.handled) {
  counterWatcher = adminAmountResult.counterWatcher;
}

// === BONUSES, MASK, CLEAN: выбор получателя + количество + от кого + комментарий
const bonusResult = handleBonusMaskCleanForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, price });
if (bonusResult.handled) {
  counterWatcher = bonusResult.counterWatcher;
}

// === GIFTS & DESIGN: подарки и оформление (иконки, плашки, фоны) ===
const giftResult = handleGiftsAndDesignForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, config });
if (giftResult.handled) {
  counterWatcher = giftResult.counterWatcher;
}

// === ADMIN single-recipient начисления (активист, постописец, пост полумесяца) ===
const adminSingleResult = handleAdminSingleRecipientForms({ template, modalFields, btnSubmit, counterWatcher, data, modalAmount, price });
if (adminSingleResult.handled) {
  counterWatcher = adminSingleResult.counterWatcher;
}


// === FIRST POST: ждём FIRST_POST_FLAG, PLOT_POSTS и PERSONAL_POSTS ===
const firstPostResult = handleFirstPostForm({ template, modalFields, btnSubmit, counterWatcher });
if (firstPostResult.handled) {
  counterWatcher = firstPostResult.counterWatcher;
}

// === POST: личные и сюжетные посты ===
const postResult = handlePostForms({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, modalAmountLabel, data });
if (postResult.handled) {
  counterWatcher = postResult.counterWatcher;
}

// === FLYER: ждём ADS_POSTS и рисуем список ===
const flyerResult = handleFlyerForm({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, amount, price, data });
if (flyerResult.handled) {
  counterWatcher = flyerResult.counterWatcher;
}

// === COUNTER: 100 сообщений/репутации/позитива, месяц ===
const counterResult = handleCounterForms({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, modalAmountLabel, data });
if (counterResult.handled) {
  counterWatcher = counterResult.counterWatcher;
}

// === BUYOUT: формы выкупа ===
const buyoutResult = handleBuyoutForms({ template, modalFields, modalAmount, form, amount });
if (buyoutResult.handled) {
  // Buyout forms не требуют counterWatcher
}

  // === URL FIELDS & GIFT GROUPS: динамические поля ===
  const giftContainer = modalFields.querySelector('[data-gift-container]');
  const giftAddBtn = modalFields.querySelector('[data-add-gift-group]');
  const giftTemplateGroup = giftContainer ? giftContainer.querySelector('[data-gift-group]') : null;

  const getExtraFields = () => Array.from(modalFields.querySelectorAll('.extra-field'));
  const getGiftGroups = () => giftContainer ? Array.from(giftContainer.querySelectorAll('[data-gift-group]')) : [];

  const amountRaw = amount || '';
  const amountNumber = parseNumericAmount(amountRaw);

  const computeMultiplier = () => {
    if (giftContainer) {
      const groups = getGiftGroups();
      return groups.length ? groups.length : 1;
    }
    // Для форм счетчиков multiplier берётся из form.dataset.currentMultiplier
    const storedRaw = form.dataset.currentMultiplier;
    if (storedRaw !== undefined) {
      const stored = Number.parseFloat(storedRaw);
      if (Number.isFinite(stored)) return stored;
    }
    // Для URL форм все поля теперь extra (нет базового поля)
    const isUrlFieldForm = URL_FIELD_FORMS.includes(templateSelector);
    if (isUrlFieldForm) {
      return getExtraFields().length;
    }
    // Для других форм: базовое поле (1) + дополнительные
    return 1 + getExtraFields().length;
  };

  const updateAmountSummary = (multiplierOverride = null) => {
    modalAmountLabel.textContent = resolvedAmountLabel;

    // Для форм постов НЕ обновляем сумму здесь - они управляют отображением сами через setSummary()
    if (POST_FORMS.includes(template.id)) {
      return;
    }

    // Для urlFieldForms НЕ используем сохраненный currentMultiplier, всегда пересчитываем
    const isUrlFieldForm = URL_FIELD_FORMS.includes(templateSelector);
    if (isUrlFieldForm && multiplierOverride === null) {
      // Временно удаляем currentMultiplier, чтобы computeMultiplier() пересчитал
      delete form.dataset.currentMultiplier;
      const multiplier = computeMultiplier();
      form.dataset.currentMultiplier = String(multiplier);

      const mode = form.dataset.mode;
      if (mode === 'price_per_item' && form.dataset.price) {
        updateModalAmount(modalAmount, form, { items: multiplier });
        return;
      }
      if (mode === 'price_per_item_w_bonus' && form.dataset.price) {
        updateModalAmount(modalAmount, form, { items: multiplier });
        return;
      }
    }

    const multiplier = multiplierOverride !== null ? multiplierOverride : computeMultiplier();
    form.dataset.currentMultiplier = String(multiplier);

    const mode = form.dataset.mode;

    // Для форм с mode используем новую универсальную функцию
    if (mode === 'price_per_item' && form.dataset.price) {
      updateModalAmount(modalAmount, form, { items: multiplier });
      return;
    }

    // Для форм с mode='price_per_item_w_bonus' используем универсальную функцию
    if (mode === 'price_per_item_w_bonus' && form.dataset.price) {
      updateModalAmount(modalAmount, form, { items: multiplier });
      return;
    }

    // Для topup/ams (mode='entered_amount') показываем просто price (только для админов)
    if (mode === 'entered_amount' && form.dataset.price && window.IS_ADMIN) {
      const priceNum = Number(form.dataset.price);
      modalAmount.textContent = formatNumber(priceNum);
      return;
    }

    // Для transfer (mode='price_w_entered_amount') показываем просто price
    if (mode === 'price_w_entered_amount' && form.dataset.price) {
      const priceNum = Number(form.dataset.price);
      modalAmount.textContent = formatNumber(priceNum);
      return;
    }

    // Для форм TOPUP и AMS показываем специальные значения
    const isTopupOrAms = templateSelector === toSelector(FORM_INCOME_TOPUP) || templateSelector === toSelector(FORM_INCOME_AMS);
    if (isTopupOrAms) {
      // Не-админам показываем "определяется индивидуально", админам - пусто
      modalAmount.textContent = window.IS_ADMIN ? '' : 'определяется индивидуально';
      return;
    }

    // Старая логика для форм без mode
    if (amountNumber === null) {
      modalAmount.textContent = amountRaw;
      return;
    }
    if (multiplier === 1 && multiplierOverride === null) {
      modalAmount.textContent = formatNumber(amountNumber);
      return;
    }
    const total = amountNumber * multiplier;
    modalAmount.textContent = `${formatNumber(amountNumber)} x ${multiplier} = ${formatNumber(total)}`;
  };

  // === URL FIELDS: вызываем логику для форм с дополнительными URL полями ===
  setupUrlFieldLogic({ template, modalFields, getExtraFields, updateAmountSummary, data });

  let addGiftGroup = null;
  let refreshGiftGroups = () => {};

  if (giftContainer && giftTemplateGroup) {
    const resetGiftGroup = (group) => {
      group.querySelectorAll('input, textarea').forEach((field) => {
        if (field.type === 'checkbox' || field.type === 'radio') {
          field.checked = false;
        } else {
          field.value = '';
        }
      });
      const removeBtn = group.querySelector('[data-gift-remove]');
      if (removeBtn) delete removeBtn.dataset.bound;
    };

    const attachGiftRemove = (group) => {
      const removeBtn = group.querySelector('[data-gift-remove]');
      if (!removeBtn || removeBtn.dataset.bound) return;
      removeBtn.dataset.bound = 'true';
      removeBtn.addEventListener('click', () => {
        if (getGiftGroups().length <= 1) return;
        group.remove();
        refreshGiftGroups();
      });
    };

    addGiftGroup = (options = {}) => {
      const { silent = false } = options;
      const clone = giftTemplateGroup.cloneNode(true);
      resetGiftGroup(clone);
      giftContainer.appendChild(clone);
      attachGiftRemove(clone);
      refreshGiftGroups();
      if (!silent) {
        requestAnimationFrame(() => {
          const focusable = clone.querySelector('[data-gift-recipient]');
          if (focusable && typeof focusable.focus === 'function') {
            try {
              focusable.focus({ preventScroll: true });
            } catch (err) {
              focusable.focus();
            }
          }
        });
      }
      return clone;
    };

    refreshGiftGroups = () => {
      const groups = getGiftGroups();
      const total = groups.length || 1;
      groups.forEach((group, idx) => {
        const index = idx + 1;
        const recipientInput = group.querySelector('[data-gift-recipient]');
        const fromInput = group.querySelector('[data-gift-from]');
        const wishInput = group.querySelector('[data-gift-wish]');
        const recipientLabel = group.querySelector('[data-gift-label="recipient"]');
        const fromLabel = group.querySelector('[data-gift-label="from"]');
        const wishLabel = group.querySelector('[data-gift-label="wish"]');
        if (recipientInput) {
          recipientInput.name = `recipient_${index}`;
          recipientInput.id = `gift-recipient-${index}`;
        }
        if (fromInput) {
          fromInput.name = `from_${index}`;
          fromInput.id = `gift-from-${index}`;
        }
        if (wishInput) {
          wishInput.name = `wish_${index}`;
          wishInput.id = `gift-wish-${index}`;
        }
        if (recipientLabel) {
          recipientLabel.textContent = index === 1 ? 'Получатель *' : `Получатель ${index} *`;
          recipientLabel.setAttribute('for', `gift-recipient-${index}`);
        }
        if (fromLabel) {
          fromLabel.textContent = index === 1 ? 'От кого' : `От кого ${index}`;
          fromLabel.setAttribute('for', `gift-from-${index}`);
        }
        if (wishLabel) {
          wishLabel.textContent = index === 1 ? 'Комментарий' : `Комментарий ${index}`;
          wishLabel.setAttribute('for', `gift-wish-${index}`);
        }
        const removeBtn = group.querySelector('[data-gift-remove]');
        if (removeBtn) {
          removeBtn.disabled = index === 1;
        }
        attachGiftRemove(group);
      });
      updateAmountSummary();
    };

    getGiftGroups().forEach((group) => {
      attachGiftRemove(group);
    });

    refreshGiftGroups();

    if (giftAddBtn) {
      giftAddBtn.addEventListener('click', () => {
        addGiftGroup();
      });
    }
  }

  updateAmountSummary();
  if (data) {
    if (giftContainer && giftTemplateGroup && addGiftGroup) {
      const maxGiftIndex = Object.keys(data).reduce((max, key) => {
        const match = key.match(/^(recipient|from|wish)_(\d+)$/);
        if (!match) return max;
        const idx = Number.parseInt(match[2], 10);
        return Number.isFinite(idx) ? Math.max(max, idx) : max;
      }, 1);
      while (getGiftGroups().length < maxGiftIndex) {
        addGiftGroup({ silent: true });
      }
      refreshGiftGroups();
    }
    Object.entries(data).forEach(([key, value]) => {
      const field = modalFields.querySelector(`[name="${key}"]`);
      if (!field) return;
      if (field.type === 'checkbox' || field.type === 'radio') {
        field.checked = Boolean(value);
      } else {
        field.value = value;
      }
    });
    refreshGiftGroups();
    updateAmountSummary();
  }

  return { counterWatcher };
}

// ============================================================================
// CLOSE MODAL
// ============================================================================

export function closeModal({ backdrop, form, modalFields, counterWatcher }) {
  counterWatcher = cleanupCounterWatcher(counterWatcher, modalFields, form);
  backdrop.removeAttribute('open');
  backdrop.setAttribute('aria-hidden', 'true');
  form.reset();
  modalFields.innerHTML = '';
  delete form.dataset.templateSelector;
  delete form.dataset.kind;
  delete form.dataset.amount;
  delete form.dataset.amountLabel;
  delete form.dataset.title;
  delete form.dataset.editingId;
  delete form.dataset.groupId;
  delete form.dataset.currentMultiplier;
  delete form.dataset.price;
  delete form.dataset.bonus;
  delete form.dataset.mode;

  return counterWatcher;
}
