// ============================================================================
// services.js — Бизнес-логика: данные, расчёты, утилиты
// ============================================================================

import { counterPrefixMap } from './config.js';

// ============================================================================
// УТИЛИТЫ — форматирование и парсинг 
// ============================================================================

export const pad2 = (n) => String(n).padStart(2, '0');

export const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export const formatNumber = (value) => numberFormatter.format(value);

export const parseNumericAmount = (raw) => {
  if (raw === undefined || raw === null) return null;
  const normalized = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  return /^-?\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null;
};

// ============================================================================
// УТИЛИТЫ — работа с датами (для расчёта месяцев)
// ============================================================================

export function roundNewToAnchorDOM(OLD, NEW) {
  let [y2, m2, d2] = NEW.map(Number);
  const d1 = Number(OLD[2]);
  if (d2 < d1) {
    m2 -= 1;
    if (m2 === 0) { m2 = 12; y2 -= 1; }
  }
  return [y2, m2, d1];
}

export function fullMonthsDiffVirtualDOM(OLD, NEW) {
  const [y1, m1] = OLD.map(Number);
  const [yr, mr] = roundNewToAnchorDOM(OLD, NEW);
  return Math.max(0, (yr - y1) * 12 + (mr - m1));
}

export function fmtYMD([y, m, d]) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

// ============================================================================
// УПРАВЛЕНИЕ ДАННЫМИ — хранение групп и записей
// ============================================================================

export const submissionGroups = [];
export let groupSeq = 0;
export let entrySeq = 0;

export const buildGroupKey = ({ templateSelector = '', title = '', amount = '', amountLabel = '', kind = '', giftId = '' }) =>
  [templateSelector, title, amount, amountLabel, kind, giftId].join('||');

export function incrementGroupSeq() {
  groupSeq += 1;
  return groupSeq;
}

export function incrementEntrySeq() {
  entrySeq += 1;
  return entrySeq;
}

// ============================================================================
// УТИЛИТЫ — форматирование ключей для отображения в логе
// ============================================================================

export function formatEntryKey(key) {
  if (key === 'quantity') return 'Количество';
  if (key === 'reason') return 'Комментарий';

  const recipientMatch = key.match(/^recipient_(\d+)$/);
  if (recipientMatch) return recipientMatch[1] === '1' ? 'Получатель' : `Получатель ${recipientMatch[1]}`;

  const fromMatch = key.match(/^from_(\d+)$/);
  if (fromMatch) return fromMatch[1] === '1' ? 'От кого' : `От кого ${fromMatch[1]}`;

  const wishMatch = key.match(/^wish_(\d+)$/);
  if (wishMatch) return wishMatch[1] === '1' ? 'Комментарий' : `Комментарий ${wishMatch[1]}`;

  const counterMatch = key.match(/^(msg|rep|pos|month)_(old|new|rounded|diff)$/);
  if (counterMatch) {
    const [, prefix, suffix] = counterMatch;
    const cfg = counterPrefixMap[prefix];
    if (cfg) {
      if (suffix === 'old') return 'Предыдущее значение';
      if (suffix === 'new') return 'Новое значение';
      if (suffix === 'rounded')
        return cfg.prefix === 'month'
          ? 'Новое значение (условно округлено)'
          : 'Новое значение (округлено)';
      if (suffix === 'diff') return cfg.logDiffLabel || 'Новый учитанный объем';
    }
  }
  return key;
}

// ============================================================================
// СКИДКИ НА ПОДАРКИ
// ============================================================================

// Подсчитывает общее количество подарков (получателей) во всех группах подарков
export function countTotalGifts() {
  let total = 0;
  submissionGroups.forEach((group) => {
    const isGift = group.templateSelector === '#form-gift-present' ||
                   /Подарить подарок|Праздничный подарок|Подарок-сюрприз|Воздушный подарок/i.test(group.title || '');
    if (!isGift) return;

    group.entries.forEach((item) => {
      const dataObj = item.data || {};
      const recipientKeys = Object.keys(dataObj).filter(k => /^recipient_\d+$/.test(k));
      recipientKeys.forEach((key) => {
        const rid = String(dataObj[key] ?? '').trim();
        if (rid) total++;
      });
    });
  });
  return total;
}

