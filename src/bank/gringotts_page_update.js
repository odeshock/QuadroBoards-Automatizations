document.addEventListener("DOMContentLoaded", () => {
    // Проверяем, что заголовок страницы начинается с "Гринготтс"
    if (!document.title.startsWith("Гринготтс")) return;

    // Проверяем, что URL не содержит "/edit.php?"
    if (window.location.href.includes("/edit.php?")) return;

    const postForm = document.getElementById('post-form');
    const inputFirst = document.querySelector('#post-form input[id="fld10"]');

    if (postForm && (!inputFirst)) {
        postForm.style.display = 'none'; // Скрываем элемент
    }
});