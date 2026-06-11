import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';

const dateRange = (dateFrom?: string, dateTo?: string) => {
  const f: Record<string, Date> = {};
  if (dateFrom) f.gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    f.lte = end;
  }
  return f;
};

export const getSummary = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);
  const createdAtFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
  const orgFilter = { organizationId: orgId, ...createdAtFilter };
  // Realized money is counted only for DELIVERED orders and is attributed
  // to the date the parcel was actually picked up (deliveredAt), not createdAt.
  const deliveredAtFilter = Object.keys(dateFilter).length ? { deliveredAt: dateFilter } : {};

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
    prisma.order.count({ where: orgFilter }),
    prisma.order.count({ where: { ...orgFilter, status: 'NEW' } }),
    prisma.order.count({ where: { ...orgFilter, status: 'DELIVERED' } }),
    prisma.order.count({ where: { ...orgFilter, status: 'CANCELLED' } }),
    prisma.order.aggregate({
      where: { organizationId: orgId, status: 'DELIVERED', ...deliveredAtFilter },
      _sum: { total: true },
    }),
    prisma.customer.count({ where: { organizationId: orgId, ...createdAtFilter } }),
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.product.count({ where: { organizationId: orgId, active: true } }),
    prisma.product.count({ where: { organizationId: orgId, stock: { lt: 5 }, active: true } }),
    prisma.notification.count({ where: { organizationId: orgId, userId: req.user!.id, read: false } }),
  ]);

  const expenses = await prisma.expense.aggregate({
    where: { organizationId: orgId, ...(dateFrom || dateTo ? { date: dateFilter } : {}) },
    _sum: { amount: true },
  });

  const revenue = revenueResult._sum.total || 0;
  const totalExpenses = expenses._sum.amount || 0;

  return res.json({
    orders: { total: totalOrders, new: newOrders, delivered: deliveredOrders, cancelled: cancelledOrders },
    revenue,
    expenses: totalExpenses,
    profit: revenue - totalExpenses,
    customers: { new: newCustomers, total: totalCustomers },
    products: { total: totalProducts, lowStock: lowStockProducts },
    unreadNotifications,
  });
};

