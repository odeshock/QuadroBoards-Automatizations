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

  // Получаем userId
  const userId = window.UserID;
  if (!userId) {
    console.warn('[auto_author_tag] window.UserID не найден');
    return;
  }

  log('UserID:', userId);

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
    return `[FMVauthor]usr${userId};[/FMVauthor]\n${text}`;
  }

  // CSS для плашки
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
    `;
    document.head.appendChild(style);
  }

  // Создаём плашку над textarea
  let authorBadge = null;

  function createAuthorBadge(authorId) {
    if (authorBadge) {
      authorBadge.remove();
    }

    injectCSS();

    authorBadge = document.createElement('div');
    authorBadge.className = 'fmvauthor-badge';
    authorBadge.textContent = `Автор комментария: usr${authorId}`;

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

  // Сохраняем исходный ID автора, если метка была при загрузке
  let originalAuthorId = null;

  // При загрузке: проверяем textarea на наличие метки
  function initializeTextarea() {
    const currentText = textarea.value;
    const extracted = extractAuthorTag(currentText);

    if (extracted) {
      log('Найдена метка автора:', extracted.authorId);
      originalAuthorId = extracted.authorId; // Сохраняем исходный ID
      // Удаляем метку из textarea
      textarea.value = extracted.cleanText;
      // Показываем плашку
      createAuthorBadge(extracted.authorId);
    } else {
      log('Метка автора не найдена');
      originalAuthorId = null;
      removeAuthorBadge();
    }
  }

  // При изменении текста: проверяем, не добавил ли пользователь метку вручную
  textarea.addEventListener('input', () => {
    const extracted = extractAuthorTag(textarea.value);
    if (extracted) {
      // Пользователь добавил метку вручную - удаляем из текста и показываем плашку
      textarea.value = extracted.cleanText;
      createAuthorBadge(extracted.authorId);
    }
  });

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
    if (window.EPS_FORUM_INFO) {
      const crumbsContainer = document.querySelector('.container.crumbs');
      if (crumbsContainer) {
        const forumLinks = Array.from(crumbsContainer.querySelectorAll('a[href*="/viewforum.php?id="]'));
        const forumIds = forumLinks.map(link => {
          const match = link.getAttribute('href')?.match(/viewforum\.php\?id=(\d+)/);
          return match ? Number(match[1]) : null;
        }).filter(Boolean);

        log('Forum IDs из crumbs:', forumIds);
        log('Сравниваем с EPS_FORUM_INFO:', window.EPS_FORUM_INFO);

        if (forumIds.some(id => id === window.EPS_FORUM_INFO)) {
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
  const submitButton = form?.querySelector('input[type="submit"][name="submit"]');

  if (!submitButton) {
    console.warn('[auto_author_tag] Кнопка отправки не найдена');
    // Не выходим - парсинг и плашка всё равно работают
  } else {
    log('Кнопка отправки найдена');

    // Перехватываем отправку формы (используем jQuery если доступен, иначе vanilla JS)
    if (typeof $ !== 'undefined' && $(form).length) {
      // jQuery-версия с namespacing (как в episodes/ui.js)
      $(form).off('submit.fmvauthor').on('submit.fmvauthor', function () {
        log('Форма отправляется');

        // Проверяем, нужно ли добавлять метку и какой ID использовать
        const result = shouldAddTagOnSubmit();
        if (!result.shouldAdd) {
          log('Метка не будет добавлена по условиям');
          return;
        }

        // Добавляем метку автора в начало текста с нужным ID
        const currentText = textarea.value;
        const textWithTag = addAuthorTag(currentText, result.authorId);

        if (textWithTag !== currentText) {
          log('Добавлена метка автора: usr' + result.authorId);
          textarea.value = textWithTag;
        } else {
          log('Метка уже присутствует');
        }

        // Форма продолжит отправку с меткой
      });
    } else {
      // Fallback: vanilla JS
      form.addEventListener('submit', () => {
        log('Форма отправляется');

        // Проверяем, нужно ли добавлять метку и какой ID использовать
        const result = shouldAddTagOnSubmit();
        if (!result.shouldAdd) {
          log('Метка не будет добавлена по условиям');
          return;
        }

        // Добавляем метку автора в начало текста с нужным ID
        const currentText = textarea.value;
        const textWithTag = addAuthorTag(currentText, result.authorId);

        if (textWithTag !== currentText) {
          log('Добавлена метка автора: usr' + result.authorId);
          textarea.value = textWithTag;
        } else {
          log('Метка уже присутствует');
        }

        // Форма продолжит отправку с меткой
      });
    }
  }

  // Инициализация при загрузке
  initializeTextarea();

  log('Инициализация завершена');
})();
