import { Router, Request, Response } from 'express';
import { addSseClient, removeSseClient } from '../services/eventBus';
import prisma from '../services/prisma';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/events/ticket — короткоживущий (60s) тикет для подключения к SSE.
// EventSource не умеет ставить Authorization-заголовок, поэтому фронт сначала
// берёт тикет этим запросом, а затем открывает GET /?ticket=... — длинный
// 7-дневный JWT больше не попадает в query string / серверные логи.
router.post('/ticket', authenticate, (req: AuthRequest, res: Response) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const ticket = jwt.sign(
    { id: req.user!.id, scope: 'sse' },
    process.env.JWT_SECRET,
    { expiresIn: '60s', algorithm: 'HS256' },
  );
  return res.json({ ticket });
});

router.get('/', async (req: Request, res: Response) => {
  // ?ticket= — новый короткоживущий тикет; ?token= — легаси (обратная совместимость).
  const token = (req.query.ticket || req.query.token) as string;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  let decoded: { id: string; iat?: number } | null = null;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
      iat?: number;
    };
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      active: true,
      organizationId: true,
      passwordChangedAt: true,
      organization: { select: { active: true } },
    },
  });
  if (!user || !user.active || !user.organization?.active) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Токены, выданные до смены пароля, считаем отозванными.
  // Тикеты живут 60s, так что их это не ломает.
  if (
    decoded.iat &&
    user.passwordChangedAt &&
    decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
  ) {
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
