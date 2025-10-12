# Формат JSON операций банка

При нажатии на кнопку "Купить" система собирает всю информацию об операциях и отправляет её в формате JSON.

## Структура отправляемых данных

```json
{
  "type": "PURCHASE",
  "operations": [...],     // Старый формат (для совместимости)
  "fullData": [...],       // Полный формат с данными форм
  "environment": {...},    // Переменные окружения
  "totalSum": 0            // Общая сумма
}
```

---

## 1. Environment (Переменные окружения)

Содержит все глобальные переменные, используемые системой банка.

### Структура

```json
{
  "USER_ID": "123",
  "USER_NAME": "Имя Пользователя",
  "IS_ADMIN": true,
  "USERS_LIST": [
    {
      "id": "123",
      "name": "Имя Пользователя"
    }
  ],
  "PERSONAL_POSTS": [
    {
      "src": "https://...",
      "text": "Название поста",
      "symbols_num": 1500
    }
  ],
  "PLOT_POSTS": [...],
  "ADS_POSTS": [...],
  "FIRST_POST_FLAG": false,
  "FIRST_POST_MISSED_FLAG": false,
  "BANNER_RENO_FLAG": false,
  "BANNER_MAYAK_FLAG": false,
  "ALLOWED_PARENTS": ["https://example.com"],
  "BASE_URL": "https://example.com"
}
```

### Описание полей

| Поле | Тип | Описание |
|------|-----|----------|
| `USER_ID` | string | ID текущего пользователя |
| `USER_NAME` | string | Имя текущего пользователя |
| `IS_ADMIN` | boolean | Является ли пользователь администратором |
| `USERS_LIST` | array | Список всех пользователей форума |
| `PERSONAL_POSTS` | array | Список личных постов пользователя |
| `PLOT_POSTS` | array | Список сюжетных постов пользователя |
| `ADS_POSTS` | array | Список рекламных постов |
| `FIRST_POST_FLAG` | boolean | Флаг получения первого поста |
| `FIRST_POST_MISSED_FLAG` | boolean | Флаг пропущенного первого поста |
| `BANNER_RENO_FLAG` | boolean | Флаг баннера на Рено |
| `BANNER_MAYAK_FLAG` | boolean | Флаг баннера на Маяке |
| `ALLOWED_PARENTS` | array | Разрешённые родительские домены |
| `BASE_URL` | string | Базовый URL форума |

---

## 2. Full Data (Полные данные операций)

Массив всех операций с полной информацией из форм.

### Общая структура операции

```json
{
  "title": "Название операции",
  "form_id": "form-income-plotpost",
  "type": "operation",
  "entries": [...],
  "price": 8,
  "bonus": 9,
  "amountLabel": "Сумма"
}
```

