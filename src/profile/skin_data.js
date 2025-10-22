// const icon_set = [
//  `<img class="icon" src="https://static.thenounproject.com/png/2185221-200.png">`,
//  `<img class="icon" src="https://cdn2.iconfinder.com/data/icons/harry-potter-colour-collection/60/07_-_Harry_Potter_-_Colour_-_Golden_Snitch-512.png">`,
//  `<img class="icon" src="https://i.pinimg.com/474x/c2/72/cb/c272cbe4f31c5a8d96f8b95256924e95.jpg">`,
// ];

// const plashka_set = [
//   `<a class="modal-link">
//    <img src="https://upforme.ru/uploads/001c/14/5b/440/247944.gif" class="plashka">
//    <wrds>я не подарок, но и ты не шаверма</wrds></a>`,
//   `<a class="modal-link">
//    <img src="https://upforme.ru/uploads/001c/14/5b/440/561829.gif" class="plashka">
//    <wrds>twinkle twinkle little star</wrds></a>`
// ];

// const back_set = [
//  `<img class="back" src="https://upforme.ru/uploads/001c/14/5b/440/238270.gif">`,
//  `<img class="back" src="https://forumstatic.ru/files/001c/83/91/88621.png">`,
// ];

(async () => {
  console.log('[skin_data] Начало загрузки данных скинов');
  console.log('[skin_data] window.SKIN:', window.SKIN);

  const result = await collectSkinSets();
  console.log('[skin_data] collectSkinSets вернул:', result);

  const icons = result?.icons || [];
  const plashki = result?.plashki || [];
  const backs = result?.backs || [];

  console.log('[skin_data] icons:', icons.length, 'plashki:', plashki.length, 'backs:', backs.length);

  // Плашка
  if (window.SKIN?.PlashkaFieldID) {
    console.log('[skin_data] Применяем плашку, fieldID:', window.SKIN.PlashkaFieldID);
    applyImagePicker(plashki, SKIN.PlashkaFieldID, {
      btnWidth: 229,
      btnHeight: 42,
      modalLinkMode: true,
    });
  } else {
    console.log('[skin_data] PlashkaFieldID не найден');
  }

  // Фон
  if (window.SKIN?.BackFieldID) {
    console.log('[skin_data] Применяем фон, fieldID:', window.SKIN.BackFieldID);
    applyImagePicker(backs, SKIN.BackFieldID, {
      btnWidth: 229,
      btnHeight: 42,
      modalLinkMode: true,
    });
  } else {
    console.log('[skin_data] BackFieldID не найден');
  }

  // Иконка
  if (window.SKIN?.IconFieldID) {
    console.log('[skin_data] Применяем иконку, fieldID:', window.SKIN.IconFieldID);
    applyImagePicker(icons, SKIN.IconFieldID, {
      btnWidth: 44,
    });
  } else {
    console.log('[skin_data] IconFieldID не найден');
  }

  console.log('[skin_data] Завершено');
})();
