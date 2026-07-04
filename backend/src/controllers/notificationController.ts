import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';
import { parsePagination } from '../utils/pagination';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { unreadOnly, page, limit } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {
    organizationId: orgId,
    userId: req.user!.id,
  };
  if (unreadOnly === 'true') where.read = false;

  const { page: pageNum, limit: limitNum, skip } = parsePagination(page, limit);

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { organizationId: orgId, userId: req.user!.id, read: false },
    }),
  ]);

  return res.json({
    notifications,
    unreadCount,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
};

export const markRead = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  await prisma.notification.updateMany({
    where: { id, organizationId: orgId, userId: req.user!.id },
    data: { read: true },
  });

  return res.json({ message: 'Marked as read' });
};

export const markAllRead = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  await prisma.notification.updateMany({
    where: { organizationId: orgId, userId: req.user!.id, read: false },
    data: { read: true },
  });

  return res.json({ message: 'All marked as read' });
};

export const markReadByEntity = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { entityId } = req.params;
  await prisma.notification.updateMany({
    where: { entityId, organizationId: orgId, userId: req.user!.id, read: false },
    data: { read: true },
  });
  return res.json({ message: 'Marked as read' });
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  await prisma.notification.deleteMany({
    where: { id, organizationId: orgId, userId: req.user!.id },
  });
  return res.json({ message: 'Deleted' });
};
