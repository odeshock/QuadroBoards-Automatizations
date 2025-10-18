// get_skin_api.js — Загрузка данных скинов из API вместо страниц

function isProfileFieldsPage() {
  try {
    const u = new URL(location.href);
    return /\/profile\.php$/i.test(u.pathname) &&
           u.searchParams.get('section') === 'fields' &&
           /^\d+$/.test(u.searchParams.get('id') || '');
  } catch { return false; }
}

function getProfileId() {
  const u = new URL(location.href);
  return u.searchParams.get('id') || '';
}

/**
 * Загружает страницу /pages/usrN и извлекает user_id из .modal_script
 * Приоритет: data-main-user_id > N из URL
 */
async function getUserIdFromPage(profileId) {
  try {
    const pageUrl = `/pages/usr${profileId}`;
    const response = await fetch(pageUrl);
    if (!response.ok) {
      console.error(`[get_skin_api] Не удалось загрузить ${pageUrl}`);
      return Number(profileId);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const modalScript = doc.querySelector('.modal_script');
    if (!modalScript) {
      console.warn(`[get_skin_api] .modal_script не найден в ${pageUrl}, используем profileId=${profileId}`);
      return Number(profileId);
    }

    const mainUserId = modalScript.getAttribute('data-main-user_id');
    if (mainUserId && mainUserId.trim()) {
      console.log(`[get_skin_api] Найден data-main-user_id=${mainUserId}`);
      return Number(mainUserId.trim());
    }

    // Если data-main-user_id не указан, используем profileId
    return Number(profileId);
  } catch (err) {
    console.error('[get_skin_api] Ошибка загрузки страницы:', err);
    return Number(profileId);
  }
}

/**
 * Загружает данные из API для всех категорий
 */
async function loadSkinsFromAPI(userId) {
  console.log('[get_skin_api] Загружаю данные из API для userId:', userId);

  if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
    console.error('[get_skin_api] FMVbank.storageGet не найден');
    return { icons: [], plashki: [], backs: [] };
  }

  const result = {
    icons: [],
    plashki: [],
    backs: []
  };

  const apiLabels = {
    icons: 'icon_',
    plashki: 'plashka_',
    backs: 'background_'
  };

  for (const [key, label] of Object.entries(apiLabels)) {
    try {
      const response = await window.FMVbank.storageGet(userId, label);
      console.log(`[get_skin_api] ${key} ответ:`, response);

      // Новый формат: { last_update_ts, data: [...] }
      if (response && typeof response === 'object' && Array.isArray(response.data)) {
        // Конвертируем каждый item в HTML
        result[key] = response.data.map(item => item.content || '').filter(Boolean);
        console.log(`[get_skin_api] ${key} загружено ${response.data.length} элементов`);
      }
    } catch (e) {
      console.error(`[get_skin_api] Ошибка загрузки ${key}:`, e);
    }
  }

  console.log('[get_skin_api] Результат:', result);
  return result;
}

/**
 * Загружает данные скинов из API и возвращает массивы HTML
 * { icons: string[], plashki: string[], backs: string[] }
 */
async function collectSkinSets() {
  console.log('[get_skin_api] collectSkinSets вызван');

  if (!isProfileFieldsPage()) {
    console.log('[get_skin_api] Не страница fields');
    return { icons: [], plashki: [], backs: [] };
  }

  const profileId = getProfileId();
  console.log('[get_skin_api] profileId:', profileId);

  // Получаем целевой userId с учётом data-main-user_id (async!)
  const userId = await getUserIdFromPage(profileId);
  console.log('[get_skin_api] Целевой userId:', userId);

  // Загружаем из API
  const result = await loadSkinsFromAPI(userId);

  console.log('[get_skin_api] Данные загружены:', result);
  return result;
}
