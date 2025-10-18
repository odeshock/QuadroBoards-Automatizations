/**
 * Кнопка "В правках не нуждается"
 * Блокирует кнопку "Внести правки" и показывает кнопку "Выплатить"
 */

(function () {
  'use strict';

  // Проверяем, что заголовок страницы начинается с "Гринготтс"
  if (!document.title.startsWith('Гринготтс')) {
    return;
  }

  /**
   * Создаёт кнопки "В правках не нуждается" для каждого подходящего поста
   */
  async function createPostButtons(opts) {
    const allowedGroups = opts?.allowedGroups || [];
    const allowedForums = opts?.allowedForums || [];
    const allowedUsers = opts?.allowedUsers || [];

    console.log('[NO_EDITS_NEEDED] Вызов с параметрами:', { allowedGroups, allowedForums, allowedUsers });

    // Ждём события gringotts:ready
    if (!window.__gringotts_ready) {
      console.log('[NO_EDITS_NEEDED] Ждём события gringotts:ready');
      await new Promise(r => window.addEventListener('gringotts:ready', r, { once: true }));
    } else {
      console.log('[NO_EDITS_NEEDED] gringotts уже готов');
    }

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    console.log('[NO_EDITS_NEEDED] текущая группа =', gid, ', разрешённые =', allowedGroups);

    // Проверка группы
    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) {
      console.log('[NO_EDITS_NEEDED] allowedGroups пустой, выход');
      return;
    }
    if (!allowedGroups.map(Number).includes(Number(gid))) {
      console.log('[NO_EDITS_NEEDED] группа', gid, 'не в списке, выход');
      return;
    }

    // Проверка форума
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) {
      console.log('[NO_EDITS_NEEDED] allowedForums пустой, выход');
      return;
    }

    // Проверка форума через isAllowedForum
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

    if (!isAllowedForum(allowedForums)) {
      console.log('[NO_EDITS_NEEDED] форум не разрешён, выход');
      return;
    }

    // Проверка пользователей
    if (Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      const uid = Number(window.UserID);
      console.log('[NO_EDITS_NEEDED] текущий UserID =', uid, ', разрешённые =', allowedUsers);
      if (!allowedUsers.map(Number).includes(uid)) {
        console.log('[NO_EDITS_NEEDED] пользователь', uid, 'не в списке, выход');
        return;
      }
    }

    console.log('[NO_EDITS_NEEDED] Начинаем создание кнопок');

    // Получаем все посты
    const posts = Array.from(document.querySelectorAll('div.post'));
    console.log(`[NO_EDITS_NEEDED] Найдено постов: ${posts.length}`);

    for (let index = 0; index < posts.length; index++) {
      const post = posts[index];
      const postContent = post.querySelector('div.post-content');

      if (!postContent) continue;

      // Проверяем наличие bank_ams_check и отсутствие bank_ams_done
      const hasAmsCheck = !!postContent.querySelector('bank_ams_check');
      const hasAmsDone = !!postContent.querySelector('bank_ams_done');

      if (!hasAmsCheck || hasAmsDone) {
        continue;
      }

      console.log(`[NO_EDITS_NEEDED] Пост #${index}: подходит для кнопки`);

      // Ищем контейнер .ams_info
      const amsInfo = postContent.querySelector('.ams_info');
      if (!amsInfo) {
        console.warn(`[NO_EDITS_NEEDED] Пост #${index}: не найден .ams_info`);
        continue;
      }

      // Проверяем, не создана ли уже кнопка
      if (amsInfo.querySelector('[data-post-button-label="В правках не нуждается"]')) {
        console.log(`[NO_EDITS_NEEDED] Пост #${index}: кнопка уже существует`);
        continue;
      }

      // Создаём UI (как в admin_edit.js)
      const wrap = document.createElement('div');
      wrap.dataset.order = 3; // после "Внести правки" (order=2)
      wrap.dataset.postButtonLabel = 'В правках не нуждается';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.textContent = 'В правках не нуждается';

      wrap.appendChild(button);

      // Вставка по order (как в admin_edit.js)
      const siblings = Array.from(amsInfo.querySelectorAll('div[data-order]'));
      const next = siblings.find(el => Number(el.dataset.order) > 3);
      if (next) amsInfo.insertBefore(wrap, next);
      else amsInfo.appendChild(wrap);

      // Обработчик нажатия
      button.addEventListener('click', function () {
        console.log(`[NO_EDITS_NEEDED] Кнопка нажата для поста #${index}`);

        // Блокируем кнопку "Внести правки"
        const adminEditWrap = amsInfo.querySelector('[data-post-button-label="Внести правки"]');
        if (adminEditWrap) {
          const adminEditBtn = adminEditWrap.querySelector('button');
          if (adminEditBtn) {
            adminEditBtn.disabled = true;
            adminEditBtn.style.opacity = '0.5';
            adminEditBtn.style.cursor = 'not-allowed';
            console.log(`[NO_EDITS_NEEDED] Заблокирована кнопка "Внести правки"`);
          }
        }

        // Блокируем текущую кнопку (но не скрываем)
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';

        // Разблокируем кнопку "Выплатить"
        const payOutWrap = amsInfo.querySelector('[data-post-button-label="Выплатить"]');
        if (payOutWrap) {
          const payOutBtn = payOutWrap.querySelector('button');
          if (payOutBtn) {
            payOutBtn.disabled = false;
            payOutBtn.style.opacity = '1';
            payOutBtn.style.cursor = 'pointer';
            console.log(`[NO_EDITS_NEEDED] Разблокирована кнопка "Выплатить"`);
          }
        }
      });

      console.log(`[NO_EDITS_NEEDED] Кнопка добавлена в пост #${index}`);
    }
  }

  // Запускаем создание кнопок с параметрами из window.BANK_CHECK
  const config = {
    allowedGroups: (window.BANK_CHECK?.GroupID) || [],
    allowedForums: (window.BANK_CHECK?.ForumID) || [],
    allowedUsers: (window.BANK_CHECK?.UserID) || []
  };

  createPostButtons(config).catch(err => {
    console.error('[NO_EDITS_NEEDED] Ошибка при создании кнопок:', err);
  });
})();
