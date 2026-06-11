import { Response } from 'express';
import crypto from 'crypto';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';
import { notifyNewOrder, logActivity } from '../services/notifications';
import { broadcastEvent } from '../services/eventBus';
import { sendIncomeToRashod } from '../services/rashodWebhook';
import { sendOrderStatusByIdToAdtrack } from '../services/adtrackWebhook';
import { getNextManagerId } from '../services/roundRobin';
import { checkAchievements } from '../services/achievements';
import {
  applyStatusTimestamps,
  assertOrderQuota,
  createOrderWithOrderNumRetry,
  filterOrgProductIds,
  validateOrderItems,
  validateOrgManagerId,
} from '../services/orderGuards';

const ORDER_SELECT = {
  id: true,
  orderNum: true,
  status: true,
  source: true,
  comment: true,
  total: true,
  deliveryService: true,
  deliveryCity: true,
  deliveryAddress: true,
  recipientName: true,
  npCityRef: true,
  npWarehouseRef: true,
  trackingNumber: true,
  cancelReason: true,
  // Attribution для AdTrack (видно в API чтобы UI мог отображать)
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  utmContent: true,
  utmTerm: true,
  fbclid: true,
  ttclid: true,
  gclid: true,
  customerIp: true,
  customerUserAgent: true,
  adtrackLastStatus: true,
  adtrackLastSentAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, phone: true, email: true, city: true, address: true, isBlacklisted: true, blacklistReason: true } },
  manager: { select: { id: true, name: true, email: true } },
  items: {
    select: {
      id: true,
      name: true,
      quantity: true,
      price: true,
      product: { select: { id: true, sku: true } },
    },
  },
};

export const getOrders = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const {
    status,
    managerId,
    search,
    source,
    dateFrom,
    dateTo,
    page = '1',
    limit = '20',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { organizationId: orgId };

  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (managerId) {
    where.managerId = managerId;
  }
  if (source) {
    where.source = source;
  }
  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { customer: { phone: { contains: search } } },
      { customer: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, unknown>).lte = end;
    }
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const validSortFields = ['createdAt', 'total', 'orderNum', 'status'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDir = sortOrder === 'asc' ? 'asc' : 'desc';

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: ORDER_SELECT,
      orderBy: { [sortField]: sortDir },
      skip,
      take: limitNum,
    }),
    prisma.order.count({ where }),
  ]);

  return res.json({
    orders,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
};

export const getOrder = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  const order = await prisma.order.findFirst({
    where: { id, organizationId: orgId },
    select: {
      ...ORDER_SELECT,
      history: {
        orderBy: { createdAt: 'desc' },
        include: { order: false },
        take: 50,
      },
    },
  });

  if (!order) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  return res.json(order);
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { customer, items, source = 'MANUAL', comment, managerId } = req.body;

  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: 'Customer name and phone required' });
  }

  const itemsCheck = validateOrderItems(items);
  if (!itemsCheck.ok) {
    return res.status(400).json({ error: itemsCheck.error });
  }

  // Менеджер из body — только из своей организации
  if (managerId) {
    const validManager = await validateOrgManagerId(orgId, managerId);
    if (!validManager) {
      return res.status(400).json({ error: 'Invalid manager' });
    }
  }

  // productId позиций — только товары своей организации
  const requestedProductIds: string[] = items
    .map((item: { productId?: string }) => item.productId)
    .filter((pid: string | undefined): pid is string => Boolean(pid));
  if (requestedProductIds.length > 0) {
    const orgProductIds = await filterOrgProductIds(orgId, requestedProductIds);
    if (requestedProductIds.some((pid) => !orgProductIds.has(pid))) {
      return res.status(400).json({ error: 'Invalid productId' });
    }
  }

  // Plan limit: заказы за текущий календарный месяц
  const quota = await assertOrderQuota(orgId);
  if (!quota.ok) {
    return res.status(402).json({ error: `Досягнуто ліміт замовлень тарифу: максимум ${quota.max} замовлень на місяць. Оновіть план.` });
  }

  // Find or create customer (scoped by org)
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

  const customerId = dbCustomer.id;

  const blacklistWarning = dbCustomer.isBlacklisted
    ? `⚠️ ЧОРНИЙ СПИСОК: ${dbCustomer.blacklistReason || 'без причини'}`
    : null;

  const total = items.reduce(
    (sum: number, item: { price: number; quantity: number }) =>
      sum + item.price * item.quantity,
    0
  );

  const assignedManagerId =
    managerId ||
    (req.user?.role !== 'VIEWER' ? req.user?.id : null) ||
    (await getNextManagerId(orgId)) ||
    null;

  // orderNum генерируется не атомарно — при гонке retry пересчитает номер (см. orderGuards)
  const order = await createOrderWithOrderNumRetry(orgId, (orderNum) =>
    prisma.order.create({
      data: {
        organizationId: orgId,
        orderNum,
        customerId,
        managerId: assignedManagerId || null,
        source,
        comment: [blacklistWarning, comment?.trim()].filter(Boolean).join('\n') || null,
        total,
        publicToken: crypto.randomBytes(16).toString('hex'),
        items: {
          create: items.map((item: {
            productId?: string;
            name: string;
            quantity: number;
            price: number;
          }) => ({
            productId: item.productId || null,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        },
        history: {
          create: {
            action: 'CREATED',
            newValue: 'NEW',
            userId: req.user?.id,
          },
        },
      },
      select: { ...ORDER_SELECT, history: true },
    })
  );

  broadcastEvent(orgId, 'new_order', { orderNum: order.orderNum, source: order.source });

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
    userId: req.user?.id,
    action: 'ORDER_CREATED',
    entityType: 'Order',
    entityId: order.id,
    details: `Order #${order.orderNum}`,
    ip: req.ip,
  });

  void checkAchievements(orgId);

  // AdTrack: ручной заказ от оператора — новый лид (атрибуции обычно нет, это норма)
  void sendOrderStatusByIdToAdtrack(order.id, 'NEW');

  return res.status(201).json(order);
};

