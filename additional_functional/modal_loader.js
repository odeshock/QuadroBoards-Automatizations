(function () {
  // === Настройки ===
  const MODAL_SEL   = '#character';
  const WRAP_SEL    = '#character > .modal_wrap';      // контейнер контента в модалке
  const CLOSE_SEL   = '#character .close-reveal-modal';
  const DEFAULT_CHARSET = 'windows-1251';
  const DEBUG = false;
  // ==================

  const log  = (...a) => DEBUG && console.log('[Modal]', ...a);
  const warn = (...a) => DEBUG && console.warn('[Modal]', ...a);

  let ctl = null;                 // AbortController для загрузки страницы
  let lastFilterApi = null;       // чтобы корректно снимать обработчики при закрытии
  const pageCache = new Map();    // url -> Document (кэш исходных страниц)

  // базовая разметка, которую показываем мгновенно при открытии
  const INSTANT_TEMPLATE = (
    '<div class="container">\n' +
      '<div class="character" data-id>шаблон1\n' +
        '<div class="skin_info"></div>\n' +
        '<div class="chrono_info"></div>\n' +
      '</div>\n' +
    '</div>'
  );

  function normalizeUrl(pageId) {
    // поддержим: usrN | /pages/usrN | полный href (возьмём путь после домена)
    if (!pageId) return null;
    try {
      if (/^https?:\/\//i.test(pageId)) {
        const u = new URL(pageId, location.origin);
        const m = u.pathname.match(/(?:^|\/)usr\d+(?:$|(?=\/))/i) || u.pathname.match(/(?:^|\/)pages\/(usr\d+)(?:$|(?=\/))/i);
        return m ? '/pages/' + (m[1] || m[0].replace(/^\//,'')) : u.pathname;
      }
    } catch(_) {}
    if (/^\/?pages\//i.test(pageId)) return pageId.startsWith('/') ? pageId : ('/' + pageId);
    return pageId.startsWith('/') ? pageId : ('/pages/' + pageId);
  }

  async function fetchDoc(url) {
    if (pageCache.has(url)) return pageCache.get(url);
    ctl?.abort();
    ctl = new AbortController();
    const res = await fetch(url, { signal: ctl.signal, credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const ct = res.headers.get('content-type') || '';
    const m = ct.match(/charset=([^;]+)/i);
    const charset = (m ? m[1] : DEFAULT_CHARSET).toLowerCase();

    const buf  = await res.arrayBuffer();
    const html = new TextDecoder(charset).decode(buf);
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    pageCache.set(url, doc);
    return doc;
  }

  function openModal() {
    const $modal = $(MODAL_SEL);
    if (!$modal.length) return null;
    $modal.css({ visibility: 'visible', opacity: 1 });
    return $modal[0];
  }

  function closeModal() {
    const $modal = $(MODAL_SEL);
    if (!$modal.length) return;
    if (lastFilterApi?.destroy) lastFilterApi.destroy();
    lastFilterApi = null;
    $(WRAP_SEL).empty();
    $modal.css({ visibility: '', opacity: '' });
  }

  async function loadIntoModal(pageId) {
    const rootModal = openModal();
    if (!rootModal) return;

    const $wrap = $(WRAP_SEL);
    if (!$wrap.length) return;

    // Мгновенно показываем шаблон (скелет)
    $wrap.html(INSTANT_TEMPLATE);

    try {
      const url = normalizeUrl(pageId);
      if (!url) throw new Error('Не удалось определить URL для "' + pageId + '"');

      const doc = await fetchDoc(url);

      // Ищем блок персонажа на целевой странице
      const sourceCharacter = doc.querySelector('.character[data-id]');
      if (!sourceCharacter) throw new Error('character[data-id] не найден на странице');

      // Переносим data-id, чтобы collect скрипт понял кого грузить
      const N = sourceCharacter.getAttribute('data-id');
      const charNow = $wrap[0].querySelector('.character[data-id]');
      if (charNow) charNow.setAttribute('data-id', N);

      // 1) подгружаем skin + chrono внутрь данного корня
      if (window.loadUserSections) {
        await window.loadUserSections({ root: $wrap[0] });
      } else {
        warn('window.loadUserSections не найден — подключите collect_skin_n_chrono.js');
      }

      // 2) активируем фильтры ТОЛЬКО в пределах этой модалки
      if (window.ChronoFilter && typeof window.ChronoFilter.init === 'function') {
        lastFilterApi = window.ChronoFilter.init({ root: $wrap[0] });
      } else {
        warn('ChronoFilter.init не найден — подключите chrono_filter.js (модульную версию)');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[Modal] Ошибка:', err);
      $wrap.text('Ошибка загрузки');
    }
  }

  // Делегирование кликов открытия модалки
  $(document).on('click', '.modal-link', function (e) {
    e.preventDefault();
    const href      = $(this).attr('href') || '';
    const idAttr    = $(this).attr('id');
    const dataPage  = $(this).data('page');
    const fromHref  = (href.match(/(?:^|\/)usr\d+(?:$|(?=\/))/i) || [])[0] || (href.match(/pages\/(usr\d+)/i) || [])[1];
    const pageId    = idAttr || dataPage || fromHref || href || '';
    if (!pageId) return;
    loadIntoModal(pageId);
  });

  // Закрытие модалки (крестик и Esc)
  $(document).on('click', CLOSE_SEL, function () { closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Программный вызов
  window.openCharacterModal = function (pageId) { loadIntoModal(pageId); };
  window.closeCharacterModal = closeModal;
})();
