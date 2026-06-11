import fetch from 'node-fetch';
import prisma from './prisma';
import logger from '../utils/logger';

const SOURCE_MAP: Record<string, string> = {
  LANDING: 'landing',
  MAGAZ: 'store',
  MANUAL: 'other',
  WEBHOOK: 'other',
  WEBSITE: 'store',
};

interface RashodConfig {
  baseUrl: string;
  token: string;
}

/**
 * Резолвит per-org конфиг Rashod. Приоритет — активная интеграция
 * Integration{type:'RASHOD', active:true} с config {baseUrl, token}.
 * Если активной интеграции нет — падаем на глобальные env
 * RASHOD_WEBHOOK_URL/RASHOD_WEBHOOK_TOKEN (так продолжает работать
 * исходная настройка default-орга). Возвращает null если ничего не настроено.
 */
async function loadRashodConfig(organizationId: string): Promise<RashodConfig | null> {
  try {
    const integration = await prisma.integration.findUnique({
      where: { organizationId_type: { organizationId, type: 'RASHOD' } },
    });
    if (integration && integration.active) {
      const config = JSON.parse(integration.config) as Partial<RashodConfig>;
      const baseUrl = (config.baseUrl || '').trim();
      const token = (config.token || '').trim();
      if (baseUrl && token) {
        return { baseUrl: baseUrl.replace(/\/+$/, ''), token };
      }
    }
  } catch (err) {
    logger.warn(`Rashod config parse failed for org ${organizationId}:`, err);
  }

  // Fallback на глобальные env (исходный default-org сетап).
  const envUrl = (process.env.RASHOD_WEBHOOK_URL || '').trim();
  const envToken = (process.env.RASHOD_WEBHOOK_TOKEN || '').trim();
  if (envUrl && envToken) {
    return { baseUrl: envUrl.replace(/\/+$/, ''), token: envToken };
  }
  return null;
}

export async function sendIncomeToRashod(params: {
  organizationId: string;
  orderId: string;
  orderNum: number;
  total: number;
  source: string;
  deliveredAt?: Date;
}): Promise<void> {
  const cfg = await loadRashodConfig(params.organizationId);
  if (!cfg) {
    return; // Not configured — silently skip
  }

  const source = SOURCE_MAP[params.source] ?? 'other';
  const date = (params.deliveredAt ?? new Date()).toISOString().split('T')[0];

  try {
    const res = await fetch(`${cfg.baseUrl}/api/webhook/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: cfg.token,
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

/**
 * Реверс ранее признанного дохода: посылает НЕГАТИВНУЮ сумму на тот же
 * per-org endpoint /api/webhook/income. Вызывается когда выкупленный заказ
 * (deliveredAt != null) затем стал RETURNED/CANCELLED — чтобы списать доход,
 * который уже был отправлен в Rashod при доставке.
 *
 * Та же устойчивость, что и у sendIncomeToRashod: никогда не бросает,
 * все ошибки логируются и проглатываются.
 */
export async function reverseIncomeToRashod(params: {
  organizationId: string;
  orderId: string;
  orderNum: number;
  total: number;
  source: string;
  returnedAt?: Date;
}): Promise<void> {
  const cfg = await loadRashodConfig(params.organizationId);
  if (!cfg) {
    return; // Not configured — silently skip
  }

  const source = SOURCE_MAP[params.source] ?? 'other';
  const date = (params.returnedAt ?? new Date()).toISOString().split('T')[0];
  const amount = -Math.abs(params.total);

  try {
    const res = await fetch(`${cfg.baseUrl}/api/webhook/income`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: cfg.token,
        amount,
        source,
        description: `Реверс замовлення #${params.orderNum} (повернення)`,
        date,
        orderId: params.orderId,
        orderNum: params.orderNum,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn(`Rashod reverse failed for order #${params.orderNum}: ${res.status} ${body}`);
    } else {
      logger.info(`Rashod webhook: income reversed for order #${params.orderNum} (${amount})`);
    }
  } catch (err) {
    logger.error(`Rashod reverse error for order #${params.orderNum}:`, err);
  }
}
