// ============================================================================
// buyoutForms.js — Формы выкупа (exp-face, exp-char, exp-need)
// ============================================================================

import {
  formatNumber,
  parseNumericAmount
} from '../services.js';

import {
  updateModalAmount
} from '../results.js';

import {
  BUYOUT_FORMS,
  toSelector
} from '../constants.js';

export function handleBuyoutForms({ template, modalFields, modalAmount, form, amount }) {
  if (!BUYOUT_FORMS.includes(toSelector(template.id))) return { handled: false };

  const quantityInput = modalFields.querySelector('input[name="quantity"]');
  if (!quantityInput) return { handled: true };

  const mode = form.dataset.mode;
  const amountRaw = amount || '';
  const amountNumber = parseNumericAmount(amountRaw);

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

  return { handled: true };
}
