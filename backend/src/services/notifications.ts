import prisma from './prisma';
import { sendTelegramMessage, formatOrderNotification } from './telegram';
import logger from '../utils/logger';

export async function createNotification({
  userId,
  type,
  title,
  message,
  entityId,
}: {
  userId?: string | null;
  type: string;
  title: string;
  message: string;
  entityId?: string;
}) {
  try {
    if (userId) {
      await prisma.notification.create({
        data: { userId, type, title, message, entityId },
      });
    } else {
      // Notify all admins and managers
      const users = await prisma.user.findMany({
        where: { active: true, role: { in: ['ADMIN', 'MANAGER'] } },
        select: { id: true },
      });
      await prisma.notification.createMany({
        data: users.map((u) => ({ userId: u.id, type, title, message, entityId })),
      });
    }
  } catch (error) {
    logger.error('Create notification error:', error);
  }
}

export async function notifyNewOrder(order: {
  id: string;
  orderNum: number;
  customer: { name: string; phone: string };
  total: number;
  source: string;
  items: Array<{ name: string; quantity: number; price: number }>;
}) {
  await createNotification({
    type: 'NEW_ORDER',
    title: `Новый заказ #${order.orderNum}`,
    message: `${order.customer.name} — ${order.total.toLocaleString('uk-UA')} грн`,
    entityId: order.id,
  });

  // Send Telegram notification if configured
  try {
    const telegramIntegration = await prisma.integration.findUnique({
      where: { type: 'TELEGRAM' },
    });

    if (telegramIntegration?.active) {
      const config = JSON.parse(telegramIntegration.config) as { botToken: string; chatId: string };
      if (config.botToken && config.chatId) {
        const message = formatOrderNotification(order);
        await sendTelegramMessage({
          botToken: config.botToken,
          chatId: config.chatId,
          message,
        });
      }
    }
  } catch (error) {
    logger.error('Telegram notification error:', error);
  }
}

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  details,
  ip,
}: {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  ip?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: { userId, action, entityType, entityId, details, ip },
    });
  } catch (error) {
    logger.error('Log activity error:', error);
  }
}
