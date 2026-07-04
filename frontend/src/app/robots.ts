import type { MetadataRoute } from 'next';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://crmpro-gamma.vercel.app').replace(/\/+$/, '');

// Индексируем только публичные страницы. Приватная зона приложения и публичные
// страницы отслеживания (customer PII/номер заказа по токену) закрыты от краулеров.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/register', '/forgot-password'],
      disallow: [
        '/dashboard',
        '/orders',
        '/customers',
        '/products',
        '/analytics',
        '/settings',
        '/goals',
        '/notifications',
        '/cc',
        '/t/',
        '/reset-password',
        '/verify-email',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
