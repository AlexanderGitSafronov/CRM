import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/order-views — list shared + my views
router.get('/', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const views = await prisma.orderView.findMany({
    where: {
      organizationId: orgId,
      OR: [{ userId: null }, { userId }],
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return res.json(views.map((v) => ({ ...v, filters: JSON.parse(v.filters) })));
});

// POST /api/order-views — create view
router.post('/', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { name, filters, icon, shared, sortOrder } = req.body as {
    name?: string;
    filters?: Record<string, unknown>;
    icon?: string;
    shared?: boolean;
    sortOrder?: number;
  };

  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  if (!filters || typeof filters !== 'object') return res.status(400).json({ error: 'filters object required' });

  // Only admins/managers can create shared views
  const canShare = req.user!.role === 'ADMIN' || req.user!.role === 'MANAGER';
  const view = await prisma.orderView.create({
    data: {
      organizationId: orgId,
      userId: shared && canShare ? null : userId,
      name: name.trim().slice(0, 60),
      filters: JSON.stringify(filters),
      icon: icon?.trim().slice(0, 16) || null,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
    },
  });
  return res.status(201).json({ ...view, filters: JSON.parse(view.filters) });
});

// PUT /api/order-views/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { id } = req.params;
  const existing = await prisma.orderView.findFirst({
    where: {
      id, organizationId: orgId,
      OR: [{ userId: null }, { userId }],
    },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  // Общий вид (userId=null) может менять только ADMIN/MANAGER (кто их и создаёт);
  // персональный — только владелец или ADMIN.
  const canManageShared = req.user!.role === 'ADMIN' || req.user!.role === 'MANAGER';
  if (existing.userId === null) {
    if (!canManageShared) return res.status(403).json({ error: 'Forbidden' });
  } else if (existing.userId !== userId && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { name, filters, icon, sortOrder } = req.body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = String(name).trim().slice(0, 60);
  if (filters !== undefined) data.filters = JSON.stringify(filters);
  if (icon !== undefined) data.icon = icon?.trim().slice(0, 16) || null;
  if (sortOrder !== undefined) data.sortOrder = parseInt(String(sortOrder));

  const v = await prisma.orderView.update({ where: { id }, data });
  return res.json({ ...v, filters: JSON.parse(v.filters) });
});

// DELETE /api/order-views/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const userId = req.user!.id;
  const { id } = req.params;
  const existing = await prisma.orderView.findFirst({
    where: { id, organizationId: orgId, OR: [{ userId: null }, { userId }] },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const canManageShared = req.user!.role === 'ADMIN' || req.user!.role === 'MANAGER';
  if (existing.userId === null) {
    if (!canManageShared) return res.status(403).json({ error: 'Forbidden' });
  } else if (existing.userId !== userId && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await prisma.orderView.delete({ where: { id } });
  return res.json({ message: 'Deleted' });
});

export default router;
