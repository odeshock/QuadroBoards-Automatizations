/**
 * @typedef {Object} ReplaceFieldResult
 * @property {'updated'|'error'|'uncertain'} status
 * @property {string} fieldId
 * @property {string} value
 * @property {string=} serverMessage
 * @property {number=} httpStatus
 */

async function FMVreplaceFieldData(user_id, field_id, new_value) {
  const editUrl = `/profile.php?section=fields&id=${encodeURIComponent(user_id)}&nohead`;

  try {
    // A) загрузка формы
    const doc = await fetchCP1251Doc(editUrl);
    const FIELD_SELECTOR = '#fld' + field_id;
    const form = doc.querySelector('form#profile8')
      || [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('/profile.php'));
    if (!form) {
      return {
        status: 'error',
        fieldId: field_id,
        value: new_value,
        serverMessage: 'Форма редактирования профиля не найдена'
      };
    }

    // B) заполнение
    const fld = form.querySelector(FIELD_SELECTOR);
    if (!fld) {
      return {
        status: 'error',
        fieldId: field_id,
        value: new_value,
        serverMessage: `Поле ${FIELD_SELECTOR} не найдено`
      };
    }
    fld.value = new_value;

    if (![...form.elements].some(el => el.name === 'update')) {
      const hidden = doc.createElement('input');
      hidden.type = 'hidden'; hidden.name = 'update'; hidden.value = '1';
      form.appendChild(hidden);
    }

    // C) POST
    const postUrl = form.getAttribute('action') || '/profile.php';
    const body = serializeFormCP1251(form);
    const res = await fetch(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) {
      return {
        status: 'error',
        fieldId: field_id,
        value: new_value,
        httpStatus: res.status,
        serverMessage: `HTTP ${res.status} при сохранении`
      };
    }

    // D) контрольное чтение
    const doc2 = await fetchCP1251Doc(editUrl);
    const form2 = doc2.querySelector('form#profile8')
      || [...doc2.querySelectorAll('form')].find(f => (f.action||'').includes('/profile.php'));
    const v2 = form2?.querySelector(FIELD_SELECTOR)?.value ?? null;

    if (v2 === new_value) {
      return {
        status: 'updated',
        fieldId: field_id,
        value: new_value,
        httpStatus: res.status,
        serverMessage: 'Значение успешно обновлено'
      };
    }

    return {
      status: 'uncertain',
      fieldId: field_id,
      value: new_value,
      httpStatus: res.status,
      serverMessage: 'Не удалось подтвердить новое значение, проверьте вручную'
    };

  } catch (e) {
    const err = e?.message || String(e);
    const wrapped = new Error('Transport/Runtime error: ' + err);
    wrapped.cause = e;
    throw wrapped;
  }
}
