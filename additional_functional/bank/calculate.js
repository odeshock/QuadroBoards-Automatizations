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
    const MSG_TIMEOUT_MS = 180000;
    const REP_TIMEOUT_MS = 180000;
    const POS_TIMEOUT_MS = 180000;
    const MONTH_TIMEOUT_MS = 180000;
    const COUNTER_POLL_INTERVAL_MS = 500;
    const ADS_TIMEOUT_MS = 180000;
    const PERSONAL_TIMEOUT_MS = 180000;
    const PLOT_TIMEOUT_MS = 180000;
    const FIRST_POST_TIMEOUT_MS = 180000;
    const FORM_TIMEOUT_MS = 180000;
    const PROMO_TIMEOUT_MS = 180000;
    const NEEDED_TIMEOUT_MS = 180000;
    const BEST_EPISODE_TIMEOUT_MS = 180000;
    const BEST_POST_TIMEOUT_MS = 180000;
    const BEST_WRITER_TIMEOUT_MS   = 180000;
    const BEST_ACTIVIST_TIMEOUT_MS = 180000;
    const TOPUP_TIMEOUT_MS = 180000;
    const AMS_TIMEOUT_MS = 180000;

    let counterWatcher = null;

    const counterConfigs = {
      'form-income-100msgs': {
        prefix: 'msg',
        oldVar: 'MSG100_OLD',
        newVar: 'MSG100_NEW',
        unitLabel: 'сообщений',
        diffNoteLabel: 'новых сообщений',
        logDiffLabel: 'Новые учитанные сообщения',
        timeout: MSG_TIMEOUT_MS,
        step: 100
      },
      'form-income-100rep': {
        prefix: 'rep',
        oldVar: 'REP100_OLD',
        newVar: 'REP100_NEW',
        unitLabel: 'уважения',
        diffNoteLabel: 'уважения',
        logDiffLabel: 'Новое учитанное уважение',
        timeout: REP_TIMEOUT_MS,
        step: 100
      },
      'form-income-100pos': {
        prefix: 'pos',
        oldVar: 'POS100_OLD',
        newVar: 'POS100_NEW',
        unitLabel: 'позитива',
        diffNoteLabel: 'позитива',
        logDiffLabel: 'Новый учитанный позитив',
        timeout: POS_TIMEOUT_MS,
        step: 100
      },
      'form-income-month': {
        prefix: 'month',
        oldVar: 'MONTH_OLD',
        newVar: 'MONTH_NEW',
        unitLabel: 'месяцев',
        diffNoteLabel: 'новых месяцев пребывания',
        logDiffLabel: 'Новые учтённые месяцы пребывания',
        timeout: MONTH_TIMEOUT_MS,
        step: 1
      },
    };

    const counterPrefixMap = {
      msg: counterConfigs['form-income-100msgs'],
      rep: counterConfigs['form-income-100rep'],
      pos: counterConfigs['form-income-100pos'],
      month: counterConfigs['form-income-month']
    };

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
    

    function cleanupCounterWatcher() {
      if (counterWatcher && typeof counterWatcher.cancel === 'function') {
        counterWatcher.cancel();
      }
      counterWatcher = null;
      modalFields.querySelectorAll('input[type="hidden"][data-auto-field]').forEach((el) => el.remove());
      delete form.dataset.currentMultiplier;
    }

    function updateNote(content, { error = false } = {}) {
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

    function setHiddenField(name, value) {
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

    // ==== ВИРТУАЛЬНЫЕ ДАТЫ: расчёт полных месяцев ====
    const pad2 = (n) => String(n).padStart(2, '0');

    function roundNewToAnchorDOM(OLD, NEW) {
      let [y2, m2, d2] = NEW.map(Number);
      const d1 = Number(OLD[2]);
      if (d2 < d1) {
        m2 -= 1;
        if (m2 === 0) { m2 = 12; y2 -= 1; }
      }
      return [y2, m2, d1];
    }

    function fullMonthsDiffVirtualDOM(OLD, NEW) {
      const [y1, m1] = OLD.map(Number);
      const [yr, mr] = roundNewToAnchorDOM(OLD, NEW);
      return Math.max(0, (yr - y1) * 12 + (mr - m1));
    }

    function fmtYMD([y, m, d]) {
      return `${y}-${pad2(m)}-${pad2(d)}`;
    }


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

        // ====== header ======
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
            meta.textContent = `${group.amountLabel}: ${fix} x ${totalCount} + ${bonus} x ${totalThousands} = ${total.toLocaleString('ru-RU')}`;
            header.appendChild(meta);
          } else {
            // обычное число/строка
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

        // ====== items ======
        const itemsWrap = document.createElement('div');
        itemsWrap.className = 'entry-items';

        group.entries.forEach((item, itemIndex) => {
          const itemEl = document.createElement('div');
          itemEl.className = 'entry-item';
          itemEl.dataset.entryId = item.id;
          itemEl.dataset.groupId = group.id;

          // header у записи
          const itemHeader = document.createElement('div');
          itemHeader.className = 'entry-item-header';

          const itemTitle = document.createElement('span');
          itemTitle.className = 'entry-item-title';
          const baseTitle = group.entries.length > 1 ? `Запись ${itemIndex + 1}` : 'Данные';
          itemTitle.textContent = baseTitle;
          itemHeader.appendChild(itemTitle);

          const removeTitleIfEmpty = () => {
            const hasData = itemEl.querySelector('.entry-list li');
            if (!hasData && itemTitle && itemTitle.textContent.trim() === 'Данные') {
              itemTitle.remove();
            }
          };

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

          // список данных
          const list = document.createElement('ol');
          list.className = 'entry-list';

          const formatEntryKey = (key) => {
            const recipientMatch = key.match(/^recipient_(\d+)$/);
            if (recipientMatch) return recipientMatch[1] === '1' ? 'Получатель' : `Получатель ${recipientMatch[1]}`;
            const fromMatch = key.match(/^from_(\d+)$/);
            if (fromMatch) return fromMatch[1] === '1' ? 'От кого' : `От кого ${fromMatch[1]}`;
            const wishMatch = key.match(/^wish_(\d+)$/);
            if (wishMatch) return wishMatch[1] === '1' ? 'Комментарий' : `Комментарий ${wishMatch[1]}`;
            const counterMatch = key.match(/^(msg|rep|pos|month)_(old|new|rounded|diff)$/);
            if (counterMatch) {
              const [, prefix, suffix] = counterMatch;
              const cfg = counterPrefixMap[prefix];
              if (cfg) {
                if (suffix === 'old') return 'Предыдущее значение';
                if (suffix === 'new') return 'Новое значение';
                if (suffix === 'rounded')
                return cfg.prefix === 'month'
                  ? 'Новое значение (условно округлено)'
                  : 'Новое значение (округлено)';
                if (suffix === 'diff') return cfg.logDiffLabel || 'Новый учитанный объем';
              }
            }
            return key;
          };

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

          // ===== Докупить кредиты: склеиваем recipient_i + topup_i =====
          const isTopup = (item.template_id === 'form-income-topup' || item.template_id === 'form-income-ams') ||
                (/Докупить кредиты|Персональные начисления/i.test(group.title || ''));


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
              li.innerHTML = `${displayName} — ${amountText}`;
              list.appendChild(li);
            });
          }


          // ===== остальные поля =====
          Object.entries(item.data || {}).forEach(([key, value]) => {
            // пары recipient/topup уже отрисованы для топапа
            if (isTopup && (/^recipient_\d+$/.test(key) || /^topup_\d+$/.test(key))) return;

            // для прочих форм recipient_i показываем только имя
            if (!isTopup && /^recipient_\d+$/.test(key)) {
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

            const li = document.createElement('li');
            const raw = typeof value === 'string' ? value.trim() : value;

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

          removeTitleIfEmpty();

          itemEl.appendChild(list);
          itemsWrap.appendChild(itemEl);
        });

        entryEl.appendChild(itemsWrap);
        log.appendChild(entryEl);
      });
    }


    function setupAdminRecipientsFlow({ timeoutMs, data }) {
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
    }

    function setupAdminSingleRecipientFlow({ timeoutMs, data }) {
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
    }

    function setupAdminTopupFlow({ timeoutMs, data }) {
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

        // Выбранные: Map<id, { id, name, amountInput, el }>
        const picked = new Map();

        const isValidAmount = (raw) => {
          const num = parseNumericAmount(raw); // уже объявлена выше в файле:contentReference[oaicite:1]{index=1}
          return Number.isFinite(num) && num > 0;
        };

        const syncHiddenFields = () => {
          // очищаем прошлые скрытые
          modalFields
            .querySelectorAll('input[type="hidden"][name^="recipient_"], input[type="hidden"][name^="topup_"]')
            .forEach(n => n.remove());

          // пересобираем пары recipient_i + topup_i только для валидных сумм
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
            hidA.name = `topup_${i}`;
            hidA.value = String(val).trim().replace(',', '.');

            modalFields.append(hidR, hidA);
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

        // Prefill из data: recipient_i + topup_i
        if (data) {
          const ids = Object.keys(data)
            .filter(k => /^recipient_\d+$/.test(k))
            .sort((a, b) => parseInt(a.slice(10), 10) - parseInt(b.slice(10), 10));
          ids.forEach((rk) => {
            const idx = rk.slice(10);
            const rid = String(data[rk]).trim();
            if (!rid) return;
            const amount = String(data[`topup_${idx}`] ?? '').trim();
            const u = users.find(x => String(x.id) === rid);
            if (u) addChip(u, amount);
            else   addChip({ id: rid, name: 'Неизвестный' }, amount);
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

      cleanupCounterWatcher();
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
      return;
    }


    // === ANKETA (за приём анкеты): режимы для админа/не админа ===
    if (template.id === 'form-income-anketa') {
      if (!window.IS_ADMIN) {
        btnSubmit.style.display = 'none';
      } else {
        setupAdminRecipientsFlow({ timeoutMs: FORM_TIMEOUT_MS, data });
      }
    }

    // === AKCION: «Взятие акционного персонажа» — поведение как у анкеты ===
    if (template.id === 'form-income-akcion') {
      if (!window.IS_ADMIN) {
        // не админ — просто инфо-окно (кнопка скрыта уже через data-info)
        btnSubmit.style.display = 'none';
      } else {
        // админ — тот же выбор получателей, как у анкеты
        setupAdminRecipientsFlow({ timeoutMs: PROMO_TIMEOUT_MS, data });
      }
    }

    // === NEEDCHAR: «Взятие нужного персонажа» — поведение как у анкеты ===
    if (template.id === 'form-income-needchar') {
      if (!window.IS_ADMIN) {
        btnSubmit.style.display = 'none';
      } else {
        setupAdminRecipientsFlow({ timeoutMs: NEEDED_TIMEOUT_MS, data });
      }
    }

    // === TOPUP: «Докупить кредиты» — как анкета, но на каждого указываем сумму
    if (template.id === 'form-income-topup') {
      if (!window.IS_ADMIN) {
        btnSubmit.style.display = 'none'; // инфо-режим (data-info)
      } else {
        setupAdminTopupFlow({ timeoutMs: TOPUP_TIMEOUT_MS, data });
      }
    }

    // === AMS: «Выдать денежку дополнительно» — как докупка, но на каждого указываем сумму
    if (template.id === 'form-income-ams') {
      if (!window.IS_ADMIN) {
        btnSubmit.style.display = 'none'; // инфо-режим (data-info)
      } else {
        setupAdminTopupFlow({ timeoutMs: AMS_TIMEOUT_MS, data });

      }
    }

    // === BEST-EPISODE: «Эпизод полумесяца» — поведение как у анкеты ===
    if (template.id === 'form-income-episode-of') {
      if (!window.IS_ADMIN) {
        // не админ — просто инфо-окно (submit скрыт за счёт data-info)
        btnSubmit.style.display = 'none';
      } else {
        // админ — тот же выбор получателей, как у анкеты
        setupAdminRecipientsFlow({ timeoutMs: BEST_EPISODE_TIMEOUT_MS, data });
      }
    }

    // === BEST-POST: «Пост полумесяца» — как «Эпизод полумесяца», но один получатель ===
    if (template.id === 'form-income-post-of') {
      if (!window.IS_ADMIN) {
        btnSubmit.style.display = 'none'; // инфо-окно для не-админов (data-info)
      } else {
        setupAdminSingleRecipientFlow({ timeoutMs: BEST_POST_TIMEOUT_MS, data });
      }
    }

    // === BEST-WRITER: «Постописец полумесяца» — как «Пост полумесяца», 1 получатель
    if (template.id === 'form-income-writer') {
      if (!window.IS_ADMIN) {
        btnSubmit.style.display = 'none'; // инфо-окно
      } else {
        setupAdminSingleRecipientFlow({ timeoutMs: BEST_WRITER_TIMEOUT_MS, data });
      }
    }

    // === BEST-ACTIVIST: «Активист полумесяца» — как «Пост полумесяца», 1 получатель
    if (template.id === 'form-income-activist') {
      if (!window.IS_ADMIN) {
        btnSubmit.style.display = 'none';
      } else {
        setupAdminSingleRecipientFlow({ timeoutMs: BEST_ACTIVIST_TIMEOUT_MS, data });
      }
    }


    // === FIRST POST: ждём FIRST_POST_FLAG, PLOT_POSTS и PERSONAL_POSTS ===
    if (template.id === 'form-income-firstpost') {
      // якорь "подождите..."
      const waitEl = updateNote('Пожалуйста, подождите...');

      let canceled = false;
      const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
      counterWatcher = { cancel };

      const fail = () => {
        if (canceled) return;
        updateNote('Произошла ошибка. Попробуйте обновить страницу.', { error: true });
        btnSubmit.style.display = 'none';
        cancel();
      };

      const show = (html, { ok = false, hideBtn = true } = {}) => {
        const el = updateNote(html);
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

      // ждём, пока ВСЕ три сущности вообще появятся
      const appeared = () =>
        typeof window.FIRST_POST_FLAG !== 'undefined' &&
        typeof window.PERSONAL_POSTS !== 'undefined' &&
        typeof window.PLOT_POSTS !== 'undefined';

      const to = setTimeout(fail, FIRST_POST_TIMEOUT_MS);
      const poll = setInterval(() => {
        if (!appeared()) return;

        clearTimeout(to);
        clearInterval(poll);

        // если что-то появилось, но тип неверный — сразу ошибка
        if (typeof window.FIRST_POST_FLAG !== 'boolean' ||
            (typeof window.PERSONAL_POSTS !== 'undefined' && !Array.isArray(window.PERSONAL_POSTS)) ||
            (typeof window.PLOT_POSTS !== 'undefined' && !Array.isArray(window.PLOT_POSTS))) {
          fail(); return;
        }

        succeed();
      }, COUNTER_POLL_INTERVAL_MS);
    }

    
    // === PERSONAL POST: ждём PERSONAL_POSTS и рендерим список ===
    if (template.id === 'form-income-personalpost') {
      // 1) Сначала создаём "Пожалуйста, подождите..." и держим ссылку на элемент
      const waitEl = updateNote('Пожалуйста, подождите...');

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
        updateNote('Произошла ошибка. Попробуйте обновить страницу.', { error: true });
        // прячем кнопку — это info-форма
        btnSubmit.style.display = 'none';
        setHiddenField('personal_posts_json', '');
        cancel();
      };

      const succeed = (posts) => {
        if (canceled) return;

        // пустой массив → сообщение и НЕТ кнопки «Сохранить»
        if (!Array.isArray(posts) || posts.length === 0) {
          updateNote('**Для новых начислений не хватает новых постов.**');
          btnSubmit.style.display = 'none';
          setHiddenField('personal_posts_json', '');
          setSummary(0, 0);
          cancel();
          return;
        }

        // нормальный случай
        const items = posts.map(pickItem).filter(Boolean);
        setHiddenField('personal_posts_json', JSON.stringify(items));

        // предпросмотр списка (вертикальный скролл)
        const note = updateNote('');
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
      const waitEl = updateNote('Пожалуйста, подождите...');

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
        updateNote('Произошла ошибка. Попробуйте обновить страницу.', { error: true });
        btnSubmit.style.display = 'none';
        setHiddenField('plot_posts_json', '');
        cancel();
      };

      const succeed = (posts) => {
        if (canceled) return;

        // пустой массив → сообщение и НЕТ кнопки «Сохранить»
        if (!Array.isArray(posts) || posts.length === 0) {
          updateNote('**Для новых начислений не хватает новых постов.**');
          btnSubmit.style.display = 'none';
          setHiddenField('plot_posts_json', '');
          setSummary(0, 0);
          cancel();
          return;
        }

        // нормальный случай
        const items = posts.map(pickItem).filter(Boolean);
        setHiddenField('plot_posts_json', JSON.stringify(items));

        // убираем «подождите…»
        const n = updateNote('');
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
      updateNote('Пожалуйста, подождите...');

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
        updateNote('Произошла ошибка. Попробуйте обновить страницу.', { error: true });
        btnSubmit.style.display = '';      // кнопку всё же покажем
        btnSubmit.disabled = true;         // ...но заблокируем
        cancel();
      };

      // удачный исход
      const succeed = (posts) => {
        if (canceled) return;

        // ⛔ если массив пустой — показываем сообщение и скрываем кнопку
        if (!Array.isArray(posts) || posts.length === 0) {
          updateNote('**Для новых начислений не хватает новых реклам.**');
          btnSubmit.style.display = 'none'; // скрываем кнопку полностью
          setHiddenField('flyer_links_json', '');
          form.dataset.currentMultiplier = '0';
          updateAmountSummary(0);
          cancel();
          return;
        }

        // ✅ обычный успешный случай
        const links = posts.map(pickLink).filter(Boolean);
        setHiddenField('flyer_links_json', JSON.stringify(links));

        form.dataset.currentMultiplier = String(links.length);
        updateAmountSummary(links.length);

        const note = updateNote('');
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
        setHiddenField(`${cfg.prefix}_old`, oldVal);
        setHiddenField(`${cfg.prefix}_new`, newVal);
        setHiddenField(`${cfg.prefix}_rounded`, rounded);
        setHiddenField(`${cfg.prefix}_diff`, diff);
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
          updateNote(lines, { error: false });
          btnSubmit.style.display = 'none';
          btnSubmit.disabled = true;
          updateAmountSummary(0);
        } else {
          lines.push('', `**Будет начислена выплата за** ${rounded} - ${oldVal} = ${diff} **${cfg.diffNoteLabel}.**`);
          updateNote(lines, { error: false });
          btnSubmit.style.display = '';
          btnSubmit.disabled = false;
          updateAmountSummary(units);
        }
      };

      const startCounterWatcher = (cfg) => {
        if (!cfg || counterResultApplied) return;
        const waitingText = 'Пожалуйста, подождите...';

        updateNote(waitingText, { error: false });
        btnSubmit.style.display = 'none';
        btnSubmit.disabled = true;
        setHiddenField(`${cfg.prefix}_old`);
        setHiddenField(`${cfg.prefix}_new`);
        setHiddenField(`${cfg.prefix}_rounded`);
        setHiddenField(`${cfg.prefix}_diff`);

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
          updateNote('Произошла ошибка. Попробуйте обновить страницу.', { error: true });
          btnSubmit.style.display = 'none';
          btnSubmit.disabled = true;
          setHiddenField(`${cfg.prefix}_old`);
          setHiddenField(`${cfg.prefix}_new`);
          setHiddenField(`${cfg.prefix}_rounded`);
          setHiddenField(`${cfg.prefix}_diff`);
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

      backdrop.setAttribute('open', '');
      backdrop.removeAttribute('aria-hidden');
    }

    function closeModal() {
      cleanupCounterWatcher();
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

      const multiplierValue = Number.parseFloat(form.dataset.currentMultiplier || '1');
      const normalizedMultiplier = Number.isFinite(multiplierValue) && multiplierValue >= 0 ? multiplierValue : 1;

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

