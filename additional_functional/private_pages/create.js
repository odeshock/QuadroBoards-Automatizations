// === проверка через ?edit_page=SLUG ===
async function pageExistsViaEditEndpoint(slug){
  // если в slug есть небезопасные символы — энкодим как в адресной строке (но сам движок принимает ASCII)
  const url = `/admin_pages.php?edit_page=${encodeURIComponent(slug)}`;
  const doc = await fetchCP1251Doc(url);

  // надёжные признаки страницы «редактирование»:
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const h1    = (doc.querySelector('h1, .pagetitle, .tclcon h2')?.textContent || '').trim();

  const looksLikeEditTitle =
    'Страница создана'

  // форма редактирования обычно содержит hidden name="edit_page" или submit "Сохранить"
  const hasEditHidden = !!doc.querySelector('input[name="edit_page"]');
  const hasSaveBtn = !![...doc.querySelectorAll('input[type="submit"],button[type="submit"]')]
    .find(b => /сохран/i.test(b.value||b.textContent||''));

  // страница «Информация»:
  const looksLikeInfo = /Информация/i.test(title) || /Информация/i.test(h1);

  if (looksLikeEditTitle || hasEditHidden || hasSaveBtn) return true;
  if (looksLikeInfo) return false;

  // fallback: если нет явных признаков, считаем что не существует
  return false;
}

// тянем текст сообщения из «Информация»
function extractInfoMessage(html){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const containers = [
    ...doc.querySelectorAll('.message, .msg, .infobox, .warn, .error, #pun-main p, .block p, .box p')
  ];
  const text = containers.map(n => n.textContent.trim()).filter(Boolean).join('\n').trim();
  return (title ? `[${title}] ` : '') + (text || '').trim();
}

function classifyResult(html){
  const msg = extractInfoMessage(html).toLowerCase();
  if (/уже существует|занято|должно быть уникаль/.test(msg)) return {status:'duplicate', msg};
  if (/страница создана|добавлен|успешно|сохранена/.test(msg))  return {status:'created', msg};
  if (/ошибка|forbidden|нет прав|не удалось|некоррект|заполните/.test(msg)) return {status:'error', msg};
  // когда движок просто возвращает список без явного сообщения
  return {status:'unknown', msg};
}

// === ГЛАВНЫЙ ФЛОУ ===
/**
 * @typedef {Object} CreatePageResult
 * @property {'created'|'exists'|'error'|'uncertain'} status
 * @property {string} title
 * @property {string} name
 * @property {string=} serverMessage
 * @property {number=} httpStatus
 * @property {string=} url
 * @property {string=} details
 */

/**
 * Возвращает промис с результатом; транспортные сбои — через throw/reject.
 */
async function FMVcreatePersonalPage(new_title, new_name, new_content, new_tags, enable_group_ids, announcement) {
  const addUrl = '/admin_pages.php?action=adddel';

  try {
    // A) проверка существования
    const existedBefore = await pageExistsViaEditEndpoint(new_name);
    if (existedBefore) {
      return /** @type {CreatePageResult} */({
        status: 'exists',
        title: new_title,
        name: new_name,
        serverMessage: `Страница "${new_name}" уже существует (до отправки формы).`,
        url: `/admin_pages.php?edit_page=${encodeURIComponent(new_name)}`
      });
    }

    // B) загрузка формы
    const doc = await fetchCP1251Doc(addUrl);
    const form = [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('/admin_pages.php'))
              || doc.querySelector('form[action*="admin_pages.php"]');
    if (!form) {
      return {
        status: 'error',
        title: new_title,
        name: new_name,
        serverMessage: 'Форма добавления не найдена',
        details: 'admin_pages.php без формы'
      };
    }

    // C) заполнение
    (form.querySelector('[name="title"]')   || {}).value = new_title;
    (form.querySelector('[name="name"]')    || {}).value = new_name;
    (form.querySelector('[name="content"]') || {}).value = new_content;
    const tags = form.querySelector('[name="tags"]'); if (tags) tags.value = new_tags;
    const annSel = form.querySelector('select[name="announcement"]');
    if (annSel) annSel.value = announcement;
    else [...form.querySelectorAll('input[name="announcement"]')].forEach(r => r.checked = (r.value===announcement));
    for (const id of enable_group_ids) {
      const cb = form.querySelector(`[name="group[${id}]"]`); if (cb) cb.checked = true;
    }

    let submitName = 'add_page';
    const addBtn = [...form.elements].find(el => el.type==='submit' && (el.name==='add_page' || /создать/i.test(el.value||'')));
    if (addBtn?.name) submitName = addBtn.name;

    const body = serializeFormCP1251_SelectSubmit(form, submitName);

    // D) POST
    const {res, text} = await fetchCP1251Text(addUrl, {
      method:'POST',
      credentials:'include',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      referrer: addUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    });

    const resultParsed = classifyResult(text);          // ваша текущая функция-классификатор
    const serverMsg = extractInfoMessage(text) || '';   // ваша функция извлечения сообщения

    // E) окончательная проверка
    const existsAfter = await pageExistsViaEditEndpoint(new_name);

    // --- нормализация в единый формат ---
    if (resultParsed.status === 'created' || existsAfter) {
      console.log(serverMsg || 'Страница создана');
      return {
        status: 'created',
        title: new_title,
        name: new_name,
        serverMessage: serverMsg || 'Страница создана',
        httpStatus: res.status,
        url: `/admin_pages.php?edit_page=${encodeURIComponent(new_name)}`
      };
    }

    if (resultParsed.status === 'duplicate') {
      console.log(serverMsg || 'Уже существует страница с таким адресным именем');
      return {
        status: 'exists',
        title: new_title,
        name: new_name,
        serverMessage: serverMsg || 'Уже существует страница с таким адресным именем',
        httpStatus: res.status,
        url: `/admin_pages.php?edit_page=${encodeURIComponent(new_name)}`
      };
    }

    if (resultParsed.status === 'error') {
      console.log(resultParsed.msg || serverMsg || 'Ошибка при создании');
      return {
        status: 'error',
        title: new_title,
        name: new_name,
        serverMessage: resultParsed.msg || serverMsg || 'Ошибка при создании',
        httpStatus: res.status
      };
    }

    console.log(serverMsg || 'Не удалось подтвердить создание. Проверьте админку.');
    return {
      status: 'uncertain',
      title: new_title,
      name: new_name,
      serverMessage: serverMsg || 'Не удалось подтвердить создание. Проверьте админку.',
      httpStatus: res.status
    };

  } catch (e) {
    // транспорт/исключения — наружу
    const err = (e && e.message) ? e.message : String(e);
    const wrapped = new Error('Transport/Runtime error: ' + err);
    wrapped.cause = e;
    console.log(err);
    throw wrapped;
  }
}
