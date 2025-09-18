// === проверка через ?edit_page=SLUG ===
async function pageExistsViaEditEndpoint(slug){
  // если в slug есть небезопасные символы — энкодим как в адресной строке (но сам движок принимает ASCII)
  const url = `/admin_pages.php?edit_page=${encodeURIComponent(slug)}`;
  const doc = await fetchCP1251Doc(url);

  // надёжные признаки страницы «редактирование»:
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const h1    = (doc.querySelector('h1, .pagetitle, .tclcon h2')?.textContent || '').trim();

  const looksLikeEditTitle =
    /Администрирование/i.test(title) && /Страниц/i.test(title) ||
    /Администрирование/i.test(h1)   && /Страниц/i.test(h1);

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
async function FMVcreatePersonalPage(new_title, new_name, new_content, new_tags, enable_group_ids, announcement) {
  try{
    const addUrl = '/admin_pages.php?action=adddel';

    // A) проверяем существование строго через edit_page=SLUG
    const existedBefore = await pageExistsViaEditEndpoint(new_name);
    if (existedBefore){
      console.warn(`⚠️ Уже есть страница с адресным именем "${new_name}". Создание не отправляю.`);
      return;
    }

    // B) грузим форму «Добавить»
    const doc = await fetchCP1251Doc(addUrl);
    const form = [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('/admin_pages.php'))
              || doc.querySelector('form[action*="admin_pages.php"]');
    if(!form) throw new Error('Форма добавления не найдена');

    // C) заполняем
    (form.querySelector('[name="title"]')   || {}).value = new_title;
    (form.querySelector('[name="name"]')    || {}).value = new_name;
    (form.querySelector('[name="content"]') || {}).value = new_content;
    const tags = form.querySelector('[name="tags"]'); if(tags) tags.value = new_tags;
    const annSel = form.querySelector('select[name="announcement"]');
    if (annSel) annSel.value = announcement;
    else [...form.querySelectorAll('input[name="announcement"]')].forEach(r => r.checked = (r.value===announcement));
    for(const id of enable_group_ids){
      const cb = form.querySelector(`[name="group[${id}]"]`); if(cb) cb.checked = true;
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
    console.log('POST статус:', res.status);

    const result = classifyResult(text);
    console.log('Сообщение сервера:\n', extractInfoMessage(text) || text.slice(0,500));

    // E) окончательная проверка снова через edit_page=SLUG
    const existsAfter = await pageExistsViaEditEndpoint(new_name);

    if (result.status==='created' || existsAfter){
      console.log('✅ Страница создана:', { title: new_title, name: new_name });
    } else if (result.status==='duplicate'){
      console.warn('♻️ Отклонено как дубликат (сообщение сервера выше).');
    } else if (result.status==='error'){
      console.error('⛔ Ошибка при создании:', result.msg);
    } else {
      console.warn('✳️ Не удалось подтвердить создание. Проверь админку.');
    }
  }catch(e){
    console.error('Ошибка флоу создания:', e);
  }
};