export const getOrdersByDay = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { days = '30' } = req.query as Record<string, string>;
  const daysNum = Math.min(365, Math.max(7, parseInt(days)));

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = new Date(todayUTC - (daysNum - 1) * 86400000);

  const orders = await prisma.order.findMany({
    where: { organizationId: orgId, createdAt: { gte: from } },
    select: { createdAt: true, total: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

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
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);

  const managers = await prisma.user.findMany({
    where: { organizationId: orgId, role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true, name: true },
  });

  const data = await Promise.all(
    managers.map(async (m) => {
      // Realized revenue per manager: only DELIVERED orders, attributed by deliveredAt.
      const result = await prisma.order.aggregate({
        where: {
          organizationId: orgId,
          managerId: m.id,
          status: 'DELIVERED',
          ...(Object.keys(dateFilter).length ? { deliveredAt: dateFilter } : {}),
        },
        _sum: { total: true },
        _count: { id: true },
      });
      return { manager: m.name, revenue: result._sum.total || 0, orders: result._count.id };
    })
  );

  return res.json(data.filter((d) => d.orders > 0).sort((a, b) => b.revenue - a.revenue));
};

export const getRevenueByProduct = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo, limit = '10' } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);
  // Realized money side (DELIVERED) is windowed by deliveredAt; the returns side
  // (used for redemption rate) is windowed by returnedAt — both are realized outcomes.
  const deliveredOrderFilter = {
    organizationId: orgId,
    status: 'DELIVERED',
    ...(Object.keys(dateFilter).length ? { deliveredAt: dateFilter } : {}),
  };
  const returnedOrderFilter = {
    organizationId: orgId,
    status: 'RETURNED',
    ...(Object.keys(dateFilter).length ? { returnedAt: dateFilter } : {}),
  };

  // Build the immediately-preceding equal-length window (for trendPct). We only
  // compare the realized-revenue side (DELIVERED by deliveredAt), since that's
  // the money number the verdict cares about. If either bound is missing we can't
  // define a prior period, so trendPct stays null for every product.
  let prevDeliveredFilter:
    | { organizationId: string; status: string; deliveredAt: { gte: Date; lte: Date } }
    | null = null;
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const fromMs = from.getTime();
    const toMs = to.getTime();
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs >= fromMs) {
      const periodMs = toMs - fromMs;
      const prevFrom = new Date(fromMs - periodMs - 1);
      const prevTo = new Date(fromMs - 1);
      prevDeliveredFilter = {
        organizationId: orgId,
        status: 'DELIVERED',
        deliveredAt: { gte: prevFrom, lte: prevTo },
      };
    }
  }

  const [deliveredItems, returnedItems, prevDeliveredItems] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: deliveredOrderFilter,
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
        order: returnedOrderFilter,
      },
      select: { name: true, quantity: true, productId: true },
    }),
    prevDeliveredFilter
      ? prisma.orderItem.findMany({
          where: { order: prevDeliveredFilter },
          select: { name: true, quantity: true, price: true, productId: true },
        })
      : Promise.resolve([] as { name: string; quantity: number; price: number; productId: string | null }[]),
  ]);

  type ProductRow = {
    name: string;
    revenue: number;
    quantity: number;
    cost: number;
    profit: number;
    returned: number;
    redemptionRate: number;
    marginPerUnit: number;
    trendPct: number | null;
    verdict: 'scale' | 'optimize' | 'disable';
  };

  const byProduct: Record<string, ProductRow> = {};

  deliveredItems.forEach((item) => {
    const key = item.productId || item.name;
    if (!byProduct[key]) {
      byProduct[key] = {
        name: item.name, revenue: 0, quantity: 0, cost: 0, profit: 0, returned: 0,
        redemptionRate: 100, marginPerUnit: 0, trendPct: null, verdict: 'optimize',
      };
    }
    const purchasePrice = Number.isFinite(item.product?.purchasePrice) ? (item.product?.purchasePrice ?? 0) : 0;
    byProduct[key].revenue += item.price * item.quantity;
    byProduct[key].quantity += item.quantity;
    byProduct[key].cost += purchasePrice * item.quantity;
    byProduct[key].profit += (item.price - purchasePrice) * item.quantity;
  });

  returnedItems.forEach((item) => {
    const key = item.productId || item.name;
    if (byProduct[key]) byProduct[key].returned += item.quantity;
  });

  // Prior-period revenue per product (delivered side only), used for trendPct.
  const prevRevenue: Record<string, number> = {};
  prevDeliveredItems.forEach((item) => {
    const key = item.productId || item.name;
    const rev = item.price * item.quantity;
    if (Number.isFinite(rev)) prevRevenue[key] = (prevRevenue[key] ?? 0) + rev;
  });

  Object.entries(byProduct).forEach(([key, p]) => {
    const total = p.quantity + p.returned;
    p.redemptionRate = total > 0 ? Math.round((p.quantity / total) * 100 * 10) / 10 : 100;

    // Margin after returns, per delivered unit. profit already nets only delivered
    // items; divide by delivered quantity (guard zero).
    const deliveredQty = Math.max(p.quantity, 1);
    const margin = p.profit / deliveredQty;
    p.marginPerUnit = Number.isFinite(margin) ? Math.round(margin * 100) / 100 : 0;

    // trendPct: revenue change % vs the prior equal-length window. Null if no prior
    // data (can't compute a meaningful % off a zero/absent baseline).
    const prevRev = prevRevenue[key];
    if (prevDeliveredFilter && Number.isFinite(prevRev) && (prevRev ?? 0) > 0) {
      const change = ((p.revenue - (prevRev as number)) / (prevRev as number)) * 100;
      p.trendPct = Number.isFinite(change) ? Math.round(change * 10) / 10 : null;
    } else {
      p.trendPct = null;
    }

    // Owner-facing verdict.
    if (p.profit > 0 && p.redemptionRate >= 70) {
      p.verdict = 'scale';
    } else if (p.profit <= 0 || p.redemptionRate < 50) {
      p.verdict = 'disable';
    } else {
      p.verdict = 'optimize';
    }
  });

  const sorted = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, parseInt(limit));
  return res.json(sorted);
};

