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

  // Fetch delivered and returned items separately for redemption rate
  const [deliveredItems, returnedItems] = await Promise.all([
    prisma.orderItem.findMany({
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
        product: { select: { purchasePrice: true } },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: 'RETURNED',
          ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
        },
      },
      select: { name: true, quantity: true, productId: true },
    }),
  ]);

  type ProductRow = {
    name: string;
    revenue: number;
    quantity: number;
    cost: number;
    profit: number;
    returned: number;
    redemptionRate: number;
  };

  const byProduct: Record<string, ProductRow> = {};

  deliveredItems.forEach((item) => {
    const key = item.productId || item.name;
    if (!byProduct[key]) {
      byProduct[key] = { name: item.name, revenue: 0, quantity: 0, cost: 0, profit: 0, returned: 0, redemptionRate: 100 };
    }
    const purchasePrice = item.product?.purchasePrice ?? 0;
    byProduct[key].revenue += item.price * item.quantity;
    byProduct[key].quantity += item.quantity;
    byProduct[key].cost += purchasePrice * item.quantity;
    byProduct[key].profit += (item.price - purchasePrice) * item.quantity;
  });

  returnedItems.forEach((item) => {
    const key = item.productId || item.name;
    if (byProduct[key]) {
      byProduct[key].returned += item.quantity;
    }
  });

  // Calculate redemption rate: delivered / (delivered + returned)
  Object.values(byProduct).forEach((p) => {
    const total = p.quantity + p.returned;
    p.redemptionRate = total > 0 ? Math.round((p.quantity / total) * 100 * 10) / 10 : 100;
  });

  const sorted = Object.values(byProduct)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, parseInt(limit));

  return res.json(sorted);
};

export const getRevenueBySource = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  const [totalBySource, activeBySource] = await Promise.all([
    // All orders by source
    prisma.order.groupBy({
      by: ['source'],
      where: createdAtFilter,
      _count: { id: true },
    }),
    // Non-cancelled/returned: revenue + count
    prisma.order.groupBy({
      by: ['source'],
      where: { ...createdAtFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      _sum: { total: true },
      _count: { id: true },
    }),
  ]);

  const activeMap = new Map(activeBySource.map((r) => [r.source, r]));

  const SOURCE_LABELS: Record<string, string> = {
    WEBSITE: 'Сайт',
    LANDING: 'Лендинг',
    MAGAZ: 'Магазин',
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    MANUAL: 'Менеджер',
    TELEGRAM: 'Telegram',
    WEBHOOK: 'Webhook',
  };

  const data = totalBySource
    .map((row) => {
      const active = activeMap.get(row.source);
      const total = row._count.id;
      const converted = active?._count.id ?? 0;
      const revenue = active?._sum.total ?? 0;
      return {
        source: row.source,
        label: SOURCE_LABELS[row.source] ?? row.source,
        total,
        converted,
        cancelled: total - converted,
        revenue,
        conversion: total > 0 ? Math.round((converted / total) * 100 * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return res.json(data);
};

export const getConversionByManager = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  const managers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, active: true },
    select: { id: true, name: true },
  });

  const data = await Promise.all(
    managers.map(async (m) => {
      const orders = await prisma.order.findMany({
        where: { managerId: m.id, ...createdAtFilter },
        select: {
          status: true,
          createdAt: true,
          history: {
            where: { action: 'STATUS_CHANGED', oldValue: 'NEW' },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      if (!orders.length) return null;

      const total = orders.length;
      const confirmed = orders.filter((o) =>
        ['CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(o.status),
      ).length;
      const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;
      const still_new = orders.filter((o) => o.status === 'NEW').length;

      // Average response time: time from order.createdAt to first status change from NEW
      const responseTimes = orders
        .filter((o) => o.history.length > 0)
        .map((o) => (o.history[0].createdAt.getTime() - o.createdAt.getTime()) / 60000); // minutes

      const avgResponseMinutes =
        responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null;

      return {
        manager: m.name,
        managerId: m.id,
        total,
        confirmed,
        cancelled,
        stillNew: still_new,
        conversion: total > 0 ? Math.round((confirmed / total) * 100 * 10) / 10 : 0,
        avgResponseMinutes,
      };
    }),
  );

  return res.json(
    data
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => b.total - a.total),
  );
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

// GET /api/analytics/redemption-rate
// % выкупа: DELIVERED / (DELIVERED + RETURNED) — реальная метрика для товарки
export const getRedemptionRate = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  const [shipped, delivered, returned] = await Promise.all([
    prisma.order.count({ where: { ...createdAtFilter, status: 'SHIPPED' } }),
    prisma.order.count({ where: { ...createdAtFilter, status: 'DELIVERED' } }),
    prisma.order.count({ where: { ...createdAtFilter, status: 'RETURNED' } }),
  ]);

  const resolved = delivered + returned; // посылки у которых уже известна судьба
  const redemptionRate = resolved > 0 ? Math.round((delivered / resolved) * 100 * 10) / 10 : null;

  // Revenue from delivered orders (реальные деньги)
  const revenueResult = await prisma.order.aggregate({
    where: { ...createdAtFilter, status: 'DELIVERED' },
    _sum: { total: true },
  });

  // Average order value for delivered
  const avgOrderValue = delivered > 0
    ? Math.round((revenueResult._sum.total ?? 0) / delivered)
    : 0;

  // Trend: compare to previous equal period
  let prevRedemptionRate: number | null = null;
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const periodMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodMs);
    const prevTo = new Date(from.getTime() - 1);

    const [prevDelivered, prevReturned] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: prevFrom, lte: prevTo }, status: 'DELIVERED' } }),
      prisma.order.count({ where: { createdAt: { gte: prevFrom, lte: prevTo }, status: 'RETURNED' } }),
    ]);

    const prevResolved = prevDelivered + prevReturned;
    prevRedemptionRate = prevResolved > 0
      ? Math.round((prevDelivered / prevResolved) * 100 * 10) / 10
      : null;
  }

  return res.json({
    shipped,
    delivered,
    returned,
    resolved,
    redemptionRate,
    prevRedemptionRate,
    realRevenue: revenueResult._sum.total ?? 0,
    avgOrderValue,
  });
};

