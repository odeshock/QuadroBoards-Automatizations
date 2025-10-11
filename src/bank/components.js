// ============================================================================
// components.js — UI и модальные функции
// ============================================================================

import {
  ALLOWED_PARENTS,
  BASE_URL,
  COUNTER_POLL_INTERVAL_MS,
  FORM_TIMEOUT_MS,
  AMS_TIMEOUT_MS,
  GIFT_TIMEOUT_MS,
  FIRST_POST_TIMEOUT_MS,
  ADS_TIMEOUT_MS,
  counterConfigs,
  counterPrefixMap
} from './config.js';

import {
  formatNumber,
  parseNumericAmount,
  roundNewToAnchorDOM,
  fullMonthsDiffVirtualDOM,
  fmtYMD,
  submissionGroups,
  formatEntryKey,
  updateAutoDiscounts
} from './services.js';

import {
  SPECIAL_EXPENSE_FORMS,
  COUNTER_FORMS,
  BUYOUT_FORMS,
  URL_FIELD_FORMS,
  TEXT_MESSAGES,
  FORM_INCOME_FIRSTPOST,
  FORM_INCOME_FLYER,
  FORM_INCOME_NEEDREQUEST,
  FORM_INCOME_RPGTOP,
  FORM_INCOME_EP_PERSONAL,
  FORM_INCOME_EP_PLOT,
  GIFT_AND_DESIGN_FORMS,
  ADMIN_RECIPIENT_MULTI_FORMS,
  ADMIN_SINGLE_RECIPIENT_FORMS,
  ADMIN_AMOUNT_FORMS,
  POST_FORMS,
  toSelector
} from './constants.js';

import {
  ADMIN_RECIPIENT_FLOW_TIMEOUTS,
  ADMIN_SINGLE_RECIPIENT_TIMEOUTS,
  ADMIN_AMOUNT_CONFIG,
  POST_CONFIG,
  BANNER_ALREADY_PROCESSED_CONFIG
} from './components/modalConfig.js';


import {
  handleBannerAlreadyProcessed,
  setupAdminRecipientsFlow,
  setupAdminSingleRecipientFlow,
  setupAdminTopupFlow,
  setupTransferFlow,
  setupCustomGiftFlow,
  setupGiftFlow,
  setupBonusMaskCleanFlow,
  setupPostsModalFlow
} from './components/modalSetup.js';

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
      resolvedTitle = `Подарок из коллекции (#${giftId})`;
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
    modalAmount.textContent = amount || '';
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

const bannerState = handleBannerAlreadyProcessed({ template, modalTitle, modalFields, btnSubmit, backdrop });
if (bannerState.shouldReturn) {
  return { counterWatcher };
}


// === ADMIN multi-recipient начисления (анкета, акция, нужный, эпизод) ===
if (ADMIN_RECIPIENT_MULTI_FORMS.includes(template.id)) {
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
}

// === ADMIN AMOUNT: докупка кредитов, доп.деньги, переводы
if (ADMIN_AMOUNT_FORMS.includes(template.id)) {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none'; // инфо-режим (data-info)
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
}

// === BONUSES, MASK, CLEAN: выбор получателя + количество + от кого + комментарий
if (SPECIAL_EXPENSE_FORMS.includes(toSelector(template.id))) {
  counterWatcher = setupBonusMaskCleanFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: AMS_TIMEOUT_MS, data, modalAmount, basePrice: price });
}

// === GIFTS & DESIGN: подарки и оформление (иконки, плашки, фоны) ===
if (GIFT_AND_DESIGN_FORMS.map(f => f.replace("#", "")).includes(template.id)) {
  const isCustom = template.id.includes('custom');
  counterWatcher = isCustom
    ? setupCustomGiftFlow({
        modalFields, btnSubmit, counterWatcher,
        timeoutMs: GIFT_TIMEOUT_MS, data, modalAmount,
        giftId: config.giftId,
        giftIcon: config.giftIcon,
        price: config.price
      })
    : setupGiftFlow({
        modalFields, btnSubmit, counterWatcher,
        timeoutMs: GIFT_TIMEOUT_MS, data, modalAmount,
        giftId: config.giftId,
        giftIcon: config.giftIcon,
        price: config.price
      });
}

