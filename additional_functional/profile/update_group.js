/**
 * @typedef {Object} UpdateGroupResult
 * @property {'updated'|'skipped'|'nochange'|'uncertain'|'error'} status
 * @property {string} userId
 * @property {string} fromGroupId
 * @property {string} toGroupId
 * @property {number=} httpStatus
 * @property {string=} serverMessage
 * @property {string=} details
 */

/**
 * Смена группы пользователя «как из формы администрирования», но только если текущее значение
 * равно указанному fromGroupId. Иначе — пропуск без изменений.
 *
 * Требует: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit.
 *
 * @param {string|number} user_id
 * @param {string|number} fromGroupId  // менять только из этой группы…
 * @param {string|number} toGroupId    // …вот на эту
 * @param {{ overwriteSame?: boolean }} [opts]
 * @returns {Promise<UpdateGroupResult>}
 */
async function FMVupdateGroupIfEquals(user_id, fromGroupId, toGroupId, opts = {}) {
  const overwriteSame = !!opts.overwriteSame;
  const uid = String(user_id);
  const editUrl = `/profile.php?section=admin&id=${encodeURIComponent(uid)}&nohead`;

  try {
    // A) Загрузка страницы администрирования (режим без шапки — быстрее парсится)
    const doc = await fetchCP1251Doc(editUrl);

    // На некоторых стилях id формы различается — ищем по action
    const form =
      doc.querySelector('form#profile8') ||
      [...doc.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));
    if (!form) {
      return {
        status: 'error',
        userId: uid, fromGroupId: String(fromGroupId), toGroupId: String(toGroupId),
        serverMessage: 'Форма администрирования профиля не найдена',
        details: 'profile.php?section=admin без ожидаемой формы'
      };
    }

    // B) Определяем select группы
    const sel =
      form.querySelector('select[name="group_id"]') ||
      form.querySelector('#group_id');
    if (!sel) {
      return {
        status: 'error',
        userId: uid, fromGroupId: String(fromGroupId), toGroupId: String(toGroupId),
        serverMessage: 'Селектор group_id не найден',
      };
    }

    // C) Читаем актуальное значение
    const current = (sel.value ?? '').trim();
    const fromStr = String(fromGroupId).trim();
    const toStr   = String(toGroupId).trim();

    // Если уже в целевой группе
    if (current === toStr && !overwriteSame) {
      return {
        status: 'nochange',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        serverMessage: 'Пользователь уже в целевой группе; перезапись отключена',
        details: `current=${current}`
      };
    }

    // Если текущее значение НЕ совпадает с «разрешённым исходным» — пропускаем
    if (current !== fromStr && !(current === toStr && overwriteSame)) {
      return {
        status: 'skipped',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        serverMessage: 'Текущая группа не совпадает с fromGroupId — изменения не требуются',
        details: `current=${current}`
      };
    }

    // D) Готовим форму к отправке «как из UI»
    sel.value = toStr;

    // Убедимся, что присутствует скрытое поле form_sent=1
    if (![...form.elements].some(el => el.name === 'form_sent')) {
      const hidden = doc.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'form_sent';
      hidden.value = '1';
      form.appendChild(hidden);
    }

    // Определяем имя submit-кнопки (на rusff обычно update_group_membership)
    let submitName = 'update_group_membership';
    const submitEl = [...form.elements].find(el =>
      el.type === 'submit' && (el.name || /сохран|обнов/i.test(el.value || ''))
    );
    if (submitEl?.name) submitName = submitEl.name;

    // E) Сериализуем так же, как «нажатие нужной кнопки» (CP1251)
    const body = serializeFormCP1251_SelectSubmit(form, submitName);

    // F) POST на action формы с корректным referrer
    const postUrl = form.getAttribute('action') || `/profile.php?section=admin&id=${encodeURIComponent(uid)}`;
    const { res, text } = await fetchCP1251Text(postUrl, {
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
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        httpStatus: res.status,
        serverMessage: `HTTP ${res.status} при сохранении`
      };
    }

    // G) Контрольное чтение — убедимся, что селект действительно стал toStr
    const doc2 = await fetchCP1251Doc(editUrl);
    const form2 =
      doc2.querySelector('form#profile8') ||
      [...doc2.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));
    const sel2 = form2?.querySelector('select[name="group_id"]') || form2?.querySelector('#group_id');
    const v2 = (sel2?.value ?? '').trim();

    if (v2 === toStr) {
      return {
        status: 'updated',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        httpStatus: res.status,
        serverMessage: 'Группа успешно обновлена'
      };
    }

    return {
      status: 'uncertain',
      userId: uid, fromGroupId: fromStr, toGroupId: toStr,
      httpStatus: res.status,
      serverMessage: 'Сервер ответил 200, но подтвердить новое значение не удалось — проверьте вручную',
      details: `readback=${v2}`
    };

  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return {
      status: 'error',
      userId: String(user_id),
      fromGroupId: String(fromGroupId),
      toGroupId: String(toGroupId),
      serverMessage: 'Transport/Runtime error',
      details: msg
    };
  }
}

/* Пример использования:
   // Если пользователь (id=4) сейчас в группе 1 — перевести в 3
   FMVupdateGroupIfEquals(4, 1, 3).then(console.log).catch(console.error);

   // То же, но если он уже в 3 — повторно «сохранить» (редко нужно)
   FMVupdateGroupIfEquals(4, 1, 3, { overwriteSame: true }).then(console.log);
*/