// Подсчитывает общее количество индивидуальных подарков
export function countTotalCustomGifts() {
  let total = 0;
  submissionGroups.forEach((group) => {
    const isCustomGift = group.templateSelector === '#form-gift-custom' ||
                         /Индивидуальный подарок/i.test(group.title || '');
    if (!isCustomGift) return;

    group.entries.forEach((item) => {
      const dataObj = item.data || {};
      const recipientKeys = Object.keys(dataObj).filter(k => /^recipient_\d+$/.test(k));
      recipientKeys.forEach((key) => {
        const rid = String(dataObj[key] ?? '').trim();
        if (rid) total++;
      });
    });
  });
  return total;
}

// Обновляет объект скидки: создаёт если >= 5 подарков, удаляет если < 5
export function updateGiftDiscountEntry() {
  const totalGifts = countTotalGifts();
  const totalCustomGifts = countTotalCustomGifts();

  // Находим существующую группу скидки
  const discountKey = buildGroupKey({
    templateSelector: '#gift-discount',
    title: 'Автоматические скидки',
    amount: '',
    amountLabel: 'Скидка',
    kind: 'income'
  });

  const discountGroupIndex = submissionGroups.findIndex(g => g.key === discountKey);

  const hasRegularDiscount = totalGifts >= 5;
  const hasCustomDiscount = totalCustomGifts >= 5;

  if (hasRegularDiscount || hasCustomDiscount) {
    const entries = [];
    let totalDiscount = 0;

    // Скидка на обычные подарки
    if (hasRegularDiscount) {
      const fivesCount = Math.floor(totalGifts / 5);

      let giftPrice1 = 60;
      let giftPrice5 = 140;

      const firstGiftGroup = submissionGroups.find(g =>
        g.templateSelector === '#form-gift-present' ||
        /Подарить подарок|Праздничный подарок|Подарок-сюрприз|Воздушный подарок/i.test(g.title || '')
      );

      if (firstGiftGroup) {
        giftPrice1 = Number.parseInt(firstGiftGroup.giftPrice1, 10) || 60;
        giftPrice5 = Number.parseInt(firstGiftGroup.giftPrice5, 10) || 140;
      }

      const discount = (giftPrice1 * fivesCount * 5) - (giftPrice5 * fivesCount);
      totalDiscount += discount;

      entries.push({
        id: incrementEntrySeq(),
        template_id: 'gift-discount-regular',
        data: {
          discount_type: 'regular',
          total_gifts: totalGifts,
          fives_count: fivesCount,
          discount_amount: discount,
          price_1: giftPrice1,
          price_5: giftPrice5,
          calculation: `(${giftPrice1} × ${fivesCount} × 5) - (${giftPrice5} × ${fivesCount})`
        },
        multiplier: 1
      });
    }

    // Скидка на индивидуальные подарки
    if (hasCustomDiscount) {
      const fivesCount = Math.floor(totalCustomGifts / 5);

      let customPrice1 = 100;
      let customPrice5 = 400;

      const firstCustomGiftGroup = submissionGroups.find(g =>
        g.templateSelector === '#form-gift-custom' ||
        /Индивидуальный подарок/i.test(g.title || '')
      );

      if (firstCustomGiftGroup) {
        customPrice1 = Number.parseInt(firstCustomGiftGroup.giftPrice1, 10) || 100;
        customPrice5 = Number.parseInt(firstCustomGiftGroup.giftPrice5, 10) || 400;
      }

      const discount = (customPrice1 * fivesCount * 5) - (customPrice5 * fivesCount);
      totalDiscount += discount;

      entries.push({
        id: incrementEntrySeq(),
        template_id: 'gift-discount-custom',
        data: {
          discount_type: 'custom',
          total_gifts: totalCustomGifts,
          fives_count: fivesCount,
          discount_amount: discount,
          price_1: customPrice1,
          price_5: customPrice5,
          calculation: `(${customPrice1} × ${fivesCount} × 5) - (${customPrice5} × ${fivesCount})`
        },
        multiplier: 1
      });
    }

    if (discountGroupIndex === -1) {
      // Создаём новую группу
      const newGroup = {
        id: incrementGroupSeq(),
        key: discountKey,
        templateSelector: '#gift-discount',
        title: 'Автоматические скидки',
        amount: totalDiscount,
        amountLabel: 'Скидка',
        kind: 'income',
        entries,
        isDiscount: true
      };
      submissionGroups.push(newGroup);
    } else {
      // Обновляем существующую
      const group = submissionGroups[discountGroupIndex];
      group.amount = totalDiscount;
      group.entries = entries;
    }
  } else if (discountGroupIndex !== -1) {
    // Удаляем группу скидки, если нет подарков >= 5
    submissionGroups.splice(discountGroupIndex, 1);
  }
}
