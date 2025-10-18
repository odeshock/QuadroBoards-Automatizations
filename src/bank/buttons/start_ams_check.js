/**
 * Кнопка "Начать проверку АМС"
 * Добавляет метку [FMVbank_ams_check] в начало комментария и отправляет форму редактирования
 */

(function () {
  'use strict';

  const BUTTON_CONFIG = {
    allowedGroups: (window.BANK_CHECK && window.BANK_CHECK?.GroupID) || [],
    allowedForums: (window.BANK_CHECK && window.BANK_CHECK?.ForumID) || [],
    allowedUsers: (window.BANK_CHECK && window.BANK_CHECK?.UserID) || [],
    label: 'Начать проверку',
    order: 1
  };

  const TAG = '[FMVbank_ams_check]';
  const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');

  /**
   * Проверяет, доступна ли кнопка на текущей странице
   */
  function isButtonAvailable() {
    // Проверка заголовка страницы
    const pageTitle = document.title || '';
    if (!pageTitle.startsWith('Гринготтс')) {
      return false;
    }

    const userId = window.UserID;
    const userGroup = window.UserGroup;
    const currentForum = getCurrentForumId();

    // Проверка ID пользователя
    if (BUTTON_CONFIG.allowedUsers.length > 0 && !BUTTON_CONFIG.allowedUsers.includes(userId)) {
      return false;
    }

    // Проверка группы пользователя
    if (BUTTON_CONFIG.allowedGroups.length > 0 && !BUTTON_CONFIG.allowedGroups.includes(userGroup)) {
      return false;
    }

    // Проверка форума
    if (BUTTON_CONFIG.allowedForums.length > 0 && !BUTTON_CONFIG.allowedForums.includes(currentForum)) {
      return false;
    }

    return true;
  }

  /**
   * Получает ID текущего форума из URL
   */
  function getCurrentForumId() {
    const url = new URL(window.location.href);
    return parseInt(url.searchParams.get('id')) || 0;
  }

  /**
   * Запускает проверку АМС для указанного комментария
   */
  async function startAmsCheck(commentId) {
    try {
      console.log(`🟦 [AMS_CHECK] Начинаем проверку для комментария ID: ${commentId}`);

      // Создаём скрытый iframe для редактирования
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `${SITE_URL}/edit.php?id=${commentId}`;
      document.body.appendChild(iframe);

      // Ждём загрузки iframe
      await new Promise((resolve, reject) => {
        iframe.onload = resolve;
        iframe.onerror = () => reject(new Error('Не удалось загрузить страницу редактирования'));

        // Таймаут на загрузку
        setTimeout(() => reject(new Error('Таймаут загрузки страницы редактирования')), 10000);
      });

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const textarea = iframeDoc.querySelector('textarea[name="req_message"]');
      const submitButton = iframeDoc.querySelector('input[type="submit"].button.submit[name="submit"][value="Отправить"][accesskey="s"]');

      if (!textarea || !submitButton) {
        throw new Error('Не найдена форма редактирования');
      }

      // Добавляем тег в начало, если его ещё нет
      const currentValue = textarea.value || '';
      if (!currentValue.includes(TAG)) {
        textarea.value = TAG + currentValue;
        console.log(`✅ [AMS_CHECK] Тег ${TAG} добавлен в начало комментария`);
      } else {
        console.log(`ℹ️ [AMS_CHECK] Тег ${TAG} уже присутствует в комментарии`);
      }

      // Отслеживаем редирект после отправки
      let redirectUrl = null;
      let redirectDetected = false;

      const checkRedirect = () => {
        try {
          const currentUrl = iframe.contentWindow.location.href;
          if (currentUrl.includes('/viewtopic.php?')) {
            redirectUrl = currentUrl;
            redirectDetected = true;
            console.log(`✅ [AMS_CHECK] Редирект обнаружен: ${redirectUrl}`);
          }
        } catch (err) {
          // Игнорируем CORS ошибки
        }
      };

      const redirectCheckInterval = setInterval(checkRedirect, 500);

      // Останавливаем проверку через 10 секунд
      setTimeout(() => {
        clearInterval(redirectCheckInterval);
        if (!redirectDetected) {
          console.warn('⚠️ [AMS_CHECK] Редирект не обнаружен за 10 секунд');
          iframe.remove();
        }
      }, 10000);

      // Отправляем форму
      submitButton.click();
      console.log(`🟩 [AMS_CHECK] Форма отправлена`);

      // Ждём редирект
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (redirectDetected) {
            clearInterval(interval);
            clearInterval(redirectCheckInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 10000);
      });

      // Удаляем iframe
      iframe.remove();

      if (redirectDetected) {
        console.log(`✅ [AMS_CHECK] Проверка успешно запущена для комментария ${commentId}`);
        alert(`Проверка АМС успешно запущена для комментария ${commentId}`);
        return { success: true, redirectUrl };
      } else {
        throw new Error('Не удалось обнаружить редирект после отправки');
      }

    } catch (error) {
      console.error(`❌ [AMS_CHECK] Ошибка при запуске проверки:`, error);
      alert(`Ошибка при запуске проверки АМС: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Добавляет кнопку "Начать проверку" к комментарию
   */
  function addButtonToComment(commentElement) {
    // Ищем ссылку редактирования
    const editLink = commentElement.querySelector('.pl-edit a');
    if (!editLink) return;

    // Извлекаем comment_id из href
    let commentId = 0;
    try {
      const editUrl = new URL(editLink.href);
      commentId = Number(editUrl.searchParams.get('id')) || 0;
    } catch (e) {
      console.warn('[AMS_CHECK] Не удалось извлечь comment_id:', e);
      return;
    }

    if (!commentId) return;

    // Проверяем, не добавлена ли уже кнопка
    const existingButton = commentElement.querySelector('.ams-check-button');
    if (existingButton) return;

    // Создаём кнопку
    const button = document.createElement('button');
    button.className = 'ams-check-button';
    button.textContent = BUTTON_CONFIG.label;
    button.style.cssText = 'margin-left: 10px; padding: 4px 8px; cursor: pointer;';
    button.dataset.commentId = commentId;

    button.onclick = async (e) => {
      e.preventDefault();
      button.disabled = true;
      button.textContent = 'Обработка...';

      await startAmsCheck(commentId);

      button.disabled = false;
      button.textContent = BUTTON_CONFIG.label;
    };

    // Добавляем кнопку рядом с ссылкой редактирования
    const editContainer = commentElement.querySelector('.pl-edit');
    if (editContainer) {
      editContainer.appendChild(button);
    }
  }

  /**
   * Инициализация
   */
  function init() {
    if (!isButtonAvailable()) {
      console.log('[AMS_CHECK] Кнопка недоступна на текущей странице');
      return;
    }

    // Добавляем кнопки ко всем комментариям
    document.querySelectorAll('.post').forEach(addButtonToComment);

    console.log('[AMS_CHECK] Кнопки добавлены');
  }

  // Запускаем при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Экспортируем функцию для внешнего использования
  window.startAmsCheck = startAmsCheck;
})();
