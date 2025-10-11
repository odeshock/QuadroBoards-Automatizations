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
  additionalItemsAggregator
}) {
  const waitEl = updateNote(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

  const price = Number(form.dataset.price) || 0;
  const bonus = Number(form.dataset.bonus) || 0;

  const info = document.createElement('div');
  info.className = 'calc-info';
  info.innerHTML = infoBuilder({ price, bonus });

  if (waitEl && waitEl.parentNode) {
    waitEl.parentNode.insertBefore(info, waitEl);
  } else {
    modalFields.appendChild(info);
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
    updateNote(modalFields, 'Произошла ошибка. Попробуйте обновить страницу.', { error: true });
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

    const items = Array.isArray(posts) ? posts.map(normalizePostItem).filter(Boolean) : [];
    if (!items.length) {
      updateNote(modalFields, '**Для новых начислений не хватает новых постов.**');
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

    const additionalItems = additionalItemsAggregator(items);
    setSummary(items.length, additionalItems);

    form.dataset.currentMultiplier = String(items.length);
    btnSubmit.style.display = '';
    btnSubmit.disabled = false;
    cancel();
  };

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

  return { handled: true, counterWatcher };
}

// ============================================================================
// HANDLER: POST FORMS
// ============================================================================

export function handlePostForms({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, modalAmountLabel }) {
  if (!POST_FORMS.includes(template.id)) return { handled: false, counterWatcher };

  const config = POST_CONFIG[template.id];
  counterWatcher = setupPostsModalFlow({
    modalFields,
    btnSubmit,
    counterWatcher,
    form,
    modalAmount,
    modalAmountLabel,
    ...config
  });
  return { handled: true, counterWatcher };
}

// ============================================================================
// HANDLER: FLYER FORM
// ============================================================================

export function handleFlyerForm({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, amount }) {
  if (template.id !== FORM_INCOME_FLYER) return { handled: false, counterWatcher };

  // показываем «ждём…» (у вас уже есть <p class="muted-note">Пожалуйста, подождите...</p>)
  updateNote(modalFields, TEXT_MESSAGES.PLEASE_WAIT);

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

  return { handled: true, counterWatcher };
}

