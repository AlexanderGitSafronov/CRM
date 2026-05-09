import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import { createTtn, npPost, NpSenderConfig } from '../services/novaPoshta';
import { sendSmsToCustomer, getTurboSmsConfig } from '../services/turbosms';
import { logActivity } from '../services/notifications';
import { runTrackingCycle, trackerState } from '../workers/npTracker';
import { runSlaCheck, slaTrackerState } from '../workers/slaTracker';

const router = Router();
router.use(authenticate);

// Helper: per-org NP API key (fallback to global env for default org)
async function getNpApiKey(organizationId: string): Promise<string> {
  try {
    const integration = await prisma.integration.findUnique({
      where: { organizationId_type: { organizationId, type: 'NOVA_POSHTA_SENDER' } },
    });
    if (integration?.active) {
      const cfg = JSON.parse(integration.config) as { apiKey?: string };
      if (cfg.apiKey) return cfg.apiKey;
    }
  } catch { /* ignore */ }
  return process.env.NP_API_KEY || '';
}

router.get('/cities', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { q } = req.query as Record<string, string>;
  if (!q || q.trim().length < 2) return res.json({ data: [] });

  try {
    const apiKey = await getNpApiKey(orgId);
    const result = await npPost('Address', 'searchSettlements', {
      CityName: q.trim(), Limit: 7, Page: 1,
    }, apiKey);

    if (!result.success) return res.json({ data: [] });

    type NpAddress = { Present: string; DeliveryCity: string; SettlementRef: string };
    type NpSearchResult = { Addresses: NpAddress[] };
    const addresses = (result.data?.[0] as NpSearchResult)?.Addresses ?? [];
    const cities = addresses.map((a) => ({
      ref: a.DeliveryCity, settlementRef: a.SettlementRef, label: a.Present,
    }));
    return res.json({ data: cities });
  } catch (error) {
    logger.error('Nova Poshta city search error:', error);
    return res.json({ data: [] });
  }
});

router.get('/warehouses', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { cityRef, q } = req.query as Record<string, string>;
  if (!cityRef) return res.json({ data: [] });

  try {
    const apiKey = await getNpApiKey(orgId);
    const result = await npPost('AddressGeneral', 'getWarehouses', {
      CityRef: cityRef, Limit: 150, Page: 1,
      ...(q?.trim() ? { FindByString: q.trim() } : {}),
    }, apiKey);

    if (!result.success) return res.json({ data: [] });

    type NpWarehouse = {
      Ref: string; Description: string; ShortAddress: string; TypeOfWarehouse: string; Number: string;
    };

    const warehouses = (result.data as NpWarehouse[]).map((w) => ({
      ref: w.Ref,
      label: w.Description,
      shortAddress: w.ShortAddress,
      number: w.Number,
      isPostomat: w.TypeOfWarehouse === '841339c7-591a-42e2-8233-7a0a00f0ed6f',
    }));

    return res.json({ data: warehouses });
  } catch (error) {
    logger.error('Nova Poshta warehouse search error:', error);
    return res.json({ data: [] });
  }
});

router.get('/sender-config', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: 'NOVA_POSHTA_SENDER' } },
  });
  if (!integration) return res.json({ configured: false, config: {} });
  try {
    const config = JSON.parse(integration.config) as Record<string, string>;
    return res.json({ configured: integration.active, config });
  } catch {
    return res.json({ configured: false, config: {} });
  }
});

router.post('/fetch-sender', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { phone, cityRef, warehouseRef } = req.body as Record<string, string>;
  if (!phone || !cityRef || !warehouseRef) {
    return res.status(400).json({ error: 'phone, cityRef, warehouseRef required' });
  }
  const apiKey = await getNpApiKey(orgId);

  try {
    type NpCounterpartyItem = { Ref: string; Description: string };
    const sendersRes = await npPost<NpCounterpartyItem>('Counterparty', 'getCounterparties', {
      CounterpartyProperty: 'Sender', Page: '1',
    }, apiKey);

    if (!sendersRes.success || !sendersRes.data.length) {
      return res.status(400).json({ error: 'Не знайдено відправників у цьому акаунті НП' });
    }
    const sender = sendersRes.data[0];

    type NpContact = { Ref: string; Description: string; Phones: string };
    const contactsRes = await npPost<NpContact>('Counterparty', 'getCounterpartyContactPersons', {
      Ref: sender.Ref, Page: '1',
    }, apiKey);
    const contactRef = contactsRes.data[0]?.Ref ?? '';

    return res.json({
      senderRef: sender.Ref,
      senderName: sender.Description,
      contactSenderRef: contactRef,
      citySenderRef: cityRef,
      senderAddressRef: warehouseRef,
    });
  } catch (err) {
    logger.error('NP fetch-sender error:', err);
    return res.status(500).json({ error: 'Помилка запиту до НП' });
  }
});

