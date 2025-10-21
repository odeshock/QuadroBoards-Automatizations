/**
 * Кнопка "Автопроверка"
 * Проверяет данные из BACKUP_DATA через groupByRecipientWithGifts
 */

(function () {
  'use strict';

  // Проверяем, что заголовок страницы начинается с "Гринготтс"
  if (!document.title.startsWith('Гринготтс')) {
    return;
  }

  /**
   * Извлекает данные из поста для автопроверки
   */
  async function getPostData(post) {
    // Извлекаем usr_id из профиля
    const profileLink = post.querySelector('.pl-email.profile a');
    const profileUrl = profileLink ? new URL(profileLink.href) : null;
    const usr_id = profileUrl ? Number(profileUrl.searchParams.get("id")) || 0 : 0;

    // Извлекаем ts из тега <bank_data>
    const bankData = post.querySelector('bank_data');
    const ts = bankData ? Number(bankData.textContent.trim()) || 0 : 0;

    return { usr_id, ts };
  }

  /**
   * Форматирует результат автопроверки
   */
  function formatCheckResult(result) {
    if (!Array.isArray(result) || result.length === 0) {
      return 'Нет данных для проверки';
    }

    const lines = [];

    result.forEach(recipient => {
      const recipientId = recipient.recipient_id;
      const amount = recipient.amount || 0;
      const items = recipient.items || [];

      lines.push(`\n📋 Получатель usr${recipientId}:`);

      if (amount !== 0) {
        lines.push(`  💰 Баланс: ${amount > 0 ? '+' : ''}${amount}`);
      }

      if (items.length > 0) {
        items.forEach(item => {
          const prefix = item.error ? '  ❌' : '  ✅';

          if (item.remove) {
            // Купон для удаления
            lines.push(`${prefix} Удалить купон: ${item.title || item.form_id || 'Неизвестный купон'}`);
            if (item.error) {
              lines.push(`     ⚠️ Ошибка: ${item.error}`);
            }
          } else if (item.category) {
            // Подарок/оформление
            const categoryName = {
              'gift': 'Подарок',
              'icon': 'Иконка',
              'plashka': 'Плашка',
              'background': 'Фон'
            }[item.category] || item.category;

            lines.push(`${prefix} ${categoryName}: ${item.title || item.form_id || 'Неизвестный'}`);

            if (item.custom_title) {
              lines.push(`     💬 "${item.custom_title}"`);
            }

            if (item.error) {
              const errorText = {
                'not_selected_custom': 'Не выбран элемент для индивидуального подарка',
                'not_in_library': 'Элемент не найден в библиотеке',
                'already_exists': 'Элемент уже есть у получателя',
                'coupon_not_exists': 'Купон не найден у получателя'
              }[item.error] || item.error;

              lines.push(`     ⚠️ Ошибка: ${errorText}`);
            }
          } else {
            // Прочие операции
            lines.push(`${prefix} ${item.title || item.form_id || 'Операция'}`);
            if (item.amount) {
              lines.push(`     💰 Сумма: ${item.amount}`);
            }
            if (item.error) {
              lines.push(`     ⚠️ Ошибка: ${item.error}`);
            }
          }
        });
      }
    });

    return lines.join('\n');
  }

  /**
   * Создаёт кнопку автопроверки для каждого поста
   */
  async function createAutoCheckButtons(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      allowedUsers = [],
      label = 'Автопроверка',
      containerSelector = '.ams_info',
      order = 1,
      postSelector = 'div.post',
      showStatus = true,
      showDetails = true,
    } = opts || {};

    console.log(`[adminAutoCheck] "${label}": Вызов с параметрами:`, { allowedGroups, allowedForums, allowedUsers });

    // Проверяем заголовок страницы
    if (!document.title.startsWith('Гринготтс')) {
      console.log(`[adminAutoCheck] "${label}": Страница не Гринготтс, выход`);
      return;
    }

    // Ждём события gringotts:ready
    if (!window.__gringotts_ready) {
      console.log(`[adminAutoCheck] "${label}": Ждём события gringotts:ready`);
      await new Promise(r => window.addEventListener('gringotts:ready', r, { once: true }));
    } else {
      console.log(`[adminAutoCheck] "${label}": gringotts уже готов`);
    }

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    console.log(`[adminAutoCheck] "${label}": текущая группа = ${gid}, разрешённые = [${allowedGroups}]`);

    // Проверка группы
    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) {
      console.log(`[adminAutoCheck] "${label}": allowedGroups пустой, выход`);
      return;
    }
    if (!allowedGroups.map(Number).includes(Number(gid))) {
      console.log(`[adminAutoCheck] "${label}": группа ${gid} не в списке, выход`);
      return;
    }

    // Проверка форума
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) {
      console.log(`[adminAutoCheck] "${label}": allowedForums пустой, выход`);
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
      console.log(`[adminAutoCheck] "${label}": форум не разрешён, выход`);
      return;
    }

    // Проверка пользователей
    if (Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      const uid = Number(window.UserID);
      console.log(`[adminAutoCheck] "${label}": текущий UserID = ${uid}, разрешённые = [${allowedUsers}]`);
      if (!allowedUsers.map(Number).includes(uid)) {
        console.log(`[adminAutoCheck] "${label}": пользователь ${uid} не в списке, выход`);
        return;
      }
    }

    // Находим все подходящие посты
    const posts = document.querySelectorAll(postSelector);
    console.log(`[adminAutoCheck] "${label}": Найдено постов: ${posts.length}`);

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
        console.log(`[adminAutoCheck] "${label}": Пост ${index}: hasAmsCheck=${!!hasAmsCheck}, hasAmsDone=${!!hasAmsDone}, пропуск`);
        continue;
      }

      const container = postContent.querySelector(containerSelector);
      if (!container) continue;

      // Проверяем, не добавлена ли уже кнопка
      if (container.querySelector(`[data-post-button-label="${label}"]`)) continue;

      const postData = await getPostData(post);
      console.log(`[adminAutoCheck] "${label}": Пост ${index}: getPostData вернул:`, postData);

      const { usr_id, ts } = postData;
      if (!usr_id || !ts) {
        console.log(`[adminAutoCheck] "${label}": Пост ${index}: проверка не прошла - usr_id=${usr_id}, ts=${ts}`);
        continue;
      }

      console.log(`[adminAutoCheck] "${label}": Пост ${index}: данные OK - usr_id=${usr_id}, ts=${ts}`);

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
        summary.textContent = 'Показать подробности';
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
        console.log(`[adminAutoCheck] Начало автопроверки для usr_id=${usr_id}, ts=${ts}`);
        if (status) {
          status.textContent = 'Проверяю…';
          status.style.color = '#555';
        }
        if (pre) pre.textContent = '';

        try {
          // Получаем данные из storage
          if (!window.FMVbank || typeof window.FMVbank.storageGet !== 'function') {
            throw new Error('FMVbank.storageGet недоступен');
          }

          const current_storage = await window.FMVbank.storageGet(usr_id, 'fmv_bank_info_');
          const BACKUP_DATA = current_storage[ts];

          if (!BACKUP_DATA) {
            throw new Error('BACKUP_DATA не найден');
          }

          console.log('[adminAutoCheck] BACKUP_DATA:', BACKUP_DATA);

          // Вызываем groupByRecipientWithGifts
          if (typeof window.groupByRecipientWithGifts !== 'function') {
            throw new Error('Функция groupByRecipientWithGifts недоступна');
          }

          const result = await window.groupByRecipientWithGifts(BACKUP_DATA);
          console.log('[adminAutoCheck] Результат проверки:', result);

          // Проверяем на ошибки
          let hasErrors = false;
          if (Array.isArray(result)) {
            for (const recipient of result) {
              if (Array.isArray(recipient.items)) {
                for (const item of recipient.items) {
                  if (item.error) {
                    hasErrors = true;
                    break;
                  }
                }
              }
              if (hasErrors) break;
            }
          }

          // Обновляем статус
          if (status) {
            if (hasErrors) {
              status.textContent = '⚠️ Найдены ошибки';
              status.style.color = 'orange';
            } else {
              status.textContent = '✅ ОК';
              status.style.color = 'green';
            }
          }

          // Обновляем детали
          if (pre) {
            pre.textContent = formatCheckResult(result);
          }

          // Автоматически открываем детали если есть ошибки
          if (hasErrors && details) {
            details.open = true;
          }

        } catch (err) {
          if (status) {
            status.textContent = '✖ Ошибка';
            status.style.color = 'red';
          }
          if (pre) pre.textContent = (err && err.message) ? err.message : String(err);
          console.error('[adminAutoCheck] Ошибка:', err);
        }
      });

      addedCount++;
    }

    console.log(`[adminAutoCheck] "${label}": Добавлено кнопок: ${addedCount}`);
  }

  // Инициализация
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    await createAutoCheckButtons({
      allowedGroups: (window.BANK_CHECK?.GroupID) || [],
      allowedForums: (window.BANK_CHECK?.ForumID) || [],
      allowedUsers: (window.BANK_CHECK?.UserID) || [],
      label: 'Автопроверка',
      order: 1, // Перед кнопкой "Внести правки" (order: 2)
      containerSelector: '.ams_info',
      postSelector: 'div.post',
    });
  }

  // Слушаем событие обновления кнопок
  window.addEventListener('bank:buttons:refresh', () => {
    console.log('[adminAutoCheck] Получено событие bank:buttons:refresh, пересоздаём кнопки');
    init();
  });

  // Экспортируем функцию
  window.createAutoCheckButtons = createAutoCheckButtons;
})();
