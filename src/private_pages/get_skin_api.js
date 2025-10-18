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
 * Получает user_id с учётом data-main-user_id
 */
function getUserIdFromPage(profileId) {
  const modal = document.querySelector('.modal_script[data-id]');
  if (modal) {
    const mainUserId = modal.getAttribute('data-main-user_id');
    if (mainUserId && mainUserId.trim()) {
      return Number(mainUserId.trim());
    }
  }
  return Number(profileId);
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
      const data = await window.FMVbank.storageGet(userId, label);
      console.log(`[get_skin_api] ${key} данные:`, data);

      // Данные хранятся в формате { "user_id": [...] }
      const userData = data?.[String(userId)];
      if (Array.isArray(userData)) {
        // Конвертируем каждый item в HTML
        result[key] = userData.map(item => item.content || '').filter(Boolean);
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

  // Получаем целевой userId с учётом data-main-user_id
  const userId = getUserIdFromPage(profileId);
  console.log('[get_skin_api] Целевой userId:', userId);

  // Загружаем из API
  const result = await loadSkinsFromAPI(userId);

  console.log('[get_skin_api] Данные загружены:', result);
  return result;
}
