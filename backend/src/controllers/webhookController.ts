import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../services/prisma';
import { notifyNewOrder, logActivity } from '../services/notifications';
import { broadcastEvent } from '../services/eventBus';

export const receiveOrder = async (req: Request, res: Response) => {
  // Validate webhook token
  const token =
    (req.headers['x-webhook-token'] as string) ||
    (req.query.token as string);

  if (!token) {
    return res.status(401).json({ error: 'Webhook token required' });
  }

  const webhookToken = await prisma.webhookToken.findUnique({
    where: { token },
  });

  if (!webhookToken || !webhookToken.active) {
    return res.status(401).json({ error: 'Invalid webhook token' });
  }

  const { customer, items, source = 'WEBHOOK', comment } = req.body;

  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: 'customer.name and customer.phone required' });
  }

  if (!items?.length) {
    return res.status(400).json({ error: 'items array required' });
  }

  // Find or create customer
  let dbCustomer = await prisma.customer.findUnique({
    where: { phone: customer.phone.trim() },
  });

  if (!dbCustomer) {
    dbCustomer = await prisma.customer.create({
      data: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email?.trim() || null,
        city: customer.city?.trim() || null,
        address: customer.address?.trim() || null,
      },
    });
  }

  const total = items.reduce(
    (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
    0
  );

  const lastOrder = await prisma.order.findFirst({ orderBy: { orderNum: 'desc' }, select: { orderNum: true } });
  const orderNum = (lastOrder?.orderNum ?? 0) + 1;

  const order = await prisma.order.create({
    data: {
      orderNum,
      customerId: dbCustomer.id,
      source,
      comment: comment?.trim() || null,
      total,
      items: {
        create: items.map((item: {
          name: string;
          quantity: number;
          price: number;
          productId?: string;
        }) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          productId: item.productId || null,
        })),
      },
      history: {
        create: { action: 'CREATED', newValue: 'NEW' },
      },
    },
    include: {
      customer: { select: { name: true, phone: true } },
      items: { select: { name: true, quantity: true, price: true } },
    },
  });

  broadcastEvent('new_order', { orderNum: order.orderNum, source });

  await notifyNewOrder({
    id: order.id,
    orderNum: order.orderNum,
    customer: order.customer,
    total: order.total,
    source: order.source,
    items: order.items,
  });

  await logActivity({
    action: 'WEBHOOK_ORDER',
    entityType: 'Order',
    entityId: order.id,
    details: `Webhook order #${order.orderNum} from ${source}`,
    ip: req.ip,
  });

  return res.status(201).json({
    success: true,
    orderId: order.id,
    orderNum: order.orderNum,
  });
};

export const getWebhookTokens = async (req: Request, res: Response) => {
  const tokens = await prisma.webhookToken.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return res.json(tokens);
};

export const createWebhookToken = async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name required' });
  }

  const token = await prisma.webhookToken.create({
    data: { name: name.trim(), token: uuidv4() },
  });

  return res.status(201).json(token);
};

export const deleteWebhookToken = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.webhookToken.delete({ where: { id } });
  return res.json({ message: 'Token deleted' });
};
