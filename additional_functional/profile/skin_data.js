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
  const { icons, plashki, backs } = await collectSkinSets();

  // Плашка
  if (window.SKIN?.PlashkaFieldID) {
    applyImagePicker(plashki, SKIN.PlashkaFieldID, {
      btnWidth: 229,
      btnHeight: 42,
      modalLinkMode: true,
    });
  }

  // Фон
  if (window.SKIN?.BackFieldID) {
    applyImagePicker(backs, SKIN.BackFieldID, {
      btnWidth: 229,
      btnHeight: 42,
      modalLinkMode: true,
    });
  }

  // Иконка
  if (window.SKIN?.IconFieldID) {
    applyImagePicker(icons, SKIN.IconFieldID, {
      btnWidth: 44,
    });
  }
})();
