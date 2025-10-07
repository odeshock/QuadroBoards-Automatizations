// Шаблоны модальных окон
const formTemplates = {
  // ДОХОДЫ (info)
  'form-income-anketa': '<div class="info">Начисление производит администратор при приеме анкеты. Если вам случайно забыли начислить, пожалуйста, напишите в Приемную — мы обязательно разберемся.</div><p class="muted-note"></p>',
  'form-income-akcion': '<div class="info">Начисление производит администратор при приеме анкеты. Если вам случайно забыли начислить, пожалуйста, напишите в Приемную — мы обязательно разберемся.</div><p class="muted-note"></p>',
  'form-income-needchar': '<div class="info">Начисление производит администратор при приеме анкеты. Если вам случайно забыли начислить, пожалуйста, напишите в Приемную — мы обязательно разберемся.</div><p class="muted-note"></p>',
  'form-income-firstpost': '<div class="info">За вас все посчитает скрипт, просто дайте ему время. Если у вас возникнут вопросы по подсчету или что-то окажется не учтено, пожалуйста, напишите в Приемную — мы обязательно поможем.</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-income-personalpost': '<div class="info">За вас все посчитает скрипт, просто дайте ему время. Если у вас возникнут вопросы по подсчету или что-то окажется не учтено, пожалуйста, напишите в Приемную — мы обязательно поможем.</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-income-plotpost': '<div class="info">За вас все посчитает скрипт, просто дайте ему время. Если у вас возникнут вопросы по подсчету или что-то окажется не учтено, пожалуйста, напишите в Приемную — мы обязательно поможем.</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-income-100msgs': '<div class="info">За вас все посчитает скрипт, просто дайте ему время. Если у вас возникнут вопросы по подсчету или что-то окажется не учтено, пожалуйста, напишите в Приемную — мы обязательно поможем.</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-income-100rep': '<div class="info">За вас все посчитает скрипт, просто дайте ему время. Если у вас возникнут вопросы по подсчету или что-то окажется не учтено, пожалуйста, напишите в Приемную — мы обязательно поможем.</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-income-100pos': '<div class="info">За вас все посчитает скрипт, просто дайте ему время. Если у вас возникнут вопросы по подсчету или что-то окажется не учтено, пожалуйста, напишите в Приемную — мы обязательно поможем.</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-income-month': '<div class="info">За вас все посчитает скрипт, просто дайте ему время. Если у вас возникнут вопросы по подсчету или что-то окажется не учтено, пожалуйста, напишите в Приемную — мы обязательно поможем.</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-income-flyer': '<div class="info">За вас все посчитает скрипт, просто дайте ему время. Если у вас возникнут вопросы по подсчету или что-то окажется не учтено, пожалуйста, напишите в Приемную — мы обязательно поможем.</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-income-topup': '<div class="info">Начисление производит администратор 1го и 16го числа каждого месяца. Если вам случайно забыли начислить, пожалуйста, напишите в Приемную — мы обязательно разберемся.</div>',
  'form-income-ams': '<div class="info">Начисление в частных случаях по потребности производит администратор.</div>',
  'form-income-writer': '<div class="info">Начисление производит администратор после публикации соответствующей новости. Если вам случайно забыли начислить, пожалуйста, напишите в Приемную — мы обязательно разберемся.</div><p class="muted-note"></p>',
  'form-income-post-of': '<div class="info">Начисление производит администратор после публикации соответствующей новости. Если вам случайно забыли начислить, пожалуйста, напишите в Приемную — мы обязательно разберемся.</div><p class="muted-note"></p>',
  'form-income-episode-of': '<div class="info">Начисление производит администратор после публикации соответствующей новости. Если вам случайно забыли начислить, пожалуйста, напишите в Приемную — мы обязательно разберемся.</div><p class="muted-note"></p>',
  'form-income-activist': '<div class="info">Начисление производит администратор после публикации соответствующей новости. Если вам случайно забыли начислить, пожалуйста, напишите в Приемную — мы обязательно разберемся.</div><p class="muted-note"></p>',

  // ДОХОДЫ (формы)
  'form-income-needrequest': '<div class="grid-2"><div class="field"><label for="need-link">Ссылка на «нужного»</label><input id="need-link" name="need" type="url" required></div></div><div class="field"><button type="button" class="btn" data-add-extra data-count-base="need">+ Еще</button></div>',
  'form-income-ep-personal': '<div class="grid-2"><div class="field"><label for="ep-link">Ссылка на эпизод</label><input id="ep-link" name="ep" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-count-base="ep">+ Еще</button></div></div>',
  'form-income-ep-plot': '<div class="grid-2"><div class="field"><label for="plot-ep-link">Ссылка на эпизод *</label><input id="plot-ep-link" name="plot_ep" type="url" required></div></div><div class="field"><button type="button" class="btn" data-add-extra data-count-base="plot_ep">+ Еще</button></div>',
  'form-income-contest': '<div class="info">Каждый конкурс учитывается один раз.</div><div class="field"><label for="uc">Ссылка на конкурс *</label><input id="uc" name="contest" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на конкурс" data-extra-start="2">+ Еще</button></div>',
  'form-income-avatar': '<div class="info">Учитываются только работы, опубликованные в графической теме. Если несколько работ выложено в одном комментарии, укажите этот комментарий несколько раз. Если выложено несколько версий одной работы с минимальными различиями, учитывается только одна из них.</div><div class="field"><label for="ava-link">Ссылка на граф.тему *</label><input id="ava-link" name="link" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на граф.тему" data-extra-start="2">+ Еще</button></div>',
  'form-income-design-other': '<div class="info">Учитываются только работы, опубликованные в графической теме. Если несколько работ выложено в одном комментарии, укажите этот комментарий несколько раз. Если выложено несколько версий одной работы с минимальными различиями, учитывается только одна из них.</div><div class="field"><label for="do-link">Ссылка на граф.тему *</label><input id="do-link" name="link" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на граф.тему" data-extra-start="2">+ Еще</button></div>',
  'form-income-run-contest': '<div class="field"><label for="rc">Ссылка на конкурс *</label><input id="rc" name="contest" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на конкурс" data-extra-start="2">+ Еще</button></div>',
  'form-income-mastering': '<div class="field"><label for="ms">Ссылка на эпизод *</label><input id="ms" name="ep" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на эпизод" data-extra-start="2">+ Еще</button></div>',
  'form-income-banner-reno': '<div class="field"><label for="reno">Ссылка на скрин</label><input id="reno" name="profile" type="url" required></div>',
  'form-income-banner-mayak': '<div class="field"><label for="mayak">Ссылка на скрин</label><input id="mayak" name="profile" type="url" required></div>',
  'form-income-rpgtop': '<div class="info">Загрузите свои скриншоты в «Мои загрузки» и вставьте ссылки на них сюда.</div><div class="grid-2"><div class="field"><label for="need-link">Ссылка на скрин</label><input id="need-link" name="need" type="url" required></div></div><div class="field"><button type="button" class="btn" data-add-extra data-count-base="need">+ Еще</button></div>',

  // РАСХОДЫ
  'form-exp-face-1m': '<div class="field"><label for="f1q">Количество *</label><input id="f1q" name="quantity" type="number" min="1" value="1" required></div>',
  'form-exp-face-3m': '<div class="field"><label for="f3q">Количество *</label><input id="f3q" name="quantity" type="number" min="1" value="1" required></div>',
  'form-exp-face-6m': '<div class="field"><label for="f6q">Количество *</label><input id="f6q" name="quantity" type="number" min="1" value="1" required></div>',

  'form-exp-char-1m': '<div class="field"><label for="c1q">Количество *</label><input id="c1q" name="quantity" type="number" min="1" value="1" required></div>',
  'form-exp-char-3m': '<div class="field"><label for="c3q">Количество *</label><input id="c3q" name="quantity" type="number" min="1" value="1" required></div>',
  'form-exp-char-6m': '<div class="field"><label for="c6q">Количество *</label><input id="c6q" name="quantity" type="number" min="1" value="1" required></div>',

  'form-exp-face-own-1m': '<div class="field"><label for="fo1q">Количество *</label><input id="fo1q" name="quantity" type="number" min="1" value="1" required></div>',
  'form-exp-face-own-3m': '<div class="field"><label for="fo3q">Количество *</label><input id="fo3q" name="quantity" type="number" min="1" value="1" required></div>',
  'form-exp-face-own-6m': '<div class="field"><label for="fo6q">Количество *</label><input id="fo6q" name="quantity" type="number" min="1" value="1" required></div>',

  'form-exp-need-1w': '<div class="field"><label for="n1wq">Количество *</label><input id="n1wq" name="quantity" type="number" min="1" value="1" required></div>',
  'form-exp-need-2w': '<div class="field"><label for="n2wq">Количество *</label><input id="n2wq" name="quantity" type="number" min="1" value="1" required></div>',
  'form-exp-need-1m': '<div class="field"><label for="n1mq">Количество *</label><input id="n1mq" name="quantity" type="number" min="1" value="1" required></div>',

  'form-exp-mask': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',

  'form-exp-bonus1d1': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-exp-bonus2d1': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',

  'form-exp-bonus1w1': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-exp-bonus2w1': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',

  'form-exp-bonus1m1': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-exp-bonus2m1': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',

  'form-exp-bonus1m3': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-exp-bonus2m3': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',

  'form-exp-thirdchar': '<div class="info">Предварительно согласуйте в Приемной и приложите ссылку на комментарий</div><div class="field"><label for="tc-link">Ссылка на комментарий *</label><input id="tc-link" name="link" type="url" required></div>',
  'form-exp-changechar': '<div class="field"><label for="new">Имя нового персонажа на английском *</label><input id="new" name="reason" type="text" required></div>',
  'form-exp-refuse': '<div class="info">Если у вас несколько профилей, останется только один</div><div class="field"><label for="rf-r">Комментарий *</label><textarea id="rf-r" name="reason" required placeholder="Укажите, какой фантастической тварью Вы хотите стать и, если у вас несколько профилей, какой один оставить."></textarea></div>',
  'form-exp-clean': '<div class="info">Можете выбрать себя или другого игрока</div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-exp-transfer': '<div class="grid-2"><div class="field"><label for="tr-to">Кому перевод *</label><input id="tr-to" name="to" type="text" required></div><div class="field"><label for="tr-sum">Сумма перевода *</label><input id="tr-sum" name="amount" type="number" min="1" required></div></div>',

  // ПОДАРКИ
  'form-gift-custom': '<div class="info">Правила и размеры: <a href="#" target="_blank" rel="noopener noreferrer">ссылка на правила</a></div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-gift-present': `<p class="muted-note">Пожалуйста, подождите...</p>
<div class="gift-groups" data-gift-container>
  <div class="gift-group" data-gift-group>
    <button type="button" class="btn-remove-extra gift-remove" data-gift-remove aria-label="Удалить получателя" disabled>×</button>
    <div class="field gift-field" data-gift-label="recipient"><label for="gift-recipient-1">Получатель *</label><input id="gift-recipient-1" data-gift-recipient name="recipient_1" type="text" required placeholder="Начните вводить имя..."></div>
    <div class="field gift-field" data-gift-label="from"><label for="gift-from-1">От кого</label><input id="gift-from-1" data-gift-from name="from_1" type="text" placeholder="От ..."></div>
    <div class="field gift-field" data-gift-label="wish"><label for="gift-wish-1">Комментарий</label><input id="gift-wish-1" data-gift-wish name="wish_1" type="text" placeholder="Например, с праздником!"></div>
  </div>
</div>
<div class="field"><button type="button" class="btn" data-add-gift-group>+ Еще</button></div>`,

  // ОФОРМЛЕНИЕ - Иконки
  'form-icon-custom': '<div class="info">Правила и размеры: <a href="#" target="_blank" rel="noopener noreferrer">ссылка на правила</a></div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-icon-present': '<p class="muted-note">Пожалуйста, подождите...</p>',

  // ОФОРМЛЕНИЕ - Плашки
  'form-badge-custom': '<div class="info">Правила и размеры: <a href="#" target="_blank" rel="noopener noreferrer">ссылка на правила</a></div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-badge-present': '<p class="muted-note">Пожалуйста, подождите...</p>',

  // ОФОРМЛЕНИЕ - Фоны
  'form-bg-custom': '<div class="info">Правила и размеры: <a href="#" target="_blank" rel="noopener noreferrer">ссылка на правила</a></div><p class="muted-note">Пожалуйста, подождите...</p>',
  'form-bg-present': '<p class="muted-note">Пожалуйста, подождите...</p>'
};

// Список форм с data-info атрибутом
const infoForms = [
  'form-income-anketa', 'form-income-akcion', 'form-income-needchar',
  'form-income-firstpost', 'form-income-personalpost', 'form-income-plotpost',
  'form-income-100msgs', 'form-income-100rep', 'form-income-100pos',
  'form-income-month', 'form-income-flyer', 'form-income-topup',
  'form-income-ams', 'form-income-writer', 'form-income-post-of',
  'form-income-episode-of', 'form-income-activist'
];

// Функция для инжекта шаблонов в DOM
function injectTemplates() {
  const container = document.getElementById('modal-forms-container');
  if (!container) return;

  Object.entries(formTemplates).forEach(([id, html]) => {
    const section = document.createElement('section');
    section.id = id;
    if (infoForms.includes(id)) {
      section.setAttribute('data-info', '');
    }
    section.innerHTML = html;
    container.appendChild(section);
  });
}