### Поля операции

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | string | Название операции |
| `form_id` | string | ID формы (без #) |
| `type` | string | Тип: `"operation"`, `"discount"`, `"adjustment"` |
| `entries` | array | Массив записей в операции |
| `price` | number | Базовая цена за единицу |
| `bonus` | number | Бонус за единицу |
| `amountLabel` | string | Название поля суммы |

### Структура записи (entry)

```json
{
  "key": "form-income-plotpost_1",
  "data": {
    "plot_posts_json": "[...]",
    // другие поля формы
  },
  "multiplier": 3,
  "discount_amount": 10,
  "adjustment_amount": 20,
  "calculation": "(+ 20)"
}
```

---

## 3. Типы операций и их JSON

### 3.1. Операции с постами (Личные/Сюжетные)

**Формы:** `form-income-personalpost`, `form-income-plotpost`

```json
{
  "title": "Каждый сюжетный пост",
  "form_id": "form-income-plotpost",
  "type": "operation",
  "entries": [
    {
      "key": "form-income-plotpost_1",
      "data": {
        "plot_posts_json": "[{\"src\":\"https://...\",\"text\":\"Пост 1\",\"symbols_num\":1500}]"
      },
      "multiplier": 1
    }
  ],
  "price": 8,
  "bonus": 9,
  "amountLabel": "Сумма"
}
```

**Особенности:**
- `data.plot_posts_json` или `data.personal_posts_json` — JSON-строка с массивом постов
- Каждый пост содержит: `src`, `text`, `symbols_num`
- Учитываются только посты с `symbols_num >= MIN_PLOT_POST_SYMBOLS` (50) для сюжетных
- Учитываются только посты с `symbols_num >= MIN_PERSONAL_POST_SYMBOLS` (0) для личных

---

### 3.2. Подарки

**Формы:** `form-gift-present`, `form-icon-present`, `form-badge-present`, `form-bg-present`, `form-gift-custom`

```json
{
  "title": "Подарок из коллекции (#3)",
  "form_id": "form-gift-present",
  "type": "operation",
  "entries": [
    {
      "key": "form-gift-present_gift-3_1",
      "data": {
        "recipient_1": "456",
        "from_1": "От тайного поклонника",
        "wish_1": "С наилучшими пожеланиями!",
        "gift_id_1": "3",
        "gift_icon_1": "<i class='fas fa-gift'></i>"
      },
      "multiplier": 1
    }
  ],
  "price": 10,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

**Поля данных:**
- `recipient_N` — ID получателя
- `from_N` — От кого подарок
- `wish_N` — Комментарий/пожелание
- `gift_id_N` — ID подарка из коллекции
- `gift_icon_N` — HTML иконки подарка
- `gift_data_N` — Дополнительные данные (для кастомных подарков)

---

### 3.3. Расходы с получателями (Бонусы/Маски/Билеты)

**Формы:** `form-exp-bonus*`, `form-exp-mask`, `form-exp-clean`

```json
{
  "title": "Бонус на 1 день × 1",
  "form_id": "form-exp-bonus1d1",
  "type": "operation",
  "entries": [
    {
      "key": "form-exp-bonus1d1_1",
      "data": {
        "recipient_1": "123",
        "quantity_1": "2",
        "from_1": "",
        "wish_1": ""
      },
      "multiplier": 1
    }
  ],
  "price": 5,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

**Особенности:**
- `recipient_N` — ID получателя
- `quantity_N` — Количество
- Если получатель = текущий пользователь, поля `from_N` и `wish_N` скрыты и пусты

---

### 3.4. Выкупы лица/персонажа

**Формы:** `form-exp-face-*`, `form-exp-char-*`, `form-exp-face-own-*`

```json
{
  "title": "Выкуп лица на 1 месяц",
  "form_id": "form-exp-face-1m",
  "type": "operation",
  "entries": [
    {
      "key": "form-exp-face-1m_1",
      "data": {
        "face": "Имя Актёра",
        "char": "Имя Персонажа"
      },
      "multiplier": 1
    }
  ],
  "price": 15,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

**Поля данных:**
- `face` — Имя актёра/лица
- `char` — Имя персонажа

---

### 3.5. Переводы средств

**Форма:** `form-exp-transfer`

```json
{
  "title": "Перевод средств другому игроку",
  "form_id": "form-exp-transfer",
  "type": "operation",
  "entries": [
    {
      "key": "form-exp-transfer_1",
      "data": {
        "recipient_1": "789",
        "amount_1": "100",
        "from_1": "Имя отправителя",
        "wish_1": "Комментарий"
      },
      "multiplier": 1
    }
  ],
  "price": 0,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

**Особенности:**
- `amount_N` — Сумма перевода
- Автоматически добавляется комиссия 10%

---

### 3.6. Админские начисления (с указанием суммы)

**Формы:** `form-income-topup`, `form-income-ams`

```json
{
  "title": "Докупить кредиты",
  "form_id": "form-income-topup",
  "type": "operation",
  "entries": [
    {
      "key": "form-income-topup_1",
      "data": {
        "recipient_1": "123",
        "amount_1": "500",
        "wish_1": "Причина начисления"
      },
      "multiplier": 1
    }
  ],
  "price": 0,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

**Поля данных:**
- `recipient_N` — ID получателя
- `amount_N` — Сумма начисления
- `wish_1` — Комментарий (обязателен для AMS)

---

### 3.7. Админские начисления (фиксированная сумма)

**Формы:** `form-income-anketa`, `form-income-akcion`, `form-income-needchar`, и др.

```json
{
  "title": "Принятие анкеты",
  "form_id": "form-income-anketa",
  "type": "operation",
  "entries": [
    {
      "key": "form-income-anketa_1",
      "data": {
        "recipient_1": "123",
        "recipient_2": "456"
      },
      "multiplier": 2
    }
  ],
  "price": 1,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

**Особенности:**
- Может быть несколько получателей (`recipient_1`, `recipient_2`, ...)
- `multiplier` равен количеству получателей

---

### 3.8. Баннеры

**Формы:** `form-income-banner-reno`, `form-income-banner-mayak`

```json
{
  "title": "Баннер на Рено",
  "form_id": "form-income-banner-reno",
  "type": "operation",
  "entries": [
    {
      "key": "form-income-banner-reno_1",
      "data": {
        "link": "https://..."
      },
      "multiplier": 1
    }
  ],
  "price": 20,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

**Особенности:**
- Начисление возможно только один раз (проверяется через `BANNER_*_FLAG`)

---

### 3.9. Рекламный флаер

**Форма:** `form-income-flyer`

```json
{
  "title": "Рекламный флаер",
  "form_id": "form-income-flyer",
  "type": "operation",
  "entries": [
    {
      "key": "form-income-flyer_1",
      "data": {
        "ads_posts_json": "[{\"src\":\"https://...\",\"text\":\"Пост 1\",\"symbols_num\":100}]"
      },
      "multiplier": 1
    }
  ],
  "price": 5,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

---

### 3.10. RPG-топ

**Форма:** `form-income-rpgtop`

```json
{
  "title": "Голосование за проект на rpg-top",
  "form_id": "form-income-rpgtop",
  "type": "operation",
  "entries": [
    {
      "key": "form-income-rpgtop_1",
      "data": {
        "need": "https://..."
      },
      "multiplier": 1
    }
  ],
  "price": 1,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

**Особенности:**
- Учитываются голоса раз в неделю
- `need` — ссылка на скриншот голосования

---

### 3.11. Прочие операции (дизайн, конкурсы, и т.д.)

**Формы:** `form-income-design-other`, `form-income-contest`, `form-income-run-contest`, и др.

```json
{
  "title": "Прочий дизайн",
  "form_id": "form-income-design-other",
  "type": "operation",
  "entries": [
    {
      "key": "form-income-design-other_1",
      "data": {
        "description": "Описание работы",
        "link": "https://..."
      },
      "multiplier": 1
    }
  ],
  "price": 10,
  "bonus": 0,
  "amountLabel": "Сумма"
}
```

---

## 4. Автоматические корректировки цен (Adjustments)

Применяются к операциям с количественными показателями (например, подарки).

```json
{
  "title": "Пересчёт за 5 подарков из коллекции",
  "form_id": "price-adjustment",
  "type": "adjustment",
  "entries": [
    {
      "key": "price-adjustment_gift-collection-5-discount",
      "data": {
        "form": "#form-gift-present",
        "batch_size": 5,
        "new_price": 45,
        "adjustment_amount": 20,
        "calculation": "(+ 20)"
      },
      "multiplier": 1
    }
  ],
  "price": 0,
  "bonus": 0,
  "amountLabel": "Корректировка"
}
```

**Формула корректировки:**
```
oldPrice × (itemCount ÷ batchSize) × batchSize - newPrice × (itemCount ÷ batchSize)
```

**Особенности:**
- Применяется только если `itemCount >= batchSize`
- Корректировка не может превышать сумму операции
- Отображается как доход (зелёная, с +)

---

## 5. Автоматические скидки (Discounts)

Применяются к операциям автоматически по настроенным правилам.

```json
{
  "title": "75% скидка на подарки из коллекции",
  "form_id": "automatic-discount",
  "type": "discount",
  "entries": [
    {
      "key": "automatic-discount_gift-collection-discount",
      "data": {
        "form": "#form-gift-present",
        "discount_type": "percent",
        "discount_value": 75,
        "discount_amount": 135,
        "calculation": "(+ 135)"
      },
      "multiplier": 1
    }
  ],
  "price": 0,
  "bonus": 0,
  "amountLabel": "Скидка"
}
```

**Типы скидок:**
- `"percent"` — процентная скидка (значение от 0 до 100)
- `"fixed"` — фиксированная скидка

**Особенности:**
- Скидки считаются от суммы с учётом корректировок
- Если `type === "percent"` и `value > 100`, значение приводится к 100
- Скидка на конкретные операции не может превышать сумму этих операций
- Общая сумма скидок не может превышать итоговую сумму всех операций
- При превышении все скидки пропорционально уменьшаются

---

## 6. Пример полного JSON

```json
{
  "type": "PURCHASE",
  "totalSum": 150,
  "environment": {
    "USER_ID": "123",
    "USER_NAME": "Игрок",
    "IS_ADMIN": false
  },
  "fullData": [
    {
      "title": "Каждый сюжетный пост",
      "form_id": "form-income-plotpost",
      "type": "operation",
      "entries": [
        {
          "key": "form-income-plotpost_1",
          "data": {
            "plot_posts_json": "[{\"src\":\"https://...\",\"text\":\"Пост\",\"symbols_num\":1500}]"
          },
          "multiplier": 1
        }
      ],
      "price": 8,
      "bonus": 9,
      "amountLabel": "Сумма"
    },
    {
      "title": "Автоматическая корректировка цен",
      "form_id": "price-adjustment",
      "type": "adjustment",
      "entries": [
        {
          "key": "price-adjustment_plot-5-discount",
          "data": {
            "adjustment_amount": 20,
            "calculation": "(+ 20)"
          }
        }
      ],
      "amountLabel": "Корректировка"
    },
    {
      "title": "75% скидка на сюжетные посты",
      "form_id": "automatic-discount",
      "type": "discount",
      "entries": [
        {
          "key": "automatic-discount_plot-discount",
          "data": {
            "discount_amount": 30,
            "calculation": "(+ 30)"
          }
        }
      ],
      "amountLabel": "Скидка"
    }
  ],
  "operations": [...]
}
```

---

## Примечания

1. **Группировка операций:** Операции группируются по ключу (`key`), который формируется из `form_id` и дополнительных параметров (например, ID подарка)

2. **Множитель (multiplier):** Используется для операций с количественными показателями (посты, получатели)

3. **Порядок операций:**
   - Обычные операции (type: "operation")
   - Корректировки цен (type: "adjustment")
   - Автоматические скидки (type: "discount")

4. **JSON в строках:** Некоторые поля (например, `plot_posts_json`) содержат JSON как строку и требуют парсинга

5. **Совместимость:** Поле `operations` содержит старый формат для обратной совместимости
