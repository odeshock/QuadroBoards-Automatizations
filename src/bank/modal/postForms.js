// ============================================================================
// postForms.js — Формы начислений за посты (первый пост, личные, сюжетные, листовки)
// ============================================================================

import {
  COUNTER_POLL_INTERVAL_MS,
  FIRST_POST_TIMEOUT_MS,
  ADS_TIMEOUT_MS
} from '../config.js';

import {
  formatNumber,
  parseNumericAmount
} from '../services.js';

import {
  TEXT_MESSAGES,
  FORM_INCOME_FIRSTPOST,
  FORM_INCOME_FLYER,
  POST_FORMS
} from '../constants.js';

import {
  POST_CONFIG
} from './config.js';

import {
  updateModalAmount,
  updateNote,
  setHiddenField
} from '../results.js';

import {
  showErrorMessage
} from './helpers.js';

export function normalizePostItem(raw) {
  const candidate = (raw && (raw.link || raw.a || raw)) || raw || null;
  const src = candidate && typeof candidate.src === 'string' ? candidate.src : null;
  if (!src) return null;
  const text = candidate.text || src;
  const symbolsRaw = candidate.symbols_num;
  const numericSymbols = Number.isFinite(symbolsRaw)
    ? symbolsRaw
    : Number.parseInt(typeof symbolsRaw === 'string' ? symbolsRaw : '', 10) || 0;
  return { src, text, symbols_num: Math.max(0, numericSymbols) };
}

