/**
 * Кнопка "Начать проверку АМС"
 * Добавляет метку [FMVbank_ams_check] в начало комментария topicpost и отправляет форму редактирования
 */

(function () {
  'use strict';

  console.log('[AMS_CHECK] Скрипт загружен. Заголовок страницы:', document.title);

  // Проверяем, что заголовок страницы начинается с "Гринготтс"
  if (!document.title.startsWith('Гринготтс')) {
    console.log('[AMS_CHECK] Страница не подходит (заголовок не начинается с "Гринготтс")');
    return;
  }

  console.log('[AMS_CHECK] Проверка заголовка пройдена');

  const TAG = '[FMVbank_ams_check]';
  const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');

  /**
   * Извлекает comment_id из topicpost (первого поста)
   */
  function getTopicPostCommentId() {
    const topicPost = document.querySelector('div.post.topicpost');
    if (!topicPost) {
      return 0;
    }

    const editLink = topicPost.querySelector('.pl-edit a');
    if (!editLink) {
      return 0;
    }

    try {
      const editUrl = new URL(editLink.href);
      return Number(editUrl.searchParams.get('id')) || 0;
    } catch (e) {
      console.warn('[AMS_CHECK] Не удалось извлечь comment_id:', e);
      return 0;
    }
  }

  /**
   * Запускает проверку АМС для указанного комментария
   */
  async function startAmsCheck(commentId, { setStatus, setDetails }) {
    try {
      console.log(`🟦 [AMS_CHECK] Начинаем проверку для комментария ID: ${commentId}`);
      setStatus('⏳ Загрузка...');

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
        setDetails(`Тег ${TAG} добавлен`);
      } else {
        console.log(`ℹ️ [AMS_CHECK] Тег ${TAG} уже присутствует в комментарии`);
        setDetails(`Тег ${TAG} уже присутствует`);
      }

      setStatus('⏳ Отправка...');

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
        setStatus('✅ Проверка запущена');
        setDetails(`Комментарий ${commentId} обновлён`);
        return { success: true, redirectUrl };
      } else {
        throw new Error('Не удалось обнаружить редирект после отправки');
      }

    } catch (error) {
      console.error(`❌ [AMS_CHECK] Ошибка при запуске проверки:`, error);
      setStatus('❌ Ошибка');
      setDetails(error.message);
      return { success: false, error: error.message };
    }
  }

  // Используем createForumButton для создания кнопки
  console.log('[AMS_CHECK] Проверка createForumButton:', typeof window.createForumButton);
  console.log('[AMS_CHECK] BANK_CHECK:', window.BANK_CHECK);

  if (typeof window.createForumButton === 'function') {
    console.log('[AMS_CHECK] Вызываем createForumButton с параметрами:', {
      allowedGroups: (window.BANK_CHECK?.GroupID) || [],
      allowedForums: (window.BANK_CHECK?.ForumID) || [],
      allowedUsers: (window.BANK_CHECK?.UserID) || [],
      label: 'Начать проверку',
      order: 1
    });

    window.createForumButton({
      allowedGroups: (window.BANK_CHECK?.GroupID) || [],
      allowedForums: (window.BANK_CHECK?.ForumID) || [],
      allowedUsers: (window.BANK_CHECK?.UserID) || [],
      label: 'Начать проверку',
      order: 1,
      onClick: async ({ setStatus, setDetails }) => {
        // Извлекаем comment_id из topicpost
        const commentId = getTopicPostCommentId();

        if (!commentId) {
          setStatus('❌ Ошибка');
          setDetails('Не найден topicpost или comment_id');
          console.error('[AMS_CHECK] Не удалось найти comment_id topicpost');
          return;
        }

        console.log(`[AMS_CHECK] Найден comment_id topicpost: ${commentId}`);
        await startAmsCheck(commentId, { setStatus, setDetails });
      }
    });

    console.log('[AMS_CHECK] createForumButton вызван');
  } else {
    console.error('[AMS_CHECK] Функция createForumButton недоступна');
  }

  // Экспортируем функцию для внешнего использования
  window.startAmsCheck = startAmsCheck;
})();