export const updateOrder = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const { status, managerId, comment, items } = req.body;

  const existing = await prisma.order.findFirst({
    where: { id, organizationId: orgId },
    select: { status: true, managerId: true, orderNum: true, shippedAt: true, deliveredAt: true, returnedAt: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  const historyEntries: Array<{
    action: string;
    oldValue?: string;
    newValue?: string;
    userId?: string;
  }> = [];

  const updateData: Record<string, unknown> = {};

  if (status && status !== existing.status) {
    const validStatuses = ['NEW', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'CALLED', 'NO_ANSWER'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    updateData.status = status;
    // Реальные даты жизненного цикла (честные деньги): отгрузка/выкуп/возврат.
    Object.assign(updateData, applyStatusTimestamps(status, existing));
    historyEntries.push({
      action: 'STATUS_CHANGED',
      oldValue: existing.status,
      newValue: status,
      userId: req.user?.id,
    });
  }

  if (managerId !== undefined) {
    // Менеджер должен принадлежать этой организации (как в bulkAssignManager)
    if (managerId) {
      const validManager = await validateOrgManagerId(orgId, managerId);
      if (!validManager) {
        return res.status(400).json({ error: 'Invalid manager' });
      }
    }
    updateData.managerId = managerId || null;
    historyEntries.push({
      action: 'MANAGER_CHANGED',
      newValue: managerId,
      userId: req.user?.id,
    });
  }

  if (comment !== undefined) {
    updateData.comment = comment?.trim() || null;
  }

  if (items?.length) {
    const itemsCheck = validateOrderItems(items);
    if (!itemsCheck.ok) {
      return res.status(400).json({ error: itemsCheck.error });
    }

    // productId позиций — только товары своей организации
    const requestedProductIds: string[] = items
      .map((item: { productId?: string }) => item.productId)
      .filter((pid: string | undefined): pid is string => Boolean(pid));
    if (requestedProductIds.length > 0) {
      const orgProductIds = await filterOrgProductIds(orgId, requestedProductIds);
      if (requestedProductIds.some((pid) => !orgProductIds.has(pid))) {
        return res.status(400).json({ error: 'Invalid productId' });
      }
    }

    const total = items.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0
    );
    updateData.total = total;
    updateData.items = {
      create: items.map((item: {
        productId?: string;
        name: string;
        quantity: number;
        price: number;
      }) => ({
        productId: item.productId || null,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    };
  }

  if (historyEntries.length > 0) {
    await prisma.orderHistory.createMany({
      data: historyEntries.map((h) => ({ orderId: id, ...h })),
    });
  }

  const order = await prisma.$transaction(async (tx) => {
    if (items?.length) {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
    }
    return tx.order.update({
      where: { id },
      data: updateData,
      select: ORDER_SELECT,
    });
  });

  const statusChanged = Boolean(status && status !== existing.status);

  // Side-effects доставки только при реальной смене статуса — иначе повторное
  // сохранение уже DELIVERED заказа дублировало бы доход в Rashod.
  if (statusChanged && status === 'DELIVERED') {
    sendIncomeToRashod({
      orderId: id,
      orderNum: order.orderNum,
      total: order.total,
      source: order.source,
      deliveredAt: new Date(),
    }).catch(() => {});
    broadcastEvent(orgId, 'order_delivered', { orderNum: order.orderNum, total: order.total });
    void checkAchievements(orgId);
  }

  // AdTrack: шлём любое релевантное изменение статуса. Сервис сам игнорит
  // нерелевантные (CALLED/NO_ANSWER) и дедуплицирует повторы.
  if (statusChanged) {
    void sendOrderStatusByIdToAdtrack(id, status);
  }

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'ORDER_UPDATED',
    entityType: 'Order',
    entityId: id,
    details: historyEntries.map((h) => h.action).join(', '),
    ip: req.ip,
  });

  return res.json(order);
};

export const ccUpdateOrder = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const {
    status,
    comment,
    deliveryService,
    deliveryCity,
    deliveryAddress,
    npCityRef,
    npWarehouseRef,
    recipientName,
    upsellAmount,
    cancelReason,
  } = req.body;

  const existing = await prisma.order.findFirst({
    where: { id, organizationId: orgId },
    select: { status: true, orderNum: true, total: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  const historyEntries: Array<{
    action: string;
    oldValue?: string;
    newValue?: string;
    userId?: string;
  }> = [];

  const updateData: Record<string, unknown> = {};

  if (status && status !== existing.status) {
    const ccStatuses = ['CALLED', 'NO_ANSWER', 'CANCELLED', 'CONFIRMED', 'NEW'];
    if (!ccStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status for call center' });
    }
    updateData.status = status;
    historyEntries.push({
      action: 'STATUS_CHANGED',
      oldValue: existing.status,
      newValue: status,
      userId: req.user?.id,
    });
  }

  if (deliveryService !== undefined) updateData.deliveryService = deliveryService || null;
  if (deliveryCity !== undefined) updateData.deliveryCity = deliveryCity?.trim() || null;
  if (deliveryAddress !== undefined) updateData.deliveryAddress = deliveryAddress?.trim() || null;
  if (npCityRef !== undefined) updateData.npCityRef = npCityRef || null;
  if (npWarehouseRef !== undefined) updateData.npWarehouseRef = npWarehouseRef || null;
  if (recipientName !== undefined) updateData.recipientName = recipientName?.trim() || null;
  if (comment !== undefined) updateData.comment = comment?.trim() || null;
  if (cancelReason !== undefined) updateData.cancelReason = cancelReason?.trim() || null;

  if (upsellAmount !== undefined && upsellAmount !== null && upsellAmount !== '') {
    const amount = Number(upsellAmount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 10000000) {
      return res.status(400).json({ error: 'Invalid upsellAmount' });
    }
    if (amount > 0) {
      await prisma.orderItem.create({
        data: {
          orderId: id,
          name: 'Доп. продаж',
          quantity: 1,
          price: amount,
        },
      });
      updateData.total = existing.total + amount;
      historyEntries.push({
        action: 'UPSELL_ADDED',
        newValue: `+${amount}`,
        userId: req.user?.id,
      });
    }
  }

  if (historyEntries.length > 0) {
    await prisma.orderHistory.createMany({
      data: historyEntries.map((h) => ({ orderId: id, ...h })),
    });
  }

  const order = await prisma.order.update({
    where: { id },
    data: updateData,
    select: ORDER_SELECT,
  });

  // AdTrack: смены статуса из call-center (CALLED/NO_ANSWER не пойдут — мапа их игнорит).
  if (status && status !== existing.status) {
    void sendOrderStatusByIdToAdtrack(id, status);
  }

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'CC_ORDER_UPDATED',
    entityType: 'Order',
    entityId: id,
    details: historyEntries.map((h) => h.action).join(', '),
    ip: req.ip,
  });

  return res.json(order);
};

export const deleteOrder = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  const existing = await prisma.order.findFirst({ where: { id, organizationId: orgId } });
  if (!existing) {
    return res.status(404).json({ error: 'Заказ не найден' });
  }

  await prisma.order.delete({ where: { id } });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'ORDER_DELETED',
    entityType: 'Order',
    entityId: id,
    details: `Order #${existing.orderNum}`,
    ip: req.ip,
  });

  return res.json({ message: 'Order deleted' });
};