export const getRevenueBySource = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);
  // Intake/conversion-funnel side is windowed by createdAt (when the lead came in).
  const orderFilter = {
    organizationId: orgId,
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };

  const [totalBySource, activeBySource, revenueBySource] = await Promise.all([
    prisma.order.groupBy({
      by: ['source'],
      where: orderFilter,
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ['source'],
      where: { ...orderFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      _count: { id: true },
    }),
    // Realized money per source: only DELIVERED orders, attributed by deliveredAt.
    prisma.order.groupBy({
      by: ['source'],
      where: {
        organizationId: orgId,
        status: 'DELIVERED',
        ...(Object.keys(dateFilter).length ? { deliveredAt: dateFilter } : {}),
      },
      _sum: { total: true },
    }),
  ]);

  const activeMap = new Map(activeBySource.map((r) => [r.source, r]));
  const revenueMap = new Map(revenueBySource.map((r) => [r.source, r]));

  const SOURCE_LABELS: Record<string, string> = {
    WEBSITE: 'Сайт', LANDING: 'Лендинг', MAGAZ: 'Магазин', FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram', MANUAL: 'Менеджер', TELEGRAM: 'Telegram', WEBHOOK: 'Webhook',
  };

  const data = totalBySource
    .map((row) => {
      const active = activeMap.get(row.source);
      const total = row._count.id;
      const converted = active?._count.id ?? 0;
      const revenue = revenueMap.get(row.source)?._sum.total ?? 0;
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
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);
  const orderFilter = {
    organizationId: orgId,
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };

  const managers = await prisma.user.findMany({
    where: { organizationId: orgId, role: { in: ['ADMIN', 'MANAGER'] }, active: true },
    select: { id: true, name: true },
  });

  const data = await Promise.all(
    managers.map(async (m) => {
      const orders = await prisma.order.findMany({
        where: { ...orderFilter, managerId: m.id },
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
      const confirmed = orders.filter((o) => ['CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(o.status)).length;
      const cancelled = orders.filter((o) => o.status === 'CANCELLED').length;
      const still_new = orders.filter((o) => o.status === 'NEW').length;

      const responseTimes = orders
        .filter((o) => o.history.length > 0)
        .map((o) => (o.history[0].createdAt.getTime() - o.createdAt.getTime()) / 60000);

      const avgResponseMinutes = responseTimes.length > 0
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
    data.filter((d): d is NonNullable<typeof d> => d !== null).sort((a, b) => b.total - a.total),
  );
};

export const getExpenses = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo, category, page = '1', limit = '20' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { organizationId: orgId };
  if (category) where.category = category;
  if (dateFrom || dateTo) {
    const f = dateRange(dateFrom, dateTo);
    where.date = f;
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
  const orgId = req.user!.organizationId;
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
      organizationId: orgId,
      category,
      amount: parseFloat(amount),
      description: description?.trim() || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  await logActivity({
    organizationId: orgId,
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
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  const expense = await prisma.expense.findFirst({ where: { id, organizationId: orgId } });
  if (!expense) {
    return res.status(404).json({ error: 'Расход не найден' });
  }

  await prisma.expense.delete({ where: { id } });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'EXPENSE_DELETED',
    entityType: 'Expense',
    entityId: id,
    details: `${expense.category}: ${expense.amount}`,
    ip: req.ip,
  });

  return res.json({ message: 'Expense deleted' });
};

export const getRedemptionRate = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);
  // Redemption (выкуп) is a realized outcome: window DELIVERED by deliveredAt and
  // RETURNED by returnedAt. SHIPPED is in-transit (no terminal date) so it stays
  // windowed by createdAt — it is informational, not part of the realized split.
  const orderFilter = {
    organizationId: orgId,
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };
  const deliveredFilter = {
    organizationId: orgId,
    status: 'DELIVERED',
    ...(Object.keys(dateFilter).length ? { deliveredAt: dateFilter } : {}),
  };
  const returnedFilter = {
    organizationId: orgId,
    status: 'RETURNED',
    ...(Object.keys(dateFilter).length ? { returnedAt: dateFilter } : {}),
  };

  const [shipped, delivered, returned] = await Promise.all([
    prisma.order.count({ where: { ...orderFilter, status: 'SHIPPED' } }),
    prisma.order.count({ where: deliveredFilter }),
    prisma.order.count({ where: returnedFilter }),
  ]);

  const resolved = delivered + returned;
  const redemptionRate = resolved > 0 ? Math.round((delivered / resolved) * 100 * 10) / 10 : null;

  const revenueResult = await prisma.order.aggregate({
    where: deliveredFilter,
    _sum: { total: true },
  });

  const avgOrderValue = delivered > 0 ? Math.round((revenueResult._sum.total ?? 0) / delivered) : 0;

  let prevRedemptionRate: number | null = null;
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const periodMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodMs);
    const prevTo = new Date(from.getTime() - 1);
    const [pd, pr] = await Promise.all([
      prisma.order.count({ where: { organizationId: orgId, deliveredAt: { gte: prevFrom, lte: prevTo }, status: 'DELIVERED' } }),
      prisma.order.count({ where: { organizationId: orgId, returnedAt: { gte: prevFrom, lte: prevTo }, status: 'RETURNED' } }),
    ]);
    const prevResolved = pd + pr;
    prevRedemptionRate = prevResolved > 0 ? Math.round((pd / prevResolved) * 100 * 10) / 10 : null;
  }

  return res.json({
    shipped, delivered, returned, resolved, redemptionRate, prevRedemptionRate,
    realRevenue: revenueResult._sum.total ?? 0,
    avgOrderValue,
  });
};

export const getCancelReasons = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);
  const orderFilter = {
    organizationId: orgId,
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };

  const cancelled = await prisma.order.findMany({
    where: { ...orderFilter, status: 'CANCELLED' },
    select: { cancelReason: true, managerId: true, manager: { select: { name: true } } },
  });

  const total = cancelled.length;
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

export const getCustomerLtv = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo, limit = '20' } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);

  // LTV is realized money: only DELIVERED orders, windowed and ordered by deliveredAt
  // (the date the customer actually redeemed and paid for the COD parcel).
  const realizedOrderFilter = {
    ...(Object.keys(dateFilter).length ? { deliveredAt: dateFilter } : {}),
    status: 'DELIVERED',
  };
  const customers = await prisma.customer.findMany({
    where: {
      organizationId: orgId,
      orders: {
        some: realizedOrderFilter,
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      orders: {
        where: realizedOrderFilter,
        select: { total: true, deliveredAt: true },
        orderBy: { deliveredAt: 'asc' },
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
    firstOrder: c.orders[0]?.deliveredAt ?? null,
    lastOrder: c.orders[c.orders.length - 1]?.deliveredAt ?? null,
  }));

  const sorted = withStats.sort((a, b) => b.ltv - a.ltv).slice(0, parseInt(limit));
  const repeatBuyers = withStats.filter((c) => c.ordersCount > 1).length;
  const totalWithOrders = withStats.length;
  const repeatRate = totalWithOrders > 0 ? Math.round((repeatBuyers / totalWithOrders) * 100 * 10) / 10 : 0;
  const avgLtv = withStats.length > 0
    ? Math.round(withStats.reduce((s, c) => s + c.ltv, 0) / withStats.length)
    : 0;

  return res.json({ customers: sorted, repeatBuyers, totalWithOrders, repeatRate, avgLtv });
};

export const getCcStats = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);
  const orderFilter = {
    organizationId: orgId,
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    todayOrders, todayCalled, todayConfirmed, todayCancelled, todayNoAnswer,
    periodOrders, periodCalled, periodConfirmed, periodCancelled, periodNoAnswer,
    pendingCallbacks, overdueCallbacks,
  ] = await Promise.all([
    prisma.order.count({ where: { organizationId: orgId, createdAt: { gte: todayStart } } }),
    prisma.order.count({ where: { organizationId: orgId, createdAt: { gte: todayStart }, status: { in: ['CALLED', 'CONFIRMED', 'CANCELLED'] } } }),
    prisma.order.count({ where: { organizationId: orgId, createdAt: { gte: todayStart }, status: 'CONFIRMED' } }),
    prisma.order.count({ where: { organizationId: orgId, createdAt: { gte: todayStart }, status: 'CANCELLED' } }),
    prisma.order.count({ where: { organizationId: orgId, createdAt: { gte: todayStart }, status: 'NO_ANSWER' } }),
    prisma.order.count({ where: orderFilter }),
    prisma.order.count({ where: { ...orderFilter, status: { in: ['CALLED', 'CONFIRMED', 'CANCELLED'] } } }),
    prisma.order.count({ where: { ...orderFilter, status: 'CONFIRMED' } }),
    prisma.order.count({ where: { ...orderFilter, status: 'CANCELLED' } }),
    prisma.order.count({ where: { ...orderFilter, status: 'NO_ANSWER' } }),
    prisma.callback.count({ where: { organizationId: orgId, done: false, scheduledAt: { gte: now } } }),
    prisma.callback.count({ where: { organizationId: orgId, done: false, scheduledAt: { lt: now } } }),
  ]);

  const operators = await prisma.user.findMany({
    where: { organizationId: orgId, role: { in: ['CALL_CENTER', 'ADMIN'] }, active: true },
    select: { id: true, name: true },
  });

  const operatorStats = await Promise.all(
    operators.map(async (op) => {
      const [total, confirmed, cancelled, noAnswer] = await Promise.all([
        prisma.order.count({ where: { ...orderFilter, managerId: op.id } }),
        prisma.order.count({ where: { ...orderFilter, managerId: op.id, status: 'CONFIRMED' } }),
        prisma.order.count({ where: { ...orderFilter, managerId: op.id, status: 'CANCELLED' } }),
        prisma.order.count({ where: { ...orderFilter, managerId: op.id, status: 'NO_ANSWER' } }),
      ]);
      const called = confirmed + cancelled;
      return {
        operatorId: op.id, name: op.name,
        total, called, confirmed, cancelled, noAnswer,
        confirmRate: called > 0 ? Math.round((confirmed / called) * 100 * 10) / 10 : null,
      };
    }),
  );

  const cancelledOrders = await prisma.order.findMany({
    where: { ...orderFilter, status: 'CANCELLED' },
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
    today: { orders: todayOrders, called: todayCalled, confirmed: todayConfirmed, cancelled: todayCancelled, noAnswer: todayNoAnswer, confirmRate: todayConfirmRate },
    period: { orders: periodOrders, called: periodCalled, confirmed: periodConfirmed, cancelled: periodCancelled, noAnswer: periodNoAnswer, confirmRate: periodConfirmRate },
    pendingCallbacks, overdueCallbacks,
    operators: operatorStats.filter((o) => o.total > 0).sort((a, b) => b.total - a.total),
    topCancelReasons,
  });
};

