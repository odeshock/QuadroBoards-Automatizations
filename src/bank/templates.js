// ============================================================================
// templates.js — Шаблоны модальных окон
// ============================================================================

import { BASE_URL } from './config.js';
import {
  TEXT_MESSAGES,
  FORM_INCOME_ANKETA, FORM_INCOME_AKCION, FORM_INCOME_NEEDCHAR, FORM_INCOME_NEEDREQUEST,
  FORM_INCOME_FIRSTPOST, FORM_INCOME_PERSONALPOST, FORM_INCOME_PLOTPOST,
  FORM_INCOME_EP_PERSONAL, FORM_INCOME_EP_PLOT, FORM_INCOME_100MSGS, FORM_INCOME_100REP,
  FORM_INCOME_100POS, FORM_INCOME_MONTH, FORM_INCOME_FLYER, FORM_INCOME_CONTEST,
  FORM_INCOME_AVATAR, FORM_INCOME_DESIGN_OTHER, FORM_INCOME_RUN_CONTEST, FORM_INCOME_MASTERING,
  FORM_INCOME_RPGTOP, FORM_INCOME_BANNER_RENO, FORM_INCOME_BANNER_MAYAK,
  FORM_INCOME_ACTIVIST, FORM_INCOME_WRITER, FORM_INCOME_EPISODE_OF, FORM_INCOME_POST_OF,
  FORM_INCOME_TOPUP, FORM_INCOME_AMS,
  FORM_EXP_FACE_1M, FORM_EXP_FACE_3M, FORM_EXP_FACE_6M,
  FORM_EXP_CHAR_1M, FORM_EXP_CHAR_3M, FORM_EXP_CHAR_6M,
  FORM_EXP_FACE_OWN_1M, FORM_EXP_FACE_OWN_3M, FORM_EXP_FACE_OWN_6M,
  FORM_EXP_NEED_1W, FORM_EXP_NEED_2W, FORM_EXP_NEED_1M,
  FORM_EXP_MASK, FORM_EXP_BONUS1D1, FORM_EXP_BONUS2D1, FORM_EXP_BONUS1W1, FORM_EXP_BONUS2W1,
  FORM_EXP_BONUS1M1, FORM_EXP_BONUS2M1, FORM_EXP_BONUS1M3, FORM_EXP_BONUS2M3,
  FORM_EXP_THIRDCHAR, FORM_EXP_CHANGECHAR, FORM_EXP_REFUSE, FORM_EXP_CLEAN, FORM_EXP_TRANSFER,
  FORM_GIFT_CUSTOM, FORM_GIFT_PRESENT,
  FORM_ICON_CUSTOM, FORM_ICON_PRESENT,
  FORM_BADGE_CUSTOM, FORM_BADGE_PRESENT,
  FORM_BG_CUSTOM, FORM_BG_PRESENT
} from './constants.js';

// Вспомогательные функции для создания шаблонов
const infoTemplate = (text) => `<div class="info">${text}</div>`;
const systemInfoTemplate = (text) => `<div class="system-info">${text}</div>`;
const infoWithNote = (text, note = '') => `<div class="info">${text}</div><p class="muted-note">${note}</p>`;
const waitingTemplate = (text) => infoWithNote(text, TEXT_MESSAGES.PLEASE_WAIT);

// Генератор шаблона для поля с количеством
const quantityField = (idPrefix) => {
  const id = `${idPrefix}-qty`;
  return `<div class="field"><label for="${id}">Количество *</label><input id="${id}" name="quantity" type="number" min="1" value="1" required></div>`;
};

// Генератор шаблона для поля с URL и кнопкой "+ Еще"
const urlFieldWithExtra = ({ name, buttonData, info = '', systemInfo = '' }) => {
  const infoBlock = info ? infoTemplate(info) : '';
  const systemInfoBlock = systemInfo ? systemInfoTemplate(systemInfo) : '';
  const isCountBase = buttonData.type === 'count-base';

  const buttonAttrs = isCountBase
    ? `data-add-extra data-count-base="${buttonData.value}" data-extra-prefix="${name}_extra_" data-extra-start="1"`
    : `data-add-extra data-extra-label="${buttonData.label}" data-extra-start="${buttonData.start || 1}"`;

  // Больше не создаём базовое поле - только кнопку "Еще"
  return `${infoBlock}${systemInfoBlock}<div class="field"><button type="button" class="btn" ${buttonAttrs}>+ Еще</button></div>`;
};

