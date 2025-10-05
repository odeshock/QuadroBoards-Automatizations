// Получаем ссылку на модальные элементы
    const backdrop = document.getElementById('backdrop');
    const modalTitle = document.getElementById('modal-title');
    const modalFields = document.getElementById('modal-fields');
    const modalAmount = document.getElementById('modal-amount');
    const modalAmountLabel = document.getElementById('modal-amount-label');
    const btnClose = document.getElementById('btn-close');
    const btnSubmit = document.getElementById('btn-submit');
    const form = document.getElementById('modal-form');
    const log = document.getElementById('log');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        const target = btn.getAttribute('data-tab-target');

        tabButtons.forEach((other) => {
          const isActive = other === btn;
          other.classList.toggle('is-active', isActive);
          other.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        tabPanels.forEach((panel) => {
          const shouldShow = panel.id === `tab-${target}`;
          panel.classList.toggle('is-active', shouldShow);
          if (shouldShow) {
            panel.removeAttribute('hidden');
          } else {
            panel.setAttribute('hidden', '');
          }
        });
      });
    });

    const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
    const formatNumber = (value) => numberFormatter.format(value);
    const parseNumericAmount = (raw) => {
      if (raw === undefined || raw === null) return null;
      const normalized = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
      if (!normalized) return null;
      return /^-?\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null;
    };

    const submissionGroups = [];
    let groupSeq = 0;
    let entrySeq = 0;

    const buildGroupKey = ({ templateSelector = '', title = '', amount = '', amountLabel = '', kind = '' }) =>
      [templateSelector, title, amount, amountLabel, kind].join('||');

    function renderLog() {
      log.innerHTML = '';
      if (!submissionGroups.length) {
        const empty = document.createElement('div');
        empty.className = 'log-empty';
        empty.textContent = 'Пока нет сохранённых карточек.';
        log.appendChild(empty);
        return;
      }

      submissionGroups.forEach((group, index) => {
        const entryEl = document.createElement('div');
        entryEl.className = 'entry';
        entryEl.dataset.groupId = group.id;

        const header = document.createElement('div');
        header.className = 'entry-header';

        const title = document.createElement('span');
        title.className = 'entry-title';
        title.textContent = `#${index + 1} · ${group.title}`;
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
          const amountNumber = parseNumericAmount(group.amount);
          if (amountNumber !== null) {
            const multiplier = totalEntryMultiplier > 0 ? totalEntryMultiplier : 1;
            if (multiplier > 1) {
              const total = amountNumber * multiplier;
              meta.textContent = `${group.amountLabel}: ${formatNumber(amountNumber)} x ${multiplier} = ${formatNumber(total)}`;
            } else {
              meta.textContent = `${group.amountLabel}: ${formatNumber(amountNumber)}`;
            }
          } else {
            meta.textContent = `${group.amountLabel}: ${group.amount}`;
          }
          header.appendChild(meta);
        }

        if (group.entries.length > 1) {
          const countMeta = document.createElement('span');
          countMeta.className = 'entry-meta';
          if (totalEntryMultiplier > group.entries.length) {
            countMeta.textContent = `Записей: ${group.entries.length}, всего позиций: ${totalEntryMultiplier}`;
          } else {
            countMeta.textContent = `Записей: ${group.entries.length}`;
          }
          header.appendChild(countMeta);
        }

        entryEl.appendChild(header);

        const itemsWrap = document.createElement('div');
        itemsWrap.className = 'entry-items';

        group.entries.forEach((item, itemIndex) => {
          const itemEl = document.createElement('div');
          itemEl.className = 'entry-item';
          itemEl.dataset.entryId = item.id;
          itemEl.dataset.groupId = group.id;

          const itemHeader = document.createElement('div');
          itemHeader.className = 'entry-item-header';

          const itemTitle = document.createElement('span');
          itemTitle.className = 'entry-item-title';
          const baseTitle = group.entries.length > 1 ? `Запись ${itemIndex + 1}` : 'Данные';
          const entryMultiplierRaw = item && typeof item.multiplier !== 'undefined' ? item.multiplier : null;
          const entryMultiplierNumeric = typeof entryMultiplierRaw === 'string' ? Number.parseFloat(entryMultiplierRaw) : entryMultiplierRaw;
          const entryMultiplier = Number.isFinite(entryMultiplierNumeric) && entryMultiplierNumeric > 1 ? entryMultiplierNumeric : null;
          itemTitle.textContent = entryMultiplier ? `${baseTitle} · x${entryMultiplier}` : baseTitle;
          itemHeader.appendChild(itemTitle);

          const actions = document.createElement('div');
          actions.className = 'entry-actions';

          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.dataset.action = 'edit';
          editBtn.dataset.groupId = group.id;
          editBtn.dataset.entryId = item.id;
          editBtn.textContent = 'Редактировать';
          actions.appendChild(editBtn);

          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.dataset.action = 'delete';
          deleteBtn.dataset.groupId = group.id;
          deleteBtn.dataset.entryId = item.id;
          deleteBtn.textContent = 'Удалить';
          actions.appendChild(deleteBtn);

          itemHeader.appendChild(actions);
          itemEl.appendChild(itemHeader);

          const list = document.createElement('ol');
          list.className = 'entry-list';
          const formatEntryKey = (key) => {
            const recipientMatch = key.match(/^recipient_(\d+)$/);
            if (recipientMatch) return recipientMatch[1] === '1' ? 'Получатель' : `Получатель ${recipientMatch[1]}`;
            const fromMatch = key.match(/^from_(\d+)$/);
            if (fromMatch) return fromMatch[1] === '1' ? 'От кого' : `От кого ${fromMatch[1]}`;
            const wishMatch = key.match(/^wish_(\d+)$/);
            if (wishMatch) return wishMatch[1] === '1' ? 'Комментарий' : `Комментарий ${wishMatch[1]}`;
            return key;
          };

          Object.entries(item.data).forEach(([key, value]) => {
            const li = document.createElement('li');
            const raw = typeof value === 'string' ? value.trim() : value;
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
              valueSpan.textContent = raw || '—';
              li.append(keySpan, document.createTextNode(' — '), valueSpan);
            }

            list.appendChild(li);
          });

          itemEl.appendChild(list);
          itemsWrap.appendChild(itemEl);
        });

        entryEl.appendChild(itemsWrap);
        log.appendChild(entryEl);
      });
    }

    function openModal(config) {
      const {
        templateSelector,
        title,
        amount,
        kind,
        amountLabel,
        data = null,
        entryId = null,
        groupId = null
      } = config;

      const template = document.querySelector(templateSelector);
      if (!template) return;

      const resolvedTitle = title || 'Пункт';
      const resolvedAmountLabel = amountLabel || (kind === 'expense' ? 'Стоимость' : 'Начисление');

      modalTitle.textContent = resolvedTitle;
      modalAmount.textContent = amount || '';
      modalAmountLabel.textContent = resolvedAmountLabel;

      form.dataset.templateSelector = templateSelector;
      form.dataset.kind = kind || '';
      form.dataset.amount = amount || '';
      form.dataset.amountLabel = resolvedAmountLabel;
      form.dataset.title = resolvedTitle;
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

      modalFields.innerHTML = template.innerHTML;

      const isNeedRequest = template.id === 'form-income-needrequest';
      if (isNeedRequest) {
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
      const extraPrefix = extraPrefixAttr || (isNeedRequest ? 'need_extra_' : 'extra_');
      const baseIndex = Number.isFinite(extraStartAttr) ? extraStartAttr : (isNeedRequest ? 2 : 1);

      const getExtraFields = () => Array.from(modalFields.querySelectorAll('.extra-field'));
      const getGiftGroups = () => giftContainer ? Array.from(giftContainer.querySelectorAll('[data-gift-group]')) : [];

      const computeMultiplier = () => {
        if (giftContainer) {
          const groups = getGiftGroups();
          return groups.length ? groups.length : 1;
        }
        if (!addExtraBtn) return 1;
        return 1 + getExtraFields().length;
      };

      const amountRaw = amount || '';
      const amountNumber = parseNumericAmount(amountRaw);

      const updateAmountSummary = () => {
        modalAmountLabel.textContent = resolvedAmountLabel;
        const multiplier = computeMultiplier();
        form.dataset.currentMultiplier = String(multiplier);
        if (amountNumber === null) {
          modalAmount.textContent = amountRaw;
          return;
        }
        if (multiplier > 1) {
          const total = amountNumber * multiplier;
          modalAmount.textContent = `${formatNumber(amountNumber)} x ${multiplier} = ${formatNumber(total)}`;
        } else {
          modalAmount.textContent = formatNumber(amountNumber);
        }
      };

      updateAmountSummary();

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
            const computedLabel = extraLabelBase
              ? `${extraLabelBase} ${suffix}`
              : (isNeedRequest ? `Ссылка на «нужного» ${suffix}` : `Доп. поле ${suffix}`);
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

      const addExtraField = addExtraBtn
        ? (options = {}) => {
            const { silent = false, presetKey = null } = options;
            let suffix = parseSuffix(presetKey);
            if (!Number.isFinite(suffix)) {
              suffix = getNextSuffix();
            }
            const nameAttr = `${extraPrefix}${suffix}`;
            const wrap = document.createElement('div');
            wrap.className = 'field extra-field';
            const labelText = extraLabelBase
              ? `${extraLabelBase} ${suffix}`
              : (isNeedRequest ? `Ссылка на «нужного» ${suffix}` : `Доп. поле ${suffix}`);
            const placeholderAttr = extraPlaceholderCustom
              ? ` placeholder="${extraPlaceholderCustom}"`
              : '';
            wrap.innerHTML = `
              <label for="${nameAttr}">${labelText}</label>
              <div class="extra-input">
                <input id="${nameAttr}" name="${nameAttr}" type="${isNeedRequest ? 'url' : 'text'}"${placeholderAttr} required>
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
          }
        : null;

      if (addExtraBtn && addExtraField) {
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
              wishInput.type = 'text';
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

      backdrop.setAttribute('open', '');
      backdrop.removeAttribute('aria-hidden');
    }

    function closeModal() {
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
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-add');
      if (!btn) return;
      const selector = btn.getAttribute('data-form');
      const kind = btn.getAttribute('data-kind') || '';
      const amount = btn.getAttribute('data-amount') || '';
      const row = btn.parentElement.querySelector('.title');
      const overrideTitle = btn.getAttribute('data-title');
      const titleText = overrideTitle || (row ? row.textContent.trim() : 'Пункт');
      const amountLabel = kind === 'expense' ? 'Стоимость' : 'Начисление';

      const meta = {
        templateSelector: selector,
        title: titleText,
        amount,
        kind,
        amountLabel
      };

      const key = buildGroupKey(meta);
      const existingGroup = submissionGroups.find((group) => group.key === key);

      if (existingGroup && existingGroup.entries.length) {
        const lastEntry = existingGroup.entries[existingGroup.entries.length - 1];
        openModal({
          ...meta,
          data: lastEntry.data,
          entryId: lastEntry.id,
          groupId: existingGroup.id
        });
      } else {
        openModal(meta);
      }
    });

    btnClose.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.hasAttribute('open')) closeModal();
    });

    log.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const { action, groupId, entryId } = actionBtn.dataset;
      if (!groupId) return;

      const group = submissionGroups.find((item) => item.id === groupId);
      if (!group) return;

      if (action === 'edit') {
        if (!entryId) return;
        const entry = group.entries.find((item) => item.id === entryId);
        if (!entry) return;
        openModal({
          templateSelector: group.templateSelector,
          title: group.title,
          amount: group.amount,
          kind: group.kind,
          amountLabel: group.amountLabel,
          data: entry.data,
          entryId: entry.id,
          groupId: group.id
        });
        return;
      }

      if (action === 'delete') {
        if (!entryId) return;
        const entryIndex = group.entries.findIndex((item) => item.id === entryId);
        if (entryIndex !== -1) {
          group.entries.splice(entryIndex, 1);
          if (!group.entries.length) {
            const groupIndex = submissionGroups.findIndex((item) => item.id === group.id);
            if (groupIndex !== -1) submissionGroups.splice(groupIndex, 1);
          }
          renderLog();
        }
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      const formData = new FormData(form);
      const obj = {};
      formData.forEach((value, key) => {
        obj[key] = value;
      });

      const editingEntryId = form.dataset.editingId || null;
      const editingGroupId = form.dataset.groupId || null;

      const meta = {
        templateSelector: form.dataset.templateSelector,
        title: form.dataset.title || modalTitle.textContent,
        amount: form.dataset.amount || '',
        amountLabel: form.dataset.amountLabel || modalAmountLabel.textContent,
        kind: form.dataset.kind || ''
      };

      const key = buildGroupKey(meta);
      let group = null;

      const multiplierValue = Number.parseInt(form.dataset.currentMultiplier || '1', 10);
      const normalizedMultiplier = Number.isFinite(multiplierValue) && multiplierValue > 0 ? multiplierValue : 1;

      if (editingGroupId) {
        group = submissionGroups.find((item) => item.id === editingGroupId) || null;
      }
      if (!group) {
        group = submissionGroups.find((item) => item.key === key) || null;
      }
      if (!group) {
        groupSeq += 1;
        group = {
          id: `group-${groupSeq}`,
          key,
          ...meta,
          entries: []
        };
        submissionGroups.push(group);
      } else {
        group.key = key;
        group.templateSelector = meta.templateSelector;
        group.title = meta.title;
        group.amount = meta.amount;
        group.amountLabel = meta.amountLabel;
        group.kind = meta.kind;
      }

      let entryRecord = null;

      if (editingEntryId) {
        const originGroup = submissionGroups.find((item) => item.entries.some((entry) => entry.id === editingEntryId));
        if (originGroup) {
          const idx = originGroup.entries.findIndex((entry) => entry.id === editingEntryId);
          if (idx !== -1) {
            entryRecord = originGroup.entries.splice(idx, 1)[0];
            if (!originGroup.entries.length && originGroup !== group) {
              const originGroupIndex = submissionGroups.findIndex((item) => item.id === originGroup.id);
              if (originGroupIndex !== -1) submissionGroups.splice(originGroupIndex, 1);
            }
          }
        }
        if (!entryRecord) {
          entryRecord = { id: editingEntryId };
        }
      } else {
        entrySeq += 1;
        entryRecord = { id: `entry-${entrySeq}` };
      }

      entryRecord.data = obj;
      entryRecord.multiplier = normalizedMultiplier;
      group.entries.push(entryRecord);

      renderLog();
      closeModal();
    });

    renderLog();


async function runEvery100Messages(modalRoot) {
  const statusEl = modalRoot.querySelector('#modal-fields .muted-note');
  if (statusEl) statusEl.textContent = 'идет поиск…';

  
  const userId = UserID;
  if (!userId) {
    if (statusEl) statusEl.textContent = 'Ошибка: не найден UserID';
    return;
  }

    const oldValue = MSG100_OLD;
    const newValue = MSG100_NEW;
    console.log(oldValue, newValue);
    if (oldValue === 'underfined' || newValue === 'underfined') {
      if (statusEl) statusEl.textContent = 'Ошибка: данные 100msg не работают';
     return;
    }
    
  const rounded = Math.floor(newValue / 100) * 100;

  const diff = rounded - oldValue;
  const accrual = diff / 100;

  const lines = [
    `— прежнее значение: ${oldValue}`,
    `— новое значение: ${newValue}${newValue !== rounded ? ` → округлено до сотен: ${rounded}` : ''}`,
  ];
  if (diff === 0) lines.push('нет новых начислений');
  else lines.push(`в .form-footer начисление: (${rounded} - ${oldValue}) / 100 = ${accrual}`);

  if (statusEl) statusEl.textContent = lines.join('\n');

  if (diff !== 0) {
    const footer = modalRoot.querySelector('.form-footer');
    if (footer && !footer.querySelector('[data-save-100msgs]')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn primary';
      btn.textContent = 'Сохранить';
      btn.setAttribute('data-save-100msgs', '');
      btn.addEventListener('click', () => {
        localStorage.setItem('userMessageCount', String(rounded));
        const note = document.createElement('span');
        note.className = 'hint';
        note.style.marginLeft = '8px';
        note.textContent = `Сохранено (${rounded})`;
        footer.appendChild(note);
      });
      footer.querySelector('div[style]')?.appendChild(btn);
    }
  }
}
