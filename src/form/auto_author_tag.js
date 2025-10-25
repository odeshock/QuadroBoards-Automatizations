// auto_author_tag.js
// Автоматическое добавление метки [FMVauthor]usrN;[/FMVauthor] в комментарии

(() => {
  'use strict';

  // Флаг отладки - установите в true для вывода логов
  const DEBUG = true;

  // Функция логирования с проверкой DEBUG
  const log = (...args) => {
    if (DEBUG) console.log('[auto_author_tag]', ...args);
  };

  // 1. Проверяем наличие textarea
  const textarea = document.querySelector('textarea#main-reply[name="req_message"]');
  if (!textarea) {
    log('Textarea не найден, выходим');
    return;
  }

  log('Textarea найден');

  // 2. Проверяем, не редактируем ли мы первый пост темы
  if (document.querySelector('input[type="checkbox"][name="firstpost"]')) {
    log('Найден firstpost checkbox - это редактирование первого поста, выходим');
    return;
  }

  log('Не редактирование первого поста');

  // Получаем userId
  const userId = window.UserID;
  if (!userId) {
    console.warn('[auto_author_tag] window.UserID не найден');
    return;
  }

  log('UserID:', userId);

  // Проверяем, является ли текущий пользователь GM
  const isGameMaster = Array.isArray(window.GAME_MASTERS) && window.GAME_MASTERS.includes(userId);
  log('Является GM:', isGameMaster);

  // Регулярное выражение для поиска метки автора
  const authorTagRegex = /^\[FMVauthor\]usr(\d+);?\[\/FMVauthor\]\s*/i;

  // Функция для извлечения метки автора из текста
  function extractAuthorTag(text) {
    const match = text.match(authorTagRegex);
    if (match) {
      return {
        authorId: match[1],
        cleanText: text.replace(authorTagRegex, '')
      };
    }
    return null;
  }

  // Функция для добавления метки автора в начало текста
  function addAuthorTag(text, userId) {
    // Проверяем, нет ли уже метки
    if (authorTagRegex.test(text)) {
      return text;
    }
    return `[FMVauthor]usr${userId};[/FMVauthor]${text}`;
  }

  // CSS для плашки и GM-селектора
  let cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .fmvauthor-badge {
        margin-bottom: 8px;
        padding: 8px 12px;
        background-color: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        color: #374151;
        font-weight: 500;
      }
      .fmvauthor-gm-selector {
        margin-bottom: 12px;
        padding: 12px;
        background-color: #fef3c7;
        border: 1px solid #fbbf24;
        border-radius: 6px;
      }
      .fmvauthor-gm-selector label {
        display: block;
        font-weight: 600;
        margin-bottom: 6px;
        font-size: 14px;
        color: #92400e;
      }
      .fmvauthor-gm-selector input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #d97706;
        border-radius: 4px;
        font-size: 14px;
      }
      .fmvauthor-gm-selector .hint {
        margin-top: 4px;
        font-size: 12px;
        color: #92400e;
      }
      .fmvauthor-gm-selector .autocomplete-list {
        position: absolute;
        z-index: 1000;
        background: white;
        border: 1px solid #d97706;
        border-radius: 4px;
        margin-top: 2px;
        max-height: 200px;
        overflow-y: auto;
        display: none;
      }
      .fmvauthor-gm-selector .autocomplete-list.show {
        display: block;
      }
      .fmvauthor-gm-selector .autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
      }
      .fmvauthor-gm-selector .autocomplete-item:hover,
      .fmvauthor-gm-selector .autocomplete-item.active {
        background-color: #fef3c7;
      }
    `;
    document.head.appendChild(style);
  }

  // ===== UI для обычных пользователей: плашка =====
  let authorBadge = null;

  function createAuthorBadge(authorId) {
    if (authorBadge) {
      authorBadge.remove();
    }

    injectCSS();

    authorBadge = document.createElement('div');
    authorBadge.className = 'fmvauthor-badge';
    authorBadge.textContent = `Автор комментария: user${authorId}`;

    // Вставляем перед textarea
    textarea.parentNode.insertBefore(authorBadge, textarea);
    log('Плашка создана для usr' + authorId);
  }

  function removeAuthorBadge() {
    if (authorBadge) {
      authorBadge.remove();
      authorBadge = null;
      log('Плашка удалена');
    }
  }

  // ===== UI для GM: селектор автора =====
  let gmSelector = null;
  let gmSelectedUserId = null;
  let gmKnownUsers = [];

  function createGMSelector(initialAuthorId = null) {
    if (gmSelector) {
      gmSelector.remove();
    }

    injectCSS();

    // Контейнер
    gmSelector = document.createElement('div');
    gmSelector.className = 'fmvauthor-gm-selector';

    // Label
    const label = document.createElement('label');
    label.textContent = 'Автор поста: *';
    label.setAttribute('for', 'fmvauthor-gm-input');

    // Input для автокомплита
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'fmvauthor-gm-input';
    input.placeholder = 'Наберите имя пользователя...';
    input.autocomplete = 'off';

    // Hint
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Обязательное поле. Начните вводить имя или user ID.';

    // Autocomplete list
    const autocompleteList = document.createElement('div');
    autocompleteList.className = 'autocomplete-list';

    gmSelector.appendChild(label);
    gmSelector.appendChild(input);
    gmSelector.appendChild(autocompleteList);
    gmSelector.appendChild(hint);

    // Вставляем перед textarea
    textarea.parentNode.insertBefore(gmSelector, textarea);

    // Если есть начальное значение, устанавливаем его
    if (initialAuthorId) {
      gmSelectedUserId = initialAuthorId;
      const user = gmKnownUsers.find(u => u.id === Number(initialAuthorId));
      if (user) {
        input.value = user.name;
      } else {
        input.value = `user${initialAuthorId}`;
      }
      log('GM selector создан с начальным значением usr' + initialAuthorId);
    } else {
      log('GM selector создан без начального значения');
    }

    // Автокомплит
    setupGMAutocomplete(input, autocompleteList);
  }

  function setupGMAutocomplete(input, listElement) {
    let activeIndex = -1;

    function renderAutocomplete(query) {
      const q = query.toLowerCase().trim();
      listElement.innerHTML = '';

      if (!q) {
        listElement.classList.remove('show');
        return;
      }

      const filtered = gmKnownUsers.filter(user =>
        user.name.toLowerCase().includes(q) ||
        user.code.toLowerCase().includes(q)
      ).slice(0, 20);

      if (filtered.length === 0) {
        listElement.classList.remove('show');
        return;
      }

      filtered.forEach((user, idx) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = `${user.name} (${user.code})`;
        item.dataset.userId = user.id;
        item.dataset.index = idx;

        item.addEventListener('click', () => {
          selectUser(user);
        });

        listElement.appendChild(item);
      });

      listElement.classList.add('show');
      activeIndex = -1;
    }

    function selectUser(user) {
      input.value = user.name;
      gmSelectedUserId = user.id;
      listElement.classList.remove('show');
      log('GM выбрал usr' + user.id, user.name);
    }

    input.addEventListener('input', () => {
      gmSelectedUserId = null; // Сбрасываем выбор при изменении
      renderAutocomplete(input.value);
    });

    input.addEventListener('keydown', (e) => {
      const items = listElement.querySelectorAll('.autocomplete-item');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActiveItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, -1);
        updateActiveItem(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          const userId = items[activeIndex].dataset.userId;
          const user = gmKnownUsers.find(u => u.id === Number(userId));
          if (user) selectUser(user);
        }
      } else if (e.key === 'Escape') {
        listElement.classList.remove('show');
      }
    });

    function updateActiveItem(items) {
      items.forEach((item, idx) => {
        item.classList.toggle('active', idx === activeIndex);
      });
      if (activeIndex >= 0 && items[activeIndex]) {
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      }
    }

    // Закрытие при клике вне
    document.addEventListener('click', (e) => {
      if (!gmSelector?.contains(e.target)) {
        listElement.classList.remove('show');
      }
    });
  }

  function removeGMSelector() {
    if (gmSelector) {
      gmSelector.remove();
      gmSelector = null;
      gmSelectedUserId = null;
      log('GM selector удалён');
    }
  }

  // Сохраняем исходный ID автора, если метка была при загрузке
  let originalAuthorId = null;

  // При загрузке: проверяем textarea на наличие метки
  function initializeTextarea() {
    const currentText = textarea.value;
    const extracted = extractAuthorTag(currentText);

    if (isGameMaster) {
      // Режим GM: показываем селектор
      if (extracted) {
        log('GM режим: найдена метка автора:', extracted.authorId);
        originalAuthorId = extracted.authorId;
        textarea.value = extracted.cleanText;
        createGMSelector(extracted.authorId);
      } else {
        log('GM режим: метка не найдена');
        originalAuthorId = null;
        createGMSelector(null);
      }
    } else {
      // Обычный режим: показываем плашку
      if (extracted) {
        log('Найдена метка автора:', extracted.authorId);
        originalAuthorId = extracted.authorId;
        textarea.value = extracted.cleanText;
        createAuthorBadge(extracted.authorId);
      } else {
        log('Метка автора не найдена');
        originalAuthorId = null;
        removeAuthorBadge();
      }
    }
  }

  // При изменении текста: проверяем, не добавил ли пользователь метку вручную
  textarea.addEventListener('input', () => {
    const extracted = extractAuthorTag(textarea.value);
    if (extracted) {
      // Пользователь добавил метку вручную - удаляем из текста
      textarea.value = extracted.cleanText;

      if (isGameMaster) {
        // В GM режиме обновляем селектор
        if (gmSelector) {
          gmSelectedUserId = extracted.authorId;
          const input = gmSelector.querySelector('input');
          const user = gmKnownUsers.find(u => u.id === Number(extracted.authorId));
          if (input) {
            input.value = user ? user.name : `user${extracted.authorId}`;
          }
        }
      } else {
        // В обычном режиме показываем плашку
        createAuthorBadge(extracted.authorId);
      }
    }
  });

  // Загружаем список пользователей для GM
  async function loadUsers() {
    if (!isGameMaster) return;

    log('Загружаем список пользователей для GM...');

    try {
      // Пробуем использовать FMV.fetchUsers
      if (typeof window.FMV?.fetchUsers === 'function') {
        gmKnownUsers = await window.FMV.fetchUsers();
        log('Пользователи загружены через FMV.fetchUsers:', gmKnownUsers.length);
      }
      // Или scrapeUsers
      else if (typeof window.scrapeUsers === 'function') {
        gmKnownUsers = await window.scrapeUsers();
        log('Пользователи загружены через scrapeUsers:', gmKnownUsers.length);
      }
      // Или scrapedUsers из кэша
      else if (Array.isArray(window.scrapedUsers)) {
        gmKnownUsers = window.scrapedUsers;
        log('Пользователи взяты из scrapedUsers:', gmKnownUsers.length);
      } else {
        console.warn('[auto_author_tag] Нет доступных методов для загрузки пользователей');
        gmKnownUsers = [];
      }
    } catch (error) {
      console.error('[auto_author_tag] Ошибка загрузки пользователей:', error);
      gmKnownUsers = [];
    }
  }

  // Проверяем условия для автоматического добавления метки при submit
  // Возвращает { shouldAdd: boolean, authorId: string|null }
  function shouldAddTagOnSubmit() {
    log('=== Проверка условий для добавления метки ===');

    // Если метка была при загрузке - всегда добавляем её исходное значение
    log('originalAuthorId:', originalAuthorId);
    if (originalAuthorId !== null) {
      log('✅ Метка будет добавлена: была при загрузке, usr' + originalAuthorId);
      return { shouldAdd: true, authorId: originalAuthorId };
    }

    // Проверяем URL - не добавляем на страницах редактирования
    const currentUrl = window.location.href;
    log('Текущий URL:', currentUrl);
    if (/\/edit\.php\?id=/i.test(currentUrl)) {
      log('❌ Страница редактирования - метка НЕ будет добавлена');
      return { shouldAdd: false, authorId: null };
    }

    // Проверяем форум (Гринготтс/Реклама/EPS)
    // Проверка 1: title начинается с "гринготтс" или "реклама"
    const title = (document.querySelector('head title')?.textContent || '').toLowerCase().trim();
    log('Title страницы:', title);
    if (title.startsWith('гринготтс') || title.startsWith('реклама')) {
      log('✅ Метка будет добавлена: форум определён через title');
      return { shouldAdd: true, authorId: userId };
    }

    // Проверка 2: crumbs содержит форум из EPS_FORUM_INFO
    log('EPS_FORUM_INFO:', window.EPS_FORUM_INFO);
    if (window.EPS_FORUM_INFO && Array.isArray(window.EPS_FORUM_INFO)) {
      const crumbsContainer = document.querySelector('.container.crumbs');
      if (crumbsContainer) {
        const forumLinks = Array.from(crumbsContainer.querySelectorAll('a[href*="/viewforum.php?id="]'));
        const forumIds = forumLinks.map(link => {
          const match = link.getAttribute('href')?.match(/viewforum\.php\?id=(\d+)/);
          return match ? Number(match[1]) : null;
        }).filter(Boolean);

        log('Forum IDs из crumbs:', forumIds);

        // EPS_FORUM_INFO это массив объектов вида [{id: 4, type: 'personal', ...}, ...]
        // Извлекаем только id
        const epsForumIds = window.EPS_FORUM_INFO.map(item => Number(item.id)).filter(id => !isNaN(id));
        log('EPS Forum IDs (только id):', epsForumIds);

        // Проверяем, есть ли пересечение
        if (forumIds.some(id => epsForumIds.includes(id))) {
          log('✅ Метка будет добавлена: форум из EPS_FORUM_INFO');
          return { shouldAdd: true, authorId: userId };
        }
      }
    }

    log('❌ Условия не выполнены - метка НЕ будет добавлена');
    return { shouldAdd: false, authorId: null };
  }

  // Находим форму и кнопку отправки
  const form = textarea.closest('form');
  log('Форма найдена:', !!form);

  if (!form) {
    console.warn('[auto_author_tag] Форма не найдена - submit handler не будет установлен');
  }

  const submitButton = form?.querySelector('input[type="submit"][name="submit"]');
  log('Кнопка submit найдена:', !!submitButton);

  if (!submitButton) {
    console.warn('[auto_author_tag] Кнопка отправки не найдена - submit handler не будет установлен');
    // Не выходим - парсинг и плашка всё равно работают
  } else {
    log('Кнопка отправки найдена, устанавливаем submit handler');

    // Перехватываем отправку формы (используем jQuery если доступен, иначе vanilla JS)
    if (typeof $ !== 'undefined' && $(form).length) {
      // jQuery-версия с namespacing (как в episodes/ui.js)
      $(form).off('submit.fmvauthor').on('submit.fmvauthor', function (e) {
        log('Форма отправляется');

        if (isGameMaster) {
          // GM режим: проверяем обязательное поле
          if (!gmSelectedUserId) {
            e.preventDefault();
            alert('Необходимо выбрать автора поста из списка!');
            log('❌ Submit отменён: не выбран автор');
            return false;
          }

          // Проверяем, нужно ли добавлять метку
          const result = shouldAddTagOnSubmit();
          if (result.shouldAdd) {
            // Для GM используем выбранный ID, а не из result
            const currentText = textarea.value;
            const textWithTag = addAuthorTag(currentText, gmSelectedUserId);

            if (textWithTag !== currentText) {
              log('Добавлена метка автора (GM): usr' + gmSelectedUserId);
              textarea.value = textWithTag;
            }
          }
        } else {
          // Обычный режим
          const result = shouldAddTagOnSubmit();
          if (!result.shouldAdd) {
            log('Метка не будет добавлена по условиям');
            return;
          }

          const currentText = textarea.value;
          const textWithTag = addAuthorTag(currentText, result.authorId);

          if (textWithTag !== currentText) {
            log('Добавлена метка автора: usr' + result.authorId);
            textarea.value = textWithTag;
          } else {
            log('Метка уже присутствует');
          }
        }
      });
    } else {
      // Fallback: vanilla JS
      form.addEventListener('submit', (e) => {
        log('Форма отправляется');

        if (isGameMaster) {
          // GM режим: проверяем обязательное поле
          if (!gmSelectedUserId) {
            e.preventDefault();
            alert('Необходимо выбрать автора поста из списка!');
            log('❌ Submit отменён: не выбран автор');
            return false;
          }

          // Проверяем, нужно ли добавлять метку
          const result = shouldAddTagOnSubmit();
          if (result.shouldAdd) {
            // Для GM используем выбранный ID, а не из result
            const currentText = textarea.value;
            const textWithTag = addAuthorTag(currentText, gmSelectedUserId);

            if (textWithTag !== currentText) {
              log('Добавлена метка автора (GM): usr' + gmSelectedUserId);
              textarea.value = textWithTag;
            }
          }
        } else {
          // Обычный режим
          const result = shouldAddTagOnSubmit();
          if (!result.shouldAdd) {
            log('Метка не будет добавлена по условиям');
            return;
          }

          const currentText = textarea.value;
          const textWithTag = addAuthorTag(currentText, result.authorId);

          if (textWithTag !== currentText) {
            log('Добавлена метка автора: usr' + result.authorId);
            textarea.value = textWithTag;
          } else {
            log('Метка уже присутствует');
          }
        }
      });
    }
  }

  // Инициализация при загрузке
  (async () => {
    // Загружаем пользователей для GM (если нужно)
    await loadUsers();

    // Инициализируем UI
    initializeTextarea();

    log('Инициализация завершена');
  })();
})();
