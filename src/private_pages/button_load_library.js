// button_load_library.js
// Кнопка "Подгрузить библиотеку" для загрузки данных из постов библиотеки в API

(() => {
  'use strict';

  console.log('[button_load_library] Скрипт загружен');
  console.log('[button_load_library] window.SKIN:', window.SKIN);

  // Проверяем наличие нужных полей
  if (!window.SKIN || !window.SKIN.LibraryFieldID) {
    console.warn('[button_load_library] Требуется window.SKIN с LibraryFieldID');
    console.warn('[button_load_library] window.SKIN:', window.SKIN);
    return;
  }

  const LIBRARY_FORUM_ID = [window.SKIN.LibraryForumID];
  const GID = window.SKIN.GroupID || [];

  console.log('[button_load_library] LIBRARY_FORUM_ID:', LIBRARY_FORUM_ID);
  console.log('[button_load_library] GID:', GID);

  // ID постов библиотеки
  const LIBRARY_POSTS = {
    gift: window.SKIN.LibraryGiftPostID || [],
    plashka: window.SKIN.LibraryPlashkaPostID || [],
    icon: window.SKIN.LibraryIconPostID || [],
    background: window.SKIN.LibraryBackPostID || [],
    coupon: window.SKIN.LibraryCouponPostID || []
  };

  /**
   * Парсит article.card для обычных скинов (gift, plashka, icon, background)
   */
  function parseCardArticle(article) {
    const idEl = article.querySelector('.id');
    const contentEl = article.querySelector('.content');
    const descEl = article.querySelector('.desc');

    if (!idEl) return null;

    const id = idEl.textContent.trim();
    if (!id) return null;

    const item = {
      id: id,
      content: contentEl ? contentEl.innerHTML.trim() : '',
      t: descEl ? descEl.textContent.trim() : '' // title -> t
    };

    // Проверяем классы (сохраняем как 1/0)
    item.h = article.classList.contains('hidden') ? 1 : 0;  // hidden -> h
    item.c = article.classList.contains('custom') ? 1 : 0;  // custom -> c
    item.s = article.classList.contains('system') ? 1 : 0;  // system -> s

    return item;
  }

  /**
   * Парсит article.card для купонов
   */
  function parseCouponArticle(article) {
    const idEl = article.querySelector('.id');
    const contentEl = article.querySelector('.content');
    const descEl = article.querySelector('.desc');
    const titleEl = article.querySelector('.title');
    const typeEl = article.querySelector('.type');
    const formEl = article.querySelector('.form');
    const valueEl = article.querySelector('.value');

    if (!idEl) return null;

    const id = idEl.textContent.trim();
    if (!id) return null;

    const item = {
      id: id,
      content: contentEl ? contentEl.innerHTML.trim() : '',
      t: descEl ? descEl.textContent.trim() : '' // title -> t
    };

    // Дополнительные поля для купонов (могут отсутствовать)
    if (titleEl) {
      const titleText = titleEl.textContent.trim();
      if (titleText) {
        item.s_t = titleText; // system_title -> s_t
      }
    }

    if (typeEl) {
      const typeText = typeEl.textContent.trim();
      if (typeText) {
        item.type = typeText;
      }
    }

    if (formEl) {
      const formText = formEl.textContent.trim();
      if (formText) {
        item.f = formText; // form -> f
      }
    }

    if (valueEl) {
      const val = valueEl.textContent.trim();
      if (val) {
        const numVal = Number(val);
        if (!isNaN(numVal)) {
          item.v = numVal; // value -> v
        }
      }
    }

    // У купонов НЕТ полей hidden, custom, system

    return item;
  }

  /**
   * Декодирует HTML entities
   */
  function decodeEntities(str) {
    const div = document.createElement('div');
    div.innerHTML = String(str ?? '');
    return div.textContent || div.innerText || '';
  }

  /**
   * Загружает HTML с правильной кодировкой
   */
  async function smartFetchHtml(url) {
    const res = await fetch(url, { credentials: 'include' });
    const buf = await res.arrayBuffer();

    const tryDec = enc => {
      try {
        return new TextDecoder(enc).decode(buf);
      } catch {
        return null;
      }
    };

    // Пробуем UTF-8 и Windows-1251
    const utf = tryDec('utf-8') ?? '';
    const cp = tryDec('windows-1251') ?? '';

    // Считаем количество �� (replacement characters)
    const bad = s => (s.match(/\uFFFD/g) || []).length;

    if (bad(cp) && !bad(utf)) return utf;
    if (bad(utf) && !bad(cp)) return cp;

    // Считаем кириллицу
    const cyr = s => (s.match(/[\u0400-\u04FF]/g) || []).length;
    return cyr(cp) > cyr(utf) ? cp : utf;
  }

  /**
   * Загружает и парсит пост библиотеки
   */
  async function loadLibraryPost(postId, isCoupon = false) {
    try {
      const url = `/viewtopic.php?pid=${postId}#p${postId}`;
      console.log(`[button_load_library] Загружаю URL: ${url}`);

      const html = await smartFetchHtml(url);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Ищем конкретный пост по ID: #p<postId>-content
      const postContent = doc.querySelector(`#p${postId}-content`);
      if (!postContent) {
        console.warn(`[button_load_library] Не найден #p${postId}-content`);
        return [];
      }

      console.log(`[button_load_library] Найден #p${postId}-content`);

      // Ищем script[type="text/html"] внутри поста
      const scripts = [...postContent.querySelectorAll('script[type="text/html"]')];
      console.log(`[button_load_library] Найдено script[type="text/html"]: ${scripts.length}`);

      if (!scripts.length) {
        console.warn(`[button_load_library] Нет script[type="text/html"] в посте ${postId}`);
        return [];
      }

      // Извлекаем и декодируем HTML из скриптов
      const combined = scripts.map(s => s.textContent || s.innerHTML || '').join('\n');
      const decoded = decodeEntities(combined).replace(/\u00A0/g, ' ');

      // Парсим декодированный HTML
      const innerDoc = parser.parseFromString(decoded, 'text/html');

      // Ищем article.card внутри #grid
      const articles = innerDoc.querySelectorAll('#grid article.card');
      console.log(`[button_load_library] Найдено article.card: ${articles.length}`);

      const items = [];

      for (const article of articles) {
        const item = isCoupon ? parseCouponArticle(article) : parseCardArticle(article);
        if (item) {
          items.push(item);
        }
      }

      return items;
    } catch (error) {
      console.error(`[button_load_library] Ошибка загрузки поста ${postId}:`, error);
      return [];
    }
  }

  /**
   * Собирает данные из всех постов библиотеки
   */
  async function collectLibraryData() {
    const result = {
      gift: [],
      plashka: [],
      icon: [],
      background: [],
      coupon: []
    };

    for (const [category, postIds] of Object.entries(LIBRARY_POSTS)) {
      if (!Array.isArray(postIds) || postIds.length === 0) {
        console.log(`[button_load_library] Нет постов для категории ${category}`);
        continue;
      }

      const isCoupon = category === 'coupon';

      for (const postId of postIds) {
        console.log(`[button_load_library] Загружаю пост ${postId} для ${category}...`);
        const items = await loadLibraryPost(postId, isCoupon);
        result[category].push(...items);
        console.log(`[button_load_library] Загружено ${items.length} элементов из поста ${postId}`);
      }
    }

    return result;
  }

  /**
   * Сохраняет данные библиотеки в API (в отдельные ключи)
   */
  async function saveLibraryToAPI(data) {
    if (!window.FMVbank || typeof window.FMVbank.storageSet !== 'function') {
      throw new Error('FMVbank.storageSet не найден');
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Сохраняем каждую категорию в отдельный ключ
    const categories = ['icon', 'plashka', 'background', 'gift', 'coupon'];

    for (const category of categories) {
      const saveData = {
        items: data[category] || [],
        last_timestamp: timestamp
      };

      console.log(`[button_load_library] Сохраняю ${category}:`, saveData);

      // Сохраняем с userId=1 и api_key_label='library_<category>_'
      const result = await window.FMVbank.storageSet(saveData, 1, `library_${category}_`);

      if (!result) {
        throw new Error(`Не удалось сохранить данные для ${category} в API`);
      }
    }

    return true;
  }

  // Создаём кнопку
  console.log('[button_load_library] Проверяем createForumButton:', typeof window.createForumButton);
  if (typeof window.createForumButton === 'function') {
    console.log('[button_load_library] Создаём кнопку с параметрами:', {
      allowedGroups: GID,
      allowedForums: LIBRARY_FORUM_ID,
      label: 'Подгрузить библиотеку'
    });

    window.createForumButton({
      allowedGroups: GID,
      allowedForums: LIBRARY_FORUM_ID,
      label: 'Подгрузить библиотеку',
      order: 1,
      showStatus: true,
      showDetails: true,
      showLink: false,

      async onClick(api) {
        const setStatus = api?.setStatus || (() => { });
        const setDetails = api?.setDetails || (() => { });

        try {
          setStatus('Собираю данные...');
          setDetails('');

          // Собираем данные из постов
          const libraryData = await collectLibraryData();

          // Подсчитываем общее количество элементов
          const total = Object.values(libraryData).reduce((sum, arr) => sum + arr.length, 0);

          if (total === 0) {
            setStatus('✓ готово', 'green');
            setDetails('Не найдено элементов в постах библиотеки');
            return;
          }

          setStatus('Сохраняю...');

          // Сохраняем в API
          await saveLibraryToAPI(libraryData);

          setStatus('✓ готово', 'green');
          const details = Object.entries(libraryData)
            .map(([key, arr]) => `${key}: ${arr.length} шт.`)
            .join('<br>');
          setDetails(`Загружено элементов:<br>${details}<br>Всего: ${total}`);

        } catch (error) {
          setStatus('✖ ошибка', 'red');
          setDetails(error?.message || String(error));
          console.error('[button_load_library] Ошибка:', error);
        }
      }
    });
    console.log('[button_load_library] Кнопка создана');
  } else {
    console.warn('[button_load_library] createForumButton не найдена');
  }

  console.log('[button_load_library] Инициализация завершена');
})();
