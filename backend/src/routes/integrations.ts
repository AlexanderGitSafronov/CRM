import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { sendTelegramMessage } from '../services/telegram';
import { sendSmsToCustomer, type TurboSmsChannel } from '../services/turbosms';
import { testAdtrackConnection } from '../services/adtrackWebhook';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const integrations = await prisma.integration.findMany({ where: { organizationId: orgId } });
  const masked = integrations.map((integration) => {
    try {
      const config = JSON.parse(integration.config) as Record<string, unknown>;
      const SENSITIVE_KEYS = ['botToken', 'token', 'secret', 'apiKey', 'password', 'accessToken'];
      const maskedConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase())) && typeof value === 'string' && value) {
          maskedConfig[key] = value.slice(0, 4) + '****' + value.slice(-4);
        } else {
          maskedConfig[key] = value;
        }
      }
      return { ...integration, config: JSON.stringify(maskedConfig) };
    } catch {
      return integration;
    }
  });
  return res.json(masked);
});

router.put('/:type', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { type } = req.params;
  const { config, active } = req.body;

  const integration = await prisma.integration.upsert({
    where: { organizationId_type: { organizationId: orgId, type } },
    update: { config: JSON.stringify(config), active: Boolean(active) },
    create: { organizationId: orgId, type, name: type, config: JSON.stringify(config), active: Boolean(active) },
  });

  return res.json(integration);
});

router.post('/telegram/test', async (req: AuthRequest, res: Response) => {
  const { botToken, chatId } = req.body;
  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'botToken and chatId required' });
  }
  const success = await sendTelegramMessage({
    botToken, chatId,
    message: '✅ <b>Тестовое сообщение</b>\n\nCRM подключена успешно!',
  });
  if (success) return res.json({ success: true, message: 'Test message sent' });
  return res.status(400).json({ success: false, error: 'Failed to send message. Check token and chat ID.' });
});

router.post('/turbosms/test', async (req: AuthRequest, res: Response) => {
  const { token, senderName, channel, phone } = req.body as {
    token: string; senderName: string; channel: TurboSmsChannel; phone: string;
  };
  if (!token || !senderName || !phone) {
    return res.status(400).json({ error: 'token, senderName, phone required' });
  }
  const ok = await sendSmsToCustomer(
    phone,
    `✅ Тестове повідомлення від CRM. Канал: ${channel ?? 'viber_sms'}`,
    { token, senderName, channel: channel ?? 'viber_sms' },
  );
  if (ok) return res.json({ success: true, message: 'Повідомлення надіслано' });
  return res.status(400).json({ success: false, error: 'Не вдалось надіслати. Перевірте токен та ім\'я відправника.' });
});

router.post('/adtrack/test', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { trackingId, webhookSecret, baseUrl } = (req.body ?? {}) as {
    trackingId?: string;
    webhookSecret?: string;
    baseUrl?: string;
  };
  // Если в body есть креды — тестируем их напрямую (без сохранения).
  // Если пусто — fallback на сохранённую интеграцию.
  const inline =
    trackingId && webhookSecret ? { trackingId, webhookSecret, baseUrl } : undefined;
  const result = await testAdtrackConnection(orgId, inline);
  if (result.ok) return res.json({ success: true, message: 'AdTrack reachable, credentials valid' });
  return res.status(400).json({ success: false, error: result.error });
});

export default router;
