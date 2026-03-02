# CRM Pro — Система управления товарным бизнесом

Полноценная веб-CRM система, аналогичная KeyCRM, для управления заказами, клиентами, товарами и аналитикой.

## Возможности

### Заказы
- Список заказов с фильтрацией (статус, менеджер, дата, источник)
- Поиск по имени клиента и телефону
- Канбан-доска с Drag & Drop для смены статусов
- Массовое изменение статусов
- История изменений каждого заказа
- Карточка заказа с деталями

### Клиенты
- База клиентов с автоматическим созданием при заказе
- LTV (пожизненная ценность клиента)
- История всех заказов клиента
- Поиск по телефону с автозаполнением при новом заказе

### Товары
- Каталог с закупочной ценой, ценой продажи и маржой
- Складской учёт (остатки)
- Предупреждения о низком остатке

### Аналитика
- Дашборд с ключевыми метриками
- Графики выручки и заказов по дням
- Продажи по менеджерам
- Топ товаров по выручке
- Учёт расходов (реклама, услуги, закупка)
- Расчёт чистой прибыли

### Интеграции
- REST API + Webhook для приёма заказов с лендингов
- Telegram бот (уведомления о новых заказах)
- Токены для безопасных Webhook-запросов

### Система пользователей
- Роли: Администратор, Менеджер, Просмотр
- Управление пользователями
- JWT авторизация

### Дополнительно
- Тёмная/светлая тема
- Экспорт заказов в CSV
- Уведомления в реальном времени
- Лог действий пользователей
- Адаптивный дизайн (mobile + desktop)

---

## Быстрый старт

### Требования
- Node.js 18+
- npm 9+

### Установка

```bash
# 1. Установка всех зависимостей и инициализация БД
chmod +x setup.sh
./setup.sh

# 2. Запуск системы
./start.sh
```

Или вручную:

```bash
# Terminal 1: Backend
cd backend
npm install --cache /tmp/npm-cache
npx prisma migrate dev --name init
npx ts-node --skip-project --compiler-options '{"module":"commonjs"}' prisma/seed.ts
npm run dev

# Terminal 2: Frontend
cd frontend
npm install --cache /tmp/npm-cache
npm run dev
```

### Адреса
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Prisma Studio**: `cd backend && npx prisma studio`

---

## Тестовые аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Администратор | admin@crm.com | admin123 |
| Менеджер | manager1@crm.com | manager123 |
| Менеджер | manager2@crm.com | manager123 |
| Просмотр | viewer@crm.com | viewer123 |

---

## Webhook API

Для автоматического приёма заказов с лендинга:

```bash
POST http://localhost:3001/api/webhook/order
Headers:
  Content-Type: application/json
  X-Webhook-Token: demo-webhook-token-change-in-production

Body:
{
  "customer": {
    "name": "Иван Петров",
    "phone": "+380501234567",
    "email": "ivan@example.com",
    "city": "Киев"
  },
  "items": [
    { "name": "Товар", "quantity": 1, "price": 999 }
  ],
  "source": "LANDING",
  "comment": "Срочно"
}
```

Управление токенами: Настройки → Webhook API

---

## Структура проекта

```
CRM/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Модели БД
│   │   ├── migrations/       # Миграции
│   │   └── seed.ts           # Тестовые данные
│   ├── src/
│   │   ├── controllers/      # Бизнес-логика
│   │   ├── middleware/       # Авторизация, обработка ошибок
│   │   ├── routes/           # API маршруты
│   │   └── services/         # Prisma, Telegram, уведомления
│   └── .env                  # Конфигурация
└── frontend/
    ├── src/
    │   ├── app/              # Next.js App Router
    │   │   ├── (crm)/        # Защищённые страницы CRM
    │   │   └── login/        # Страница входа
    │   ├── components/       # React компоненты
    │   ├── stores/           # Zustand состояние
    │   └── lib/              # API клиент, утилиты
    └── .env.local            # URL бэкенда
```

---

## Переменные окружения

### Backend (.env)
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```
