'use client';

import './globals.css';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

// Inline splash CSS — must paint before the main bundle to cover the
// PWA cold-start white flash. body.hydrated triggers the fade-out.
const splashCss = `
  #splash {
    position: fixed; inset: 0; z-index: 99999;
    background: #7c3aed;
    display: flex; align-items: center; justify-content: center;
    transition: opacity 0.35s ease, visibility 0.35s ease;
  }
  body.hydrated #splash { opacity: 0; visibility: hidden; pointer-events: none; }
  .splash-tile {
    width: 96px; height: 96px; border-radius: 24px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6, #d946ef);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 20px 60px -10px rgba(0,0,0,0.35);
    animation: splashPulse 1.4s ease-in-out infinite;
  }
  .splash-tile svg { width: 48px; height: 48px; fill: #fff; }
  @keyframes splashPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Reveal the app — fades the splash overlay.
  useEffect(() => {
    document.body.classList.add('hydrated');
    // Failsafe: clean DOM after the fade animation runs
    const t = setTimeout(() => document.getElementById('splash')?.remove(), 600);
    return () => clearTimeout(t);
  }, []);

  // Register the minimal service worker so Chrome/Edge show the "Install app" prompt.
  // iOS doesn't need a SW for Add-to-Home-Screen but is fine with one being present.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://crmpro-gamma.vercel.app').replace(/\/+$/, '');
  const siteTitle = 'CRM Pro — CRM для товарного бізнесу: замовлення, Нова Пошта, аналітика';
  const siteDesc = 'CRM Pro — система для товарного бізнесу: замовлення, кол-центр, інтеграція з Новою Поштою, аналітика грошей і виручки. Почніть безкоштовно.';
  const ogImage = `${siteUrl}/icon-512.png`;

  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <title>{siteTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content={siteDesc} />
        <link rel="canonical" href={siteUrl} />
        {/* Open Graph — превью в Facebook/Telegram/Viber (каналы, где продукт продаётся) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="CRM Pro" />
        <meta property="og:title" content={siteTitle} />
        <meta property="og:description" content={siteDesc} />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:locale" content="uk_UA" />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={siteTitle} />
        <meta name="twitter:description" content={siteDesc} />
        <meta name="twitter:image" content={ogImage} />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="application-name" content="CRM Pro" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="CRM Pro" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: splashCss }} />
      </head>
      <body>
        <div id="splash" aria-hidden="true">
          <div className="splash-tile">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 2 L3 14 H12 L11 22 L21 10 H12 L13 2 Z" />
            </svg>
          </div>
        </div>
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
