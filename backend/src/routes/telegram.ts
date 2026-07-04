import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../services/prisma';
import { answerCallbackQuery } from '../services/telegram';
import { sendOrderStatusByIdToAdtrack } from '../services/adtrackWebhook';
import { logActivity } from '../services/notifications';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// POST /api/telegram/webhook
// Telegram sends callback_query here. The order's organizationId determines whose bot to answer with.
router.post('/webhook', async (req: Request, res: Response) => {
  res.json({ ok: true });

  const update = req.body as {
    callback_query?: {
      id: string;
      from: { id: number; username?: string; first_name?: string };
      data?: string;
    };
  };

  if (!update.callback_query) return;

  const { id: callbackQueryId, data } = update.callback_query;
  if (!data) return;

  const [action, orderId] = data.split(':');
  if (!orderId) return;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNum: true, status: true, organizationId: true },
    });

    if (!order) return;

    const tg = await prisma.integration.findUnique({
      where: { organizationId_type: { organizationId: order.organizationId, type: 'TELEGRAM' } },
    });
    if (!tg?.active) return;
    const cfg = JSON.parse(tg.config) as { botToken: string; webhookSecret?: string };

    // Проверяем подлинность ДО любых изменений состояния.
    // Telegram присылает secret_token (заданный в setWebhook) в этом заголовке.
    // Fail-closed: без настроенного секрета апдейт неподтверждаем — не меняем статус,
    // иначе любой аноним с id заказа мог бы подтвердить/отменить чужой заказ.
    if (!cfg.webhookSecret) {
      logger.warn(`Telegram webhook without secret for org ${order.organizationId} — ignoring. Re-run set-webhook to activate.`);
      return;
    }
    const provided = req.get('x-telegram-bot-api-secret-token') ?? '';
    const expected = Buffer.from(cfg.webhookSecret);
    const actual = Buffer.from(provided);
    const valid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!valid) {
      logger.warn(`Telegram webhook secret mismatch for org ${order.organizationId}, ignoring update`);
      return;
    }

    if (action === 'confirm') {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } });
      await prisma.orderHistory.create({
        data: { orderId, action: 'STATUS_CHANGED', oldValue: order.status, newValue: 'CONFIRMED' },
      });
      await answerCallbackQuery(cfg.botToken, callbackQueryId, `✅ Замовлення #${order.orderNum} підтверджено`);
      void sendOrderStatusByIdToAdtrack(orderId, 'CONFIRMED');
      await logActivity({
        organizationId: order.organizationId,
        action: 'TG_CONFIRMED', entityType: 'Order', entityId: orderId,
        details: 'Telegram inline confirm',
      });
    } else if (action === 'cancel') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelReason: 'Відмова (Telegram)' },
      });
      await prisma.orderHistory.create({
        data: { orderId, action: 'STATUS_CHANGED', oldValue: order.status, newValue: 'CANCELLED' },
      });
      await answerCallbackQuery(cfg.botToken, callbackQueryId, `❌ Замовлення #${order.orderNum} скасовано`);
      void sendOrderStatusByIdToAdtrack(orderId, 'CANCELLED');
      await logActivity({
        organizationId: order.organizationId,
        action: 'TG_CANCELLED', entityType: 'Order', entityId: orderId,
        details: 'Telegram inline cancel',
      });
    }
  } catch (err) {
    logger.error('Telegram webhook handler error:', err);
  }
});

router.post('/set-webhook', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { webhookUrl } = req.body as { webhookUrl: string };
  if (!webhookUrl) return res.status(400).json({ error: 'webhookUrl required' });

  const tg = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: 'TELEGRAM' } },
  });
  if (!tg?.active) return res.status(400).json({ error: 'Telegram не налаштований' });

  const cfg = JSON.parse(tg.config) as { botToken: string; webhookSecret?: string };
  try {
    // secret_token: Telegram будет присылать его в заголовке
    // x-telegram-bot-api-secret-token каждого апдейта — /webhook сверяет его.
    const secret = crypto.randomBytes(32).toString('hex');
    const r = await fetch(`https://api.telegram.org/bot${cfg.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `${webhookUrl}/api/telegram/webhook`, secret_token: secret }),
    });
    const data = await r.json() as { ok: boolean; description?: string };
    if (data.ok) {
      await prisma.integration.update({
        where: { organizationId_type: { organizationId: orgId, type: 'TELEGRAM' } },
        data: { config: JSON.stringify({ ...cfg, webhookSecret: secret }) },
      });
    }
    return res.json(data);
  } catch (err) {
    logger.error('Set webhook error:', err);
    return res.status(500).json({ error: 'Помилка' });
  }
});

export default router;