export const getCcPayroll = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);
  const orderFilter = {
    organizationId: orgId,
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };

  const CONFIRM_RATE = 10;
  const UPSELL_RATE = 0.20;

  const operators = await prisma.user.findMany({
    where: { organizationId: orgId, role: { in: ['CALL_CENTER', 'ADMIN'] }, active: true },
    select: { id: true, name: true },
  });

  const operatorStats = await Promise.all(
    operators.map(async (op) => {
      const confirmedOrders = await prisma.order.count({
        where: { ...orderFilter, managerId: op.id, status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] } },
      });

      const upsellItems = await prisma.orderItem.findMany({
        where: {
          name: 'Доп. продаж',
          order: { ...orderFilter, managerId: op.id, status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] } },
        },
        select: { price: true, quantity: true },
      });

      const upsellAmount = upsellItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const confirmedBonus = confirmedOrders * CONFIRM_RATE;
      const upsellBonus = Math.round(upsellAmount * UPSELL_RATE * 100) / 100;
      const totalEarned = confirmedBonus + upsellBonus;

      const paymentsResult = await prisma.ccPayment.aggregate({
        where: { organizationId: orgId, operatorId: op.id },
        _sum: { amount: true },
      });
      const totalPaid = paymentsResult._sum.amount ?? 0;

      const payments = await prisma.ccPayment.findMany({
        where: { organizationId: orgId, operatorId: op.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, amount: true, note: true, createdAt: true },
      });

      return {
        operatorId: op.id, name: op.name,
        confirmedOrders, confirmedBonus,
        upsellAmount: Math.round(upsellAmount * 100) / 100, upsellBonus,
        totalEarned,
        totalPaid: Math.round(totalPaid * 100) / 100,
        balance: Math.round((totalEarned - totalPaid) * 100) / 100,
        payments,
      };
    }),
  );

  return res.json({
    operators: operatorStats
      .filter((o) => o.confirmedOrders > 0 || o.totalPaid > 0)
      .sort((a, b) => b.totalEarned - a.totalEarned),
    rates: { confirmRate: CONFIRM_RATE, upsellRate: UPSELL_RATE },
  });
};

