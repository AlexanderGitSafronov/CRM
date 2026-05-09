import { Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';

export const exportOrders = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { status, dateFrom, dateTo, format = 'csv' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { organizationId: orgId };
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
    NEW: 'Новый', PROCESSING: 'В обработке', CONFIRMED: 'Подтверждён',
    SHIPPED: 'Отправлен', DELIVERED: 'Доставлен', CANCELLED: 'Отказ', RETURNED: 'Возврат',
  };
  const SOURCE_LABELS: Record<string, string> = {
    WEBSITE: 'Сайт', LANDING: 'Лендинг', FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram',
    MANUAL: 'Менеджер', TELEGRAM: 'Telegram', WEBHOOK: 'Webhook',
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
    res.setHeader('Content-Disposition', `attachment; filename="orders_${new Date().toISOString().split('T')[0]}.json"`);
    return res.json(rows);
  }

  const csv = stringify(rows, { header: true, delimiter: ';' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders_${new Date().toISOString().split('T')[0]}.csv"`);
  return res.send('﻿' + csv);
};

export const exportFinances = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  const orderWhere = {
    organizationId: orgId,
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };
  const expenseWhere = {
    organizationId: orgId,
    ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
  };

  const [expenses, deliveredOrders] = await Promise.all([
    prisma.expense.findMany({ where: expenseWhere, orderBy: { date: 'desc' } }),
    prisma.order.findMany({
      where: { ...orderWhere, status: 'DELIVERED' },
      select: { orderNum: true, total: true, createdAt: true, source: true, customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const EXPENSE_LABELS: Record<string, string> = {
    ADVERTISING: 'Реклама', SERVICES: 'Услуги', PURCHASE: 'Закупка', OTHER: 'Прочее',
  };

  const expenseRows = expenses.map((e) => ({
    'Тип': 'Расход',
    'Дата': new Date(e.date).toLocaleDateString('uk-UA'),
    'Категория/Источник': EXPENSE_LABELS[e.category] || e.category,
    'Описание': e.description || '',
    'Сумма': -e.amount,
  }));

  const revenueRows = deliveredOrders.map((o) => ({
    'Тип': 'Доход',
    'Дата': o.createdAt.toLocaleDateString('uk-UA'),
    'Категория/Источник': o.source,
    'Описание': `Замовлення #${o.orderNum} — ${o.customer.name}`,
    'Сумма': o.total,
  }));

  const allRows = [...revenueRows, ...expenseRows].sort((a, b) =>
    new Date(b['Дата']).getTime() - new Date(a['Дата']).getTime()
  );

  const totalRevenue = deliveredOrders.reduce((s, o) => s + o.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  allRows.push({ 'Тип': '', 'Дата': '', 'Категория/Источник': 'ИТОГО ДОХОДОВ', 'Описание': '', 'Сумма': totalRevenue });
  allRows.push({ 'Тип': '', 'Дата': '', 'Категория/Источник': 'ИТОГО РАСХОДОВ', 'Описание': '', 'Сумма': -totalExpenses });
  allRows.push({ 'Тип': '', 'Дата': '', 'Категория/Источник': 'ЧИСТАЯ ПРИБЫЛЬ', 'Описание': '', 'Сумма': totalRevenue - totalExpenses });

  const csv = stringify(allRows, { header: true, delimiter: ';' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="finances_${new Date().toISOString().split('T')[0]}.csv"`);
  return res.send('﻿' + csv);
};

export const getActivityLogs = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { userId, action, entityType, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { organizationId: orgId };
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
