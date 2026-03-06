import fetch from 'node-fetch';
import logger from '../utils/logger';

const SOURCE_MAP: Record<string, string> = {
  LANDING: 'landing',
  MAGAZ: 'store',
  MANUAL: 'other',
  WEBHOOK: 'other',
  WEBSITE: 'store',
};

export async function sendIncomeToRashod(params: {
  orderId: string;
  orderNum: number;
  total: number;
  source: string;
  deliveredAt?: Date;
}): Promise<void> {
  const rashodUrl = process.env.RASHOD_WEBHOOK_URL;
  const rashodToken = process.env.RASHOD_WEBHOOK_TOKEN;

  if (!rashodUrl || !rashodToken) {
    return; // Not configured — silently skip
  }

  const source = SOURCE_MAP[params.source] ?? 'other';
  const date = (params.deliveredAt ?? new Date()).toISOString().split('T')[0];

  try {
    const res = await fetch(`${rashodUrl}/api/webhook/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rashodToken,
        amount: params.total,
        source,
        description: `Замовлення #${params.orderNum}`,
        date,
        orderId: params.orderId,
        orderNum: params.orderNum,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn(`Rashod webhook failed for order #${params.orderNum}: ${res.status} ${body}`);
    } else {
      logger.info(`Rashod webhook: income sent for order #${params.orderNum} (${params.total})`);
    }
  } catch (err) {
    logger.error(`Rashod webhook error for order #${params.orderNum}:`, err);
  }
}
