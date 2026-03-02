import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';

export const getSummary = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  const [
    totalOrders,
    newOrders,
    deliveredOrders,
    cancelledOrders,
    revenueResult,
    newCustomers,
    totalCustomers,
    totalProducts,
    lowStockProducts,
    unreadNotifications,
  ] = await Promise.all([
    prisma.order.count({ where: createdAtFilter }),
    prisma.order.count({ where: { ...createdAtFilter, status: 'NEW' } }),
    prisma.order.count({ where: { ...createdAtFilter, status: 'DELIVERED' } }),
    prisma.order.count({ where: { ...createdAtFilter, status: 'CANCELLED' } }),
    prisma.order.aggregate({
      where: { ...createdAtFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      _sum: { total: true },
    }),
    prisma.customer.count({ where: createdAtFilter }),
    prisma.customer.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { stock: { lt: 5 }, active: true } }),
    prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
  ]);

  // Get expenses for the period
  const expenses = await prisma.expense.aggregate({
    where: dateFrom || dateTo ? { date: dateFilter } : {},
    _sum: { amount: true },
  });

  const revenue = revenueResult._sum.total || 0;
  const totalExpenses = expenses._sum.amount || 0;

  return res.json({
    orders: {
      total: totalOrders,
      new: newOrders,
      delivered: deliveredOrders,
      cancelled: cancelledOrders,
    },
    revenue,
    expenses: totalExpenses,
    profit: revenue - totalExpenses,
    customers: {
      new: newCustomers,
      total: totalCustomers,
    },
    products: {
      total: totalProducts,
      lowStock: lowStockProducts,
    },
    unreadNotifications,
  });
};

export const getOrdersByDay = async (req: AuthRequest, res: Response) => {
  const { days = '30' } = req.query as Record<string, string>;
  const daysNum = Math.min(365, Math.max(7, parseInt(days)));

  // Use UTC-based arithmetic so day keys match order createdAt UTC dates
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = new Date(todayUTC - (daysNum - 1) * 86400000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: from } },
    select: { createdAt: true, total: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  // Group by UTC day — same key format as createdAt.toISOString()
  const byDay: Record<string, { date: string; orders: number; revenue: number }> = {};

  for (let i = 0; i < daysNum; i++) {
    const d = new Date(from.getTime() + i * 86400000);
    const key = d.toISOString().split('T')[0];
    byDay[key] = { date: key, orders: 0, revenue: 0 };
  }

  orders.forEach((o) => {
    const key = o.createdAt.toISOString().split('T')[0];
    if (byDay[key]) {
      byDay[key].orders++;
      if (!['CANCELLED', 'RETURNED'].includes(o.status)) {
        byDay[key].revenue += o.total;
      }
    }
  });

  return res.json(Object.values(byDay));
};

export const getRevenueByManager = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const managers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true, name: true },
  });

  const data = await Promise.all(
    managers.map(async (m) => {
      const result = await prisma.order.aggregate({
        where: {
          managerId: m.id,
          status: { notIn: ['CANCELLED', 'RETURNED'] },
          ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
        },
        _sum: { total: true },
        _count: { id: true },
      });
      return {
        manager: m.name,
        revenue: result._sum.total || 0,
        orders: result._count.id,
      };
    })
  );

  return res.json(data.filter((d) => d.orders > 0).sort((a, b) => b.revenue - a.revenue));
};

export const getRevenueByProduct = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo, limit = '10' } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        status: { notIn: ['CANCELLED', 'RETURNED'] },
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      },
    },
    select: {
      name: true,
      quantity: true,
      price: true,
      productId: true,
    },
  });

  const byProduct: Record<string, { name: string; revenue: number; quantity: number }> = {};
  items.forEach((item) => {
    const key = item.productId || item.name;
    if (!byProduct[key]) {
      byProduct[key] = { name: item.name, revenue: 0, quantity: 0 };
    }
    byProduct[key].revenue += item.price * item.quantity;
    byProduct[key].quantity += item.quantity;
  });

  const sorted = Object.values(byProduct)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, parseInt(limit));

  return res.json(sorted);
};

export const getExpenses = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo, category, page = '1', limit = '20' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) (where.date as Record<string, Date>).gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      (where.date as Record<string, Date>).lte = end;
    }
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));

  const [expenses, total, totalAmount] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  return res.json({
    expenses,
    total: totalAmount._sum.amount || 0,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
};

export const createExpense = async (req: AuthRequest, res: Response) => {
  const { category, amount, description, date } = req.body;

  const validCategories = ['ADVERTISING', 'SERVICES', 'PURCHASE', 'OTHER'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Valid amount required' });
  }

  const expense = await prisma.expense.create({
    data: {
      category,
      amount: parseFloat(amount),
      description: description?.trim() || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  await logActivity({
    userId: req.user?.id,
    action: 'EXPENSE_CREATED',
    entityType: 'Expense',
    entityId: expense.id,
    details: `${category}: ${expense.amount}`,
    ip: req.ip,
  });

  return res.status(201).json(expense);
};

export const deleteExpense = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) {
    return res.status(404).json({ error: 'Расход не найден' });
  }

  await prisma.expense.delete({ where: { id } });

  await logActivity({
    userId: req.user?.id,
    action: 'EXPENSE_DELETED',
    entityType: 'Expense',
    entityId: id,
    details: `${expense.category}: ${expense.amount}`,
    ip: req.ip,
  });

  return res.json({ message: 'Expense deleted' });
};