// GET /api/analytics/cancel-reasons
// Топ причин отказа по количеству за период
export const getCancelReasons = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  const cancelled = await prisma.order.findMany({
    where: { ...createdAtFilter, status: 'CANCELLED' },
    select: { cancelReason: true, managerId: true, manager: { select: { name: true } } },
  });

  const total = cancelled.length;

  // Group by reason
  const reasonMap: Record<string, number> = {};
  cancelled.forEach((o) => {
    const reason = o.cancelReason?.trim() || 'Не вказано';
    reasonMap[reason] = (reasonMap[reason] ?? 0) + 1;
  });

  const byReason = Object.entries(reasonMap)
    .map(([reason, count]) => ({
      reason,
      count,
      percent: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Group by manager
  const managerMap: Record<string, { name: string; count: number }> = {};
  cancelled.forEach((o) => {
    if (!o.managerId) return;
    const key = o.managerId;
    if (!managerMap[key]) managerMap[key] = { name: o.manager?.name ?? 'Unknown', count: 0 };
    managerMap[key].count++;
  });

  const byManager = Object.values(managerMap).sort((a, b) => b.count - a.count);

  return res.json({ total, byReason, byManager });
};

// GET /api/analytics/customer-ltv
// LTV клиентов: средний чек, повторные покупки, топ клиентов
export const getCustomerLtv = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo, limit = '20' } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  // Customers with more than 1 order (repeat buyers)
  const customers = await prisma.customer.findMany({
    where: {
      orders: {
        some: { ...createdAtFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      orders: {
        where: { ...createdAtFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const withStats = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    ordersCount: c.orders.length,
    ltv: c.orders.reduce((s, o) => s + o.total, 0),
    avgOrder: c.orders.length > 0 ? Math.round(c.orders.reduce((s, o) => s + o.total, 0) / c.orders.length) : 0,
    firstOrder: c.orders[0]?.createdAt ?? null,
    lastOrder: c.orders[c.orders.length - 1]?.createdAt ?? null,
  }));

  const sorted = withStats
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, parseInt(limit));

  const repeatBuyers = withStats.filter((c) => c.ordersCount > 1).length;
  const totalWithOrders = withStats.length;
  const repeatRate = totalWithOrders > 0 ? Math.round((repeatBuyers / totalWithOrders) * 100 * 10) / 10 : 0;

  const avgLtv = withStats.length > 0
    ? Math.round(withStats.reduce((s, c) => s + c.ltv, 0) / withStats.length)
    : 0;

  return res.json({ customers: sorted, repeatBuyers, totalWithOrders, repeatRate, avgLtv });
};

// GET /api/analytics/cc-stats
// Дашборд колл-центра: сколько обзвонено, % подтверждений, по операторам
export const getCcStats = async (req: AuthRequest, res: Response) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }
  const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    todayOrders,
    todayCalled,
    todayConfirmed,
    todayCancelled,
    todayNoAnswer,
    periodOrders,
    periodCalled,
    periodConfirmed,
    periodCancelled,
    periodNoAnswer,
    pendingCallbacks,
    overdueCallbacks,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart }, status: { in: ['CALLED', 'CONFIRMED', 'CANCELLED'] } } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart }, status: 'CONFIRMED' } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart }, status: 'CANCELLED' } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart }, status: 'NO_ANSWER' } }),
    prisma.order.count({ where: createdAtFilter }),
    prisma.order.count({ where: { ...createdAtFilter, status: { in: ['CALLED', 'CONFIRMED', 'CANCELLED'] } } }),
    prisma.order.count({ where: { ...createdAtFilter, status: 'CONFIRMED' } }),
    prisma.order.count({ where: { ...createdAtFilter, status: 'CANCELLED' } }),
    prisma.order.count({ where: { ...createdAtFilter, status: 'NO_ANSWER' } }),
    prisma.callback.count({ where: { done: false, scheduledAt: { gte: now } } }),
    prisma.callback.count({ where: { done: false, scheduledAt: { lt: now } } }),
  ]);

  // Per-operator stats (CALL_CENTER + ADMIN)
  const operators = await prisma.user.findMany({
    where: { role: { in: ['CALL_CENTER', 'ADMIN'] }, active: true },
    select: { id: true, name: true },
  });

  const operatorStats = await Promise.all(
    operators.map(async (op) => {
      const [total, confirmed, cancelled, noAnswer] = await Promise.all([
        prisma.order.count({ where: { ...createdAtFilter, managerId: op.id } }),
        prisma.order.count({ where: { ...createdAtFilter, managerId: op.id, status: 'CONFIRMED' } }),
        prisma.order.count({ where: { ...createdAtFilter, managerId: op.id, status: 'CANCELLED' } }),
        prisma.order.count({ where: { ...createdAtFilter, managerId: op.id, status: 'NO_ANSWER' } }),
      ]);
      const called = confirmed + cancelled;
      return {
        operatorId: op.id,
        name: op.name,
        total,
        called,
        confirmed,
        cancelled,
        noAnswer,
        confirmRate: called > 0 ? Math.round((confirmed / called) * 100 * 10) / 10 : null,
      };
    }),
  );

  // Top cancel reasons for period
  const cancelledOrders = await prisma.order.findMany({
    where: { ...createdAtFilter, status: 'CANCELLED' },
    select: { cancelReason: true },
  });
  const reasonMap: Record<string, number> = {};
  cancelledOrders.forEach((o) => {
    const r = o.cancelReason?.trim() || 'Не вказано';
    reasonMap[r] = (reasonMap[r] ?? 0) + 1;
  });
  const topCancelReasons = Object.entries(reasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  const todayConfirmRate = todayCalled > 0 ? Math.round((todayConfirmed / todayCalled) * 100 * 10) / 10 : null;
  const periodConfirmRate = periodCalled > 0 ? Math.round((periodConfirmed / periodCalled) * 100 * 10) / 10 : null;

  return res.json({
    today: {
      orders: todayOrders,
      called: todayCalled,
      confirmed: todayConfirmed,
      cancelled: todayCancelled,
      noAnswer: todayNoAnswer,
      confirmRate: todayConfirmRate,
    },
    period: {
      orders: periodOrders,
      called: periodCalled,
      confirmed: periodConfirmed,
      cancelled: periodCancelled,
      noAnswer: periodNoAnswer,
      confirmRate: periodConfirmRate,
    },
    pendingCallbacks,
    overdueCallbacks,
    operators: operatorStats.filter((o) => o.total > 0).sort((a, b) => b.total - a.total),
    topCancelReasons,
  });
};

