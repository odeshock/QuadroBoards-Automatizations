// ============================================================================
// components.js — UI и модальные функции
// ============================================================================

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function cleanupCounterWatcher(counterWatcher, modalFields, form) {
  if (counterWatcher && typeof counterWatcher.cancel === 'function') {
    counterWatcher.cancel();
  }
  counterWatcher = null;
  modalFields.querySelectorAll('input[type="hidden"][data-auto-field]').forEach((el) => el.remove());
  delete form.dataset.currentMultiplier;
  return counterWatcher;
}

function updateNote(modalFields, content, { error = false } = {}) {
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

function setHiddenField(modalFields, name, value) {
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

function renderLog(log) {
  log.innerHTML = '';
  if (!submissionGroups.length) {
    const empty = document.createElement('div');
    empty.className = 'log-empty';
    empty.textContent = 'Пока нет сохранённых карточек.';
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

      // формат "фикс + xнадбавка" (например "5 + x10")
      const m = String(group.amount).match(/^\s*(\d+)\s*\+\s*x\s*(\d+)\s*$/i);
      if (m) {
        const fix = Number(m[1]);
        const bonus = Number(m[2]);

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

        const total = fix * totalCount + bonus * totalThousands;
        meta.textContent = `${group.amountLabel}: ${total.toLocaleString('ru-RU')}`;
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

        const commission = recipientCount * 10;
        const totalCost = totalAmount + commission;

        if (recipientCount > 0) {
          meta.textContent = `${group.amountLabel}: ${formatNumber(totalCost)}`;
        } else {
          meta.textContent = `${group.amountLabel}: ${group.amount}`;
        }
        header.appendChild(meta);
      } else if (group.isDiscount) {
        // Скидки: сумма всех discount_amount
        let totalDiscount = 0;
        group.entries.forEach((item) => {
          const amount = Number(item.data?.discount_amount) || 0;
          totalDiscount += amount;
        });
        meta.textContent = `${group.amountLabel}: ${formatNumber(totalDiscount)}`;
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

        const totalCost = giftPrice1 * totalGifts;
        meta.textContent = `${group.amountLabel}: ${formatNumber(totalCost > 0 ? totalCost : group.amount)}`;
        header.appendChild(meta);
      } else if (['#form-exp-bonus1d1', '#form-exp-bonus2d1', '#form-exp-bonus1w1', '#form-exp-bonus2w1', '#form-exp-bonus1m1', '#form-exp-bonus2m1', '#form-exp-bonus1m3', '#form-exp-bonus2m3', '#form-exp-mask', '#form-exp-clean'].includes(group.templateSelector)) {
        // Бонусы/Маска/Жилет: базовая цена × сумма всех quantity
        let totalQuantity = 0;
        const basePrice = parseNumericAmount(group.amount) || 0;

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

        const totalCost = basePrice * totalQuantity;
        meta.textContent = `${group.amountLabel}: ${formatNumber(totalCost > 0 ? totalCost : group.amount)}`;
        header.appendChild(meta);
      } else {
        // обычное число/строка
        const amountNumber = parseNumericAmount(group.amount);
        if (amountNumber !== null) {
          const multiplier = totalEntryMultiplier > 0 ? totalEntryMultiplier : 1;
          const total = amountNumber * multiplier;
          meta.textContent = `${group.amountLabel}: ${formatNumber(total)}`;
        } else {
          meta.textContent = `${group.amountLabel}: ${group.amount}`;
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

        if (dataObj.discount_type === 'custom') {
          label.textContent = 'Скидка за пять индивидуальных подарков: ';
        } else {
          label.textContent = 'Скидка за пять подарков: ';
        }

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

      // ===== Докупить кредиты / Персональные начисления: склеиваем recipient_i + topup_i (+ comment_i для AMS) =====
      const bonusMaskCleanIds = [
        'form-exp-bonus1d1', 'form-exp-bonus2d1',
        'form-exp-bonus1w1', 'form-exp-bonus2w1',
        'form-exp-bonus1m1', 'form-exp-bonus2m1',
        'form-exp-bonus1m3', 'form-exp-bonus2m3',
        'form-exp-mask', 'form-exp-clean'
      ];
      const isBonusMaskClean = bonusMaskCleanIds.includes(item.template_id);

      const isTopup = (item.template_id === 'form-income-topup' || item.template_id === 'form-income-ams') ||
            (/Докупить кредиты|Персональные начисления/i.test(group.title || ''));
      const isAMS = (item.template_id === 'form-income-ams') || (/Персональные начисления/i.test(group.title || ''));

      // ===== Перевод средств: recipient_i + amount_i =====
      const isTransfer = (item.template_id === 'form-exp-transfer') ||
            (/Перевод средств другому/i.test(group.title || ''));

      if (isTopup) {
        const dataObj = item.data || {};
        const idxs = Object.keys(dataObj)
          .map(k => k.match(/^recipient_(\d+)$/))
          .filter(Boolean)
          .map(m => m[1])
          .sort((a, b) => Number(a) - Number(b));

        idxs.forEach((idx) => {
          const rid = String(dataObj[`recipient_${idx}`] ?? '').trim();
          if (!rid) return;

          const user = window.USERS_LIST?.find(u => String(u.id) === rid);
          const displayName = user ? `<strong>${user.name}</strong> (id: ${user.id})` : `id: ${rid}`;

          const rawAmount = String(dataObj[`topup_${idx}`] ?? '').trim();
          const amountNum = parseNumericAmount(rawAmount);
          const amountText = (amountNum !== null && rawAmount) ? formatNumber(amountNum) : (rawAmount || '—');

          const li = document.createElement('li');

          // Для AMS добавляем комментарий
          if (isAMS) {
            const comment = String(dataObj[`comment_${idx}`] ?? '').trim();
            li.innerHTML = comment
              ? `${displayName} — ${amountText} (комментарий: ${comment})`
              : `${displayName} — ${amountText}`;
          } else {
            li.innerHTML = `${displayName} — ${amountText}`;
          }

          list.appendChild(li);
        });
      }

      // ===== Бонусы/Маска/Жилет: recipient_i + quantity_i + from_i + wish_i =====
      if (isBonusMaskClean) {
        const dataObj = item.data || {};
        const idxs = Object.keys(dataObj)
          .map(k => k.match(/^recipient_(\d+)$/))
          .filter(Boolean)
          .map(m => m[1])
          .sort((a, b) => Number(a) - Number(b));

        const basePrice = parseNumericAmount(group.amount) || 0;

        idxs.forEach((idx) => {
          const rid = String(dataObj[`recipient_${idx}`] ?? '').trim();
          if (!rid) return;

          const user = window.USERS_LIST?.find(u => String(u.id) === rid);
          const displayName = user ? `<strong>${user.name}</strong> (id: ${user.id})` : `id: ${rid}`;

          const from = String(dataObj[`from_${idx}`] ?? '').trim();
          const wish = String(dataObj[`wish_${idx}`] ?? '').trim();
          const qty = Number(dataObj[`quantity_${idx}`] ?? '1') || 1;

          const li = document.createElement('li');

          // Получатель
          const recipient = document.createElement('span');
          recipient.innerHTML = displayName;
          li.append(recipient);

          // От кого: комментарий (как у подарков)
          if (from || wish) {
            const sep2 = document.createTextNode(' — ');
            li.append(sep2);

            if (from && wish) {
              const fromText = document.createElement('span');
              fromText.style.fontStyle = 'italic';
              fromText.textContent = from;

              const colonText = document.createTextNode(': ');

              const wishText = document.createElement('span');
              wishText.style.color = 'var(--muted, #666)';
              wishText.textContent = wish;

              li.append(fromText, colonText, wishText);
            } else if (from) {
              const fromText = document.createElement('span');
              fromText.style.fontStyle = 'italic';
              fromText.textContent = from;
              li.append(fromText);
            } else if (wish) {
              const wishText = document.createElement('span');
              wishText.style.color = 'var(--muted, #666)';
              wishText.textContent = wish;
              li.append(wishText);
            }
          }

          // Количество и стоимость
          const cost = basePrice * qty;
          const sep3 = document.createTextNode(' — ');
          const costText = document.createElement('span');
          if (qty > 1) {
            costText.textContent = `${qty} × ${formatNumber(basePrice)} = ${formatNumber(cost)}`;
          } else {
            costText.textContent = formatNumber(cost);
          }
          li.append(sep3, costText);

          list.appendChild(li);
        });
      }

      // ===== Перевод средств: выводим каждого получателя с суммой (без комиссии) =====
      if (isTransfer) {
        const dataObj = item.data || {};
        const idxs = Object.keys(dataObj)
          .map(k => k.match(/^recipient_(\d+)$/))
          .filter(Boolean)
          .map(m => m[1])
          .sort((a, b) => Number(a) - Number(b));

        idxs.forEach((idx) => {
          const rid = String(dataObj[`recipient_${idx}`] ?? '').trim();
          if (!rid) return;

          const user = window.USERS_LIST?.find(u => String(u.id) === rid);
          const displayName = user ? `<strong>${user.name}</strong> (id: ${user.id})` : `id: ${rid}`;

          const rawAmount = String(dataObj[`amount_${idx}`] ?? '').trim();
          const amountNum = parseNumericAmount(rawAmount);
          const amountText = (amountNum !== null && rawAmount) ? formatNumber(amountNum) : (rawAmount || '—');

          const li = document.createElement('li');
          li.innerHTML = `${displayName} — ${amountText}`;
          list.appendChild(li);
        });
      }

      // ===== Подарки и Оформление: выводим каждого получателя с информацией =====
      const designTemplates = ['form-icon-custom', 'form-icon-present', 'form-badge-custom', 'form-badge-present', 'form-bg-custom', 'form-bg-present'];
      const isDesign = designTemplates.includes(item.template_id);
      const isDesignCustom = isDesign && item.template_id.includes('custom');
      const isDesignRegular = isDesign && !item.template_id.includes('custom');

      const isGift = (item.template_id === 'form-gift-present' || isDesignRegular) ||
            (/Подарить подарок|Праздничный подарок|Подарок-сюрприз|Воздушный подарок/i.test(group.title || ''));

      const isCustomGift = (item.template_id === 'form-gift-custom' || isDesignCustom) ||
            (/Индивидуальный подарок/i.test(group.title || ''));

      if (isGift) {
        const dataObj = item.data || {};
        const idxs = Object.keys(dataObj)
          .map(k => k.match(/^recipient_(\d+)$/))
          .filter(Boolean)
          .map(m => m[1])
          .sort((a, b) => Number(a) - Number(b));

        idxs.forEach((idx) => {
          const rid = String(dataObj[`recipient_${idx}`] ?? '').trim();
          if (!rid) return;

          const user = window.USERS_LIST?.find(u => String(u.id) === rid);
          const displayName = user ? `<strong>${user.name}</strong> (id: ${user.id})` : `id: ${rid}`;

          const from = String(dataObj[`from_${idx}`] ?? '').trim();
          const wish = String(dataObj[`wish_${idx}`] ?? '').trim();

          const li = document.createElement('li');

          // Получатель
          const recipient = document.createElement('span');
          recipient.innerHTML = displayName;

          li.append(recipient);

          // От кого: комментарий
          if (from || wish) {
            const sep2 = document.createTextNode(' — ');
            li.append(sep2);

            if (from && wish) {
              // Оба поля заполнены: "от кого: комментарий"
              const fromText = document.createElement('span');
              fromText.style.fontStyle = 'italic';
              fromText.textContent = from;

              const colonText = document.createTextNode(': ');

              const wishText = document.createElement('span');
              wishText.style.color = 'var(--muted, #666)';
              wishText.textContent = wish;

              li.append(fromText, colonText, wishText);
            } else if (from) {
              // Только "от кого"
              const fromText = document.createElement('span');
              fromText.style.fontStyle = 'italic';
              fromText.textContent = from;
              li.append(fromText);
            } else if (wish) {
              // Только комментарий
              const wishText = document.createElement('span');
              wishText.style.color = 'var(--muted, #666)';
              wishText.textContent = wish;
              li.append(wishText);
            }
          }

          list.appendChild(li);
        });
      }

      // ===== Индивидуальные подарки: получатель + данные для подарка =====
      if (isCustomGift) {
        const dataObj = item.data || {};
        const idxs = Object.keys(dataObj)
          .map(k => k.match(/^recipient_(\d+)$/))
          .filter(Boolean)
          .map(m => m[1])
          .sort((a, b) => Number(a) - Number(b));

        idxs.forEach((idx) => {
          const rid = String(dataObj[`recipient_${idx}`] ?? '').trim();
          if (!rid) return;

          const user = window.USERS_LIST?.find(u => String(u.id) === rid);
          const displayName = user ? `<strong>${user.name}</strong> (id: ${user.id})` : `id: ${rid}`;

          const from = String(dataObj[`from_${idx}`] ?? '').trim();
          const wish = String(dataObj[`wish_${idx}`] ?? '').trim();
          const giftData = String(dataObj[`gift_data_${idx}`] ?? '').trim();

          const li = document.createElement('li');

          // Получатель
          const recipient = document.createElement('span');
          recipient.innerHTML = displayName;

          li.append(recipient);

          // От кого: комментарий
          if (from || wish) {
            const sep2 = document.createTextNode(' — ');
            li.append(sep2);

            if (from && wish) {
              const fromText = document.createElement('span');
              fromText.style.fontStyle = 'italic';
              fromText.textContent = from;

              const colonText = document.createTextNode(': ');

              const wishText = document.createElement('span');
              wishText.style.color = 'var(--muted, #666)';
              wishText.textContent = wish;

              li.append(fromText, colonText, wishText);
            } else if (from) {
              const fromText = document.createElement('span');
              fromText.style.fontStyle = 'italic';
              fromText.textContent = from;
              li.append(fromText);
            } else if (wish) {
              const wishText = document.createElement('span');
              wishText.style.color = 'var(--muted, #666)';
              wishText.textContent = wish;
              li.append(wishText);
            }
          }

          // Данные для подарка (после <br> с учетом переносов)
          if (giftData) {
            li.appendChild(document.createElement('br'));
            const dataDiv = document.createElement('div');
            dataDiv.style.whiteSpace = 'pre-wrap';
            dataDiv.textContent = giftData;
            li.appendChild(dataDiv);
          }

          list.appendChild(li);
        });
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
          // пары recipient/topup/comment уже отрисованы для топапа
          if (isTopup && (/^recipient_\d+$/.test(key) || /^topup_\d+$/.test(key) || /^comment_\d+$/.test(key))) return;

          // пары recipient/from/wish/quantity уже отрисованы для бонусов/маски/жилета
          if (isBonusMaskClean && (/^recipient_\d+$/.test(key) || /^from_\d+$/.test(key) || /^wish_\d+$/.test(key) || /^quantity_\d+$/.test(key))) return;

          // пары recipient/amount уже отрисованы для переводов
          if (isTransfer && (/^recipient_\d+$/.test(key) || /^amount_\d+$/.test(key))) return;

          // пары recipient/from/wish/gift_id/gift_icon/gift_data уже отрисованы для подарков
          if (isGift && (/^recipient_\d+$/.test(key) || /^from_\d+$/.test(key) || /^wish_\d+$/.test(key) || /^gift_id_\d+$/.test(key) || /^gift_icon_\d+$/.test(key) || /^gift_data_\d+$/.test(key))) return;
          if (isCustomGift && (/^recipient_\d+$/.test(key) || /^from_\d+$/.test(key) || /^wish_\d+$/.test(key) || /^gift_id_\d+$/.test(key) || /^gift_icon_\d+$/.test(key) || /^gift_data_\d+$/.test(key))) return;

          // для прочих форм recipient_i показываем только имя
          if (!isTopup && !isGift && !isCustomGift && !isBonusMaskClean && /^recipient_\d+$/.test(key)) {
            const rid = String(value ?? '').trim();
            if (!rid) return;
            const user = window.USERS_LIST?.find(u => String(u.id) === rid);
            const li = document.createElement('li');
            li.innerHTML = user ? `<strong>${user.name}</strong> (id: ${user.id})` : `id: ${rid}`;
            list.appendChild(li);
            return;
          }

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
}

// ============================================================================
// ADMIN FLOWS
// ============================================================================

function setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data }) {
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

function setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data }) {
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

function setupAdminTopupFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, requireComment = false }) {
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

        i++;
      }

      const hasAny = i > 1;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
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
      amount.step = '0.1';
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

function setupTransferFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount }) {
  // === 1) Удаляем существующие поля формы ===
  modalFields.querySelectorAll('.info, .gift-note, .muted-note, .note-error, .callout, [data-info], .field')
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

    const commission = count * 10;
    const totalCost = totalAmount + commission;

    if (modalAmount) {
      if (count > 0) {
        // Формат: "сумма чисел + 10 x количество = итого"
        modalAmount.textContent = `${formatNumber(totalAmount)} + 10 × ${count} = ${formatNumber(totalCost)}`;
      } else {
        modalAmount.textContent = '';
      }
    }

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
      amount.step = '0.1';
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

function setupCustomGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, giftPrice1, giftPrice5 }) {
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
    const totalCost = price1 * totalCount;

    if (modalAmount) {
      if (totalCount > 0) {
        modalAmount.textContent = `${price1} × ${totalCount} = ${formatNumber(totalCost)}`;
      } else {
        modalAmount.textContent = '';
      }
    }

    return { totalCount, totalCost };
  };

  const renderCustomGiftPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    // Превью подарка
    const preview = document.createElement('div');
    preview.className = 'gift-preview';
    preview.style.padding = '12px';
    preview.style.marginBottom = '16px';
    preview.style.borderRadius = '8px';
    preview.style.background = 'var(--bg-alt, #f5f5f5)';
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.gap = '12px';
    preview.style.fontSize = '14px';

    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '32px';
    iconSpan.textContent = giftIcon || '✨';

    const idSpan = document.createElement('span');
    idSpan.style.fontWeight = '600';
    idSpan.textContent = `ID: ${giftId || 'custom'}`;

    preview.append(iconSpan, idSpan);
    modalFields.appendChild(preview);

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

function setupGiftFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, giftId, giftIcon, giftPrice1, giftPrice5 }) {
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
    const totalCost = price1 * totalCount;

    if (modalAmount) {
      if (totalCount > 0) {
        modalAmount.textContent = `${price1} × ${totalCount} = ${formatNumber(totalCost)}`;
      } else {
        modalAmount.textContent = '';
      }
    }

    return { totalCount, totalCost };
  };

  // === 4) Когда USERS_LIST готов — рисуем интерфейс выбора получателей ===
  const renderGiftPicker = (users) => {
    if (!Array.isArray(users)) return fail();

    hideWait();

    // Превью подарка (иконка + ID)
    const preview = document.createElement('div');
    preview.className = 'gift-preview';
    preview.style.padding = '12px';
    preview.style.marginBottom = '16px';
    preview.style.borderRadius = '8px';
    preview.style.background = 'var(--bg-alt, #f5f5f5)';
    preview.style.display = 'flex';
    preview.style.alignItems = 'center';
    preview.style.gap = '12px';
    preview.style.fontSize = '14px';

    const iconSpan = document.createElement('span');
    iconSpan.style.fontSize = '32px';
    iconSpan.textContent = giftIcon || '🎁';

    const idSpan = document.createElement('span');
    idSpan.style.fontWeight = '600';
    idSpan.textContent = `ID: ${giftId || 'gift'}`;

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

function setupBonusMaskCleanFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs, data, modalAmount, basePrice }) {
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
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showError('Произошла ошибка. Пожалуйста, обновите страницу.');
    cancel();
  };

  const updateTotalCost = (itemGroups) => {
    let totalQuantity = 0;
    itemGroups.forEach(group => {
      const qty = Number(group.quantityInput.value) || 0;
      totalQuantity += qty;
    });

    const price = Number.parseInt(basePrice, 10) || 0;
    const totalCost = price * totalQuantity;

    if (modalAmount) {
      if (totalQuantity > 0) {
        modalAmount.textContent = `${price} × ${totalQuantity} = ${formatNumber(totalCost)}`;
      } else {
        modalAmount.textContent = '';
      }
    }

    return { totalQuantity, totalCost };
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

    const syncHiddenFields = () => {
      modalFields
        .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="from_"], input[type="hidden"][name^="wish_"], input[type="hidden"][name^="quantity_"]')
        .forEach(n => n.remove());

      itemGroups.forEach((group, index) => {
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
      });

      const stats = updateTotalCost(itemGroups);
      const hasAny = stats.totalQuantity > 0;
      btnSubmit.style.display = hasAny ? '' : 'none';
      btnSubmit.disabled = !hasAny;
    };

    const removeGroup = (group) => {
      const idx = itemGroups.indexOf(group);
      if (idx > -1) itemGroups.splice(idx, 1);
      if (group.el) group.el.remove();

      // Обновляем состояние кнопок удаления после удаления
      updateRemoveButtons();
      syncHiddenFields();
    };

    const updateRemoveButtons = () => {
      const allRemoveBtns = groupsContainer.querySelectorAll('.gift-remove');
      allRemoveBtns.forEach((btn, i) => {
        // Первая группа всегда недоступна для удаления
        btn.disabled = i === 0;
      });
    };

    const addGroup = (user, prefillQty = '', prefillFrom = '', prefillWish = '', isFirst = false) => {
      groupCounter++;
      const idx = groupCounter;

      const groupEl = document.createElement('div');
      groupEl.className = 'gift-group';
      groupEl.setAttribute('data-gift-group', '');

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-extra gift-remove';
      removeBtn.setAttribute('data-gift-remove', '');
      removeBtn.setAttribute('aria-label', 'Удалить получателя');
      removeBtn.textContent = '×';
      removeBtn.disabled = isFirst;

      // Получатель
      const recipientField = document.createElement('div');
      recipientField.className = 'field gift-field';
      recipientField.setAttribute('data-gift-label', 'recipient');
      const recipientLabel = document.createElement('label');
      recipientLabel.setAttribute('for', `bonus-recipient-${idx}`);
      recipientLabel.textContent = 'Получатель *';
      const recipientInput = document.createElement('input');
      recipientInput.id = `bonus-recipient-${idx}`;
      recipientInput.setAttribute('data-gift-recipient', '');
      recipientInput.name = `recipient_${idx}`;
      recipientInput.type = 'text';
      recipientInput.value = `${user.name} (id: ${user.id})`;
      recipientInput.required = true;
      recipientInput.readOnly = true;
      recipientField.append(recipientLabel, recipientInput);

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
      qtyInput.value = prefillQty || '1';
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
      fromInput.name = `from_${idx}`;
      fromInput.type = 'text';
      fromInput.value = prefillFrom || '';
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
      wishInput.name = `wish_${idx}`;
      wishInput.type = 'text';
      wishInput.value = prefillWish || '';
      wishInput.placeholder = 'Комментарий';
      wishField.append(wishLabel, wishInput);

      groupEl.append(removeBtn, recipientField, quantityField, fromField, wishField);
      groupsContainer.appendChild(groupEl);

      const group = {
        recipientId: user.id,
        recipientName: user.name,
        quantityInput: qtyInput,
        fromInput: fromInput,
        wishInput: wishInput,
        el: groupEl
      };

      itemGroups.push(group);

      qtyInput.addEventListener('input', syncHiddenFields);
      fromInput.addEventListener('input', syncHiddenFields);
      wishInput.addEventListener('input', syncHiddenFields);
      removeBtn.addEventListener('click', () => removeGroup(group));

      // Обновляем состояние кнопок удаления
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

    const addMoreField = document.createElement('div');
    addMoreField.className = 'field';
    addMoreField.appendChild(addMoreBtn);
    modalFields.appendChild(addMoreField);

    // Поиск пользователей
    const searchField = document.createElement('div');
    searchField.className = 'field anketa-combobox';
    searchField.style.display = 'none';
    searchField.style.marginTop = '12px';

    const searchLabel = document.createElement('label');
    searchLabel.textContent = 'Найти получателя';

    const comboBox = document.createElement('div');
    comboBox.className = 'combo';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Начните вводить имя или id...';
    searchInput.setAttribute('autocomplete', 'off');

    const suggestList = document.createElement('div');
    suggestList.className = 'suggest';
    suggestList.setAttribute('role', 'listbox');
    suggestList.style.position = 'fixed';
    suggestList.style.zIndex = '9999';
    suggestList.style.display = 'none';

    comboBox.append(searchInput, suggestList);
    searchField.append(searchLabel, comboBox);
    modalFields.appendChild(searchField);

    let portalMounted = false;
    const mountPortal = () => { if (!portalMounted) { document.body.appendChild(suggestList); portalMounted = true; } };
    const unmountPortal = () => { if (portalMounted) { suggestList.remove(); portalMounted = false; } };
    const positionPortal = () => {
      const r = searchInput.getBoundingClientRect();
      suggestList.style.left = `${r.left}px`;
      suggestList.style.top = `${r.bottom + 6}px`;
      suggestList.style.width = `${r.width}px`;
    };
    const closeSuggest = () => { suggestList.style.display = 'none'; unmountPortal(); };
    const openSuggest = () => { mountPortal(); positionPortal(); suggestList.style.display = 'block'; };

    const norm = (s) => String(s ?? '').trim().toLowerCase();
    const doSearch = () => {
      const q = norm(searchInput.value);
      suggestList.innerHTML = '';
      if (!q) {
        closeSuggest();
        return;
      }

      const matches = users.filter(u => {
        const addedIds = itemGroups.map(g => String(g.recipientId));
        if (addedIds.includes(String(u.id))) return false;
        return norm(u.name).includes(q) || String(u.id).includes(q);
      }).slice(0, 10);

      if (matches.length === 0) {
        closeSuggest();
        return;
      }

      matches.forEach(u => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'suggest-item';
        item.setAttribute('role', 'option');
        item.textContent = `${u.name} (id: ${u.id})`;
        item.addEventListener('click', () => {
          // Первая группа (если групп ещё нет) будет недоступна для удаления
          const isFirst = itemGroups.length === 0;
          addGroup(u, '1', '', '', isFirst);
          searchInput.value = '';
          closeSuggest();
          searchField.style.display = 'none';
        });
        suggestList.appendChild(item);
      });

      openSuggest();
    };

    searchInput.addEventListener('input', doSearch);
    searchInput.addEventListener('focus', doSearch);
    searchInput.addEventListener('blur', () => setTimeout(closeSuggest, 200));

    addMoreBtn.addEventListener('click', () => {
      searchField.style.display = 'block';
      searchInput.focus();
    });

    // Восстановление данных при редактировании
    if (data && typeof data === 'object') {
      const recipientKeys = Object.keys(data)
        .filter(k => /^recipient_\d+$/.test(k))
        .map(k => k.match(/^recipient_(\d+)$/)[1])
        .sort((a, b) => Number(a) - Number(b));

      recipientKeys.forEach((idx, i) => {
        const rid = String(data[`recipient_${idx}`] ?? '').trim();
        if (!rid) return;
        const user = users.find(u => String(u.id) === rid);
        if (!user) return;

        const qty = String(data[`quantity_${idx}`] ?? '1');
        const from = String(data[`from_${idx}`] ?? '');
        const wish = String(data[`wish_${idx}`] ?? '');

        addGroup(user, qty, from, wish, i === 0);
      });
    } else {
      // При создании новой записи показываем поле поиска сразу для первого получателя
      searchField.style.display = 'block';
      searchInput.focus();
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

function openModal({
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
    groupId = null
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
  modalAmount.textContent = amount || '';
  modalAmountLabel.textContent = resolvedAmountLabel;

  form.dataset.templateSelector = templateSelector;
  form.dataset.kind = kind || '';
  form.dataset.amount = amount || '';
  form.dataset.baseAmount = amount || '';
  form.dataset.amountLabel = resolvedAmountLabel;
  form.dataset.title = resolvedTitle;
  form.dataset.giftPrice1 = giftPrice1 || '';
  form.dataset.giftPrice5 = giftPrice5 || '';
  form.dataset.giftId = giftId || '';
  form.dataset.giftIcon = giftIcon || '';
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
    counterWatcher = setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: FORM_TIMEOUT_MS, data });
  }
}

