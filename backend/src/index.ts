import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import logger from './utils/logger';

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

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
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

app.listen(PORT, () => {
  logger.info(`🚀 CRM Backend running on http://localhost:${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
