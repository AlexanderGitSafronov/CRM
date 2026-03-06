import cron from 'node-cron';
import prisma from '../services/prisma';
import { createNotification, logActivity } from '../services/notifications';
import { sendTelegramMessage } from '../services/telegram';
import logger from '../utils/logger';

// SLA threshold: orders in NEW status longer than this are overdue
const SLA_HOURS = Number(process.env.SLA_NEW_ORDER_HOURS || 2);

export const slaTrackerState = {
  lastRun: null as Date | null,
  lastResult: null as { checked: number; notified: number; errors: number } | null,
  isRunning: false,
};

export async function runSlaCheck(): Promise<{ checked: number; notified: number; errors: number }> {
  if (slaTrackerState.isRunning) {
    logger.info('SLA Tracker: already running, skipping');
    return { checked: 0, notified: 0, errors: 0 };
  }

  slaTrackerState.isRunning = true;
  logger.info('SLA Tracker: starting check');

  const result = { checked: 0, notified: 0, errors: 0 };

  try {
    const threshold = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

    // Find NEW orders older than SLA threshold
    const orders = await prisma.order.findMany({
      where: {
        status: 'NEW',
        createdAt: { lt: threshold },
      },
      select: {
        id: true,
        orderNum: true,
        createdAt: true,
        managerId: true,
        customer: { select: { name: true } },
      },
    });

    if (!orders.length) {
      logger.info('SLA Tracker: no overdue orders');
      slaTrackerState.isRunning = false;
      return result;
    }

    result.checked = orders.length;
    logger.info(`SLA Tracker: found ${orders.length} overdue orders`);

    for (const order of orders) {
      try {
        // Check if OVERDUE notification already exists for this order to avoid duplicates
        const existingNotification = await prisma.notification.findFirst({
          where: { type: 'OVERDUE', entityId: order.id },
        });

        if (existingNotification) continue;

        const hoursOverdue = Math.floor(
          (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60),
        );

        await createNotification({
          userId: order.managerId ?? undefined,
          type: 'OVERDUE',
          title: `Замовлення #${order.orderNum} — прострочено SLA`,
          message: `${order.customer.name} · У статусі NEW вже ${hoursOverdue} год.`,
          entityId: order.id,
        });

        // Telegram alert
        try {
          const tgIntegration = await prisma.integration.findUnique({
            where: { type: 'TELEGRAM' },
          });
          if (tgIntegration?.active) {
            const cfg = JSON.parse(tgIntegration.config) as { botToken: string; chatId: string };
            if (cfg.botToken && cfg.chatId) {
              await sendTelegramMessage({
                botToken: cfg.botToken,
                chatId: cfg.chatId,
                message: `⏰ <b>SLA порушено — Замовлення #${order.orderNum}</b>\n${order.customer.name}\nУ статусі NEW вже ${hoursOverdue} год.`,
              });
            }
          }
        } catch (tgErr) {
          logger.error('SLA Tracker telegram error:', tgErr);
        }

        await logActivity({
          action: 'SLA_OVERDUE',
          entityType: 'Order',
          entityId: order.id,
          details: `Замовлення #${order.orderNum} у статусі NEW вже ${hoursOverdue} год.`,
        });

        result.notified++;
        logger.info(`SLA Tracker: order #${order.orderNum} overdue by ${hoursOverdue}h — notified`);
      } catch (err) {
        result.errors++;
        logger.error(`SLA Tracker: error processing order #${order.orderNum}:`, err);
      }
    }
  } catch (err) {
    result.errors++;
    logger.error('SLA Tracker cycle error:', err);
  } finally {
    slaTrackerState.isRunning = false;
    slaTrackerState.lastRun = new Date();
    slaTrackerState.lastResult = result;
  }

  logger.info(
    `SLA Tracker: done. checked=${result.checked} notified=${result.notified} errors=${result.errors}`,
  );
  return result;
}

let slaJob: ReturnType<typeof cron.schedule> | null = null;

// Default: every 30 minutes
const SLA_CRON = process.env.SLA_CHECK_INTERVAL_CRON || '*/30 * * * *';

export function startSlaTracker() {
  if (slaJob) return;

  logger.info(`SLA Tracker: scheduling with cron "${SLA_CRON}" (threshold: ${SLA_HOURS}h)`);

  slaJob = cron.schedule(SLA_CRON, async () => {
    await runSlaCheck();
  });

  logger.info('SLA Tracker: started');
}

export function stopSlaTracker() {
  if (slaJob) {
    slaJob.stop();
    slaJob = null;
    logger.info('SLA Tracker: stopped');
  }
}
