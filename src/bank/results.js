// ============================================================================
// results.js — Rendering of results/итогов
// ============================================================================

import {
  ALLOWED_PARENTS,
  BASE_URL
} from './config.js';

import {
  formatNumber,
  parseNumericAmount,
  submissionGroups,
  formatEntryKey,
  updateAutoDiscounts
} from './services.js';

import {
  SPECIAL_EXPENSE_FORMS,
  RECIPIENT_LIST_FORMS,
  DIRECT_RENDER_FORMS,
  BUYOUT_FORMS,
  URL_FIELD_FORMS,
  BANNER_FORMS,
  CHARACTER_CHANGE_FORMS,
  REFUSE_FORMS,
  COUNTER_FORMS,
  ADMIN_RECIPIENT_FORMS,
  DESIGN_FORMS,
  GIFT_FORMS,
  FORM_GIFT_DISCOUNT,
  FORM_GIFT_PRESENT,
  FORM_GIFT_CUSTOM,
  FORM_EXP_TRANSFER,
  FORM_EXP_THIRDCHAR,
  FORM_INCOME_TOPUP,
  FORM_INCOME_AMS,
  FORM_INCOME_ANKETA,
  FORM_INCOME_AKCION,
  FORM_INCOME_NEEDCHAR,
  FORM_INCOME_ACTIVIST,
  FORM_INCOME_WRITER,
  FORM_INCOME_EPISODE_OF,
  FORM_INCOME_POST_OF,
  toSelector
} from './constants.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Рекурсивно конвертирует DOM-узел в BB-код
 * @param {Node} node - DOM узел для конвертации
 * @returns {string} - BB-код представление узла
 */
function nodeToBBCode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const tagName = node.tagName.toLowerCase();

    // Обрабатываем ссылки
    if (tagName === 'a') {
      const href = node.getAttribute('href') || '';
      const text = node.textContent || '';
      // Если href и текст совпадают, оставляем просто URL жирным
      if (href === text) {
        return `${href}`;
      }
      // Иначе используем BB-код url
      return `[url=${href}]${text}[/url]`;
    }

    // Обрабатываем strong/b
    if (tagName === 'strong' || tagName === 'b') {
      const content = Array.from(node.childNodes).map(nodeToBBCode).join('');
      return `[b]${content}[/b]`;
    }

    // Обрабатываем br
    if (tagName === 'br') {
      return '\n';
    }

    // Для остальных элементов просто обрабатываем дочерние узлы
    return Array.from(node.childNodes).map(nodeToBBCode).join('');
  }

  return '';
}

/**
 * Формирует массив операций из отрендеренного DOM
 * @param {HTMLElement} logElement - элемент лога с отрендеренными операциями
 * @returns {Array} - массив операций с форматированными данными
 */