// === ADMIN single-recipient начисления (активист, постописец, пост полумесяца) ===
if (ADMIN_SINGLE_RECIPIENT_FORMS.includes(template.id)) {
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
}


// === FIRST POST: ждём FIRST_POST_FLAG, PLOT_POSTS и PERSONAL_POSTS ===
if (template.id === FORM_INCOME_FIRSTPOST) {
  // якорь "подождите..."
  const waitEl = updateNote(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    updateNote(modalFields, 'Произошла ошибка. Попробуйте обновить страницу.', { error: true });
    btnSubmit.style.display = 'none';
    cancel();
  };

  const show = (html, { ok = false, hideBtn = true } = {}) => {
    const el = updateNote(modalFields, html);
    if (ok && el) el.style.color = 'var(--ok)'; // зелёный для «Поздравляем…»
    btnSubmit.style.display = hideBtn ? 'none' : '';
    btnSubmit.disabled = hideBtn ? true : false;
  };

  const succeed = () => {
    if (canceled) return;

    const flag = window.FIRST_POST_FLAG;
    const personal = window.PERSONAL_POSTS;
    const plot = window.PLOT_POSTS;

    // строгая проверка типов
    if (typeof flag !== 'boolean' || !Array.isArray(personal) || !Array.isArray(plot)) {
      fail(); return;
    }

    // 1) уже начисляли
    if (flag === false) {
      show('**Начисление за первый пост на профиле уже производилось.**', { hideBtn: true });
      cancel(); return;
    }

    // 2) флаг true, но оба массива пустые
    if (flag === true && personal.length === 0 && plot.length === 0) {
      show('**Для начисления не хватает поста.**', { hideBtn: true });
      cancel(); return;
    }

    // 3) флаг true и хотя бы один массив непустой — успех
    show('**Поздравляем с первым постом!**', { ok: true, hideBtn: false });
    cancel();
  };

  const to = setTimeout(fail, FIRST_POST_TIMEOUT_MS);
  const poll = setInterval(() => {
    // Сначала проверяем флаг
    if (typeof window.FIRST_POST_FLAG === 'undefined') return;

    // Если флаг есть, но не boolean — ошибка
    if (typeof window.FIRST_POST_FLAG !== 'boolean') {
      fail(); return;
    }

    // Если флаг false — сразу показываем сообщение, не ждём массивы
    if (window.FIRST_POST_FLAG === false) {
      clearTimeout(to);
      clearInterval(poll);
      show('**Начисление за первый пост на профиле уже производилось.**', { hideBtn: true });
      cancel();
      return;
    }

    // Если флаг true — ждём появления обоих массивов
    if (typeof window.PERSONAL_POSTS === 'undefined' || typeof window.PLOT_POSTS === 'undefined') {
      return;
    }

    clearTimeout(to);
    clearInterval(poll);

    // Проверяем типы массивов
    if (!Array.isArray(window.PERSONAL_POSTS) || !Array.isArray(window.PLOT_POSTS)) {
      fail(); return;
    }

    succeed();
  }, COUNTER_POLL_INTERVAL_MS);
}


// === POST: личные и сюжетные посты ===
if (POST_FORMS.includes(template.id)) {
  const config = POST_CONFIG[template.id];
  counterWatcher = setupPostsModalFlow({
    modalFields,
    btnSubmit,
    counterWatcher,
    form,
    modalAmount,
    modalAmountLabel,
    ...config
  });
}

