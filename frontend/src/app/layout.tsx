'use client';

import './globals.css';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <title>CRM — Управление заказами</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Современная CRM система для товарного бизнеса" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            className: '!bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-gray-100 !shadow-lg',
            success: { iconTheme: { primary: '#22c55e', secondary: 'white' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
          }}
        />
      </body>
    </html>
  );
}
