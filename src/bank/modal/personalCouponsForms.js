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

    // Валидируем купон при рендеринге, чтобы показать предупреждения/ошибки сразу
    if (selectedPersonalCoupons.includes(coupon.id)) {
      validateCoupon(coupon, couponBlock, errorContainer, btnSubmit, activeCoupons, modalFields);
    }
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

  // Группируем купоны по формам для правильного расчета с учетом порядка применения
  const couponsByForm = {};

  selectedBlocks.forEach(block => {
    const couponId = block.dataset.couponId;
    const coupon = activeCoupons.find(c => c.id === couponId);
    if (!coupon) return;

    if (!couponsByForm[coupon.form]) {
      couponsByForm[coupon.form] = {
        item: [],
        fixed: [],
        percent: []
      };
    }
    couponsByForm[coupon.form][coupon.type].push(coupon);
  });

  // Обрабатываем купоны для каждой формы в правильном порядке
  Object.keys(couponsByForm).forEach(formId => {
    const coupons = couponsByForm[formId];
    let remainingCost = getCostForForm(formId);

    // 1. Применяем item купоны
    coupons.item.forEach(coupon => {
      const itemsInCart = countItemsForForm(formId);
      if (itemsInCart >= coupon.value) {
        const formSelector = '#' + formId;
        const formGroup = submissionGroups.find(g => g.templateSelector === formSelector && !g.isDiscount && !g.isPriceAdjustment && !g.isPersonalCoupon);
        if (formGroup) {
          const price = Number(formGroup.price) || 0;
          const discount = price * coupon.value;
          totalDiscount += discount;
          remainingCost -= discount;
        }
      }
    });

    // Вычитаем корректировки для этой формы (они применяются после item купонов, но до fixed)
    const formSelector = '#' + formId;
    const adjustmentGroup = submissionGroups.find(g => g.isPriceAdjustment);
    if (adjustmentGroup) {
      adjustmentGroup.entries.forEach(entry => {
        const adjustmentForm = entry.data?.form;
        if (adjustmentForm === formSelector) {
          const adjustmentAmount = Number(entry.data?.adjustment_amount) || 0;
          remainingCost -= adjustmentAmount;
        }
      });
    }

    // 2. Применяем fixed купоны
    coupons.fixed.forEach(coupon => {
      if (remainingCost > 0) {
        const discount = Math.min(coupon.value, remainingCost);
        totalDiscount += discount;
        remainingCost -= discount;
      }
    });

    // 3. Применяем percent купоны
    coupons.percent.forEach(coupon => {
      if (remainingCost > 0) {
        let percentValue = coupon.value;
        if (percentValue > 100) percentValue = 100;
        const discount = Math.ceil(remainingCost * (percentValue / 100));
        totalDiscount += discount;
        remainingCost -= discount;
      }
    });
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
    let costInCart = getCostForForm(coupon.form);

    // Находим текущий блок купона в DOM
    const currentBlock = Array.from(modalFields.querySelectorAll('.coupon-block')).find(
      block => block.dataset.couponId === coupon.id
    );

    // Вычитаем скидки от других выбранных купонов (кроме текущего)
    const selectedBlocks = modalFields.querySelectorAll('.coupon-block[data-selected="true"]');
    selectedBlocks.forEach(block => {
      const otherCouponId = block.dataset.couponId;
      if (otherCouponId !== coupon.id) {
        const otherCoupon = activeCoupons.find(c => c.id === otherCouponId);
        if (otherCoupon && otherCoupon.form === coupon.form) {
          // Вычисляем скидку от другого купона
          if (otherCoupon.type === 'item') {
            const itemsInCart = countItemsForForm(otherCoupon.form);
            if (itemsInCart >= otherCoupon.value) {
              const formSelector = '#' + otherCoupon.form;
              const formGroup = submissionGroups.find(g => g.templateSelector === formSelector && !g.isDiscount && !g.isPriceAdjustment && !g.isPersonalCoupon);
              if (formGroup) {
                const price = Number(formGroup.price) || 0;
                costInCart -= price * otherCoupon.value;
              }
            }
          } else if (otherCoupon.type === 'fixed') {
            // Для fixed купонов вычитаем только те, которые идут РАНЬШЕ в DOM
            // (они были выбраны раньше и применяются первыми)
            const allBlocks = Array.from(modalFields.querySelectorAll('.coupon-block'));
            const otherBlockIndex = allBlocks.indexOf(block);
            const currentBlockIndex = allBlocks.indexOf(currentBlock);

            if (otherBlockIndex < currentBlockIndex) {
              // Этот купон применяется раньше текущего
              const discount = Math.min(otherCoupon.value, costInCart);
              costInCart -= discount;
            }
          }
          // Percent купоны применяются ПОСЛЕ fixed, поэтому не вычитаем их при проверке fixed купона
        }
      }
    });

    // Вычитаем корректировки для этой формы (они применяются после item купонов, но до fixed)
    const formSelector = '#' + coupon.form;
    const adjustmentGroup = submissionGroups.find(g => g.isPriceAdjustment);
    if (adjustmentGroup) {
      adjustmentGroup.entries.forEach(entry => {
        const adjustmentForm = entry.data?.form;
        if (adjustmentForm === formSelector) {
          const adjustmentAmount = Number(entry.data?.adjustment_amount) || 0;
          costInCart -= adjustmentAmount;
        }
      });
    }

    if (costInCart <= 0) {
      errorMessage = `В корзине недостаточно средств после применения других купонов.`;
      isValid = false;
    } else {
      // Вычисляем фактически применяемую скидку
      const actualDiscount = Math.min(coupon.value, costInCart);

      // Показываем предупреждение только если купон применяется НЕ полностью
      if (actualDiscount < coupon.value) {
        errorMessage = `⚠️ Купон применён частично: будет использовано ${actualDiscount} из ${coupon.value}.`;
        errorContainer.style.color = '#f59e0b'; // Orange warning color
        errorContainer.style.display = 'block';
        errorContainer.textContent = errorMessage;
        return true; // Валидация пройдена
      }
    }
  } else if (coupon.type === 'percent') {
    let costInCart = getCostForForm(coupon.form);

    // Вычитаем скидки от других выбранных купонов которые применяются РАНЬШЕ percent (item и fixed)
    const selectedBlocks = modalFields.querySelectorAll('.coupon-block[data-selected="true"]');
    selectedBlocks.forEach(block => {
      const otherCouponId = block.dataset.couponId;
      if (otherCouponId !== coupon.id) {
        const otherCoupon = activeCoupons.find(c => c.id === otherCouponId);
        if (otherCoupon && otherCoupon.form === coupon.form) {
          // Вычисляем скидку от другого купона (только item и fixed)
          if (otherCoupon.type === 'item') {
            const itemsInCart = countItemsForForm(otherCoupon.form);
            if (itemsInCart >= otherCoupon.value) {
              const formSelector = '#' + otherCoupon.form;
              const formGroup = submissionGroups.find(g => g.templateSelector === formSelector && !g.isDiscount && !g.isPriceAdjustment && !g.isPersonalCoupon);
              if (formGroup) {
                const price = Number(formGroup.price) || 0;
                costInCart -= price * otherCoupon.value;
              }
            }
          } else if (otherCoupon.type === 'fixed') {
            costInCart -= Math.min(otherCoupon.value, costInCart);
          }
          // Другие percent купоны не вычитаем (они применяются параллельно)
        }
      }
    });

    // Вычитаем корректировки для этой формы
    const formSelector = '#' + coupon.form;
    const adjustmentGroup = submissionGroups.find(g => g.isPriceAdjustment);
    if (adjustmentGroup) {
      adjustmentGroup.entries.forEach(entry => {
        const adjustmentForm = entry.data?.form;
        if (adjustmentForm === formSelector) {
          const adjustmentAmount = Number(entry.data?.adjustment_amount) || 0;
          costInCart -= adjustmentAmount;
        }
      });
    }

    if (costInCart <= 0) {
      errorMessage = `В корзине недостаточно средств после применения других купонов.`;
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
