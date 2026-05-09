// Lightweight i18n: 3 locales, flat key dictionary, browser-only.
// Default locale is Ukrainian. Locale persisted via localeStore (zustand+persist).

export type Locale = 'uk' | 'ru' | 'en';

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export const DEFAULT_LOCALE: Locale = 'uk';

// Flat dictionary: each key has 3 values. Add as you translate UI surfaces.
export const DICT = {
  // ============ NAV ============
  'nav.dashboard':      { uk: 'Дашборд',         ru: 'Дашборд',         en: 'Dashboard' },
  'nav.orders':         { uk: 'Заказы',           ru: 'Заказы',           en: 'Orders' },
  'nav.customers':      { uk: 'Клієнти',          ru: 'Клиенты',          en: 'Customers' },
  'nav.products':       { uk: 'Товари',           ru: 'Товары',           en: 'Products' },
  'nav.analytics':      { uk: 'Аналітика',        ru: 'Аналитика',        en: 'Analytics' },
  'nav.goals':          { uk: 'Цілі',             ru: 'Цели',             en: 'Goals' },
  'nav.payroll':        { uk: 'Зарплата КЦ',      ru: 'Зарплата КЦ',      en: 'CC Payroll' },
  'nav.notifications':  { uk: 'Сповіщення',       ru: 'Уведомления',      en: 'Notifications' },
  'nav.settings':       { uk: 'Налаштування',     ru: 'Настройки',        en: 'Settings' },
  'nav.logout':         { uk: 'Вийти',            ru: 'Выйти',            en: 'Sign out' },

  // ============ ROLES ============
  'role.ADMIN':         { uk: 'Адміністратор',    ru: 'Администратор',    en: 'Admin' },
  'role.MANAGER':       { uk: 'Менеджер',         ru: 'Менеджер',         en: 'Manager' },
  'role.VIEWER':        { uk: 'Перегляд',         ru: 'Просмотр',         en: 'Viewer' },
  'role.CALL_CENTER':   { uk: 'Колл-центр',       ru: 'Колл-центр',       en: 'Call Center' },

  // ============ HEADER ============
  'header.search':      { uk: 'Пошук',            ru: 'Поиск',            en: 'Search' },
  'header.themeDark':   { uk: 'Темна тема',       ru: 'Тёмная тема',      en: 'Dark theme' },
  'header.themeLight':  { uk: 'Світла тема',      ru: 'Светлая тема',     en: 'Light theme' },
  'header.soundOn':     { uk: 'Вимкнути звук',    ru: 'Выключить звук',   en: 'Mute sounds' },
  'header.soundOff':    { uk: 'Увімкнути звук',   ru: 'Включить звук',    en: 'Enable sounds' },

  // ============ COMMON ============
  'common.save':        { uk: 'Зберегти',         ru: 'Сохранить',        en: 'Save' },
  'common.cancel':      { uk: 'Скасувати',        ru: 'Отмена',           en: 'Cancel' },
  'common.create':      { uk: 'Створити',         ru: 'Создать',          en: 'Create' },
  'common.delete':      { uk: 'Видалити',         ru: 'Удалить',          en: 'Delete' },
  'common.edit':        { uk: 'Редагувати',       ru: 'Редактировать',    en: 'Edit' },
  'common.add':         { uk: 'Додати',           ru: 'Добавить',         en: 'Add' },
  'common.refresh':     { uk: 'Оновити',          ru: 'Обновить',         en: 'Refresh' },
  'common.export':      { uk: 'Експорт',          ru: 'Экспорт',          en: 'Export' },
  'common.import':      { uk: 'Імпорт',           ru: 'Импорт',           en: 'Import' },
  'common.back':        { uk: 'Назад',            ru: 'Назад',            en: 'Back' },
  'common.close':       { uk: 'Закрити',          ru: 'Закрыть',          en: 'Close' },
  'common.loading':     { uk: 'Завантаження…',    ru: 'Загрузка…',        en: 'Loading…' },
  'common.search':      { uk: 'Пошук...',         ru: 'Поиск...',         en: 'Search...' },
  'common.yes':         { uk: 'Так',              ru: 'Да',               en: 'Yes' },
  'common.no':          { uk: 'Ні',               ru: 'Нет',              en: 'No' },
  'common.error':       { uk: 'Помилка',          ru: 'Ошибка',           en: 'Error' },
  'common.success':     { uk: 'Успішно',          ru: 'Успешно',          en: 'Success' },
  'common.all':         { uk: 'Усі',              ru: 'Все',              en: 'All' },
  'common.empty':       { uk: 'Пусто',            ru: 'Пусто',            en: 'Empty' },
  'common.notFound':    { uk: 'Нічого не знайдено', ru: 'Ничего не найдено', en: 'Nothing found' },
  'common.required':    { uk: "обов'язкове",      ru: 'обязательно',      en: 'required' },
  'common.optional':    { uk: 'необов\'язково',   ru: 'необязательно',    en: 'optional' },

  // ============ DASHBOARD ============
  'dashboard.welcome':       { uk: 'Ласкаво просимо',     ru: 'Добро пожаловать',     en: 'Welcome' },
  'dashboard.subtitle':      { uk: 'Ось що відбувається з вашим бізнесом сьогодні', ru: 'Вот что происходит с вашим бизнесом сегодня', en: "Here's what's happening with your business today" },
  'dashboard.updatedAt':     { uk: 'Оновлено о',          ru: 'Обновлено в',          en: 'Updated at' },
  'dashboard.todayOrders':   { uk: 'Сьогодні заказів',    ru: 'Сегодня заказов',      en: 'Orders today' },
  'dashboard.inTransit':     { uk: 'В дорозі',            ru: 'В пути',               en: 'In transit' },
  'dashboard.parcels':       { uk: 'посилок',             ru: 'посылок',              en: 'parcels' },
  'dashboard.redemption':    { uk: 'Викуп (30д)',         ru: 'Выкуп (30д)',          en: 'Redemption (30d)' },
  'dashboard.callbacks':     { uk: 'Передзвони',          ru: 'Перезвоны',            en: 'Callbacks' },
  'dashboard.tillTomorrow':  { uk: 'до завтра',           ru: 'до завтра',            en: 'till tomorrow' },
  'dashboard.totalOrders':   { uk: 'Всього заказів',      ru: 'Всего заказов',        en: 'Total orders' },
  'dashboard.newOrders':     { uk: 'нових',               ru: 'новых',                en: 'new' },
  'dashboard.revenue':       { uk: 'Виручка',             ru: 'Выручка',              en: 'Revenue' },
  'dashboard.expenses':      { uk: 'Витрати',             ru: 'Расходы',              en: 'Expenses' },
  'dashboard.profit':        { uk: 'Прибуток',            ru: 'Прибыль',              en: 'Profit' },
  'dashboard.margin':        { uk: 'Маржа',               ru: 'Маржа',                en: 'Margin' },
  'dashboard.customers':     { uk: 'Клієнтів',            ru: 'Клиентов',             en: 'Customers' },
  'dashboard.lowStockWarn':  { uk: 'товарів з низьким залишком', ru: 'товаров с низким остатком', en: 'low-stock products' },
  'dashboard.newOrdersAlert':{ uk: 'нових заказів потребують обробки', ru: 'новых заказов требуют обработки', en: 'new orders need processing' },
  'dashboard.revenue14d':    { uk: 'Виручка за 14 днів',  ru: 'Выручка за 14 дней',   en: 'Revenue (14 days)' },
  'dashboard.ordersDaily':   { uk: 'Заказів по днях',     ru: 'Заказов по дням',      en: 'Daily orders' },
  'dashboard.recentOrders':  { uk: 'Останні заказы',      ru: 'Последние заказы',     en: 'Recent orders' },
  'dashboard.allOrders':     { uk: 'Усі заказы',          ru: 'Все заказы',           en: 'All orders' },
  'dashboard.noOrdersYet':   { uk: 'Заказів ще немає',    ru: 'Заказов ещё нет',      en: 'No orders yet' },

  // ============ TABLE COLUMNS ============
  'col.num':            { uk: '№',                ru: '№',                en: '#' },
  'col.customer':       { uk: 'Клієнт',           ru: 'Клиент',           en: 'Customer' },
  'col.items':          { uk: 'Товари',           ru: 'Товары',           en: 'Items' },
  'col.amount':         { uk: 'Сума',             ru: 'Сумма',            en: 'Amount' },
  'col.status':         { uk: 'Статус',           ru: 'Статус',           en: 'Status' },
  'col.source':         { uk: 'Джерело',          ru: 'Источник',         en: 'Source' },
  'col.manager':        { uk: 'Менеджер',         ru: 'Менеджер',         en: 'Manager' },
  'col.date':           { uk: 'Дата',             ru: 'Дата',             en: 'Date' },
  'col.phone':          { uk: 'Телефон',          ru: 'Телефон',          en: 'Phone' },
  'col.email':          { uk: 'Email',            ru: 'Email',            en: 'Email' },
  'col.city':           { uk: 'Місто',            ru: 'Город',            en: 'City' },
  'col.product':        { uk: 'Товар',            ru: 'Товар',            en: 'Product' },
  'col.sku':            { uk: 'Артикул',          ru: 'Артикул',          en: 'SKU' },
  'col.price':          { uk: 'Ціна',             ru: 'Цена',             en: 'Price' },
  'col.purchase':       { uk: 'Собівартість',     ru: 'Себест.',          en: 'Cost' },
  'col.stock':          { uk: 'Залишок',          ru: 'Остаток',          en: 'Stock' },

  // ============ ORDERS PAGE ============
  'orders.title':       { uk: 'Заказы',           ru: 'Заказы',           en: 'Orders' },
  'orders.count':       { uk: 'заказів',          ru: 'заказов',          en: 'orders' },
  'orders.new':         { uk: 'Новий заказ',      ru: 'Новый заказ',      en: 'New order' },
  'orders.searchPlaceholder': { uk: 'Пошук за іменем або телефоном...', ru: 'Поиск по имени или телефону...', en: 'Search by name or phone...' },
  'orders.allStatuses': { uk: 'Усі статуси',      ru: 'Все статусы',      en: 'All statuses' },
  'orders.allManagers': { uk: 'Усі менеджери',    ru: 'Все менеджеры',    en: 'All managers' },
  'orders.dateFrom':    { uk: 'Дата від',         ru: 'Дата от',          en: 'Date from' },
  'orders.dateTo':      { uk: 'Дата до',          ru: 'Дата до',          en: 'Date to' },
  'orders.reset':       { uk: 'Скинути',          ru: 'Сбросить',         en: 'Reset' },
  'orders.selected':    { uk: 'Вибрано',          ru: 'Выбрано',          en: 'Selected' },
  'orders.changeStatus':{ uk: 'Змінити статус',   ru: 'Изменить статус',  en: 'Change status' },
  'orders.assignManager':{ uk: 'Призначити',      ru: 'Назначить',        en: 'Assign' },
  'orders.unassign':    { uk: '✕ Зняти менеджера', ru: '✕ Снять менеджера', en: '✕ Unassign' },
  'orders.createTtn':   { uk: 'Створити ТТН',     ru: 'Создать ТТН',      en: 'Create TTN' },
  'orders.creating':    { uk: 'Створення...',     ru: 'Создание...',      en: 'Creating...' },

  // ============ CUSTOMERS PAGE ============
  'customers.title':    { uk: 'Клієнти',          ru: 'Клиенты',          en: 'Customers' },
  'customers.count':    { uk: 'клієнтів',         ru: 'клиентов',         en: 'customers' },
  'customers.searchPlaceholder': { uk: 'Пошук за іменем, телефоном, email...', ru: 'Поиск по имени, телефону, email...', en: 'Search by name, phone, email...' },
  'customers.csvImport':{ uk: 'Імпорт CSV',       ru: 'Импорт CSV',       en: 'Import CSV' },

  // ============ PRODUCTS PAGE ============
  'products.title':     { uk: 'Товари',           ru: 'Товары',           en: 'Products' },
  'products.count':     { uk: 'товарів',          ru: 'товаров',          en: 'products' },
  'products.warehouse': { uk: 'Склад',            ru: 'Склад',            en: 'Warehouse' },
  'products.add':       { uk: 'Додати товар',     ru: 'Добавить товар',   en: 'Add product' },
  'products.searchPlaceholder': { uk: 'Пошук за назвою або артикулом...', ru: 'Поиск по названию или артикулу...', en: 'Search by name or SKU...' },

  // ============ GOALS PAGE ============
  'goals.title':        { uk: 'Цілі продажів',    ru: 'Цели продаж',      en: 'Sales goals' },
  'goals.subtitle':     { uk: 'Плани на місяць, квартал, рік', ru: 'Планы на месяц, квартал, год', en: 'Plans for month, quarter, year' },
  'goals.month':        { uk: 'Місяць',           ru: 'Месяц',            en: 'Month' },
  'goals.quarter':      { uk: 'Квартал',          ru: 'Квартал',          en: 'Quarter' },
  'goals.year':         { uk: 'Рік',              ru: 'Год',              en: 'Year' },
  'goals.forMonth':     { uk: 'На місяць',        ru: 'На месяц',         en: 'Monthly' },
  'goals.forQuarter':   { uk: 'На квартал',       ru: 'На квартал',       en: 'Quarterly' },
  'goals.forYear':      { uk: 'На рік',           ru: 'На год',           en: 'Yearly' },
  'goals.empty':        { uk: 'Цілей ще немає',   ru: 'Целей ещё нет',    en: 'No goals yet' },
  'goals.emptyHint':    { uk: 'Поставте план продажів — і відстежуйте прогрес у реальному часі', ru: 'Поставьте план продаж — и отслеживайте прогресс в реальном времени', en: 'Set a sales plan and track progress in real time' },
  'goals.createFirst':  { uk: 'Створити першу ціль', ru: 'Создать первую цель', en: 'Create first goal' },
  'goals.targetRevenue':{ uk: 'Цільова виручка',  ru: 'Целевая выручка',  en: 'Target revenue' },
  'goals.targetOrders': { uk: 'Цільова кількість заказів', ru: 'Целевое количество заказов', en: 'Target order count' },
  'goals.daysLeft':     { uk: 'Залишилось',       ru: 'Осталось',         en: 'Left' },
  'goals.days':         { uk: 'дн',               ru: 'дн',               en: 'd' },
  'goals.completed':    { uk: 'Завершено',        ru: 'Завершено',        en: 'Completed' },
  'goals.aheadOfPace':  { uk: '✓ випереджаєте темп', ru: '✓ опережаете темп', en: '✓ ahead of pace' },
  'goals.behindPace':   { uk: 'відставання',      ru: 'отставание',       en: 'behind pace' },
  'goals.fromPace':     { uk: 'від темпу',        ru: 'от темпа',         en: 'from pace' },
  'goals.start':        { uk: 'Початок',          ru: 'Начало',           en: 'Start' },
  'goals.end':          { uk: 'Кінець',           ru: 'Конец',            en: 'End' },
  'goals.period':       { uk: 'Період',           ru: 'Период',           en: 'Period' },
  'goals.activeShort':  { uk: 'Активна (показувати на дашборді)', ru: 'Активная (показывать на дашборде)', en: 'Active (show on dashboard)' },
  'goals.newGoal':      { uk: 'Нова ціль',        ru: 'Новая цель',       en: 'New goal' },
  'goals.editGoal':     { uk: 'Редагувати ціль',  ru: 'Редактировать цель', en: 'Edit goal' },

  // ============ SETTINGS PAGE ============
  'settings.title':     { uk: 'Налаштування',     ru: 'Настройки',        en: 'Settings' },
  'settings.tabs.users':       { uk: 'Користувачі',     ru: 'Пользователи',     en: 'Users' },
  'settings.tabs.branding':    { uk: 'Брендинг',        ru: 'Брендинг',         en: 'Branding' },
  'settings.tabs.templates':   { uk: 'Шаблони',         ru: 'Шаблоны',          en: 'Templates' },
  'settings.tabs.webhooks':    { uk: 'Webhook API',     ru: 'Webhook API',      en: 'Webhook API' },
  'settings.tabs.integrations':{ uk: 'Інтеграції',      ru: 'Интеграции',       en: 'Integrations' },
  'settings.tabs.general':     { uk: 'Загальне',        ru: 'Общее',            en: 'General' },
  'settings.language':         { uk: 'Мова інтерфейсу', ru: 'Язык интерфейса',  en: 'Interface language' },
  'settings.languageHint':     { uk: 'Зміни застосовуються одразу та зберігаються у вашому браузері', ru: 'Изменения применяются сразу и сохраняются в вашем браузере', en: 'Changes apply immediately and are saved in your browser' },

  // ============ PLAN USAGE ============
  'plan.users':         { uk: 'Користувачів',     ru: 'Пользователей',    en: 'Users' },
  'plan.ordersMonth':   { uk: 'Заказів / місяць', ru: 'Заказов / месяц',  en: 'Orders / month' },
  'plan.products':      { uk: 'Товарів',          ru: 'Товаров',          en: 'Products' },
  'plan.tariff':        { uk: 'Тариф',            ru: 'Тариф',            en: 'Plan' },
  'plan.upgrade':       { uk: 'Оновити',          ru: 'Обновить',         en: 'Upgrade' },

  // ============ ACHIEVEMENTS ============
  'achievements.title': { uk: 'Досягнення',       ru: 'Достижения',       en: 'Achievements' },
  'achievements.of':    { uk: 'з',                ru: 'из',               en: 'of' },

  // ============ MAP ============
  'map.title':          { uk: 'Карта замовлень',  ru: 'Карта заказов',    en: 'Orders map' },
  'map.cities':         { uk: 'міст',             ru: 'городов',          en: 'cities' },
  'map.empty':          { uk: 'Поки що немає даних про міста', ru: 'Пока нет данных о городах', en: 'No city data yet' },

  // ============ SEARCH PALETTE ============
  'search.placeholder': { uk: 'Шукати заказы, клієнтів, товари...', ru: 'Искать заказы, клиентов, товары...', en: 'Search orders, customers, products...' },
  'search.startTyping': { uk: 'Почніть вводити для пошуку...', ru: 'Начните вводить для поиска...', en: 'Start typing to search…' },
  'search.minChars':    { uk: 'Введіть мінімум 2 символи', ru: 'Введите минимум 2 символа', en: 'Enter at least 2 characters' },
  'search.noResults':   { uk: 'Нічого не знайдено по',  ru: 'Ничего не найдено по',  en: 'No results for' },
  'search.navigate':    { uk: 'навігація',        ru: 'навигация',        en: 'navigate' },
  'search.open':        { uk: 'відкрити',         ru: 'открыть',          en: 'open' },
  'search.section.orders':    { uk: 'Заказы',     ru: 'Заказы',           en: 'Orders' },
  'search.section.customers': { uk: 'Клієнти',    ru: 'Клиенты',          en: 'Customers' },
  'search.section.products':  { uk: 'Товари',     ru: 'Товары',           en: 'Products' },
};

export type DictKey = keyof typeof DICT;

export function translate(key: DictKey | string, locale: Locale): string {
  const entry = (DICT as Record<string, Record<Locale, string>>)[key];
  if (!entry) return key;
  return entry[locale] ?? entry[DEFAULT_LOCALE] ?? key;
}
