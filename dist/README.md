# QuadroBoards Automatizations - Bundle Documentation

## 📦 Собранные файлы

В этой директории находятся собранные и минифицированные версии всех модулей проекта.

### Файлы

| Файл | Размер | Описание |
|------|--------|----------|
| `head-bundle.js` | 62 KB | Полная версия HEAD bundle с комментариями |
| `head-bundle.min.js` | 28 KB | Минифицированная версия HEAD bundle |
| `body-bundle.js` | 265 KB | Полная версия BODY bundle с комментариями |
| `body-bundle.min.js` | 137 KB | Минифицированная версия BODY bundle |

## 🚀 Использование

### В HTML (рекомендуется минифицированные версии)

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Ваш сайт</title>

    <!-- HEAD BUNDLE - загружается первым -->
    <script type="text/javascript" src="https://odeshock.github.io/QuadroBoards-Automatizations/dist/head-bundle.min.js"></script>

    <!-- Банковская система (отдельно, т.к. использует ESM modules) -->
    <script type="text/javascript" src="https://odeshock.github.io/QuadroBoards-Automatizations/additional_functional/bank/parent.js"></script>
</head>
<body>
    <!-- Ваш контент -->

    <!-- BODY BUNDLE - загружается в конце -->
    <script type="text/javascript" src="https://odeshock.github.io/QuadroBoards-Automatizations/dist/body-bundle.min.js"></script>
</body>
</html>
```

### Для разработки (с комментариями)

Если вы разрабатываете или отлаживаете код, используйте полные версии:

```html
<head>
    <script src="https://odeshock.github.io/QuadroBoards-Automatizations/dist/head-bundle.js"></script>
</head>
<body>
    <!-- ... -->
    <script src="https://odeshock.github.io/QuadroBoards-Automatizations/dist/body-bundle.js"></script>
</body>
```

## 📋 Содержимое bundle файлов

### HEAD BUNDLE (head-bundle.js)

Базовые утилиты и функции, которые должны быть доступны до загрузки DOM:

1. **common.js** - FMV namespace, базовые утилиты
   - `FMV.escapeHtml()` - экранирование HTML
   - `FMV.normSpace()` - нормализация пробелов
   - `FMV.parseCharactersUnified()` - парсинг characters
   - `FMV.parseOrderStrict()` - проверка поля order
   - `FMV.fetchUsers()` - загрузка списка пользователей
   - `FMV.invalidateUsersCache()` - инвалидация кэша

2. **helpers.js** - CP1251 утилиты, fetchHtml, сериализация форм
   - `encodeURIcp1251()` - кодирование в CP1251
   - `serializeFormCP1251()` - сериализация форм
   - `fetchHtml()` - загрузка HTML с автодетекцией кодировки
   - `fetchCP1251Doc()` - загрузка документа в CP1251
   - `parseChronoTagsRaw()` - парсинг хроно-тегов
   - `resolveChronoData()` - резолвинг имён в хроно-данных

3. **profile_from_user.js** - profileLink, резолвинг имён пользователей
   - `window.profileLink()` - генерация ссылки на профиль
   - `window.profileLinkMeta()` - мета-информация о ссылке
   - `window.profileLinkByIdAsync()` - асинхронная генерация ссылки
   - `window.getProfileNameById()` - получение имени по ID

4. **check_group.js** - проверка групп пользователей
   - `getCurrentGroupId()` - получить текущую группу
   - `ensureAllowed()` - проверить разрешение

5. **load_main_users_money.js** - резолвер денежных полей
   - `window.MainUsrFieldResolver.getFieldValue()` - получение значения поля

6. **bank_common.js** - форматирование банковских операций
   - `scrapeUsers()` - сбор пользователей
   - `fetchProfileInfo()` - информация о профиле
   - `scrapePosts()` - сбор постов
   - `scrapeTopicFirstPostLinks()` - ссылки на первые посты тем

### BODY BUNDLE (body-bundle.js)

DOM-зависимые модули и UI компоненты:

#### Группа 1: UI компоненты
- **html_code_copy.js** - копирование кода из `.code-box`
- **button.js** - общие кнопки интерфейса
- **ams_info.js** - блоки AMS информации

#### Группа 2: Профили и приватные страницы
- **collect_skin_n_chrono.js** - загрузка скинов и хронологии
- **chrono_filter.js** - фильтрация хронологии
- **create.js** - создание приватных страниц
- **edit.js** - редактирование приватных страниц
- **get_skin.js** - получение скина
- **admin_bridge.js** - мост для администраторов
- **chrono_info_parser.js** - парсер хроно-информации

#### Группа 3: Формы
- **create_personal_page.js** - создание личной страницы
- **update_personal_field.js** - обновление личного поля
- **update_group.js** - обновление группы
- **update_money_field.js** - обновление денежного поля

#### Группа 4: Профиль и скины
- **create_choice_panel.js** - панель выбора
- **skin_set_up.js** - настройка скинов
- **skin_change.js** - смена скинов
- **skin_data.js** - данные скинов
- **profile_runner.js** - запуск профиля
- **update_additional_fields.js** - обновление дополнительных полей
- **update_group.js** - обновление группы

#### Группа 5: Хронология
- **replace.js** - замена элементов в комментариях
- **comment_to_skin.js** - связь комментариев со скинами
- **parser.js** - парсер хронологии
- **helpers.js** - вспомогательные функции хронологии
- **button_update_total.js** - кнопка обновления тотала
- **button_total_to_excel.js** - экспорт в Excel
- **button_update_per_user.js** - обновление по пользователю
- **button_update_personal_page.js** - обновление личной страницы

#### Группа 6: Эпизоды
- **ui.js** - UI эпизодов с автоподключением для создания/редактирования
- **tags_visibility.js** - видимость тегов

#### Группа 7: Последние комментарии
- **bank_last_comment.js** - последний банковский комментарий
- **post_last_comment.js** - последний пост

## 🔧 Пересборка

Если вам нужно пересобрать bundle файлы после изменений:

```bash
# Из корневой директории проекта
cd dist