export const bulkUpdateStatus = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { ids, status } = req.body;

  if (!ids?.length || !status) {
    return res.status(400).json({ error: 'IDs and status required' });
  }

  const validStatuses = ['NEW', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'CALLED', 'NO_ANSWER'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, organizationId: orgId },
    select: { id: true, status: true, orderNum: true, total: true, source: true, shippedAt: true, deliveredAt: true, returnedAt: true },
  });

  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) }, organizationId: orgId },
    data: { status },
  });

  // Реальные даты жизненного цикла. updateMany не умеет per-row значения, поэтому
  // отдельным апдейтом проставляем единственное релевантное для целевого статуса поле
  // тем заказам, у кого статус реально сменился и таймстемп ещё пуст (идемпотентно).
  const timestampField: 'shippedAt' | 'deliveredAt' | 'returnedAt' | null =
    status === 'SHIPPED' ? 'shippedAt'
    : status === 'DELIVERED' ? 'deliveredAt'
    : status === 'RETURNED' ? 'returnedAt'
    : null;
  if (timestampField) {
    const toStamp = orders
      .filter((o) => o.status !== status && o[timestampField] === null)
      .map((o) => o.id);
    if (toStamp.length > 0) {
      await prisma.order.updateMany({
        where: { id: { in: toStamp }, organizationId: orgId },
        data: { [timestampField]: new Date() },
      });
    }
  }

  await prisma.orderHistory.createMany({
    data: orders.map((o) => ({
      orderId: o.id,
      action: 'STATUS_CHANGED',
      oldValue: o.status,
      newValue: status,
      userId: req.user?.id,
    })),
  });

  // DELIVERED через bulk: доход в Rashod шлём только заказам, реально перешедшим
  // в DELIVERED (как в одиночном updateOrder).
  if (status === 'DELIVERED') {
    const newlyDelivered = orders.filter((o) => o.status !== 'DELIVERED');
    for (const o of newlyDelivered) {
      sendIncomeToRashod({
        orderId: o.id,
        orderNum: o.orderNum,
        total: o.total,
        source: o.source,
        deliveredAt: new Date(),
      }).catch(() => {});
    }
    if (newlyDelivered.length > 0) {
      void checkAchievements(orgId);
    }
  }

  // AdTrack: шлём изменение только тем заказам, у кого статус реально менялся.
  for (const o of orders) {
    if (o.status !== status) {
      void sendOrderStatusByIdToAdtrack(o.id, status);
    }
  }

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'BULK_STATUS_UPDATE',
    entityType: 'Order',
    details: `Updated ${orders.length} orders to ${status}`,
    ip: req.ip,
  });

  return res.json({ updated: orders.length });
};

