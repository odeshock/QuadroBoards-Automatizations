/**
 * Преобразует входной объект { fullData: [...] } в текст по заданным правилам.
 * Использует modalAmount (fallback — amount).
 */
function formatBankText(data) {
  if (!data || !Array.isArray(data.fullData)) return "";

  // нормализация BASE_URL: window.SITE_URL без завершающего '/'
  let BASE_URL = "";
  if (typeof window !== "undefined" && typeof window.SITE_URL === "string") {
    BASE_URL = window.SITE_URL.trim().replace(/\/+$/, "");
  }

  // -1) САМЫЕ-ПЕРВЫЕ (без amount): списки получателей с ценой item.price
  const earliestIds = [
    "form-income-anketa",
    "form-income-akcion",
    "form-income-needchar",
    "form-income-episode-of",
    "form-income-post-of",
    "form-income-writer",
    "form-income-activist",
  ];

  // -0.5) сразу после earliestIds (без amount): пополнения/АМС
  const topupAmsIds = ["form-income-topup", "form-income-ams"];

  // 0) самые-первые: "первый пост" (без quote)
  const firstPostIds = ["form-income-firstpost"];

  // 1) посты
  const postIds = ["form-income-personalpost", "form-income-plotpost"];

  // 2) флаеры
  const flyerIds = ["form-income-flyer"];

  // 3) первые после постов/флаеров
  const firstIds = [
    "form-income-100msgs",
    "form-income-100pos",
    "form-income-100rep",
    "form-income-month",
  ];

  // 4) income (общий случай — нумерованный список значений data)
  const incomeIds = [
    "form-income-needrequest",
    "form-income-contest",
    "form-income-avatar",
    "form-income-avatar",
    "form-income-design-other",
    "form-income-run-contest",
    "form-income-mastering",
    "form-income-rpgtop",
  ];

  // 5) баннеры
  const bannerIds = ["form-income-banner-mayak", "form-income-banner-reno"];

  // 6) exp (обычные — количество)
  const expIds = [
    "form-exp-face-1m",
    "form-exp-face-3m",
    "form-exp-face-6m",
    "form-exp-char-1m",
    "form-exp-char-3m",
    "form-exp-char-6m",
    "form-exp-face-own-1m",
    "form-exp-face-own-3m",
    "form-exp-face-own-6m",
    "form-exp-need-1w",
    "form-exp-need-2w",
    "form-exp-need-1m",
  ];

  // 7) самые последние (группы)
  const thirdCharIds  = ["form-exp-thirdchar"];
  const changeCharIds = ["form-exp-changechar"];
  const refuseIds     = ["form-exp-refuse"];
  const transferIds   = ["form-exp-transfer"];

  // 8) самые последние (финальные EXP)
  const finalExpIds = [
    "form-exp-mask",
    "form-exp-bonus1d1",
    "form-exp-bonus2d1",
    "form-exp-bonus1w1",
    "form-exp-bonus2w1",
    "form-exp-bonus1m1",
    "form-exp-bonus2m1",
    "form-exp-bonus1m3",
    "form-exp-bonus2m3",
    "form-exp-clean",
  ];

  // 9) САМЫЕ-САМЫЕ ПОСЛЕДНИЕ: иконки/бейджи/фоны/подарки
  const giftLikeIds = [
    "form-icon-custom",
    "form-icon-present",
    "form-badge-custom",
    "form-badge-present",
    "form-bg-custom",
    "form-bg-present",
    "form-gift-custom",
    "form-gift-present",
  ];

  // 10) ПОЗДНЕЕ ВСЕХ: пересчёт цены
  const priceAdjustmentIds = ["price-adjustment"];

  // 11) САМОЕ-САМОЕ ПОСЛЕДНЕЕ: скидки на подарки (с amount в заголовке)
  const giftDiscountIds = ["gift-discount"];

  // Итоговый порядок
  const wantedOrder = [
    ...earliestIds,
    ...topupAmsIds,
    ...firstPostIds,
    ...postIds,
    ...flyerIds,
    ...firstIds,
    ...incomeIds,
    ...bannerIds,
    ...expIds,
    ...thirdCharIds,
    ...changeCharIds,
    ...refuseIds,
    ...transferIds,
    ...finalExpIds,
    ...giftLikeIds,
    ...priceAdjustmentIds,
    ...giftDiscountIds,
  ];

  // Карта порядка
  const orderIndex = new Map();
  for (let i = 0; i < wantedOrder.length; i++) {
    if (!orderIndex.has(wantedOrder[i])) orderIndex.set(wantedOrder[i], i);
  }

  // ---- форматтеры ----
  const formatBlock = (title, amountLike, innerLines) => {
    const inside = innerLines.length ? innerLines.join("\n") : "";
    return `[b]— ${title}[/b] = ${amountLike}\n[quote]${inside}[/quote]`;
  };
  const formatSimple = (title, amountLike) => `[b]— ${title}[/b] = ${amountLike}`;
  const formatBlockNoAmount = (title, innerLines) => {
    const inside = innerLines.length ? innerLines.join("\n") : "";
    return `[b]— ${title}[/b]\n[quote]${inside}[/quote]`;
  };

  // ---- утилиты ----
  const pickArray = (raw) => {
    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };
  const nonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== "";

  // САМЫЕ-ПЕРВЫЕ: списки recipient_N, цена из item.price
  const entriesEarliestLines = (entries, price) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data;
      if (!obj || typeof obj !== "object") continue;
      const keys = Object.keys(obj).filter(k => k.startsWith("recipient_"));
      for (const key of keys) {
        const suf = key.split("_")[1];
        const rec = obj[`recipient_${suf}`];
        if (rec) { lines.push(`${idx}. ${BASE_URL}/profile.php?id=${rec} — ${price ?? ""}`); idx++; }
      }
    }
    return lines;
  };

  // СРАЗУ ПОСЛЕ earliestIds: topup/ams
  const entriesTopupAmsLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let globalIdx = 1;
    for (const e of entries) {
      const obj = e?.data;
      if (!obj || typeof obj !== "object") continue;
      const recipients = Object.keys(obj).filter(k => k.startsWith("recipient_"));
      recipients.forEach((key, i) => {
        const suf = key.split("_")[1];
        const rec = obj[`recipient_${suf}`];
        const amt = obj[`amount_${suf}`];
        const cmt = obj[`comment_${suf}`];
        if (!rec) return;

        let block = `${globalIdx}. ${BASE_URL}/profile.php?id=${rec} — ${amt ?? ""}\n`;
        const hasComment = nonEmpty(cmt);
        if (hasComment) block += `\n[b]Комментарий:[/b] ${String(cmt).trim()}\n`;
        const isLast = i === recipients.length - 1;
        if (!isLast && hasComment) block += `[hr]\n`;

        lines.push(block);
        globalIdx++;
      });
    }
    return lines;
  };

  // Посты
  const entriesPostsLines = (entries, which) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data || {};
      const raw = which === "personal"
        ? obj.personal_posts_json ?? obj.personalPostsJson
        : obj.plot_posts_json ?? obj.plotPostsJson;
      for (const it of pickArray(raw)) {
        const src = it?.src ?? "";
        const text = it?.text ?? "";
        const symbols = it?.symbols_num ?? "";
        lines.push(`${idx}. ${src} — ${symbols} символов`);
        idx++;
      }
    }
    return lines;
  };

  // Флаеры
  const entriesFlyerLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data || {};
      for (const it of pickArray(obj.flyer_links_json ?? obj.flyerLinksJson)) {
        const src = it?.src ?? "";
        const text = it?.text ?? "";
        lines.push(`${idx}. ${src}`);
        idx++;
      }
    }
    return lines;
  };

  // Income (общий случай)
  const entriesValuesLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e && e.data && typeof e.data === "object" ? e.data : null;
      if (!obj) continue;
      for (const key of Object.keys(obj)) { lines.push(`${idx}. ${obj[key]}`); idx++; }
    }
    return lines;
  };

  // Exp (количество)
  const entriesQuantityLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const q = e?.data?.quantity;
      if (q !== undefined && q!== null) lines.push(`[b]Количество[/b]: ${q}`);
    }
    return lines;
  };

  // Баннеры
  const entriesBannerLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const url = e?.data?.url;
      if (url) lines.push(`[b]Ссылка:[/b] ${url}`);
    }
    return lines;
  };

  // Первые (100*/month)
  const entriesFirstLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    const pickBySuffix = (obj, suffix) => {
      if (!obj) return undefined;
      const sfx = String(suffix).toLowerCase();
      for (const k of Object.keys(obj)) if (k.toLowerCase().endsWith(sfx)) return obj[k];
      return undefined;
    };
    for (const e of entries) {
      const obj = e && e.data && typeof e.data === "object" ? e.data : null;
      if (!obj) continue;
      const vOld = pickBySuffix(obj, "_old");
      const vNew = pickBySuffix(obj, "_new");
      const vRounded = pickBySuffix(obj, "_rounded");
      const vTimes = e?.multiplier;
      lines.push(
        `[b]Последнее обработанное значение:[/b] ${vOld ?? ""}`,
        `[b]Текущее значение:[/b] ${vNew ?? ""}`,
        `[b]Условно округленное значение:[/b] ${vRounded ?? ""}`,
        `[b]Сколько раз начисляем:[/b] ${vTimes ?? ""}`
      );
    }
    return lines;
  };

  // last groups
  const entriesThirdCharLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const d = e?.data; if (!d) continue;
      const arr = Array.isArray(d) ? d : [d];
      for (const it of arr) { const url = it?.url ?? ""; if (url) lines.push(`[b]Согласование:[/b] ${url}`); }
    }
    return lines;
  };

  const entriesChangeCharLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const d = e?.data; if (!d) continue;
      const arr = Array.isArray(d) ? d : [d];
      for (const it of arr) { const text = it?.text ?? ""; if (text !== "") lines.push(`[b]Новое имя профиля:[/b]\n[code]${text}[/code]`); }
    }
    return lines;
  };

  const entriesRefuseLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    for (const e of entries) {
      const d = e?.data; if (!d) continue;
      const arr = Array.isArray(d) ? d : [d];
      for (const it of arr) { const comment = it?.comment ?? ""; if (comment !== "") lines.push(`[b]Комментарий:[/b]\n${comment}`); }
    }
    return lines;
  };

  const entriesTransferLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data; if (!obj || typeof obj !== "object") continue;
      for (const key of Object.keys(obj)) {
        if (key.startsWith("recipient_")) {
          const suffix = key.split("_")[1];
          const rec = obj[`recipient_${suffix}`];
          const amt = obj[`amount_${suffix}`];
          if (rec) { lines.push(`${idx}. ${BASE_URL}/profile.php?id=${rec} — ${amt ?? ""}`); idx++; }
        }
      }
    }
    return lines;
  };

  const entriesFinalExpLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data; if (!obj || typeof obj !== "object") continue;
      const recipientKeys = Object.keys(obj).filter(k => k.startsWith("recipient_"));
      recipientKeys.forEach((key, i) => {
        const suffix = key.split("_")[1];
        const rec  = obj[`recipient_${suffix}`];
        const qty  = obj[`quantity_${suffix}`];
        const from = obj[`from_${suffix}`];
        const wish = obj[`wish_${suffix}`];
        const hasFrom = nonEmpty(from);
        const hasWish = nonEmpty(wish);
        if (!rec) return;
        let block = `${idx}. ${BASE_URL}/profile.php?id=${rec} — ${qty ?? ""}\n`;
        if (hasFrom || hasWish) {
          let commentText = "";
          if (hasFrom && hasWish) commentText = `${String(from).trim()}: ${String(wish).trim()}`;
          else if (hasFrom) commentText = String(from).trim();
          else if (hasWish) commentText = String(wish).trim();
          block += `\n[b]Комментарий:[/b]\n[code]${commentText}[/code]`;
        }
        const isLast = i === recipientKeys.length - 1;
        block += (!isLast && (hasFrom || hasWish)) ? `[hr]\n` : ``;
        lines.push(block);
        idx++;
      });
    }
    return lines;
  };

  const entriesGiftLikeLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const obj = e?.data; if (!obj || typeof obj !== "object") continue;
      const recipientKeys = Object.keys(obj).filter(k => k.startsWith("recipient_"));
      recipientKeys.forEach((key, i) => {
        const suffix = key.split("_")[1];
        const rec   = obj[`recipient_${suffix}`];
        const fromV = obj[`from_${suffix}`];
        const wishV = obj[`wish_${suffix}`];
        const dataV = obj[`gift_data_${suffix}`];
        const hasFrom = nonEmpty(fromV);
        const hasWish = nonEmpty(wishV);
        const hasData = nonEmpty(dataV);
        if (!rec) return;
        let block = `${idx}. ${BASE_URL}/profile.php?id=${rec}\n`;
        if (hasFrom || hasWish) {
          let commentText = "";
          if (hasFrom && hasWish) commentText = `${String(fromV).trim()}: ${String(wishV).trim()}`;
          else if (hasFrom) commentText = String(fromV).trim();
          else if (hasWish) commentText = String(wishV).trim();
          block += `\n[b]Комментарий:[/b]\n[code]${commentText}[/code]`;
        }
        if (hasData) block += `\n[b]Данные:[/b]\n${String(dataV)}\n`;
        const isLast = i === recipientKeys.length - 1;
        block += (!isLast && (hasFrom || hasWish || hasData)) ? `[hr]\n` : ``;
        lines.push(block);
        idx++;
      });
    }
    return lines;
  };

  const entriesPriceAdjustmentLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const d = e?.data; if (!d) { idx++; continue; }
      const pack = Array.isArray(d) ? d : [d];
      for (const item of pack) {
        const t  = item?.adjustment_title ?? "";
        const aa = item?.adjustment_amount ?? "";
        lines.push(`${idx}. [b]${t}:[/b] -${aa}`);
      }
      idx++;
    }
    return lines;
  };

  const entriesGiftDiscountLines = (entries) => {
    if (!Array.isArray(entries)) return [];
    const lines = [];
    let idx = 1;
    for (const e of entries) {
      const d = e?.data; if (!d) { idx++; continue; }
      const pack = Array.isArray(d) ? d : [d];
      for (const item of pack) {
        const t  = item?.discount_title ?? "";
        const da = item?.discount_amount ?? "";
        lines.push(`${idx}. [b]${t}:[/b] ${da}`);
      }
      idx++;
    }
    return lines;
  };

  // ---- фильтр и сортировка ----
  const items = data.fullData
    .filter((item) => orderIndex.has(item.form_id))
    .sort((a, b) => orderIndex.get(a.form_id) - orderIndex.get(b.form_id));

  // ---- группы/границы ----
  const incomeSet = new Set([
    ...earliestIds, ...topupAmsIds, ...firstPostIds, ...postIds,
    ...flyerIds, ...firstIds, ...incomeIds, ...bannerIds
  ]);

  // ВАЖНО: добавили giftLikeIds в расходы
  const expenseSet = new Set([
    ...expIds, ...thirdCharIds, ...changeCharIds, ...refuseIds,
    ...transferIds, ...finalExpIds, ...priceAdjustmentIds, ...giftLikeIds
  ]);

  const hideSet = new Set([
    ...finalExpIds, ...giftLikeIds, ...priceAdjustmentIds
  ]);

  const hasIncomeGroup  = items.some(it => incomeSet.has(it.form_id));
  const firstExpenseIdx = items.findIndex(it => expenseSet.has(it.form_id));
  const hasExpenseGroup = firstExpenseIdx !== -1;

  let firstHideIdx = -1, lastHideIdx = -1;
  items.forEach((it, idx) => {
    if (hideSet.has(it.form_id)) {
      if (firstHideIdx === -1) firstHideIdx = idx;
      lastHideIdx = idx;
    }
  });
  const hasHideGroup = firstHideIdx !== -1;

  const blocks = [];
  if (hasIncomeGroup) blocks.push(`[quote][size=16][b][align=center]ДОХОДЫ[/align][/b][/size][/quote]`);

  items.forEach((item, idx) => {
    if (hasExpenseGroup && idx === firstExpenseIdx) {
      blocks.push(`[quote][size=16][b][align=center]РАСХОДЫ[/align][/b][/size][/quote]`);
    }
    if (hasHideGroup && idx === firstHideIdx) blocks.push(`[hide=99999999]`);

    const title = item?.title ?? "";
    const amountLike = item?.modalAmount ?? item?.amount ?? "";

    let rendered;
    if (earliestIds.includes(item.form_id)) {
      rendered = formatBlockNoAmount(title, entriesEarliestLines(item.entries, item.price));
    } else if (topupAmsIds.includes(item.form_id)) {
      rendered = formatBlockNoAmount(title, entriesTopupAmsLines(item.entries));
    } else if (firstPostIds.includes(item.form_id)) {
      rendered = formatSimple(title, amountLike);
    } else if (postIds.includes(item.form_id)) {
      const which = item.form_id === "form-income-personalpost" ? "personal" : "plot";
      rendered = formatBlock(title, amountLike, entriesPostsLines(item.entries, which));
    } else if (flyerIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesFlyerLines(item.entries));
    } else if (firstIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesFirstLines(item.entries));
    } else if (bannerIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesBannerLines(item.entries));
    } else if (expIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesQuantityLines(item.entries));
    } else if (thirdCharIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesThirdCharLines(item.entries));
    } else if (changeCharIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesChangeCharLines(item.entries));
    } else if (refuseIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesRefuseLines(item.entries));
    } else if (transferIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesTransferLines(item.entries));
    } else if (finalExpIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesFinalExpLines(item.entries));
    } else if (giftLikeIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesGiftLikeLines(item.entries));
    } else if (priceAdjustmentIds.includes(item.form_id)) {
      rendered = formatBlockNoAmount(title, entriesPriceAdjustmentLines(item.entries));
    } else if (giftDiscountIds.includes(item.form_id)) {
      rendered = formatBlock(title, amountLike, entriesGiftDiscountLines(item.entries));
    } else {
      rendered = formatBlock(title, amountLike, entriesValuesLines(item.entries));
    }

    blocks.push(rendered);
    if (hasHideGroup && idx === lastHideIdx) blocks.push(`[/hide]`);
  });

  let result = blocks.join("\n\n");

  if (typeof data.totalSum !== "undefined" && data.totalSum !== null && data.totalSum !== "") {
    const clr = Number(data.totalSum) < 0 ? "red" : "green";
    const sign = Number(data.totalSum) > 0 ? "+" : "";
    result += `\n\n[quote][size=16][align=center][b]ИТОГО:[/b] [color=${clr}]${sign}${data.totalSum}[/color][/align][/size][/quote]`;
  }

  return result;
}

