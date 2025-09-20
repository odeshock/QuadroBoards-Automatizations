// universal_button.js
(() => {
  'use strict';

  // Ждём, пока готов DOM и .ams_info
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

  // Проверка форума
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
   * Универсальный конструктор кнопки.
   * @param {Object} opts
   * @param {string[]} opts.allowedGroups - список groupId (числа или строки)
   * @param {string[]} opts.allowedForums - список forumId (строки)
   * @param {string}   opts.label         - текст кнопки
   * @param {Function} opts.onClick       - async ({statusEl}) => void
   * @param {string}   [opts.containerSelector='.ams_info']
   */
  window.createForumButton = async function(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      label = 'Действие',
      onClick,
      containerSelector = '.ams_info'
    } = opts;

    await waitAmsReady();

    const groupId = getCurrentGroupId(); // Функция уже подключена из check_group.js
    if (allowedGroups.length && !allowedGroups.map(Number).includes(Number(groupId))) return;
    if (allowedForums.length && !isAllowedForum(allowedForums)) return;

    const container = await waitFor(containerSelector, 5000);
    if (!container) return;

    // --- UI ---
    const wrap = document.createElement('div');
    const btn  = document.createElement('button');
    btn.type   = 'button';
    btn.className = 'button';
    btn.textContent = label;

    const status = document.createElement('span');
    status.style.marginLeft = '10px';
    status.style.fontSize = '14px';
    status.style.color = '#555';

    wrap.appendChild(btn);
    wrap.appendChild(status);
    container.appendChild(document.createElement('br'));
    container.appendChild(wrap);

    btn.addEventListener('click', async () => {
      status.textContent = 'Выполняю…';
      status.style.color = '#555';
      try {
        await onClick({ statusEl: status });
      } catch (e) {
        status.textContent = '✖ Ошибка';
        status.style.color = 'red';
        console.error(e);
      }
    });
  };
})();
