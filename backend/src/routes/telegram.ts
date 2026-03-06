import { Router, Request, Response } from 'express';
import prisma from '../services/prisma';
import { answerCallbackQuery } from '../services/telegram';
import { logActivity } from '../services/notifications';
import logger from '../utils/logger';

const router = Router();

// POST /api/telegram/webhook
// Telegram sends callback_query here when user presses inline keyboard button
// Register with: https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-domain/api/telegram/webhook
router.post('/webhook', async (req: Request, res: Response) => {
  // Respond quickly so Telegram doesn't retry
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
      select: { id: true, orderNum: true, status: true },
    });

    if (!order) {
      // Get bot token to answer
      const tg = await prisma.integration.findUnique({ where: { type: 'TELEGRAM' } });
      if (tg?.active) {
        const cfg = JSON.parse(tg.config) as { botToken: string };
        await answerCallbackQuery(cfg.botToken, callbackQueryId, '❌ Замовлення не знайдено');
      }
      return;
    }

    const tg = await prisma.integration.findUnique({ where: { type: 'TELEGRAM' } });
    if (!tg?.active) return;
    const cfg = JSON.parse(tg.config) as { botToken: string };

    if (action === 'confirm') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED' },
      });
      await prisma.orderHistory.create({
        data: { orderId, action: 'STATUS_CHANGED', oldValue: order.status, newValue: 'CONFIRMED' },
      });
      await answerCallbackQuery(cfg.botToken, callbackQueryId, `✅ Замовлення #${order.orderNum} підтверджено`);
      await logActivity({ action: 'TG_CONFIRMED', entityType: 'Order', entityId: orderId, details: 'Telegram inline confirm' });
    } else if (action === 'cancel') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelReason: 'Відмова (Telegram)' },
      });
      await prisma.orderHistory.create({
        data: { orderId, action: 'STATUS_CHANGED', oldValue: order.status, newValue: 'CANCELLED' },
      });
      await answerCallbackQuery(cfg.botToken, callbackQueryId, `❌ Замовлення #${order.orderNum} скасовано`);
      await logActivity({ action: 'TG_CANCELLED', entityType: 'Order', entityId: orderId, details: 'Telegram inline cancel' });
    }
  } catch (err) {
    logger.error('Telegram webhook handler error:', err);
  }
});

// POST /api/telegram/set-webhook — helper to register webhook URL with Telegram
router.post('/set-webhook', async (req: Request, res: Response) => {
  const { webhookUrl } = req.body as { webhookUrl: string };
  if (!webhookUrl) return res.status(400).json({ error: 'webhookUrl required' });

  const tg = await prisma.integration.findUnique({ where: { type: 'TELEGRAM' } });
  if (!tg?.active) return res.status(400).json({ error: 'Telegram не налаштований' });

  const cfg = JSON.parse(tg.config) as { botToken: string };
  try {
    const r = await fetch(`https://api.telegram.org/bot${cfg.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `${webhookUrl}/api/telegram/webhook` }),
    });
    const data = await r.json() as { ok: boolean; description?: string };
    return res.json(data);
  } catch (err) {
    logger.error('Set webhook error:', err);
    return res.status(500).json({ error: 'Помилка' });
  }
});

export default router;
