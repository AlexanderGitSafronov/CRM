import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';

const router = Router();
router.use(authenticate);

// Compute current period progress for a goal
async function computeProgress(orgId: string, goal: { startDate: Date; endDate: Date; targetRevenue: number; targetOrders: number }) {
  const where = {
    organizationId: orgId,
    createdAt: { gte: goal.startDate, lte: goal.endDate },
    status: { notIn: ['CANCELLED', 'RETURNED'] },
  };
  const [agg, count] = await Promise.all([
    prisma.order.aggregate({ where, _sum: { total: true } }),
    prisma.order.count({ where }),
  ]);
  const revenue = agg._sum.total ?? 0;
  const orders = count;
  const now = Date.now();
  const periodMs = goal.endDate.getTime() - goal.startDate.getTime();
  const elapsedMs = Math.min(periodMs, Math.max(0, now - goal.startDate.getTime()));
  const elapsedPct = periodMs > 0 ? Math.round((elapsedMs / periodMs) * 100) : 0;

  return {
    revenue,
    orders,
    revenuePct: goal.targetRevenue > 0 ? Math.round((revenue / goal.targetRevenue) * 100) : 0,
    ordersPct: goal.targetOrders > 0 ? Math.round((orders / goal.targetOrders) * 100) : 0,
    elapsedPct,
    daysLeft: Math.max(0, Math.ceil((goal.endDate.getTime() - now) / 86_400_000)),
  };
}

// GET /api/goals — list with progress (раскрывает выручку/цели — только ADMIN/MANAGER)
router.get('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { active } = req.query as Record<string, string>;
  const where: Record<string, unknown> = { organizationId: orgId };
  if (active === 'true') where.active = true;

  const goals = await prisma.salesGoal.findMany({
    where,
    orderBy: [{ active: 'desc' }, { startDate: 'desc' }],
  });

  const withProgress = await Promise.all(
    goals.map(async (g) => ({ ...g, progress: await computeProgress(orgId, g) })),
  );
  return res.json(withProgress);
});

// POST /api/goals
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { period, startDate, endDate, targetRevenue, targetOrders } = req.body as {
    period?: string;
    startDate?: string;
    endDate?: string;
    targetRevenue?: number;
    targetOrders?: number;
  };

  if (!period || !startDate || !endDate) return res.status(400).json({ error: 'period, startDate, endDate обовʼязкові' });
  if (!['MONTH', 'QUARTER', 'YEAR'].includes(period)) return res.status(400).json({ error: 'Invalid period' });
  const sd = new Date(startDate);
  const ed = new Date(endDate);
  if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || ed <= sd) return res.status(400).json({ error: 'Invalid dates' });

  const goal = await prisma.salesGoal.create({
    data: {
      organizationId: orgId,
      period,
      startDate: sd,
      endDate: ed,
      targetRevenue: Math.max(0, Number(targetRevenue) || 0),
      targetOrders: Math.max(0, parseInt(String(targetOrders || 0))),
    },
  });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'GOAL_CREATED',
    details: `${period}: ${goal.targetRevenue}₴ / ${goal.targetOrders} orders`,
    ip: req.ip,
  });

  return res.status(201).json(goal);
});

// PUT /api/goals/:id
router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const existing = await prisma.salesGoal.findFirst({ where: { id, organizationId: orgId } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });

  const { period, startDate, endDate, targetRevenue, targetOrders, active } = req.body;
  const data: Record<string, unknown> = {};
  if (period !== undefined && ['MONTH', 'QUARTER', 'YEAR'].includes(period)) data.period = period;
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = new Date(endDate);
  if (targetRevenue !== undefined) data.targetRevenue = Math.max(0, Number(targetRevenue) || 0);
  if (targetOrders !== undefined) data.targetOrders = Math.max(0, parseInt(String(targetOrders)));
  if (active !== undefined) data.active = Boolean(active);

  const goal = await prisma.salesGoal.update({ where: { id }, data });
  return res.json(goal);
});

// DELETE /api/goals/:id
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const existing = await prisma.salesGoal.findFirst({ where: { id, organizationId: orgId } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  await prisma.salesGoal.delete({ where: { id } });
  return res.json({ message: 'Видалено' });
});

export default router;
