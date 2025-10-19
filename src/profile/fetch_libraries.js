// fetch_libraries.js — Загрузка библиотек (плашки, иконки, фон, подарки, купоны)

/**
 * Загружает все библиотеки из window.SKIN
 * @returns {Promise<Object>} { plashka: [], icon: [], back: [], gift: [], coupon: [] }
 */
async function fetchAllLibraries() {
  const SKIN = window.SKIN;

  // Проверка наличия SKIN
  if (!SKIN) {
    console.warn('[fetchAllLibraries] window.SKIN не найден');
    return {
      plashka: [],
      icon: [],
      back: [],
      gift: [],
      coupon: []
    };
  }

  // Проверка наличия fetchCardsWrappedClean
  if (typeof fetchCardsWrappedClean !== 'function') {
    console.error('[fetchAllLibraries] fetchCardsWrappedClean не найдена');
    return {
      plashka: [],
      icon: [],
      back: [],
      gift: [],
      coupon: []
    };
  }

  // Загружаем все библиотеки параллельно
  let [libPlashka, libIcon, libBack, libGift, libCoupon] = await Promise.all([
    fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryPlashkaPostID),
    fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryIconPostID),
    fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryBackPostID),
    fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryGiftPostID),
    fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryCouponPostID, { isCoupon: true })
  ]);

  // Подстраховка от null/undefined
  libPlashka = Array.isArray(libPlashka) ? libPlashka : [];
  libIcon    = Array.isArray(libIcon)    ? libIcon    : [];
  libBack    = Array.isArray(libBack)    ? libBack    : [];
  libGift    = Array.isArray(libGift)    ? libGift    : [];
  libCoupon  = Array.isArray(libCoupon)  ? libCoupon  : [];

  return {
    plashka: libPlashka,
    icon: libIcon,
    back: libBack,
    gift: libGift,
    coupon: libCoupon
  };
}

// Экспортируем в window
window.fetchAllLibraries = fetchAllLibraries;
