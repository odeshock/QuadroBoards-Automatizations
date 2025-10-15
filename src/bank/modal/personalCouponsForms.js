// ============================================================================
// personalCouponsForms.js — Модальное окно для выбора персональных купонов
// ============================================================================

import {
  getActivePersonalCoupons,
  selectedPersonalCoupons,
  countItemsForForm,
  getCostForForm,
  submissionGroups
} from '../services.js';

import {
  DEFAULT_TIMEOUT_MS
} from '../config.js';

import {
  TEXT_MESSAGES
} from '../constants.js';

import {
  showErrorMessage,
  clearErrorMessage
} from './helpers.js';

/**
 * Функция для рендеринга купонов
 */
function renderCoupons(activeCoupons, modalFields, btnSubmit) {
  // Создаем контейнер для купонов
  const couponsContainer = document.createElement('div');
  couponsContainer.className = 'coupons-container';
  couponsContainer.style.display = 'flex';
  couponsContainer.style.flexDirection = 'column';
  couponsContainer.style.gap = '16px';

  // Для каждого купона создаем блок
  activeCoupons.forEach((coupon, index) => {
    const couponBlock = document.createElement('div');
    couponBlock.className = 'coupon-block';
    couponBlock.style.border = '2px solid var(--border-color, #e5e7eb)';
    couponBlock.style.borderRadius = '8px';
    couponBlock.style.padding = '12px';
    couponBlock.style.cursor = 'pointer';
    couponBlock.style.transition = 'all 0.2s';
    couponBlock.dataset.couponId = coupon.id;
    couponBlock.dataset.selected = 'false';

    // Если купон уже был выбран ранее, отмечаем его
    if (selectedPersonalCoupons.includes(coupon.id)) {
      couponBlock.dataset.selected = 'true';
      couponBlock.classList.add('chosen');
      couponBlock.style.borderColor = 'var(--primary, #3b82f6)';
      couponBlock.style.backgroundColor = 'var(--bg-hover, #f9fafb)';
    }

    // Вставляем HTML блок купона
    const htmlContainer = document.createElement('div');
    htmlContainer.innerHTML = coupon.html || '';
    couponBlock.appendChild(htmlContainer);

    // Контейнер для сообщений об ошибках валидации
    const errorContainer = document.createElement('div');
    errorContainer.className = 'coupon-error';
    errorContainer.style.color = 'var(--danger, #ef4444)';
    errorContainer.style.fontSize = '0.875rem';
    errorContainer.style.marginTop = '8px';
    errorContainer.style.display = 'none';
    couponBlock.appendChild(errorContainer);

    couponsContainer.appendChild(couponBlock);

    // Добавляем слушатель для клика по купону
    couponBlock.addEventListener('click', () => {
      const isSelected = couponBlock.dataset.selected === 'true';

      // Переключаем состояние
      couponBlock.dataset.selected = isSelected ? 'false' : 'true';

      if (couponBlock.dataset.selected === 'true') {
        couponBlock.classList.add('chosen');
        couponBlock.style.borderColor = 'var(--primary, #3b82f6)';
        couponBlock.style.backgroundColor = 'var(--bg-hover, #f9fafb)';
      } else {
        couponBlock.classList.remove('chosen');
        couponBlock.style.borderColor = 'var(--border-color, #e5e7eb)';
        couponBlock.style.backgroundColor = '';
      }

      // Валидация и обновление всех купонов
      validateCoupon(coupon, couponBlock, errorContainer, btnSubmit, activeCoupons, modalFields);
      updateAllValidations(activeCoupons, modalFields, btnSubmit);

      // Обновляем сумму скидки в футере
      const modalAmount = document.getElementById('modal-amount');
      if (modalAmount) {
        updateCouponDiscount(activeCoupons, modalFields, modalAmount);
      }
    });

    // Hover эффект
    couponBlock.addEventListener('mouseenter', () => {
      if (couponBlock.dataset.selected !== 'true') {
        couponBlock.style.borderColor = 'var(--primary, #3b82f6)';
      }
    });

    couponBlock.addEventListener('mouseleave', () => {
      if (couponBlock.dataset.selected !== 'true') {
        couponBlock.style.borderColor = 'var(--border-color, #e5e7eb)';
      }
    });
  });

  modalFields.appendChild(couponsContainer);

  // Обновляем футер для отображения скидки
  const modalAmountLabel = document.getElementById('modal-amount-label');
  const modalAmount = document.getElementById('modal-amount');
  if (modalAmountLabel) {
    modalAmountLabel.textContent = 'Скидка';
  }
  if (modalAmount) {
    // Вычисляем начальную скидку
    updateCouponDiscount(activeCoupons, modalFields, modalAmount);
  }

  // Первоначальная валидация
  updateAllValidations(activeCoupons, modalFields, btnSubmit);

  // Показываем кнопку сохранить
  btnSubmit.style.display = '';
  btnSubmit.disabled = false;
}

