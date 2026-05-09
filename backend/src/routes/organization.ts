import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';

const router = Router();
router.use(authenticate);

// GET /api/organization — current workspace info + usage stats
router.get('/', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;

  const [org, userCount, productCount, monthOrderCount] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, name: true, slug: true, plan: true,
        maxUsers: true, maxOrders: true, maxProducts: true,
        subscriptionStatus: true, currentPeriodEnd: true, trialEndsAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: { organizationId: orgId, active: true } }),
    prisma.product.count({ where: { organizationId: orgId } }),
    prisma.order.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  if (!org) return res.status(404).json({ error: 'Organization not found' });

  return res.json({
    ...org,
    usage: {
      users: userCount,
      products: productCount,
      ordersThisMonth: monthOrderCount,
    },
  });
});

// PUT /api/organization — update name/slug
router.put('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { name } = req.body as { name?: string };

  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: { name: name.trim().slice(0, 80) },
  });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'ORG_UPDATED',
    details: `name -> ${org.name}`,
    ip: req.ip,
  });

  return res.json(org);
});

export default router;