router.post('/create-ttn', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { orderId, weight, cost, codAmount, description, seats, payerType } = req.body as {
    orderId: string; weight: number; cost: number; codAmount: number;
    description: string; seats: number; payerType: 'Recipient' | 'Sender';
  };

  if (!orderId || !weight || !cost) {
    return res.status(400).json({ error: 'orderId, weight, cost required' });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId: orgId },
    include: { customer: { select: { name: true, phone: true } } },
  });

  if (!order) return res.status(404).json({ error: 'Замовлення не знайдено' });
  if (!order.npCityRef || !order.npWarehouseRef) {
    return res.status(400).json({ error: 'Немає refs НП у замовленні. Виберіть місто та відділення через інтерфейс КЦ.' });
  }

  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: 'NOVA_POSHTA_SENDER' } },
  });
  if (!integration || !integration.active) {
    return res.status(400).json({ error: 'Налаштування відправника НП не задані. Перейдіть до Налаштувань → Нова Пошта.' });
  }

  let senderConfig: NpSenderConfig;
  try {
    senderConfig = JSON.parse(integration.config) as NpSenderConfig;
  } catch {
    return res.status(400).json({ error: 'Невалідна конфігурація відправника' });
  }

  if (!senderConfig.apiKey || !senderConfig.senderRef || !senderConfig.citySenderRef || !senderConfig.senderAddressRef) {
    return res.status(400).json({ error: 'Конфігурація відправника неповна. Перевірте налаштування.' });
  }

  try {
    const result = await createTtn({
      senderConfig,
      recipientName: order.recipientName || order.customer.name,
      recipientPhone: order.customer.phone,
      npCityRef: order.npCityRef,
      npWarehouseRef: order.npWarehouseRef,
      weight: Number(weight), cost: Number(cost),
      codAmount: Number(codAmount ?? 0),
      description: description?.trim() || 'Товар',
      seats: Number(seats ?? 1),
      payerType: payerType ?? 'Recipient',
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { trackingNumber: result.ttn, status: 'SHIPPED' },
    });

    await prisma.orderHistory.create({
      data: { orderId, action: 'TTN_CREATED', newValue: result.ttn, userId: req.user?.id },
    });

    await logActivity({
      organizationId: orgId,
      userId: req.user?.id,
      action: 'TTN_CREATED', entityType: 'Order', entityId: orderId,
      details: `ТТН: ${result.ttn}`,
      ip: req.ip,
    });

    try {
      const smsConfig = await getTurboSmsConfig(prisma, orgId);
      if (smsConfig) {
        const text =
          `Ваше замовлення #${order.orderNum} відправлено 🚚\n` +
          `ТТН Нової Пошти: ${result.ttn}\n` +
          `Відстежити: https://tracking.novaposhta.ua/#/uk?waybill=${result.ttn}`;
        await sendSmsToCustomer(order.customer.phone, text, smsConfig);
      }
    } catch (smsErr) {
      logger.error('TTN SMS notify error:', smsErr);
    }

    return res.json({
      ttn: result.ttn,
      estimatedDelivery: result.estimatedDelivery,
      deliveryCost: result.cost,
    });
  } catch (err) {
    logger.error('Create TTN error:', err);
    const msg = err instanceof Error ? err.message : 'Помилка створення ТТН';
    return res.status(400).json({ error: msg });
  }
});

router.post('/bulk-create-ttn', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { orderIds, weight = 1, description = 'Товар', payerType = 'Recipient' } = req.body as {
    orderIds: string[]; weight: number; description: string; payerType: 'Recipient' | 'Sender';
  };

  if (!Array.isArray(orderIds) || !orderIds.length) {
    return res.status(400).json({ error: 'orderIds array required' });
  }

  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: 'NOVA_POSHTA_SENDER' } },
  });
  if (!integration?.active) {
    return res.status(400).json({ error: 'Налаштування відправника НП не задані' });
  }

  let senderConfig: NpSenderConfig;
  try {
    senderConfig = JSON.parse(integration.config) as NpSenderConfig;
  } catch {
    return res.status(400).json({ error: 'Невалідна конфігурація відправника' });
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds }, organizationId: orgId },
    include: { customer: { select: { name: true, phone: true } } },
  });

  const results: Array<{ orderId: string; orderNum: number; ttn?: string; error?: string }> = [];
  const smsConfig = await getTurboSmsConfig(prisma, orgId);

  for (const order of orders) {
    if (!order.npCityRef || !order.npWarehouseRef) {
      results.push({ orderId: order.id, orderNum: order.orderNum, error: 'Немає реф НП' });
      continue;
    }
    try {
      const result = await createTtn({
        senderConfig,
        recipientName: order.recipientName || order.customer.name,
        recipientPhone: order.customer.phone,
        npCityRef: order.npCityRef, npWarehouseRef: order.npWarehouseRef,
        weight: Number(weight), cost: order.total, codAmount: order.total,
        description: description || 'Товар', seats: 1,
        payerType: payerType ?? 'Recipient',
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { trackingNumber: result.ttn, status: 'SHIPPED' },
      });
      await prisma.orderHistory.create({
        data: { orderId: order.id, action: 'TTN_CREATED', newValue: result.ttn, userId: req.user?.id },
      });

      if (smsConfig) {
        const text = `Ваше замовлення #${order.orderNum} відправлено 🚚\nТТН: ${result.ttn}\nhttps://tracking.novaposhta.ua/#/uk?waybill=${result.ttn}`;
        sendSmsToCustomer(order.customer.phone, text, smsConfig).catch(() => {});
      }

      results.push({ orderId: order.id, orderNum: order.orderNum, ttn: result.ttn });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка';
      results.push({ orderId: order.id, orderNum: order.orderNum, error: msg });
    }
  }

  const success = results.filter((r) => r.ttn).length;
  const failed = results.filter((r) => r.error).length;
  logger.info(`Bulk TTN: ${success} created, ${failed} failed`);

  return res.json({ success, failed, results });
});

