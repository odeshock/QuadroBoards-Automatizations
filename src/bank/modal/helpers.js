// ============================================================================
// helpers.js — Общие вспомогательные функции для модальных окон
// ============================================================================

import { COUNTER_POLL_INTERVAL_MS } from '../config.js';
import { TEXT_MESSAGES } from '../constants.js';

// ============================================================================
// UI HELPERS - Работа с сообщениями и очисткой
// ============================================================================

/**
 * Показывает сообщение ожидания в модальном окне
 */
export function showWaitMessage(modalFields, message = TEXT_MESSAGES.PLEASE_WAIT) {
  let waitNote = modalFields.querySelector('.muted-note');
  if (!waitNote) {
    waitNote = document.createElement('p');
    waitNote.className = 'muted-note';

    // Вставляем после system-info или info, если есть, иначе в начало
    const infoBlock = modalFields.querySelector('.system-info, .info');
    if (infoBlock) {
      infoBlock.insertAdjacentElement('afterend', waitNote);
    } else {
      modalFields.prepend(waitNote);
    }
  }
  waitNote.textContent = message;
  return waitNote;
}

/**
 * Скрывает сообщение ожидания
 */
export function hideWaitMessage(modalFields) {
  const el = modalFields.querySelector('.muted-note');
  if (el) el.remove();
}

/**
 * Показывает сообщение об ошибке
 */
export function showErrorMessage(modalFields, message = TEXT_MESSAGES.ERROR_REFRESH) {
  hideWaitMessage(modalFields);

  let err = modalFields.querySelector('.note-error.admin-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'note-error admin-error';
    err.style.color = 'var(--danger)';

    // Вставляем после system-info, info или admin-wait-note
    const anchor = modalFields.querySelector('.system-info, .info, .admin-wait-note');
    if (anchor) {
      anchor.insertAdjacentElement('afterend', err);
    } else {
      modalFields.prepend(err);
    }
  }
  err.textContent = message;
  return err;
}

/**
 * Скрывает сообщение об ошибке
 */
export function clearErrorMessage(modalFields) {
  const err = modalFields.querySelector('.note-error.admin-error');
  if (err) err.remove();
}

/**
 * Отключает кнопку отправки формы
 * @param {HTMLElement} btnSubmit - Кнопка отправки
 * @param {Object} options - Опции отключения
 * @param {boolean} options.hide - Скрывать кнопку (по умолчанию true)
 */
export function disableSubmitButton(btnSubmit, options = {}) {
  const { hide = true } = options;

  if (hide) {
    btnSubmit.style.display = 'none';
  }
  btnSubmit.disabled = true;
}

/**
 * Очищает поля модального окна
 * @param {HTMLElement} modalFields - Контейнер полей модального окна
 * @param {Object} options - Опции очистки
 * @param {boolean} options.includeInfo - Удалять .info элементы (по умолчанию false)
 * @param {boolean} options.includeFields - Удалять .field элементы (по умолчанию true)
 * @param {boolean} options.includeGiftGroups - Удалять .gift-groups элементы (по умолчанию true)
 */
export function clearModalFields(modalFields, options = {}) {
  const {
    includeInfo = false,
    includeFields = true,
    includeGiftGroups = true
  } = options;

  const selectors = [
    '.gift-note',
    '.muted-note',
    '.note-error',
    '.callout',
    '[data-info]'
  ];

  if (includeInfo) selectors.push('.info');
  if (includeFields) selectors.push('.field');
  if (includeGiftGroups) selectors.push('.gift-groups');

  modalFields.querySelectorAll(selectors.join(', ')).forEach(el => el.remove());
}

// ============================================================================
// ASYNC HELPERS - Работа с асинхронными операциями
// ============================================================================

/**
 * Ожидает появления глобальной переменной-массива с таймаутом
 * @param {string} varName - Имя глобальной переменной (например 'USERS_LIST')
 * @param {number} timeoutMs - Таймаут ожидания в миллисекундах
 * @param {Function} onSuccess - Колбэк при успехе, получает массив
 * @param {Function} onError - Колбэк при ошибке
 * @returns {{ cancel: Function }} - Объект с методом отмены
 */
export function waitForGlobalArray(varName, timeoutMs, onSuccess, onError) {
  let canceled = false;
  let poll, timeout;

  const cancel = () => {
    canceled = true;
    if (poll) clearInterval(poll);
    if (timeout) clearTimeout(timeout);
  };

  poll = setInterval(() => {
    if (canceled) return;

    const value = window[varName];

    // Если переменная существует, но это не массив - ошибка
    if (value !== undefined && !Array.isArray(value)) {
      cancel();
      onError();
      return;
    }

    // Успех - получили массив
    if (Array.isArray(value)) {
      cancel();
      onSuccess(value);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  timeout = setTimeout(() => {
    if (!canceled) {
      cancel();
      onError();
    }
  }, timeoutMs);

  return { cancel };
}

/**
 * Создаёт отменяемую операцию с стандартным паттерном cancel/fail
 * @param {HTMLElement} modalFields - Контейнер модального окна
 * @param {HTMLElement} btnSubmit - Кнопка отправки формы
 * @returns {Object} - { canceled, cancel, fail, checkCanceled }
 */
export function createCancellableOperation(modalFields, btnSubmit) {
  let canceled = false;
  const timers = [];

  const cancel = () => {
    canceled = true;
    timers.forEach(t => {
      if (t.type === 'interval') clearInterval(t.id);
      if (t.type === 'timeout') clearTimeout(t.id);
    });
    timers.length = 0;
  };

  const fail = (message = TEXT_MESSAGES.ERROR_REFRESH) => {
    if (canceled) return;
    showErrorMessage(modalFields, message);
    disableSubmitButton(btnSubmit);
    cancel();
  };

  const checkCanceled = () => canceled;

  // Хелперы для добавления таймеров в список
  const addInterval = (callback, delay) => {
    const id = setInterval(callback, delay);
    timers.push({ type: 'interval', id });
    return id;
  };

  const addTimeout = (callback, delay) => {
    const id = setTimeout(callback, delay);
    timers.push({ type: 'timeout', id });
    return id;
  };

  return {
    canceled: () => canceled,
    cancel,
    fail,
    checkCanceled,
    addInterval,
    addTimeout
  };
}

// ============================================================================
// FORM HELPERS - Работа с полями формы
// ============================================================================

/**
 * Удаляет все скрытые поля recipient_* из формы
 */
export function clearRecipientFields(modalFields) {
  modalFields.querySelectorAll('input[type="hidden"][name^="recipient_"]').forEach(n => n.remove());
}

/**
 * Устанавливает значение скрытого поля или удаляет его, если значение пустое
 */
export function setHiddenField(container, name, value = '') {
  let field = container.querySelector(`input[type="hidden"][name="${name}"]`);

  if (!value && value !== 0) {
    // Удаляем поле, если значение пустое
    if (field) field.remove();
    return null;
  }

  if (!field) {
    field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    container.appendChild(field);
  }

  field.value = String(value);
  return field;
}

// ============================================================================
// PORTAL HELPERS - Работа с портал-элементами (dropdown/suggest)
// ============================================================================

