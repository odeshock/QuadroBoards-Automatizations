// ============================= EDIT (update) =============================
/**
 * Обновляет персональную страницу в админке.
 *
 * @param {string} name               Адресное имя (например "usr2_skin")
 * @param {Object} patch              Что меняем
 * @param {string=} patch.title       Новый заголовок (если нужно)
 * @param {string=} patch.content     Новый HTML для textarea (#page-content)
 * @param {string|number=} patch.announcement  "0"|"1" или соответствующее значение селекта/радио
 * @param {string=} patch.tags        Строка тегов
 * @param {number[]=} patch.groupsOn  Список ID групп, которые должны быть включены (галочки)
 * @param {number[]=} patch.groupsOff Список ID групп, которые должны быть сняты
 *
 * @returns {Promise<{status:'saved'|'error'|'forbidden'|'notfound'|'unknown', serverMessage?:string, httpStatus?:number, url?:string}>}
 */
async function FMVeditPersonalPage(name, patch = {}) {
  if (!name) throw new Error('FMVeditPersonalPage: "name" is required');

  const editUrl = `/admin_pages.php?edit_page=${encodeURIComponent(name)}`;

  // --- 1) грузим HTML формы в CP1251 ---
  const doc = await (typeof fetchCP1251Doc === 'function'
    ? fetchCP1251Doc(editUrl)
    : (async () => {
        const html = await fetch(editUrl, { credentials:'include' }).then(r => r.text());
        return new DOMParser().parseFromString(html, 'text/html');
      })()
  );

  // Проверка на «нет доступа / устаревшая ссылка / инфо-страница»
  const bodyText = (doc.body && doc.body.textContent || '').trim();
  if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText)) {
    return { status:'forbidden', serverMessage:'Ссылка неверная или устаревшая', url:editUrl };
  }

  const form = [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('admin_pages.php'))
            || doc.querySelector('form');
  if (!form) {
    return { status:'notfound', serverMessage:'Форма редактирования не найдена', url:editUrl };
  }

  // --- 2) подставляем значения в DOM формы ---
  // title
  if (patch.title != null) {
    const t = form.querySelector('[name="title"]'); if (t) t.value = String(patch.title);
  }
  // content
  if (patch.content != null) {
    const ta = form.querySelector('#page-content,[name="content"]'); if (ta) ta.value = String(patch.content);
  }
  // announcement (select или radio)
  if (patch.announcement != null) {
    const annSel = form.querySelector('select[name="announcement"]');
    if (annSel) annSel.value = String(patch.announcement);
    else {
      const radios = [...form.querySelectorAll('input[name="announcement"]')];
      if (radios.length) radios.forEach(r => r.checked = (r.value == patch.announcement));
    }
  }
  // tags
  if (patch.tags != null) {
    const tags = form.querySelector('[name="tags"]'); if (tags) tags.value = String(patch.tags);
  }
  // groups (checkboxes like name="group[ID]")
  if (Array.isArray(patch.groupsOn)) {
    for (const id of patch.groupsOn) {
      const cb = form.querySelector(`[name="group[${id}]"]`); if (cb) cb.checked = true;
    }
  }
  if (Array.isArray(patch.groupsOff)) {
    for (const id of patch.groupsOff) {
      const cb = form.querySelector(`[name="group[${id}]"]`); if (cb) cb.checked = false;
    }
  }

  // --- 3) выбираем корректное имя сабмита ---
  // Обычно "save", но подстрахуемся: ищем submit-кнопку с текстом "Сохранить"
  let submitName = 'save';
  const saveBtn = [...form.elements].find(el =>
    el.type === 'submit' && (
      el.name === 'save' || /сохр|save/i.test(el.value || el.textContent || '')
    )
  );
  if (saveBtn?.name) submitName = saveBtn.name;

  // --- 4) сериализация формы в CP1251 + POST ---
  let res, text;
  
  // ВАЖНО: постим на фактический action формы (обычно "/admin_pages.php")
  const postUrl = new URL(form.getAttribute('action') || editUrl, location.origin).toString();
  
  if (typeof serializeFormCP1251_SelectSubmit === 'function' && typeof fetchCP1251Text === 'function') {
    const body = serializeFormCP1251_SelectSubmit(form, submitName);
    ({ res, text } = await fetchCP1251Text(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=windows-1251' },
      referrer: editUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    }));
  } else {
    const fd = new FormData(form);
    fd.append(submitName, saveBtn?.value || '1');
    res  = await fetch(postUrl, { method:'POST', credentials:'include', body: fd });
    text = await res.text();
  }

  // --- 5) анализ ответа ---
  const okByText = /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text);
  const msg = (typeof extractInfoMessage === 'function' ? extractInfoMessage(text) : '') || '';

  const redirectedToAdminList =
    res.ok &&
    (res.url && /\/admin_pages\.php(?:\?|$)/.test(res.url)) &&
    !/ошибк|forbidden|нет прав|устаревш/i.test((text || '').toLowerCase());

  if (res.ok && (okByText || redirectedToAdminList)) {
    return { status:'saved', serverMessage: msg || 'Изменения сохранены', httpStatus: res.status, url: editUrl };
  }

  // если есть твой классификатор — используем
  let cls = { status:'unknown', msg };
  if (typeof classifyResult === 'function') {
    try { cls = classifyResult(text); } catch {}
  }
  if (/ошибк|forbidden|нет прав|устаревш/i.test((msg || cls.msg || '').toLowerCase())) {
    return { status:'forbidden', serverMessage: msg || cls.msg || 'Нет прав/ошибка сохранения', httpStatus: res.status, url: editUrl };
  }

  return { status:'error', serverMessage: msg || 'Ошибка сохранения', httpStatus: res.status, url: editUrl };
}
// =========================== /EDIT (update) ============================

/**
 * Удобный шорткат: заменить только textarea (#page-content).
 * @param {string} name
 * @param {string} newHtml
 */
async function FMVeditTextareaOnly(name, newHtml) {
  return FMVeditPersonalPage(name, { content: newHtml });
}
