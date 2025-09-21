const icons_set = [
 `<img src="https://static.thenounproject.com/png/2185221-200.png">`,
 `<img src="https://cdn2.iconfinder.com/data/icons/harry-potter-colour-collection/60/07_-_Harry_Potter_-_Colour_-_Golden_Snitch-512.png">`,
 `<img src="https://i.pinimg.com/474x/c2/72/cb/c272cbe4f31c5a8d96f8b95256924e95.jpg">`,
];

const plashka_set = [
  `<a class="modal-link">
   <img src="https://upforme.ru/uploads/001c/14/5b/440/247944.gif" class="plashka">
   <wrds>я не подарок, но и ты не шаверма</wrds></a>`,
  `<a class="modal-link">
   <img src="https://upforme.ru/uploads/001c/14/5b/440/561829.gif" class="plashka">
   <wrds>twinkle twinkle little star</wrds></a>`
];


applyImagePicker(icons_set, '5',
 {
   btnWidth: 44
});
applyImagePicker(plashka_set, '3',
  {
    btnWidth: 229,    // ширина кнопки
    btnHeight: 42, // высота кнопки
    modalLinkMode: true, 
  });
