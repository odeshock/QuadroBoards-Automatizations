// ==UserScript==
// @name         Profile → last post in topic by title (search with pagination)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  const PROFILE_PATH_RE = /\/profile\.php$/i;
  const PROFILE_ID_RE = /[?&]id=\d+/;
  const PROFILE_RIGHT_SEL = '#viewprofile #profile-right';

  if (!PROFILE_PATH_RE.test(location.pathname)) return;
  if (!PROFILE_ID_RE.test(location.search)) return;

  const style = document.createElement('style');
  style.textContent = `
    #pa-bank-link a.is-empty {
      color: #999 !important;
      text-decoration: none !important;
      pointer-events: none;
      cursor: default;
      opacity: .8;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  async function ensureScrapePosts(timeoutMs = 8000, intervalMs = 250) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      if (typeof window.scrapePosts === 'function') return true;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
  }

  function insertSlot() {
    const right = document.querySelector(PROFILE_RIGHT_SEL);
    if (!right) return null;

    const li = document.createElement('li');
    li.id = 'pa-bank-link';
    li.innerHTML = `
      <span>Банковская операция:</span>
      <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a></strong>
    `;

    const after = right.querySelector('#pa-last-visit');
    if (after && after.parentElement === right) {
      after.insertAdjacentElement('afterend', li);
    } else {
      right.appendChild(li);
    }

    return li.querySelector('a');
  }

  function setEmpty(anchor, reason) {
    const text = 'Не найдена';
    anchor.classList.add('is-empty');
    anchor.href = '#';
    anchor.title = reason || text;
    anchor.textContent = text;
  }

  function setLink(anchor, href) {
    anchor.classList.remove('is-empty');
    anchor.href = href;
    anchor.textContent = 'Последняя';
  }

  ready(async () => {
    const anchor = insertSlot();
    if (!anchor) return;

    const hasScrape = await ensureScrapePosts();
    if (!hasScrape) {
      setEmpty(anchor, 'нет доступа к поиску');
      return;
    }

    if (!window.UserLogin) {
      setEmpty(anchor, 'нет данных пользователя');
      return;
    }

    const forumsRaw = window.BANK_FORUMS;
    const forums = Array.isArray(forumsRaw)
      ? forumsRaw
      : typeof forumsRaw === 'string' && forumsRaw.trim()
        ? forumsRaw.split(',').map(id => id.trim()).filter(Boolean)
        : [];

    try {
      const posts = await window.scrapePosts(window.UserLogin, forums, {
        title_prefix: 'Гринготтс',
        stopOnFirstNonEmpty: true,
        keywords: 'ДОХОДЫ OR РАСХОДЫ AND ИТОГО'
      });

      if (Array.isArray(posts) && posts.length && posts[0]?.src) {
        const siteBase = (typeof window.SITE_URL === 'string' && window.SITE_URL.trim())
          ? window.SITE_URL.trim().replace(/\/$/, '')
          : location.origin.replace(/\/$/, '');
        const href = `${siteBase}/viewtopic.php?${posts[0].src}`;
        setLink(slot, href, posts[0].date_text || posts[0].text || 'Последняя операция');
      } else {
        setEmpty(anchor);
      }
    } catch (error) {
      console.error('[bank_last_comment] scrapePosts failed', error);
      setEmpty(anchor, 'ошибка поиска');
    }
  });
})();
