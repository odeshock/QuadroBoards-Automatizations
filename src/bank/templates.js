// ============================================================================
// templates.js — Шаблоны модальных окон
// ============================================================================

import { TEXT_MESSAGES } from './constants.js';

// Вспомогательные функции для создания шаблонов
const infoTemplate = (text) => `<div class="info">${text}</div>`;
const infoWithNote = (text, note = '') => `<div class="info">${text}</div><p class="muted-note">${note}</p>`;
const waitingTemplate = (text) => infoWithNote(text, TEXT_MESSAGES.PLEASE_WAIT);

// Генератор шаблона для поля с количеством
const quantityField = (idPrefix) => {
  const id = `${idPrefix}-qty`;
  return `<div class="field"><label for="${id}">Количество *</label><input id="${id}" name="quantity" type="number" min="1" value="1" required></div>`;
};

// Шаблоны модальных окон
export const formTemplates = {
  // ДОХОДЫ (info)
  'form-income-anketa': infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  'form-income-akcion': infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  'form-income-needchar': infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  'form-income-firstpost': waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  'form-income-personalpost': waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  'form-income-plotpost': waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  'form-income-100msgs': waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  'form-income-100rep': waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  'form-income-100pos': waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  'form-income-month': waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  'form-income-flyer': waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  'form-income-topup': infoTemplate(TEXT_MESSAGES.TOPUP_INFO),
  'form-income-ams': infoTemplate(TEXT_MESSAGES.AMS_INFO),
  'form-income-writer': infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  'form-income-post-of': infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  'form-income-episode-of': infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  'form-income-activist': infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  
  // ДОХОДЫ (формы)
  'form-income-needrequest': '<div class="grid-2"><div class="field"><label for="need-link">Ссылка на «нужного» *</label><input id="need-link" name="need" type="url" required></div></div><div class="field"><button type="button" class="btn" data-add-extra data-count-base="need">+ Еще</button></div>',
  'form-income-ep-personal': '<div class="grid-2"><div class="field"><label for="ep-link">Ссылка на эпизод *</label><input id="ep-link" name="ep" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-count-base="ep">+ Еще</button></div></div>',
  'form-income-ep-plot': '<div class="grid-2"><div class="field"><label for="plot-ep-link">Ссылка на эпизод *</label><input id="plot-ep-link" name="plot_ep" type="url" required></div></div><div class="field"><button type="button" class="btn" data-add-extra data-count-base="plot_ep">+ Еще</button></div>',
  'form-income-contest': `${infoTemplate(TEXT_MESSAGES.CONTEST_INFO)}<div class="field"><label for="uc">Ссылка на конкурс *</label><input id="uc" name="contest" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на конкурс" data-extra-start="2">+ Еще</button></div>`,
  'form-income-avatar': `${infoTemplate(TEXT_MESSAGES.GRAPHIC_WORK_INFO)}<div class="field"><label for="ava-link">Ссылка на граф.тему *</label><input id="ava-link" name="link" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на граф.тему" data-extra-start="2">+ Еще</button></div>`,
  'form-income-design-other': `${infoTemplate(TEXT_MESSAGES.GRAPHIC_WORK_INFO)}<div class="field"><label for="do-link">Ссылка на граф.тему *</label><input id="do-link" name="link" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на граф.тему" data-extra-start="2">+ Еще</button></div>`,
  'form-income-run-contest': '<div class="field"><label for="rc">Ссылка на конкурс *</label><input id="rc" name="contest" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на конкурс" data-extra-start="2">+ Еще</button></div>',
  'form-income-mastering': '<div class="field"><label for="ms">Ссылка на эпизод *</label><input id="ms" name="ep" type="url" required></div><div class="field"><button type="button" class="btn" data-add-extra data-extra-label="Ссылка на эпизод" data-extra-start="2">+ Еще</button></div>',
  'form-income-banner-reno': '<div class="field"><label for="reno">Ссылка на скрин *</label><input id="reno" name="url" type="url" required></div>',
  'form-income-banner-mayak': '<div class="field"><label for="mayak">Ссылка на скрин *</label><input id="mayak" name="url" type="url" required></div>',
  'form-income-rpgtop': `${infoTemplate(TEXT_MESSAGES.SCREENSHOT_INFO)}<div class="grid-2"><div class="field"><label for="need-link">Ссылка на скрин *</label><input id="need-link" name="need" type="url" required></div></div><div class="field"><button type="button" class="btn" data-add-extra data-count-base="need">+ Еще</button></div>`,

  // РАСХОДЫ
  'form-exp-face-1m': quantityField('face-1m'),
  'form-exp-face-3m': quantityField('face-3m'),
  'form-exp-face-6m': quantityField('face-6m'),

  'form-exp-char-1m': quantityField('char-1m'),
  'form-exp-char-3m': quantityField('char-3m'),
  'form-exp-char-6m': quantityField('char-6m'),

  'form-exp-face-own-1m': quantityField('face-own-1m'),
  'form-exp-face-own-3m': quantityField('face-own-3m'),
  'form-exp-face-own-6m': quantityField('face-own-6m'),

  'form-exp-need-1w': quantityField('need-1w'),
  'form-exp-need-2w': quantityField('need-2w'),
  'form-exp-need-1m': quantityField('need-1m'),

  'form-exp-mask': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  'form-exp-bonus1d1': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  'form-exp-bonus2d1': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  'form-exp-bonus1w1': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  'form-exp-bonus2w1': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  'form-exp-bonus1m1': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  'form-exp-bonus2m1': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  'form-exp-bonus1m3': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  'form-exp-bonus2m3': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  'form-exp-thirdchar': `${infoTemplate(TEXT_MESSAGES.THIRDCHAR_INFO)}<div class="field"><label for="tc-link">Ссылка на комментарий *</label><input id="tc-link" name="url" type="url" required></div>`,
  'form-exp-changechar': '<div class="field"><label for="new">Имя нового персонажа на английском *</label><input id="new" name="text" type="text" required></div>',
  'form-exp-refuse': `${infoTemplate(TEXT_MESSAGES.REFUSE_INFO)}<div class="field"><label for="rf-r">Комментарий *</label><textarea id="rf-r" name="comment" required placeholder="Укажите, какой фантастической тварью Вы хотите стать и, если у вас несколько профилей, какой один оставить."></textarea></div>`,
  'form-exp-clean': waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  'form-exp-transfer': '<div class="grid-2"><div class="field"><label for="tr-to">Кому перевод *</label><input id="tr-to" name="to" type="text" required></div><div class="field"><label for="tr-sum">Сумма перевода *</label><input id="tr-sum" name="amount" type="number" min="1" required></div></div>',

  // ПОДАРКИ
  'form-gift-custom': waitingTemplate(TEXT_MESSAGES.DESIGN_INFO),
  'form-gift-present': waitingTemplate(TEXT_MESSAGES.PLEASE_WAIT),

  // ОФОРМЛЕНИЕ - Иконки
  'form-icon-custom': waitingTemplate(TEXT_MESSAGES.DESIGN_INFO),
  'form-icon-present': waitingTemplate(TEXT_MESSAGES.PLEASE_WAIT),

  // ОФОРМЛЕНИЕ - Плашки
  'form-badge-custom': waitingTemplate(TEXT_MESSAGES.DESIGN_INFO),
  'form-badge-present': waitingTemplate(TEXT_MESSAGES.PLEASE_WAIT),

  // ОФОРМЛЕНИЕ - Фоны
  'form-bg-custom': waitingTemplate(TEXT_MESSAGES.DESIGN_INFO),
  'form-bg-present': waitingTemplate(TEXT_MESSAGES.PLEASE_WAIT)
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
export function injectTemplates() {
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
