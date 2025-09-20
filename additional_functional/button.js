// button.js
(() => {
  'use strict';

  // ждём DOM и нужный контейнер
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

  // проверка форума по ссылкам на viewforum.php
  function isAllowedForum(forumIds) {
    const allow = (forumIds || []).map(String);
    const crumbs = document.querySelector('.crumbs') ||
                   document.querySelector('#pun-crumbs') ||
                   document.querySelector('.pun_crumbs') ||
                   document.querySelector('.container .crumbs');

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

  /**
   * Универсальный конструктор кнопки.
   *
   * @param {Object}   opts
   * @param {string[]} [opts.allowedGroups=[]]
   * @param {string[]} [opts.allowedForums=[]]
   * @param {string}   [opts.label='Действие']
   * @param {Function} opts.onClick       async ({statusEl, linkEl, detailsEl, setStatus, setDetails, setLink, wrap}) => void
   * @param {string}   [opts.containerSelector='.ams_info']
   * @param {number}   [opts.order=0]
   * @param {boolean}  [opts.showStatus=true]   // ← новинка
   * @param {boolean}  [opts.showDetails=true]  // ← новинка
   * @param {boolean}  [opts.showLink=true]     // ← новинка
   */
  window.createForumButton = async function createForumButton(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      label = 'Действие',
      onClick,
      containerSelector = '.ams_info',
      order = 0,
      showStatus = true,
      showDetails = true,
      showLink = true,
    } = opts || {};

    if (typeof onClick !== 'function') return;

    await waitAmsReady();

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) return;
    if (!allowedGroups.map(Number).includes(Number(gid))) return;
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) return;
    if (!isAllowedForum(allowedForums)) return;

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
      pre.textContent = String(text || '');
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
      // раньше мы всегда писали "Выполняю…"
      // теперь делаем это только если showStatus=true
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
        // молча глотаем, если статус/детали скрыты; иначе покажем коротко
        if (showStatus) setStatus('✖ Ошибка', 'red');
        if (showDetails) setDetails((err && err.message) ? err.message : String(err));
        console.error('[createForumButton]', err);
      }
    });
  };
})();

