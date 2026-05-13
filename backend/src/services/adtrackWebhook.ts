import fetch from 'node-fetch';
import prisma from './prisma';
import logger from '../utils/logger';

/**
 * Опциональная интеграция с AdTrack.
 * Если в Integration{type:'ADTRACK', active:true} не задан config — тихо пропускаем.
 *
 * AdTrack обучает FB/TikTok пиксели на **подтверждённый выкуп** (статус DELIVERED),
 * а не на сам заказ. Шлём событие на каждое релевантное изменение статуса.
 */

const DEFAULT_ADTRACK_URL = 'https://adtrack-backend.vercel.app';

/**
 * Нормализует Backend URL: убирает trailing slash и хвост `/webhook/...`,
 * если пользователь скопировал готовый endpoint вместо базового URL.
 */
function normalizeBaseUrl(raw: string | undefined | null): string {
  let url = (raw || '').trim() || DEFAULT_ADTRACK_URL;
  url = url.replace(/\/+$/, '');                // trailing /
  url = url.replace(/\/webhook\/order-status$/i, ''); // полный endpoint
  url = url.replace(/\/webhook$/i, '');                // /webhook
  return url;
}

/**
 * Мапа из CRM-статусов в OrderStatus AdTrack.
 * `null` — не слать (статусы которые AdTrack не различает).
 */
type AdtrackStatus = 'NEW' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'RETURNED' | 'CANCELLED';
const STATUS_MAP: Record<string, AdtrackStatus | null> = {
  NEW: 'NEW',
  PROCESSING: 'CONFIRMED', // в воронке = заказ обрабатывается = лид
  CONFIRMED: 'CONFIRMED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  RETURNED: 'RETURNED',
  CALLED: null, // промежуточный CC-статус — AdTrack не знает
  NO_ANSWER: null,
};

interface AdtrackConfig {
  trackingId: string;
  webhookSecret: string;
  baseUrl?: string;
}

/**
 * Достаёт активную интеграцию ADTRACK для организации. Возвращает null
 * если интеграции нет / не активна / config битый.
 */
async function loadAdtrackConfig(organizationId: string): Promise<AdtrackConfig | null> {
  try {
    const integration = await prisma.integration.findUnique({
      where: { organizationId_type: { organizationId, type: 'ADTRACK' } },
    });
    if (!integration || !integration.active) return null;
    const config = JSON.parse(integration.config) as Partial<AdtrackConfig>;
    if (!config.trackingId || !config.webhookSecret) return null;
    return {
      trackingId: config.trackingId,
      webhookSecret: config.webhookSecret,
      baseUrl: normalizeBaseUrl(config.baseUrl || process.env.ADTRACK_WEBHOOK_URL),
    };
  } catch (err) {
    logger.warn(`AdTrack config parse failed for org ${organizationId}:`, err);
    return null;
  }
}

export interface AdtrackOrderInput {
  organizationId: string;
  orderId: string; // внутренний CRM id (для дедупа adtrackLastSentAt)
  externalId: string; // что отправить как externalId в AdTrack (мы используем тот же CRM order.id)
  orderNum?: number; // для логов
  status: string; // CRM-статус
  amount: number;
  currency?: string;
  customer?: {
    email?: string | null;
    phone?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  };
  attribution?: {
    fbclid?: string | null;
    ttclid?: string | null;
    gclid?: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    utmTerm?: string | null;
  };
}

/**
 * Шлёт текущий статус заказа в AdTrack. Идемпотентна: AdTrack делает upsert
 * по `(projectId, externalId)`, наша сторона помечает `adtrackLastStatus/SentAt`,
 * чтобы не дёргать вебхук дважды на один и тот же статус.
 *
 * Никогда не бросает — все ошибки логируются и проглатываются. Если интеграция
 * не настроена — silent skip.
 */
