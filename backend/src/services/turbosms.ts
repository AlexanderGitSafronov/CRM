import fetch from 'node-fetch';
import logger from '../utils/logger';

const TURBOSMS_URL = 'https://api.turbosms.ua/message/send.json';
const TURBOSMS_BALANCE_URL = 'https://api.turbosms.ua/user/balance.json';

export type TurboSmsChannel = 'sms' | 'viber' | 'viber_sms';

export interface TurboSmsConfig {
  token: string;
  senderName: string;
  channel: TurboSmsChannel;
  smsOnOrderCreated: boolean;
  smsOnArrival: boolean;
}

interface TurboSmsResponse {
  response_code: number;
  response_status: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('380')) return digits;
  if (digits.startsWith('80')) return '3' + digits;
  if (digits.startsWith('0')) return '38' + digits;
  return digits;
}

export async function sendSmsToCustomer(
  phone: string,
  text: string,
  config: TurboSmsConfig,
): Promise<boolean> {
  const recipient = normalizePhone(phone);
  const body: Record<string, unknown> = { recipients: [recipient] };

  const msgPayload = { sender: config.senderName, text };

  if (config.channel === 'sms') body.sms = msgPayload;
  else if (config.channel === 'viber') body.viber = msgPayload;
  else { body.viber = msgPayload; body.sms = msgPayload; }

  try {
    const response = await fetch(TURBOSMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as TurboSmsResponse;
    if (data.response_code === 0) {
      logger.info(`TurboSMS: sent to ${recipient} via ${config.channel}`);
      return true;
    }
    logger.warn(`TurboSMS: failed — code ${data.response_code}, status: ${data.response_status}`);
    return false;
  } catch (err) {
    logger.error('TurboSMS send error:', err);
    return false;
  }
}

// Per-org TurboSMS config
export async function getTurboSmsConfig(prisma: {
  integration: {
    findUnique: (args: { where: { organizationId_type: { organizationId: string; type: string } } }) => Promise<{
      active: boolean;
      config: string;
    } | null>;
  };
}, organizationId: string): Promise<TurboSmsConfig | null> {
  const integration = await prisma.integration.findUnique({
    where: { organizationId_type: { organizationId, type: 'TURBOSMS' } },
  });

  if (!integration?.active) return null;

  try {
    const cfg = JSON.parse(integration.config) as Partial<TurboSmsConfig>;
    if (!cfg.token || !cfg.senderName) return null;
    return {
      token: cfg.token,
      senderName: cfg.senderName,
      channel: cfg.channel ?? 'viber_sms',
      // Новые типы SMS включены по умолчанию для уже настроенных конфигов:
      // если поля нет в JSON — считаем true.
      smsOnOrderCreated: cfg.smsOnOrderCreated ?? true,
      smsOnArrival: cfg.smsOnArrival ?? true,
    };
  } catch {
    return null;
  }
}

interface TurboSmsBalanceResponse {
  response_code?: number;
  response_status?: string;
  response_result?: { balance?: number | string } | null;
  balance?: number | string;
}

// Возвращает числовой баланс аккаунта TurboSMS или null при ошибке/невалидном ответе.
export async function getTurboSmsBalance(token: string): Promise<number | null> {
  try {
    const response = await fetch(TURBOSMS_BALANCE_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as TurboSmsBalanceResponse;
    const raw = data.response_result?.balance ?? data.balance;
    const balance = typeof raw === 'string' ? parseFloat(raw) : raw;
    if (typeof balance === 'number' && Number.isFinite(balance)) return balance;
    logger.warn('TurboSMS: balance parse failed', data);
    return null;
  } catch (err) {
    logger.error('TurboSMS balance error:', err);
    return null;
  }
}