// Функция кодирования JSON в короткий код (base64 + сжатие)
function encodeJSON(obj) {
  const json = JSON.stringify(obj);
  // Преобразуем в UTF-8 и сжимаем через встроенный TextEncoder + base64
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
  const base64 = btoa(binary);
  return base64;
}

// Функция декодирования обратно в JSON
function decodeJSON(code) {
  const binary = atob(code);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

// Ищет в живом DOM (по умолчанию — во всём документе)
function getBlockquoteTextAfterPersonalPost(
  root,
  label,
  mode = ''
) {
  // helper для блока "last_value"
  function extractLastValue(r = root) {
    const target = Array.from(r.querySelectorAll('strong'))
      .find(s => s.textContent.trim().startsWith('Условно округленное значение:'));
    if (!target) return null;

    const parts = [];
    // собираем текстовые/элементные узлы после <strong> до следующего <strong> в том же родителе
    for (let n = target.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType === Node.ELEMENT_NODE && n.tagName?.toLowerCase() === 'strong') break;
      if (n.nodeType === Node.TEXT_NODE) parts.push(n.nodeValue);
      else if (n.nodeType === Node.ELEMENT_NODE) parts.push(n.textContent);
    }
    const val = parts.join(' ').replace(/\s+/g, ' ').trim();
    return val || null;
  }

  // ищем <p>, внутри которого есть <strong> с нужным текстом
  const pWithLabel = Array.from(root.querySelectorAll('p > strong'))
    .map(s => s.closest('p'))
    .find(p => p && p.querySelector('strong')?.textContent?.includes(label));

  if (!pWithLabel) return null;

  // идём по соседям до следующего <p>, ищем первый blockquote
  let blockquote = null;
  for (let el = pWithLabel.nextElementSibling; el; el = el.nextElementSibling) {
    if (el.tagName?.toLowerCase() === 'p') break; // дошли до следующего параграфа — стоп
    const bq = el.matches?.('blockquote') ? el : el.querySelector?.('blockquote');
    if (bq) { blockquote = bq; break; }
  }

  if (!blockquote) return null;

  // режим "last_value" не зависит от "Каждый личный пост"
  if (mode === 'last_value') {
    return extractLastValue(blockquote);
  }

  // режимы возврата
  if (mode === 'link') {
    return Array.from(blockquote.querySelectorAll('a'))
      .map(a => a.getAttribute('href'))
      .filter(Boolean);
  }

  // режим по умолчанию — как было
  return blockquote.innerHTML.trim();
}


function getBlockquoteTextFromHtml(html, label, mode = '') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return getBlockquoteTextAfterPersonalPost(doc, label, mode);
}


window.formatBankText = formatBankText;
window.encodeJSON = encodeJSON;
window.decodeJSON = decodeJSON;
window.getBlockquoteTextAfterPersonalPost = getBlockquoteTextAfterPersonalPost;
window.getBlockquoteTextFromHtml = getBlockquoteTextFromHtml;
