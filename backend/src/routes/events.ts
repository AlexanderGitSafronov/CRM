import { Router, Request, Response } from 'express';
import { addSseClient, removeSseClient } from '../services/eventBus';
import prisma from '../services/prisma';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  let decoded: { id: string } | null = null;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { active: true, organizationId: true, organization: { select: { active: true } } },
  });
  if (!user || !user.active || !user.organization?.active) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write('event: connected\ndata: {}\n\n');

  addSseClient(user.organizationId, res);

  const ping = setInterval(() => {
    try {
      res.write('event: ping\ndata: {}\n\n');
    } catch {
      clearInterval(ping);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    removeSseClient(user.organizationId, res);
  });
});

export default router;
