// ============================================================================
// counterForms.js — Формы счетчиков (100 сообщений, репутация, позитив, месяц)
// ============================================================================

import {
  COUNTER_POLL_INTERVAL_MS,
  counterConfigs
} from '../config.js';

import {
  roundNewToAnchorDOM,
  fullMonthsDiffVirtualDOM,
  fmtYMD
} from '../services.js';

import {
  TEXT_MESSAGES,
  COUNTER_FORMS,
  toSelector
} from '../constants.js';

import {
  updateModalAmount
} from '../results.js';

import {
  setHiddenField,
  updateNote
} from './helpers.js';

export function handleCounterForms({ template, modalFields, btnSubmit, counterWatcher, form, modalAmount, modalAmountLabel, data }) {
  if (!COUNTER_FORMS.includes(toSelector(template.id))) return { handled: false, counterWatcher };

  const counterConfig = counterConfigs[template.id];
  let counterResultApplied = false;

  const updateAmountSummary = (multiplierOverride = null) => {
    const multiplier = multiplierOverride !== null ? multiplierOverride : 1;
    form.dataset.currentMultiplier = String(multiplier);

    // Для форм с mode используем новую универсальную функцию
    const mode = form.dataset.mode;
    if (mode === 'price_per_item' && form.dataset.price) {
      updateModalAmount(modalAmount, form, { items: multiplier });
      return;
    }
  };

  const renderCounterOutcome = (cfg, oldVal, newVal, rounded, diff) => {
    counterResultApplied = true;
    const units = diff > 0 ? diff / cfg.step : 0;
    setHiddenField(modalFields, `${cfg.prefix}_old`, oldVal);
    setHiddenField(modalFields, `${cfg.prefix}_new`, newVal);
    setHiddenField(modalFields, `${cfg.prefix}_rounded`, rounded);
    setHiddenField(modalFields, `${cfg.prefix}_diff`, diff);
    form.dataset.currentMultiplier = String(units);

    const roundLabel = cfg.prefix === 'month'
      ? 'условно округлено'
      : 'округлено до сотен';

    const lines = [
      `**Последнее обработанное значение:** ${oldVal}`,
      newVal !== rounded
        ? `**Новое значение:** ${newVal} **→ ${roundLabel}:** ${rounded}`
        : `**Новое значение:** ${newVal}`
    ];

    if (diff === 0) {
      lines.push('', `**Для новых начислений не хватает ${cfg.unitLabel}.**`);
      updateNote(modalFields, lines, { error: false });
      btnSubmit.style.display = 'none';
      btnSubmit.disabled = true;
      updateAmountSummary(0);
    } else {
      lines.push('', `**Будет начислена выплата за** ${rounded} - ${oldVal} = ${diff} **${cfg.diffNoteLabel}.**`);
      updateNote(modalFields, lines, { error: false });
      btnSubmit.style.display = '';
      btnSubmit.disabled = false;
      updateAmountSummary(units);
    }
  };

  const startCounterWatcher = (cfg) => {
    if (!cfg || counterResultApplied) return;
    const waitingText = TEXT_MESSAGES.PLEASE_WAIT;

    updateNote(modalFields, waitingText, { error: false });
    btnSubmit.style.display = 'none';
    btnSubmit.disabled = true;
    setHiddenField(modalFields, `${cfg.prefix}_old`);
    setHiddenField(modalFields, `${cfg.prefix}_new`);
    setHiddenField(modalFields, `${cfg.prefix}_rounded`);
    setHiddenField(modalFields, `${cfg.prefix}_diff`);

    const controller = { cancelled: false, timer: null };
    controller.cancel = () => {
      controller.cancelled = true;
      if (controller.timer) clearTimeout(controller.timer);
    };
    counterWatcher = controller;

    const startTime = performance.now();

    const concludeSuccess = (oldVal, newVal, rounded, diff) => {
      if (controller.cancelled) return;
      renderCounterOutcome(cfg, oldVal, newVal, rounded, diff);
    };

    const concludeError = () => {
      if (controller.cancelled) return;
      updateNote(modalFields, TEXT_MESSAGES.ERROR_REFRESH, { error: true });
      btnSubmit.style.display = 'none';
      btnSubmit.disabled = true;
      setHiddenField(modalFields, `${cfg.prefix}_old`);
      setHiddenField(modalFields, `${cfg.prefix}_new`);
      setHiddenField(modalFields, `${cfg.prefix}_rounded`);
      setHiddenField(modalFields, `${cfg.prefix}_diff`);
    };

    const poll = () => {
      if (controller.cancelled) return;

      const rawOld = window[cfg.oldVar];
      const rawNew = window[cfg.newVar];

      // ВЕТКА ДЛЯ МЕСЯЦЕВ: MONTH_OLD/MONTH_NEW — массивы [yyyy,mm,dd] или строка "yyyy-mm-dd"
      if (cfg.prefix === 'month') {
        const parseArr = (raw) => {
          if (Array.isArray(raw)) return raw.map(Number);
          if (typeof raw === 'string') {
            const s = raw.trim();
            // поддержим JSON-подобную строку вида "[2025,02,31]"
            if (s.startsWith('[')) {
              try {
                const a = JSON.parse(s);
                if (Array.isArray(a)) return a.map(Number);
              } catch (_) {}
            }
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
          }
          return null;
        };

        const OLD = parseArr(rawOld);
        const NEW = parseArr(rawNew);

        if (OLD && NEW && OLD.length === 3 && NEW.length === 3) {
          // НЕ валидируем даты намеренно — требование пользователя
          const newRoundedArr = roundNewToAnchorDOM(OLD, NEW);
          const diff = fullMonthsDiffVirtualDOM(OLD, NEW);

          // В общий рендер отдаём строки дат, diff — число
          concludeSuccess(
            fmtYMD(OLD),
            fmtYMD(NEW),
            fmtYMD(newRoundedArr),
            Math.max(0, Number(diff) || 0)
          );
          return;
        }
      } else {
        // СТАРАЯ ЧИСЛОВАЯ ВЕТКА (сообщения/репа/позитив)
        const oldVal = Number(rawOld);
        const newVal = Number(rawNew);
        const valid = Number.isFinite(oldVal) && Number.isFinite(newVal);
        if (valid) {
          const rounded = Math.floor(newVal / cfg.step) * cfg.step;
          const diffRaw = rounded - oldVal;
          const diff = diffRaw > 0 ? diffRaw : 0;
          concludeSuccess(oldVal, newVal, rounded, diff);
          return;
        }
      }

      if (performance.now() - startTime >= cfg.timeout) {
        concludeError();
        return;
      }
      controller.timer = setTimeout(poll, COUNTER_POLL_INTERVAL_MS);
    };

    poll();
  };

  // Prefill если есть data
  if (data) {
    const cfg = counterConfig;

    if (cfg.prefix === 'month') {
      const oldVal = data[`${cfg.prefix}_old`];
      const newVal = data[`${cfg.prefix}_new`];
      const roundedVal = data[`${cfg.prefix}_rounded`] ?? data[`${cfg.prefix}_new`];
      const diffVal = Number(data[`${cfg.prefix}_diff`]);

      if (oldVal && newVal && roundedVal && Number.isFinite(diffVal)) {
        renderCounterOutcome(cfg, oldVal, newVal, roundedVal, diffVal);
      }
    } else {
      const oldVal = Number(data[`${cfg.prefix}_old`]);
      const newVal = Number(data[`${cfg.prefix}_new`]);
      const roundedVal = Number(data[`${cfg.prefix}_rounded`] ?? data[`${cfg.prefix}_new`]);
      const diffVal = Number(data[`${cfg.prefix}_diff`]);
      if ([oldVal, newVal, roundedVal, diffVal].every(Number.isFinite)) {
        renderCounterOutcome(cfg, oldVal, newVal, roundedVal, diffVal);
      }
    }
  }

  // Запуск watcher если нет prefill
  if (!counterResultApplied) {
    startCounterWatcher(counterConfig);
  }

  return { handled: true, counterWatcher };
}
