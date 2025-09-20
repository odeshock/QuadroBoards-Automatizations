// button.js
(() => {
  'use strict';

  // Ждём DOM и нужный контейнер
  const waitFor = (selector, timeout = 8000) =>
    new Promise((resolve, reject) => {
      const node = document.querySelector(selector);
      if (node) return resolve(node);
      const obs = new MutationObserver(() => {
        const n = document.querySelector(selector);
        if (n) { obs.disconnect(); resolve(n); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('timeout: ' + selector)); }, timeout);
    });

  const ready = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  async function waitAmsReady() {
    await ready;
    if (window.__ams_ready) return;
    await new Promise(r => window.addEventListener('ams:ready', r, { once: true }));
  }

  // Проверка форума по crumbs → /viewforum.php?id=...
  function isAllowedForum(forumIds) {
    const crumbs = document.querySelector('.crumbs') ||
                   document.querySelector('#pun-crumbs') ||
                   document.querySelector('.pun_crumbs') ||
                   document.querySelector('.container .crumbs');
    if (!crumbs) return false;

    return Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
      try {
        const u = new URL(a.getAttribute('href'), location.href);
        return u.pathname.endsWith('/viewforum.php') &&
               forumIds.includes(u.searchParams.get('id'));
      } catch { return false; }
    });
  }

  /**
   * Универсальный конструктор кнопки с сортировкой по order
   * и встроенной ссылкой рядом со статусом.
   *
   * @param {Object}   opts
   * @param {string[]} [opts.allowedGroups=[]]  допустимые groupId (числа/строки)
   * @param {string[]} [opts.allowedForums=[]]  допустимые forumId (строки)
   * @param {string}   [opts.label='Действие']  текст на кнопке
   * @param {Function} opts.onClick             async ({statusEl, linkEl, detailsEl, setStatus, setDetails}) => void
   * @param {string}   [opts.containerSelector='.ams_info']
   * @param {number}   [opts.order=0]           порядок вывода кнопок (меньше = выше)
   */
  window.createForumButton = async function createForumButton(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      label = 'Действие',
      onClick,
      containerSelector = '.ams_info',
      order = 0
    } = opts || {};

    if (typeof onClick !== 'function') return;

    await waitAmsReady();

    // получаем groupId через подключённый check_group.js
    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    if (allowedGroups.length && !allowedGroups.map(Number).includes(Number(gid))) return;
    if (allowedForums.length && !isAllowedForum(allowedForums)) return;

    const container = await waitFor(containerSelector, 5000).catch(() => null);
    if (!container) return;

    // ---------- UI ----------
    const br = document.createElement('br');
    const wrap = document.createElement('div');
    wrap.dataset.order = order;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'button';
    btn.textContent = label;

    const status = document.createElement('span');
    status.style.marginLeft = '10px';
    status.style.fontSize = '14px';
    status.style.color = '#555';

    // встроенная ссылка рядом со статусом
    const link = document.createElement('a');
    link.className = 'fmv-action-link';
    link.target = '_blank';
    link.rel = 'noopener';
    link.style.marginLeft = '10px';
    link.style.fontSize = '14px';
    link.style.display = 'none'; // по умолчанию скрыта

    // блок деталей
    const details = document.createElement('details');
    details.style.marginTop = '6px';
    const summary = document.createElement('summary');
    summary.textContent = 'Показать детали';
    summary.style.cursor = 'pointer';
    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.margin = '6px 0 0';
    pre.style.fontSize = '12px';
    details.appendChild(summary);
    details.appendChild(pre);

    // добавляем элементы в обёртку
    wrap.appendChild(btn);
    wrap.appendChild(status);
    wrap.appendChild(link);     // <-- ССЫЛКА РЯДОМ СО СТАТУСОМ
    wrap.appendChild(details);

    container.appendChild(br);

    // вставляем по order
    const siblings = Array.from(container.querySelectorAll('div[data-order]'));
    const next = siblings.find(el => Number(el.dataset.order) > Number(order));
    if (next) container.insertBefore(wrap, next);
    else container.appendChild(wrap);

    // helpers для обновления
    const setStatus = (text, color = '#555') => {
      status.textContent = text;
      status.style.color = color;
    };
    const setDetails = (text = '') => {
      pre.textContent = String(text || '');
    };
    const setLink = (url, text = 'Открыть') => {
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

    // обработчик клика
    btn.addEventListener('click', async () => {
      setStatus('Выполняю…', '#555');
      setDetails('');
      setLink(null);
      try {
        await onClick({
          statusEl: status,
          linkEl: link,
          detailsEl: pre,
          setStatus,
          setDetails,
          setLink
        });
      } catch (err) {
        setStatus('✖ Ошибка', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[createForumButton]', err);
      }
    });
  };
})();
