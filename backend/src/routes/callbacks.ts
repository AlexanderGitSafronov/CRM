import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { createNotification, logActivity } from '../services/notifications';

const router = Router();
router.use(authenticate);

// GET /api/callbacks — list (optionally filter: ?done=false, ?mine=true)
router.get('/', async (req: AuthRequest, res: Response) => {
  const { done, mine, orderId } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (done !== undefined) where.done = done === 'true';
  if (mine === 'true') where.managerId = req.user!.id;
  if (orderId) where.orderId = orderId;

  const callbacks = await prisma.callback.findMany({
    where,
    orderBy: { scheduledAt: 'asc' },
    include: {
      order: { select: { orderNum: true, status: true, customer: { select: { name: true, phone: true } } } },
      manager: { select: { id: true, name: true } },
    },
  });

  return res.json(callbacks);
});

// POST /api/callbacks — create callback reminder
router.post('/', requireRole('ADMIN', 'MANAGER', 'CALL_CENTER'), async (req: AuthRequest, res: Response) => {
  const { orderId, scheduledAt, note, managerId } = req.body;

  if (!orderId || !scheduledAt) {
    return res.status(400).json({ error: 'orderId and scheduledAt required' });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNum: true, managerId: true },
  });

  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  const assignedManagerId = managerId || order.managerId || req.user?.id;

  const callback = await prisma.callback.create({
    data: {
      orderId,
      managerId: assignedManagerId || null,
      scheduledAt: new Date(scheduledAt),
      note: note?.trim() || null,
    },
    include: {
      order: { select: { orderNum: true, customer: { select: { name: true, phone: true } } } },
      manager: { select: { id: true, name: true } },
    },
  });

  await logActivity({
    userId: req.user?.id,
    action: 'CALLBACK_CREATED',
    entityType: 'Order',
    entityId: orderId,
    details: `Перезвон: ${new Date(scheduledAt).toLocaleString('uk-UA')}`,
    ip: req.ip,
  });

  return res.status(201).json(callback);
});

// PATCH /api/callbacks/:id/done — mark as done
router.patch('/:id/done', requireRole('ADMIN', 'MANAGER', 'CALL_CENTER'), async (req: AuthRequest, res: Response) => {
  const cb = await prisma.callback.findUnique({ where: { id: req.params.id } });
  if (!cb) return res.status(404).json({ error: 'Не найдено' });

  const updated = await prisma.callback.update({
    where: { id: req.params.id },
    data: { done: true, doneAt: new Date() },
    include: {
      order: { select: { orderNum: true, customer: { select: { name: true, phone: true } } } },
    },
  });

  return res.json(updated);
});

// DELETE /api/callbacks/:id
router.delete('/:id', requireRole('ADMIN', 'MANAGER', 'CALL_CENTER'), async (req: AuthRequest, res: Response) => {
  await prisma.callback.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

export default router;
