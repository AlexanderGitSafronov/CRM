import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../services/prisma';

// UNAUTHENTICATED public router. Mounted at /api/public (см. routes/index.ts) и
// НЕ оборачивается middleware authenticate — это страница отслеживания заказа клиентом
// по непредсказуемому publicToken. Отдаём только безопасную проекцию: никаких телефонов,
// email, адресов, менеджера, сумм (кроме названий позиций), внутренних id, organizationId.

const router = Router();

// Человекочитаемые украинские метки статусов заказа.
const STATUS_LABELS: Record<string, string> = {
  NEW: 'Нове',
  PROCESSING: 'В обробці',
  CONFIRMED: 'Підтверджено',
  CALLED: 'Прозвонено',
  NO_ANSWER: 'Немає відповіді',
  SHIPPED: 'Відправлено',
  DELIVERED: 'Доставлено',
  CANCELLED: 'Скасовано',
  RETURNED: 'Повернено',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

// Публичный эндпоинт — без авторизации. Свой rate-limiter (60/мин на IP) поверх
// глобального /api лимитера, т.к. это публично доступная по токену страница.
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Забагато запитів, спробуйте пізніше' },
});

router.get('/track/:token', trackLimiter, async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(404).json({ error: 'Замовлення не знайдено' });
  }

  const order = await prisma.order.findUnique({
    where: { publicToken: token },
    select: {
      orderNum: true,
      status: true,
      trackingNumber: true,
      deliveryService: true,
      deliveryCity: true,
      createdAt: true,
      shippedAt: true,
      deliveredAt: true,
      npArrivedAt: true,
      items: { select: { name: true, quantity: true } },
    },
  });

  if (!order) {
    return res.status(404).json({ error: 'Замовлення не знайдено' });
  }

  // Безопасная проекция: НИКАКИХ phone/email/address, manager, total, id, organizationId.
  return res.json({
    orderNum: order.orderNum,
    status: order.status,
    statusText: statusLabel(order.status),
    trackingNumber: order.trackingNumber,
    deliveryService: order.deliveryService,
    deliveryCity: order.deliveryCity,
    createdAt: order.createdAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    npArrivedAt: order.npArrivedAt,
    items: order.items.map((it) => ({ name: it.name, quantity: it.quantity })),
  });
});

export default router;
