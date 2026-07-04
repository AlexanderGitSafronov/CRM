import cron from 'node-cron';
import prisma from '../services/prisma';
import { getTrackingStatuses } from '../services/novaPoshta';
import { applyStatusTimestamps } from '../services/orderGuards';
import { createNotification, logActivity } from '../services/notifications';
import { sendTelegramMessage, escapeHtml } from '../services/telegram';
import { sendIncomeToRashod, reverseIncomeToRashod } from '../services/rashodWebhook';
import { sendOrderStatusByIdToAdtrack } from '../services/adtrackWebhook';
import { sendSmsToCustomer, getTurboSmsConfig } from '../services/turbosms';
import { broadcastEvent } from '../services/eventBus';
import { checkAchievements } from '../services/achievements';
import logger from '../utils/logger';

export const trackerState = {
  lastRun: null as Date | null,
  lastResult: null as { checked: number; updated: number; errors: number } | null,
  isRunning: false,
  nextRun: null as Date | null,
};

// One cycle iterates per-org so each org's NP key is used.
export async function runTrackingCycle(): Promise<{ checked: number; updated: number; errors: number }> {
  if (trackerState.isRunning) {
    logger.info('NP Tracker: already running, skipping');
    return { checked: 0, updated: 0, errors: 0 };
  }

  trackerState.isRunning = true;
  logger.info('NP Tracker: starting cycle');

  const result = { checked: 0, updated: 0, errors: 0 };

  // Кеш TurboSMS-конфіга на час одного циклу, щоб не перевитягувати інтеграцію
  // для кожного замовлення/нагадування. Значення може бути null (TurboSMS не
  // налаштовано/не активовано) — це валідний кешований результат.
  const smsConfigCache = new Map<string, Awaited<ReturnType<typeof getTurboSmsConfig>>>();
  const resolveSmsConfig = async (organizationId: string) => {
    if (smsConfigCache.has(organizationId)) return smsConfigCache.get(organizationId)!;
    const cfg = await getTurboSmsConfig(prisma, organizationId);
    smsConfigCache.set(organizationId, cfg);
    return cfg;
  };

  try {
    // Get all orgs that have at least one SHIPPED order with TTN
    const orgsWithShipped = await prisma.order.findMany({
      where: { trackingNumber: { not: null }, status: 'SHIPPED' },
      select: { organizationId: true },
      distinct: ['organizationId'],
    });

    for (const { organizationId } of orgsWithShipped) {
      const integration = await prisma.integration.findUnique({
        where: { organizationId_type: { organizationId, type: 'NOVA_POSHTA_SENDER' } },
      });
      // Глобальный env-ключ — только выделенному орг (NP_GLOBAL_KEY_ORG_ID), не всем тенантам.
      const globalKey =
        process.env.NP_GLOBAL_KEY_ORG_ID && organizationId === process.env.NP_GLOBAL_KEY_ORG_ID
          ? process.env.NP_API_KEY || ''
          : '';
      const apiKey = integration
        ? (JSON.parse(integration.config) as { apiKey?: string }).apiKey || globalKey
        : globalKey;

      if (!apiKey) {
        logger.warn(`NP Tracker: no API key for org ${organizationId}, skipping`);
        continue;
      }

      const orders = await prisma.order.findMany({
        where: { organizationId, trackingNumber: { not: null }, status: 'SHIPPED' },
        select: {
          id: true, orderNum: true, trackingNumber: true, managerId: true,
          total: true, source: true, organizationId: true,
          shippedAt: true, deliveredAt: true, returnedAt: true, rashodReversedAt: true,
          npArrivedAt: true,
          npArrivalNotifiedAt: true, deliveryCity: true, deliveryAddress: true,
          customer: { select: { name: true, phone: true } },
        },
      });

      if (!orders.length) continue;
      result.checked += orders.length;

      const BATCH_SIZE = 100;
      for (let i = 0; i < orders.length; i += BATCH_SIZE) {
        const batch = orders.slice(i, i + BATCH_SIZE);
        const ttns = batch.map((o) => o.trackingNumber!);

        try {
          const statuses = await getTrackingStatuses(ttns, apiKey);

          for (const status of statuses) {
            const order = batch.find((o) => o.trackingNumber === status.ttn);
            if (!order) continue;

            // Посилка прибула до відділення (коди 7/8/14): фіксуємо момент прибуття,
            // але НЕ змінюємо статус і НЕ визнаємо виручку. Пишемо лише один раз (null-guard),
            // тож повторні цикли не перетирають таймстемп і не тригерять побічні ефекти.
            if (!status.crmStatus) {
              if (status.arrived && !order.npArrivedAt) {
                // Таймстемп прибуття не залежить від SMS — ставимо завжди.
                const arrivalData: { npArrivedAt: Date; npArrivalNotifiedAt?: Date } = {
                  npArrivedAt: new Date(),
                };

                // Сповіщаємо клієнта про прибуття один раз (дедуп по npArrivalNotifiedAt).
                // Якщо TurboSMS не налаштовано (cfg === null) — лишаємо npArrivalNotifiedAt
                // порожнім, щоб орг міг сповістити пізніше, якщо ввімкне SMS.
                // Раз сповістили — більше не шлемо.
                if (!order.npArrivalNotifiedAt) {
                  const cfg = await resolveSmsConfig(organizationId);
                  if (cfg && cfg.smsOnArrival !== false) {
                    const location = order.deliveryAddress?.trim() || order.deliveryCity?.trim() || '';
                    const where = location ? ` ${location}` : '';
                    sendSmsToCustomer(
                      order.customer.phone,
                      `Ваше замовлення №${order.orderNum} прибуло у відділення${where}. ТТН ${order.trackingNumber}. Очікуємо вас!`,
                      cfg,
                    ).catch(() => {});
                    arrivalData.npArrivalNotifiedAt = new Date();
                  }
                }

                await prisma.order.update({
                  where: { id: order.id },
                  data: arrivalData,
                });
              }
              continue;
            }

            // Реальний фінальний статус (DELIVERED/RETURNED): проставляємо lifecycle-таймстемп.
            // Для DELIVERED надаємо перевагу фактичній даті отримання від НП (actualDeliveryDate).
            const timestamps = applyStatusTimestamps(status.crmStatus, order);
            if (status.crmStatus === 'DELIVERED' && 'deliveredAt' in timestamps && status.actualDeliveryDate) {
              const actual = new Date(status.actualDeliveryDate);
              if (!Number.isNaN(actual.getTime())) {
                timestamps.deliveredAt = actual;
              }
            }

            await prisma.order.update({
              where: { id: order.id },
              data: { status: status.crmStatus, ...timestamps },
            });

            await prisma.orderHistory.create({
              data: { orderId: order.id, action: 'STATUS_CHANGED', oldValue: 'SHIPPED', newValue: status.crmStatus },
            });

            const statusLabel = status.crmStatus === 'DELIVERED' ? 'Доставлено' : 'Повернення';
            await createNotification({
              organizationId,
              userId: order.managerId ?? undefined,
              type: 'STATUS_CHANGE',
              title: `Замовлення #${order.orderNum} — ${statusLabel}`,
              message: `${order.customer.name} · ТТН ${status.ttn}`,
              entityId: order.id,
            });

            try {
              const tgIntegration = await prisma.integration.findUnique({
                where: { organizationId_type: { organizationId, type: 'TELEGRAM' } },
              });
              if (tgIntegration?.active) {
                const cfg = JSON.parse(tgIntegration.config) as { botToken: string; chatId: string };
                if (cfg.botToken && cfg.chatId) {
                  const emoji = status.crmStatus === 'DELIVERED' ? '✅' : '↩️';
                  await sendTelegramMessage({
                    botToken: cfg.botToken,
                    chatId: cfg.chatId,
                    message: `${emoji} <b>Замовлення #${order.orderNum}</b>\n${escapeHtml(order.customer.name)}\nТТН: <code>${escapeHtml(status.ttn)}</code>\nСтатус: ${statusLabel}`,
                  });
                }
              }
            } catch (tgErr) {
              logger.error('NP Tracker telegram error:', tgErr);
            }

            await logActivity({
              organizationId,
              action: 'NP_STATUS_UPDATED', entityType: 'Order', entityId: order.id,
              details: `TTN ${status.ttn}: ${status.statusText} → ${status.crmStatus}`,
            });

            if (status.crmStatus === 'DELIVERED') {
              sendIncomeToRashod({
                organizationId, orderId: order.id, orderNum: order.orderNum,
                total: order.total, source: order.source, deliveredAt: new Date(),
              }).catch(() => {});
              broadcastEvent(organizationId, 'order_delivered', { orderNum: order.orderNum, total: order.total });
              void checkAchievements(organizationId);
            }

            // Возврат ранее выкупленного заказа: реверсим доход в Rashod (негативная
            // сумма) и штампуем rashodReversedAt для дедупа. Зеркалит логику
            // orderController. deliveredAt берём из выборки (до этого перехода).
            if (
              status.crmStatus === 'RETURNED' &&
              order.deliveredAt != null &&
              order.rashodReversedAt == null
            ) {
              reverseIncomeToRashod({
                organizationId, orderId: order.id, orderNum: order.orderNum,
                total: order.total, source: order.source, returnedAt: new Date(),
              }).catch(() => {});
              await prisma.order.update({
                where: { id: order.id },
                data: { rashodReversedAt: new Date() },
              }).catch(() => {});
            }

            // AdTrack: подтверждённый выкуп / возврат — главный сигнал для FB CAPI.
            void sendOrderStatusByIdToAdtrack(order.id, status.crmStatus);

            if (status.crmStatus === 'RETURNED') {
              try {
                const smsConfig = await resolveSmsConfig(organizationId);
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

      // Нагадування про невикуплену посилку: прибула > 2 днів тому, ще SHIPPED,
      // нагадування ще не слали. Це лише читання БД — ЖОДНИХ додаткових викликів НП API.
      // Дедуп по npReminderSentAt. Якщо TurboSMS не налаштовано — тихо пропускаємо.
      try {
        const reminderCfg = await resolveSmsConfig(organizationId);
        if (reminderCfg && reminderCfg.smsOnArrival !== false) {
          const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
          const toRemind = await prisma.order.findMany({
            where: {
              organizationId,
              status: 'SHIPPED',
              npArrivedAt: { not: null, lte: twoDaysAgo },
              npReminderSentAt: null,
              trackingNumber: { not: null },
            },
            select: {
              id: true, orderNum: true, trackingNumber: true,
              customer: { select: { phone: true } },
            },
            take: 100,
          });

          for (const ord of toRemind) {
            sendSmsToCustomer(
              ord.customer.phone,
              `Нагадуємо: замовлення №${ord.orderNum} очікує у відділенні. ТТН ${ord.trackingNumber}. Заберіть, будь ласка, щоб не повернулось.`,
              reminderCfg,
            ).catch(() => {});
            await prisma.order.update({
              where: { id: ord.id },
              data: { npReminderSentAt: new Date() },
            });
          }
        }
      } catch (reminderErr) {
        logger.error('NP Tracker reminder error:', reminderErr);
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
const CRON_SCHEDULE = process.env.NP_TRACKER_CRON || '0 */3 * * *';

export function startNpTracker() {
  if (cronJob) return;
  logger.info(`NP Tracker: scheduling with cron "${CRON_SCHEDULE}"`);
  cronJob = cron.schedule(CRON_SCHEDULE, async () => {
    await runTrackingCycle();
    trackerState.nextRun = getNextRunDate();
  });
  trackerState.nextRun = getNextRunDate();
  logger.info(`NP Tracker: started. Next run: ${trackerState.nextRun?.toISOString()}`);
}

export function stopNpTracker() {
  if (cronJob) { cronJob.stop(); cronJob = null; logger.info('NP Tracker: stopped'); }
}

function getNextRunDate(): Date {
  const match = CRON_SCHEDULE.match(/^0 \*\/(\d+) \* \* \*$/);
  const intervalHours = match ? parseInt(match[1]) : 3;
  const now = new Date();
  const next = new Date(now);
  const currentHour = now.getHours();
  const hoursUntilNext = intervalHours - (currentHour % intervalHours);
  next.setHours(currentHour + hoursUntilNext, 0, 0, 0);
  return next;
}
