// ============================================================================
// bannerForms.js — Формы баннеров с проверкой флага
// ============================================================================

import {
  BANNER_TIMEOUT_MS
} from '../config.js';

import {
  TEXT_MESSAGES
} from '../constants.js';

import {
  BANNER_ALREADY_PROCESSED_CONFIG
} from './config.js';

import {
  showErrorMessage
} from './helpers.js';

export function handleBannerForms({ template, modalFields, btnSubmit, counterWatcher }) {
  const config = BANNER_ALREADY_PROCESSED_CONFIG[template.id];
  if (!config) return { handled: false, counterWatcher };

  const { flagKey, message } = config;

  // Шаблон уже содержит info block и "Пожалуйста, подождите..."
  // Ничего дополнительно добавлять не нужно

  // 3) Создаем механизм отмены
  let canceled = false;
  let timeoutHandle = null;
  let checkInterval = null;

  const cancel = () => {
    canceled = true;
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (checkInterval) clearInterval(checkInterval);
  };
  counterWatcher = { cancel };

  // 4) Функция для показа ошибки таймаута
  const onTimeout = () => {
    if (canceled) return;
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    btnSubmit.style.display = 'none';
    cancel();
  };

  // 5) Функция для успешной загрузки
  const onSuccess = (flagValue) => {
    if (canceled) return;

    // Если флаг false - уже обработано
    if (flagValue === false) {
      // Удаляем "Пожалуйста, подождите..."
      const waitEl = modalFields.querySelector('.muted-note');
      if (waitEl) waitEl.remove();

      // Создаем сообщение и вставляем после info
      const msg = document.createElement('p');
      msg.innerHTML = `<strong>${message}</strong>`;

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

    // Если флаг true - показываем поле для ввода ссылки
    if (flagValue === true) {
      const note = modalFields.querySelector('.muted-note');
      if (note) note.remove();

      // Создаем поле для ссылки
      const fieldWrap = document.createElement('div');
      fieldWrap.className = 'field';
      fieldWrap.innerHTML = `
        <label for="url">Ссылка на скрин *</label>
        <input id="url" name="url" type="url" required">
      `;
      modalFields.appendChild(fieldWrap);

      btnSubmit.style.display = '';
      btnSubmit.disabled = false;
      cancel();
      return;
    }

    // Неожиданное значение флага
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    btnSubmit.style.display = 'none';
    cancel();
  };

  // 6) Запускаем проверку с таймаутом
  timeoutHandle = setTimeout(onTimeout, BANNER_TIMEOUT_MS);

  checkInterval = setInterval(() => {
    if (canceled) {
      clearInterval(checkInterval);
      return;
    }

    const flagValue = window[flagKey];
    if (typeof flagValue !== 'undefined') {
      clearInterval(checkInterval);
      clearTimeout(timeoutHandle);
      onSuccess(flagValue);
    }
  }, 100);

  return { handled: true, counterWatcher };
}
