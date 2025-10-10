# 📖 Руководство по использованию QuadroBoards Automatizations

## 🎯 Быстрый старт

### Минимальная установка (2 файла)

Добавьте в HTML вашего форума:

```html
<!DOCTYPE html>
<html>
<head>
    <!-- 1. HEAD BUNDLE - базовые утилиты -->
    <script src="https://odeshock.github.io/QuadroBoards-Automatizations/dist/head-bundle.min.js"></script>

    <!-- 2. Банковская система (если нужна) -->
    <script src="https://odeshock.github.io/QuadroBoards-Automatizations/src/src/bank/parent.js"></script>
</head>
<body>
    <!-- Ваш контент -->

    <!-- 3. BODY BUNDLE - UI и DOM-зависимые модули -->
    <script src="https://odeshock.github.io/QuadroBoards-Automatizations/dist/body-bundle.min.js"></script>
</body>
</html>
```

**Готово!** Все функции автоматически инициализируются.

---

## 📦 Что включено

### HEAD Bundle (28 KB минифицированный)
- ✅ Работа с кодировкой CP1251
- ✅ Резолвинг имён пользователей
- ✅ Парсинг хронологических тегов
- ✅ Сериализация форм
- ✅ Проверка групп доступа
- ✅ Утилиты для профилей

### BODY Bundle (137 KB минифицированный)
- ✅ Копирование кода из блоков
- ✅ Управление скинами персонажей
- ✅ Хронология и эпизоды
- ✅ Приватные страницы персонажей
- ✅ Формы создания/редактирования
- ✅ Экспорт в Excel
- ✅ И многое другое...

---

## ⚙️ Настройка

### Обязательная конфигурация

Добавьте перед загрузкой HEAD bundle:

```html
<script>
// ID поля с деньгами в профиле
window.PROFILE_FIELDS = {
    MoneyID: 6
};
</script>
```

### Опциональная конфигурация

```html
<script>
// Список удалённых профилей (опционально)
window.EX_PROFILES = {
    topicID: 123,
    commentID: 456
};

// Проверка доступа для профилей
window.PROFILE_CHECK = {
    GroupID: [1, 2, 3],        // ID групп с доступом
    ForumID: [10, 20, 30]      // ID форумов
};

// Проверка доступа для хронологии
window.CHRONO_CHECK = {
    GroupID: [1, 2, 3],
    ForumID: [10, 20, 30],
    AmsForumID: [40, 50]
};

// Отключить ссылки на имена (опционально)
window.MAKE_NAMES_LINKS = false;
</script>
```

---

## 🎨 Примеры использования

### 1. Получить имя пользователя по ID

```javascript
// Асинхронно
const name = await window.getProfileNameById(123);
console.log(name); // "Имя Пользователя"

// Или с HTML ссылкой
const link = window.profileLink(123, "Имя Пользователя");
console.log(link); // '<a href="/profile.php?id=123">Имя Пользователя</a>'
```

### 2. Парсить хронологические теги

```javascript
const tags = document.querySelector('.chrono-tags');
const data = window.parseChronoTagsRaw(tags);
console.log(data);
// {
//   participantsLower: ['user5', 'user6'],
//   masks: { 'user5': 'Маска1' },
//   location: 'Локация',
//   order: '5'
// }
```

### 3. Экранировать HTML

```javascript
const safe = FMV.escapeHtml('<script>alert("xss")</script>');
console.log(safe); // '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
```

### 4. Загрузить HTML с CP1251

```javascript
const html = await fetchHtml('/some-page.php');
console.log(html); // Правильно декодированный HTML
```

### 5. Сериализовать форму в CP1251

```javascript
const form = document.querySelector('form');
const data = serializeFormCP1251_SelectSubmit(form, 'save');
// Готово для отправки на форум с CP1251
```

### 6. Загрузить список всех пользователей

```javascript
// Используя jQuery Deferred
FMV.fetchUsers().then(users => {
    console.log(users);
    // [{ id: 1, code: 'user1', name: 'Имя' }, ...]
});

// С опциями
FMV.fetchUsers({
    force: true,       // Игнорировать кэш
    maxPages: 100,     // Максимум страниц
    batchSize: 10      // Параллельная загрузка
}).then(users => {
    console.table(users);
});
```

---

## 🔧 Банковская система

Банковская система использует ES modules и загружается отдельно:

```html
<script src=".../src/bank/parent.js"></script>
```

Она подгружает остальные модули автоматически:
- `config.js` - конфигурация
- `constants.js` - константы
- `data.js` - данные операций
- `utils.js` - утилиты
- `templates.js` - шаблоны
- `components.js` - компоненты UI
- `services.js` - бизнес-логика
- `app.js` - главный файл

---

## 🎯 Автоматические возможности

После загрузки bundle файлов автоматически работают:

### 1. Копирование кода
Все блоки `.code-box` получают кнопку "Скопировать код"

### 2. Загрузка скинов персонажей
Автоматически подгружаются скины при открытии профиля

### 3. Фильтрация хронологии
В модальных окнах с хронологией появляются фильтры

### 4. Валидация форм
Формы персонажей автоматически валидируются

### 5. AMS блоки
В разрешённых форумах появляется `.ams_info` блок

---

## 🐛 Отладка

### Проверить загрузку

```javascript
// В консоли браузера (F12)
console.log(window.FMV);        // Должен быть объект
console.log(window.profileLink); // Должна быть функция
console.log(window.ChronoFilter); // Должен быть объект
```

### Использовать не минифицированные версии

Для отладки замените `.min.js` на `.js`:

```html
<script src=".../head-bundle.js"></script>     <!-- Вместо .min.js -->
<script src=".../body-bundle.js"></script>     <!-- Вместо .min.js -->
```

### Включить логи

```javascript
// Перед загрузкой bundle
window.DEBUG_MODE = true;
```

---

## 📊 Производительность

| Метрика | Значение |
|---------|----------|
| HEAD bundle (min) | 28 KB (~10 KB gzip) |
| BODY bundle (min) | 137 KB (~35 KB gzip) |
| Загрузка HEAD | < 50ms |
| Загрузка BODY | < 150ms |
| Инициализация | < 100ms |

---

## 🔄 Обновление

Чтобы получить последнюю версию:

1. Замените URL в HTML на новую версию
2. Очистите кэш браузера (Ctrl+Shift+R)
3. Проверьте консоль на ошибки

### Версионирование

```html
<!-- С версией в URL -->
<script src=".../head-bundle.min.js?v=1.0.0"></script>
<script src=".../body-bundle.min.js?v=1.0.0"></script>
```

---

## ❓ FAQ

### Q: Нужен ли jQuery?
**A:** Да, для некоторых модулей (например, `html_code_copy.js`, `FMV.fetchUsers`)

### Q: Поддерживает ли IE11?
**A:** Нет, требуется современный браузер с поддержкой ES6+

### Q: Можно ли использовать только часть функций?
**A:** Да, вы можете подключать отдельные файлы из папки `src/`, но bundle удобнее

### Q: Как добавить свои модули?
**A:** Отредактируйте `dist/build-body-bundle.sh` и пересоберите bundle

### Q: Можно ли использовать с другими форумными движками?
**A:** Код заточен под PunBB, но можно адаптировать

---

## 📞 Поддержка

- **GitHub Issues**: [создать issue](https://github.com/odeshock/QuadroBoards-Automatizations/issues)
- **Документация**: `/dist/README.md`
- **Примеры**: Смотрите исходный код в `src/`

---

## 📄 Лицензия

MIT License - свободно используйте в своих проектах

---

**Последнее обновление**: 2025-10-10
**Версия**: 1.0.0
