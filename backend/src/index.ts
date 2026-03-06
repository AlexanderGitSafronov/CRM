import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import logger from './utils/logger';
import prisma from './services/prisma';
import { startNpTracker } from './workers/npTracker';
import { startSlaTracker } from './workers/slaTracker';
import { startCallbackReminder } from './workers/callbackReminder';

// Security guard: warn about insecure defaults
const JWT_SECRET = process.env.JWT_SECRET;
const INSECURE_DEFAULTS = ['secret', 'your-super-secret-jwt-key-change-in-production', ''];
if (!JWT_SECRET || INSECURE_DEFAULTS.includes(JWT_SECRET)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is not set or uses an insecure default. Refusing to start in production.');
    process.exit(1);
  } else {
    console.warn('WARNING: JWT_SECRET is not set or uses an insecure default. Do not use this in production!');
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Railway's reverse proxy
app.set('trust proxy', 1);

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Managed separately for API server
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Token'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// Stricter limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts' },
});
app.use('/api/auth/login', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// 404 and error handling
app.use(notFound);
app.use(errorHandler);

async function seedIfEmpty() {
  const count = await prisma.user.count();
  if (count > 0) return;
  logger.info('No users found — running initial seed...');
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: { name: 'Администратор', email: 'admin@crm.com', password: hash, role: 'ADMIN' },
  });
  await prisma.integration.createMany({
    data: [
      { type: 'TELEGRAM', name: 'Telegram Bot', config: JSON.stringify({ botToken: '', chatId: '' }), active: false },
      { type: 'WEBHOOK', name: 'Webhook API', config: JSON.stringify({}), active: true },
    ],
    skipDuplicates: true,
  });
  await prisma.webhookToken.upsert({
    where: { token: 'demo-webhook-token-change-in-production' },
    update: {},
    create: { name: 'Default Webhook', token: 'demo-webhook-token-change-in-production' },
  });
  logger.info('Seed complete. Admin: admin@crm.com / admin123');
}

app.listen(PORT, async () => {
  logger.info(`🚀 CRM Backend running on http://localhost:${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  await seedIfEmpty();
  startNpTracker();
  startSlaTracker();
  startCallbackReminder();
});

export default app;