// === AKCION: «Взятие акционного персонажа» — поведение как у анкеты ===
if (template.id === 'form-income-akcion') {
  if (!window.IS_ADMIN) {
    // не админ — просто инфо-окно (кнопка скрыта уже через data-info)
    btnSubmit.style.display = 'none';
  } else {
    // админ — тот же выбор получателей, как у анкеты
    counterWatcher = setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: PROMO_TIMEOUT_MS, data });
  }
}

// === NEEDCHAR: «Взятие нужного персонажа» — поведение как у анкеты ===
if (template.id === 'form-income-needchar') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none';
  } else {
    counterWatcher = setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: NEEDED_TIMEOUT_MS, data });
  }
}

// === TOPUP: «Докупить кредиты» — как анкета, но на каждого указываем сумму
if (template.id === 'form-income-topup') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none'; // инфо-режим (data-info)
  } else {
    counterWatcher = setupAdminTopupFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: TOPUP_TIMEOUT_MS, data });
  }
}

// === AMS: «Выдать денежку дополнительно» — как докупка, но на каждого указываем сумму и комментарий
if (template.id === 'form-income-ams') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none'; // инфо-режим (data-info)
  } else {
    counterWatcher = setupAdminTopupFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: AMS_TIMEOUT_MS, data, requireComment: true });
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
  counterWatcher = setupBonusMaskCleanFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: AMS_TIMEOUT_MS, data, modalAmount, basePrice: amount });
}

