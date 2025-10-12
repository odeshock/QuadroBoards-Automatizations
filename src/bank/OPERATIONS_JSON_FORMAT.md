# Формат JSON операций банка

При нажатии на кнопку "Купить" система собирает всю информацию об операциях и отправляет её в формате JSON.

---

## Восстановление операций из backup

Система поддерживает восстановление операций из сохранённых данных.

### Как использовать

1. Установите данные в `window.BACKUP_DATA` перед загрузкой банка:
   ```javascript
   window.BACKUP_DATA = {
     fullData: [...],  // массив операций
     totalSum: 150     // опционально
   };
   ```

2. При загрузке страницы появится модальное окно с вопросом:
   **"Обнаружены сохранённые данные. Восстановить банковскую операцию?"**

3. Выберите:
   - **Да** — операции будут восстановлены, новые корректировки и скидки применятся автоматически
   - **Нет** — данные будут проигнорированы

4. После выбора `window.BACKUP_DATA` автоматически очищается (устанавливается в `undefined`)

### Особенности восстановления

**Гибридный подход:**
- ✅ Восстанавливаются **все** операции из backup (type: "operation")
- ✅ Восстанавливаются корректировки из backup (type: "adjustment")
- ✅ Восстанавливаются скидки из backup (type: "discount")
- ✅ **Новые корректировки применяются** (вечные правила из `autoPriceAdjustments`, которых нет в backup)
- ✅ **Исторические скидки применяются** (только те, что были активны на момент `backup.timestamp`)
- ✅ Все поля форм восстанавливаются полностью
- ✅ `groupSeq` и `entrySeq` обновляются для корректной работы
- ✅ Флаги `isDiscount` и `isPriceAdjustment` устанавливаются автоматически

**Логика корректировок (вечные):**
- Корректировки не имеют временных ограничений
- Применяются ВСЕ корректировки из `autoPriceAdjustments`, которых нет в backup
- Если ID корректировки есть в backup — она пропускается (избегаем дублирования)

**Логика скидок (временные):**
- Скидки применяются ТОЛЬКО на основе `backup.timestamp`
- Если в backup есть `timestamp` (ISO 8601), система проверяет какие скидки из `autoDiscounts` были активны на тот момент
- Скидка считается активной на момент backup, если:
  - `backup.timestamp >= discount.startDate` (в московском времени, 00:00:00)
  - `backup.timestamp <= discount.expiresAt` (в московском времени, 23:59:59) или `expiresAt` не указан
- Исторически активные скидки применяются, даже если они уже истекли или были удалены из конфигурации
- ⚠️ Скидки, активные сейчас, но НЕ активные на момент backup — **не применяются**

---

## Структура отправляемых данных

```json
{
  "type": "PURCHASE",
  "timestamp": "2025-01-15T12:34:56.789Z",  // ISO 8601 timestamp нажатия "Купить"
  "operations": [...],     // Старый формат (для совместимости)
  "fullData": [...],       // Полный формат с данными форм
  "environment": {...},    // Переменные окружения
  "totalSum": 0            // Общая сумма
}
```

### Поля верхнего уровня

| Поле | Тип | Описание |
|------|-----|----------|
| `type` | string | Тип сообщения, всегда `"PURCHASE"` |
| `timestamp` | string | Timestamp нажатия кнопки "Купить" в формате ISO 8601 (UTC) |
| `operations` | array | Старый формат операций из DOM (для совместимости) |
| `fullData` | array | Полный формат операций с данными всех полей форм |
| `environment` | object | Переменные окружения (USER_ID, IS_ADMIN, и т.д.) |
| `totalSum` | number | Общая итоговая сумма всех операций |

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
        "discount_id": "gift-collection-discount",
        "discount_title": "75% скидка на подарки из коллекции",
        "discount_type": "percent",
        "total_items": 5,
        "discount_amount": 135,
        "calculation": "180 × 75%",
        "startDate": "2024-01-01",
        "expiresAt": "2025-12-31"
      },
      "multiplier": 1
    }
  ],
  "price": 0,
  "bonus": 0,
  "amountLabel": "Скидка"
}
```

**Поля данных скидки:**
- `discount_id` — уникальный ID правила скидки
- `discount_title` — название скидки
- `discount_type` — тип скидки: `"percent"`, `"fixed"`, `"per_item"`, `"per_batch"`
- `total_items` — количество элементов, к которым применена скидка
- `discount_amount` — сумма скидки
- `calculation` — формула расчёта скидки
- `startDate` — дата начала действия скидки (формат `YYYY-MM-DD`)
- `expiresAt` — дата окончания действия скидки (формат `YYYY-MM-DD` или `null` если бессрочно)

**Типы скидок:**
- `"percent"` — процентная скидка (значение от 0 до 100)
- `"fixed"` — фиксированная скидка
- `"per_item"` — скидка за каждый элемент
- `"per_batch"` — скидка за каждую партию элементов

**Временные параметры:**
- **`startDate`** (ОБЯЗАТЕЛЬНО) — дата начала действия скидки в формате `YYYY-MM-DD`
  - Скидка начинает действовать с 00:00:00 по московскому времени (UTC+3)
  - Если текущее московское время < startDate, скидка не применяется
  - Пример: `"startDate": "2025-01-15"` — скидка начнёт работать 15 января 2025 в 00:00 МСК
- **`expiresAt`** (опционально) — дата окончания действия скидки в формате `YYYY-MM-DD`
  - Скидка действует до конца дня (23:59:59) по московскому времени
  - Если не указано — скидка действует бессрочно
  - Пример: `"expiresAt": "2025-01-31"` — скидка истекает 31 января 2025 в 23:59:59 МСК

**Особенности:**
- Скидки считаются от суммы с учётом корректировок
- Если `type === "percent"` и `value > 100`, значение приводится к 100
- Скидка на конкретные операции не может превышать сумму этих операций
- Общая сумма скидок не может превышать итоговую сумму всех операций
- При превышении все скидки пропорционально уменьшаются
- Если отсутствует обязательное поле `startDate`, скидка пропускается с предупреждением в консоли

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

---

## Пример восстановления из backup

### Тестовый пример

```javascript
// Пример данных для восстановления
window.BACKUP_DATA = {
  "fullData": [
    {
      "title": "Каждый сюжетный пост",
      "form_id": "form-income-plotpost",
      "type": "operation",
      "entries": [
        {
          "key": "form-income-plotpost_1",
          "data": {
            "plot_posts_json": "[{\"src\":\"https://example.com/post1\",\"text\":\"Пост 1\",\"symbols_num\":1500}]"
          },
          "multiplier": 1
        }
      ],
      "price": 8,
      "bonus": 9,
      "amountLabel": "Сумма"
    },
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
  ],
  "totalSum": 150
};
```

### Использование в консоли

1. Откройте консоль браузера
2. Вставьте код выше
3. Обновите страницу (F5)
4. Появится модальное окно с вопросом о восстановлении
5. Нажмите "Да" для восстановления операций

### Проверка результата

После восстановления:
- В логе появятся восстановленные операции
- Автоматические корректировки и скидки пересчитаются
- `window.BACKUP_DATA` будет очищен
- В консоли появится сообщение: "Операции успешно восстановлены из backup"
