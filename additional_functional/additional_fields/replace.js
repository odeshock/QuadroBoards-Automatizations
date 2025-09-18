

// == УСТАНОВИТЬ ЗНАЧЕНИЕ ==
async function FMVreplaceFieldData(user_id, new_value) {
  try {
    const editUrl = `/profile.php?section=fields&id=${encodeURIComponent(user_id)}&nohead`;
    const doc = await fetchCP1251Doc(editUrl);

    // форма редактирования (на многих темах id="profile8"; подстрахуемся по action)
    const FIELD_SELECTOR = '#fld' + PROFILE_CHECK.PPageFieldID;
    const form = doc.querySelector('form#profile8') ||
                 [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('/profile.php'));
    if (!form) throw new Error('Не нашла форму редактирования профиля.');

    // ставим новое значение в #fld3 (в просмотре это pa-fld3)
    const fld = form.querySelector(FIELD_SELECTOR);
    if (!fld) throw new Error(`Поле ${FIELD_SELECTOR} не найдено. Проверьте номер fld.`);
    fld.value = PROFILE_CHECK.PPageFieldTemplate;

    // ensure name="update" присутствует (некоторые шаблоны требуют)
    if (![...form.elements].some(el => el.name === 'update')) {
      const hidden = doc.createElement('input');
      hidden.type = 'hidden'; hidden.name = 'update'; hidden.value = '1';
      form.appendChild(hidden);
    }

    // отправляем как x-www-form-urlencoded с cp1251 percent-encoding
    const postUrl = form.getAttribute('action') || '/profile.php';
    const body = serializeFormCP1251(form);
    const save = await fetch(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!save.ok) throw new Error(`POST ${postUrl} → HTTP ${save.status}`);

    // контрольное чтение (не обязательно, но полезно)
    const doc2 = await fetchCP1251Doc(editUrl);
    const form2 = doc2.querySelector('form#profile8') ||
                  [...doc2.querySelectorAll('form')].find(f => (f.action||'').includes('/profile.php'));
    const v2 = form2?.querySelector(FIELD_SELECTOR)?.value ?? null;

    console.log('✅ Установлено новое значение:', new_value, '| Прочитано из формы:', v2);
  } catch (e) {
    console.log('❌ Ошибка:', e);
  }
};
