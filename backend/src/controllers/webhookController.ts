import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../services/prisma';
import { notifyNewOrder, logActivity } from '../services/notifications';
import { broadcastEvent } from '../services/eventBus';
import { getNextManagerId } from '../services/roundRobin';
import { AuthRequest } from '../middleware/auth';

// Public webhook endpoint — token determines which org the order belongs to
export const receiveOrder = async (req: Request, res: Response) => {
  const token =
    (req.headers['x-webhook-token'] as string) ||
    (req.query.token as string);

  if (!token) {
    return res.status(401).json({ error: 'Webhook token required' });
  }

  const webhookToken = await prisma.webhookToken.findUnique({
    where: { token },
    select: { active: true, organizationId: true, organization: { select: { active: true } } },
  });

  if (!webhookToken || !webhookToken.active || !webhookToken.organization?.active) {
    return res.status(401).json({ error: 'Invalid webhook token' });
  }

  const orgId = webhookToken.organizationId;

  const { customer, items, source = 'WEBHOOK', comment, delivery } = req.body;

  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: 'customer.name and customer.phone required' });
  }

  if (!items?.length) {
    return res.status(400).json({ error: 'items array required' });
  }

  let dbCustomer = await prisma.customer.findUnique({
    where: { organizationId_phone: { organizationId: orgId, phone: customer.phone.trim() } },
  });

  if (!dbCustomer) {
    dbCustomer = await prisma.customer.create({
      data: {
        organizationId: orgId,
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email?.trim() || null,
        city: customer.city?.trim() || null,
        address: customer.address?.trim() || null,
      },
    });
  }

  const blacklistWarning = dbCustomer.isBlacklisted
    ? `⚠️ ЧОРНИЙ СПИСОК: ${dbCustomer.blacklistReason || 'без причини'}`
    : null;

  const total = items.reduce(
    (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
    0
  );

  const lastOrder = await prisma.order.findFirst({
    where: { organizationId: orgId },
    orderBy: { orderNum: 'desc' },
    select: { orderNum: true },
  });
  const orderNum = (lastOrder?.orderNum ?? 0) + 1;

  const autoManagerId = await getNextManagerId(orgId);

  const order = await prisma.order.create({
    data: {
      organizationId: orgId,
      orderNum,
      customerId: dbCustomer.id,
      managerId: autoManagerId,
      source,
      comment: [blacklistWarning, comment?.trim()].filter(Boolean).join('\n') || null,
      total,
      deliveryService: delivery?.service?.trim() || null,
      deliveryCity: delivery?.city?.trim() || null,
      deliveryAddress: delivery?.address?.trim() || null,
      recipientName: delivery?.recipientName?.trim() || null,
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

  broadcastEvent(orgId, 'new_order', { orderNum: order.orderNum, source });

  await notifyNewOrder({
    organizationId: orgId,
    id: order.id,
    orderNum: order.orderNum,
    customer: order.customer,
    total: order.total,
    source: order.source,
    items: order.items,
  });

  await logActivity({
    organizationId: orgId,
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
    ...(blacklistWarning ? { blacklistWarning } : {}),
  });
};

export const getWebhookTokens = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const tokens = await prisma.webhookToken.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(tokens);
};

export const createWebhookToken = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name required' });
  }

  const token = await prisma.webhookToken.create({
    data: {
      organizationId: orgId,
      name: name.trim(),
      token: crypto.randomBytes(24).toString('hex'),
    },
  });

  return res.status(201).json(token);
};

export const deleteWebhookToken = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const existing = await prisma.webhookToken.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: 'Token not found' });
  await prisma.webhookToken.delete({ where: { id } });
  return res.json({ message: 'Token deleted' });
};
