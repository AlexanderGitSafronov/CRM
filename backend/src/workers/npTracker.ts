import cron from 'node-cron';
import prisma from '../services/prisma';
import { getTrackingStatuses } from '../services/novaPoshta';
import { createNotification, logActivity } from '../services/notifications';
import { sendTelegramMessage } from '../services/telegram';
import { sendIncomeToRashod } from '../services/rashodWebhook';
import { sendSmsToCustomer, getTurboSmsConfig } from '../services/turbosms';
import logger from '../utils/logger';

// Worker state — shared across the module
export const trackerState = {
  lastRun: null as Date | null,
  lastResult: null as { checked: number; updated: number; errors: number } | null,
  isRunning: false,
  nextRun: null as Date | null,
};

// Run one tracking cycle: check all SHIPPED orders with TTN
export async function runTrackingCycle(): Promise<{ checked: number; updated: number; errors: number }> {
  if (trackerState.isRunning) {
    logger.info('NP Tracker: already running, skipping');
    return { checked: 0, updated: 0, errors: 0 };
  }

  trackerState.isRunning = true;
  logger.info('NP Tracker: starting cycle');

  const result = { checked: 0, updated: 0, errors: 0 };

  try {
    // Get API key from sender config
    const integration = await prisma.integration.findUnique({
      where: { type: 'NOVA_POSHTA_SENDER' },
    });

    const apiKey = integration
      ? (JSON.parse(integration.config) as { apiKey?: string }).apiKey || ''
      : process.env.NP_API_KEY || '';

    if (!apiKey) {
      logger.warn('NP Tracker: no API key configured, skipping');
      trackerState.isRunning = false;
      return result;
    }

    // Find all orders with TTN and status SHIPPED (batch by 100)
    const orders = await prisma.order.findMany({
      where: {
        trackingNumber: { not: null },
        status: 'SHIPPED',
      },
      select: {
        id: true,
        orderNum: true,
        trackingNumber: true,
        managerId: true,
        total: true,
        source: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    if (!orders.length) {
      logger.info('NP Tracker: no SHIPPED orders with TTN');
      trackerState.isRunning = false;
      return result;
    }

    result.checked = orders.length;
    logger.info(`NP Tracker: checking ${orders.length} orders`);

    // Batch in groups of 100 (NP API limit)
    const BATCH_SIZE = 100;
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const batch = orders.slice(i, i + BATCH_SIZE);
      const ttns = batch.map((o) => o.trackingNumber!);

      try {
        const statuses = await getTrackingStatuses(ttns, apiKey);

        for (const status of statuses) {
          if (!status.crmStatus) continue; // No change needed

          const order = batch.find((o) => o.trackingNumber === status.ttn);
          if (!order) continue;

          // Update order status
          await prisma.order.update({
            where: { id: order.id },
            data: { status: status.crmStatus },
          });

          // History entry
          await prisma.orderHistory.create({
            data: {
              orderId: order.id,
              action: 'STATUS_CHANGED',
              oldValue: 'SHIPPED',
              newValue: status.crmStatus,
            },
          });

          // In-app notification to manager (if assigned) or all admins
          const statusLabel = status.crmStatus === 'DELIVERED' ? 'Доставлено' : 'Повернення';
          await createNotification({
            userId: order.managerId ?? undefined,
            type: 'STATUS_CHANGE',
            title: `Замовлення #${order.orderNum} — ${statusLabel}`,
            message: `${order.customer.name} · ТТН ${status.ttn}`,
            entityId: order.id,
          });

          // Telegram notification
          try {
            const tgIntegration = await prisma.integration.findUnique({
              where: { type: 'TELEGRAM' },
            });
            if (tgIntegration?.active) {
              const cfg = JSON.parse(tgIntegration.config) as { botToken: string; chatId: string };
              if (cfg.botToken && cfg.chatId) {
                const emoji = status.crmStatus === 'DELIVERED' ? '✅' : '↩️';
                await sendTelegramMessage({
                  botToken: cfg.botToken,
                  chatId: cfg.chatId,
                  message: `${emoji} <b>Замовлення #${order.orderNum}</b>\n${order.customer.name}\nТТН: <code>${status.ttn}</code>\nСтатус: ${statusLabel}`,
                });
              }
            }
          } catch (tgErr) {
            logger.error('NP Tracker telegram error:', tgErr);
          }

          await logActivity({
            action: 'NP_STATUS_UPDATED',
            entityType: 'Order',
            entityId: order.id,
            details: `TTN ${status.ttn}: ${status.statusText} → ${status.crmStatus}`,
          });

          // Send income to rashod when delivered
          if (status.crmStatus === 'DELIVERED') {
            sendIncomeToRashod({
              orderId: order.id,
              orderNum: order.orderNum,
              total: order.total,
              source: order.source,
              deliveredAt: new Date(),
            }).catch(() => {});
          }

          // SMS to customer on return
          if (status.crmStatus === 'RETURNED') {
            try {
              const smsConfig = await getTurboSmsConfig(prisma);
              if (smsConfig) {
                await sendSmsToCustomer(
                  order.customer.phone,
                  `Ваше замовлення #${order.orderNum} повернулось на відділення НП. Зв'яжіться з менеджером для уточнення.`,
                  smsConfig,
                );
              }
            } catch (smsErr) {
              logger.error('NP Tracker SMS error on return:', smsErr);
            }
          }

          result.updated++;
          logger.info(`NP Tracker: order #${order.orderNum} TTN ${status.ttn} → ${status.crmStatus}`);
        }
      } catch (batchErr) {
        result.errors++;
        logger.error('NP Tracker batch error:', batchErr);
      }
    }
  } catch (err) {
    result.errors++;
    logger.error('NP Tracker cycle error:', err);
  } finally {
    trackerState.isRunning = false;
    trackerState.lastRun = new Date();
    trackerState.lastResult = result;
  }

  logger.info(`NP Tracker: done. checked=${result.checked} updated=${result.updated} errors=${result.errors}`);
  return result;
}

let cronJob: ReturnType<typeof cron.schedule> | null = null;

// Default: every 3 hours at :00 — "0 */3 * * *"
// Can be overridden by NP_TRACKER_CRON env var
const CRON_SCHEDULE = process.env.NP_TRACKER_CRON || '0 */3 * * *';

export function startNpTracker() {
  if (cronJob) return; // Already started

  logger.info(`NP Tracker: scheduling with cron "${CRON_SCHEDULE}"`);

  cronJob = cron.schedule(CRON_SCHEDULE, async () => {
    await runTrackingCycle();
    // Calculate next run
    trackerState.nextRun = getNextRunDate();
  });

  trackerState.nextRun = getNextRunDate();
  logger.info(`NP Tracker: started. Next run: ${trackerState.nextRun?.toISOString()}`);
}

export function stopNpTracker() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('NP Tracker: stopped');
  }
}

function getNextRunDate(): Date {
  // Approximate next run from cron expression
  const match = CRON_SCHEDULE.match(/^0 \*\/(\d+) \* \* \*$/);
  const intervalHours = match ? parseInt(match[1]) : 3;
  const now = new Date();
  const next = new Date(now);
  const currentHour = now.getHours();
  const hoursUntilNext = intervalHours - (currentHour % intervalHours);
  next.setHours(currentHour + hoursUntilNext, 0, 0, 0);
  return next;
}
