import prisma from './prisma';
import { broadcastEvent } from './eventBus';
import logger from '../utils/logger';

interface AchievementDef {
  code: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  // Returns true if condition is currently satisfied
  check: (stats: OrgStats) => boolean;
}

interface OrgStats {
  delivered: number;
  totalRevenue: number;
  customers: number;
  products: number;
  orders: number;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // Order milestones
  { code: 'first_order',     title: 'Перший заказ',           description: 'Створено перше замовлення', icon: 'Sparkles',     check: (s) => s.orders >= 1 },
  { code: 'orders_10',       title: '10 замовлень',           description: 'Шлях розпочато',          icon: 'Trophy',         check: (s) => s.orders >= 10 },
  { code: 'orders_100',      title: '100 замовлень',          description: 'Серйозна справа',         icon: 'Award',          check: (s) => s.orders >= 100 },
  { code: 'orders_1000',     title: '1000 замовлень',         description: 'Майстер продажів',        icon: 'Crown',          check: (s) => s.orders >= 1000 },
  // Delivered milestones
  { code: 'first_delivered', title: 'Перша доставка',         description: 'Перший заказ доставлено', icon: 'PackageCheck',   check: (s) => s.delivered >= 1 },
  { code: 'delivered_100',   title: '100 доставок',           description: 'Логістика відлажена',     icon: 'Truck',          check: (s) => s.delivered >= 100 },
  { code: 'delivered_500',   title: '500 доставок',           description: 'Купа щасливих клієнтів',  icon: 'Truck',          check: (s) => s.delivered >= 500 },
  { code: 'delivered_1000',  title: '1000 доставок',          description: 'Тисячник',                icon: 'Trophy',         check: (s) => s.delivered >= 1000 },
  // Revenue milestones
  { code: 'revenue_10k',     title: '10 000 ₴ виручки',       description: 'Перші серйозні гроші',    icon: 'TrendingUp',     check: (s) => s.totalRevenue >= 10_000 },
  { code: 'revenue_100k',    title: '100 000 ₴ виручки',      description: 'На повний хід',           icon: 'DollarSign',     check: (s) => s.totalRevenue >= 100_000 },
  { code: 'revenue_500k',    title: '500 000 ₴ виручки',      description: 'Півмільйона',             icon: 'Coins',          check: (s) => s.totalRevenue >= 500_000 },
  { code: 'revenue_1m',      title: '1 000 000 ₴ виручки',    description: 'Мільйонер',               icon: 'Crown',          check: (s) => s.totalRevenue >= 1_000_000 },
  // Catalog
  { code: 'products_10',     title: '10 товарів',             description: 'Каталог росте',           icon: 'Package',        check: (s) => s.products >= 10 },
  { code: 'products_50',     title: '50 товарів',             description: 'Великий асортимент',      icon: 'Package',        check: (s) => s.products >= 50 },
  // Customers
  { code: 'customers_50',    title: '50 клієнтів',            description: 'База росте',              icon: 'Users',          check: (s) => s.customers >= 50 },
  { code: 'customers_500',   title: '500 клієнтів',           description: 'Команда мрії',            icon: 'Users',          check: (s) => s.customers >= 500 },
];

async function computeStats(orgId: string): Promise<OrgStats> {
  const [delivered, revenueAgg, customers, products, orders] = await Promise.all([
    prisma.order.count({ where: { organizationId: orgId, status: 'DELIVERED' } }),
    prisma.order.aggregate({ where: { organizationId: orgId, status: 'DELIVERED' }, _sum: { total: true } }),
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.product.count({ where: { organizationId: orgId } }),
    prisma.order.count({ where: { organizationId: orgId } }),
  ]);
  return {
    delivered,
    totalRevenue: revenueAgg._sum.total ?? 0,
    customers,
    products,
    orders,
  };
}

// Re-evaluates achievements for an org. Persists newly unlocked ones.
// Broadcasts SSE 'achievement_unlocked' for celebrations.
export async function checkAchievements(orgId: string): Promise<void> {
  try {
    const [stats, existing] = await Promise.all([
      computeStats(orgId),
      prisma.achievement.findMany({ where: { organizationId: orgId }, select: { code: true } }),
    ]);
    const have = new Set(existing.map((a) => a.code));

    for (const def of ACHIEVEMENT_DEFS) {
      if (have.has(def.code)) continue;
      if (!def.check(stats)) continue;
      try {
        const created = await prisma.achievement.create({
          data: {
            organizationId: orgId,
            code: def.code,
            title: def.title,
            description: def.description,
            icon: def.icon,
          },
        });
        broadcastEvent(orgId, 'achievement_unlocked', {
          code: created.code,
          title: created.title,
          description: created.description,
          icon: created.icon,
        });
      } catch {
        /* race: ignore unique conflict */
      }
    }
  } catch (e) {
    logger.error('checkAchievements error:', e);
  }
}
