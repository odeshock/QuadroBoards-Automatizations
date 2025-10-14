// ==UserScript==
// @name         Profile → Последний пост (bank/post_last_comment, без jQuery)
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
    #pa-lastpost-link a.is-empty {
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
    li.id = 'pa-lastpost-link';
    li.innerHTML = `
      <span>Последний пост:</span>
      <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a></strong>
    `;

    const after = right.querySelector('#pa-last-visit');
    if (after && after.parentElement === right) {
      after.insertAdjacentElement('afterend', li);
    } else {
      right.appendChild(li);
    }

    return li;
  }

  function setEmpty(reason) {
    const text = 'Не найден';
    anchor.classList.add('is-empty');
    anchor.href = '#';
    anchor.title = reason || text;
    anchor.textContent = text;
  }

  function setLink(href, dateText) {
    anchor.classList.remove('is-empty');
    anchor.href = href;
    anchor.textContent = dateText || 'Последний пост';
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
        stopOnFirstNonEmpty: true,
        comments_only: true
      });

      if (Array.isArray(posts) && posts.length && posts[0]?.src) {
        const base = (typeof window.SITE_URL === 'string' && window.SITE_URL.trim())
          ? window.SITE_URL.trim().replace(/\/$/, '')
          : location.origin.replace(/\/$/, '');
        const href = `${base}/viewtopic.php?${posts[0].src}`;
        setLink(slot, href, posts[0].date_text || posts[0].text || 'Последний пост');
      } else {
        setEmpty(slot);
      }
    } catch (error) {
      console.error('[post_last_comment] scrapePosts failed', error);
      setEmpty(slot, 'ошибка поиска');
    }
  });
})();
