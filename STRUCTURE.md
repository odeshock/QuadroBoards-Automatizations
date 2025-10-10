# 📁 Структура проекта QuadroBoards Automatizations

## 🎯 Обзор

Проект организован по модульному принципу с чёткой иерархией:

```
QuadroBoards-Automatizations/
├── src/                    # Исходный код (основная функциональность)
├── dist/                   # Собранные bundle файлы
├── utilities/              # Вспомогательные скрипты
└── docs/                   # Документация
```

---

## 📦 src/ - Исходный код

### src/core/ - Базовые модули
Основные утилиты, загружаемые в `<head>`:

| Файл | Описание |
|------|----------|
| `common.js` | FMV namespace, escapeHtml, парсеры characters, загрузчик пользователей |
| `helpers.js` | CP1251 утилиты, fetchHtml, сериализация форм, парсинг хронологии |
| `profile_from_user.js` | profileLink, getProfileNameById, резолвинг имён пользователей |
| `check_group.js` | Проверка групп доступа (getCurrentGroupId, ensureAllowed) |

### src/bank/ - Банковская система
ESM modules для банковских операций:

| Файл | Описание |
|------|----------|
| `parent.js` | Главный файл, импортирует все модули |
| `config.js` | Конфигурация системы |
| `constants.js` | Константы |
| `data.js` | Данные операций |
| `utils.js` | Утилиты |
| `templates.js` | HTML шаблоны |
| `components.js` | UI компоненты |
| `services.js` | Бизнес-логика |
| `app.js` | Главное приложение |

### src/profile/ - Профили пользователей

#### src/profile/loader/
| Файл | Описание |
|------|----------|
| `load_main_users_money.js` | Загрузка денежных полей из главного профиля |

#### src/profile/fields/
| Файл | Описание |
|------|----------|
| `bank_common.js` | Форматирование банковских операций, скрейпинг данных |

#### src/profile/ (корень)
| Файл | Описание |
|------|----------|
| `create_choice_panel.js` | Панель выбора |
| `skin_set_up.js` | Настройка скинов |
| `skin_change.js` | Смена скинов |
| `skin_data.js` | Данные скинов |
| `profile_runner.js` | Запуск профиля |
| `update_additional_fields.js` | Обновление дополнительных полей |
| `update_group.js` | Обновление группы |

### src/ui/ - UI компоненты

| Файл | Описание |
|------|----------|
| `code_copy.js` | Копирование кода из `.code-box` (jQuery) |
| `button.js` | Общие кнопки интерфейса |
| `ams_info.js` | Блоки AMS информации |

### src/comments/ - Комментарии

| Файл | Описание |
|------|----------|
| `replace.js` | Замена элементов в комментариях |
| `comment_to_skin.js` | Связь комментариев со скинами |
| `bank_last_comment.js` | Последний банковский комментарий |
| `post_last_comment.js` | Последний пост |

### src/chrono/ - Хронология

| Файл | Описание |
|------|----------|
| `parser.js` | Парсер хронологических данных |
| `helpers.js` | Вспомогательные функции |
| `button_update_total.js` | Кнопка обновления тотала |
| `button_total_to_excel.js` | Экспорт в Excel |
| `button_update_per_user.js` | Обновление по пользователю |
| `button_update_personal_page.js` | Обновление личной страницы |

### src/episodes/ - Эпизоды

| Файл | Описание |
|------|----------|
| `ui.js` | UI эпизодов |
| `edition.js` | Редактирование |
| `creation.js` | Создание |
| `tags_visibility.js` | Видимость тегов |

### src/private_pages/ - Приватные страницы

| Файл | Описание |
|------|----------|
| `collect_skin_n_chrono.js` | Загрузка скинов и хронологии |
| `chrono_filter.js` | Фильтрация хронологии |
| `create.js` | Создание приватных страниц |
| `edit.js` | Редактирование |
| `get_skin.js` | Получение скина |
| `admin_bridge.js` | Мост для администраторов |
| `chrono_info_parser.js` | Парсер хроно-информации |