// Генератор шаблона для простого поля (input/textarea)
const simpleField = ({ id, name, label, type = 'url', info = '', placeholder = '', required = true }) => {
  const infoBlock = info ? infoTemplate(info) : '';
  const requiredAttr = required ? 'required' : '';
  const placeholderAttr = placeholder ? `placeholder="${placeholder}"` : '';

  const inputElement = type === 'textarea'
    ? `<textarea id="${id}" name="${name}" ${requiredAttr} ${placeholderAttr}></textarea>`
    : `<input id="${id}" name="${name}" type="${type}" ${requiredAttr}>`;

  return `${infoBlock}<div class="field"><label for="${id}">${label}</label>${inputElement}</div>`;
};

// Шаблоны модальных окон
export const formTemplates = {
  // ДОХОДЫ (info)
  [FORM_INCOME_ANKETA]: infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  [FORM_INCOME_AKCION]: infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  [FORM_INCOME_NEEDCHAR]: infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  [FORM_INCOME_FIRSTPOST]: waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  [FORM_INCOME_PERSONALPOST]: waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  [FORM_INCOME_PLOTPOST]: waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  [FORM_INCOME_100MSGS]: waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  [FORM_INCOME_100REP]: waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  [FORM_INCOME_100POS]: waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  [FORM_INCOME_MONTH]: waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  [FORM_INCOME_FLYER]: waitingTemplate(TEXT_MESSAGES.SCRIPT_INFO),
  [FORM_INCOME_TOPUP]: waitingTemplate(''),
  [FORM_INCOME_AMS]: waitingTemplate(''),
  [FORM_INCOME_WRITER]: infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  [FORM_INCOME_POST_OF]: infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  [FORM_INCOME_EPISODE_OF]: infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  [FORM_INCOME_ACTIVIST]: infoWithNote(TEXT_MESSAGES.ADMIN_INFO),
  
  // ДОХОДЫ (формы)
  [FORM_INCOME_NEEDREQUEST]: urlFieldWithExtra({
    name: 'need',
    buttonData: { type: 'count-base', value: 'need' },
    info: 'Разместите свою заявку на нужного в соответствующей теме и получите вознаграждение.',
    systemInfo: 'За заявки, которые дублируют Ваши старые или были возвращены из архива, галлеоны <strong>повторно не начисляются</strong>.'
  }),
  [FORM_INCOME_EP_PERSONAL]: urlFieldWithExtra({
    name: 'ep',
    buttonData: { type: 'count-base', value: 'ep' },
    systemInfo: 'Каждый завершённый эпизод учитывается <strong>только один раз</strong>.<br>При переоткрытии <strong>не начисляется</strong> заново.'
  }),
  [FORM_INCOME_EP_PLOT]: urlFieldWithExtra({
    name: 'plot_ep',
    buttonData: { type: 'count-base', value: 'plot_ep' },
    systemInfo: 'Каждый завершённый эпизод учитывается <strong>только один раз</strong>.<br>При переоткрытии <strong>не начисляется</strong> заново.'
  }),
  [FORM_INCOME_CONTEST]: urlFieldWithExtra({
    name: 'contest',
    buttonData: { type: 'extra-label', label: 'Ссылка на конкурс', start: 1 },
    systemInfo: TEXT_MESSAGES.CONTEST_INFO
  }),
  [FORM_INCOME_AVATAR]: urlFieldWithExtra({
    name: 'link',
    buttonData: { type: 'extra-label', label: 'Ссылка на граф.тему', start: 1 },
    systemInfo: TEXT_MESSAGES.GRAPHIC_WORK_INFO
  }),
  [FORM_INCOME_DESIGN_OTHER]: urlFieldWithExtra({
    name: 'link',
    buttonData: { type: 'extra-label', label: 'Ссылка на граф.тему', start: 1 },
    systemInfo: TEXT_MESSAGES.GRAPHIC_WORK_INFO
  }),
  [FORM_INCOME_RUN_CONTEST]: urlFieldWithExtra({
    name: 'contest',
    buttonData: { type: 'extra-label', label: 'Ссылка на конкурс', start: 1 },
    systemInfo: 'Каждый конкурс учитывается только один раз.'
  }),
  [FORM_INCOME_MASTERING]: urlFieldWithExtra({
    name: 'ep',
    buttonData: { type: 'extra-label', label: 'Ссылка на эпизод', start: 1 },
    systemInfo: 'Каждый сюжетный эпизод учитывается <strong>только один раз</strong>.'
  }),
  [FORM_INCOME_BANNER_RENO]: `${systemInfoTemplate(TEXT_MESSAGES.BANNER_INFO)}<p class="muted-note">${TEXT_MESSAGES.PLEASE_WAIT}</p>`,
  [FORM_INCOME_BANNER_MAYAK]: `${systemInfoTemplate(TEXT_MESSAGES.BANNER_INFO)}<p class="muted-note">${TEXT_MESSAGES.PLEASE_WAIT}</p>`,
  [FORM_INCOME_RPGTOP]: urlFieldWithExtra({
    name: 'need',
    buttonData: { type: 'count-base', value: 'need' },
    systemInfo: `Учитываются голоса, отправленные не чаще, чем <strong>раз в неделю</strong>.<br>Загрузите свои скриншоты в «<a href="${BASE_URL}/profile.php?section=uploads&id=${window.USER_ID}" target="_blank" rel="noopener noreferrer"><strong>Мои загрузки</strong></a>» и вставьте сюда ссылки.`
  }),

  // РАСХОДЫ
  [FORM_EXP_FACE_1M]: quantityField('face-1m'),
  [FORM_EXP_FACE_3M]: quantityField('face-3m'),
  [FORM_EXP_FACE_6M]: quantityField('face-6m'),

  [FORM_EXP_CHAR_1M]: quantityField('char-1m'),
  [FORM_EXP_CHAR_3M]: quantityField('char-3m'),
  [FORM_EXP_CHAR_6M]: quantityField('char-6m'),

  [FORM_EXP_FACE_OWN_1M]: quantityField('face-own-1m'),
  [FORM_EXP_FACE_OWN_3M]: quantityField('face-own-3m'),
  [FORM_EXP_FACE_OWN_6M]: quantityField('face-own-6m'),

  [FORM_EXP_NEED_1W]: quantityField('need-1w'),
  [FORM_EXP_NEED_2W]: quantityField('need-2w'),
  [FORM_EXP_NEED_1M]: quantityField('need-1m'),

  [FORM_EXP_MASK]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  [FORM_EXP_BONUS1D1]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  [FORM_EXP_BONUS2D1]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  [FORM_EXP_BONUS1W1]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  [FORM_EXP_BONUS2W1]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  [FORM_EXP_BONUS1M1]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  [FORM_EXP_BONUS2M1]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  [FORM_EXP_BONUS1M3]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  [FORM_EXP_BONUS2M3]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),

  [FORM_EXP_THIRDCHAR]: simpleField({
    id: 'tc-link',
    name: 'url',
    label: 'Ссылка на комментарий *',
    type: 'url',
    info: TEXT_MESSAGES.THIRDCHAR_INFO
  }),
  [FORM_EXP_CHANGECHAR]: simpleField({
    id: 'new',
    name: 'text',
    label: 'Имя нового персонажа на английском *',
    type: 'text'
  }),
  [FORM_EXP_REFUSE]: simpleField({
    id: 'rf-r',
    name: 'comment',
    label: 'Комментарий *',
    type: 'textarea',
    info: TEXT_MESSAGES.REFUSE_INFO,
    placeholder: 'Укажите, какой фантастической тварью Вы хотите стать и, если у вас несколько профилей, какой один оставить.'
  }),
  [FORM_EXP_CLEAN]: waitingTemplate(TEXT_MESSAGES.PLAYER_CHOICE_INFO),
  [FORM_EXP_TRANSFER]: `<p class="muted-note">${TEXT_MESSAGES.PLEASE_WAIT}</p>`,

  // ПОДАРКИ
  [FORM_GIFT_CUSTOM]: waitingTemplate(TEXT_MESSAGES.DESIGN_INFO),
  [FORM_GIFT_PRESENT]: waitingTemplate(''),

  // ОФОРМЛЕНИЕ - Иконки
  [FORM_ICON_CUSTOM]: waitingTemplate(TEXT_MESSAGES.DESIGN_INFO),
  [FORM_ICON_PRESENT]: waitingTemplate(''),

  // ОФОРМЛЕНИЕ - Плашки
  [FORM_BADGE_CUSTOM]: waitingTemplate(TEXT_MESSAGES.DESIGN_INFO),
  [FORM_BADGE_PRESENT]: waitingTemplate(''),

  // ОФОРМЛЕНИЕ - Фоны
  [FORM_BG_CUSTOM]: waitingTemplate(TEXT_MESSAGES.DESIGN_INFO),
  [FORM_BG_PRESENT]: waitingTemplate('')
};

// Список форм с data-info атрибутом
const infoForms = [
  FORM_INCOME_ANKETA, FORM_INCOME_AKCION, FORM_INCOME_NEEDCHAR,
  FORM_INCOME_FIRSTPOST, FORM_INCOME_PERSONALPOST, FORM_INCOME_PLOTPOST,
  FORM_INCOME_100MSGS, FORM_INCOME_100REP, FORM_INCOME_100POS,
  FORM_INCOME_MONTH, FORM_INCOME_FLYER, FORM_INCOME_TOPUP,
  FORM_INCOME_AMS, FORM_INCOME_WRITER, FORM_INCOME_POST_OF,
  FORM_INCOME_EPISODE_OF, FORM_INCOME_ACTIVIST,
  FORM_INCOME_BANNER_RENO, FORM_INCOME_BANNER_MAYAK
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
