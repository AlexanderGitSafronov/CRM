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
        logo: true, primaryColor: true,
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

// PUT /api/organization — update name/branding
router.put('/', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { name, logo, primaryColor } = req.body as { name?: string; logo?: string | null; primaryColor?: string | null };

  const data: Record<string, unknown> = {};
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name required' });
    data.name = name.trim().slice(0, 80);
  }
  if (logo !== undefined) {
    // Only data:image URLs are allowed. Arbitrary http(s) URLs are an SSRF
    // and tracking vector when rendered as <img src=...> in the browser
    // (e.g. requests to internal IPs / metadata services from the user's
    // network). The client uploader produces data: URLs anyway.
    if (logo && typeof logo === 'string') {
      if (logo.length > 500_000) return res.status(400).json({ error: 'Логотип занадто великий (макс ~500KB)' });
      // Disallow SVG — it can contain <script> that runs when used as
      // <object>/<iframe> source. Raster formats only.
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(logo)) {
        return res.status(400).json({ error: 'Невалідний формат логотипу (тільки PNG/JPG/WebP/GIF)' });
      }
      data.logo = logo;
    } else {
      data.logo = null;
    }
  }
  if (primaryColor !== undefined) {
    if (primaryColor && typeof primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      data.primaryColor = primaryColor;
    } else {
      data.primaryColor = null;
    }
  }

  const org = await prisma.organization.update({ where: { id: orgId }, data });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'ORG_UPDATED',
    details: Object.keys(data).join(','),
    ip: req.ip,
  });

  return res.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    logo: org.logo,
    primaryColor: org.primaryColor,
  });
});

// GET /api/organization/branding — public-ish branding (used by frontend on every page)
router.get('/branding', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, logo: true, primaryColor: true },
  });
  return res.json(org);
});

export default router;
