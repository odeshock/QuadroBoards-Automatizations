// Admin: универсальные панели выбора (JSON-режим для API)
// createChoicePanelJSON({ title, targetClass, library, ...opts })
// Возвращает { getData(), init(jsonArray) }

(function () {
  'use strict';


  const baseCSS = `
  details.ufo-panel{margin-top:12px;border:1px solid #d0d0d7;border-radius:10px;background:#fff}
  details.ufo-panel>summary{cursor:pointer;list-style:none;padding:10px 14px;font-weight:600;background:#f6f6f8;border-bottom:1px solid #e6e6ef;border-radius:10px}
  details.ufo-panel>summary::-webkit-details-marker{display:none}
  .ufo-wrap{display:flex;flex-direction:column;gap:16px;padding:14px}
  .ufo-col{display:flex;flex-direction:column;gap:8px}
  .ufo-col h4{margin:0;font-size:14px;opacity:.8;display:flex;justify-content:space-between;align-items:center}
  .ufo-search{padding:6px 10px;font-size:13px;border:1px solid #d0d0d7;border-radius:8px;background:#f5f2e8}
  .ufo-lib,.ufo-selected{border:1px dashed #c9c9d9;border-radius:8px;background:#fafafd;padding:8px;overflow:auto}
  .ufo-lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
  .ufo-lib .ufo-card{margin:0}
  .ufo-card{display:grid;grid-template-columns:auto 1fr auto auto;grid-template-rows:auto auto;grid-template-areas:"id full date actions" "id title title actions";gap:8px;background:#fff;border:1px solid #e7e7ef;border-radius:8px;padding:8px;margin:6px 0;max-width:100%;position:relative;overflow:hidden}
  .ufo-idtag{grid-area:id;font-size:11px;opacity:.7;align-self:start}
  .ufo-actions{grid-area:actions;display:flex;align-items:center;gap:6px}
  .ufo-btn{border:1px solid #d7d7e0;background:#f3f3f7;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;line-height:1.15;display:inline-flex;align-items:center}
  .ufo-btn:hover{background:#ececf4}
  .ufo-card.disabled{opacity:.4;pointer-events:none}
  .ufo-selected .ufo-card {grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas:
        "id"
        "full"
        "actions";}
  .ufo-selected .ufo-actions{justify-content: flex-end;}
  .ufo-full{grid-area:full;box-sizing:border-box;margin:0;padding:0;border:0;background:transparent;overflow:hidden}
  .ufo-full .item{position:relative;margin:0}
  .ufo-full .item .modal-link{display:block}
  .ufo-full .item img{display:block;max-width:100%;height:auto;border-radius:6px}
  .ufo-lib .ufo-full .item img{height:90px;width:100%;object-fit:cover}
  .ufo-lib .ufo-full a{pointer-events:none}
  .ufo-title-edit{grid-area:title;border:1px dashed #aaa;border-radius:6px;padding:6px 8px;background:#fffef7;font-size:13px;white-space:pre-wrap;overflow:visible}
  .ufo-title-edit:focus{outline:none;background:#fffdf1}
  .ufo-date-edit{grid-area:date;border:1px dashed #aaa;border-radius:6px;padding:6px 8px;background:#fffef7;font-size:13px;align-self:start}
  .ufo-date-edit input{border:none;background:transparent;font-size:13px;width:100%;font-family:inherit}
  .ufo-date-edit input:focus{outline:none}
  `;
  (function injectCSS() {
    if (window.__ufoCSS) return;
    window.__ufoCSS = true;
    const s = document.createElement('style'); s.textContent = baseCSS; document.head.appendChild(s);
    if (typeof GM_addStyle === 'function') GM_addStyle(baseCSS);
  })();

  const mkBtn = (txt, onClick) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ufo-btn'; b.textContent = txt; b.addEventListener('click', onClick); return b; };

  function computeTwoRowMaxSelected(container) {
    const first = container.querySelector('.ufo-card');
    if (!first) { container.style.maxHeight = ''; return; }
    const style = getComputedStyle(first);
    const h = first.getBoundingClientRect().height;
    const mt = parseFloat(style.marginTop) || 0;
    const mb = parseFloat(style.marginBottom) || 0;
    const cStyle = getComputedStyle(container);
    const pt = parseFloat(cStyle.paddingTop) || 0;
    const pb = parseFloat(cStyle.paddingBottom) || 0;
    const max = Math.round(h * 2 + (mt + mb) * 3 + pt + pb);
    container.style.maxHeight = max + 'px';
  }
  function firstVisibleCard(container) { const cards = [...container.querySelectorAll('.ufo-card')]; return cards.find(c => getComputedStyle(c).display !== 'none') || null; }
  function computeTwoRowMaxLib(container) { const card = firstVisibleCard(container); if (!card) { container.style.maxHeight = ''; return; } const ch = card.getBoundingClientRect().height; const cs = getComputedStyle(container); const rowGap = parseFloat(cs.rowGap) || 0; const pt = parseFloat(cs.paddingTop) || 0; const pb = parseFloat(cs.paddingBottom) || 0; const max = Math.round(ch * 2 + rowGap + pt + pb); container.style.maxHeight = max + 'px'; }

  function createChoicePanelJSON(userOpts) {
    const opts = Object.assign({
      title: 'Библиотека и выбранные',
      targetClass: '_section',
      library: [],           // [{ id, html }]
      startOpen: false,
      itemSelector: '.item',
      idAttr: 'data-id',
      editableAttr: 'title',
      searchPlaceholder: 'поиск по id',
      mountEl: null,
      allowMultiAdd: false,
      expirableAttr: null    // например 'data-expired-date' для купонов
    }, userOpts || {});
    if (!Array.isArray(opts.library)) opts.library = [];

    const uid = 'ufo_' + (opts.targetClass || 'section').replace(/\W+/g, '_') + '_' + Math.random().toString(36).slice(2, 7);

    // Массив выбранных элементов (внутреннее состояние)
    // Каждый элемент: { id, title, content, expired_date?, ...data-attrs }
    let selectedItems = [];

    const details = document.createElement('details'); details.className = 'ufo-panel'; details.open = !!opts.startOpen;
    const summary = document.createElement('summary'); summary.textContent = opts.title || 'Панель';
    const wrap = document.createElement('div'); wrap.className = 'ufo-wrap';

    const libCol = document.createElement('div'); libCol.className = 'ufo-col';
    const hLib = document.createElement('h4'); hLib.textContent = 'Библиотека';
    const search = document.createElement('input'); search.type = 'text'; search.placeholder = opts.searchPlaceholder || 'поиск по id'; search.className = 'ufo-search'; hLib.appendChild(search);
    const libBox = document.createElement('div'); libBox.className = 'ufo-lib'; libBox.id = uid + '-lib';
    libCol.append(hLib, libBox);

    const selCol = document.createElement('div'); selCol.className = 'ufo-col'; selCol.innerHTML = '<h4>Выбранные (сверху — новее)</h4>';
    const selBox = document.createElement('div'); selBox.className = 'ufo-selected'; selBox.id = uid + '-selected';
    selCol.appendChild(selBox);

    wrap.append(libCol, selCol); details.append(summary, wrap);

    if (opts.mountEl) {
      opts.mountEl.appendChild(details);
    }

    function renderLibItem(item) {
      const card = document.createElement('div'); card.className = 'ufo-card'; card.dataset.id = item.id;
      const id = document.createElement('div'); id.className = 'ufo-idtag'; id.textContent = '#' + item.id;
      const full = document.createElement('div'); full.className = 'ufo-full';
      const tmp = document.createElement('div'); tmp.innerHTML = item.html.trim(); full.appendChild(tmp.firstElementChild);
      const actions = document.createElement('div'); actions.className = 'ufo-actions';
      actions.appendChild(mkBtn('Добавить ↑', (e) => { e.preventDefault(); e.stopPropagation(); addItemFromLibrary(item); }));
      card.append(id, full, actions); return card;
    }
    opts.library.forEach(x => libBox.appendChild(renderLibItem(x)));

    /**
     * Добавляет элемент из библиотеки в selectedItems
     */
    function addItemFromLibrary(libItem) {
      const libCard = libBox.querySelector(`.ufo-card[data-id="${libItem.id}"]`);

      // Блокировка дублей (если allowMultiAdd = false)
      if (!opts.allowMultiAdd) {
        if (selectedItems.some(i => i.id === libItem.id)) return;
        if (libCard) libCard.classList.add('disabled');
      }

      // Парсим HTML из библиотеки, извлекаем данные
      const tmp = document.createElement('div');
      tmp.innerHTML = libItem.html.trim();
      const itemEl = tmp.querySelector(opts.itemSelector);

      const newItem = {
        id: libItem.id,
        title: itemEl ? (itemEl.getAttribute(opts.editableAttr) || '') : '',
        content: itemEl ? itemEl.innerHTML.trim() : '', // Только innerHTML, без обёртки
      };

      // Извлекаем ВСЕ data-* атрибуты из элемента
      if (itemEl && itemEl.attributes) {
        for (let i = 0; i < itemEl.attributes.length; i++) {
          const attr = itemEl.attributes[i];
          if (attr.name.startsWith('data-') && attr.name !== 'data-id') {
            // Убираем префикс "data-" и заменяем дефисы на подчёркивания
            const key = attr.name.substring(5).replace(/-/g, '_');
            newItem[key] = attr.value;
          }
        }
      }

      // Если есть expirableAttr, извлекаем дату (может перезаписать то, что извлекли выше)
      if (opts.expirableAttr && itemEl) {
        newItem.expired_date = itemEl.getAttribute(opts.expirableAttr) || '';
      }

      selectedItems.unshift(newItem); // добавляем в начало (новее сверху)
      renderSelected();
    }

    /**
     * Рендерит UI из selectedItems
     */
    function renderSelected() {
      selBox.innerHTML = '';
      selectedItems.forEach((item, index) => {
        const row = createSelectedCard(item, index);
        selBox.appendChild(row);
      });
      computeTwoRowMaxSelected(selBox);
    }

    /**
     * Создаёт DOM-карточку для выбранного элемента
     */
    function createSelectedCard(item, index) {
      const row = document.createElement('div');
      row.className = 'ufo-card';
      row.draggable = true;
      row.dataset.id = item.id;
      row.dataset.index = index;

      const id = document.createElement('div');
      id.className = 'ufo-idtag';
      id.textContent = '#' + item.id;

      const full = document.createElement('div');
      full.className = 'ufo-full';
      const tmp = document.createElement('div');
      tmp.innerHTML = item.content.trim();
      full.appendChild(tmp.firstElementChild);

      const editor = document.createElement('div');
      editor.className = 'ufo-title-edit';
      editor.contentEditable = true;
      editor.textContent = item.title || '';
      editor.addEventListener('blur', () => {
        const cleanTitle = String(editor.innerHTML || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        selectedItems[index].title = cleanTitle;
      });

      let dateEditor = null;
      if (opts.expirableAttr) {
        dateEditor = document.createElement('div');
        dateEditor.className = 'ufo-date-edit';
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.value = item.expired_date || '';
        dateInput.addEventListener('change', () => {
          selectedItems[index].expired_date = dateInput.value;
        });
        dateEditor.appendChild(dateInput);
      }

      const actions = document.createElement('div');
      actions.className = 'ufo-actions';
      const recalc = () => computeTwoRowMaxSelected(selBox);

      const btnUp = mkBtn('↑', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (index > 0) {
          [selectedItems[index - 1], selectedItems[index]] = [selectedItems[index], selectedItems[index - 1]];
          renderSelected();
        }
      });
      const btnDown = mkBtn('↓', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (index < selectedItems.length - 1) {
          [selectedItems[index], selectedItems[index + 1]] = [selectedItems[index + 1], selectedItems[index]];
          renderSelected();
        }
      });
      const btnRemove = mkBtn('✕', (e) => {
        e.preventDefault(); e.stopPropagation();
        selectedItems.splice(index, 1);
        if (!opts.allowMultiAdd) {
          const libCard = libBox.querySelector(`.ufo-card[data-id="${item.id}"]`);
          if (libCard) libCard.classList.remove('disabled');
        }
        renderSelected();
      });

      actions.append(btnUp, btnDown, btnRemove);

      row.append(id, full, actions, editor);
      if (dateEditor) row.appendChild(dateEditor);

      return row;
    }

    // Drag & Drop для переупорядочивания
    (function enableDnd(container) {
      let dragIndex = null;
      container.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.ufo-card');
        if (!card) return;
        dragIndex = parseInt(card.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      });
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const over = e.target.closest('.ufo-card');
        if (!over || dragIndex === null) return;
        const overIndex = parseInt(over.dataset.index, 10);
        if (dragIndex === overIndex) return;
        // Меняем местами в массиве
        const temp = selectedItems[dragIndex];
        selectedItems.splice(dragIndex, 1);
        selectedItems.splice(overIndex, 0, temp);
        dragIndex = overIndex;
        renderSelected();
      });
      container.addEventListener('drop', (e) => {
        e.preventDefault();
        dragIndex = null;
      });
      container.addEventListener('dragend', () => {
        dragIndex = null;
      });
    })(selBox);

    // Поиск в библиотеке
    search.addEventListener('input', () => {
      const v = search.value.trim();
      libBox.querySelectorAll('.ufo-card').forEach(c => {
        c.style.display = (!v || c.dataset.id.includes(v)) ? '' : 'none';
      });
      computeTwoRowMaxLib(libBox);
    });

    const mo1 = new MutationObserver(() => computeTwoRowMaxSelected(selBox));
    mo1.observe(selBox, { childList: true, subtree: true, attributes: true });
    const mo2 = new MutationObserver(() => computeTwoRowMaxLib(libBox));
    mo2.observe(libBox, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', () => { computeTwoRowMaxLib(libBox); computeTwoRowMaxSelected(selBox); });
    computeTwoRowMaxLib(libBox);
    computeTwoRowMaxSelected(selBox);

    /**
     * Инициализация из массива JSON
     * @param {Array} jsonArray - [{ id, title, content, ...data-attrs }]
     */
    function init(jsonArray) {
      if (!Array.isArray(jsonArray)) return;
      selectedItems = [];
      jsonArray.forEach(item => {
        // Добавляем элемент как есть
        selectedItems.push({ ...item });

        // Блокируем в библиотеке если нужно
        if (!opts.allowMultiAdd) {
          const libCard = libBox.querySelector(`.ufo-card[data-id="${item.id}"]`);
          if (libCard) libCard.classList.add('disabled');
        }
      });
      renderSelected();
    }

    /**
     * Возвращает массив данных для сохранения в API
     * @returns {Array} [{ id, title, content, ...data-attrs }]
     */
    function getData() {
      return selectedItems.map(item => {
        // Создаём временный элемент для применения изменений
        const tmp = document.createElement('div');
        tmp.innerHTML = item.content.trim();

        // Если купоны (expirableAttr), всегда добавляем/обновляем span.coupon_deadline
        if (opts.expirableAttr) {
          // Находим img и добавляем span после него
          const imgEl = tmp.querySelector('img');
          if (imgEl) {
            // Удаляем старый span если есть
            const oldSpan = imgEl.parentNode.querySelector('.coupon_deadline');
            if (oldSpan) oldSpan.remove();

            // Создаём новый span
            const deadlineSpan = document.createElement('span');
            deadlineSpan.className = 'coupon_deadline';

            if (item.expired_date) {
              // Конвертируем yyyy-mm-dd -> dd/mm/yy
              const parts = item.expired_date.split('-');
              if (parts.length === 3) {
                const year = parts[0].slice(2);
                const month = parts[1];
                const day = parts[2];
                deadlineSpan.textContent = `${day}/${month}/${year}`;
              }
            }
            // Если даты нет, span остаётся пустым

            // Вставляем span после img
            if (imgEl.nextSibling) {
              imgEl.parentNode.insertBefore(deadlineSpan, imgEl.nextSibling);
            } else {
              imgEl.parentNode.appendChild(deadlineSpan);
            }
          }
        }

        // Применяем title к атрибуту (если нужно)
        if (item.title) {
          const titleAttrElements = tmp.querySelectorAll(`[${opts.editableAttr}]`);
          titleAttrElements.forEach(el => {
            el.setAttribute(opts.editableAttr, item.title);
          });
        }

        // Собираем результат
        const result = {
          id: item.id,
          title: item.title || '',
          content: tmp.innerHTML.trim()
        };

        // Добавляем все data-* атрибуты (кроме id, title, content)
        Object.keys(item).forEach(key => {
          if (key !== 'id' && key !== 'title' && key !== 'content') {
            result[key] = item[key];
          }
        });

        return result;
      });
    }

    return { details, init, getData };
  }

  window.createChoicePanelJSON = createChoicePanelJSON;
})();
