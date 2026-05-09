import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../services/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    organizationId: string;
  };
}

const getJwtSecret = (): string => {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error('JWT_SECRET is not configured');
  }
  return s;
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      email: string;
      role: string;
      name: string;
      organizationId?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, email: true, role: true, name: true, active: true, organizationId: true,
        organization: { select: { active: true } },
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Unauthorized: User not found or inactive' });
    }
    if (!user.organization?.active) {
      return res.status(403).json({ error: 'Workspace is suspended' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

// Helper: build a where clause that automatically scopes to the org
export const orgScope = (req: AuthRequest, extra: Record<string, unknown> = {}) => ({
  organizationId: req.user!.organizationId,
  ...extra,
});
