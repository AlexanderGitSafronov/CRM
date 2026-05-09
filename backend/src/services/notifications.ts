import prisma from './prisma';
import { sendTelegramMessage, formatOrderNotification } from './telegram';
import logger from '../utils/logger';

export async function createNotification({
  organizationId,
  userId,
  type,
  title,
  message,
  entityId,
}: {
  organizationId: string;
  userId?: string | null;
  type: string;
  title: string;
  message: string;
  entityId?: string;
}) {
  try {
    if (userId) {
      await prisma.notification.create({
        data: { organizationId, userId, type, title, message, entityId },
      });
    } else {
      // Notify all admins and managers in this organization
      const users = await prisma.user.findMany({
        where: { organizationId, active: true, role: { in: ['ADMIN', 'MANAGER'] } },
        select: { id: true },
      });
      if (users.length) {
        await prisma.notification.createMany({
          data: users.map((u) => ({ organizationId, userId: u.id, type, title, message, entityId })),
        });
      }
    }
  } catch (error) {
    logger.error('Create notification error:', error);
  }
}

export async function notifyNewOrder(order: {
  organizationId: string;
  id: string;
  orderNum: number;
  customer: { name: string; phone: string };
  total: number;
  source: string;
  items: Array<{ name: string; quantity: number; price: number }>;
}) {
  await createNotification({
    organizationId: order.organizationId,
    type: 'NEW_ORDER',
    title: `Новый заказ #${order.orderNum}`,
    message: `${order.customer.name} — ${order.total.toLocaleString('uk-UA')} грн`,
    entityId: order.id,
  });

  // Send Telegram notification if configured for this org
  try {
    const telegramIntegration = await prisma.integration.findUnique({
      where: { organizationId_type: { organizationId: order.organizationId, type: 'TELEGRAM' } },
    });

    if (telegramIntegration?.active) {
      const config = JSON.parse(telegramIntegration.config) as { botToken: string; chatId: string };
      if (config.botToken && config.chatId) {
        const message = formatOrderNotification(order);
        await sendTelegramMessage({
          botToken: config.botToken,
          chatId: config.chatId,
          message,
          inlineKeyboard: [[
            { text: '✅ Підтвердити', callback_data: `confirm:${order.id}` },
            { text: '❌ Відмова', callback_data: `cancel:${order.id}` },
          ]],
        });
      }
    }
  } catch (error) {
    logger.error('Telegram notification error:', error);
  }
}

export async function logActivity({
  organizationId,
  userId,
  action,
  entityType,
  entityId,
  details,
  ip,
}: {
  organizationId: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  ip?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: { organizationId, userId, action, entityType, entityId, details, ip },
    });
  } catch (error) {
    logger.error('Log activity error:', error);
  }
}