export function setupPostsModalFlow({
  modalFields,
  btnSubmit,
  counterWatcher,
  form,
  modalAmount,
  modalAmountLabel,
  hiddenFieldName,
  postsKey,
  timeoutMs,
  previewId,
  infoBuilder,
  additionalItemsAggregator,
  itemCountFilter,
  data
}) {
  const waitEl = updateNote(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  const price = Number(form.dataset.price) || 0;
  const bonus = Number(form.dataset.bonus) || 0;

  // Создаем system-info блок и вставляем после .info
  const systemInfo = document.createElement('div');
  systemInfo.className = 'system-info';
  systemInfo.innerHTML = infoBuilder({ price, bonus });

  const infoBlock = modalFields.querySelector('.info');
  if (infoBlock) {
    infoBlock.insertAdjacentElement('afterend', systemInfo);
  } else if (waitEl && waitEl.parentNode) {
    waitEl.parentNode.insertBefore(systemInfo, waitEl);
  } else {
    modalFields.appendChild(systemInfo);
  }

  let canceled = false;
  let poll = null;
  let timeoutHandle = null;

  const cancel = () => {
    canceled = true;
    if (poll) clearInterval(poll);
    if (timeoutHandle) clearTimeout(timeoutHandle);
  };

  counterWatcher = { cancel };

  const setSummary = (count, additionalItems) => {
    modalAmountLabel.textContent = form.dataset.amountLabel || 'Начисление';
    updateModalAmount(modalAmount, form, {
      items: count,
      additional_items: additionalItems
    });
  };

  const fail = () => {
    if (canceled) return;
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    btnSubmit.style.display = 'none';
    setHiddenField(modalFields, hiddenFieldName, '');
    cancel();
  };

  const renderList = (items) => {
    const caption = document.createElement('p');
    caption.className = 'list-caption';
    caption.innerHTML = '<strong>Список постов:</strong>';
    modalFields.appendChild(caption);

    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `
      <div style="max-height:320px; overflow:auto">
        <ol class="entry-list" id="${previewId}"></ol>
      </div>`;
    modalFields.appendChild(wrap);

    const listEl = wrap.querySelector(`#${previewId}`);
    items.forEach(({ src, text, symbols_num }) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = src;
      link.textContent = text || src;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      li.appendChild(link);
      li.appendChild(document.createTextNode(` [${symbols_num} символов]`));
      listEl.appendChild(li);
    });
  };

  const succeed = (posts) => {
    if (canceled) return;

    // Сначала проверяем пустоту
    if (!Array.isArray(posts) || posts.length === 0) {
      // Удаляем "Пожалуйста, подождите..."
      const waitEl = modalFields.querySelector('.muted-note');
      if (waitEl) waitEl.remove();

      // Создаем сообщение и вставляем после system-info/info
      const msg = document.createElement('p');
      msg.innerHTML = '<strong>Для новых начислений не хватает новых постов.</strong>';

      const anchor = modalFields.querySelector('.system-info') || modalFields.querySelector('.info');
      if (anchor) {
        anchor.insertAdjacentElement('afterend', msg);
      } else {
        modalFields.appendChild(msg);
      }

      btnSubmit.style.display = 'none';
      setHiddenField(modalFields, hiddenFieldName, '');
      setSummary(0, 0);
      cancel();
      return;
    }

    // Потом нормализуем
    const items = posts.map(normalizePostItem).filter(Boolean);
    if (!items.length) {
      // Удаляем "Пожалуйста, подождите..."
      const waitEl = modalFields.querySelector('.muted-note');
      if (waitEl) waitEl.remove();

      // Создаем сообщение и вставляем после system-info/info
      const msg = document.createElement('p');
      msg.innerHTML = '<strong>Для новых начислений не хватает новых постов.</strong>';

      const anchor = modalFields.querySelector('.system-info') || modalFields.querySelector('.info');
      if (anchor) {
        anchor.insertAdjacentElement('afterend', msg);
      } else {
        modalFields.appendChild(msg);
      }

      btnSubmit.style.display = 'none';
      setHiddenField(modalFields, hiddenFieldName, '');
      setSummary(0, 0);
      cancel();
      return;
    }

    setHiddenField(modalFields, hiddenFieldName, JSON.stringify(items));

    const note = updateNote(modalFields, '');
    if (note) note.remove();

    renderList(items);

    const additionalItems = additionalItemsAggregator ? additionalItemsAggregator(items) : 0;
    const itemCount = itemCountFilter ? itemCountFilter(items) : items.length;
    console.log('📊 Post calculation:', { items, itemCount, additionalItems, hasAggregator: !!additionalItemsAggregator });
    setSummary(itemCount, additionalItems);

    form.dataset.currentMultiplier = String(itemCount);
    btnSubmit.style.display = '';
    btnSubmit.disabled = false;
    cancel();
  };

  // Если есть data (редактирование/восстановление), сразу используем данные
  if (data && data[hiddenFieldName]) {
    try {
      const posts = JSON.parse(data[hiddenFieldName]);
      if (Array.isArray(posts)) {
        succeed(posts);
        return counterWatcher;
      }
    } catch (e) {
      console.error('Failed to parse posts JSON from data:', e);
    }
  }

  const globalObj = typeof window !== 'undefined' ? window : undefined;

  timeoutHandle = setTimeout(fail, timeoutMs);

  poll = setInterval(() => {
    if (!globalObj) return;
    const value = globalObj[postsKey];
    if (typeof value !== 'undefined' && !Array.isArray(value)) {
      fail();
      return;
    }
    if (Array.isArray(value)) {
      clearInterval(poll);
      poll = null;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      succeed(value);
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return counterWatcher;
}


// ============================================================================
// HANDLER: FIRST POST FORM
// ============================================================================

export function handleFirstPostForm({ template, modalFields, btnSubmit, counterWatcher }) {
  if (template.id !== FORM_INCOME_FIRSTPOST) return { handled: false, counterWatcher };

  // якорь "подождите..."
  const waitEl = updateNote(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  let canceled = false;
  const cancel = () => { canceled = true; clearInterval(poll); clearTimeout(to); };
  counterWatcher = { cancel };

  const fail = () => {
    if (canceled) return;
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
    btnSubmit.style.display = 'none';
    cancel();
  };

  const show = (html, { ok = false, hideBtn = true } = {}) => {
    const el = updateNote(modalFields, html);
    if (ok && el) el.style.color = 'var(--ok)'; // зелёный для «Поздравляем…»
    btnSubmit.style.display = hideBtn ? 'none' : '';
    btnSubmit.disabled = hideBtn ? true : false;
  };

  const to = setTimeout(fail, FIRST_POST_TIMEOUT_MS);
  const poll = setInterval(() => {
    // Проверяем наличие FIRST_POST_FLAG
    if (typeof window.FIRST_POST_FLAG === 'undefined') return;

    // Если флаг есть, но не boolean — ошибка
    if (typeof window.FIRST_POST_FLAG !== 'boolean') {
      fail(); return;
    }

    // Если FIRST_POST_FLAG = false — сразу выходим успешно (уже выплачивалось)
    if (window.FIRST_POST_FLAG === false) {
      clearTimeout(to);
      clearInterval(poll);
      show('**Начисление за первый пост на профиле уже производилось.**', { hideBtn: true });
      cancel();
      return;
    }

    // FIRST_POST_FLAG = true — проверяем условия по мере появления переменных

    // Проверяем PERSONAL_POSTS
    if (typeof window.PERSONAL_POSTS !== 'undefined') {
      if (!Array.isArray(window.PERSONAL_POSTS)) {
        fail(); return;
      }
      if (window.PERSONAL_POSTS.length > 0) {
        clearTimeout(to);
        clearInterval(poll);
        show('**Поздравляем с первым постом!**', { ok: true, hideBtn: false });
        cancel();
        return;
      }
    }

    // Проверяем PLOT_POSTS
    if (typeof window.PLOT_POSTS !== 'undefined') {
      if (!Array.isArray(window.PLOT_POSTS)) {
        fail(); return;
      }
      if (window.PLOT_POSTS.length > 0) {
        clearTimeout(to);
        clearInterval(poll);
        show('**Поздравляем с первым постом!**', { ok: true, hideBtn: false });
        cancel();
        return;
      }
    }

    // Проверяем FIRST_POST_MISSED_FLAG
    if (typeof window.FIRST_POST_MISSED_FLAG !== 'undefined') {
      if (window.FIRST_POST_MISSED_FLAG === true) {
        clearTimeout(to);
        clearInterval(poll);
        show('**Поздравляем с первым постом!**', { ok: true, hideBtn: false });
        cancel();
        return;
      }
    }

    // Если все три переменные появились, но ни одно условие не выполнено
    if (typeof window.PERSONAL_POSTS !== 'undefined' &&
        typeof window.PLOT_POSTS !== 'undefined' &&
        typeof window.FIRST_POST_MISSED_FLAG !== 'undefined') {
      clearTimeout(to);
      clearInterval(poll);
      show('**Для начисления не хватает поста.**', { hideBtn: true });
      cancel();
    }
  }, COUNTER_POLL_INTERVAL_MS);

  return { handled: true, counterWatcher };
}

// ============================================================================
// HANDLER: POST FORMS
// ============================================================================

export function handlePostForms({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, modalAmountLabel, data }) {
  if (!POST_FORMS.includes(template.id)) return { handled: false, counterWatcher };

  const config = POST_CONFIG[template.id];
  counterWatcher = setupPostsModalFlow({
    modalFields,
    btnSubmit,
    counterWatcher,
    form,
    modalAmount,
    modalAmountLabel,
    data,
    ...config
  });
  return { handled: true, counterWatcher };
}

// ============================================================================
// HANDLER: FLYER FORM
// ============================================================================

export function handleFlyerForm({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, amount, price }) {
  if (template.id !== FORM_INCOME_FLYER) return { handled: false, counterWatcher };

  // показываем «ждём…» (у вас уже есть <p class="muted-note">Пожалуйста, подождите...</p>)
  updateNote(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  // Добавляем system-info блок сразу после элемента .info
  const infoBlock = modalFields.querySelector('.info');
  if (infoBlock) {
    const systemInfo = document.createElement('div');
    systemInfo.className = 'system-info';
    systemInfo.innerHTML = `<strong>Система подсчета:</strong> за каждую листовку, размещенную с <strong>Вашего профиля</strong> — ${formatNumber(price)}.`;
    infoBlock.insertAdjacentElement('afterend', systemInfo);
  }

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
    showErrorMessage(modalFields, TEXT_MESSAGES.ERROR_REFRESH);
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
      // Удаляем "Пожалуйста, подождите..."
      const waitEl = modalFields.querySelector('.muted-note');
      if (waitEl) waitEl.remove();

      // Создаем сообщение и вставляем после system-info
      const msg = document.createElement('p');
      msg.innerHTML = '<strong>Для новых начислений не хватает новых реклам.</strong>';

      const systemInfo = modalFields.querySelector('.system-info');
      if (systemInfo) {
        systemInfo.insertAdjacentElement('afterend', msg);
      } else {
        const infoBlock = modalFields.querySelector('.info');
        if (infoBlock) {
          infoBlock.insertAdjacentElement('afterend', msg);
        } else {
          modalFields.appendChild(msg);
        }
      }

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
    caption.innerHTML = '<strong>Список найденных листовок:</strong>';

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

  return { handled: true, counterWatcher };
}