export async function sendOrderStatusToAdtrack(input: AdtrackOrderInput): Promise<void> {
  const cfg = await loadAdtrackConfig(input.organizationId);
  if (!cfg) return;

  const mapped = STATUS_MAP[input.status];
  if (!mapped) return; // CALLED / NO_ANSWER → не отправляем

  // Дедупликация на нашей стороне: если последний отправленный статус совпадает —
  // пропускаем (статус может ставиться повторно при ручных кликах).
  try {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { adtrackLastStatus: true },
    });
    if (order?.adtrackLastStatus === mapped) return;
  } catch {
    // не критично, продолжаем
  }

  // strip null'ы — AdTrack ожидает .optional(), а не null
  const customer = stripNulls(input.customer);
  const attribution = stripNulls(input.attribution);

  const payload = {
    trackingId: cfg.trackingId,
    secret: cfg.webhookSecret,
    order: {
      externalId: input.externalId,
      status: mapped,
      amount: input.amount,
      currency: input.currency ?? 'UAH',
      ...(Object.keys(customer).length ? { customer } : {}),
      ...(Object.keys(attribution).length ? { attribution } : {}),
    },
  };

  try {
    const res = await fetch(`${cfg.baseUrl}/webhook/order-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn(
        `AdTrack webhook failed for order ${input.orderNum ?? input.orderId} (${mapped}): ${res.status} ${body}`,
      );
      return;
    }
    // успех — отмечаем у себя
    await prisma.order.update({
      where: { id: input.orderId },
      data: { adtrackLastStatus: mapped, adtrackLastSentAt: new Date() },
    }).catch(() => {});
    logger.info(`AdTrack webhook: ${mapped} sent for order ${input.orderNum ?? input.orderId}`);
  } catch (err) {
    logger.error(
      `AdTrack webhook error for order ${input.orderNum ?? input.orderId}:`,
      err,
    );
  }
}

function stripNulls<T extends object | undefined>(obj: T): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && v !== '') out[k] = String(v);
  }
  return out;
}

/**
 * Удобный shortcut — загружает заказ и его атрибуцию, шлёт. Используется в местах,
 * где у нас есть только orderId (например в воркерах).
 */
export async function sendOrderStatusByIdToAdtrack(orderId: string, newStatus: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNum: true,
        organizationId: true,
        total: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        utmTerm: true,
        fbclid: true,
        ttclid: true,
        gclid: true,
        customerIp: true,
        customerUserAgent: true,
        customer: { select: { email: true, phone: true } },
      },
    });
    if (!order) return;
    await sendOrderStatusToAdtrack({
      organizationId: order.organizationId,
      orderId: order.id,
      externalId: order.id,
      orderNum: order.orderNum,
      status: newStatus,
      amount: order.total,
      customer: {
        email: order.customer?.email,
        phone: order.customer?.phone,
        ip: order.customerIp,
        userAgent: order.customerUserAgent,
      },
      attribution: {
        fbclid: order.fbclid,
        ttclid: order.ttclid,
        gclid: order.gclid,
        utmSource: order.utmSource,
        utmMedium: order.utmMedium,
        utmCampaign: order.utmCampaign,
        utmContent: order.utmContent,
        utmTerm: order.utmTerm,
      },
    });
  } catch (err) {
    logger.error(`AdTrack webhook: failed to load order ${orderId}:`, err);
  }
}

/**
 * Тестовая отправка — для кнопки "Проверить" в UI Settings.
 *
 * Если переданы `inline` параметры, используем их напрямую (можно тестировать
 * до сохранения формы). Иначе тянем активную интеграцию из БД.
 */
export async function testAdtrackConnection(
  organizationId: string,
  inline?: Partial<AdtrackConfig>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let cfg: AdtrackConfig | null;

  if (inline?.trackingId && inline?.webhookSecret) {
    cfg = {
      trackingId: inline.trackingId.trim(),
      webhookSecret: inline.webhookSecret.trim(),
      baseUrl: normalizeBaseUrl(inline.baseUrl),
    };
  } else {
    cfg = await loadAdtrackConfig(organizationId);
  }

  if (!cfg) return { ok: false, error: 'AdTrack integration is not configured or not active' };

  try {
    const res = await fetch(`${cfg.baseUrl}/webhook/order-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingId: cfg.trackingId,
        secret: cfg.webhookSecret,
        order: {
          externalId: `crm-test-${Date.now()}`,
          status: 'NEW',
          amount: 0,
          currency: 'UAH',
        },
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `${res.status}: ${body.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
