import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';

export const getUsers = async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      avatar: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return res.json(users);
};

export const createUser = async (req: AuthRequest, res: Response) => {
  const { name, email, password, role = 'MANAGER' } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }

  const validRoles = ['ADMIN', 'MANAGER', 'VIEWER', 'CALL_CENTER'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: await bcrypt.hash(password, 10),
      role,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  await logActivity({
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
  const { id } = req.params;
  const { name, email, role, active, password } = req.body;

  // Prevent self-demotion from admin
  if (id === req.user?.id && role && role !== 'ADMIN' && req.user.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
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
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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
  const { id } = req.params;

  if (id === req.user?.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Transfer orders to null manager
  await prisma.order.updateMany({ where: { managerId: id }, data: { managerId: null } });

  await prisma.user.delete({ where: { id } });

  await logActivity({
    userId: req.user?.id,
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: id,
    details: user.name,
    ip: req.ip,
  });

  return res.json({ message: 'User deleted' });
};
