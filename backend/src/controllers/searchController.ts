import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';

// GET /api/search?q=text — unified search across orders, customers, products
export const search = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const q = (req.query.q as string)?.trim();

  if (!q || q.length < 2) {
    return res.json({ orders: [], customers: [], products: [] });
  }

  // If looks like an order number (digits only), prioritize it
  const orderNum = /^\d+$/.test(q) ? parseInt(q) : null;

  const [orders, customers, products] = await Promise.all([
    prisma.order.findMany({
      where: {
        organizationId: orgId,
        OR: [
          ...(orderNum ? [{ orderNum }] : []),
          { customer: { name: { contains: q, mode: 'insensitive' as const } } },
          { customer: { phone: { contains: q } } },
          { trackingNumber: { contains: q } },
        ],
      },
      select: {
        id: true,
        orderNum: true,
        status: true,
        total: true,
        createdAt: true,
        customer: { select: { name: true, phone: true } },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        city: true,
        _count: { select: { orders: true } },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { sku: { contains: q, mode: 'insensitive' as const } },
        ],
      },
      // image намеренно НЕ выбираем — палитра поиска его не рендерит, а base64
      // до ~500KB на товар раздувал ответ на каждый ввод.
      select: { id: true, name: true, sku: true, salePrice: true, stock: true },
      take: 10,
      orderBy: { name: 'asc' },
    }),
  ]);

  return res.json({
    orders: orders.map((o) => ({ ...o, ordersCount: undefined })),
    customers: customers.map((c) => ({ ...c, ordersCount: c._count.orders, _count: undefined })),
    products,
  });
};

// GET /api/customers/lookup?phone=... — autocomplete by partial phone
export const lookupByPhone = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const phone = (req.query.phone as string)?.trim();

  if (!phone || phone.length < 3) {
    return res.json({ customers: [] });
  }

  const customers = await prisma.customer.findMany({
    where: {
      organizationId: orgId,
      OR: [
        { phone: { contains: phone } },
        { name: { contains: phone, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      city: true,
      address: true,
      isBlacklisted: true,
      blacklistReason: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  return res.json({
    customers: customers.map((c) => ({
      ...c,
      ordersCount: c._count.orders,
      _count: undefined,
    })),
  });
};
