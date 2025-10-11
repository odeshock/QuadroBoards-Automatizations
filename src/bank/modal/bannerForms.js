// ============================================================================
// bannerForms.js — Проверка баннеров "уже обработано"
// ============================================================================

import {
  BANNER_ALREADY_PROCESSED_CONFIG
} from './config.js';

export function handleBannerAlreadyProcessed({ template, modalFields, btnSubmit }) {
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
