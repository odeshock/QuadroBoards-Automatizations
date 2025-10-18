document.addEventListener("DOMContentLoaded", () => {
    // Проверяем, что заголовок страницы начинается с "Гринготтс"
    if (!document.title.startsWith("Гринготтс")) return;

    const postForm = document.getElementById('post-form');
    const inputFirst = document.querySelector('#post-form input[id="fld10"]');

    if (postForm && (!inputFirst)) {
        postForm.style.display = 'none'; // Скрываем элемент
    }

    // Проходим по всем контейнерам постов
    document.querySelectorAll("div.post").forEach(container => {
        try {
            // Ищем кнопку "Редактировать"
            const editLink = container.querySelector(".pl-edit a");
            if (!editLink) return;

            // Проверяем, что внутри контейнера есть div.post, но не div.post.topicpost
            const post = container;
            if (!post || post.classList.contains("topicpost")) return;

            // Ищем ID профиля (N)
            const profileLink = container.querySelector('.pl-email.profile a');
            const profileUrl = (!profileLink) ? undefined : new URL(profileLink.href);
            const N = (!profileUrl) ? 0 : Number(profileUrl.searchParams.get("id"));

            // Ищем K — число в теге <bank_data>
            const bankData = container.querySelector("bank_data");
            const K = (!bankData) ? 0 : Number(bankData.textContent.trim());

            // Заменяем поведение кнопки
            editLink.removeAttribute("href");
            editLink.removeAttribute("rel");
            editLink.setAttribute("onclick", `bankCommentEditFromBackup(${N}, ${K})`);
        } catch (e) {
            console.error("Ошибка при обработке контейнера:", e);
        }
    });
});