export const bulkAssignManager = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { ids, managerId } = req.body as { ids: string[]; managerId: string | null };

  if (!ids?.length) return res.status(400).json({ error: 'IDs required' });

  // If manager set, verify they belong to this org
  if (managerId) {
    const m = await prisma.user.findFirst({ where: { id: managerId, organizationId: orgId } });
    if (!m) return res.status(400).json({ error: 'Invalid manager' });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, organizationId: orgId },
    select: { id: true },
  });

  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) }, organizationId: orgId },
    data: { managerId: managerId || null },
  });

  await prisma.orderHistory.createMany({
    data: orders.map((o) => ({
      orderId: o.id,
      action: 'MANAGER_CHANGED',
      newValue: managerId || 'unassigned',
      userId: req.user?.id,
    })),
  });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'BULK_ASSIGN_MANAGER',
    entityType: 'Order',
    details: `${orders.length} orders → ${managerId || 'unassigned'}`,
    ip: req.ip,
  });

  return res.json({ updated: orders.length });
};

export const bulkDelete = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { ids } = req.body as { ids: string[] };
  if (!ids?.length) return res.status(400).json({ error: 'IDs required' });

  const result = await prisma.order.deleteMany({
    where: { id: { in: ids }, organizationId: orgId },
  });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'BULK_DELETE',
    entityType: 'Order',
    details: `Deleted ${result.count} orders`,
    ip: req.ip,
  });

  return res.json({ deleted: result.count });
};

export const getOrderHistory = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  // Verify the order belongs to caller's org
  const order = await prisma.order.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const history = await prisma.orderHistory.findMany({
    where: { orderId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { orderNum: true } },
    },
  });

  return res.json(history);
};
