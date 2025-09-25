// modal.js — финальная сборка
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
  let isOpening = false;          // замок от авто-тоггла во время открытия

  // Мгновенно показываемый скелет
  const INSTANT_TEMPLATE =
    '<div class="container">\n' +
    '  <div class="character" data-id>шаблон1\n' +
    '    <div class="skin_info"></div>\n' +
    '    <div class="chrono_info"></div>\n' +
    '  </div>\n' +
    '</div>';

  function normalizeUrl(pageId) {
    // поддержим: usrN | /pages/usrN | полный href
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
    // если у темы есть фон модалки — блокируем клики, чтобы внешние делегаты не схлопнули окно
    $('.reveal-modal-bg').css('pointer-events','none');
    return $modal[0];
  }

  function closeModal() {
    const $modal = $(MODAL_SEL);
    if (!$modal.length) return;
    if (lastFilterApi?.destroy) lastFilterApi.destroy();
    lastFilterApi = null;
    $(WRAP_SEL).empty();
    $modal.css({ visibility: '', opacity: '' });
    $('.reveal-modal-bg').css('pointer-events','');
  }

  async function loadIntoModal(pageId) {
    const rootModal = openModal();
    if (!rootModal) return;

    const $wrap = $(WRAP_SEL);
    if (!$wrap.length) return;

    // 1) мгновенный скелет
    $wrap.html(INSTANT_TEMPLATE);

    try {
      const url = normalizeUrl(pageId);
      if (!url) throw new Error('Не удалось определить URL для "' + pageId + '"');

      const doc = await fetchDoc(url);

      // 2) найдём .character[data-id] на странице и проставим тот же data-id в наш скелет
      const sourceCharacter = doc.querySelector('.character[data-id]');
      if (!sourceCharacter) throw new Error('character[data-id] не найден на странице');
      const N = sourceCharacter.getAttribute('data-id');
      const charNow = $wrap[0].querySelector('.character[data-id]');
      if (charNow) charNow.setAttribute('data-id', N);

      // 3) подтянем skin + chrono внутрь этого корня
      if (window.loadUserSections) {
        await window.loadUserSections({ root: $wrap[0] });
      } else {
        warn('window.loadUserSections не найден — подключите collect_skin_n_chrono.js');
      }

      // 4) активируем фильтры ТОЛЬКО в пределах этой модалки
      if (window.ChronoFilter && typeof window.ChronoFilter.init === 'function') {
        lastFilterApi = window.ChronoFilter.init({ root: $wrap[0] });
      } else if (window.ChronoFilter?.apply) {
        // если старая версия — хотя бы применим
        window.ChronoFilter.apply();
      } else {
        warn('ChronoFilter.init не найден — подключите модульную chrono_filter.js');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[Modal] Ошибка:', err);
      $wrap.text('Ошибка загрузки');
    }
  }

  // Открытие по клику — защита от самозакрытия
  $(document).on('click', '.modal-link', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    if (isOpening) return;
    isOpening = true;

    const href      = $(this).attr('href') || '';
    const idAttr    = $(this).attr('id');
    const dataPage  = $(this).data('page');
    const fromHref  = (href.match(/(?:^|\/)usr\d+(?:$|(?=\/))/i) || [])[0] || (href.match(/pages\/(usr\d+)/i) || [])[1];
    const pageId    = idAttr || dataPage || fromHref || href || '';
    if (!pageId) { isOpening = false; return; }

    loadIntoModal(pageId).finally(() => {
      setTimeout(() => { isOpening = false; }, 200);
    });
  });

  // клики по контенту модалки не должны проламываться наружу
  $(document).on('click', '#character .modal_wrap', function (e) {
    e.stopPropagation();
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
