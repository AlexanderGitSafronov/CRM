import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../services/prisma';
import { notifyNewOrder, logActivity } from '../services/notifications';
import { broadcastEvent } from '../services/eventBus';
import { getNextManagerId } from '../services/roundRobin';
import { checkAchievements } from '../services/achievements';
import { sendOrderStatusToAdtrack } from '../services/adtrackWebhook';
import { sendSmsToCustomer, getTurboSmsConfig } from '../services/turbosms';
import { AuthRequest } from '../middleware/auth';
import {
  assertOrderQuota,
  createOrderWithOrderNumRetry,
  filterOrgProductIds,
  validateOrderItems,
} from '../services/orderGuards';

/**
 * Безопасно извлекает строковое значение из nested-объекта payload.
 * Принимает `null`, числа, пустые строки — отбрасывает их.
 */
function pickStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= 500 ? t : null;
}

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

  const {
    customer,
    items,
    source = 'WEBHOOK',
    comment,
    delivery,
    attribution: rawAttribution,
  } = req.body as {
    customer?: { name?: string; phone?: string; email?: string; city?: string; address?: string };
    items?: Array<{ name: string; quantity: number; price: number; productId?: string }>;
    source?: string;
    comment?: string;
    delivery?: { service?: string; city?: string; address?: string; recipientName?: string };
    attribution?: Record<string, unknown>;
  };

  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({ error: 'customer.name and customer.phone required' });
  }

  if (!items?.length) {
    return res.status(400).json({ error: 'items array required' });
  }

  const itemsCheck = validateOrderItems(items);
  if (!itemsCheck.ok) {
    return res.status(400).json({ error: itemsCheck.error });
  }

  // Plan limit: заказы за текущий календарный месяц
  const quota = await assertOrderQuota(orgId);
  if (!quota.ok) {
    return res.status(402).json({ error: `Досягнуто ліміт замовлень тарифу: максимум ${quota.max} замовлень на місяць. Оновіть план.` });
  }

  // Захват атрибуции (fbclid/utm/...) — приходит из Magaz/лендингов через AdTrack tracker.js cookie.
  // Все поля опциональные: если ничего не передано — заказ создаётся без них, AdTrack просто не свяжет
  // его с креативом, но интеграция всё равно работает.
  const attribution = rawAttribution ?? {};
  const utmSource = pickStr(attribution.utmSource ?? attribution.utm_source);
  const utmMedium = pickStr(attribution.utmMedium ?? attribution.utm_medium);
  const utmCampaign = pickStr(attribution.utmCampaign ?? attribution.utm_campaign);
  const utmContent = pickStr(attribution.utmContent ?? attribution.utm_content);
  const utmTerm = pickStr(attribution.utmTerm ?? attribution.utm_term);
  const fbclid = pickStr(attribution.fbclid);
  const ttclid = pickStr(attribution.ttclid);
  const gclid = pickStr(attribution.gclid);

  // IP/UA можно прокинуть с фронта (например лендинг → сервер → сюда), либо взять из самого запроса
  // (но это будет IP того кто шлёт вебхук, не IP клиента). Поэтому приоритет — body.customer.ip/userAgent.
  const customerIp =
    pickStr((customer as { ip?: string }).ip) ?? pickStr(attribution.ip as string) ?? req.ip ?? null;
  const customerUserAgent =
    pickStr((customer as { userAgent?: string }).userAgent) ??
    pickStr(attribution.userAgent as string) ??
    pickStr(req.headers['user-agent']) ??
    null;

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
    (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
    0
  );

  const autoManagerId = await getNextManagerId(orgId);

  // productId от внешних магазинов могут быть чужими/устаревшими — заказ не отклоняем,
  // просто обнуляем неизвестные productId.
  const requestedProductIds = items
    .map((item) => item.productId)
    .filter((pid): pid is string => Boolean(pid));
  const orgProductIds = await filterOrgProductIds(orgId, requestedProductIds);

  // Публичный токен страницы отслеживания — генерируем заранее, чтобы
  // переиспользовать его и в записи заказа, и в trackUrl для SMS.
  const publicToken = crypto.randomBytes(16).toString('hex');

  // orderNum генерируется не атомарно — при гонке retry пересчитает номер (см. orderGuards)
  const order = await createOrderWithOrderNumRetry(orgId, (orderNum) =>
    prisma.order.create({
      data: {
        organizationId: orgId,
        orderNum,
        customerId,
        managerId: autoManagerId,
        source,
        comment: [blacklistWarning, comment?.trim()].filter(Boolean).join('\n') || null,
        total,
        publicToken,
        deliveryService: delivery?.service?.trim() || null,
        deliveryCity: delivery?.city?.trim() || null,
        deliveryAddress: delivery?.address?.trim() || null,
        recipientName: delivery?.recipientName?.trim() || null,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        fbclid,
        ttclid,
        gclid,
        customerIp,
        customerUserAgent,
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
            productId: item.productId && orgProductIds.has(item.productId) ? item.productId : null,
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
    })
  );

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

  void checkAchievements(orgId);

  // AdTrack: новый заказ = Lead. Если интеграция не настроена — silent skip.
  void sendOrderStatusToAdtrack({
    organizationId: orgId,
    orderId: order.id,
    externalId: order.id,
    orderNum: order.orderNum,
    status: 'NEW',
    amount: order.total,
    customer: {
      email: dbCustomer.email,
      phone: dbCustomer.phone,
      ip: customerIp,
      userAgent: customerUserAgent,
    },
    attribution: { fbclid, ttclid, gclid, utmSource, utmMedium, utmCampaign, utmContent, utmTerm },
  });

  // Клиентская SMS «замовлення прийнято». Полностью dormant: если TurboSMS не
  // настроен/выключен у этой орг — getTurboSmsConfig вернёт null и мы тихо пропускаем,
  // не ломая флоу заказа. Fire-and-forget с .catch.
  const smsCfg = await getTurboSmsConfig(prisma, orgId);
  if (smsCfg && smsCfg.smsOnOrderCreated !== false) {
    const trackUrl = `${process.env.FRONTEND_URL || ''}/t/${publicToken}`;
    const text = `Дякуємо за замовлення №${order.orderNum}! Менеджер зателефонує найближчим часом. Стежити: ${trackUrl}`;
    sendSmsToCustomer(dbCustomer.phone, text, smsCfg).catch(() => {});
  }

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
