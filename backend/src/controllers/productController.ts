import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';
import { parsePagination } from '../utils/pagination';

// Безопасный разбор числа из тела запроса: нечисло/NaN → null (не пишем в Prisma).
const numOrNull = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v.trim() || null : null);

// Image input validator — accepts data:image/* (raster only) or https:// URL.
// Rejects javascript:, file:, data:text/html, and SVG (script-bearing).
export function validateImage(input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === undefined) return { ok: true, value: undefined as unknown as null };
  if (input === null || input === '') return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false, error: 'image must be a string' };
  if (input.length > 500_000) return { ok: false, error: 'Зображення занадто велике (макс ~500KB)' };
  const isData = /^data:image\/(png|jpe?g|webp|gif);base64,/.test(input);
  const isHttps = /^https:\/\/[^\s<>"]+$/.test(input);
  if (!isData && !isHttps) return { ok: false, error: 'Невалідний формат зображення' };
  return { ok: true, value: input };
}

export const getProducts = async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { search, active } = req.query as Record<string, string>;
  // lite=true — без тяжёлого base64-поля image (для формы заказа/поиска, где картинка не нужна):
  // раньше OrderForm тянул до 200 товаров с картинками (~10-20MB) при каждом открытии.
  const lite = req.query.lite === 'true';

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

  const { page: pageNum, limit: limitNum, skip } = parsePagination(req.query.page, req.query.limit, { defLimit: 50, maxLimit: 200 });

  const products = lite
    ? await prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
        select: {
          id: true, name: true, sku: true, salePrice: true, purchasePrice: true,
          stock: true, active: true, lowStockThreshold: true,
          _count: { select: { orderItems: true } },
        },
      })
    : await prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limitNum,
        include: { _count: { select: { orderItems: true } } },
      });
  const total = await prisma.product.count({ where });

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

  if (typeof name !== 'string' || !name.trim()) {
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

  const imgCheck = validateImage(image?.trim());
  if (!imgCheck.ok) return res.status(400).json({ error: imgCheck.error });

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
      image: imgCheck.value,
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

  let imagePatch: { image: string | null } | object = {};
  if (image !== undefined) {
    const imgCheck = validateImage(image?.trim());
    if (!imgCheck.ok) return res.status(400).json({ error: imgCheck.error });
    imagePatch = { image: imgCheck.value };
  }

  // Числовые поля: нечисло/NaN игнорируем (не пишем в Prisma), иначе float NaN → 500.
  // Строковые: .trim() только для строк.
  const purchase = numOrNull(purchasePrice);
  const sale = numOrNull(salePrice);
  const stockNum = numOrNull(stock);
  const lowStock = numOrNull(lowStockThreshold);

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(typeof name === 'string' && name.trim() && { name: name.trim() }),
      ...(sku !== undefined && { sku: strOrNull(sku) }),
      ...(description !== undefined && { description: strOrNull(description) }),
      ...(purchase !== null && { purchasePrice: purchase }),
      ...(sale !== null && { salePrice: sale }),
      ...(stockNum !== null && { stock: Math.trunc(stockNum), lowStockNotifiedAt: null }),
      ...(lowStock !== null && { lowStockThreshold: Math.max(0, Math.trunc(lowStock)) }),
      ...imagePatch,
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
    const n = numOrNull(stock);
    if (n === null) return res.status(400).json({ error: 'Invalid stock' });
    const product = await prisma.product.update({
      where: { id },
      data: { stock: Math.trunc(n) },
    });
    return res.json(product);
  }

  if (delta !== undefined) {
    const n = numOrNull(delta);
    if (n === null) return res.status(400).json({ error: 'Invalid delta' });
    const product = await prisma.product.update({
      where: { id },
      data: { stock: { increment: Math.trunc(n) } },
    });
    return res.json(product);
  }

  return res.status(400).json({ error: 'stock or delta required' });
};