// GET /api/analytics/kpi
// Ключевые метрики для дашборда: сегодня, 30 дней, redemption rate, в пути
export const getKpi = async (_req: AuthRequest, res: Response) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    todayOrders,
    todayRevenue,
    monthOrders,
    monthRevenue,
    monthExpenses,
    inTransit,
    delivered30,
    returned30,
    pendingCallbacks,
    weeklyOrders,
    newOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: todayStart }, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: thirtyDaysAgo }, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.order.count({ where: { status: 'SHIPPED' } }),
    prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo }, status: 'DELIVERED' } }),
    prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo }, status: 'RETURNED' } }),
    prisma.callback.count({ where: { done: false, scheduledAt: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } } }),
    prisma.order.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.order.count({ where: { status: 'NEW' } }),
  ]);

  const monthRevenueVal = monthRevenue._sum.total ?? 0;
  const monthExpensesVal = monthExpenses._sum.amount ?? 0;
  const resolved = delivered30 + returned30;
  const redemptionRate = resolved > 0 ? Math.round((delivered30 / resolved) * 100 * 10) / 10 : null;

  return res.json({
    today: {
      orders: todayOrders,
      revenue: todayRevenue._sum.total ?? 0,
    },
    month: {
      orders: monthOrders,
      revenue: monthRevenueVal,
      expenses: monthExpensesVal,
      profit: monthRevenueVal - monthExpensesVal,
    },
    inTransit,
    newOrders,
    redemptionRate,
    delivered30,
    returned30,
    pendingCallbacks,
    weeklyOrders,
  });
};
