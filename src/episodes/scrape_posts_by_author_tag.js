// scrape_posts_by_author_tag.js
// Поиск постов по метке [FMVauthor]usrN;[/FMVauthor] вместо автора

/**
 * Собирает посты по метке автора (вместо обычного поиска по автору)
 * @param {number} authorUserId - ID пользователя для поиска через usrN в ключевых словах
 * @param {number[]|string} forums - ID форумов (массив или строка через запятую)
 * @param {Object} options - Опции поиска (аналогично scrapePostsByAuthorTag)
 * @param {string} [options.authorLogin=''] - Логин автора для дополнительной фильтрации (параметр author=)
 * @param {boolean} [options.debug=false] - Включить debug-логи
 * @returns {Promise<Array>} Массив постов
 */
window.scrapePostsByAuthorTag = async function (authorUserId, forums, {
  stopOnNthPost,
  last_src = [],
  title_prefix = '',
  maxPages = 999,
  delayMs = 300,
  keywords = '',
  comments_only = false,
  min_symbols_num = -1,
  authorLogin = ''
} = {}) {

  const DEBUG = true;

  const log = (...args) => {
    if (DEBUG) console.log('[scrapePostsByAuthorTag]', ...args);
  };

  if (!authorUserId) throw new Error('authorUserId обязателен');
  if (!forums || (Array.isArray(forums) && forums.length === 0)) {
    throw new Error('forums обязателен');
  }

  log('Начало работы с параметрами:', { authorUserId, forums, stopOnNthPost, last_src, title_prefix, maxPages, delayMs, keywords, comments_only, min_symbols_num, authorLogin, debug });

  const forumsStr = Array.isArray(forums) ? forums.join(',') : String(forums);

  // Добавляем usrN AND к ключевым словам
  const baseKeywords = String(keywords ?? '').trim();
  const finalKeywords = baseKeywords
    ? `usr${authorUserId} AND ${baseKeywords}`
    : `usr${authorUserId}`;  // ИСПРАВЛЕНО: всегда добавляем usrN, даже без доп. keywords

  log('Ключевые слова для поиска:', finalKeywords);
  if (authorLogin) {
    log('Дополнительная фильтрация по логину автора:', authorLogin);
  }

  const titlePrefix = String(title_prefix || '').trim().toLocaleLowerCase('ru');
  const lastSources = Array.isArray(last_src) ? last_src : [last_src].filter(Boolean);
  const seenSources = new Set(lastSources.map(normalizeSource));

  function normalizeSource(url) {
    try {
      const u = new URL(url, location.href);
      const hashMatch = u.hash && u.hash.match(/^#p(\d+)$/);
      if (hashMatch) {
        const pid = hashMatch[1];
        return `pid=${pid}#p${pid}`;
      }
      const pidParam = u.searchParams.get('pid');
      if (pidParam) return `pid=${pidParam}#p${pidParam}`;
      const pParam = u.searchParams.get('p');
      if (pParam) return `pid=${pParam}#p${pParam}`;
      return u.toString();
    } catch {
      return url;
    }
  }

  function hashPosts(posts) {
    let hash = 0;
    const str = posts.join('\n');
    for (const char of str) {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      hash |= 0;
    }
    return hash;
  }

  function buildSearchUrl(page) {
    const authorParam = String(authorLogin || '').trim();

    const params = [
      ['action', 'search'],
      ['keywords', finalKeywords ? encodeForSearch(finalKeywords) : ''],
      ['author', authorParam ? encodeForSearch(authorParam) : ''],
      ['forums', forumsStr],
      ['search_in', '0'],
      ['sort_by', '0'],
      ['sort_dir', 'DESC'],
      ['show_as', 'posts'],
      ['search', encodeForSearch('Отправить')],
      ['p', String(page)]
    ].filter(([k, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join('&');

    const url = new URL(`/search.php?${params}`, location.origin).toString();
    log(`Построен URL для страницы ${page}:`, url);
    return url;
  }

  async function fetchDoc(url) {
    if (window.FMV?.fetchDoc) return await window.FMV.fetchDoc(url);
    if (typeof fetchCP1251Doc === 'function') return await fetchCP1251Doc(url);
    if (typeof fetchHtml === 'function') {
      const html = await fetchHtml(url);
      return (new DOMParser()).parseFromString(html, 'text/html');
    }
    const resp = await fetch(url, { credentials: 'include' });
    const html = await resp.text();
    return (new DOMParser()).parseFromString(html, 'text/html');
  }

  function isNoResults(doc) {
    if ((doc.querySelector('title')?.textContent || '').trim() === 'Информация') {
      const info = doc.querySelector('#pun-main .info .container');
      if (info && /ничего не найдено/i.test(info.textContent)) return true;
    }
    return false;
  }

  function cleanText(html = '') {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Удаляем скрытые quote-box
    temp.querySelectorAll('.quote-box.hide-box').forEach(el => {
      const blockquote = el.querySelector('blockquote');
      if (blockquote) {
        const div = document.createElement('div');
        div.innerHTML = blockquote.innerHTML;
        el.replaceWith(div);
      }
    });

    // Удаляем cite
    temp.querySelectorAll('cite').forEach(el => el.remove());

    // Code boxes
    temp.querySelectorAll('.code-box').forEach(el => {
      const pre = el.querySelector('pre');
      const text = pre ? pre.textContent : '';
      const div = document.createElement('div');
      div.textContent = text || '';
      el.replaceWith(div);
    });

    // Удаляем custom tags
    temp.querySelectorAll('.custom_tag, .hidden_tag, characters, location, order').forEach(el => el.remove());

    // script[type="text/html"]
    temp.querySelectorAll('script[type="text/html"]').forEach(el => {
      const div = document.createElement('div');
      div.innerHTML = el.textContent || '';
      div.querySelectorAll('p, br').forEach(e => e.insertAdjacentText('afterend', '\n'));
      let txt = (div.textContent || '').replace(/\u00A0/g, ' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n');
      el.insertAdjacentText('beforebegin', txt ? `\n${txt}\n` : '');
      el.remove();
    });

    // Заменяем блочные элементы на переносы
    const blockTags = [
      'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'DT', 'DD',
      'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3',
      'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
      'SECTION', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'UL', 'BR'
    ].join(',');

    temp.querySelectorAll(blockTags).forEach(el => {
      if (el.tagName === 'BR') {
        el.insertAdjacentText('beforebegin', '\n');
      } else {
        el.insertAdjacentText('afterend', '\n');
      }
    });

    let text = (temp.textContent || '').replace(/\u00A0/g, ' ');
    text = text.replace(/\[\/?indent\]/gi, '')
      .replace(/\[\/?float(?:=[^\]]+)?\]/gi, '')
      .replace(/\[DiceFM[^\]]*?\]/gi, '');

    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n')
      .replace(/ {2,}/g, ' ').replace(/\n{2,}/g, '\n');

    const lines = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '') {
        if (lines.length && lines[lines.length - 1] !== '') lines.push('');
      } else {
        lines.push(trimmed);
      }
    }

    return lines.join('\n').replace(/ {2,}/g, ' ').replace(/\n{2,}/g, '\n')
      .replace(/^\n+|\n+$/g, '').trim();
  }

  function parsePost(postEl) {
    const h3 = postEl.querySelector('h3 > span');
    const links = h3 ? h3.querySelectorAll('a') : [];
    const title = (links[1]?.textContent?.trim() || '').toLocaleLowerCase('ru');
    const srcLink = links[2] ? new URL(links[2].getAttribute('href'), location.href).href : '';
    const src = srcLink ? normalizeSource(srcLink) : '';
    const dateText = links[2]?.innerText?.trim() || '';
    const postedAttr = postEl.getAttribute('data-posted');
    const dateTs = Number(postedAttr);
    const content = postEl.querySelector('.post-content');
    let html = content?.innerHTML?.trim() || '';

    // Обработка [html]...[/html]
    const processHtml = (str) => str.replace(/\[html\]([\s\S]*?)\[\/html\]/gi, (m, inside) => cleanText(inside));
    html = processHtml(html);

    const text = cleanText(html);

    return {
      title,
      src,
      text,
      html,
      symbols_num: text.length,
      date_ts: dateTs,
      date_text: dateText
    };
  }

  function filterPosts(doc) {
    const allPosts = [...doc.querySelectorAll('.post')].map(parsePost);
    log(`Найдено постов на странице: ${allPosts.length}`);

    // Фильтр по title_prefix
    let filtered = allPosts.filter(p => !titlePrefix || p.title.startsWith(titlePrefix));
    if (titlePrefix) {
      log(`После фильтра по title_prefix="${titlePrefix}": ${filtered.length} постов`);
    }

    // Фильтр по seenSources
    const beforeSeenFilter = filtered.length;
    filtered = filtered.filter(p => !seenSources.has(p.src));
    if (beforeSeenFilter !== filtered.length) {
      log(`Отфильтровано уже виденных постов: ${beforeSeenFilter - filtered.length}`);
    }

    // Фильтр по min_symbols_num
    if (min_symbols_num > 0) {
      const beforeSymbolsFilter = filtered.length;
      filtered = filtered.filter(p => p.symbols_num >= min_symbols_num);
      if (beforeSymbolsFilter !== filtered.length) {
        log(`Отфильтровано постов по min_symbols_num=${min_symbols_num}: ${beforeSymbolsFilter - filtered.length}`);
      }
    }

    // Фильтр comments_only (НЕ используем scrapeTopicFirstPostLinks)
    // Просто пропускаем эту логику, т.к. мы ищем по тегу, а не по автору

    log(`Финальное количество постов после всех фильтров: ${filtered.length}`);
    return filtered;
  }

  // Основной цикл
  const allResults = [];
  let lastHash = null;
  let sameHashCount = 0;

  log('Начинаем основной цикл поиска постов');

  for (let page = 1; page <= maxPages; page++) {
    log(`\n--- Обработка страницы ${page} ---`);
    const doc = await fetchDoc(buildSearchUrl(page));

    if (isNoResults(doc)) {
      log('Получена страница "ничего не найдено", завершаем поиск');
      break;
    }

    const currentPage = Number(doc.querySelector('div.linkst div.pagelink strong')?.textContent || page);
    log(`Текущая страница по DOM: ${currentPage}`);
    if (currentPage === 1 && page !== 1) {
      log('Вернулись на первую страницу, закончились страницы');
      break; // Закончились страницы
    }

    const posts = filterPosts(doc);

    if (!posts.length) {
      log('Постов после фильтрации нет');
      const currentHash = hashPosts(allResults.map(p => p.src));
      if (currentHash === lastHash) {
        sameHashCount++;
        log(`Хеш повторяется (${sameHashCount}/3)`);
        if (sameHashCount >= 3) {
          log('Хеш повторился 3 раза, завершаем поиск');
          break;
        }
      } else {
        lastHash = currentHash;
        sameHashCount = 0;
      }
    } else {
      log(`Добавляем ${posts.length} постов к результатам`);
      allResults.push(...posts);
      posts.forEach(p => seenSources.add(p.src));
      sameHashCount = 0;
      log(`Всего собрано постов: ${allResults.length}`);
    }

    if (stopOnNthPost && allResults.length >= stopOnNthPost) {
      log(`Достигнут лимит stopOnNthPost=${stopOnNthPost}, завершаем поиск`);
      break;
    }

    if (page < maxPages) {
      log(`Ожидание ${delayMs}ms перед следующей страницей`);
      await (window.FMV?.sleep?.(delayMs) ?? new Promise(r => setTimeout(r, delayMs)));
    }
  }

  log(`\n✅ Поиск завершен. Всего найдено постов: ${allResults.length}`);
  return allResults;
};
