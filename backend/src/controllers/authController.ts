import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../services/prisma';
import { logActivity } from '../services/notifications';
import { sendMail, renderVerificationEmail, renderPasswordResetEmail } from '../services/email';
import { AuthRequest } from '../middleware/auth';

const JWT_SECRET = (): string => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not configured');
  return s;
};

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordIssue = (pw: string): string | null => {
  if (typeof pw !== 'string') return 'Password required';
  if (pw.length < 8) return 'Пароль має містити мінімум 8 символів';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Пароль має містити літери та цифри';
  return null;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9а-яёіїєґ\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'workspace';

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  if (!slug) slug = 'workspace';
  for (let i = 0; i < 10; i++) {
    const exists = await prisma.organization.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${slugify(base)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${slugify(base)}-${Date.now().toString(36)}`;
}

const issueToken = (user: { id: string; email: string; role: string; name: string; organizationId: string }) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, organizationId: user.organizationId },
    JWT_SECRET(),
    { expiresIn: JWT_EXPIRES_IN }
  );

const userResponse = (
  user: { id: string; name: string; email: string; role: string; avatar: string | null; emailVerified: boolean; organizationId: string },
  org: { id: string; name: string; slug: string; plan: string }
) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  emailVerified: user.emailVerified,
  organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
});

// POST /api/auth/register — public signup
// Creates a new Organization + ADMIN user atomically
export const register = async (req: Request, res: Response) => {
  const { name, email, password, organizationName } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    organizationName?: string;
  };

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Ім\'я, email та пароль обов\'язкові' });
  }

  const trimmedEmail = email.toLowerCase().trim();
  if (!EMAIL_RX.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Невалідний email' });
  }

  const pwIssue = passwordIssue(password);
  if (pwIssue) return res.status(400).json({ error: pwIssue });

  const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Користувач з таким email вже існує' });
  }

  const orgName = (organizationName?.trim() || `${name.trim()}'s Workspace`).slice(0, 80);
  const slug = await uniqueSlug(orgName);
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        plan: 'FREE',
        // Default FREE limits set in schema (3 users, 500 orders/mo, 50 products)
      },
    });

    const user = await tx.user.create({
      data: {
        organizationId: org.id,
        name: name.trim(),
        email: trimmedEmail,
        password: passwordHash,
        role: 'ADMIN',
        emailVerified: false,
      },
    });

    // Bootstrap a webhook token for the new org
    await tx.webhookToken.create({
      data: {
        organizationId: org.id,
        name: 'Default',
        token: crypto.randomBytes(24).toString('hex'),
      },
    });

    // Bootstrap default integrations (inactive)
    await tx.integration.createMany({
      data: [
        { organizationId: org.id, type: 'TELEGRAM', name: 'Telegram Bot', config: '{"botToken":"","chatId":""}', active: false },
        { organizationId: org.id, type: 'WEBHOOK', name: 'Webhook API', config: '{}', active: true },
      ],
    });

    return { org, user };
  });

  // Email verification (best-effort, don't block signup)
  try {
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await prisma.emailVerification.create({
      data: {
        organizationId: result.org.id,
        userId: result.user.id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;
    await sendMail({
      to: trimmedEmail,
      subject: 'Підтвердіть email — CRM Pro',
      html: renderVerificationEmail({ name: name.trim(), verifyUrl }),
    });
  } catch (err) {
    // Logged inside sendMail; continue
  }

  await logActivity({
    organizationId: result.org.id,
    userId: result.user.id,
    action: 'USER_REGISTERED',
    details: `New workspace "${result.org.name}" registered`,
    ip: req.ip,
  });

  const token = issueToken(result.user);
  return res.status(201).json({
    token,
    user: userResponse(result.user, result.org),
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { organization: true },
  });

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Невірний email або пароль' });
  }
  if (!user.organization.active) {
    return res.status(403).json({ error: 'Воркспейс призупинено' });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Невірний email або пароль' });
  }

  const token = issueToken({
    id: user.id, email: user.email, role: user.role, name: user.name, organizationId: user.organizationId,
  });

  await logActivity({
    organizationId: user.organizationId,
    userId: user.id,
    action: 'LOGIN',
    ip: req.ip,
  });

  return res.json({
    token,
    user: userResponse(user, user.organization),
  });
};

export const getMe = async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true, name: true, email: true, role: true, avatar: true, emailVerified: true,
      organizationId: true, createdAt: true,
      organization: { select: { id: true, name: true, slug: true, plan: true, maxUsers: true, maxOrders: true, maxProducts: true } },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    organization: user.organization,
  });
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Passwords required' });
  }

  const pwIssue = passwordIssue(newPassword);
  if (pwIssue) return res.status(400).json({ error: pwIssue });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Невірний поточний пароль' });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { password: hashed },
  });

  return res.json({ message: 'Password changed successfully' });
};

// POST /api/auth/forgot — request password reset (always returns 200, no enumeration)
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  const trimmed = email?.toLowerCase().trim();
  if (!trimmed) return res.json({ message: 'OK' });

  const user = await prisma.user.findUnique({
    where: { email: trimmed },
    select: { id: true, name: true, email: true, organizationId: true },
  });

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordReset.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    try {
      await sendMail({
        to: user.email,
        subject: 'Відновлення паролю — CRM Pro',
        html: renderPasswordResetEmail({ name: user.name, resetUrl }),
      });
    } catch (e) {
      /* logged inside sendMail */
    }
  }

  return res.json({ message: 'Якщо email існує — лист відправлено' });
};

// POST /api/auth/reset — consume reset token
export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) return res.status(400).json({ error: 'token and password required' });

  const pwIssue = passwordIssue(password);
  if (pwIssue) return res.status(400).json({ error: pwIssue });

  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (!reset || reset.consumedAt || reset.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Посилання недійсне або вже використане' });
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { password: hashed } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { consumedAt: new Date() } }),
  ]);

  return res.json({ message: 'Пароль оновлено' });
};

// POST /api/auth/verify — consume email verification token
export const verifyEmail = async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: 'token required' });

  const verification = await prisma.emailVerification.findUnique({ where: { token } });
  if (!verification || verification.consumedAt || verification.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Посилання недійсне або вже використане' });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: verification.userId }, data: { emailVerified: true } }),
    prisma.emailVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } }),
  ]);

  return res.json({ message: 'Email підтверджено' });
};
