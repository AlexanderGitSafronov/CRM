import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';

export const getUsers = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const users = await prisma.user.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      avatar: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return res.json(users);
};

export const createUser = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { name, email, password, role = 'MANAGER' } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }

  const validRoles = ['ADMIN', 'MANAGER', 'VIEWER', 'CALL_CENTER'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль має містити мінімум 8 символів' });
  }

  // Plan limit
  const [org, userCount] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { maxUsers: true } }),
    prisma.user.count({ where: { organizationId: orgId, active: true } }),
  ]);
  if (org && userCount >= org.maxUsers) {
    return res.status(402).json({ error: `Ліміт тарифу: максимум ${org.maxUsers} користувачів. Оновіть план.` });
  }

  const trimmedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      name: name.trim(),
      email: trimmedEmail,
      password: await bcrypt.hash(password, 10),
      role,
      emailVerified: true, // Created by admin — pre-verified
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    details: `${user.name} (${user.role})`,
    ip: req.ip,
  });

  return res.status(201).json(user);
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const { name, email, role, active, password } = req.body;

  // Verify the user belongs to the same org
  const target = await prisma.user.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (id === req.user?.id && role && role !== 'ADMIN' && req.user.role === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { organizationId: orgId, role: 'ADMIN', active: true },
    });
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last admin' });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name.trim();
  if (email) updateData.email = email.toLowerCase().trim();
  if (role) updateData.role = role;
  if (active !== undefined) updateData.active = Boolean(active);
  if (password) {
    if (password.length < 8) {
      return res.status(400).json({ error: 'Пароль має містити мінімум 8 символів' });
    }
    updateData.password = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  return res.json(user);
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  if (id === req.user?.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }

  const user = await prisma.user.findFirst({ where: { id, organizationId: orgId } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  await prisma.order.updateMany({ where: { managerId: id }, data: { managerId: null } });

  await prisma.user.delete({ where: { id } });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: id,
    details: user.name,
    ip: req.ip,
  });

  return res.json({ message: 'User deleted' });
};
