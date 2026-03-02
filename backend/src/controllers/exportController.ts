import { Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';

export const exportOrders = async (req: AuthRequest, res: Response) => {
  const { status, dateFrom, dateTo, format = 'csv' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (status && status !== 'ALL') where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, Date>).gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, Date>).lte = end;
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true, email: true, city: true } },
      manager: { select: { name: true } },
      items: { select: { name: true, quantity: true, price: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const STATUS_LABELS: Record<string, string> = {
    NEW: 'Новый',
    PROCESSING: 'В обработке',
    CONFIRMED: 'Подтверждён',
    SHIPPED: 'Отправлен',
    DELIVERED: 'Доставлен',
    CANCELLED: 'Отказ',
    RETURNED: 'Возврат',
  };

  const SOURCE_LABELS: Record<string, string> = {
    WEBSITE: 'Сайт',
    LANDING: 'Лендинг',
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    MANUAL: 'Менеджер',
    TELEGRAM: 'Telegram',
    WEBHOOK: 'Webhook',
  };

  const rows = orders.map((o) => ({
    '№ заказа': o.orderNum,
    'Дата создания': o.createdAt.toLocaleString('uk-UA'),
    'Клиент': o.customer.name,
    'Телефон': o.customer.phone,
    'Email': o.customer.email || '',
    'Город': o.customer.city || '',
    'Товары': o.items.map((i) => `${i.name} x${i.quantity}`).join('; '),
    'Кол-во': o.items.reduce((s, i) => s + i.quantity, 0),
    'Сумма': o.total,
    'Статус': STATUS_LABELS[o.status] || o.status,
    'Источник': SOURCE_LABELS[o.source] || o.source,
    'Менеджер': o.manager?.name || '',
    'Комментарий': o.comment || '',
  }));

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orders_${new Date().toISOString().split('T')[0]}.json"`
    );
    return res.json(rows);
  }

  const csv = stringify(rows, { header: true, delimiter: ';' });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="orders_${new Date().toISOString().split('T')[0]}.csv"`
  );
  // Add BOM for Excel
  return res.send('\uFEFF' + csv);
};

export const getActivityLogs = async (req: AuthRequest, res: Response) => {
  const { userId, action, entityType, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (action) where.action = { contains: action };
  if (entityType) where.entityType = entityType;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, parseInt(limit));

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return res.json({
    logs,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
};
