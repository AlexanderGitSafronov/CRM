import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';

export const getProducts = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { search, active, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = { organizationId: orgId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (active !== undefined) {
    where.active = active === 'true';
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        _count: { select: { orderItems: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return res.json({
    products: products.map((p) => ({
      ...p,
      margin: p.salePrice - p.purchasePrice,
      marginPercent: p.purchasePrice > 0 ? ((p.salePrice - p.purchasePrice) / p.purchasePrice) * 100 : 0,
      totalSold: p._count.orderItems,
      _count: undefined,
    })),
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
};

export const getProduct = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const product = await prisma.product.findFirst({
    where: { id, organizationId: orgId },
    include: { _count: { select: { orderItems: true } } },
  });

  if (!product) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  return res.json({
    ...product,
    margin: product.salePrice - product.purchasePrice,
    marginPercent:
      product.purchasePrice > 0
        ? ((product.salePrice - product.purchasePrice) / product.purchasePrice) * 100
        : 0,
    totalSold: product._count.orderItems,
    _count: undefined,
  });
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { name, sku, description, purchasePrice, salePrice, stock, image } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Product name required' });
  }

  // Plan limit check
  const [org, productCount] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { maxProducts: true } }),
    prisma.product.count({ where: { organizationId: orgId } }),
  ]);
  if (org && productCount >= org.maxProducts) {
    return res.status(402).json({ error: `Ліміт тарифу: максимум ${org.maxProducts} товарів. Оновіть план.` });
  }

  const product = await prisma.product.create({
    data: {
      organizationId: orgId,
      name: name.trim(),
      sku: sku?.trim() || null,
      description: description?.trim() || null,
      purchasePrice: parseFloat(purchasePrice) || 0,
      salePrice: parseFloat(salePrice) || 0,
      stock: parseInt(stock) || 0,
      lowStockThreshold: req.body.lowStockThreshold !== undefined ? Math.max(0, parseInt(req.body.lowStockThreshold)) : 5,
      image: image?.trim() || null,
    },
  });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'PRODUCT_CREATED',
    entityType: 'Product',
    entityId: product.id,
    details: product.name,
    ip: req.ip,
  });

  return res.status(201).json(product);
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const { name, sku, description, purchasePrice, salePrice, stock, lowStockThreshold, image, active } = req.body;

  const existing = await prisma.product.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: 'Товар не найден' });

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(sku !== undefined && { sku: sku?.trim() || null }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(purchasePrice !== undefined && { purchasePrice: parseFloat(purchasePrice) }),
      ...(salePrice !== undefined && { salePrice: parseFloat(salePrice) }),
      ...(stock !== undefined && { stock: parseInt(stock), lowStockNotifiedAt: null }),
      ...(lowStockThreshold !== undefined && { lowStockThreshold: Math.max(0, parseInt(lowStockThreshold)) }),
      ...(image !== undefined && { image: image?.trim() || null }),
      ...(active !== undefined && { active: Boolean(active) }),
    },
  });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'PRODUCT_UPDATED',
    entityType: 'Product',
    entityId: id,
    ip: req.ip,
  });

  return res.json(product);
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;

  const existing = await prisma.product.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: 'Товар не найден' });

  const inUse = await prisma.orderItem.count({ where: { productId: id } });
  if (inUse > 0) {
    await prisma.product.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'Product deactivated (has orders)' });
  }

  await prisma.product.delete({ where: { id } });

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'PRODUCT_DELETED',
    entityType: 'Product',
    entityId: id,
    ip: req.ip,
  });

  return res.json({ message: 'Product deleted' });
};

export const updateStock = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { id } = req.params;
  const { stock, delta } = req.body;

  const existing = await prisma.product.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!existing) return res.status(404).json({ error: 'Товар не найден' });

  if (stock !== undefined) {
    const product = await prisma.product.update({
      where: { id },
      data: { stock: parseInt(stock) },
    });
    return res.json(product);
  }

  if (delta !== undefined) {
    const product = await prisma.product.update({
      where: { id },
      data: { stock: { increment: parseInt(delta) } },
    });
    return res.json(product);
  }

  return res.status(400).json({ error: 'stock or delta required' });
};
