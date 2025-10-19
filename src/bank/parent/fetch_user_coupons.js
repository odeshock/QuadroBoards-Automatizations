const typeRank = { item: 0, fixed: 1 };
const rankType = t => (t in typeRank ? typeRank[t] : 2);

// Безопасное приведение value к числу (нечисловые → -Infinity, чтобы улетали в конец при убывании)
const toNumber = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : -Infinity;
};

// Приведение expiresAt к таймстемпу; невалидные/пустые → +Infinity (как «без срока» в конце)
const toTimeOrInf = v => {
  if (v === undefined || v === null || v === "") return Infinity;
  const t = (v instanceof Date) ? v.getTime() : Date.parse(v);
  return Number.isFinite(t) ? t : Infinity;
};

const comparator = (a, b) => {
  // 1) type: item → fixed → остальное
  let diff = rankType(a.type) - rankType(b.type);
  if (diff !== 0) return diff;

  // 2) value: по убыванию
  diff = toNumber(b.value) - toNumber(a.value);
  if (diff !== 0) return diff;

  // 3) expiresAt: присутствующие раньше отсутствующих; внутри — по возрастанию
  const ta = toTimeOrInf(a.expiresAt);
  const tb = toTimeOrInf(b.expiresAt);

  // Если у одного Infinity (нет срока), он идёт позже
  if (ta === Infinity && tb !== Infinity) return 1;
  if (tb === Infinity && ta !== Infinity) return -1;

  // Оба есть или оба Infinity → обычное сравнение
  diff = ta - tb;
  if (diff !== 0) return diff;

  return 0;
};

/**
 * Загружает страницу /pages/usrN и извлекает user_id из .modal_script
 * Приоритет: data-main-user_id > N из URL
 */
async function getUserIdFromPage(profileId) {
  try {
    const pageUrl = `/pages/usr${profileId}`;
    const response = await fetch(pageUrl);
    if (!response.ok) {
      console.error(`[fetchUserCoupons] Не удалось загрузить ${pageUrl}`);
      return Number(profileId);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const modalScript = doc.querySelector('.modal_script');
    if (!modalScript) {
      console.warn(`[fetchUserCoupons] .modal_script не найден в ${pageUrl}, используем profileId=${profileId}`);
      return Number(profileId);
    }

    const mainUserId = modalScript.getAttribute('data-main-user_id');
    if (mainUserId && mainUserId.trim()) {
      console.log(`[fetchUserCoupons] Найден data-main-user_id=${mainUserId}`);
      return Number(mainUserId.trim());
    }

    // Если data-main-user_id не указан, используем profileId
    return Number(profileId);
  } catch (err) {
    console.error('[fetchUserCoupons] Ошибка загрузки страницы:', err);
    return Number(profileId);
  }
}

/**
 * Загружает персональные купоны пользователя из API.
 * Следует data-main-user_id и валидирует даты истечения.
 *
 * @returns {Promise<Array<{system_id: string, type: string, form: string, value: number, title: string, html: string, expiresAt?: string}>>}
 */
async function fetchUserCoupons() {
  // Получаем ID пользователя
  const profileId = window.UserID;
  if (!profileId) {
    console.warn('[fetchUserCoupons] window.UserID не определён');
    return [];
  }

  // Получаем целевой userId с учётом data-main-user_id (async!)
  const userId = await getUserIdFromPage(profileId);
  console.log('[fetchUserCoupons] Целевой userId:', userId);

  // Проверяем доступность API
  if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
    console.error('[fetchUserCoupons] FMVbank.storageGet не найден');
    return [];
  }

  // Функция для получения текущей даты в МСК (yyyy-mm-dd)
  const getTodayMoscow = () => {
    const now = new Date();
    const moscowOffset = 3 * 60; // UTC+3
    const localOffset = now.getTimezoneOffset(); // минуты от UTC
    const moscowTime = new Date(now.getTime() + (moscowOffset + localOffset) * 60000);

    const year = moscowTime.getFullYear();
    const month = String(moscowTime.getMonth() + 1).padStart(2, '0');
    const day = String(moscowTime.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const today = getTodayMoscow();

  // Загружаем купоны из API
  let response;
  try {
    response = await window.FMVbank.storageGet(userId, 'coupon_');
    console.log(response.data);
    console.log('[fetchUserCoupons] API ответ:', response);
  } catch (error) {
    console.error('[fetchUserCoupons] Ошибка загрузки из API:', error);
    return [];
  }

  // Новый формат: { last_update_ts, data: [...] }
  if (!response || typeof response !== 'object' || !Array.isArray(response.data)) {
    console.warn('[fetchUserCoupons] Неверный формат ответа API');
    return [];
  }

  const coupons = [];

  response.data.forEach(item => {
    // Пропускаем невидимые элементы
    if (item.is_visible === false) {
      console.log(`[fetchUserCoupons] Пропущен невидимый купон id=${item.id}`);
      return;
    }

    // Извлекаем данные из item
    const systemId = String(item.id || '');
    const type = item.coupon_type || '';
    const form = item.coupon_form || '';
    const value = Number(item.coupon_value || 0);
    const title = item.coupon_title || item.title || '';
    const expiresAt = item.expired_date; // yyyy-mm-dd

    // Фильтрация по дате истечения
    if (expiresAt) {
      // Сравниваем даты как строки (yyyy-mm-dd формат позволяет это)
      if (expiresAt < today) {
        console.log(`[fetchUserCoupons] Пропущен купон "${title}" (истёк: ${expiresAt} < ${today})`);
        return; // Пропускаем истекший купон
      }
    }

    // Восстанавливаем HTML из content — берём ВСЕ атрибуты из JSON
    const escapeAttr = s => (s || '').replace(/"/g, '&quot;');
    const attrs = [
      `data-id="${escapeAttr(systemId)}"`,
      `title="${escapeAttr(item.title || '')}"`
    ];

    // Добавляем ВСЕ data-* атрибуты из JSON (кроме id, title, content, is_visible)
    Object.keys(item).forEach(key => {
      if (key !== 'id' && key !== 'title' && key !== 'content' && key !== 'is_visible') {
        const attrName = 'data-' + key.replace(/_/g, '-');
        attrs.push(`${attrName}="${escapeAttr(String(item[key] || ''))}"`);
      }
    });

    const html = `<div class="item" ${attrs.join(' ')}>${item.content || ''}</div>`;

    const coupon = {
      system_id: systemId,
      type: type,
      form: form,
      value: value,
      title: title,
      html: html
    };

    // Добавляем expiresAt только если он указан
    if (expiresAt) {
      coupon.expiresAt = expiresAt;
    }

    coupons.push(coupon);
  });

  console.log(`[fetchUserCoupons] Загружено купонов: ${coupons.length}`);
  const update_data = coupons.sort(comparator);
  update_data.forEach((item, index) => {
    item.id = String(index + 1);
  });
  return update_data;
}

// Экспортируем в window
window.fetchUserCoupons = fetchUserCoupons;