export const createCcPayment = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { operatorId, amount, note } = req.body;

  if (!operatorId || !amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'operatorId and positive amount required' });
  }

  const operator = await prisma.user.findFirst({ where: { id: operatorId, organizationId: orgId } });
  if (!operator) {
    return res.status(404).json({ error: 'Operator not found' });
  }

  const payment = await prisma.ccPayment.create({
    data: { organizationId: orgId, operatorId, amount: parseFloat(amount), note: note?.trim() || null },
  });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'CC_PAYMENT_CREATED',
    entityType: 'CcPayment',
    entityId: payment.id,
    details: `${operator.name}: ${payment.amount} грн`,
    ip: req.ip,
  });

  return res.status(201).json(payment);
};

export const deleteCcPayment = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  const payment = await prisma.ccPayment.findFirst({ where: { id, organizationId: orgId } });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  await prisma.ccPayment.delete({ where: { id } });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'CC_PAYMENT_DELETED',
    entityType: 'CcPayment',
    entityId: id,
    details: `${payment.amount} грн`,
    ip: req.ip,
  });

  return res.json({ message: 'Payment deleted' });
};

// GET /api/analytics/customers-by-city — aggregate orders+revenue by city
export const getCustomersByCity = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const dateFilter = dateRange(dateFrom, dateTo);
  const orderFilter = {
    organizationId: orgId,
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
  };

  const orders = await prisma.order.findMany({
    where: { ...orderFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
    select: {
      total: true,
      customer: { select: { city: true } },
    },
  });

  const map = new Map<string, { city: string; orders: number; revenue: number }>();
  for (const o of orders) {
    const c = (o.customer.city || '').trim();
    if (!c) continue;
    const key = c.toLowerCase();
    const cur = map.get(key) || { city: c, orders: 0, revenue: 0 };
    cur.orders++;
    cur.revenue += o.total;
    map.set(key, cur);
  }

  const data = Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  return res.json(data);
};

