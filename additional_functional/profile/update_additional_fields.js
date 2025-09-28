/**
 * @typedef {Object} ReplaceFieldResult
 * @property {'updated'|'error'|'uncertain'} status
 * @property {string} fieldId
 * @property {string} value
 * @property {string=} serverMessage
 * @property {number=} httpStatus
 * @property {string=} details
 */

/**
 * Обновляет пользовательское поле профиля «как из формы», даже если вы не на странице редактирования.
 * Требует: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit.
 *
 * @param {string|number} user_id
 * @param {string|number} field_id           // без # — только номер (например "3")
 * @param {string} new_value
 * @param {boolean} [overwriteIfExists=false] // если true — перезаписывать даже если там уже «что-то» есть
 * @returns {Promise<ReplaceFieldResult>}
 */
async function FMVreplaceFieldData(user_id, field_id, new_value, overwriteIfExists = false) {
  const editUrl = `/profile.php?section=fields&id=${encodeURIComponent(user_id)}&nohead`;
  const FIELD_SELECTOR = '#fld' + field_id;

  // helper: "есть ли что-то" — всё, кроме "", " ", "0"
  const hasSomething = (v) => v !== '' && v !== ' ' && v !== '0';

  try {
    // A) загрузка формы редактирования
    const doc = await fetchCP1251Doc(editUrl);

    // форма редактирования (часто id="profile8"; подстрахуемся по action)
    const form =
      doc.querySelector('form#profile8') ||
      [...doc.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));

    if (!form) {
      return {
        status: 'error',
        fieldId: String(field_id),
        value: new_value,
        serverMessage: 'Форма редактирования профиля не найдена',
        details: 'profile.php без формы'
      };
    }

    // B0) найдём поле и прочитаем текущее значение ДО изменения
    const fld = form.querySelector(FIELD_SELECTOR);
    if (!fld) {
      return {
        status: 'error',
        fieldId: String(field_id),
        value: new_value,
        serverMessage: `Поле ${FIELD_SELECTOR} не найдено. Проверьте номер fld.`
      };
    }

    const prevValue = fld.value ?? '';

    // B1) если уже есть «что-то» и перезаписывать нельзя — выходим с ошибкой и сообщением
    if (hasSomething(prevValue) && !overwriteIfExists) {
      return {
        status: 'nochange',
        fieldId: String(field_id),
        value: new_value,
        serverMessage: 'Поле уже содержит значение. Перезапись запрещена.',
        details: `Прежнее значение: ${String(prevValue)}`
      };
    }

    // B2) заполнение нового значения
    fld.value = new_value;

    // ensure name="update" (некоторые шаблоны требуют наличия этого поля)
    if (![...form.elements].some(el => el.name === 'update')) {
      const hidden = doc.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'update';
      hidden.value = '1';
      form.appendChild(hidden);
    }

    // C) выбрать реальное имя submit-кнопки (как в create)
    let submitName = 'update';
    const submitEl = [...form.elements].find(el =>
      el.type === 'submit' && (el.name || /сохран|обнов/i.test(el.value || ''))
    );
    if (submitEl?.name) submitName = submitEl.name;

    // сериализация формы с учётом выбранного submit
    const body = serializeFormCP1251_SelectSubmit(form, submitName);

    // D) POST «как будто со страницы редактирования» — важен referrer
    const postUrl = form.getAttribute('action') || '/profile.php';
    const { res } = await fetchCP1251Text(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      referrer: editUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    });

    if (!res.ok) {
      return {
        status: 'error',
        fieldId: String(field_id),
        value: new_value,
        httpStatus: res.status,
        serverMessage: `HTTP ${res.status} при сохранении`
      };
    }

    // E) контрольное чтение — подтверждаем, что значение действительно сохранилось
    const doc2 = await fetchCP1251Doc(editUrl);
    const form2 =
      doc2.querySelector('form#profile8') ||
      [...doc2.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));
    const v2 = form2?.querySelector(FIELD_SELECTOR)?.value ?? null;

    if (v2 === new_value) {
      return {
        status: 'updated',
        fieldId: String(field_id),
        value: new_value,
        httpStatus: res.status,
        serverMessage: 'Значение успешно обновлено'
      };
    }

    // сервер ответил 200, но подтвердить новое значение не удалось
    return {
      status: 'uncertain',
      fieldId: String(field_id),
      value: new_value,
      httpStatus: res.status,
      serverMessage: 'Не удалось подтвердить новое значение, проверьте вручную'
    };

  } catch (e) {
    // транспорт/исключения — наружу в виде throw (как в create)
    const err = (e && e.message) ? e.message : String(e);
    const wrapped = new Error('Transport/Runtime error: ' + err);
    wrapped.cause = e;
    throw wrapped;
  }
}

// (по желанию) экспорт в глобал, если требуется из других скриптов
// window.FMVreplaceFieldData = FMVreplaceFieldData;
