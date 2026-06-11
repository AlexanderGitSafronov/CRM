import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { done, mine, orderId } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { organizationId: orgId };
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

router.post('/', requireRole('ADMIN', 'MANAGER', 'CALL_CENTER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { orderId, scheduledAt, note, managerId } = req.body;

  if (!orderId || !scheduledAt) {
    return res.status(400).json({ error: 'orderId and scheduledAt required' });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId: orgId },
    select: { orderNum: true, managerId: true },
  });

  if (!order) return res.status(404).json({ error: 'Заказ не найден' });

  if (managerId) {
    const manager = await prisma.user.findFirst({
      where: { id: managerId, organizationId: orgId },
      select: { id: true },
    });
    if (!manager) return res.status(400).json({ error: 'Invalid managerId' });
  }

  const assignedManagerId = managerId || order.managerId || req.user?.id;

  const callback = await prisma.callback.create({
    data: {
      organizationId: orgId,
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
    organizationId: orgId,
    userId: req.user?.id,
    action: 'CALLBACK_CREATED',
    entityType: 'Order',
    entityId: orderId,
    details: `Перезвон: ${new Date(scheduledAt).toLocaleString('uk-UA')}`,
    ip: req.ip,
  });

  return res.status(201).json(callback);
});

router.patch('/:id/done', requireRole('ADMIN', 'MANAGER', 'CALL_CENTER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const cb = await prisma.callback.findFirst({ where: { id: req.params.id, organizationId: orgId } });
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

router.delete('/:id', requireRole('ADMIN', 'MANAGER', 'CALL_CENTER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const existing = await prisma.callback.findFirst({ where: { id: req.params.id, organizationId: orgId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: 'Не найдено' });
  await prisma.callback.delete({ where: { id: req.params.id } });
  return res.json({ success: true });
});

export default router;
