'use client';

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuthStore } from '@/stores/authStore';
import { useLocaleStore } from '@/stores/localeStore';
import type { Locale } from '@/lib/i18n';

const TOUR_KEY = 'crm_tour_done_v2'; // v2 — added call-center step + locales

type Step = {
  popover: { title: string; description: string };
  element?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
};

const TOUR_BY_LOCALE: Record<Locale, {
  ui: { next: string; prev: string; done: string; progress: string };
  steps: Step[];
}> = {
  uk: {
    ui: { next: 'Далі →', prev: '← Назад', done: 'Готово ✓', progress: '{{current}} з {{total}}' },
    steps: [
      { popover: { title: '👋 Ласкаво просимо!', description: 'Покажу вам ключові розділи за 30 секунд. Ви завжди зможете знайти їх у бічній панелі.' } },
      { element: '[data-tour="orders"]', side: 'right', align: 'start',
        popover: { title: '🛒 Заказы', description: 'Усі ваші замовлення. Можна перетягувати картки між статусами (kanban) або працювати в таблиці.' } },
      { element: '[data-tour="customers"]', side: 'right', align: 'start',
        popover: { title: '👥 Клієнти', description: 'База клієнтів з історією замовлень. Підтримує імпорт CSV для міграції з інших систем.' } },
      { element: '[data-tour="products"]', side: 'right', align: 'start',
        popover: { title: '📦 Товари', description: 'Каталог із залишками. Поставте поріг — і отримуйте сповіщення коли товар закінчується.' } },
      { element: '[data-tour="analytics"]', side: 'right', align: 'start',
        popover: { title: '📊 Аналітика', description: 'Виручка, конверсія, % викупу, топ менеджерів — все, щоб розуміти бізнес.' } },
      { element: '[data-tour="settings"]', side: 'right', align: 'start',
        popover: { title: '☎️ Свій колл-центр', description: 'У CRM є окремий режим для колл-центру. Створіть користувача з роллю «Колл-центр» у Налаштування → Користувачі — він отримає інтерфейс /cc для обзвону, з відстеженням зарплати та інтеграцією Нової Пошти. Не всі знають що це є — використовуйте!' } },
      { element: '[data-tour="settings"]', side: 'right', align: 'start',
        popover: { title: '⚙️ Налаштування', description: 'Користувачі, інтеграції (Telegram, Нова Пошта, TurboSMS), webhook для лендингу, шаблони замовлень та мова інтерфейсу.' } },
      { element: '[data-tour="search"]', side: 'bottom', align: 'end',
        popover: { title: '🔍 Швидкий пошук', description: 'Натисніть ⌘K (Ctrl+K) у будь-якому місці — і миттєво знайдете заказ, клієнта чи товар.' } },
      { popover: { title: '🚀 Все готово!', description: 'Створіть перший товар → перший заказ → налаштуйте Telegram-бот. Питання? Пишіть у підтримку.' } },
    ],
  },
  ru: {
    ui: { next: 'Далее →', prev: '← Назад', done: 'Готово ✓', progress: '{{current}} из {{total}}' },
    steps: [
      { popover: { title: '👋 Добро пожаловать!', description: 'Покажу ключевые разделы за 30 секунд. Они всегда доступны в боковой панели.' } },
      { element: '[data-tour="orders"]', side: 'right', align: 'start',
        popover: { title: '🛒 Заказы', description: 'Все ваши заказы. Можно перетаскивать карточки между статусами (kanban) или работать в таблице.' } },
      { element: '[data-tour="customers"]', side: 'right', align: 'start',
        popover: { title: '👥 Клиенты', description: 'База клиентов с историей заказов. Поддерживает импорт CSV для миграции с других систем.' } },
      { element: '[data-tour="products"]', side: 'right', align: 'start',
        popover: { title: '📦 Товары', description: 'Каталог с остатками. Поставьте порог — и получайте уведомления, когда товар заканчивается.' } },
      { element: '[data-tour="analytics"]', side: 'right', align: 'start',
        popover: { title: '📊 Аналитика', description: 'Выручка, конверсия, % выкупа, топ менеджеров — всё, чтобы понимать бизнес.' } },
      { element: '[data-tour="settings"]', side: 'right', align: 'start',
        popover: { title: '☎️ Свой колл-центр', description: 'В CRM есть отдельный режим колл-центра. Создайте пользователя с ролью «Колл-центр» в Настройки → Пользователи — он получит свой интерфейс /cc для обзвона, с отслеживанием зарплаты и интеграцией Новой Почты. Не все знают что это есть — используйте!' } },
      { element: '[data-tour="settings"]', side: 'right', align: 'start',
        popover: { title: '⚙️ Настройки', description: 'Пользователи, интеграции (Telegram, Новая Почта, TurboSMS), webhook для лендинга, шаблоны заказов и язык интерфейса.' } },
      { element: '[data-tour="search"]', side: 'bottom', align: 'end',
        popover: { title: '🔍 Быстрый поиск', description: 'Нажмите ⌘K (Ctrl+K) в любом месте — и мгновенно найдёте заказ, клиента или товар.' } },
      { popover: { title: '🚀 Всё готово!', description: 'Создайте первый товар → первый заказ → подключите Telegram-бот. Вопросы? Пишите в поддержку.' } },
    ],
  },
  en: {
    ui: { next: 'Next →', prev: '← Back', done: 'Done ✓', progress: '{{current}} of {{total}}' },
    steps: [
      { popover: { title: '👋 Welcome!', description: 'Quick 30-second tour of the main sections. You can always find them in the side panel.' } },
      { element: '[data-tour="orders"]', side: 'right', align: 'start',
        popover: { title: '🛒 Orders', description: 'All your orders. Drag cards between statuses (kanban) or work in the table.' } },
      { element: '[data-tour="customers"]', side: 'right', align: 'start',
        popover: { title: '👥 Customers', description: 'Customer database with order history. CSV import is supported for migration from other systems.' } },
      { element: '[data-tour="products"]', side: 'right', align: 'start',
        popover: { title: '📦 Products', description: 'Catalog with stock levels. Set a threshold and get alerts when stock runs low.' } },
      { element: '[data-tour="analytics"]', side: 'right', align: 'start',
        popover: { title: '📊 Analytics', description: 'Revenue, conversion, redemption rate, top managers — everything to understand your business.' } },
      { element: '[data-tour="settings"]', side: 'right', align: 'start',
        popover: { title: '☎️ Built-in call center', description: 'CRM has a dedicated call-center mode. Create a user with the "Call Center" role in Settings → Users — they get their own /cc interface for calling, payroll tracking and Nova Poshta integration. Not everyone knows about this — use it!' } },
      { element: '[data-tour="settings"]', side: 'right', align: 'start',
        popover: { title: '⚙️ Settings', description: 'Users, integrations (Telegram, Nova Poshta, TurboSMS), landing-page webhook, order templates and interface language.' } },
      { element: '[data-tour="search"]', side: 'bottom', align: 'end',
        popover: { title: '🔍 Quick search', description: 'Press ⌘K (Ctrl+K) anywhere — instantly find an order, customer or product.' } },
      { popover: { title: '🚀 All set!', description: 'Create your first product → first order → connect the Telegram bot. Questions? Reach out to support.' } },
    ],
  },
};

export function WelcomeTour() {
  const { user } = useAuthStore();
  const locale = useLocaleStore((s) => s.locale);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(TOUR_KEY)) return;

    const cfg = TOUR_BY_LOCALE[locale] || TOUR_BY_LOCALE.uk;

    const timer = setTimeout(() => {
      const d = driver({
        showProgress: true,
        animate: true,
        nextBtnText: cfg.ui.next,
        prevBtnText: cfg.ui.prev,
        doneBtnText: cfg.ui.done,
        progressText: cfg.ui.progress,
        steps: cfg.steps,
        onDestroyed: () => {
          localStorage.setItem(TOUR_KEY, '1');
        },
      });
      d.drive();
    }, 800);

    return () => clearTimeout(timer);
  }, [user, locale]);

  return null;
}
