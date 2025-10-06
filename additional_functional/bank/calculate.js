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
    const COUNTER_POLL_INTERVAL_MS = 500;
    const ADS_TIMEOUT_MS = 180000;
    const PERSONAL_TIMEOUT_MS = 180000;
    const PLOT_TIMEOUT_MS = 180000;
    const FIRST_POST_TIMEOUT_MS = 180000;
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
      }
    };

    const counterPrefixMap = {
      msg: counterConfigs['form-income-100msgs'],
      rep: counterConfigs['form-income-100rep'],
      pos: counterConfigs['form-income-100pos']
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

          // 1) Спец-формат: "фикс + xнадбавка" (например "5 + x10")
          const m = String(group.amount).match(/^\s*(\d+)\s*\+\s*x\s*(\d+)\s*$/i);
          if (m) {
            const fix = Number(m[1]);
            const bonus = Number(m[2]);

            // Собираем по всем записям группы
            let totalCount = 0;
            let totalThousands = 0;
            group.entries.forEach((item) => {
              // Личные посты — без капа
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
                } catch(_) {}
              }
              // Сюжетные посты — с капом 3к на пост
              const rawPlot = item?.data?.plot_posts_json;
              if (rawPlot) {
                try {
                  const arr = JSON.parse(rawPlot);
                  if (Array.isArray(arr) && arr.length) {
                    totalCount += arr.length;
                    totalThousands += arr.reduce((s, it) => {
                      const n = Number.isFinite(it?.symbols_num) ? it.symbols_num : parseInt(it?.symbols_num, 10) || 0;
                      const k = Math.floor(Math.max(0, n) / 1000);
                      return s + Math.min(k, 3); // кап 3
                    }, 0);
                  }
                } catch(_) {}
              }
            });

            const total = fix * totalCount + bonus * totalThousands;
            meta.textContent = `${group.amountLabel}: ${fix} x ${totalCount} + ${bonus} x ${totalThousands} = ${total.toLocaleString('ru-RU')}`;
            header.appendChild(meta);
          } else {
            // 2) Обычный числовой случай (как было)
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
          itemTitle.textContent = baseTitle;
          itemHeader.appendChild(itemTitle);

          const removeTitleIfEmpty = () => {
            // есть ли в этой записи хотя бы один пункт данных?
            const hasData = itemEl.querySelector('.entry-list li');
            if (!hasData && itemTitle && itemTitle.textContent.trim() === 'Данные') {
              itemTitle.remove(); // убираем заголовок «Данные», кнопки остаются
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

          const list = document.createElement('ol');
          list.className = 'entry-list';
          const formatEntryKey = (key) => {
            const recipientMatch = key.match(/^recipient_(\d+)$/);
            if (recipientMatch) return recipientMatch[1] === '1' ? 'Получатель' : `Получатель ${recipientMatch[1]}`;
            const fromMatch = key.match(/^from_(\d+)$/);
            if (fromMatch) return fromMatch[1] === '1' ? 'От кого' : `От кого ${fromMatch[1]}`;
            const wishMatch = key.match(/^wish_(\d+)$/);
            if (wishMatch) return wishMatch[1] === '1' ? 'Комментарий' : `Комментарий ${wishMatch[1]}`;
            const counterMatch = key.match(/^(msg|rep|pos)_(old|new|rounded|diff)$/);
            if (counterMatch) {
              const [, prefix, suffix] = counterMatch;
              const cfg = counterPrefixMap[prefix];
              if (cfg) {
                if (suffix === 'old') return 'Предыдущее значение';
                if (suffix === 'new') return 'Новое значение';
                if (suffix === 'rounded') return 'Новое значение (округлено)';
                if (suffix === 'diff') return cfg.logDiffLabel || 'Новый учитанный объем';
              }
            }
            return key;
          };
          
          // спец-рендер для листовки
          if (item.data && item.data.flyer_links_json) {
            try {
              const links = JSON.parse(item.data.flyer_links_json);
              if (Array.isArray(links) && links.length) {
                const list = document.createElement('ol');
                
                const removeTitleIfEmpty = () => {
                  if (list.children.length === 0 && itemTitle && itemTitle.textContent.trim() === 'Данные') {
                    itemTitle.remove(); // убираем только текст "Данные", кнопки в header остаются
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
                return; // уже отрисовали "Данные" для этой записи
              }
            } catch (e) { /* ignore */ }
          }

          // спец-рендер для личных постов
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
            } catch(e) { /* ignore */ }
          }

          // спец-рендер для сюжетных постов
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
            } catch (e) { /* ignore */ }
          }


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
          removeTitleIfEmpty();

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

      cleanupCounterWatcher();
      modalFields.innerHTML = template.innerHTML;

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
          show('**Начисление за первый пост на профиле уже производились.**', { hideBtn: true });
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

        const lines = [
          `**Последнее обработанное значение:** ${oldVal}`,
          newVal !== rounded
            ? `**Новое значение:** ${newVal} **→ округлено до сотен:** ${rounded}`
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
        const oldVal = Number(data[`${cfg.prefix}_old`]);
        const newVal = Number(data[`${cfg.prefix}_new`]);
        const roundedVal = Number(data[`${cfg.prefix}_rounded`] ?? data[`${cfg.prefix}_new`]);
        const diffVal = Number(data[`${cfg.prefix}_diff`]);
        if ([oldVal, newVal, roundedVal, diffVal].every(Number.isFinite)) {
          renderCounterOutcome(cfg, oldVal, newVal, roundedVal, diffVal);
          counterResultApplied = false; // allow fresh data after render
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

(function () {
  // ===== Настройки =====
  // Корневой контейнер формы голосования
  const FORM_SEL = '#form-income-rpgtop';
  // Селектор первой «базы» для подтверждения (существующее поле)
  const BASE_PROOF_NAME = 'proof'; // name="proof"

  // ===== Вспомогалки =====
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Кнопка "добавить ещё" из вашей формы (если уже есть логика data-add-extra — используем её)
  function clickAddExtra() {
    const btn = $(`${FORM_SEL} [data-add-extra]`);
    if (btn) btn.click();
    else {
      // Фолбэк: создаём поле вручную
      const wrap = document.createElement('div');
      const idx = getProofInputs().length + 1;
      wrap.className = 'field';
      wrap.innerHTML = `
        <label>Подтверждение (скрин/ссылка) ${idx}</label>
        <input type="url" name="proof_${idx}" required placeholder="Ссылка на скриншот или пост">
      `;
      $(FORM_SEL).appendChild(wrap);
    }
  }

  function getProofInputs() {
    return $$(`${FORM_SEL} input[name="${BASE_PROOF_NAME}"], ${FORM_SEL} input[name^="${BASE_PROOF_NAME}_"]`);
  }

  // Возвращает input для следующего добавленного подтверждения
  function ensureNextProofInput() {
    // ищем пустое поле среди уже существующих
    const empty = getProofInputs().find(inp => !inp.value?.trim());
    if (empty) return empty;

    // иначе создаём новое
    clickAddExtra();

    // пытаемся найти последнее добавленное поле по имени
    const inputs = getProofInputs();
    return inputs[inputs.length - 1];
  }

  // Добавляет URL в следующее поле подтверждения
  function addProofUrl(url) {
    const input = ensureNextProofInput();
    if (!input) return;
    input.value = url;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Нормализация src -> абсолютный URL
  function toAbsUrl(src) {
    try { return new URL(src, location.href).href; } catch { return src; }
  }

  // ===== Вызов штатного Загрузчика =====
  // Поддержка IPS 4.x (есть глобальный IPS и CKEDITOR)
  function openIpsUploader() {
    // 1) Пробуем штатную кнопку «скрепка/загрузки» под редактором
    // Обычно это input[type="file"] внутри блока вложений
    let fileInput = document.querySelector('.ipsAttachmentUpload input[type="file"], [data-role="attachmentUpload"] input[type="file"]');
    if (fileInput) {
      fileInput.click();
      return true;
    }

    // 2) Пробуем кнопку тулбара "Изображение" CKEditor (русская локаль)
    let imgBtn = document.querySelector('.cke_button__image, .cke_button[aria-label*="Изображение"], .cke_button[aria-label*="image"]');
    if (imgBtn) {
      imgBtn.click();
      return true;
    }

    // 3) Пробуем открыть «галерею» уже загруженных (как на скриншоте) — у IPS это ссылка "Вставить другие носители"
    let otherSrc = document.querySelector('[data-action="insertOtherMedia"], [data-action="insertExistingAttachment"]');
    if (otherSrc) {
      otherSrc.click();
      return true;
    }

    // 4) Жёсткий фолбэк: ищем ЛЮБОЙ input[type=file] в компоуз-области и кликаем
    let anyFile = document.querySelector('.ipsComposeArea input[type="file"]');
    if (anyFile) {
      anyFile.click();
      return true;
    }

    return false;
  }

  // ===== Отслеживаем вставку картинок в редактор и переносим URL в форму =====
  const seen = new Set();

  // CKEditor (IPS)
  function bindCkeditorWatcher() {
    if (!window.CKEDITOR || !CKEDITOR.instances) return false;

    const instances = Object.values(CKEDITOR.instances);
    if (!instances.length) return false;

    instances.forEach(instance => {
      // На любое изменение проверяем содержимое на новые <img>
      instance.on('change', () => {
        const html = instance.getData() || '';
        // Достаём src из <img ... src="...">
        const urls = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)).map(m => toAbsUrl(m[1]));
        urls.forEach(u => {
          if (!seen.has(u)) {
            seen.add(u);
            addProofUrl(u);
          }
        });
      });

      // Дополнительно ловим вставку (drag&drop, пейст)
      instance.on('afterCommandExec', (evt) => {
        if (evt.data && /image|upload/i.test(String(evt.data.name))) {
          setTimeout(() => instance.fire('change'), 500);
        }
      });
    });

    return true;
  }

  // Контент-editable без CKEditor (универсальный фолбэк)
  function bindContentObserver() {
    const editable = document.querySelector('[contenteditable="true"], .ipsComposeArea_editor, .cke_wysiwyg_div');
    if (!editable) return false;

    const obs = new MutationObserver(() => {
      const imgs = editable.querySelectorAll('img[src]');
      imgs.forEach(img => {
        const url = toAbsUrl(img.getAttribute('src'));
        if (!seen.has(url)) {
          seen.add(url);
          addProofUrl(url);
        }
      });
    });
    obs.observe(editable, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    return true;
  }

  // ===== Инициализация =====
  function init() {
    // Кнопка «Загрузить скриншоты»
    const btn = $('#rt-open-uploader');
    if (btn) {
      btn.addEventListener('click', () => {
        const ok = openIpsUploader();
        if (!ok) {
          // Если не нашли специфичные элементы IPS — пытаемся найти любой file input в области редактора
          const ok2 = openIpsUploader();
          if (!ok2) alert('Не удалось открыть встроенный загрузчик. Попробуйте загрузить в редактор вручную — ссылки подхватятся автоматически.');
        }
      });
    }

    // Подписываемся на редактор
    const boundCKE = bindCkeditorWatcher();
    if (!boundCKE) bindContentObserver();
  }

  // Ждём DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
