import prisma from './prisma';

export const MAX_ORDER_ITEM_QUANTITY = 10000;
export const MAX_ORDER_ITEM_PRICE = 10000000;

const ORDER_NUM_MAX_ATTEMPTS = 3;

type ItemsCheck = { ok: true } | { ok: false; error: string };

/**
 * Валидация позиций заказа: непустой массив, name — непустая строка,
 * quantity — целое 1..10000, price — конечное число 0..10 000 000.
 */
export function validateOrderItems(items: unknown): ItemsCheck {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'At least one item required' };
  }
  for (const raw of items) {
    const item = raw as { name?: unknown; quantity?: unknown; price?: unknown } | null;
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid order item' };
    }
    if (typeof item.name !== 'string' || !item.name.trim()) {
      return { ok: false, error: 'Item name required' };
    }
    if (
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > MAX_ORDER_ITEM_QUANTITY
    ) {
      return { ok: false, error: `Item quantity must be an integer between 1 and ${MAX_ORDER_ITEM_QUANTITY}` };
    }
    if (
      typeof item.price !== 'number' ||
      !Number.isFinite(item.price) ||
      item.price < 0 ||
      item.price > MAX_ORDER_ITEM_PRICE
    ) {
      return { ok: false, error: `Item price must be a number between 0 and ${MAX_ORDER_ITEM_PRICE}` };
    }
  }
  return { ok: true };
}

/**
 * Месячная квота заказов тарифа (Organization.maxOrders, календарный месяц UTC).
 */
export async function assertOrderQuota(
  organizationId: string
): Promise<{ ok: true } | { ok: false; max: number }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { maxOrders: true },
  });
  if (!org) return { ok: true };

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const count = await prisma.order.count({
    where: { organizationId, createdAt: { gte: monthStart } },
  });

  if (count >= org.maxOrders) {
    return { ok: false, max: org.maxOrders };
  }
  return { ok: true };
}

/**
 * Менеджер из body должен принадлежать той же организации (анти cross-tenant).
 */
export async function validateOrgManagerId(
  organizationId: string,
  managerId: string
): Promise<boolean> {
  const manager = await prisma.user.findFirst({
    where: { id: managerId, organizationId },
    select: { id: true },
  });
  return Boolean(manager);
}

/**
 * Возвращает Set productId, реально принадлежащих организации.
 */
export async function filterOrgProductIds(
  organizationId: string,
  productIds: string[]
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId },
    select: { id: true },
  });
  return new Set(products.map((p) => p.id));
}

/**
 * P2002 по @@unique([organizationId, orderNum]) — гонка генерации orderNum.
 */
function isOrderNumConflict(err: unknown): boolean {
  const e = err as { code?: string; meta?: { target?: unknown } } | null;
  if (!e || e.code !== 'P2002') return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes('orderNum');
  if (typeof target === 'string') return target.includes('orderNum');
  return true; // P2002 без meta — единственный unique на Order это [organizationId, orderNum]
}

/**
 * Генерация orderNum не атомарна: при гонке двух запросов create падает с P2002.
 * Пересчитываем orderNum и пробуем заново (до 3 попыток); прочие ошибки — наружу.
 */
export async function createOrderWithOrderNumRetry<T>(
  organizationId: string,
  create: (orderNum: number) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < ORDER_NUM_MAX_ATTEMPTS; attempt++) {
    const lastOrder = await prisma.order.findFirst({
      where: { organizationId },
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true },
    });
    const orderNum = (lastOrder?.orderNum ?? 0) + 1;
    try {
      return await create(orderNum);
    } catch (err) {
      if (!isOrderNumConflict(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
