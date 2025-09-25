// modal.js — stable/safe версия без обязательного fetch
(function () {
  const MODAL_SEL = '#character';
  const WRAP_SEL  = '#character > .modal_wrap';
  const CLOSE_SEL = '#character .close-reveal-modal';
  const DEBUG = false;

  const log  = (...a) => DEBUG && console.log('[Modal]', ...a);
  const warn = (...a) => DEBUG && console.warn('[Modal]', ...a);

  let lastFilterApi = null;
  let isOpening = false;

  const INSTANT_TEMPLATE =
    '<div class="container">\n' +
    '  <div class="character" data-id>шаблон1\n' +
    '    <div class="skin_info"></div>\n' +
    '    <div class="chrono_info"></div>\n' +
    '  </div>\n' +
    '</div>';

  // --- утилиты ---
  function extractN(any) {
    const m = String(any || '').match(/usr(\d+)/i);
    return m ? m[1] : null;
  }
  function getPageIdFrom(el) {
    const $el = $(el);
    const idAttr   = $el.attr('id');          // usr4
    const dataPage = $el.data('page');        // usr4
    const href     = $el.attr('href') || '';  // /pages/usr4 или usr4
    const fromHref = (href.match(/(?:^|\/)(usr\d+)(?=$|[/?#])/i) || [])[1];
    return idAttr || dataPage || fromHref || href || '';
  }

  function openModal() {
    const $m = $(MODAL_SEL);
    if (!$m.length) return null;
    // некоторые темы скрывают через display:none — включим явно
    $m.addClass('open').css({ display: 'block', visibility: 'visible', opacity: 1 });
    return $m[0];
  }
  function closeModal() {
    const $m = $(MODAL_SEL);
    if (!$m.length) return;
    if (lastFilterApi?.destroy) lastFilterApi.destroy();
    lastFilterApi = null;
    $(WRAP_SEL).empty();
    $m.removeClass('open').css({ display: '', visibility: '', opacity: '' });
  }

  async function loadIntoModal(pageId) {
    const rootModal = openModal();
    if (!rootModal) return;

    const $wrap = $(WRAP_SEL);
    if (!$wrap.length) return;

    // 1) скелет — сразу
    $wrap.html(INSTANT_TEMPLATE);

    // 2) достаём usrN прямо из кликнутой ссылки/идентификатора
    const N = extractN(pageId);
    const charNow = $wrap[0].querySelector('.character[data-id]');
    if (!N) {
      warn('Не удалось определить usrN из', pageId);
      charNow?.removeAttribute('data-id');
      return; // скелет остаётся, чтобы было видно, что модалка открылась
    }
    charNow.setAttribute('data-id', N);

    // 3) подгружаем skin/chrono строго в пределах этой модалки
    if (window.loadUserSections) {
      try {
        await window.loadUserSections({ root: $wrap[0] });
      } catch (e) {
        console.error('[Modal] loadUserSections error:', e);
      }
    } else {
      warn('window.loadUserSections не найден — подключите collect_skin_n_chrono.js');
    }

    // 4) активируем фильтры локально (модульная версия)
    try {
      const filtersRoot = $wrap[0].querySelector('#filters');
      if (filtersRoot && window.ChronoFilter?.init) {
        lastFilterApi = window.ChronoFilter.init({ root: $wrap[0] });
      } else if (filtersRoot && window.ChronoFilter?.apply) {
        // старая версия — применим как есть
        window.ChronoFilter.apply();
      }
    } catch (e) {
      warn('ChronoFilter init error:', e);
    }
  }

  // --- делегаты ---
  // ВАЖНО: не используем stopImmediatePropagation глобально, чтобы не ломать тему;
  // глушим только всплытие и default у наших ссылок
  $(document).on('click', '.modal-link', function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (isOpening) return;
    isOpening = true;

    const pageId = getPageIdFrom(this);
    if (!pageId) { isOpening = false; return; }

    loadIntoModal(pageId).finally(() => {
      setTimeout(() => { isOpening = false; }, 150);
    });
  });

  // клики внутри контента не проламываются наружу
  $(document).on('click', '#character .modal_wrap', function (e) {
    e.stopPropagation();
  });

  // закрытие — крестик и Esc
  $(document).on('click', CLOSE_SEL, function (e) {
    e.preventDefault();
    closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // программный вызов
  window.openCharacterModal  = (pageId) => loadIntoModal(pageId);
  window.closeCharacterModal = closeModal;

  if (DEBUG) log('modal ready');
})();
