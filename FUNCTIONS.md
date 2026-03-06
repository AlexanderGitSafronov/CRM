# CRM — Описание функций и API

## Стек
- **Backend**: Node.js + Express 4 + TypeScript, порт 3001
- **БД**: SQLite via Prisma ORM
- **Auth**: JWT (Bearer токен)
- **Роли**: ADMIN, MANAGER, CALL_CENTER, VIEWER

---

## Аутентификация — `/api/auth`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| POST | `/api/auth/login` | — | Вход по email+password, возвращает JWT токен |
| GET | `/api/auth/me` | любой авторизованный | Текущий пользователь |
| POST | `/api/auth/change-password` | любой авторизованный | Смена пароля |

---

## Заказы — `/api/orders`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/orders` | любой | Список заказов с фильтрами: `status`, `managerId`, `search`, `source`, `dateFrom`, `dateTo`, `page`, `limit`, `sortBy`, `sortOrder` |
| GET | `/api/orders/:id` | любой | Один заказ с историей изменений |
| POST | `/api/orders` | ADMIN, MANAGER | Создать заказ вручную (source=MANUAL). Round-robin назначение менеджера |
| PUT | `/api/orders/:id` | ADMIN, MANAGER | Обновить статус, менеджера, комментарий, товары |
| PATCH | `/api/orders/:id` | ADMIN, MANAGER, CALL_CENTER | Call-center обновление: доставка (NP refs), статус CC, upsell, причина отказа |
| DELETE | `/api/orders/:id` | ADMIN | Удалить заказ |
| POST | `/api/orders/bulk-status` | ADMIN, MANAGER | Массовое обновление статуса |
| GET | `/api/orders/:id/history` | любой | История изменений заказа |

**Статусы заказа**: `NEW`, `PROCESSING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `RETURNED`, `CALLED`, `NO_ANSWER`

**Источники заказа**: `LANDING`, `MAGAZ`, `MANUAL`, `WEBHOOK`, `WEBSITE`, `FACEBOOK`, `INSTAGRAM`, `TELEGRAM`

---

## Клиенты — `/api/customers`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/customers` | любой | Список клиентов с поиском и пагинацией. Включает LTV |
| GET | `/api/customers/:id` | любой | Клиент + все заказы + LTV |
| PUT | `/api/customers/:id` | любой | Обновить name, email, city, address, notes |
| PATCH | `/api/customers/:id/blacklist` | ADMIN, MANAGER | Добавить/снять с чёрного списка |
| DELETE | `/api/customers/:id` | ADMIN | Удалить (запрещено если есть заказы) |

---

## Товары — `/api/products`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/products` | любой | Список товаров. Фильтры: `search`, `active`. Возвращает: margin, marginPercent, totalSold |
| GET | `/api/products/:id` | любой | Один товар |
| POST | `/api/products` | ADMIN, MANAGER | Создать товар (name, sku, purchasePrice, salePrice, stock, image) |
| PUT | `/api/products/:id` | ADMIN, MANAGER | Обновить товар |
| DELETE | `/api/products/:id` | ADMIN | Удалить (soft delete если есть заказы) |
| PATCH | `/api/products/:id/stock` | ADMIN, MANAGER | Установить склад (`stock`) или изменить на дельту (`delta`) |

---

## Аналитика — `/api/analytics`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/analytics/summary` | любой | Сводка: заказы, выручка, расходы, прибыль, клиенты, товары |
| GET | `/api/analytics/kpi` | любой | KPI дашборд: сегодня, 30 дней, redemption rate, в пути, колбэки |
| GET | `/api/analytics/orders-by-day` | любой | Заказы и выручка по дням (параметр `days`, 7-365) |
| GET | `/api/analytics/revenue-by-manager` | любой | Выручка по менеджерам |
| GET | `/api/analytics/conversion-by-manager` | любой | Конверсия менеджеров + среднее время ответа |
| GET | `/api/analytics/revenue-by-source` | любой | Выручка по источнику с конверсией |
| GET | `/api/analytics/revenue-by-product` | любой | Топ товаров: выручка, кол-во, себестоимость, прибыль, возвраты, % выкупа |
| GET | `/api/analytics/redemption-rate` | любой | % выкупа (DELIVERED/resolved) + тренд vs предыдущий период |
| GET | `/api/analytics/cancel-reasons` | любой | Топ причин отказа по количеству |
| GET | `/api/analytics/customer-ltv` | любой | LTV клиентов, повторные покупки, repeatRate |
| GET | `/api/analytics/expenses` | любой | Список расходов с фильтрами |
| POST | `/api/analytics/expenses` | ADMIN, MANAGER | Создать расход (категории: ADVERTISING, SERVICES, PURCHASE, OTHER) |
| DELETE | `/api/analytics/expenses/:id` | ADMIN | Удалить расход |

---

