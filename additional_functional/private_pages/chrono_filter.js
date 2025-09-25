// ЧИСТЫЙ СТАРТ
ChronoFilter && ChronoFilter.stop && ChronoFilter.stop();

(function waitAndInit() {
  var MODAL_SEL = '.modal_wrap';
  var FILTERS_SEL = '.chrono_info #filters';   // при желании можно упростить до '#filters'
  var LIST_SEL    = '.chrono_info #list';      // или '#list'

  function ready(modal){
    return modal &&
           modal.querySelector(FILTERS_SEL) &&
           modal.querySelector(LIST_SEL);
  }

  var modal = document.querySelector(MODAL_SEL);
  if (!modal) {
    // ждём появления модалки
    var mo1 = new MutationObserver(function(){
      var m = document.querySelector(MODAL_SEL);
      if (m) { mo1.disconnect(); waitAndInit(); }
    });
    mo1.observe(document.documentElement || document.body, {childList:true, subtree:true});
    return;
  }

  if (ready(modal)) {
    ChronoFilter.init({
      root: modal,
      filtersSelector: FILTERS_SEL,
      listSelector: LIST_SEL,
      episodeSelector: '.episode',
      DEBUG: true
    });
    return;
  }

  // ждём, пока внутрь модалки подгрузятся #filters и #list
  var mo2 = new MutationObserver(function(){
    if (ready(modal)) {
      mo2.disconnect();
      ChronoFilter.init({
        root: modal,
        filtersSelector: FILTERS_SEL,
        listSelector: LIST_SEL,
        episodeSelector: '.episode',
        DEBUG: true
      });
    }
  });
  mo2.observe(modal, {childList:true, subtree:true});
})();
