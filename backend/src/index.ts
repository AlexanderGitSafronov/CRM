import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import logger from './utils/logger';
import prisma from './services/prisma';
import { startNpTracker } from './workers/npTracker';
import { startSlaTracker } from './workers/slaTracker';
import { startCallbackReminder } from './workers/callbackReminder';
import { startLowStockWatcher } from './workers/lowStockWatcher';

// Hard fail: production must have a real JWT secret
const JWT_SECRET = process.env.JWT_SECRET;
const INSECURE_DEFAULTS = ['secret', 'your-super-secret-jwt-key-change-in-production', ''];
if (!JWT_SECRET || INSECURE_DEFAULTS.includes(JWT_SECRET)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is not set or uses an insecure default. Refusing to start in production.');
    process.exit(1);
  }
  console.warn('WARNING: JWT_SECRET is not set or uses an insecure default. Do not use this in production!');
}
if (JWT_SECRET && JWT_SECRET.length < 32 && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET must be at least 32 chars in production.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// Multi-origin CORS: allow comma-separated CORS_ORIGIN list
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / curl
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    return cb(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Token'],
}));

// General rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// Stricter limit for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts' },
});
app.use('/api/auth/login', loginLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

// One-time bootstrap: ensure default org exists and has admin (preserves any pre-existing data).
// New SaaS users sign up via POST /api/auth/register — no demo seed needed.
async function bootstrapDefaultOrg() {
  const defaultOrgId = 'org_default';
  const org = await prisma.organization.findUnique({ where: { id: defaultOrgId } });
  if (!org) {
    await prisma.organization.create({
      data: {
        id: defaultOrgId,
        name: 'Default Workspace',
        slug: 'default',
        plan: 'BUSINESS',
        maxUsers: 100,
        maxOrders: 100000,
        maxProducts: 10000,
      },
    });
    logger.info('Created default organization');
  }

  const adminCount = await prisma.user.count({ where: { organizationId: defaultOrgId, role: 'ADMIN' } });
  if (adminCount === 0 && process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    await prisma.user.create({
      data: {
        organizationId: defaultOrgId,
        name: 'Administrator',
        email: process.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
        password: await bcrypt.hash(process.env.BOOTSTRAP_ADMIN_PASSWORD, 10),
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    logger.info(`Created bootstrap admin: ${process.env.BOOTSTRAP_ADMIN_EMAIL}`);
  }

  // Ensure default org has at least one webhook token
  const tokenCount = await prisma.webhookToken.count({ where: { organizationId: defaultOrgId } });
  if (tokenCount === 0) {
    await prisma.webhookToken.create({
      data: {
        organizationId: defaultOrgId,
        name: 'Default',
        token: crypto.randomBytes(24).toString('hex'),
      },
    });
    logger.info('Created default webhook token for default org');
  }
}

app.listen(PORT, async () => {
  logger.info(`🚀 CRM Backend running on http://localhost:${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  try {
    await bootstrapDefaultOrg();
  } catch (e) {
    logger.error('Bootstrap error (non-fatal):', e);
  }
  startNpTracker();
  startSlaTracker();
  startCallbackReminder();
  startLowStockWatcher();
});

export default app;