## Нова Пошта — `/api/nova-poshta`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/nova-poshta/cities?q=` | любой | Поиск городов по названию (мин. 2 символа) |
| GET | `/api/nova-poshta/warehouses?cityRef=&q=` | любой | Список отделений в городе |
| GET | `/api/nova-poshta/sender-config` | ADMIN, MANAGER | Получить настройки отправителя (с маскировкой) |
| POST | `/api/nova-poshta/fetch-sender` | ADMIN | Автоматически получить refs отправителя из НП |
| POST | `/api/nova-poshta/create-ttn` | ADMIN, MANAGER | Создать ТТН для заказа. Статус → SHIPPED. Отправляет SMS/Viber клиенту |
| POST | `/api/nova-poshta/bulk-create-ttn` | ADMIN, MANAGER | Массовое создание ТТН для нескольких заказов |
| GET | `/api/nova-poshta/tracker/status` | ADMIN, MANAGER | Статус NP трекер-воркера |
| POST | `/api/nova-poshta/tracker/run` | ADMIN | Запустить трекер вручную |
| GET | `/api/nova-poshta/sla/status` | ADMIN, MANAGER | Статус SLA трекера и количество просроченных заказов |
| POST | `/api/nova-poshta/sla/run` | ADMIN | Запустить SLA проверку вручную |

---

## Уведомления — `/api/notifications`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/notifications` | любой | Уведомления текущего пользователя |
| POST | `/api/notifications/:id/read` | любой | Отметить прочитанным |
| POST | `/api/notifications/read-all` | любой | Отметить все прочитанными |

---

## Колбэки — `/api/callbacks`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/callbacks` | любой | Список колбэков. Фильтры: `done`, `mine`, `orderId` |
| POST | `/api/callbacks` | ADMIN, MANAGER, CALL_CENTER | Создать напоминание (orderId, scheduledAt, note) |
| PATCH | `/api/callbacks/:id/done` | ADMIN, MANAGER, CALL_CENTER | Отметить выполненным |
| DELETE | `/api/callbacks/:id` | ADMIN, MANAGER, CALL_CENTER | Удалить колбэк |

---

## Пользователи — `/api/users`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/users` | ADMIN | Список пользователей |
| POST | `/api/users` | ADMIN | Создать пользователя |
| PUT | `/api/users/:id` | ADMIN | Обновить пользователя |
| DELETE | `/api/users/:id` | ADMIN | Удалить пользователя |

---

## Интеграции — `/api/integrations`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/integrations` | ADMIN | Список интеграций (чувствительные поля маскированы) |
| PUT | `/api/integrations/:type` | ADMIN | Сохранить настройки интеграции (upsert) |
| POST | `/api/integrations/telegram/test` | ADMIN | Тестовое сообщение в Telegram |
| POST | `/api/integrations/turbosms/test` | ADMIN | Тестовое SMS/Viber через TurboSMS |

**Типы интеграций**: `TELEGRAM`, `TURBOSMS`, `NOVA_POSHTA_SENDER`

---

## Вебхук (входящие заказы) — `/api/webhook`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| POST | `/api/webhook/order` | — (X-Webhook-Token) | Принять заказ от внешней системы (magaz, landing) |
| GET | `/api/webhook/tokens` | ADMIN | Список вебхук-токенов |
| POST | `/api/webhook/tokens` | ADMIN | Создать токен |
| DELETE | `/api/webhook/tokens/:id` | ADMIN | Удалить токен |

**Формат входящего заказа**:
```json
{
  "customer": { "name": "...", "phone": "...", "email": "...", "city": "..." },
  "items": [{ "name": "...", "quantity": 1, "price": 100 }],
  "source": "MAGAZ",
  "delivery": { "service": "NOVA_POSHTA", "city": "...", "address": "...", "recipientName": "..." }
}
```

---

## Экспорт — `/api/export`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/export/orders` | ADMIN, MANAGER | Экспорт заказов в CSV |

---

## SSE Events — `/api/events`

| Метод | Путь | Роль | Описание |
|-------|------|------|---------|
| GET | `/api/events` | любой | Server-Sent Events: `new_order` события в реальном времени |

---

## Фоновые воркеры

| Воркер | Расписание | Описание |
|--------|-----------|---------|
| NP Tracker | каждые 3ч (`0 */3 * * *`) | Проверяет статус ТТН через API НП. SHIPPED → DELIVERED или RETURNED |
| SLA Tracker | каждые 30 мин (`*/30 * * * *`) | Находит заказы в статусе NEW старше N часов, отправляет уведомления |
| Callback Reminder | каждый час | Напоминает менеджерам о плановых колбэках |

---

## Сервисы

| Сервис | Файл | Описание |
|--------|------|---------|
| TurboSMS | `services/turbosms.ts` | SMS и Viber сообщения клиентам |
| Telegram | `services/telegram.ts` | Уведомления в Telegram чат |
| Nova Poshta | `services/novaPoshta.ts` | API НП: поиск, ТТН, трекинг |
| Rashod Webhook | `services/rashodWebhook.ts` | Отправляет доход в rashod при DELIVERED |
| Round Robin | `services/roundRobin.ts` | Автоназначение менеджера на новые заказы |
| Event Bus | `services/eventBus.ts` | SSE-броадкаст событий клиентам |
| Notifications | `services/notifications.ts` | Уведомления в БД + Telegram |
