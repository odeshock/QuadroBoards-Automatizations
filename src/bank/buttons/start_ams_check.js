/**
 * Кнопка "Начать проверку АМС"
 * Добавляет метку [FMVbank_ams_check] в начало комментария и отправляет форму редактирования
 */

(function () {
  'use strict';

  // Проверяем, что заголовок страницы начинается с "Гринготтс"
  if (!document.title.startsWith('Гринготтс')) {
    return;
  }

  const TAG = '[FMVbank_ams_check]';
  const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');

  /**
   * Извлекает comment_id из поста
   */
  function getCommentId(post) {
    const editLink = post.querySelector('.pl-edit a');
    if (!editLink) return 0;

    try {
      const editUrl = new URL(editLink.href);
      return Number(editUrl.searchParams.get('id')) || 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Запускает проверку АМС для указанного комментария
   */
  async function startAmsCheck(commentId, { setStatus, setDetails }) {
    try {
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
        setDetails(`Тег ${TAG} добавлен`);
      } else {
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
          }
        } catch (err) {
          // Игнорируем CORS ошибки
        }
      };

      const redirectCheckInterval = setInterval(checkRedirect, 500);

      setTimeout(() => {
        clearInterval(redirectCheckInterval);
        if (!redirectDetected) {
          iframe.remove();
        }
      }, 10000);

      // Отправляем форму
      submitButton.click();

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
        setStatus('✅ Проверка запущена');
        setDetails(`Комментарий ${commentId} обновлён`);

        // Перезагружаем страницу через 2 секунды
        setTimeout(() => {
          window.location.reload();
        }, 2000);

        return { success: true, redirectUrl };
      } else {
        throw new Error('Не удалось обнаружить редирект после отправки');
      }

    } catch (error) {
      setStatus('❌ Ошибка');
      setDetails(error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Создаёт кнопку для каждого поста (аналог createForumButton, но для постов)
   */
  async function createPostButtons(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      allowedUsers = [],
      label = 'Действие',
      onClick,
      containerSelector = '.ams_info',
      order = 0,
      postSelector = 'div.post',
      showStatus = true,
      showDetails = true,
    } = opts || {};

    if (typeof onClick !== 'function') return;

    // Ждём готовности AMS
    if (window.__ams_ready === undefined) {
      await new Promise(r => window.addEventListener('ams:ready', r, { once: true }));
    }

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    // Проверка группы
    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) return;
    if (!allowedGroups.map(Number).includes(Number(gid))) return;

    // Проверка форума
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) return;

    // Проверка форума через isAllowedForum (из button.js)
    const isAllowedForum = (forumIds) => {
      const allow = (forumIds || []).map(String);
      const crumbs = document.querySelector('.container.crumbs');

      const matchIn = (root) => Array.from(root.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          if (!u.pathname.includes('viewforum.php')) return false;
          const id = (u.searchParams.get('id') || '').trim();
          return id && allow.includes(id);
        } catch { return false; }
      });

      if (crumbs && matchIn(crumbs)) return true;
      if (matchIn(document)) return true;

      const bodyForumId = document.body?.dataset?.forumId;
      if (bodyForumId && allow.includes(String(bodyForumId))) return true;

      return false;
    };

    if (!isAllowedForum(allowedForums)) return;

    // Проверка пользователей (если задано)
    if (Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      const uid = Number(window.UserID);
      if (!allowedUsers.map(Number).includes(uid)) return;
    }

    // Находим все подходящие посты
    const posts = document.querySelectorAll(postSelector);

    posts.forEach(post => {
      const postContent = post.querySelector('.post-content');
      if (!postContent) return;

      // Проверяем, что нет тегов bank_ams_check и bank_ams_done
      const hasAmsCheck = postContent.querySelector('bank_ams_check');
      const hasAmsDone = postContent.querySelector('bank_ams_done');
      if (hasAmsCheck || hasAmsDone) return;

      const container = postContent.querySelector(containerSelector);
      if (!container) return;

      // Проверяем, не добавлена ли уже кнопка
      if (container.querySelector(`[data-post-button-label="${label}"]`)) return;

      const commentId = getCommentId(post);
      if (!commentId) return;

      // Создаём UI
      const wrap = document.createElement('div');
      wrap.dataset.order = order;
      wrap.dataset.postButtonLabel = label;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'button';
      btn.textContent = label;

      const status = showStatus ? document.createElement('span') : null;
      if (status) {
        status.style.marginLeft = '10px';
        status.style.fontSize = '14px';
        status.style.color = '#555';
      }

      const details = showDetails ? document.createElement('details') : null;
      let pre = null;
      if (details) {
        details.style.marginTop = '6px';
        const summary = document.createElement('summary');
        summary.textContent = 'Показать детали';
        summary.style.cursor = 'pointer';
        pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.margin = '6px 0 0';
        pre.style.fontSize = '12px';
        details.appendChild(summary);
        details.appendChild(pre);
      }

      wrap.appendChild(btn);
      if (status) wrap.appendChild(status);
      if (details) wrap.appendChild(details);

      // Вставка по order
      const siblings = Array.from(container.querySelectorAll('div[data-order]'));
      const next = siblings.find(el => Number(el.dataset.order) > Number(order));
      if (next) container.insertBefore(wrap, next);
      else container.appendChild(wrap);

      // Helpers
      const setStatus = (text, color = '#555') => {
        if (!status) return;
        status.textContent = text;
        status.style.color = color;
      };
      const setDetails = (text = '') => {
        if (!pre) return;
        pre.textContent = String(text || '');
      };

      btn.addEventListener('click', async () => {
        if (showStatus) setStatus('Выполняю…', '#555');
        if (showDetails) setDetails('');

        try {
          await onClick({
            commentId,
            post,
            statusEl: status || null,
            detailsEl: pre || null,
            setStatus,
            setDetails,
            wrap
          });
        } catch (err) {
          if (showStatus) setStatus('✖ Ошибка', 'red');
          if (showDetails) setDetails((err && err.message) ? err.message : String(err));
        }
      });
    });
  }

  // Используем createPostButtons для создания кнопок
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    await createPostButtons({
      allowedGroups: (window.BANK_CHECK?.GroupID) || [],
      allowedForums: (window.BANK_CHECK?.ForumID) || [],
      allowedUsers: (window.BANK_CHECK?.UserID) || [],
      label: 'Начать проверку',
      order: 1,
      containerSelector: '.ams_info',
      postSelector: 'div.post',
      onClick: async ({ commentId, setStatus, setDetails }) => {
        await startAmsCheck(commentId, { setStatus, setDetails });
      }
    });
  }

  // Экспортируем функции
  window.startAmsCheck = startAmsCheck;
  window.createPostButtons = createPostButtons;
})();