// === TRANSFER: «Перевод средств другому (комиссия)» — выбор пользователей + сумма с комиссией 10 галлеонов за каждого
if (template.id === 'form-exp-transfer') {
  counterWatcher = setupTransferFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: TRANSFER_TIMEOUT_MS, data, modalAmount });
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
    counterWatcher = setupAdminRecipientsFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: BEST_EPISODE_TIMEOUT_MS, data });
  }
}

// === BEST-POST: «Пост полумесяца» — как «Эпизод полумесяца», но один получатель ===
if (template.id === 'form-income-post-of') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none'; // инфо-окно для не-админов (data-info)
  } else {
    counterWatcher = setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: BEST_POST_TIMEOUT_MS, data });
  }
}

// === BEST-WRITER: «Постописец полумесяца» — как «Пост полумесяца», 1 получатель
if (template.id === 'form-income-writer') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none'; // инфо-окно
  } else {
    counterWatcher = setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: BEST_WRITER_TIMEOUT_MS, data });
  }
}

// === BEST-ACTIVIST: «Активист полумесяца» — как «Пост полумесяца», 1 получатель
if (template.id === 'form-income-activist') {
  if (!window.IS_ADMIN) {
    btnSubmit.style.display = 'none';
  } else {
    counterWatcher = setupAdminSingleRecipientFlow({ modalFields, btnSubmit, counterWatcher, timeoutMs: BEST_ACTIVIST_TIMEOUT_MS, data });
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
    const raw = form.dataset.amount || '5 + x10';
    const m = raw.match(/^\s*(\d+)\s*\+\s*x\s*(\d+)\s*$/i);
    const fix = m ? Number(m[1]) : 5;
    const bonus = m ? Number(m[2]) : 10;

    const info = document.createElement('div');
    info.className = 'calc-info';
    info.innerHTML =
      `<strong>Система подсчета:</strong><br>
      — фиксированная выплата за пост — ${fix},<br>
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
    // amount для пункта "Личный пост" = "5 + x10" в разметке (фикс 5, надбавка 10).
    // Заберём числа из form.dataset.amount на всякий случай:
    const raw = form.dataset.amount || '5 + x10';
    const m = raw.match(/^\s*(\d+)\s*\+\s*x\s*(\d+)\s*$/i);
    const fix = m ? Number(m[1]) : 5;
    const bonus = m ? Number(m[2]) : 10;

    const total = fix * count + bonus * thousandsSum;
    modalAmountLabel.textContent = form.dataset.amountLabel || 'Начисление';
    modalAmount.textContent = `${fix} x ${count} + ${bonus} x ${thousandsSum} = ${total.toLocaleString('ru-RU')}`;
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

  // Пояснение «Система подсчёта» — берём числа из data-amount (в HTML: "20 + x5")
  (() => {
    const raw = form.dataset.amount || '20 + x5';
    const m = raw.match(/^\s*(\d+)\s*\+\s*x\s*(\d+)\s*$/i);
    const fix = m ? Number(m[1]) : 20;
    const bonus = m ? Number(m[2]) : 5;

    const info = document.createElement('div');
    info.className = 'calc-info';
    info.innerHTML =
      `<strong>Система подсчета:</strong><br>
      — фиксированная выплата за пост — ${fix},<br>
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
    // "20 + x5" из HTML разметки для «Сюжетный пост»
    const raw = form.dataset.amount || '20 + x5';
    const m = raw.match(/^\s*(\d+)\s*\+\s*x\s*(\d+)\s*$/i);
    const fix = m ? Number(m[1]) : 20;
    const bonus = m ? Number(m[2]) : 5;
    const total = fix * count + bonus * thousandsSumCapped;
    modalAmountLabel.textContent = form.dataset.amountLabel || 'Начисление';
    modalAmount.textContent = `${fix} x ${count} + ${bonus} x ${thousandsSumCapped} = ${total.toLocaleString('ru-RU')}`;
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
    const amountRaw = amount || '';
    const amountNumber = parseNumericAmount(amountRaw);
    form.dataset.currentMultiplier = String(multiplier);
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
  const labelOverride = isRpgTop ? 'Ссылка на скриншот' : null;
  const typeOverride = isRpgTop ? 'url' : null;
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
  if (quantityInput && amountNumber !== null) {
    const updateQuantityAmount = () => {
      const qty = Number(quantityInput.value) || 1;
      const total = amountNumber * qty;
      modalAmount.textContent = `${formatNumber(amountNumber)} × ${qty} = ${formatNumber(total)}`;
    };
    quantityInput.addEventListener('input', updateQuantityAmount);
    updateQuantityAmount();
  }

  backdrop.setAttribute('open', '');
  backdrop.removeAttribute('aria-hidden');

  return { counterWatcher };
}

// ============================================================================
// CLOSE MODAL
// ============================================================================

function closeModal({ backdrop, form, modalFields, counterWatcher }) {
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
  return counterWatcher;
}
