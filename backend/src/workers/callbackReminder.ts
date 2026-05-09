import cron from 'node-cron';
import prisma from '../services/prisma';
import { createNotification } from '../services/notifications';
import { sendTelegramMessage } from '../services/telegram';
import logger from '../utils/logger';

export const callbackState = {
  lastRun: null as Date | null,
  lastResult: null as { reminded: number; errors: number } | null,
  isRunning: false,
};

export async function runCallbackCheck(): Promise<{ reminded: number; errors: number }> {
  if (callbackState.isRunning) return { reminded: 0, errors: 0 };

  callbackState.isRunning = true;
  const result = { reminded: 0, errors: 0 };

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);

    const due = await prisma.callback.findMany({
      where: { done: false, scheduledAt: { gte: now, lte: windowEnd } },
      include: {
        order: { select: { orderNum: true, customer: { select: { name: true, phone: true } } } },
        manager: { select: { id: true, name: true } },
      },
    });

    for (const cb of due) {
      try {
        const title = `Перезвон: замовлення #${cb.order.orderNum}`;
        const msg = `${cb.order.customer.name} · ${cb.order.customer.phone}${cb.note ? `\n${cb.note}` : ''}`;

        await createNotification({
          organizationId: cb.organizationId,
          userId: cb.managerId ?? undefined,
          type: 'REMINDER',
          title, message: msg,
          entityId: cb.orderId,
        });

        const tgIntegration = await prisma.integration.findUnique({
          where: { organizationId_type: { organizationId: cb.organizationId, type: 'TELEGRAM' } },
        });
        if (tgIntegration?.active) {
          const cfg = JSON.parse(tgIntegration.config) as { botToken: string; chatId: string };
          if (cfg.botToken && cfg.chatId) {
            await sendTelegramMessage({
              botToken: cfg.botToken,
              chatId: cfg.chatId,
              message: `📞 <b>Час перезвонити!</b>\n\nЗамовлення #${cb.order.orderNum}\n👤 ${cb.order.customer.name}\n📱 ${cb.order.customer.phone}${cb.note ? `\n💬 ${cb.note}` : ''}`,
            });
          }
        }

        result.reminded++;
      } catch (err) {
        result.errors++;
        logger.error(`Callback reminder error for ${cb.id}:`, err);
      }
    }
  } catch (err) {
    result.errors++;
    logger.error('Callback reminder cycle error:', err);
  } finally {
    callbackState.isRunning = false;
    callbackState.lastRun = new Date();
    callbackState.lastResult = result;
  }

  return result;
}

let cronJob: ReturnType<typeof cron.schedule> | null = null;

export function startCallbackReminder() {
  if (cronJob) return;
  cronJob = cron.schedule('*/5 * * * *', () => runCallbackCheck().catch((e) => logger.error('Callback cron error:', e)));
  logger.info('Callback reminder: started (every 5 minutes)');
}

export function stopCallbackReminder() {
  if (cronJob) { cronJob.stop(); cronJob = null; }
}