// === FLYER: ждём ADS_POSTS и рисуем список ===
if (template.id === FORM_INCOME_FLYER) {
  // показываем «ждём…» (у вас уже есть <p class="muted-note">Пожалуйста, подождите...</p>)
  updateNote(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  // helper для извлечения {src, text} из элемента массива (поддержим и вложенный словарь)
  const pickLink = (item) => {
    const dict = (item && (item.link || item.a || item)) || null;
    const src = dict && typeof dict.src === 'string' ? dict.src : null;
    const text = dict && (dict.text || src);
    return src ? { src, text } : null;
  };

  // отмена по закрытию
  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel }; // используем существующий механизм очистки

  // если что-то пошло не так
  const fail = () => {
    if (canceled) return;
    updateNote(modalFields, 'Произошла ошибка. Попробуйте обновить страницу.', { error: true });
    btnSubmit.style.display = '';      // кнопку всё же покажем
    btnSubmit.disabled = true;         // ...но заблокируем
    cancel();
  };

  const updateAmountSummary = (multiplier) => {
    form.dataset.currentMultiplier = String(multiplier);

    // Для форм с mode используем новую универсальную функцию
    const mode = form.dataset.mode;
    if (mode === 'price_per_item' && form.dataset.price) {
      updateModalAmount(modalAmount, form, { items: multiplier });
      return;
    }

    // Старая логика для форм без mode
    const amountRaw = amount || '';
    const amountNumber = parseNumericAmount(amountRaw);
    if (amountNumber === null) {
      modalAmount.textContent = amountRaw;
      return;
    }
    if (multiplier === 1) {
      modalAmount.textContent = formatNumber(amountNumber);
      return;
    }
    const total = amountNumber * multiplier;
    modalAmount.textContent = `${formatNumber(amountNumber)} x ${multiplier} = ${formatNumber(total)}`;
  };

  // удачный исход
  const succeed = (posts) => {
    if (canceled) return;

    // ⛔ если массив пустой — показываем сообщение и скрываем кнопку
    if (!Array.isArray(posts) || posts.length === 0) {
      updateNote(modalFields, '**Для новых начислений не хватает новых реклам.**');
      btnSubmit.style.display = 'none'; // скрываем кнопку полностью
      setHiddenField(modalFields, 'flyer_links_json', '');
      form.dataset.currentMultiplier = '0';
      updateAmountSummary(0);
      cancel();
      return;
    }

    // ✅ обычный успешный случай
    const links = posts.map(pickLink).filter(Boolean);
    setHiddenField(modalFields, 'flyer_links_json', JSON.stringify(links));

    form.dataset.currentMultiplier = String(links.length);
    updateAmountSummary(links.length);

    const note = updateNote(modalFields, '');
    if (note) note.remove();

    // НЕ удаляем «Пожалуйста, подождите...», а вставляем список ПОД ним
    const waitEl = modalFields.querySelector('.muted-note');

    // заголовок «Список листовок:»
    const caption = document.createElement('p');
    caption.className = 'list-caption';
    caption.innerHTML = '<strong>Список листовок:</strong>';

    // контейнер со скроллом + нумерованный список (как в «Личный пост»)
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `
      <div style="max-height:320px; overflow:auto">
        <ol class="entry-list" id="flyer-preview"></ol>
      </div>`;
    const ol = wrap.querySelector('#flyer-preview');

    // вставляем ПОД «Пожалуйста, подождите...»
    if (waitEl && waitEl.parentNode) {
      waitEl.insertAdjacentElement('afterend', caption);
      caption.insertAdjacentElement('afterend', wrap);
    } else {
      // если по каким-то причинам .muted-note нет — просто добавим в конец
      modalFields.appendChild(caption);
      modalFields.appendChild(wrap);
    }

    links.forEach(({ src, text }) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = src;
      a.textContent = text || src;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);
      ol.appendChild(li);
    });

    btnSubmit.style.display = '';
    btnSubmit.disabled = false;
    cancel();
  };


  // ждём ADS_POSTS не дольше ADS_TIMEOUT_MS
  const to = setTimeout(() => {
    // если переменная есть, но это не массив — это тоже ошибка
    if (typeof window.ADS_POSTS !== 'undefined' && !Array.isArray(window.ADS_POSTS)) return fail();
    return fail();
  }, ADS_TIMEOUT_MS);

  const poll = setInterval(() => {
    // моментально «фейлим», если тип неверный
    if (typeof window.ADS_POSTS !== 'undefined' && !Array.isArray(window.ADS_POSTS)) {
      fail();
      return;
    }
    // удача
    if (Array.isArray(window.ADS_POSTS)) {
      clearTimeout(to);
      clearInterval(poll);
      succeed(window.ADS_POSTS);
    }
  }, COUNTER_POLL_INTERVAL_MS);
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

    // Для topup/ams (mode='entered_amount') показываем просто price
    if (mode === 'entered_amount' && form.dataset.price) {
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

  // === COUNTER: 100 сообщений/репутации/позитива, месяц ===
  if (COUNTER_FORMS.includes(toSelector(template.id))) {
    const counterConfig = counterConfigs[template.id];
    let counterResultApplied = false;

    const renderCounterOutcome = (cfg, oldVal, newVal, rounded, diff) => {
      counterResultApplied = true;
      const units = diff > 0 ? diff / cfg.step : 0;
      setHiddenField(modalFields, `${cfg.prefix}_old`, oldVal);
      setHiddenField(modalFields, `${cfg.prefix}_new`, newVal);
      setHiddenField(modalFields, `${cfg.prefix}_rounded`, rounded);
      setHiddenField(modalFields, `${cfg.prefix}_diff`, diff);
      form.dataset.currentMultiplier = String(units);

      const roundLabel = cfg.prefix === 'month'
        ? 'условно округлено'
        : 'округлено до сотен';

      const lines = [
        `**Последнее обработанное значение:** ${oldVal}`,
        newVal !== rounded
          ? `**Новое значение:** ${newVal} **→ ${roundLabel}:** ${rounded}`
          : `**Новое значение:** ${newVal}`
      ];

      if (diff === 0) {
        lines.push('', `**Для новых начислений не хватает ${cfg.unitLabel}.**`);
        updateNote(modalFields, lines, { error: false });
        btnSubmit.style.display = 'none';
        btnSubmit.disabled = true;
        updateAmountSummary(0);
      } else {
        lines.push('', `**Будет начислена выплата за** ${rounded} - ${oldVal} = ${diff} **${cfg.diffNoteLabel}.**`);
        updateNote(modalFields, lines, { error: false });
        btnSubmit.style.display = '';
        btnSubmit.disabled = false;
        updateAmountSummary(units);
      }
    };

    const startCounterWatcher = (cfg) => {
      if (!cfg || counterResultApplied) return;
      const waitingText = TEXT_MESSAGES.PLEASE_WAIT;

      updateNote(modalFields, waitingText, { error: false });
      btnSubmit.style.display = 'none';
      btnSubmit.disabled = true;
      setHiddenField(modalFields, `${cfg.prefix}_old`);
      setHiddenField(modalFields, `${cfg.prefix}_new`);
      setHiddenField(modalFields, `${cfg.prefix}_rounded`);
      setHiddenField(modalFields, `${cfg.prefix}_diff`);

      const controller = { cancelled: false, timer: null };
      controller.cancel = () => {
        controller.cancelled = true;
        if (controller.timer) clearTimeout(controller.timer);
      };
      counterWatcher = controller;

      const startTime = performance.now();

      const concludeSuccess = (oldVal, newVal, rounded, diff) => {
        if (controller.cancelled) return;
        renderCounterOutcome(cfg, oldVal, newVal, rounded, diff);
      };

      const concludeError = () => {
        if (controller.cancelled) return;
        updateNote(modalFields, 'Произошла ошибка. Попробуйте обновить страницу.', { error: true });
        btnSubmit.style.display = 'none';
        btnSubmit.disabled = true;
        setHiddenField(modalFields, `${cfg.prefix}_old`);
        setHiddenField(modalFields, `${cfg.prefix}_new`);
        setHiddenField(modalFields, `${cfg.prefix}_rounded`);
        setHiddenField(modalFields, `${cfg.prefix}_diff`);
      };

      const poll = () => {
        if (controller.cancelled) return;

        const rawOld = window[cfg.oldVar];
        const rawNew = window[cfg.newVar];

        // ВЕТКА ДЛЯ МЕСЯЦЕВ: MONTH_OLD/MONTH_NEW — массивы [yyyy,mm,dd] или строка "yyyy-mm-dd"
        if (cfg.prefix === 'month') {
          const parseArr = (raw) => {
            if (Array.isArray(raw)) return raw.map(Number);
            if (typeof raw === 'string') {
              const s = raw.trim();
              // поддержим JSON-подобную строку вида "[2025,02,31]"
              if (s.startsWith('[')) {
                try {
                  const a = JSON.parse(s);
                  if (Array.isArray(a)) return a.map(Number);
                } catch (_) {}
              }
              const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
            }
            return null;
          };

          const OLD = parseArr(rawOld);
          const NEW = parseArr(rawNew);

          if (OLD && NEW && OLD.length === 3 && NEW.length === 3) {
            // НЕ валидируем даты намеренно — требование пользователя
            const newRoundedArr = roundNewToAnchorDOM(OLD, NEW);
            const diff = fullMonthsDiffVirtualDOM(OLD, NEW);

            // В общий рендер отдаём строки дат, diff — число
            concludeSuccess(
              fmtYMD(OLD),
              fmtYMD(NEW),
              fmtYMD(newRoundedArr),
              Math.max(0, Number(diff) || 0)
            );
            return;
          }
        } else {
          // СТАРАЯ ЧИСЛОВАЯ ВЕТКА (сообщения/репа/позитив)
          const oldVal = Number(rawOld);
          const newVal = Number(rawNew);
          const valid = Number.isFinite(oldVal) && Number.isFinite(newVal);
          if (valid) {
            const rounded = Math.floor(newVal / cfg.step) * cfg.step;
            const diffRaw = rounded - oldVal;
            const diff = diffRaw > 0 ? diffRaw : 0;
            concludeSuccess(oldVal, newVal, rounded, diff);
            return;
          }
        }

        if (performance.now() - startTime >= cfg.timeout) {
          concludeError();
          return;
        }
        controller.timer = setTimeout(poll, COUNTER_POLL_INTERVAL_MS);
      };

      poll();
    };

    // Prefill если есть data
    if (data) {
      const cfg = counterConfig;

      if (cfg.prefix === 'month') {
        const oldVal = data[`${cfg.prefix}_old`];
        const newVal = data[`${cfg.prefix}_new`];
        const roundedVal = data[`${cfg.prefix}_rounded`] ?? data[`${cfg.prefix}_new`];
        const diffVal = Number(data[`${cfg.prefix}_diff`]);

        if (oldVal && newVal && roundedVal && Number.isFinite(diffVal)) {
          renderCounterOutcome(cfg, oldVal, newVal, roundedVal, diffVal);
        }
      } else {
        const oldVal = Number(data[`${cfg.prefix}_old`]);
        const newVal = Number(data[`${cfg.prefix}_new`]);
        const roundedVal = Number(data[`${cfg.prefix}_rounded`] ?? data[`${cfg.prefix}_new`]);
        const diffVal = Number(data[`${cfg.prefix}_diff`]);
        if ([oldVal, newVal, roundedVal, diffVal].every(Number.isFinite)) {
          renderCounterOutcome(cfg, oldVal, newVal, roundedVal, diffVal);
        }
      }
    }

    // Запуск watcher если нет prefill
    if (!counterResultApplied) {
      startCounterWatcher(counterConfig);
    }
  }

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