/**
 * Обновляет отображение суммы скидки в футере
 */
function updateCouponDiscount(activeCoupons, modalFields, modalAmount) {
  let totalDiscount = 0;
  const selectedBlocks = modalFields.querySelectorAll('.coupon-block[data-selected="true"]');

  selectedBlocks.forEach(block => {
    const couponId = block.dataset.couponId;
    const coupon = activeCoupons.find(c => c.id === couponId);

    if (!coupon) return;

    // Вычисляем скидку для каждого типа купона
    if (coupon.type === 'item') {
      const itemsInCart = countItemsForForm(coupon.form);
      if (itemsInCart >= coupon.value) {
        // Находим группу для получения price
        const formSelector = '#' + coupon.form;
        const formGroup = submissionGroups.find(g => g.templateSelector === formSelector && !g.isDiscount && !g.isPriceAdjustment && !g.isPersonalCoupon);
        if (formGroup) {
          const price = Number(formGroup.price) || 0;
          totalDiscount += price * coupon.value;
        }
      }
    } else if (coupon.type === 'fixed') {
      const costInCart = getCostForForm(coupon.form);
      if (costInCart > 0) {
        totalDiscount += Math.min(coupon.value, costInCart);
      }
    } else if (coupon.type === 'percent') {
      const costInCart = getCostForForm(coupon.form);
      if (costInCart > 0) {
        let percentValue = coupon.value;
        if (percentValue > 100) percentValue = 100;
        totalDiscount += Math.ceil(costInCart * (percentValue / 100));
      }
    }
  });

  if (modalAmount) {
    modalAmount.textContent = totalDiscount > 0 ? totalDiscount : '0';
  }
}

/**
 * Функция валидации одного купона
 */
function validateCoupon(coupon, couponBlock, errorContainer, btnSubmit, activeCoupons, modalFields) {
  const isSelected = couponBlock.dataset.selected === 'true';

  if (!isSelected) {
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
    return true;
  }

  let errorMessage = '';
  let isValid = true;

  if (coupon.type === 'item') {
    const itemsInCart = countItemsForForm(coupon.form);
    if (itemsInCart === 0) {
      errorMessage = `В корзине нет операций типа "${coupon.form}".`;
      isValid = false;
    } else if (itemsInCart < coupon.value) {
      errorMessage = `Недостаточно позиций. Нужно: ${coupon.value}, в корзине: ${itemsInCart}.`;
      isValid = false;
    }
  } else if (coupon.type === 'fixed') {
    const costInCart = getCostForForm(coupon.form);
    if (costInCart === 0) {
      errorMessage = `В корзине нет операций типа "${coupon.form}".`;
      isValid = false;
    } else if (costInCart < coupon.value) {
      // Купон применяется частично - показываем предупреждение, но не блокируем
      errorMessage = `⚠️ Купон применён частично: будет использовано ${costInCart} из ${coupon.value}.`;
      errorContainer.style.color = '#f59e0b'; // Orange warning color
      errorContainer.style.display = 'block';
      errorContainer.textContent = errorMessage;
      return true; // Валидация пройдена
    }
  } else if (coupon.type === 'percent') {
    const costInCart = getCostForForm(coupon.form);
    if (costInCart === 0) {
      errorMessage = `В корзине нет операций типа "${coupon.form}".`;
      isValid = false;
    }
  }

  if (!isValid) {
    errorContainer.style.color = 'var(--danger, #ef4444)'; // Red error color
    errorContainer.textContent = errorMessage;
    errorContainer.style.display = 'block';
  } else {
    errorContainer.style.display = 'none';
    errorContainer.textContent = '';
    errorContainer.style.color = 'var(--danger, #ef4444)'; // Reset to default
  }

  return isValid;
}

/**
 * Функция для проверки всех выбранных купонов
 */
function updateAllValidations(activeCoupons, modalFields, btnSubmit) {
  let allValid = true;
  const couponBlocks = modalFields.querySelectorAll('.coupon-block');

  couponBlocks.forEach((couponBlock) => {
    const isSelected = couponBlock.dataset.selected === 'true';
    if (!isSelected) return;

    const couponId = couponBlock.dataset.couponId;
    const coupon = activeCoupons.find(c => c.id === couponId);
    const errorContainer = couponBlock.querySelector('.coupon-error');

    if (coupon && errorContainer) {
      const isValid = validateCoupon(coupon, couponBlock, errorContainer, btnSubmit, activeCoupons, modalFields);
      if (!isValid) {
        allValid = false;
      }
    }
  });

  const selectedPercentCoupons = {};
  couponBlocks.forEach((couponBlock) => {
    const isSelected = couponBlock.dataset.selected === 'true';
    if (!isSelected) return;

    const couponId = couponBlock.dataset.couponId;
    const coupon = activeCoupons.find(c => c.id === couponId);

    if (coupon && coupon.type === 'percent') {
      const formId = coupon.form;
      if (!selectedPercentCoupons[formId]) {
        selectedPercentCoupons[formId] = [];
      }
      selectedPercentCoupons[formId].push({ coupon, couponBlock });
    }
  });

  Object.keys(selectedPercentCoupons).forEach(formId => {
    const coupons = selectedPercentCoupons[formId];
    if (coupons.length > 1) {
      allValid = false;
      coupons.forEach(({ coupon, couponBlock }) => {
        const errorContainer = couponBlock.querySelector('.coupon-error');
        if (errorContainer) {
          errorContainer.textContent = `Можно использовать только один процентный купон для формы "${formId}".`;
          errorContainer.style.display = 'block';
        }
      });
    } else {
      coupons.forEach(({ couponBlock }) => {
        const errorContainer = couponBlock.querySelector('.coupon-error');
        if (errorContainer && errorContainer.textContent.includes('Можно использовать только один процентный купон')) {
          errorContainer.style.display = 'none';
          errorContainer.textContent = '';
        }
      });
    }
  });

  btnSubmit.disabled = !allValid;
}

