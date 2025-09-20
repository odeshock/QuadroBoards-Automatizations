// button.js
(() => {
  'use strict';

  // ожидание DOM/элементов
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

  // проверка форума по crumbs → /viewforum.php?id=...
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
   * Ничего не объединяет автоматически — все допуски передаёшь параметрами.
   *
   * @param {Object}   opts
   * @param {string[]} [opts.allowedGroups=[]]   список groupId (числа или строки); сравнение по числу
   * @param {string[]} [opts.allowedForums=[]]   список forumId (строки)
   * @param {string}   [opts.label='Действие']   текст на кнопке
   * @param {Function} opts.onClick              async ({statusEl, detailsEl, setStatus, setDetails}) => void
   * @param {string}   [opts.containerSelector='.ams_info']  куда вставлять
   */
  window.createForumButton = async function createForumButton(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      label = 'Действие',
      onClick,
      containerSelector = '.ams_info',
    } = opts || {};

    if (typeof onClick !== 'function') return;

    await waitAmsReady();

    // группа — берём готовую функцию из check_group.js (не дублируем!)
    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    if (allowedGroups.length && !allowedGroups.map(Number).includes(Number(gid))) return;
    if (allowedForums.length && !isAllowedForum(allowedForums)) return;

    const container = await waitFor(containerSelector, 5000).catch(() => null);
    if (!container) return;

    // --- UI ---
    const br = document.createElement('br');
    const wrap = document.createElement('div');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'button';
    btn.textContent = label;

    const status = document.createElement('span');
    status.style.marginLeft = '10px';
    status.style.fontSize = '14px';
    status.style.color = '#555';

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

    wrap.appendChild(btn);
    wrap.appendChild(status);
    wrap.appendChild(details);
    container.appendChild(br);
    container.appendChild(wrap);

    const setStatus = (text, color = '#555') => {
      status.textContent = text;
      status.style.color = color;
    };
    const setDetails = (text = '') => {
      pre.textContent = String(text || '');
    };

    btn.addEventListener('click', async () => {
      setStatus('Выполняю…', '#555');
      setDetails('');
      try {
        await onClick({ statusEl: status, detailsEl: pre, setStatus, setDetails });
      } catch (err) {
        setStatus('✖ Ошибка', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[createForumButton]', err);
      }
    });
  };
})();
