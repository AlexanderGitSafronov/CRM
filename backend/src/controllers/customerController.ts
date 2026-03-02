import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';

export const getCustomers = async (req: AuthRequest, res: Response) => {
  const { search, page = '1', limit = '20' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { orders: true } },
        orders: {
          select: { total: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.customer.count({ where }),
  ]);

  const customersWithLTV = customers.map((c) => ({
    ...c,
    ltv: c.orders.reduce((sum, o) => sum + o.total, 0),
    ordersCount: c._count.orders,
    lastOrder: c.orders[0] || null,
    orders: undefined,
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
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
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

  const ltv = customer.orders.reduce((sum, o) => sum + o.total, 0);

  return res.json({ ...customer, ltv });
};

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, email, city, address, notes } = req.body;

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

export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const ordersCount = await prisma.order.count({ where: { customerId: id } });
  if (ordersCount > 0) {
    return res.status(400).json({
      error: `Невозможно удалить клиента — у него ${ordersCount} заказов`,
    });
  }

  await prisma.customer.delete({ where: { id } });
  return res.json({ message: 'Customer deleted' });
};