function buildOperationsArray(logElement) {
  const operations = [];

  // Находим все entry элементы в логе
  const entries = logElement.querySelectorAll('.entry');

  entries.forEach((entryEl) => {
    // Получаем заголовок операции
    const titleEl = entryEl.querySelector('.entry-title');
    if (!titleEl) return;

    const titleText = titleEl.textContent.trim();
    // Убираем номер в начале (например "#1 · ")
    const title = titleText.replace(/^#\d+\s*·\s*/, '');

    // Получаем form_id из data-form-id
    const formId = entryEl.dataset.formId || '';

    // Получаем сумму из entry-meta
    const metaEl = entryEl.querySelector('.entry-meta');
    let sum = 0;
    if (metaEl) {
      const sumSpan = metaEl.querySelector('span[style*="color"]');
      if (sumSpan) {
        const sumText = sumSpan.textContent.trim();
        // Убираем префикс "+ " или "− " и парсим число
        const cleanSum = sumText.replace(/^[+−]\s*/, '').replace(/\s/g, '');
        const numValue = parseNumericAmount(cleanSum);

        // Определяем знак по цвету или префиксу
        const isPositive = sumText.startsWith('+') || sumSpan.style.color.includes('22c55e');
        sum = isPositive ? numValue : -numValue;
      }
    }

    // Получаем информацию из entry-items
    const info = [];
    const itemsWrap = entryEl.querySelector('.entry-items');

    if (itemsWrap) {
      // Проверяем, есть ли ol.entry-list (список)
      const entryLists = itemsWrap.querySelectorAll('ol.entry-list');

      if (entryLists.length > 0) {
        // Это список - собираем каждый li отдельно
        const comments = [];
        let listType = 'list';

        entryLists.forEach(list => {
          // Если список помечен классом separated, меняем тип
          if (list.classList.contains('separated')) {
            listType = 'list separated';
          }

          const listItems = list.querySelectorAll('li');
          listItems.forEach(li => {
            const bbCode = nodeToBBCode(li);
            if (bbCode.trim()) {
              comments.push(bbCode);
            }
          });
        });

        if (comments.length > 0) {
          info.push({
            comment: comments,
            type: listType
          });
        }
      } else {
        // Это plain - собираем весь контент
        const entryItems = itemsWrap.querySelectorAll('.entry-item');

        entryItems.forEach(item => {
          const bbCode = nodeToBBCode(item);
          if (bbCode.trim()) {
            info.push({
              comment: [bbCode],
              type: 'plain'
            });
          }
        });
      }
    }

    operations.push({
      title: title,
      sum: sum,
      info: info,
      form_id: formId
    });
  });

  return operations;
}

/**
 * Создает модальное окно подтверждения действия
 * @param {string} message - текст сообщения для пользователя
 * @returns {Promise<boolean>} - true если пользователь подтвердил, false если отменил
 */
export function showConfirmModal(message) {
  return new Promise((resolve) => {
    // Создаем backdrop для модального окна подтверждения
    const confirmBackdrop = document.createElement('div');
    confirmBackdrop.className = 'modal-backdrop';
    confirmBackdrop.style.display = 'flex';
    confirmBackdrop.setAttribute('aria-hidden', 'false');

    // Создаем модальное окно
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal confirm-modal';
    confirmModal.setAttribute('role', 'dialog');
    confirmModal.setAttribute('aria-modal', 'true');

    // Создаем содержимое
    confirmModal.innerHTML = `
      <header>
        <h3>Подтверждение</h3>
      </header>
      <div class="body">
        <p style="margin: 0; text-align: center;">${message}</p>
      </div>
      <div class="form-footer">
        <div style="display:flex; gap:8px; justify-content: center; width: 100%;">
          <button type="button" class="button" data-action="cancel">Отмена</button>
          <button type="button" class="button primary" data-action="confirm">Подтвердить</button>
        </div>
      </div>
    `;

    confirmBackdrop.appendChild(confirmModal);
    document.body.appendChild(confirmBackdrop);

    // Функция закрытия модального окна
    const closeModal = () => {
      confirmBackdrop.remove();
    };

    // Обработчик кнопки "Отмена"
    const cancelBtn = confirmModal.querySelector('[data-action="cancel"]');
    cancelBtn.addEventListener('click', () => {
      closeModal();
      resolve(false);
    });

    // Обработчик кнопки "Подтвердить"
    const confirmBtn = confirmModal.querySelector('[data-action="confirm"]');
    confirmBtn.addEventListener('click', () => {
      closeModal();
      resolve(true);
    });

    // Закрытие по клику на backdrop
    confirmBackdrop.addEventListener('click', (e) => {
      if (e.target === confirmBackdrop) {
        closeModal();
        resolve(false);
      }
    });

    // Закрытие по Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        resolve(false);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

/**
 * Универсальная функция расчета стоимости на основе режима из data.js
 * @param {string} mode - режим расчета ('price_per_item', 'price_per_item_w_bonus', 'entered_amount', 'price_w_entered_amount')
 * @param {number} price - базовая цена за единицу
 * @param {number} bonus - бонус за дополнительные единицы
 * @param {number} items - количество основных единиц
 * @param {number} additional_items - количество дополнительных единиц
 * @param {number} entered_amount - введенная сумма
 * @returns {number} итоговая стоимость
 */
export function calculateCost(mode, price, bonus = 0, items = 0, additional_items = 0, entered_amount = 0) {
  switch (mode) {
    case 'price_per_item':
      // итого = price × items
      return price * items;

    case 'price_per_item_w_bonus':
      // итого = price × items + bonus × additional_items
      return price * items + bonus * additional_items;

    case 'entered_amount':
      // итого = sum(entered_amount)
      return entered_amount;

    case 'price_w_entered_amount':
      // итого = sum(entered_amount) + price × items
      return entered_amount + price * items;

    default:
      return 0;
  }
}

/**
 * Универсальная функция для форматированного отображения расчета стоимости в modalAmount
 * @param {string} mode - режим расчета
 * @param {number} price - базовая цена за единицу
 * @param {number} bonus - бонус за дополнительные единицы
 * @param {number} items - количество основных единиц
 * @param {number} additional_items - количество дополнительных единиц
 * @param {number} entered_amount - введенная сумма
 * @returns {string} форматированная строка для отображения
 */
export function formatCostDisplay(mode, price, bonus = 0, items = 0, additional_items = 0, entered_amount = 0) {
  const total = calculateCost(mode, price, bonus, items, additional_items, entered_amount);

  switch (mode) {
    case 'price_per_item':
      // Формат: "price × items = total"
      if (items === 0) return '';
      if (items === 1) return formatNumber(total);
      return `${formatNumber(price)} × ${items} = ${formatNumber(total)}`;

    case 'price_per_item_w_bonus':
      // Формат: "price × items + bonus × additional_items = total"
      if (items === 0 && additional_items === 0) return '';
      if (additional_items === 0) {
        if (items === 1) return formatNumber(total);
        return `${formatNumber(price)} × ${items} = ${formatNumber(total)}`;
      }
      return `${formatNumber(price)} × ${items} + ${formatNumber(bonus)} × ${additional_items} = ${formatNumber(total)}`;

    case 'entered_amount':
      // Формат: просто сумма
      if (entered_amount === 0) return '';
      return formatNumber(entered_amount);

    case 'price_w_entered_amount':
      // Формат: "entered_amount + price × items = total"
      if (entered_amount === 0 && items === 0) return '';
      if (items === 0) return formatNumber(entered_amount);
      return `${formatNumber(entered_amount)} + ${formatNumber(price)} × ${items} = ${formatNumber(total)}`;

    default:
      return '';
  }
}

/**
 * Универсальная функция для обновления modalAmount на основе mode и данных формы
 * @param {HTMLElement} modalAmount - элемент для отображения стоимости
 * @param {HTMLFormElement} form - форма с dataset
 * @param {Object} params - параметры для расчета
 * @param {number} params.items - количество основных единиц
 * @param {number} params.additional_items - количество дополнительных единиц
 * @param {number} params.entered_amount - введенная сумма
 */
export function updateModalAmount(modalAmount, form, params = {}) {
  const mode = form.dataset.mode || '';
  const price = Number(form.dataset.price) || 0;
  const bonus = Number(form.dataset.bonus) || 0;

  const { items = 0, additional_items = 0, entered_amount = 0 } = params;

  // Если mode не указан, показываем базовый amount
  if (!mode) {
    modalAmount.textContent = form.dataset.amount || '';
    return;
  }

  // Для режима 'entered_amount' (TOPUP/AMS) не-админам не обновляем modalAmount
  // (оно будет установлено в handleAdminAmountForms как "определяется индивидуально")
  if (mode === 'entered_amount' && !window.IS_ADMIN) {
    return;
  }

  const displayText = formatCostDisplay(mode, price, bonus, items, additional_items, entered_amount);
  modalAmount.textContent = displayText;
}

export function cleanupCounterWatcher(counterWatcher, modalFields, form) {
  // Проверяем, если это объект с вложенным counterWatcher (например, {counterWatcher: {cancel: fn}})
  if (counterWatcher && counterWatcher.counterWatcher && typeof counterWatcher.counterWatcher.cancel === 'function') {
    counterWatcher.counterWatcher.cancel();
  }
  // Или если это прямой counterWatcher с cancel функцией
  else if (counterWatcher && typeof counterWatcher.cancel === 'function') {
    counterWatcher.cancel();
  }

  counterWatcher = null;
  modalFields.querySelectorAll('input[type="hidden"][data-auto-field]').forEach((el) => el.remove());
  delete form.dataset.currentMultiplier;
  return counterWatcher;
}

export function updateNote(modalFields, content, { error = false } = {}) {
  const note = modalFields.querySelector('.muted-note, .note-error') || modalFields.querySelector('.gift-note');
  if (!note) return null;
  const original = content;
  let html = Array.isArray(content) ? content.join('<br>') : content;
  html = String(html)
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const isWaiting = !error && original === 'Пожалуйста, подождите...';
  note.classList.toggle('note-error', error);
  note.classList.toggle('muted-note', isWaiting);
  note.style.fontStyle = isWaiting ? 'italic' : 'normal';
  note.style.color = error ? 'var(--danger)' : (isWaiting ? 'var(--muted)' : 'var(--text)');
  note.innerHTML = html;
  return note;
}

export function setHiddenField(modalFields, name, value) {
  let field = modalFields.querySelector(`input[type="hidden"][data-auto-field="${name}"]`);
  if (value === undefined || value === null || value === '') {
    if (field) field.remove();
    return;
  }
  if (!field) {
    field = document.createElement('input');
    field.type = 'hidden';
    field.dataset.autoField = name;
    field.name = name;
    modalFields.appendChild(field);
  }
  field.value = value;
}

// ============================================================================
// RENDER LOG
// ============================================================================

export function renderLog(log) {
  // Пересчитываем автоматические скидки перед рендерингом
  updateAutoDiscounts();

  log.innerHTML = '';
  if (!submissionGroups.length) {
    const empty = document.createElement('div');
    empty.className = 'log-empty';
    empty.textContent = 'Пока нет выбранных операций.';
    log.appendChild(empty);
    return;
  }

  // Сортируем группы: скидки в конец
  const sortedGroups = [...submissionGroups].sort((a, b) => {
    const aIsDiscount = a.isDiscount || a.templateSelector === '#gift-discount';
    const bIsDiscount = b.isDiscount || b.templateSelector === '#gift-discount';
    if (aIsDiscount && !bIsDiscount) return 1;
    if (!aIsDiscount && bIsDiscount) return -1;
    return 0;
  });

  sortedGroups.forEach((group, index) => {
    const entryEl = document.createElement('div');
    entryEl.className = 'entry';
    entryEl.dataset.groupId = group.id;
    // Сохраняем form_id для передачи в операции
    if (group.templateSelector) {
      entryEl.dataset.formId = group.templateSelector;
    }

    // ====== header ======
    const header = document.createElement('div');
    header.className = 'entry-header';
    header.style.cursor = 'pointer';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '12px';

    // Кнопки действий (слева)
    const headerActions = document.createElement('div');
    headerActions.className = 'entry-header-actions';
    headerActions.style.display = 'flex';
    headerActions.style.gap = '4px';

    const title = document.createElement('span');
    title.className = 'entry-title';
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.gap = '8px';

    // Для подарков и оформления добавляем иконку и ID в заголовок
    const isGiftGroup = group.templateSelector === toSelector(FORM_GIFT_PRESENT) || /Подарить подарок|Праздничный подарок|Подарок-сюрприз|Воздушный подарок/i.test(group.title || '');
    const isDesignGroup = DESIGN_FORMS.includes(group.templateSelector);

    if ((isGiftGroup || isDesignGroup) && group.entries.length > 0) {
      const firstEntry = group.entries[0];
      const dataObj = firstEntry.data || {};
      // Используем giftId из группы (если есть) или из первого получателя
      const giftIcon = String(dataObj['gift_icon_1'] ?? group.giftIcon ?? '🎁').trim();
      const giftId = String(group.giftId ?? dataObj['gift_id_1'] ?? '').trim();

      if (giftId) {
        let itemTitle = '';
        const isCustom = giftId.includes('custom');

        if (group.templateSelector?.includes('icon')) {
          itemTitle = isCustom ? 'Индивидуальная иконка' : `Иконка из коллекции (#${giftId})`;
        } else if (group.templateSelector?.includes('badge')) {
          itemTitle = isCustom ? 'Индивидуальная плашка' : `Плашка из коллекции (#${giftId})`;
        } else if (group.templateSelector?.includes('bg')) {
          itemTitle = isCustom ? 'Индивидуальный фон' : `Фон из коллекции (#${giftId})`;
        } else {
          // Подарки
          itemTitle = isCustom ? 'Индивидуальный подарок' : `Подарок из коллекции (#${giftId})`;
        }

        title.textContent = `#${index + 1} · ${itemTitle}`;
      } else {
        title.textContent = `#${index + 1} · ${group.title}`;
      }
    } else {
      title.textContent = `#${index + 1} · ${group.title}`;
    }

    header.appendChild(headerActions);
    header.appendChild(title);

    const totalEntryMultiplier = group.entries.reduce((sum, item) => {
      const raw = item && typeof item.multiplier !== 'undefined' ? item.multiplier : null;
      const numeric = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
      const value = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
      return sum + value;
    }, 0);

    if (group.amount) {
      const meta = document.createElement('span');
      meta.className = 'entry-meta';

      // Определяем тип операции: доход (+) или расход (-)
      const isIncome = group.isDiscount || group.templateSelector?.includes('income');
      const prefix = isIncome ? '+ ' : '− ';
      const color = isIncome ? '#22c55e' : '#ef4444';

      // формат "фикс + xнадбавка" (например "5 + x10") или используем mode
      const m = String(group.amount).match(/^\s*(\d+)\s*\+\s*x\s*(\d+)\s*$/i);
      if (m || group.mode === 'price_per_item_w_bonus') {
        // Берем price и bonus из group или парсим из amount
        const price = group.price !== null && group.price !== undefined ? Number(group.price) : (m ? Number(m[1]) : 0);
        const bonus = group.bonus !== null && group.bonus !== undefined ? Number(group.bonus) : (m ? Number(m[2]) : 0);

        // суммируем по всем записям группы
        let totalCount = 0;
        let totalThousands = 0;
        group.entries.forEach((item) => {
          // личные посты — без капа
          const rawPersonal = item?.data?.personal_posts_json;
          if (rawPersonal) {
            try {
              const arr = JSON.parse(rawPersonal);
              if (Array.isArray(arr) && arr.length) {
                totalCount += arr.length;
                totalThousands += arr.reduce((s, it) => {
                  const n = Number.isFinite(it?.symbols_num) ? it.symbols_num : parseInt(it?.symbols_num, 10) || 0;
                  return s + Math.floor(Math.max(0, n) / 1000);
                }, 0);
              }
            } catch (_) {}
          }
          // сюжетные посты — кап 3к на пост
          const rawPlot = item?.data?.plot_posts_json;
          if (rawPlot) {
            try {
              const arr = JSON.parse(rawPlot);
              if (Array.isArray(arr) && arr.length) {
                totalCount += arr.length;
                totalThousands += arr.reduce((s, it) => {
                  const n = Number.isFinite(it?.symbols_num) ? it.symbols_num : parseInt(it?.symbols_num, 10) || 0;
                  const k = Math.floor(Math.max(0, n) / 1000);
                  return s + Math.min(k, 3);
                }, 0);
              }
            } catch (_) {}
          }
        });

        // Используем calculateCost для получения только итоговой суммы
        const total = calculateCost('price_per_item_w_bonus', price, bonus, totalCount, totalThousands, 0);
        meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${formatNumber(total)}</span>`;
        header.appendChild(meta);
      } else if (group.templateSelector === toSelector(FORM_EXP_TRANSFER) || /Перевод средств другому/i.test(group.title || '')) {
        // Специальная логика для переводов: сумма + комиссия
        let totalAmount = 0;
        let recipientCount = 0;

        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);

          idxs.forEach((idx) => {
            const rawAmount = String(dataObj[`amount_${idx}`] ?? '').trim();
            const amountNum = parseNumericAmount(rawAmount);
            if (amountNum !== null && amountNum > 0) {
              totalAmount += amountNum;
              recipientCount++;
            }
          });
        });

        // Используем calculateCost для получения только итоговой суммы
        if (recipientCount > 0) {
          const price = group.price !== null && group.price !== undefined ? Number(group.price) : 10;
          const total = calculateCost('price_w_entered_amount', price, 0, recipientCount, 0, totalAmount);
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${formatNumber(total)}</span>`;
        } else {
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${group.amount}</span>`;
        }
        header.appendChild(meta);
      } else if (group.templateSelector === toSelector(FORM_INCOME_TOPUP) || group.templateSelector === toSelector(FORM_INCOME_AMS)) {
        // Докупить кредиты / Выдать денежку дополнительно: price × сумма всех topup
        let totalTopup = 0;

        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);

          idxs.forEach((idx) => {
            const topupAmount = Number(dataObj[`amount_${idx}`]) || 0;
            totalTopup += topupAmount;
          });
        });

        // Используем calculateCost для получения только итоговой суммы
        if (totalTopup > 0) {
          const price = group.price !== null && group.price !== undefined ? Number(group.price) : 0;
          const total = calculateCost('price_per_item', price, 0, totalTopup, 0, 0);
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${formatNumber(total)}</span>`;
        } else {
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${group.amount}</span>`;
        }
        header.appendChild(meta);
      } else if (group.isDiscount) {
        // Скидки: сумма всех discount_amount
        let totalDiscount = 0;
        group.entries.forEach((item) => {
          const amount = Number(item.data?.discount_amount) || 0;
          totalDiscount += amount;
        });
        meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${formatNumber(totalDiscount)}</span>`;
        header.appendChild(meta);
      } else if (
        group.templateSelector === toSelector(FORM_GIFT_PRESENT) ||
        group.templateSelector === toSelector(FORM_GIFT_CUSTOM) ||
        DESIGN_FORMS.includes(group.templateSelector) ||
        /Подарить подарок|Индивидуальный подарок/i.test(group.title || '')
      ) {
        // Подарки и Оформление: цена_1 × количество получателей
        let totalGifts = 0;
        const price = Number.parseInt(group.price, 10) || 100;

        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);
          totalGifts += idxs.filter(idx => String(dataObj[`recipient_${idx}`] || '').trim()).length;
        });

        // Используем calculateCost для получения только итоговой суммы
        if (totalGifts > 0) {
          const total = calculateCost('price_per_item', price, 0, totalGifts, 0, 0);
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${formatNumber(total)}</span>`;
        } else {
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${group.amount}</span>`;
        }
        header.appendChild(meta);
      } else if (SPECIAL_EXPENSE_FORMS.includes(group.templateSelector)) {
        // Бонусы/Маска/Жилет: базовая цена × сумма всех quantity
        let totalQuantity = 0;

        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);

          idxs.forEach((idx) => {
            const qty = Number(dataObj[`quantity_${idx}`]) || 0;
            totalQuantity += qty;
          });
        });

        // Используем calculateCost для получения только итоговой суммы
        const mode = group.mode || 'price_per_item';
        const price = group.price !== null && group.price !== undefined ? Number(group.price) : (parseNumericAmount(group.amount) || 0);

        if (totalQuantity > 0) {
          const total = calculateCost(mode, price, 0, totalQuantity, 0, 0);
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${formatNumber(total)}</span>`;
        } else {
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${group.amount}</span>`;
        }
        header.appendChild(meta);
      } else if (
        group.templateSelector === toSelector(FORM_INCOME_ANKETA) ||
        group.templateSelector === toSelector(FORM_INCOME_AKCION) ||
        group.templateSelector === toSelector(FORM_INCOME_NEEDCHAR) ||
        group.templateSelector === toSelector(FORM_INCOME_ACTIVIST) ||
        group.templateSelector === toSelector(FORM_INCOME_WRITER) ||
        group.templateSelector === toSelector(FORM_INCOME_EPISODE_OF) ||
        group.templateSelector === toSelector(FORM_INCOME_POST_OF)
      ) {
        // Приём анкеты, Взятие акционного/нужного персонажа, Активист/Постописец/Эпизод/Пост полумесяца: всегда показываем 0
        meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}0</span>`;
        header.appendChild(meta);
      } else {
        // Используем mode для расчета стоимости
        const mode = group.mode;
        const price = group.price !== null && group.price !== undefined ? Number(group.price) : null;
        const bonus = group.bonus !== null && group.bonus !== undefined ? Number(group.bonus) : null;

        if (mode && price !== null) {
          // Для mode='price_per_item' считаем items
          if (mode === 'price_per_item') {
            // Для форм с полем quantity суммируем quantity из всех entries
            let totalQuantity = 0;
            let totalRecipients = 0;

            group.entries.forEach((item) => {
              const dataObj = item.data || {};
              if (dataObj.quantity !== undefined) {
                totalQuantity += Number(dataObj.quantity) || 0;
              }

              // Считаем количество получателей (recipient_N полей)
              const recipientKeys = Object.keys(dataObj).filter(k => k.startsWith('recipient_'));
              totalRecipients += recipientKeys.length;
            });

            // Если есть quantity в данных, используем его
            // Если есть recipients, используем их количество
            // Иначе используем multiplier
            const items = totalQuantity > 0 ? totalQuantity : (totalRecipients > 0 ? totalRecipients : (totalEntryMultiplier > 0 ? totalEntryMultiplier : 1));
            const total = calculateCost(mode, price, bonus || 0, items, 0, 0);
            meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${formatNumber(total)}</span>`;
          } else {
            // Для других режимов пока показываем просто amount
            meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${group.amount}</span>`;
          }
        } else {
          // Старая логика для форм без mode (обратная совместимость)
          const amountNumber = parseNumericAmount(group.amount);
          if (amountNumber !== null) {
            const multiplier = totalEntryMultiplier > 0 ? totalEntryMultiplier : 1;
            const total = amountNumber * multiplier;
            meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${formatNumber(total)}</span>`;
          } else {
            meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${group.amount}</span>`;
          }
        }
        header.appendChild(meta);
      }
    }

    // Для скидок не показываем "Записей: X"
    if (group.entries.length > 1 && !group.isDiscount) {
      const countMeta = document.createElement('span');
      countMeta.className = 'entry-meta';
      if (totalEntryMultiplier > group.entries.length) {
        countMeta.textContent = `Записей: ${group.entries.length}, всего позиций: ${totalEntryMultiplier}`;
      } else {
        countMeta.textContent = `Записей: ${group.entries.length}`;
      }
      header.appendChild(countMeta);
    }

    // Добавляем кнопки в заголовок для каждой записи (кроме скидки)
    if (!group.isDiscount) {
      group.entries.forEach((item) => {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'icon-btn';
        editBtn.dataset.action = 'edit';
        editBtn.dataset.groupId = group.id;
        editBtn.dataset.entryId = item.id;
        editBtn.innerHTML = '✏️';
        editBtn.title = 'Редактировать';
        editBtn.style.fontSize = '16px';
        editBtn.style.background = 'none';
        editBtn.style.border = 'none';
        editBtn.style.cursor = 'pointer';
        editBtn.style.padding = '4px';
        headerActions.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'icon-btn';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.dataset.groupId = group.id;
        deleteBtn.dataset.entryId = item.id;
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Удалить';
        deleteBtn.style.fontSize = '16px';
        deleteBtn.style.background = 'none';
        deleteBtn.style.border = 'none';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.padding = '4px';
        headerActions.appendChild(deleteBtn);
      });
    }

    entryEl.appendChild(header);

    // ====== items ======
    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'entry-items';
    itemsWrap.style.display = 'none'; // Скрыто по умолчанию

    // Клик по заголовку раскрывает/скрывает содержимое
    header.addEventListener('click', (e) => {
      // Не раскрывать если кликнули на кнопку
      if (e.target.closest('.icon-btn')) return;

      const isHidden = itemsWrap.style.display === 'none';
      itemsWrap.style.display = isHidden ? 'block' : 'none';
    });

    // Для скидок: собираем все в один общий список
    if (group.isDiscount) {
      const itemEl = document.createElement('div');
      itemEl.className = 'entry-item';

      const list = document.createElement('ol');
      list.className = 'entry-list';

      group.entries.forEach((item) => {
        const dataObj = item.data || {};
        const li = document.createElement('li');

        const label = document.createElement('strong');
        label.textContent = `${dataObj.discount_title || 'Скидка'}: `;

        const calculation = document.createElement('span');
        calculation.textContent = `${dataObj.calculation || ''} = ${formatNumber(dataObj.discount_amount || 0)}`;

        li.append(label, calculation);
        list.appendChild(li);
      });

      itemEl.appendChild(list);
      itemsWrap.appendChild(itemEl);
      entryEl.appendChild(itemsWrap);
      log.appendChild(entryEl);
      return;
    }

    group.entries.forEach((item, itemIndex) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'entry-item';
      itemEl.dataset.entryId = item.id;
      itemEl.dataset.groupId = group.id;

      // ID шаблона формы
      const tid = item.template_id;

      // Определяем формы, требующие визуального разделения
      const isBonusMaskClean = SPECIAL_EXPENSE_FORMS.includes(toSelector(tid));

      // header у записи (если нужен заголовок для нескольких записей)
      // Для скидок не показываем "Запись X"
      const itemTitle = document.createElement('div');
      itemTitle.className = 'entry-item-title';
      const baseTitle = (group.entries.length > 1 && !group.isDiscount) ? `Запись ${itemIndex + 1}` : '';
      if (baseTitle) {
        itemTitle.textContent = baseTitle;
        itemEl.appendChild(itemTitle);
      }

      const removeTitleIfEmpty = () => {
        const hasData = itemEl.querySelector('.entry-list li');
        if (!hasData && itemTitle && itemTitle.textContent.trim() === 'Данные') {
          itemTitle.remove();
        }
      };

      // список данных
      const list = document.createElement('ol');

      // Добавляем класс separated для форм с комментариями/получателями
      const needsSeparation = isBonusMaskClean || tid === FORM_INCOME_AMS || tid.includes('icon') || tid.includes('badge') || tid.includes('bg') || tid.includes('gift');
      list.className = needsSeparation ? 'entry-list separated' : 'entry-list';

      // ===== спец-рендеры =====
      // листовка
      if (item.data && item.data.flyer_links_json) {
        try {
          const links = JSON.parse(item.data.flyer_links_json);
          if (Array.isArray(links) && links.length) {
            const list = document.createElement('ol');
            const removeTitleIfEmpty = () => {
              if (list.children.length === 0 && itemTitle && itemTitle.textContent.trim() === 'Данные') {
                itemTitle.remove();
              }
            };
            list.className = 'entry-list';
            links.forEach(({ src, text }) => {
              if (!src) return;
              const li = document.createElement('li');
              const a = document.createElement('a');
              a.href = src; a.textContent = text || src;
              a.target = '_blank'; a.rel = 'noopener noreferrer';
              li.appendChild(a); list.appendChild(li);
            });
            itemEl.appendChild(list);
            itemsWrap.appendChild(itemEl);
            return;
          }
        } catch(_) {}
      }

      // личные посты
      if (item.data && item.data.personal_posts_json) {
        try {
          const items = JSON.parse(item.data.personal_posts_json);
          if (Array.isArray(items) && items.length) {
            const list = document.createElement('ol');
            list.className = 'entry-list';
            items.forEach(({ src, text, symbols_num }) => {
              if (!src) return;
              const li = document.createElement('li');
              const a = document.createElement('a');
              a.href = src;
              a.textContent = text || src;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              li.appendChild(a);
              li.appendChild(document.createTextNode(` [${symbols_num} символов]`));
              list.appendChild(li);
            });
            itemEl.appendChild(list);
            itemsWrap.appendChild(itemEl);
            removeTitleIfEmpty();
            return;
          }
        } catch(_) {}
      }

      // сюжетные посты
      if (item.data && item.data.plot_posts_json) {
        try {
          const items = JSON.parse(item.data.plot_posts_json);
          if (Array.isArray(items) && items.length) {
            const list = document.createElement('ol');
            list.className = 'entry-list';
            items.forEach(({ src, text, symbols_num }) => {
              if (!src) return;
              const li = document.createElement('li');
              const a = document.createElement('a');
              a.href = src;
              a.textContent = text || src;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              li.appendChild(a);
              li.appendChild(document.createTextNode(` [${symbols_num} символов]`));
              list.appendChild(li);
            });
            itemEl.appendChild(list);
            itemsWrap.appendChild(itemEl);
            removeTitleIfEmpty();
            return;
          }
        } catch(_) {}
      }

      // ===== Определяем тип формы для правильного рендеринга =====
      // Используем импортированные константы вместо локальных массивов

      // ===== ГРУППА 1: Формы с получателями в списке =====
      if (RECIPIENT_LIST_FORMS.includes(toSelector(tid))) {
        const dataObj = item.data || {};
        const idxs = Object.keys(dataObj)
          .map(k => k.match(/^recipient_(\d+)$/))
          .filter(Boolean)
          .map(m => m[1])
          .sort((a, b) => Number(a) - Number(b));

        // Определяем, запрашивается ли FROM (от кого) для этой формы
        const hasFromField = isBonusMaskClean || tid.includes('icon') || tid.includes('badge') || tid.includes('bg') || tid.includes('gift');

        idxs.forEach((idx) => {
          const rid = String(dataObj[`recipient_${idx}`] ?? '').trim();
          if (!rid) return;

          const user = window.USERS_LIST?.find(u => String(u.id) === rid);
          const userName = user ? user.name : '';
          const userId = user ? user.id : rid;

          // Получаем данные
          const from = String(dataObj[`from_${idx}`] ?? '').trim();
          const comment = String(dataObj[`wish_${idx}`] || dataObj[`comment_${idx}`] || '').trim();
          const giftData = String(dataObj[`gift_data_${idx}`] ?? '').trim();
          const quantity = dataObj[`quantity_${idx}`] || dataObj[`amount_${idx}`] || '';

          const li = document.createElement('li');

          // NAME с ссылкой
          let htmlContent = `<strong><a target="_blank" href="${BASE_URL}/profile.php?id=${userId}">${userName}</a></strong>`;

          // NUM_INFO: показываем либо quantity, либо price (для админ-форм начислений)
          // adminRecipientForms заменены на ADMIN_RECIPIENT_FORMS
          const showPrice = ADMIN_RECIPIENT_FORMS.includes(toSelector(tid)) && !quantity;
          const isTopupOrAms = toSelector(tid) === FORM_INCOME_TOPUP || toSelector(tid) === FORM_INCOME_AMS;

          if (showPrice && group.price) {
            // Для админ-форм начислений показываем price рядом с именем
            htmlContent += ` — ${formatNumber(group.price)}`;
          } else if (quantity) {
            // Для всех форм с quantity показываем количество
            const qtyNum = typeof quantity === 'number' ? quantity : parseNumericAmount(String(quantity));
            if (qtyNum !== null) {
              htmlContent += ` — ${formatNumber(qtyNum)}`;
            } else if (String(quantity).trim()) {
              htmlContent += ` — ${String(quantity).trim()}`;
            }
          }

          // COM_INFO
          if (hasFromField && from && comment) {
            // Есть и "От кого" и "Комментарий"
            htmlContent += `<br><br><strong>${from}: </strong>${comment}`;
          } else if (hasFromField && from && !comment) {
            // Есть только "От кого" без комментария - выводим без двоеточия
            htmlContent += `<br><br><strong>${from}</strong>`;
          } else if (hasFromField && !from && comment) {
            // Для форм с полем "От кого": если оно не заполнено, а комментарий есть - просто текст
            htmlContent += `<br><br>${comment}`;
          } else if (!hasFromField && comment) {
            // Для форм БЕЗ поля "От кого" - выводим с меткой "Комментарий:"
            htmlContent += `<br><br><strong>Комментарий: </strong>${comment}`;
          }

          // DATA_INFO
          if (giftData) {
            const formattedData = giftData.replace(/\n/g, '<br>');
            htmlContent += `<br><br><strong>Данные:</strong><br>${formattedData}`;
          }

          li.innerHTML = htmlContent;
          list.appendChild(li);
        });
      }

      // ===== ГРУППА 2: Активист/Постописец/Пост полумесяца (без li) =====
      if (DIRECT_RENDER_FORMS.includes(toSelector(tid))) {
        const dataObj = item.data || {};
        const idxs = Object.keys(dataObj)
          .map(k => k.match(/^recipient_(\d+)$/))
          .filter(Boolean)
          .map(m => m[1])
          .sort((a, b) => Number(a) - Number(b));

        const hasFromField = false;

        idxs.forEach((idx) => {
          const rid = String(dataObj[`recipient_${idx}`] ?? '').trim();
          if (!rid) return;

          const user = window.USERS_LIST?.find(u => String(u.id) === rid);
          const userName = user ? user.name : '';
          const userId = user ? user.id : rid;

          const from = String(dataObj[`from_${idx}`] ?? '').trim();
          const comment = String(dataObj[`wish_${idx}`] || dataObj[`comment_${idx}`] || '').trim();
          const giftData = String(dataObj[`gift_data_${idx}`] ?? '').trim();
          const quantity = dataObj[`quantity_${idx}`] || dataObj[`amount_${idx}`] || '';

          const itemEl = document.createElement('div');
          itemEl.className = 'entry-item';
          itemEl.style.flexDirection = 'row';
          
          let htmlContent = `<strong><a target="_blank" href="${BASE_URL}/profile.php?id=${userId}">${userName}</a></strong>`;

          // Для group2Templates (Активист, Постописец, Пост) показываем price
          if (!quantity && group.price) {
            htmlContent += ` — ${formatNumber(group.price)}`;
          } else if (quantity) {
            const qtyNum = typeof quantity === 'number' ? quantity : parseNumericAmount(String(quantity));
            if (qtyNum !== null) {
              htmlContent += ` — ${formatNumber(qtyNum)}`;
            } else if (String(quantity).trim()) {
              htmlContent += ` — ${String(quantity).trim()}`;
            }
          }

          if (comment) {
            const comLabel = (hasFromField && from) ? `<strong>${from}: </strong>` : (hasFromField ? '' : '<strong>Комментарий: </strong>');
            htmlContent += `<br><br>${comLabel}${comment}`;
          }

          if (giftData) {
            const formattedData = giftData.replace(/\n/g, '<br>');
            htmlContent += `<br><br><strong>Данные:</strong><br>${formattedData}`;
          }

          itemEl.innerHTML = htmlContent;
          itemsWrap.appendChild(itemEl);
        });
        removeTitleIfEmpty();
        return;
      }

      // ===== ГРУППА 3: Выкупы (только количество) =====
      if (BUYOUT_FORMS.includes(toSelector(tid))) {
        const dataObj = item.data || {};
        const quantity = dataObj.quantity || '';

        const itemEl = document.createElement('div');
        itemEl.className = 'entry-item';
        itemEl.style.display = 'block'; // Переопределяем flex на block для правильного отображения
        itemEl.innerHTML = `<strong>Количество</strong> — ${quantity}`;
        itemsWrap.appendChild(itemEl);
        removeTitleIfEmpty();
        return;
      }

      // ===== ГРУППА 4: Ссылки в li =====
      if (URL_FIELD_FORMS.includes(toSelector(tid))) {
        const dataObj = item.data || {};
        const url = dataObj.url || '';

        if (url) {
          const li = document.createElement('li');
          li.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
          list.appendChild(li);
        }
      }

      // ===== ГРУППА 5: Ссылки без li =====
      if (BANNER_FORMS.includes(toSelector(tid))) {
        const dataObj = item.data || {};
        const url = dataObj.url || '';

        const itemEl = document.createElement('div');
        itemEl.className = 'entry-item';
        itemEl.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
        itemsWrap.appendChild(itemEl);
        removeTitleIfEmpty();
        return;
      }

      // ===== ГРУППА 6: Текстовые поля =====
      if (CHARACTER_CHANGE_FORMS.includes(toSelector(tid))) {
        const dataObj = item.data || {};
        const text = dataObj.text || dataObj.name || dataObj.reason || '';

        const itemEl = document.createElement('div');
        itemEl.className = 'entry-item';
        itemEl.textContent = text;
        itemsWrap.appendChild(itemEl);
        removeTitleIfEmpty();
        return;
      }

      // ===== ГРУППА 7: Отказ от персонажа =====
      if (REFUSE_FORMS.includes(toSelector(tid))) {
        const dataObj = item.data || {};
        const comment = (dataObj.comment || '').replace(/\n/g, '<br>');

        const itemEl = document.createElement('div');
        itemEl.className = 'entry-item';
        itemEl.innerHTML = `<strong>Комментарий: </strong>${comment}`;
        itemsWrap.appendChild(itemEl);
        removeTitleIfEmpty();
        return;
      }

      // ===== ГРУППА 8: Ключ-значение без li =====
      if (COUNTER_FORMS.includes(toSelector(tid))) {
        const dataObj = item.data || {};
        const itemEl = document.createElement('div');
        itemEl.className = 'entry-item';
        itemEl.style.display = 'block'; // Переопределяем flex на block для правильного отображения

        const lines = [];
        Object.entries(dataObj).forEach(([key, value]) => {
          if (value === undefined || value === null || String(value).trim() === '') return;
          lines.push(`<strong>${formatEntryKey(key)}</strong> — ${String(value).trim()}`);
        });

        itemEl.innerHTML = lines.join('<br>');
        itemsWrap.appendChild(itemEl);
        removeTitleIfEmpty();
        return;
      }

      // ===== Скидка на подарки =====
      // (скидки уже отрисованы выше в едином списке, этот блок больше не нужен)
      const isDiscount = group.isDiscount || (item.template_id === 'gift-discount') ||
                         (item.template_id === 'gift-discount-regular') ||
                         (item.template_id === 'gift-discount-custom');

      // ===== остальные поля =====
      // Для скидок пропускаем вывод всех остальных полей (они уже показаны в виде расчёта выше)
      if (!isDiscount) {
        Object.entries(item.data || {}).forEach(([key, value]) => {
          // Группа 1: все поля уже отрисованы
          if (RECIPIENT_LIST_FORMS.includes(toSelector(tid)) && (/^recipient_\d+$/.test(key) || /^from_\d+$/.test(key) || /^wish_\d+$/.test(key) || /^comment_\d+$/.test(key) || /^quantity_\d+$/.test(key) || /^amount_\d+$/.test(key) || /^gift_id_\d+$/.test(key) || /^gift_icon_\d+$/.test(key) || /^gift_data_\d+$/.test(key))) return;

          // Группа 2: все поля уже отрисованы
          if (DIRECT_RENDER_FORMS.includes(toSelector(tid)) && (/^recipient_\d+$/.test(key) || /^from_\d+$/.test(key) || /^wish_\d+$/.test(key) || /^comment_\d+$/.test(key) || /^quantity_\d+$/.test(key) || /^amount_\d+$/.test(key) || /^gift_id_\d+$/.test(key) || /^gift_icon_\d+$/.test(key) || /^gift_data_\d+$/.test(key))) return;

          // Группа 3: quantity уже отрисован
          if (BUYOUT_FORMS.includes(toSelector(tid)) && key === 'quantity') return;

          // Группа 4: url уже отрисован
          if (URL_FIELD_FORMS.includes(toSelector(tid)) && key === 'url') return;

          // Группа 5: url уже отрисован
          if (BANNER_FORMS.includes(toSelector(tid)) && key === 'url') return;

          // Группа 6: text/name/reason уже отрисованы
          if (CHARACTER_CHANGE_FORMS.includes(toSelector(tid)) && (key === 'text' || key === 'name' || key === 'reason')) return;

          // Группа 7: comment уже отрисован
          if (REFUSE_FORMS.includes(toSelector(tid)) && key === 'comment') return;

          // Группа 8: все поля уже отрисованы
          if (COUNTER_FORMS.includes(toSelector(tid))) return;

          // пустые значения не выводим (чтобы не было "— —")
          if (value === undefined || value === null || String(value).trim() === '') return;

          const raw = typeof value === 'string' ? value.trim() : value;

          // Для reason (Отказ от персонажа, Смена персонажа) - выводим напрямую с переносами, без нумерации
          if (key === 'reason') {
            const div = document.createElement('div');
            div.style.whiteSpace = 'pre-wrap';
            div.textContent = raw;
            list.appendChild(div);
            return;
          }

          // Для link в "Третий персонаж" - выводим ссылку напрямую, без <li>
          const isThirdChar = toSelector(item.template_id) === FORM_EXP_THIRDCHAR;
          if (isThirdChar && key === 'link') {
            const isUrl = typeof raw === 'string' && /^https?:\/\//i.test(raw);
            if (isUrl) {
              const link = document.createElement('a');
              link.href = raw;
              link.textContent = raw;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              list.appendChild(link);
              return;
            }
          }

          const li = document.createElement('li');

          // URL-поля
          const isUrl = typeof raw === 'string' && /^https?:\/\//i.test(raw);
          if (isUrl) {
            const link = document.createElement('a');
            link.href = raw;
            link.textContent = raw;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            li.appendChild(link);
          } else {
            const keySpan = document.createElement('span');
            keySpan.className = 'key';
            keySpan.textContent = formatEntryKey(key);
            const valueSpan = document.createElement('span');
            valueSpan.className = 'value';
            valueSpan.textContent = (raw ?? '—');
            li.append(keySpan, document.createTextNode(' — '), valueSpan);
          }

          list.appendChild(li);
        });
      }

      removeTitleIfEmpty();

      itemEl.appendChild(list);
      itemsWrap.appendChild(itemEl);
    });

    entryEl.appendChild(itemsWrap);
    log.appendChild(entryEl);
  });

  // ====== Итоговая плашка с суммой и кнопками ======
  if (sortedGroups.length > 0) {
    const summaryPanel = document.createElement('div');
    summaryPanel.className = 'summary-panel';

    // Вычисляем общую сумму
    let totalSum = 0;
    sortedGroups.forEach((group) => {
      if (!group.amount) return;

      // Пропускаем формы, для которых всегда показываем 0
      if (
        group.templateSelector === toSelector(FORM_INCOME_ANKETA) ||
        group.templateSelector === toSelector(FORM_INCOME_AKCION) ||
        group.templateSelector === toSelector(FORM_INCOME_NEEDCHAR) ||
        group.templateSelector === toSelector(FORM_INCOME_ACTIVIST) ||
        group.templateSelector === toSelector(FORM_INCOME_WRITER) ||
        group.templateSelector === toSelector(FORM_INCOME_EPISODE_OF) ||
        group.templateSelector === toSelector(FORM_INCOME_POST_OF)
      ) {
        return;
      }

      const isIncome = group.isDiscount || group.templateSelector?.includes('income');
      const m = String(group.amount).match(/^\s*(\d+)\s*\+\s*x\s*(\d+)\s*$/i);

      if (m || group.mode === 'price_per_item_w_bonus') {
        const price = group.price !== null && group.price !== undefined ? Number(group.price) : (m ? Number(m[1]) : 0);
        const bonus = group.bonus !== null && group.bonus !== undefined ? Number(group.bonus) : (m ? Number(m[2]) : 0);

        let totalCount = 0;
        let totalThousands = 0;
        group.entries.forEach((item) => {
          const rawPersonal = item?.data?.personal_posts_json;
          if (rawPersonal) {
            try {
              const arr = JSON.parse(rawPersonal);
              if (Array.isArray(arr) && arr.length) {
                totalCount += arr.length;
                totalThousands += arr.reduce((s, it) => {
                  const n = Number.isFinite(it?.symbols_num) ? it.symbols_num : parseInt(it?.symbols_num, 10) || 0;
                  return s + Math.floor(Math.max(0, n) / 1000);
                }, 0);
              }
            } catch (_) {}
          }
          const rawPlot = item?.data?.plot_posts_json;
          if (rawPlot) {
            try {
              const arr = JSON.parse(rawPlot);
              if (Array.isArray(arr) && arr.length) {
                totalCount += arr.length;
                totalThousands += arr.reduce((s, it) => {
                  const n = Number.isFinite(it?.symbols_num) ? it.symbols_num : parseInt(it?.symbols_num, 10) || 0;
                  const k = Math.floor(Math.max(0, n) / 1000);
                  return s + Math.min(k, 3);
                }, 0);
              }
            } catch (_) {}
          }
        });

        const total = calculateCost('price_per_item_w_bonus', price, bonus, totalCount, totalThousands, 0);
        totalSum += isIncome ? total : -total;
      } else if (group.templateSelector === toSelector(FORM_EXP_TRANSFER) || /Перевод средств другому/i.test(group.title || '')) {
        let totalAmount = 0;
        let recipientCount = 0;
        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);
          idxs.forEach((idx) => {
            const rawAmount = String(dataObj[`amount_${idx}`] ?? '').trim();
            const amountNum = parseNumericAmount(rawAmount);
            if (amountNum !== null && amountNum > 0) {
              totalAmount += amountNum;
              recipientCount++;
            }
          });
        });
        if (recipientCount > 0) {
          const price = group.price !== null && group.price !== undefined ? Number(group.price) : 10;
          const total = calculateCost('price_w_entered_amount', price, 0, recipientCount, 0, totalAmount);
          totalSum += isIncome ? total : -total;
        }
      } else if (group.templateSelector === toSelector(FORM_INCOME_TOPUP) || group.templateSelector === toSelector(FORM_INCOME_AMS)) {
        // Докупить кредиты / Выдать денежку дополнительно
        let totalTopup = 0;
        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);
          idxs.forEach((idx) => {
            const topupAmount = Number(dataObj[`amount_${idx}`]) || 0;
            totalTopup += topupAmount;
          });
        });
        if (totalTopup > 0) {
          const price = group.price !== null && group.price !== undefined ? Number(group.price) : 0;
          const total = calculateCost('price_per_item', price, 0, totalTopup, 0, 0);
          totalSum += isIncome ? total : -total;
        }
      } else if (group.isDiscount) {
        let totalDiscount = 0;
        group.entries.forEach((item) => {
          const amount = Number(item.data?.discount_amount) || 0;
          totalDiscount += amount;
        });
        totalSum += totalDiscount;
      } else if (
        group.templateSelector === toSelector(FORM_GIFT_PRESENT) ||
        group.templateSelector === toSelector(FORM_GIFT_CUSTOM) ||
        DESIGN_FORMS.includes(group.templateSelector) ||
        /Подарить подарок|Индивидуальный подарок/i.test(group.title || '')
      ) {
        let totalGifts = 0;
        const price = Number.parseInt(group.price, 10) || 100;
        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);
          totalGifts += idxs.filter(idx => String(dataObj[`recipient_${idx}`] || '').trim()).length;
        });
        if (totalGifts > 0) {
          const total = calculateCost('price_per_item', price, 0, totalGifts, 0, 0);
          totalSum += isIncome ? total : -total;
        }
      } else if (SPECIAL_EXPENSE_FORMS.includes(group.templateSelector)) {
        let totalQuantity = 0;
        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);
          idxs.forEach((idx) => {
            const qty = Number(dataObj[`quantity_${idx}`]) || 0;
            totalQuantity += qty;
          });
        });
        const mode = group.mode || 'price_per_item';
        const price = group.price !== null && group.price !== undefined ? Number(group.price) : (parseNumericAmount(group.amount) || 0);
        if (totalQuantity > 0) {
          const total = calculateCost(mode, price, 0, totalQuantity, 0, 0);
          totalSum += isIncome ? total : -total;
        }
      } else {
        const mode = group.mode;
        const price = group.price !== null && group.price !== undefined ? Number(group.price) : null;
        const bonus = group.bonus !== null && group.bonus !== undefined ? Number(group.bonus) : null;

        if (mode && price !== null) {
          if (mode === 'price_per_item') {
            let totalQuantity = 0;
            let totalRecipients = 0;
            const totalEntryMultiplier = group.entries.reduce((sum, item) => {
              const raw = item && typeof item.multiplier !== 'undefined' ? item.multiplier : null;
              const numeric = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
              const value = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
              return sum + value;
            }, 0);

            group.entries.forEach((item) => {
              const dataObj = item.data || {};
              if (dataObj.quantity !== undefined) {
                totalQuantity += Number(dataObj.quantity) || 0;
              }
              const recipientKeys = Object.keys(dataObj).filter(k => k.startsWith('recipient_'));
              totalRecipients += recipientKeys.length;
            });

            const items = totalQuantity > 0 ? totalQuantity : (totalRecipients > 0 ? totalRecipients : (totalEntryMultiplier > 0 ? totalEntryMultiplier : 1));
            const total = calculateCost(mode, price, bonus || 0, items, 0, 0);
            totalSum += isIncome ? total : -total;
          }
        } else {
          const amountNumber = parseNumericAmount(group.amount);
          if (amountNumber !== null) {
            const totalEntryMultiplier = group.entries.reduce((sum, item) => {
              const raw = item && typeof item.multiplier !== 'undefined' ? item.multiplier : null;
              const numeric = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
              const value = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
              return sum + value;
            }, 0);
            const multiplier = totalEntryMultiplier > 0 ? totalEntryMultiplier : 1;
            const total = amountNumber * multiplier;
            totalSum += isIncome ? total : -total;
          }
        }
      }
    });

    // Создаем содержимое панели
    const totalText = document.createElement('div');
    totalText.className = 'summary-total';
    const totalColor = totalSum >= 0 ? '#22c55e' : '#ef4444';
    const totalPrefix = totalSum >= 0 ? '+ ' : '− ';
    totalText.innerHTML = `<strong>ИТОГО:</strong> <span style="color: ${totalColor}">${totalPrefix}${formatNumber(Math.abs(totalSum))}</span>`;
    summaryPanel.appendChild(totalText);

    // Кнопки
    const buttonsWrap = document.createElement('div');
    buttonsWrap.className = 'summary-buttons';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'button';
    resetBtn.textContent = 'Сбросить';
    resetBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmModal('Вы уверены, что хотите очистить все операции?');
      if (confirmed) {
        submissionGroups.length = 0;
        renderLog(log);
      }
    });

    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.className = 'button primary';
    buyBtn.textContent = 'Купить';
    buyBtn.addEventListener('click', () => {
      // Формируем массив операций из отрендеренного DOM
      const operations = buildOperationsArray(log);

      console.log('=== Итоги операций ===');
      console.log('Всего операций:', operations.length);
      console.log('Общая сумма:', totalSum);
      console.log('\nДетали операций:');
      console.log(operations);
      console.log('\n======================');

      // Отправляем сообщение родительскому окну с операциями
      for (const origin of ALLOWED_PARENTS) {
        try {
          window.parent.postMessage({
            type: "PURCHASE",
            operations: operations,
            totalSum: totalSum
          }, '*');
        } catch {
          console.log("ты пытался что-то купить");
        }
      }
    });

    buttonsWrap.appendChild(resetBtn);
    buttonsWrap.appendChild(buyBtn);
    summaryPanel.appendChild(buttonsWrap);

    log.appendChild(summaryPanel);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================
// Note: Most functions are already exported with 'export function ...' syntax
// Only internal helper functions need to be exported here

export { buildOperationsArray };
