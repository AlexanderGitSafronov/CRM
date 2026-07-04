import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';
import { parsePagination } from '../utils/pagination';

export const getCustomers = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { search } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { organizationId: orgId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const { page: pageNum, limit: limitNum, skip } = parsePagination(req.query.page, req.query.limit);

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.customer.count({ where }),
  ]);

  // LTV/lastOrder считаем ограниченными запросами по id текущей страницы,
  // а не подгружая ВСЕ заказы каждого клиента (было unbounded include).
  // LTV — только реализованные деньги (DELIVERED), чтобы совпадало с аналитикой.
  const ids = customers.map((c) => c.id);
  const [ltvRows, lastRows] = await Promise.all([
    ids.length
      ? prisma.order.groupBy({
          by: ['customerId'],
          where: { organizationId: orgId, customerId: { in: ids }, status: 'DELIVERED' },
          _sum: { total: true },
        })
      : Promise.resolve([] as Array<{ customerId: string; _sum: { total: number | null } }>),
    ids.length
      ? prisma.order.findMany({
          where: { organizationId: orgId, customerId: { in: ids } },
          distinct: ['customerId'],
          orderBy: { createdAt: 'desc' },
          select: { customerId: true, total: true, status: true },
        })
      : Promise.resolve([] as Array<{ customerId: string; total: number; status: string }>),
  ]);

  const ltvByCustomer = new Map(ltvRows.map((r) => [r.customerId, r._sum.total ?? 0]));
  const lastByCustomer = new Map(lastRows.map((r) => [r.customerId, { total: r.total, status: r.status }]));

  const customersWithLTV = customers.map((c) => ({
    ...c,
    ltv: ltvByCustomer.get(c.id) ?? 0,
    ordersCount: c._count.orders,
    lastOrder: lastByCustomer.get(c.id) ?? null,
    _count: undefined,
  }));

  return res.json({
    customers: customersWithLTV,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
};

export const getCustomer = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: orgId },
    include: {
      orders: {
        include: {
          items: true,
          manager: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!customer) {
    return res.status(404).json({ error: 'Клиент не найден' });
  }

  // LTV — реализованные деньги (только DELIVERED), как в списке и аналитике.
  const ltv = customer.orders
    .filter((o) => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + o.total, 0);

  return res.json({ ...customer, ltv });
};

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const { name, email, city, address, notes } = req.body;

  const existing = await prisma.customer.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: 'Клиент не найден' });

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: name?.trim(),
      email: email?.trim() || null,
      city: city?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
    },
  });

  return res.json(customer);
};

export const toggleBlacklist = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const { isBlacklisted, blacklistReason } = req.body;

  const customer = await prisma.customer.findFirst({ where: { id, organizationId: orgId } });
  if (!customer) {
    return res.status(404).json({ error: 'Клиент не найден' });
  }

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      isBlacklisted: Boolean(isBlacklisted),
      blacklistReason: isBlacklisted ? (blacklistReason?.trim() || null) : null,
    },
  });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: isBlacklisted ? 'CUSTOMER_BLACKLISTED' : 'CUSTOMER_UNBLACKLISTED',
    entityType: 'Customer',
    entityId: id,
    details: isBlacklisted ? `Причина: ${blacklistReason || 'не вказана'}` : 'Знято з чорного списку',
    ip: req.ip,
  });

  return res.json(updated);
};

export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  const existing = await prisma.customer.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: 'Клиент не найден' });

  const ordersCount = await prisma.order.count({ where: { customerId: id, organizationId: orgId } });
  if (ordersCount > 0) {
    return res.status(400).json({
      error: `Невозможно удалить клиента — у него ${ordersCount} заказов`,
    });
  }

  await prisma.customer.delete({ where: { id } });
  return res.json({ message: 'Customer deleted' });
};