export const getKpi = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const orgFilter = { organizationId: orgId };

  const [
    todayOrders, todayRevenue, monthOrders, monthRevenue, monthExpenses,
    inTransitOrders, inTransitAgg, delivered30, returned30, pendingCallbacks, weeklyOrders, newOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { ...orgFilter, createdAt: { gte: todayStart } } }),
    // Realized revenue: only DELIVERED orders, attributed by deliveredAt (not createdAt).
    prisma.order.aggregate({
      where: { ...orgFilter, deliveredAt: { gte: todayStart }, status: 'DELIVERED' },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { ...orgFilter, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.order.aggregate({
      where: { ...orgFilter, deliveredAt: { gte: thirtyDaysAgo }, status: 'DELIVERED' },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: { ...orgFilter, date: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.order.count({ where: { ...orgFilter, status: 'SHIPPED' } }),
    // In-transit money snapshot: sum(total) of SHIPPED orders that actually have a TTN
    // (trackingNumber). These are the COD parcels whose cash is still on the road.
    prisma.order.aggregate({
      where: { ...orgFilter, status: 'SHIPPED', trackingNumber: { not: null } },
      _sum: { total: true },
    }),
    // Realized outcomes for redemption rate: delivered by deliveredAt, returned by returnedAt.
    prisma.order.count({ where: { ...orgFilter, deliveredAt: { gte: thirtyDaysAgo }, status: 'DELIVERED' } }),
    prisma.order.count({ where: { ...orgFilter, returnedAt: { gte: thirtyDaysAgo }, status: 'RETURNED' } }),
    prisma.callback.count({ where: { ...orgFilter, done: false, scheduledAt: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } } }),
    prisma.order.count({ where: { ...orgFilter, createdAt: { gte: sevenDaysAgo } } }),
    prisma.order.count({ where: { ...orgFilter, status: 'NEW' } }),
  ]);

  const monthRevenueVal = monthRevenue._sum.total ?? 0;
  const monthExpensesVal = monthExpenses._sum.amount ?? 0;
  const resolved = delivered30 + returned30;
  const redemptionRate = resolved > 0 ? Math.round((delivered30 / resolved) * 100 * 10) / 10 : null;
  const inTransitSum = inTransitAgg._sum.total ?? 0;

  return res.json({
    today: { orders: todayOrders, revenue: todayRevenue._sum.total ?? 0 },
    month: {
      orders: monthOrders, revenue: monthRevenueVal, expenses: monthExpensesVal,
      profit: monthRevenueVal - monthExpensesVal,
    },
    // inTransit is now the money-in-transit total (sum of SHIPPED-with-TTN order totals),
    // matching /cash-in-transit's inTransitTotal. inTransitOrders keeps the old SHIPPED count.
    inTransit: Number.isFinite(inTransitSum) ? inTransitSum : 0,
    inTransitOrders, newOrders, redemptionRate, delivered30, returned30, pendingCallbacks, weeklyOrders,
  });
};

// GET /api/analytics/returns-cost — the real cost of returns (возвраты) in a window.
// Windowed by returnedAt (the realized return date). Money lost = round-trip shipping
// the seller eats + COGS frozen in the товар that came back.
export const getReturnsCost = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { from, to } = req.query as Record<string, string>;
  const dateFilter = dateRange(from, to);
  const returnedFilter = {
    organizationId: orgId,
    status: 'RETURNED',
    ...(Object.keys(dateFilter).length ? { returnedAt: dateFilter } : {}),
  };

  const orders = await prisma.order.findMany({
    where: returnedFilter,
    select: {
      shippingCost: true,
      source: true,
      items: {
        select: {
          name: true,
          quantity: true,
          productId: true,
          product: { select: { name: true, purchasePrice: true } },
        },
      },
    },
  });

  const totalReturns = orders.length;

  let lostShipping = 0;
  let frozenCogs = 0;
  const byProductMap: Record<string, { name: string; count: number; frozenCogs: number }> = {};
  const bySourceMap: Record<string, { source: string; count: number }> = {};

  for (const o of orders) {
    // Round-trip: the seller pays to ship out and to ship the return back. Treat a
    // missing/non-finite shippingCost as 0.
    const ship = Number.isFinite(o.shippingCost) ? (o.shippingCost ?? 0) : 0;
    lostShipping += ship * 2;

    const src = (o.source || '').trim() || 'UNKNOWN';
    if (!bySourceMap[src]) bySourceMap[src] = { source: src, count: 0 };
    bySourceMap[src].count++;

    for (const item of o.items) {
      const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
      const purchasePrice = Number.isFinite(item.product?.purchasePrice) ? (item.product?.purchasePrice ?? 0) : 0;
      const itemCogs = purchasePrice * qty;
      frozenCogs += itemCogs;

      const key = item.productId || item.name;
      const displayName = item.product?.name || item.name;
      if (!byProductMap[key]) byProductMap[key] = { name: displayName, count: 0, frozenCogs: 0 };
      byProductMap[key].count += qty;
      byProductMap[key].frozenCogs += itemCogs;
    }
  }

  lostShipping = Math.round(lostShipping * 100) / 100;
  frozenCogs = Math.round(frozenCogs * 100) / 100;
  const totalLoss = Math.round((lostShipping + frozenCogs) * 100) / 100;

  const byProduct = Object.values(byProductMap)
    .map((p) => ({ ...p, frozenCogs: Math.round(p.frozenCogs * 100) / 100 }))
    .sort((a, b) => b.frozenCogs - a.frozenCogs);

  const bySource = Object.values(bySourceMap).sort((a, b) => b.count - a.count);

  return res.json({ totalReturns, lostShipping, frozenCogs, totalLoss, byProduct, bySource });
};

// GET /api/analytics/cash-in-transit — live snapshot of COD money on the road.
// No date filter: it's "right now". We estimate when that cash lands and how much
// of it actually redeems, using recent lag + redemption history.
export const getCashInTransit = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const orgFilter = { organizationId: orgId };

  const [inTransitOrders, lagOrders, delivered30, returned30] = await Promise.all([
    // In-transit parcels: SHIPPED with a TTN. We need shippedAt to project landing date.
    prisma.order.findMany({
      where: { ...orgFilter, status: 'SHIPPED', trackingNumber: { not: null } },
      select: { total: true, shippedAt: true },
    }),
    // Lag sample: DELIVERED orders in the last ~90 days that have both timestamps.
    prisma.order.findMany({
      where: {
        ...orgFilter,
        status: 'DELIVERED',
        deliveredAt: { gte: ninetyDaysAgo, not: null },
        shippedAt: { not: null },
      },
      select: { shippedAt: true, deliveredAt: true },
    }),
    // Trailing-30d redemption split (by their terminal dates).
    prisma.order.count({ where: { ...orgFilter, status: 'DELIVERED', deliveredAt: { gte: thirtyDaysAgo } } }),
    prisma.order.count({ where: { ...orgFilter, status: 'RETURNED', returnedAt: { gte: thirtyDaysAgo } } }),
  ]);

  const inTransitTotal = inTransitOrders.reduce((s, o) => s + (Number.isFinite(o.total) ? o.total : 0), 0);

  // Average shipping→delivery lag in days. Fallback 5 days if we have no sample.
  const lags: number[] = [];
  for (const o of lagOrders) {
    if (!o.shippedAt || !o.deliveredAt) continue;
    const ms = o.deliveredAt.getTime() - o.shippedAt.getTime();
    if (Number.isFinite(ms) && ms > 0) lags.push(ms / 86400000);
  }
  let avgLagDays = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : 5;
  if (!Number.isFinite(avgLagDays) || avgLagDays <= 0) avgLagDays = 5;
  avgLagDays = Math.round(avgLagDays * 10) / 10;

  // Trailing-30d redemption rate (delivered vs delivered+returned). Fallback 0.7.
  const resolved30 = delivered30 + returned30;
  let redemptionRate = resolved30 > 0 ? delivered30 / resolved30 : 0.7;
  if (!Number.isFinite(redemptionRate) || redemptionRate <= 0) redemptionRate = 0.7;

  const expectedPayout = Math.round(inTransitTotal * redemptionRate * 100) / 100;

  // Bucket in-transit money by expected delivery date (shippedAt + avgLagDays). Parcels
  // missing shippedAt land on "today + avgLag" from now as a fallback so they aren't dropped.
  const lagMs = avgLagDays * 86400000;
  const byDateMap: Record<string, number> = {};
  for (const o of inTransitOrders) {
    const base = o.shippedAt ? o.shippedAt.getTime() : now.getTime();
    if (!Number.isFinite(base)) continue;
    const eta = new Date(base + lagMs);
    const key = eta.toISOString().split('T')[0];
    const amount = (Number.isFinite(o.total) ? o.total : 0) * redemptionRate;
    byDateMap[key] = (byDateMap[key] ?? 0) + amount;
  }

  const expectedByDate = Object.entries(byDateMap)
    .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return res.json({
    inTransitTotal: Math.round(inTransitTotal * 100) / 100,
    expectedPayout,
    avgLagDays,
    expectedByDate,
  });
};
