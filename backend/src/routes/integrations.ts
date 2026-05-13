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

// Сигнатура маскированного значения из GET /integrations: `aaaa****bbbb`.
// Если UI прислал такое значение — значит юзер просто round-trip'нул маску,
// настоящего ключа он не вводил → сохраняем существующий.
const MASKED_RE = /\*{3,}/;

router.put('/:type', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { type } = req.params;
  const { config: incomingConfig, active } = req.body as {
    config?: Record<string, unknown>;
    active?: boolean;
  };

  const existing = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type } },
  });

  let baseConfig: Record<string, unknown> = {};
  if (existing) {
    try {
      baseConfig = JSON.parse(existing.config) as Record<string, unknown>;
    } catch {
      // битый JSON в БД — стартуем с пустого
    }
  }

  // Мерджим: каждое поле из incomingConfig перезаписывает existing,
  // КРОМЕ строк с маской — их пропускаем, чтобы не затереть реальный секрет.
  const mergedConfig: Record<string, unknown> = { ...baseConfig };
  for (const [key, value] of Object.entries(incomingConfig ?? {})) {
    if (typeof value === 'string' && MASKED_RE.test(value)) continue;
    mergedConfig[key] = value;
  }

  const nextActive =
    typeof active === 'boolean' ? active : existing?.active ?? false;

  const integration = await prisma.integration.upsert({
    where: { organizationId_type: { organizationId: orgId, type } },
    update: { config: JSON.stringify(mergedConfig), active: nextActive },
    create: {
      organizationId: orgId,
      type,
      name: type,
      config: JSON.stringify(mergedConfig),
      active: nextActive,
    },
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