router.get('/tracker/status', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const pendingCount = await prisma.order.count({
    where: { organizationId: orgId, trackingNumber: { not: null }, status: 'SHIPPED' },
  });

  return res.json({
    isRunning: trackerState.isRunning,
    lastRun: trackerState.lastRun,
    lastResult: trackerState.lastResult,
    nextRun: trackerState.nextRun,
    pendingOrders: pendingCount,
    schedule: process.env.NP_TRACKER_CRON || '0 */3 * * *',
  });
});

router.post('/tracker/run', requireRole('ADMIN'), async (_req: AuthRequest, res: Response) => {
  if (trackerState.isRunning) {
    return res.status(409).json({ error: 'Трекер вже запущено' });
  }
  runTrackingCycle().catch((err) => logger.error('Manual tracker run error:', err));
  return res.json({ message: 'Трекер запущено вручну' });
});

router.get('/sla/status', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const slaHours = Number(process.env.SLA_NEW_ORDER_HOURS || 2);
  const threshold = new Date(Date.now() - slaHours * 60 * 60 * 1000);

  const overdueCount = await prisma.order.count({
    where: { organizationId: orgId, status: 'NEW', createdAt: { lt: threshold } },
  });

  return res.json({
    isRunning: slaTrackerState.isRunning,
    lastRun: slaTrackerState.lastRun,
    lastResult: slaTrackerState.lastResult,
    overdueOrders: overdueCount,
    slaHours,
    schedule: process.env.SLA_CHECK_INTERVAL_CRON || '*/30 * * * *',
  });
});

router.post('/sla/run', requireRole('ADMIN'), async (_req: AuthRequest, res: Response) => {
  if (slaTrackerState.isRunning) {
    return res.status(409).json({ error: 'SLA трекер вже запущено' });
  }
  runSlaCheck().catch((err) => logger.error('Manual SLA check error:', err));
  return res.json({ message: 'SLA перевірку запущено вручну' });
});

// GET /api/nova-poshta/print-ttn?orderId=xxx&format=pdf|html&size=100x100|A4
// Streams the printable TTN through the backend so the NP apiKey never
// leaks to the browser (URL referer, history, sharing).
router.get('/print-ttn', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { orderId } = req.query as { orderId?: string };
  const format = (req.query.format as string) === 'html' ? 'html' : 'pdf';
  const size = (req.query.size as string) === 'A4' ? 'A4' : '100x100';
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId: orgId },
    select: { trackingNumber: true, orderNum: true },
  });
  if (!order) return res.status(404).json({ error: 'Замовлення не знайдено' });
  if (!order.trackingNumber) return res.status(400).json({ error: 'У замовлення немає ТТН' });

  // Per-org NP API key
  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: 'NOVA_POSHTA_SENDER' } },
  });
  const apiKey = integration?.active
    ? (JSON.parse(integration.config) as { apiKey?: string }).apiKey || ''
    : process.env.NP_API_KEY || '';
  if (!apiKey) return res.status(400).json({ error: 'NP API key не задано' });

  const sizePath = size === 'A4' ? '' : '/100x100';
  const upstream = `https://my.novaposhta.ua/orders/printDocument/orders[]/${order.trackingNumber}/type/${format}/apiKey/${apiKey}${sizePath}`;

  try {
    const r = await fetch(upstream);
    if (!r.ok) {
      logger.warn(`NP printDocument returned ${r.status} for TTN ${order.trackingNumber}`);
      return res.status(502).json({ error: `Нова Пошта повернула статус ${r.status}` });
    }
    const contentType = r.headers.get('content-type') || (format === 'pdf' ? 'application/pdf' : 'text/html');
    const filename = `TTN-${order.trackingNumber}-${size}.${format === 'pdf' ? 'pdf' : 'html'}`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const buf = Buffer.from(await r.arrayBuffer());
    return res.send(buf);
  } catch (err) {
    logger.error('NP print-ttn proxy error:', err);
    return res.status(500).json({ error: 'Помилка отримання документа з НП' });
  }
});

export default router;
