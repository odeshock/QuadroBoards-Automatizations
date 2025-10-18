/**
 * Кнопка "Внести правки"
 * Вызывает bankCommentEditFromBackup с флагом NEW_ADMIN_EDIT = true
 */

(function () {
  'use strict';

  // Проверяем, что заголовок страницы начинается с "Гринготтс"
  if (!document.title.startsWith('Гринготтс')) {
    return;
  }

  /**
   * Извлекает данные из поста для вызова bankCommentEditFromBackup
   */
  async function getPostData(post) {
    // Извлекаем usr_id из профиля
    const profileLink = post.querySelector('.pl-email.profile a');
    const profileUrl = profileLink ? new URL(profileLink.href) : null;
    const usr_id = profileUrl ? Number(profileUrl.searchParams.get("id")) || 0 : 0;

    // Извлекаем ts из тега <bank_data>
    const bankData = post.querySelector('bank_data');
    const ts = bankData ? Number(bankData.textContent.trim()) || 0 : 0;

    // Извлекаем comment_id из h3 span .permalink по хешу (#p346)
    let comment_id = 0;
    const permalink = post.querySelector('h3 span .permalink');
    if (permalink && permalink.href) {
      try {
        const url = new URL(permalink.href);
        const hash = url.hash; // например, "#p346"
        if (hash && hash.startsWith('#p')) {
          comment_id = Number(hash.substring(2)) || 0; // убираем "#p" и берём число
        }
      } catch (e) {
        console.warn('[adminEdit] Не удалось извлечь comment_id из permalink:', e);
      }
    }

    // Извлекаем current_bank из поля MoneyID (аналогично gringotts_page_update.js)
    let current_bank = 0;
    try {
      const moneyFieldClass = `pa-fld${window.PROFILE_FIELDS?.MoneyID || 0}`;
      const moneyField = post.querySelector(`.${moneyFieldClass}`);

      if (moneyField) {
        // Проверяем наличие комментария <!-- main: usrN -->
        const walker = document.createTreeWalker(moneyField, NodeFilter.SHOW_COMMENT);
        let hasMainComment = false;
        const RE_MAIN = /^\s*main:\s*usr(\d+)\s*$/i;

        for (let node; (node = walker.nextNode());) {
          const match = (node.nodeValue || "").match(RE_MAIN);
          if (match) {
            hasMainComment = true;
            // Если есть комментарий <!-- main: usrN -->, используем API для получения значения
            if (window.MainUsrFieldResolver?.getFieldValue) {
              try {
                const value = await window.MainUsrFieldResolver.getFieldValue({
                  doc: document,
                  fieldId: window.PROFILE_FIELDS?.MoneyID || 0
                });
                current_bank = Number(value) || 0;
              } catch (err) {
                console.warn("Ошибка получения значения через MainUsrFieldResolver:", err);
                current_bank = 0;
              }
            }
            break;
          }
        }

        // Если нет комментария, берём текстовое значение из li (вне span)
        if (!hasMainComment) {
          const fieldNameSpan = moneyField.querySelector('span.fld-name');
          let textContent = moneyField.textContent || '';

          if (fieldNameSpan) {
            textContent = textContent.replace(fieldNameSpan.textContent, '');
          }

          textContent = textContent.replace(/\u00A0/g, ' ').trim();
          const match = textContent.match(/-?\d+(?:\.\d+)?/);
          if (match) {
            current_bank = Number(match[0]) || 0;
          }
        }
      }
    } catch (e) {
      console.warn('[adminEdit] Не удалось извлечь current_bank:', e);
    }

    return { usr_id, ts, comment_id, current_bank };
  }

  /**
   * Создаёт кнопку для каждого поста
   */
  async function createAdminEditButtons(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      allowedUsers = [],
      label = 'Внести правки',
      containerSelector = '.ams_info',
      order = 2,
      postSelector = 'div.post',
      showStatus = true,
      showDetails = true,
    } = opts || {};

    console.log(`[adminEdit] "${label}": Вызов с параметрами:`, { allowedGroups, allowedForums, allowedUsers });

    // Проверяем заголовок страницы
    if (!document.title.startsWith('Гринготтс')) {
      console.log(`[adminEdit] "${label}": Страница не Гринготтс, выход`);
      return;
    }

    // Ждём события gringotts:ready
    if (!window.__gringotts_ready) {
      console.log(`[adminEdit] "${label}": Ждём события gringotts:ready`);
      await new Promise(r => window.addEventListener('gringotts:ready', r, { once: true }));
    } else {
      console.log(`[adminEdit] "${label}": gringotts уже готов`);
    }

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    console.log(`[adminEdit] "${label}": текущая группа = ${gid}, разрешённые = [${allowedGroups}]`);

    // Проверка группы
    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) {
      console.log(`[adminEdit] "${label}": allowedGroups пустой, выход`);
      return;
    }
    if (!allowedGroups.map(Number).includes(Number(gid))) {
      console.log(`[adminEdit] "${label}": группа ${gid} не в списке, выход`);
      return;
    }

    // Проверка форума
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) {
      console.log(`[adminEdit] "${label}": allowedForums пустой, выход`);
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
      console.log(`[adminEdit] "${label}": форум не разрешён, выход`);
      return;
    }

    // Проверка пользователей
    if (Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      const uid = Number(window.UserID);
      console.log(`[adminEdit] "${label}": текущий UserID = ${uid}, разрешённые = [${allowedUsers}]`);
      if (!allowedUsers.map(Number).includes(uid)) {
        console.log(`[adminEdit] "${label}": пользователь ${uid} не в списке, выход`);
        return;
      }
    }

    // Находим все подходящие посты
    const posts = document.querySelectorAll(postSelector);
    console.log(`[adminEdit] "${label}": Найдено постов: ${posts.length}`);

    let addedCount = 0;
    for (let index = 0; index < posts.length; index++) {
      const post = posts[index];

      // Пропускаем topicpost
      if (post.classList.contains('topicpost')) continue;

      const postContent = post.querySelector('.post-content');
      if (!postContent) continue;

      // Проверяем, что ЕСТЬ bank_ams_check, но НЕТ bank_ams_done
      const hasAmsCheck = postContent.querySelector('bank_ams_check');
      const hasAmsDone = postContent.querySelector('bank_ams_done');
      if (!hasAmsCheck || hasAmsDone) {
        console.log(`[adminEdit] "${label}": Пост ${index}: hasAmsCheck=${!!hasAmsCheck}, hasAmsDone=${!!hasAmsDone}, пропуск`);
        continue;
      }

      const container = postContent.querySelector(containerSelector);
      if (!container) continue;

      // Проверяем, не добавлена ли уже кнопка
      if (container.querySelector(`[data-post-button-label="${label}"]`)) continue;

      const postData = await getPostData(post);
      console.log(`[adminEdit] "${label}": Пост ${index}: getPostData вернул:`, postData);

      const { usr_id, ts, comment_id, current_bank } = postData;
      if (!usr_id || !ts || !comment_id) {
        console.log(`[adminEdit] "${label}": Пост ${index}: проверка не прошла - usr_id=${usr_id}, ts=${ts}, comment_id=${comment_id}`);
        continue;
      }

      console.log(`[adminEdit] "${label}": Пост ${index}: данные OK - usr_id=${usr_id}, ts=${ts}, comment_id=${comment_id}, current_bank=${current_bank}`);

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

      // Обработчик клика
      btn.addEventListener('click', async () => {
        console.log(`[adminEdit] Вызов bankCommentEditFromBackup с NEW_IS_ADMIN_TO_EDIT=true`);
        if (status) {
          status.textContent = 'Выполняю…';
          status.style.color = '#555';
        }
        if (pre) pre.textContent = '';

        try {
          if (typeof window.bankCommentEditFromBackup === 'function') {
            await window.bankCommentEditFromBackup(usr_id, ts, comment_id, current_bank, { NEW_IS_ADMIN_TO_EDIT: true });
            if (status) {
              status.textContent = '✅ Готово';
              status.style.color = 'green';
            }
            if (pre) pre.textContent = `Вызвано с NEW_ADMIN_EDIT=true`;
          } else {
            throw new Error('Функция bankCommentEditFromBackup недоступна');
          }
        } catch (err) {
          if (status) {
            status.textContent = '✖ Ошибка';
            status.style.color = 'red';
          }
          if (pre) pre.textContent = (err && err.message) ? err.message : String(err);
          console.error('[adminEdit] Ошибка:', err);
        }
      });

      addedCount++;
    }

    console.log(`[adminEdit] "${label}": Добавлено кнопок: ${addedCount}`);
  }

  // Инициализация
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    await createAdminEditButtons({
      allowedGroups: (window.BANK_CHECK?.GroupID) || [],
      allowedForums: (window.BANK_CHECK?.ForumID) || [],
      allowedUsers: (window.BANK_CHECK?.UserID) || [],
      label: 'Внести правки',
      order: 2,
      containerSelector: '.ams_info',
      postSelector: 'div.post',
    });
  }

  // Экспортируем функцию
  window.createAdminEditButtons = createAdminEditButtons;
})();
