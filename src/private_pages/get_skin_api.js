// get_skin_api.js — Загрузка данных скинов из API вместо страниц

// Флаг отладки - установите в true для вывода логов
const DEBUG = false;

// Функция логирования с проверкой DEBUG
const log = (...args) => {
  if (DEBUG) console.log('[get_skin_api]', ...args);
};

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
      console.error('[get_skin_api] Не удалось загрузить', pageUrl);
      return Number(profileId);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const modalScript = doc.querySelector('.modal_script');
    if (!modalScript) {
      log(`.modal_script не найден в ${pageUrl}, используем profileId=${profileId}`);
      return Number(profileId);
    }

    const mainUserId = modalScript.getAttribute('data-main-user_id');
    if (mainUserId && mainUserId.trim()) {
      log(`Найден data-main-user_id=${mainUserId}`);
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
  log('Загружаю данные из API для userId:', userId);

  if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
    console.error('[get_skin_api] FMVbank.storageGet не найден');
    return { icons: [], plashki: [], backs: [] };
  }

  const result = {
    icons: [],
    plashki: [],
    backs: []
  };

  try {
    // Загружаем единый объект skin_<userId>
    const response = await window.FMVbank.storageGet(userId, 'skin_');
    log('skin_ ответ:', response);

    if (!response || typeof response !== 'object') {
      log('Нет данных в skin_ для userId:', userId);
      return result;
    }

    // Маппинг ключей API -> результат
    const mapping = {
      icon: 'icons',
      plashka: 'plashki',
      background: 'backs'
    };

    for (const [apiKey, resultKey] of Object.entries(mapping)) {
      const items = response[apiKey];
      if (Array.isArray(items)) {
        // Конвертируем каждый item в HTML
        result[resultKey] = items.map(item => item.content || '').filter(Boolean);
        log(`${resultKey} загружено ${items.length} элементов`);
      } else {
        log(`${resultKey} отсутствует или не массив`);
      }
    }

  } catch (e) {
    console.error('[get_skin_api] Ошибка загрузки данных:', e);
  }

  log('Результат:', result);
  return result;
}

/**
 * Загружает данные скинов из API и возвращает массивы HTML
 * { icons: string[], plashki: string[], backs: string[] }
 */
async function collectSkinSets() {
  log('collectSkinSets вызван');

  if (!isProfileFieldsPage()) {
    log('Не страница fields');
    return { icons: [], plashki: [], backs: [] };
  }

  const profileId = getProfileId();
  log('profileId:', profileId);

  // Получаем целевой userId с учётом data-main-user_id (async!)
  const userId = await getUserIdFromPage(profileId);
  log('Целевой userId:', userId);

  // Загружаем из API
  const result = await loadSkinsFromAPI(userId);

  log('Данные загружены:', result);
  return result;
}
