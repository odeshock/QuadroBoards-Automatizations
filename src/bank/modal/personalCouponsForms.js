// ============================================================================
// personalCouponsForms.js — Модальное окно для выбора персональных купонов
// ============================================================================

import {
  getActivePersonalCoupons,
  selectedPersonalCoupons,
  countItemsForForm,
  getCostForForm
} from '../services.js';

import {
  updateNote,
  clearErrorMessage
} from './helpers.js';

/**
 * Обработчик формы выбора персональных купонов
 * @returns {{ handled: boolean }}
 */
export function handlePersonalCouponsForm({ template, modalFields, btnSubmit }) {
  // Проверяем, что это форма персональных купонов
  if (template.id !== 'personal-coupon') {
    return { handled: false };
  }

  clearErrorMessage(modalFields);

  // Убираем "Пожалуйста, подождите..."
  const mutedNote = modalFields.querySelector('.muted-note');
  if (mutedNote) {
    mutedNote.remove();
  }

  // Получаем активные купоны
  const activeCoupons = getActivePersonalCoupons();

  if (!activeCoupons || activeCoupons.length === 0) {
    updateNote(modalFields, 'У вас нет доступных купонов.', { error: true });
    btnSubmit.disabled = true;
    return { handled: true };
  }

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
        couponBlock.style.borderColor = 'var(--primary, #3b82f6)';
        couponBlock.style.backgroundColor = 'var(--bg-hover, #f9fafb)';
      } else {
        couponBlock.style.borderColor = 'var(--border-color, #e5e7eb)';
        couponBlock.style.backgroundColor = '';
      }

      // Валидация и обновление всех купонов
      validateCoupon(coupon, couponBlock, errorContainer, btnSubmit);
      updateAllValidations();
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

  // Функция валидации одного купона
  function validateCoupon(coupon, couponBlock, errorContainer, btnSubmit) {
    const isSelected = couponBlock.dataset.selected === 'true';

    if (!isSelected) {
      errorContainer.style.display = 'none';
      errorContainer.textContent = '';
      return true; // Невыбранный купон не валидируем
    }

    let errorMessage = '';
    let isValid = true;

    // Валидация для разных типов купонов
    if (coupon.type === 'item') {
      // Проверяем, что форма существует в корзине
      const itemsInCart = countItemsForForm(coupon.form);

      if (itemsInCart === 0) {
        errorMessage = `В корзине нет операций типа "${coupon.form}".`;
        isValid = false;
      } else if (itemsInCart < coupon.value) {
        errorMessage = `Недостаточно позиций. Нужно: ${coupon.value}, в корзине: ${itemsInCart}.`;
        isValid = false;
      }
    } else if (coupon.type === 'fixed') {
      // Проверяем, что сумма в корзине достаточна
      const costInCart = getCostForForm(coupon.form);

      if (costInCart === 0) {
        errorMessage = `В корзине нет операций типа "${coupon.form}".`;
        isValid = false;
      } else if (costInCart < coupon.value) {
        errorMessage = `Недостаточная сумма. Нужно: ${coupon.value}, в корзине: ${costInCart}.`;
        isValid = false;
      }
    } else if (coupon.type === 'percent') {
      // Для процентных купонов проверяем только наличие операций
      const costInCart = getCostForForm(coupon.form);

      if (costInCart === 0) {
        errorMessage = `В корзине нет операций типа "${coupon.form}".`;
        isValid = false;
      }
    }

    if (!isValid) {
      errorContainer.textContent = errorMessage;
      errorContainer.style.display = 'block';
    } else {
      errorContainer.style.display = 'none';
      errorContainer.textContent = '';
    }

    return isValid;
  }

  // Функция для проверки всех выбранных купонов
  function updateAllValidations() {
    let allValid = true;
    const couponBlocks = modalFields.querySelectorAll('.coupon-block');

    // Сначала валидируем каждый купон индивидуально
    couponBlocks.forEach((couponBlock) => {
      const isSelected = couponBlock.dataset.selected === 'true';
      if (!isSelected) return;

      const couponId = couponBlock.dataset.couponId;
      const coupon = activeCoupons.find(c => c.id === couponId);
      const errorContainer = couponBlock.querySelector('.coupon-error');

      if (coupon && errorContainer) {
        const isValid = validateCoupon(coupon, couponBlock, errorContainer, btnSubmit);
        if (!isValid) {
          allValid = false;
        }
      }
    });

    // Проверяем, что выбран не более одного процентного купона для каждой формы
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

    // Если для формы выбрано более одного процентного купона, показываем ошибку
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
        // Убираем ошибку о дубликатах, если она была
        coupons.forEach(({ couponBlock }) => {
          const errorContainer = couponBlock.querySelector('.coupon-error');
          if (errorContainer && errorContainer.textContent.includes('Можно использовать только один процентный купон')) {
            errorContainer.style.display = 'none';
            errorContainer.textContent = '';
          }
        });
      }
    });

    // Обновляем состояние кнопки "Сохранить"
    btnSubmit.disabled = !allValid;
  }

  // Первоначальная валидация
  updateAllValidations();

  return { handled: true };
}
