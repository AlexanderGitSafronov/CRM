import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { sendTelegramMessage } from '../services/telegram';
import { sendSmsToCustomer, getTurboSmsBalance, type TurboSmsChannel } from '../services/turbosms';
import { testAdtrackConnection } from '../services/adtrackWebhook';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

/**
 * Маска секрета — строка из `•` той же длины что и оригинал.
 * UI ставит её в input как value: пользователь видит реальное колво
 * символов своего ключа, при этом не раскрывает его содержимое.
 * При сохранении бэк отличает «голую маску» от настоящего нового значения
 * и не затирает реальный ключ (см. MASKED_RE в PUT).
 */
const SENSITIVE_KEYS = ['botToken', 'token', 'secret', 'apiKey', 'password', 'accessToken'];
function maskValue(v: string): string {
  return '•'.repeat(Math.min(v.length, 200));
}

router.get('/', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const integrations = await prisma.integration.findMany({ where: { organizationId: orgId } });
  const masked = integrations.map((integration) => {
    try {
      const config = JSON.parse(integration.config) as Record<string, unknown>;
      const maskedConfig: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase())) && typeof value === 'string' && value) {
          maskedConfig[key] = maskValue(value);
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

// Сигнатура маскированного значения: либо чистая bullet-строка `•••••…`,
// либо легаси `aaaa****bbbb`. В обоих случаях НЕ затираем реальный ключ.
// • = BULLET, · = MIDDLE DOT (на всякий случай).
// Оба альтернативных паттерна заякорены: иначе настоящий секрет,
// содержащий `***` внутри, ошибочно считался бы маской и терялся.
const MASKED_RE = /^[•·]+$|^\S{0,6}\*{3,}\S{0,6}$/;
const isSensitiveKey = (key: string) =>
  SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()));

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
  // КРОМЕ чувствительных ключей со значением-маской — их пропускаем,
  // чтобы не затереть реальный секрет. Нечувствительные поля всегда берём как есть.
  const mergedConfig: Record<string, unknown> = { ...baseConfig };
  for (const [key, value] of Object.entries(incomingConfig ?? {})) {
    if (isSensitiveKey(key) && typeof value === 'string' && MASKED_RE.test(value)) continue;
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
    { token, senderName, channel: channel ?? 'viber_sms', smsOnOrderCreated: true, smsOnArrival: true },
  );
  if (ok) return res.json({ success: true, message: 'Повідомлення надіслано' });
  return res.status(400).json({ success: false, error: 'Не вдалось надіслати. Перевірте токен та ім\'я відправника.' });
});

// Баланс TurboSMS по сохранённому в БД токену организации.
// Возвращает { balance: null } если интеграция не настроена/нет токена/недоступна.
router.get('/turbosms/balance', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId: orgId, type: 'TURBOSMS' } },
  });
  if (!integration) return res.json({ balance: null });

  let token: string | undefined;
  try {
    const cfg = JSON.parse(integration.config) as { token?: string };
    token = cfg.token;
  } catch {
    // битый JSON — считаем не настроенным
  }
  if (!token) return res.json({ balance: null });

  const balance = await getTurboSmsBalance(token);
  return res.json({ balance });
});

router.post('/adtrack/test', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { trackingId, webhookSecret, baseUrl } = (req.body ?? {}) as {
    trackingId?: string;
    webhookSecret?: string;
    baseUrl?: string;
  };
  // Если webhookSecret выглядит как маска из точек/звёздочек — это не настоящий
  // секрет, а round-trip визуального плейсхолдера. Используем сохранённый в БД.
  const isMask = (s: string | undefined) =>
    typeof s === 'string' && MASKED_RE.test(s);
  const realSecret = webhookSecret && !isMask(webhookSecret) ? webhookSecret : undefined;
  const inline = trackingId && realSecret ? { trackingId, webhookSecret: realSecret, baseUrl } : undefined;

  const result = await testAdtrackConnection(orgId, inline);
  if (result.ok) return res.json({ success: true, message: 'AdTrack reachable, credentials valid' });
  return res.status(400).json({ success: false, error: result.error });
});

export default router;
