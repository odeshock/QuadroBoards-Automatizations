// button.js
(() => {
  'use strict';

  const ready = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  async function waitAmsReady() {
    await ready;
    if (window.__ams_ready) return;
    await new Promise(r => window.addEventListener('ams:ready', r, { once: true }));
  }

  // проверка форума по ссылкам на viewforum.php
  function isAllowedForum(forumIds) {
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
  }

  // НОВОЕ: проверка, что мы на нужной теме /viewtopic.php?id=N (p/K/#pM игнорируем)
  function isOnTopicId(topicId) {
    if (topicId == null) return true; // проверка не запрошена
    const want = String(topicId).trim();
    if (!want) return false;

    try {
      const u = new URL(location.href);
      if (!u.pathname.includes('viewtopic.php')) return false;
      const got = (u.searchParams.get('id') || '').trim();
      return got === want;
    } catch {
      return false;
    }
  }

  /**
   * Универсальный конструктор кнопки.
   *
   * @param {Object}   opts
   * @param {string[]} [opts.allowedGroups=[]]
   * @param {string[]} [opts.allowedForums=[]]
   * @param {string[]} [opts.allowedUsers=[]]
   * @param {string}   [opts.label='Действие']
   * @param {Function} opts.onClick  async ({statusEl, linkEl, detailsEl, setStatus, setDetails, setLink, wrap}) => void
   * @param {string}   [opts.containerSelector='.ams_info']
   * @param {number}   [opts.order=0]
   * @param {boolean}  [opts.showStatus=true]
   * @param {boolean}  [opts.showDetails=true]
   * @param {boolean}  [opts.showLink=true]
   * @param {string|number|null} [opts.topicId=null]  // НОВОЕ: если задано — рендерить только на /viewtopic.php?id=topicId
   */
  window.createForumButton = async function createForumButton(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      allowedUsers = [],
      label = 'Действие',
      onClick,
      containerSelector = '.ams_info',
      order = 0,
      showStatus = true,
      showDetails = true,
      showLink = true,
      topicId = null,               // НОВОЕ
    } = opts || {};

    console.log(`[createForumButton] Вызов для "${label}":`, { allowedGroups, allowedForums, allowedUsers, containerSelector });

    if (typeof onClick !== 'function') {
      console.log(`[createForumButton] "${label}": onClick не функция, выход`);
      return;
    }

    await waitAmsReady();
    console.log(`[createForumButton] "${label}": AMS готов`);

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    console.log(`[createForumButton] "${label}": текущая группа = ${gid}, разрешённые = [${allowedGroups}]`);

    // строгая проверка группы
    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) {
      console.log(`[createForumButton] "${label}": allowedGroups пустой, выход`);
      return;
    }
    if (!allowedGroups.map(Number).includes(Number(gid))) {
      console.log(`[createForumButton] "${label}": группа ${gid} не в списке, выход`);
      return;
    }

    console.log(`[createForumButton] "${label}": проверка группы пройдена`);

    // строгая проверка форума
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) {
      console.log(`[createForumButton] "${label}": allowedForums пустой, выход`);
      return;
    }
    if (!isAllowedForum(allowedForums)) {
      console.log(`[createForumButton] "${label}": форум не разрешён, выход`);
      return;
    }

    console.log(`[createForumButton] "${label}": проверка форума пройдена`);

    // проверка пользователей (если задано)
    if (Array.isArray(allowedUsers) && allowedUsers.length > 0) {
      const uid = Number(window.UserID);
      console.log(`[createForumButton] "${label}": текущий UserID = ${uid}, разрешённые = [${allowedUsers}]`);
      if (!allowedUsers.map(Number).includes(uid)) {
        console.log(`[createForumButton] "${label}": пользователь ${uid} не в списке, выход`);
        return;
      }
    }

    console.log(`[createForumButton] "${label}": проверка пользователей пройдена`);

    // НОВОЕ: строгая проверка нужной темы
    if (!isOnTopicId(topicId)) {
      console.log(`[createForumButton] "${label}": topicId не совпадает, выход`);
      return;
    }

    console.log(`[createForumButton] "${label}": ищем контейнер "${containerSelector}"`);

    const container = await FMV.waitForSelector(containerSelector, 5000).catch(() => null);
    if (!container) {
      console.log(`[createForumButton] "${label}": контейнер "${containerSelector}" не найден, выход`);
      return;
    }

    console.log(`[createForumButton] "${label}": контейнер найден, создаём кнопку`);

    // ---------- UI ----------
    const br = document.createElement('br');
    const wrap = document.createElement('div');
    wrap.dataset.order = order;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'button';
    btn.textContent = label;

    // статус (опционально)
    const status = showStatus ? document.createElement('span') : null;
    if (status) {
      status.style.marginLeft = '10px';
      status.style.fontSize = '14px';
      status.style.color = '#555';
    }

    // встроенная ссылка рядом со статусом (опционально)
    const link = showLink ? document.createElement('a') : null;
    if (link) {
      link.className = 'fmv-action-link';
      link.target = '_blank';
      link.rel = 'noopener';
      link.style.marginLeft = '10px';
      link.style.fontSize = '14px';
      link.style.display = 'none';
    }

    // блок деталей (опционально)
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

    // собираем wrap
    wrap.appendChild(btn);
    if (status) wrap.appendChild(status);
    if (link) wrap.appendChild(link);
    if (details) wrap.appendChild(details);

    container.appendChild(br);

    // вставка по order
    const siblings = Array.from(container.querySelectorAll('div[data-order]'));
    const next = siblings.find(el => Number(el.dataset.order) > Number(order));
    if (next) container.insertBefore(wrap, next);
    else container.appendChild(wrap);

    // helpers
    const setStatus = (text, color = '#555') => {
      if (!status) return;
      status.textContent = text;
      status.style.color = color;
    };
    const setDetails = (text = '') => {
      if (!pre) return;
      const str = String(text || '');
      // Если текст содержит HTML теги, используем innerHTML, иначе textContent
      if (str.includes('<') && str.includes('>')) {
        pre.innerHTML = str;
      } else {
        pre.textContent = str;
      }
    };
    const setLink = (url, text = 'Открыть') => {
      if (!link) return;
      if (url) {
        link.href = url;
        link.textContent = text;
        link.style.display = 'inline';
      } else {
        link.style.display = 'none';
        link.textContent = '';
        link.removeAttribute('href');
      }
    };

    btn.addEventListener('click', async () => {
      if (showStatus) setStatus('Выполняю…', '#555');
      if (showDetails) setDetails('');
      if (showLink) setLink(null);

      try {
        await onClick({
          statusEl: status || null,
          linkEl: link || null,
          detailsEl: pre || null,
          setStatus,
          setDetails,
          setLink,
          wrap
        });
      } catch (err) {
        if (showStatus) setStatus('✖ ошибка', 'red');
        if (showDetails) setDetails((err && err.message) ? err.message : String(err));
        console.error('[createForumButton]', err);
      }
    });
  };
})();