### src/form/ - Формы

| Файл | Описание |
|------|----------|
| `create_personal_page.js` | Создание личной страницы |
| `update_personal_field.js` | Обновление личного поля |
| `update_group.js` | Обновление группы |
| `update_money_field.js` | Обновление денежного поля |

---

## 🎁 dist/ - Собранные bundle

| Файл | Размер | Описание |
|------|--------|----------|
| `head-bundle.js` | 61 KB | Полная версия HEAD bundle |
| `head-bundle.min.js` | 27 KB | Минифицированная HEAD bundle |
| `body-bundle.js` | 263 KB | Полная версия BODY bundle |
| `body-bundle.min.js` | 137 KB | Минифицированная BODY bundle |
| `build-head-bundle.sh` | - | Скрипт сборки HEAD bundle |
| `build-body-bundle.sh` | - | Скрипт сборки BODY bundle |
| `README.md` | - | Документация bundle файлов |

---

## 🛠️ utilities/ - Вспомогательные скрипты

### utilities/text/ - Текстовые утилиты

| Файл | Описание |
|------|----------|
| `hyphens_replacing.js` | Замена дефисов |
| `html_code_as_text.js` | HTML код как текст |
| `profile_fields_as_html.js` | Поля профиля как HTML |

### utilities/export/ - Экспорт данных

| Файл | Описание |
|------|----------|
| `eps_preserving.js` | Экспорт эпизодов в txt/html |

### utilities/modal/ - Модальные окна

| Файл | Описание |
|------|----------|
| `modal_content_replacement.js` | Замена контента в модалках |

### utilities/media/ - Медиа

| Файл | Описание |
|------|----------|
| `radio_player.js` | Радио-плейер с плейлистом |

### utilities/gamification/ - Геймификация

| Файл | Описание |
|------|----------|
| `dices.js` | Кости (игральные) |
| `hogwarts_course_calc.js` | Калькулятор курсов Хогвартса |

### utilities/contests/ - Конкурсы

| Файл | Описание |
|------|----------|
| `bingo_vynil.js` | Игра Bingo с винилом |

---

## 📚 Документация

| Файл | Описание |
|------|----------|
| `USAGE.md` | Руководство пользователя |
| `REFACTORING_REPORT.md` | Отчёт о рефакторинге |
| `STRUCTURE.md` | Этот файл - структура проекта |
| `dist/README.md` | Документация bundle файлов |

---

## 🔄 Порядок загрузки

### В `<head>`:
```html
<script src=".../dist/head-bundle.min.js"></script>
<script src=".../src/bank/parent.js"></script>
```

### В конце `</body>`:
```html
<script src=".../dist/body-bundle.min.js"></script>
```

---

## 📊 Статистика

| Категория | Количество |
|-----------|------------|
| Модулей в HEAD bundle | 6 |
| Модулей в BODY bundle | 34 |
| Утилит (отдельные скрипты) | 11 |
| Всего JS файлов | 60+ |

---

## 🎨 Правила организации

### src/ - Production код
- Код, который включается в bundle
- Критичная функциональность сайта
- Оптимизирован и минифицирован

### utilities/ - Вспомогательные скрипты
- Подключаются только при необходимости
- Специфичные функции (экспорт, геймификация)
- Не включаются в bundle

---

## 🔧 Разработка

### Добавить новый модуль в bundle:

1. Создать файл в `src/`
2. Отредактировать `dist/build-*-bundle.sh`
3. Пересобрать: `./dist/build-head-bundle.sh` или `./dist/build-body-bundle.sh`
4. Минифицировать: `npx terser dist/head-bundle.js -o dist/head-bundle.min.js -c -m`

### Добавить утилиту:

1. Создать файл в `utilities/`
2. Подключать напрямую: `<script src=".../utilities/...js"></script>`

---

**Последнее обновление**: 2025-10-10
**Версия**: 2.0.0 (после реорганизации)
