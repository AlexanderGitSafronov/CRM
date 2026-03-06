import fetch from 'node-fetch';
import logger from '../utils/logger';

const TURBOSMS_URL = 'https://api.turbosms.ua/message/send.json';

export type TurboSmsChannel = 'sms' | 'viber' | 'viber_sms';

export interface TurboSmsConfig {
  token: string;
  senderName: string;
  channel: TurboSmsChannel;
}

interface TurboSmsResponse {
  response_code: number;
  response_status: string;
  response_result?: Array<{
    recipient: string;
    sms?: { status: string };
    viber?: { status: string };
  }>;
}

// Normalize phone to 380XXXXXXXXX format (Ukrainian)
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

  if (config.channel === 'sms') {
    body.sms = msgPayload;
  } else if (config.channel === 'viber') {
    body.viber = msgPayload;
  } else {
    // viber_sms: try Viber first, fallback to SMS
    body.viber = msgPayload;
    body.sms = msgPayload;
  }

  try {
    const response = await fetch(TURBOSMS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as TurboSmsResponse;

    if (data.response_code === 0) {
      logger.info(`TurboSMS: sent to ${recipient} via ${config.channel}`);
      return true;
    } else {
      logger.warn(`TurboSMS: failed — code ${data.response_code}, status: ${data.response_status}`);
      return false;
    }
  } catch (err) {
    logger.error('TurboSMS send error:', err);
    return false;
  }
}

export async function getTurboSmsConfig(prisma: {
  integration: {
    findUnique: (args: { where: { type: string } }) => Promise<{
      active: boolean;
      config: string;
    } | null>;
  };
}): Promise<TurboSmsConfig | null> {
  const integration = await prisma.integration.findUnique({
    where: { type: 'TURBOSMS' },
  });

  if (!integration?.active) return null;

  try {
    const cfg = JSON.parse(integration.config) as Partial<TurboSmsConfig>;
    if (!cfg.token || !cfg.senderName) return null;
    return {
      token: cfg.token,
      senderName: cfg.senderName,
      channel: cfg.channel ?? 'viber_sms',
    };
  } catch {
    return null;
  }
}
