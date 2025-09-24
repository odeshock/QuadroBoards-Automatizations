(function () {
  const WRAP_SEL = '#character > .modal_wrap';  // куда вставляем в модалке
  const DEFAULT_CHARSET = 'windows-1251';
  const DEBUG = true;

  const log  = (...a) => DEBUG && console.log('[ModalLoader]', ...a);
  const warn = (...a) => DEBUG && console.warn('[ModalLoader]', ...a);

  let ctl = null;
  const pageCache = new Map(); // url -> Document

  function normalizeUrl(pageId) {
    return pageId.startsWith('/') ? pageId : '/pages/' + pageId;
  }

  async function fetchDoc(url) {
    if (ctl) ctl.abort();
    ctl = new AbortController();

    log('Запрос:', url);
    const res = await fetch(url, { credentials: 'same-origin', signal: ctl.signal });
    log('Статус:', res.status, res.statusText);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const ct = res.headers.get('content-type') || '';
    const m = ct.match(/charset=([^;]+)/i);
    const charset = (m ? m[1] : DEFAULT_CHARSET).toLowerCase();
    log('Content-Type:', ct, '| Кодировка:', charset);

    const buf  = await res.arrayBuffer();
    const html = new TextDecoder(charset).decode(buf);
    log('Длина HTML:', html.length);

    return new DOMParser().parseFromString(html, 'text/html');
  }

  async function loadIntoModal(pageId) {
    const $wrap = $(WRAP_SEL);
    log('Контейнеров .modal_wrap:', $wrap.length);
    if (!$wrap.length) return;

    // индикатор
    $wrap[0].textContent = 'Загрузка…';

    try {
      const url = normalizeUrl(pageId);

      let doc;
      if (pageCache.has(url)) {
        log('cache hit:', url);
        doc = pageCache.get(url);
      } else {
        doc = await fetchDoc(url);
        pageCache.set(url, doc);
      }

      // ищем персонажа и его ближайший контейнер
      const char = doc.querySelector('.character[data-id]');
      log('.character[data-id] найден:', !!char);
      if (!char) { $wrap.text('Нет .character[data-id]'); return; }

      const container = char.closest('.container') || char.parentElement || char;
      log('.container найден:', !!container);

      // ВСТАВЛЯЕМ КЛОН, чтобы не «чинилась» разметка браузером
      $wrap.empty().append($(container).clone(true));
      log('Контент вставлен (clone).');

      // 1) подтянуть skin/chrono именно внутри модалки
      if (window.loadUserSections) {
        log('Запуск loadUserSections (root=.modal_wrap)');
        await window.loadUserSections({ root: $wrap[0] });
      } else {
        warn('window.loadUserSections не найден');
      }

      // 2) и только теперь — фильтр хроники
      if (window.ChronoFilter && typeof window.ChronoFilter.init === 'function') {
        log('Запуск ChronoFilter.init (root=.modal_wrap)');
        window.ChronoFilter.init({ root: $wrap[0] }); // сам применит фильтры
      } else {
        warn('ChronoFilter.init не найден — подключите chrono_filter.js');
      }
    } catch (err) {
      if (err.name === 'AbortError') { log('Запрос отменён (новый клик)'); return; }
      console.error('[ModalLoader] Ошибка:', err);
      $wrap.text('Ошибка загрузки');
    }
  }

  // Делегированный обработчик на все ссылки открытия модалки
  $(document).on('click', '.modal-link', function (e) {
    e.preventDefault();
    const pageId = $(this).attr('id'); // ожидается "usr2", "usr15", ...
    log('Клик .modal-link, pageId =', pageId);
    if (!pageId) return;
    loadIntoModal(pageId);
  });

  // Программный вызов (если нужно)
  window.openCharacterModal = function (pageId) {
    log('Программный вызов для', pageId);
    loadIntoModal(pageId);
  };
})();
