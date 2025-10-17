/**
 * Загружает персональные купоны пользователя с его профильной страницы.
 * Следует редиректам (main: usrK_skin) и валидирует даты истечения.
 *
 * @returns {Promise<Array<{system_id: string, type: string, form: string, value: number, title: string, html: string, expiresAt?: string}>>}
 */
async function fetchUserCoupons() {
  // Получаем ID пользователя
  const userId = window.UserID;
  if (!userId) {
    console.warn('[fetchUserCoupons] window.UserID не определён');
    return [];
  }

  // Используем window.fetchHtml если доступна (из helpers.js), иначе fetchWithRetry
  const fetchFunc = typeof window.fetchHtml === 'function'
    ? window.fetchHtml
    : async (url) => {
        const fetchWithRetry = window.fetchWithRetry || (async (u, init) => fetch(u, init));
        const res = await fetchWithRetry(url, { credentials: 'include' });
        return res.text();
      };

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

  // Загружаем страницу пользователя
  let currentUrl = `${location.origin}/pages/usr${userId}_skin`;
  let pageHtml;

  try {
    pageHtml = await fetchFunc(currentUrl);
  } catch (error) {
    console.error(`[fetchUserCoupons] Ошибка загрузки ${currentUrl}:`, error);
    return [];
  }

  const doc = new DOMParser().parseFromString(pageHtml, 'text/html');
  const container = doc.querySelector('div.container');

  if (!container) {
    console.warn('[fetchUserCoupons] Не найден div.container');
    return [];
  }

  // Проверяем на ошибку "неверная ссылка"
  const errorText = 'Ссылка, по которой Вы пришли, неверная или устаревшая.';
  if (container.textContent.includes(errorText)) {
    console.log('[fetchUserCoupons] Страница не найдена (ошибка "неверная ссылка")');
    return [];
  }

  // Проверяем на редирект (<!-- main: usrK_skin -->)
  const commentNodes = Array.from(container.childNodes).filter(node => node.nodeType === Node.COMMENT_NODE);
  const mainComment = commentNodes.find(comment => comment.textContent.trim().startsWith('main: usr'));

  if (mainComment) {
    const match = mainComment.textContent.trim().match(/main:\s*usr(\d+)_skin/);
    if (match) {
      const redirectUserId = match[1];
      console.log(`[fetchUserCoupons] Редирект на usr${redirectUserId}_skin`);

      // Загружаем страницу редиректа
      const redirectUrl = `${location.origin}/pages/usr${redirectUserId}_skin`;
      try {
        pageHtml = await fetchFunc(redirectUrl);
      } catch (error) {
        console.error(`[fetchUserCoupons] Ошибка загрузки редиректа ${redirectUrl}:`, error);
        return [];
      }

      const redirectDoc = new DOMParser().parseFromString(pageHtml, 'text/html');
      const redirectContainer = redirectDoc.querySelector('div.container');

      if (!redirectContainer) {
        console.warn('[fetchUserCoupons] Не найден div.container после редиректа');
        return [];
      }

      // Проверяем снова на ошибку
      if (redirectContainer.textContent.includes(errorText)) {
        console.log('[fetchUserCoupons] Страница редиректа не найдена');
        return [];
      }

      // Используем новый документ для поиска купонов
      return extractCouponsFromDoc(redirectDoc, today);
    }
  }

  // Извлекаем купоны из исходного документа
  return extractCouponsFromDoc(doc, today);
}

/**
 * Извлекает купоны из DOM документа
 * @param {Document} doc - DOM документ
 * @param {string} today - Текущая дата в формате yyyy-mm-dd
 * @returns {Array<Object>} - Массив купонов
 */
function extractCouponsFromDoc(doc, today) {
  const couponSection = doc.querySelector('div._coupon');

  if (!couponSection) {
    console.log('[fetchUserCoupons] Не найден div._coupon');
    return [];
  }

  const items = couponSection.querySelectorAll('div.item[data-coupon-type]');
  const coupons = [];

  items.forEach(item => {
    const systemId = item.getAttribute('data-id') || '';
    const type = item.getAttribute('data-coupon-type') || '';
    const form = item.getAttribute('data-coupon-form') || '';
    const valueStr = item.getAttribute('data-coupon-value') || '0';
    const value = Number(valueStr);
    const title = item.getAttribute('data-coupon-title') || '';
    const expiresAt = item.getAttribute('data-expired-date'); // может быть null

    // Фильтрация по дате истечения
    if (expiresAt) {
      // Сравниваем даты как строки (yyyy-mm-dd формат позволяет это)
      if (expiresAt < today) {
        console.log(`[fetchUserCoupons] Пропущен купон "${title}" (истёк: ${expiresAt} < ${today})`);
        return; // Пропускаем истекший купон
      }
    }

    const html = item.outerHTML;

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
  return coupons;
}

// Экспортируем в window
window.fetchUserCoupons = fetchUserCoupons;
