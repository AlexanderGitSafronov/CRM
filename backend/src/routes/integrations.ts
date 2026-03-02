import { Router, Request, Response } from 'express';
import prisma from '../services/prisma';
import { sendTelegramMessage } from '../services/telegram';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', async (req: Request, res: Response) => {
  const integrations = await prisma.integration.findMany();
  // Mask sensitive fields in config before returning
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

router.put('/:type', async (req: Request, res: Response) => {
  const { type } = req.params;
  const { config, active } = req.body;

  const integration = await prisma.integration.upsert({
    where: { type },
    update: {
      config: JSON.stringify(config),
      active: Boolean(active),
    },
    create: {
      type,
      name: type,
      config: JSON.stringify(config),
      active: Boolean(active),
    },
  });

  return res.json(integration);
});

router.post('/telegram/test', async (req: Request, res: Response) => {
  const { botToken, chatId } = req.body;

  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'botToken and chatId required' });
  }

  const success = await sendTelegramMessage({
    botToken,
    chatId,
    message: '✅ <b>Тестовое сообщение</b>\n\nCRM подключена успешно!',
  });

  if (success) {
    return res.json({ success: true, message: 'Test message sent' });
  } else {
    return res.status(400).json({ success: false, error: 'Failed to send message. Check token and chat ID.' });
  }
});

export default router;
