'use client';

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuthStore } from '@/stores/authStore';

const TOUR_KEY = 'crm_tour_done_v1';

export function WelcomeTour() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(TOUR_KEY)) return;

    // Wait for the dashboard to mount
    const timer = setTimeout(() => {
      const d = driver({
        showProgress: true,
        animate: true,
        nextBtnText: 'Далі →',
        prevBtnText: '← Назад',
        doneBtnText: 'Готово ✓',
        progressText: '{{current}} з {{total}}',
        steps: [
          {
            popover: {
              title: '👋 Ласкаво просимо!',
              description: 'Покажу вам ключові розділи за 30 секунд. Ви завжди зможете знайти їх у бічній панелі.',
            },
          },
          {
            element: '[data-tour="orders"]',
            popover: {
              title: '🛒 Заказы',
              description: 'Тут усі ваші замовлення. Можна перетягувати картки між статусами (kanban) або працювати в таблиці.',
              side: 'right', align: 'start',
            },
          },
          {
            element: '[data-tour="customers"]',
            popover: {
              title: '👥 Клієнти',
              description: 'База клієнтів з історією замовлень. Підтримує імпорт CSV для міграції з інших систем.',
              side: 'right', align: 'start',
            },
          },
          {
            element: '[data-tour="products"]',
            popover: {
              title: '📦 Товари',
              description: 'Каталог із залишками. Поставте поріг — і отримуйте сповіщення коли товар закінчується.',
              side: 'right', align: 'start',
            },
          },
          {
            element: '[data-tour="analytics"]',
            popover: {
              title: '📊 Аналітика',
              description: 'Виручка, конверсія, % викупу, топ менеджерів — все, щоб розуміти бізнес.',
              side: 'right', align: 'start',
            },
          },
          {
            element: '[data-tour="settings"]',
            popover: {
              title: '⚙️ Налаштування',
              description: 'Користувачі, інтеграції (Telegram, Нова Пошта), webhook для лендингу, брендинг та шаблони.',
              side: 'right', align: 'start',
            },
          },
          {
            element: '[data-tour="search"]',
            popover: {
              title: '🔍 Швидкий пошук',
              description: 'Натисніть ⌘K (Ctrl+K) у будь-якому місці — і миттєво знайдете заказ, клієнта чи товар.',
              side: 'bottom', align: 'end',
            },
          },
          {
            popover: {
              title: '🚀 Все готово!',
              description: 'Створіть перший товар → перший заказ → налаштуйте Telegram-бот. Питання? Пишіть у підтримку.',
            },
          },
        ],
        onDestroyed: () => {
          localStorage.setItem(TOUR_KEY, '1');
        },
      });
      d.drive();
    }, 800);

    return () => clearTimeout(timer);
  }, [user]);

  return null;
}