/**
 * Обработчик формы выбора персональных купонов
 * @returns {{ handled: boolean, counterWatcher }}
 */
export function handlePersonalCouponsForm({ template, modalFields, btnSubmit }) {
  // Проверяем, что это форма персональных купонов
  if (template.id !== 'personal-coupon') {
    return { handled: false };
  }

  clearErrorMessage(modalFields);

  // Проверяем, есть ли купоны уже сейчас
  const couponsAvailable = typeof window.PERSONAL_DISCOUNTS !== 'undefined' && Array.isArray(window.PERSONAL_DISCOUNTS);

  // Если купоны уже загружены, показываем их сразу
  if (couponsAvailable) {
    const activeCoupons = getActivePersonalCoupons();

    // Убираем "Пожалуйста, подождите..."
    const mutedNote = modalFields.querySelector('.muted-note');
    if (mutedNote) {
      mutedNote.remove();
    }

    // Если купонов нет, показываем сообщение
    if (!activeCoupons || activeCoupons.length === 0) {
      const msg = document.createElement('p');
      msg.innerHTML = '<strong>У вас нет доступных купонов.</strong>';
      msg.style.color = 'var(--danger, #ef4444)';

      const infoBlock = modalFields.querySelector('.info');
      if (infoBlock) {
        infoBlock.insertAdjacentElement('afterend', msg);
      } else {
        modalFields.appendChild(msg);
      }

      btnSubmit.style.display = 'none';
      return { handled: true };
    }

    // Рендерим купоны сразу
    renderCoupons(activeCoupons, modalFields, btnSubmit);
    return { handled: true };
  }

  // Купоны ещё не загружены - ждём с таймаутом
  // Шаблон уже содержит info block и "Пожалуйста, подождите..."
  // Создаем механизм отмены
  let canceled = false;
  let timeoutHandle = null;
  let checkInterval = null;

  const cancel = () => {
    canceled = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (checkInterval) clearInterval(checkInterval);
  };
  const counterWatcher = { cancel };

  // Функция для показа ошибки таймаута
  const onTimeout = () => {
    if (canceled) return;
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    btnSubmit.style.display = 'none';
    cancel();
  };

  // Функция для успешной загрузки купонов
  const onSuccess = (activeCoupons) => {
    if (canceled) return;

    // Убираем "Пожалуйста, подождите..."
    const mutedNote = modalFields.querySelector('.muted-note');
    if (mutedNote) {
      mutedNote.remove();
    }

    // Если купонов нет, показываем сообщение
    if (!activeCoupons || activeCoupons.length === 0) {
      const msg = document.createElement('p');
      msg.innerHTML = '<strong>У вас нет доступных купонов.</strong>';
      msg.style.color = 'var(--danger, #ef4444)';

      const infoBlock = modalFields.querySelector('.info');
      if (infoBlock) {
        infoBlock.insertAdjacentElement('afterend', msg);
      } else {
        modalFields.appendChild(msg);
      }

      btnSubmit.style.display = 'none';
      cancel();
      return;
    }

    // Рендерим купоны
    renderCoupons(activeCoupons, modalFields, btnSubmit);
    cancel();
  };


  // Запускаем проверку с таймаутом
  timeoutHandle = setTimeout(onTimeout, DEFAULT_TIMEOUT_MS);

  checkInterval = setInterval(() => {
    if (canceled) {
      clearInterval(checkInterval);
      return;
    }

    const activeCoupons = getActivePersonalCoupons();
    // Проверяем, что купоны загружены (массив существует и определён)
    if (typeof window.PERSONAL_DISCOUNTS !== 'undefined' && Array.isArray(window.PERSONAL_DISCOUNTS)) {
      clearInterval(checkInterval);
      clearTimeout(timeoutHandle);
      onSuccess(activeCoupons);
    }
  }, 100);

  return { handled: true, counterWatcher };
}
