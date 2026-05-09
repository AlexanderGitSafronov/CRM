'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './welcomeTour.css';
import { useAuthStore } from '@/stores/authStore';
import { useLocaleStore } from '@/stores/localeStore';
import type { Locale } from '@/lib/i18n';

const TOUR_KEY = 'crm_tour_done_v3'; // v3 — futuristic theme + final CTAs

interface Strings {
  ui: { next: string; prev: string; done: string; progress: string };
  intro: { title: string; description: string };
  steps: {
    orders: { title: string; description: string };
    customers: { title: string; description: string };
    products: { title: string; description: string };
    analytics: { title: string; description: string };
    callCenter: { title: string; description: string };
    webhook: { title: string; description: string };
    settings: { title: string; description: string };
    search: { title: string; description: string };
  };
  finale: {
    title: string;
    description: string;
    cta: { products: string; orders: string; settings: string };
  };
}

const I: Record<Locale, Strings> = {
  uk: {
    ui: { next: 'Далі →', prev: '← Назад', done: 'Готово ✓', progress: '{{current}} / {{total}}' },
    intro: {
      title: '✨ Ласкаво просимо у CRM Pro',
      description: 'За 30 секунд покажу ключові розділи. Поїхали!',
    },
    steps: {
      orders:    { title: '🛒 Заказы',     description: 'Усі заказы в одному місці — таблиця або канбан з drag & drop між статусами.' },
      customers: { title: '👥 Клієнти',     description: 'База з історією покупок і LTV. Імпорт CSV для міграції зі старої системи.' },
      products:  { title: '📦 Товари',      description: 'Каталог із залишками + автоматичні алерти у Telegram коли товар закінчується.' },
      analytics: { title: '📊 Аналітика',   description: 'Виручка, конверсія, % викупу, топ менеджерів — все, що треба для управління.' },
      callCenter:{ title: '☎️ Свій колл-центр', description: 'Створіть користувача з роллю «Колл-центр» у Налаштування → Користувачі. Він отримає окремий інтерфейс /cc для обзвону, з зарплатою та інтеграцією Нової Пошти.' },
      webhook:   { title: '🌐 Webhook для лендингу', description: 'У Налаштування → Webhook API є готовий endpoint. Підключіть форму на сайті — і нові заказы автоматично з\'являться тут.' },
      settings:  { title: '⚙️ Налаштування', description: 'Команда, інтеграції (Telegram, Нова Пошта, TurboSMS), мова інтерфейсу та шаблони заказів.' },
      search:    { title: '🔍 Швидкий пошук',  description: 'Натисніть ⌘K (Ctrl+K) у будь-якому місці — миттєво знайдете заказ, клієнта чи товар.' },
    },
    finale: {
      title: '🚀 Все готово до запуску!',
      description: 'З чого почнемо?',
      cta: { products: 'Додати товар', orders: 'Створити заказ', settings: 'Налаштування' },
    },
  },
  ru: {
    ui: { next: 'Далее →', prev: '← Назад', done: 'Готово ✓', progress: '{{current}} / {{total}}' },
    intro: {
      title: '✨ Добро пожаловать в CRM Pro',
      description: 'За 30 секунд покажу ключевые разделы. Поехали!',
    },
    steps: {
      orders:    { title: '🛒 Заказы',     description: 'Все заказы в одном месте — таблица или канбан с drag & drop между статусами.' },
      customers: { title: '👥 Клиенты',     description: 'База с историей покупок и LTV. Импорт CSV для миграции со старой системы.' },
      products:  { title: '📦 Товары',      description: 'Каталог с остатками + автоматические алерты в Telegram, когда товар заканчивается.' },
      analytics: { title: '📊 Аналитика',   description: 'Выручка, конверсия, % выкупа, топ менеджеров — всё для управления.' },
      callCenter:{ title: '☎️ Свой колл-центр', description: 'Создайте пользователя с ролью «Колл-центр» в Настройки → Пользователи. Он получит отдельный интерфейс /cc для обзвона, с зарплатой и интеграцией Новой Почты.' },
      webhook:   { title: '🌐 Webhook для лендинга', description: 'В Настройки → Webhook API есть готовый endpoint. Подключите форму на сайте — и новые заказы автоматически появятся здесь.' },
      settings:  { title: '⚙️ Настройки',   description: 'Команда, интеграции (Telegram, Новая Почта, TurboSMS), язык интерфейса и шаблоны заказов.' },
      search:    { title: '🔍 Быстрый поиск',  description: 'Нажмите ⌘K (Ctrl+K) в любом месте — мгновенно найдёте заказ, клиента или товар.' },
    },
    finale: {
      title: '🚀 Всё готово к старту!',
      description: 'С чего начнём?',
      cta: { products: 'Добавить товар', orders: 'Создать заказ', settings: 'Настройки' },
    },
  },
  en: {
    ui: { next: 'Next →', prev: '← Back', done: 'Done ✓', progress: '{{current}} / {{total}}' },
    intro: {
      title: '✨ Welcome to CRM Pro',
      description: "30-second tour of the key sections. Let's go!",
    },
    steps: {
      orders:    { title: '🛒 Orders',     description: 'All orders in one place — table or kanban with drag & drop between statuses.' },
      customers: { title: '👥 Customers',  description: 'Database with purchase history and LTV. CSV import for migration from another system.' },
      products:  { title: '📦 Products',   description: 'Catalog with stock + automatic Telegram alerts when items run low.' },
      analytics: { title: '📊 Analytics',  description: 'Revenue, conversion, redemption rate, top managers — everything you need to run the business.' },
      callCenter:{ title: '☎️ Built-in call center', description: 'Create a user with the "Call Center" role in Settings → Users. They get a dedicated /cc interface for calling, payroll and Nova Poshta integration.' },
      webhook:   { title: '🌐 Landing-page webhook', description: 'Settings → Webhook API has a ready endpoint. Wire up your form and new orders show up here automatically.' },
      settings:  { title: '⚙️ Settings',    description: 'Team, integrations (Telegram, Nova Poshta, TurboSMS), interface language and order templates.' },
      search:    { title: '🔍 Quick search', description: 'Press ⌘K (Ctrl+K) anywhere — instantly find an order, customer or product.' },
    },
    finale: {
      title: '🚀 All set!',
      description: 'Where to start?',
      cta: { products: 'Add a product', orders: 'Create an order', settings: 'Settings' },
    },
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function WelcomeTour() {
  const { user } = useAuthStore();
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(TOUR_KEY)) return;

    const s = I[locale] || I.uk;

    const finaleHtml = `
      <div>${escapeHtml(s.finale.description)}</div>
      <div class="tour-action-row">
        <a class="tour-action-chip primary" data-action="products">📦 ${escapeHtml(s.finale.cta.products)}</a>
        <a class="tour-action-chip" data-action="orders">🛒 ${escapeHtml(s.finale.cta.orders)}</a>
        <a class="tour-action-chip" data-action="settings">⚙️ ${escapeHtml(s.finale.cta.settings)}</a>
      </div>
    `;

    const onPopoverClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const actionBtn = target.closest<HTMLAnchorElement>('[data-action]');
      if (actionBtn) {
        const action = actionBtn.getAttribute('data-action');
        try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
        driverRef.current?.destroy();
        if (action === 'products') router.push('/products');
        else if (action === 'orders') router.push('/orders');
        else if (action === 'settings') router.push('/settings');
      }
    };

    document.addEventListener('click', onPopoverClick);

    const timer = setTimeout(() => {
      const d = driver({
        showProgress: true,
        animate: true,
        nextBtnText: s.ui.next,
        prevBtnText: s.ui.prev,
        doneBtnText: s.ui.done,
        progressText: s.ui.progress,
        steps: [
          { popover: { title: s.intro.title, description: s.intro.description } },
          { element: '[data-tour="orders"]',    popover: { ...s.steps.orders, side: 'right', align: 'start' } },
          { element: '[data-tour="customers"]', popover: { ...s.steps.customers, side: 'right', align: 'start' } },
          { element: '[data-tour="products"]',  popover: { ...s.steps.products, side: 'right', align: 'start' } },
          { element: '[data-tour="analytics"]', popover: { ...s.steps.analytics, side: 'right', align: 'start' } },
          { element: '[data-tour="settings"]',  popover: { ...s.steps.callCenter, side: 'right', align: 'start' } },
          { element: '[data-tour="settings"]',  popover: { ...s.steps.webhook, side: 'right', align: 'start' } },
          { element: '[data-tour="settings"]',  popover: { ...s.steps.settings, side: 'right', align: 'start' } },
          { element: '[data-tour="search"]',    popover: { ...s.steps.search, side: 'bottom', align: 'end' } },
          { popover: { title: s.finale.title, description: finaleHtml } },
        ],
        onDestroyed: () => {
          try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
        },
      });
      driverRef.current = d;
      d.drive();
    }, 600);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onPopoverClick);
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [user, locale, router]);

  return null;
}