# Пересобрать body-bundle.js
./build-body-bundle.sh

# Минифицировать оба bundle
npx terser head-bundle.js -o head-bundle.min.js -c -m
npx terser body-bundle.js -o body-bundle.min.js -c -m
```

## ⚠️ Важные замечания

1. **Порядок загрузки**: HEAD bundle ВСЕГДА должен загружаться перед BODY bundle
2. **jQuery**: Некоторые модули требуют jQuery (например, `html_code_copy.js`)
3. **Банковская система**: Остаётся отдельным файлом `bank/parent.js` из-за использования ES modules
4. **Кодировка**: Все файлы используют UTF-8, но поддерживают работу с CP1251
5. **Глобальные переменные**: Код создаёт глобальный namespace `window.FMV`

## 📝 Конфигурация

Некоторые модули требуют глобальной конфигурации:

```html
<script>
// Настройка перед загрузкой HEAD bundle
window.PROFILE_FIELDS = {
    MoneyID: 6  // ID поля с деньгами
};

window.EX_PROFILES = {
    topicID: 123,     // ID темы с удалёнными профилями
    commentID: 456    // ID комментария
};

window.PROFILE_CHECK = {
    GroupID: [1, 2, 3],    // Разрешённые группы
    ForumID: [10, 20, 30]  // Разрешённые форумы
};

window.CHRONO_CHECK = {
    GroupID: [1, 2, 3],
    ForumID: [10, 20, 30],
    AmsForumID: [40, 50]
};
</script>

<script src=".../head-bundle.min.js"></script>
```

## 🐛 Отладка

Если что-то не работает:

1. Откройте консоль браузера (F12)
2. Проверьте, что `window.FMV` определён
3. Проверьте порядок загрузки скриптов
4. Используйте полные (не минифицированные) версии для отладки
5. Проверьте, что все необходимые глобальные переменные установлены

## 📊 Статистика

- **Всего модулей в HEAD**: 6 файлов
- **Всего модулей в BODY**: 34 файла
- **Сжатие**: ~48% (с минификацией)
- **Совместимость**: ES6+ (современные браузеры)

## 🔗 Ссылки

- [GitHub Repository](https://github.com/odeshock/QuadroBoards-Automatizations)
- [Исходные файлы](../additional_functional/)
- [История изменений](../CHANGELOG.md)

---

**Версия**: 1.0.0
**Дата**: 2025-10-10
**Автор**: QuadroBoards Team
