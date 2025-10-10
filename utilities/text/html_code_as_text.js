$().pun_mainReady(function () {
  $('.host-code .code-box pre').each(function () {
    // Если внутри есть реальные элементы/теги — превращаем в текст
    if (this.children.length || /<[^>]+>/.test(this.innerHTML)) {
      this.textContent = this.innerHTML;
    }
  });
});
