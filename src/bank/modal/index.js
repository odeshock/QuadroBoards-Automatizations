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
  COUNTER_FORMS,
  BUYOUT_FORMS,
  URL_FIELD_FORMS,
  TEXT_MESSAGES,
  FORM_INCOME_NEEDREQUEST,
  FORM_INCOME_RPGTOP,
  FORM_INCOME_EP_PERSONAL,
  FORM_INCOME_EP_PLOT,
  FORM_INCOME_TOPUP,
  FORM_INCOME_AMS,
  toSelector
} from '../constants.js';

import {
  BANNER_ALREADY_PROCESSED_CONFIG
} from './config.js';


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

// ============================================================================
// BANNER ALREADY PROCESSED CHECK
// ============================================================================

function handleBannerAlreadyProcessed({ template, modalFields, btnSubmit }) {
  const config = BANNER_ALREADY_PROCESSED_CONFIG[template.id];
  if (!config) return { shouldReturn: false };

  const { flagKey, message } = config;
  // Проверяем, что флаг определён и равен false (уже обработан)
  if (typeof window[flagKey] === 'undefined' || window[flagKey] !== false) {
    return { shouldReturn: false };
  }

  // Баннер уже обработан - показываем сообщение
  modalFields.innerHTML = `<p><strong>${message}</strong></p>`;
  btnSubmit.style.display = 'none';

  return { shouldReturn: true };
}

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

    // Для форм с получателями (бонусы, маска, жилет, подарки) показываем базовую цену
    const hasRecipientField = templateSelector?.includes('bonus') ||
                              templateSelector?.includes('mask') ||
                              templateSelector?.includes('clean') ||
                              templateSelector?.includes('gift') ||
                              templateSelector?.includes('icon') ||
                              templateSelector?.includes('badge') ||
                              templateSelector?.includes('bg');

    if (initialItems === 0 && hasRecipientField) {
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

const bannerState = handleBannerAlreadyProcessed({ template, modalFields, btnSubmit });
if (bannerState.shouldReturn) {
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
const postResult = handlePostForms({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, modalAmountLabel });
if (postResult.handled) {
  counterWatcher = postResult.counterWatcher;
}

// === FLYER: ждём ADS_POSTS и рисуем список ===
const flyerResult = handleFlyerForm({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, amount });
if (flyerResult.handled) {
  counterWatcher = flyerResult.counterWatcher;
}

// === COUNTER: 100 сообщений/репутации/позитива, месяц ===
const counterResult = handleCounterForms({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, modalAmountLabel, data });
if (counterResult.handled) {
  counterWatcher = counterResult.counterWatcher;
}

  // === URL FIELDS: формы с дополнительными URL полями ===
  const isUrlFieldForm = URL_FIELD_FORMS.includes(toSelector(template.id));
  const isNeedRequest = template.id === FORM_INCOME_NEEDREQUEST;
  const isRpgTop = template.id === FORM_INCOME_RPGTOP;
  const isEpPersonal = template.id === FORM_INCOME_EP_PERSONAL;
  const isEpPlot = template.id === FORM_INCOME_EP_PLOT;

  const scrollContainer = modalFields.parentElement;
  const addExtraBtn = modalFields.querySelector('[data-add-extra]');
  const giftContainer = modalFields.querySelector('[data-gift-container]');
  const giftAddBtn = modalFields.querySelector('[data-add-gift-group]');
  const giftTemplateGroup = giftContainer ? giftContainer.querySelector('[data-gift-group]') : null;
  const extraPrefixAttr = addExtraBtn ? addExtraBtn.getAttribute('data-extra-prefix') : null;
  const extraLabelBase = addExtraBtn ? addExtraBtn.getAttribute('data-extra-label') : null;
  const extraPlaceholderCustom = addExtraBtn ? addExtraBtn.getAttribute('data-extra-placeholder') : null;
  const extraStartAttr = addExtraBtn ? Number.parseInt(addExtraBtn.getAttribute('data-extra-start'), 10) : NaN;
  const requiresUrlType = isUrlFieldForm;
  const typeOverride = requiresUrlType ? 'url' : null;
  const extraPrefix = extraPrefixAttr || (isNeedRequest ? 'need_extra_' : 'extra_');
  const baseIndex = Number.isFinite(extraStartAttr)
    ? extraStartAttr
    : ((isNeedRequest || isRpgTop || isEpPersonal || isEpPlot) ? 2 : 1);



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
    if (COUNTER_FORMS.includes(toSelector(template.id))) {
      const storedRaw = form.dataset.currentMultiplier;
      const stored = storedRaw !== undefined ? Number.parseFloat(storedRaw) : NaN;
      return Number.isFinite(stored) ? stored : 1;
    }
    if (!addExtraBtn) return 1;
    return 1 + getExtraFields().length;
  };

  const updateAmountSummary = (multiplierOverride = null) => {
    modalAmountLabel.textContent = resolvedAmountLabel;
    const multiplier = multiplierOverride !== null ? multiplierOverride : computeMultiplier();
    form.dataset.currentMultiplier = String(multiplier);

    // Для форм с mode используем новую универсальную функцию
    const mode = form.dataset.mode;
    if (mode === 'price_per_item' && form.dataset.price) {
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

  // === BUYOUT: формы выкупа ===
  if (BUYOUT_FORMS.includes(toSelector(template.id))) {
    const quantityInput = modalFields.querySelector('input[name="quantity"]');
    if (quantityInput) {
      const mode = form.dataset.mode;

      // Для форм с mode используем универсальную функцию
      if (mode === 'price_per_item') {
        const updateQuantityAmount = () => {
          const qty = Number(quantityInput.value) || 1;
          updateModalAmount(modalAmount, form, { items: qty });
        };
        quantityInput.addEventListener('input', updateQuantityAmount);
        updateQuantityAmount();
      } else if (amountNumber !== null) {
        // Старая логика для форм без mode (для обратной совместимости)
        const updateQuantityAmount = () => {
          const qty = Number(quantityInput.value) || 1;
          const total = amountNumber * qty;
          modalAmount.textContent = `${formatNumber(amountNumber)} × ${qty} = ${formatNumber(total)}`;
        };
        quantityInput.addEventListener('input', updateQuantityAmount);
        updateQuantityAmount();
      }
    }
  }

  const parseSuffix = (key) => {
    if (!key || !key.startsWith(extraPrefix)) return NaN;
    const trimmed = key.slice(extraPrefix.length);
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? NaN : parsed;
  };

  const refreshExtraFields = () => {
    getExtraFields().forEach((field, idx) => {
      const input = field.querySelector('input, textarea, select');
      if (!input) return;
      const label = field.querySelector('label');
      const suffix = baseIndex + idx;
      const nameAttr = `${extraPrefix}${suffix}`;
      input.name = nameAttr;
      input.id = nameAttr;
      input.required = true;
      if (label) {
        let computedLabel;
        if (extraLabelBase) {
          computedLabel = `${extraLabelBase} ${suffix}`;
        } else if (template.id === FORM_INCOME_NEEDREQUEST) {
          computedLabel = `Ссылка на «нужного» ${suffix}`;
        } else if (template.id === FORM_INCOME_RPGTOP) {
          computedLabel = `Ссылка на скрин ${suffix}`;
        } else if (template.id === FORM_INCOME_EP_PERSONAL || template.id === FORM_INCOME_EP_PLOT) {
          computedLabel = `Ссылка на эпизод ${suffix}`;
        } else {
          computedLabel = `Доп. поле ${suffix}`;
        }
        label.textContent = computedLabel;

        label.setAttribute('for', nameAttr);
      }
    });
  };

  const getNextSuffix = () => {
    const suffixes = getExtraFields()
      .map((field) => {
        const input = field.querySelector('input, textarea, select');
        const currentName = input && input.name ? input.name : '';
        return parseSuffix(currentName);
      })
      .filter((num) => Number.isFinite(num));
    if (!suffixes.length) return baseIndex;
    return Math.max(...suffixes) + 1;
  };

  let addExtraField = null;
  if (addExtraBtn) {
    addExtraField = (options = {}) => {
      const { silent = false, presetKey = null } = options;
      let suffix = parseSuffix(presetKey);
      if (!Number.isFinite(suffix)) {
        suffix = getNextSuffix();
      }
      const nameAttr = `${extraPrefix}${suffix}`;
      const wrap = document.createElement('div');
      wrap.className = 'field extra-field';

      const label = document.createElement('label');

      let labelText = '';
      if (template.id === FORM_INCOME_NEEDREQUEST) {
        labelText = `Ссылка на «нужного» ${suffix}`;
      } else if (template.id === FORM_INCOME_RPGTOP) {
        labelText = `Ссылка на скрин ${suffix}`;
      } else if (template.id === FORM_INCOME_EP_PERSONAL || template.id === FORM_INCOME_EP_PLOT) {
        labelText = `Ссылка на эпизод ${suffix}`;
      } else {
        labelText = `Доп. поле ${suffix}`;
      }
      label.textContent = labelText;

      const inputType = typeOverride || (isNeedRequest ? 'url' : 'text');
      const placeholderAttr = extraPlaceholderCustom ? ` placeholder="${extraPlaceholderCustom}"` : '';

      wrap.innerHTML = `
        <label for="${nameAttr}">${labelText}</label>
        <div class="extra-input">
          <input id="${nameAttr}" name="${nameAttr}" type="${inputType}"${placeholderAttr} required>
          <button type="button" class="btn-remove-extra" aria-label="Удалить поле" title="Удалить поле">×</button>
        </div>
      `;

      addExtraBtn.parentElement.insertAdjacentElement('beforebegin', wrap);

      const input = wrap.querySelector('input, textarea, select');
      if (input) input.required = true;

      const removeBtn = wrap.querySelector('.btn-remove-extra');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          wrap.remove();
          refreshExtraFields();
          updateAmountSummary();
        });
      }

      if (!presetKey) {
        refreshExtraFields();
      }

      requestAnimationFrame(() => {
        if (silent) return;
        if (scrollContainer) {
          const top = scrollContainer.scrollHeight;
          scrollContainer.scrollTo({ top, behavior: 'smooth' });
        } else {
          wrap.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }
        if (input && typeof input.focus === 'function') {
          try {
            input.focus({ preventScroll: true });
          } catch (err) {
            input.focus();
          }
        }
      });

      if (!silent && !presetKey) {
        updateAmountSummary();
      }

      return wrap;
    };

    addExtraBtn.addEventListener('click', () => {
      addExtraField();
    });
  }

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
    const baseNames = Array.from(modalFields.querySelectorAll('[name]')).map((el) => el.name);
    const toAdd = Object.keys(data).filter((key) => !baseNames.includes(key));
    if (addExtraField && toAdd.length) {
      toAdd
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .forEach((key) => addExtraField({ silent: true, presetKey: key }));
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
    refreshExtraFields();
    refreshGiftGroups();
    updateAmountSummary();
  }

  backdrop.setAttribute('open', '');
  backdrop.removeAttribute('aria-hidden');

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
