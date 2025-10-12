// ============================================================================
// urlFieldForms.js — Формы с дополнительными URL полями (needrequest, rpgtop, episodes)
// ============================================================================

import {
  URL_FIELD_FORMS,
  FORM_INCOME_NEEDREQUEST,
  toSelector
} from '../constants.js';

export function setupUrlFieldLogic({ template, modalFields, getExtraFields, updateAmountSummary, data }) {
  const isUrlFieldForm = URL_FIELD_FORMS.includes(toSelector(template.id));
  if (!isUrlFieldForm) return { handled: false };

  const isNeedRequest = template.id === FORM_INCOME_NEEDREQUEST;

  const scrollContainer = modalFields.parentElement;
  const addExtraBtn = modalFields.querySelector('[data-add-extra]');
  if (!addExtraBtn) return { handled: false };

  const extraPrefixAttr = addExtraBtn.getAttribute('data-extra-prefix');
  const extraLabelBase = addExtraBtn.getAttribute('data-extra-label');
  const extraPlaceholderCustom = addExtraBtn.getAttribute('data-extra-placeholder');
  const extraStartAttr = Number.parseInt(addExtraBtn.getAttribute('data-extra-start'), 10);
  const requiresUrlType = isUrlFieldForm;
  const typeOverride = requiresUrlType ? 'url' : null;
  const extraPrefix = extraPrefixAttr || (isNeedRequest ? 'need_extra_' : 'extra_');
  const baseIndex = Number.isFinite(extraStartAttr) ? extraStartAttr : 1;

  const parseSuffix = (key) => {
    if (!key || !key.startsWith(extraPrefix)) return NaN;
    const trimmed = key.slice(extraPrefix.length);
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? NaN : parsed;
  };

  const refreshExtraFields = () => {
    getExtraFields().forEach((field, idx) => {
      const input = field.querySelector('input, textarea, select');
      if (!input) return;
      const label = field.querySelector('label');
      const suffix = baseIndex + idx;
      const nameAttr = `${extraPrefix}${suffix}`;
      input.name = nameAttr;
      input.id = nameAttr;
      input.required = true;
      if (label) {
        let computedLabel;
        const suffixText = suffix === 1 ? '' : ` ${suffix}`;
        if (extraLabelBase) {
          computedLabel = suffix === 1 ? extraLabelBase : `${extraLabelBase} ${suffix}`;
        } else if (template.id === FORM_INCOME_NEEDREQUEST) {
          computedLabel = `Ссылка на «нужного»${suffixText}`;
        } else if (template.id === FORM_INCOME_RPGTOP) {
          computedLabel = `Ссылка на скрин${suffixText}`;
        } else if (template.id === FORM_INCOME_EP_PERSONAL || template.id === FORM_INCOME_EP_PLOT) {
          computedLabel = `Ссылка на эпизод${suffixText}`;
        } else {
          computedLabel = `Доп. поле${suffixText}`;
        }
        label.textContent = computedLabel;
        label.setAttribute('for', nameAttr);
      }
    });
  };

  const getNextSuffix = () => {
    const suffixes = getExtraFields()
      .map((field) => {
        const input = field.querySelector('input, textarea, select');
        const currentName = input && input.name ? input.name : '';
        return parseSuffix(currentName);
      })
      .filter((num) => Number.isFinite(num));
    if (!suffixes.length) return baseIndex;
    return Math.max(...suffixes) + 1;
  };

  const addExtraField = (options = {}) => {
    const { silent = false, presetKey = null } = options;
    let suffix = parseSuffix(presetKey);
    if (!Number.isFinite(suffix)) {
      suffix = getNextSuffix();
    }
    const nameAttr = `${extraPrefix}${suffix}`;
    const wrap = document.createElement('div');
    wrap.className = 'field extra-field';

    const label = document.createElement('label');

    let labelText = '';
    const suffixText = suffix === 1 ? '' : ` ${suffix}`;
    if (template.id === FORM_INCOME_NEEDREQUEST) {
      labelText = `Ссылка на «нужного»${suffixText}`;
    } else if (template.id === FORM_INCOME_RPGTOP) {
      labelText = `Ссылка на скрин${suffixText}`;
    } else if (template.id === FORM_INCOME_EP_PERSONAL || template.id === FORM_INCOME_EP_PLOT) {
      labelText = `Ссылка на эпизод${suffixText}`;
    } else {
      labelText = `Доп. поле${suffixText}`;
    }
    label.textContent = labelText;

    const inputType = typeOverride || (isNeedRequest ? 'url' : 'text');
    const placeholderAttr = extraPlaceholderCustom ? ` placeholder="${extraPlaceholderCustom}"` : '';

    wrap.innerHTML = `
      <label for="${nameAttr}">${labelText}</label>
      <div class="extra-input">
        <input id="${nameAttr}" name="${nameAttr}" type="${inputType}"${placeholderAttr} required>
        <button type="button" class="btn-remove-extra" aria-label="Удалить поле" title="Удалить поле">×</button>
      </div>
    `;

    addExtraBtn.parentElement.insertAdjacentElement('beforebegin', wrap);

    const input = wrap.querySelector('input, textarea, select');
    if (input) input.required = true;

    const removeBtn = wrap.querySelector('.btn-remove-extra');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        wrap.remove();
        // Обновляем после удаления из DOM
        requestAnimationFrame(() => {
          refreshExtraFields();
          updateAmountSummary();
        });
      });
    }

    if (!presetKey) {
      refreshExtraFields();
    }

    requestAnimationFrame(() => {
      if (silent) return;
      if (scrollContainer) {
        const top = scrollContainer.scrollHeight;
        scrollContainer.scrollTo({ top, behavior: 'smooth' });
      } else {
        wrap.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }
      if (input && typeof input.focus === 'function') {
        try {
          input.focus({ preventScroll: true });
        } catch (err) {
          input.focus();
        }
      }
    });

    if (!silent && !presetKey) {
      updateAmountSummary();
    }

    return wrap;
  };

  addExtraBtn.addEventListener('click', () => {
    addExtraField();
  });

  // Если нет data (создание новой операции), автоматически создаём первое поле
  // Если есть data (редактирование), создадим поля из data ниже
  if (!data) {
    addExtraField({ silent: true });
    // Обновляем сумму после создания первого поля
    updateAmountSummary();
  }

  // Prefill из data
  if (data) {
    const baseNames = Array.from(modalFields.querySelectorAll('[name]')).map((el) => el.name);
    const toAdd = Object.keys(data).filter((key) => !baseNames.includes(key));
    if (toAdd.length) {
      toAdd
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .forEach((key) => addExtraField({ silent: true, presetKey: key }));
    }
    refreshExtraFields();
    // Обновляем modalAmount после загрузки всех полей
    updateAmountSummary();
  }

  return { handled: true };
}
