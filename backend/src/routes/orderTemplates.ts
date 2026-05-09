import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const templates = await prisma.orderTemplate.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(templates.map((t) => ({ ...t, items: JSON.parse(t.items) })));
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { name, items, source, comment } = req.body as {
    name?: string;
    items?: Array<{ productId?: string; name: string; quantity: number; price: number }>;
    source?: string;
    comment?: string;
  };

  if (!name?.trim()) return res.status(400).json({ error: 'Назва обов\'язкова' });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Хоча б один товар' });

  const template = await prisma.orderTemplate.create({
    data: {
      organizationId: orgId,
      name: name.trim().slice(0, 80),
      items: JSON.stringify(items),
      source: source || null,
      comment: comment?.trim() || null,
    },
  });

  return res.status(201).json({ ...template, items: JSON.parse(template.items) });
});

router.put('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const existing = await prisma.orderTemplate.findFirst({ where: { id, organizationId: orgId } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });

  const { name, items, source, comment } = req.body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = String(name).trim().slice(0, 80);
  if (items !== undefined) data.items = JSON.stringify(items);
  if (source !== undefined) data.source = source || null;
  if (comment !== undefined) data.comment = comment?.trim() || null;

  const t = await prisma.orderTemplate.update({ where: { id }, data });
  return res.json({ ...t, items: JSON.parse(t.items) });
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const existing = await prisma.orderTemplate.findFirst({ where: { id, organizationId: orgId } });
  if (!existing) return res.status(404).json({ error: 'Не знайдено' });
  await prisma.orderTemplate.delete({ where: { id } });
  return res.json({ message: 'Видалено' });
});

export default router;
