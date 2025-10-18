document.addEventListener("DOMContentLoaded", () => {
    // Проверяем, что заголовок страницы начинается с "Гринготтс"
    if (!document.title.startsWith("Гринготтс")) return;

    const postForm = document.getElementById('post-form');
    const inputFirst = document.querySelector('#post-form input[id="fld10"]');

    if (postForm && (!inputFirst)) {
        postForm.style.display = 'none'; // Скрываем элемент
    }

    // Создаём .ams_info только для разрешённых пользователей
    const allowedUsers = (window.BANK_CHECK?.UserID) || [];
    const currentUser = Number(window.UserID);

    if (allowedUsers.length > 0 && allowedUsers.map(Number).includes(currentUser)) {
        let createdCount = 0;
        document.querySelectorAll('div.post').forEach((post) => {
            // Пропускаем topicpost
            if (post.classList.contains('topicpost')) return;

            const postContent = post.querySelector('.post-content');
            if (!postContent) return;

            // Проверяем, что нет тега bank_ams_done
            const hasAmsDone = postContent.querySelector('bank_ams_done');

            if (!hasAmsDone && !postContent.querySelector('.ams_info')) {
                const amsInfo = document.createElement('div');
                amsInfo.className = 'ams_info';
                postContent.appendChild(amsInfo);
                createdCount++;
            }
        });

        console.log(`[gringotts_page_update] .ams_info создано для UserID=${currentUser}: ${createdCount}`);
    } else {
        console.log(`[gringotts_page_update] UserID=${currentUser} не в списке allowedUsers=[${allowedUsers}], .ams_info не создаётся`);
    }

    // Проходим по всем контейнерам постов (асинхронно для поддержки MainUsrFieldResolver)
    document.querySelectorAll("div.post").forEach(async (container) => {
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
            const usr_id = (!profileUrl) ? 0 : Number(profileUrl.searchParams.get("id"));

            // Ищем K — число в теге <bank_data>
            const bankData = container.querySelector("bank_data");
            const ts = (!bankData) ? 0 : Number(bankData.textContent.trim());

            // Извлекаем comment_id из href ссылки редактирования
            // Формат: https://testfmvoice.rusff.me/edit.php?id=154
            let comment_id = 0;
            try {
                const editUrl = new URL(editLink.href);
                comment_id = Number(editUrl.searchParams.get("id")) || 0;
            } catch (e) {
                console.warn("Не удалось извлечь comment_id из href:", e);
            }

            // Извлекаем текущее значение денег из профиля (поле MoneyID)
            let current_bank = 0;
            try {
                const moneyFieldClass = `pa-fld${window.PROFILE_FIELDS?.MoneyID || 0}`;
                const moneyField = container.querySelector(`.${moneyFieldClass}`);

                if (moneyField) {
                    // Проверяем наличие комментария <!-- main: usrN -->
                    const walker = document.createTreeWalker(moneyField, NodeFilter.SHOW_COMMENT);
                    let hasMainComment = false;
                    const RE_MAIN = /^\s*main:\s*usr(\d+)\s*$/i;

                    for (let node; (node = walker.nextNode());) {
                        const match = (node.nodeValue || "").match(RE_MAIN);
                        if (match) {
                            hasMainComment = true;
                            // Если есть комментарий <!-- main: usrN -->, используем API для получения значения
                            if (window.MainUsrFieldResolver?.getFieldValue) {
                                try {
                                    const value = await window.MainUsrFieldResolver.getFieldValue({
                                        doc: document,
                                        fieldId: window.PROFILE_FIELDS?.MoneyID || 0
                                    });
                                    current_bank = Number(value) || 0;
                                } catch (err) {
                                    console.warn("Ошибка получения значения через MainUsrFieldResolver:", err);
                                    current_bank = 0;
                                }
                            }
                            break;
                        }
                    }

                    // Если нет комментария, берём текстовое значение из li (вне span)
                    if (!hasMainComment) {
                        // Ищем текст вне <span class="fld-name">
                        const fieldNameSpan = moneyField.querySelector('span.fld-name');
                        let textContent = moneyField.textContent || '';

                        if (fieldNameSpan) {
                            // Убираем текст из span.fld-name
                            textContent = textContent.replace(fieldNameSpan.textContent, '');
                        }

                        // Очищаем от пробелов и неразрывных пробелов
                        textContent = textContent.replace(/\u00A0/g, ' ').trim();

                        // Извлекаем число
                        const match = textContent.match(/-?\d+(?:\.\d+)?/);
                        if (match) {
                            current_bank = Number(match[0]) || 0;
                        }
                    }
                } else {
                    current_bank = 0;
                }
            } catch (e) {
                console.warn("Не удалось извлечь current_bank:", e);
            }

            // Заменяем поведение кнопки
            editLink.removeAttribute("href");
            editLink.removeAttribute("rel");
            editLink.setAttribute("onclick", `bankCommentEditFromBackup(${usr_id}, ${ts}, ${comment_id}, ${current_bank})`);
        } catch (e) {
            console.error("Ошибка при обработке контейнера:", e);
        }
    });

    // Отправляем событие в конце и устанавливаем флаг
    window.__gringotts_ready = true;
    window.dispatchEvent(new CustomEvent('gringotts:ready'));
    console.log('[gringotts_page_update] Событие gringotts:ready отправлено, флаг установлен');
});