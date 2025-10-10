// ============================================================================
// components.js — UI и модальные функции
// ============================================================================

import {
  ALLOWED_PARENTS,
  BASE_URL, 
  COUNTER_POLL_INTERVAL_MS,
  FORM_TIMEOUT_MS,
  PROMO_TIMEOUT_MS,
  NEEDED_TIMEOUT_MS,
  TOPUP_TIMEOUT_MS,
  AMS_TIMEOUT_MS,
  TRANSFER_TIMEOUT_MS,
  GIFT_TIMEOUT_MS,
  BEST_EPISODE_TIMEOUT_MS,
  BEST_POST_TIMEOUT_MS,
  BEST_WRITER_TIMEOUT_MS,
  BEST_ACTIVIST_TIMEOUT_MS,
  FIRST_POST_TIMEOUT_MS,
  PERSONAL_TIMEOUT_MS,
  PLOT_TIMEOUT_MS,
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
  formatEntryKey
} from './services.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Конвертирует DOM узел в BB-код
 * @param {Node} node - DOM узел
 * @returns {string} - строка с BB-кодами
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
        entryLists.forEach(list => {
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
            type: 'list'
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
      info: info
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

  const displayText = formatCostDisplay(mode, price, bonus, items, additional_items, entered_amount);
  modalAmount.textContent = displayText;
}

export function cleanupCounterWatcher(counterWatcher, modalFields, form) {
  if (counterWatcher && typeof counterWatcher.cancel === 'function') {
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
    const designSelectors = ['#form-icon-custom', '#form-icon-present', '#form-badge-custom', '#form-badge-present', '#form-bg-custom', '#form-bg-present'];
    const isGiftGroup = group.templateSelector === '#form-gift-present' || /Подарить подарок|Праздничный подарок|Подарок-сюрприз|Воздушный подарок/i.test(group.title || '');
    const isDesignGroup = designSelectors.includes(group.templateSelector);

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
          itemTitle = `Подарок из коллекции (#${giftId})`;
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
      } else if (group.templateSelector === '#form-exp-transfer' || /Перевод средств другому/i.test(group.title || '')) {
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
      } else if (group.templateSelector === '#form-income-topup' || group.templateSelector === '#form-income-ams') {
        // Докупить кредиты / Выдать денежку дополнительно: price × сумма всех topup
        let totalTopup = 0;

        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);

          idxs.forEach((idx) => {
            const topupAmount = Number(dataObj[`topup_${idx}`]) || 0;
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
        group.templateSelector === '#form-gift-present' ||
        group.templateSelector === '#form-gift-custom' ||
        ['#form-icon-custom', '#form-icon-present', '#form-badge-custom', '#form-badge-present', '#form-bg-custom', '#form-bg-present'].includes(group.templateSelector) ||
        /Подарить подарок|Индивидуальный подарок/i.test(group.title || '')
      ) {
        // Подарки и Оформление: цена_1 × количество получателей
        let totalGifts = 0;
        const giftPrice1 = Number.parseInt(group.giftPrice1, 10) || 100;

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
          const total = calculateCost('price_per_item', giftPrice1, 0, totalGifts, 0, 0);
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${formatNumber(total)}</span>`;
        } else {
          meta.innerHTML = `${group.amountLabel}: <span style="color: ${color}">${prefix}${group.amount}</span>`;
        }
        header.appendChild(meta);
      } else if (['#form-exp-bonus1d1', '#form-exp-bonus2d1', '#form-exp-bonus1w1', '#form-exp-bonus2w1', '#form-exp-bonus1m1', '#form-exp-bonus2m1', '#form-exp-bonus1m3', '#form-exp-bonus2m3', '#form-exp-mask', '#form-exp-clean'].includes(group.templateSelector)) {
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
      list.className = 'entry-list';

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
      const tid = item.template_id;

      // Группа 1: Формы с получателями (листом)
      const group1Templates = [
        'form-income-anketa', 'form-income-akcion', 'form-income-needchar',
        'form-income-episode-of', 'form-income-topup', 'form-income-ams',
        'form-exp-mask',
        'form-exp-bonus1d1', 'form-exp-bonus2d1',
        'form-exp-bonus1w1', 'form-exp-bonus2w1',
        'form-exp-bonus1m1', 'form-exp-bonus2m1',
        'form-exp-bonus1m3', 'form-exp-bonus2m3',
        'form-exp-clean',
        'form-icon-custom', 'form-icon-present',
        'form-badge-custom', 'form-badge-present',
        'form-bg-custom', 'form-bg-present',
        'form-gift-custom', 'form-gift-present',
        'form-exp-transfer'
      ];

      // Группа 2: Активист/Постописец/Пост полумесяца (без li)
      const group2Templates = ['form-income-activist', 'form-income-writer', 'form-income-post-of'];

      // Группа 3: Выкупы (только количество)
      const group3Templates = [
        'form-exp-face-1m', 'form-exp-face-3m', 'form-exp-face-6m',
        'form-exp-char-1m', 'form-exp-char-3m', 'form-exp-char-6m',
        'form-exp-face-own-1m', 'form-exp-face-own-3m', 'form-exp-face-own-6m',
        'form-exp-need-1w', 'form-exp-need-2w', 'form-exp-need-1m'
      ];

      // Группа 4: Ссылки в li
      const group4Templates = [
        'form-income-needrequest', 'form-income-ep-personal', 'form-income-ep-plot',
        'form-income-contest', 'form-income-avatar', 'form-income-design-other',
        'form-income-run-contest', 'form-income-mastering', 'form-income-rpgtop'
      ];

      // Группа 5: Ссылки без li
      const group5Templates = ['form-income-banner-reno', 'form-income-banner-mayak', 'form-exp-thirdchar'];

      // Группа 6: Текстовые поля
      const group6Templates = ['form-exp-changechar', 'form-income-firstpost'];

      // Группа 7: Отказ от персонажа
      const group7Templates = ['form-exp-refuse'];

      // Группа 8: Ключ-значение без li (100 сообщений, репутации, позитива, месяц)
      const group8Templates = ['form-income-100msgs', 'form-income-100rep', 'form-income-100pos', 'form-income-month'];

      const bonusMaskCleanIds = [
        'form-exp-bonus1d1', 'form-exp-bonus2d1',
        'form-exp-bonus1w1', 'form-exp-bonus2w1',
        'form-exp-bonus1m1', 'form-exp-bonus2m1',
        'form-exp-bonus1m3', 'form-exp-bonus2m3',
        'form-exp-mask', 'form-exp-clean'
      ];
      const isBonusMaskClean = bonusMaskCleanIds.includes(item.template_id);

      // ===== ГРУППА 1: Формы с получателями в списке =====
      if (group1Templates.includes(tid)) {
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
          const quantity = dataObj[`quantity_${idx}`] || dataObj[`topup_${idx}`] || dataObj[`amount_${idx}`] || '';

          const li = document.createElement('li');

          // NAME с ссылкой
          let htmlContent = `<strong><a target="_blank" href="${BASE_URL}/profile.php?id=${userId}">${userName}</a></strong>`;

          // NUM_INFO: показываем либо quantity, либо price (для админ-форм начислений)
          const adminRecipientForms = ['form-income-anketa', 'form-income-akcion', 'form-income-needchar', 'form-income-episode-of'];
          const showPrice = adminRecipientForms.includes(tid) && !quantity;
          const isTopupOrAms = tid === 'form-income-topup' || tid === 'form-income-ams';

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

          // Добавляем отступ в конце для форм с комментариями
          if (hasFromField) {
            htmlContent += '<br><br>';
          }

          li.innerHTML = htmlContent;
          list.appendChild(li);
        });
      }

      // ===== ГРУППА 2: Активист/Постописец/Пост полумесяца (без li) =====
      if (group2Templates.includes(tid)) {
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
          const quantity = dataObj[`quantity_${idx}`] || dataObj[`topup_${idx}`] || dataObj[`amount_${idx}`] || '';

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
      if (group3Templates.includes(tid)) {
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
      if (group4Templates.includes(tid)) {
        const dataObj = item.data || {};
        const url = dataObj.url || '';

        if (url) {
          const li = document.createElement('li');
          li.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
          list.appendChild(li);
        }
      }

      // ===== ГРУППА 5: Ссылки без li =====
      if (group5Templates.includes(tid)) {
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
      if (group6Templates.includes(tid)) {
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
      if (group7Templates.includes(tid)) {
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
      if (group8Templates.includes(tid)) {
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
          if (group1Templates.includes(tid) && (/^recipient_\d+$/.test(key) || /^from_\d+$/.test(key) || /^wish_\d+$/.test(key) || /^comment_\d+$/.test(key) || /^quantity_\d+$/.test(key) || /^topup_\d+$/.test(key) || /^amount_\d+$/.test(key) || /^gift_id_\d+$/.test(key) || /^gift_icon_\d+$/.test(key) || /^gift_data_\d+$/.test(key))) return;

          // Группа 2: все поля уже отрисованы
          if (group2Templates.includes(tid) && (/^recipient_\d+$/.test(key) || /^from_\d+$/.test(key) || /^wish_\d+$/.test(key) || /^comment_\d+$/.test(key) || /^quantity_\d+$/.test(key) || /^topup_\d+$/.test(key) || /^amount_\d+$/.test(key) || /^gift_id_\d+$/.test(key) || /^gift_icon_\d+$/.test(key) || /^gift_data_\d+$/.test(key))) return;

          // Группа 3: quantity уже отрисован
          if (group3Templates.includes(tid) && key === 'quantity') return;

          // Группа 4: url уже отрисован
          if (group4Templates.includes(tid) && key === 'url') return;

          // Группа 5: url уже отрисован
          if (group5Templates.includes(tid) && key === 'url') return;

          // Группа 6: text/name/reason уже отрисованы
          if (group6Templates.includes(tid) && (key === 'text' || key === 'name' || key === 'reason')) return;

          // Группа 7: comment уже отрисован
          if (group7Templates.includes(tid) && key === 'comment') return;

          // Группа 8: все поля уже отрисованы
          if (group8Templates.includes(tid)) return;

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
          const isThirdChar = item.template_id === 'form-exp-thirdchar';
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
      } else if (group.templateSelector === '#form-exp-transfer' || /Перевод средств другому/i.test(group.title || '')) {
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
      } else if (group.templateSelector === '#form-income-topup' || group.templateSelector === '#form-income-ams') {
        // Докупить кредиты / Выдать денежку дополнительно
        let totalTopup = 0;
        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);
          idxs.forEach((idx) => {
            const topupAmount = Number(dataObj[`topup_${idx}`]) || 0;
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
        group.templateSelector === '#form-gift-present' ||
        group.templateSelector === '#form-gift-custom' ||
        ['#form-icon-custom', '#form-icon-present', '#form-badge-custom', '#form-badge-present', '#form-bg-custom', '#form-bg-present'].includes(group.templateSelector) ||
        /Подарить подарок|Индивидуальный подарок/i.test(group.title || '')
      ) {
        let totalGifts = 0;
        const giftPrice1 = Number.parseInt(group.giftPrice1, 10) || 100;
        group.entries.forEach((item) => {
          const dataObj = item.data || {};
          const idxs = Object.keys(dataObj)
            .map(k => k.match(/^recipient_(\d+)$/))
            .filter(Boolean)
            .map(m => m[1]);
          totalGifts += idxs.filter(idx => String(dataObj[`recipient_${idx}`] || '').trim()).length;
        });
        if (totalGifts > 0) {
          const total = calculateCost('price_per_item', giftPrice1, 0, totalGifts, 0, 0);
          totalSum += isIncome ? total : -total;
        }
      } else if (['#form-exp-bonus1d1', '#form-exp-bonus2d1', '#form-exp-bonus1w1', '#form-exp-bonus2w1', '#form-exp-bonus1m1', '#form-exp-bonus2m1', '#form-exp-bonus1m3', '#form-exp-bonus2m3', '#form-exp-mask', '#form-exp-clean'].includes(group.templateSelector)) {
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
// ADMIN FLOWS
// ============================================================================

export function setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount = null, basePrice = null }) {
  // 1) убрать лишние инфо-плашки из шаблона
  (() => {
    modalFields.querySelectorAll('.gift-note, .muted-note, .note-error, .callout, [data-info]')
      .forEach(el => el.remove());
    const maybeInfo = Array.from(modalFields.children)
      .find(el => /Начисление производит администратор/i.test(el.textContent || ''));
    if (maybeInfo) maybeInfo.remove();
  })();

  // 2) показать «ждём…» (якорь для ошибок)
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = 'Пожалуйста, подождите...';
  modalFields.prepend(waitNote);

  const hideWait = () => { const el = modalFields.querySelector('.admin-wait-note'); if (el) el.remove(); };
  const showError = (msg) => {
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      const anchor = modalFields.querySelector('.admin-wait-note');
      if (anchor) anchor.insertAdjacentElement('afterend', err);
      else modalFields.prepend(err);
    }
    err.textContent = msg || 'Произошла ошибка. Попробуйте обновить страницу.';
  };
  const clearError = () => { const err = modalFields.querySelector('.note-error.admin-error'); if (err) err.remove(); };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    hideWait();
    showError('Произошла ошибка. Попробуйте обновить страницу.');
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
    cancel();
  };

  const renderAdminPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();
    clearError();

    const wrap = document.createElement('div');
    wrap.className = 'field';

    const chosen = document.createElement('div');
    chosen.className = 'chips';
    wrap.appendChild(chosen);

    const block = document.createElement('div');
    block.className = 'field anketa-combobox';

    const label = document.createElement('label');
    label.textContent = 'Кому начислить*';
    block.appendChild(label);

    const box = document.createElement('div');
    box.className = 'combo';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Начните вводить имя или id...';
    input.setAttribute('autocomplete', 'off');

    const list = document.createElement('div');
    list.className = 'suggest';
    list.setAttribute('role', 'listbox');

    box.appendChild(input);
    box.appendChild(list);
    block.appendChild(box);
    wrap.appendChild(block);
    modalFields.appendChild(wrap);

    const norm = (s) => String(s ?? '').trim().toLowerCase();
    const picked = new Set();

    const syncHiddenFields = () => {
      modalFields.querySelectorAll('input[type="hidden"][name^="recipient_"]').forEach(n => n.remove());
      let i = 1;
      picked.forEach((id) => {
        const hid = document.createElement('input');
        hid.type = 'hidden';
        hid.name = `recipient_${i++}`;
        hid.value = String(id);
        modalFields.appendChild(hid);
      });
      btnSubmit.style.display = picked.size ? '' : 'none';
      btnSubmit.disabled = picked.size === 0;

      // Обновляем modalAmount: price × количество получателей
      if (modalAmount && basePrice !== null) {
        const price = Number(basePrice) || 0;
        const totalRecipients = picked.size;
        if (totalRecipients > 0) {
          updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(price), bonus: '0' } }, { items: totalRecipients });
        } else {
          modalAmount.textContent = formatNumber(price);
        }
      }
    };

    const addChip = (user) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = `${user.name} (id: ${user.id})`;
      chip.title = 'Нажмите, чтобы удалить';
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        picked.delete(String(user.id));
        chip.remove();
        syncHiddenFields();
      });
      chosen.appendChild(chip);
    };

    const portalList = list;
    portalList.style.position = 'fixed';
    portalList.style.zIndex = '9999';
    let portalMounted = false;
    const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
    const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
    const positionPortal = () => {
      const r = input.getBoundingClientRect();
      portalList.style.left = `${r.left}px`;
      portalList.style.top  = `${r.bottom + 6}px`;
      portalList.style.width = `${r.width}px`;
    };
    const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
    const openSuggest  = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

    const buildItem = (u) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'suggest-item';
      item.setAttribute('role', 'option');
      item.textContent = `${u.name} (id: ${u.id})`;
      item.addEventListener('click', () => {
        const sid = String(u.id);
        if (picked.has(sid)) { closeSuggest(); input.value = ''; return; }
        picked.add(sid);
        addChip(u);
        syncHiddenFields();
        input.value = '';
        closeSuggest();
        input.focus();
      });
      return item;
    };

    const doSearch = () => {
      const q = norm(input.value);
      portalList.innerHTML = '';
      if (!q) { closeSuggest(); return; }
      const res = users
        .filter(u => norm(u.name).includes(q) || String(u.id).includes(q))
        .slice(0, 20);
      if (!res.length) { closeSuggest(); return; }
      res.forEach(u => portalList.appendChild(buildItem(u)));
      openSuggest();
    };

    input.addEventListener('input', doSearch);
    input.addEventListener('focus', doSearch);
    document.addEventListener('click', (e) => {
      if (!block.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
    });
    window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
    window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

    // Prefill из data
    if (data) {
      const ids = Object.keys(data)
        .filter(k => /^recipient_\d+$/.test(k))
        .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10))
        .map(k => String(data[k]).trim())
        .filter(Boolean);

      ids.forEach((id) => {
        if (picked.has(id)) return;
        const u = Array.isArray(users) ? users.find(x => String(x.id) === id) : null;
        if (u) {
          picked.add(String(u.id));
          addChip(u);
        } else {
          picked.add(id);
          addChip({ name: 'Неизвестный', id });
        }
      });

      syncHiddenFields();
    }

    if (!picked.size) {
      btnSubmit.style.display = 'none';
      btnSubmit.disabled = true;
    }
  };

  const to = setTimeout(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) return fail();
    return fail();
  }, timeoutMs);

  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderAdminPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

export function setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount = null, basePrice = null }) {
  // удалить инфо-элементы
  (() => {
    modalFields.querySelectorAll('.gift-note, .muted-note, .note-error, .callout, [data-info]')
      .forEach(el => el.remove());
    const maybeInfo = Array.from(modalFields.children)
      .find(el => /Начисление производит администратор/i.test(el.textContent || ''));
    if (maybeInfo) maybeInfo.remove();
  })();

  // "ждём..."
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = 'Пожалуйста, подождите...';
  modalFields.prepend(waitNote);

  const hideWait = () => { const el = modalFields.querySelector('.admin-wait-note'); if (el) el.remove(); };
  const showError = (msg) => {
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      const anchor = modalFields.querySelector('.admin-wait-note');
      if (anchor) anchor.insertAdjacentElement('afterend', err);
      else modalFields.prepend(err);
    }
    err.textContent = msg || 'Произошла ошибка. Попробуйте обновить страницу.';
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    hideWait();
    showError('Произошла ошибка. Попробуйте обновить страницу.');
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
    cancel();
  };

  const renderAdminPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const chosen = document.createElement('div');
    chosen.className = 'chips';
    wrap.appendChild(chosen);

    const block = document.createElement('div');
    block.className = 'field anketa-combobox';

    const label = document.createElement('label');
    label.textContent = 'Кому начислить*';
    block.appendChild(label);

    const box = document.createElement('div');
    box.className = 'combo';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Начните вводить имя или id...';
    input.setAttribute('autocomplete', 'off');

    const list = document.createElement('div');
    list.className = 'suggest';
    list.setAttribute('role', 'listbox');

    box.appendChild(input);
    box.appendChild(list);
    block.appendChild(box);
    wrap.appendChild(block);
    modalFields.appendChild(wrap);

    // единственный выбранный id (строка)
    let pickedId = '';

    const syncHiddenFields = () => {
      modalFields.querySelectorAll('input[type="hidden"][name^="recipient_"]').forEach(n => n.remove());
      if (pickedId) {
        const hid = document.createElement('input');
        hid.type = 'hidden';
        hid.name = 'recipient_1';
        hid.value = pickedId;
        modalFields.appendChild(hid);
      }
      btnSubmit.style.display = pickedId ? '' : 'none';
      btnSubmit.disabled = !pickedId;

      // Обновляем modalAmount: показываем price (для 1 получателя)
      if (modalAmount && basePrice !== null) {
        const price = Number(basePrice) || 0;
        modalAmount.textContent = formatNumber(price);
      }
    };

    const renderChip = (user) => {
      chosen.innerHTML = '';
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = `${user.name} (id: ${user.id})`;
      chip.title = 'Нажмите, чтобы удалить';
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        pickedId = '';
        chosen.innerHTML = '';
        syncHiddenFields();
      });
      chosen.appendChild(chip);
    };

    const portalList = list;
    portalList.style.position = 'fixed';
    portalList.style.zIndex = '9999';
    let portalMounted = false;
    const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
    const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
    const positionPortal = () => {
      const r = input.getBoundingClientRect();
      portalList.style.left = `${r.left}px`;
      portalList.style.top  = `${r.bottom + 6}px`;
      portalList.style.width = `${r.width}px`;
    };
    const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
    const openSuggest  = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

    const buildItem = (u) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'suggest-item';
      item.setAttribute('role', 'option');
      item.textContent = `${u.name} (id: ${u.id})`;
      item.addEventListener('click', () => {
        pickedId = String(u.id);
        renderChip(u);
        syncHiddenFields();
        input.value = '';
        closeSuggest();
        input.focus();
      });
      return item;
    };

    const norm = (s) => String(s ?? '').trim().toLowerCase();
    const doSearch = () => {
      const q = norm(input.value);
      portalList.innerHTML = '';
      if (!q) { closeSuggest(); return; }
      const res = users
        .filter(u => norm(u.name).includes(q) || String(u.id).includes(q))
        .slice(0, 20);
      if (!res.length) { closeSuggest(); return; }
      res.forEach(u => portalList.appendChild(buildItem(u)));
      openSuggest();
    };

    input.addEventListener('input', doSearch);
    input.addEventListener('focus', doSearch);
    document.addEventListener('click', (e) => {
      if (!block.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
    });
    window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
    window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

    // Prefill из data (берём только первого)
    if (data) {
      const ids = Object.keys(data)
        .filter(k => /^recipient_\d+$/.test(k))
        .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10))
        .map(k => String(data[k]).trim())
        .filter(Boolean);
      const first = ids[0];
      if (first) {
        const u = users.find(x => String(x.id) === first);
        if (u) { pickedId = String(u.id); renderChip(u); }
        else   { pickedId = first; renderChip({ name: 'Неизвестный', id: first }); }
      }
      syncHiddenFields();
    }

    // изначально скрыта
    if (!pickedId) {
      btnSubmit.style.display = 'none';
      btnSubmit.disabled = true;
    }
  };

  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderAdminPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

export function setupAdminTopupFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, requireComment = false, modalAmount, basePrice = null }) {
  // === 1) Удаляем дисклеймер и прочие инфо-элементы — у админа их быть НЕ должно ===
  modalFields.querySelectorAll('.info, .gift-note, .muted-note, .note-error, .callout, [data-info]')
    .forEach(el => el.remove());
  const maybeInfo = Array.from(modalFields.children)
    .find(el => /Начисление производит администратор/i.test(el.textContent || ''));
  if (maybeInfo) maybeInfo.remove();

  // === 2) Показываем "Пожалуйста, подождите..." пока ждём USERS_LIST ===
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = 'Пожалуйста, подождите...';
  modalFields.prepend(waitNote);

  const hideWait = () => {
    const el = modalFields.querySelector('.admin-wait-note');
    if (el) el.remove();
  };
  const showError = (msg) => {
    hideWait();
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      modalFields.prepend(err);
    }
    err.textContent = msg || 'Произошла ошибка. Попробуйте обновить страницу.';
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Попробуйте обновить страницу.');
    cancel();
  };

  // === 3) Когда USERS_LIST готов — рисуем пикер с суммой на каждого ===
  const renderAdminPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    // Каркас
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const chosen = document.createElement('div');
    chosen.className = 'chips';
    wrap.appendChild(chosen);

    const block = document.createElement('div');
    block.className = 'field anketa-combobox';

    const label = document.createElement('label');
    label.textContent = 'Кому начислить и сколько*';
    block.appendChild(label);

    const box = document.createElement('div');
    box.className = 'combo';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Начните вводить имя или id...';
    input.setAttribute('autocomplete', 'off');

    const list = document.createElement('div');
    list.className = 'suggest';
    list.setAttribute('role', 'listbox');

    box.appendChild(input);
    box.appendChild(list);
    block.appendChild(box);
    wrap.appendChild(block);
    modalFields.appendChild(wrap);

    // Выбранные: Map<id, { id, name, amountInput, commentInput, el }>
    const picked = new Map();

    const isValidAmount = (raw) => {
      const num = parseNumericAmount(raw);
      return Number.isFinite(num) && num > 0;
    };

    const syncHiddenFields = () => {
      // очищаем прошлые скрытые
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="topup_"], input[type="hidden"][name^="comment_"]')
        .forEach(n => n.remove());

      // пересобираем пары recipient_i + topup_i (+ comment_i для AMS) только для валидных сумм
      let i = 1;
      let totalAmount = 0;
      for (const { id, amountInput, commentInput } of picked.values()) {
        const val = amountInput?.value ?? '';
        if (!isValidAmount(val)) continue;

        // Для AMS проверяем наличие комментария
        if (requireComment) {
          const comment = commentInput?.value?.trim() ?? '';
          if (!comment) continue;
        }

        const hidR = document.createElement('input');
        hidR.type = 'hidden';
        hidR.name = `recipient_${i}`;
        hidR.value = String(id);

        const hidA = document.createElement('input');
        hidA.type = 'hidden';
        hidA.name = `topup_${i}`;
        hidA.value = String(val).trim().replace(',', '.');

        modalFields.append(hidR, hidA);

        // Для AMS добавляем комментарий
        if (requireComment && commentInput) {
          const hidC = document.createElement('input');
          hidC.type = 'hidden';
          hidC.name = `comment_${i}`;
          hidC.value = commentInput.value.trim();
          modalFields.append(hidC);
        }

        // Суммируем количество получателей для расчета итого
        totalAmount += parseNumericAmount(val) || 0;
        i++;
      }

      const hasAny = i > 1;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;

      // Обновляем modal-amount: price × total = итого
      if (modalAmount && basePrice !== null) {
        const price = Number(basePrice);
        const total = price * totalAmount;
        modalAmount.textContent = `${formatNumber(price)} × ${totalAmount} = ${formatNumber(total)}`;
      }
    };

    const removeChip = (id) => {
      const item = picked.get(id);
      if (item && item.el) item.el.remove();
      picked.delete(id);
      syncHiddenFields();
    };

    const addChip = (user, prefillAmount = '', prefillComment = '') => {
      const sid = String(user.id);
      if (picked.has(sid)) return;

      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';

      const text = document.createElement('span');
      text.textContent = `${user.name} (id: ${user.id})`;

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '0';
      amount.step = '1';
      amount.placeholder = 'сколько';
      amount.value = prefillAmount || '';
      amount.style.width = '90px';
      amount.addEventListener('input', syncHiddenFields);

      let commentInput = null;
      if (requireComment) {
        commentInput = document.createElement('input');
        commentInput.type = 'text';
        commentInput.placeholder = 'за что *';
        commentInput.value = prefillComment || '';
        commentInput.style.width = '150px';
        commentInput.required = true;
        commentInput.addEventListener('input', syncHiddenFields);
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.title = 'Удалить';
      del.style.border = 'none';
      del.style.background = 'transparent';
      del.style.cursor = 'pointer';
      del.style.fontSize = '16px';
      del.addEventListener('click', () => removeChip(sid));

      if (requireComment) {
        chip.append(text, amount, commentInput, del);
      } else {
        chip.append(text, amount, del);
      }
      chosen.appendChild(chip);

      picked.set(sid, { id: sid, name: user.name, amountInput: amount, commentInput, el: chip });
      syncHiddenFields();
    };

    // Подсказки (портал)
    const portalList = list;
    portalList.style.position = 'fixed';
    portalList.style.zIndex = '9999';
    let portalMounted = false;
    const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
    const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
    const positionPortal = () => {
      const r = input.getBoundingClientRect();
      portalList.style.left = `${r.left}px`;
      portalList.style.top  = `${r.bottom + 6}px`;
      portalList.style.width = `${r.width}px`;
    };
    const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
    const openSuggest  = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

    const norm = (s) => String(s ?? '').trim().toLowerCase();
    const buildItem = (u) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'suggest-item';
      item.setAttribute('role', 'option');
      item.textContent = `${u.name} (id: ${u.id})`;
      item.addEventListener('click', () => {
        addChip(u);
        input.value = '';
        closeSuggest();
        input.focus();
      });
      return item;
    };
    const doSearch = () => {
      const q = norm(input.value);
      portalList.innerHTML = '';
      if (!q) { closeSuggest(); return; }
      const res = users.filter(u => norm(u.name).includes(q) || String(u.id).includes(q)).slice(0, 20);
      if (!res.length) { closeSuggest(); return; }
      res.forEach(u => portalList.appendChild(buildItem(u)));
      openSuggest();
    };
    input.addEventListener('input', doSearch);
    input.addEventListener('focus', doSearch);
    document.addEventListener('click', (e) => {
      if (!block.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
    });
    window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
    window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

    // Prefill из data: recipient_i + topup_i (+ comment_i для AMS)
    if (data) {
      const ids = Object.keys(data)
        .filter(k => /^recipient_\d+$/.test(k))
        .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10));
      ids.forEach((rk) => {
        const idx = rk.slice(10);
        const rid = String(data[rk]).trim();
        if (!rid) return;
        const amount = String(data[`topup_${idx}`] ?? '').trim();
        const comment = requireComment ? String(data[`comment_${idx}`] ?? '').trim() : '';
        const u = users.find(x => String(x.id) === rid);
        if (u) addChip(u, amount, comment);
        else   addChip({ id: rid, name: 'Неизвестный' }, amount, comment);
      });
      syncHiddenFields();
    }

    // изначально submit скрыт, пока нет валидных пар
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  // === 4) Ждём USERS_LIST с таймаутом ===
  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderAdminPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

// ============================================================================
// SETUP TRANSFER FLOW - Перевод средств другому (комиссия)
// ============================================================================

export function setupTransferFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, basePrice = null }) {
  // === 1) Удаляем существующие поля формы ===
  modalFields.querySelectorAll('.info, .gift-note, .muted-note, .note-error, .callout, [data-info], .field')
    .forEach(el => el.remove());

  // Устанавливаем начальное значение modalAmount
  if (modalAmount && basePrice !== null) {
    modalAmount.textContent = formatNumber(basePrice);
  }

  // === 2) Показываем "Пожалуйста, подождите..." пока ждём USERS_LIST ===
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = 'Пожалуйста, подождите...';
  modalFields.prepend(waitNote);

  const hideWait = () => {
    const el = modalFields.querySelector('.admin-wait-note');
    if (el) el.remove();
  };

  const showError = (msg) => {
    hideWait();
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      err.style.color = 'var(--danger)';
      modalFields.prepend(err);
    }
    err.textContent = msg || 'Произошла ошибка. Пожалуйста, обновите страницу.';
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Пожалуйста, обновите страницу.');
    cancel();
  };

  // === 3) Функция обновления стоимости ===
  const updateTotalCost = (picked) => {
    let totalAmount = 0;
    let count = 0;

    for (const { amountInput } of picked.values()) {
      const val = amountInput?.value ?? '';
      const num = parseNumericAmount(val);
      if (Number.isFinite(num) && num > 0) {
        totalAmount += num;
        count++;
      }
    }

    if (modalAmount) {
      if (count > 0) {
        // Используем режим 'price_w_entered_amount': entered_amount + price × items
        const priceStr = basePrice !== null ? String(basePrice) : '0';
        updateModalAmount(modalAmount, { dataset: { mode: 'price_w_entered_amount', price: priceStr, bonus: '0' } }, {
          items: count,
          entered_amount: totalAmount
        });
      } else {
        // Показываем базовую цену, если нет получателей
        if (basePrice !== null) {
          modalAmount.textContent = formatNumber(basePrice);
        } else {
          modalAmount.textContent = '';
        }
      }
    }

    const commissionPerPerson = basePrice;
    const commission = count * commissionPerPerson;
    const totalCost = totalAmount + commission;
    return { totalAmount, commission, totalCost, count };
  };

  // === 4) Когда USERS_LIST готов — рисуем пикер с суммой на каждого ===
  const renderTransferPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    // Добавляем информационное сообщение
    const infoBlock = document.createElement('div');
    infoBlock.className = 'info';
    infoBlock.innerHTML = '<strong>Система подсчета:</strong> ваша сумма + 10 галлеонов за каждого пользователя';
    modalFields.appendChild(infoBlock);

    // Каркас
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const chosen = document.createElement('div');
    chosen.className = 'chips';
    wrap.appendChild(chosen);

    const block = document.createElement('div');
    block.className = 'field anketa-combobox';

    const label = document.createElement('label');
    label.textContent = 'Кому перевести и сколько*';
    block.appendChild(label);

    const box = document.createElement('div');
    box.className = 'combo';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Начните вводить имя или id...';
    input.setAttribute('autocomplete', 'off');

    const list = document.createElement('div');
    list.className = 'suggest';
    list.setAttribute('role', 'listbox');

    box.appendChild(input);
    box.appendChild(list);
    block.appendChild(box);
    wrap.appendChild(block);
    modalFields.appendChild(wrap);

    // Выбранные: Map<id, { id, name, amountInput, el }>
    const picked = new Map();

    const isValidAmount = (raw) => {
      const num = parseNumericAmount(raw);
      return Number.isFinite(num) && num > 0;
    };

    const syncHiddenFields = () => {
      // очищаем прошлые скрытые
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="amount_"]')
        .forEach(n => n.remove());

      // пересобираем пары recipient_i + amount_i только для валидных сумм
      let i = 1;
      for (const { id, amountInput } of picked.values()) {
        const val = amountInput?.value ?? '';
        if (!isValidAmount(val)) continue;

        const hidR = document.createElement('input');
        hidR.type = 'hidden';
        hidR.name = `recipient_${i}`;
        hidR.value = String(id);

        const hidA = document.createElement('input');
        hidA.type = 'hidden';
        hidA.name = `amount_${i}`;
        hidA.value = String(val).trim().replace(',', '.');

        modalFields.append(hidR, hidA);
        i++;
      }

      const { count } = updateTotalCost(picked);
      const hasAny = count > 0;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
    };

    const removeChip = (id) => {
      const item = picked.get(id);
      if (item && item.el) item.el.remove();
      picked.delete(id);
      syncHiddenFields();
    };

    const addChip = (user, prefillAmount = '') => {
      const sid = String(user.id);
      if (picked.has(sid)) return;

      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';

      const text = document.createElement('span');
      text.textContent = `${user.name} (id: ${user.id})`;

      const amount = document.createElement('input');
      amount.type = 'number';
      amount.min = '0';
      amount.step = '1';
      amount.placeholder = 'сколько';
      amount.value = prefillAmount || '';
      amount.style.width = '90px';
      amount.addEventListener('input', syncHiddenFields);

      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.title = 'Удалить';
      del.style.border = 'none';
      del.style.background = 'transparent';
      del.style.cursor = 'pointer';
      del.style.fontSize = '16px';
      del.addEventListener('click', () => removeChip(sid));

      chip.append(text, amount, del);
      chosen.appendChild(chip);

      picked.set(sid, { id: sid, name: user.name, amountInput: amount, el: chip });
      syncHiddenFields();
    };

    // Подсказки (портал)
    const portalList = list;
    portalList.style.position = 'fixed';
    portalList.style.zIndex = '9999';

    const hideList = () => { portalList.innerHTML = ''; portalList.style.display = 'none'; };

    const showList = (items) => {
      portalList.innerHTML = '';
      if (!items.length) { hideList(); return; }

      items.forEach(u => {
        const item = document.createElement('div');
        item.className = 'suggest-item';
        item.textContent = `${u.name} (id: ${u.id})`;
        item.setAttribute('role', 'option');
        item.addEventListener('click', () => {
          addChip(u);
          input.value = '';
          hideList();
        });
        portalList.appendChild(item);
      });

      const rect = input.getBoundingClientRect();
      portalList.style.left = rect.left + 'px';
      portalList.style.top = rect.bottom + 'px';
      portalList.style.width = rect.width + 'px';
      portalList.style.display = 'block';
    };

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { hideList(); return; }
      const matches = users
        .filter(u => u.name.toLowerCase().includes(q) || String(u.id).includes(q))
        .slice(0, 10);
      showList(matches);
    });

    input.addEventListener('blur', () => setTimeout(hideList, 200));

    // Восстановление данных при редактировании
    if (data) {
      const entries = Object.entries(data);
      const recipientEntries = entries.filter(([k]) => k.startsWith('recipient_'));
      recipientEntries.forEach(([key, userId]) => {
        const idx = key.replace('recipient_', '');
        const amountKey = `amount_${idx}`;
        const amountVal = data[amountKey] || '';
        const user = users.find(u => String(u.id) === String(userId));
        if (user) addChip(user, amountVal);
      });
    }

    syncHiddenFields();
  };

  // === 5) Ждём USERS_LIST с таймаутом ===
  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderTransferPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

// ============================================================================
// SETUP CUSTOM GIFT FLOW - Индивидуальные подарки
// ============================================================================

export function setupCustomGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, giftPrice1, giftPrice5 }) {
  // Удаляем всё кроме дисклеймера
  modalFields.querySelectorAll('.gift-note, .muted-note, .note-error, .callout, [data-info], .field, .gift-groups')
    .forEach(el => el.remove());

  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = 'Пожалуйста, подождите...';
  // Вставляем после дисклеймера
  const disclaimer = modalFields.querySelector('.info');
  if (disclaimer) {
    disclaimer.insertAdjacentElement('afterend', waitNote);
  } else {
    modalFields.prepend(waitNote);
  }

  const hideWait = () => {
    const el = modalFields.querySelector('.admin-wait-note');
    if (el) el.remove();
  };

  const showError = (msg) => {
    hideWait();
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      err.style.color = 'var(--danger)';
      if (disclaimer) {
        disclaimer.insertAdjacentElement('afterend', err);
      } else {
        modalFields.prepend(err);
      }
    }
    err.textContent = msg || 'Произошла ошибка. Пожалуйста, обновите страницу.';
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Пожалуйста, обновите страницу.');
    cancel();
  };

  
  const updateTotalCost = (giftGroups) => {
    const totalCount = giftGroups.length;
    const price1 = Number.parseInt(giftPrice1, 10) || 100;

    if (modalAmount) {
      if (totalCount > 0) {
        updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(price1), bonus: '0' } }, { items: totalCount });
      } else {
        modalAmount.textContent = '';
      }
    }

    const totalCost = price1 * totalCount;
    return { totalCount, totalCost };
  };

  const renderCustomGiftPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'gift-groups';
    groupsContainer.setAttribute('data-gift-container', '');
    modalFields.appendChild(groupsContainer);

    const giftGroups = [];

    const syncHiddenFields = () => {
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="from_"], input[type="hidden"][name^="wish_"], input[type="hidden"][name^="gift_data_"], input[type="hidden"][name^="gift_id_"], input[type="hidden"][name^="gift_icon_"]')
        .forEach(n => n.remove());

      giftGroups.forEach((group, index) => {
        const i = index + 1;

        const hidR = document.createElement('input');
        hidR.type = 'hidden';
        hidR.name = `recipient_${i}`;
        hidR.value = String(group.recipientId);

        const hidFrom = document.createElement('input');
        hidFrom.type = 'hidden';
        hidFrom.name = `from_${i}`;
        hidFrom.value = group.fromInput.value.trim();

        const hidWish = document.createElement('input');
        hidWish.type = 'hidden';
        hidWish.name = `wish_${i}`;
        hidWish.value = group.wishInput.value.trim();

        const hidData = document.createElement('input');
        hidData.type = 'hidden';
        hidData.name = `gift_data_${i}`;
        hidData.value = group.giftDataInput.value.trim();

        const hidGiftId = document.createElement('input');
        hidGiftId.type = 'hidden';
        hidGiftId.name = `gift_id_${i}`;
        hidGiftId.value = giftId || '';

        const hidGiftIcon = document.createElement('input');
        hidGiftIcon.type = 'hidden';
        hidGiftIcon.name = `gift_icon_${i}`;
        hidGiftIcon.value = giftIcon || '';

        modalFields.append(hidR, hidFrom, hidWish, hidData, hidGiftId, hidGiftIcon);
      });

      const { totalCount } = updateTotalCost(giftGroups);
      const hasAny = totalCount > 0;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
    };

    const removeGroup = (group) => {
      const index = giftGroups.indexOf(group);
      if (index !== -1) {
        giftGroups.splice(index, 1);
        group.el.remove();
        syncHiddenFields();
      }
    };

    const createCustomGiftGroup = (prefillRecipientId = '', prefillFrom = '', prefillWish = '', prefillGiftData = '') => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'gift-group';
      groupDiv.setAttribute('data-gift-group', '');

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-extra gift-remove';
      removeBtn.setAttribute('data-gift-remove', '');
      removeBtn.setAttribute('aria-label', 'Удалить получателя');
      removeBtn.textContent = '×';
      removeBtn.disabled = giftGroups.length === 0;

      const recipientField = document.createElement('div');
      recipientField.className = 'field gift-field';
      recipientField.setAttribute('data-gift-label', 'recipient');

      const recipientLabel = document.createElement('label');
      recipientLabel.textContent = 'Получатель *';

      const recipientInput = document.createElement('input');
      recipientInput.type = 'text';
      recipientInput.required = true;
      recipientInput.placeholder = 'Начните вводить имя или id...';
      recipientInput.setAttribute('autocomplete', 'off');

      const suggestDiv = document.createElement('div');
      suggestDiv.className = 'suggest';
      suggestDiv.setAttribute('role', 'listbox');

      recipientField.appendChild(recipientLabel);
      recipientField.appendChild(recipientInput);

      const fromField = document.createElement('div');
      fromField.className = 'field gift-field';
      fromField.setAttribute('data-gift-label', 'from');

      const fromLabel = document.createElement('label');
      fromLabel.textContent = 'От кого';

      const fromInput = document.createElement('input');
      fromInput.type = 'text';
      fromInput.placeholder = 'От тайного поклонника';

      fromField.appendChild(fromLabel);
      fromField.appendChild(fromInput);

      const wishField = document.createElement('div');
      wishField.className = 'field gift-field';
      wishField.setAttribute('data-gift-label', 'wish');

      const wishLabel = document.createElement('label');
      wishLabel.textContent = 'Комментарий';

      const wishInput = document.createElement('input');
      wishInput.type = 'text';
      wishInput.placeholder = 'Например, с праздником!';

      wishField.appendChild(wishLabel);
      wishField.appendChild(wishInput);

      // Дополнительное поле "Данные для подарка"
      const giftDataField = document.createElement('div');
      giftDataField.className = 'field gift-field';
      giftDataField.setAttribute('data-gift-label', 'gift_data');

      const giftDataLabel = document.createElement('label');
      giftDataLabel.textContent = 'Данные для подарка *';

      const giftDataInput = document.createElement('textarea');
      giftDataInput.required = true;
      giftDataInput.placeholder = 'Ссылки на исходники (если есть) и/или комментарии, по которым мы сможем собрать подарок';
      giftDataInput.rows = 3;

      giftDataField.appendChild(giftDataLabel);
      giftDataField.appendChild(giftDataInput);

      groupDiv.appendChild(removeBtn);
      groupDiv.appendChild(recipientField);
      groupDiv.appendChild(fromField);
      groupDiv.appendChild(wishField);
      groupDiv.appendChild(giftDataField);

      groupsContainer.appendChild(groupDiv);

      const group = {
        el: groupDiv,
        recipientId: '',
        recipientInput,
        fromInput,
        wishInput,
        giftDataInput,
        suggestDiv
      };

      giftGroups.push(group);

      // Автокомплит (копия из setupGiftFlow)
      const portalList = suggestDiv;
      portalList.style.position = 'fixed';
      portalList.style.zIndex = '9999';
      let portalMounted = false;
      const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
      const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
      const positionPortal = () => {
        const r = recipientInput.getBoundingClientRect();
        portalList.style.left = `${r.left}px`;
        portalList.style.top  = `${r.bottom + 6}px`;
        portalList.style.width = `${r.width}px`;
      };
      const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
      const openSuggest  = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

      const buildItem = (u) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'suggest-item';
        item.setAttribute('role', 'option');
        item.textContent = `${u.name} (id: ${u.id})`;
        item.addEventListener('click', () => {
          recipientInput.value = `${u.name} (id: ${u.id})`;
          group.recipientId = u.id;
          recipientInput.setCustomValidity('');
          closeSuggest();
          syncHiddenFields();
          recipientInput.focus();
        });
        return item;
      };

      const norm = (s) => String(s ?? '').trim().toLowerCase();
      const doSearch = () => {
        const q = norm(recipientInput.value);
        portalList.innerHTML = '';
        if (!q) { closeSuggest(); return; }
        const res = users
          .filter(u => norm(u.name).includes(q) || String(u.id).includes(q))
          .slice(0, 20);
        if (!res.length) { closeSuggest(); return; }
        res.forEach(u => portalList.appendChild(buildItem(u)));
        openSuggest();
      };

      recipientInput.addEventListener('input', () => {
        group.recipientId = '';
        recipientInput.setCustomValidity('Выберите получателя из списка');
        doSearch();
      });
      recipientInput.addEventListener('focus', doSearch);

      document.addEventListener('click', (e) => {
        if (!recipientField.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
      });
      window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
      window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

      removeBtn.addEventListener('click', () => removeGroup(group));

      if (prefillRecipientId) {
        const user = users.find(u => String(u.id) === String(prefillRecipientId));
        if (user) {
          recipientInput.value = `${user.name} (id: ${user.id})`;
          group.recipientId = user.id;
          recipientInput.setCustomValidity('');
        }
      }
      if (prefillFrom) fromInput.value = prefillFrom;
      if (prefillWish) wishInput.value = prefillWish;
      if (prefillGiftData) giftDataInput.value = prefillGiftData;

      fromInput.addEventListener('input', syncHiddenFields);
      wishInput.addEventListener('input', syncHiddenFields);
      giftDataInput.addEventListener('input', syncHiddenFields);

      syncHiddenFields();
      return group;
    };

    const addMoreBtn = document.createElement('div');
    addMoreBtn.className = 'field';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = '+ Еще';
    btn.addEventListener('click', () => createCustomGiftGroup());
    addMoreBtn.appendChild(btn);
    modalFields.appendChild(addMoreBtn);

    if (data) {
      const entries = Object.entries(data);
      const recipientEntries = entries.filter(([k]) => k.startsWith('recipient_'));

      if (recipientEntries.length > 0) {
        recipientEntries.forEach(([key, userId]) => {
          const idx = key.replace('recipient_', '');
          const fromVal = data[`from_${idx}`] || '';
          const wishVal = data[`wish_${idx}`] || '';
          const giftDataVal = data[`gift_data_${idx}`] || '';
          createCustomGiftGroup(userId, fromVal, wishVal, giftDataVal);
        });
      } else {
        createCustomGiftGroup();
      }
    } else {
      createCustomGiftGroup();
    }
  };

  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderCustomGiftPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

// ============================================================================
// SETUP GIFT FLOW - Подарки
// ============================================================================

export function setupGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, giftPrice1, giftPrice5 }) {
  // === 1) Удаляем существующие поля формы ===
  modalFields.querySelectorAll('.info, .gift-note, .muted-note, .note-error, .callout, [data-info], .field, .gift-groups')
    .forEach(el => el.remove());

  // === 2) Показываем "Пожалуйста, подождите..." пока ждём USERS_LIST ===
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = 'Пожалуйста, подождите...';
  modalFields.prepend(waitNote);

  const hideWait = () => {
    const el = modalFields.querySelector('.admin-wait-note');
    if (el) el.remove();
  };

  const showError = (msg) => {
    hideWait();
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      err.style.color = 'var(--danger)';
      modalFields.prepend(err);
    }
    err.textContent = msg || 'Произошла ошибка. Пожалуйста, обновите страницу.';
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Пожалуйста, обновите страницу.');
    cancel();
  };

  // === 3) Функция подсчета стоимости подарков (простое умножение цена_1 × количество) ===
  const updateTotalCost = (giftGroups) => {
    const totalCount = giftGroups.length;
    const price1 = Number.parseInt(giftPrice1, 10) || 60;

    if (modalAmount) {
      if (totalCount > 0) {
        updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(price1), bonus: '0' } }, { items: totalCount });
      } else {
        modalAmount.textContent = '';
      }
    }

    const totalCost = price1 * totalCount;
    return { totalCount, totalCost };
  };

  // === 4) Когда USERS_LIST готов — рисуем интерфейс выбора получателей ===
  const renderGiftPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    // Превью подарка (иконка + ID)
    const preview = document.createElement('div');
    preview.className = 'preview';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon-prw';
    iconSpan.innerHTML = giftIcon || '';

    const idSpan = document.createElement('span');
    idSpan.style.fontWeight = '600';
    idSpan.textContent = `ID: ${giftId || ''}`;

    preview.append(iconSpan, idSpan);
    modalFields.appendChild(preview);

    // Контейнер для групп подарков
    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'gift-groups';
    groupsContainer.setAttribute('data-gift-container', '');
    modalFields.appendChild(groupsContainer);

    // Массив групп (получателей)
    const giftGroups = [];

    const syncHiddenFields = () => {
      // Очищаем предыдущие скрытые поля
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="from_"], input[type="hidden"][name^="wish_"], input[type="hidden"][name^="gift_id_"], input[type="hidden"][name^="gift_icon_"]')
        .forEach(n => n.remove());

      // Пересобираем для каждого получателя
      giftGroups.forEach((group, index) => {
        const i = index + 1;

        const hidR = document.createElement('input');
        hidR.type = 'hidden';
        hidR.name = `recipient_${i}`;
        hidR.value = String(group.recipientId);

        const hidFrom = document.createElement('input');
        hidFrom.type = 'hidden';
        hidFrom.name = `from_${i}`;
        hidFrom.value = group.fromInput.value.trim();

        const hidWish = document.createElement('input');
        hidWish.type = 'hidden';
        hidWish.name = `wish_${i}`;
        hidWish.value = group.wishInput.value.trim();

        const hidGiftId = document.createElement('input');
        hidGiftId.type = 'hidden';
        hidGiftId.name = `gift_id_${i}`;
        hidGiftId.value = giftId || '';

        const hidGiftIcon = document.createElement('input');
        hidGiftIcon.type = 'hidden';
        hidGiftIcon.name = `gift_icon_${i}`;
        hidGiftIcon.value = giftIcon || '';

        modalFields.append(hidR, hidFrom, hidWish, hidGiftId, hidGiftIcon);
      });

      const { totalCount } = updateTotalCost(giftGroups);
      const hasAny = totalCount > 0;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
    };

    const removeGroup = (group) => {
      const index = giftGroups.indexOf(group);
      if (index !== -1) {
        giftGroups.splice(index, 1);
        group.el.remove();
        syncHiddenFields();
      }
    };

    const createGiftGroup = (prefillRecipientId = '', prefillFrom = '', prefillWish = '') => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'gift-group';
      groupDiv.setAttribute('data-gift-group', '');

      // Кнопка удаления
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-extra gift-remove';
      removeBtn.setAttribute('data-gift-remove', '');
      removeBtn.setAttribute('aria-label', 'Удалить получателя');
      removeBtn.textContent = '×';
      removeBtn.disabled = giftGroups.length === 0; // Первая группа не удаляется

      // Поле "Получатель" с автокомплитом
      const recipientField = document.createElement('div');
      recipientField.className = 'field gift-field';
      recipientField.setAttribute('data-gift-label', 'recipient');

      const recipientLabel = document.createElement('label');
      recipientLabel.textContent = 'Получатель *';

      const recipientInput = document.createElement('input');
      recipientInput.type = 'text';
      recipientInput.required = true;
      recipientInput.placeholder = 'Начните вводить имя или id...';
      recipientInput.setAttribute('autocomplete', 'off');

      const suggestDiv = document.createElement('div');
      suggestDiv.className = 'suggest';
      suggestDiv.setAttribute('role', 'listbox');

      recipientField.appendChild(recipientLabel);
      recipientField.appendChild(recipientInput);

      // Поле "От кого"
      const fromField = document.createElement('div');
      fromField.className = 'field gift-field';
      fromField.setAttribute('data-gift-label', 'from');

      const fromLabel = document.createElement('label');
      fromLabel.textContent = 'От кого';

      const fromInput = document.createElement('input');
      fromInput.type = 'text';
      fromInput.placeholder = 'От тайного поклонника';

      fromField.appendChild(fromLabel);
      fromField.appendChild(fromInput);

      // Поле "Комментарий"
      const wishField = document.createElement('div');
      wishField.className = 'field gift-field';
      wishField.setAttribute('data-gift-label', 'wish');

      const wishLabel = document.createElement('label');
      wishLabel.textContent = 'Комментарий';

      const wishInput = document.createElement('input');
      wishInput.type = 'text';
      wishInput.placeholder = 'Например, с праздником!';

      wishField.appendChild(wishLabel);
      wishField.appendChild(wishInput);

      // Собираем группу
      groupDiv.appendChild(removeBtn);
      groupDiv.appendChild(recipientField);
      groupDiv.appendChild(fromField);
      groupDiv.appendChild(wishField);

      groupsContainer.appendChild(groupDiv);

      // Объект группы
      const group = {
        el: groupDiv,
        recipientId: '',
        recipientInput,
        fromInput,
        wishInput,
        suggestDiv
      };

      giftGroups.push(group);

      // Автокомплит для получателя (portal approach)
      const portalList = suggestDiv;
      portalList.style.position = 'fixed';
      portalList.style.zIndex = '9999';
      let portalMounted = false;
      const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
      const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
      const positionPortal = () => {
        const r = recipientInput.getBoundingClientRect();
        portalList.style.left = `${r.left}px`;
        portalList.style.top  = `${r.bottom + 6}px`;
        portalList.style.width = `${r.width}px`;
      };
      const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
      const openSuggest  = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

      const buildItem = (u) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'suggest-item';
        item.setAttribute('role', 'option');
        item.textContent = `${u.name} (id: ${u.id})`;
        item.addEventListener('click', () => {
          recipientInput.value = `${u.name} (id: ${u.id})`;
          group.recipientId = u.id;
          recipientInput.setCustomValidity('');
          closeSuggest();
          syncHiddenFields();
          recipientInput.focus();
        });
        return item;
      };

      const norm = (s) => String(s ?? '').trim().toLowerCase();
      const doSearch = () => {
        const q = norm(recipientInput.value);
        portalList.innerHTML = '';
        if (!q) { closeSuggest(); return; }
        const res = users
          .filter(u => norm(u.name).includes(q) || String(u.id).includes(q))
          .slice(0, 20);
        if (!res.length) { closeSuggest(); return; }
        res.forEach(u => portalList.appendChild(buildItem(u)));
        openSuggest();
      };

      recipientInput.addEventListener('input', () => {
        group.recipientId = '';
        recipientInput.setCustomValidity('Выберите получателя из списка');
        doSearch();
      });
      recipientInput.addEventListener('focus', doSearch);

      document.addEventListener('click', (e) => {
        if (!recipientField.contains(e.target) && !portalList.contains(e.target)) closeSuggest();
      });
      window.addEventListener('scroll', () => { if (portalList.style.display === 'block') positionPortal(); }, true);
      window.addEventListener('resize', () => { if (portalList.style.display === 'block') positionPortal(); });

      // Обработчик кнопки удаления
      removeBtn.addEventListener('click', () => removeGroup(group));

      // Prefill
      if (prefillRecipientId) {
        const user = users.find(u => String(u.id) === String(prefillRecipientId));
        if (user) {
          recipientInput.value = `${user.name} (id: ${user.id})`;
          group.recipientId = user.id;
          recipientInput.setCustomValidity('');
        }
      }
      if (prefillFrom) fromInput.value = prefillFrom;
      if (prefillWish) wishInput.value = prefillWish;

      fromInput.addEventListener('input', syncHiddenFields);
      wishInput.addEventListener('input', syncHiddenFields);

      syncHiddenFields();
      return group;
    };

    // Кнопка "+ Еще"
    const addMoreBtn = document.createElement('div');
    addMoreBtn.className = 'field';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = '+ Еще';
    btn.addEventListener('click', () => createGiftGroup());
    addMoreBtn.appendChild(btn);
    modalFields.appendChild(addMoreBtn);

    // Восстановление данных при редактировании
    if (data) {
      const entries = Object.entries(data);
      const recipientEntries = entries.filter(([k]) => k.startsWith('recipient_'));

      if (recipientEntries.length > 0) {
        recipientEntries.forEach(([key, userId]) => {
          const idx = key.replace('recipient_', '');
          const fromVal = data[`from_${idx}`] || '';
          const wishVal = data[`wish_${idx}`] || '';
          createGiftGroup(userId, fromVal, wishVal);
        });
      } else {
        // Создаем одну пустую группу
        createGiftGroup();
      }
    } else {
      // Создаем одну пустую группу
      createGiftGroup();
    }
  };

  // === 5) Ждём USERS_LIST с таймаутом ===
  const to = setTimeout(fail, timeoutMs);
  const poll = setInterval(() => {
    if (typeof window.USERS_LIST !== 'undefined' && !Array.isArray(window.USERS_LIST)) { fail(); return; }
    if (Array.isArray(window.USERS_LIST)) {
      clearTimeout(to);
      clearInterval(poll);
      renderGiftPicker(window.USERS_LIST);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}

// ============================================================================
// OPEN MODAL
// ============================================================================

// ============================================================================
// SETUP BONUS/MASK/CLEAN FLOW - Бонусы, Маска, Жилет
// ============================================================================

export function setupBonusMaskCleanFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, basePrice }) {
  // === 1) Удаляем существующие поля формы ===
  modalFields.querySelectorAll('.info, .gift-note, .muted-note, .note-error, .callout, [data-info], .field, .gift-groups')
    .forEach(el => el.remove());

  const disclaimer = document.createElement('div');
  disclaimer.className = 'info';
  disclaimer.textContent = 'Можете выбрать себя или другого игрока';
  modalFields.insertBefore(disclaimer, modalFields.firstChild);

  // === 2) Показываем "Пожалуйста, подождите..." пока ждём USERS_LIST ===
  const waitNote = document.createElement('p');
  waitNote.className = 'muted-note admin-wait-note';
  waitNote.textContent = 'Пожалуйста, подождите...';
  modalFields.appendChild(waitNote);

  const hideWait = () => {
    const el = modalFields.querySelector('.admin-wait-note');
    if (el) el.remove();
  };

  const showError = (msg) => {
    hideWait();
    let err = modalFields.querySelector('.note-error.admin-error');
    if (!err) {
      err = document.createElement('p');
      err.className = 'note-error admin-error';
      err.style.color = 'var(--danger)';
      disclaimer.insertAdjacentElement('afterend', err);
    }
    err.textContent = msg || 'Произошла ошибка. Пожалуйста, обновите страницу.';
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
  };

  let canceled = false;
  const cancel = () => { canceled = true; };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Пожалуйста, обновите страницу.');
    cancel();
  };

  const renderPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    const groupsContainer = document.createElement('div');
    groupsContainer.className = 'gift-groups';
    groupsContainer.setAttribute('data-gift-container', '');
    modalFields.appendChild(groupsContainer);

    const itemGroups = [];
    let groupCounter = 0;
    const price = Number.parseInt(basePrice, 10) || 0;

    // Показываем базовую цену сразу
    if (modalAmount) {
      modalAmount.textContent = formatNumber(price);
    }

    const syncHiddenFields = () => {
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="from_"], input[type="hidden"][name^="wish_"], input[type="hidden"][name^="quantity_"]')
        .forEach(n => n.remove());

      let totalQuantity = 0;
      itemGroups.forEach((group, index) => {
        if (!group.recipientId) return;
        const i = index + 1;
        const qty = Number(group.quantityInput.value) || 0;
        if (qty <= 0) return;

        const hidR = document.createElement('input');
        hidR.type = 'hidden';
        hidR.name = `recipient_${i}`;
        hidR.value = String(group.recipientId);

        const hidFrom = document.createElement('input');
        hidFrom.type = 'hidden';
        hidFrom.name = `from_${i}`;
        hidFrom.value = group.fromInput.value.trim();

        const hidWish = document.createElement('input');
        hidWish.type = 'hidden';
        hidWish.name = `wish_${i}`;
        hidWish.value = group.wishInput.value.trim();

        const hidQty = document.createElement('input');
        hidQty.type = 'hidden';
        hidQty.name = `quantity_${i}`;
        hidQty.value = String(qty);

        modalFields.append(hidR, hidFrom, hidWish, hidQty);
        totalQuantity += qty;
      });

      if (modalAmount) {
        if (totalQuantity > 0) {
          updateModalAmount(modalAmount, { dataset: { mode: 'price_per_item', price: String(price), bonus: '0' } }, { items: totalQuantity });
        } else {
          // Показываем базовую цену даже когда нет получателей
          modalAmount.textContent = formatNumber(price);
        }
      }

      const hasAny = totalQuantity > 0;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
    };

    const removeGroup = (group) => {
      const idx = itemGroups.indexOf(group);
      if (idx > -1) itemGroups.splice(idx, 1);
      if (group.el) group.el.remove();
      updateRemoveButtons();
      syncHiddenFields();
    };

    const updateRemoveButtons = () => {
      const allRemoveBtns = groupsContainer.querySelectorAll('.gift-remove');
      allRemoveBtns.forEach((btn, i) => {
        btn.disabled = i === 0;
      });
    };

    const createGroup = (prefillUser = null, prefillQty = '1', prefillFrom = '', prefillWish = '') => {
      groupCounter++;
      const idx = groupCounter;
      const isFirst = itemGroups.length === 0;

      const groupDiv = document.createElement('div');
      groupDiv.className = 'gift-group';
      groupDiv.setAttribute('data-gift-group', '');

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-extra gift-remove';
      removeBtn.setAttribute('data-gift-remove', '');
      removeBtn.setAttribute('aria-label', 'Удалить получателя');
      removeBtn.textContent = '×';
      removeBtn.disabled = isFirst;

      // Получатель с автокомплитом
      const recipientField = document.createElement('div');
      recipientField.className = 'field gift-field anketa-combobox';
      recipientField.setAttribute('data-gift-label', 'recipient');

      const recipientLabel = document.createElement('label');
      recipientLabel.setAttribute('for', `bonus-recipient-${idx}`);
      recipientLabel.textContent = 'Получатель *';

      const comboDiv = document.createElement('div');
      comboDiv.className = 'combo';

      const recipientInput = document.createElement('input');
      recipientInput.id = `bonus-recipient-${idx}`;
      recipientInput.setAttribute('data-gift-recipient', '');
      recipientInput.type = 'text';
      recipientInput.placeholder = 'Начните вводить имя или id...';
      recipientInput.required = true;
      recipientInput.setAttribute('autocomplete', 'off');
      if (prefillUser) {
        recipientInput.value = `${prefillUser.name} (id: ${prefillUser.id})`;
      }

      const suggestDiv = document.createElement('div');
      suggestDiv.className = 'suggest';
      suggestDiv.setAttribute('role', 'listbox');
      suggestDiv.style.display = 'none';

      comboDiv.append(recipientInput, suggestDiv);
      recipientField.append(recipientLabel, comboDiv);

      // Количество
      const quantityField = document.createElement('div');
      quantityField.className = 'field gift-field';
      const qtyLabel = document.createElement('label');
      qtyLabel.setAttribute('for', `bonus-quantity-${idx}`);
      qtyLabel.textContent = 'Количество *';
      const qtyInput = document.createElement('input');
      qtyInput.id = `bonus-quantity-${idx}`;
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.value = prefillQty;
      qtyInput.required = true;
      quantityField.append(qtyLabel, qtyInput);

      // От кого
      const fromField = document.createElement('div');
      fromField.className = 'field gift-field';
      fromField.setAttribute('data-gift-label', 'from');
      const fromLabel = document.createElement('label');
      fromLabel.setAttribute('for', `bonus-from-${idx}`);
      fromLabel.textContent = 'От кого';
      const fromInput = document.createElement('input');
      fromInput.id = `bonus-from-${idx}`;
      fromInput.setAttribute('data-gift-from', '');
      fromInput.type = 'text';
      fromInput.value = prefillFrom;
      fromInput.placeholder = 'От ...';
      fromField.append(fromLabel, fromInput);

      // Комментарий
      const wishField = document.createElement('div');
      wishField.className = 'field gift-field';
      wishField.setAttribute('data-gift-label', 'wish');
      const wishLabel = document.createElement('label');
      wishLabel.setAttribute('for', `bonus-wish-${idx}`);
      wishLabel.textContent = 'Комментарий';
      const wishInput = document.createElement('input');
      wishInput.id = `bonus-wish-${idx}`;
      wishInput.setAttribute('data-gift-wish', '');
      wishInput.type = 'text';
      wishInput.value = prefillWish;
      wishInput.placeholder = 'Комментарий';
      wishField.append(wishLabel, wishInput);

      groupDiv.append(removeBtn, recipientField, quantityField, fromField, wishField);
      groupsContainer.appendChild(groupDiv);

      const group = {
        el: groupDiv,
        recipientId: prefillUser ? prefillUser.id : '',
        recipientInput,
        quantityInput: qtyInput,
        fromInput,
        wishInput,
        suggestDiv
      };

      itemGroups.push(group);

      // Автокомплит
      const portalList = suggestDiv;
      portalList.style.position = 'fixed';
      portalList.style.zIndex = '9999';
      let portalMounted = false;
      const mountPortal = () => { if (!portalMounted) { document.body.appendChild(portalList); portalMounted = true; } };
      const unmountPortal = () => { if (portalMounted) { portalList.remove(); portalMounted = false; } };
      const positionPortal = () => {
        const r = recipientInput.getBoundingClientRect();
        portalList.style.left = `${r.left}px`;
        portalList.style.top = `${r.bottom + 6}px`;
        portalList.style.width = `${r.width}px`;
      };
      const closeSuggest = () => { portalList.style.display = 'none'; unmountPortal(); };
      const openSuggest = () => { mountPortal(); positionPortal(); portalList.style.display = 'block'; };

      const buildItem = (u) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'suggest-item';
        item.setAttribute('role', 'option');
        item.textContent = `${u.name} (id: ${u.id})`;
        item.addEventListener('click', () => {
          recipientInput.value = `${u.name} (id: ${u.id})`;
          group.recipientId = u.id;
          recipientInput.setCustomValidity('');
          closeSuggest();
          syncHiddenFields();
        });
        return item;
      };

      const norm = (s) => String(s ?? '').trim().toLowerCase();
      const doSearch = () => {
        const q = norm(recipientInput.value);
        portalList.innerHTML = '';

        if (!q) {
          closeSuggest();
          return;
        }

        const alreadyAdded = itemGroups.map(g => String(g.recipientId)).filter(Boolean);
        const matches = users.filter(u =>
          !alreadyAdded.includes(String(u.id)) &&
          (norm(u.name).includes(q) || String(u.id).includes(q))
        ).slice(0, 10);

        if (matches.length === 0) {
          closeSuggest();
          return;
        }

        matches.forEach(u => portalList.appendChild(buildItem(u)));
        openSuggest();
      };

      recipientInput.addEventListener('input', () => {
        group.recipientId = '';
        doSearch();
        syncHiddenFields();
      });
      recipientInput.addEventListener('focus', doSearch);
      recipientInput.addEventListener('blur', () => setTimeout(closeSuggest, 200));

      qtyInput.addEventListener('input', syncHiddenFields);
      fromInput.addEventListener('input', syncHiddenFields);
      wishInput.addEventListener('input', syncHiddenFields);
      removeBtn.addEventListener('click', () => removeGroup(group));

      updateRemoveButtons();
      syncHiddenFields();
      return group;
    };

    // Кнопка "+ Еще"
    const addMoreBtn = document.createElement('button');
    addMoreBtn.type = 'button';
    addMoreBtn.className = 'btn';
    addMoreBtn.textContent = '+ Еще';
    addMoreBtn.setAttribute('data-add-gift-group', '');
    addMoreBtn.addEventListener('click', () => {
      createGroup();
    });

    const addMoreField = document.createElement('div');
    addMoreField.className = 'field';
    addMoreField.appendChild(addMoreBtn);
    modalFields.appendChild(addMoreField);

    // Восстановление данных при редактировании или создание первой группы
    if (data && typeof data === 'object') {
      const recipientKeys = Object.keys(data)
        .filter(k => /^recipient_\d+$/.test(k))
        .map(k => k.match(/^recipient_(\d+)$/)[1])
        .sort((a, b) => Number(a) - Number(b));

      if (recipientKeys.length > 0) {
        recipientKeys.forEach((idx) => {
          const rid = String(data[`recipient_${idx}`] ?? '').trim();
          if (!rid) return;
          const user = users.find(u => String(u.id) === rid);
          if (!user) return;

          const qty = String(data[`quantity_${idx}`] ?? '1');
          const from = String(data[`from_${idx}`] ?? '');
          const wish = String(data[`wish_${idx}`] ?? '');

          createGroup(user, qty, from, wish);
        });
      } else {
        // Создаём первую пустую группу
        createGroup();
      }
    } else {
      // При создании новой записи создаём первую пустую группу
      createGroup();
    }

    syncHiddenFields();
  };

  // === 3) Ждём USERS_LIST ===
  let counter = 0;
  const poll = setInterval(() => {
    if (canceled) return;
    if (window.USERS_LIST && Array.isArray(window.USERS_LIST)) {
      clearInterval(poll);
      clearTimeout(to);
      renderPicker(window.USERS_LIST);
    } else {
      counter++;
    }
  }, 100);

  const to = setTimeout(() => {
    if (!canceled) {
      clearInterval(poll);
      fail();
    }
  }, timeoutMs);

  return counterWatcher;
}

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
    giftPrice1,
    giftPrice5,
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
  form.dataset.giftPrice1 = giftPrice1 || '';
  form.dataset.giftPrice5 = giftPrice5 || '';
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

// === Баннер FMV в подписи на Рено ===
if (
  template.id === 'form-income-banner-reno' &&
  typeof window.BANNER_RENO_FLAG !== 'undefined' &&
  window.BANNER_RENO_FLAG === false
) {
  // заменяем содержимое формы на текст
  modalFields.innerHTML = '<p><strong>Начисление за баннер на Рено уже производилось.</strong></p>';

  // скрываем кнопку "Сохранить", как у info-модалок
  btnSubmit.style.display = 'none';
}

// === Баннер FMV в подписи на Маяке ===
if (
  template.id === 'form-income-banner-mayak' &&
  typeof window.BANNER_MAYAK_FLAG !== 'undefined' &&
  window.BANNER_MAYAK_FLAG === false
) {
  modalTitle.textContent = 'Баннер FMV в подписи на Маяке';
  modalFields.innerHTML = '<p><strong>Начисление за баннер на Маяке уже производилось.</strong></p>';
  btnSubmit.style.display = 'none';

  backdrop.setAttribute('open', '');
  return { counterWatcher };
}


// === ANKETA (за приём анкеты): режимы для админа/не админа ===
if (template.id === 'form-income-anketa') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none';
  } else {
    counterWatcher = setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: FORM_TIMEOUT_MS, data, modalAmount, basePrice: price });
  }
}

// === AKCION: «Взятие акционного персонажа» — поведение как у анкеты ===
if (template.id === 'form-income-akcion') {
  if (!window.IS_ADMIN) {
    // не админ — просто инфо-окно (кнопка скрыта уже через data-info)
    btnSubmit.style.display = 'none';
  } else {
    // админ — тот же выбор получателей, как у анкеты
    counterWatcher = setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: PROMO_TIMEOUT_MS, data, modalAmount, basePrice: price });
  }
}

// === NEEDCHAR: «Взятие нужного персонажа» — поведение как у анкеты ===
if (template.id === 'form-income-needchar') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none';
  } else {
    counterWatcher = setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: NEEDED_TIMEOUT_MS, data, modalAmount, basePrice: price });
  }
}

// === TOPUP: «Докупить кредиты» — как анкета, но на каждого указываем сумму
if (template.id === 'form-income-topup') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none'; // инфо-режим (data-info)
  } else {
    counterWatcher = setupAdminTopupFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: TOPUP_TIMEOUT_MS, data, modalAmount, basePrice: price });
  }
}

// === AMS: «Выдать денежку дополнительно» — как докупка, но на каждого указываем сумму и комментарий
if (template.id === 'form-income-ams') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none'; // инфо-режим (data-info)
  } else {
    counterWatcher = setupAdminTopupFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: AMS_TIMEOUT_MS, data, requireComment: true, modalAmount, basePrice: price });
  }
}

// === BONUSES, MASK, CLEAN: выбор получателя + количество + от кого + комментарий
const bonusMaskCleanForms = [
  'form-exp-bonus1d1', 'form-exp-bonus2d1',
  'form-exp-bonus1w1', 'form-exp-bonus2w1',
  'form-exp-bonus1m1', 'form-exp-bonus2m1',
  'form-exp-bonus1m3', 'form-exp-bonus2m3',
  'form-exp-mask', 'form-exp-clean'
];
if (bonusMaskCleanForms.includes(template.id)) {
  counterWatcher = setupBonusMaskCleanFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: AMS_TIMEOUT_MS, data, modalAmount, basePrice: price });
}

// === TRANSFER: «Перевод средств другому (комиссия)» — выбор пользователей + сумма с комиссией 10 галлеонов за каждого
if (template.id === 'form-exp-transfer') {
  counterWatcher = setupTransferFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: TRANSFER_TIMEOUT_MS, data, modalAmount, basePrice: price });
}

// === GIFT: «Подарить подарок» — выбор пользователей с опциональными полями "от кого" и "комментарий"
if (template.id === 'form-gift-custom') {
  counterWatcher = setupCustomGiftFlow({
    modalFields, btnSubmit, counterWatcher,
    timeoutMs: GIFT_TIMEOUT_MS, data, modalAmount,
    giftId: config.giftId,
    giftIcon: config.giftIcon,
    giftPrice1: config.giftPrice1,
    giftPrice5: config.giftPrice5
  });
}

if (template.id === 'form-gift-present') {
  counterWatcher = setupGiftFlow({
    modalFields, btnSubmit, counterWatcher,
    timeoutMs: GIFT_TIMEOUT_MS, data, modalAmount,
    giftId: config.giftId,
    giftIcon: config.giftIcon,
    giftPrice1: config.giftPrice1,
    giftPrice5: config.giftPrice5
  });
}

// === DESIGN: Оформление (иконки, плашки, фоны) — как подарки ===
const designForms = ['form-icon-custom', 'form-icon-present', 'form-badge-custom', 'form-badge-present', 'form-bg-custom', 'form-bg-present'];
if (designForms.includes(template.id)) {
  const isCustom = template.id.includes('custom');
  counterWatcher = isCustom
    ? setupCustomGiftFlow({
        modalFields, btnSubmit, counterWatcher,
        timeoutMs: GIFT_TIMEOUT_MS, data, modalAmount,
        giftId: config.giftId,
        giftIcon: config.giftIcon,
        giftPrice1: config.giftPrice1,
        giftPrice5: config.giftPrice5
      })
    : setupGiftFlow({
        modalFields, btnSubmit, counterWatcher,
        timeoutMs: GIFT_TIMEOUT_MS, data, modalAmount,
        giftId: config.giftId,
        giftIcon: config.giftIcon,
        giftPrice1: config.giftPrice1,
        giftPrice5: config.giftPrice5
      });
}

// === BEST-EPISODE: «Эпизод полумесяца» — поведение как у анкеты ===
if (template.id === 'form-income-episode-of') {
  if (!window.IS_ADMIN) {
    // не админ — просто инфо-окно (submit скрыт за счёт data-info)
    btnSubmit.style.display = 'none';
  } else {
    // админ — тот же выбор получателей, как у анкеты
    counterWatcher = setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: BEST_EPISODE_TIMEOUT_MS, data, modalAmount, basePrice: price });
  }
}

// === BEST-POST: «Пост полумесяца» — как «Эпизод полумесяца», но один получатель ===
if (template.id === 'form-income-post-of') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none'; // инфо-окно для не-админов (data-info)
  } else {
    counterWatcher = setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: BEST_POST_TIMEOUT_MS, data, modalAmount, basePrice: price });
  }
}

// === BEST-WRITER: «Постописец полумесяца» — как «Пост полумесяца», 1 получатель
if (template.id === 'form-income-writer') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none'; // инфо-окно
  } else {
    counterWatcher = setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: BEST_WRITER_TIMEOUT_MS, data, modalAmount, basePrice: price });
  }
}

// === BEST-ACTIVIST: «Активист полумесяца» — как «Пост полумесяца», 1 получатель
if (template.id === 'form-income-activist') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none';
  } else {
    counterWatcher = setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: BEST_ACTIVIST_TIMEOUT_MS, data, modalAmount, basePrice: price });
  }
}


// === FIRST POST: ждём FIRST_POST_FLAG, PLOT_POSTS и PERSONAL_POSTS ===
if (template.id === 'form-income-firstpost') {
  // якорь "подождите..."
  const waitEl = updateNote(modalFields, 'Пожалуйста, подождите...');

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


// === PERSONAL POST: ждём PERSONAL_POSTS и рендерим список ===
if (template.id === 'form-income-personalpost') {
  // 1) Сначала создаём "Пожалуйста, подождите..." и держим ссылку на элемент
  const waitEl = updateNote(modalFields, 'Пожалуйста, подождите...');

  // 2) Теперь формируем блок "Система подсчета" и вставляем его ПЕРЕД waitEl
  (() => {
    const price = Number(form.dataset.price) || 5;
    const bonus = Number(form.dataset.bonus) || 10;

    const info = document.createElement('div');
    info.className = 'calc-info';
    info.innerHTML =
      `<strong>Система подсчета:</strong><br>
      — фиксированная выплата за пост — ${price},<br>
      — дополнительная выплата за каждую тысячу символов в посте — ${bonus}.`;

    if (waitEl && waitEl.parentNode) {
      waitEl.parentNode.insertBefore(info, waitEl); // ← вставляем строго над "подождите"
    } else {
      modalFields.appendChild(info); // запасной вариант
    }
  })();

  // вытаскиваем {src, text, symbols_num} (поддерживаем вложенные словари link/a)
  const pickItem = (it) => {
    const d = (it && (it.link || it.a || it)) || it || null;
    const src = d && typeof d.src === 'string' ? d.src : null;
    const text = d && (d.text || src);
    const symbols = Number.isFinite(d?.symbols_num) ? d.symbols_num : (parseInt(d?.symbols_num, 10) || 0);
    return src ? { src, text, symbols_num: Math.max(0, symbols) } : null;
  };

  // таймеры ожидания
  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const setSummary = (count, thousandsSum) => {
    modalAmountLabel.textContent = form.dataset.amountLabel || 'Начисление';
    updateModalAmount(modalAmount, form, {
      items: count,
      additional_items: thousandsSum
    });
  };

  const fail = () => {
    if (canceled) return;
    updateNote(modalFields, 'Произошла ошибка. Попробуйте обновить страницу.', { error: true });
    // прячем кнопку — это info-форма
    btnSubmit.style.display = 'none';
    setHiddenField(modalFields, 'personal_posts_json', '');
    cancel();
  };

  const succeed = (posts) => {
    if (canceled) return;

    // пустой массив → сообщение и НЕТ кнопки «Сохранить»
    if (!Array.isArray(posts) || posts.length === 0) {
      updateNote(modalFields, '**Для новых начислений не хватает новых постов.**');
      btnSubmit.style.display = 'none';
      setHiddenField(modalFields, 'personal_posts_json', '');
      setSummary(0, 0);
      cancel();
      return;
    }

    // нормальный случай
    const items = posts.map(pickItem).filter(Boolean);
    setHiddenField(modalFields, 'personal_posts_json', JSON.stringify(items));

    // предпросмотр списка (вертикальный скролл)
    const note = updateNote(modalFields, '');
    if (note) note.remove();

    // Заголовок над списком
    const caption = document.createElement('p');
    caption.className = 'list-caption';
    caption.innerHTML = '<strong>Список постов:</strong>';
    modalFields.appendChild(caption);

    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `
      <div style="max-height:320px; overflow:auto">
        <ol class="entry-list" id="personal-preview"></ol>
      </div>`;
    modalFields.appendChild(wrap);

    const ol = wrap.querySelector('#personal-preview');
    items.forEach(({ src, text, symbols_num }) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = src;
      a.textContent = text || src;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);
      const note = document.createTextNode(` [${symbols_num} символов]`);
      li.appendChild(note);
      ol.appendChild(li);
    });

    // сумма «тысяч» = Σ floor(symbols_num / 1000)
    const thousandsSum = items.reduce((s, it) => s + Math.floor(it.symbols_num / 1000), 0);

    // показываем формулу «фикс x count + надбавка x Σтысяч»
    setSummary(items.length, thousandsSum);

    // для единообразия сохраним множитель (может пригодиться дальше)
    form.dataset.currentMultiplier = String(items.length);

    // если всё успешно — показываем кнопку "Сохранить"
    btnSubmit.style.display = '';
    btnSubmit.disabled = false;

    // завершаем наблюдатель
    cancel();

  };

  // ждём PERSONAL_POSTS не дольше 3 минут
  const to = setTimeout(fail, PERSONAL_TIMEOUT_MS);
  const poll = setInterval(() => {
    if (typeof window.PERSONAL_POSTS !== 'undefined' && !Array.isArray(window.PERSONAL_POSTS)) {
      fail(); return;
    }
    if (Array.isArray(window.PERSONAL_POSTS)) {
      clearTimeout(to); clearInterval(poll);
      succeed(window.PERSONAL_POSTS);
    }
  }, 500);
}

// === PLOT POST: ждём PLOT_POSTS и рендерим список (кап 3к на пост) ===
if (template.id === 'form-income-plotpost') {
  // якорь "подождите..."
  const waitEl = updateNote(modalFields, 'Пожалуйста, подождите...');

  // Пояснение «Система подсчёта»
  (() => {
    const price = Number(form.dataset.price) || 20;
    const bonus = Number(form.dataset.bonus) || 5;

    const info = document.createElement('div');
    info.className = 'calc-info';
    info.innerHTML =
      `<strong>Система подсчета:</strong><br>
      — фиксированная выплата за пост — ${price},<br>
      — дополнительная выплата за каждую тысячу символов в посте (но не более, чем за три тысячи) — ${bonus}.`;

    if (waitEl && waitEl.parentNode) {
      waitEl.parentNode.insertBefore(info, waitEl);
    } else {
      modalFields.appendChild(info);
    }
  })();

  // извлекаем {src, text, symbols_num}
  const pickItem = (it) => {
    const d = (it && (it.link || it.a || it)) || it || null;
    const src = d && typeof d.src === 'string' ? d.src : null;
    const text = d && (d.text || src);
    const symbols = Number.isFinite(d?.symbols_num) ? d.symbols_num : (parseInt(d?.symbols_num, 10) || 0);
    return src ? { src, text, symbols_num: Math.max(0, symbols) } : null;
  };

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const setSummary = (count, thousandsSumCapped) => {
    modalAmountLabel.textContent = form.dataset.amountLabel || 'Начисление';
    updateModalAmount(modalAmount, form, {
      items: count,
      additional_items: thousandsSumCapped
    });
  };

  const fail = () => {
    if (canceled) return;
    updateNote(modalFields, 'Произошла ошибка. Попробуйте обновить страницу.', { error: true });
    btnSubmit.style.display = 'none';
    setHiddenField(modalFields, 'plot_posts_json', '');
    cancel();
  };

  const succeed = (posts) => {
    if (canceled) return;

    // пустой массив → сообщение и НЕТ кнопки «Сохранить»
    if (!Array.isArray(posts) || posts.length === 0) {
      updateNote(modalFields, '**Для новых начислений не хватает новых постов.**');
      btnSubmit.style.display = 'none';
      setHiddenField(modalFields, 'plot_posts_json', '');
      setSummary(0, 0);
      cancel();
      return;
    }

    // нормальный случай
    const items = posts.map(pickItem).filter(Boolean);
    setHiddenField(modalFields, 'plot_posts_json', JSON.stringify(items));

    // убираем «подождите…»
    const n = updateNote(modalFields, '');
    if (n) n.remove();

    // Заголовок «Список постов:»
    const caption = document.createElement('p');
    caption.className = 'list-caption';
    caption.innerHTML = '<strong>Список постов:</strong>';
    modalFields.appendChild(caption);

    // список со скроллом
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `
      <div style="max-height:320px; overflow:auto">
        <ol class="entry-list" id="plot-preview"></ol>
      </div>`;
    modalFields.appendChild(wrap);

    const ol = wrap.querySelector('#plot-preview');
    items.forEach(({ src, text, symbols_num }) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = src; a.textContent = text || src;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      li.appendChild(a);
      li.appendChild(document.createTextNode(` [${symbols_num} символов]`));
      ol.appendChild(li);
    });

    // Σ min(floor(symbols/1000), 3) по постам
    const thousandsSumCapped = items.reduce((s, it) => {
      const k = Math.floor(it.symbols_num / 1000);
      return s + Math.min(Math.max(0, k), 3);
    }, 0);

    // формула
    setSummary(items.length, thousandsSumCapped);

    form.dataset.currentMultiplier = String(items.length);
    btnSubmit.style.display = '';
    btnSubmit.disabled = false;
    cancel();
  };

  // ждём PLOT_POSTS не дольше 3 минут (используем уже заданный таймаут)
  const to = setTimeout(fail, PLOT_TIMEOUT_MS);
  const poll = setInterval(() => {
    if (typeof window.PLOT_POSTS !== 'undefined' && !Array.isArray(window.PLOT_POSTS)) { fail(); return; }
    if (Array.isArray(window.PLOT_POSTS)) {
      clearTimeout(to); clearInterval(poll);
      succeed(window.PLOT_POSTS);
    }
  }, 500);
}

  // === FLYER: ждём ADS_POSTS и рисуем список ===
if (template.id === 'form-income-flyer') {
  // показываем «ждём…» (у вас уже есть <p class="muted-note">Пожалуйста, подождите...</p>)
  updateNote(modalFields, 'Пожалуйста, подождите...');

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

  const isNeedRequest = template.id === 'form-income-needrequest';
  const isRpgTop      = template.id === 'form-income-rpgtop';
  const isEpPersonal  = template.id === 'form-income-ep-personal';
  const isEpPlot      = template.id === 'form-income-ep-plot';
  const isContest     = template.id === 'form-income-contest';
  const isAvatar      = template.id === 'form-income-avatar';
  const isDesignOther = template.id === 'form-income-design-other';
  const isRunContest  = template.id === 'form-income-run-contest';
  const isMastering   = template.id === 'form-income-mastering';

  if (isNeedRequest || isRpgTop || isEpPersonal || isEpPlot) {
    const grid = modalFields.querySelector('.grid-2');
    if (grid) grid.classList.remove('grid-2');
  }


  const scrollContainer = modalFields.parentElement;
  const addExtraBtn = modalFields.querySelector('[data-add-extra]');
  const giftContainer = modalFields.querySelector('[data-gift-container]');
  const giftAddBtn = modalFields.querySelector('[data-add-gift-group]');
  const giftTemplateGroup = giftContainer ? giftContainer.querySelector('[data-gift-group]') : null;
  const extraPrefixAttr = addExtraBtn ? addExtraBtn.getAttribute('data-extra-prefix') : null;
  const extraLabelBase = addExtraBtn ? addExtraBtn.getAttribute('data-extra-label') : null;
  const extraPlaceholderCustom = addExtraBtn ? addExtraBtn.getAttribute('data-extra-placeholder') : null;
  const extraStartAttr = addExtraBtn ? Number.parseInt(addExtraBtn.getAttribute('data-extra-start'), 10) : NaN;
  const requiresUrlType = isRpgTop || isEpPersonal || isEpPlot || isContest || isAvatar || isDesignOther || isRunContest || isMastering;
  const typeOverride = requiresUrlType ? 'url' : null;
  const extraPrefix = extraPrefixAttr || (isNeedRequest ? 'need_extra_' : 'extra_');
  const baseIndex = Number.isFinite(extraStartAttr)
    ? extraStartAttr
    : ((isNeedRequest || isRpgTop || isEpPersonal || isEpPlot) ? 2 : 1);



  const getExtraFields = () => Array.from(modalFields.querySelectorAll('.extra-field'));
  const getGiftGroups = () => giftContainer ? Array.from(giftContainer.querySelectorAll('[data-gift-group]')) : [];
  const counterConfig = counterConfigs[template.id] || null;
  const isCounterForm = Boolean(counterConfig);
  let counterResultApplied = false;

  const amountRaw = amount || '';
  const amountNumber = parseNumericAmount(amountRaw);

  const computeMultiplier = () => {
    if (giftContainer) {
      const groups = getGiftGroups();
      return groups.length ? groups.length : 1;
    }
    if (isCounterForm) {
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
        } else if (template.id === 'form-income-needrequest') {
          computedLabel = `Ссылка на «нужного» ${suffix}`;
        } else if (template.id === 'form-income-rpgtop') {
          computedLabel = `Ссылка на скрин ${suffix}`;
        } else if (template.id === 'form-income-ep-personal' || template.id === 'form-income-ep-plot') {
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
      if (template.id === 'form-income-needrequest') {
        labelText = `Ссылка на «нужного» ${suffix}`;
      } else if (template.id === 'form-income-rpgtop') {
        labelText = `Ссылка на скрин ${suffix}`;
      } else if (template.id === 'form-income-ep-personal' || template.id === 'form-income-ep-plot') {
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
    const waitingText = 'Пожалуйста, подождите...';

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

  updateAmountSummary();

  let shouldStartWatcher = isCounterForm;
  if (isCounterForm && data) {
    const cfg = counterConfig;

    if (cfg.prefix === 'month') {
      const oldVal = data[`${cfg.prefix}_old`];
      const newVal = data[`${cfg.prefix}_new`];
      const roundedVal = data[`${cfg.prefix}_rounded`] ?? data[`${cfg.prefix}_new`];
      const diffVal = Number(data[`${cfg.prefix}_diff`]);

      if (oldVal && newVal && roundedVal && Number.isFinite(diffVal)) {
        renderCounterOutcome(cfg, oldVal, newVal, roundedVal, diffVal);
        counterResultApplied = false;
      }
    } else {
      const oldVal = Number(data[`${cfg.prefix}_old`]);
      const newVal = Number(data[`${cfg.prefix}_new`]);
      const roundedVal = Number(data[`${cfg.prefix}_rounded`] ?? data[`${cfg.prefix}_new`]);
      const diffVal = Number(data[`${cfg.prefix}_diff`]);
      if ([oldVal, newVal, roundedVal, diffVal].every(Number.isFinite)) {
        renderCounterOutcome(cfg, oldVal, newVal, roundedVal, diffVal);
        counterResultApplied = false;
      }
    }
  }


  if (shouldStartWatcher) {
    startCounterWatcher(counterConfig);
  }
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

  // Пересчет для форм с quantity (после восстановления data)
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
