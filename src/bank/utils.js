// ============================================================================
// utils.js — Утилиты и вспомогательные функции
// ============================================================================

import { REGEX } from './constants.js';

// ============================================================================
// ФОРМАТИРОВАНИЕ И ПАРСИНГ
// ============================================================================

export const pad2 = (n) => String(n).padStart(2, '0');

export const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export const formatNumber = (value) => numberFormatter.format(value);

/**
 * Парсит числовое значение из строки
 * @param {string|number} raw - исходное значение
 * @returns {number|null} распарсенное число или null
 */
export const parseNumericAmount = (raw) => {
  if (raw === undefined || raw === null) return null;
  const normalized = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  return REGEX.NUMERIC.test(normalized) ? Number(normalized) : null;
};

// ============================================================================
// РАБОТА С ДАТАМИ
// ============================================================================

/**
 * Округляет новую дату к дню месяца из старой даты
 * @param {Array} OLD - [год, месяц, день]
 * @param {Array} NEW - [год, месяц, день]
 * @returns {Array} округленная дата
 */
export function roundNewToAnchorDOM(OLD, NEW) {
  let [y2, m2, d2] = NEW.map(Number);
  const d1 = Number(OLD[2]);
  if (d2 < d1) {
    m2 -= 1;
    if (m2 === 0) { m2 = 12; y2 -= 1; }
  }
  return [y2, m2, d1];
}

/**
 * Вычисляет количество полных месяцев между двумя датами
 * @param {Array} OLD - [год, месяц, день]
 * @param {Array} NEW - [год, месяц, день]
 * @returns {number} количество полных месяцев
 */
export function fullMonthsDiffVirtualDOM(OLD, NEW) {
  const [y1, m1] = OLD.map(Number);
  const [yr, mr] = roundNewToAnchorDOM(OLD, NEW);
  return Math.max(0, (yr - y1) * 12 + (mr - m1));
}

/**
 * Форматирует дату в строку YYYY-MM-DD
 * @param {Array} date - [год, месяц, день]
 * @returns {string} отформатированная дата
 */
export function fmtYMD([y, m, d]) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

// ============================================================================
// РАБОТА С ОБЪЕКТАМИ И МАССИВАМИ
// ============================================================================

/**
 * Извлекает индексы из ключей объекта по паттерну
 * @param {Object} dataObj - объект с данными
 * @param {RegExp} pattern - регулярное выражение для поиска
 * @returns {Array<string>} массив найденных индексов
 */
export function extractIndices(dataObj, pattern) {
  return Object.keys(dataObj)
    .map(k => k.match(pattern))
    .filter(Boolean)
    .map(m => m[1]);
}

/**
 * Безопасно парсит JSON
 * @param {string} jsonString - JSON строка
 * @param {*} defaultValue - значение по умолчанию
 * @returns {*} распарсенный объект или defaultValue
 */
export function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return defaultValue;
  }
}

// ============================================================================
// ПРОВЕРКИ И ВАЛИДАЦИЯ
// ============================================================================

/**
 * Проверяет, является ли значение валидным числом
 * @param {*} value - проверяемое значение
 * @returns {boolean}
 */
export function isValidNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Приводит значение к валидному множителю
 * @param {*} value - исходное значение
 * @param {number} defaultValue - значение по умолчанию
 * @returns {number} нормализованный множитель
 */
export function normalizeMultiplier(value, defaultValue = 1) {
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : defaultValue;
}

/**
 * Получает безопасное числовое значение из объекта
 * @param {Object} obj - объект с данными
 * @param {string} key - ключ
 * @param {number} defaultValue - значение по умолчанию
 * @returns {number}
 */
export function getSafeNumber(obj, key, defaultValue = 0) {
  const value = Number(obj?.[key]);
  return Number.isFinite(value) ? value : defaultValue;
}

// ============================================================================
// РАБОТА С DOM
// ============================================================================

/**
 * Создает элемент с классом и атрибутами
 * @param {string} tag - тег элемента
 * @param {string} className - класс элемента
 * @param {Object} attrs - дополнительные атрибуты
 * @returns {HTMLElement}
 */
export function createElement(tag, className = '', attrs = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'textContent' || key === 'innerHTML') {
      el[key] = value;
    } else {
      el.setAttribute(key, value);
    }
  });
  return el;
}

/**
 * Устанавливает стили для элемента
 * @param {HTMLElement} element - элемент
 * @param {Object} styles - объект со стилями
 */
export function setStyles(element, styles) {
  Object.entries(styles).forEach(([key, value]) => {
    element.style[key] = value;
  });
}

// ============================================================================
// ДЕБАУНС И ТРОТТЛИНГ
// ============================================================================

/**
 * Создает функцию с задержкой выполнения
 * @param {Function} func - функция для дебаунса
 * @param {number} wait - задержка в мс
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
