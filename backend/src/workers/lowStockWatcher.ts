import cron from 'node-cron';
import prisma from '../services/prisma';
import { createNotification, logActivity } from '../services/notifications';
import { sendTelegramMessage } from '../services/telegram';
import logger from '../utils/logger';

export const lowStockState = {
  lastRun: null as Date | null,
  lastResult: null as { checked: number; alerted: number } | null,
  isRunning: false,
};

const RENOTIFY_AFTER_HOURS = 24;

export async function runLowStockCheck(): Promise<{ checked: number; alerted: number }> {
  if (lowStockState.isRunning) return { checked: 0, alerted: 0 };
  lowStockState.isRunning = true;
  const result = { checked: 0, alerted: 0 };

  try {
    // Group by org so we can hit Telegram once per org with a digest
    const orgs = await prisma.organization.findMany({
      where: { active: true },
      select: { id: true },
    });

    for (const { id: orgId } of orgs) {
      const cutoff = new Date(Date.now() - RENOTIFY_AFTER_HOURS * 60 * 60 * 1000);
      const products = await prisma.product.findMany({
        where: {
          organizationId: orgId,
          active: true,
          stock: { lte: prisma.product.fields.lowStockThreshold },
          OR: [
            { lowStockNotifiedAt: null },
            { lowStockNotifiedAt: { lt: cutoff } },
          ],
        },
        select: { id: true, name: true, sku: true, stock: true, lowStockThreshold: true },
        take: 50,
      });

      result.checked += products.length;

      if (!products.length) continue;

      // In-app notification for admins/managers
      await createNotification({
        organizationId: orgId,
        type: 'LOW_STOCK',
        title: `${products.length} товарів закінчуються`,
        message: products.slice(0, 5).map((p) => `${p.name} — ${p.stock}/${p.lowStockThreshold}`).join('; '),
      });

      // Telegram digest
      try {
        const tg = await prisma.integration.findUnique({
          where: { organizationId_type: { organizationId: orgId, type: 'TELEGRAM' } },
        });
        if (tg?.active) {
          const cfg = JSON.parse(tg.config) as { botToken: string; chatId: string };
          if (cfg.botToken && cfg.chatId) {
            const lines = products.slice(0, 15).map((p) =>
              `• <b>${escapeHtml(p.name)}</b>${p.sku ? ` (<code>${escapeHtml(p.sku)}</code>)` : ''} — залишок <b>${p.stock}</b> з ${p.lowStockThreshold}`
            ).join('\n');
            const msg = `📦 <b>Закінчуються товари</b> (${products.length})\n\n${lines}${products.length > 15 ? `\n\n…та ще ${products.length - 15}` : ''}`;
            await sendTelegramMessage({ botToken: cfg.botToken, chatId: cfg.chatId, message: msg });
          }
        }
      } catch (tgErr) {
        logger.error('Low stock telegram error:', tgErr);
      }

      // Mark as notified
      await prisma.product.updateMany({
        where: { id: { in: products.map((p) => p.id) } },
        data: { lowStockNotifiedAt: new Date() },
      });

      await logActivity({
        organizationId: orgId,
        action: 'LOW_STOCK_DIGEST',
        details: `Notified about ${products.length} low-stock products`,
      });

      result.alerted += products.length;
    }
  } catch (err) {
    logger.error('Low stock cycle error:', err);
  } finally {
    lowStockState.isRunning = false;
    lowStockState.lastRun = new Date();
    lowStockState.lastResult = result;
  }

  logger.info(`Low stock: checked=${result.checked} alerted=${result.alerted}`);
  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let cronJob: ReturnType<typeof cron.schedule> | null = null;
const SCHEDULE = process.env.LOW_STOCK_CRON || '0 9 * * *'; // every day at 09:00

export function startLowStockWatcher() {
  if (cronJob) return;
  cronJob = cron.schedule(SCHEDULE, () => runLowStockCheck().catch((e) => logger.error('low stock cron err:', e)));
  logger.info(`Low stock watcher: scheduled "${SCHEDULE}"`);
}

export function stopLowStockWatcher() {
  if (cronJob) { cronJob.stop(); cronJob = null; }
}
