import { Router, Request, Response } from 'express';
import { addSseClient, removeSseClient } from '../services/eventBus';
import prisma from '../services/prisma';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  // Auth via query param (EventSource doesn't support headers)
  const token = req.query.token as string;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded: { id: string } | null = null;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string };
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Verify user is still active
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { active: true },
  });
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write('event: connected\ndata: {}\n\n');

  addSseClient(res);

  // Keep-alive ping every 25s
  const ping = setInterval(() => {
    try {
      res.write('event: ping\ndata: {}\n\n');
    } catch {
      clearInterval(ping);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    removeSseClient(res);
  });
});

export default router;
