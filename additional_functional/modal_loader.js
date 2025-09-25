(function () {
  // === Настройки ===
  const MODAL_SEL = '#character';
  const WRAP_SEL  = '#character > .modal_wrap';
  const CLOSE_SEL = '#character .close-reveal-modal';
  const DEBUG = true;

  const log  = (...a) => DEBUG && console.log('[Modal]', ...a);
  const warn = (...a) => DEBUG && console.warn('[Modal]', ...a);

  let lastFilterApi = null; // ChronoFilter API для текущей плашки

  // Скелет, который показываем сразу (обязательно с .character и data-id)
  function instantTemplate(N) {
    return (
      '<div class="container">\n' +
      `  <div class="character" data-id="${N}">шаблон1\n` +
      '    <div class="skin_info"></div>\n' +
      '    <div class="chrono_info"></div>\n' +
      '  </div>\n' +
      '</div>'
    );
  }

  function openModal() {
    const $m = $(MODAL_SEL);
    if (!$m.length) return null;
    $m.css({ visibility: 'visible', opacity: 1 });
    return $m[0];
  }

  function closeModal() {
    const $m = $(MODAL_SEL);
    if (!$m.length) return;
    if (lastFilterApi?.destroy) lastFilterApi.destroy();
    lastFilterApi = null;
    $(WRAP_SEL).empty();
    $m.css({ visibility: '', opacity: '' });
  }

  // Утилита: ждём появления селектора в пределах root
  function waitFor(selector, { root = document, timeout = 7000 } = {}) {
    return new Promise((resolve, reject) => {
      const found = root.querySelector(selector);
      if (found) return resolve(found);
      const obs = new MutationObserver(() => {
        const n = root.querySelector(selector);
        if (n) { obs.disconnect(); resolve(n); }
      });
      obs.observe(root, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('waitFor timeout: ' + selector)); }, timeout);
    });
  }

  function getPageIdFromEl(el) {
    const $el = $(el);
    const idAttr   = $el.attr('id');
    const dataPage = $el.data('page');
    const href     = $el.attr('href') || '';
    const fromHref = (href.match(/(?:^|\/)usr\d+(?=$|[/?#])/i) || [])[0] || (href.match(/pages\/(usr\d+)/i) || [])[1];
    return idAttr || dataPage || fromHref || href || '';
  }

  function extractN(pageId) {
    const m = String(pageId || '').match(/usr(\d+)/i);
    return m ? m[1] : null;
  }

  async function loadIntoModal(pageId) {
    const rootModal = openModal();
    if (!rootModal) return;

    const $wrap = $(WRAP_SEL);
    if (!$wrap.length) return;

    const N = extractN(pageId);
    if (!N) { warn('Не удалось извлечь N из', pageId); return; }

    // 1) мгновенный скелет
    $wrap.html(instantTemplate(N));

    // 2) подгружаем .skin_info/.chrono_info внутрь ЭТОЙ модалки
    if (window.loadUserSections) {
      await window.loadUserSections({ root: $wrap[0] });
    } else {
      warn('window.loadUserSections не найден — подключите collect_skin_n_chrono.js');
    }

    // 3) когда появятся фильтры — инициализируем их локально (модульная версия)
    try {
      await waitFor('#filters', { root: $wrap[0], timeout: 8000 });
      if (window.ChronoFilter?.init) {
        lastFilterApi = window.ChronoFilter.init({ root: $wrap[0] });
        log('ChronoFilter.init OK');
      } else if (window.ChronoFilter?.apply) {
        // ЛЕГАСИ: если подключена старая версия без init, хотя бы попробуем применить
        log('ChronoFilter.init нет — пробую apply() старой версии');
        window.ChronoFilter.apply?.();
      } else {
        warn('ChronoFilter не найден — фильтры не активны');
      }
    } catch (e) {
      warn('Фильтры не появились в отведённое время');
    }
  }

  // Открытие по клику
  $(document).on('click', '.modal-link', function (e) {
    e.preventDefault();
    const pageId = getPageIdFromEl(this);
    if (!pageId) return;
    loadIntoModal(pageId);
  });

  // Закрытие по крестику и Esc
  $(document).on('click', CLOSE_SEL, function () { closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // Публичные хелперы
  window.openCharacterModal = (pageId) => loadIntoModal(pageId);
  window.closeCharacterModal = closeModal;
})();
